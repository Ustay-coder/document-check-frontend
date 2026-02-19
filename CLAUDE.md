# Document Check Frontend

## Specs

개발 시 `specs/` 디렉토리의 문서들을 반드시 참조할 것:

- `specs/PRD.md` — 제품 요구사항 정의서
- `specs/PIPELINE-SPEC.md` — 문서 검토 파이프라인 스펙
- `specs/API-SPEC.md` — API 스펙
- `specs/DB-SPEC.md` — DB 스펙
- `specs/UI-SPEC.md` — UI 스펙

## Tech Stack
- Next.js 16 (App Router) + React 19
- Tailwind CSS 4 + shadcn/ui
- Zustand (auth state)
- next-intl (i18n: ko/en)

## Development
```bash
npm install
npm run dev    # http://localhost:3000
npm run build  # production build
```

## Project Structure
```
src/
├── app/[locale]/          # Pages (locale-prefixed routing)
│   ├── auth/              # Login, register, OAuth callback
│   ├── dashboard/         # Review history list
│   └── review/            # New review + review detail
├── components/            # Shared components
│   ├── ui/                # shadcn/ui primitives
│   ├── header.tsx         # App header
│   ├── auth-guard.tsx     # Auth protection wrapper
│   ├── file-dropzone.tsx  # Drag & drop file upload
│   ├── review-progress.tsx # Review progress display
│   └── review-result.tsx  # Review result display
├── lib/                   # Utilities
│   ├── api.ts             # API client
│   ├── types.ts           # TypeScript types
│   └── config.ts          # Configuration
├── stores/                # Zustand stores
│   └── auth.ts            # Auth state
├── i18n/                  # next-intl config
└── middleware.ts           # Locale routing middleware
messages/                   # Translation files (ko.json, en.json)
```

## Environment Variables
- `NEXT_PUBLIC_API_URL` — Backend API URL (default: `http://localhost:8000`)
