/**
 * Citadel POW - 기부/결제 모듈
 * Lightning Network 기부, 지갑 연동
 */

import { formatTime, parseSatsRate, getGoalProgressFor, donationModeLabels, normalizeInvoice, getLightningUri } from './utils.js';
import {
  getLastSessionSeconds,
  getDonationHistory,
  getPendingDaily,
  saveDonationHistoryEntry,
  getTotalSecondsToday,
  getAllSessionsTotalSeconds,
  loadSessions,
  getTotalDonatedSats,
  isPaidEntry,
  backendAccumulatedSats,
  setBackendAccumulatedSats,
  currentDiscordId,
  getStorageKeys,
} from './storage.js';
import { getBadgeDataUrl } from './media.js';

// DOM 요소 참조
let satsRateInput = null;
let satsTotalEl = null;
let currentTotalSats = null;
let donationNote = null;
let donationMode = null;
let donationScope = null;
let shareStatus = null;
let walletModal = null;
let walletStatus = null;
let walletOptions = [];
let walletInvoice = null;
let walletInvoiceQr = null;
let walletToast = null;
let timerAccumulatedNote = null;
let donationPageAccumulated = null;
let donationPageAccumulatedRow = null;
let donationPagePay = null;
let todayAccumulatedSats = null;
let todayAccumulatedPay = null;
let todayAccumulatedRow = null;
let accumulationToast = null;
let accumulationToastMessage = null;
let loginUserName = null;

// 결제 상태
let currentInvoice = null;
let pendingOnSuccessCallback = null;
let currentDonationScope = null;
let currentDonationSats = 0;
let currentDonationPayload = null;
let paymentPollingInterval = null;
let walletToastTimeout = null;
let latestDonationPayload = null;

// 외부 변수 참조 (app.js에서 설정)
let selectedVideoDataUrl = null;
let selectedVideoFilename = "";
let elapsedSecondsRef = null;

// 초기화
export const initDonation = (elements, refs = {}) => {
  satsRateInput = elements.satsRateInput;
  satsTotalEl = elements.satsTotalEl;
  currentTotalSats = elements.currentTotalSats;
  donationNote = elements.donationNote;
  donationMode = elements.donationMode;
  donationScope = elements.donationScope;
  shareStatus = elements.shareStatus;
  walletModal = elements.walletModal;
  walletStatus = elements.walletStatus;
  walletOptions = elements.walletOptions || [];
  walletInvoice = elements.walletInvoice;
  walletInvoiceQr = elements.walletInvoiceQr;
  walletToast = elements.walletToast;
  timerAccumulatedNote = elements.timerAccumulatedNote;
  donationPageAccumulated = elements.donationPageAccumulated;
  donationPageAccumulatedRow = elements.donationPageAccumulatedRow;
  donationPagePay = elements.donationPagePay;
  todayAccumulatedSats = elements.todayAccumulatedSats;
  todayAccumulatedPay = elements.todayAccumulatedPay;
  todayAccumulatedRow = elements.todayAccumulatedRow;
  accumulationToast = elements.accumulationToast;
  accumulationToastMessage = elements.accumulationToastMessage;
  loginUserName = elements.loginUserName;

  // 외부 참조
  if (refs.getElapsedSeconds) {
    elapsedSecondsRef = refs.getElapsedSeconds;
  }
  if (refs.getSelectedVideo) {
    const video = refs.getSelectedVideo();
    selectedVideoDataUrl = video.dataUrl;
    selectedVideoFilename = video.filename;
  }
};

// sats rate 포맷팅
export const formatSatsRateInput = () => {
  if (!satsRateInput) return;
  const numeric = parseSatsRate(satsRateInput.value);
  satsRateInput.value = numeric ? `${numeric}sats` : "";
};

// 현재 목표 시간 가져오기 (외부에서 주입)
let getCurrentGoalMinutes = () => 0;
export const setGoalMinutesGetter = (getter) => {
  getCurrentGoalMinutes = getter;
};

// donation scope 값 가져오기
export const getDonationScopeValue = () => donationScope?.value || "session";

// 기부된 시간 계산 (scope별)
const getDonatedSecondsByScope = ({ scope, dateKey } = {}) => {
  const history = getDonationHistory();
  const uniqueSessions = new Set();
  let totalSeconds = 0;

  history.forEach((entry) => {
    if (!isPaidEntry(entry)) return;
    if (scope && entry.scope !== scope) return;
    if (dateKey && entry.date !== dateKey) return;

    const entrySessionId = entry.sessionId || "";
    if (entrySessionId && uniqueSessions.has(entrySessionId)) return;
    if (entrySessionId) uniqueSessions.add(entrySessionId);

    const seconds = typeof entry.seconds === "number"
      ? entry.seconds
      : Number(entry.minutes || 0) * 60;
    totalSeconds += seconds;
  });

  return totalSeconds;
};

// 기부 시간 계산
export const getDonationSeconds = () => {
  const scope = getDonationScopeValue();
  const { todayKey } = getStorageKeys();

  if (scope === "session") {
    return getLastSessionSeconds().durationSeconds;
  }
  if (scope === "total") {
    const pending = getPendingDaily();
    const entry = pending[todayKey];
    return entry ? entry.seconds : 0;
  }
  if (scope === "daily") {
    const available = getTotalSecondsToday() - getDonatedSecondsByScope({ scope, dateKey: todayKey });
    return Math.max(0, available);
  }
  const available = getAllSessionsTotalSeconds() - getDonatedSecondsByScope({ scope });
  return Math.max(0, available);
};

// 세션 예상 시간
export const getSessionEstimateSeconds = () => {
  const elapsed = elapsedSecondsRef ? elapsedSecondsRef() : 0;
  if (elapsed > 0) return elapsed;
  return getLastSessionSeconds().durationSeconds;
};

// ============================================
// Algorithm v3: sats 계산 (FLOOR 사용)
// ============================================
export const calculateSatsForGoal = ({ rate, seconds, goalMinutes }) => {
  if (!rate) return 0;
  const progressRate = getGoalProgressFor(seconds, goalMinutes) / 100;
  // Algorithm v3: FLOOR로 정수 처리 (반올림 대신 내림)
  return Math.floor(rate * progressRate);
};

export const calculateSats = ({ rate, seconds, goalMinutes }) =>
  calculateSatsForGoal({
    rate,
    seconds,
    goalMinutes: goalMinutes ?? getCurrentGoalMinutes(),
  });

// Algorithm v3: 달성률 런타임 계산 (저장 안함)
export const calculateAchievementRate = (durationSeconds, goalSeconds) => {
  if (!goalSeconds || goalSeconds <= 0) return 100; // 목표 없음 = 100%
  return Math.floor((durationSeconds / goalSeconds) * 100);
};

// 세션 적립 sats
export const getSessionAccumulatedSats = () => {
  const rate = parseSatsRate(satsRateInput?.value);
  const lastSession = getLastSessionSeconds();
  return calculateSats({
    rate,
    seconds: lastSession.durationSeconds || 0,
  });
};

// 현재 세션 sats
export const getCurrentSessionSats = () => {
  const rate = parseSatsRate(satsRateInput?.value);
  return calculateSats({
    rate,
    seconds: getDonationSeconds(),
  });
};

// scope별 기부 sats
export const getDonationSatsForScope = () => {
  if (getDonationScopeValue() === "total") {
    return backendAccumulatedSats;
  }
  return getCurrentSessionSats();
};

// 결제 스냅샷
export const getDonationPaymentSnapshot = () => {
  const scope = getDonationScopeValue();
  if (scope !== "session") {
    return {
      scope,
      seconds: getDonationSeconds(),
      sats: getDonationSatsForScope(),
    };
  }
  const rate = parseSatsRate(satsRateInput?.value);
  const seconds = getSessionEstimateSeconds();
  return {
    scope,
    seconds,
    sats: calculateSats({ rate, seconds }),
  };
};

// 적립액 토스트 표시
export const showAccumulationToast = (message) => {
  if (!accumulationToast) return;
  if (accumulationToastMessage) {
    accumulationToastMessage.textContent = message;
  } else {
    accumulationToast.textContent = message;
  }
  accumulationToast.classList.remove("hidden");
};

// 적립액 UI 업데이트
export const updateAccumulatedSats = () => {
  const sats = getDonationSatsForScope();

  if (currentTotalSats) {
    currentTotalSats.textContent = `${sats} sats`;
  }
  if (timerAccumulatedNote) {
    timerAccumulatedNote.classList.toggle("hidden", getDonationScopeValue() !== "total");
  }
  if (donationPageAccumulated) {
    donationPageAccumulated.textContent = `${sats} sats`;
  }
  if (donationPageAccumulatedRow) {
    donationPageAccumulatedRow.classList.toggle("hidden", sats <= 0);
  }
  if (donationPagePay) {
    donationPagePay.classList.toggle("hidden", sats <= 0);
  }
  if (todayAccumulatedSats) {
    todayAccumulatedSats.textContent = `${sats} sats`;
  }
};

// sats UI 업데이트
export const updateSats = () => {
  const rate = parseSatsRate(satsRateInput?.value);
  const sats = calculateSats({
    rate,
    seconds: getSessionEstimateSeconds(),
  });
  if (satsTotalEl) {
    satsTotalEl.textContent = `${sats} sats`;
  }
  updateAccumulatedSats();
};

// 지갑 딥링크
const walletDeepLinks = {
  walletofsatoshi: (invoice) => `walletofsatoshi:${invoice}`,
  blink: (invoice) => getLightningUri(invoice),
  strike: (invoice) => `strike:${invoice}`,
  zeus: (invoice) => `zeusln:${invoice}`,
};

// 지갑 옵션 활성화/비활성화
const setWalletOptionsEnabled = (enabled) => {
  walletOptions.forEach((option) => {
    if ("disabled" in option) {
      option.disabled = !enabled;
    } else {
      option.setAttribute("aria-disabled", enabled ? "false" : "true");
      option.tabIndex = enabled ? 0 : -1;
    }
  });
};

// 지갑 토스트 표시
const showWalletToast = (message) => {
  if (!walletToast) return;
  walletToast.textContent = message;
  walletToast.classList.remove("hidden");
  if (walletToastTimeout) clearTimeout(walletToastTimeout);
  walletToastTimeout = setTimeout(() => {
    walletToast.classList.add("hidden");
  }, 1000);
};

// 인보이스 QR 렌더링
const renderWalletInvoice = (invoice) => {
  if (!walletInvoice || !walletInvoiceQr) return;

  const normalizedInvoice = normalizeInvoice(invoice);
  if (!normalizedInvoice) {
    walletInvoice.classList.add("hidden");
    walletInvoiceQr.src = "";
    return;
  }

  walletInvoice.classList.remove("hidden");
  const lightningUri = getLightningUri(normalizedInvoice);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(lightningUri)}`;
  walletInvoiceQr.src = qrUrl;

  if (invoice && pendingOnSuccessCallback) {
    currentInvoice = normalizedInvoice;
    setTimeout(() => startPaymentPolling(), 3000);
  }
};

// 지갑 선택 모달 열기
export const openWalletSelection = ({ invoice, message, onSuccess } = {}) => {
  pendingOnSuccessCallback = onSuccess || null;

  if (!walletModal) {
    if (invoice) {
      const normalizedInvoice = normalizeInvoice(invoice);
      if (normalizedInvoice) {
        window.location.href = getLightningUri(normalizedInvoice);
      }
    }
    return;
  }

  walletModal.dataset.invoice = normalizeInvoice(invoice) || "";
  walletModal.classList.remove("hidden");
  walletModal.setAttribute("aria-hidden", "false");

  if (walletStatus) {
    walletStatus.textContent = message || "선택한 지갑으로 인보이스를 전달합니다.";
  }

  renderWalletInvoice(invoice);
  setWalletOptionsEnabled(Boolean(invoice));

  if (walletToast) {
    walletToast.classList.add("hidden");
  }
};

// 지갑 선택 모달 닫기
export const closeWalletSelection = () => {
  if (!walletModal) return;

  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }

  walletModal.classList.add("hidden");
  walletModal.setAttribute("aria-hidden", "true");
  walletModal.dataset.invoice = "";

  if (walletStatus) {
    walletStatus.textContent = "선택한 지갑으로 인보이스를 전달합니다.";
  }

  renderWalletInvoice("");
  setWalletOptionsEnabled(true);

  if (walletToast) {
    walletToast.classList.add("hidden");
  }
};

// 결제 polling 시작
const startPaymentPolling = () => {
  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }

  if (!currentInvoice || !pendingOnSuccessCallback) return;

  let attemptCount = 0;
  const MAX_ATTEMPTS = 40;

  paymentPollingInterval = setInterval(async () => {
    attemptCount++;

    try {
      const checkResponse = await fetch(`${window.BACKEND_API_URL}/api/blink/check-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequest: currentInvoice }),
      });

      if (!checkResponse.ok) return;

      const checkResult = await checkResponse.json();

      if (checkResult?.success && checkResult.data?.paid) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;

        if (pendingOnSuccessCallback) {
          await pendingOnSuccessCallback();
        }

        closeWalletSelection();
        pendingOnSuccessCallback = null;
        currentInvoice = null;
        currentDonationScope = null;
        currentDonationSats = 0;
        currentDonationPayload = null;

        updateAccumulatedSats();
        showAccumulationToast("기부가 완료되었습니다! 🎉");
      }

      if (attemptCount >= MAX_ATTEMPTS) {
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;
      }
    } catch (error) {
      console.error('Polling 오류:', error);
    }
  }, 3000);
};

// ============================================
// Algorithm v3: 기부 페이로드 생성 (간소화)
// - achievement_rate: 런타임 계산 (저장 안함)
// - total_donated_sats: 런타임 계산 (저장 안함)
// - total_accumulated_sats: 런타임 계산 (저장 안함)
// ============================================
export const buildDonationPayload = ({
  dataUrl,
  plan,
  durationSeconds,
  goalMinutes,
  goalSeconds, // Algorithm v3: seconds 단위 지원
  sats,
  donationScopeValue,
  donationModeValue,
  donationNoteValue,
  accumulatedSats = 0,
  sessionId = null, // Algorithm v3: 세션 연결
  // Deprecated (하위 호환성) - 저장하지 않음
  totalDonatedSats = 0,
  totalAccumulatedSats = 0,
}) => {
  // Algorithm v3: 달성률은 런타임에 계산 (저장 안함)
  const effectiveGoalSeconds = goalSeconds || (goalMinutes ? goalMinutes * 60 : 0);
  const achievementRate = calculateAchievementRate(durationSeconds || 0, effectiveGoalSeconds);

  return {
    dataUrl,
    plan: plan || "목표 미입력",
    studyTime: formatTime(durationSeconds || 0),
    // Algorithm v3: 달성률은 표시용만 (저장 안함)
    goalRate: `${achievementRate}%`,
    achievementRate, // 숫자 값 (표시용)
    minutes: Math.floor((durationSeconds || 0) / 60),
    durationSeconds: durationSeconds || 0,
    goalSeconds: effectiveGoalSeconds,
    sats,
    donationMode: donationModeValue || "pow-writing",
    donationScope: donationScopeValue || "total",
    donationNote: donationNoteValue || "",
    accumulatedSats, // 기부 시점 적립액 스냅샷 (표시용)
    sessionId, // Algorithm v3: 세션 연결
    username: loginUserName?.textContent || "",
    videoDataUrl: selectedVideoDataUrl,
    videoFilename: selectedVideoFilename,
    // Deprecated (하위 호환성)
    totalDonatedSats,
    totalAccumulatedSats,
  };
};

// Lightning 지갑 열기 (페이로드 포함)
export const openLightningWalletWithPayload = async (payload, { onSuccess } = {}) => {
  if (!payload?.sats || payload.sats <= 0) {
    alert("기부할 사토시 금액을 먼저 확인해주세요.");
    return;
  }
  if (!payload?.dataUrl || payload.dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }

  openWalletSelection({
    message: "인보이스를 생성하는 중입니다. 잠시만 기다려주세요.",
  });

  latestDonationPayload = payload;

  try {
    const invoiceResponse = await fetch(`${window.BACKEND_API_URL}/api/blink/create-invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: payload.sats,
        memo: payload.donationNote || `Citadel POW - ${payload.donationMode}`,
      }),
    });

    if (!invoiceResponse.ok) {
      let errorMessage = "";
      try {
        const parsed = await invoiceResponse.clone().json();
        errorMessage = parsed?.error || "";
      } catch (error) {
        errorMessage = await invoiceResponse.text();
      }
      throw new Error(errorMessage || "인보이스 생성에 실패했습니다.");
    }

    const invoiceResult = await invoiceResponse.json();
    if (!invoiceResult?.success || !invoiceResult?.data?.invoice) {
      throw new Error("인보이스 응답이 비어 있습니다.");
    }

    const normalizedInvoice = normalizeInvoice(invoiceResult.data.invoice);
    if (!normalizedInvoice) {
      throw new Error("인보이스 형식이 올바르지 않습니다.");
    }

    currentInvoice = normalizedInvoice;

    if (shareStatus) {
      shareStatus.textContent = "지갑 앱을 열었습니다. 결제가 완료되면 직접 '결제 완료' 버튼을 눌러주세요.";
    }

    openWalletSelection({
      invoice: normalizedInvoice,
      message: "원하는 지갑을 선택하면 결제가 이어집니다.",
      onSuccess,
    });
  } catch (error) {
    if (shareStatus) {
      shareStatus.textContent = error?.message
        ? `인보이스 생성 실패: ${error.message}`
        : "인보이스 생성에 실패했습니다.";
    }
    if (walletStatus) {
      walletStatus.textContent = error?.message?.trim() || "인보이스 생성에 실패했습니다.";
    }
    setWalletOptionsEnabled(false);
  }
};

// 지갑 실행
export const launchWallet = async (walletKey) => {
  const modalInvoice = walletModal?.dataset?.invoice;
  if (!modalInvoice) {
    alert("인보이스 정보를 찾을 수 없습니다.");
    return;
  }

  try {
    const invoice = normalizeInvoice(modalInvoice);
    if (!invoice) {
      throw new Error("인보이스 정보가 올바르지 않습니다.");
    }

    const deepLinkBuilder = walletDeepLinks[walletKey];
    const deepLink = deepLinkBuilder ? deepLinkBuilder(invoice) : `lightning:${invoice}`;

    // BUG FIX: 모달을 닫지 않고 지갑만 열기 (polling 유지)
    // closeWalletSelection() 호출 제거 - polling이 계속 실행되어야 결제 확인 가능
    if (walletStatus) {
      walletStatus.textContent = "지갑 앱에서 결제를 완료해주세요. 결제 확인 중...";
    }

    window.location.href = deepLink;
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = error?.message || "지갑 실행에 실패했습니다.";
    }
  }
};

// 인보이스 복사
export const copyWalletInvoice = async () => {
  const invoice = walletModal?.dataset?.invoice || "";
  if (!invoice) return;

  try {
    await navigator.clipboard.writeText(invoice);
    showWalletToast("인보이스가 복사되었습니다.");
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = "인보이스 복사에 실패했습니다.";
    }
  }
};

// 결제 상태 초기화
export const resetPaymentState = () => {
  currentInvoice = null;
  pendingOnSuccessCallback = null;
  currentDonationScope = null;
  currentDonationSats = 0;
  currentDonationPayload = null;

  if (walletModal) {
    walletModal.dataset.invoice = "";
  }
};

// polling cleanup
export const cleanupPaymentPolling = () => {
  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }
};

// 현재 기부 정보 설정
export const setCurrentDonationInfo = (scope, sats, payload) => {
  currentDonationScope = scope;
  currentDonationSats = sats;
  currentDonationPayload = payload;
};

// 현재 기부 정보 가져오기
export const getCurrentDonationInfo = () => ({
  scope: currentDonationScope,
  sats: currentDonationSats,
  payload: currentDonationPayload,
  invoice: currentInvoice,
});
