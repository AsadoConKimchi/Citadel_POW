# Render 환경변수 정리 가이드

## 🎯 목적
Cloudflare Workers로 마이그레이션 완료 후, Render 서버에서 더 이상 필요없는 환경변수를 삭제합니다.

## ❌ Render Dashboard에서 삭제할 환경변수

Render Dashboard (https://dashboard.render.com) → 서비스 선택 → Environment 탭에서 아래 환경변수들을 삭제하세요:

### 1. DISCORD_WEBHOOK_URL
- **이유**: Discord 알림 기능이 Cloudflare Workers로 이동
- **위치**: Cloudflare Workers 환경변수 (Secret)

### 2. BLINK_API_ENDPOINT
- **이유**: Lightning Invoice 생성이 Cloudflare Workers로 이동
- **위치**: Cloudflare Workers 환경변수 (Text)

### 3. BLINK_API_KEY
- **이유**: Lightning Invoice 생성이 Cloudflare Workers로 이동
- **위치**: Cloudflare Workers 환경변수 (Secret)

### 4. BLINK_LIGHTNING_ADDRESS
- **이유**: Lightning 주소 설정이 Cloudflare Workers로 이동
- **위치**: Cloudflare Workers 환경변수 (Text)

### 5. DONATION_WEBHOOK_URL (있다면)
- **이유**: 사용하지 않는 환경변수

## ✅ Render에서 유지할 환경변수

아래 환경변수들은 **삭제하지 마세요** (Discord OAuth에 필요):

- `DISCORD_CLIENT_ID` ✓
- `DISCORD_CLIENT_SECRET` ✓
- `DISCORD_REDIRECT_URI` ✓
- `DISCORD_GUILD_ID` ✓
- `DISCORD_ROLE_ID` ✓
- `SESSION_SECRET` ✓
- `PORT` ✓

## 📝 삭제 절차

1. **Render Dashboard 접속**
   ```
   https://dashboard.render.com
   ```

2. **서비스 선택**
   - Web Services → citadel-pow (또는 서비스 이름)

3. **Environment 탭 클릭**

4. **환경변수 삭제**
   - 위에 나열된 5개 환경변수 옆의 삭제 버튼 클릭
   - `DISCORD_WEBHOOK_URL`
   - `BLINK_API_ENDPOINT`
   - `BLINK_API_KEY`
   - `BLINK_LIGHTNING_ADDRESS`
   - `DONATION_WEBHOOK_URL`

5. **저장**
   - "Save Changes" 버튼 클릭
   - 서비스가 자동으로 재시작됩니다

## ⚠️ 주의사항

- **삭제 전 백업**: 혹시 모르니 환경변수 값을 메모장에 백업해두세요
- **자동 재시작**: 환경변수 변경 시 서비스가 자동으로 재시작됩니다
- **OAuth는 유지**: Discord OAuth 관련 환경변수는 절대 삭제하지 마세요

## ✅ 삭제 후 확인

환경변수 삭제 후 아래 기능이 정상 작동하는지 확인:

1. **Discord 로그인** - OAuth는 Render에서 처리
2. **일반 기부** - Lightning Invoice는 Cloudflare Workers에서 처리
3. **Meet-up 기부** - Discord 알림은 Cloudflare Workers에서 처리

모든 기능이 정상 작동하면 마이그레이션 완료! 🎉

## 🔍 트러블슈팅

### Q: 환경변수 삭제 후 에러가 발생하면?
A: Render 서버가 재시작되는 동안 일시적으로 에러가 발생할 수 있습니다. 1-2분 기다린 후 다시 시도하세요.

### Q: Discord 로그인이 안 되면?
A: Discord OAuth 관련 환경변수를 실수로 삭제했을 수 있습니다. 복구하세요:
- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`
- `DISCORD_GUILD_ID`
- `DISCORD_ROLE_ID`

### Q: Lightning 결제가 안 되면?
A: Cloudflare Workers 환경변수를 확인하세요:
- `BLINK_API_ENDPOINT`
- `BLINK_API_KEY`
- `BLINK_LIGHTNING_ADDRESS`
