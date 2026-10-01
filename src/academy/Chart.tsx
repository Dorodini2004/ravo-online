"use client";
import { useState } from "react";
import { aggregate } from "./logic.mjs";
export type Candle = { o: number; h: number; l: number; c: number };
export function candlesFor(variant = 0, phase = "up"): Candle[] {
  const wave = [
    0, 2, 5, 8, 6, 4, 3, 5, 8, 11, 9, 7, 6, 8, 11, 14, 12, 10, 9, 11, 14, 17,
    15, 13, 12, 14, 17, 20, 18, 16,
  ];
  return wave.map((v, i) => {
    const level =
      phase === "side" ? v - Math.floor(i / 7) * 3 : phase === "down" ? -v : v;
    const o = 100 + variant * 3 + level;
    const c = o + (i % 4 === 0 ? -2 : 1.5);
    return {
      o,
      h: Math.max(o, c) + 1 + (i % 3) * 0.25,
      l: Math.min(o, c) - 1,
      c,
    };
  });
}
export default function Chart({
  candles = candlesFor(),
  compact = false,
  marking = false,
  marks = [],
  onMark,
  zone,
  onZone,
  hideValues = false,
}: {
  candles?: Candle[];
  compact?: boolean;
  marking?: boolean;
  marks?: number[];
  onMark?: (i: number) => void;
  zone?: [number, number];
  onZone?: (v: [number, number]) => void;
  hideValues?: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const [frame, setFrame] = useState(1);
  const [anchor, setAnchor] = useState<number | null>(null);
  const effectiveFrame = candles.length < 5 ? 1 : frame;
  const data =
    effectiveFrame === 1 ? candles : (aggregate(candles, 5) as Candle[]);
  const low = Math.floor(Math.min(...data.map((c) => c.l)) - 3),
    high = Math.ceil(Math.max(...data.map((c) => c.h)) + 3);
  const W = 760,
    H = compact ? 250 : 320,
    left = 20,
    right = 65,
    top = 25,
    bottom = 40,
    plotH = H - top - bottom;
  const y = (p: number) => top + ((high - p) / (high - low)) * plotH;
  const gap = (W - left - right) / data.length;
  const chosen = data[Math.min(selected, data.length - 1)];
  const select = (i: number) => {
    setSelected(i);
    onMark?.(i);
  };
  function pointer(event: React.PointerEvent<SVGSVGElement>, end: boolean) {
    if (!onZone) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const p =
      Math.round(
        (high -
          ((((event.clientY - rect.top) / rect.height) * H - top) / plotH) *
            (high - low)) *
          2,
      ) / 2;
    if (!end) {
      setAnchor(p);
      event.currentTarget.setPointerCapture(event.pointerId);
    } else if (anchor !== null) {
      onZone([Math.min(anchor, p), Math.max(anchor, p)]);
      setAnchor(null);
    }
  }
  return (
    <div className={`ta-chart ${compact ? "compact" : ""}`}>
      <div className="chart-toolbar">
        <span>
          <b>ACADEMY / SIM</b>
          <span className="muted"> · Preise in Punkten</span>
        </span>
        {!marking && !onZone && (
          <div className="segmented">
            {[1, 5].map((n) => (
              <button
                key={n}
                disabled={n === 5 && candles.length < 5}
                aria-pressed={effectiveFrame === n}
                onClick={() => {
                  setFrame(n);
                  setSelected(0);
                }}
              >
                {n} Min
              </button>
            ))}
          </div>
        )}
      </div>
      {!hideValues && (
        <div className="ohlc">
          <span>
            O <b>{chosen.o.toFixed(2)}</b>
          </span>
          <span>
            H <b>{chosen.h.toFixed(2)}</b>
          </span>
          <span>
            L <b>{chosen.l.toFixed(2)}</b>
          </span>
          <span>
            C <b>{chosen.c.toFixed(2)}</b>
          </span>
          <span className={chosen.c >= chosen.o ? "positive" : "negative"}>
            {chosen.c >= chosen.o ? "+ steigend" : "− fallend"}
          </span>
        </div>
      )}
      <div className="chart-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="group"
          aria-label="Interaktiver Kerzenchart mit simulierten Daten"
          onPointerDown={(e) => pointer(e, false)}
          onPointerUp={(e) => pointer(e, true)}
          style={{ touchAction: onZone ? "none" : "auto" }}
        >
          {Array.from({ length: 5 }, (_, i) => {
            const p = low + ((high - low) * i) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={W - right + 8}
                  y1={y(p)}
                  y2={y(p)}
                  stroke="#29352f"
                  strokeDasharray="3 5"
                />
                <text
                  x={W - right + 15}
                  y={y(p) + 4}
                  fill="#84948d"
                  fontSize="11"
                >
                  {p.toFixed(1)}
                </text>
              </g>
            );
          })}
          {zone && (
            <g>
              <rect
                x={left}
                width={W - left - right}
                y={y(zone[1])}
                height={Math.max(1, y(zone[0]) - y(zone[1]))}
                fill="#b9f877"
                opacity=".16"
              />
              <line
                x1={left}
                x2={W - right}
                y1={y(zone[0])}
                y2={y(zone[0])}
                stroke="#b9f877"
                strokeDasharray="4 4"
              />
              <line
                x1={left}
                x2={W - right}
                y1={y(zone[1])}
                y2={y(zone[1])}
                stroke="#b9f877"
                strokeDasharray="4 4"
              />
            </g>
          )}
          {data.map((c, i) => {
            const x = left + gap * (i + 0.5),
              up = c.c >= c.o,
              bodyWidth = Math.min(22, gap * 0.46);
            return (
              <g
                key={i}
                tabIndex={0}
                role="button"
                aria-label={`Kerze ${i + 1}${hideValues ? "" : `: O ${c.o}, H ${c.h}, L ${c.l}, C ${c.c}`}`}
                aria-pressed={marking ? marks.includes(i) : selected === i}
                onClick={() => select(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    select(i);
                  }
                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const next =
                      e.key === "ArrowRight"
                        ? e.currentTarget.nextElementSibling
                        : e.currentTarget.previousElementSibling;
                    (next as SVGGElement | null)?.focus?.();
                  }
                }}
              >
                <rect
                  x={x - gap / 2}
                  y={top}
                  width={gap}
                  height={plotH}
                  fill={
                    marks.includes(i)
                      ? "#b9f87718"
                      : selected === i
                        ? "#ffffff06"
                        : "transparent"
                  }
                />
                <line
                  x1={x}
                  x2={x}
                  y1={y(c.h)}
                  y2={y(c.l)}
                  stroke={up ? "#8bcfae" : "#d88882"}
                  strokeWidth="1.5"
                />
                <rect
                  x={x - bodyWidth / 2}
                  y={y(Math.max(c.o, c.c))}
                  width={bodyWidth}
                  height={Math.max(2, Math.abs(y(c.o) - y(c.c)))}
                  fill={up ? "#8bcfae" : "#d88882"}
                  rx="1"
                />
                <text
                  x={x}
                  y={H - bottom + 17}
                  textAnchor="middle"
                  fill={marks.includes(i) ? "#c1f98a" : "#82968b"}
                  fontSize="9"
                >
                  {marking
                    ? i + 1
                    : i % 5 === 0
                      ? `${String(9 + Math.floor((i * effectiveFrame) / 60)).padStart(2, "0")}:${String((i * frame) % 60).padStart(2, "0")}`
                      : ""}
                </text>
                {marks.includes(i) && (
                  <text
                    x={x}
                    y={y(c.h) - 10}
                    textAnchor="middle"
                    fill="#c1f98a"
                    fontSize="14"
                  >
                    ◆
                  </text>
                )}
              </g>
            );
          })}
          <text x={left} y={H - 3} fill="#82968b" fontSize="10">
            {marking
              ? "Kerzennummer · alle gezeigten Kerzen geschlossen"
              : "Simulationszeit · Europe/Vienna · 01.10.2026"}
          </text>
        </svg>
      </div>
      <span className="chart-mobile-hint">
        Chart seitlich scrollbar · Kerzen per Touch oder Tastatur auswählen
      </span>
      <div className="chart-caption">
        <span>
          <i className="legend-up" /> + Steigend <i className="legend-down" /> −
          Fallend
        </span>
        <span>SIMULIERTE DATEN</span>
      </div>
    </div>
  );
}
