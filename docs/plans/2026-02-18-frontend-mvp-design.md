# Frontend MVP Design

> Date: 2026-02-18
> Status: Approved

## Tech Stack

- Next.js 16 (App Router) + React 19
- Tailwind CSS 4 + shadcn/ui (Radix UI)
- next-intl for i18n (Korean default, English toggle)
- Zustand for client-side auth state

## Pages

| Route | Purpose | Auth |
|---|---|---|
| `/` | Redirect to `/dashboard` or `/auth/login` | No |
| `/auth/login` | Email/password + Google OAuth | No |
| `/auth/register` | Registration form | No |
| `/auth/callback` | Receives JWT from Google OAuth redirect | No |
| `/dashboard` | Review history list + "New Review" | Yes |
| `/review/new` | File upload + template selection | Yes |
| `/review/[id]` | Processing progress / results display | Yes |

## Auth Flow

1. User logs in via email/password or Google OAuth
2. JWT stored in localStorage
3. API calls include `Authorization: Bearer <token>` header
4. Auth state managed via Zustand store
5. Protected routes redirect to `/auth/login` if no token

## Upload Flow (Presigned URL)

1. User selects files + optional template
2. `POST /api/upload/presign` → get presigned URLs + review_id
3. Upload files directly to R2 via presigned PUT URLs (parallel)
4. `POST /api/reviews/{review_id}/start` → begin processing
5. Redirect to `/review/[id]` → poll for progress

## Components

### Auth Pages
- Card-centered layout
- Email/password form
- "Sign in with Google" button
- Login/register toggle link

### Dashboard
- Header: user info, logout, language toggle (KR/EN)
- "New Review" primary action button
- Review list table: ID, status badge, file count, date, cost
- Row click → `/review/[id]`

### New Review (`/review/new`)
- Drag & drop file zone (PDF, JPG, PNG)
- File list with remove buttons
- Optional template selector dropdown
- "Start Review" button

### Review Detail (`/review/[id]`)
- **Processing**: Phase progress (1/2/3) with group counts
- **Completed**: Summary card (pass/warning/fail) + document accordion + cross-validation + usage stats + JSON download
- **Failed**: Error message + retry button

## i18n

- Default locale: Korean (ko)
- Supported: Korean (ko), English (en)
- Language toggle in header
- Translation files in `messages/ko.json` and `messages/en.json`

## API Client

Single API client module (`lib/api.ts`) wrapping fetch with:
- Base URL configuration
- JWT token injection
- Error handling (401 → redirect to login)
- TypeScript types matching API spec
