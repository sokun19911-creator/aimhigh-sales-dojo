export type Phase = "setup" | "battle" | "scoring" | "result";

export interface Message {
  role: "staff" | "customer";
  text: string;
}

export interface Deduction {
  points: number;
  reason: string;
}

export interface Scoring {
  score: number;
  highlights: string[];
  deductions: Deduction[];
  summary: string;
}

export interface ObjectionResult {
  accepted: boolean;
  new_score: number;
  verdict: string;
}

export interface CustomerResponse {
  reply: string;
  guard: number;
  status: "continue" | "win" | "lose";
}

export interface RoleplayResult {
  id: string;
  staff_name: string;
  scenario_id: string;
  scenario_label: string;
  category: string;
  is_random: boolean;
  score: number;
  highlights: string[];
  deductions: Deduction[];
  summary: string;
  transcript: Message[];
  created_at: string;
}
