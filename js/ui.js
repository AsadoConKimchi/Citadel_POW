/**
 * Citadel POW - UI 렌더링 모듈
 */

import { formatTime, donationModeLabels } from './utils.js';
import { loadSessions, getDonationHistory, getTotalDonatedSats, getSessionStorageDates, isPaidEntry, getTotalSecondsToday } from './storage.js';

// DOM 요소 참조
let sessionList = null;
let sessionEmpty = null;
let sessionPagination = null;
let donationHistory = null;
let donationHistoryEmpty = null;
let donationPagination = null;
let totalTodayEl = null;
let goalProgressEl = null;
let satsTotalEl = null;
let satsTotalAllEl = null;

// 페이지 상태
let sessionPage = 1;
let donationPage = 1;

// 초기화
export const initUI = (elements) => {
  sessionList = elements.sessionList;
  sessionEmpty = elements.sessionEmpty;
  sessionPagination = elements.sessionPagination;
  donationHistory = elements.donationHistory;
  donationHistoryEmpty = elements.donationHistoryEmpty;
  donationPagination = elements.donationPagination;
  totalTodayEl = elements.totalTodayEl;
  goalProgressEl = elements.goalProgressEl;
  satsTotalEl = elements.satsTotalEl;
  satsTotalAllEl = elements.satsTotalAllEl;
};

// 세션 아이템 렌더링
export const renderSessionItems = (sessions, listEl, emptyEl, { startIndex = 0 } = {}) => {
  if (!listEl) return;

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
        <span class="session-status ${achieved ? "success" : "pending"}">${achieved ? "달성" : "미달성"}</span>
      </div>
      <div class="session-meta">
        <div>실제 POW 시간: <strong>${formatTime(session.durationSeconds)}</strong> <span class="session-rate">(${sessionGoalRate.toFixed(1)}%)</span></div>
        <div>목표 POW 시간: <strong>${session.goalMinutes}분</strong></div>
        <div>오늘의 POW 목표: <strong>${session.plan || "미입력"}</strong></div>
      </div>
    `;
    listEl.appendChild(item);
  });
};

// 페이지네이션 렌더링
export const renderPagination = ({ container, currentPage, totalPages, onPageChange }) => {
  if (!container) return;

  container.innerHTML = "";
  if (totalPages <= 1) return;

  for (let page = 1; page <= totalPages; page++) {
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

// 세션 목록 렌더링
export const renderSessions = () => {
  if (!sessionList) return;

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

// 기부 기록 렌더링
export const renderDonationHistory = (todayKey) => {
  if (!donationHistory || !donationHistoryEmpty) return;

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
      renderDonationHistory(todayKey);
    },
  });
};

// 리더보드 렌더링
export const renderLeaderboard = ({ element, entries, valueFormatter }) => {
  if (!element) return;

  element.innerHTML = "";
  const maxCount = 5;
  const safeEntries = Array.isArray(entries) ? entries.slice(0, maxCount) : [];

  for (let index = 0; index < maxCount; index++) {
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

// 총 시간/진행도 업데이트
export const updateTotals = (goalMinutes = 0) => {
  const totalSeconds = getTotalSecondsToday();

  if (totalTodayEl) {
    totalTodayEl.textContent = formatTime(totalSeconds);
  }

  if (goalProgressEl && goalMinutes > 0) {
    const progress = Math.min(100, (totalSeconds / 60 / goalMinutes) * 100);
    goalProgressEl.textContent = `${progress.toFixed(1)}%`;
  }
};

// 기부 총합 업데이트
export const updateDonationTotals = () => {
  const total = getTotalDonatedSats();

  if (satsTotalAllEl) {
    satsTotalAllEl.textContent = `${total} sats`;
  }
};

// 토스트 메시지 표시
export const showToast = (element, message, duration = 3000) => {
  if (!element) return;

  if (element.querySelector('.toast-message')) {
    element.querySelector('.toast-message').textContent = message;
  } else {
    element.textContent = message;
  }

  element.classList.remove("hidden");

  setTimeout(() => {
    element.classList.add("hidden");
  }, duration);
};

// 세션 페이지 설정
export const setSessionPage = (page) => {
  sessionPage = page;
};

// 기부 페이지 설정
export const setDonationPage = (page) => {
  donationPage = page;
};
