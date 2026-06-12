import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getServerSupabase } from "@/lib/supabase";

const SaveSchema = z.object({
  staff_name: z.string().min(1).max(50),
  scenario_id: z.string().min(1).max(50),
  scenario_label: z.string().max(100),
  category: z.string().max(50),
  is_random: z.boolean(),
  score: z.number().int().min(0).max(100),
  highlights: z.array(z.string().max(500)).default([]),
  deductions: z.array(
    z.object({ points: z.number().int().min(0), reason: z.string().max(500) })
  ),
  summary: z.string().max(1000).default(""),
  transcript: z.array(
    z.object({ role: z.enum(["staff", "customer"]), text: z.string().max(2000) })
  ),
});

const UpdateScoreSchema = z.object({
  id: z.string().uuid(),
  score: z.number().int().min(0).max(100),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("roleplay_results")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateScoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "入力が不正です" }, { status: 400 });
  }

  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("roleplay_results")
    .update({ score: parsed.data.score })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("Supabase update error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
