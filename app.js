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
const wordCountField = document.getElementById("word-count-field");
const wordRateField = document.getElementById("word-rate-field");
const wordCountInput = document.getElementById("word-count");
const wordRateInput = document.getElementById("word-rate");

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
const walletModal = document.getElementById("wallet-modal");
const walletModalClose = document.getElementById("wallet-modal-close");
const walletStatus = document.getElementById("wallet-status");
const walletOptions = document.querySelectorAll(".wallet-option");
const walletInvoice = document.getElementById("wallet-invoice");
const walletInvoiceText = document.getElementById("wallet-invoice-text");
const walletInvoiceCopy = document.getElementById("wallet-invoice-copy");
const walletInvoiceQr = document.getElementById("wallet-invoice-qr");

let timerInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let cameraStream = null;
let photoSource = null;

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

const updateTotals = () => {
  if (!totalTodayEl || !goalProgressEl) {
    return;
  }
  const totalSeconds = getStoredTotal();
  totalTodayEl.textContent = formatMinutesSeconds(totalSeconds);
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

const renderSessionItems = (sessions, listEl, emptyEl) => {
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
    item.innerHTML = `
      <div class="session-header">
        <span class="session-index">${index + 1}회차</span>
        <span class="session-status ${achieved ? "success" : "pending"}">${
      achieved ? "달성" : "미달성"
    }</span>
      </div>
      <div class="session-meta">
        <div>실제 공부 시간: <strong>${formatMinutesSeconds(
          session.durationSeconds
        )}</strong></div>
        <div>목표 공부 시간: <strong>${session.goalMinutes}분</strong></div>
        <div>학습 목표: <strong>${session.plan || "미입력"}</strong></div>
      </div>
    `;
    listEl.appendChild(item);
  });
};

const renderSessions = () => {
  if (!sessionList) {
    return;
  }
  renderSessionItems(loadSessions(), sessionList, sessionEmpty);
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
      finishButton.textContent = "공부 종료 & 인증하기";
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
  const total = getStoredTotal() + elapsedSeconds;
  setStoredTotal(total);
  setLastSessionSeconds({ durationSeconds: elapsedSeconds, goalMinutes, plan, sessionId });
  elapsedSeconds = 0;
  updateDisplay();
  updateTotals();
  renderSessions();
  finishButton.textContent = "인증 카드 만들기 완료!";
  setTimeout(() => {
    finishButton.textContent = "공부 종료 & 인증하기";
  }, 2000);
  if (photoSource) {
    drawBadge();
  }
  openCameraButton?.focus();
};

const getDonationHistory = () =>
  JSON.parse(localStorage.getItem(donationHistoryKey) || "[]");

const getDonatedSessionSeconds = (dateKey) => {
  const history = getDonationHistory();
  const uniqueSessions = new Set();
  let totalSeconds = 0;
  history.forEach((entry) => {
    if (entry.date !== dateKey || entry.scope !== "session") {
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

const getDonationSeconds = () => {
  if (donationScope?.value === "session") {
    return getLastSessionSeconds().durationSeconds;
  }
  const available = getStoredTotal() - getDonatedSessionSeconds(todayKey);
  return Math.max(0, available);
};

const updateSats = () => {
  if (!satsTotalEl) {
    return;
  }
  const mode = donationMode?.value || "time";
  if (mode === "words") {
    const words = Number(wordCountInput?.value || 0);
    const rate = Number(wordRateInput?.value || 0);
    const sats = words * rate;
    satsTotalEl.textContent = `${sats} sats`;
    return;
  }
  const rate = Number(satsRateInput.value || 0);
  const totalMinutes = Math.floor(getDonationSeconds() / 60);
  const sats = totalMinutes * rate;
  satsTotalEl.textContent = `${sats} sats`;
};

const renderDonationHistory = () => {
  if (!donationHistory || !donationHistoryEmpty) {
    return;
  }
  const history = getDonationHistory().filter((item) => item.date === todayKey);
  donationHistory.innerHTML = "";
  donationHistoryEmpty.style.display = history.length ? "none" : "block";
  history.slice().reverse().forEach((item) => {
    const entry = document.createElement("div");
    entry.className = "history-item";
    const scopeLabel = item.scope === "session" ? "회차 별" : "누적";
    const modeLabel = item.mode === "words" ? "공부량" : "공부 시간";
    entry.innerHTML = `
      <div><strong>${item.date}</strong> · ${scopeLabel} · ${modeLabel}</div>
      <div>기부: <strong>${item.sats} sats</strong> · ${item.minutes}분</div>
      <div>메모: ${item.note || "없음"}</div>
    `;
    donationHistory.appendChild(entry);
  });
};

const updateDonationTotals = () => {
  if (!satsTotalAllEl) {
    return;
  }
  const total = getDonationHistory().reduce((sum, item) => sum + (item.sats || 0), 0);
  satsTotalAllEl.textContent = `${total} sats`;
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
    const grouped = history.reduce((acc, entry) => {
      if (!acc[entry.date]) {
        acc[entry.date] = [];
      }
      acc[entry.date].push(entry);
      return acc;
    }, {});
    Object.keys(grouped)
      .sort()
      .reverse()
      .forEach((date) => {
        const dayBlock = document.createElement("div");
        dayBlock.className = "history-day";
        dayBlock.innerHTML = `<p class="history-day__title">${date}</p>`;
        grouped[date].forEach((item) => {
          const entry = document.createElement("div");
          entry.className = "history-item";
          const scopeLabel = item.scope === "session" ? "회차 별" : "누적";
          const modeLabel = item.mode === "words" ? "공부량" : "공부 시간";
          entry.innerHTML = `
            <div>${scopeLabel} · ${modeLabel}</div>
            <div>기부: <strong>${item.sats} sats</strong> · ${item.minutes}분</div>
            <div>메모: ${item.note || "없음"}</div>
          `;
          dayBlock.appendChild(entry);
        });
        listEl.appendChild(dayBlock);
      });
    if (currentLabel) {
      currentLabel.textContent = monthKey;
    }
  };
  const initialMonth = months[0];
  monthSelect.value = initialMonth;
  renderForMonth(initialMonth);
  monthSelect.addEventListener("change", (event) => {
    renderForMonth(event.target.value);
  });
};

const initializeTotals = () => {
  updateDisplay();
  updateTotals();
  updateDonationTotals();
  renderDonationHistory();
};

const openLightningWallet = async () => {
  const sats = Number((satsTotalEl.textContent || "0").replace(/\D/g, "")) || 0;
  if (sats <= 0) {
    alert("기부할 사토시 금액을 먼저 확인해주세요.");
    return;
  }
  const dataUrl = getBadgeDataUrl();
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }
  openWalletSelection({
    message: "인보이스를 생성하는 중입니다. 잠시만 기다려주세요.",
  });
  const lastSession = getLastSessionSeconds();
  const donationSeconds = getDonationSeconds();
  const donationMinutes = Math.floor(donationSeconds / 60);
  const payload = {
    dataUrl,
    plan: lastSession.plan || "학습 목표 미입력",
    studyTime: formatMinutesSeconds(lastSession.durationSeconds || 0),
    goalRate: `${
      lastSession.goalMinutes
        ? Math.min(
            100,
            (lastSession.durationSeconds / 60 / lastSession.goalMinutes) * 100
          ).toFixed(1)
        : "0.0"
    }%`,
    minutes: donationMinutes,
    sats,
    donationMode: donationMode?.value || "time",
    donationScope: donationScope?.value || "total",
    wordCount: Number(wordCountInput?.value || 0),
    donationNote: donationNote?.value?.trim() || "",
    username: loginUserName?.textContent || "",
  };
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

const walletDeepLinks = {
  walletofsatoshi: (invoice) =>
    `walletofsatoshi://pay?invoice=${encodeURIComponent(invoice)}`,
  speed: (invoice) => getLightningUri(invoice),
  blink: (invoice) => `lightning:${invoice}`,
  strike: (invoice) => `strike://pay?invoice=${encodeURIComponent(invoice)}`,
  zeus: (invoice) => getLightningUri(invoice),
};

const setWalletOptionsEnabled = (enabled) => {
  walletOptions.forEach((option) => {
    option.disabled = !enabled;
  });
  if (walletInvoiceCopy) {
    walletInvoiceCopy.disabled = !enabled;
  }
};

const renderWalletInvoice = (invoice) => {
  if (!walletInvoice || !walletInvoiceText || !walletInvoiceQr) {
    return;
  }
  const normalizedInvoice = normalizeInvoice(invoice);
  if (!normalizedInvoice) {
    walletInvoice.classList.add("hidden");
    walletInvoiceText.value = "";
    walletInvoiceQr.src = "";
    return;
  }
  walletInvoice.classList.remove("hidden");
  walletInvoiceText.value = normalizedInvoice;
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
};

const launchWallet = (walletKey) => {
  const invoice = walletModal?.dataset?.invoice;
  if (!invoice) {
    alert("인보이스 정보를 찾을 수 없습니다.");
    return;
  }
  const deepLinkBuilder = walletDeepLinks[walletKey];
  const deepLink = deepLinkBuilder ? deepLinkBuilder(invoice) : `lightning:${invoice}`;
  closeWalletSelection();
  window.location.href = deepLink;
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

const saveStudyPlan = () => {
  if (!studyPlanInput) {
    return;
  }
  const value = studyPlanInput.value.trim();
  if (value) {
    localStorage.setItem(planKey, value);
    if (planStatus) {
      planStatus.textContent = "학습 목표가 저장되었습니다.";
    }
    if (studyPlanPreview) {
      studyPlanPreview.value = value;
    }
  } else {
    localStorage.removeItem(planKey);
    if (planStatus) {
      planStatus.textContent = "학습 목표는 자동 저장됩니다.";
    }
    if (studyPlanPreview) {
      studyPlanPreview.value = "";
    }
  }
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

satsRateInput?.addEventListener("input", updateSats);
goalInput?.addEventListener("input", updateTotals);
if (donationMode) {
  donationMode.addEventListener("change", () => {
    const isWords = donationMode.value === "words";
    wordCountField?.classList.toggle("hidden", !isWords);
    wordRateField?.classList.toggle("hidden", !isWords);
    satsRateInput.closest("label")?.classList.toggle("hidden", isWords);
    updateSats();
  });
}
donationScope?.addEventListener("change", updateSats);
wordCountInput?.addEventListener("input", updateSats);
wordRateInput?.addEventListener("input", updateSats);
studyPlanInput?.addEventListener("input", saveStudyPlan);

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

const drawBadge = () => {
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

  const lastSession = getLastSessionSeconds();
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
  const sats =
    mode === "words"
      ? Number(wordCountInput?.value || 0) * Number(wordRateInput?.value || 0)
      : totalMinutes * Number(satsRateInput.value || 0);
  const note = donationNote.value.trim();
  const history = getDonationHistory();
  const lastSession = getLastSessionSeconds();
  history.push({
    date: todayKey,
    sats,
    minutes: totalMinutes,
    seconds: donationSeconds,
    mode,
    scope: donationScope?.value || "total",
    sessionId: donationScope?.value === "session" ? lastSession.sessionId : "",
    words: Number(wordCountInput?.value || 0),
    note,
  });
  localStorage.setItem(donationHistoryKey, JSON.stringify(history));
  donationStatus.textContent = `오늘 ${sats} sats 기부 기록을 저장했습니다.`;
  updateDonationTotals();
  renderDonationHistory();
});

window.addEventListener("beforeunload", () => {
  pauseTimer();
});

initializeTotals();
loadStudyPlan();
renderSessions();
renderStudyHistoryPage();
renderDonationHistoryPage();

walletModalClose?.addEventListener("click", closeWalletSelection);
walletModal?.addEventListener("click", (event) => {
  if (event.target === walletModal) {
    closeWalletSelection();
  }
});
walletOptions.forEach((option) => {
  option.addEventListener("click", (event) => {
    const walletKey = event.currentTarget?.dataset?.wallet;
    if (walletKey) {
      launchWallet(walletKey);
    }
  });
});

walletInvoiceCopy?.addEventListener("click", async () => {
  const invoice = walletInvoiceText?.value || "";
  if (!invoice) {
    return;
  }
  try {
    await navigator.clipboard.writeText(invoice);
    if (walletStatus) {
      walletStatus.textContent = "인보이스를 복사했습니다.";
    }
  } catch (error) {
    if (walletStatus) {
      walletStatus.textContent = "인보이스 복사에 실패했습니다.";
    }
  }
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
