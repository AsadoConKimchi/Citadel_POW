# Algorithm v3 구현 요약

**날짜**: 2026-01-15
**작업자**: Claude Opus 4.5 + 사용자

---

## 1. 구현 목표

기부 상태 관리 및 총 기부액 계산 시스템 개선:
- 기부 상태 2단계 분리: `paid` → `completed`
- 백엔드 `user_total_donated` 테이블 활용
- 프론트엔드 localStorage 의존도 감소

---

## 2. 3단계 기부 흐름

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Algorithm v3: 기부 → 총 기부액 흐름                       │
└─────────────────────────────────────────────────────────────────────────────┘

[사용자: 결제 완료]
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1단계: saveDonationHistoryEntry()                                           │
│ • DonationAPI.create({ status: 'paid' })                                   │
│ • 반환: donation_id                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2단계: shareToDiscordAPI()                                                  │
│ • Discord 채널에 인증카드 공유                                              │
│ • 실패 시 → status='paid' 유지                                              │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3단계: DonationAPI.updateStatus(donation_id, 'completed')                   │
│ • PATCH /api/donations/{id}/status                                          │
│ • Supabase 트리거 → user_total_donated 테이블 업데이트                      │
└─────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4단계: loadTotalDonatedFromAPI()                                            │
│ • GET /api/users/{discordId}/stats                                          │
│ • total_donated_sats 반환 (user_total_donated 테이블에서 조회)              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. 변경된 파일

### 백엔드 (Citadel_POW_BackEND)

| 파일 | 변경 내용 |
|------|----------|
| `src/routes/users.ts` | user_total_donated 테이블 조회, total_donated_sats 키 반환 |

### 프론트엔드 (Citadel_POW)

| 파일 | 변경 내용 |
|------|----------|
| `api.js` | DonationAPI.updateStatus() 메서드 추가 |
| `js/storage.js` | saveDonationHistoryEntry() donation_id 반환, loadTotalDonatedFromAPI(), getTotalDonatedSats() 백엔드 우선 |
| `js/app.js` | onSuccess 3단계 흐름 적용, loadTotalDonatedFromAPI import |
| `app.js` | 레거시 버전 동일 수정 |
| `js/timer.js` | sessionId UUID 형식 변경 (crypto.randomUUID) |

---

## 4. Supabase 트리거 SQL

```sql
-- 트리거 함수: status가 'completed'로 변경될 때 user_total_donated 업데이트
CREATE OR REPLACE FUNCTION update_user_total_donated_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    INSERT INTO user_total_donated (user_id, total_donated, donation_count, last_donated_at)
    VALUES (NEW.user_id, NEW.amount, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      total_donated = user_total_donated.total_donated + NEW.amount,
      donation_count = user_total_donated.donation_count + 1,
      last_donated_at = NOW(),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결
DROP TRIGGER IF EXISTS trigger_update_user_total_donated ON donations;
CREATE TRIGGER trigger_update_user_total_donated
  AFTER UPDATE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_total_donated_on_status_change();
```

---

## 5. 테스트 결과

### API 테스트 (프로덕션)

**Step 1: 기부 생성 (status: 'paid')**
```bash
POST /api/donations
→ donation_id: 0ce50f55-06c6-48e1-8c62-61c607401682
→ status: "paid" ✅
```

**Step 2: 상태 업데이트 (paid → completed)**
```bash
PATCH /api/donations/0ce50f55-06c6-48e1-8c62-61c607401682/status
→ status: "completed" ✅
→ transition: { from: "paid", to: "completed" }
```

**Step 3: Supabase 트리거 확인**
```
user_total_donated 테이블:
- total_donated: 2975 (100 SAT 추가됨)
- donation_count: 20
- last_donated_at: 2026-01-15 14:51:17 ✅
```

**Step 4: 통계 API 확인**
```bash
GET /api/users/1340338561899303005/stats
→ total_donated_sats: 2975 ✅
→ total_donated: 2975 ✅
→ donation_count: 20
```

---

## 6. 배포 정보

| 서비스 | 커밋 | 상태 |
|--------|------|------|
| 백엔드 (Cloudflare) | `24b83e2` | ✅ 배포 완료 |
| 프론트엔드 (Render) | `d1184eb` | ✅ 배포 완료 |

---

## 7. 관련 링크

- 프론트엔드: https://github.com/AsadoConKimchi/Citadel_POW
- 백엔드: https://github.com/AsadoConKimchi/Citadel_POW_BackEND
- 디스코드 봇: https://github.com/AsadoConKimchi/Citadel_POW_Discord_Bot

---

## 8. 참고 사항

- `.dev.vars` 파일은 로컬 개발용 (Git에 커밋하지 않음)
- `anon` 키는 읽기 전용, INSERT는 `service_role` 키 필요
- 프로덕션 Supabase 시크릿은 Cloudflare Workers에 설정됨
