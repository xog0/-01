export type Sector = "real_estate" | "equities" | "ventures" | "cash";
export type DealStatus = "open" | "funding" | "closed" | "exited";
export type RiskLevel = "low" | "moderate" | "high";
export type PostKind = "article" | "report";
export type RequestStatus = "new" | "contacted" | "qualified" | "archived";

/** نص ثنائي اللغة مخزّن في عمودين — Bilingual text stored in two columns. */
export interface Bilingual {
  ar: string;
  en: string;
}

export interface Opportunity {
  id: string;
  slug: string;
  title_ar: string;
  title_en: string;
  summary_ar: string;
  summary_en: string;
  body_ar: string;
  body_en: string;
  sector: Sector;
  status: DealStatus;
  risk: RiskLevel;
  location_ar: string;
  location_en: string;
  /** العائد السنوي المستهدف بالنسبة المئوية */
  target_return: number;
  min_ticket: number;
  horizon_years: number;
  target_raise: number;
  raised: number;
  highlights_ar: string[];
  highlights_en: string[];
  financials: {
    label_ar: string;
    label_en: string;
    value_ar: string;
    value_en: string;
  }[];
  /** مفتاح تدرّج لوني للغلاف بدل صورة خارجية */
  tone: "navy" | "gold" | "teal" | "plum";
  published: boolean;
  created_at: string;
}

export interface Post {
  id: string;
  slug: string;
  kind: PostKind;
  title_ar: string;
  title_en: string;
  excerpt_ar: string;
  excerpt_en: string;
  body_ar: string;
  body_en: string;
  author_ar: string;
  author_en: string;
  reading_minutes: number;
  file_url: string | null;
  tone: "navy" | "gold" | "teal" | "plum";
  published: boolean;
  published_at: string;
}

export interface NavPoint {
  period: string;
  value: number;
}

export interface AllocationSlice {
  sector: Sector;
  weight: number;
}

export interface AnnualReturn {
  year: number;
  net_return: number;
}

export interface PortfolioKpis {
  nav: number;
  irr: number;
  cash_yield: number;
  max_drawdown: number;
  deals: number;
  exits: number;
  as_of: string;
}

export interface InvestmentRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  amount: number | null;
  interest: Sector | null;
  message: string;
  status: RequestStatus;
  locale: string;
  created_at: string;
}

export interface TeamMember {
  initials: string;
  name_ar: string;
  name_en: string;
  role_ar: string;
  role_en: string;
  bio_ar: string;
  bio_en: string;
}
