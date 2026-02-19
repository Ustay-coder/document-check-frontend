# Rule Template Management

> Date: 2026-02-19
> Status: Planned
> Priority: High

## Overview

사용자가 AI 서류 검토에 사용할 커스텀 규칙 템플릿을 생성, 조회, 수정, 삭제할 수 있는 관리 화면.
백엔드 API(`GET/POST/PUT/DELETE /api/rule-templates`)는 이미 구현되어 있으며, 프론트엔드 UI만 추가하면 됨.

규칙은 자연어 텍스트 형식으로 입력하며, 내부적으로 `{ "instructions": "..." }` JSON 구조로 저장.
새 검토 시작 시 기존 템플릿 선택 드롭다운에서 선택하여 적용.

## Backend Endpoints (Existing)

| Method | Endpoint | Description | Request Body | Response |
|--------|----------|-------------|--------------|----------|
| GET | `/api/rule-templates` | 사용자의 템플릿 목록 조회 | - | `TemplateResponse[]` |
| POST | `/api/rule-templates` | 새 템플릿 생성 | `TemplateCreateRequest` | `TemplateResponse` (201) |
| GET | `/api/rule-templates/{template_id}` | 단일 템플릿 조회 | - | `TemplateResponse` |
| PUT | `/api/rule-templates/{template_id}` | 템플릿 수정 | `TemplateUpdateRequest` | `TemplateResponse` |
| DELETE | `/api/rule-templates/{template_id}` | 템플릿 삭제 | - | `{}` |

### Schemas

```
TemplateCreateRequest:
  name: string (required)
  description: string | null
  rules: Record<string, unknown> (required)

TemplateUpdateRequest:
  name: string | null
  description: string | null
  rules: Record<string, unknown> | null

TemplateResponse:
  id: string
  name: string
  description: string | null
  rules: Record<string, unknown>
  created_at: string
  updated_at: string
```

### Rules 저장 형식

프론트엔드에서 자연어 텍스트로 입력받아 다음 형태로 저장:

```json
{
  "instructions": "1. 사업자등록증의 상호명과 계약서의 상호명이 일치하는지 확인\n2. 계약 금액이 1억 이상인 경우 인감증명서 첨부 여부 확인\n3. ..."
}
```

## Pages & Components

### 1. Rule Templates List Page

- **Route**: `/settings/rule-templates`
- 템플릿 목록 카드 리스트:
  - Name (템플릿 이름)
  - Description (설명, 있을 경우)
  - Updated date
  - 각 카드에 Edit / Delete 버튼
- 상단 "새 템플릿 만들기" 버튼
- 템플릿이 없을 경우 빈 상태 안내 메시지

### 2. Create Template Dialog

- Dialog 형태
- 입력 필드:
  - 템플릿 이름 (필수, e.g. "부동산 계약서 검토", "입찰 서류 검토")
  - 설명 (선택)
  - 검토 규칙 (필수, Textarea) — 자연어로 AI에게 전달할 검토 규칙 작성
    - Placeholder에 예시 규칙 표시
- 생성 후 목록에 즉시 반영

### 3. Edit Template Dialog

- Create Dialog와 동일한 구조
- 기존 값 pre-fill
- 수정 후 목록에 즉시 반영

### 4. Delete Confirmation Dialog

- 삭제 대상 템플릿 이름 표시
- "이 작업은 되돌릴 수 없습니다" 경고
- 확인/취소 버튼

## i18n Keys (to add)

```json
{
  "settings": {
    "ruleTemplates": {
      "title": "규칙 템플릿",
      "description": "AI 서류 검토에 사용할 커스텀 규칙을 관리합니다",
      "create": "새 템플릿 만들기",
      "edit": "수정",
      "name": "템플릿 이름",
      "namePlaceholder": "예: 부동산 계약서 검토",
      "templateDescription": "설명",
      "descriptionPlaceholder": "이 템플릿의 용도를 간단히 설명해 주세요",
      "rules": "검토 규칙",
      "rulesPlaceholder": "예:\n1. 사업자등록증의 상호명과 계약서의 상호명이 일치하는지 확인\n2. 계약 금액이 1억 이상인 경우 인감증명서 첨부 여부 확인\n3. 모든 서류의 날짜가 유효기간 내인지 확인",
      "deleteConfirm": "정말 이 템플릿을 삭제하시겠습니까?",
      "deleteWarning": "이 작업은 되돌릴 수 없습니다.",
      "noTemplates": "아직 규칙 템플릿이 없습니다",
      "noTemplatesHint": "새 템플릿을 만들어 AI 검토 규칙을 커스터마이즈하세요",
      "updatedAt": "마지막 수정"
    }
  }
}
```

## Files to Create/Modify

| Action | Path | Description |
|--------|------|-------------|
| Create | `src/app/[locale]/settings/rule-templates/page.tsx` | 템플릿 목록 페이지 |
| Create | `src/app/[locale]/settings/layout.tsx` | Settings layout (auth guard + header) |
| Create | `src/components/create-template-dialog.tsx` | 생성 다이얼로그 |
| Create | `src/components/edit-template-dialog.tsx` | 수정 다이얼로그 |
| Create | `src/components/delete-template-dialog.tsx` | 삭제 확인 다이얼로그 |
| Modify | `src/lib/api.ts` | CRUD 메서드 추가 |
| Modify | `src/lib/types.ts` | Request 타입 추가 |
| Modify | `src/components/header.tsx` | Settings(템플릿 관리) 링크 추가 |
| Modify | `messages/ko.json` | settings.ruleTemplates 번역 추가 |
| Modify | `messages/en.json` | settings.ruleTemplates 번역 추가 |

## API Client Methods (to add)

```typescript
// In src/lib/api.ts
getTemplate(templateId: string): Promise<TemplateResponse>
createTemplate(data: TemplateCreateRequest): Promise<TemplateResponse>
updateTemplate(templateId: string, data: TemplateUpdateRequest): Promise<TemplateResponse>
deleteTemplate(templateId: string): Promise<void>
```

## TypeScript Types (to add)

```typescript
// In src/lib/types.ts
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
```

## Design Notes

- Settings 페이지는 API Key 관리 등 향후 설정 추가를 고려하여 `/settings` 하위 라우팅으로 구성
- 규칙 입력은 자연어 텍스트 (Textarea)로 하되, `{ "instructions": "..." }` 형태로 JSON 변환하여 저장
- 기존 `review/new` 페이지의 템플릿 선택 드롭다운은 이미 `api.listTemplates()`와 연동되어 있으므로 별도 수정 불필요
- 참고 UI: Notion의 템플릿 관리, Linear의 이슈 템플릿 설정
