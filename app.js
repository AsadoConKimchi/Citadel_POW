const timerDisplay = document.getElementById("timer-display");
const goalInput = document.getElementById("goal-minutes");
const totalTodayEl = document.getElementById("total-today");
const goalProgressEl = document.getElementById("goal-progress");
const satsRateInput = document.getElementById("sats-rate");
const satsTotalEl = document.getElementById("sats-total");
const finishButton = document.getElementById("finish");
const studyPlanInput = document.getElementById("study-plan");
const planStatus = document.getElementById("plan-status");
const shareDiscordButton = document.getElementById("share-discord");
const shareStatus = document.getElementById("share-status");
const donationMode = document.getElementById("donation-mode");
const wordCountField = document.getElementById("word-count-field");
const wordRateField = document.getElementById("word-rate-field");
const wordCountInput = document.getElementById("word-count");
const wordRateInput = document.getElementById("word-rate");

const startButton = document.getElementById("start");
const pauseButton = document.getElementById("pause");
const resetButton = document.getElementById("reset");

const discordAppLogin = document.getElementById("discord-app-login");
const discordWebLogin = document.getElementById("discord-web-login");
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

const studyLanguageInput = document.getElementById("study-language");
const studyTopicInput = document.getElementById("study-topic");
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

let timerInterval = null;
let elapsedSeconds = 0;
let isRunning = false;
let cameraStream = null;
let photoSource = null;

const todayKey = new Date().toISOString().slice(0, 10);
const planKey = `citadel-plan-${todayKey}`;

const formatTime = (seconds) => {
  const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${hrs}:${mins}:${secs}`;
};

const getStoredTotal = () => {
  const saved = Number(localStorage.getItem(`citadel-total-${todayKey}`) || 0);
  return Number.isNaN(saved) ? 0 : saved;
};

const setStoredTotal = (value) => {
  localStorage.setItem(`citadel-total-${todayKey}`, String(value));
};

const updateTotals = () => {
  const totalSeconds = getStoredTotal();
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  totalTodayEl.textContent = `${String(minutes).padStart(2, "0")}분 ${String(seconds).padStart(2, "0")}초`;
  const goalMinutes = Number(goalInput.value || 0);
  const progress = goalMinutes > 0 ? Math.min(100, (totalSeconds / 60 / goalMinutes) * 100) : 0;
  goalProgressEl.textContent = `${progress.toFixed(1)}%`;
  updateSats();
};

const updateDisplay = () => {
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

const finishSession = () => {
  if (elapsedSeconds === 0) {
    finishButton.textContent = "기록할 시간이 없습니다";
    setTimeout(() => {
      finishButton.textContent = "공부 종료 & 인증하기";
    }, 2000);
    return;
  }
  pauseTimer();
  const total = getStoredTotal() + elapsedSeconds;
  setStoredTotal(total);
  elapsedSeconds = 0;
  updateDisplay();
  updateTotals();
  finishButton.textContent = "인증 카드 만들기 완료!";
  setTimeout(() => {
    finishButton.textContent = "공부 종료 & 인증하기";
  }, 2000);
  document.getElementById("study-language").focus();
};

const updateSats = () => {
  const mode = donationMode?.value || "time";
  if (mode === "words") {
    const words = Number(wordCountInput?.value || 0);
    const rate = Number(wordRateInput?.value || 0);
    const sats = words * rate;
    satsTotalEl.textContent = `${sats} sats`;
    return;
  }
  const rate = Number(satsRateInput.value || 0);
  const totalMinutes = Math.floor(getStoredTotal() / 60);
  const sats = totalMinutes * rate;
  satsTotalEl.textContent = `${sats} sats`;
};

const initializeTotals = () => {
  updateDisplay();
  updateTotals();
};

const loadStudyPlan = () => {
  const savedPlan = localStorage.getItem(planKey);
  if (savedPlan && studyPlanInput) {
    studyPlanInput.value = savedPlan;
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
  } else {
    localStorage.removeItem(planKey);
    if (planStatus) {
      planStatus.textContent = "학습 목표는 자동 저장됩니다.";
    }
  }
};

const setAuthState = ({ authenticated, authorized, user, guild, error }) => {
  if (error) {
    discordStatus.textContent = `로그인 상태: ${error}`;
    discordHint.textContent = "서버 설정을 확인해주세요.";
    mainContent.classList.add("locked");
    discordLogout.style.display = "none";
    discordProfile.style.display = "none";
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
    discordProfile.style.display = "none";
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
    discordProfile.style.display = "none";
    if (allowedServer) {
      const guildName = guild?.name ?? "citadel.sx";
      allowedServer.textContent = `접속 가능 서버: ${guildName}`;
    }
    return;
  }

  discordStatus.textContent = `로그인 상태: ${user?.username ?? "인증됨"}`;
  discordHint.textContent = "역할(Role) 확인 완료. 모든 기능을 사용할 수 있습니다.";
  mainContent.classList.remove("locked");
  discordLogout.style.display = "inline-flex";
  discordProfile.style.display = "block";
  if (user) {
    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
      : "";
    const bannerUrl = user.banner
      ? `https://cdn.discordapp.com/banners/${user.id}/${user.banner}.png?size=480`
      : "";
    discordAvatar.src = avatarUrl || "https://cdn.discordapp.com/embed/avatars/0.png";
    discordBanner.style.backgroundImage = bannerUrl ? `url(${bannerUrl})` : "";
    discordBanner.style.backgroundSize = "cover";
    discordUsername.textContent = user.username;
  }
  if (guild?.name) {
    discordGuild.textContent = `서버: ${guild.name}`;
  }
  if (allowedServer) {
    const guildName = guild?.name ?? "citadel.sx";
    allowedServer.textContent = `접속 가능 서버: ${guildName}`;
  }
};

discordAppLogin.addEventListener("click", () => {
  window.location.href = "/auth/discord/app";
});

discordWebLogin.addEventListener("click", () => {
  window.location.href = "/auth/discord/web";
});

discordLogout.addEventListener("click", async () => {
  await fetch("/logout", { method: "POST" });
  window.location.reload();
});

startButton.addEventListener("click", startTimer);
pauseButton.addEventListener("click", pauseTimer);
resetButton.addEventListener("click", resetTimer);
finishButton.addEventListener("click", finishSession);

satsRateInput.addEventListener("input", updateSats);
goalInput.addEventListener("input", updateTotals);
if (donationMode) {
  donationMode.addEventListener("change", () => {
    const isWords = donationMode.value === "words";
    wordCountField?.classList.toggle("hidden", !isWords);
    wordRateField?.classList.toggle("hidden", !isWords);
    satsRateInput.closest("label")?.classList.toggle("hidden", isWords);
    updateSats();
  });
}
wordCountInput?.addEventListener("input", updateSats);
wordRateInput?.addEventListener("input", updateSats);
if (studyPlanInput) {
  studyPlanInput.addEventListener("input", saveStudyPlan);
}

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
};

openCameraButton.addEventListener("click", async () => {
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
  } catch (error) {
    alert("카메라를 열 수 없습니다. 권한을 확인해주세요.");
  }
});

captureButton.addEventListener("click", () => {
  if (!cameraStream) {
    alert("먼저 카메라를 열어주세요.");
    return;
  }
  const context = snapshotCanvas.getContext("2d");
  context.drawImage(cameraVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
  snapshotCanvas.style.display = "block";
  cameraVideo.style.display = "none";
  photoPreview.style.display = "none";
  photoSource = snapshotCanvas;
  stopCamera();
});

photoUpload.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }
  const url = URL.createObjectURL(file);
  photoPreview.src = url;
  photoPreview.style.display = "block";
  snapshotCanvas.style.display = "none";
  cameraVideo.style.display = "none";
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

  context.fillStyle = "rgba(15, 23, 42, 0.65)";
  context.fillRect(0, badgeCanvas.height - 280, badgeCanvas.width, 280);

  context.fillStyle = "#f8fafc";
  context.font = "bold 52px sans-serif";
  context.fillText("오늘의 공부 인증", 60, badgeCanvas.height - 200);

  context.font = "bold 40px sans-serif";
  const language = studyLanguageInput.value || "언어 미입력";
  context.fillText(`Language: ${language}`, 60, badgeCanvas.height - 140);

  context.font = "28px sans-serif";
  const topic = studyTopicInput.value || "주제 미입력";
  context.fillText(`Topic: ${topic}`, 60, badgeCanvas.height - 90);

  const totalMinutes = Math.floor(getStoredTotal() / 60);
  context.fillText(`Study Time: ${totalMinutes}분`, 60, badgeCanvas.height - 48);

  context.font = "24px sans-serif";
  const date = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  context.fillText(date, badgeCanvas.width - 300, badgeCanvas.height - 48);

  const dataUrl = badgeCanvas.toDataURL("image/png");
  downloadLink.href = dataUrl;
  downloadLink.style.display = "inline-flex";
  if (shareStatus) {
    shareStatus.textContent = "디스코드 공유와 기부 연동은 서버에서 설정해야 합니다.";
  }
};

const shareToDiscord = async () => {
  if (!badgeCanvas) {
    return;
  }
  const dataUrl = badgeCanvas.toDataURL("image/png");
  if (!dataUrl || dataUrl === "data:,") {
    alert("먼저 인증 카드를 생성해주세요.");
    return;
  }
  const payload = {
    dataUrl,
    language: studyLanguageInput.value || "언어 미입력",
    topic: studyTopicInput.value || "주제 미입력",
    minutes: Math.floor(getStoredTotal() / 60),
    sats: Number((satsTotalEl.textContent || "0").replace(/\D/g, "")) || 0,
    donationMode: donationMode?.value || "time",
    wordCount: Number(wordCountInput?.value || 0),
  };
  try {
    const response = await fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || "공유에 실패했습니다.");
    }
    const result = await response.json();
    if (shareStatus) {
      shareStatus.textContent = result.message || "디스코드 공유 완료!";
    }
  } catch (error) {
    if (shareStatus) {
      shareStatus.textContent = "공유에 실패했습니다. 서버 설정을 확인해주세요.";
    }
  }
};

generateButton.addEventListener("click", () => {
  if (!photoSource) {
    alert("먼저 사진을 촬영하거나 업로드해주세요.");
    return;
  }
  drawBadge();
});

if (shareDiscordButton) {
  shareDiscordButton.addEventListener("click", shareToDiscord);
}

donateButton.addEventListener("click", () => {
  const totalMinutes = Math.floor(getStoredTotal() / 60);
  const mode = donationMode?.value || "time";
  const sats =
    mode === "words"
      ? Number(wordCountInput?.value || 0) * Number(wordRateInput?.value || 0)
      : totalMinutes * Number(satsRateInput.value || 0);
  const note = donationNote.value.trim();
  const history = JSON.parse(localStorage.getItem("citadel-donations") || "[]");
  history.push({
    date: todayKey,
    sats,
    minutes: totalMinutes,
    mode,
    words: Number(wordCountInput?.value || 0),
    note,
  });
  localStorage.setItem("citadel-donations", JSON.stringify(history));
  donationStatus.textContent = `오늘 ${sats} sats 기부 기록을 저장했습니다.`;
});

window.addEventListener("beforeunload", () => {
  pauseTimer();
});

initializeTotals();
loadStudyPlan();

const loadSession = async () => {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unauthorized")) {
      setAuthState({ authenticated: true, authorized: false });
      return;
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
