// Citadel POW Backend API 통신 유틸리티

// 백엔드 API URL (환경 변수 또는 기본값)
const API_BASE_URL = window.BACKEND_API_URL || 'https://citadel-pow-backend.workers.dev';

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
};

/**
 * 공부 세션 API
 */
const StudySessionAPI = {
  // 공부 세션 생성
  async create(discordId, sessionData) {
    const payload = {
      discord_id: discordId,
      start_time: sessionData.startTime,
      end_time: sessionData.endTime,
      duration_minutes: sessionData.durationMinutes,
    };

    // optional 필드는 값이 있을 때만 포함
    if (sessionData.planText) {
      payload.plan_text = sessionData.planText;
    }
    if (sessionData.photoUrl) {
      payload.photo_url = sessionData.photoUrl;
    }

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
  // 기부 생성
  async create(discordId, amount, currency = 'SAT', message = '', transactionId = '') {
    return apiRequest('/api/donations', {
      method: 'POST',
      body: JSON.stringify({
        discord_id: discordId,
        amount,
        currency,
        message,
        transaction_id: transactionId,
      }),
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
