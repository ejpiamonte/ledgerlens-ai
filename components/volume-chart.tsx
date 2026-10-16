'use client';

import { useState } from 'react';
import type { DailyPoint } from '@/lib/insights';

const W = 720;
const H = 210;
const PAD = { top: 12, right: 8, bottom: 26, left: 30 };
const GAP = 2;

/** Rect with only the top corners rounded (data end), square at the baseline. */
function topRounded(x: number, y: number, w: number, h: number, r = 4) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export function VolumeChart({ data }: { data: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.touchless + d.reviewed));
  const step = max <= 4 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, k) => k * step);
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(18, band * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const active = hover === null ? null : data[hover];

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Invoices received per day over the last 30 days, split into touchless and reviewed"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              className={t === 0 ? 'baseline' : 'gridline'}
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(t)}
              y2={y(t)}
            />
            <text className="axis" x={PAD.left - 8} y={y(t) + 3} textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, k) => {
          const x = PAD.left + k * band + (band - barW) / 2;
          const hT = (d.touchless / top) * plotH;
          const hR = (d.reviewed / top) * plotH;
          const yT = PAD.top + plotH - hT;
          const yR = yT - hR;
          return (
            <g key={d.date}>
              {hover === k && (
                <rect
                  className="hover-band"
                  x={PAD.left + k * band}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                />
              )}
              {d.touchless > 0 && (
                <path
                  d={d.reviewed > 0 ? `M${x},${yT}h${barW}v${hT}h${-barW}Z` : topRounded(x, yT, barW, hT)}
                  fill="var(--series-1)"
                />
              )}
              {d.reviewed > 0 && (
                <path
                  d={topRounded(x, yR, barW, Math.max(0, hR - (d.touchless > 0 ? GAP : 0)))}
                  fill="var(--series-2)"
                />
              )}
              {(k % 5 === 4 || k === 0) && (
                <text className="axis" x={x + barW / 2} y={H - 8} textAnchor="middle">
                  {d.label}
                </text>
              )}
              <rect
                className="hit"
                x={PAD.left + k * band}
                y={PAD.top}
                width={band}
                height={plotH}
                onMouseEnter={() => setHover(k)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="tooltip"
          style={{
            left: `${((PAD.left + hover * band + band / 2) / W) * 100}%`,
            top: `${(y(active.touchless + active.reviewed) / H) * 100}%`,
            marginTop: -8,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{active.label}</div>
          <div className="tooltip-row">
            <span>
              <i className="swatch" style={{ background: 'var(--series-1)' }} />
              Touchless
            </span>
            <b>{active.touchless}</b>
          </div>
          <div className="tooltip-row">
            <span>
              <i className="swatch" style={{ background: 'var(--series-2)' }} />
              Reviewed by a person
            </span>
            <b>{active.reviewed}</b>
          </div>
        </div>
      )}
      <div className="legend">
        <span>
          <i className="swatch" style={{ background: 'var(--series-1)' }} />
          Touchless (auto-approved)
        </span>
        <span>
          <i className="swatch" style={{ background: 'var(--series-2)' }} />
          Reviewed by a person
        </span>
      </div>
      <details className="secondary" style={{ marginTop: 8 }}>
        <summary style={{ cursor: 'pointer' }}>View as table</summary>
        <div className="tablewrap" style={{ maxHeight: 220, marginTop: 6 }}>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Touchless</th>
                <th className="num">Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date}>
                  <td>{d.label}</td>
                  <td className="num">{d.touchless}</td>
                  <td className="num">{d.reviewed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
