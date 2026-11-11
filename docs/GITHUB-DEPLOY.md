# GitHub로 온라인 2인 대전 배포

GitHub 저장소: https://github.com/chsh3462-byte/cardsteam

현재 실행 주소: https://hex-havoc-dice-dungeon.chsh3462.chatgpt.site

GitHub Pages는 정적 파일만 제공하므로 방 상태, 계정별 수집함, 원자적 포인트 결제를 실행할 수 없습니다. 이 저장소는 **GitHub Actions → Cloudflare Worker + R2**로 게임 화면과 온라인 서버 전체를 같은 주소에 배포합니다. 브라우저의 외부 라이브러리는 필요하지 않습니다.

## 첫 배포 설정

1. Cloudflare 계정에서 R2 버킷을 생성합니다(예: `cardsteam-data`).
2. Zero Trust → Access에서 Self-hosted application을 만들고 배포할 주소 `cardsteam.<계정-subdomain>.workers.dev` 전체 경로를 보호합니다. 이메일 OTP 등 원하는 로그인 방법과 참가자 정책을 설정합니다. Application Audience(AUD)와 팀 도메인을 확인합니다.
3. GitHub 저장소 Settings → Environments에 `production`을 생성합니다.
4. 해당 환경 Secrets에 `CLOUDFLARE_API_TOKEN`(Workers Scripts Edit 및 해당 R2 버킷 접근 배포 권한), `CLOUDFLARE_ACCOUNT_ID`를 설정합니다. 토큰은 코드나 채팅에 넣지 않습니다.
5. 해당 환경 Variables에 `R2_BUCKET_NAME`, `ACCESS_TEAM_DOMAIN`(예: `myteam.cloudflareaccess.com`, https:// 제외), `ACCESS_AUD`를 설정합니다.
6. Actions → **Deploy online duel** → Run workflow. 체크와 테스트가 통과하면 전체 Worker가 배포됩니다. Actions 로그에 표시된 실제 Worker 주소를 사용합니다.
7. 허용된 두 계정으로 로그인하여 한 명이 방을 만들고, 다른 한 명이 8자리 코드를 입력합니다. 동일 계정은 양쪽에 들어갈 수 없습니다.

배포 전 Access를 설정하기 어려우면 먼저 대상 workers.dev 주소를 Cloudflare 계정에서 확인하세요. 서버는 Access 설정/유효한 JWT가 없으면 계정 API를 거절합니다. 사용자가 보낸 Sites 신원 헤더는 독립 Worker 모드에서 무시됩니다. 별도 CORS나 브라우저 비밀키가 필요하지 않습니다.

## 로그인과 데이터

- Sites에서는 플랫폼의 `oai-authenticated-user-id`로 계정을 식별합니다.
- 독립 Cloudflare 배포에서는 Access의 RS256 서명, issuer, audience, 만료를 검증한 `sub`를 사용합니다.
- R2에 계정 해시별 수집함과 대전 상태를 저장합니다. 경기 보상·개봉·구매는 조건부 쓰기로 처리합니다.
- Sites와 별도 Cloudflare 배포는 서로 다른 저장소와 사용자 ID를 사용하므로 수집 데이터가 자동 이전되지는 않습니다.
- 대전은 1.5초 폴링, 비활성 탭은 4.5초 폴링입니다. 방은 생성 후 24시간 유효합니다.
- 페이지 재접속 시 계정 수집함과 최근 개봉 기록은 서버에서 복구됩니다. 좌석 토큰은 현재 탭의 sessionStorage에 저장합니다.
- GitHub 워크플로는 직접 실행할 때만 서비스에 배포합니다. 일반 push/PR은 빌드와 테스트만 실행합니다.

## 개발과 검사

Node.js 22 이상에서 `npm run build`, `npm test`를 실행합니다. 빌드/게임은 npm 의존성이 없습니다. 테스트는 규칙, 모든 카드, 이미지 경로, 추첨 확률, 계정 검증, 중복 지급 방지와 동시 결제를 검사합니다.

로컬 실제 계정 데이터를 테스트한다고 클라이언트 제공 사용자 ID를 신뢰하는 인증 우회 모드를 추가하지 마세요. 테스트 코드는 메모리 버킷과 명시적 테스트 신원을 사용합니다.
