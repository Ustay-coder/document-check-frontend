# API Key Management

> Date: 2026-02-18
> Status: Planned
> Priority: Medium

## Overview

사용자가 프론트엔드에서 API Key를 생성, 조회, 삭제할 수 있는 관리 화면.
백엔드 API(`POST/GET/DELETE /api/auth/api-keys`)는 이미 구현되어 있으며, 프론트엔드 UI만 추가하면 됨.

## Backend Endpoints (Existing)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/api-keys` | Create a new API key |
| GET | `/api/auth/api-keys` | List user's API keys |
| DELETE | `/api/auth/api-keys/{key_id}` | Revoke an API key |

## Pages & Components

### 1. API Keys List Page

- **Route**: `/settings/api-keys`
- Key 목록 테이블:
  - Name (사용자 지정 이름)
  - Key prefix (`dk_a1b2...`)
  - Created date
  - Last used date
  - Expires at (optional)
  - Status (active/expired)
- 각 행에 Revoke(삭제) 버튼
- 상단 "Create API Key" 버튼

### 2. Create API Key Dialog

- Modal/Dialog 형태
- 입력 필드:
  - Key 이름 (필수, e.g. "Production", "CI/CD")
  - 만료일 설정 (선택: 30일, 90일, 1년, 무제한)
- 생성 후:
  - 전체 Key 값 1회만 표시 (다시 조회 불가)
  - 복사 버튼 제공
  - "이 키는 다시 볼 수 없습니다" 경고 표시

### 3. Revoke Confirmation Dialog

- 삭제 대상 Key 이름 + prefix 표시
- "이 작업은 되돌릴 수 없습니다" 경고
- 확인/취소 버튼

## i18n Keys (to add)

```json
{
  "settings": {
    "apiKeys": {
      "title": "API Keys",
      "description": "API 키를 생성하여 프로그래매틱 접근에 사용할 수 있습니다",
      "create": "API Key 생성",
      "name": "Key 이름",
      "namePlaceholder": "예: Production",
      "expiration": "만료",
      "expirationOptions": {
        "30d": "30일",
        "90d": "90일",
        "1y": "1년",
        "never": "무제한"
      },
      "createdSuccess": "API Key가 생성되었습니다",
      "copyWarning": "이 키는 다시 볼 수 없습니다. 지금 복사해 주세요.",
      "copy": "복사",
      "copied": "복사됨",
      "revoke": "삭제",
      "revokeConfirm": "정말 이 API Key를 삭제하시겠습니까?",
      "revokeWarning": "이 작업은 되돌릴 수 없으며, 이 키를 사용하는 모든 연동이 중단됩니다.",
      "noKeys": "아직 API Key가 없습니다",
      "columns": {
        "name": "이름",
        "key": "Key",
        "created": "생성일",
        "lastUsed": "마지막 사용",
        "expires": "만료일",
        "actions": ""
      }
    }
  }
}
```

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| Create | `src/app/[locale]/settings/api-keys/page.tsx` | API Keys list page |
| Create | `src/app/[locale]/settings/layout.tsx` | Settings layout (auth guard + header) |
| Create | `src/components/create-api-key-dialog.tsx` | Create key dialog |
| Create | `src/components/revoke-api-key-dialog.tsx` | Revoke confirmation dialog |
| Modify | `src/lib/api.ts` | Add API key CRUD methods |
| Modify | `src/lib/types.ts` | Add ApiKey types |
| Modify | `src/components/header.tsx` | Add Settings link |
| Modify | `messages/ko.json` | Add settings.apiKeys translations |
| Modify | `messages/en.json` | Add settings.apiKeys translations |

## API Client Methods (to add)

```typescript
// In src/lib/api.ts
createApiKey(name: string, expiresInDays?: number): Promise<{ id: string; key: string; prefix: string }>
listApiKeys(): Promise<ApiKeyInfo[]>
revokeApiKey(keyId: string): Promise<void>
```

## TypeScript Types (to add)

```typescript
// In src/lib/types.ts
export interface ApiKeyInfo {
  id: string;
  key_prefix: string;
  name?: string;
  is_active: boolean;
  last_used: string | null;
  created_at: string;
  expires_at: string | null;
}
```

## Design Notes

- Settings 페이지는 향후 다른 설정(프로필, 알림 등) 추가를 고려하여 `/settings` 하위 라우팅으로 구성
- Key 생성 직후의 전체 값 표시는 보안상 1회만 허용 (백엔드에서 해시만 저장)
- 참고 서비스: OpenAI Platform, Stripe Dashboard, Vercel Settings, GitHub Personal Access Tokens
