# Citadel Idioma

Discord 로그인, 공부 타이머, 인증 카드, 사토시 기부 흐름을 한 번에 경험할 수 있는 웹앱 프로토타입입니다.

## 실행 방법

Discord Role 검증을 위해 Node 서버를 실행합니다.

```bash
npm install
npm start
```

브라우저에서 `http://localhost:3000`으로 접속합니다. 운영 환경은 `https://idioma.citadel.sx`를 사용합니다.

## 환경 변수 설정

`.env.example`을 복사해 `.env`를 만든 뒤 아래 값을 채워주세요.

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI` (예: `https://idioma.citadel.sx/auth/discord/callback`)
- `DISCORD_GUILD_ID`
- `DISCORD_GUILD_NAME` (예: `citadel.sx`)
- `DISCORD_ROLE_ID`
- `SESSION_SECRET`

## 배포 (Render 기준)

`https://idioma.citadel.sx`로 접속되도록 하려면 **배포 + 커스텀 도메인 연결**이 필요합니다.

1. Render에서 새 Web Service 생성 후 이 저장소를 연결합니다.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Environment Variables에 `.env` 항목들을 입력합니다.
5. Render의 Custom Domains에서 `idioma.citadel.sx`를 추가합니다.
6. DNS 설정에서 `idioma.citadel.sx`에 Render가 제공한 CNAME 레코드를 등록합니다.
7. HTTPS 인증서가 활성화되면 `https://idioma.citadel.sx`로 접속됩니다.

> 참고: 무료 서브도메인(예: `*.onrender.com`)에서도 동작하지만, Discord OAuth Redirect URI는
> 실제 사용 도메인과 일치해야 합니다.

## 배포 (Railway 기준)

Render 대신 Railway로도 바로 배포할 수 있습니다.

1. Railway 로그인 → **New Project** → **Deploy from GitHub repo** 선택
2. `Citadel_idioma` 레포 연결
3. **Variables**에 `.env` 값들을 그대로 등록
4. Deploy 완료 후 생성된 도메인(예: `https://citadel-idioma.up.railway.app`) 확인
5. Discord OAuth Redirect URI에 위 도메인의 콜백 주소 등록  
   예: `https://citadel-idioma.up.railway.app/auth/discord/callback`
6. 커스텀 도메인을 쓸 경우 Railway에서 도메인 추가 후 CNAME 설정

## 주요 기능

- Discord OAuth 로그인 + 지정 Role 보유 여부 확인 (App/Web 로그인)
- 목표 공부시간 설정 + 타이머 + 당일 누적 시간 저장
- 카메라 촬영 또는 사진 업로드 후 공부 인증 카드 생성
- 공부 시간 기반 사토시 기부 계산 및 기록

## 추가로 필요한 것

실제 서비스화를 위해서는 다음이 필요합니다:

- Discord OAuth 서버 구현 및 특정 Role 권한 검증 (완료)
- 저장소/DB 연결 (공부 기록, 사진, 기부 내역)
- Lightning 지갑 또는 LNURL 연동
- 프로덕션 배포 환경 (도메인, HTTPS)

## 브라우저 안내

- Safari에서 카메라 기능을 사용하려면 HTTPS 환경이 필요합니다. `https://idioma.citadel.sx`에서 접속해주세요.
