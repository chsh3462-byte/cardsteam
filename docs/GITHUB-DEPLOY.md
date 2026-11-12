# NAL-MUK-CARD 온라인 배포

현재 게임: https://hex-havoc-dice-dungeon.chsh3462.chatgpt.site
소스: https://github.com/chsh3462-byte/cardsteam

현재 게임 링크에서는 **회원가입 → 게임 이메일로 로그인 → 호스팅 시작 → 주소 공유**만 하면 됩니다. Cloudflare를 별도로 설정할 필요는 없습니다.

자신의 Cloudflare 계정에 독립 서버를 만들 때만 아래 절차를 사용합니다. GitHub Pages는 서버를 실행할 수 없으므로 GitHub Actions가 Worker와 R2에 연결된 전체 게임을 배포합니다.

1. Cloudflare에서 R2 버킷을 만듭니다(예: `cardsteam-data`). 공개 버킷 설정은 필요하지 않습니다.
2. GitHub 저장소 Settings → Environments에 `production`을 만듭니다.
3. 해당 환경 Secrets에 `CLOUDFLARE_API_TOKEN`(해당 계정의 Worker 배포와 R2 접근 권한), `CLOUDFLARE_ACCOUNT_ID`를 등록합니다. 비밀값은 코드나 채팅에 넣지 않습니다.
4. 해당 환경 Variables에 `R2_BUCKET_NAME`을 등록합니다.
5. Actions → **Deploy online duel** → Run workflow를 실행합니다. 빌드와 테스트를 통과하면 실제 서버 주소가 로그에 표시됩니다.
6. 각자 `아이디@NALMUK.COM` 계정을 만들고 로그인합니다. 호스트가 방 주소를 보내면 친구가 입장할 수 있습니다.

새 배포는 게임 자체 회원가입을 사용하므로 `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` 설정이 필요하지 않습니다. 예전에 Cloudflare Access 보호를 직접 적용했다면 해당 정책은 Cloudflare에서 별도로 관리해야 합니다.

## 저장과 로그인

`AUTH_MODE=game`을 자동 설정합니다. 사용자 신원은 암호학적으로 무작위인 서버 세션으로 확인하며, 브라우저가 임의로 보낸 사용자 ID나 플랫폼 헤더로 로그인할 수 없습니다. 가상 이메일은 실제 메일 주소가 아니므로 비밀번호 복구에는 가입 시 발급한 복구 코드를 사용합니다.

계정과 카드/팩/포인트/덱/이름은 R2에 저장됩니다. 신규 Cloudflare 배포는 현재 Sites와 별도 저장소이므로 수집함이나 게임 계정이 자동 복제되지 않습니다. 코드 업데이트 시 버킷과 저장된 데이터를 유지하세요. 대전 방 유효 기간은 24시간, 로그인 세션은 30일입니다.

일반 push/PR은 자동 검사만 실행합니다. 실제 배포 워크플로는 직접 실행합니다. Node.js 22 이상에서 `npm run build` 및 `npm test`로 로컬 검사가 가능합니다.
