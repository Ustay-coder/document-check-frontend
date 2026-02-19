# 서류 검토 파이프라인 스펙

## 개요

서류 검토 시스템의 핵심 실행 파이프라인을 정의한다.
**메인 에이전트 루프를 제거**하고, 코드가 직접 Phase 1→2→3을 오케스트레이션한다.

### 변경 이유

기존 방식(메인 에이전트 루프)은 Claude가 매 단계마다 "다음에 뭘 할지" 판단하는 구조였다.
하지만 워크플로우는 항상 동일하므로, 이 판단 자체가 불필요한 오버헤드다.

| 항목 | 기존 (에이전트 루프) | 현재 (고정 파이프라인) |
|------|---------------------|----------------------|
| 메인 에이전트 API 호출 | ~6회 (iteration마다) | **0회** |
| 오케스트레이션 | Claude가 판단 | 코드가 직접 실행 |
| 서브에이전트 | Claude가 호출 결정 | 코드가 직접 스폰 |
| 예상 소요 시간 | 60~90초 | **20~30초** |
| 컨텍스트 누적 비용 | 매 iteration마다 증가 | 없음 |

---

## 아키텍처

```
사용자 → Streamlit UI → POST /api/reviews → FastAPI
                                              │
                                              ▼
                                      _run_review() (백그라운드)
                                              │
                                              ▼
                                   run_review_pipeline()
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              Phase 1 (코드)          Phase 2 (서브에이전트)       Phase 3 (서브에이전트)
              PDF→PNG 변환            병렬 OCR + 개별 검토         교차검증
              파일 그룹핑              (agent loop 사용)           (agent loop 사용)
                    │                         │                         │
                    └─────────────────────────┼─────────────────────────┘
                                              ▼
                                     _assemble_result() (코드)
                                              │
                                              ▼
                                   ReviewResult → DB 저장
                                              │
                                              ▼
                              Streamlit 폴링이 completed 감지 → 결과 표시
```

---

## Phase 1: 전처리 (코드 직접 실행)

**입력**: work_dir 내 업로드된 파일들 (PDF, JPG, PNG)
**출력**: 파일 그룹 목록

### 1-1. PDF → JPEG 변환 (병렬)

```
pdftoppm -jpeg -jpegopt quality=85 -r 200 {파일명}.pdf {파일명}
```

- `asyncio.gather()`로 모든 PDF를 **병렬 변환** (순차 대비 3~5배 빠름)
- 각 페이지가 `{파일명}-1.jpg`, `{파일명}-2.jpg` 등으로 생성됨
- DPI 200으로 설정 (OCR 정확도와 파일 크기 균형)
- JPEG quality 85로 설정 (PNG 대비 60~70% 크기 감소, OCR 정확도 영향 없음)

### 1-2. 파일 → 이미지 매핑

원본 파일별로 이미지 파일을 매핑한다:

```python
{
    "invoice.pdf": ["invoice-1.png", "invoice-2.png"],  # PDF → 변환된 PNG
    "photo.jpg": ["photo.jpg"],                          # 이미지 → 그대로
    "contract.pdf": ["contract-1.png"],                  # 1페이지 PDF
}
```

- PDF에서 변환된 PNG는 원본 PDF에 귀속
- 업로드된 이미지(JPG/PNG)는 변환 없이 그대로 사용
- 변환 실패한 PDF는 건너뜀

### 1-3. 그룹핑

원본 파일을 **최대 5개씩** 묶어 그룹을 구성한다.

```python
# 파일 9개 → 그룹 2개
Group 1: [invoice.pdf(2p), contract.pdf(1p), estimate.pdf(1p), bank_account.jpg, business_reg.jpg]
Group 2: [transfer.png, inspection.pdf(2p), transaction.pdf(1p), subsidy.pdf(1p)]
```

- 의미 기반 그룹핑(관련 서류끼리)은 하지 않음
- 서브에이전트가 문서 유형을 직접 판별하도록 위임
- 단순 순서 기반 그룹핑으로 코드 복잡도 최소화

**Claude API 호출: 0회**

---

## Phase 2: OCR + 개별 검토 (서브에이전트 병렬)

**입력**: 파일 그룹 목록 + 레퍼런스 체크리스트 (+ Custom Rules)
**출력**: 그룹별 `documents[]` JSON

### 실행 방식

`spawn_parallel()` 호출 → 그룹 수만큼 서브에이전트 병렬 실행 (최대 5개 동시)

각 서브에이전트는 **독립적인 agent loop**을 실행한다:
- 도구: `read_file`, `list_files` 만 사용 가능
- `read_file`로 이미지를 읽으면 → base64 이미지가 Claude Vision으로 전달
- 문서 유형을 자동 판별하고 체크리스트에 따라 검토

### Custom Rules 주입 (Phase 2)

서브에이전트에게 전달할 체크리스트 번들은 Custom Rules 유무에 따라 분기한다:

```
custom_rules.phase2_checklists 존재?
├─ YES → build_reference_bundle_with_overrides(checklists, mode)
│         ├─ mode="supplement": 커스텀 체크리스트 + (겹치지 않는) 기본 체크리스트
│         └─ mode="replace": 커스텀 체크리스트만
└─ NO  → build_reference_bundle()
          └─ app/prompts/references/*.md 전체 로드 + 결합
```

> **참고**: `supplement` 모드에서 사용자 체크리스트의 `doc_type`이 기본 11종과 겹치면 해당 유형만 사용자 규칙으로 대체된다.

> **문서 유형 확장**: `doc_type`에 기본 11종에 없는 이름(예: `부동산매매계약서`, `수출신고필증`)을 지정하면, 해당 체크리스트가 번들에 추가되어 LLM이 새 유형을 인식하고 검토한다. `replace` 모드에서는 사용자 정의 유형만으로 완전히 다른 도메인의 서류를 검토할 수 있다.

### 서브에이전트 태스크 구성

각 서브에이전트에게 전달되는 태스크에 포함되는 내용:

1. **분석할 파일 목록**: 이미지 파일 경로 + `read_file`로 읽으라는 지시
2. **문서 유형별 체크리스트**: `build_reference_bundle()` 또는 `build_reference_bundle_with_overrides()`로 구성한 체크리스트 번들
3. **반환 형식**: `documents[]` JSON 스키마

### 서브에이전트 내부 흐름

```
Iteration 1: Claude → read_file("invoice-1.png") 요청
Iteration 2: 이미지 수신 → read_file("invoice-2.png") 요청
Iteration 3: 이미지 수신 → read_file("contract-1.png") 요청
Iteration 4: 모든 이미지 분석 완료 → JSON 결과 반환 (end_turn)
```

### 반환 JSON 형식

```json
{
  "documents": [
    {
      "docType": "세금계산서",
      "filename": "invoice.pdf",
      "party": "supplier",
      "status": "pass",
      "extractedData": {
        "businessRegNo": "123-45-67890",
        "companyName": "에스엠테크",
        "supplyAmount": 1000000,
        "taxAmount": 100000,
        "totalAmount": 1100000,
        "date": "2026-01-15",
        ...
      },
      "checklist": [
        {"item": "필수기재사항", "status": "pass", "value": "...", "note": ""}
      ]
    }
  ]
}
```

**Claude API 호출: 그룹 수 × 서브에이전트 iteration 수**
(예: 3그룹 × 평균 4회 = 12회, 5개 동시 실행으로 벽시계 시간은 1그룹 분량)

---

## Phase 3: 교차검증 (서브에이전트 1회)

**입력**: Phase 2의 모든 결과 (텍스트) (+ Custom Rules)
**출력**: `crossValidation[]` + `summary` JSON

### 실행 방식

`spawn_subagent()` 호출 → 단일 서브에이전트 실행

- **이미지를 보내지 않음** → 텍스트만 전달 → 토큰 절약
- Phase 2 결과 JSON 전체를 텍스트로 전달
- 교차검증 규칙을 태스크에 포함

### Custom Rules 주입 (Phase 3)

```
custom_rules.cross_validation_rules 존재?
├─ YES → _build_phase3_task(phase2_raw, extra_rules=cross_validation_rules)
│         └─ 기본 CROSS_VALIDATION_RULES + "## 추가 교차검증 규칙" 섹션 삽입
└─ NO  → _build_phase3_task(phase2_raw)
          └─ 기본 CROSS_VALIDATION_RULES만 사용
```

> `mode`는 Phase 2와 동일한 값(`custom_rules.mode`)이 적용된다. `replace` 모드에서는 기본 `CROSS_VALIDATION_RULES`를 무시하고 사용자 규칙만 사용한다.

### 교차검증 항목

| 카테고리 | 검증 내용 |
|---------|----------|
| 금액 흐름 | 견적서 ↔ 계약서 ↔ 세금계산서 ↔ 이체확인증 금액 일치 |
| 당사자 정보 | 사업자등록번호, 업체명, 대표자명 일치 |
| 계좌 정보 | 이체확인증 계좌 ↔ 통장사본 ↔ 계약 당사자 |
| 날짜 정합성 | 견적일 → 계약일 → 이체일 → 검수일 순서 |
| 누락 서류 | 필수 서류 누락 여부 |

### 반환 JSON 형식

```json
{
  "crossValidation": [
    {
      "category": "금액흐름",
      "item": "계약서 금액 ↔ 세금계산서 공급가액",
      "status": "pass",
      "expected": "1,000,000원",
      "actual": "1,000,000원",
      "docs": ["계약서", "세금계산서"],
      "note": ""
    }
  ],
  "summary": {
    "totalDocs": 9,
    "passed": 7,
    "warnings": 1,
    "failures": 1,
    "criticalIssues": ["이체확인증 금액과 세금계산서 합계 불일치"],
    "actionRequired": ["이체확인증 재확인 필요"],
    "opinion": "대부분 일치하나 금액 확인 필요"
  }
}
```

**Claude API 호출: 서브에이전트 1~2회** (이미지 없으므로 보통 1회로 종료)

---

## 최종 조립 (코드)

`_assemble_result()` 함수가 Phase 2 + Phase 3 결과를 `ReviewResult` 모델로 조립한다.

```python
ReviewResult(
    meta={},
    documents=[...],          # Phase 2에서 추출
    cross_validation=[...],   # Phase 3에서 추출
    summary=ReviewSummary(...) # Phase 3에서 추출 + Phase 2 통계
)
```

### JSON 파싱 전략

서브에이전트 응답에서 JSON을 추출하는 우선순위:
1. ` ```json ... ``` ` 코드 블록
2. ` ``` ... ``` ` 코드 블록 내 JSON
3. 텍스트 내 첫 `{` ~ 마지막 `}` 범위

---

## 진행 상태 업데이트

파이프라인의 각 단계에서 `ReviewProgress`를 업데이트하여 UI 폴링에 반영한다.

| phase | detail | completed_groups | total_groups |
|-------|--------|-----------------|-------------|
| `phase1_preprocessing` | "PDF 변환 중..." | 0 | 0 |
| `phase2_ocr` | "N개 그룹 검토 시작..." | 0 | N |
| `phase2_ocr` | "OCR + 검토 완료" | N | N |
| `phase3_cross_validation` | "교차검증 중..." | 0 | 0 |
| `completed` | "검토 완료" | 0 | 0 |

---

## API 호출 비교

### 기존: 메인 에이전트 루프

```
메인 에이전트 iteration 1: list_files              → API 1회
메인 에이전트 iteration 2: exec_command(pdftoppm)   → API 1회
메인 에이전트 iteration 3: exec_command(pdftoppm)   → API 1회
메인 에이전트 iteration 4: spawn_parallel           → API 1회 + 서브에이전트 ~15회
메인 에이전트 iteration 5: spawn_subagent           → API 1회 + 서브에이전트 ~2회
메인 에이전트 iteration 6: 최종 JSON 조립           → API 1회
─────────────────────────────────────────────
총: 메인 6회 + 서브 ~17회 = ~23회
```

### 현재: 고정 파이프라인

```
Phase 1: pdftoppm (코드 직접 실행)                  → API 0회
Phase 2: spawn_parallel                             → 서브에이전트 ~12회
Phase 3: spawn_subagent                             → 서브에이전트 ~2회
최종 조립 (코드 직접 실행)                           → API 0회
─────────────────────────────────────────────
총: 메인 0회 + 서브 ~14회 = ~14회
```

**절감: 메인 에이전트 API 호출 6회 완전 제거** → 순수 대기 시간 30~40초 절약

---

## 파일 구조

```
app/
├── pipeline.py          # 고정 파이프라인 (Phase 1→2→3)
├── routes.py            # FastAPI 엔드포인트 (_run_review → pipeline 호출)
├── agent.py             # 에이전트 루프 (서브에이전트에서만 사용)
├── tools/
│   ├── __init__.py      # 도구 스키마 + execute_tool
│   ├── subagent.py      # spawn_subagent, spawn_parallel
│   ├── read_file.py     # 파일 읽기 (이미지 → base64)
│   ├── exec_command.py  # 쉘 명령 실행
│   └── list_files.py    # 파일 목록
├── prompts/
│   ├── system.md        # (서브에이전트용 참고)
│   ├── SKILL.md         # 워크플로우 정의 (참고 문서)
│   └── references/      # 문서 유형별 체크리스트
└── models.py            # Pydantic 모델
```

---

## 설정

`app/config.py` 관련 설정:

| 설정 | 기본값 | 용도 |
|------|--------|------|
| `PHASE2_MODEL` | `google/gemini-2.5-flash` | Phase 2 Vision OCR 모델 |
| `PHASE3_MODEL` | `google/gemini-2.5-flash` | Phase 3 교차검증 모델 |
| `MAX_CONCURRENT_SUBAGENTS` | `5` | 동시 실행 서브에이전트 수 |
| `COMMAND_TIMEOUT` | `30` | pdftoppm 등 명령 타임아웃 (초) |

> 모든 LLM 호출은 OpenRouter 경유. 모델명은 OpenRouter 형식 사용.

---

## 최적화 로드맵

### Phase A: 즉시 적용 (완료)

속도/비용을 동시에 개선하는 저위험 변경. config + 코드 소폭 수정만으로 적용.

| 변경 | 효과 |
|------|------|
| 모델 변경: Qwen3-VL-235B-thinking → **Gemini 2.5 Flash** | 속도 3~5배, 비용 78% 절감 |
| PDF 변환 병렬화: 순차 → `asyncio.gather()` | Phase 1 소요시간 70% 단축 |
| 그룹 크기 확대: 3개 → **5개** | API 호출 수 33% 감소 |
| 이미지 포맷: PNG → **JPEG 85** | 파일 크기 60~70% 감소, 전송 속도 향상 |
| max_tokens: 8192 → **4096** | 불필요한 출력 토큰 방지 |

**예상 결과** (9건 서류):
- 처리 시간: 80~140초 → **18~37초**
- 건당 비용: $0.045 → **~$0.010**

### Phase B: 단기 (1~2주)

정확도를 강화하는 프롬프트/전처리 최적화.

| 변경 | 효과 |
|------|------|
| DPI 200 → **300** 상향 | OCR 정확도 +3~5% (금액/사업자번호) |
| 스캔 문서 감지 → 조건부 이미지 전처리 (대비 향상, 노이즈 제거) | 스캔 문서 정확도 +10~20% |
| 2-Pass 프롬프트: 문서 유형 판별 → 선별 체크리스트 전달 | 정확도 +3~5%, 입력 토큰 40~60% 절감 |

**예상 결과**:
- 금액/사업자번호 추출 정확도: 95% → **98%**
- 건당 비용: $0.010 → **~$0.006**

### Phase C: 중기 (1~2개월)

하이브리드 OCR로 최고 정확도 달성.

| 변경 | 효과 |
|------|------|
| PaddleOCR + LLM Vision 병행 (하이브리드 OCR) | 금액/번호 정확도 99%+, F1=0.997 |
| Batch API 모드 (대량 일괄 검토) | 비용 추가 50% 절감 |

**예상 결과**:
- 금액/번호 정확도: 98% → **99%+**
- 대량 처리 건당 비용: **~$0.003**
