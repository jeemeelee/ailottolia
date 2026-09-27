# AILOTTOLIA

Responsive lotto number generator.

- 5 games
- 6 unique numbers per game
- Numbers 1–45
- No AI API required for the initial version

## 관리자 기능

기존 `index.html`의 UI와 무작위 5게임 생성 로직은 유지합니다. 공개 페이지 변경은
통계용 `telemetry.js` 로드 한 줄뿐이며, 관리자 링크는 추가하지 않습니다.

- `/admin`: 서버가 로그인 여부를 확인한 후 로그인 화면 또는 대시보드를 반환합니다.
- `/api/admin`: 로그인, 로그아웃, 통계 조회, 주간 프롬프트 저장. 모든 관리 데이터는 서버에서 인증합니다.
- `/api/events`: 방문/생성 이벤트 전용 공개 수집 API. 관리 데이터 조회 기능은 없습니다.
- `lib/`: 인증, Redis 접근, 서버에서만 제공되는 관리자 화면.
- `scripts/build.mjs`: `public/`에 `index.html`, `telemetry.js`만 복사합니다.

### Vercel 설정

기존 GitHub 저장소와 Vercel 프로젝트 연결을 그대로 사용합니다. Next.js 전환이나
외부 npm 의존성은 없습니다. Vercel의 정적 배포에 Node.js `/api` Functions를 추가합니다.
`cleanUrls`는 유지하고 `/admin`만 관리 함수로 rewrite합니다.

1. Vercel 프로젝트에 Upstash Redis를 연결합니다. REST API를 지원하는 영구 저장소가 필요합니다.
2. 아래 환경 변수를 서버 환경에 설정합니다. 비밀 값은 GitHub/HTML에 넣지 마세요.
3. Framework Preset은 **Other**, Node.js는 **22.x**를 사용합니다.
   저장소의 `vercel.json`이 build command `npm run build`, output directory `public`을 지정합니다.
   대시보드의 충돌하는 수동 override는 해제합니다.
4. Preview에서 검증한 뒤 병합합니다. Preview에는 별도 저장소와 비밀 값을 사용하고
   `ADMIN_ORIGIN`을 해당 Preview의 정확한 HTTPS origin으로 지정합니다.
5. 배포 후 `/admin`에 직접 접속해 로그인하고, 공개 페이지 방문/번호 생성 후 통계를 새로고침합니다.

| 변수 | 값 |
|---|---|
| `ADMIN_PASSWORD` | 무작위 관리자 비밀번호, 최소 16자 |
| `ADMIN_SESSION_SECRET` | 독립적인 무작위 비밀 값, 최소 32자 |
| `ADMIN_ORIGIN` | 사이트의 정확한 origin, 예: `https://ailottolia.vercel.app` (끝 `/` 없음) |
| `UPSTASH_REDIS_REST_URL` | Redis HTTPS REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Redis 쓰기 권한 REST 토큰 |

환경 변수 누락 시 관리자/수집 API는 503으로 닫히고, 기존 번호 생성은 계속 작동합니다.
설정 변경 후 재배포가 필요합니다. 여러 도메인이 있으면 통계 수집은 `ADMIN_ORIGIN` 도메인에서만
허용됩니다. 사용 도메인을 하나로 정하고 나머지를 해당 도메인으로 리디렉션하세요.

### 인증과 보관

관리자 비밀번호는 서버에서 고정 길이 해시로 비교합니다. 세션은 256비트 무작위 값이고
Redis에는 세션의 HMAC만 8시간 저장합니다. 쿠키는 `__Host-`, Secure, HttpOnly,
SameSite=Strict입니다. 로그아웃 시 Redis 세션도 삭제합니다. 비밀번호/세션 비밀 변경은
기존 세션을 무효화합니다. 로그인은 IP별 15분당 5회 제한하며 Redis 장애 시 차단합니다.
변경 요청에는 정확한 Origin과 JSON 콘텐츠 형식을 요구합니다. 관리자 응답은 no-store,
noindex이고 HTML에는 nonce 기반 CSP가 적용됩니다. 숨긴 URL 자체를 보안 수단으로 사용하지 않습니다.

방문자는 localStorage 브라우저 식별자 기반의 **UTC 일일 고유 브라우저 수**입니다.
브라우저 저장소가 차단되면 새 방문으로 집계될 수 있습니다. 페이지 조회는 로드 횟수,
번호 생성은 버튼 클릭 횟수(1회=5게임)입니다. 요청 재전송은 이벤트 ID로 중복 제거합니다.
국가·지역은 Vercel 헤더의 코드를 사용하고 알 수 없는 값은 `Unknown`으로 표시합니다.
지역별 최근 7일 값은 일일 방문자의 합계이며 7일 고유 인원이 아닙니다.
원본 IP/전체 브라우저 ID는 저장하지 않습니다. 중복 제거 키는 2일, 일별 집계는 90일 보관합니다.
관리자 화면에는 최근 7일만 표시합니다. `VERCEL_ENV`별 키 접두사로 데이터를 분리합니다.
클라이언트 통계이므로 봇·차단·위조 요청에 따른 오차가 있으며 과금/감사 지표로 사용하지 않습니다.
기존 방문 기록은 소급 복원하지 않습니다.

주간 프롬프트는 서버 저장소에 최신 내용과 저장 시간을 보관합니다. 공개 API로 제공하지 않으며
현재 번호 생성 알고리즘에 적용하지 않습니다. AI 기능 추가 시 서버에서 이 값을 읽어 사용하세요.
현재 버전은 단일 관리자/최신 설정 관리이며 주간 예약, 버전 이력, 동시 편집 충돌 감지는 없습니다.

### 검증

`npm test`로 인증 우회, 세션 만료/로그아웃, CSRF, 저장소 장애, 이벤트 유효성,
프롬프트 저장을 검사합니다. `npm run build`로 공개 산출물을 생성합니다.
운영 연결 전에는 Preview에서 실제 Redis 및 Vercel 지리 헤더를 별도로 검증해야 합니다.

참고: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js),
[Vercel 요청 헤더](https://vercel.com/docs/headers/request-headers),
[Upstash REST API](https://upstash.com/docs/redis/features/restapi).

### Vercel Analytics (선택)

관리자 화면에는 자체 통계와 별도로 Vercel의 최근 7일 방문자/페이지 조회를 표시할 수 있습니다.
공식 Web Analytics API를 서버에서 조회하며, API 토큰은 브라우저로 전달하지 않습니다.
연결하지 않아도 기존 자체 통계와 프롬프트 저장은 사용할 수 있습니다.

1. Vercel의 프로젝트 Analytics에서 Enable을 선택합니다.
2. Analytics의 HTML 설치 안내에서 실제 스크립트 경로를 복사해 `VERCEL_ANALYTICS_SCRIPT_PATH`에 설정합니다.
   예: `/_vercel/insights/script.js` 또는 프로젝트에 표시되는 고유 경로. 전체 URL이나 `<script>` 태그가 아니라 `/`로 시작하는 경로만 입력합니다.
   빌드 시 공개 페이지에 추적 스크립트가 추가되며 관리자 화면에는 추가되지 않습니다.
3. `VERCEL_ANALYTICS_TOKEN`에 해당 프로젝트 조회 권한이 있는 Vercel 액세스 토큰,
   `VERCEL_ANALYTICS_PROJECT_ID`에 프로젝트 ID를 설정합니다.
   팀 소유 프로젝트라면 `VERCEL_ANALYTICS_TEAM_ID`도 설정합니다.
4. 재배포 후 공개 첫 페이지(`/`)에 방문하고 관리자 화면의 통계를 새로고침합니다.

API는 최근 7일의 `/` 방문을 날짜별로 조회합니다. 숫자는 Vercel에서 반환한 값을 그대로 표시하며,
자체 집계와 합산하지 않습니다. 데이터 없음, 연결 전, 조회 실패를 구분합니다.
플랜의 조회 가능 기간/권한 및 데이터 반영 지연에 따라 결과가 달라질 수 있습니다.
Preview 검증에서는 Vercel 프로젝트의 실제 조회 데이터가 나타날 수 있으므로 자체 Preview 집계와 구분하세요.
추적 경로만 공개 빌드에 포함되며 토큰·프로젝트 조회 설정은 서버에만 남습니다.

공식 문서: [HTML 설치](https://vercel.com/docs/analytics/quickstart),
[Web Analytics 조회 API](https://vercel.com/docs/analytics/web-analytics-api).

### 이번 보완의 검증 범위

- 인증 및 저장소 모의 응답 기반 9개 자동 검사: 인증 없는 Analytics 접근 차단,
  Vercel 응답 처리/실패 상태, 기존 로그인·로그아웃·프롬프트 저장 및 번호 생성 포함.
- 로컬 브라우저에서 모의 API로 로그인, 저장, 페이지 재조회 후 내용 유지, 로그아웃을 확인합니다.
- 이 검사는 운영 비밀번호, 실제 Redis, 실제 Vercel Analytics 권한 연결 검증을 대신하지 않습니다.
- 프롬프트 최초 조회 실패 시 저장 버튼을 비활성화하고, 통계 새로고침으로 재조회할 수 있습니다.
