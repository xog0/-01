import { cn } from "@/lib/format";
import type { DealStatus, RiskLevel } from "@/types";

const statusStyles: Record<DealStatus, string> = {
  open: "bg-positive/10 text-positive",
  funding: "bg-gold-100 text-gold-600",
  closed: "bg-paper-2 text-muted",
  exited: "bg-navy-100 text-navy-700",
};

const statusStylesOnDark: Record<DealStatus, string> = {
  open: "bg-[#0E8F80]/25 text-[#7FE3D3]",
  funding: "bg-gold-400/20 text-gold-300",
  closed: "bg-white/10 text-navy-100/80",
  exited: "bg-white/10 text-navy-100/80",
};

const riskStyles: Record<RiskLevel, string> = {
  low: "bg-positive/10 text-positive",
  moderate: "bg-gold-100 text-gold-600",
  high: "bg-negative/10 text-negative",
};

const riskStylesOnDark: Record<RiskLevel, string> = {
  low: "bg-[#0E8F80]/25 text-[#7FE3D3]",
  moderate: "bg-gold-400/20 text-gold-300",
  high: "bg-[#C2562A]/30 text-[#F0A98A]",
};

export function StatusBadge({
  status,
  label,
  onDark = false,
}: {
  status: DealStatus;
  label: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("badge", onDark ? statusStylesOnDark[status] : statusStyles[status])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function RiskBadge({
  risk,
  label,
  onDark = false,
}: {
  risk: RiskLevel;
  label: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn("badge", onDark ? riskStylesOnDark[risk] : riskStyles[risk])}>
      {label}
    </span>
  );
}
