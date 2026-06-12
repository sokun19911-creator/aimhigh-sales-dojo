"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { CATEGORIES, SCENARIOS, RANDOM } from "@/lib/scenarios";
import type { Phase, Message, Scoring, ObjectionResult } from "@/lib/types";

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

function guardFace(v: number): string {
  if (v >= 80) return "😡";
  if (v >= 60) return "😠";
  if (v >= 40) return "😐";
  if (v >= 20) return "🙂";
  return "😊";
}

function GuardGauge({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? C.pink : pct >= 40 ? C.gold : C.green;
  return (
    <div className="flex items-center gap-3">
      <div className="text-3xl pop-in" key={guardFace(pct)}>{guardFace(pct)}</div>
      <div className="flex-1">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs font-bold" style={{ color: C.gray }}>お客さんの警戒度</span>
          <span className="pop-display text-sm" style={{ color }}>{pct}</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden" style={{ background: "#F0E6D6", border: `2px solid ${C.ink}` }}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const main = score >= 85 ? C.pink : score >= 65 ? C.gold : score >= 50 ? C.sky : C.gray;
  const stars = score >= 85 ? "⭐⭐⭐" : score >= 65 ? "⭐⭐" : score >= 50 ? "⭐" : "🌱";
  return (
    <div
      className="pop-in mx-auto flex flex-col items-center justify-center rounded-full"
      style={{ width: 140, height: 140, background: C.white, border: `3px solid ${C.ink}`, boxShadow: `5px 5px 0 ${main}` }}
    >
      <div className="text-lg leading-none mb-1">{stars}</div>
      <div className="pop-display text-5xl leading-none" style={{ color: main }}>{score}</div>
      <div className="text-xs font-bold mt-1" style={{ color: C.gray }}>/ 100てん</div>
    </div>
  );
}

function ScenarioCard({ s, onStart, gold }: {
  s: { id: string; emoji: string; label: string; desc: string };
  onStart: (id: string) => void;
  gold?: boolean;
}) {
  return (
    <button
      onClick={() => onStart(s.id)}
      className="w-full text-left p-4 transition-all active:translate-x-0.5 active:translate-y-0.5"
      style={cardStyle({
        background: gold ? C.gold : C.white,
        boxShadow: gold ? `4px 4px 0 ${C.pink}` : `4px 4px 0 ${C.ink}`,
      })}
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{s.emoji}</span>
        <div className="flex-1">
          <div className="font-extrabold text-sm">{s.label}</div>
          <div className="text-xs font-bold mt-0.5 leading-relaxed" style={{ color: gold ? C.ink : C.gray }}>{s.desc}</div>
        </div>
        <span className="pop-display" style={{ color: C.pink }}>▶</span>
      </div>
    </button>
  );
}

export default function SalesDojo() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [staffName, setStaffName] = useState("");
  const [scenario, setScenario] = useState<string | null>(null);
  const [scenarioChoice, setScenarioChoice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guard, setGuard] = useState(85);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scoring, setScoring] = useState<Scoring | null>(null);
  const [endedBy, setEndedBy] = useState("");
  const [objection, setObjection] = useState("");
  const [objectionResult, setObjectionResult] = useState<ObjectionResult | null>(null);
  const [savedResultId, setSavedResultId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function callRoleplay(body: Record<string, unknown>) {
    const res = await fetch("/api/roleplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || "API error");
    }
    return res.json();
  }

  async function startBattle(choiceId: string) {
    let actual = choiceId;
    if (choiceId === "random") {
      actual = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)].id;
    }
    setScenarioChoice(choiceId);
    setScenario(actual);
    setMessages([]);
    setScoring(null);
    setObjectionResult(null);
    setObjection("");
    setError("");
    setSavedResultId(null);
    setPhase("battle");
    setLoading(true);
    try {
      const r = await callRoleplay({ type: "customer", scenarioId: actual, messages: [] });
      setMessages([{ role: "customer", text: r.reply }]);
      setGuard(r.guard ?? 85);
    } catch (e) {
      setError(e instanceof Error ? e.message : "お客さんAIの呼び出しに失敗しました。");
      setPhase("setup");
    }
    setLoading(false);
  }

  async function sendStaffLine() {
    if (!input.trim() || loading || !scenario) return;
    const next: Message[] = [...messages, { role: "staff", text: input.trim() }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");
    try {
      const r = await callRoleplay({ type: "customer", scenarioId: scenario, messages: next });
      const withReply: Message[] = [...next, { role: "customer", text: r.reply }];
      setMessages(withReply);
      setGuard(r.guard ?? guard);
      if (r.status === "win" || r.status === "lose") {
        await runScoring(
          withReply,
          r.status === "win" ? "クロージング成功でフィニッシュ!" : "お客さんが帰っちゃいました…"
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "通信エラー。もう一度送ってください。");
      setMessages(messages);
      setInput(input);
    }
    setLoading(false);
  }

  const runScoring = useCallback(async (msgs: Message[], reason: string) => {
    if (!scenario) return;
    setPhase("scoring");
    setEndedBy(reason);
    try {
      const meta = SCENARIOS.find((s) => s.id === scenario);
      // メタ情報をリクエストに含め、サーバー側で DB 保存 → result_id を受け取る
      const r = await callRoleplay({
        type: "score",
        scenarioId: scenario,
        messages: msgs,
        endedBy: reason,
        staff_name: staffName.trim(),
        scenario_label: meta?.label ?? scenario,
        category: meta?.cat ?? "",
        is_random: scenarioChoice === "random",
      });
      setScoring(r);
      setSavedResultId(r.result_id ?? null);
      setPhase("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "採点に失敗しました。「採点をやりなおす」を押してください。");
      setPhase("result");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario, staffName, scenarioChoice]);

  async function submitObjection() {
    if (!objection.trim() || loading || !scoring || !scenario) return;
    setLoading(true);
    setError("");
    try {
      // result_id をサーバーに渡し、反論成立時にサーバー側で DB 更新
      const r = await callRoleplay({
        type: "objection",
        scenarioId: scenario,
        messages,
        result_id: savedResultId,
        scoring: { score: scoring.score, deductions: scoring.deductions },
        objection: objection.trim(),
      });
      setObjectionResult(r);
      if (r.accepted && typeof r.new_score === "number") {
        setScoring({ ...scoring, score: r.new_score });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "反論の判定に失敗しました。");
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendStaffLine();
    }
  }

  const currentScenario = SCENARIOS.find((s) => s.id === scenario);

  return (
    <div className="pop-body min-h-screen pb-6" style={{ background: C.bg, color: C.ink }}>
      {/* ヘッダー */}
      <header className="px-4 pt-5 pb-4 max-w-md mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bouncing text-3xl">📣</div>
            <div>
              <div className="text-[10px] font-bold tracking-wider" style={{ color: C.gray }}>合同会社AimHigh</div>
              <h1 className="pop-display text-2xl leading-tight">
                営業<span style={{ color: C.pink }}>道場</span>
              </h1>
            </div>
            <span
              className="wiggling pop-display text-xs px-2 py-1 rounded-lg ml-1"
              style={{ background: C.gold, border: `2px solid ${C.ink}`, boxShadow: `2px 2px 0 ${C.ink}` }}
            >
              研修用
            </span>
          </div>
        </div>
      </header>

      {/* ======== SETUP ======== */}
      {phase === "setup" && (
        <main className="px-4 max-w-md mx-auto">
          <div className="p-4 mb-4" style={cardStyle({ background: C.pinkSoft })}>
            <p className="text-sm font-bold leading-relaxed">
              AIがお客さんを演じます🎭 勝負がついたら忖度なしの採点!納得いかなければ、ロジックで反論してね。言い訳はきかないよ〜
            </p>
          </div>

          <label className="block text-xs font-bold mb-2" style={{ color: C.gray }}>👤 スタッフのなまえ</label>
          <input
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="なまえを入力(きろくに使います)"
            className="w-full p-3 mb-5 outline-none text-sm font-bold"
            style={cardStyle({ borderRadius: 16, boxShadow: `3px 3px 0 ${C.ink}` })}
          />

          <div className="mb-4">
            <ScenarioCard s={RANDOM} onStart={startBattle} gold />
          </div>

          {CATEGORIES.map((cat) => (
            <div key={cat.id} className="mb-5">
              <div className="flex items-baseline gap-2 mb-2 px-1">
                <h2 className="pop-display text-base">{cat.label}</h2>
                <span className="text-[11px] font-bold" style={{ color: C.gray }}>{cat.sub}</span>
              </div>
              <div className="space-y-3">
                {SCENARIOS.filter((s) => s.cat === cat.id).map((s) => (
                  <ScenarioCard key={s.id} s={s} onStart={startBattle} />
                ))}
              </div>
            </div>
          ))}
        </main>
      )}

      {/* ======== BATTLE ======== */}
      {phase === "battle" && (
        <main className="flex flex-col max-w-md mx-auto px-4" style={{ height: "calc(100vh - 90px)" }}>
          <div className="p-3 mb-3" style={cardStyle({ borderRadius: 16 })}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold">
                {scenarioChoice === "random"
                  ? "🎲 予告なしランダム戦"
                  : `${currentScenario?.emoji} ${currentScenario?.label}`}
              </span>
              <button
                onClick={() => runScoring(messages, "営業側の申告による打ち切り")}
                className="text-[11px] font-bold px-2 py-1 rounded-lg"
                style={{ background: C.pinkSoft, border: `2px solid ${C.ink}` }}
              >
                ✋ 打ち切って採点
              </button>
            </div>
            <GuardGauge value={guard} />
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pb-2">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "staff" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[85%] p-3 text-sm font-bold leading-relaxed whitespace-pre-wrap"
                  style={{
                    background: m.role === "staff" ? C.skySoft : C.white,
                    border: `2.5px solid ${C.ink}`,
                    borderRadius: 18,
                    borderBottomRightRadius: m.role === "staff" ? 4 : 18,
                    borderBottomLeftRadius: m.role === "staff" ? 18 : 4,
                    boxShadow: `3px 3px 0 ${m.role === "staff" ? C.sky : C.pink}`,
                  }}
                >
                  <div className="text-[10px] mb-1 font-extrabold" style={{ color: m.role === "staff" ? C.sky : C.pink }}>
                    {m.role === "staff" ? "🧑‍💼 あなた" : "🛍️ お客さん"}
                  </div>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="p-3 text-sm font-bold rounded-2xl" style={{ background: C.white, border: `2.5px solid ${C.ink}`, color: C.gray }}>
                  <span className="bouncing inline-block">💭</span> お客さんが考え中…
                </div>
              </div>
            )}
            {error && <div className="text-xs font-bold p-2" style={{ color: C.pink }}>{error}</div>}
            <div ref={bottomRef} />
          </div>

          <div className="py-3">
            <div className="flex gap-2 items-stretch">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="営業としての発言・行動(しぐさは括弧書きでOK) ※Enterで送信"
                className="flex-1 p-3 text-sm font-bold outline-none resize-none"
                style={cardStyle({ borderRadius: 16, boxShadow: `3px 3px 0 ${C.ink}` })}
              />
              <button
                onClick={sendStaffLine}
                disabled={loading || !input.trim()}
                className="px-4 pop-display text-sm active:translate-y-0.5"
                style={cardStyle({
                  borderRadius: 16,
                  background: loading || !input.trim() ? "#E5DCCB" : C.pink,
                  color: loading || !input.trim() ? C.gray : "#fff",
                  boxShadow: `3px 3px 0 ${C.ink}`,
                })}
              >
                送信
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ======== SCORING ======== */}
      {phase === "scoring" && (
        <main className="px-4 py-16 max-w-md mx-auto text-center">
          <div className="text-5xl bouncing mb-4">✍️</div>
          <div className="pop-display text-2xl mb-2" style={{ color: C.pink }}>採点中…</div>
          <p className="text-sm font-bold" style={{ color: C.gray }}>ルーブリックでチェックしています</p>
        </main>
      )}

      {/* ======== RESULT ======== */}
      {phase === "result" && (
        <main className="px-4 max-w-md mx-auto">
          {scoring ? (
            <div className="p-5" style={cardStyle({ borderRadius: 24 })}>
              <div className="text-center mb-2">
                <div className="text-xs font-extrabold" style={{ color: C.gray }}>
                  {scenarioChoice === "random" ? "🎲 出題されたのは… " : ""}
                  {currentScenario?.emoji} {currentScenario?.label}
                </div>
                <div className="text-xs font-bold mt-1" style={{ color: C.gray }}>{endedBy}</div>
              </div>
              <div className="my-5"><ScoreBadge score={scoring.score} /></div>
              <div className="text-center pop-display text-base mb-5" style={{ color: scoring.score >= 85 ? C.pink : scoring.score >= 65 ? C.gold : scoring.score >= 50 ? C.sky : C.gray }}>
                {scoring.score >= 85 ? "達人級!めったに出ない!" : scoring.score >= 65 ? "上位ライン!型が出てる!" : scoring.score >= 50 ? "平均圏。型を磨こう。" : "🔥 猛特訓!ここから鍛える!"}
              </div>

              <div className="p-3 mb-3 rounded-2xl" style={{ background: C.greenSoft, border: `2px solid ${C.ink}` }}>
                <h3 className="pop-display text-sm mb-2" style={{ color: "#1E8A5C" }}>🌟 よかったところ</h3>
                <ul className="text-sm font-bold space-y-2">
                  {scoring.highlights?.map((h, i) => <li key={i} className="leading-relaxed">{h}</li>)}
                </ul>
              </div>

              <div className="p-3 mb-3 rounded-2xl" style={{ background: C.pinkSoft, border: `2px solid ${C.ink}` }}>
                <h3 className="pop-display text-sm mb-2" style={{ color: C.pink }}>💥 げんてん</h3>
                <ul className="text-sm font-bold space-y-2">
                  {scoring.deductions?.map((d, i) => (
                    <li key={i} className="leading-relaxed">
                      <span className="pop-display" style={{ color: C.pink }}>−{d.points}点</span> {d.reason}
                    </li>
                  ))}
                  {(!scoring.deductions || scoring.deductions.length === 0) && <li>減点なし!かんぺき!</li>}
                </ul>
              </div>

              <div className="p-3 mb-4 rounded-2xl" style={{ background: C.skySoft, border: `2px solid ${C.ink}` }}>
                <h3 className="pop-display text-sm mb-2" style={{ color: "#1B6FB0" }}>📝 そうひょう</h3>
                <p className="text-sm font-bold leading-relaxed">{scoring.summary}</p>
              </div>

              <div className="pt-2">
                <h3 className="pop-display text-sm mb-1">⚖️ 採点にもの申す</h3>
                <p className="text-[11px] font-bold mb-2" style={{ color: C.gray }}>営業判断としてロジックが通れば点数が動きます。言い訳はきゃっか!</p>
                {objectionResult ? (
                  <div
                    className="p-3 rounded-2xl text-sm font-bold"
                    style={{ background: objectionResult.accepted ? C.greenSoft : C.pinkSoft, border: `2px solid ${C.ink}` }}
                  >
                    <span className="pop-display">
                      {objectionResult.accepted ? `反論せいりつ!→ ${objectionResult.new_score}点` : "反論きゃっか"}
                    </span><br />
                    {objectionResult.verdict}
                  </div>
                ) : (
                  <div className="flex gap-2 items-stretch">
                    <textarea
                      value={objection}
                      onChange={(e) => setObjection(e.target.value)}
                      rows={2}
                      placeholder="例: あの場面で家族構成を聞くと不信感を招くため、あえて…"
                      className="flex-1 p-3 text-sm font-bold outline-none resize-none"
                      style={{ background: "#FFFDF8", border: `2.5px solid ${C.ink}`, borderRadius: 16, color: C.ink }}
                    />
                    <button
                      onClick={submitObjection}
                      disabled={loading || !objection.trim()}
                      className="px-4 pop-display text-sm rounded-2xl active:translate-y-0.5"
                      style={{
                        background: loading || !objection.trim() ? "#E5DCCB" : C.ink,
                        color: "#fff",
                        border: `2.5px solid ${C.ink}`,
                      }}
                    >
                      {loading ? "…" : "提出"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-5" style={cardStyle()}>
              <p className="text-sm font-bold mb-4" style={{ color: C.pink }}>{error || "採点データがありません。"}</p>
              <button
                onClick={() => runScoring(messages, endedBy || "再採点")}
                className="px-4 py-2 rounded-xl text-sm pop-display"
                style={{ background: C.pink, color: "#fff", border: `2.5px solid ${C.ink}`, boxShadow: `3px 3px 0 ${C.ink}` }}
              >
                採点をやりなおす
              </button>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => scenario && startBattle(scenarioChoice || scenario)}
              className="flex-1 py-3 pop-display text-sm active:translate-y-0.5"
              style={cardStyle({ background: C.sky, color: "#fff", borderRadius: 16 })}
            >
              🔁 もう一戦!
            </button>
            <button
              onClick={() => setPhase("setup")}
              className="flex-1 py-3 pop-display text-sm active:translate-y-0.5"
              style={cardStyle({ borderRadius: 16 })}
            >
              🏠 道場にもどる
            </button>
          </div>
        </main>
      )}
    </div>
  );
}
