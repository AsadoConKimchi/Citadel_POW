/**
 * Citadel POW - 유틸리티 함수 모듈
 * 공통으로 사용되는 헬퍼 함수들
 */

// 시간 포맷팅 (초 → "00시간 00분 00초" 또는 "00분 00초")
export const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}시간 ${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
  }
  return `${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
};

// formatMinutesSeconds는 formatTime과 동일하므로 통합
export const formatMinutesSeconds = formatTime;

// 오늘 날짜 키 (YYYY-MM-DD)
export const getTodayKey = () => new Date().toISOString().slice(0, 10);

// sats 환율 파싱 ("10sats" → 10)
export const parseSatsRate = (value) => {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// 목표 시간 파싱 ("30분" → 30)
export const parseGoalMinutes = (value) => {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

// 목표 달성률 계산 (0-100%)
export const getGoalProgressFor = (totalSeconds, goalMinutes) => {
  if (!goalMinutes || goalMinutes <= 0) {
    return 0;
  }
  return Math.min(100, (totalSeconds / 60 / goalMinutes) * 100);
};

// Lightning 인보이스 정규화
export const normalizeInvoice = (invoice) => {
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

// Lightning URI 생성
export const getLightningUri = (invoice) => `lightning:${normalizeInvoice(invoice)}`;

// 목표 달성 기반 sats 계산
export const calculateSatsForGoal = ({ rate, seconds, goalMinutes }) => {
  if (!rate) {
    return 0;
  }
  const progressRate = getGoalProgressFor(seconds, goalMinutes) / 100;
  return Math.round(rate * progressRate);
};

// POW 카테고리 레이블
export const donationModeLabels = {
  "pow-writing": "✒️ㅣ글쓰기",
  "pow-music": "🎵ㅣ음악",
  "pow-study": "📝ㅣ공부",
  "pow-art": "🎨ㅣ그림",
  "pow-reading": "📚ㅣ독서",
  "pow-service": "✝️ㅣ봉사",
};

// 카테고리 이모지만 가져오기
export const getCategoryEmoji = (category) => {
  const emojis = {
    "pow-writing": "✒️",
    "pow-music": "🎵",
    "pow-study": "📝",
    "pow-art": "🎨",
    "pow-reading": "📚",
    "pow-service": "✝️",
  };
  return emojis[category] || "";
};

// 파일을 Data URL로 읽기
export const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("file-read-failed"));
    reader.readAsDataURL(file);
  });

// debounce 함수 (연속 호출 방지)
export const debounce = (fn, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};
