# Frontend MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js frontend for the KR Document Review API with auth, file upload, review processing, and results display.

**Architecture:** Next.js 16 App Router with shadcn/ui components, Zustand for auth state, next-intl for i18n (ko/en). Presigned URL upload flow to R2. Polling-based progress tracking.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Zustand, next-intl

**Backend API:** https://github.com/Ustay-coder/document-check-backend — see `specs/API-SPEC.md` for full endpoint reference.

**Working directory:** `/Users/jeean/projects/document-check/frontend`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install runtime dependencies**

```bash
cd /Users/jeean/projects/document-check/frontend
npm install zustand next-intl
```

**Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Neutral
- CSS variables: Yes

**Step 3: Add shadcn/ui components we need**

```bash
npx shadcn@latest add button card input label badge table dialog dropdown-menu separator tabs accordion progress alert toast sonner
```

**Step 4: Verify build works**

```bash
npm run build
```

Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: install shadcn/ui, zustand, next-intl"
```

---

## Task 2: TypeScript Types + API Client

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/api.ts`
- Create: `src/lib/config.ts`

**Step 1: Create config**

Create `src/lib/config.ts`:

```typescript
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const POLL_INTERVAL_MS = 2000;
```

**Step 2: Create TypeScript types matching API spec**

Create `src/lib/types.ts` with types from `specs/API-SPEC.md` section 4:

```typescript
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

// Templates
export interface TemplateResponse {
  id: string;
  name: string;
  description: string | null;
  rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Create API client**

Create `src/lib/api.ts`:

```typescript
import { API_BASE_URL } from "./config";
import type {
  TokenResponse,
  PresignedUrlResponse,
  ReviewCreateResponse,
  ReviewStatusResponse,
  ReviewListResponse,
  ChatResponse,
  TemplateResponse,
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

  // Health
  health() {
    return request<{ status: string; db: string }>("/health");
  },
};

export { ApiError };
```

**Step 4: Verify build**

```bash
npm run build
```

**Step 5: Commit**

```bash
git add src/lib/
git commit -m "feat: add TypeScript types and API client"
```

---

## Task 3: Auth Store (Zustand)

**Files:**
- Create: `src/stores/auth.ts`

**Step 1: Create auth store**

Create `src/stores/auth.ts`:

```typescript
import { create } from "zustand";
import { api } from "@/lib/api";
import type { UserResponse } from "@/lib/types";

interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;

  setAuth: (token: string, user: UserResponse) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: (token, user) => {
    localStorage.setItem("token", token);
    set({ token, user, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, user: null, isLoading: false });
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const user = await api.getMe();
      set({ token, user, isLoading: false });
    } catch {
      localStorage.removeItem("token");
      set({ token: null, user: null, isLoading: false });
    }
  },
}));
```

**Step 2: Commit**

```bash
git add src/stores/
git commit -m "feat: add Zustand auth store"
```

---

## Task 4: i18n Setup (next-intl)

**Files:**
- Create: `src/i18n/request.ts`
- Create: `src/i18n/routing.ts`
- Create: `messages/ko.json`
- Create: `messages/en.json`
- Modify: `next.config.ts`

**Step 1: Create i18n config files**

Create `src/i18n/routing.ts`:

```typescript
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ko", "en"],
  defaultLocale: "ko",
});
```

Create `src/i18n/request.ts`:

```typescript
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "ko" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

**Step 2: Create translation files**

Create `messages/ko.json`:

```json
{
  "common": {
    "appName": "서류 검토 AI",
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "다시 시도",
    "cancel": "취소",
    "save": "저장",
    "delete": "삭제",
    "download": "다운로드",
    "logout": "로그아웃",
    "back": "뒤로"
  },
  "auth": {
    "login": "로그인",
    "register": "회원가입",
    "email": "이메일",
    "password": "비밀번호",
    "name": "이름",
    "googleLogin": "Google로 로그인",
    "noAccount": "계정이 없으신가요?",
    "hasAccount": "이미 계정이 있으신가요?",
    "registerLink": "회원가입",
    "loginLink": "로그인"
  },
  "dashboard": {
    "title": "검토 이력",
    "newReview": "새 검토",
    "noReviews": "아직 검토 이력이 없습니다",
    "status": {
      "pending": "대기",
      "processing": "진행 중",
      "completed": "완료",
      "failed": "실패"
    },
    "columns": {
      "id": "검토 ID",
      "status": "상태",
      "files": "파일 수",
      "date": "날짜",
      "cost": "비용"
    }
  },
  "upload": {
    "title": "새 검토",
    "dropzone": "검토할 서류를 업로드하세요",
    "dropzoneHint": "PDF, JPG, PNG 파일을 드래그하거나 클릭하여 선택",
    "filesSelected": "{count}개 파일 선택됨",
    "template": "규칙 템플릿 (선택)",
    "templateNone": "기본 규칙 사용",
    "startReview": "검토 시작",
    "uploading": "업로드 중..."
  },
  "review": {
    "processing": "{count}건 검토 진행 중...",
    "phase1": "Phase 1: 전처리",
    "phase2": "Phase 2: OCR + 검토",
    "phase3": "Phase 3: 교차검증",
    "completed": "검토가 완료되었습니다!",
    "failed": "검토 실패",
    "summary": "검토 결과 요약",
    "passed": "통과",
    "warnings": "주의",
    "failures": "오류",
    "documents": "문서별 상세",
    "crossValidation": "교차검증",
    "downloadJson": "JSON 다운로드",
    "newReview": "새 검토 시작",
    "cost": "비용",
    "duration": "소요 시간",
    "seconds": "초"
  }
}
```

Create `messages/en.json`:

```json
{
  "common": {
    "appName": "Document Review AI",
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Retry",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "download": "Download",
    "logout": "Logout",
    "back": "Back"
  },
  "auth": {
    "login": "Login",
    "register": "Register",
    "email": "Email",
    "password": "Password",
    "name": "Name",
    "googleLogin": "Sign in with Google",
    "noAccount": "Don't have an account?",
    "hasAccount": "Already have an account?",
    "registerLink": "Register",
    "loginLink": "Login"
  },
  "dashboard": {
    "title": "Review History",
    "newReview": "New Review",
    "noReviews": "No reviews yet",
    "status": {
      "pending": "Pending",
      "processing": "Processing",
      "completed": "Completed",
      "failed": "Failed"
    },
    "columns": {
      "id": "Review ID",
      "status": "Status",
      "files": "Files",
      "date": "Date",
      "cost": "Cost"
    }
  },
  "upload": {
    "title": "New Review",
    "dropzone": "Upload documents for review",
    "dropzoneHint": "Drag & drop PDF, JPG, PNG files or click to browse",
    "filesSelected": "{count} files selected",
    "template": "Rule Template (optional)",
    "templateNone": "Use default rules",
    "startReview": "Start Review",
    "uploading": "Uploading..."
  },
  "review": {
    "processing": "Reviewing {count} documents...",
    "phase1": "Phase 1: Preprocessing",
    "phase2": "Phase 2: OCR + Review",
    "phase3": "Phase 3: Cross-validation",
    "completed": "Review completed!",
    "failed": "Review failed",
    "summary": "Review Summary",
    "passed": "Passed",
    "warnings": "Warnings",
    "failures": "Failures",
    "documents": "Document Details",
    "crossValidation": "Cross-validation",
    "downloadJson": "Download JSON",
    "newReview": "Start New Review",
    "cost": "Cost",
    "duration": "Duration",
    "seconds": "sec"
  }
}
```

**Step 3: Update next.config.ts**

Modify `next.config.ts` to integrate next-intl with `createNextIntlPlugin`:

```typescript
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

**Step 4: Restructure app for locale routing**

Move `src/app/` contents into `src/app/[locale]/` for next-intl locale prefix routing:

- Move: `src/app/layout.tsx` → `src/app/[locale]/layout.tsx` (update with next-intl provider)
- Move: `src/app/page.tsx` → `src/app/[locale]/page.tsx`
- Move: `src/app/globals.css` stays at `src/app/globals.css`
- Create: `src/middleware.ts` for locale detection
- Create: `src/app/[locale]/layout.tsx` with `NextIntlClientProvider`

Create `src/middleware.ts`:

```typescript
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

Update `src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Geist, Geist_Mono } from "next/font/google";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Document Review AI",
  description: "AI-powered Korean business document review",
};

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

**Step 5: Verify build**

```bash
npm run build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add i18n with next-intl (ko/en)"
```

---

## Task 5: App Shell — Layout, Header, Auth Guard

**Files:**
- Create: `src/components/header.tsx`
- Create: `src/components/auth-guard.tsx`
- Create: `src/components/locale-switcher.tsx`
- Modify: `src/app/[locale]/layout.tsx`

**Step 1: Create locale switcher**

Create `src/components/locale-switcher.tsx`:

```tsx
"use client";

import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchLocale() {
    const newLocale = locale === "ko" ? "en" : "ko";
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
  }

  return (
    <Button variant="ghost" size="sm" onClick={switchLocale}>
      {locale === "ko" ? "EN" : "KR"}
    </Button>
  );
}
```

**Step 2: Create header**

Create `src/components/header.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/stores/auth";
import { LocaleSwitcher } from "./locale-switcher";
import { Button } from "@/components/ui/button";

export function Header({ locale }: { locale: string }) {
  const t = useTranslations();
  const { user, logout } = useAuthStore();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href={`/${locale}/dashboard`} className="text-lg font-semibold">
          {t("common.appName")}
        </Link>
        <div className="flex items-center gap-2">
          <LocaleSwitcher locale={locale} />
          {user && (
            <>
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="ghost" size="sm" onClick={logout}>
                {t("common.logout")}
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
```

**Step 3: Create auth guard**

Create `src/components/auth-guard.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth";

export function AuthGuard({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const { user, isLoading, loadFromStorage } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/${locale}/auth/login`);
    }
  }, [isLoading, user, router, locale]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return <>{children}</>;
}
```

**Step 4: Commit**

```bash
git add src/components/
git commit -m "feat: add header, auth guard, locale switcher"
```

---

## Task 6: Auth Pages — Login + Register

**Files:**
- Create: `src/app/[locale]/auth/login/page.tsx`
- Create: `src/app/[locale]/auth/register/page.tsx`
- Create: `src/app/[locale]/auth/callback/page.tsx`

**Step 1: Create login page**

Create `src/app/[locale]/auth/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(email, password);
      setAuth(res.token, res.user);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const { authorization_url } = await api.getGoogleAuthUrl();
      window.location.href = authorization_url;
    } catch {
      setError("Failed to start Google login");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.login")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("auth.login")}
            </Button>
          </form>

          <Separator className="my-6" />

          <Button
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
          >
            {t("auth.googleLogin")}
          </Button>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.noAccount")}{" "}
            <Link
              href={`/${locale}/auth/register`}
              className="font-medium text-foreground underline"
            >
              {t("auth.registerLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create register page**

Create `src/app/[locale]/auth/register/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function RegisterPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();
  const { setAuth } = useAuthStore();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register(email, password, name);
      setAuth(res.token, res.user);
      router.push(`/${locale}/dashboard`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("auth.register")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="space-y-2">
              <Label htmlFor="name">{t("auth.name")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.loading") : t("auth.register")}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t("auth.hasAccount")}{" "}
            <Link
              href={`/${locale}/auth/login`}
              className="font-medium text-foreground underline"
            >
              {t("auth.loginLink")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Create OAuth callback page**

Create `src/app/[locale]/auth/callback/page.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth";
import { api } from "@/lib/api";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useParams<{ locale: string }>();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      localStorage.setItem("token", token);
      api.getMe().then((user) => {
        setAuth(token, user);
        router.replace(`/${locale}/dashboard`);
      }).catch(() => {
        router.replace(`/${locale}/auth/login`);
      });
    } else {
      router.replace(`/${locale}/auth/login`);
    }
  }, [searchParams, router, locale, setAuth]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Authenticating...</p>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add login, register, and OAuth callback pages"
```

---

## Task 7: Dashboard Page — Review History

**Files:**
- Create: `src/app/[locale]/dashboard/page.tsx`
- Create: `src/app/[locale]/dashboard/layout.tsx`

**Step 1: Create dashboard layout (with auth guard + header)**

Create `src/app/[locale]/dashboard/layout.tsx`:

```tsx
import { Header } from "@/components/header";
import { AuthGuard } from "@/components/auth-guard";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <AuthGuard locale={locale}>
      <Header locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </AuthGuard>
  );
}
```

**Step 2: Create dashboard page**

Create `src/app/[locale]/dashboard/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import type { ReviewStatusResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

export default function DashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [reviews, setReviews] = useState<ReviewStatusResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listReviews(50, 0).then((data) => {
      setReviews(data.reviews);
      setTotal(data.total);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
        <Button onClick={() => router.push(`/${locale}/review/new`)}>
          {t("dashboard.newReview")}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("common.loading")}</p>
      ) : reviews.length === 0 ? (
        <p className="text-muted-foreground">{t("dashboard.noReviews")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("dashboard.columns.id")}</TableHead>
              <TableHead>{t("dashboard.columns.status")}</TableHead>
              <TableHead>{t("dashboard.columns.files")}</TableHead>
              <TableHead>{t("dashboard.columns.date")}</TableHead>
              <TableHead>{t("dashboard.columns.cost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((r) => (
              <TableRow
                key={r.review_id}
                className="cursor-pointer"
                onClick={() => router.push(`/${locale}/review/${r.review_id}`)}
              >
                <TableCell className="font-mono text-sm">
                  {r.review_id.slice(0, 8)}...
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[r.status] || "outline"}>
                    {t(`dashboard.status.${r.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  {r.result?.summary?.total_docs ?? "-"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(r.review_id).toLocaleDateString(locale, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </TableCell>
                <TableCell>
                  {r.usage ? `$${r.usage.estimated_cost_usd.toFixed(3)}` : "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

**Step 3: Update root page to redirect**

Replace `src/app/[locale]/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
```

**Step 4: Commit**

```bash
git add src/app/
git commit -m "feat: add dashboard page with review history"
```

---

## Task 8: New Review Page — File Upload

**Files:**
- Create: `src/app/[locale]/review/new/page.tsx`
- Create: `src/app/[locale]/review/layout.tsx`
- Create: `src/components/file-dropzone.tsx`

**Step 1: Create review layout (reuse auth guard + header)**

Create `src/app/[locale]/review/layout.tsx`:

```tsx
import { Header } from "@/components/header";
import { AuthGuard } from "@/components/auth-guard";

export default async function ReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <AuthGuard locale={locale}>
      <Header locale={locale} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </AuthGuard>
  );
}
```

**Step 2: Create file dropzone component**

Create `src/components/file-dropzone.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];

interface FileDropzoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export function FileDropzone({ files, onFilesChange }: FileDropzoneProps) {
  const t = useTranslations("upload");
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files).filter((f) =>
        ACCEPTED_TYPES.includes(f.type),
      );
      onFilesChange([...files, ...dropped]);
    },
    [files, onFilesChange],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selected = Array.from(e.target.files);
        onFilesChange([...files, ...selected]);
      }
    },
    [files, onFilesChange],
  );

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25"
        }`}
      >
        <p className="mb-2 text-lg font-medium">{t("dropzone")}</p>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("dropzoneHint")}
        </p>
        <label>
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleFileInput}
            className="hidden"
          />
          <Button variant="outline" asChild>
            <span>Browse files</span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm font-medium">
            {t("filesSelected", { count: files.length })}
          </p>
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded border px-3 py-2 text-sm"
            >
              <span className="truncate">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(i)}
                className="ml-2 h-6 px-2 text-muted-foreground"
              >
                x
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 3: Create new review page**

Create `src/app/[locale]/review/new/page.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api, ApiError } from "@/lib/api";
import type { TemplateResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDropzone } from "@/components/file-dropzone";

export default function NewReviewPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [files, setFiles] = useState<File[]>([]);
  const [templates, setTemplates] = useState<TemplateResponse[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listTemplates().then(setTemplates).catch(() => {});
  }, []);

  async function handleStartReview() {
    if (files.length === 0) return;
    setError("");
    setLoading(true);

    try {
      // 1. Get presigned URLs
      const presignRes = await api.presign(
        files.map((f) => f.name),
        selectedTemplate || undefined,
      );

      // 2. Upload files to R2 in parallel
      await Promise.all(
        presignRes.files.map(({ upload_url }, i) =>
          fetch(upload_url, { method: "PUT", body: files[i] }),
        ),
      );

      // 3. Start review
      await api.startReview(presignRes.review_id);

      // 4. Navigate to review detail
      router.push(`/${locale}/review/${presignRes.review_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upload failed");
      setLoading(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>{t("upload.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <FileDropzone files={files} onFilesChange={setFiles} />

        {templates.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("upload.template")}
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="w-full rounded border px-3 py-2 text-sm"
            >
              <option value="">{t("upload.templateNone")}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>
                  {tmpl.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <Button
          className="w-full"
          size="lg"
          disabled={files.length === 0 || loading}
          onClick={handleStartReview}
        >
          {loading ? t("upload.uploading") : t("upload.startReview")}
        </Button>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add file upload page with drag & drop and presigned URL flow"
```

---

## Task 9: Review Detail Page — Progress + Results

**Files:**
- Create: `src/app/[locale]/review/[id]/page.tsx`
- Create: `src/components/review-progress.tsx`
- Create: `src/components/review-result.tsx`

**Step 1: Create progress component**

Create `src/components/review-progress.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ReviewProgress } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewProgressViewProps {
  progress: ReviewProgress;
  fileCount?: number;
}

export function ReviewProgressView({
  progress,
  fileCount,
}: ReviewProgressViewProps) {
  const t = useTranslations("review");

  const phases = [
    { key: "phase1_preprocess", label: t("phase1") },
    { key: "phase2_extraction", label: t("phase2") },
    { key: "phase3_cross_validation", label: t("phase3") },
  ];

  function getPhaseStatus(phaseKey: string) {
    const currentIdx = phases.findIndex((p) => progress.phase.includes(p.key.split("_")[0]));
    const thisIdx = phases.findIndex((p) => p.key === phaseKey);

    if (thisIdx < currentIdx) return "done";
    if (thisIdx === currentIdx) return "active";
    return "pending";
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="space-y-4 pt-6">
        <p className="text-center text-lg font-medium">
          {t("processing", { count: fileCount || "?" })}
        </p>

        <div className="space-y-3">
          {phases.map((phase) => {
            const status = getPhaseStatus(phase.key);
            return (
              <div key={phase.key} className="flex items-center gap-3">
                <span className="w-6 text-center">
                  {status === "done" && "✅"}
                  {status === "active" && "🔄"}
                  {status === "pending" && "⏳"}
                </span>
                <span
                  className={
                    status === "active" ? "font-medium" : "text-muted-foreground"
                  }
                >
                  {phase.label}
                </span>
                {status === "active" &&
                  progress.total_groups > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {progress.completed_groups}/{progress.total_groups}
                    </span>
                  )}
              </div>
            );
          })}
        </div>

        {progress.detail && (
          <p className="text-center text-sm text-muted-foreground">
            {progress.detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create result component**

Create `src/components/review-result.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { ReviewResult, Usage } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const STATUS_ICON: Record<string, string> = {
  pass: "✅",
  warning: "⚠️",
  fail: "❌",
};

interface ReviewResultViewProps {
  result: ReviewResult;
  usage: Usage | null;
  reviewId: string;
  onNewReview: () => void;
}

export function ReviewResultView({
  result,
  usage,
  reviewId,
  onNewReview,
}: ReviewResultViewProps) {
  const t = useTranslations("review");

  function downloadJson() {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `review-${reviewId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const { summary } = result;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-center text-lg font-medium text-green-600">
        ✅ {t("completed")}
      </p>

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("summary")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-green-600">
                {summary.passed}
              </p>
              <p className="text-sm text-muted-foreground">{t("passed")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-600">
                {summary.warnings}
              </p>
              <p className="text-sm text-muted-foreground">{t("warnings")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">
                {summary.failures}
              </p>
              <p className="text-sm text-muted-foreground">{t("failures")}</p>
            </div>
          </div>

          {summary.opinion && (
            <p className="mb-4 text-sm">{summary.opinion}</p>
          )}

          {summary.critical_issues.map((issue, i) => (
            <p key={i} className="mb-1 text-sm text-red-600">
              ❌ {issue}
            </p>
          ))}
          {summary.action_required.map((action, i) => (
            <p key={i} className="mb-1 text-sm text-yellow-600">
              ⚠️ {action}
            </p>
          ))}
        </CardContent>
      </Card>

      {/* Document Details */}
      <Accordion type="single" collapsible>
        <AccordionItem value="documents">
          <AccordionTrigger>{t("documents")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {result.documents.map((doc, i) => (
                <Card key={i}>
                  <CardContent className="pt-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span>{STATUS_ICON[doc.status]}</span>
                      <span className="font-medium">{doc.doc_type}</span>
                      <span className="text-sm text-muted-foreground">
                        ({doc.filename})
                      </span>
                    </div>

                    {/* Extracted data */}
                    {Object.keys(doc.extracted_data).length > 0 && (
                      <div className="mb-3 rounded bg-muted p-3">
                        {Object.entries(doc.extracted_data).map(
                          ([key, val]) => (
                            <div key={key} className="flex gap-2 text-sm">
                              <span className="font-medium">{key}:</span>
                              <span>{String(val)}</span>
                            </div>
                          ),
                        )}
                      </div>
                    )}

                    {/* Checklist */}
                    {doc.checklist.map((item, j) => (
                      <div key={j} className="mb-1 text-sm">
                        <span>{STATUS_ICON[item.status]}</span>{" "}
                        <span className="font-medium">{item.item}</span>
                        {item.detail && (
                          <span className="text-muted-foreground">
                            {" "}
                            — {item.detail}
                          </span>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Cross-Validation */}
        <AccordionItem value="cross-validation">
          <AccordionTrigger>{t("crossValidation")}</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {result.cross_validation.map((item, i) => (
                <div key={i} className="text-sm">
                  <span>{STATUS_ICON[item.status]}</span>{" "}
                  <span className="font-medium">{item.description}</span>
                  {item.details && (
                    <p className="ml-6 text-muted-foreground">
                      {item.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Usage + Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          {usage && (
            <>
              <span>
                💰 ${usage.estimated_cost_usd.toFixed(3)}
              </span>
              <span>
                ⏱ {Math.round(usage.duration_seconds)}{t("seconds")}
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadJson}>
            {t("downloadJson")}
          </Button>
        </div>
      </div>

      <Button className="w-full" size="lg" onClick={onNewReview}>
        {t("newReview")}
      </Button>
    </div>
  );
}
```

**Step 3: Create review detail page with polling**

Create `src/app/[locale]/review/[id]/page.tsx`:

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { POLL_INTERVAL_MS } from "@/lib/config";
import type { ReviewStatusResponse } from "@/lib/types";
import { ReviewProgressView } from "@/components/review-progress";
import { ReviewResultView } from "@/components/review-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ReviewDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const { locale, id } = useParams<{ locale: string; id: string }>();

  const [review, setReview] = useState<ReviewStatusResponse | null>(null);
  const [error, setError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    function poll() {
      api
        .getReview(id)
        .then((data) => {
          setReview(data);
          if (data.status === "completed" || data.status === "failed") {
            if (intervalRef.current) clearInterval(intervalRef.current);
          }
        })
        .catch((err) => {
          setError(err.message || "Failed to fetch review");
          if (intervalRef.current) clearInterval(intervalRef.current);
        });
    }

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  if (error) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-red-600">❌ {error}</p>
          <Button onClick={() => router.push(`/${locale}/dashboard`)}>
            {t("common.back")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!review) {
    return (
      <div className="flex justify-center pt-20">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  if (review.status === "processing" || review.status === "pending") {
    return (
      <ReviewProgressView
        progress={
          review.progress || {
            phase: "phase1_preprocess",
            detail: "",
            completed_groups: 0,
            total_groups: 0,
          }
        }
        fileCount={review.result?.summary?.total_docs}
      />
    );
  }

  if (review.status === "failed") {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-lg font-medium text-red-600">
            ❌ {t("review.failed")}
          </p>
          <p className="text-sm text-muted-foreground">{review.error}</p>
          <Button onClick={() => router.push(`/${locale}/review/new`)}>
            {t("common.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (review.status === "completed" && review.result) {
    return (
      <ReviewResultView
        result={review.result}
        usage={review.usage}
        reviewId={review.review_id}
        onNewReview={() => router.push(`/${locale}/review/new`)}
      />
    );
  }

  return null;
}
```

**Step 4: Commit**

```bash
git add src/
git commit -m "feat: add review detail page with polling progress and result display"
```

---

## Task 10: Final Polish + Build Verification

**Step 1: Delete leftover default files**

Remove `src/app/[locale]/page.tsx` default Next.js content if not already replaced. Remove `public/file.svg`, `public/globe.svg`, `public/next.svg`, `public/vercel.svg`, `public/window.svg`.

**Step 2: Add .env.example**

Create `.env.example`:

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Step 3: Verify full build**

```bash
npm run build
```

Fix any TypeScript or build errors.

**Step 4: Test dev server**

```bash
npm run dev
```

Visit `http://localhost:3000` — should redirect to `/ko/dashboard` (or `/ko/auth/login` if not authenticated).

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete frontend MVP - auth, upload, review, i18n"
```

---

## Summary

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Install dependencies | `package.json` |
| 2 | Types + API client | `src/lib/types.ts`, `src/lib/api.ts` |
| 3 | Auth store | `src/stores/auth.ts` |
| 4 | i18n setup | `src/i18n/`, `messages/`, `middleware.ts` |
| 5 | Layout + header + auth guard | `src/components/header.tsx`, `auth-guard.tsx` |
| 6 | Auth pages (login/register/callback) | `src/app/[locale]/auth/` |
| 7 | Dashboard (review list) | `src/app/[locale]/dashboard/` |
| 8 | New review (file upload) | `src/app/[locale]/review/new/` |
| 9 | Review detail (progress + results) | `src/app/[locale]/review/[id]/` |
| 10 | Polish + build verification | cleanup, `.env.example` |
