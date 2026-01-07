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
const donationCountField = document.getElementById("donation-count-field");
const donationCountInput = document.getElementById("donation-count");
const sessionPagination = document.getElementById("session-pagination");

const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const resetButton = document.getElementById("reset");

const discordAppLogin = document.getElementById("discord-app-login");
const discordWebLogin = document.getElementById("discord-web-login");
const discordRefresh = document.getElementById("discord-refresh");
const discordHint = document.getElementById("discord-hint");
const discordStatus = document.getElementById("discord-status");
const discordLogout = document.getElementById("discord-logout");
const mainContent = document.querySelector("main");
const discordProfile = document.getElementById("discord-profile");
const discordAvatar = document.getElementById("discord-avatar");
const discordBanner = document.getElementById("discord-banner");
const discordUsername = document.getElementById("discord-username");
const discordGuild = document.getElementById("discord-guild");
const allowedServer = document.getElementById("allowed-server");
const sessionList = document.getElementById("session-list");
const sessionEmpty = document.getElementById("session-empty");
const loginUser = document.getElementById("login-user");
const loginUserName = document.getElementById("login-user-name");

const studyPlanPreview = document.getElementById("study-plan-preview");
const openCameraButton = document.getElementById("open-camera");
const captureButton = document.getElementById("capture");
const generateButton = document.getElementById("generate");
const photoUpload = document.getElementById("photo-upload");
const cameraVideo = document.getElementById("camera");
const snapshotCanvas = document.getElementById("snapshot");
const photoPreview = document.getElementById("photo-preview");
const badgeCanvas = document.getElementById("badge");
const downloadLink = document.getElementById("download");

const donationNote = document.getElementById("donation-note");
const donateButton = document.getElementById("donate");
const donationStatus = document.getElementById("donation-status");
const donationHistory = document.getElementById("donation-history");
const donationHistoryEmpty = document.getElementById("donation-history-empty");
const donationPagination = document.getElementById("donation-pagination");
const currentTotalSats = document.getElementById("current-total-sats");
const donationPageTotal = document.getElementById("donation-page-total");
const donationPagePay = document.getElementById("donation-page-pay");
const walletModal = document.getElementById("wallet-modal");
const walletModalClose = document.getElementById("wallet-modal-close");
const walletStatus = document.getElementById("wallet-status");
const walletOptions = document.querySelectorAll(".wallet-option");
const walletInvoice = document.getElementById("wallet-invoice");
const walletInvoiceQr = document.getElementById("wallet-invoice-qr");
const walletToast = document.getElementById("wallet-toast");
const donationHistoryPagination = document.getElementById("donation-history-pagination");

let timerInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let cameraStream = null;
let photoSource = null;
let latestDonationPayload = null;
let sessionPage = 1;
let donationPage = 1;
let donationHistoryPage = 1;
const pendingDailyKey = "citadel-pending-daily";
let hasPromptedDaily = false;
let walletToastTimeout = null;

const donationControls = [
  donationScope,
  donationMode,
  satsRateInput,
  donationCountInput,
];

const setDonationControlsEnabled = (enabled) => {
  donationControls.forEach((control) => {
    if (control) {
      control.disabled = !enabled;
    }
  });
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const todayKey = getTodayKey();
const planKey = `citadel-plan-${todayKey}`;
const sessionsKey = `citadel-sessions-${todayKey}`;
const lastSessionKey = `citadel-last-session-${todayKey}`;
const donationHistoryKey = "citadel-donations";

const formatTime = (seconds) => {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
};

const formatMinutesSeconds = (seconds) => {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}분 ${secs}초`;
};

const getGoalProgress = (totalSeconds) => {
  if (!goalInput) {
    return 0;
  }
  const goalMinutes = Number(goalInput.value || 0);
  if (goalMinutes <= 0) {
    return 0;
  }
  return Math.min(100, (totalSeconds / 60 / goalMinutes) * 100);
};

const getStoredTotal = () => {
  const saved = Number(localStorage.getItem(`citadel-total-${todayKey}`) || 0);
  return Number.isNaN(saved) ? 0 : saved;
};

const setStoredTotal = (value) => {
  localStorage.setItem(`citadel-total-${todayKey}`, String(value));
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

const getPendingDaily = () => {
  try {
    const raw = localStorage.getItem(pendingDailyKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};

const savePendingDaily = (pending) => {
  localStorage.setItem(pendingDailyKey, JSON.stringify(pending));
};

const updateTotals = () => {
  if (!totalTodayEl || !goalProgressEl) {
    return;
  }
  const totalSeconds = getStoredTotal();
  totalTodayEl.textContent = formatTime(totalSeconds);
  goalProgressEl.textContent = `${getGoalProgress(totalSeconds).toFixed(1)}%`;
  updateSats();
};

const updateDisplay = () => {
  if (!timerDisplay) {
    return;
  }
  timerDisplay.textContent = formatTime(elapsedSeconds);
};

const tick = () => {
  elapsedSeconds += 1;
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

const startTimer = () => {
  if (isRunning) {
    return;
  }
  isRunning = true;
  timerInterval = setInterval(tick, 1000);
  setDonationControlsEnabled(false);
};

const pauseTimer = () => {
  if (!isRunning) {
    return;
  }
  isRunning = false;
  clearInterval(timerInterval);
};

const resetTimer = () => {
  pauseTimer();
  elapsedSeconds = 0;
  updateDisplay();
  updateSats();
  setDonationControlsEnabled(true);
};

const getPlanValue = () => {
  return studyPlanInput?.value.trim() || localStorage.getItem(planKey) || "";
};

const loadSessions = (key = sessionsKey) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

const saveSessions = (sessions, key = sessionsKey) => {
  localStorage.setItem(key, JSON.stringify(sessions));
};

const getLastSessionSeconds = () => {
  try {
    const raw = localStorage.getItem(lastSessionKey);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) {
      return { durationSeconds: 0, goalMinutes: 0, plan: "", sessionId: "" };
    }
    return {
      durationSeconds: Number(parsed.durationSeconds || 0),
      goalMinutes: Number(parsed.goalMinutes || 0),
      plan: parsed.plan || "",
      sessionId: parsed.sessionId || "",
    };
  } catch (error) {
    return { durationSeconds: 0, goalMinutes: 0, plan: "", sessionId: "" };
  }
};

const setLastSessionSeconds = (value) => {
  localStorage.setItem(lastSessionKey, JSON.stringify(value));
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
        <div>실제 공부 시간: <strong>${formatMinutesSeconds(
          session.durationSeconds
        )}</strong> <span class="session-rate">(${sessionGoalRate.toFixed(
      1
    )}%)</span></div>
        <div>목표 공부 시간: <strong>${session.goalMinutes}분</strong></div>
        <div>학습 목표: <strong>${session.plan || "미입력"}</strong></div>
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
  if (!dateSelect || !listEl || !emptyEl) {
    return;
  }
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
      finishButton.textContent = "공부 종료";
    }, 2000);
    return;
  }
  pauseTimer();
  const plan = getPlanValue();
  const goalMinutes = Number(goalInput.value || 0);
  const achieved = goalMinutes > 0 ? elapsedSeconds >= goalMinutes * 60 : false;
  const sessionId = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const sessions = loadSessions();
  sessions.push({
    durationSeconds: elapsedSeconds,
    goalMinutes,
    plan,
    achieved,
    timestamp: new Date().toISOString(),
    sessionId,
  });
  saveSessions(sessions);
  sessionPage = Math.ceil(sessions.length / 2);
  const total = getStoredTotal() + elapsedSeconds;
  setStoredTotal(total);
  setLastSessionSeconds({ durationSeconds: elapsedSeconds, goalMinutes, plan, sessionId });
  if (donationScope?.value === "daily") {
    const pending = getPendingDaily();
    const entry = pending[todayKey] || {
      seconds: 0,
      sats: 0,
      count: 0,
      plan: "",
      goalMinutes: 0,
      mode: donationMode?.value || "time",
      note: "",
    };
    const rate = Number(satsRateInput.value || 0);
    const count = Number(donationCountInput?.value || 0);
    const sessionSats = calculateSats({
      mode: donationMode?.value || "time",
      rate,
      seconds: elapsedSeconds,
      count,
    });
    entry.seconds += elapsedSeconds;
    entry.sats += sessionSats;
    entry.count += donationMode?.value === "time" ? 0 : count;
    entry.plan = plan || entry.plan;
    entry.goalMinutes = goalMinutes || entry.goalMinutes;
    entry.mode = donationMode?.value || entry.mode;
    pending[todayKey] = entry;
    savePendingDaily(pending);
  }
  elapsedSeconds = 0;
  updateDisplay();
  updateTotals();
  renderSessions();
  finishButton.textContent = "인증 카드 만들기 완료!";
  setTimeout(() => {
    finishButton.textContent = "공부 종료";
  }, 2000);
  if (photoSource) {
    drawBadge();
  }
  setDonationControlsEnabled(true);
  openCameraButton?.focus();
};

const getDonationHistory = () =>
  JSON.parse(localStorage.getItem(donationHistoryKey) || "[]");

const getDonatedSecondsByScope = ({ scope, dateKey } = {}) => {
  const history = getDonationHistory();
  const uniqueSessions = new Set();
  let totalSeconds = 0;
  history.forEach((entry) => {
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
  const scope = donationScope?.value || "session";
  if (scope === "session") {
    return getLastSessionSeconds().durationSeconds;
  }
  if (scope === "daily") {
    const available = getStoredTotal() - getDonatedSecondsByScope({ scope, dateKey: todayKey });
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

const calculateSats = ({ mode, rate, seconds, count }) => {
  if (mode === "time") {
    const totalMinutes = Math.floor(seconds / 60);
    return totalMinutes * rate;
  }
  return count * rate;
};

const getDonationSatsForScope = () => {
  const mode = donationMode?.value || "time";
  const rate = Number(satsRateInput.value || 0);
  const count = Number(donationCountInput?.value || 0);
  return calculateSats({
    mode,
    rate,
    seconds: getDonationSeconds(),
    count,
  });
};

const updateAccumulatedSats = () => {
  const sats = getDonationSatsForScope();
  if (currentTotalSats) {
    currentTotalSats.textContent = `${sats} sats`;
  }
  if (donationPageTotal) {
    donationPageTotal.textContent = `${sats} sats`;
  }
};

const updateSats = () => {
  if (!satsTotalEl) {
    return;
  }
  const mode = donationMode?.value || "time";
  const rate = Number(satsRateInput.value || 0);
  const count = Number(donationCountInput?.value || 0);
  const sats = calculateSats({
    mode,
    rate,
    seconds: getSessionEstimateSeconds(),
    count,
  });
  satsTotalEl.textContent = `${sats} sats`;
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
    const scopeLabels = { session: "회차 별", daily: "하루 단위", total: "누적 후 한번" };
    const scopeLabel = scopeLabels[item.scope] || "누적";
    const modeLabel = donationModeLabels[item.mode] || "공부 시간";
    const countLabel = item.mode === "time" ? "" : ` · 기준 수량 ${item.count || 0}`;
    entry.innerHTML = `
      <div><strong>${item.date}</strong> · ${scopeLabel} · ${modeLabel}${countLabel}</div>
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
  if (!satsTotalAllEl) {
    return;
  }
  const total = getDonationHistory().reduce((sum, item) => sum + (item.sats || 0), 0);
  satsTotalAllEl.textContent = `${total} sats`;
  updateAccumulatedSats();
};

const donationModeLabels = {
  time: "공부 시간",
  pages: "페이지 수",
  problems: "문제/단어 수",
  other: "기타",
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
  if (!monthSelect || !listEl || !emptyEl) {
    return;
  }
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
      const scopeLabels = { session: "회차 별", daily: "하루 단위", total: "누적 후 한번" };
      const scopeLabel = scopeLabels[item.scope] || "누적";
      const modeLabel = donationModeLabels[item.mode] || "공부 시간";
      const countLabel = item.mode === "time" ? "" : ` · 기준 수량 ${item.count || 0}`;
      entry.innerHTML = `
        <div><strong>${item.date}</strong> · ${scopeLabel} · ${modeLabel}${countLabel}</div>
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
  updateDisplay();
  updateTotals();
  updateDonationTotals();
  renderDonationHistory();
  updateDonationModeUI();
};

const saveDonationHistoryEntry = ({
  date,
  sats,
  minutes,
  seconds,
  mode,
  scope,
  sessionId = "",
  count = 0,
  note = "",
}) => {
  const history = getDonationHistory();
  history.push({
    date,
    sats,
    minutes,
    seconds,
    mode,
    scope,
    sessionId,
    count,
    note,
  });
  localStorage.setItem(donationHistoryKey, JSON.stringify(history));
  updateDonationTotals();
  renderDonationHistory();
};

const promptPendingDailyDonation = async () => {
  if (!badgeCanvas || !shareDiscordButton) {
    return;
  }
  const pending = getPendingDaily();
  const dates = Object.keys(pending).sort();
  const pendingDate = dates.find((date) => date < todayKey);
  if (!pendingDate) {
    return;
  }
  const entry = pending[pendingDate];
  if (!entry || entry.sats <= 0) {
    return;
  }
  const confirmDonation = window.confirm(
    `${pendingDate} 누적 기부 ${entry.sats} sats가 있습니다. 지금 기부하고 공부를 시작할까요?`
  );
  if (!confirmDonation) {
    return;
  }
  const sessionData = {
    durationSeconds: entry.seconds || 0,
    goalMinutes: entry.goalMinutes || Number(goalInput?.value || 0),
    plan: entry.plan || `${pendingDate} 누적 학습`,
  };
  drawBadge(sessionData);
  const payload = buildDonationPayload({
    dataUrl: getBadgeDataUrl(),
    plan: sessionData.plan,
    durationSeconds: sessionData.durationSeconds,
    goalMinutes: sessionData.goalMinutes,
    sats: entry.sats,
    donationModeValue: entry.mode || "time",
    donationScopeValue: "daily",
    count: entry.count || 0,
    donationNoteValue: entry.note || "",
  });
  await openLightningWalletWithPayload(payload, {
    onSuccess: () => {
      saveDonationHistoryEntry({
        date: pendingDate,
        sats: entry.sats,
        minutes: Math.floor((entry.seconds || 0) / 60),
        seconds: entry.seconds || 0,
        mode: entry.mode || "time",
        scope: "daily",
        count: entry.count || 0,
        note: entry.note || "",
      });
      delete pending[pendingDate];
      savePendingDaily(pending);
    },
  });
};

const buildDonationPayload = ({
  dataUrl,
  plan,
  durationSeconds,
  goalMinutes,
  sats,
  donationScopeValue,
  donationModeValue,
  count,
  donationNoteValue,
}) => {
  const goalRate = goalMinutes
    ? Math.min(100, (durationSeconds / 60 / goalMinutes) * 100).toFixed(1)
    : "0.0";
  return {
    dataUrl,
    plan: plan || "학습 목표 미입력",
    studyTime: formatMinutesSeconds(durationSeconds || 0),
    goalRate: `${goalRate}%`,
    minutes: Math.floor((durationSeconds || 0) / 60),
    sats,
    donationMode: donationModeValue || "time",
    donationScope: donationScopeValue || "total",
    count,
    wordCount: count,
    donationNote: donationNoteValue || "",
    username: loginUserName?.textContent || "",
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
    const response = await fetch("/api/donation-invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let errorMessage = "";
      try {
        const parsed = await response.clone().json();
        errorMessage = parsed?.message || "";
      } catch (error) {
        errorMessage = await response.text();
      }
      throw new Error(errorMessage || "인보이스 생성에 실패했습니다.");
    }
    const result = await response.json();
    if (!result?.invoice) {
      throw new Error("인보이스 응답이 비어 있습니다.");
    }
    const normalizedInvoice = normalizeInvoice(result.invoice);
    if (!normalizedInvoice) {
      throw new Error("인보이스 형식이 올바르지 않습니다.");
    }
    if (shareStatus) {
      shareStatus.textContent =
        "지갑 앱을 열었습니다. 결제 완료 시 디스코드에 자동 공유됩니다.";
    }
    if (onSuccess) {
      onSuccess();
    }
    openWalletSelection({
      invoice: normalizedInvoice,
      message: "원하는 지갑을 선택하면 결제가 이어집니다.",
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
  const sats = getDonationSatsForScope();
  const dataUrl = getBadgeDataUrl();
  const lastSession = getLastSessionSeconds();
  const donationSeconds = getDonationSeconds();
  const payload = buildDonationPayload({
    dataUrl,
    plan: lastSession.plan,
    durationSeconds: donationSeconds,
    goalMinutes: lastSession.goalMinutes,
    sats,
    donationModeValue: donationMode?.value || "time",
    donationScopeValue: donationScope?.value || "total",
    count: Number(donationCountInput?.value || 0),
    donationNoteValue: donationNote?.value?.trim() || "",
  });
  await openLightningWalletWithPayload(payload);
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
};

const openWalletSelection = ({ invoice, message } = {}) => {
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

const closeWalletSelection = () => {
  if (!walletModal) {
    return;
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
      planStatus.textContent = "학습 목표가 저장되었습니다.";
    }
  } else {
    localStorage.removeItem(planKey);
    if (planStatus) {
      planStatus.textContent = "학습 목표는 자동 저장됩니다.";
    }
  }
  if (studyPlanInput) {
    studyPlanInput.value = trimmed;
  }
  if (studyPlanPreview) {
    studyPlanPreview.value = trimmed;
  }
};

const saveStudyPlan = () => {
  if (!studyPlanInput) {
    return;
  }
  applyStudyPlanValue(studyPlanInput.value);
};

const updateDonationModeUI = () => {
  if (!donationMode || !donationCountField || !donationCountInput) {
    return;
  }
  const mode = donationMode.value;
  const isTime = mode === "time";
  donationCountField.classList.toggle("hidden", isTime);
  const label = donationCountField.querySelector("span");
  const labelTextMap = {
    pages: "오늘 공부한 페이지 수",
    problems: "오늘 푼 문제(단어) 수",
    other: "기타 기준 수량",
  };
  if (label) {
    label.textContent = labelTextMap[mode] || "기준 수량";
  }
  if (isTime) {
    donationCountInput.value = "0";
  }
  updateSats();
};

const updateDiscordProfile = ({ user, guild, authorized }) => {
  if (!discordProfile) {
    return;
  }
  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";
  const bannerUrl = user?.banner
    ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=480`
    : "";
  discordAvatar.src = avatarUrl;
  discordAvatar.alt = user?.username ? `${user.username} avatar` : "Discord avatar";
  discordAvatar.classList.remove("status-ok", "status-pending");
  if (authorized === true) {
    discordAvatar.classList.add("status-ok");
  } else if (authorized === false) {
    discordAvatar.classList.add("status-pending");
  }
  discordBanner.style.backgroundImage = bannerUrl ? `url(${bannerUrl})` : "";
  discordBanner.style.backgroundSize = "cover";
  discordUsername.textContent = user?.username ?? "로그인된 사용자 없음";
  if (discordGuild) {
    const guildName = guild?.name ?? "-";
    discordGuild.textContent = `서버: ${guildName}`;
  }
  if (loginUserName && user?.username) {
    loginUserName.textContent = user.username;
  }
};

const setAuthState = ({ authenticated, authorized, user, guild, error }) => {
  if (error) {
    discordStatus.textContent = `로그인 상태: ${error}`;
    discordHint.textContent = "서버 설정을 확인해주세요.";
    mainContent.classList.add("locked");
    discordLogout.style.display = "none";
    if (discordRefresh) {
      discordRefresh.style.display = "none";
    }
    discordProfile.style.display = "none";
    if (discordAvatar) {
      discordAvatar.classList.remove("status-ok", "status-pending");
    }
    if (loginUser) {
      loginUser.classList.add("hidden");
    }
    discordAppLogin.style.display = "inline-flex";
    discordWebLogin.style.display = "inline-flex";
    if (allowedServer) {
      allowedServer.textContent = "접속 가능 서버: 확인 실패";
    }
    return;
  }

  if (!authenticated) {
    discordStatus.textContent = "로그인 상태: 미인증";
    discordHint.textContent = "Discord 로그인 후 역할(Role) 검증이 완료됩니다.";
    mainContent.classList.add("locked");
    discordLogout.style.display = "none";
    if (discordRefresh) {
      discordRefresh.style.display = "none";
    }
    discordProfile.style.display = "none";
    if (discordAvatar) {
      discordAvatar.classList.remove("status-ok", "status-pending");
    }
    if (loginUser) {
      loginUser.classList.add("hidden");
    }
    discordAppLogin.style.display = "inline-flex";
    discordWebLogin.style.display = "inline-flex";
    if (allowedServer) {
      allowedServer.textContent = "접속 가능 서버: 로그인 필요";
    }
    return;
  }

  if (!authorized) {
    discordStatus.textContent = "로그인 상태: 역할 미충족";
    discordHint.textContent = "지정된 Role 권한이 필요합니다.";
    mainContent.classList.add("locked");
    discordLogout.style.display = "inline-flex";
    if (discordRefresh) {
      discordRefresh.style.display = "inline-flex";
    }
    discordProfile.style.display = "block";
    if (loginUser) {
      loginUser.classList.remove("hidden");
    }
    discordAppLogin.style.display = "none";
    discordWebLogin.style.display = "none";
    if (allowedServer) {
      const guildName = guild?.name ?? "citadel.sx";
      allowedServer.textContent = `접속 가능 서버: ${guildName}`;
    }
    if (user && loginUserName) {
      loginUserName.textContent = user.username ?? "-";
    }
    updateDiscordProfile({ user, guild, authorized: false });
    return;
  }

  const roleName = guild?.roleName || "지정 역할";
  discordStatus.textContent = `로그인 상태: 역할(${roleName}) 확인`;
  discordHint.textContent = "역할(Role) 확인 완료. 모든 기능을 사용할 수 있습니다.";
  mainContent.classList.remove("locked");
  discordLogout.style.display = "inline-flex";
  if (discordRefresh) {
    discordRefresh.style.display = "inline-flex";
  }
  discordProfile.style.display = "block";
  if (loginUser) {
    loginUser.classList.remove("hidden");
  }
  discordAppLogin.style.display = "none";
  discordWebLogin.style.display = "none";
  updateDiscordProfile({ user, guild, authorized: true });
  if (allowedServer) {
    const guildName = guild?.name ?? "citadel.sx";
    allowedServer.textContent = `접속 가능 서버: ${guildName}`;
  }
  if (!hasPromptedDaily) {
    hasPromptedDaily = true;
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

startButton?.addEventListener("click", startTimer);
pauseButton?.addEventListener("click", pauseTimer);
resetButton?.addEventListener("click", resetTimer);
finishButton?.addEventListener("click", finishSession);
goalInput?.addEventListener("input", updateTotals);
if (donationMode) {
  donationMode.addEventListener("change", () => {
    updateDonationModeUI();
  });
}
donationScope?.addEventListener("change", updateSats);
donationCountInput?.addEventListener("input", updateSats);
satsRateInput?.addEventListener("input", updateSats);
studyPlanInput?.addEventListener("input", saveStudyPlan);
studyPlanPreview?.addEventListener("input", (event) => {
  applyStudyPlanValue(event.target.value);
});

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
};

openCameraButton?.addEventListener("click", async () => {
  try {
    stopCamera();
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false,
    });
    cameraVideo.srcObject = cameraStream;
    cameraVideo.style.display = "block";
    snapshotCanvas.style.display = "none";
    photoPreview.style.display = "none";
    badgeCanvas.style.display = "none";
  } catch (error) {
    alert("카메라를 열 수 없습니다. 권한을 확인해주세요.");
  }
});

captureButton?.addEventListener("click", () => {
  if (!cameraStream) {
    alert("먼저 카메라를 열어주세요.");
    return;
  }
  const context = snapshotCanvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  snapshotCanvas.style.display = "block";
  cameraVideo.style.display = "none";
  photoPreview.style.display = "none";
  badgeCanvas.style.display = "none";
  photoSource = snapshotCanvas;
  stopCamera();
});

photoUpload?.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const url = URL.createObjectURL(file);
  photoPreview.src = url;
  photoPreview.style.display = "block";
  snapshotCanvas.style.display = "none";
  cameraVideo.style.display = "none";
  badgeCanvas.style.display = "none";
  photoSource = photoPreview;
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
  const overlayHeight = 340;

  context.fillStyle = "rgba(15, 23, 42, 0.65)";
  context.fillRect(0, badgeCanvas.height - overlayHeight, badgeCanvas.width, overlayHeight);

  context.fillStyle = "#f8fafc";
  context.font = "bold 52px sans-serif";
  context.fillText("오늘의 공부 인증", 60, badgeCanvas.height - overlayHeight + 90);

  context.font = "bold 36px sans-serif";
  const plan = lastSession.plan || "학습 목표 미입력";
  context.fillText(`학습목표: ${plan}`, 60, badgeCanvas.height - overlayHeight + 150);

  context.font = "28px sans-serif";
  const studyTimeLabel = formatMinutesSeconds(lastSession.durationSeconds || 0);
  context.fillText(`Study Time: ${studyTimeLabel}`, 60, badgeCanvas.height - overlayHeight + 205);

  context.fillText(
    `Goal Rate: ${lastGoalRate.toFixed(1)}%`,
    60,
    badgeCanvas.height - overlayHeight + 245
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

const shareToDiscord = async () => {
  await openLightningWallet();
};

generateButton?.addEventListener("click", () => {
  if (!photoSource) {
    alert("먼저 사진을 촬영하거나 업로드해주세요.");
    return;
  }
  drawBadge();
});

shareDiscordButton?.addEventListener("click", shareToDiscord);

donateButton?.addEventListener("click", () => {
  const donationSeconds = getDonationSeconds();
  const totalMinutes = Math.floor(donationSeconds / 60);
  const mode = donationMode?.value || "time";
  const sats = getDonationSatsForScope();
  const note = donationNote.value.trim();
  const lastSession = getLastSessionSeconds();
  const count = Number(donationCountInput?.value || 0);
  saveDonationHistoryEntry({
    date: todayKey,
    sats,
    minutes: totalMinutes,
    seconds: donationSeconds,
    mode,
    scope: donationScope?.value || "total",
    sessionId: donationScope?.value === "session" ? lastSession.sessionId : "",
    count,
    note,
  });
  donationStatus.textContent = `오늘 ${sats} sats 기부 기록을 저장했습니다.`;
  donationPage = 1;
});

donationPagePay?.addEventListener("click", () => {
  openLightningWallet();
});

window.addEventListener("beforeunload", () => {
  pauseTimer();
});

initializeTotals();
loadStudyPlan();
renderSessions();
renderStudyHistoryPage();
renderDonationHistoryPage();
promptPendingDailyDonation();

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

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, .file");
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
    if (!ignoreUrlFlag && params.get("unauthorized")) {
      setAuthState({ authenticated: true, authorized: false });
      return;
    }
    if (ignoreUrlFlag && params.has("unauthorized")) {
      params.delete("unauthorized");
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", nextUrl);
    }
    if (discordStatus) {
      discordStatus.textContent = "로그인 상태: 확인 중...";
    }
    const response = await fetch("/api/session");
    if (!response.ok) {
      setAuthState({ error: "서버 연결 실패" });
      return;
    }
    const data = await response.json();
    setAuthState(data);
  } catch (error) {
    setAuthState({ error: "서버 연결 실패" });
  }
};

loadSession();
promptPendingDailyDonation();
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
