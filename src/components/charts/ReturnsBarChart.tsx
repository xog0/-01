"use client";

import { useState } from "react";
import { axisInk, gridInk, niceScale, polarityColor } from "@/lib/charts";
import { formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { AnnualReturn } from "@/types";

const W = 560;
const H = 300;
const PAD = { top: 26, right: 10, bottom: 34, left: 40 };

/** قيم فوق/تحت خط الصفر: زوج لوني متباعد + الموضع كترميز ثانٍ. */
export function ReturnsBarChart({
  data,
  locale,
  label,
}: {
  data: AnnualReturn[];
  locale: Locale;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (!data.length) return null;

  const values = data.map((item) => item.net_return);
  const scale = niceScale(Math.min(0, ...values), Math.max(0, ...values));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / data.length;
  const barW = Math.min(34, slot * 0.58);

  const y = (value: number) =>
    PAD.top + plotH - ((value - scale.min) / (scale.max - scale.min)) * plotH;
  const zeroY = y(0);

  const ticks: number[] = [];
  for (let value = scale.min; value <= scale.max + 0.001; value += scale.step) {
    ticks.push(Number(value.toFixed(4)));
  }

  return (
    <figure dir="ltr">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={label}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? axisInk : gridInk}
              strokeWidth="1"
            />
            <text
              x={PAD.left - 10}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="12"
              fill={axisInk}
            >
              {tick}%
            </text>
          </g>
        ))}

        {data.map((item, index) => {
          const positive = item.net_return >= 0;
          const cx = PAD.left + slot * index + slot / 2;
          const top = positive ? y(item.net_return) : zeroY;
          const height = Math.max(2, Math.abs(y(item.net_return) - zeroY));
          const isHover = hover === index;

          return (
            <g
              key={item.year}
              onMouseEnter={() => setHover(index)}
              className="cursor-default"
            >
              <rect
                x={cx - slot / 2}
                y={PAD.top}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={height}
                rx="4"
                fill={positive ? polarityColor.positive : polarityColor.negative}
                opacity={hover === null || isHover ? 1 : 0.5}
              />
              {/* تسمية مباشرة فوق/تحت العمود */}
              <text
                x={cx}
                y={positive ? top - 8 : top + height + 15}
                textAnchor="middle"
                fontSize="12"
                fontWeight="700"
                fill={positive ? polarityColor.positive : polarityColor.negative}
              >
                {item.net_return > 0 ? "+" : ""}
                {item.net_return}%
              </text>
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                fontSize="12"
                fill={axisInk}
              >
                {item.year}
              </text>
            </g>
          );
        })}
      </svg>

      <figcaption className="sr-only">
        <table>
          <caption>{label}</caption>
          <tbody>
            {data.map((item) => (
              <tr key={item.year}>
                <th scope="row">{item.year}</th>
                <td>{formatPercent(item.net_return, locale, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
