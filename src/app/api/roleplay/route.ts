import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  buildCustomerPrompt,
  buildScoringPrompt,
  buildObjectionPrompt,
} from "@/lib/scenarios";

const MessageSchema = z.object({
  role: z.enum(["staff", "customer"]),
  text: z.string().min(1).max(2000),
});

const RequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("customer"),
    scenarioId: z.string().min(1).max(50),
    messages: z.array(MessageSchema).max(40),
  }),
  z.object({
    type: z.literal("score"),
    scenarioId: z.string().min(1).max(50),
    messages: z.array(MessageSchema).min(1).max(40),
    endedBy: z.string().max(100),
  }),
  z.object({
    type: z.literal("objection"),
    scenarioId: z.string().min(1).max(50),
    messages: z.array(MessageSchema).min(1).max(40),
    scoring: z.object({
      score: z.number().int().min(0).max(100),
      deductions: z.array(
        z.object({ points: z.number().int().min(0), reason: z.string().max(500) })
      ),
    }),
    objection: z.string().min(1).max(1000),
  }),
]);

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaude(prompt: string) {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");

  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON not found in response");
  return JSON.parse(clean.slice(start, end + 1));
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const { allowed } = checkRateLimit(ip);
  if (!allowed) {
    return NextResponse.json(
      { error: "リクエストが多すぎます。1分後に再試行してください。" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "入力が不正です", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Enforce 15-turn limit for customer calls
  if (data.type === "customer") {
    const staffTurns = data.messages.filter((m) => m.role === "staff").length;
    if (staffTurns >= 15) {
      return NextResponse.json({
        reply: "（長時間のロープレ、お疲れ様でした。この辺で採点に移りましょう。）",
        guard: 50,
        status: "lose",
      });
    }
  }

  try {
    let prompt: string;
    if (data.type === "customer") {
      prompt = buildCustomerPrompt(data.scenarioId, data.messages);
    } else if (data.type === "score") {
      prompt = buildScoringPrompt(data.scenarioId, data.messages, data.endedBy);
    } else {
      prompt = buildObjectionPrompt(
        data.scenarioId,
        data.messages,
        data.scoring,
        data.objection
      );
    }

    const result = await callClaude(prompt);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { error: "AI呼び出しに失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }
}
