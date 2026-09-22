# aigle-jira-relay — 장애신고 → Jira 중계 (Cloudflare Worker)

브라우저에서 Jira REST API를 직접 부를 수 없어(CORS · 토큰 노출) 이 Worker가 대신 호출한다. DB 없음 — Jira(AGI)가 저장소.

## 1회 설정 (약 5분)
```bash
cd jira-relay
npm install
npx wrangler login                 # 브라우저에서 Cloudflare 계정 로그인 (무료)
npx wrangler secret put JIRA_EMAIL       # Atlassian 로그인 이메일 입력
npx wrangler secret put JIRA_API_TOKEN   # https://id.atlassian.com/manage-profile/security/api-tokens 에서 만든 토큰 붙여넣기
npx wrangler deploy                # → https://aigle-jira-relay.<계정>.workers.dev
```
토큰은 **Cloudflare Worker secret**에만 저장된다. 이 리포·`.env`·화면 코드 어디에도 두지 않는다. 토큰을 바꾸면 `secret put`만 다시 하면 된다.

## 웹앱 연결
`.env` (gitignore)에 배포된 Worker 주소를 넣고 다시 빌드·배포:
```
VITE_JIRA_RELAY_URL=https://aigle-jira-relay.<계정>.workers.dev
```
주소가 없으면 화면은 종전처럼 시뮬레이션(가짜 키)으로 동작한다.

## 동작 확인
```bash
curl -X POST https://aigle-jira-relay.<계정>.workers.dev/incidents -H "Content-Type: application/json" \
  -d '{"id":"INC-TEST","source":"환경설정","school":"공주 고등학교","teacher":"김 b","symptom":"연동 테스트"}'
```
→ `{ "key": "AGI-123", "url": "https://neolab-convergence.atlassian.net/browse/AGI-123" }`

## 엔드포인트
| | 역할 |
|---|---|
| `POST /incidents` | 이슈 생성 (label `aigle-incident`, 담당자 = wrangler.toml의 JIRA_ASSIGNEE) |
| `GET /incidents` | 이 Worker가 만든 이슈 목록 |
| `GET /incidents/:key` | 이슈 + 댓글 |
| `POST /incidents/:key/comments` `{text}` | 댓글 추가 (운영팀 메일 발송 기록) |
| `POST /incidents/:key/transitions` `{name}` | 상태 전환 (워크플로우 상태 이름) |

허용 origin은 `wrangler.toml`의 `ALLOWED_ORIGINS`.
