"use client";

import { useState } from "react";
import type { RoleplayResult } from "@/lib/types";

const C = {
  bg: "#FFF4E0",
  ink: "#4A3F35",
  white: "#FFFFFF",
  pink: "#FF5D8F",
  pinkSoft: "#FFE3EC",
  sky: "#4FB8FF",
  skySoft: "#E1F2FF",
  gold: "#FFC53D",
  green: "#3FCF8E",
  greenSoft: "#E2F8EE",
  gray: "#9B8F82",
};

function cardStyle(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background: C.white,
    border: `2.5px solid ${C.ink}`,
    borderRadius: 20,
    boxShadow: `4px 4px 0 ${C.ink}`,
    ...extra,
  };
}

function scoreColor(s: number) {
  return s >= 85 ? C.pink : s >= 75 ? C.gold : s >= 60 ? C.sky : C.gray;
}

// 一覧レコード (transcript なし)
type ResultSummary = Omit<RoleplayResult, "transcript">;

interface PageData {
  data: ResultSummary[];
  total: number;
  limit: number;
  offset: number;
}

interface StaffStats {
  name: string;
  avg: number;
  count: number;
}

const PAGE_SIZE = 20;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [storedPassword, setStoredPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterName, setFilterName] = useState("");
  const [selected, setSelected] = useState<RoleplayResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  async function fetchPage(pw: string, offset: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      const res = await fetch(`/api/admin/results?${params}`, {
        headers: { "x-admin-password": pw },
      });
      if (res.status === 401) {
        setAuthError("パスワードが違います");
        setLoading(false);
        return false;
      }
      const json: PageData = await res.json();
      setPageData(json);
      return true;
    } catch {
      setAuthError("通信エラーが発生しました");
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    setLoading(true);
    setAuthError("");
    const ok = await fetchPage(password, 0);
    if (ok) {
      setStoredPassword(password);
      setAuthed(true);
    }
  }

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/results/${id}`, {
        headers: { "x-admin-password": storedPassword },
      });
      if (res.ok) {
        const detail: RoleplayResult = await res.json();
        setSelected(detail);
      }
    } catch {
      // silent
    } finally {
      setDetailLoading(false);
    }
  }

  const allResults = pageData?.data ?? [];
  const filtered = filterName
    ? allResults.filter((r) => r.staff_name.includes(filterName))
    : allResults;

  const staffStats: StaffStats[] = (() => {
    const map = new Map<string, number[]>();
    for (const r of allResults) {
      if (!map.has(r.staff_name)) map.set(r.staff_name, []);
      map.get(r.staff_name)!.push(r.score);
    }
    return Array.from(map.entries())
      .map(([name, scores]) => ({
        name,
        avg: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
        count: scores.length,
      }))
      .sort((a, b) => b.avg - a.avg);
  })();

  const currentOffset = pageData?.offset ?? 0;
  const total = pageData?.total ?? 0;
  const hasPrev = currentOffset > 0;
  const hasNext = currentOffset + PAGE_SIZE < total;

  if (!authed) {
    return (
      <div className="pop-body min-h-screen flex items-center justify-center px-4" style={{ background: C.bg, color: C.ink }}>
        <div className="w-full max-w-sm p-6" style={cardStyle()}>
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="pop-display text-2xl">管理者ログイン</h1>
            <p className="text-xs font-bold mt-1" style={{ color: C.gray }}>営業道場 管理画面</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && login()}
            placeholder="管理者パスワード"
            className="w-full p-3 mb-3 outline-none text-sm font-bold"
            style={cardStyle({ borderRadius: 16, boxShadow: `3px 3px 0 ${C.ink}` })}
          />
          {authError && <p className="text-xs font-bold mb-2" style={{ color: C.pink }}>{authError}</p>}
          <button
            onClick={login}
            disabled={loading || !password}
            className="w-full py-3 pop-display text-sm rounded-2xl"
            style={{
              background: loading || !password ? "#E5DCCB" : C.pink,
              color: "#fff",
              border: `2.5px solid ${C.ink}`,
              boxShadow: `3px 3px 0 ${C.ink}`,
            }}
          >
            {loading ? "確認中…" : "ログイン"}
          </button>
          <div className="mt-4 text-center">
            <a href="/" className="text-xs font-bold" style={{ color: C.gray }}>← 道場にもどる</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pop-body min-h-screen pb-8" style={{ background: C.bg, color: C.ink }}>
      <header className="px-4 pt-5 pb-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold tracking-wider" style={{ color: C.gray }}>合同会社AimHigh</div>
            <h1 className="pop-display text-2xl leading-tight">
              管理者<span style={{ color: C.pink }}>ダッシュボード</span>
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => fetchPage(storedPassword, 0)}
              className="text-xs font-bold px-3 py-2 rounded-xl"
              style={cardStyle({ borderRadius: 14, boxShadow: `3px 3px 0 ${C.ink}` })}
            >
              🔄 更新
            </button>
            <a href="/" className="text-xs font-bold px-3 py-2 rounded-xl" style={cardStyle({ borderRadius: 14, boxShadow: `3px 3px 0 ${C.ink}` })}>
              🏠 道場
            </a>
          </div>
        </div>
      </header>

      <main className="px-4 max-w-3xl mx-auto space-y-6">
        {/* スタッフ別平均点 */}
        <section>
          <h2 className="pop-display text-base mb-3">🏆 スタッフ別平均点（表示中 {allResults.length} 件）</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {staffStats.map((s) => (
              <div key={s.name} className="p-3 text-center" style={cardStyle({ borderRadius: 16 })}>
                <div className="text-xs font-bold mb-1" style={{ color: C.gray }}>{s.name}</div>
                <div className="pop-display text-3xl" style={{ color: scoreColor(s.avg) }}>{s.avg}</div>
                <div className="text-[10px] font-bold mt-1" style={{ color: C.gray }}>{s.count}戦</div>
              </div>
            ))}
            {staffStats.length === 0 && (
              <div className="col-span-2 sm:col-span-3 p-5 text-center" style={cardStyle()}>
                <p className="text-sm font-bold" style={{ color: C.gray }}>まだ記録がありません</p>
              </div>
            )}
          </div>
        </section>

        {/* フィルター + 一覧 */}
        <section>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="pop-display text-base">📋 成績一覧</h2>
            <span className="text-xs font-bold" style={{ color: C.gray }}>全{total}件</span>
            <input
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="名前で絞り込み"
              className="flex-1 px-3 py-1.5 text-xs font-bold outline-none"
              style={cardStyle({ borderRadius: 12, boxShadow: `2px 2px 0 ${C.ink}` })}
            />
          </div>

          <div className="space-y-2">
            {filtered.map((r) => (
              <button
                key={r.id}
                onClick={() => openDetail(r.id)}
                className="w-full text-left p-3 transition-all active:translate-y-0.5"
                style={cardStyle({ borderRadius: 16 })}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-extrabold">{r.staff_name}</div>
                    <div className="text-xs font-bold mt-0.5" style={{ color: C.gray }}>
                      {r.scenario_label}{r.is_random ? " 🎲" : ""} · {new Date(r.created_at).toLocaleDateString("ja-JP")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {detailLoading && <span className="text-xs" style={{ color: C.gray }}>…</span>}
                    <div className="pop-display text-2xl" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                  </div>
                </div>
              </button>
            ))}
            {filtered.length === 0 && !loading && (
              <div className="p-5 text-center" style={cardStyle()}>
                <p className="text-sm font-bold" style={{ color: C.gray }}>該当する記録がありません</p>
              </div>
            )}
          </div>

          {/* ページネーション */}
          {(hasPrev || hasNext) && (
            <div className="flex gap-3 mt-4 justify-center">
              <button
                onClick={() => fetchPage(storedPassword, currentOffset - PAGE_SIZE)}
                disabled={!hasPrev || loading}
                className="px-4 py-2 text-sm font-bold rounded-xl"
                style={cardStyle({
                  borderRadius: 14,
                  background: hasPrev && !loading ? C.white : "#E5DCCB",
                  boxShadow: `3px 3px 0 ${C.ink}`,
                })}
              >
                ← 前のページ
              </button>
              <span className="flex items-center text-xs font-bold" style={{ color: C.gray }}>
                {currentOffset + 1}–{Math.min(currentOffset + PAGE_SIZE, total)} / {total}件
              </span>
              <button
                onClick={() => fetchPage(storedPassword, currentOffset + PAGE_SIZE)}
                disabled={!hasNext || loading}
                className="px-4 py-2 text-sm font-bold rounded-xl"
                style={cardStyle({
                  borderRadius: 14,
                  background: hasNext && !loading ? C.white : "#E5DCCB",
                  boxShadow: `3px 3px 0 ${C.ink}`,
                })}
              >
                次のページ →
              </button>
            </div>
          )}
        </section>
      </main>

      {/* 詳細モーダル */}
      {selected && (
        <div
          className="fixed inset-0 flex items-end sm:items-center justify-center p-4 z-50"
          style={{ background: "rgba(74,63,53,0.6)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg max-h-[85vh] overflow-y-auto p-5"
            style={cardStyle({ borderRadius: 24 })}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="pop-display text-lg">{selected.staff_name}</h3>
                <p className="text-xs font-bold" style={{ color: C.gray }}>
                  {selected.scenario_label}{selected.is_random ? " 🎲" : ""} · {new Date(selected.created_at).toLocaleDateString("ja-JP")}
                </p>
              </div>
              <div className="pop-display text-4xl" style={{ color: scoreColor(selected.score) }}>{selected.score}</div>
            </div>

            <div className="p-3 mb-3 rounded-2xl" style={{ background: C.greenSoft, border: `2px solid ${C.ink}` }}>
              <h4 className="pop-display text-sm mb-2" style={{ color: "#1E8A5C" }}>🌟 よかったところ</h4>
              <ul className="text-xs font-bold space-y-1">
                {selected.highlights?.map((h, i) => <li key={i}>{h}</li>)}
                {(!selected.highlights || selected.highlights.length === 0) && (
                  <li style={{ color: C.gray }}>記録なし</li>
                )}
              </ul>
            </div>

            {selected.summary && (
              <div className="p-3 mb-3 rounded-2xl" style={{ background: C.skySoft, border: `2px solid ${C.ink}` }}>
                <h4 className="pop-display text-sm mb-2" style={{ color: "#1B6FB0" }}>📝 そうひょう</h4>
                <p className="text-xs font-bold leading-relaxed">{selected.summary}</p>
              </div>
            )}

            <div className="p-3 mb-3 rounded-2xl" style={{ background: C.pinkSoft, border: `2px solid ${C.ink}` }}>
              <h4 className="pop-display text-sm mb-2" style={{ color: C.pink }}>💥 げんてん</h4>
              <ul className="text-xs font-bold space-y-1">
                {selected.deductions?.map((d, i) => (
                  <li key={i}><span className="pop-display" style={{ color: C.pink }}>−{d.points}点</span> {d.reason}</li>
                ))}
                {(!selected.deductions || selected.deductions.length === 0) && <li>減点なし</li>}
              </ul>
            </div>

            <div className="p-3 rounded-2xl mb-4" style={{ background: "#FAFAFA", border: `2px solid ${C.ink}` }}>
              <h4 className="pop-display text-sm mb-2">💬 会話ログ</h4>
              <div className="space-y-2">
                {selected.transcript?.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "staff" ? "justify-end" : "justify-start"}`}>
                    <div
                      className="max-w-[85%] p-2 text-xs font-bold leading-relaxed"
                      style={{
                        background: m.role === "staff" ? C.skySoft : C.white,
                        border: `1.5px solid ${C.ink}`,
                        borderRadius: 12,
                        boxShadow: `2px 2px 0 ${m.role === "staff" ? C.sky : C.pink}`,
                      }}
                    >
                      <div className="text-[9px] mb-0.5 font-extrabold" style={{ color: m.role === "staff" ? C.sky : C.pink }}>
                        {m.role === "staff" ? "🧑‍💼 営業" : "🛍️ 客"}
                      </div>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="w-full py-3 pop-display text-sm rounded-2xl"
              style={{ background: C.ink, color: "#fff", border: `2.5px solid ${C.ink}` }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
