import type { Sector } from "@/types";

/**
 * لوحة ألوان الرسوم — تم التحقق منها بأداة validate_palette (كل الفحوص PASS)
 * على سطح فاتح: نطاق الإضاءة، حد التشبّع، فصل عمى الألوان، والتباين.
 * الترتيب ثابت ولا يُعاد توزيعه عند تغيّر عدد الفئات.
 */
export const sectorColor: Record<Sector, string> = {
  real_estate: "#2E6BB8",
  equities: "#0E8F80",
  ventures: "#B9861A",
  cash: "#A05FA8",
};

/** زوج متباعد للقيم فوق/تحت الصفر — آمن لعمى الألوان (ΔE 11.9 deutan). */
export const polarityColor = {
  positive: "#0E8F80",
  negative: "#C2562A",
};

/** لون السلسلة المفردة — كحلي الهوية. */
export const seriesInk = "#163356";
export const gridInk = "#E4E1D8";
export const axisInk = "#8A93A3";

export function niceScale(min: number, max: number, ticks = 4) {
  const span = max - min || 1;
  const raw = span / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * magnitude >= raw)! * magnitude;
  return {
    min: Math.floor(min / step) * step,
    max: Math.ceil(max / step) * step,
    step,
  };
}
