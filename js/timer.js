/**
 * Citadel POW - 타이머 모듈
 * 백그라운드 지원, 알림 통합
 */

import { formatTime, parseGoalMinutes, getGoalProgressFor } from './utils.js';
import { getStorageKeys, loadSessions, saveSessions, setLastSessionSeconds, getTotalSecondsToday } from './storage.js';
import { notifyTimerComplete, scheduleNotification, requestNotificationPermission, playNotificationSound, vibrate } from './notification.js';

// 타이머 상태
export let timerInterval = null;
export let elapsedSeconds = 0;
export let isRunning = false;
export let isResetReady = false;
export let timerStartTime = null;
export let timerEndTime = null;
export let elapsedOffsetSeconds = 0;

// DOM 요소 참조 (init에서 설정)
let timerDisplay = null;
let timerModal = null;
let pauseButton = null;
let resetButton = null;
let finishButton = null;
let goalInput = null;
let donationControls = [];

// 콜백 함수들
let onTimerUpdate = null;
let onTimerComplete = null;

// 초기화
export const initTimer = (elements, callbacks = {}) => {
  timerDisplay = elements.timerDisplay;
  timerModal = elements.timerModal;
  pauseButton = elements.pauseButton;
  resetButton = elements.resetButton;
  finishButton = elements.finishButton;
  goalInput = elements.goalInput;
  donationControls = elements.donationControls || [];

  onTimerUpdate = callbacks.onTimerUpdate;
  onTimerComplete = callbacks.onTimerComplete;

  // 타이머 상태 복원
  restoreTimerState();
};

// 디스플레이 업데이트
export const updateDisplay = () => {
  if (timerDisplay) {
    timerDisplay.textContent = formatTime(elapsedSeconds);
  }
};

// 일시정지 버튼 레이블 변경
export const setPauseButtonLabel = (label) => {
  if (pauseButton) {
    pauseButton.textContent = label;
  }
};

// 리셋 버튼 레이블 변경
export const setResetButtonLabel = (label) => {
  if (resetButton) {
    resetButton.textContent = label;
  }
};

// 기부 컨트롤 활성/비활성
export const setDonationControlsEnabled = (enabled) => {
  donationControls.forEach((control) => {
    if (control) {
      control.disabled = !enabled;
    }
  });
};

// 타이머 모달 열기
export const openTimerModal = () => {
  if (!timerModal) return;
  timerModal.classList.remove("hidden");
  timerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("timer-modal-open");
  document.documentElement.classList.add("timer-modal-open");
};

// 타이머 모달 닫기
export const closeTimerModal = () => {
  if (!timerModal) return;
  timerModal.classList.add("hidden");
  timerModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("timer-modal-open");
  document.documentElement.classList.remove("timer-modal-open");
};

// 현재 목표 시간 (분)
export const getCurrentGoalMinutes = () => {
  return parseGoalMinutes(goalInput?.value);
};

// 목표 진행률
export const getGoalProgress = (totalSeconds) => {
  return getGoalProgressFor(totalSeconds, getCurrentGoalMinutes());
};

// 경과 시간 동기화 (백그라운드 지원)
export const syncElapsedTime = async () => {
  if (!isRunning || timerStartTime === null) return;

  const now = Date.now();
  const nextElapsed = elapsedOffsetSeconds + Math.floor((now - timerStartTime) / 1000);

  if (nextElapsed === elapsedSeconds) return;

  elapsedSeconds = nextElapsed;
  updateDisplay();

  if (onTimerUpdate) {
    onTimerUpdate(elapsedSeconds);
  }

  // 목표 시간 도달 확인
  const goalMinutes = getCurrentGoalMinutes();
  if (goalMinutes > 0 && elapsedSeconds >= goalMinutes * 60) {
    if (finishButton) {
      finishButton.classList.add("accent");
    }

    // 처음 도달했을 때만 알림 (timerEndTime이 아직 미래였다면)
    if (timerEndTime && now >= timerEndTime) {
      // 알림 권한이 있으면 알림
      const result = await notifyTimerComplete(goalMinutes);

      // 타이머 자동 정지 및 종료 시간 초기화
      timerEndTime = null;
      const { timerEndKey, timerGoalKey } = getStorageKeys();
      localStorage.removeItem(timerEndKey);
      localStorage.removeItem(timerGoalKey);
    }
  }
};

// 타이머 틱
const tick = () => {
  syncElapsedTime();
};

// 타이머 시작
export const startTimer = async () => {
  if (isRunning) return;

  // 첫 시작 시 알림 권한 요청
  await requestNotificationPermission();

  isRunning = true;
  timerStartTime = Date.now();
  elapsedOffsetSeconds = elapsedSeconds;

  const goalMinutes = getCurrentGoalMinutes();
  const { timerEndKey, timerGoalKey } = getStorageKeys();

  if (goalMinutes > 0 && elapsedSeconds === 0) {
    // 새로 시작하는 경우 종료 시간 계산
    timerEndTime = Date.now() + (goalMinutes * 60 * 1000);
    localStorage.setItem(timerEndKey, timerEndTime.toString());
    localStorage.setItem(timerGoalKey, goalMinutes.toString());

    // 백그라운드 알림 예약
    scheduleNotification(goalMinutes, timerEndTime);
  } else if (timerEndTime) {
    // 재개하는 경우 기존 종료 시간 유지
    localStorage.setItem(timerEndKey, timerEndTime.toString());
  }

  // interval 중복 방지
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(tick, 1000);

  setDonationControlsEnabled(false);
  setPauseButtonLabel("일시정지");
  setResetButtonLabel("리셋");
  isResetReady = false;
};

// 타이머 일시정지
export const pauseTimer = () => {
  if (!isRunning) return;

  syncElapsedTime();
  isRunning = false;
  clearInterval(timerInterval);
  timerInterval = null;
  timerStartTime = null;
  elapsedOffsetSeconds = elapsedSeconds;
  setPauseButtonLabel("재개");
};

// 타이머 리셋
export const resetTimer = () => {
  pauseTimer();
  elapsedSeconds = 0;
  elapsedOffsetSeconds = 0;
  timerStartTime = null;
  timerEndTime = null;

  const { timerEndKey, timerGoalKey } = getStorageKeys();
  localStorage.removeItem(timerEndKey);
  localStorage.removeItem(timerGoalKey);

  updateDisplay();
  setDonationControlsEnabled(true);
  setPauseButtonLabel("일시정지");

  if (onTimerUpdate) {
    onTimerUpdate(0);
  }
};

// 세션 종료
export const finishSession = (additionalData = {}) => {
  if (elapsedSeconds === 0) {
    if (finishButton) {
      finishButton.textContent = "기록할 시간이 없습니다";
      setTimeout(() => {
        finishButton.textContent = "POW 종료";
      }, 2000);
    }
    return null;
  }

  pauseTimer();

  const goalMinutes = getCurrentGoalMinutes();
  const achieved = goalMinutes > 0 ? elapsedSeconds >= goalMinutes * 60 : false;
  const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const sessionTimestamp = new Date().toISOString();

  const sessionData = {
    durationSeconds: elapsedSeconds,
    goalMinutes,
    plan: additionalData.plan || "",
    achieved,
    timestamp: sessionTimestamp,
    sessionId,
  };

  // 세션 저장
  const sessions = loadSessions();
  sessions.push(sessionData);
  saveSessions(sessions);

  // 마지막 세션 설정
  setLastSessionSeconds({
    durationSeconds: elapsedSeconds,
    goalMinutes,
    plan: additionalData.plan || "",
    sessionId,
  });

  const completedSeconds = elapsedSeconds;
  elapsedSeconds = 0;

  updateDisplay();
  setDonationControlsEnabled(true);
  closeTimerModal();
  setResetButtonLabel("리셋");
  isResetReady = false;

  if (finishButton) {
    finishButton.textContent = "인증 카드 만들기 완료!";
    finishButton.classList.remove("accent");
    setTimeout(() => {
      finishButton.textContent = "POW 종료";
    }, 2000);
  }

  if (onTimerComplete) {
    onTimerComplete(sessionData);
  }

  return sessionData;
};

// 타이머 상태 복원 (앱 시작 시)
export const restoreTimerState = () => {
  const { timerEndKey, timerGoalKey } = getStorageKeys();
  const savedEndTime = localStorage.getItem(timerEndKey);
  const savedGoal = localStorage.getItem(timerGoalKey);

  if (!savedEndTime) return;

  timerEndTime = parseInt(savedEndTime, 10);
  const now = Date.now();

  if (now < timerEndTime) {
    // 아직 목표 시간 전 - 경과 시간 복원 및 자동 재시작
    const goalMinutes = parseInt(savedGoal, 10) || 0;
    const totalDuration = goalMinutes * 60 * 1000;
    const elapsed = totalDuration - (timerEndTime - now);
    elapsedSeconds = Math.floor(elapsed / 1000);
    elapsedOffsetSeconds = elapsedSeconds;

    if (goalInput) {
      goalInput.value = `${goalMinutes}분`;
    }

    // 타이머 자동 재시작
    isRunning = true;
    timerStartTime = Date.now();
    timerInterval = setInterval(tick, 1000);

    updateDisplay();
    setDonationControlsEnabled(false);
    setPauseButtonLabel("일시정지");
    openTimerModal();

    console.log(`⏱️ 타이머 복원 및 재시작: ${Math.floor(elapsedSeconds / 60)}분 ${elapsedSeconds % 60}초 경과`);
  } else {
    // 목표 시간 초과 - 알림 표시
    const goalMinutes = parseInt(savedGoal, 10) || 0;
    elapsedSeconds = goalMinutes * 60;
    elapsedOffsetSeconds = elapsedSeconds;

    if (goalInput) {
      goalInput.value = `${goalMinutes}분`;
    }

    // localStorage 정리
    localStorage.removeItem(timerEndKey);
    localStorage.removeItem(timerGoalKey);
    timerEndTime = null;

    updateDisplay();
    setPauseButtonLabel("일시정지");

    // 목표 달성 알림
    notifyTimerComplete(goalMinutes);

    console.log(`⏱️ 타이머 복원: 목표 시간(${goalMinutes}분) 도달`);
  }
};

// visibility 변경 시 동기화
export const handleVisibilityChange = () => {
  if (document.visibilityState === "visible") {
    syncElapsedTime();
  }
};

// 현재 경과 시간 반환
export const getElapsedSeconds = () => elapsedSeconds;

// 타이머 실행 중 여부
export const getIsRunning = () => isRunning;
