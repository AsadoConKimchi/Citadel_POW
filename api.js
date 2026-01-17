/**
 * Citadel POW Backend API 통신 유틸리티
 * ES6 Module
 */

// 백엔드 API URL (환경 변수 또는 기본값)
const API_BASE_URL = window.BACKEND_API_URL || 'https://citadel-pow-backend.magadenuevo2025.workers.dev';

/**
 * API 재시도 설정
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1초
  maxDelayMs: 10000, // 10초
};

/**
 * 지수 백오프 딜레이 계산
 */
function getRetryDelay(attempt) {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

/**
 * 재시도 가능한 에러인지 확인
 * - 5xx 서버 에러: 재시도
 * - 네트워크 에러 (fetch 실패): 재시도
 * - 4xx 클라이언트 에러: 재시도 안함 (즉시 실패)
 */
function isRetryableError(error, response) {
  // 네트워크 에러 (fetch 자체가 실패)
  if (!response) {
    return true;
  }
  // 5xx 서버 에러
  if (response.status >= 500) {
    return true;
  }
  // 4xx 클라이언트 에러는 재시도 안함
  return false;
}

/**
 * API 요청 헬퍼 함수 (재시도 로직 포함)
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  let lastError = null;
  let lastResponse = null;

  for (let attempt = 0; attempt < RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await fetch(url, mergedOptions);
      lastResponse = response;
      const data = await response.json();

      if (!response.ok) {
        const error = new Error(data.error || `API 요청 실패: ${response.status}`);
        error.status = response.status;
        error.data = data;

        // 4xx 에러는 즉시 실패 (재시도 안함)
        if (response.status >= 400 && response.status < 500) {
          throw error;
        }

        lastError = error;
        // 5xx 에러는 재시도
        if (attempt < RETRY_CONFIG.maxRetries - 1) {
          const delay = getRetryDelay(attempt);
          console.log(`⏳ API 재시도 ${attempt + 1}/${RETRY_CONFIG.maxRetries} (${delay}ms 후)...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }

      return data;
    } catch (error) {
      lastError = error;

      // 네트워크 에러 또는 JSON 파싱 에러
      if (isRetryableError(error, lastResponse) && attempt < RETRY_CONFIG.maxRetries - 1) {
        const delay = getRetryDelay(attempt);
        console.log(`⏳ API 재시도 ${attempt + 1}/${RETRY_CONFIG.maxRetries} (${delay}ms 후)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      console.error('API 요청 오류:', error);
      throw error;
    }
  }

  // 모든 재시도 실패
  console.error('API 요청 최종 실패 (재시도 소진):', lastError);
  throw lastError;
}

/**
 * 사용자 API
 */
export const UserAPI = {
  // 사용자 생성/업데이트
  async upsert(discordId, username, avatar) {
    return apiRequest('/api/users', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        discord_username: username,
        discord_avatar: avatar,
      }),
    });
  },

  // 사용자 정보 조회
  async get(discordId) {
    return apiRequest(`/api/users/${discordId}`);
  },

  // 사용자 통계 조회
  async getStats(discordId) {
    return apiRequest(`/api/users/${discordId}/stats`);
  },

  // 사용자 설정 업데이트
  async updateSettings(discordId, settings) {
    return apiRequest(`/api/users/${discordId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
  },
};

/**
 * Algorithm v3 + Option A: POW 세션 API
 * - session_id: 프론트엔드에서 생성한 UUID를 DB id로 사용 (Option A)
 * - achievement_rate: 프론트엔드에서 계산하여 전송 (소수점 1자리)
 * - donation_id: 저장 안함 (donations.session_id로 단방향 참조)
 * - goal_minutes: 분 단위 (백엔드 스키마 일치)
 * - pow_fields: POW 분야 (pow-writing, pow-music 등)
 * - pow_plan_text: 오늘의 목표
 */
export const StudySessionAPI = {
  // POW 세션 생성
  async create(discordId, sessionData) {
    // 달성률 계산 (소수점 1자리)
    const goalSeconds = sessionData.goalSeconds || (sessionData.goalMinutes ? sessionData.goalMinutes * 60 : 0);
    const durationSeconds = sessionData.durationSeconds || 0;
    const achievementRate = goalSeconds > 0
      ? Math.round((durationSeconds / goalSeconds) * 1000) / 10  // 소수점 1자리
      : 0;

    const payload = {
      discord_id: discordId,

      // Option A: 프론트엔드에서 생성한 UUID를 DB id로 사용
      session_id: sessionData.sessionId || null,

      // POW 정보
      pow_fields: sessionData.powFields || 'pow-writing',
      pow_plan_text: sessionData.powPlanText || '',

      // 시간 정보 (초 단위 기준)
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      duration_seconds: durationSeconds,
      duration_minutes: Math.round(durationSeconds / 60),
      goal_minutes: sessionData.goalMinutes || 0,
      achievement_rate: achievementRate,

      // 인증카드
      photo_url: sessionData.photoUrl || null,
    };

    console.log('📤 POW 세션 페이로드:', payload);

    return apiRequest('/api/pow-sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 여러 세션 일괄 생성
  async createBulk(discordId, sessions) {
    return apiRequest('/api/pow-sessions/bulk', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        sessions: sessions.map(s => {
          const session = {
            start_time: s.startTime,
            end_time: s.endTime,
            duration_minutes: s.durationMinutes,
          };

          // optional 필드는 값이 있을 때만 포함
          if (s.powPlanText) {
            session.pow_plan_text = s.powPlanText;
          }
          if (s.powFields) {
            session.pow_fields = s.powFields;
          }
          if (s.photoUrl) {
            session.photo_url = s.photoUrl;
          }

          return session;
        }),
      }),
    });
  },

  // 사용자의 POW 세션 조회
  async getByUser(discordId, limit = 50) {
    return apiRequest(`/api/pow-sessions/user/${discordId}?limit=${limit}`);
  },

  // 오늘의 POW 세션 조회
  async getToday(discordId) {
    return apiRequest(`/api/pow-sessions/today/${discordId}`);
  },

  // 사용자 POW 통계 조회
  async getStats(discordId) {
    return apiRequest(`/api/pow-sessions/stats/${discordId}`);
  },

  // POW 세션 상태 업데이트 (Algorithm v3)
  // 상태 전이: pending → shared → completed | failed
  async updateStatus(sessionId, status) {
    return apiRequest(`/api/pow-sessions/${sessionId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // POW 세션 삭제 (롤백용)
  async delete(sessionId) {
    return apiRequest(`/api/pow-sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * 기부 API
 * - pow_fields: POW 분야 (pow-writing, pow-music 등)
 * - donation_mode: 기부 범위 ('session' | 'total')
 * - pow_plan_text: 오늘의 목표
 */
export const DonationAPI = {
  // 기부 생성 (확장된 필드 포함)
  async create(discordId, donationData) {
    const payload = {
      discord_id: discordId,

      // 기부 정보
      amount: donationData.amount,
      currency: donationData.currency || 'SAT',
      pow_fields: donationData.powFields || 'pow-writing',
      donation_mode: donationData.donationMode || 'session',
      note: donationData.note || null,

      // POW 정보 (기부 시점 스냅샷)
      pow_plan_text: donationData.powPlanText || null,
      duration_minutes: donationData.durationMinutes || null,
      duration_seconds: donationData.durationSeconds || null,
      goal_minutes: donationData.goalMinutes || null,
      achievement_rate: donationData.achievementRate || null,
      photo_url: donationData.photoUrl || null,

      // 누적 정보 (기부 시점 스냅샷)
      accumulated_sats: donationData.accumulatedSats || null,
      total_accumulated_sats: donationData.totalAccumulatedSats || null,
      total_donated_sats: donationData.totalDonatedSats || null,

      // 결제 정보
      transaction_id: donationData.transactionId || null,
      status: donationData.status || 'pending',
      date: donationData.date || new Date().toISOString().split('T')[0],
      session_id: donationData.sessionId || null,

      // Deprecated
      message: donationData.message || null,
    };

    return apiRequest('/api/donations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 사용자의 기부 내역 조회
  async getByUser(discordId) {
    return apiRequest(`/api/donations/user/${discordId}`);
  },

  // 최근 기부 내역 조회
  async getRecent(limit = 20) {
    return apiRequest(`/api/donations/recent?limit=${limit}`);
  },

  // 기부 통계 조회
  async getStats() {
    return apiRequest('/api/donations/stats');
  },

  // 최고 기부자 조회
  async getTopDonors(limit = 50) {
    return apiRequest(`/api/donations/top?limit=${limit}`);
  },

  // 기부 상태 업데이트 (paid → completed)
  async updateStatus(donationId, status, discordShared = true) {
    return apiRequest(`/api/donations/${donationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({
        status,
        discord_shared: discordShared,
      }),
    });
  },
};

/**
 * 순위 API
 */
export const RankingAPI = {
  // 현재 주차 순위 조회
  async getCurrent() {
    return apiRequest('/api/rankings/current');
  },

  // 순위표 조회
  async get(week, year, limit = 100) {
    let query = `?limit=${limit}`;
    if (week) query += `&week=${week}`;
    if (year) query += `&year=${year}`;
    return apiRequest(`/api/rankings${query}`);
  },

  // 사용자 순위 이력 조회
  async getByUser(discordId) {
    return apiRequest(`/api/rankings/user/${discordId}`);
  },
};

/**
 * localStorage 데이터를 백엔드로 마이그레이션
 */
export async function migrateLocalStorageToBackend(discordId) {
  if (!discordId) {
    console.error('Discord ID가 필요합니다.');
    return;
  }

  const migrationKey = `migrated_to_backend_${discordId}`;
  if (localStorage.getItem(migrationKey)) {
    console.log('이미 마이그레이션이 완료되었습니다.');
    return;
  }

  try {
    // localStorage에서 공부 세션 데이터 수집
    const sessions = [];
    const keys = Object.keys(localStorage);

    for (const key of keys) {
      if (key.startsWith('citadel-sessions-')) {
        try {
          const sessionsData = JSON.parse(localStorage.getItem(key));
          if (Array.isArray(sessionsData)) {
            sessions.push(...sessionsData.map(s => ({
              startTime: s.startTime,
              endTime: s.endTime,
              durationMinutes: Math.round(s.elapsed / 60),
              planText: localStorage.getItem(key.replace('sessions', 'plan')),
              photoUrl: s.imageUrl,
            })));
          }
        } catch (e) {
          console.error('세션 파싱 오류:', key, e);
        }
      }
    }

    if (sessions.length > 0) {
      console.log(`${sessions.length}개의 세션을 백엔드로 마이그레이션 중...`);
      await StudySessionAPI.createBulk(discordId, sessions);
      console.log('마이그레이션 완료!');
    }

    // 마이그레이션 완료 표시
    localStorage.setItem(migrationKey, new Date().toISOString());
  } catch (error) {
    console.error('마이그레이션 오류:', error);
    throw error;
  }
}

/**
 * Meet-up API
 */
export const MeetupAPI = {
  // Meet-up 생성 (Organizer only)
  async create(discordId, meetupData) {
    return apiRequest('/api/meetups', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        ...meetupData,
      }),
    });
  },

  // Meet-up 목록 조회
  async list(status = 'all', limit = 20) {
    const params = new URLSearchParams({ status, limit: limit.toString() });
    return apiRequest(`/api/meetups?${params}`);
  },

  // Meet-up 상세 조회
  async get(meetupId) {
    return apiRequest(`/api/meetups/${meetupId}`);
  },

  // Meet-up 참여
  async join(meetupId, discordId, pledgedAmount) {
    return apiRequest(`/api/meetups/${meetupId}/join`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        pledged_amount: pledgedAmount,
      }),
    });
  },

  // Meet-up 참여 취소
  async leave(meetupId, discordId) {
    return apiRequest(`/api/meetups/${meetupId}/leave`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
      }),
    });
  },

  // QR 코드 생성 (Organizer only)
  async generateQR(meetupId, discordId) {
    return apiRequest(`/api/meetups/${meetupId}/generate-qr`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
      }),
    });
  },

  // QR 출석 체크
  async checkIn(meetupId, discordId, qrData) {
    return apiRequest(`/api/meetups/${meetupId}/check-in`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        qr_data: qrData,
      }),
    });
  },

  // Meet-up 상태 변경 (Organizer only)
  async updateStatus(meetupId, discordId, status) {
    return apiRequest(`/api/meetups/${meetupId}/update-status`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        status,
      }),
    });
  },

  // Meet-up 취소 (Organizer only)
  async cancel(meetupId, discordId) {
    return apiRequest(`/api/meetups/${meetupId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
      }),
    });
  },

  // 미완료 기부 조회
  async getPendingDonations(discordId) {
    const params = new URLSearchParams({ discord_id: discordId });
    return apiRequest(`/api/meetups/my-pending-donations?${params}`);
  },

  // 기부 완료
  async completeDonation(meetupId, discordId, amount) {
    return apiRequest(`/api/meetups/${meetupId}/complete-donation`, {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        amount,
      }),
    });
  },
};

/**
 * Discord Posts API (Algorithm v3)
 * - status: 'pending' | 'completed' | 'failed'
 */
export const DiscordPostsAPI = {
  // Discord에 공유 (인증카드 전송)
  async share(discordId, shareData) {
    return apiRequest('/api/discord-posts/share', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        session_id: shareData.sessionId || null,
        photo_url: shareData.photoUrl,
        pow_plan_text: shareData.powPlanText || '',
        pow_fields: shareData.powFields || 'pow-writing',
        duration_seconds: shareData.durationSeconds || 0,
        donation_mode: shareData.donationMode || 'session',
        donation_sats: shareData.donationSats || 0,
        total_donated_sats: shareData.totalDonatedSats || 0,
        total_accumulated_sats: shareData.totalAccumulatedSats || 0,
        donation_note: shareData.donationNote || '',
        video_url: shareData.videoUrl || null,
        video_filename: shareData.videoFilename || null,
      }),
    });
  },

  // Discord post 상태 업데이트
  async updateStatus(messageId, status) {
    return apiRequest(`/api/discord-posts/${messageId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Discord post 삭제
  async delete(messageId) {
    return apiRequest(`/api/discord-posts/${messageId}`, {
      method: 'DELETE',
    });
  },
};

/**
 * 적립액 API (하이브리드 시스템)
 */
export const AccumulatedSatsAPI = {
  // 현재 적립액 조회
  async get(discordId) {
    return apiRequest(`/api/accumulated-sats/user/${discordId}`);
  },

  // 적립액 추가 (디스코드 공유 성공 시)
  async add(discordId, amount, sessionId = null, note = null) {
    return apiRequest('/api/accumulated-sats/add', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        amount,
        session_id: sessionId,
        note,
      }),
    });
  },

  // 적립액 차감 (기부 완료 시)
  async deduct(discordId, amount, donationId = null, note = null) {
    return apiRequest('/api/accumulated-sats/deduct', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        amount,
        donation_id: donationId,
        note,
      }),
    });
  },

  // 이력 조회
  async getLogs(discordId, limit = 50, offset = 0) {
    const params = new URLSearchParams({ limit: limit.toString(), offset: offset.toString() });
    return apiRequest(`/api/accumulated-sats/logs/${discordId}?${params}`);
  },

  // 데이터 무결성 검증 (관리자용)
  async validate() {
    return apiRequest('/api/accumulated-sats/validate');
  },
};

// 하위 호환성: 비-모듈 스크립트를 위한 window 연결
// (study-history.html, my-pow-records.html, group-meetups.html 등에서 사용)
if (typeof window !== 'undefined') {
  window.UserAPI = UserAPI;
  window.StudySessionAPI = StudySessionAPI;
  window.DonationAPI = DonationAPI;
  window.RankingAPI = RankingAPI;
  window.MeetupAPI = MeetupAPI;
  window.AccumulatedSatsAPI = AccumulatedSatsAPI;
  window.DiscordPostsAPI = DiscordPostsAPI;
  window.migrateLocalStorageToBackend = migrateLocalStorageToBackend;
}
