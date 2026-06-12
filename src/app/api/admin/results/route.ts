import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

function checkAuth(req: NextRequest): boolean {
  const auth = req.headers.get("x-admin-password");
  return !!auth && auth === process.env.ADMIN_PASSWORD;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? "0"), 0);

  const supabase = getServerSupabase();

  // 一覧は transcript を除外して軽量化
  const { data, error, count } = await supabase
    .from("roleplay_results")
    .select(
      "id, staff_name, scenario_id, scenario_label, category, is_random, score, highlights, deductions, summary, created_at",
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Supabase fetch error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }

  return NextResponse.json({ data, total: count ?? 0, limit, offset });
}
