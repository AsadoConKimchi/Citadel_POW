/**
 * Citadel POW - 메인 애플리케이션 모듈
 * 모든 모듈 통합 및 초기화
 */

import { getTodayKey, parseGoalMinutes, formatTime, donationModeLabels } from './utils.js';
import { UserAPI, StudySessionAPI, AccumulatedSatsAPI, DonationAPI, DiscordPostsAPI } from '../api.js';
import {
  loadSessions,
  saveSessions,
  getDonationHistory,
  getPendingDaily,
  saveDonationHistoryEntry,
  loadSessionsFromAPI,
  loadDonationsFromAPI,
  loadPendingDailyFromAPI,
  loadTotalDonatedFromAPI,
  setLastSessionSeconds,
  getLastSessionSeconds,
  getTotalSecondsToday,
  getTotalDonatedSats,
  setCurrentDiscordId,
  currentDiscordId,
  backendAccumulatedSats,
  setBackendAccumulatedSats,
  clearCaches,
  getStorageKeys,
} from './storage.js';
import {
  initTimer,
  startTimer,
  pauseTimer,
  resetTimer,
  finishSession as timerFinishSession,
  openTimerModal,
  closeTimerModal,
  updateDisplay,
  getElapsedSeconds,
  getIsRunning,
  handleVisibilityChange,
  getCurrentGoalMinutes,
  syncElapsedTime,
} from './timer.js';
import {
  initUI,
  renderSessions,
  renderDonationHistory,
  renderLeaderboard,
  updateTotals,
  updateDonationTotals,
  showToast,
} from './ui.js';
import {
  initMedia,
  handleMediaFile,
  resetMediaPreview,
  drawBadge,
  getBadgeDataUrl,
  hasPhotoSource,
  getSelectedVideo,
} from './media.js';
import {
  initDonation,
  formatSatsRateInput,
  updateSats,
  updateAccumulatedSats,
  showAccumulationToast,
  getDonationScopeValue,
  getDonationPaymentSnapshot,
  buildDonationPayload,
  openLightningWalletWithPayload,
  openWalletSelection,
  closeWalletSelection,
  launchWallet,
  copyWalletInvoice,
  resetPaymentState,
  cleanupPaymentPolling,
  getCurrentSessionSats,
  getSessionAccumulatedSats,
  getDonationSatsForScope,
  setGoalMinutesGetter,
  setCurrentDonationInfo,
  calculateAchievementRate, // Algorithm v3: 런타임 계산
} from './donation.js';
import {
  initDiscord,
  loadSession,
  setAuthState,
  shareToDiscordAPI,
  getCurrentUser,
} from './discord.js';
import { initNotifications } from './notification.js';

// ========================================
// DOM 요소 참조
// ========================================

// 타이머 관련
const timerDisplay = document.getElementById("timer-display");
const goalInput = document.getElementById("goal-minutes");
const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const resetButton = document.getElementById("reset");
const finishButton = document.getElementById("finish");
const timerModal = document.getElementById("timer-modal");

// 오늘의 기록
const totalTodayEl = document.getElementById("total-today");
const goalProgressEl = document.getElementById("goal-progress");

// 기부 관련
const satsRateInput = document.getElementById("sats-rate");
const satsTotalEl = document.getElementById("sats-total");
const satsTotalAllEl = document.getElementById("sats-total-all");
const donationMode = document.getElementById("donation-mode");
const donationScope = document.getElementById("donation-scope");
const donationNote = document.getElementById("donation-note");
const currentTotalSats = document.getElementById("current-total-sats");
const donationPageDonated = document.getElementById("donation-page-donated");
const donationPageAccumulated = document.getElementById("donation-page-accumulated");
const donationPageAccumulatedRow = document.getElementById("donation-page-accumulated-row");
const donationPagePay = document.getElementById("donation-page-pay");
const todayTotalDonated = document.getElementById("today-total-donated");
const todayAccumulatedRow = document.getElementById("today-accumulated-row");
const todayAccumulatedSats = document.getElementById("today-accumulated-sats");
const todayAccumulatedPay = document.getElementById("today-accumulated-pay");
const timerAccumulatedNote = document.getElementById("timer-accumulated-note");

// 지갑 모달
const walletModal = document.getElementById("wallet-modal");
const walletModalClose = document.getElementById("wallet-modal-close");
const walletStatus = document.getElementById("wallet-status");
const walletOptions = document.querySelectorAll(".wallet-option");
const walletInvoice = document.getElementById("wallet-invoice");
const walletInvoiceQr = document.getElementById("wallet-invoice-qr");
const walletToast = document.getElementById("wallet-toast");

// 토스트
const accumulationToast = document.getElementById("accumulation-toast");
const accumulationToastMessage = document.getElementById("accumulation-toast-message");
const accumulationToastClose = accumulationToast?.querySelector(".toast-close");

// 목표/계획
const studyPlanInput = document.getElementById("study-plan");
const planStatus = document.getElementById("plan-status");
const studyPlanPreview = document.getElementById("study-plan-preview");

// 미디어 관련
const openCameraButton = document.getElementById("open-camera");
const generateButton = document.getElementById("generate");
const mediaUpload = document.getElementById("media-upload");
const cameraCapture = document.getElementById("camera-capture");
const cameraVideo = document.getElementById("camera");
const snapshotCanvas = document.getElementById("snapshot");
const photoPreview = document.getElementById("photo-preview");
const badgeCanvas = document.getElementById("badge");
const downloadLink = document.getElementById("download");
const studyCard = document.getElementById("study-card");

// Discord 공유
const shareDiscordButton = document.getElementById("share-discord");
const shareStatus = document.getElementById("share-status");

// Discord 인증
const discordAppLogin = document.getElementById("discord-app-login");
const discordWebLogin = document.getElementById("discord-web-login");
const discordRefresh = document.getElementById("discord-refresh");
const discordHint = document.getElementById("discord-hint");
const discordStatus = document.getElementById("discord-status");
const discordLogout = document.getElementById("discord-logout");
const mainContent = document.querySelector("main");
const discordProfile = document.getElementById("discord-profile");
const discordAvatar = document.getElementById("discord-avatar");
const discordUsername = document.getElementById("discord-username");
const discordGuild = document.getElementById("discord-guild");
const allowedServer = document.getElementById("allowed-server");
const loginUser = document.getElementById("login-user");
const loginUserName = document.getElementById("login-user-name");

// 세션/기부 목록
const sessionList = document.getElementById("session-list");
const sessionEmpty = document.getElementById("session-empty");
const sessionPagination = document.getElementById("session-pagination");
const donationHistoryEl = document.getElementById("donation-history");
const donationHistoryEmpty = document.getElementById("donation-history-empty");
const donationPagination = document.getElementById("donation-pagination");

// 토글 버튼
const toggleButtons = document.querySelectorAll('.toggle-button');
const donationScopeKey = 'citadel-donation-scope';

// ========================================
// 상태 변수
// ========================================

let isResetReady = false;
const todayKey = getTodayKey();
const { planKey } = getStorageKeys();

// Algorithm v3: 현재 처리 중인 세션 정보 (롤백용)
let currentPendingSession = {
  sessionId: null,      // 현재 pending 상태의 POW session ID
  donationId: null,     // 현재 pending/paid 상태의 donation ID
  messageId: null,      // 현재 Discord message ID
  status: 'idle',       // 'idle' | 'pow_saved' | 'paid' | 'shared' | 'completed' | 'failed'
};

// ========================================
// Algorithm v3: 롤백 함수
// ========================================

/**
 * 롤백 실행 - 실패 시 이전 단계까지 롤백
 * @param {string} failedStep - 실패한 단계 ('pow_save' | 'payment' | 'discord_share' | 'status_update')
 */
const rollbackTransaction = async (failedStep) => {
  console.log(`🔄 롤백 시작: ${failedStep} 단계 실패`);

  try {
    // POW session 삭제 (pending 상태인 경우만)
    if (currentPendingSession.sessionId && currentPendingSession.status === 'pow_saved') {
      try {
        await StudySessionAPI.delete(currentPendingSession.sessionId);
        console.log(`✅ POW session 롤백 완료: ${currentPendingSession.sessionId}`);
      } catch (err) {
        console.error('⚠️ POW session 롤백 실패:', err);
      }
    }

    // Donation 상태를 failed로 변경 (삭제 대신)
    if (currentPendingSession.donationId) {
      try {
        await DonationAPI.updateStatus(currentPendingSession.donationId, 'failed', false);
        console.log(`✅ Donation 롤백 완료: ${currentPendingSession.donationId}`);
      } catch (err) {
        console.error('⚠️ Donation 롤백 실패:', err);
      }
    }

    // Discord post 삭제 (message_id가 있는 경우)
    if (currentPendingSession.messageId) {
      try {
        await DiscordPostsAPI.delete(currentPendingSession.messageId);
        console.log(`✅ Discord post 롤백 완료: ${currentPendingSession.messageId}`);
      } catch (err) {
        console.error('⚠️ Discord post 롤백 실패:', err);
      }
    }
  } catch (err) {
    console.error('❌ 롤백 중 오류:', err);
  }

  // 상태 초기화
  currentPendingSession = {
    sessionId: null,
    donationId: null,
    messageId: null,
    status: 'idle',
  };
};

/**
 * 세션 상태 초기화
 */
const resetPendingSession = () => {
  currentPendingSession = {
    sessionId: null,
    donationId: null,
    messageId: null,
    status: 'idle',
  };
};

// ========================================
// 목표 시간 관련
// ========================================

const parseCurrentGoalMinutes = () => {
  if (!goalInput) return 0;
  return parseGoalMinutes(goalInput.value);
};

// 기부 모듈에 목표 시간 getter 설정
setGoalMinutesGetter(parseCurrentGoalMinutes);

// ========================================
// 오늘의 목표 저장/로드
// ========================================

const loadStudyPlan = () => {
  const savedPlan = localStorage.getItem(planKey);
  if (savedPlan && studyPlanInput) {
    studyPlanInput.value = savedPlan;
  }
  if (studyPlanPreview) {
    studyPlanPreview.value = savedPlan || "";
  }
};

const applyStudyPlanValue = (value) => {
  const trimmed = value.trim();
  if (trimmed) {
    localStorage.setItem(planKey, trimmed);
    if (planStatus) {
      planStatus.textContent = "목표가 저장되었습니다.";
    }
  } else {
    localStorage.removeItem(planKey);
    if (planStatus) {
      planStatus.textContent = "목표는 자동 저장됩니다.";
    }
  }
  if (studyPlanPreview) {
    studyPlanPreview.value = value;
  }
};

const saveStudyPlan = () => {
  if (!studyPlanInput) return;
  applyStudyPlanValue(studyPlanInput.value);
};

const getPlanValue = () => {
  return studyPlanInput?.value.trim() || localStorage.getItem(planKey) || "";
};

// ========================================
// 토글 버튼 초기화
// ========================================

const initToggleButtons = () => {
  const savedDonationScope = localStorage.getItem(donationScopeKey) || 'session';

  if (donationScope) {
    donationScope.value = savedDonationScope;
  }

  if (toggleButtons.length > 0) {
    toggleButtons.forEach(button => {
      const value = button.getAttribute('data-value');
      if (value === savedDonationScope) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    });

    toggleButtons.forEach(button => {
      button.addEventListener('click', async () => {
        toggleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        const value = button.getAttribute('data-value');
        if (donationScope) {
          donationScope.value = value;
          localStorage.setItem(donationScopeKey, value);

          // 백엔드에 저장
          if (currentDiscordId) {
            try {
              await UserAPI.updateSettings(currentDiscordId, {
                donation_scope: value,
              });
            } catch (error) {
              console.error('donation_scope 백엔드 저장 실패:', error);
            }
          }

          donationScope.dispatchEvent(new Event('change'));
        }
      });
    });
  }
};

// ========================================
// 공유 버튼 레이블 업데이트
// ========================================

const updateShareButtonLabel = () => {
  if (!shareDiscordButton) return;
  shareDiscordButton.textContent =
    getDonationScopeValue() === "total"
      ? "디스코드에 공유"
      : "디스코드에 공유 & 사토시 기부";
};

// ========================================
// 오늘 기부 요약 업데이트
// ========================================

const updateTodayDonationSummary = () => {
  if (!todayTotalDonated && !todayAccumulatedRow && !todayAccumulatedSats) return;

  const totalDonated = getTotalDonatedSats();
  if (todayTotalDonated) {
    todayTotalDonated.textContent = `${totalDonated} sats`;
  }

  const isAccumulated = getDonationScopeValue() === "total";
  if (todayAccumulatedRow) {
    todayAccumulatedRow.classList.toggle("hidden", !isAccumulated);
  }
  if (todayAccumulatedPay) {
    todayAccumulatedPay.classList.toggle("hidden", !isAccumulated);
  }
  if (todayAccumulatedSats) {
    todayAccumulatedSats.textContent = `${getDonationSatsForScope()} sats`;
  }
};

// ========================================
// 세션 종료 처리 (Algorithm v3)
// - POW 세션을 status: 'pending'으로 저장
// - sessionId를 생성하여 추적 (Option A)
// ========================================

const handleFinishSession = () => {
  const plan = getPlanValue();
  const sessionData = timerFinishSession({ plan });

  if (!sessionData) return;

  // POW 분야 가져오기
  const currentMode = donationMode?.value || "pow-writing";
  const modeEmoji = donationModeLabels[currentMode]?.split('ㅣ')[0] || "";
  const planWithCategory = modeEmoji ? `${modeEmoji} ${plan}` : plan;

  // 백엔드에 세션 저장
  const endTime = new Date(sessionData.timestamp);
  const startTime = new Date(endTime.getTime() - sessionData.durationSeconds * 1000);
  // Algorithm v3: goal_seconds 단위로 변환
  const goalSeconds = (sessionData.goalMinutes || 0) * 60;

  // Algorithm v3 + Option A: 프론트엔드에서 UUID 생성
  const sessionId = crypto.randomUUID();

  (async () => {
    let photoDataUrl = getBadgeDataUrl();
    if (!photoDataUrl || photoDataUrl === "data:,") {
      if (hasPhotoSource()) {
        drawBadge({
          sessionOverride: sessionData,
          donationModeValue: currentMode,
          planText: plan,
        });
        photoDataUrl = getBadgeDataUrl();
      }
    }

    try {
      const res = await fetch('/api/session');
      const sessionInfo = await res.json();
      if (sessionInfo.authenticated && sessionInfo.user?.id) {
        // Algorithm v3: POW 세션 저장 (status: 'pending')
        // 프론트엔드에서 생성한 sessionId를 DB id로 사용 (Option A)
        const result = await StudySessionAPI.create(sessionInfo.user.id, {
          sessionId: sessionId,  // Option A: 프론트엔드 UUID를 DB id로
          powFields: currentMode,
          powPlanText: planWithCategory,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationSeconds: sessionData.durationSeconds,
          goalSeconds: goalSeconds,
          photoUrl: photoDataUrl,
          // status: 'pending' (백엔드 기본값)
        });

        // 현재 세션 상태 추적 (롤백용)
        currentPendingSession.sessionId = sessionId;
        currentPendingSession.status = 'pow_saved';
        console.log(`✅ POW 세션 저장 완료 (pending): ${sessionId}`);
      }
    } catch (err) {
      console.error('백엔드 세션 저장 오류:', err);
      // 저장 실패 시에도 로컬에서는 진행 가능하도록 sessionId 유지
      currentPendingSession.sessionId = sessionId;
      currentPendingSession.status = 'pow_saved';
    }
  })();

  // 적립 후 기부 모드 처리
  if (getDonationScopeValue() === "total") {
    const pending = getPendingDaily();
    const entry = pending[todayKey] || {
      seconds: 0,
      sats: 0,
      plan: "",
      goalMinutes: 0,
      mode: currentMode,
      note: "",
    };

    const sessionSats = getSessionAccumulatedSats();
    entry.seconds += sessionData.durationSeconds;
    entry.sats += sessionSats;
    entry.plan = plan || entry.plan;
    entry.goalMinutes = sessionData.goalMinutes || entry.goalMinutes;
    entry.mode = currentMode;
    pending[todayKey] = entry;
    localStorage.setItem('citadel-pending-daily', JSON.stringify(pending));

    showAccumulationToast(`기부금 * 달성률을 곱해서 ${sessionSats} sats가 적립되었습니다.`);
  }

  // 결제 상태 초기화
  resetPaymentState();

  // UI 업데이트
  updateTotals(parseCurrentGoalMinutes());
  updateTodayDonationSummary();
  renderSessions();

  if (finishButton) {
    finishButton.textContent = "인증 카드 만들기 완료!";
    setTimeout(() => {
      finishButton.textContent = "POW 종료";
    }, 2000);
  }

  if (hasPhotoSource()) {
    drawBadge({
      sessionOverride: sessionData,
      donationModeValue: currentMode,
      planText: plan,
    });
  }

  if (studyCard) {
    studyCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  openCameraButton?.focus();
};

// ========================================
// Lightning 지갑 열기 (CASE 1: 즉시기부, CASE 3: 적립금 기부)
// ========================================

// ============================================
// Algorithm v3: CASE 1 & CASE 3
// CASE 1 (session): POW 세션 (pending) → 결제 → Discord 공유 → POW (completed)
// CASE 3 (total): 결제 → Discord 공유 → 적립액 차감 (POW 세션 없음)
// ============================================
const openLightningWallet = async () => {
  const { sats, seconds: donationSeconds, scope } = getDonationPaymentSnapshot();
  let dataUrl = getBadgeDataUrl();

  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }

  const lastSession = getLastSessionSeconds();
  const mode = donationMode?.value || "pow-writing";
  const note = donationNote?.value?.trim() || "";

  // ============================================
  // CASE 구분:
  // - CASE 1: scope === 'session' → 현재 POW 세션과 연결
  // - CASE 3: scope === 'total' → POW 세션 없음 (적립금 기부)
  // ============================================
  const isCase3 = (scope === 'total');

  // CASE 1: 현재 세션의 sessionId 사용
  // CASE 3: sessionId = null (POW 세션 없음)
  const sessionId = isCase3 ? null : (currentPendingSession.sessionId || lastSession.sessionId || null);

  const accumulatedSats = getSessionAccumulatedSats();

  // Algorithm v3: goal_seconds 단위 사용
  const goalSeconds = (lastSession.goalMinutes || 0) * 60;

  const payload = buildDonationPayload({
    dataUrl,
    plan: lastSession.plan,
    durationSeconds: donationSeconds,
    goalSeconds: goalSeconds,
    sats,
    donationModeValue: mode,
    donationScopeValue: scope,
    donationNoteValue: note,
    accumulatedSats,
    sessionId: sessionId,
  });

  // Algorithm v3: 달성률은 런타임 계산
  const achievementRate = calculateAchievementRate(donationSeconds, goalSeconds);

  setCurrentDonationInfo(scope, sats, payload);

  await openLightningWalletWithPayload(payload, {
    onSuccess: async () => {
      // ============================================
      // Algorithm v3 + Option A: CASE 1 - 즉시기부 흐름
      // 1단계: DonationAPI.create(status: 'paid') → donation_id 반환
      // 2단계: shareToDiscordAPI() → Discord 공유
      // 3단계: DonationAPI.updateStatus(donation_id, 'completed')
      // 4단계: POW session status → 'completed'
      // ============================================

      try {
        // 1단계: 기부 기록 저장 (status: 'paid')
        const donationId = await saveDonationHistoryEntry({
          date: todayKey,
          sats,
          seconds: donationSeconds,
          goalSeconds: goalSeconds,
          mode,
          scope,
          sessionId,
          note,
          isPaid: true,
          planText: lastSession.plan,
          photoUrl: dataUrl,
          accumulatedSats: scope === "session" ? 0 : accumulatedSats,
        });

        currentPendingSession.donationId = donationId;
        currentPendingSession.status = 'paid';
        console.log(`✅ 기부 기록 저장 완료 (paid): ${donationId}`);

        // 2단계: Discord 공유
        const video = getSelectedVideo();

        // CASE 3: 적립금 기부 시 별도 메시지
        const shareData = isCase3 ? {
          sessionId: null,                    // POW 세션 없음
          dataUrl: dataUrl,
          planText: `적립금 ${sats} sats 기부`,  // 적립금 기부 표시
          durationSeconds: 0,                 // 세션 시간 없음
          donationScope: 'accumulated',       // 적립금 기부 표시
          donationSats: sats,
          donationNote: note,
          videoDataUrl: video?.dataUrl || null,
          videoFilename: video?.filename || null,
        } : {
          sessionId: sessionId,
          dataUrl: dataUrl,
          planText: lastSession.plan,
          durationSeconds: donationSeconds,
          donationScope: scope,
          donationSats: sats,
          donationNote: note,
          videoDataUrl: video?.dataUrl || null,
          videoFilename: video?.filename || null,
        };

        const shareResult = await shareToDiscordAPI(shareData);

        currentPendingSession.messageId = shareResult?.message_id || null;
        currentPendingSession.status = 'shared';
        console.log(`✅ Discord 공유 완료: ${shareResult?.message_id}`);

        // 3단계: Donation status → 'completed'
        if (donationId) {
          try {
            await DonationAPI.updateStatus(donationId, 'completed', true);
            console.log('✅ 기부 상태 업데이트 완료: completed');
          } catch (statusError) {
            console.error('⚠️ 기부 상태 업데이트 실패 (기부는 완료됨):', statusError);
          }
        }

        // 4단계: POW session status → 'completed' (CASE 1)
        if (sessionId && scope === 'session') {
          try {
            await StudySessionAPI.updateStatus(sessionId, 'completed');
            currentPendingSession.status = 'completed';
            console.log(`✅ POW 세션 상태 업데이트 완료: completed`);
          } catch (statusError) {
            console.error('⚠️ POW 세션 상태 업데이트 실패:', statusError);
          }
        }

        // 5단계: 적립액 차감 (CASE 3 - 적립금 기부)
        // scope === 'total'이고 결제가 완료된 경우 = 적립금 기부
        if (scope === 'total' && currentDiscordId) {
          try {
            const deductResult = await AccumulatedSatsAPI.deduct(
              currentDiscordId,
              sats,
              donationId,
              note || '적립금 기부'
            );

            if (deductResult.success && deductResult.data) {
              setBackendAccumulatedSats(deductResult.data.amount_after);
              console.log(`✅ 적립액 차감 완료: ${sats} sats → 잔액: ${deductResult.data.amount_after} sats`);
            }
          } catch (deductError) {
            console.error('⚠️ 적립액 차감 실패 (기부는 완료됨):', deductError);
            // 적립액 차감 실패해도 기부는 완료되었으므로 계속 진행
          }
        }

        // 성공 - 상태 초기화
        resetPendingSession();
        showAccumulationToast("기부 및 Discord 공유가 완료되었습니다. 페이지를 새로고침합니다...");
        setTimeout(() => {
          window.location.reload();
        }, 1500);

      } catch (error) {
        console.error("❌ CASE 1 처리 실패:", error);

        // 롤백 실행
        await rollbackTransaction('discord_share');

        alert("Discord 공유에 실패했습니다: " + error.message);
      }
    },
  });
};

// ========================================
// Discord 공유만 (CASE 2: 적립만 모드)
// ========================================

// ============================================
// Algorithm v3: CASE 2 - 적립만 모드 (total mode)
// 흐름: POW 세션 (pending) → Discord 공유 → POW (completed) → 적립액 저장
// 롤백: Discord 공유 실패 시 POW 세션 삭제
// ============================================
const shareToDiscordOnly = async () => {
  let dataUrl = getBadgeDataUrl();
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }

  if (shareStatus) {
    shareStatus.textContent = "디스코드 공유를 진행 중입니다.";
  }

  const lastSession = getLastSessionSeconds();
  const donationScopeValue = getDonationScopeValue();
  const donationSats = getCurrentSessionSats();

  // Algorithm v3: currentPendingSession에서 sessionId 가져오기 (Option A)
  const sessionId = currentPendingSession.sessionId || lastSession.sessionId || null;

  try {
    // 1단계: Discord 공유
    const video = getSelectedVideo();
    const shareResult = await shareToDiscordAPI({
      sessionId: sessionId,
      dataUrl: dataUrl,
      planText: lastSession.plan,
      durationSeconds: lastSession.durationSeconds,
      donationScope: donationScopeValue,
      donationSats: donationSats,
      donationNote: donationNote?.value?.trim() || "",
      videoDataUrl: video?.dataUrl || null,
      videoFilename: video?.filename || null,
    });

    currentPendingSession.messageId = shareResult?.message_id || null;
    currentPendingSession.status = 'shared';
    console.log(`✅ Discord 공유 완료: ${shareResult?.message_id}`);

    if (shareStatus) {
      shareStatus.textContent = "디스코드 공유를 완료했습니다.";
    }

    // 2단계: POW session status → 'completed' (CASE 2)
    if (sessionId) {
      try {
        await StudySessionAPI.updateStatus(sessionId, 'completed');
        currentPendingSession.status = 'completed';
        console.log(`✅ POW 세션 상태 업데이트 완료: completed`);
      } catch (statusError) {
        console.error('⚠️ POW 세션 상태 업데이트 실패:', statusError);
      }
    }

    // 3단계: 적립액 저장 (백엔드)
    if (donationScopeValue === "total" && currentDiscordId) {
      try {
        const result = await AccumulatedSatsAPI.add(
          currentDiscordId,
          donationSats,
          sessionId, // UUID 형식 sessionId 전달 (중복 적립 방지)
          donationNote?.value?.trim() || null
        );

        if (result.success && result.data) {
          setBackendAccumulatedSats(result.data.amount_after);
          console.log(`✅ 적립액 저장 성공: ${result.data.amount_after} sats`);
        }
      } catch (error) {
        console.error('적립액 저장 실패:', error);
        // 적립 실패해도 Discord 공유는 완료되었으므로 계속 진행
      }
    }

    // 성공 - 상태 초기화
    resetPendingSession();

    // 목표 초기화
    localStorage.removeItem(planKey);
    if (studyPlanInput) {
      studyPlanInput.value = "";
    }

    updateAccumulatedSats();
    showAccumulationToast("디스코드 공유가 완료되었습니다. 페이지를 새로고침합니다...");
    setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (error) {
    console.error("❌ CASE 2 처리 실패:", error);

    // 롤백 실행
    await rollbackTransaction('discord_share');

    if (shareStatus) {
      shareStatus.textContent = error?.message || "디스코드 공유에 실패했습니다.";
    }
  }
};

// ========================================
// Discord 공유 통합
// ========================================

const shareToDiscord = async () => {
  if (getDonationScopeValue() === "total") {
    await shareToDiscordOnly();
    return;
  }
  await openLightningWallet();
};

// ========================================
// 목표 시간 입력 포맷팅
// ========================================

const formatGoalMinutesInput = () => {
  if (!goalInput) return;
  const cleaned = String(goalInput.value || "").replace(/[^\d]/g, "");
  const numeric = Number(cleaned);
  if (numeric > 0) {
    goalInput.value = `${numeric}분`;
  } else {
    goalInput.value = "";
  }
};

// ========================================
// 이벤트 리스너 설정
// ========================================

const setupEventListeners = () => {
  // 타이머 버튼
  startButton?.addEventListener("click", () => {
    openTimerModal();
    startTimer();
  });

  pauseButton?.addEventListener("click", () => {
    if (getIsRunning()) {
      pauseTimer();
    } else if (getElapsedSeconds() > 0) {
      startTimer();
    }
  });

  resetButton?.addEventListener("click", () => {
    if (isResetReady) {
      startTimer();
      return;
    }
    resetTimer();
    if (resetButton) {
      resetButton.textContent = "재시작";
    }
    isResetReady = true;
  });

  finishButton?.addEventListener("click", handleFinishSession);

  // 목표 시간 입력
  goalInput?.addEventListener("input", () => {
    updateTotals(parseCurrentGoalMinutes());
  });

  goalInput?.addEventListener("blur", formatGoalMinutesInput);

  // 기부 스코프 변경
  donationScope?.addEventListener("change", () => {
    updateSats();
    updateShareButtonLabel();
    updateTodayDonationSummary();
  });

  // sats rate 입력
  satsRateInput?.addEventListener("input", updateSats);
  satsRateInput?.addEventListener("blur", formatSatsRateInput);

  // 목표 입력
  studyPlanInput?.addEventListener("input", saveStudyPlan);
  studyPlanPreview?.addEventListener("input", (event) => {
    applyStudyPlanValue(event.target.value);
  });

  // 미디어 업로드
  openCameraButton?.addEventListener("click", () => {
    cameraCapture?.click();
  });

  mediaUpload?.addEventListener("change", (event) => {
    handleMediaFile(event.target.files[0]);
    event.target.value = "";
  });

  cameraCapture?.addEventListener("change", (event) => {
    handleMediaFile(event.target.files[0]);
    event.target.value = "";
  });

  // 인증 카드 생성
  generateButton?.addEventListener("click", () => {
    if (!hasPhotoSource()) {
      alert("먼저 사진 또는 동영상을 촬영하거나 업로드해주세요.");
      return;
    }
    drawBadge({
      donationModeValue: donationMode?.value,
      planText: studyPlanPreview?.value?.trim(),
    });
  });

  // Discord 공유
  shareDiscordButton?.addEventListener("click", shareToDiscord);

  // 적립액 결제
  todayAccumulatedPay?.addEventListener("click", async () => {
    // 적립액 기부 로직
    if (getDonationScopeValue() !== "total") return;

    const sats = getDonationSatsForScope();
    if (!sats || sats <= 0) {
      alert("기부할 적립 금액이 없습니다.");
      return;
    }

    let dataUrl = getBadgeDataUrl();
    if (!dataUrl || dataUrl === "data:,") {
      alert("먼저 인증 카드를 생성해주세요.");
      return;
    }

    await openLightningWallet();
  });

  donationPagePay?.addEventListener("click", async () => {
    if (getDonationScopeValue() !== "total") return;
    const sats = getDonationSatsForScope();
    if (!sats || sats <= 0) {
      alert("기부할 적립 금액이 없습니다.");
      return;
    }
    await openLightningWallet();
  });

  // 지갑 모달
  walletModalClose?.addEventListener("click", closeWalletSelection);
  walletModal?.addEventListener("click", (event) => {
    if (event.target === walletModal) {
      closeWalletSelection();
    }
  });

  walletOptions.forEach((option) => {
    option.addEventListener("click", async (event) => {
      if (event.currentTarget?.tagName === "A") {
        if (event.currentTarget.getAttribute("aria-disabled") === "true") {
          event.preventDefault();
        }
        return;
      }
      const walletKey = event.currentTarget?.dataset?.wallet;
      if (walletKey) {
        await launchWallet(walletKey);
      }
    });
  });

  walletInvoiceQr?.addEventListener("click", copyWalletInvoice);

  // 토스트 닫기
  accumulationToastClose?.addEventListener("click", () => {
    accumulationToast?.classList.add("hidden");
  });

  // 버튼 애니메이션
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, .button-link, .file");
    if (!target) return;
    target.classList.add("is-pressed");
    setTimeout(() => {
      target.classList.remove("is-pressed");
    }, 200);
  });

  // 페이지 이벤트
  window.addEventListener("beforeunload", () => {
    pauseTimer();
    cleanupPaymentPolling();
  });

  document.addEventListener("visibilitychange", handleVisibilityChange);
};

// ========================================
// 모듈 초기화
// ========================================

const initializeApp = async () => {
  // 알림 시스템 초기화
  await initNotifications();

  // 타이머 초기화
  initTimer(
    {
      timerDisplay,
      timerModal,
      pauseButton,
      resetButton,
      finishButton,
      goalInput,
      donationControls: [donationScope, donationMode, satsRateInput],
    },
    {
      onTimerUpdate: (seconds) => {
        updateSats();
        if (seconds % 30 === 0) {
          updateTotals(parseCurrentGoalMinutes());
        }
      },
      onTimerComplete: (sessionData) => {
        // 타이머 완료 시 추가 처리
      },
    }
  );

  // UI 초기화
  initUI({
    sessionList,
    sessionEmpty,
    sessionPagination,
    donationHistory: donationHistoryEl,
    donationHistoryEmpty,
    donationPagination,
    totalTodayEl,
    goalProgressEl,
    satsTotalEl,
    satsTotalAllEl,
  });

  // 미디어 초기화
  initMedia({
    photoPreview,
    snapshotCanvas,
    badgeCanvas,
    cameraVideo,
    downloadLink,
  });

  // 기부 모듈 초기화
  initDonation(
    {
      satsRateInput,
      satsTotalEl,
      currentTotalSats,
      donationNote,
      donationMode,
      donationScope,
      shareStatus,
      walletModal,
      walletStatus,
      walletOptions: Array.from(walletOptions),
      walletInvoice,
      walletInvoiceQr,
      walletToast,
      timerAccumulatedNote,
      donationPageAccumulated,
      donationPageAccumulatedRow,
      donationPagePay,
      todayAccumulatedSats,
      todayAccumulatedPay,
      todayAccumulatedRow,
      accumulationToast,
      accumulationToastMessage,
      loginUserName,
    },
    {
      getElapsedSeconds,
      getSelectedVideo,
    }
  );

  // Discord 모듈 초기화
  initDiscord(
    {
      discordAppLogin,
      discordWebLogin,
      discordRefresh,
      discordHint,
      discordStatus,
      discordLogout,
      mainContent,
      discordProfile,
      discordAvatar,
      discordUsername,
      discordGuild,
      allowedServer,
      loginUser,
      loginUserName,
      donationScope,
      donationMode,
      donationNote,
      shareStatus,
      toggleButtons: Array.from(toggleButtons),
    },
    {
      onAuthSuccess: async ({ user, guild, userLevel }) => {
        // 인증 성공 시 데이터 로드
        await Promise.all([
          loadPendingDailyFromAPI(),
          loadSessionsFromAPI(),
          loadDonationsFromAPI(),
          loadTotalDonatedFromAPI(),
        ]);

        loadStudyPlan();
        updateAccumulatedSats();
        updateTodayDonationSummary();
        renderSessions();
        updateDonationTotals();
        renderDonationHistory(todayKey);
      },
      onAuthFail: ({ error, authenticated, authorized }) => {
        // 인증 실패 처리
      },
    }
  );

  // 토글 버튼 초기화
  initToggleButtons();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 초기 UI 업데이트
  formatSatsRateInput();
  updateDisplay();
  updateTotals(parseCurrentGoalMinutes());
  updateDonationTotals();
  updateShareButtonLabel();
  updateTodayDonationSummary();
  renderDonationHistory(todayKey);

  // 세션 로드
  await loadSession();
};

// 앱 시작
initializeApp();
