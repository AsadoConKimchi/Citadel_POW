// Citadel POW Backend API 통신 유틸리티

// 백엔드 API URL (환경 변수 또는 기본값)
const API_BASE_URL = window.BACKEND_API_URL || 'https://citadel-pow-backend.magadenuevo2025.workers.dev';

/**
 * API 요청 헬퍼 함수
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

  try {
    const response = await fetch(url, mergedOptions);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `API 요청 실패: ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API 요청 오류:', error);
    throw error;
  }
}

/**
 * 사용자 API
 */
const UserAPI = {
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
 * 공부 세션 API
 */
const StudySessionAPI = {
  // 공부 세션 생성
  async create(discordId, sessionData) {
    const payload = {
      discord_id: discordId,

      // POW 정보
      donation_mode: sessionData.donationMode || 'pow-writing',
      plan_text: sessionData.planText || '',

      // 시간 정보
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      duration_seconds: sessionData.durationSeconds,
      duration_minutes: sessionData.durationMinutes,
      goal_minutes: sessionData.goalMinutes || 0,
      achievement_rate: sessionData.achievementRate || 0,

      // 인증카드
      photo_url: sessionData.photoUrl || null,

      // 기부 연결
      donation_id: sessionData.donationId || null,
    };

    console.log('📤 공부 세션 페이로드:', payload);

    return apiRequest('/api/study-sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // 여러 세션 일괄 생성
  async createBulk(discordId, sessions) {
    return apiRequest('/api/study-sessions/bulk', {
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
          if (s.planText) {
            session.plan_text = s.planText;
          }
          if (s.photoUrl) {
            session.photo_url = s.photoUrl;
          }

          return session;
        }),
      }),
    });
  },

  // 사용자의 공부 세션 조회
  async getByUser(discordId, limit = 50) {
    return apiRequest(`/api/study-sessions/user/${discordId}?limit=${limit}`);
  },

  // 오늘의 공부 세션 조회
  async getToday(discordId) {
    return apiRequest(`/api/study-sessions/today/${discordId}`);
  },

  // 사용자 공부 통계 조회
  async getStats(discordId) {
    return apiRequest(`/api/study-sessions/stats/${discordId}`);
  },
};

/**
 * 기부 API
 */
const DonationAPI = {
  // 기부 생성 (확장된 필드 포함)
  async create(discordId, donationData) {
    const payload = {
      discord_id: discordId,

      // 기부 정보
      amount: donationData.amount,
      currency: donationData.currency || 'SAT',
      donation_mode: donationData.donationMode || 'pow-writing',
      donation_scope: donationData.donationScope || 'session',
      note: donationData.note || null,

      // POW 정보 (기부 시점 스냅샷)
      plan_text: donationData.planText || null,
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
};

/**
 * 순위 API
 */
const RankingAPI = {
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
async function migrateLocalStorageToBackend(discordId) {
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
const MeetupAPI = {
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
 * 적립액 API (하이브리드 시스템)
 */
const AccumulatedSatsAPI = {
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
