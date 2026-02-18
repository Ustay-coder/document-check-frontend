# Document Check Frontend

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
