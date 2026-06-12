import { NextResponse } from "next/server";

// このエンドポイントは廃止されました。
// 採点結果の保存は /api/roleplay (type=score) がサーバー側で直接行います。
export function POST() {
  return NextResponse.json({ error: "Endpoint removed" }, { status: 410 });
}
export function PATCH() {
  return NextResponse.json({ error: "Endpoint removed" }, { status: 410 });
}
