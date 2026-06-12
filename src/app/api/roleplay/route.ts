import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { checkRateLimit } from "@/lib/rateLimit";
import { getServerSupabase } from "@/lib/supabase";
import {
  SCENARIO_IDS,
  buildCustomerPrompt,
  buildScoringPrompt,
  buildObjectionPrompt,
} from "@/lib/scenarios";

// ── リクエストスキーマ ──────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(["staff", "customer"]),
  text: z.string().min(1).max(2000),
});

const ScenarioIdSchema = z.enum(SCENARIO_IDS);

// score/objection 両方で使う保存メタ情報
const MetaSchema = z.object({
  staff_name: z.string().max(50),      // 空文字なら保存スキップ
  scenario_label: z.string().max(100),
  category: z.string().max(50),
  is_random: z.boolean(),
});

const RequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("customer"),
    scenarioId: ScenarioIdSchema,
    messages: z.array(MessageSchema).max(40),
  }),
  z.object({
    type: z.literal("score"),
    scenarioId: ScenarioIdSchema,
    messages: z.array(MessageSchema).min(1).max(40),
    endedBy: z.string().max(100),
  }).merge(MetaSchema),
  z.object({
    type: z.literal("objection"),
    scenarioId: ScenarioIdSchema,
    messages: z.array(MessageSchema).min(1).max(40),
    result_id: z.string().uuid().nullable().optional(),
    scoring: z.object({
      score: z.number().int().min(0).max(100),
      deductions: z.array(
        z.object({ points: z.number().int().min(0), reason: z.string().max(500) })
      ),
    }),
    objection: z.string().min(1).max(1000),
  }),
]);

// ── AI レスポンス Zod スキーマ (Medium: サーバー側検証) ─────────────────────

const CustomerResponseSchema = z.object({
  reply: z.string().min(1),
  guard: z.number().int().min(0).max(100),
  status: z.enum(["continue", "win", "lose"]),
});

const ScoringResponseSchema = z.object({
  score: z.number().int().min(0).max(100),
  highlights: z.array(z.string()),
  deductions: z.array(
    z.object({ points: z.number().int().min(0), reason: z.string() })
  ),
  summary: z.string(),
});

const ObjectionResponseSchema = z.object({
  accepted: z.boolean(),
  new_score: z.number().int().min(0).max(100),
  verdict: z.string(),
});

// ── Claude 呼び出し + Zod 検証 + 1回リトライ ────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function extractJson(text: string): unknown {
  const clean = text.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("JSON not found in response");
  return JSON.parse(clean.slice(start, end + 1));
}

async function callRaw(prompt: string, maxTokens: number): Promise<unknown> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("\n");
  return extractJson(text);
}

async function callClaude<T>(prompt: string, schema: z.ZodSchema<T>, maxTokens: number): Promise<T> {
  let raw: unknown;
  try {
    raw = await callRaw(prompt, maxTokens);
  } catch {
    raw = await callRaw(prompt, maxTokens);
  }
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const raw2 = await callRaw(prompt, maxTokens);
  const parsed2 = schema.safeParse(raw2);
  if (parsed2.success) return parsed2.data;
  throw new Error(`AI response validation failed: ${parsed2.error.message}`);
}

// ── POST ハンドラ ────────────────────────────────────────────────────────────

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

  try {
    // ── customer ──────────────────────────────────────────────────────────
    if (data.type === "customer") {
      const staffTurns = data.messages.filter((m) => m.role === "staff").length;
      if (staffTurns >= 15) {
        return NextResponse.json({
          reply: "（長時間のロープレ、お疲れ様でした。この辺で採点に移りましょう。）",
          guard: 50,
          status: "lose",
        });
      }
      const result = await callClaude(
        buildCustomerPrompt(data.scenarioId, data.messages),
        CustomerResponseSchema,
        1024
      );
      return NextResponse.json(result);
    }

    // ── score ─────────────────────────────────────────────────────────────
    if (data.type === "score") {
      let result: z.infer<typeof ScoringResponseSchema>;
      let scoringFailed = false;
      try {
        result = await callClaude(
          buildScoringPrompt(data.scenarioId, data.messages, data.endedBy),
          ScoringResponseSchema,
          3072
        );
      } catch {
        scoringFailed = true;
        result = {
          score: 50,
          highlights: [],
          deductions: [],
          summary: "採点の生成に失敗しました。もう一度お試しください。",
        };
      }

      // フォールバック時は DB 保存しない
      let result_id: string | null = null;
      if (!scoringFailed && data.staff_name.trim()) {
        const supabase = getServerSupabase();
        const { data: row, error } = await supabase
          .from("roleplay_results")
          .insert({
            staff_name: data.staff_name.trim(),
            scenario_id: data.scenarioId,
            scenario_label: data.scenario_label,
            category: data.category,
            is_random: data.is_random,
            score: result.score,
            highlights: result.highlights,
            deductions: result.deductions,
            summary: result.summary,
            transcript: data.messages,
          })
          .select("id")
          .single();
        if (error) console.error("DB insert error:", error);
        else result_id = row.id;
      }

      return NextResponse.json({ ...result, result_id });
    }

    // ── objection ─────────────────────────────────────────────────────────
    const result = await callClaude(
      buildObjectionPrompt(
        data.scenarioId,
        data.messages,
        data.scoring,
        data.objection
      ),
      ObjectionResponseSchema,
      3072
    );

    // 反論成立かつ result_id があればサーバー側でスコア更新
    if (result.accepted && data.result_id) {
      const supabase = getServerSupabase();
      const { error } = await supabase
        .from("roleplay_results")
        .update({ score: result.new_score })
        .eq("id", data.result_id);
      if (error) console.error("DB update error:", error);
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("Claude API error:", err);
    return NextResponse.json(
      { error: "AI呼び出しに失敗しました。もう一度お試しください。" },
      { status: 500 }
    );
  }
}
