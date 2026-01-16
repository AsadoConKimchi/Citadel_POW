/**
 * Citadel POW - 저장소 관리 모듈
 * localStorage, 캐시, 백엔드 API 연동
 */

import { getTodayKey } from './utils.js';
import { StudySessionAPI, DonationAPI, AccumulatedSatsAPI, UserAPI } from '../api.js';

// 캐시 변수
let sessionsCache = null;
let donationsCache = null;
let pendingDailyCache = null;
export let backendAccumulatedSats = 0;
// Algorithm v3: 백엔드 총 기부액 (user_total_donated 테이블에서 로드)
export let backendTotalDonatedSats = null;
export let currentSession = null;

// 현재 로그인한 Discord ID
export let currentDiscordId = null;

// 저장소 키
export const getStorageKeys = () => {
  const todayKey = getTodayKey();
  return {
    planKey: `citadel-plan-${todayKey}`,
    sessionsKey: `citadel-sessions-${todayKey}`,
    donationHistoryKey: 'citadel-donations',
    pendingDailyKey: 'citadel-pending-daily',
    donationScopeKey: 'citadel-donation-scope',
    backendAccumulatedKey: 'citadel-backend-accumulated-sats',
    backendTotalDonatedKey: 'citadel-backend-total-donated-sats',
    timerEndKey: 'citadel-timer-end',
    timerGoalKey: 'citadel-timer-goal',
  };
};

// Discord ID 설정
export const setCurrentDiscordId = (id) => {
  currentDiscordId = id;
};

// 세션 로드 (캐시 우선)
export const loadSessions = (key = null) => {
  const { sessionsKey } = getStorageKeys();
  const targetKey = key || sessionsKey;

  if (!key && sessionsCache !== null) {
    return sessionsCache;
  }

  try {
    const raw = localStorage.getItem(targetKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const result = Array.isArray(parsed) ? parsed : [];
    if (!key) {
      sessionsCache = result;
    }
    return result;
  } catch (error) {
    if (!key) {
      sessionsCache = [];
    }
    return [];
  }
};

// 세션 저장
export const saveSessions = (sessions) => {
  const { sessionsKey } = getStorageKeys();
  localStorage.setItem(sessionsKey, JSON.stringify(sessions));
  sessionsCache = sessions;
};

// ============================================
// Algorithm v3: API에서 세션 로드
// - achievement_rate: 백엔드에서 런타임 계산됨
// - goal_seconds: 초 단위 지원
// ============================================
export const loadSessionsFromAPI = async () => {
  if (!currentDiscordId) {
    return [];
  }

  try {
    const response = await StudySessionAPI.getToday(currentDiscordId);
    if (response.success && response.data) {
      const sessions = response.data.map(apiSession => {
        const durationSeconds = apiSession.duration_seconds || (apiSession.duration_minutes * 60);
        // Algorithm v3: goal_seconds 우선 사용
        const goalSeconds = apiSession.goal_seconds || (apiSession.goal_minutes * 60) || 0;
        // Algorithm v3: achievement_rate는 백엔드에서 런타임 계산됨
        const achievementRate = apiSession.achievement_rate || 0;

        return {
          durationSeconds,
          goalSeconds,
          goalMinutes: apiSession.goal_minutes || Math.round(goalSeconds / 60),
          // 새 필드명 매핑: pow_plan_text → plan, pow_fields → mode
          plan: apiSession.pow_plan_text || apiSession.plan_text || "",
          mode: apiSession.pow_fields || apiSession.donation_mode || "pow-writing",
          achieved: achievementRate >= 100,
          achievementRate,
          timestamp: apiSession.created_at,
          sessionId: apiSession.id,
        };
      });
      sessionsCache = sessions;
      const { sessionsKey } = getStorageKeys();
      localStorage.setItem(sessionsKey, JSON.stringify(sessions));
      console.log('API에서 POW 세션 로드 완료:', sessions.length, '개');
      return sessions;
    }
    sessionsCache = [];
    return [];
  } catch (error) {
    console.error('API에서 POW 세션 가져오기 실패:', error);
    sessionsCache = [];
    return [];
  }
};

// 기부 기록 조회
export const getDonationHistory = () => {
  if (donationsCache !== null) {
    return donationsCache;
  }

  try {
    const { donationHistoryKey } = getStorageKeys();
    const raw = localStorage.getItem(donationHistoryKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const result = Array.isArray(parsed) ? parsed : [];
    donationsCache = result;
    return result;
  } catch (error) {
    donationsCache = [];
    return [];
  }
};

// ============================================
// Algorithm v3: API에서 기부 기록 로드
// - status: 'paid' 또는 'completed'는 모두 결제됨으로 처리
// ============================================
export const loadDonationsFromAPI = async () => {
  if (!currentDiscordId) {
    return [];
  }

  try {
    const response = await DonationAPI.getByUser(currentDiscordId);
    if (response.success && response.user && response.user.donations) {
      const donations = response.user.donations.map(apiDonation => ({
        date: apiDonation.date || apiDonation.created_at.split('T')[0],
        sats: apiDonation.amount || 0,
        // 새 필드명 매핑: pow_fields → mode, donation_mode → scope
        mode: apiDonation.pow_fields || apiDonation.donation_mode || 'pow-writing',
        scope: apiDonation.donation_mode || apiDonation.donation_scope || 'session',
        sessionId: apiDonation.session_id || '',
        note: apiDonation.note || apiDonation.message || '',
        // Algorithm v3: 'paid' 또는 'completed'는 모두 결제됨으로 처리
        isPaid: apiDonation.status === 'completed' || apiDonation.status === 'paid',
        isCompleted: apiDonation.status === 'completed',
        discordShared: apiDonation.discord_shared || false,
        donationId: apiDonation.id,
        paidAt: apiDonation.paid_at,
      }));
      donationsCache = donations;
      const { donationHistoryKey } = getStorageKeys();
      localStorage.setItem(donationHistoryKey, JSON.stringify(donations));
      console.log('API에서 기부 기록 로드 완료:', donations.length, '개');
      return donations;
    }
    donationsCache = [];
    return [];
  } catch (error) {
    console.error('API에서 기부 기록 가져오기 실패:', error);
    donationsCache = [];
    return [];
  }
};

// ============================================
// Algorithm v3 + 옵션 A: 기부 기록 저장 (2단계 분리)
// - 1단계: status='paid'로 저장, donation_id 반환
// - 2단계: Discord 공유 후 updateStatus로 'completed' 전환
// - achievement_rate, total_donated_sats: 저장 안함 (런타임 계산)
// ============================================
export const saveDonationHistoryEntry = async (entry) => {
  const history = getDonationHistory();
  history.push(entry);

  const { donationHistoryKey } = getStorageKeys();
  localStorage.setItem(donationHistoryKey, JSON.stringify(history));
  donationsCache = history;

  // 로그인한 경우 API에 저장 (status: 'paid')
  // 반환값: { success, data: { id: donation_id, ... } }
  if (currentDiscordId && entry.isPaid) {
    try {
      const result = await DonationAPI.create(currentDiscordId, {
        amount: entry.sats,
        currency: 'SAT',
        date: entry.date,
        donationMode: entry.mode,
        donationScope: entry.scope,
        sessionId: entry.sessionId || null,
        note: entry.note,
        planText: entry.planText,
        photoUrl: entry.photoUrl,
        accumulatedSats: entry.accumulatedSats,
        transactionId: '',
        status: 'paid', // 1단계: paid로 저장
      });
      console.log('✅ 기부 기록 저장 (status: paid)');
      // donation_id 반환 (2단계 updateStatus에서 사용)
      return result?.data?.id || null;
    } catch (error) {
      console.error('❌ API에 기부 기록 저장 실패:', error);
      return null;
    }
  }
  return null;
};

// 적립액 조회
export const getPendingDaily = () => {
  if (pendingDailyCache !== null) {
    return pendingDailyCache;
  }

  try {
    const { pendingDailyKey } = getStorageKeys();
    const raw = localStorage.getItem(pendingDailyKey);
    const parsed = raw ? JSON.parse(raw) : {};
    const result = parsed && typeof parsed === "object" ? parsed : {};
    pendingDailyCache = result;
    return result;
  } catch (error) {
    pendingDailyCache = {};
    return {};
  }
};

// API에서 적립액 로드
export const loadPendingDailyFromAPI = async () => {
  if (!currentDiscordId) {
    return;
  }

  try {
    const response = await AccumulatedSatsAPI.get(currentDiscordId);
    if (response.success && response.data) {
      backendAccumulatedSats = response.data.accumulated_sats || 0;
      console.log(`✅ 백엔드 적립액 로드 완료: ${backendAccumulatedSats} sats`);
      const { backendAccumulatedKey } = getStorageKeys();
      localStorage.setItem(backendAccumulatedKey, backendAccumulatedSats.toString());
    } else {
      backendAccumulatedSats = 0;
    }
  } catch (error) {
    console.error('❌ 백엔드에서 적립액 가져오기 실패:', error);
    const { backendAccumulatedKey } = getStorageKeys();
    const cached = localStorage.getItem(backendAccumulatedKey);
    if (cached) {
      backendAccumulatedSats = parseInt(cached, 10) || 0;
    }
  }
};

// 백엔드 적립액 설정
export const setBackendAccumulatedSats = (value) => {
  backendAccumulatedSats = value;
  const { backendAccumulatedKey } = getStorageKeys();
  localStorage.setItem(backendAccumulatedKey, value.toString());
};

// ============================================
// Algorithm v3: 백엔드에서 총 기부액 로드
// user_total_donated 테이블에서 로드 (UserAPI.getStats)
// ============================================
export const loadTotalDonatedFromAPI = async () => {
  if (!currentDiscordId) {
    return;
  }

  try {
    const response = await UserAPI.getStats(currentDiscordId);
    if (response.success && response.data) {
      // user_total_donated 테이블의 total_donated 값 사용
      backendTotalDonatedSats = response.data.total_donated_sats || 0;
      console.log(`✅ 백엔드 총 기부액 로드 완료: ${backendTotalDonatedSats} sats`);
      const { backendTotalDonatedKey } = getStorageKeys();
      localStorage.setItem(backendTotalDonatedKey, backendTotalDonatedSats.toString());
    } else {
      backendTotalDonatedSats = null;
    }
  } catch (error) {
    console.error('❌ 백엔드에서 총 기부액 가져오기 실패:', error);
    // 캐시된 값 사용
    const { backendTotalDonatedKey } = getStorageKeys();
    const cached = localStorage.getItem(backendTotalDonatedKey);
    if (cached) {
      backendTotalDonatedSats = parseInt(cached, 10) || null;
    }
  }
};

// 백엔드 총 기부액 설정
export const setBackendTotalDonatedSats = (value) => {
  backendTotalDonatedSats = value;
  const { backendTotalDonatedKey } = getStorageKeys();
  localStorage.setItem(backendTotalDonatedKey, value.toString());
};

// 마지막 세션 조회
export const getLastSessionSeconds = () => {
  if (currentSession) {
    return currentSession;
  }

  const sessions = loadSessions();
  if (sessions && sessions.length > 0) {
    const latestSession = sessions[sessions.length - 1];
    return {
      durationSeconds: latestSession.durationSeconds || 0,
      goalMinutes: latestSession.goalMinutes || 0,
      plan: latestSession.plan || "",
      sessionId: latestSession.sessionId || "",
    };
  }

  return { durationSeconds: 0, goalMinutes: 0, plan: "", sessionId: "" };
};

// 마지막 세션 설정
export const setLastSessionSeconds = (value) => {
  currentSession = value;
};

// 모든 세션 날짜 조회
export const getSessionStorageDates = () => {
  const dates = new Set();
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("citadel-sessions-")) {
      dates.add(key.replace("citadel-sessions-", ""));
    }
  }
  return Array.from(dates).sort().reverse();
};

// 모든 세션 총 시간
export const getAllSessionsTotalSeconds = () => {
  const dates = getSessionStorageDates();
  return dates.reduce((sum, date) => {
    const sessions = loadSessions(`citadel-sessions-${date}`);
    const daySeconds = sessions.reduce(
      (daySum, session) => daySum + Number(session.durationSeconds || 0),
      0
    );
    return sum + daySeconds;
  }, 0);
};

// 오늘 총 시간
export const getTotalSecondsToday = () => {
  const sessions = loadSessions();
  if (!sessions || !Array.isArray(sessions)) {
    return 0;
  }
  return sessions.reduce((sum, session) => sum + (session.durationSeconds || 0), 0);
};

// 결제 여부 확인
export const isPaidEntry = (entry) => entry?.isPaid !== false;

// ============================================
// Algorithm v3: 총 기부액
// - 로그인 시: 백엔드 값 (user_total_donated 테이블) 우선 사용
// - 비로그인/오프라인: localStorage 계산값 사용
// ============================================
export const getTotalDonatedSats = () => {
  // 백엔드 값이 있으면 우선 사용 (status: 'completed'인 것만 합산됨)
  if (currentDiscordId && backendTotalDonatedSats !== null) {
    return backendTotalDonatedSats;
  }

  // 폴백: localStorage에서 계산
  const history = getDonationHistory();
  return history.reduce(
    (sum, item) => (isPaidEntry(item) ? sum + Number(item.sats || 0) : sum),
    0
  );
};

// 캐시 초기화
export const clearCaches = () => {
  sessionsCache = null;
  donationsCache = null;
  pendingDailyCache = null;
};
