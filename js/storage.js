/**
 * Citadel POW - 저장소 관리 모듈
 * localStorage, 캐시, 백엔드 API 연동
 */

import { getTodayKey } from './utils.js';

// 캐시 변수
let sessionsCache = null;
let donationsCache = null;
let pendingDailyCache = null;
export let backendAccumulatedSats = 0;
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

// API에서 세션 로드
export const loadSessionsFromAPI = async () => {
  if (!currentDiscordId || typeof window.StudySessionAPI === 'undefined') {
    return [];
  }

  try {
    const response = await window.StudySessionAPI.getToday(currentDiscordId);
    if (response.success && response.data) {
      const sessions = response.data.map(apiSession => {
        const durationSeconds = apiSession.duration_seconds || (apiSession.duration_minutes * 60);
        return {
          durationSeconds,
          goalMinutes: apiSession.goal_minutes || 0,
          plan: apiSession.plan_text || "",
          achieved: apiSession.achievement_rate >= 100,
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

// API에서 기부 기록 로드
export const loadDonationsFromAPI = async () => {
  if (!currentDiscordId || typeof window.DonationAPI === 'undefined') {
    return [];
  }

  try {
    const response = await window.DonationAPI.getByUser(currentDiscordId);
    if (response.success && response.user && response.user.donations) {
      const donations = response.user.donations.map(apiDonation => ({
        date: apiDonation.date || apiDonation.created_at.split('T')[0],
        sats: apiDonation.amount || 0,
        minutes: apiDonation.duration_minutes || Math.floor((apiDonation.duration_seconds || 0) / 60),
        seconds: apiDonation.duration_seconds || 0,
        mode: apiDonation.donation_mode || 'pow-writing',
        scope: apiDonation.donation_scope || 'session',
        sessionId: apiDonation.session_id || '',
        note: apiDonation.note || apiDonation.message || '',
        isPaid: apiDonation.status === 'completed',
        donationId: apiDonation.id,
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

// 기부 기록 저장
export const saveDonationHistoryEntry = async (entry) => {
  const history = getDonationHistory();
  history.push(entry);

  const { donationHistoryKey } = getStorageKeys();
  localStorage.setItem(donationHistoryKey, JSON.stringify(history));
  donationsCache = history;

  // 로그인한 경우 API에도 저장
  if (currentDiscordId && typeof window.DonationAPI !== 'undefined' && entry.isPaid) {
    try {
      await window.DonationAPI.create(currentDiscordId, {
        amount: entry.sats,
        currency: 'SAT',
        date: entry.date,
        durationSeconds: entry.seconds,
        durationMinutes: entry.minutes,
        donationMode: entry.mode,
        donationScope: entry.scope,
        sessionId: entry.sessionId,
        note: entry.note,
        planText: entry.planText,
        goalMinutes: entry.goalMinutes,
        achievementRate: entry.achievementRate,
        photoUrl: entry.photoUrl,
        accumulatedSats: entry.accumulatedSats,
        totalAccumulatedSats: entry.totalAccumulatedSats,
        totalDonatedSats: entry.totalDonatedSats,
        transactionId: '',
        status: 'completed',
      });
      console.log('기부 기록이 API에 저장되었습니다.');
    } catch (error) {
      console.error('API에 기부 기록 저장 실패:', error);
    }
  }
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
  if (!currentDiscordId || typeof window.AccumulatedSatsAPI === 'undefined') {
    return;
  }

  try {
    const response = await window.AccumulatedSatsAPI.get(currentDiscordId);
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

// 총 기부액
export const getTotalDonatedSats = () => {
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
