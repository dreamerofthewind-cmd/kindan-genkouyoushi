"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ===== THEMES =====
const THEMES: Record<string, {
  bg: string; paper: string; ink: string; accent: string;
  danger: string; success: string; grid: string; dark: boolean;
}> = {
  墨:   { bg: "#1c1810", paper: "#2c2418", ink: "#ffffff", accent: "#f0c060", danger: "#ff6060", success: "#50e090", grid: "#f0c060",  dark: true },
  桜:   { bg: "#281020", paper: "#3c1830", ink: "#ffffff", accent: "#ff90c0", danger: "#ff6060", success: "#50e090", grid: "#ff90c0", dark: true },
  海:   { bg: "#0e1e30", paper: "#182a42", ink: "#ffffff", accent: "#60d0ff", danger: "#ff6060", success: "#40e8cc", grid: "#60d0ff", dark: true },
  竹:   { bg: "#121e12", paper: "#1e2e1e", ink: "#ffffff", accent: "#90ee90", danger: "#ff6060", success: "#50e090", grid: "#90ee90", dark: true },
  白墨: { bg: "#f5f0e8", paper: "#ffffff", ink: "#1a1610", accent: "#8b6914", danger: "#cc3333", success: "#2a8a50", grid: "#8b6914", dark: false },
  白桜: { bg: "#fff0f5", paper: "#ffffff", ink: "#2a101e", accent: "#c04070", danger: "#cc3333", success: "#2a8a50", grid: "#c04070", dark: false },
  白海: { bg: "#f0f6ff", paper: "#ffffff", ink: "#0e1e30", accent: "#1a6090", danger: "#cc3333", success: "#1a7060", grid: "#1a6090", dark: false },
  白竹: { bg: "#f0f8f0", paper: "#ffffff", ink: "#121e12", accent: "#2a6e2a", danger: "#cc3333", success: "#2a8a50", grid: "#2a6e2a", dark: false },
};

const STYLES = ["縦書き原稿用紙", "縦書き無地", "横書き無地"];
const PUNCT_RIGHT_TOP = new Set(["。","、","．","，","！","？","!","?","…","‥","」","』","）",")","】","〕","]","〉","》","・"]);
const PUNCT_ROTATE = new Set(["―","−","ー","〜","～","─","━"]);

// ===== キャラクター定義 =====
const CHARA_DEFS = [
  {
    id: "murasaki", name: "むらさき", body1: "#3d2b5a", body2: "#5a3d8a", obi: "#c8a96e", hair: "#2c1810",
    free: true, price: null as number | null, unique: false,
    desc: "最初の仲間。いつでも一緒にいる。",
    ability: { type: "none", value: 0, label: "能力なし", desc: "ただそばにいてくれる。" },
  },
  {
    id: "yamabuki", name: "やまぶき", body1: "#4a3a0a", body2: "#6a5a1a", obi: "#e8c86e", hair: "#201808",
    free: false, price: 500, unique: false,
    desc: "山吹の着物。一発逆転の守護者。",
    ability: { type: "shield", value: 1, label: "消滅防御", desc: "1体につきセッション中1回だけ消滅を防ぐ。複数体で複数回発動。" },
  },
];

// ===== 型定義 =====
interface OwnedItem { id: string; count: number; }
interface ActiveItem { id: string; activeCount: number; }
interface SaveData {
  totalChars: number;
  owned: OwnedItem[];
  active: ActiveItem[];
}

// ===== calc関数 =====
function hasShield(active: ActiveItem[]) {
  return active.some(a => {
    const def = CHARA_DEFS.find(c => c.id === a.id);
    return def && def.ability.type === "shield" && a.activeCount > 0;
  });
}
function shieldCount(active: ActiveItem[]) {
  return active.reduce((sum, a) => {
    const def = CHARA_DEFS.find(c => c.id === a.id);
    if (def && def.ability.type === "shield") return sum + a.activeCount;
    return sum;
  }, 0);
}

// ===== ストレージ =====
const STORAGE_KEY = "kindan_save_v2";
function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (!d.active || (d.active.length > 0 && typeof d.active[0] === "string")) {
        d.active = d.owned.map((o: OwnedItem) => ({ id: o.id, activeCount: 1 }));
      }
      return d;
    }
  } catch {}
  return {
    totalChars: 0,
    owned: [{ id: "murasaki", count: 1 }],
    active: [{ id: "murasaki", activeCount: 1 }],
  };
}
function writeSave(data: SaveData) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}
function countOf(owned: OwnedItem[], id: string) { return owned.find(o => o.id === id)?.count || 0; }
function activeCountOf(active: ActiveItem[], id: string) { return active.find(a => a.id === id)?.activeCount || 0; }
function ownedIds(owned: OwnedItem[]) { return owned.map(o => o.id); }
function cycleActive(active: ActiveItem[], owned: OwnedItem[], id: string): ActiveItem[] {
  const maxCount = countOf(owned, id);
  const current = activeCountOf(active, id);
  const next = (current + 1) % (maxCount + 1);
  const exists = active.some(a => a.id === id);
  if (!exists) return [...active, { id, activeCount: next }];
  return active.map(a => a.id === id ? { ...a, activeCount: next } : a);
}

// ===== CharaSVG =====
function CharaSVG({ def, isTyping = false, isDanger = false, size = 60, animDelay = 0 }: {
  def: typeof CHARA_DEFS[0]; isTyping?: boolean; isDanger?: boolean; size?: number; animDelay?: number;
}) {
  const H = size * 1.35;
  const anim = isTyping ? "bob 0.25s infinite" : isDanger ? "panic 0.15s infinite" : "idle 2.5s infinite";
  const uid = `av_${def.id}_${size}`;
  return (
    <svg width={size} height={H} viewBox="0 0 60 80"
      style={{ display: "block", filter: isDanger ? "drop-shadow(0 0 6px #e74c3c)" : "none", transition: "filter 0.3s" }}>
      <style>{`
        @keyframes bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes panic { 0%,100%{transform:rotate(0)} 25%{transform:rotate(-9deg)} 75%{transform:rotate(9deg)} }
        @keyframes idle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        .${uid} { animation: ${anim}; animation-delay: ${animDelay}s; transform-origin: 30px 40px; }
      `}</style>
      <g className={uid}>
        <ellipse cx="30" cy="58" rx="18" ry="22" fill={isDanger ? "#8b1a1a" : def.body1} />
        <ellipse cx="30" cy="58" rx="10" ry="22" fill={isDanger ? "#a52020" : def.body2} />
        <rect x="14" y="52" width="32" height="6" rx="3" fill={def.obi} opacity={0.8} />
        <rect x="26" y="30" width="8" height="12" rx="4" fill="#f5c9a0" />
        <circle cx="30" cy="25" r="14" fill="#f5c9a0" />
        <ellipse cx="30" cy="14" rx="14" ry="8" fill={def.hair} />
        <rect x="16" y="10" width="6" height="16" rx="3" fill={def.hair} />
        <rect x="38" y="10" width="6" height="16" rx="3" fill={def.hair} />
        <ellipse cx="24" cy="24" rx="2.5" ry={isDanger ? 3.5 : 2.5} fill="#2c1810" />
        <ellipse cx="36" cy="24" rx="2.5" ry={isDanger ? 3.5 : 2.5} fill="#2c1810" />
        <circle cx="25" cy="23" r="1" fill="white" opacity={0.8} />
        <circle cx="37" cy="23" r="1" fill="white" opacity={0.8} />
        {isDanger
          ? <ellipse cx="30" cy="30" rx="4" ry="3" fill="#c0392b" />
          : isTyping
            ? <ellipse cx="30" cy="30" rx="3" ry="2" fill="#d4956a" />
            : <path d="M27 30 Q30 32 33 30" stroke="#d4956a" strokeWidth="1.5" fill="none" strokeLinecap="round" />}
        <ellipse cx="18" cy="50" rx="5" ry="3" fill="#f5c9a0" />
        <ellipse cx="44" cy="50" rx="5" ry="3" fill="#f5c9a0" />
        {isDanger && <ellipse cx="43" cy="19" rx="2.5" ry="4" fill="#5aafd8" opacity={0.8} transform="rotate(15 43 19)" />}
      </g>
    </svg>
  );
}

// ===== CheerPanel =====
function CheerPanel({ save, isTyping, isDanger, totalChars, t }: {
  save: SaveData; isTyping: boolean; isDanger: boolean; totalChars: number;
  t: typeof THEMES[string];
}) {
  const activeList = save.active.filter(a => a.activeCount > 0);
  const owned = CHARA_DEFS.filter(c => activeList.some(a => a.id === c.id));
  return (
    <div style={{ borderTop: `1px solid ${t.ink}18`, background: `${t.bg}f0`, padding: "6px 10px 4px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexShrink: 0, overflowX: "auto", gap: "6px" }}>
      <div style={{ display: "flex", gap: "4px", alignItems: "flex-end" }}>
        {owned.map((def, i) => {
          const ac = activeCountOf(save.active, def.id);
          return Array.from({ length: ac }).map((_, ci) => (
            <div key={`${def.id}_${ci}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
              <CharaSVG def={def} isTyping={isTyping} isDanger={isDanger} size={44} animDelay={(i + ci * 0.05) * 0.15} />
              {ci === 0 && <span style={{ fontSize: "7px", color: t.ink + "60" }}>{def.name}</span>}
            </div>
          ));
        })}
      </div>
      <div style={{ flexShrink: 0, fontSize: "9px", color: t.ink + "60", alignSelf: "center" }}>
        累計 <span style={{ color: t.accent, fontWeight: 700 }}>{totalChars.toLocaleString()}</span> 字
      </div>
    </div>
  );
}

// ===== ShopScreen =====
function ShopScreen({ save, onSave, onClose, theme }: {
  save: SaveData; onSave: (s: SaveData) => void; onClose: () => void; theme: string;
}) {
  const t = THEMES[theme];
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [newlyUnlocked, setNewlyUnlocked] = useState<string | null>(null);

  const handleBuy = async (def: typeof CHARA_DEFS[0]) => {
    if (!def.price) return;
    setPurchasing(def.id);
    try {
      // Stripe Checkout セッションを作成してリダイレクト
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ charaId: def.id, price: def.price }),
      });
      const { url } = await res.json();
      if (url) {
        // 現在のsaveをsessionStorageに保存（戻ってきたときに使う）
        sessionStorage.setItem("kindan_pending_chara", def.id);
        window.location.href = url;
      }
    } catch (e) {
      console.error(e);
      setPurchasing(null);
      alert("決済の開始に失敗しました。");
    }
  };

  const btn = (ex: Record<string, unknown>) => ({
    padding: "8px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
    fontFamily: "inherit", outline: "none", letterSpacing: "0.05em", border: "none", ...ex
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: `${t.bg}f8`, fontFamily: "'Noto Serif JP', Georgia, serif", color: t.ink, display: "flex", flexDirection: "column", zIndex: 100 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${t.ink}18` }}>
        <div>
          <div style={{ fontSize: "16px", letterSpacing: "0.2em", fontWeight: 700 }}>仲間を増やす</div>
          <div style={{ fontSize: "10px", color: t.ink + "70", marginTop: "2px" }}>累計 {save.totalChars.toLocaleString()} 字</div>
        </div>
        <button onClick={onClose} style={btn({ background: `${t.ink}15`, color: t.ink, padding: "6px 14px" }) as React.CSSProperties}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px" }}>
          {CHARA_DEFS.map(def => {
            const ownedCount = countOf(save.owned, def.id);
            const isOwned = ownedCount > 0;
            const isPurchasing = purchasing === def.id;
            const isNew = newlyUnlocked === def.id;
            return (
              <div key={def.id} style={{ background: isOwned ? `${t.accent}12` : `${t.ink}06`, border: `1px solid ${isOwned ? t.accent : t.ink}${isOwned ? "35" : "18"}`, borderRadius: "10px", padding: "14px 10px", textAlign: "center", position: "relative", boxShadow: isNew ? `0 0 20px ${t.accent}50` : "none" }}>
                <CharaSVG def={def} size={54} isTyping={isOwned} />
                <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "7px", color: isOwned ? t.accent : t.ink }}>{def.name}</div>
                <div style={{ fontSize: "9px", color: t.ink + "60", marginTop: "3px", lineHeight: 1.5 }}>{def.desc}</div>
                <div style={{ fontSize: "9px", color: t.accent, background: `${t.accent}18`, borderRadius: "10px", padding: "2px 8px", margin: "6px auto 0", display: "inline-block" }}>
                  {def.ability.label}
                </div>
                <div style={{ fontSize: "8px", color: t.ink + "50", marginTop: "3px", lineHeight: 1.4 }}>{def.ability.desc}</div>
                <div style={{ marginTop: "10px" }}>
                  {def.free ? (
                    <div style={{ fontSize: "11px", color: t.success }}>✓ 無料</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      {isOwned && <div style={{ fontSize: "10px", color: t.accent }}>所持 ×{ownedCount}</div>}
                      <button onClick={() => handleBuy(def)} disabled={isPurchasing}
                        style={btn({ width: "100%", background: isPurchasing ? `${t.ink}10` : `${t.accent}20`, border: `1px solid ${t.accent}60`, color: t.accent, opacity: isPurchasing ? 0.6 : 1, fontSize: "12px" }) as React.CSSProperties}>
                        {isPurchasing ? "処理中..." : isOwned ? `もう1体 ¥${def.price}` : `¥${def.price}`}
                      </button>
                    </div>
                  )}
                </div>
                {isNew && <div style={{ position: "absolute", top: "-8px", right: "-8px", background: t.success, color: "#fff", fontSize: "9px", padding: "2px 6px", borderRadius: "10px" }}>NEW!</div>}
              </div>
            );
          })}
        </div>
        <p style={{ textAlign: "center", marginTop: "18px", fontSize: "10px", color: t.ink + "40" }}>Stripe 決済 / キャラデータはブラウザに保存</p>
      </div>
    </div>
  );
}

// ===== GenkouCanvas =====
function GenkouCanvas({ text, t, timerPct, cellSize }: {
  text: string; t: typeof THEMES[string]; timerPct: number; cellSize: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([e]) => {
      setDims({ w: e.contentRect.width, h: e.contentRect.height });
    });
    obs.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => obs.disconnect();
  }, []);

  const CELL = cellSize;
  const PAD = 8;
  const rows = Math.max(1, Math.floor((dims.h - PAD * 2) / CELL));
  const cols = Math.max(1, Math.floor((dims.w - PAD * 2) / CELL));
  const gridW = cols * CELL, gridH = rows * CELL;
  const offsetX = PAD + ((dims.w - PAD * 2) - gridW) / 2;
  const offsetY = PAD + ((dims.h - PAD * 2) - gridH) / 2;

  const opacity = Math.max(0.03, timerPct);
  const fontSize = CELL * 0.72;
  const punctSize = CELL * 0.38;

  const cells = [];
  for (let i = 0; i < text.length; i++) {
    const col = Math.floor(i / rows);
    const row = i % rows;
    if (col >= cols) continue;
    const cx = offsetX + (cols - 1 - col) * CELL + CELL / 2;
    const cy = offsetY + row * CELL + CELL / 2;
    const ch = text[i];
    cells.push({ ch, cx, cy, col, isPunctRT: PUNCT_RIGHT_TOP.has(ch), isRotate: PUNCT_ROTATE.has(ch), idx: i });
  }

  const cursorCol = Math.floor(text.length / rows);
  const cursorRow = text.length % rows;
  const cursorCX = offsetX + (cols - 1 - cursorCol) * CELL;
  const cursorCY = offsetY + cursorRow * CELL;

  return (
    <div ref={containerRef} style={{ position: "absolute", inset: 0 }}>
      {dims.w > 0 && (
        <svg width={dims.w} height={dims.h} style={{ position: "absolute", inset: 0, display: "block" }}>
          {Array.from({ length: cols + 1 }).map((_, c) => (
            <line key={`v${c}`} x1={offsetX + c * CELL} y1={offsetY} x2={offsetX + c * CELL} y2={offsetY + gridH} stroke={t.grid} strokeWidth="0.6" opacity="0.25" />
          ))}
          {Array.from({ length: rows + 1 }).map((_, r) => (
            <line key={`h${r}`} x1={offsetX} y1={offsetY + r * CELL} x2={offsetX + gridW} y2={offsetY + r * CELL} stroke={t.grid} strokeWidth="0.6" opacity="0.25" />
          ))}
          {cells.map(({ ch, cx, cy, col, isPunctRT, isRotate, idx }) => {
            const cellRight = cx + CELL / 2;
            const cellTop = cy - CELL / 2;
            if (isPunctRT) {
              return <text key={idx} x={cellRight - punctSize * 0.5} y={cellTop + punctSize * 0.5} textAnchor="middle" dominantBaseline="central" fontSize={punctSize} fill={t.ink} opacity={opacity} fontFamily="'Noto Serif JP', Georgia, serif">{ch}</text>;
            } else if (isRotate) {
              return <text key={idx} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={t.ink} opacity={opacity} fontFamily="'Noto Serif JP', Georgia, serif" transform={`rotate(90,${cx},${cy})`}>{ch}</text>;
            }
            return <text key={idx} x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fill={t.ink} opacity={opacity} fontFamily="'Noto Serif JP', Georgia, serif">{ch}</text>;
          })}
          {cursorCol < cols && (
            <rect x={cursorCX + 3} y={cursorCY + 3} width={CELL - 6} height={CELL - 6} fill={t.accent} rx="2">
              <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.1s" repeatCount="indefinite" />
            </rect>
          )}
        </svg>
      )}
    </div>
  );
}

// ===== SetupScreen =====
function SetupScreen({ onStart, theme, setTheme, save, onSave, onOpenShop }: {
  onStart: (c: Record<string, unknown>) => void;
  theme: string; setTheme: (t: string) => void;
  save: SaveData; onSave: (s: SaveData) => void;
  onOpenShop: () => void;
}) {
  const [limitSec, setLimitSec] = useState(3);
  const [goalType, setGoalType] = useState("chars");
  const [goalValue, setGoalValue] = useState("400");
  const [goalTimePreset, setGoalTimePreset] = useState<number | null>(null);
  const [style, setStyle] = useState("縦書き原稿用紙");
  const [cellSize, setCellSize] = useState(40);
  const t = THEMES[theme];

  const pill = (active: boolean) => ({
    padding: "7px 16px", borderRadius: "20px",
    border: `1px solid ${active ? t.accent : t.ink + "30"}`,
    background: active ? `${t.accent}22` : "transparent",
    color: active ? t.accent : t.ink + "70",
    cursor: "pointer", fontSize: "13px", fontFamily: "inherit", outline: "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.ink, fontFamily: "'Noto Serif JP', Georgia, serif", overflowY: "auto" }}>
      <div style={{ maxWidth: "440px", margin: "0 auto", padding: "36px 24px 60px" }}>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.4em", color: t.accent, marginBottom: "8px" }}>── 覚悟を持て ──</div>
          <h1 style={{ fontSize: "28px", letterSpacing: "0.25em", margin: "0 0 6px", fontWeight: 700 }}>禁断の原稿用紙</h1>
          <p style={{ fontSize: "11px", color: t.ink + "cc", letterSpacing: "0.12em" }}>指が止まった瞬間、すべては消える。</p>
        </div>

        {/* 仲間パネル */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "6px", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "6px" }}>
            {save.active.filter(a => a.activeCount > 0).flatMap((a, gi) => {
              const def = CHARA_DEFS.find(c => c.id === a.id);
              if (!def) return [];
              return Array.from({ length: a.activeCount }).map((_, ci) => (
                <div key={`${a.id}_${ci}`} style={{ textAlign: "center" }}>
                  <CharaSVG def={def} size={44} animDelay={(gi + ci * 0.08) * 0.18} />
                  {ci === 0 && <div style={{ fontSize: "8px", color: t.accent, marginTop: "1px" }}>{def.name}</div>}
                </div>
              ));
            })}
            {save.active.every(a => a.activeCount === 0) && (
              <div style={{ fontSize: "12px", color: t.ink + "40", padding: "16px 0" }}>下のボタンでキャラを選んでね</div>
            )}
          </div>

          {save.owned.length > 0 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center", marginBottom: "10px" }}>
              {save.owned.map(({ id, count }) => {
                const def = CHARA_DEFS.find(c => c.id === id);
                if (!def) return null;
                const ac = activeCountOf(save.active, id);
                const isActive = ac > 0;
                return (
                  <button key={id} onClick={() => {
                    const newActive = cycleActive(save.active, save.owned, id);
                    const next = { ...save, active: newActive };
                    writeSave(next); onSave(next);
                  }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", border: `1px solid ${isActive ? t.accent : t.ink + "20"}`, background: isActive ? `${t.accent}18` : "transparent", outline: "none", fontFamily: "inherit", transition: "all 0.15s" } as React.CSSProperties}>
                    <div style={{ opacity: isActive ? 1 : 0.35 }}><CharaSVG def={def} size={34} /></div>
                    <div style={{ fontSize: "8px", color: isActive ? t.accent : t.ink + "40" }}>{def.name}</div>
                    <div style={{ display: "flex", gap: "3px", marginTop: "2px" }}>
                      {Array.from({ length: count }).map((_, i) => (
                        <div key={i} style={{ width: "5px", height: "5px", borderRadius: "50%", background: i < ac ? t.accent : t.ink + "25" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: "7px", color: isActive ? t.accent : t.ink + "30" }}>{ac}/{count}体</div>
                  </button>
                );
              })}
            </div>
          )}
          <button onClick={onOpenShop} style={pill(false) as React.CSSProperties}>＋ 仲間を増やす</button>
        </div>

        {/* 設定 */}
        <div style={{ marginTop: "20px" }}>
          {[
            {
              label: "制限時間（秒）", content: (
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" as const }}>
                    {[1, 3, 5, 10, 30].map(s => (
                      <button key={s} style={pill(limitSec === s) as React.CSSProperties} onClick={() => setLimitSec(s)}>{s}秒</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <input type="number" value={limitSec} min={1} max={300}
                      onChange={e => setLimitSec(Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: "80px", padding: "7px 10px", background: t.dark ? "#ffffff0a" : "#0000000a", border: `1px solid ${t.accent}40`, color: t.ink, borderRadius: "6px", fontSize: "15px", outline: "none", fontFamily: "inherit" }} />
                    <span style={{ fontSize: "12px", color: t.ink + "80" }}>秒</span>
                    {limitSec === 1 && <span style={{ fontSize: "11px", color: t.danger }}>⚠ 変換の暇なし</span>}
                  </div>
                </div>
              )
            },
            {
              label: "目標", content: (
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <button style={pill(goalType === "chars") as React.CSSProperties} onClick={() => { setGoalType("chars"); setGoalValue("400"); }}>文字数</button>
                    <button style={pill(goalType === "time") as React.CSSProperties} onClick={() => { setGoalType("time"); setGoalValue(""); setGoalTimePreset(null); }}>時間（分）</button>
                  </div>
                  {goalType === "chars" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <input type="number" value={goalValue} min={1}
                        onChange={e => setGoalValue(e.target.value.replace(/^0+(?=\d)/, ""))}
                        style={{ width: "90px", padding: "7px 10px", background: t.dark ? "#ffffff0a" : "#0000000a", border: `1px solid ${t.accent}40`, color: t.ink, borderRadius: "6px", fontSize: "15px", outline: "none", fontFamily: "inherit" }} />
                      <span style={{ fontSize: "12px", color: t.ink + "80" }}>文字</span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" as const }}>
                        {[5, 15, 60].map(m => (
                          <button key={m} style={pill(goalTimePreset === m) as React.CSSProperties} onClick={() => { setGoalTimePreset(m); setGoalValue(String(m)); }}>{m}分</button>
                        ))}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <input type="number" value={goalValue} min={1} placeholder="分を入力"
                          onChange={e => { setGoalValue(e.target.value.replace(/^0+(?=\d)/, "")); setGoalTimePreset(null); }}
                          style={{ width: "110px", padding: "7px 10px", background: t.dark ? "#ffffff0a" : "#0000000a", border: `1px solid ${t.accent}40`, color: t.ink, borderRadius: "6px", fontSize: "15px", outline: "none", fontFamily: "inherit" }} />
                        <span style={{ fontSize: "12px", color: t.ink + "80" }}>分</span>
                      </div>
                    </div>
                  )}
                </div>
              )
            },
            {
              label: "用紙スタイル", content: (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "6px" }}>
                  {STYLES.map(s => <button key={s} style={{ ...pill(style === s), textAlign: "left" } as React.CSSProperties} onClick={() => setStyle(s)}>{s}</button>)}
                </div>
              )
            },
            {
              label: `文字サイズ：${cellSize}px`, content: (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "11px", color: t.ink + "60" }}>小</span>
                  <input type="range" min={28} max={64} step={2} value={cellSize} onChange={e => setCellSize(Number(e.target.value))} style={{ flex: 1, accentColor: t.accent }} />
                  <span style={{ fontSize: "11px", color: t.ink + "60" }}>大</span>
                </div>
              )
            },
            {
              label: "テーマ", content: (
                <div style={{ display: "flex", flexDirection: "column" as const, gap: "10px" }}>
                  <div style={{ fontSize: "9px", color: t.ink + "60", letterSpacing: "0.1em" }}>DARK</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
                    {Object.entries(THEMES).filter(([, v]) => v.dark).map(([k, v]) => (
                      <button key={k} onClick={() => setTheme(k)} title={k} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", outline: "none" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: v.bg, border: theme === k ? `3px solid ${t.ink}` : `2px solid ${v.accent}`, boxShadow: theme === k ? `0 0 10px ${v.accent}` : "none" }}>
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `radial-gradient(circle at 70% 30%, ${v.accent}80, transparent)` }} />
                        </div>
                        <span style={{ fontSize: "8px", color: t.ink + "80" }}>{k}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: "9px", color: t.ink + "60", letterSpacing: "0.1em" }}>LIGHT</div>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" as const }}>
                    {Object.entries(THEMES).filter(([, v]) => !v.dark).map(([k, v]) => (
                      <button key={k} onClick={() => setTheme(k)} title={k} style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: "3px", background: "none", border: "none", cursor: "pointer", outline: "none" }}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: v.paper, border: theme === k ? `3px solid ${v.accent}` : `2px solid ${v.accent}60`, boxShadow: theme === k ? `0 0 10px ${v.accent}` : "none" }}>
                          <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: `radial-gradient(circle at 70% 30%, ${v.accent}60, transparent)` }} />
                        </div>
                        <span style={{ fontSize: "8px", color: t.ink + "80" }}>{k}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            },
          ].map(({ label, content }) => (
            <div key={label} style={{ marginBottom: "22px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.2em", color: t.accent, marginBottom: "9px", paddingLeft: "9px", borderLeft: `2px solid ${t.accent}` }}>{label}</div>
              {content}
            </div>
          ))}
        </div>

        <button onClick={() => onStart({ limitSec, goalType, goalValue: Number(goalValue) || 1, style, cellSize })}
          style={{ width: "100%", padding: "15px", background: `${t.accent}18`, border: `1px solid ${t.accent}`, color: t.accent, fontSize: "15px", letterSpacing: "0.3em", borderRadius: "6px", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          執筆を開始する
        </button>
        <p style={{ textAlign: "center", marginTop: "10px", fontSize: "10px", color: t.ink + "40" }}>ログイン不要 / データはブラウザのみに保持</p>
      </div>
    </div>
  );
}

// ===== WritingScreen =====
interface Config {
  limitSec: number; goalType: string; goalValue: number;
  style: string; cellSize: number;
  _reviveText?: string; _reviveKey?: number; _shieldsRemaining?: number;
}

function WritingScreen({ config, theme, onEnd, save, onSave }: {
  config: Config; theme: string;
  onEnd: (r: Record<string, unknown>) => void;
  save: SaveData; onSave: (s: SaveData) => void;
}) {
  const t = THEMES[theme];
  const { limitSec, goalType, goalValue, style, cellSize } = config;

  const totalShields = config._shieldsRemaining !== undefined
    ? config._shieldsRemaining
    : shieldCount(save.active);

  const [text, setText] = useState(config._reviveText || "");
  const [timerPct, setTimerPct] = useState(1);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [currentCell, setCurrentCell] = useState(cellSize);

  const textRef = useRef(config._reviveText || "");
  const hiddenRef = useRef<HTMLTextAreaElement>(null);
  const lastInputRef = useRef(Date.now());
  const typingTRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef(Date.now());
  const endedRef = useRef(false);

  const goalChars = goalType === "chars" ? goalValue : null;
  const goalTimeSec = goalType === "time" ? goalValue * 60 : null;
  const isVertical = style.includes("縦書き");
  const isGenkou = style === "縦書き原稿用紙";

  const triggerEnd = useCallback((type: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    const newSave = { ...save, totalChars: save.totalChars + textRef.current.length };
    writeSave(newSave);
    onSave(newSave);
    onEnd({ type, text: textRef.current, newTotal: newSave.totalChars, shieldReviveAvail: type === "fail" ? totalShields : 0 });
  }, [onEnd, save, onSave, totalShields]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      const el = Date.now() - lastInputRef.current;
      const pct = Math.max(0, 1 - el / (limitSec * 1000));
      setTimerPct(pct);
      if (pct <= 0) triggerEnd("fail");
    }, 50);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [limitSec, triggerEnd]);

  useEffect(() => {
    elapsedRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startRef.current) / 1000);
      setElapsedSec(sec);
      if (goalTimeSec && sec >= goalTimeSec) triggerEnd("success");
    }, 500);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [goalTimeSec, triggerEnd]);

  useEffect(() => {
    hiddenRef.current?.focus();
    const focus = () => hiddenRef.current?.focus();
    document.addEventListener("touchend", focus, { passive: true });
    return () => document.removeEventListener("touchend", focus);
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    textRef.current = val;
    setText(val);
    lastInputRef.current = Date.now();
    setIsTyping(true);
    if (typingTRef.current) clearTimeout(typingTRef.current);
    typingTRef.current = setTimeout(() => setIsTyping(false), 200);
    if (goalChars && val.length >= goalChars) triggerEnd("success");
  }, [goalChars, triggerEnd]);

  const isDanger = timerPct < 0.3;
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, "0");
  const ss = String(elapsedSec % 60).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0, background: t.bg, fontFamily: "'Noto Serif JP', Georgia, serif", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 12px", borderBottom: `1px solid ${t.ink}12`, background: isDanger ? `${t.danger}09` : `${t.bg}ee`, transition: "background 0.3s", flexShrink: 0, gap: "8px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px" }}>
          <span>
            <span style={{ color: isDanger ? t.danger : t.accent, fontWeight: 700, fontSize: "15px" }}>{text.length}</span>
            {goalChars && <span style={{ color: t.ink + "40" }}>/{goalChars}字</span>}
          </span>
          <span style={{ color: t.ink + "60" }}>{mm}:{ss}{goalTimeSec && <span style={{ color: t.ink + "30" }}>/{String(Math.floor(goalTimeSec / 60)).padStart(2, "0")}:00</span>}</span>
          <span style={{ color: isDanger ? t.danger : t.ink + "40", fontSize: "10px" }}>⏱{limitSec}秒</span>
          {totalShields > 0 && <span style={{ fontSize: "10px", color: t.accent }}>🛡×{totalShields}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ fontSize: "9px", color: t.ink + "40" }}>小</span>
          <input type="range" min={24} max={60} step={2} value={currentCell} onChange={e => setCurrentCell(Number(e.target.value))} style={{ width: "60px", accentColor: t.accent }} />
          <span style={{ fontSize: "9px", color: t.ink + "40" }}>大</span>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: isGenkou ? t.paper : t.bg, cursor: "text" }}
        onClick={() => hiddenRef.current?.focus()}>
        {isGenkou ? (
          <GenkouCanvas text={text} t={t} timerPct={timerPct} cellSize={currentCell} />
        ) : (
          <>
            <div style={{ position: "absolute", inset: 0, padding: isVertical ? "20px 16px" : "20px 24px", fontFamily: "'Noto Serif JP',Georgia,serif", fontSize: `${currentCell * 0.7}px`, lineHeight: "2.1", letterSpacing: "0.06em", writingMode: isVertical ? "vertical-rl" : "horizontal-tb", overflowY: isVertical ? "hidden" : "auto", overflowX: isVertical ? "auto" : "hidden", pointerEvents: "none", wordBreak: "break-all", color: t.ink, opacity: Math.max(0.03, timerPct), transition: "opacity 0.05s" }}>
              {text || <span style={{ opacity: 0.2 }}>ここに書け。</span>}
            </div>
            <textarea ref={hiddenRef} value={text} onInput={handleInput} onChange={handleInput}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: "'Noto Serif JP',Georgia,serif", fontSize: `${currentCell * 0.7}px`, lineHeight: "2.1", letterSpacing: "0.06em", padding: isVertical ? "20px 16px" : "20px 24px", writingMode: isVertical ? "vertical-rl" : "horizontal-tb", color: "transparent", caretColor: t.accent, overflowY: isVertical ? "hidden" : "auto", overflowX: isVertical ? "auto" : "hidden", wordBreak: "break-all" }} />
          </>
        )}
        {isGenkou && (
          <textarea ref={hiddenRef} value={text} onInput={handleInput} onChange={handleInput}
            style={{ position: "fixed", bottom: 0, left: 0, width: "100vw", height: "1px", opacity: 0.01, border: "none", outline: "none", background: "transparent", resize: "none", fontSize: "16px", color: "transparent", caretColor: "transparent" }} />
        )}
        {text.length === 0 && isGenkou && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.ink + "25", fontSize: "13px", letterSpacing: "0.2em", pointerEvents: "none" }}>タップして書き始める</div>
        )}
      </div>

      <CheerPanel save={save} isTyping={isTyping} isDanger={isDanger} totalChars={save.totalChars + text.length} t={t} />

      {isDanger && (
        <div style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", background: `${t.danger}20`, border: `1px solid ${t.danger}65`, color: t.danger, padding: "6px 20px", borderRadius: "20px", fontSize: "12px", letterSpacing: "0.1em", pointerEvents: "none", animation: "wp 0.5s infinite alternate", whiteSpace: "nowrap" }}>
          ⚠ 書け。今すぐ書け。
        </div>
      )}
      <style>{`@keyframes wp{from{opacity:0.6}to{opacity:1}}`}</style>
    </div>
  );
}

// ===== ResultScreen =====
function ResultScreen({ result, theme, onRestart, onOpenShop, save, onRevive }: {
  result: Record<string, unknown>; theme: string;
  onRestart: () => void; onOpenShop: () => void;
  save: SaveData; onRevive: (text: string, shields: number) => void;
}) {
  const t = THEMES[theme];
  const isSuccess = result.type === "success";
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const canRead = isSuccess;
  const btn = (ex: Record<string, unknown>) => ({ padding: "11px 18px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", letterSpacing: "0.08em", fontFamily: "inherit", outline: "none", ...ex });

  const handleCopy = async () => {
    const text = result.text as string;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:absolute;left:-9999px;top:-9999px;opacity:0.01;font-size:16px";
        document.body.appendChild(ta);
        if (/ipad|iphone/i.test(navigator.userAgent)) {
          ta.contentEditable = "true";
          const range = document.createRange();
          range.selectNodeContents(ta);
          const sel = window.getSelection();
          sel?.removeAllRanges(); sel?.addRange(range);
          ta.setSelectionRange(0, 999999);
        } else { ta.select(); }
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const ta = document.getElementById("result-text-area") as HTMLTextAreaElement;
      if (ta) { ta.focus(); ta.select(); }
      alert("テキストを手動で選択してコピーしてください。");
    }
  };

  const handleSave = () => {
    try {
      const blob = new Blob([result.text as string], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `genkou_${new Date().toISOString().slice(0, 10)}.txt`;
      a.style.display = "none";
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch { alert("保存に失敗しました。コピーして手動で保存してください。"); }
  };

  const handlePayment = async () => {
    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "revive", price: 300 }),
      });
      const { url } = await res.json();
      if (url) {
        sessionStorage.setItem("kindan_revive_text", result.text as string);
        window.location.href = url;
      }
    } catch { setPaying(false); alert("決済の開始に失敗しました。"); }
  };

  return (
    <div style={{ minHeight: "100vh", background: t.bg, color: t.ink, fontFamily: "'Noto Serif JP', Georgia, serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 20px", overflowY: "auto" }}>
      <div style={{ maxWidth: "440px", width: "100%", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "8px", flexWrap: "wrap" }}>
          {CHARA_DEFS.filter(c => ownedIds(save.owned).includes(c.id)).map((def, i) => (
            <CharaSVG key={def.id} def={def} size={40} isTyping={canRead} isDanger={!canRead} animDelay={i * 0.1} />
          ))}
        </div>
        <div style={{ fontSize: "24px" }}>{isSuccess ? "🎉" : "💀"}</div>
        <h2 style={{ fontSize: "20px", letterSpacing: "0.2em", color: isSuccess ? t.success : t.danger, margin: "6px 0" }}>{isSuccess ? "達成" : "消滅"}</h2>
        <p style={{ color: t.ink + "60", fontSize: "13px", marginBottom: "4px" }}>{(result.text as string).length}文字{isSuccess ? "を書き上げた。" : "の原稿が闇に消えた。"}</p>
        <p style={{ color: t.ink + "40", fontSize: "11px", marginBottom: "16px" }}>累計 <span style={{ color: t.accent }}>{(result.newTotal as number)?.toLocaleString() || save.totalChars.toLocaleString()}</span> 字</p>

        <div style={{ position: "relative", marginBottom: "16px" }}>
          <textarea id="result-text-area" readOnly value={canRead ? (result.text as string || "") : ""}
            style={{ width: "100%", height: "160px", background: t.paper, border: `1px solid ${canRead ? t.accent : t.danger}25`, borderRadius: "6px", padding: "14px", fontSize: "13px", lineHeight: "1.9", color: t.ink + "cc", filter: canRead ? "none" : "blur(6px)", userSelect: canRead ? "text" : "none", resize: "none", outline: "none", fontFamily: "'Noto Serif JP', Georgia, serif", cursor: canRead ? "text" : "default" }} />
          {!canRead && <div style={{ position: "absolute", inset: 0, background: `linear-gradient(transparent 40%, ${t.paper})`, pointerEvents: "none", borderRadius: "6px" }} />}
        </div>

        {isSuccess ? (
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={handleCopy} style={btn({ background: copied ? `${t.success}20` : `${t.accent}15`, border: `1px solid ${copied ? t.success : t.accent}`, color: copied ? t.success : t.accent }) as React.CSSProperties}>
              {copied ? "✓ コピーしました" : "クリップボードにコピー"}
            </button>
            <button onClick={handleSave} style={btn({ background: `${t.ink}08`, border: `1px solid ${t.ink}25`, color: t.ink + "65" }) as React.CSSProperties}>.txt で保存</button>
          </div>
        ) : (result.shieldReviveAvail as number) > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ background: `${t.accent}15`, border: `1px solid ${t.accent}40`, borderRadius: "8px", padding: "10px 14px" }}>
              <div style={{ fontSize: "11px", color: t.accent, marginBottom: "4px" }}>🛡 やまぶきが守ってくれる</div>
              <div style={{ fontSize: "10px", color: t.ink + "60" }}>残シールド {result.shieldReviveAvail as number}回</div>
            </div>
            <button onClick={() => onRevive(result.text as string, (result.shieldReviveAvail as number) - 1)}
              style={btn({ width: "100%", padding: "14px", background: `${t.accent}20`, border: `2px solid ${t.accent}`, color: t.accent, fontSize: "15px", letterSpacing: "0.2em", fontWeight: 700 }) as React.CSSProperties}>
              回復して戻る →
            </button>
            <button onClick={handlePayment} disabled={paying}
              style={btn({ width: "100%", padding: "11px", background: `${t.danger}10`, border: `1px solid ${t.danger}50`, color: t.danger, opacity: paying ? 0.6 : 1 }) as React.CSSProperties}>
              {paying ? "処理中..." : "¥300 で原稿を復活させる"}
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "11px", color: t.ink + "40", marginBottom: "10px" }}>テキストはまだブラウザ内に存在する。決済すれば取り戻せる。</p>
            <button onClick={handlePayment} disabled={paying}
              style={btn({ width: "100%", padding: "14px", background: `${t.danger}15`, border: `1px solid ${t.danger}75`, color: t.danger, fontSize: "14px", letterSpacing: "0.2em", opacity: paying ? 0.6 : 1 }) as React.CSSProperties}>
              {paying ? "処理中..." : "¥300 で原稿を復活させる"}
            </button>
          </>
        )}

        <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px", flexWrap: "wrap" }}>
          {isSuccess && <button onClick={onOpenShop} style={btn({ background: `${t.accent}12`, border: `1px solid ${t.accent}40`, color: t.accent }) as React.CSSProperties}>仲間を増やす ＋</button>}
          <button onClick={onRestart} style={btn({ background: "transparent", border: `1px solid ${t.ink}20`, color: t.ink + "50" }) as React.CSSProperties}>最初から</button>
        </div>
      </div>
    </div>
  );
}

// ===== ROOT =====
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [config, setConfig] = useState<Config | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [theme, setTheme] = useState("墨");
  const [save, setSave] = useState<SaveData>(() => ({
    totalChars: 0,
    owned: [{ id: "murasaki", count: 1 }],
    active: [{ id: "murasaki", activeCount: 1 }],
  }));
  const [showShop, setShowShop] = useState(false);

  // クライアントサイドでのみlocalStorageを読む
  useEffect(() => {
    setSave(loadSave());
    // Stripe決済完了後のキャラ解放
    const pendingChara = sessionStorage.getItem("kindan_pending_chara");
    if (pendingChara && window.location.search.includes("success=chara")) {
      sessionStorage.removeItem("kindan_pending_chara");
      const currentSave = loadSave();
      const existing = currentSave.owned.find(o => o.id === pendingChara);
      const newOwned = existing
        ? currentSave.owned.map(o => o.id === pendingChara ? { ...o, count: o.count + 1 } : o)
        : [...currentSave.owned, { id: pendingChara, count: 1 }];
      const alreadyActive = currentSave.active.find(a => a.id === pendingChara);
      const newActive = alreadyActive
        ? currentSave.active.map(a => a.id === pendingChara ? { ...a, activeCount: a.activeCount + 1 } : a)
        : [...currentSave.active, { id: pendingChara, activeCount: 1 }];
      const next = { ...currentSave, owned: newOwned, active: newActive };
      writeSave(next);
      setSave(next);
      window.history.replaceState({}, "", "/");
      setShowShop(true);
    }
    // 原稿復活決済完了後
    const reviveText = sessionStorage.getItem("kindan_revive_text");
    if (reviveText && window.location.search.includes("success=revive")) {
      sessionStorage.removeItem("kindan_revive_text");
      alert("原稿が復活しました！コピーしてください。");
      setResult({ type: "success", text: reviveText, newTotal: loadSave().totalChars, shieldReviveAvail: 0 });
      setScreen("result");
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const handleEnd = useCallback((res: Record<string, unknown>) => {
    setResult({ ...res, prevOwned: save.owned });
    setScreen("result");
  }, [save.owned]);

  const handleSave = useCallback((newSave: SaveData) => setSave(newSave), []);

  const handleRevive = useCallback((survivedText: string, shieldsRemaining: number) => {
    if (!config) return;
    setConfig(c => c ? { ...c, _reviveText: survivedText, _reviveKey: Date.now(), _shieldsRemaining: shieldsRemaining } : c);
    setResult(null);
    setScreen("writing");
  }, [config]);

  return (
    <>
      {screen === "setup" && (
        <SetupScreen
          onStart={(c) => { setConfig(c as Config); setScreen("writing"); }}
          theme={theme} setTheme={setTheme}
          save={save} onSave={handleSave} onOpenShop={() => setShowShop(true)}
        />
      )}
      {screen === "writing" && config && (
        <WritingScreen key={config._reviveKey || "main"} config={config} theme={theme} onEnd={handleEnd} save={save} onSave={handleSave} />
      )}
      {screen === "result" && result && (
        <ResultScreen result={result} theme={theme} save={save}
          onRestart={() => { setConfig(null); setResult(null); setScreen("setup"); }}
          onOpenShop={() => setShowShop(true)}
          onRevive={handleRevive}
        />
      )}
      {showShop && <ShopScreen save={save} onSave={handleSave} onClose={() => setShowShop(false)} theme={theme} />}
    </>
  );
}
