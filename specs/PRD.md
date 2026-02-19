# PRD: 한국 비즈니스 서류 검토 API

## 0. Why — 왜 만드는가

### 0.1 문제 정의

정부 지원사업(청년CEO육성, 창업지원, R&D 등)에 참여하는 스타트업/중소기업은 정산 시 **평균 8~15종의 증빙 서류**를 제출해야 한다. 현재 이 서류 검토는 100% 수작업으로 이루어진다:

- **담당자가 직접** 세금계산서 금액이 계약서와 맞는지, 사업자번호가 일치하는지, 날짜 순서가 맞는지 하나하나 눈으로 대조
- **서류 세트당 30분~2시간** 소요 (서류 수, 복잡도에 따라)
- 사람이 하므로 **실수가 불가피** — 금액 불일치, 서류 누락, 날짜 오류를 놓침
- 반려 → 보완 → 재제출 사이클로 **정산 기간 장기화** (평균 2~4주)
- 지원사업 수행기관(운영사)도 동일한 수작업 검토를 반복

### 0.2 기회

| 현재 (수작업) | 목표 (자동화) |
|---|---|
| 서류 세트 검토 30분~2시간 | **2분 이내** |
| 사람마다 검토 품질 편차 | **일관된 체크리스트 기반 검증** |
| 금액 불일치/누락 탐지 누락 | **교차검증으로 98% 이상 탐지** |
| 검토 인력 인건비 | **건당 $1 이하** |
| 반려-재제출 반복 | **제출 전 사전 검토로 1회 통과율 향상** |

### 0.3 가설

> **H1**: 정부 지원사업 참여 기업에게 "서류 업로드 → 즉시 검토 결과"를 제공하면,
> 정산 서류 반려율을 **50% 이상 감소**시킬 수 있다.

> **H2**: LLM 기반 교차검증은 사람 대비 **금액 불일치/사업자번호 오류/서류 누락을 더 정확하게** 탐지한다.
> (사람은 피로/부주의로 놓치는 것을 기계는 놓치지 않음)

> **H3**: 정산 담당자의 검토 시간을 **90% 이상 단축**하면,
> 유료 전환 의사가 있는 PMF 시그널을 확인할 수 있다.

> **H4**: 수행기관(운영사) 측에서도 수령 서류 사전 검증 용도로 수요가 존재한다.
> → B2B 양면 시장 가능성

> **H5**: 사용자가 검토 규칙을 커스터마이즈할 수 있으면,
> 정부 지원사업 외 도메인(부동산, 무역, 일반 기업 정산 등)으로의 **확장이 가능**하다.
> 도메인별 맞춤 규칙으로 오탐률이 감소하고, B2B 수행기관의 온보딩 장벽이 낮아진다.
>
> **검증 방법**: 기본 규칙 vs 커스텀 규칙 적용 시 오탐률(false positive) 비교.
> 3개 이상의 비정부 지원사업 도메인에서 커스텀 규칙 적용 후 사용자 만족도 측정.

### 0.4 목표

**1차 목표 (MVP, 1개월)**
- 정부 지원사업 정산 서류 세트(8~15종)를 업로드하면 2분 내 검토 결과 반환
- 금액 흐름, 당사자 정보, 날짜 정합성, 누락 서류를 자동 교차검증
- 5개 이상 실제 기업의 서류로 검증 → 탐지 정확도 95% 이상 확인

**2차 목표 (3개월)**
- SaaS 웹앱 출시 (서류 업로드 UI + 결과 대시보드)
- 월 100건 이상 검토 처리
- 유료 전환 10개사 이상 → PMF 검증

**3차 목표 (6개월)**
- 수행기관(운영사) 대상 B2B 확장
- 지원사업 유형별 서류 세트 템플릿 제공
- 서류 보관/이력 관리 기능
- Custom Rules 고도화: 시스템 기본 템플릿 시드, 규칙 효과 측정, 규칙 공유 기능

### 0.5 핵심 지표 (North Star Metric)

| 지표 | 정의 | 목표 |
|---|---|---|
| **정산 1회 통과율** | 본 서비스로 사전 검토 후 제출한 서류의 1회 통과 비율 | 80% 이상 |
| 검토 완료 시간 | 서류 업로드~결과 반환 | 2분 이내 |
| 이슈 탐지 정확도 | 실제 문제 중 탐지한 비율 (recall) | 95% 이상 |
| 오탐률 | 문제 없는데 문제로 표시한 비율 (false positive) | 10% 이하 |
| 건당 비용 | API 호출 비용 (LLM 토큰) | $0.05 이하 (Gemini Flash 기준) |

---

## 1. 개요

### 1.1 제품명
**KR Document Review API** (가칭)

### 1.2 목적
한국 비즈니스 서류(세금계산서, 계약서, 견적서 등)를 업로드하면, LLM이 자율적으로 판단·분석·교차검증하여 검토 결과를 반환하는 API 서비스. **정부 지원사업 정산 서류 검토 자동화**가 1차 타겟.

### 1.3 핵심 원칙
- **LLM이 오케스트레이터**: 문서 유형 판별, 그룹 분배, 검토 전략 수립을 LLM이 자율적으로 수행
- **FastAPI는 런타임**: LLM이 요청하는 도구(파일 읽기, 명령 실행, 서브에이전트 스폰)를 실행하는 역할에 한정
- **하드코딩 최소화**: 비즈니스 로직은 프롬프트(스킬 파일)에 담고, 코드는 도구 실행과 에이전트 루프만 담당

### 1.4 배경
기존 OpenClaw 환경에서 `kr-document-reviewer` 스킬로 동작하던 서류 검토 워크플로우를, 독립적인 SaaS API 서비스로 분리하여 다른 스타트업/중소기업도 사용할 수 있게 한다.

---

## 2. 사용자 및 시나리오

### 2.1 대상 사용자

**1차 타겟: 지원사업 참여 기업**
- 정부/공공 지원사업(청년CEO육성, 창업지원, R&D 등)에 참여하는 스타트업/중소기업
- 정산 서류 작성 및 제출을 담당하는 실무자

**2차 타겟: 수행기관(운영사)**
- 지원사업을 운영하며 제출된 서류를 검토하는 기관
- 대량의 서류 세트를 반복 검토해야 하는 담당자

**3차 타겟: 시스템 연동**
- 사내 ERP/정산 시스템에서 API로 호출
- 프론트엔드 웹앱 (서류 업로드 UI)

### 2.2 핵심 시나리오

**시나리오 1: 일괄 서류 검토**
1. 사용자가 서류 파일 N개를 업로드 (PDF, JPG, PNG)
2. API가 검토 작업을 시작하고 작업 ID 반환
3. LLM이 자율적으로: 파일 전처리 → 유형 판별 → 그룹 분배 → 서브에이전트 병렬 검토 → 교차검증
4. 완료 시 구조화된 JSON 결과 반환

**시나리오 2: 단건 서류 확인**
1. 사용자가 서류 1~2건 업로드
2. LLM이 직접 검토 (서브에이전트 없이)
3. 즉시 결과 반환

**시나리오 3: 진행 상황 조회**
1. 다건 검토는 시간이 걸리므로 (1~3분)
2. 사용자가 작업 ID로 진행 상황 폴링 또는 WebSocket으로 실시간 수신

---

## 3. 시스템 아키텍처

### 3.1 전체 구조

```
Client (Web/API)
    ↓ POST /api/reviews (files)
FastAPI Server
    ├─ Upload Handler      — 파일 저장, 작업 생성
    ├─ Agent Loop Engine   — LLM ↔ Tool 반복 루프 (핵심)
    ├─ Tool Executor       — LLM이 호출하는 도구 실행
    │   ├─ read_file       — 파일 읽기 (이미지 → vision)
    │   ├─ exec_command    — 쉘 명령 (pdftoppm 등)
    │   ├─ spawn_subagent  — 서브에이전트 생성 (병렬 가능)
    │   └─ list_files      — 업로드된 파일 목록 조회
    ├─ Prompt Manager      — SKILL.md + references/*.md 관리
    └─ Result Store        — 검토 결과 저장/조회
```

### 3.2 Agent Loop Engine (핵심 컴포넌트)

Anthropic tool-use API를 활용한 에이전트 반복 루프:

```
입력: system_prompt, messages, tools, model
  ↓
Claude API 호출
  ↓
stop_reason == "end_turn"? → 최종 응답 반환
  ↓ (tool_use)
tool_call 추출 → Tool Executor로 실행 → tool_result 생성
  ↓
messages에 추가 → 다시 Claude API 호출 (반복)
```

**요구사항:**
- 비동기 실행 (async/await)
- 루프 최대 횟수 제한 (무한 루프 방지, 기본 30회)
- 루프당 토큰 사용량 추적
- 에러 발생 시 graceful 처리 (tool 실행 실패 → LLM에 에러 메시지 전달)

### 3.3 Tool 정의

#### `read_file`
- **용도**: 파일 내용 읽기. 이미지 파일이면 base64로 변환하여 vision content block으로 반환
- **입력**: `{ path: string }`
- **출력**: 텍스트 또는 이미지 content block
- **지원 형식**: PNG, JPG, PDF(텍스트), TXT, JSON, MD

#### `exec_command`
- **용도**: 쉘 명령 실행 (PDF→이미지 변환 등)
- **입력**: `{ command: string, timeout?: number }`
- **출력**: stdout + stderr
- **보안**: 허용 명령어 화이트리스트 (`pdftoppm`, `ls`, `mkdir` 등)
- **타임아웃**: 기본 30초

#### `spawn_subagent`
- **용도**: 독립적인 에이전트 루프를 새로 생성하여 병렬 작업 실행
- **입력**: `{ task: string, model?: string, tools?: string[] }`
- **출력**: 서브에이전트의 최종 응답 텍스트
- **기본 모델**: claude-sonnet-4-5 (비용 최적화)
- **서브에이전트 사용 가능 도구**: `read_file` 만 (exec, spawn 불가 — 재귀 방지)

#### `spawn_parallel`
- **용도**: 여러 서브에이전트를 동시에 실행
- **입력**: `{ tasks: [{ task: string, model?: string }] }`
- **출력**: 각 서브에이전트 응답 배열
- **최대 동시 실행**: 5개

#### `list_files`
- **용도**: 현재 작업의 업로드된 파일 및 생성된 파일 목록 조회
- **입력**: `{ directory?: string }`
- **출력**: 파일 경로 배열

### 3.4 Prompt Manager

스킬 파일을 시스템 프롬프트로 관리:

```
prompts/
├── system.md              — 에이전트 역할 정의 + 도구 사용 가이드
├── skill.md               — SKILL.md (워크플로우 지시)
└── references/
    ├── tax-invoice.md      — 세금계산서 체크리스트
    ├── contract.md         — 계약서 체크리스트
    ├── estimate.md         — 견적서 체크리스트
    ├── transaction-statement.md
    ├── business-registration.md
    ├── transfer-confirmation.md
    ├── result-report.md
    ├── inspection-report.md
    ├── bank-account.md
    ├── expense-request.md
    └── subsidy-application.md
```

**시스템 프롬프트 구성:**
```
[system.md]       — "너는 서류 검토 에이전트다. 도구를 사용하여..."
[skill.md]        — 워크플로우 지시 (Phase 1/2/3)
```

**서브에이전트 프롬프트:**
```
메인 에이전트가 spawn_subagent 호출 시 task에
체크리스트(references/*.md 내용)를 직접 포함하여 전달
```

---

## 4. API 설계

### 4.1 엔드포인트

#### `POST /api/reviews`
서류 검토 작업 생성

**Request:**
```
Content-Type: multipart/form-data

files: File[]          — 서류 파일 (PDF, JPG, PNG)
callback_url?: string  — 완료 시 webhook URL (선택)
```

**Response (202 Accepted):**
```json
{
  "review_id": "REV-20260213-001",
  "status": "processing",
  "file_count": 9,
  "created_at": "2026-02-13T17:00:00+09:00",
  "estimated_seconds": 120
}
```

#### `GET /api/reviews/{review_id}`
검토 결과 조회

**Response (200 — 진행 중):**
```json
{
  "review_id": "REV-20260213-001",
  "status": "processing",
  "progress": {
    "phase": "phase2_ocr",
    "completed_groups": 2,
    "total_groups": 3
  }
}
```

**Response (200 — 완료):**
```json
{
  "review_id": "REV-20260213-001",
  "status": "completed",
  "result": {
    "meta": { ... },
    "documents": [ ... ],
    "crossValidation": [ ... ],
    "summary": {
      "totalDocs": 9,
      "pass": 6,
      "warning": 2,
      "fail": 1,
      "criticalIssues": [...],
      "actionRequired": [...],
      "opinion": "..."
    }
  },
  "usage": {
    "total_tokens": 85000,
    "estimated_cost_usd": 0.72,
    "duration_seconds": 95
  }
}
```

#### `GET /api/reviews/{review_id}/stream`
WebSocket — 실시간 진행 상황 스트리밍 (선택 구현)

**메시지 형식:**
```json
{"event": "phase_start", "phase": "phase1_preprocess"}
{"event": "phase_start", "phase": "phase2_ocr", "groups": 3}
{"event": "group_complete", "group": 1, "status": "pass"}
{"event": "group_complete", "group": 2, "status": "warning"}
{"event": "group_complete", "group": 3, "status": "pass"}
{"event": "phase_start", "phase": "phase3_cross_validation"}
{"event": "complete", "review_id": "REV-20260213-001"}
```

#### `GET /api/reviews`
검토 이력 목록 조회

**Query params:** `limit`, `offset`, `status`

#### `DELETE /api/reviews/{review_id}`
검토 결과 및 관련 파일 삭제

---

## 5. 데이터 모델

### 5.1 Review

| 필드 | 타입 | 설명 |
|---|---|---|
| review_id | string | 고유 ID (REV-YYYYMMDD-NNN) |
| status | enum | pending / processing / completed / failed |
| files | File[] | 업로드된 파일 목록 |
| result | ReviewResult? | 검토 결과 JSON |
| usage | Usage | 토큰/비용/시간 |
| created_at | datetime | 생성 시각 |
| completed_at | datetime? | 완료 시각 |
| error | string? | 실패 시 에러 메시지 |

### 5.2 ReviewResult

기존 스킬의 JSON 스키마(`schema/review-result.schema.json`)를 그대로 사용:
- `meta`: 검토 메타 정보
- `documents[]`: 문서별 추출 데이터 + 체크리스트
- `crossValidation[]`: 교차 검증 결과
- `summary`: 종합 요약

---

## 5.5 Custom Rules (사용자 정의 검증 규칙)

### 5.5.1 개요

시스템에 내장된 기본 검증 규칙(11종 문서 체크리스트 + 교차검증 규칙) 외에, 사용자가 **자체 규칙을 정의하여 검토 파이프라인에 주입**할 수 있는 기능이다. 이를 통해 정부 지원사업 정산 외 다양한 도메인으로 확장 가능하다.

### 5.5.2 핵심 개념

#### 규칙 계층 구조

| 계층 | 설명 | 관리 주체 |
|------|------|-----------|
| **기본 규칙** | 11종 문서 유형별 체크리스트 (`prompts/references/*.md`) + 교차검증 규칙 (`CROSS_VALIDATION_RULES`) | 시스템 (코드 내장) |
| **사용자 정의 규칙** | Phase 2 체크리스트 오버라이드 + Phase 3 추가 교차검증 규칙 | 사용자 (API/UI) |
| **규칙 템플릿** | 자주 사용하는 사용자 정의 규칙 세트를 저장/재사용 | 사용자 (API/UI) |

#### 규칙 적용 모드

| 모드 | Phase 2 (개별 검토) | Phase 3 (교차검증) |
|------|---------------------|-------------------|
| `supplement` (기본) | 사용자 규칙을 기본 체크리스트에 **추가**. 동일 doc_type이면 사용자 규칙이 기본을 대체하고, 나머지 기본 규칙은 유지 | 사용자 규칙을 기본 교차검증 규칙에 **추가** |
| `replace` | 기본 체크리스트를 **완전히 대체**하고 사용자 규칙만 사용 | 기본 교차검증 규칙을 **완전히 대체**하고 사용자 규칙만 사용 |

#### 문서 유형 확장

Custom Rules의 `phase2_checklists`에서 `doc_type`에 기본 11종에 없는 새로운 유형명을 지정하면, 해당 문서 유형이 검토 대상에 추가된다.

- **`supplement` 모드**: 기본 11종 + 사용자 정의 신규 유형이 함께 사용됨
- **`replace` 모드**: 사용자 정의 유형만 사용 (기본 11종 무시)

이를 통해 정부 지원사업 정산 외 도메인(부동산, 무역, 일반 기업 정산 등)으로의 확장이 가능하다.

> **제약**: 문서 유형 식별은 LLM이 이미지를 보고 자율적으로 판단한다. 사용자가 "이 유형의 문서만 받아라"고 필터링하는 기능은 없으며, 체크리스트는 LLM에게 "이런 유형이 있으니 이 기준으로 검토하라"는 힌트 역할을 한다.

### 5.5.3 CustomRules 데이터 모델

```json
{
  "mode": "supplement",
  "phase2_checklists": [
    {
      "doc_type": "문서유형명",
      "checklist_md": "마크다운 형식의 체크리스트"
    }
  ],
  "cross_validation_rules": "마크다운 형식의 교차검증 규칙"
}
```

- `mode`: `"supplement"` (기본) 또는 `"replace"`
- `phase2_checklists`: Phase 2에서 사용할 문서 유형별 체크리스트 (선택)
- `cross_validation_rules`: Phase 3에서 사용할 추가/대체 교차검증 규칙 (선택)

### 5.5.4 규칙 템플릿 (Rule Templates)

자주 사용하는 규칙 세트를 저장하여 반복 사용할 수 있는 CRUD 시스템이다.

- **생성**: 이름, 설명, CustomRules JSON을 묶어 저장
- **적용**: 리뷰 생성 시 `template_id`를 전달하면 해당 템플릿의 규칙이 자동 적용
- **사용자 격리**: 각 사용자는 자신이 만든 템플릿만 조회/수정/삭제 가능
- **우선순위**: `template_id`와 `custom_rules`가 동시에 전달되면 `template_id`가 우선

### 5.5.5 파이프라인 주입 지점

```
[API 요청: template_id 또는 custom_rules JSON]
    ↓
[routes.py: CustomRules 파싱/검증]
    ↓
[pipeline.py: run_review_pipeline(custom_rules=...)]
    ↓
  ┌─ Phase 2: custom_rules.phase2_checklists
  │   → build_reference_bundle_with_overrides(checklists, mode)
  │   → LLM 프롬프트의 "문서 유형별 체크리스트" 섹션에 삽입
  │
  └─ Phase 3: custom_rules.cross_validation_rules
      → _build_phase3_task(phase2_raw, extra_rules, mode)
      → LLM 프롬프트의 교차검증 규칙 섹션에 삽입 또는 대체
```

### 5.5.6 사용 시나리오

**시나리오 A: 기본 규칙 보충 (supplement)**
> 정부 지원사업 정산 서류를 검토하되, 특정 사업(예: R&D 과제)에 고유한 추가 체크항목을 반영하고 싶은 경우.
> 기본 11종 체크리스트는 그대로 사용하면서, "결과보고서"에 연구 성과 관련 체크항목만 추가.

**시나리오 B: 완전 대체 (replace)**
> 정부 지원사업이 아닌 부동산 계약서 검토 등 완전히 다른 도메인에 적용하는 경우.
> 기본 규칙을 모두 무시하고, 부동산 관련 체크리스트만 사용.

**시나리오 C: 템플릿 재사용**
> 수행기관이 매번 동일한 사업 유형의 서류를 검토하는 경우.
> 최초 1회 규칙 템플릿을 생성한 후, 이후 검토 시 `template_id`만 전달하여 반복 사용.

### 5.5.7 성공 지표

| 지표 | 정의 | 목표 |
|------|------|------|
| 커스텀 규칙 사용률 | 전체 리뷰 중 커스텀 규칙이 적용된 비율 | 30% 이상 (B2B 고객) |
| 오탐률 감소 | 커스텀 규칙 적용 전후 false positive 변화 | 20% 이상 감소 |
| 비정부 도메인 적용 수 | 정부 지원사업 외 도메인에서 사용된 횟수 | 3개 도메인 이상 |
| 템플릿 재사용 횟수 | 저장된 템플릿이 리뷰에 적용된 평균 횟수 | 템플릿당 5회 이상 |

### 5.5.8 규칙 작성 가이드라인

Custom Rules 작성 방법에 대한 상세 가이드는 **`docs/CUSTOM-RULES-GUIDE.md`** 를 참조한다.

---

## 6. 비기능 요구사항

### 6.1 성능
- 서류 9건 기준 처리 시간: **2분 이내** (최적화 후 목표: **30초~1분**)
- Single-Shot 병렬 호출 + 그룹 크기 확대로 API 호출 수 최소화
- PDF 변환 병렬화로 전처리 시간 최소화
- 단건 처리: **30초 이내** (최적화 후 목표: **10초 이내**)

### 6.2 비용

**목표: 리뷰당 $0.05 이하** (11종 14페이지 기준)

#### 비용 최적화 전략

두 가지 구조적 변경으로 초기 $0.70/건에서 **$0.01~0.05/건**으로 93~99% 절감:

**변경 1: Agent Loop → Single-Shot API Call**
- 기존: 서브에이전트가 tool call loop로 동작 → iteration마다 전체 컨텍스트 재전송 (4회 × 누적 토큰)
- 변경: 이미지를 코드에서 직접 읽어 API 1회 호출에 임베딩 → 동일 결과, 토큰 60-70% 절감
- 효과: API call 수 75% 감소, Vision 토큰 누적 제거

**변경 2: OpenRouter 경유 멀티 모델 지원**

모든 LLM 호출은 OpenRouter(https://openrouter.ai)를 경유한다. OpenAI-compatible 엔드포인트로 모델명만 변경하여 어떤 프로바이더의 모델이든 즉시 전환 가능.

| 모델 | Input $/M | Output $/M | Vision | 용도 |
|------|-----------|------------|--------|------|
| **Gemini 2.5 Flash (현재 기본)** | $0.30 | $2.50 | O | 속도-정확도 최적 균형 |
| Gemini 2.0 Flash (저비용) | $0.10 | $0.40 | O | 최저 비용 |
| GPT-4o-mini (대안) | $0.15 | $0.60 | O | 대안 |
| Qwen3-VL-235B (고정확도) | $0.30 | $1.20 | O | thinking 모드 가능 |
| Haiku 3.5 (프리미엄) | $1.00 | $5.00 | O | 고정확도 |

#### 예상 비용 비교 (11종 14페이지)

| 구성 | Phase 2 | Phase 3 | 합계 | 절감률 |
|------|---------|---------|------|--------|
| 이전: Sonnet + Agent Loop | ~$0.60 | ~$0.10 | **~$0.70** | — |
| Qwen3-VL-235B-thinking + Single-Shot | ~$0.037 | ~$0.006 | **~$0.045** | 94% |
| **Gemini 2.5 Flash + Single-Shot** | ~$0.015 | ~$0.004 | **~$0.019** | **97%** |
| Gemini 2.0 Flash + Single-Shot | ~$0.008 | ~$0.002 | **~$0.010** | 99% |

#### 비용-정확도 균형 가이드라인

- **일반 검토 (현재 기본)**: Gemini 2.5 Flash — 비용 $0.02/건, 속도 빠름, 한국어 OCR 우수. 대부분의 정산 서류 검토에 최적
- **최저 비용**: Gemini 2.0 Flash — $0.01/건. 정확도가 약간 낮을 수 있으나 대량 처리에 적합
- **최고 정확도**: Qwen3-VL-235B (thinking) — $0.045/건. 복잡한 서류 세트, 감사 대응에 사용
- **Phase별 모델 분리**: Phase 2 (Vision OCR)와 Phase 3 (텍스트 교차검증)에 동일 모델 사용. Phase 3은 이미지가 없으므로 텍스트 전용 모델로도 대체 가능

#### 설정 방법 (`app/config.py`)

```
OPENROUTER_API_KEY=sk-or-...
PHASE2_MODEL=google/gemini-2.5-flash   # Vision + OCR
PHASE3_MODEL=google/gemini-2.5-flash   # 교차검증 (텍스트)
```

향후 정확도 비교 테스트를 통해 최적 모델 조합을 결정할 것. 동일 문서 세트로 모델별 체크리스트 pass/fail 일치율을 측정하여 "비용 대비 정확도" 최적점을 찾는다.

### 6.3 보안
- 업로드 파일: 작업 완료 후 설정 가능한 TTL (기본 24시간 후 삭제)
- exec_command: 화이트리스트 기반 명령어 제한
- 서브에이전트: spawn 재귀 불가 (depth 1 제한)
- API 인증: Bearer token 또는 API key

### 6.4 안정성
- Agent loop 최대 반복 제한 (30회)
- 서브에이전트 타임아웃 (120초)
- Claude API 호출 재시도 (429/500 → 최대 3회, exponential backoff)
- 부분 실패 처리: 서브에이전트 1개 실패 시 나머지 결과는 유지, 실패 그룹 표시

### 6.5 관측성
- 각 API 호출의 토큰 사용량 로깅
- Agent loop 단계별 로깅 (tool call 이름, 소요시간)
- 서브에이전트별 비용 추적
- 구조화된 로그 (JSON format)

---

## 7. 기술 스택

| 컴포넌트 | 기술 |
|---|---|
| 프레임워크 | FastAPI (Python 3.11+) |
| LLM API | OpenRouter (OpenAI-compatible) → Gemini, GPT, Claude, Qwen 등 |
| PDF 처리 | pdftoppm (poppler-utils) — JPEG 출력, 병렬 변환 |
| 비동기 | asyncio, httpx |
| 스토리지 | 로컬 파일시스템 (MVP) → S3 (확장) |
| DB | SQLite (MVP) → PostgreSQL (확장) |
| 작업 큐 | 인프로세스 asyncio (MVP) → Celery/Redis (확장) |
| 컨테이너 | Docker + docker-compose |

---

## 8. 마일스톤

### Phase 1: MVP (1주)
- [ ] Agent Loop Engine 구현
- [ ] Tool 구현: read_file, exec_command, spawn_subagent, spawn_parallel, list_files
- [ ] Prompt Manager (스킬 파일 로딩)
- [ ] `POST /api/reviews` + `GET /api/reviews/{id}` 엔드포인트
- [ ] 동기 처리 (요청 → 완료까지 대기 → 응답)
- [ ] 기존 스킬 references/*.md 이식

### Phase 2: 비동기 + 안정화 (1주)
- [ ] 백그라운드 작업 처리 (202 반환 + 폴링)
- [ ] WebSocket 스트리밍
- [ ] 에러 핸들링 및 재시도
- [ ] 토큰/비용 추적
- [ ] API 인증

### Phase 3: 프로덕션 (1주)
- [ ] Docker 패키징
- [ ] DB 연동 (검토 이력)
- [ ] 파일 TTL 자동 삭제
- [ ] 로깅/모니터링
- [ ] 웹훅 콜백
- [ ] 부하 테스트

---

## 9. 제약사항 및 리스크

| 리스크 | 대응 |
|---|---|
| LLM Vision OCR 오독 (금액/번호) | 교차검증에서 불일치 감지 + 향후 하이브리드 OCR(Phase C) |
| 모델 변경 시 정확도 하락 | 동일 문서 세트로 A/B 테스트 후 전환 |
| OpenRouter rate limit / 장애 | 동시 실행 수 제한 (기본 5개) + 재시도 + 직접 API fallback 가능 |
| 대용량 파일 (고해상도 스캔) | JPEG 변환 + 이미지 리사이즈 전처리 |
| 스캔 문서 OCR 정확도 저하 | 향후 선택적 이미지 전처리(Phase B): 대비 향상, 노이즈 제거 |

---

## 10. 성공 지표

- 서류 9건 검토 완료율: **95% 이상**
- 금액/사업자번호 추출 정확도: **98% 이상**
- 교차검증 이슈 탐지율: **90% 이상**
- 평균 처리 시간 (9건): **2분 이내** (최적화 후 목표: 30초~1분)
- 건당 평균 비용: **$0.05 이하** (최적화 후 실측: ~$0.01~0.02)

---

## 11. 파이프라인 최적화 전략

### 11.1 목적

MVP 파이프라인이 동작하는 상태에서, **속도·비용·정확도** 세 축을 동시에 개선하는 것이 목적이다.
세 축은 일반적으로 트레이드오프 관계이지만, 현재 파이프라인에는 구조적 비효율이 존재하여
적절한 최적화로 세 축을 동시에 개선할 수 있는 기회가 있다.

| 축 | MVP 상태 | 최적화 목표 |
|---|---|---|
| 속도 (9건) | 80~140초 | **18~37초** |
| 비용 (건당) | ~$0.045 | **~$0.01** |
| 정확도 (금액/번호) | ~95% | **98~99%** |

### 11.2 가설

> **H5 (모델 효율성)**: Thinking 모델(Qwen3-VL-235B-thinking)의 내부 chain-of-thought는
> 구조화된 OCR + JSON 추출 작업에서 불필요한 오버헤드이다. Non-thinking 모델로 전환해도
> OCR 정확도는 1% 이내 하락에 그치면서, 속도는 2~5배, 비용은 50~78% 개선된다.
>
> **검증 방법**: 동일 문서 세트(11종 14페이지)로 thinking vs non-thinking 모델의
> 체크리스트 pass/fail 일치율 및 금액/번호 추출 정확도를 비교한다.

> **H6 (이미지 포맷 최적화)**: PNG → JPEG(quality 85) 변환은 이미지 크기를 60~70% 줄이면서
> Vision 모델의 OCR 정확도에 영향을 주지 않는다. 이미지 토큰 계산이 픽셀 기반이므로
> 파일 크기 자체는 비용에 영향 없으나, base64 인코딩 크기 감소로 네트워크 전송 시간이 단축된다.
>
> **검증 방법**: PNG vs JPEG 동일 문서의 OCR 결과를 비교한다.

> **H7 (그룹 확대)**: 그룹 크기를 3→5로 확대하면 API 호출 수가 33% 감소하여 총 처리 시간이
> 5~15초 단축된다. 그룹이 커져도 LLM의 다중 문서 동시 분석 능력은 충분하다.
>
> **검증 방법**: 그룹 크기별(3, 5, 7) 처리 시간과 정확도를 비교한다.

> **H8 (DPI 상향 + 전처리)**: DPI 200→300 상향은 한국어 세금계산서의 소형 글자(8~10pt)와
> 표 구조 인식을 3~5% 개선한다. 추가로 스캔 문서에 대비 향상/노이즈 제거를 적용하면
> 스캔 문서 정확도가 10~20% 향상된다.
>
> **검증 방법**: DPI 150/200/300에서 금액·사업자번호 추출 정확도를 비교한다.

> **H9 (2-Pass 프롬프트)**: 11종 체크리스트를 모두 전달하는 대신, 1차에서 문서 유형을 판별하고
> 2차에서 해당 유형의 체크리스트만 전달하면, 입력 토큰 40~60% 절감과 동시에
> 모델의 주의력 집중으로 정확도가 3~5% 향상된다.
>
> **검증 방법**: 전체 번들 vs 선별 번들의 체크리스트 일치율을 비교한다.

> **H10 (하이브리드 OCR)**: PaddleOCR로 사전 추출한 텍스트를 이미지와 함께 LLM에 전달하면,
> LLM이 OCR 텍스트를 참고하여 이미지 판독 정확도가 향상된다.
> 연구 결과(Hybrid OCR-LLM Framework)에서 F1=0.997을 달성한 것과 동일한 원리.
> 특히 금액·사업자번호 등 숫자 데이터에서 상호 보완 효과가 크다.
>
> **검증 방법**: LLM-only vs PaddleOCR+LLM의 금액/번호 추출 정확도를 비교한다.

### 11.3 방법: 3단계 최적화 로드맵

#### Phase A: 즉시 적용 — 구조적 비효율 제거 (H5, H6, H7)

config 변경 + 소규모 코드 수정만으로 속도/비용을 대폭 개선. 정확도 리스크 최소.

| 변경 | 수정 대상 | 효과 |
|------|----------|------|
| 모델: Qwen3-VL-235B-thinking → **Gemini 2.5 Flash** | `config.py` | 속도 3~5배, 비용 78% 절감 |
| PDF 변환: 순차 → **병렬** (`asyncio.gather`) | `pipeline.py` | Phase 1 소요시간 70% 단축 |
| 그룹 크기: 3 → **5** | `pipeline.py` | API 호출 수 33% 감소 |
| 이미지: PNG → **JPEG 85** | `pipeline.py`, `llm.py` | 전송 크기 60~70% 감소 |
| max_tokens: 8192 → **4096** | `llm.py` | 불필요한 출력 방지 |

**예상 결과**: 처리 시간 80~140초 → 18~37초, 비용 $0.045 → $0.010~0.019

**검증 계획**: Phase A 적용 후 기존 테스트 서류로 결과를 비교하여 H5, H6, H7을 검증한다.
만약 정확도가 기준(95%) 미만이면 모델을 `qwen/qwen-2.5-vl-72b-instruct`로 대체 시도한다.

#### Phase B: 단기 — 정확도 강화 (H8, H9)

| 변경 | 수정 대상 | 효과 |
|------|----------|------|
| DPI 200 → **300** + JPEG 변환 | `pipeline.py` | OCR 정확도 +3~5% |
| 스캔 문서 감지 → 조건부 이미지 전처리 | `pipeline.py` (신규 함수) | 스캔 문서 정확도 +10~20% |
| 2-Pass 프롬프트: 유형 판별 → 선별 체크리스트 | `pipeline.py`, `prompt_manager.py` | 정확도 +3~5%, 비용 40~60% 절감 |

**예상 결과**: 금액/번호 정확도 95% → 98%, 비용 $0.010 → $0.006

#### Phase C: 중기 — 최고 정확도 달성 (H10)

| 변경 | 수정 대상 | 효과 |
|------|----------|------|
| PaddleOCR + LLM Vision 하이브리드 | `pipeline.py` (Phase 1.5 신규) | 금액/번호 정확도 99%+ |
| Batch API 모드 (대량 일괄 검토) | `llm.py` (대체 경로) | 비용 추가 50% 절감 |

**예상 결과**: 금액/번호 정확도 98% → 99%+, 대량 처리 비용 $0.003/건

### 11.4 의사결정 기록

| 일자 | 결정 | 근거 |
|------|------|------|
| 2026-02-14 | Phase A 적용: Gemini 2.5 Flash 전환 | thinking 모델의 OCR 작업 내 불필요한 CoT 오버헤드. 속도 3~5배, 비용 78% 개선. 구현 비용 최소(config 변경). |
| 2026-02-14 | Phase A 적용: PNG → JPEG 85 | base64 크기 60~70% 감소. 픽셀 기반 토큰 계산이므로 Vision 비용 불변. OCR 정확도 영향 없음. |
| 2026-02-14 | Phase A 적용: 그룹 크기 3→5 | 9건 서류: 3그룹→2그룹. API 호출 1회 절약 (~10초). 5개 문서 동시 분석은 LLM context window 내 충분. |
| 2026-02-14 | Phase A 적용: PDF 변환 병렬화 | 독립적인 파일 변환을 순차 실행할 이유 없음. asyncio.gather로 변경. |
| 2026-02-14 | OpenRouter 유지 결정 | 수수료 5.5%이나 절대액 미미($0.001/건). 모델 전환 유연성 + fallback 가치가 더 큼. 월 10만건 이상 시 재검토. |
