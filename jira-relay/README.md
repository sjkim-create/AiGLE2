# aigle-jira-relay — 장애신고 → Jira 중계 (Vercel Serverless Functions)

브라우저에서 Jira REST API를 직접 부를 수 없어(CORS · 토큰 노출) 이 함수들이 대신 호출한다. DB 없음 — Jira(AGI)가 저장소.

## 1회 설정 (약 5분) — GitHub 계정으로 로그인
```bash
cd jira-relay
npm install
npx vercel login          # → "Continue with GitHub" 선택, 브라우저에서 승인
npx vercel                # 프로젝트 생성·연결 (질문은 전부 Enter = 기본값). 미리보기 배포 1회
npx vercel env add JIRA_EMAIL production        # Atlassian 로그인 이메일 입력
npx vercel env add JIRA_API_TOKEN production    # Jira API 토큰 붙여넣기 (https://id.atlassian.com/manage-profile/security/api-tokens)
npx vercel --prod         # 실배포 → https://aigle-jira-relay-<계정>.vercel.app
```
토큰은 **Vercel 프로젝트 환경변수**(암호화)에만 저장된다. 이 리포·`.env`·화면 코드 어디에도 두지 않는다.
대시보드에서 넣어도 된다: vercel.com → 프로젝트 → Settings → Environment Variables → `JIRA_EMAIL`, `JIRA_API_TOKEN` (Production) → 저장 후 **Redeploy**.
토큰을 바꾸면 환경변수만 고치고 다시 배포.

## 웹앱 연결
`Aigle2/.env` (gitignore)에 배포 주소를 넣고 다시 빌드·배포:
```
VITE_JIRA_RELAY_URL=https://aigle-jira-relay-<계정>.vercel.app
```
주소가 없으면 화면은 종전처럼 시뮬레이션(가짜 키)으로 동작한다.

## 동작 확인
```bash
curl -X POST https://aigle-jira-relay-<계정>.vercel.app/api/incidents -H "Content-Type: application/json" -d "{\"id\":\"INC-TEST\",\"source\":\"환경설정\",\"school\":\"공주 고등학교\",\"teacher\":\"김 b\",\"symptom\":\"연동 테스트\"}"
```
→ `{ "key": "AGI-123", "url": "https://neolab-convergence.atlassian.net/browse/AGI-123" }`

## 엔드포인트 (모두 `/api` 아래)
| | 역할 |
|---|---|
| `POST /api/incidents` | 이슈 생성 (label `aigle-incident`, 담당자 = lib/jira.js JIRA_ASSIGNEE 기본값) |
| `GET /api/incidents` | 이 앱이 만든 이슈 목록 |
| `GET /api/incidents/:key` | 이슈 + 댓글 |
| `POST /api/incidents/:key/comments` `{text}` | 댓글 추가 (운영팀 메일 발송 기록) |
| `POST /api/incidents/:key/transitions` `{name}` | 상태 전환 (워크플로우 상태 이름) |

허용 origin·프로젝트 키·담당자 등 기본값은 `lib/jira.js`. 바꾸려면 같은 이름의 환경변수로 덮는다.
