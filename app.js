const timerDisplay = document.getElementById("timer-display");
const goalInput = document.getElementById("goal-minutes");
const totalTodayEl = document.getElementById("total-today");
const goalProgressEl = document.getElementById("goal-progress");
const satsRateInput = document.getElementById("sats-rate");
const satsTotalEl = document.getElementById("sats-total");
const satsTotalAllEl = document.getElementById("sats-total-all");
const finishButton = document.getElementById("finish");
const studyPlanInput = document.getElementById("study-plan");
const planStatus = document.getElementById("plan-status");
const shareDiscordButton = document.getElementById("share-discord");
const shareStatus = document.getElementById("share-status");
const donationMode = document.getElementById("donation-mode");
const donationScope = document.getElementById("donation-scope");
const sessionPagination = document.getElementById("session-pagination");

const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const resetButton = document.getElementById("reset");

const timerModal = document.getElementById("timer-modal");

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
const sessionList = document.getElementById("session-list");
const sessionEmpty = document.getElementById("session-empty");
const loginUser = document.getElementById("login-user");
const loginUserName = document.getElementById("login-user-name");

const studyPlanPreview = document.getElementById("study-plan-preview");
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

const donationNote = document.getElementById("donation-note");
const donateButton = document.getElementById("donate");
const donationStatus = document.getElementById("donation-status");
const donationHistory = document.getElementById("donation-history");
const donationHistoryEmpty = document.getElementById("donation-history-empty");
const donationPagination = document.getElementById("donation-pagination");
const currentTotalSats = document.getElementById("current-total-sats");
const donationPageDonated = document.getElementById("donation-page-donated");
const donationPageAccumulated = document.getElementById("donation-page-accumulated");
const donationPageAccumulatedRow = document.getElementById("donation-page-accumulated-row");
const donationPagePay = document.getElementById("donation-page-pay");
const todayTotalDonated = document.getElementById("today-total-donated");
const todayAccumulatedRow = document.getElementById("today-accumulated-row");
const todayAccumulatedSats = document.getElementById("today-accumulated-sats");
const todayAccumulatedPay = document.getElementById("today-accumulated-pay");
const walletModal = document.getElementById("wallet-modal");
const walletModalClose = document.getElementById("wallet-modal-close");
const walletStatus = document.getElementById("wallet-status");
const walletOptions = document.querySelectorAll(".wallet-option");
const walletInvoice = document.getElementById("wallet-invoice");
const walletInvoiceQr = document.getElementById("wallet-invoice-qr");
const walletToast = document.getElementById("wallet-toast");
const donationHistoryPagination = document.getElementById("donation-history-pagination");
const accumulationToast = document.getElementById("accumulation-toast");
const accumulationToastMessage = document.getElementById("accumulation-toast-message");
const accumulationToastClose = accumulationToast?.querySelector(".toast-close");
const timerAccumulatedNote = document.getElementById("timer-accumulated-note");

let timerInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let isResetReady = false;
let timerStartTime = null;
let timerEndTime = null;  // ⭐️ 종료시간 기반 타이머
let elapsedOffsetSeconds = 0;
let photoSource = null;
let mediaPreviewUrl = null;
let selectedVideoDataUrl = null;
let selectedVideoFilename = "";
let latestDonationPayload = null;
let sessionPage = 1;
let donationPage = 1;
let donationHistoryPage = 1;
const pendingDailyKey = "citadel-pending-daily";
let walletToastTimeout = null;
let currentDiscordId = null; // 현재 로그인한 사용자의 Discord ID
let pendingDailyCache = null; // API 호출 결과 캐시
let sessionsCache = null; // POW 세션 캐시
let donationsCache = null; // 기부 기록 캐시
let backendAccumulatedSats = 0; // 백엔드에서 조회한 적립액 (하이브리드 시스템)
let currentSession = null; // 현재 세션 (메모리 변수, localStorage 제거)

const donationControls = [
  donationScope,
  donationMode,
  satsRateInput,
];

// 토글 버튼 초기화
const toggleButtons = document.querySelectorAll('.toggle-button');
const donationScopeKey = 'citadel-donation-scope';

// 저장된 토글 상태 복원
const savedDonationScope = localStorage.getItem(donationScopeKey) || 'session';

// donationScope input이 있으면 값 설정
if (donationScope) {
  donationScope.value = savedDonationScope;
}

// 토글 버튼이 있으면 초기화
if (toggleButtons.length > 0) {
  toggleButtons.forEach(button => {
    const value = button.getAttribute('data-value');
    if (value === savedDonationScope) {
      button.classList.add('active');
    } else {
      button.classList.remove('active');
    }
  });

  // 토글 버튼 클릭 이벤트
  toggleButtons.forEach(button => {
    button.addEventListener('click', async () => {
      // 모든 버튼에서 active 클래스 제거
      toggleButtons.forEach(btn => btn.classList.remove('active'));
      // 클릭한 버튼에 active 클래스 추가
      button.classList.add('active');
      // hidden input 값 업데이트
      const value = button.getAttribute('data-value');
      if (donationScope) {
        donationScope.value = value;
        // localStorage에 캐시 (백엔드 실패 시 폴백)
        localStorage.setItem(donationScopeKey, value);

        // ⭐️ 백엔드에 저장
        if (currentDiscordId && typeof UserAPI !== 'undefined') {
          try {
            await UserAPI.updateSettings(currentDiscordId, {
              donation_scope: value,
            });
            console.log(`✅ donation_scope를 백엔드에 저장: ${value}`);
          } catch (error) {
            console.error('donation_scope 백엔드 저장 실패:', error);
            // 실패해도 localStorage는 유지
          }
        }

        // 기존 change 이벤트 트리거
        donationScope.dispatchEvent(new Event('change'));
      }
    });
  });
}

const getDonationScopeValue = () => donationScope?.value || "session";

const updateShareButtonLabel = () => {
  if (!shareDiscordButton) {
    return;
  }
  shareDiscordButton.textContent =
    getDonationScopeValue() === "total"
      ? "디스코드에 공유"
      : "디스코드에 공유 & 사토시 기부";
};

const updateTodayDonationSummary = () => {
  if (!todayTotalDonated && !todayAccumulatedRow && !todayAccumulatedSats) {
    return;
  }
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

const setDonationControlsEnabled = (enabled) => {
  donationControls.forEach((control) => {
    if (control) {
      control.disabled = !enabled;
    }
  });
};

const showAccumulationToast = (message) => {
  if (!accumulationToast) {
    return;
  }
  if (accumulationToastMessage) {
    accumulationToastMessage.textContent = message;
  } else {
    accumulationToast.textContent = message;
  }
  accumulationToast.classList.remove("hidden");
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const todayKey = getTodayKey();
const planKey = `citadel-plan-${todayKey}`;
const sessionsKey = `citadel-sessions-${todayKey}`;
const lastSessionKey = `citadel-last-session-${todayKey}`;
const donationHistoryKey = "citadel-donations";

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // 1시간 이상: "00시간 00분 00초"
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}시간 ${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
  }

  // 1시간 미만: "00분 00초"
  return `${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
};

const formatMinutesSeconds = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  // 1시간 이상: "00시간 00분 00초"
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}시간 ${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
  }

  // 1시간 미만: "00분 00초"
  return `${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
};

const parseSatsRate = (value) => {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatSatsRateInput = () => {
  if (!satsRateInput) {
    return;
  }
  const numeric = parseSatsRate(satsRateInput.value);
  satsRateInput.value = numeric ? `${numeric}sats` : "";
};

const getGoalProgressFor = (totalSeconds, goalMinutes) => {
  if (!goalMinutes || goalMinutes <= 0) {
    return 0;
  }
  return Math.min(100, (totalSeconds / 60 / goalMinutes) * 100);
};

const parseGoalMinutes = () => {
  if (!goalInput) {
    return 0;
  }
  const cleaned = String(goalInput.value || "").replace(/[^\d]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const getCurrentGoalMinutes = () => parseGoalMinutes();

const getGoalProgress = (totalSeconds) => getGoalProgressFor(totalSeconds, getCurrentGoalMinutes());

// ⭐️ 백엔드에서 오늘의 총 공부 시간 계산 (localStorage 제거)
const getTotalSecondsToday = () => {
  if (!sessionsCache || !Array.isArray(sessionsCache)) {
    return 0;
  }
  return sessionsCache.reduce((sum, session) => {
    return sum + (session.durationSeconds || 0);
  }, 0);
};

const normalizeInvoice = (invoice) => {
  if (!invoice) {
    return "";
  }
  const trimmed = String(invoice).trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.toLowerCase().startsWith("lightning:")
    ? trimmed.slice("lightning:".length).trim()
    : trimmed;
};

const getLightningUri = (invoice) => `lightning:${normalizeInvoice(invoice)}`;

// 적립액 데이터 가져오기 (동기, 캐시 사용)
const getPendingDaily = () => {
  // 캐시가 있으면 반환
  if (pendingDailyCache !== null) {
    return pendingDailyCache;
  }

  // 캐시가 없으면 localStorage에서 가져오기
  try {
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

// 적립액 데이터를 API에서 로드 (비동기, 초기화 시 호출)
const loadPendingDailyFromAPI = async () => {
  if (!currentDiscordId || typeof AccumulatedSatsAPI === 'undefined') {
    return;
  }

  try {
    // ⭐️ 하이브리드 시스템: 백엔드에서 총 적립액 조회
    const response = await AccumulatedSatsAPI.get(currentDiscordId);
    if (response.success && response.data) {
      backendAccumulatedSats = response.data.accumulated_sats || 0;
      console.log(`✅ 백엔드 적립액 로드 완료: ${backendAccumulatedSats} sats`);

      // localStorage에도 캐시 (폴백용)
      localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
    } else {
      // 데이터가 없는 경우
      backendAccumulatedSats = 0;
      console.log('백엔드 적립액 없음, 0으로 초기화');
    }
  } catch (error) {
    console.error('❌ 백엔드에서 적립액 가져오기 실패:', error);
    // 폴백: localStorage에서 읽기
    const cached = localStorage.getItem('citadel-backend-accumulated-sats');
    if (cached) {
      backendAccumulatedSats = parseInt(cached, 10) || 0;
      console.log(`폴백: localStorage에서 적립액 로드 (${backendAccumulatedSats} sats)`);
    }
  }
};

// ⚠️ DEPRECATED: 하이브리드 시스템에서 더 이상 사용하지 않음
// 적립액은 Discord 공유 시 AccumulatedSatsAPI.add()로 저장
// localStorage는 각 위치에서 직접 setItem으로 저장
// const savePendingDaily = async (pending) => {
//   localStorage.setItem(pendingDailyKey, JSON.stringify(pending));
// };

const updateTotals = () => {
  const totalSeconds = getTotalSecondsToday();
  if (totalTodayEl) {
    totalTodayEl.textContent = formatTime(totalSeconds);
  }
  if (goalProgressEl) {
    goalProgressEl.textContent = `${getGoalProgress(totalSeconds).toFixed(1)}%`;
  }
  updateSats();
};

const updateDisplay = () => {
  if (!timerDisplay) {
    return;
  }
  timerDisplay.textContent = formatTime(elapsedSeconds);
};

const setPauseButtonLabel = (label) => {
  if (!pauseButton) {
    return;
  }
  pauseButton.textContent = label;
};

const setResetButtonLabel = (label) => {
  if (!resetButton) {
    return;
  }
  resetButton.textContent = label;
};

const openTimerModal = () => {
  if (!timerModal) {
    return;
  }
  timerModal.classList.remove("hidden");
  timerModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("timer-modal-open");
  document.documentElement.classList.add("timer-modal-open");
};

const closeTimerModal = () => {
  if (!timerModal) {
    return;
  }
  timerModal.classList.add("hidden");
  timerModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("timer-modal-open");
  document.documentElement.classList.remove("timer-modal-open");
};

const syncElapsedTime = () => {
  if (!isRunning || timerStartTime === null) {
    return;
  }
  const now = Date.now();
  const nextElapsed =
    elapsedOffsetSeconds + Math.floor((now - timerStartTime) / 1000);
  if (nextElapsed === elapsedSeconds) {
    return;
  }
  elapsedSeconds = nextElapsed;
  updateDisplay();
  updateSats();
  if (elapsedSeconds % 30 === 0) {
    updateTotals();
  }
  const goalMinutes = Number(goalInput.value || 0);
  if (goalMinutes > 0 && elapsedSeconds >= goalMinutes * 60) {
    finishButton.classList.add("accent");
  }
};

const tick = () => {
  syncElapsedTime();
};

const startTimer = () => {
  if (isRunning) {
    return;
  }
  isRunning = true;
  timerStartTime = Date.now();
  elapsedOffsetSeconds = elapsedSeconds;

  // ⭐️ 종료시간 계산 및 저장 (백그라운드 동작 지원)
  const goalMinutes = parseInt(goalInput?.value) || 0;
  if (goalMinutes > 0 && elapsedSeconds === 0) {
    // 새로 시작하는 경우에만 종료시간 계산
    timerEndTime = Date.now() + (goalMinutes * 60 * 1000);
    localStorage.setItem('citadel-timer-end', timerEndTime.toString());
    localStorage.setItem('citadel-timer-goal', goalMinutes.toString());
  } else if (timerEndTime) {
    // 재개하는 경우 기존 종료시간 유지
    localStorage.setItem('citadel-timer-end', timerEndTime.toString());
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

const pauseTimer = () => {
  if (!isRunning) {
    return;
  }
  syncElapsedTime();
  isRunning = false;
  clearInterval(timerInterval);
  timerStartTime = null;
  elapsedOffsetSeconds = elapsedSeconds;
  setPauseButtonLabel("재개");
};

const resetTimer = () => {
  pauseTimer();
  elapsedSeconds = 0;
  elapsedOffsetSeconds = 0;
  timerStartTime = null;
  timerEndTime = null;  // ⭐️ 종료시간 초기화
  localStorage.removeItem('citadel-timer-end');
  localStorage.removeItem('citadel-timer-goal');

  // ⭐️ 인보이스 관련 전역 변수 초기화 (새 POW 활동 대비)
  currentInvoice = null;
  pendingOnSuccessCallback = null;
  currentDonationScope = null;
  currentDonationSats = 0;
  currentDonationPayload = null;

  // ⭐️ 모달 dataset invoice 초기화 (예전 invoice 재사용 방지)
  if (walletModal) {
    walletModal.dataset.invoice = "";
  }

  updateDisplay();
  updateSats();
  setDonationControlsEnabled(true);
  setPauseButtonLabel("일시정지");
};

const getPlanValue = () => {
  return studyPlanInput?.value.trim() || localStorage.getItem(planKey) || "";
};

// POW 세션 데이터를 API에서 로드 (비동기, 초기화 시 호출)
const loadSessionsFromAPI = async () => {
  if (!currentDiscordId || typeof StudySessionAPI === 'undefined') {
    return;
  }

  try {
    const response = await StudySessionAPI.getToday(currentDiscordId);
    if (response.success && response.data) {
      // API 응답을 localStorage 형식으로 변환
      const sessions = response.data.map(apiSession => {
        const durationSeconds = apiSession.duration_seconds || (apiSession.duration_minutes * 60);
        const goalMinutes = apiSession.goal_minutes || 0;
        return {
          durationSeconds,
          goalMinutes,
          plan: apiSession.plan_text || "",
          achieved: apiSession.achievement_rate >= 100, // 달성 여부
          timestamp: apiSession.created_at,
          sessionId: apiSession.id,
        };
      });
      sessionsCache = sessions;
      // localStorage에도 저장 (폴백용)
      localStorage.setItem(sessionsKey, JSON.stringify(sessions));
      console.log('API에서 POW 세션 로드 완료:', sessions.length, '개');
      return sessions;
    } else {
      sessionsCache = [];
      return [];
    }
  } catch (error) {
    console.error('API에서 POW 세션 가져오기 실패:', error);
    sessionsCache = [];
    return [];
  }
};

const loadSessions = (key = sessionsKey) => {
  // 캐시가 있으면 반환
  if (sessionsCache !== null) {
    return sessionsCache;
  }

  // 캐시가 없으면 localStorage에서 가져오기
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    const result = Array.isArray(parsed) ? parsed : [];
    sessionsCache = result;
    return result;
  } catch (error) {
    sessionsCache = [];
    return [];
  }
};

// 기부 기록을 API에서 로드 (비동기, 초기화 시 호출)
const loadDonationsFromAPI = async () => {
  if (!currentDiscordId || typeof DonationAPI === 'undefined') {
    return;
  }

  try {
    const response = await DonationAPI.getByUser(currentDiscordId);
    if (response.success && response.user && response.user.donations) {
      // API 응답을 localStorage 형식으로 변환
      const donations = response.user.donations.map(apiDonation => {
        return {
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
        };
      });
      donationsCache = donations;
      // localStorage에도 저장 (폴백용)
      localStorage.setItem(donationHistoryKey, JSON.stringify(donations));
      console.log('API에서 기부 기록 로드 완료:', donations.length, '개');
      return donations;
    } else {
      donationsCache = [];
      return [];
    }
  } catch (error) {
    console.error('API에서 기부 기록 가져오기 실패:', error);
    donationsCache = [];
    return [];
  }
};

const saveSessions = (sessions, key = sessionsKey) => {
  localStorage.setItem(key, JSON.stringify(sessions));
  sessionsCache = sessions;
};

// ⭐️ 메모리 변수 사용 (localStorage 제거, 백엔드가 Source of Truth)
const getLastSessionSeconds = () => {
  // 메모리 변수에 있으면 반환
  if (currentSession) {
    return currentSession;
  }

  // 메모리에 없으면 sessionsCache에서 최근 세션 가져오기
  if (sessionsCache && sessionsCache.length > 0) {
    const latestSession = sessionsCache[sessionsCache.length - 1];
    return {
      durationSeconds: latestSession.durationSeconds || 0,
      goalMinutes: latestSession.goalMinutes || 0,
      plan: latestSession.plan || "",
      sessionId: latestSession.sessionId || "",
    };
  }

  // 없으면 기본값
  return { durationSeconds: 0, goalMinutes: 0, plan: "", sessionId: "" };
};

const setLastSessionSeconds = (value) => {
  // 메모리 변수에만 저장 (localStorage 제거)
  currentSession = value;
};

const renderSessionItems = (sessions, listEl, emptyEl, { startIndex = 0 } = {}) => {
  if (!listEl) {
    return;
  }
  listEl.innerHTML = "";
  if (emptyEl) {
    emptyEl.style.display = sessions.length ? "none" : "block";
  }
  sessions.forEach((session, index) => {
    const item = document.createElement("div");
    item.className = "session-item";
    const achieved = session.achieved;
    const sessionGoalRate = session.goalMinutes
      ? Math.min(100, (session.durationSeconds / 60 / session.goalMinutes) * 100)
      : 0;
    item.innerHTML = `
      <div class="session-header">
        <span class="session-index">${startIndex + index + 1}회차</span>
        <span class="session-status ${achieved ? "success" : "pending"}">${
      achieved ? "달성" : "미달성"
    }</span>
      </div>
      <div class="session-meta">
        <div>실제 POW 시간: <strong>${formatMinutesSeconds(
          session.durationSeconds
        )}</strong> <span class="session-rate">(${sessionGoalRate.toFixed(
      1
    )}%)</span></div>
        <div>목표 POW 시간: <strong>${session.goalMinutes}분</strong></div>
        <div>오늘의 POW 목표: <strong>${session.plan || "미입력"}</strong></div>
      </div>
    `;
    listEl.appendChild(item);
  });
};

const renderPagination = ({ container, currentPage, totalPages, onPageChange }) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  if (totalPages <= 1) {
    return;
  }
  for (let page = 1; page <= totalPages; page += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-button";
    if (page === currentPage) {
      button.classList.add("active");
    }
    button.textContent = String(page);
    button.addEventListener("click", () => {
      if (page !== currentPage) {
        onPageChange(page);
      }
    });
    container.appendChild(button);
  }
};

const renderSessions = () => {
  if (!sessionList) {
    return;
  }
  const sessions = loadSessions();
  const perPage = 2;
  const totalPages = Math.max(1, Math.ceil(sessions.length / perPage));
  if (sessionPage > totalPages) {
    sessionPage = totalPages;
  }
  const startIndex = (sessionPage - 1) * perPage;
  const pagedSessions = sessions.slice(startIndex, startIndex + perPage);
  renderSessionItems(pagedSessions, sessionList, sessionEmpty, { startIndex });
  renderPagination({
    container: sessionPagination,
    currentPage: sessionPage,
    totalPages,
    onPageChange: (page) => {
      sessionPage = page;
      renderSessions();
    },
  });
};

const getSessionStorageDates = () => {
  const dates = new Set();
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith("citadel-sessions-")) {
      continue;
    }
    dates.add(key.replace("citadel-sessions-", ""));
  }
  return Array.from(dates).sort().reverse();
};

const renderStudyHistoryPage = () => {
  const dateSelect = document.getElementById("study-date-select");
  const listEl = document.getElementById("study-history-list");
  const emptyEl = document.getElementById("study-history-empty");
  const currentLabel = document.getElementById("study-history-date");
  const leaderboardEl = document.getElementById("study-leaderboard");
  if (!dateSelect || !listEl || !emptyEl) {
    return;
  }
  const totalSeconds = getAllSessionsTotalSeconds();
  renderLeaderboard({
    element: leaderboardEl,
    entries: totalSeconds
      ? [
          {
            name: "나",
            value: totalSeconds,
          },
        ]
      : [],
    valueFormatter: (value) => formatMinutesSeconds(value),
  });
  const dates = getSessionStorageDates();
  dateSelect.innerHTML = "";
  if (!dates.length) {
    emptyEl.style.display = "block";
    if (currentLabel) {
      currentLabel.textContent = "기록 없음";
    }
    return;
  }
  dates.forEach((date) => {
    const option = document.createElement("option");
    option.value = date;
    option.textContent = date;
    dateSelect.appendChild(option);
  });
  const renderForDate = (dateKey) => {
    const sessions = loadSessions(`citadel-sessions-${dateKey}`);
    renderSessionItems(sessions, listEl, emptyEl);
    if (currentLabel) {
      currentLabel.textContent = dateKey;
    }
  };
  const initialDate = dates[0];
  dateSelect.value = initialDate;
  renderForDate(initialDate);
  dateSelect.addEventListener("change", (event) => {
    renderForDate(event.target.value);
  });
};

const finishSession = () => {
  if (elapsedSeconds === 0) {
    finishButton.textContent = "기록할 시간이 없습니다";
    setTimeout(() => {
      finishButton.textContent = "POW 종료";
    }, 2000);
    return;
  }
  pauseTimer();
  const plan = getPlanValue();
  const goalMinutes = parseGoalMinutes();
  const achieved = goalMinutes > 0 ? elapsedSeconds >= goalMinutes * 60 : false;
  const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const sessions = loadSessions();
  const sessionTimestamp = new Date().toISOString();
  const sessionData = {
    durationSeconds: elapsedSeconds,
    goalMinutes,
    plan,
    achieved,
    timestamp: sessionTimestamp,
    sessionId,
  };
  sessions.push(sessionData);
  saveSessions(sessions);

  // 백엔드에 공부 세션 저장
  if (typeof StudySessionAPI !== 'undefined') {
    const endTime = new Date(sessionTimestamp);
    const startTime = new Date(endTime.getTime() - elapsedSeconds * 1000);

    // 인증카드 이미지 가져오기
    (async () => {
      let photoDataUrl = null;
      if (typeof getBadgeDataUrl === 'function') {
        photoDataUrl = getBadgeDataUrl();
        // 인증카드가 생성되지 않았으면 자동 생성 (사진 유무와 관계없이)
        if (!photoDataUrl || photoDataUrl === "data:,") {
          if (typeof drawBadge === 'function') {
            drawBadge();
            photoDataUrl = getBadgeDataUrl();
          }
        }
      }

      // POW 분야 이모지 가져오기
      const currentMode = donationMode?.value || "pow-writing";
      const modeEmoji = getCategoryLabel(currentMode);
      const planWithCategory = modeEmoji ? `${modeEmoji} ${plan}` : plan;

      // 달성률 계산 (초 단위로 정확하게 계산)
      const actualMinutes = Math.round(elapsedSeconds / 60);
      const achievementRate = goalMinutes > 0
        ? Math.round((elapsedSeconds / 60 / goalMinutes) * 100)
        : 0;

      // 현재 로그인한 사용자 정보 가져오기
      try {
        const res = await fetch('/api/session');
        const sessionData = await res.json();
        if (sessionData.authenticated && sessionData.user?.id) {
          await StudySessionAPI.create(sessionData.user.id, {
            donationMode: currentMode,
            planText: planWithCategory,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            durationSeconds: elapsedSeconds,
            durationMinutes: actualMinutes,
            goalMinutes: goalMinutes || 0,
            achievementRate: achievementRate,
            photoUrl: photoDataUrl,
            donationId: null,
          });
          console.log('공부 세션이 백엔드에 저장되었습니다.');
        }
      } catch (err) {
        console.error('백엔드 세션 저장 오류:', err);
      }
    })();
  }

  sessionPage = Math.ceil(sessions.length / 2);
  // ⭐️ setStoredTotal() 제거 - 백엔드에서 자동 계산
  setLastSessionSeconds({ durationSeconds: elapsedSeconds, goalMinutes, plan, sessionId });
  if (donationScope?.value === "total") {
    const pending = getPendingDaily();
    const entry = pending[todayKey] || {
      seconds: 0,
      sats: 0,
      plan: "",
      goalMinutes: 0,
      mode: donationMode?.value || "pow-writing",
      note: "",
    };
    const rate = parseSatsRate(satsRateInput?.value);
    const sessionSats = calculateSats({
      rate,
      seconds: elapsedSeconds,
    });
    entry.seconds += elapsedSeconds;
    entry.sats += sessionSats;
    entry.plan = plan || entry.plan;
    entry.goalMinutes = goalMinutes || entry.goalMinutes;
    entry.mode = donationMode?.value || entry.mode;
    pending[todayKey] = entry;
    // localStorage만 저장 (백엔드는 Discord 공유 시 저장)
    localStorage.setItem(pendingDailyKey, JSON.stringify(pending));
    showAccumulationToast(
      `기부금 * 달성률을 곱해서 ${sessionSats} sats가 적립되었습니다.`
    );
  }
  elapsedSeconds = 0;

  // ⭐️ 인보이스 관련 전역 변수 초기화 (새 POW 활동 대비)
  currentInvoice = null;
  pendingOnSuccessCallback = null;
  currentDonationScope = null;
  currentDonationSats = 0;
  currentDonationPayload = null;

  // ⭐️ 모달 dataset invoice 초기화 (예전 invoice 재사용 방지)
  if (walletModal) {
    walletModal.dataset.invoice = "";
  }

  updateDisplay();
  updateTotals();
  // updateAccumulatedSats(); // Discord 공유 성공 후에만 적립액 표시
  updateTodayDonationSummary();
  renderSessions();
  finishButton.textContent = "인증 카드 만들기 완료!";
  setTimeout(() => {
    finishButton.textContent = "POW 종료";
  }, 2000);
  if (photoSource) {
    drawBadge();
  }
  setDonationControlsEnabled(true);
  closeTimerModal();
  setResetButtonLabel("리셋");
  isResetReady = false;
  if (studyCard) {
    studyCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  openCameraButton?.focus();
};

const getDonationHistory = () => {
  // 캐시가 있으면 반환
  if (donationsCache !== null) {
    return donationsCache;
  }

  // 캐시가 없으면 localStorage에서 가져오기
  try {
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

const isPaidEntry = (entry) => entry?.isPaid !== false;

const getTotalDonatedSats = () =>
  getDonationHistory().reduce(
    (sum, item) => (isPaidEntry(item) ? sum + Number(item.sats || 0) : sum),
    0
  );

const renderLeaderboard = ({ element, entries, valueFormatter }) => {
  if (!element) {
    return;
  }
  element.innerHTML = "";
  const maxCount = 5;
  const safeEntries = Array.isArray(entries) ? entries.slice(0, maxCount) : [];
  for (let index = 0; index < maxCount; index += 1) {
    const entry = safeEntries[index];
    const item = document.createElement("li");
    item.className = "leaderboard-item";
    const rank = index + 1;
    if (entry) {
      const valueLabel = valueFormatter ? valueFormatter(entry.value) : String(entry.value);
      item.innerHTML = `<span>${rank}위 · <strong>${entry.name}</strong></span><span>${valueLabel}</span>`;
    } else {
      item.innerHTML = `<span>${rank}위 · <strong>대기 중</strong></span><span>-</span>`;
    }
    element.appendChild(item);
  }
};

const getDonatedSecondsByScope = ({ scope, dateKey } = {}) => {
  const history = getDonationHistory();
  const uniqueSessions = new Set();
  let totalSeconds = 0;
  history.forEach((entry) => {
    if (!isPaidEntry(entry)) {
      return;
    }
    if (scope && entry.scope !== scope) {
      return;
    }
    if (dateKey && entry.date !== dateKey) {
      return;
    }
    const entrySessionId = entry.sessionId || "";
    if (entrySessionId && uniqueSessions.has(entrySessionId)) {
      return;
    }
    if (entrySessionId) {
      uniqueSessions.add(entrySessionId);
    }
    const seconds =
      typeof entry.seconds === "number"
        ? entry.seconds
        : Number(entry.minutes || 0) * 60;
    totalSeconds += seconds;
  });
  return totalSeconds;
};

const getAllSessionsTotalSeconds = () => {
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

const getDonationSeconds = () => {
  const scope = getDonationScopeValue();
  if (scope === "session") {
    return getLastSessionSeconds().durationSeconds;
  }
  if (scope === "total") {
    // 적립 후 기부 모드: pending daily에서 적립된 시간 사용
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

const getSessionEstimateSeconds = () => {
  if (elapsedSeconds > 0) {
    return elapsedSeconds;
  }
  return getLastSessionSeconds().durationSeconds;
};

const calculateSatsForGoal = ({ rate, seconds, goalMinutes }) => {
  if (!rate) {
    return 0;
  }
  const progressRate = getGoalProgressFor(seconds, goalMinutes) / 100;
  return Math.round(rate * progressRate);
};

const calculateSats = ({ rate, seconds, goalMinutes }) =>
  calculateSatsForGoal({
    rate,
    seconds,
    goalMinutes: goalMinutes ?? getCurrentGoalMinutes(),
  });

const getSessionAccumulatedSats = () => {
  const rate = parseSatsRate(satsRateInput?.value);
  const lastSession = getLastSessionSeconds();
  return calculateSats({
    rate,
    seconds: lastSession.durationSeconds || 0,
  });
};

const getSessionSatsRate = (session) =>
  parseSatsRate(session?.satsRate ?? satsRateInput?.value);

const calculateSessionAccumulatedSats = (session, secondsOverride) =>
  calculateSatsForGoal({
    rate: getSessionSatsRate(session),
    seconds: secondsOverride ?? Number(session?.durationSeconds || 0),
    goalMinutes: Number(session?.goalMinutes || 0),
  });

const getAccumulatedSatsForScope = (scope) => {
  if (scope === "daily") {
    const sessions = loadSessions();
    const total = sessions.reduce(
      (sum, session) => sum + calculateSessionAccumulatedSats(session),
      0
    );
    const running =
      elapsedSeconds > 0
        ? calculateSatsForGoal({
            rate: parseSatsRate(satsRateInput?.value),
            seconds: elapsedSeconds,
            goalMinutes: getCurrentGoalMinutes(),
          })
        : 0;
    return total + running;
  }
  if (scope === "total") {
    const dates = getSessionStorageDates();
    const savedTotal = dates.reduce((sum, dateKey) => {
      const sessions = loadSessions(`citadel-sessions-${dateKey}`);
      const dayTotal = sessions.reduce(
        (daySum, session) => daySum + calculateSessionAccumulatedSats(session),
        0
      );
      return sum + dayTotal;
    }, 0);
    const running =
      elapsedSeconds > 0
        ? calculateSatsForGoal({
            rate: parseSatsRate(satsRateInput?.value),
            seconds: elapsedSeconds,
            goalMinutes: getCurrentGoalMinutes(),
          })
        : 0;
    return savedTotal + running;
  }
  return 0;
};

const getDonatedSatsByScope = ({ scope, dateKey } = {}) =>
  getDonationHistory().reduce((sum, entry) => {
    if (!isPaidEntry(entry)) {
      return sum;
    }
    if (scope && entry.scope !== scope) {
      return sum;
    }
    if (dateKey && entry.date !== dateKey) {
      return sum;
    }
    return sum + Number(entry.sats || 0);
  }, 0);

// ⭐️ 방안 A: 현재 세션의 sats 계산 (B - 오늘 받을 용돈)
const getCurrentSessionSats = () => {
  const rate = parseSatsRate(satsRateInput?.value);
  return calculateSats({
    rate,
    seconds: getDonationSeconds(),
  });
};

// ⭐️ 방안 A: UI 표시 및 계산용 함수
const getDonationSatsForScope = () => {
  // 적립 후 기부 모드: 백엔드 적립액 사용 (A' - 저금통 총액)
  if (getDonationScopeValue() === "total") {
    return backendAccumulatedSats;
  }

  // 즉시 기부 모드: 현재 세션 sats 계산 (B)
  return getCurrentSessionSats();
};

const getDonationPaymentSnapshot = () => {
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

const updateAccumulatedSats = () => {
  const sats = getDonationSatsForScope();
  if (currentTotalSats) {
    currentTotalSats.textContent = `${sats} sats`;
  }
  if (timerAccumulatedNote) {
    timerAccumulatedNote.classList.toggle(
      "hidden",
      getDonationScopeValue() !== "total"
    );
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

const updateSats = () => {
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

const renderDonationHistory = () => {
  if (!donationHistory || !donationHistoryEmpty) {
    return;
  }
  const history = getDonationHistory().filter((item) => item.date === todayKey).reverse();
  donationHistory.innerHTML = "";
  donationHistoryEmpty.style.display = history.length ? "none" : "block";
  const perPage = 5;
  const totalPages = Math.max(1, Math.ceil(history.length / perPage));
  if (donationPage > totalPages) {
    donationPage = totalPages;
  }
  const startIndex = (donationPage - 1) * perPage;
  const pagedHistory = history.slice(startIndex, startIndex + perPage);
  pagedHistory.forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "history-item";
    const scopeLabels = { session: "회차 별", daily: "하루 단위", total: "누적 후 한번에" };
    const scopeLabel = scopeLabels[item.scope] || "누적";
    const modeLabel = donationModeLabels[item.mode] || "✒️ㅣ글쓰기";
    entry.innerHTML = `
      <div><strong>${item.date}</strong> · ${scopeLabel} · ${modeLabel}</div>
      <div>기부: <strong>${item.sats} sats</strong> · ${item.minutes}분</div>
      <div>메모: ${item.note || "없음"}</div>
    `;
    donationHistory.appendChild(entry);
  });
  renderPagination({
    container: donationPagination,
    currentPage: donationPage,
    totalPages,
    onPageChange: (page) => {
      donationPage = page;
      renderDonationHistory();
    },
  });
};

const updateDonationTotals = () => {
  const total = getTotalDonatedSats();
  if (satsTotalAllEl) {
    satsTotalAllEl.textContent = `${total} sats`;
  }
  if (donationPageDonated) {
    donationPageDonated.textContent = `${total} sats`;
  }
  updateAccumulatedSats();
  updateTodayDonationSummary();
};

const donationModeLabels = {
  "pow-writing": "✒️ㅣ글쓰기",
  "pow-music": "🎵ㅣ음악",
  "pow-study": "📝ㅣ공부",
  "pow-art": "🎨ㅣ그림",
  "pow-reading": "📚ㅣ독서",
  "pow-service": "✝️ㅣ봉사",
};

// POW 카테고리 이모지만 가져오기
const getCategoryLabel = (category) => {
  const labels = {
    "pow-writing": "✒️",
    "pow-music": "🎵",
    "pow-study": "📝",
    "pow-art": "🎨",
    "pow-reading": "📚",
    "pow-service": "✝️",
  };
  return labels[category] || "";
};

const getDonationHistoryMonths = () => {
  const history = getDonationHistory();
  const months = new Set();
  history.forEach((entry) => {
    if (entry.date) {
      months.add(entry.date.slice(0, 7));
    }
  });
  return Array.from(months).sort().reverse();
};

const renderDonationHistoryPage = () => {
  const monthSelect = document.getElementById("donation-month-select");
  const listEl = document.getElementById("donation-history-list");
  const emptyEl = document.getElementById("donation-history-empty-page");
  const currentLabel = document.getElementById("donation-history-month");
  const leaderboardEl = document.getElementById("donation-leaderboard");
  if (!monthSelect || !listEl || !emptyEl) {
    return;
  }
  const totalSats = getTotalDonatedSats();
  renderLeaderboard({
    element: leaderboardEl,
    entries: totalSats
      ? [
          {
            name: "나",
            value: totalSats,
          },
        ]
      : [],
    valueFormatter: (value) => `${value} sats`,
  });
  const months = getDonationHistoryMonths();
  monthSelect.innerHTML = "";
  if (!months.length) {
    emptyEl.style.display = "block";
    if (currentLabel) {
      currentLabel.textContent = "기록 없음";
    }
    return;
  }
  months.forEach((month) => {
    const option = document.createElement("option");
    option.value = month;
    option.textContent = month;
    monthSelect.appendChild(option);
  });
  const renderForMonth = (monthKey) => {
    const history = getDonationHistory()
      .filter((entry) => entry.date?.startsWith(monthKey))
      .sort((a, b) => (a.date > b.date ? -1 : 1));
    listEl.innerHTML = "";
    emptyEl.style.display = history.length ? "none" : "block";
    const perPage = 5;
    const totalPages = Math.max(1, Math.ceil(history.length / perPage));
    if (donationHistoryPage > totalPages) {
      donationHistoryPage = totalPages;
    }
    const startIndex = (donationHistoryPage - 1) * perPage;
    const pagedHistory = history.slice(startIndex, startIndex + perPage);
    pagedHistory.forEach((item) => {
      const entry = document.createElement("div");
      entry.className = "history-item";
      const scopeLabels = { session: "회차 별", daily: "하루 단위", total: "누적 후 한번에" };
      const scopeLabel = scopeLabels[item.scope] || "누적";
      const modeLabel = donationModeLabels[item.mode] || "✒️글쓰기📝";
      entry.innerHTML = `
        <div><strong>${item.date}</strong> · ${scopeLabel} · ${modeLabel}</div>
        <div>기부: <strong>${item.sats} sats</strong> · ${item.minutes}분</div>
        <div>메모: ${item.note || "없음"}</div>
      `;
      listEl.appendChild(entry);
    });
    renderPagination({
      container: donationHistoryPagination,
      currentPage: donationHistoryPage,
      totalPages,
      onPageChange: (page) => {
        donationHistoryPage = page;
        renderForMonth(monthKey);
      },
    });
    if (currentLabel) {
      currentLabel.textContent = monthKey;
    }
  };
  const initialMonth = months[0];
  monthSelect.value = initialMonth;
  donationHistoryPage = 1;
  renderForMonth(initialMonth);
  monthSelect.addEventListener("change", (event) => {
    donationHistoryPage = 1;
    renderForMonth(event.target.value);
  });
};

const initializeTotals = () => {
  formatSatsRateInput();
  updateDisplay();
  updateTotals();
  updateDonationTotals();
  updateShareButtonLabel();
  updateTodayDonationSummary();
  renderDonationHistory();
};

const saveDonationHistoryEntry = async ({
  date,
  sats,
  minutes,
  seconds,
  mode,
  scope,
  sessionId = "",
  note = "",
  isPaid = true,
  // POW 정보 (선택적)
  planText = null,
  goalMinutes = null,
  achievementRate = null,
  photoUrl = null,
  // 누적 정보 (선택적)
  accumulatedSats = null,
  totalAccumulatedSats = null,
  totalDonatedSats = null,
}) => {
  const history = getDonationHistory();
  const entry = {
    date,
    sats,
    minutes,
    seconds,
    mode,
    scope,
    sessionId,
    note,
    isPaid,
  };
  history.push(entry);

  // localStorage에 저장 (폴백용)
  localStorage.setItem(donationHistoryKey, JSON.stringify(history));
  donationsCache = history;

  // 로그인한 경우 API에도 저장
  if (currentDiscordId && typeof DonationAPI !== 'undefined' && isPaid) {
    try {
      await DonationAPI.create(currentDiscordId, {
        amount: sats,
        currency: 'SAT',
        date: date,
        durationSeconds: seconds,
        durationMinutes: minutes,
        donationMode: mode,
        donationScope: scope,
        sessionId: sessionId,
        note: note,
        // POW 정보
        planText: planText,
        goalMinutes: goalMinutes,
        achievementRate: achievementRate,
        photoUrl: photoUrl,
        // 누적 정보
        accumulatedSats: accumulatedSats,
        totalAccumulatedSats: totalAccumulatedSats,
        totalDonatedSats: totalDonatedSats,
        // 결제 정보
        transactionId: '',
        status: 'completed',
      });
      console.log('기부 기록이 API에 저장되었습니다.');
    } catch (error) {
      console.error('API에 기부 기록 저장 실패:', error);
      // 실패해도 localStorage에는 저장되어 있음
    }
  }

  updateDonationTotals();
  renderDonationHistory();
};

// ============================================
// 구버전 localStorage → 백엔드 자동 마이그레이션
// ============================================
const promptPendingDailyDonation = async () => {
  // sessionStorage로 중복 방지 (탭 전환 시 팝업 안 뜸)
  if (sessionStorage.getItem('hasPromptedDaily')) {
    return;
  }

  const pending = getPendingDaily();
  const dates = Object.keys(pending).sort();
  const pendingDate = dates.find((date) => date < todayKey);

  if (!pendingDate) {
    sessionStorage.setItem('hasPromptedDaily', 'true');
    return;
  }

  const entry = pending[pendingDate];
  if (!entry || entry.sats <= 0) {
    sessionStorage.setItem('hasPromptedDaily', 'true');
    return;
  }

  // ⭐️ 백엔드로 자동 마이그레이션
  if (currentDiscordId && typeof AccumulatedSatsAPI !== 'undefined') {
    try {
      const result = await AccumulatedSatsAPI.add(
        currentDiscordId,
        entry.sats,
        null,
        `구버전 적립액 마이그레이션 (${pendingDate})`
      );

      console.log(`✅ ${entry.sats}sats를 백엔드로 마이그레이션 완료`);

      // localStorage 정리
      delete pending[pendingDate];
      localStorage.setItem(pendingDailyKey, JSON.stringify(pending));

      // 백엔드 적립액 UI 업데이트
      if (result.success && result.data) {
        backendAccumulatedSats = result.data.amount_after;
        localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
        updateAccumulatedSats();
      }

      // 사용자 알림
      showAccumulationToast(`${entry.sats} sats가 적립되어 있습니다. "오늘 기부 현황"에서 기부할 수 있습니다.`);
    } catch (error) {
      console.error('마이그레이션 실패:', error);
      alert(`적립액 마이그레이션에 실패했습니다: ${error.message || '알 수 없는 오류'}`);
    }
  }

  // 중복 방지 플래그 설정 (sessionStorage)
  sessionStorage.setItem('hasPromptedDaily', 'true');
};

const buildDonationPayload = ({
  dataUrl,
  plan,
  durationSeconds,
  goalMinutes,
  sats,
  donationScopeValue,
  donationModeValue,
  donationNoteValue,
  totalDonatedSats = 0,
  accumulatedSats = 0,
  totalAccumulatedSats = 0,
}) => {
  const goalRate = goalMinutes
    ? Math.min(100, (durationSeconds / 60 / goalMinutes) * 100).toFixed(1)
    : "0.0";
  return {
    dataUrl,
    plan: plan || "목표 미입력",
    studyTime: formatMinutesSeconds(durationSeconds || 0),
    goalRate: `${goalRate}%`,
    minutes: Math.floor((durationSeconds || 0) / 60),
    sats,
    donationMode: donationModeValue || "pow-writing",
    donationScope: donationScopeValue || "total",
    donationNote: donationNoteValue || "",
    totalDonatedSats,
    accumulatedSats,
    totalAccumulatedSats,
    username: loginUserName?.textContent || "",
    videoDataUrl: selectedVideoDataUrl,
    videoFilename: selectedVideoFilename,
  };
};

const openLightningWalletWithPayload = async (payload, { onSuccess } = {}) => {
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
    // Create invoice using backend API
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

    // invoice 저장 (결제 확인용)
    currentInvoice = normalizedInvoice;
    console.log('✅ [DEBUG] currentInvoice 설정됨:', currentInvoice.substring(0, 50) + '...');
    console.log('  - currentDonationScope:', payload.scope);
    console.log('  - currentDonationSats:', payload.sats);

    if (shareStatus) {
      shareStatus.textContent =
        "지갑 앱을 열었습니다. 결제가 완료되면 직접 '결제 완료' 버튼을 눌러주세요.";
    }
    // onSuccess 콜백을 walletSelection으로 전달
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
      walletStatus.textContent =
        error?.message?.trim() || "인보이스 생성에 실패했습니다.";
    }
    setWalletOptionsEnabled(false);
  }
};

const openLightningWallet = async () => {
  const { sats, seconds: donationSeconds, scope } = getDonationPaymentSnapshot();
  let dataUrl = getBadgeDataUrl();
  // 인증카드가 없으면 오류 메시지
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }
  const lastSession = getLastSessionSeconds();
  const totalDonatedSats = getTotalDonatedSats() + sats;
  const totalMinutes = Math.floor(donationSeconds / 60);
  const mode = donationMode?.value || "pow-writing";
  const note = donationNote?.value?.trim() || "";
  const sessionId = scope === "session" ? lastSession.sessionId : "";
  const accumulatedSats = getSessionAccumulatedSats();
  const totalAccumulatedSats = getDonationSatsForScope();
  const payload = buildDonationPayload({
    dataUrl,
    plan: lastSession.plan,
    durationSeconds: donationSeconds,
    goalMinutes: lastSession.goalMinutes,
    sats,
    donationModeValue: mode,
    donationScopeValue: scope,
    donationNoteValue: note,
    totalDonatedSats,
    accumulatedSats,
    totalAccumulatedSats,
  });
  // 달성률 계산
  const achievementRate = lastSession.goalMinutes > 0
    ? Math.round((totalMinutes / lastSession.goalMinutes) * 100)
    : 0;

  // 현재 기부 타입 및 정보 저장
  currentDonationScope = scope;
  currentDonationSats = sats;
  currentDonationPayload = payload;
  console.log('📝 [DEBUG] 기부 정보 저장됨 (openLightningWallet)');
  console.log('  - scope:', scope);
  console.log('  - sats:', sats);

  await openLightningWalletWithPayload(payload, {
    onSuccess: async () => {
      // Discord 공유 먼저 실행
      try {
        await shareToDiscordAPI({
          sessionId: sessionId,
          dataUrl: dataUrl,
          planText: lastSession.plan,
          durationSeconds: donationSeconds,
          donationScope: scope,
          donationSats: sats,
          totalDonatedSats: totalDonatedSats,
          totalAccumulatedSats: totalAccumulatedSats,
          donationNote: note,
        });
      } catch (error) {
        console.error("Discord 공유 실패:", error);
        alert("Discord 공유에 실패했습니다: " + error.message);
      }

      // 기부 기록 저장
      saveDonationHistoryEntry({
        date: todayKey,
        sats,
        minutes: totalMinutes,
        seconds: donationSeconds,
        mode,
        scope,
        sessionId,
        note,
        isPaid: true,
        // POW 정보
        planText: lastSession.plan,
        goalMinutes: lastSession.goalMinutes,
        achievementRate: achievementRate,
        photoUrl: dataUrl,
        // 누적 정보
        accumulatedSats: scope === "session" ? 0 : accumulatedSats,
        totalAccumulatedSats: totalAccumulatedSats,
        totalDonatedSats: totalDonatedSats,
      });

      showAccumulationToast("기부 및 Discord 공유가 완료되었습니다. 페이지를 새로고침합니다...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
  });
};

const openAccumulatedDonationPayment = async () => {
  if (getDonationScopeValue() !== "total") {
    return;
  }
  const sats = getDonationSatsForScope();
  const donationSeconds = getDonationSeconds();
  if (!sats || sats <= 0 || donationSeconds <= 0) {
    alert("기부할 적립 금액이 없습니다.");
    return;
  }
  let dataUrl = getBadgeDataUrl();
  // 인증카드가 없으면 오류 메시지
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }
  const lastSession = getLastSessionSeconds();
  const totalMinutes = Math.floor(donationSeconds / 60);
  const mode = donationMode?.value || "pow-writing";
  const note = donationNote?.value?.trim() || "";
  const totalDonatedSats = getTotalDonatedSats() + sats;
  const accumulatedSats = getSessionAccumulatedSats();
  const totalAccumulatedSats = getDonationSatsForScope();
  const payload = buildDonationPayload({
    dataUrl,
    plan: lastSession.plan,
    durationSeconds: donationSeconds,
    goalMinutes: lastSession.goalMinutes,
    sats,
    donationModeValue: mode,
    donationScopeValue: "total",
    donationNoteValue: note,
    totalDonatedSats,
    accumulatedSats,
    totalAccumulatedSats,
  });

  // 달성률 계산
  const achievementRate = lastSession.goalMinutes > 0
    ? Math.round((totalMinutes / lastSession.goalMinutes) * 100)
    : 0;

  // 현재 기부 타입 및 정보 저장 (적립금 기부)
  currentDonationScope = "accumulated";
  currentDonationSats = sats;
  currentDonationPayload = payload;
  console.log('📝 [DEBUG] 기부 정보 저장됨 (donateDailyAccumulated)');
  console.log('  - scope: accumulated');
  console.log('  - sats:', sats);

  // 결제 완료 후 Discord 공유 및 localStorage 업데이트
  await openLightningWalletWithPayload(payload, {
    onSuccess: async () => {
      // Discord 공유 먼저 실행
      try {
        await shareToDiscordAPI({
          sessionId: lastSession.sessionId,
          dataUrl: "", // 적립액 기부는 이미지 없음
          planText: lastSession.plan,
          durationSeconds: donationSeconds,
          donationScope: "accumulated", // 적립액 기부
          donationSats: sats,
          totalDonatedSats: totalDonatedSats,
          totalAccumulatedSats: totalAccumulatedSats,
          donationNote: note,
        });
      } catch (error) {
        console.error("Discord 공유 실패:", error);
        alert("Discord 공유에 실패했습니다: " + error.message);
      }

      // ⭐️ 백엔드에서 적립액 차감
      if (typeof AccumulatedSatsAPI !== 'undefined' && currentUser?.id) {
        try {
          const result = await AccumulatedSatsAPI.deduct(
            currentUser.id,
            sats,
            null, // donation_id는 나중에 추가 가능
            note || '적립액 기부'
          );
          console.log('✅ 적립액 차감 성공:', result);

          // 백엔드 적립액 변수 업데이트
          if (result.success && result.data) {
            backendAccumulatedSats = result.data.amount_after;
            localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
          }
        } catch (error) {
          console.error('❌ 적립액 차감 실패:', error);
          // 차감 실패 시 경고하지만 계속 진행 (localStorage 폴백 사용)
        }
      }

      // pending daily에서 적립액 차감 (localStorage 정리)
      const pending = getPendingDaily();
      delete pending[todayKey];
      localStorage.setItem(pendingDailyKey, JSON.stringify(pending));

      // 기부 기록 저장
      saveDonationHistoryEntry({
        date: todayKey,
        sats,
        minutes: totalMinutes,
        seconds: donationSeconds,
        mode,
        scope: "total",
        note,
        isPaid: true,
        // POW 정보
        planText: lastSession.plan,
        goalMinutes: lastSession.goalMinutes,
        achievementRate: achievementRate,
        photoUrl: dataUrl,
        // 누적 정보
        accumulatedSats: accumulatedSats,
        totalAccumulatedSats: totalAccumulatedSats,
        totalDonatedSats: totalDonatedSats,
      });

      showAccumulationToast("적립액 기부 및 Discord 공유가 완료되었습니다. 페이지를 새로고침합니다...");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
  });
};

const buildLightningUri = (invoice) => `lightning:${invoice}`;

const walletDeepLinks = {
  walletofsatoshi: (invoice) => `walletofsatoshi:${invoice}`,
  blink: (invoice) => buildLightningUri(invoice),
  strike: (invoice) => `strike:${invoice}`,
  zeus: (invoice) => `zeusln:${invoice}`,
};

const openWalletDeepLink = (deepLink) => {
  window.location.href = deepLink;
};

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

const showWalletToast = (message) => {
  if (!walletToast) {
    return;
  }
  walletToast.textContent = message;
  walletToast.classList.remove("hidden");
  if (walletToastTimeout) {
    clearTimeout(walletToastTimeout);
  }
  walletToastTimeout = setTimeout(() => {
    walletToast.classList.add("hidden");
  }, 1000);
};

const renderWalletInvoice = (invoice) => {
  if (!walletInvoice || !walletInvoiceQr) {
    return;
  }
  const normalizedInvoice = normalizeInvoice(invoice);
  if (!normalizedInvoice) {
    walletInvoice.classList.add("hidden");
    walletInvoiceQr.src = "";
    return;
  }
  walletInvoice.classList.remove("hidden");
  const lightningUri = getLightningUri(normalizedInvoice);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    lightningUri
  )}`;
  walletInvoiceQr.src = qrUrl;

  // QR 표시 직후 자동 polling 시작 (3초 후)
  if (invoice && pendingOnSuccessCallback) {
    console.log('🚀 QR 표시 완료 - 3초 후 polling 시작');
    currentInvoice = normalizedInvoice; // currentInvoice 업데이트
    setTimeout(() => startPaymentPolling(), 3000);
  }
};

// 결제 완료 후 실행할 콜백 저장
let pendingOnSuccessCallback = null;
let currentInvoice = null;
let currentDonationScope = null; // 'session', 'total', 'accumulated'
let currentDonationSats = 0;
let currentDonationPayload = null;
let paymentPollingInterval = null; // 자동 결제 확인 polling interval

const openWalletSelection = ({ invoice, message, onSuccess } = {}) => {
  // onSuccess 콜백 저장
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
    walletStatus.textContent =
      message || "선택한 지갑으로 인보이스를 전달합니다.";
  }
  renderWalletInvoice(invoice);
  setWalletOptionsEnabled(Boolean(invoice));
  if (walletToast) {
    walletToast.classList.add("hidden");
  }
};

// 자동 결제 확인 polling 시작
const startPaymentPolling = () => {
  // 이미 polling 중이면 중단
  if (paymentPollingInterval) {
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }

  if (!currentInvoice || !pendingOnSuccessCallback) {
    console.log('⚠️ polling 시작 불가: invoice 또는 callback 없음');
    return;
  }

  let attemptCount = 0;
  const MAX_ATTEMPTS = 40; // 120초 (3초 간격 × 40회)

  console.log('🚀 결제 확인 polling 시작 (최대 40회, 120초)');

  paymentPollingInterval = setInterval(async () => {
    attemptCount++;
    console.log(`💳 결제 확인 polling... (${attemptCount}/${MAX_ATTEMPTS})`);

    try {
      const checkResponse = await fetch(`${window.BACKEND_API_URL}/api/blink/check-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequest: currentInvoice }),
      });

      if (!checkResponse.ok) {
        console.log(`⚠️ API 응답 오류: ${checkResponse.status}`);
        return; // 다음 polling 계속
      }

      const checkResult = await checkResponse.json();

      if (checkResult?.success && checkResult.data?.paid) {
        // ✅ 결제 확인 성공!
        console.log('✅ 결제 확인 성공 - 자동 처리 시작');
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;

        // 콜백 실행 (donations 테이블에 저장)
        if (pendingOnSuccessCallback) {
          try {
            await pendingOnSuccessCallback();
          } catch (error) {
            console.error('❌ 콜백 실행 오류:', error);
            alert("기부 기록 저장 중 오류가 발생했습니다: " + error.message);
            return;
          }
        }

        // 모달 닫기
        if (walletModal) {
          walletModal.classList.add("hidden");
          walletModal.setAttribute("aria-hidden", "true");
          walletModal.dataset.invoice = "";
        }

        // 상태 초기화
        pendingOnSuccessCallback = null;
        currentInvoice = null;
        currentDonationScope = null;
        currentDonationSats = 0;
        currentDonationPayload = null;

        // Option B: 부드러운 UI 업데이트 (페이지 새로고침 대신)
        updateAccumulatedSats();
        updateTodayDonationSummary();
        showAccumulationToast("기부가 완료되었습니다! 🎉");

        // 모달 UI 초기화
        if (walletStatus) {
          walletStatus.textContent = "선택한 지갑으로 인보이스를 전달합니다.";
        }
        renderWalletInvoice("");
        setWalletOptionsEnabled(true);
        if (walletToast) {
          walletToast.classList.add("hidden");
        }
      }

      // ⭐️ 타임아웃 체크 (40회 실패 시 모달)
      if (attemptCount >= MAX_ATTEMPTS) {
        console.log('⏱️ Polling 타임아웃 (40회 실패, 120초 경과)');
        clearInterval(paymentPollingInterval);
        paymentPollingInterval = null;

        // 결제 실패 모달 표시
        showPaymentFailedModal();
      }
    } catch (error) {
      console.error('❌ Polling 오류:', error);
      // 다음 polling 계속
    }
  }, 3000); // 3초 간격
};

// ⭐️ 결제 실패 모달 표시
const showPaymentFailedModal = async () => {
  const scope = currentDonationScope;
  let message = '';

  if (scope === 'session') {
    // 즉시 기부 실패
    message = '기부에 실패하였습니다. 적립할까요?';
  } else {
    // 적립액 기부 실패
    message = '기부에 실패하였습니다. 다음에 기부할까요?';
  }

  if (confirm(message)) {
    // "예" 선택
    if (scope === 'session') {
      // 즉시 기부 → 적립으로 전환
      try {
        // 백엔드 적립액 증가
        if (currentDiscordId && typeof AccumulatedSatsAPI !== 'undefined') {
          const result = await AccumulatedSatsAPI.add(
            currentDiscordId,
            currentDonationSats,
            null,
            '결제 실패 후 적립'
          );

          if (result.success && result.data) {
            backendAccumulatedSats = result.data.amount_after;
            localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
          }

          console.log('✅ 결제 실패 후 적립 성공:', result);
        }

        // Discord 공유 (currentDonationPayload 사용)
        if (currentDonationPayload) {
          await shareToDiscordOnly();
          console.log('✅ 결제 실패 후 Discord 공유 성공');
        }

        showAccumulationToast(`${currentDonationSats}sats가 적립되었습니다.`);
        updateAccumulatedSats();
        updateTodayDonationSummary();
      } catch (error) {
        console.error('❌ 적립 처리 실패:', error);
        alert('적립 처리 중 오류가 발생했습니다: ' + error.message);
      }
    } else {
      // 적립액 기부 → 적립액 유지
      console.log('적립액 유지 - 나중에 기부');
    }

    // 모달 닫기
    closeWalletSelection();
  } else {
    // "아니오" 선택 → 1회 재확인
    console.log('1회 재확인 시도');

    try {
      const checkResponse = await fetch(`${window.BACKEND_API_URL}/api/blink/check-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequest: currentInvoice }),
      });

      if (checkResponse.ok) {
        const checkResult = await checkResponse.json();

        if (checkResult?.success && checkResult.data?.paid) {
          // ✅ 재확인 성공 - callback 실행
          console.log('✅ 재확인 성공 - pendingOnSuccessCallback 실행');

          if (pendingOnSuccessCallback) {
            await pendingOnSuccessCallback();
            // pendingOnSuccessCallback은 페이지 새로고침을 포함하므로
            // 이 이후 코드는 실행되지 않을 수 있음
          }

          // 상태 초기화
          pendingOnSuccessCallback = null;
          currentInvoice = null;
          currentDonationScope = null;
          currentDonationSats = 0;
          currentDonationPayload = null;

          // Polling 중단
          if (paymentPollingInterval) {
            clearInterval(paymentPollingInterval);
            paymentPollingInterval = null;
          }

          // 모달 닫기 (closeWalletSelection 호출하지 않음 - 중복 방지)
          if (walletModal) {
            walletModal.classList.add("hidden");
            walletModal.setAttribute("aria-hidden", "true");
            walletModal.dataset.invoice = "";
          }

          // 모달 UI 초기화
          if (walletStatus) {
            walletStatus.textContent = "선택한 지갑으로 인보이스를 전달합니다.";
          }
          renderWalletInvoice("");
          setWalletOptionsEnabled(true);
          if (walletToast) {
            walletToast.classList.add("hidden");
          }

          return;
        }
      }

      // 재확인도 실패
      alert('결제 확인에 실패했습니다. 나중에 다시 시도해주세요.');
      closeWalletSelection();
    } catch (error) {
      console.error('❌ 재확인 오류:', error);
      alert('결제 확인 중 오류가 발생했습니다.');
      closeWalletSelection();
    }
  }
};

const closeWalletSelection = async () => {
  if (!walletModal) {
    return;
  }

  console.log('🔍 [DEBUG] closeWalletSelection 호출됨 (X 버튼 클릭)');
  console.log('  - currentInvoice:', currentInvoice ? currentInvoice.substring(0, 50) + '...' : 'null');
  console.log('  - currentDonationScope:', currentDonationScope);
  console.log('  - currentDonationSats:', currentDonationSats);
  console.log('  - pendingOnSuccessCallback:', typeof pendingOnSuccessCallback);

  // 1. polling 즉시 중단
  if (paymentPollingInterval) {
    console.log('⏹️ Polling 중단');
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }

  // 2. 마지막으로 한 번만 더 결제 확인
  if (pendingOnSuccessCallback && currentInvoice) {
    if (walletStatus) {
      walletStatus.textContent = "결제 확인 중입니다. 잠시만 기다려주세요...";
    }

    try {
      console.log('🔍 마지막 결제 확인 시도...');
      const checkResponse = await fetch(`${window.BACKEND_API_URL}/api/blink/check-invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentRequest: currentInvoice }),
      });

      // ⚠️ API 응답 상태 체크
      if (!checkResponse.ok) {
        throw new Error(`API 오류: ${checkResponse.status}`);
      }

      const checkResult = await checkResponse.json();

      // ✅ Case 1: 결제 완료 확인됨
      if (checkResult?.success && checkResult.data?.paid) {
        console.log('✅ 결제 확인 성공!');
        await pendingOnSuccessCallback();

        // 상태 초기화
        pendingOnSuccessCallback = null;
        currentInvoice = null;
        currentDonationScope = null;
        currentDonationSats = 0;
        currentDonationPayload = null;

        // 모달 닫기
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

        // Option B: 부드러운 UI 업데이트
        updateAccumulatedSats();
        updateTodayDonationSummary();
        showAccumulationToast("기부가 완료되었습니다! 🎉");

        return; // 여기서 종료 (안내창 표시 안 함)
      }

      // ❌ Case 2: 결제 미완료 확인됨 (API는 정상, 결제만 안 됨)
      if (checkResult?.success && checkResult.data?.paid === false) {
        console.log('❌ 결제 미완료 확인됨');

        // "적립할까요?" 안내창
        if (currentDonationScope === "session") {
          const accumulate = window.confirm("아직 POW 활동에 대한 기부가 되지 않았습니다. 적립할까요?");
          if (accumulate) {
            // ⭐️ 하이브리드 시스템: 백엔드 적립 + Discord 공유

            // 1. 백엔드 적립액 증가
            if (currentDiscordId && typeof AccumulatedSatsAPI !== 'undefined') {
              try {
                const result = await AccumulatedSatsAPI.add(
                  currentDiscordId,
                  currentDonationSats,
                  null, // session_id는 Discord 공유 시 저장됨
                  '결제 실패 후 적립'
                );

                // 2. 메모리 변수 업데이트
                if (result.success && result.data) {
                  backendAccumulatedSats = result.data.amount_after;
                  localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
                }

                console.log('✅ 결제 실패 후 적립 성공:', result);
              } catch (error) {
                console.error('❌ 결제 실패 후 적립 실패:', error);
              }
            }

            // 3. Discord 공유 (인증카드)
            try {
              await shareToDiscordOnly();
              console.log('✅ 결제 실패 후 Discord 공유 성공');
            } catch (error) {
              console.error('❌ 결제 실패 후 Discord 공유 실패:', error);
            }

            // 4. UI 갱신
            showAccumulationToast(`${currentDonationSats}sats가 적립되었습니다.`);
            updateAccumulatedSats();
            updateTodayDonationSummary();
          }
        } else if (currentDonationScope === "accumulated") {
          const later = window.confirm("나중에 기부할까요?");
          // "예" → 적립액 유지 (아무것도 안 함)
        }

        // 상태 초기화
        pendingOnSuccessCallback = null;
        currentInvoice = null;
        currentDonationScope = null;
        currentDonationSats = 0;
        currentDonationPayload = null;

        // 모달 닫기
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

        return;
      }

      // ⚠️ Case 3: API 응답이 이상함 (success=false 등)
      throw new Error(checkResult?.error || 'API 응답 형식이 올바르지 않습니다.');

    } catch (error) {
      // ⚠️ Case 4: API 호출 자체가 실패 (네트워크 오류, 서버 오류 등)
      console.error('❌ 결제 확인 중 오류:', error);

      // 재시도 안내창
      const retry = window.confirm(
        "결제 확인 중 오류가 발생했습니다.\n" +
        "네트워크 문제일 수 있습니다.\n\n" +
        "다시 확인하시겠습니까?\n" +
        "(취소하면 모달만 닫힙니다. 적립액은 유지됩니다.)"
      );

      if (retry) {
        // 재시도 (모달 닫지 않음)
        if (walletStatus) {
          walletStatus.textContent = "결제 확인을 재시도합니다...";
        }

        // 1초 후 다시 closeWalletSelection 호출 (재귀)
        setTimeout(() => closeWalletSelection(), 1000);
        return; // 모달 닫지 않고 종료
      } else {
        // 취소 → 모달만 닫기 (적립 안 함, 상태 유지)
        console.log('사용자가 재시도 취소 → 모달만 닫음');
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
        // 상태는 초기화하지 않음 (나중에 다시 시도 가능)
        return;
      }
    }
  }

  // 3. 모달 닫기 (일반 케이스 - callback 없을 때)
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

const launchWallet = async (walletKey) => {
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
    closeWalletSelection();
    openWalletDeepLink(deepLink);
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = error?.message || "지갑 실행에 실패했습니다.";
    }
  }
};

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
  if (!studyPlanInput) {
    return;
  }
  applyStudyPlanValue(studyPlanInput.value);
};


const updateDiscordProfile = ({ user, guild, authorized, userLevel }) => {
  if (!discordProfile) {
    return;
  }
  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";
  discordAvatar.src = avatarUrl;
  discordAvatar.alt = user?.username ? `${user.username} avatar` : "Discord avatar";

  // ⭐️ 기존 클래스 제거 (status + level)
  discordAvatar.classList.remove("status-ok", "status-pending", "user-level-1", "user-level-2", "user-level-3");

  // ⭐️ 사용자 레벨별 클래스 추가 (프로필 테두리 색상)
  if (userLevel) {
    discordAvatar.classList.add(`user-level-${userLevel}`);
  }

  if (authorized === true) {
    discordAvatar.classList.add("status-ok");

    // 백엔드에 사용자 등록/업데이트
    if (typeof UserAPI !== 'undefined' && user?.id) {
      UserAPI.upsert(user.id, user.username, user.avatar)
        .then(() => console.log('사용자 정보가 백엔드에 저장되었습니다.'))
        .catch(err => console.error('백엔드 사용자 저장 오류:', err));
    }
  } else if (authorized === false) {
    discordAvatar.classList.add("status-pending");
  }
  discordUsername.textContent = user?.username ?? "로그인된 사용자 없음";
  if (discordGuild) {
    const guildName = guild?.name ?? "-";
    discordGuild.textContent = `서버: ${guildName}`;
  }
  if (loginUserName && user?.username) {
    loginUserName.textContent = user.username;
  }
};

const setAuthState = ({ authenticated, authorized, user, guild, error, userLevel }) => {
  if (error) {
    if (discordStatus) {
      discordStatus.textContent = `로그인 상태: ${error}`;
    }
    if (discordHint) {
      discordHint.textContent = "서버 설정을 확인해주세요.";
    }
    mainContent.classList.add("locked");
    if (discordLogout) {
      discordLogout.style.display = "none";
    }
    if (discordRefresh) {
      discordRefresh.style.display = "none";
    }
    if (discordProfile) {
      discordProfile.style.display = "none";
    }
    if (discordAvatar) {
      discordAvatar.classList.remove("status-ok", "status-pending");
    }
    if (loginUser) {
      loginUser.classList.add("hidden");
    }
    if (discordAppLogin) {
      discordAppLogin.style.display = "inline-flex";
    }
    if (discordWebLogin) {
      discordWebLogin.style.display = "none";
    }
    if (allowedServer) {
      allowedServer.textContent = "접속 가능 서버: 확인 실패";
    }
    return;
  }

  if (!authenticated) {
    if (discordStatus) {
      discordStatus.textContent = "로그인 상태: 미인증";
    }
    if (discordHint) {
      discordHint.textContent = "Discord 로그인 후 역할(Role) 검증이 완료됩니다.";
    }
    mainContent.classList.add("locked");
    if (discordLogout) {
      discordLogout.style.display = "none";
    }
    if (discordRefresh) {
      discordRefresh.style.display = "none";
    }
    if (discordProfile) {
      discordProfile.style.display = "none";
    }
    if (discordAvatar) {
      discordAvatar.classList.remove("status-ok", "status-pending");
    }
    if (loginUser) {
      loginUser.classList.add("hidden");
    }
    if (discordAppLogin) {
      discordAppLogin.style.display = "inline-flex";
    }
    if (discordWebLogin) {
      discordWebLogin.style.display = "none";
    }
    if (allowedServer) {
      allowedServer.textContent = "접속 가능 서버: 로그인 필요";
    }
    return;
  }

  if (!authorized) {
    if (discordStatus) {
      discordStatus.textContent = "로그인 상태: 역할 미충족";
    }
    if (discordHint) {
      discordHint.textContent = "지정된 Role 권한이 필요합니다.";
    }
    mainContent.classList.add("locked");
    if (discordLogout) {
      discordLogout.style.display = "inline-flex";
    }
    if (discordRefresh) {
      discordRefresh.style.display = "inline-flex";
    }
    if (discordProfile) {
      discordProfile.style.display = "block";
    }
    if (loginUser) {
      loginUser.classList.remove("hidden");
    }
    if (discordAppLogin) {
      discordAppLogin.style.display = "none";
    }
    if (discordWebLogin) {
      discordWebLogin.style.display = "none";
    }
    if (allowedServer) {
      const guildName = guild?.name ?? "citadel.sx";
      allowedServer.textContent = `접속 가능 서버: ${guildName}`;
    }
    if (user && loginUserName) {
      loginUserName.textContent = user.username ?? "-";
    }
    updateDiscordProfile({ user, guild, authorized: false, userLevel });
    return;
  }

  const roleName = guild?.roleName || "지정 역할";
  if (discordStatus) {
    discordStatus.textContent = `로그인 상태: 역할(${roleName}) 확인`;
  }
  if (discordHint) {
    discordHint.textContent = "역할(Role) 확인 완료. 모든 기능을 사용할 수 있습니다.";
  }
  mainContent.classList.remove("locked");
  if (discordLogout) {
    discordLogout.style.display = "inline-flex";
  }
  if (discordRefresh) {
    discordRefresh.style.display = "inline-flex";
  }
  if (discordProfile) {
    discordProfile.style.display = "block";
  }
  if (loginUser) {
    loginUser.classList.remove("hidden");
  }
  if (discordAppLogin) {
    discordAppLogin.style.display = "none";
  }
  if (discordWebLogin) {
    discordWebLogin.style.display = "none";
  }
  updateDiscordProfile({ user, guild, authorized: true, userLevel });
  if (allowedServer) {
    const guildName = guild?.name ?? "citadel.sx";
    allowedServer.textContent = `접속 가능 서버: ${guildName}`;
  }

  // 로그인한 사용자의 Discord ID 설정 및 모든 데이터 로드
  if (user && user.id) {
    currentDiscordId = user.id;

    // ⭐️ 백엔드에서 사용자 설정 로드 (donation_scope 등)
    if (typeof UserAPI !== 'undefined') {
      UserAPI.get(currentDiscordId)
        .then(response => {
          if (response.success && response.data) {
            const { donation_scope } = response.data;
            if (donation_scope && donationScope) {
              // 백엔드 값으로 UI 업데이트
              donationScope.value = donation_scope;
              localStorage.setItem(donationScopeKey, donation_scope);

              // 토글 버튼 UI 업데이트
              toggleButtons.forEach(btn => {
                if (btn.getAttribute('data-value') === donation_scope) {
                  btn.classList.add('active');
                } else {
                  btn.classList.remove('active');
                }
              });

              console.log(`✅ 백엔드에서 donation_scope 로드: ${donation_scope}`);
            }
          }
        })
        .catch(error => {
          console.error('사용자 설정 로드 실패:', error);
          // 실패 시 localStorage 값 사용 (이미 초기화됨)
        });
    }

    // 모든 데이터를 병렬로 API에서 로드
    Promise.all([
      loadPendingDailyFromAPI(),
      loadSessionsFromAPI(),
      loadDonationsFromAPI(),
    ]).then(() => {
      // 로드 완료 후 UI 업데이트
      loadStudyPlan();
      updateAccumulatedSats();
      updateTodayDonationSummary();
      renderSessions();
      renderStudyHistoryPage();
      renderDonationHistoryPage();
      updateDonationTotals();
      renderDonationHistory();
      console.log('모든 데이터를 API에서 로드 완료');
    }).catch(error => {
      console.error('데이터 로드 중 오류 발생:', error);
    });
  }

  // 구버전 localStorage 데이터를 백엔드로 자동 마이그레이션
  if (!sessionStorage.getItem('hasPromptedDaily')) {
    promptPendingDailyDonation();
  }
};

discordAppLogin?.addEventListener("click", () => {
  window.location.href = "/auth/discord/app";
});

discordWebLogin?.addEventListener("click", () => {
  window.location.href = "/auth/discord/web";
});

discordLogout?.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  window.location.reload();
});

startButton?.addEventListener("click", () => {
  openTimerModal();
  startTimer();
});
pauseButton?.addEventListener("click", () => {
  if (isRunning) {
    pauseTimer();
  } else if (elapsedSeconds > 0) {
    startTimer();
  }
});
resetButton?.addEventListener("click", () => {
  if (isResetReady) {
    startTimer();
    return;
  }
  resetTimer();
  setResetButtonLabel("재시작");
  isResetReady = true;
});
finishButton?.addEventListener("click", finishSession);
// POW 시간 입력 포맷팅
const formatGoalMinutesInput = () => {
  if (!goalInput) {
    return;
  }
  // 숫자만 추출
  const cleaned = String(goalInput.value || "").replace(/[^\d]/g, "");
  const numeric = Number(cleaned);

  // 숫자가 있으면 "00분" 형식으로 표시, 없으면 빈 문자열
  if (numeric > 0) {
    goalInput.value = `${numeric}분`;
  } else {
    goalInput.value = "";
  }
};

goalInput?.addEventListener("input", () => {
  updateTotals();
});
goalInput?.addEventListener("blur", () => {
  formatGoalMinutesInput();
});
donationScope?.addEventListener("change", () => {
  updateSats();
  updateShareButtonLabel();
  updateTodayDonationSummary();
});
satsRateInput?.addEventListener("input", () => {
  updateSats();
});
satsRateInput?.addEventListener("blur", () => {
  formatSatsRateInput();
});
studyPlanInput?.addEventListener("input", saveStudyPlan);
studyPlanPreview?.addEventListener("input", (event) => {
  applyStudyPlanValue(event.target.value);
});

const resetMediaPreview = () => {
  if (mediaPreviewUrl) {
    URL.revokeObjectURL(mediaPreviewUrl);
    mediaPreviewUrl = null;
  }
  selectedVideoDataUrl = null;
  selectedVideoFilename = "";
  photoSource = null;
  photoPreview.src = "";
  photoPreview.style.display = "none";
  snapshotCanvas.style.display = "none";
  badgeCanvas.style.display = "none";
  cameraVideo.pause();
  cameraVideo.removeAttribute("src");
  cameraVideo.load();
  cameraVideo.style.display = "none";
};

const resetShareSection = () => {
  resetMediaPreview();
  if (downloadLink) {
    downloadLink.href = "";
    downloadLink.style.display = "none";
  }
  if (donationNote) {
    donationNote.value = "";
  }
  if (shareStatus) {
    shareStatus.textContent = "디스코드 공유와 기부 연동은 서버에서 설정해야 합니다.";
  }
  if (donationStatus) {
    donationStatus.textContent = "실제 사토시 전송은 LNURL/지갑 연동이 필요합니다.";
  }
};

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });

const loadVideoThumbnail = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    mediaPreviewUrl = url;
    cameraVideo.src = url;
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;
    const cleanup = () => {
      cameraVideo.removeEventListener("loadeddata", onLoadedData);
      cameraVideo.removeEventListener("error", onError);
    };
    const onLoadedData = () => {
      try {
        cameraVideo.currentTime = Math.min(0.1, cameraVideo.duration || 0);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }
      const onSeeked = () => {
        cameraVideo.removeEventListener("seeked", onSeeked);
        snapshotCanvas.width = cameraVideo.videoWidth || snapshotCanvas.width;
        snapshotCanvas.height = cameraVideo.videoHeight || snapshotCanvas.height;
        const context = snapshotCanvas.getContext("2d");
        context.drawImage(cameraVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        const dataUrl = snapshotCanvas.toDataURL("image/png");
        photoPreview.src = dataUrl;
        photoPreview.style.display = "block";
        snapshotCanvas.style.display = "none";
        cameraVideo.style.display = "none";
        cleanup();
        resolve();
      };
      cameraVideo.addEventListener("seeked", onSeeked);
    };
    const onError = () => {
      cleanup();
      reject(new Error("video-load-failed"));
    };
    cameraVideo.addEventListener("loadeddata", onLoadedData);
    cameraVideo.addEventListener("error", onError);
  });

const handleMediaFile = async (file) => {
  if (!file) {
    return;
  }
  resetMediaPreview();
  if (file.type.startsWith("video/")) {
    try {
      // ⭐️ 동영상 재생 시간 체크 (10초 제한)
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => {
          if (video.duration > 10) {
            reject(new Error(`동영상은 10초 이내로 업로드해주세요. (현재: ${Math.round(video.duration)}초)`));
          } else {
            resolve(null);
          }
          URL.revokeObjectURL(video.src);
        });
        video.addEventListener('error', () => {
          reject(new Error('동영상 메타데이터를 불러올 수 없습니다.'));
          URL.revokeObjectURL(video.src);
        });
      });

      const dataUrl = await readFileAsDataUrl(file);
      selectedVideoDataUrl = dataUrl;
      selectedVideoFilename = file.name || "study-video";
      await loadVideoThumbnail(file);
      photoSource = photoPreview;
    } catch (error) {
      alert(error.message || "동영상을 불러올 수 없습니다. 다른 파일을 선택해주세요.");
      return;
    }
    return;
  }
  const url = URL.createObjectURL(file);
  mediaPreviewUrl = url;
  photoPreview.src = url;
  photoPreview.style.display = "block";
  snapshotCanvas.style.display = "none";
  cameraVideo.style.display = "none";
  badgeCanvas.style.display = "none";
  photoSource = photoPreview;
};

openCameraButton?.addEventListener("click", () => {
  cameraCapture?.click();
});

mediaUpload?.addEventListener("change", (event) => {
  handleMediaFile(event.target.files[0]);
  // 두 번째 업로드를 위해 입력 필드 리셋
  event.target.value = "";
});

cameraCapture?.addEventListener("change", (event) => {
  handleMediaFile(event.target.files[0]);
  // 두 번째 업로드를 위해 입력 필드 리셋
  event.target.value = "";
});

const drawBadge = (sessionOverride = null) => {
  const context = badgeCanvas.getContext("2d");
  context.clearRect(0, 0, badgeCanvas.width, badgeCanvas.height);
  context.fillStyle = "#0f172a";
  context.fillRect(0, 0, badgeCanvas.width, badgeCanvas.height);

  if (photoSource) {
    const ratio = Math.min(
      badgeCanvas.width / photoSource.width,
      badgeCanvas.height / photoSource.height
    );
    const width = photoSource.width * ratio;
    const height = photoSource.height * ratio;
    const x = (badgeCanvas.width - width) / 2;
    const y = (badgeCanvas.height - height) / 2;
    context.drawImage(photoSource, x, y, width, height);
  }

  const lastSession = sessionOverride || getLastSessionSeconds();
  const lastGoalRate = lastSession.goalMinutes
    ? Math.min(100, (lastSession.durationSeconds / 60 / lastSession.goalMinutes) * 100)
    : 0;
  const overlayHeight = 380;

  context.fillStyle = "rgba(15, 23, 42, 0.65)";
  context.fillRect(0, badgeCanvas.height - overlayHeight, badgeCanvas.width, overlayHeight);

  context.fillStyle = "#f8fafc";
  context.font = "bold 52px sans-serif";
  context.fillText("오늘의 POW 인증", 60, badgeCanvas.height - overlayHeight + 90);

  context.font = "bold 36px sans-serif";
  // studyPlanPreview 값이 있으면 사용, 없으면 lastSession.plan 사용
  const plan = (studyPlanPreview?.value?.trim() || lastSession.plan) || "목표 미입력";
  context.fillText(`목표: ${plan}`, 60, badgeCanvas.height - overlayHeight + 150);

  context.font = "32px sans-serif";
  const modeLabel = donationModeLabels[donationMode?.value] || "POW";
  context.fillText(
    `POW 분야: ${modeLabel}`,
    60,
    badgeCanvas.height - overlayHeight + 200
  );

  context.font = "28px sans-serif";
  const studyTimeLabel = formatMinutesSeconds(lastSession.durationSeconds || 0);
  context.fillText(`POW Time: ${studyTimeLabel}`, 60, badgeCanvas.height - overlayHeight + 245);

  context.fillText(
    `Goal Rate: ${lastGoalRate.toFixed(1)}%`,
    60,
    badgeCanvas.height - overlayHeight + 285
  );

  context.font = "24px sans-serif";
  const date = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  context.fillText(date, badgeCanvas.width - 300, badgeCanvas.height - 36);

  const dataUrl = badgeCanvas.toDataURL("image/png");
  downloadLink.href = dataUrl;
  downloadLink.style.display = "inline-flex";
  badgeCanvas.style.display = "block";
  snapshotCanvas.style.display = "none";
  cameraVideo.style.display = "none";
  photoPreview.style.display = "none";
  if (shareStatus) {
    shareStatus.textContent = "디스코드 공유와 기부 연동은 서버에서 설정해야 합니다.";
  }
};

const getBadgeDataUrl = () => {
  const rawDataUrl = badgeCanvas.toDataURL("image/png");
  if (!rawDataUrl || rawDataUrl === "data:,") {
    return rawDataUrl;
  }
  const maxSize = 720;
  const scaled = document.createElement("canvas");
  const scale = Math.min(maxSize / badgeCanvas.width, maxSize / badgeCanvas.height);
  scaled.width = Math.round(badgeCanvas.width * scale);
  scaled.height = Math.round(badgeCanvas.height * scale);
  const context = scaled.getContext("2d");
  context.drawImage(badgeCanvas, 0, 0, scaled.width, scaled.height);
  return scaled.toDataURL("image/png", 0.92);
};

// Discord 공유 API 호출 공통 함수
const shareToDiscordAPI = async ({
  sessionId,
  dataUrl,
  planText,
  durationSeconds,
  donationScope,
  donationSats,
  totalDonatedSats,
  totalAccumulatedSats,
  donationNote,
}) => {
  // 현재 로그인한 사용자 정보 가져오기
  const sessionResponse = await fetch('/api/session');
  const sessionData = await sessionResponse.json();

  if (!sessionData.authenticated || !sessionData.user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  // Bot이 기대하는 형식으로 데이터 준비
  const botPayload = {
    discord_id: sessionData.user.id,
    session_id: sessionId,
    photo_url: dataUrl,
    plan_text: planText || "목표 미입력",
    donation_mode: donationMode?.value || "pow-writing",
    duration_seconds: durationSeconds || 0,
    donation_scope: donationScope,
    donation_sats: donationSats,
    total_donated_sats: totalDonatedSats,
    total_accumulated_sats: totalAccumulatedSats,
    donation_note: donationNote || "",
  };

  // 백엔드 API를 통해 Discord에 전송
  const response = await fetch("https://citadel-pow-backend.magadenuevo2025.workers.dev/api/discord-posts/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(botPayload),
  });

  if (!response.ok) {
    let errorMessage = "";
    try {
      const parsed = await response.clone().json();
      errorMessage = parsed?.error || "";
    } catch (error) {
      errorMessage = await response.text();
    }
    throw new Error(errorMessage || "디스코드 공유에 실패했습니다.");
  }

  return await response.json();
};

const shareToDiscordOnly = async () => {
  let dataUrl = getBadgeDataUrl();
  // 인증카드가 없으면 오류 메시지
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }
  if (shareStatus) {
    shareStatus.textContent = "디스코드 공유를 진행 중입니다.";
  }
  const lastSession = getLastSessionSeconds();

  // 현재 로그인한 사용자 정보 가져오기
  const sessionResponse = await fetch('/api/session');
  const sessionData = await sessionResponse.json();

  if (!sessionData.authenticated || !sessionData.user?.id) {
    alert("로그인이 필요합니다.");
    return;
  }

  // ⭐️ 방안 A: 기부 정보 수집
  const donationScopeValue = getDonationScopeValue();
  // Discord 공유 시에는 항상 현재 세션 sats(B) 사용
  const donationSats = getCurrentSessionSats();
  const totalDonatedSats = getTotalDonatedSats();
  // 총 적립액은 기존 적립액 + 현재 세션 sats
  const totalAccumulatedSats = donationScopeValue === "total"
    ? backendAccumulatedSats + donationSats
    : 0;

  // Bot이 기대하는 형식으로 데이터 준비
  const botPayload = {
    discord_id: sessionData.user.id,
    session_id: lastSession.sessionId,
    photo_url: dataUrl,
    plan_text: lastSession.plan || "목표 미입력",
    donation_mode: donationMode?.value || "pow-writing",
    duration_seconds: lastSession.durationSeconds || 0,
    // 기부 정보 추가
    donation_scope: donationScopeValue,
    donation_sats: donationSats,
    total_donated_sats: totalDonatedSats,
    total_accumulated_sats: totalAccumulatedSats,
    donation_note: donationNote?.value?.trim() || "",
  };

  try {
    // 백엔드 API를 통해 Discord에 전송
    const response = await fetch("https://citadel-pow-backend.magadenuevo2025.workers.dev/api/discord-posts/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(botPayload),
    });
    if (!response.ok) {
      let errorMessage = "";
      try {
        const parsed = await response.clone().json();
        errorMessage = parsed?.error || "";
      } catch (error) {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage || "디스코드 공유에 실패했습니다.");
    }
    if (shareStatus) {
      shareStatus.textContent = "디스코드 공유를 완료했습니다.";
    }

    // 적립 후 기부 모드가 아닌 경우에만 기부 기록 저장
    if (getDonationScopeValue() !== "total") {
      const mode = donationMode?.value || "pow-writing";
      const { sats, seconds: donationSeconds, scope } = getDonationPaymentSnapshot();
      const totalMinutes = Math.floor(donationSeconds / 60);
      const note = donationNote?.value?.trim() || "";
      saveDonationHistoryEntry({
        date: todayKey,
        sats: payload.sats,
        minutes: totalMinutes,
        seconds: donationSeconds,
        mode,
        scope: getDonationScopeValue(),
        sessionId: scope === "session" ? lastSession.sessionId : "",
        note,
        isPaid: false,
      });
      donationPage = 1;
    } else {
      // ⭐️ 적립 후 기부 모드: 백엔드에 적립액 저장
      if (typeof AccumulatedSatsAPI !== 'undefined' && currentDiscordId) {
        try {
          const satsToAccumulate = donationSats;
          const result = await AccumulatedSatsAPI.add(
            currentDiscordId,
            satsToAccumulate,
            lastSession.sessionId || null,  // 빈 문자열 → null 변환
            donationNote?.value?.trim() || null
          );
          console.log('✅ 적립액 저장 성공:', result);

          // 백엔드 적립액 변수 업데이트
          if (result.success && result.data) {
            backendAccumulatedSats = result.data.amount_after;
            localStorage.setItem('citadel-backend-accumulated-sats', backendAccumulatedSats.toString());
          }
        } catch (error) {
          console.error('❌ 적립액 저장 실패:', error);
          // 실패해도 디스코드 공유는 성공했으므로 계속 진행
        }
      }
    }

    // 디스코드 공유 성공 후 오늘의 목표 초기화
    localStorage.removeItem(planKey);
    if (studyPlanInput) {
      studyPlanInput.value = "";
    }

    // Discord 공유 성공 후 적립액 UI 업데이트
    updateAccumulatedSats();

    // 페이지 새로고침으로 모든 상태 업데이트
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

const shareToDiscord = async () => {
  if (getDonationScopeValue() === "total") {
    await shareToDiscordOnly();
    return;
  }
  await openLightningWallet();
};

generateButton?.addEventListener("click", () => {
  // photoSource가 없으면 오류 메시지
  if (!photoSource) {
    alert("먼저 사진 또는 동영상을 촬영하거나 업로드해주세요.");
    return;
  }
  drawBadge();
});

shareDiscordButton?.addEventListener("click", shareToDiscord);
todayAccumulatedPay?.addEventListener("click", openAccumulatedDonationPayment);

donationPagePay?.addEventListener("click", () => {
  openAccumulatedDonationPayment();
});

window.addEventListener("beforeunload", () => {
  pauseTimer();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    syncElapsedTime();
  }
});

// ⭐️ 타이머 복원 함수 (백그라운드 동작 지원)
const restoreTimerState = () => {
  const savedEndTime = localStorage.getItem('citadel-timer-end');
  const savedGoal = localStorage.getItem('citadel-timer-goal');

  if (savedEndTime) {
    timerEndTime = parseInt(savedEndTime, 10);
    const now = Date.now();

    if (now < timerEndTime) {
      // 아직 목표 시간 전 - 경과 시간 복원 및 자동 재시작
      const goalMinutes = parseInt(savedGoal, 10) || 0;
      const totalDuration = goalMinutes * 60 * 1000;
      const elapsed = totalDuration - (timerEndTime - now);
      elapsedSeconds = Math.floor(elapsed / 1000);
      elapsedOffsetSeconds = elapsedSeconds;

      // ⭐️ goalInput 복원 (중요!)
      if (goalInput) {
        goalInput.value = goalMinutes;
      }

      // ⭐️ 타이머 자동 재시작
      isRunning = true;
      timerStartTime = Date.now();
      timerInterval = setInterval(tick, 1000);

      // UI 업데이트
      updateDisplay();
      updateSats();
      setDonationControlsEnabled(false);
      setPauseButtonLabel("일시정지");  // 버튼을 "일시정지"로 변경

      // 타이머 모달 자동 열기
      openTimerModal();

      console.log(`⏱️ 타이머 복원 및 재시작: ${Math.floor(elapsedSeconds / 60)}분 ${elapsedSeconds % 60}초 경과`);
    } else {
      // 목표 시간 초과 - 목표 시간으로 설정
      const goalMinutes = parseInt(savedGoal, 10) || 0;
      elapsedSeconds = goalMinutes * 60;
      elapsedOffsetSeconds = elapsedSeconds;

      // ⭐️ goalInput 복원
      if (goalInput) {
        goalInput.value = goalMinutes;
      }

      // localStorage 정리
      localStorage.removeItem('citadel-timer-end');
      localStorage.removeItem('citadel-timer-goal');
      timerEndTime = null;

      updateDisplay();
      updateSats();
      setPauseButtonLabel("일시정지");

      console.log(`⏱️ 타이머 복원: 목표 시간(${goalMinutes}분) 도달`);
    }
  }
};

// 로그인 후 setAuthState에서 초기화됨
initializeTotals();
restoreTimerState();

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

const copyWalletInvoice = async () => {
  const invoice = walletModal?.dataset?.invoice || "";
  if (!invoice) {
    return;
  }
  try {
    await navigator.clipboard.writeText(invoice);
    showWalletToast("인보이스가 복사되었습니다.");
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = "인보이스 복사에 실패했습니다.";
    }
  }
};

walletInvoiceQr?.addEventListener("click", copyWalletInvoice);

accumulationToastClose?.addEventListener("click", () => {
  accumulationToast?.classList.add("hidden");
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, .button-link, .file");
  if (!target) {
    return;
  }
  target.classList.add("is-pressed");
  setTimeout(() => {
    target.classList.remove("is-pressed");
  }, 200);
});

const loadSession = async ({ ignoreUrlFlag = false } = {}) => {
  try {
    const params = new URLSearchParams(window.location.search);
    const hasUnauthorizedFlag = params.has("unauthorized");
    if (discordStatus) {
      discordStatus.textContent = "로그인 상태: 확인 중...";
    }
    const response = await fetch("/api/session");
    if (!response.ok) {
      setAuthState({ error: "서버 연결 실패" });
      return;
    }
    const data = await response.json();
    if (hasUnauthorizedFlag && (ignoreUrlFlag || data?.authorized)) {
      params.delete("unauthorized");
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
    setAuthState(data);
  } catch (error) {
    setAuthState({ error: "서버 연결 실패" });
  }
};

loadSession();
if (discordRefresh) {
  discordRefresh.addEventListener("click", async () => {
    discordRefresh.disabled = true;
    const originalLabel = discordRefresh.textContent;
    discordRefresh.textContent = "확인 중...";
    await loadSession({ ignoreUrlFlag: true });
    discordRefresh.textContent = originalLabel;
    discordRefresh.disabled = false;
  });
}

// 페이지 이동 시 polling cleanup
window.addEventListener('beforeunload', () => {
  if (paymentPollingInterval) {
    console.log('🧹 페이지 이동 - polling cleanup');
    clearInterval(paymentPollingInterval);
    paymentPollingInterval = null;
  }
});
