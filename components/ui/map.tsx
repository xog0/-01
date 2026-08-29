"use client";

import { useId, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { MAP_HEIGHT, MAP_REGION, MAP_WIDTH } from "./map.projection";

export type MapPoint = {
  lat: number;
  lng: number;
  label?: string;
};

export type MapArc = {
  start: MapPoint;
  end: MapPoint;
};

export type WorldMapProps = {
  dots?: MapArc[];
  /** Stroke colour for the arcs and their endpoints. */
  lineColor?: string;
  className?: string;
};

/**
 * `dotted-map` renders a Mercator projection clipped to MAP_REGION, so latitude
 * is *not* linear in y. Projecting with a plain equirectangular formula drifts
 * badly towards the poles — Fairbanks lands ~5 units off. Mirror the real
 * projection instead so endpoints sit on their dots.
 */
const mercatorY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));

const Y_TOP = mercatorY(MAP_REGION.lat.max);
const Y_BOTTOM = mercatorY(MAP_REGION.lat.min);

function projectPoint({ lat, lng }: MapPoint) {
  const x =
    ((lng - MAP_REGION.lng.min) / (MAP_REGION.lng.max - MAP_REGION.lng.min)) *
    MAP_WIDTH;
  const y = ((Y_TOP - mercatorY(lat)) / (Y_TOP - Y_BOTTOM)) * MAP_HEIGHT;
  return { x, y };
}

/** Lift the control point in proportion to span so short and long hops arc alike. */
function curvedPath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const lift = Math.hypot(b.x - a.x, b.y - a.y) * 0.25;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2 - lift;
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
}

export function WorldMap({
  dots = [],
  lineColor = "#0ea5e9",
  className,
}: WorldMapProps) {
  const gradientId = useId();
  const reduceMotion = useReducedMotion();

  const arcs = useMemo(
    () =>
      dots.map(({ start, end }) => ({
        start,
        end,
        from: projectPoint(start),
        to: projectPoint(end),
      })),
    [dots],
  );

  // Hubs repeat across arcs (New Delhi appears three times) — draw each once.
  const places = useMemo(() => {
    const seen = new Map<string, MapPoint & { x: number; y: number }>();
    for (const { start, end } of dots) {
      for (const point of [start, end]) {
        const key = `${point.lat},${point.lng}`;
        if (!seen.has(key)) seen.set(key, { ...point, ...projectPoint(point) });
      }
    }
    return [...seen.values()];
  }, [dots]);

  const routeSummary = dots
    .map(({ start, end }) => `${start.label ?? "start"} to ${end.label ?? "end"}`)
    .join(", ");

  return (
    <div
      className={`relative aspect-[198/100] w-full ${className ?? ""}`}
    >
      {/* Decorative basemap. Two files instead of a theme hook: no provider,
          no hydration mismatch, and the browser only fetches the visible one.
          next/image is deliberately not used: it passes SVGs through
          unoptimized anyway, and these are static local assets that the server
          already serves gzipped (~22 KB each). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/world-map-light.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 h-full w-full select-none dark:hidden"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/world-map-dark.svg"
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute inset-0 hidden h-full w-full select-none dark:block"
      />

      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="pointer-events-none absolute inset-0 h-full w-full select-none"
        role="img"
        aria-label={
          routeSummary
            ? `World map showing connections: ${routeSummary}.`
            : "World map"
        }
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            {/* Fade in the line's own hue, not white: interpolating from white
                leaves a grey haze at the arc tips on a dark background. */}
            <stop offset="0%" stopColor={lineColor} stopOpacity="0" />
            <stop offset="15%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="85%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {arcs.map(({ from, to }, i) => (
          <motion.path
            key={`arc-${i}`}
            d={curvedPath(from, to)}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="0.4"
            strokeLinecap="round"
            // `initial` must not depend on reduceMotion: it is baked into the
            // SSR markup, and useReducedMotion only resolves on the client, so
            // branching here produces a hydration mismatch (React #418).
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { duration: 1.1, delay: 0.35 * i, ease: "easeOut" }
            }
          />
        ))}

        {places.map((place, i) => (
          <g key={`place-${i}`}>
            <circle cx={place.x} cy={place.y} r="0.5" fill={lineColor} />
            {/* Rendered unconditionally and silenced in CSS — a JS-side
                conditional would change the markup between server and client.
                The stylesheet drops it under prefers-reduced-motion. */}
            <circle
              cx={place.x}
              cy={place.y}
              r="0.5"
              fill={lineColor}
              className="world-map-ping"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
            {place.label && (
              <text
                x={place.x}
                y={place.y - 1.8}
                textAnchor="middle"
                fontSize="2.6"
                // Halo keeps labels legible over the dot grid in both themes.
                strokeWidth="0.7"
                paintOrder="stroke"
                className="fill-neutral-700 stroke-white dark:fill-neutral-200 dark:stroke-black"
              >
                {place.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default WorldMap;
