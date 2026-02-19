import { API_BASE_URL } from "./config";
import type {
  TokenResponse,
  PresignedUrlResponse,
  ReviewCreateResponse,
  ReviewStatusResponse,
  ReviewListResponse,
  ChatResponse,
  TemplateResponse,
  TemplateCreateRequest,
  TemplateUpdateRequest,
} from "./types";

class ApiError extends Error {
  constructor(
    public status: number,
    public detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/auth/login";
      throw new ApiError(401, "Unauthorized");
    }
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  return res.json();
}

export const api = {
  // Auth
  register(email: string, password: string, name: string) {
    return request<TokenResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    });
  },

  login(email: string, password: string) {
    return request<TokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getMe() {
    return request<TokenResponse["user"]>("/api/auth/me");
  },

  getGoogleAuthUrl() {
    return request<{ authorization_url: string }>("/api/auth/google/authorize");
  },

  // Upload (presigned URL flow)
  presign(filenames: string[], templateId?: string, customRules?: string) {
    return request<PresignedUrlResponse>("/api/upload/presign", {
      method: "POST",
      body: JSON.stringify({
        filenames,
        template_id: templateId || null,
        custom_rules: customRules || null,
      }),
    });
  },

  startReview(reviewId: string) {
    return request<ReviewCreateResponse>(`/api/reviews/${reviewId}/start`, {
      method: "POST",
    });
  },

  // Reviews
  getReview(reviewId: string) {
    return request<ReviewStatusResponse>(`/api/reviews/${reviewId}`);
  },

  listReviews(limit = 20, offset = 0, status?: string) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set("status", status);
    return request<ReviewListResponse>(`/api/reviews?${params}`);
  },

  deleteReview(reviewId: string) {
    return request<{ detail: string }>(`/api/reviews/${reviewId}`, {
      method: "DELETE",
    });
  },

  // Chat
  chat(message: string, history: { role: string; content: string }[] = [], reviewId?: string) {
    return request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        history,
        review_id: reviewId || null,
      }),
    });
  },

  // Templates
  listTemplates() {
    return request<TemplateResponse[]>("/api/rule-templates");
  },

  getTemplate(templateId: string) {
    return request<TemplateResponse>(`/api/rule-templates/${templateId}`);
  },

  createTemplate(data: TemplateCreateRequest) {
    return request<TemplateResponse>("/api/rule-templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateTemplate(templateId: string, data: TemplateUpdateRequest) {
    return request<TemplateResponse>(`/api/rule-templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  deleteTemplate(templateId: string) {
    return request<Record<string, never>>(`/api/rule-templates/${templateId}`, {
      method: "DELETE",
    });
  },

  // Health
  health() {
    return request<{ status: string; db: string }>("/health");
  },
};

export { ApiError };
