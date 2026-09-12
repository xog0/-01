"use client";

import { useId, useState } from "react";
import { axisInk, gridInk, niceScale, seriesInk } from "@/lib/charts";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { NavPoint } from "@/types";

const W = 1000;
const H = 360;
const PAD = { top: 22, right: 22, bottom: 42, left: 56 };

/** سلسلة واحدة — لا حاجة للوسيلة الإيضاحية، العنوان يسمّيها. */
export function NavTrendChart({
  data,
  locale,
  valueLabel,
}: {
  data: NavPoint[];
  locale: Locale;
  valueLabel: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length < 2) return null;

  const values = data.map((point) => point.value);
  const scale = niceScale(Math.min(...values), Math.max(...values));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (index: number) => PAD.left + (index / (data.length - 1)) * plotW;
  const y = (value: number) =>
    PAD.top + plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;

  const linePath = data
    .map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point.value)}`)
    .join(" ");
  const areaPath = `${linePath} L${x(data.length - 1)},${PAD.top + plotH} L${x(0)},${PAD.top + plotH} Z`;

  const ticks: number[] = [];
  for (let value = scale.min; value <= scale.max + 0.001; value += scale.step) {
    ticks.push(Number(value.toFixed(4)));
  }

  const active = hover === null ? null : data[hover];
  const last = data[data.length - 1];

  return (
    <figure dir="ltr" className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={valueLabel}
        className="overflow-visible"
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={seriesInk} stopOpacity="0.16" />
            <stop offset="100%" stopColor={seriesInk} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* شبكة خافتة */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={gridInk}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 12}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="13"
              fill={axisInk}
            >
              {formatNumber(tick, "en")}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={seriesInk}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* النقطة الأخيرة معلّمة مباشرة */}
        <circle cx={x(data.length - 1)} cy={y(last.value)} r="4.5" fill="#C9A227" stroke="#fff" strokeWidth="2" />

        {/* خط التتبّع عند المرور */}
        {active && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              stroke={seriesInk}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.5"
            />
            <circle cx={x(hover)} cy={y(active.value)} r="5" fill={seriesInk} stroke="#fff" strokeWidth="2" />
          </g>
        )}

        {data.map((point, index) => (
          <g key={point.period}>
            {index % Math.ceil(data.length / 8) === 0 || index === data.length - 1 ? (
              <text
                x={x(index)}
                y={H - 10}
                textAnchor="middle"
                fontSize="13"
                fill={axisInk}
              >
                {point.period}
              </text>
            ) : null}
            {/* هدف تمرير أوسع من العلامة نفسها */}
            <rect
              x={x(index) - plotW / (data.length - 1) / 2}
              y={PAD.top}
              width={plotW / (data.length - 1)}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(index)}
              onFocus={() => setHover(index)}
              tabIndex={-1}
            />
          </g>
        ))}
      </svg>

      {active && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(active.value) / H) * 100}%`,
          }}
        >
          <p className="font-semibold text-navy-900">{active.period}</p>
          <p className="tnum mt-0.5 text-muted">
            {formatNumber(active.value, locale, 1)}
          </p>
        </div>
      )}

      {/* جدول مكافئ لقارئات الشاشة */}
      <figcaption className="sr-only">
        <table>
          <caption>{valueLabel}</caption>
          <tbody>
            {data.map((point) => (
              <tr key={point.period}>
                <th scope="row">{point.period}</th>
                <td>{point.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
