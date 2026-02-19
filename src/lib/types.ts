// Auth
export interface UserResponse {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponse {
  token: string;
  token_type: "bearer";
  user: UserResponse;
}

// Upload
export interface PresignedUrlItem {
  filename: string;
  upload_url: string;
  r2_key: string;
}

export interface PresignedUrlResponse {
  review_id: string;
  files: PresignedUrlItem[];
  expires_in: number;
}

// Review
export interface ReviewCreateResponse {
  review_id: string;
  status: "processing";
  file_count: number;
  created_at: string;
  estimated_seconds: number;
}

export interface ReviewProgress {
  phase: string;
  detail: string;
  completed_groups: number;
  total_groups: number;
}

export interface ChecklistItem {
  item: string;
  status: "pass" | "warning" | "fail";
  detail: string;
  [key: string]: unknown;
}

export interface DocumentResult {
  doc_type: string;
  filename: string;
  extracted_data: Record<string, unknown>;
  checklist: ChecklistItem[];
  status: "pass" | "warning" | "fail";
}

export interface CrossValidationItem {
  check_type: string;
  description: string;
  status: "pass" | "warning" | "fail";
  details: string;
}

export interface ReviewSummary {
  total_docs: number;
  passed: number;
  warnings: number;
  failures: number;
  critical_issues: string[];
  action_required: string[];
  opinion: string;
}

export interface ReviewResult {
  meta: Record<string, unknown>;
  documents: DocumentResult[];
  cross_validation: CrossValidationItem[];
  summary: ReviewSummary;
}

export interface Usage {
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  duration_seconds: number;
}

export type ReviewStatus = "pending" | "processing" | "completed" | "failed";

export interface ReviewStatusResponse {
  review_id: string;
  status: ReviewStatus;
  progress: ReviewProgress | null;
  result: ReviewResult | null;
  usage: Usage | null;
  error: string | null;
}

export interface ReviewListResponse {
  reviews: ReviewStatusResponse[];
  total: number;
}

// Chat
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  reply: string;
  usage: Usage | null;
}

// Custom Rules
export interface CustomChecklist {
  doc_type: string;
  checklist_md: string;
}

// Templates
export interface TemplateResponse {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TemplateCreateRequest {
  name: string;
  description?: string | null;
  rules: Record<string, unknown>;
}

export interface TemplateUpdateRequest {
  name?: string | null;
  description?: string | null;
  rules?: Record<string, unknown> | null;
}
