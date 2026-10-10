# 문제 은행 · 정답형 과제 — DB 설계 (상용 반영 기준)

> 관련 PRD: product-docs `TSK-14 스마트 과제 등록` · `QBK-01 문제 은행`
> 프로토 구현: `src/lib/itemBank.js` (브라우저 IndexedDB `aigle-item-bank` — 아래 테이블과 같은 구조의 문서 저장)
> 작성: 2026-10-02 (v1.1 — 문제집·기초학력·양자택일형·단원 단위 성취기준 반영 · v1.2 2026-10-10 — 원본 쪽 이미지 보관·그림 위치(page·box·origin)) · 상태: **초안** (상용 정답형 JSON 형식 미확보 — §6)
> AI 판단 기준·요청 문구: `AI_추출_설계기준.md`

## 1. 범위

| 단계 | 대상 | 이번 문서 |
|---|---|---|
| 1. 문항 수집 | 자료 업로드 → AI 분류 → 문항 저장 → 문제집 | **확정 초안** (`item_source` · `item_passage` · `item` · `workbook`) |
| 2. 과제 배치 | 문항을 골라 평가 문항으로 배치 | 개요만 (§5) |
| 3. 출력·채점 | Ncode 시험지 · 답안 영역 · 채점 | 개요만 (§5) |

## 2. 엔터티 관계

```
item_source 1 ─── N item_passage
item_source 1 ─── N item ─── N:1 item_passage (선택)
item 1 ─── N item (lineage: parent_id — 파생 문항)
workbook 1 ─── N workbook_item N ─── 1 item (문제집 — 순서 있는 묶음, 문항은 여러 문제집에 담길 수 있음)
item N ─── 1 교육과정 카탈로그 (school_level / grade / curriculum / subject / evaluation_area / standard)
```

## 3. 테이블

### 3.1 item_source — 업로드한 자료 1건

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | O | PK |
| owner_teacher_id | FK | O | 업로드한 교사 (프로토: 없음) |
| school_id | FK | O | 소속 학교 |
| file_name | varchar(255) | O | 원본 파일명 |
| file_size | int | O | 바이트 |
| file_uri | varchar | - | 원본 보관 위치 (스토리지). 프로토는 보관 안 함 |
| page_count | int | O | 전체 쪽 수 (분석은 앞 10쪽) |
| title | varchar(200) | O | 자료 제목 (AI 추출, 없으면 파일명) |
| curriculum_guess | json | - | 자료 전체 교육과정 추정 {schoolLevelName, gradeLabel, curriculumName, subjectName, subjectId} |
| track | enum | O | `curriculum`(교과) · `basic`(기초학력) — AI 판단, 교사 변경 가능 |
| skill | varchar(100) | - | 기초학력 학습 기능명 (예: 복잡한 받침 단어 읽기) |
| exam_scope | json | - | 시험 범위 {units:[자료 표기 단원명], standardCodes:[]} — 지필평가 계획서 단위 |
| page_images | json | - | (v1.2) 원본 쪽 이미지 `[{no, uri, width, height}]` — 그림 범위 다시 잡기용. 상용은 스토리지 URI, 프로토는 JPEG data URL |
| ai_model | varchar(50) | - | 분석에 쓴 모델 (비용·품질 추적) |
| uploaded_at | datetime | O | |

### 3.2 item_passage — 공통 지문

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | O | PK |
| source_id | FK | O | item_source |
| passage_key | varchar(10) | - | 자료 안 식별자 (P1, P2…) |
| body | text | O | 지문 전문 (상용: TipTap doc 직렬화 — 서·논술 과제의 passage와 같은 형식) |
| range_label | varchar(50) | - | 「1~3번」 등 적용 범위 표기 |
| created_at | datetime | O | |

### 3.3 item — 문항

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | O | PK |
| schema_version | int | O | 문항 JSON 구조 버전 (현재 1) |
| owner_teacher_id / school_id | FK | O | 소유 |
| source_id | FK | - | 원본 자료 (직접 입력·파생은 없을 수 있음) |
| source_page | int | - | 원본 쪽 |
| source_number | varchar(10) | O | 자료의 문항 번호 |
| sort_order | int | O | 자료 안 순서 |
| item_type | enum | O | `multiple_choice` · `binary_choice`(양자택일형) · `true_false` · `matching` · `short_answer` · `completion` · `essay` |
| track | enum | O | `curriculum` · `basic` — 기초학력은 단원·성취기준을 요구하지 않음 |
| skill | varchar(100) | - | 기초학력 학습 기능명 |
| type_group | enum | O | `select`(선택형) · `supply`(서답형) — item_type에서 파생 |
| stem | text | O | 발문 |
| material | text | - | `<보기>`·조건·제시 자료 |
| choices | json | - | 선다형·양자택일형 보기 `[{no, text, imageUri?}]` (양자택일형은 2개) |
| matching | json | - | 연결형 `{left:[…], right:[…]}` |
| blank_count | int | - | 완성형 빈칸 수 |
| answer | json | - | 정답 — §4. **모든 유형 칸을 보관**하고 유형을 바꿔도 지우지 않는다 (되돌리면 복구) |
| answer_source | enum | O | `file` · `ai` · `teacher` · `none` |
| explanation | text | - | 해설 |
| points | decimal(5,2) | - | 배점 (자료에 있을 때). 과제 배치에서 덮어쓸 수 있음 |
| passage_id | FK | - | item_passage |
| images | json | - | `[{uri, label, bytes, page, box, origin}]` — 상용은 스토리지 URI, 프로토는 data URL. (v1.2) `page`: 원본 쪽 번호 · `box`: `[ymin,xmin,ymax,xmax]` 쪽 크기 대비 0~1000 · `origin`: `ai`(AI가 자름) / `teacher`(교사가 자름) / `upload`(교사가 올림) |
| school_level_code · grade_id · curriculum_id · subject_id | FK | - | 교육과정 카탈로그 (상용 「아이글_과제 생성 정보」 ID와 동일) |
| unit_area_id | FK | - | **단원**(카탈로그 핵심평가영역) — 교과 문항의 성취기준은 이 단원 단위 |
| unit_label | varchar(200) | - | 자료에 적힌 단원 표기 그대로 (교과서 단원명) |
| unit_source | enum | - | `file`(자료 표기·성취기준 코드) · `scope`(시험 범위 안) · `ai`(내용 추정 — 교사 확인) · `teacher` · `none` |
| standards_basis | enum | O | `unit`(단원의 성취기준 전체) · `none`(기초학력). 문항별 개별 성취기준 선택은 하지 않는다 |
| standard_ids | json(int[]) | - | 단원에서 파생한 성취기준 ID (조회 편의 — unit_area_id로 재계산 가능, 상용 과제 JSON `standards`와 같은 ID) |
| lineage_root_id | FK(item) | O | 계보 최상위 원본 (원본이면 자기 자신) |
| lineage_parent_id | FK(item) | - | 바로 위 원본. 원본 문항은 null |
| derivation | varchar(30) | - | 파생 방식 (`numeric_change` · `choice_swap` · `difficulty_up` · `type_convert` … — 후속 확정) |
| status | enum | O | `ready`(사용 가능) · `needs_review`(확인 필요) — 저장 시 재판정 |
| issues | json | - | 확인 항목 `[{level, field, message}]` (AI 추출 결과 품질 표시) |
| created_at · updated_at | datetime | O | |
| deleted_at | datetime | - | 소프트 삭제 (파생 문항의 parent 참조 유지 위해) |

인덱스: `(owner_teacher_id, item_type)` · `(source_id, sort_order)` · `(subject_id, unit_area_id)` · `(track)` · `(lineage_root_id)` · `(status)`

### 3.4 workbook — 문제집

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| id | uuid | O | PK |
| owner_teacher_id · school_id | FK | O | 소유 |
| title | varchar(60) | O | 이름 |
| purpose | enum | O | `exam`(시험 대비) · `basic`(기초학력) · `practice`(수업·연습) |
| created_at · updated_at | datetime | O | |

### 3.5 workbook_item — 문제집 안 문항 (순서)

| 컬럼 | 타입 | 필수 | 설명 |
|---|---|---|---|
| workbook_id | FK | O | PK 1 |
| item_id | FK | O | PK 2 — 같은 문항을 한 문제집에 두 번 담지 않음 |
| sort_order | int | O | 순서 |

- 문항 삭제(소프트) 시 workbook_item은 남기고 화면에서 「삭제된 문항」으로 집계. 문제집 삭제는 문항에 영향 없음
- 프로토는 workbook 문서에 `itemIds` 배열(순서)로 저장

## 4. 정답(answer) JSON — 유형별

모든 유형이 같은 객체를 쓰고, 해당 칸만 채운다.

```json
{ "choices": [], "truth": null, "texts": [], "blanks": [], "pairs": [], "model": "" }
```

| item_type | 쓰는 칸 | 예 | 채점 |
|---|---|---|---|
| multiple_choice | `choices` (보기 번호, 복수 가능) | `[3]` · `[1,4]` | 마킹 번호 일치 (복수 정답 규칙은 과제 배치에서 — 모두 일치 / 하나라도) |
| binary_choice | `choices` (1개) | `[1]` | 동그라미 친 낱말 영역 판별 후 일치 |
| true_false | `truth` | `true`(O) | O/X 인식 후 일치 |
| matching | `pairs` ([왼쪽 순번, 오른쪽 순번]) | `[[1,2],[2,3],[3,1]]` | 선 연결 인식 후 쌍 비교 (부분 점수 규칙 후속) |
| short_answer | `texts` (허용 답 목록) | `["힘","힘(force)"]` | 필기 인식 후 허용 답과 정규화 비교 |
| completion | `blanks` (빈칸별 허용 답 목록) | `[["원래"],["반대"]]` | 빈칸별 비교 |
| essay | `model` (모범답안) | `"…"` | 채점 기준(루브릭)으로 AI 채점 — 루브릭은 과제 배치에서 |

## 5. 다음 단계 (개요 — 과제 배치 · 출력 · 채점)

| 테이블 | 역할 |
|---|---|
| assessment | 정답형 과제(시험지) — 기존 과제와 같은 목록·배포·채점 흐름. `assessment_form = 'answer_based'` 로 서·논술 과제와 구분 |
| assessment_item | 시험지에 배치한 문항 — item 스냅샷(배포 후 원본 수정 영향 차단) · 번호 · 배점 · 복수정답/부분점수 규칙 |
| sheet_layout | 출력 레이아웃 — 쪽 · 단 · 문항 위치 |
| answer_area | 문항별 답안 영역 좌표 (쪽, x, y, w, h) — Ncode 좌표로 필기를 문항에 배정, 스캔은 마커 정렬 후 같은 좌표 사용 |
| ncode_allocation | 학생 × 쪽별 Ncode 페이지 주소 할당 |
| response / item_score | 학생 응답(인식 결과·원본 필기 참조) · 문항별 점수·판정 근거 |

## 6. 상용 형식 확인 필요

| # | 항목 | 현황 |
|---|---|---|
| 1 | 상용 과제 JSON의 서술형 외 `problemType` 값과 문항 구조 | **미확보** — 유형별 export 샘플 필요. 확보 시 item ↔ 상용 JSON 변환기 추가 |
| 2 | `schoolLevelCode` 숫자 | HIGH=3만 샘플로 확인, ELEMENTARY=1·MIDDLE=2 추정 |
| 3 | 이미지 저장 방식 | 상용 과제 JSON 이미지 노드 형식 미확인 (서·논술 내보내기는 data URL로 시도 중) |

## 7. 유형 변경 시 정답 처리 (`changeItemType`)

| 변경 | 처리 |
|---|---|
| 선다형 ↔ 양자택일형 | `choices` 그대로 |
| 선다형·양자택일형 → 단답형 | `texts`가 비었으면 고른 보기 글자로 채움 |
| 단답형 → 선다형·양자택일형 | `choices`가 비었으면 `texts`와 같은 글자의 보기 번호로 채움 |
| 그 외 | 값 이동 없음. 새 유형 칸이 비면 「정답 없음」 상태, **다른 칸은 보존** → 되돌리면 복구. `answer_source`도 유지 |
