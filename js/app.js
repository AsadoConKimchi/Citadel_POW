/**
 * Citadel POW - 메인 애플리케이션 모듈
 * 모든 모듈 통합 및 초기화
 */

import { getTodayKey, parseGoalMinutes, formatTime, donationModeLabels } from './utils.js';
import { UserAPI, StudySessionAPI, AccumulatedSatsAPI } from '../api.js';
import {
  loadSessions,
  saveSessions,
  getDonationHistory,
  getPendingDaily,
  saveDonationHistoryEntry,
  loadSessionsFromAPI,
  loadDonationsFromAPI,
  loadPendingDailyFromAPI,
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
// 세션 종료 처리
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
        // Algorithm v3: achievement_rate, donation_id 저장 안함 (런타임 계산)
        await StudySessionAPI.create(sessionInfo.user.id, {
            donationMode: currentMode,
            planText: planWithCategory,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationSeconds: sessionData.durationSeconds,
            goalSeconds: goalSeconds,
            photoUrl: photoDataUrl,
            // achievement_rate: 저장 안함 (백엔드에서 런타임 계산)
            // donation_id: 저장 안함 (donations.session_id로 단방향 참조)
          });
        }
      } catch (err) {
        console.error('백엔드 세션 저장 오류:', err);
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
// Lightning 지갑 열기
// ========================================

// ============================================
// Algorithm v3: Lightning 지갑 열기
// - achievement_rate: 런타임 계산 (저장 안함)
// - total_donated_sats: 런타임 계산 (저장 안함)
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
  const sessionId = scope === "session" ? lastSession.sessionId : null;
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
      try {
        const video = getSelectedVideo();
        await shareToDiscordAPI({
          sessionId: sessionId,
          dataUrl: dataUrl,
          planText: lastSession.plan,
          durationSeconds: donationSeconds,
          donationScope: scope,
          donationSats: sats,
          donationNote: note,
          videoDataUrl: video?.dataUrl || null,
          videoFilename: video?.filename || null,
        });
      } catch (error) {
        console.error("Discord 공유 실패:", error);
        alert("Discord 공유에 실패했습니다: " + error.message);
      }

      // Algorithm v3: 간소화된 기부 기록 (런타임 계산 필드 제외)
      saveDonationHistoryEntry({
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
        // Algorithm v3: 아래 필드는 저장하지 않음 (런타임 계산)
        // achievementRate, totalAccumulatedSats, totalDonatedSats
      });

      showAccumulationToast("기부 및 Discord 공유가 완료되었습니다. 페이지를 새로고침합니다...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
  });
};

// ========================================
// Discord 공유만
// ========================================

// ============================================
// Algorithm v3: Discord 공유만 (적립 후 기부 모드)
// PARTIAL UNIQUE로 중복 적립 방지 (백엔드)
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

  try {
    const video = getSelectedVideo();
    // Algorithm v3: 런타임 계산 필드 제외
    await shareToDiscordAPI({
      sessionId: lastSession.sessionId,
      dataUrl: dataUrl,
      planText: lastSession.plan,
      durationSeconds: lastSession.durationSeconds,
      donationScope: donationScopeValue,
      donationSats: donationSats,
      donationNote: donationNote?.value?.trim() || "",
      videoDataUrl: video?.dataUrl || null,
      videoFilename: video?.filename || null,
    });

    if (shareStatus) {
      shareStatus.textContent = "디스코드 공유를 완료했습니다.";
    }

    // Algorithm v3: 적립 후 기부 모드 - 백엔드에 적립액 저장
    if (donationScopeValue === "total" && currentDiscordId) {
      try {
        // BUG FIX: 프론트엔드 sessionId는 UUID 형식이 아니므로 null 전달
        // 프론트엔드 sessionId: "1736946830000-abc123" (로컬 생성)
        // 백엔드 기대값: UUID 형식 또는 null
        // 두 ID가 서로 다르므로 중복 방지 로직도 작동하지 않음
        const result = await AccumulatedSatsAPI.add(
          currentDiscordId,
          donationSats,
          null, // sessionId는 null로 전달 (UUID 형식 불일치 문제 해결)
          donationNote?.value?.trim() || null
        );

        if (result.success && result.data) {
          setBackendAccumulatedSats(result.data.amount_after);
          console.log(`✅ 적립액 저장 성공: ${result.data.amount_after} sats`);
        }
      } catch (error) {
        console.error('적립액 저장 실패:', error);
      }
    }

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
