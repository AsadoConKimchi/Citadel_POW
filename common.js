// Citadel POW 공통 유틸리티 함수
// Phase 2: 재사용 가능한 공통 로직

// ============================================
// 날짜/시간 포맷팅 유틸리티
// ============================================

/**
 * 오늘 날짜를 YYYY-MM-DD 형식으로 반환
 */
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * 초를 시간 문자열로 변환
 * @param {number} seconds - 변환할 초
 * @returns {string} "00시간 00분 00초" 또는 "00분 00초"
 */
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}시간 ${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
  }

  return `${String(mins).padStart(2, "0")}분 ${String(secs).padStart(2, "0")}초`;
}

/**
 * 분을 "00시간 00분" 형식으로 변환
 * @param {number} minutes - 변환할 분
 * @returns {string} "00시간 00분"
 */
function formatMinutesToHoursMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}시간 ${remainingMinutes}분`;
  }

  return `${minutes}분`;
}

/**
 * 초를 사람이 읽기 쉬운 형식으로 변환
 * @param {number} totalSeconds - 변환할 초
 * @param {boolean} short - 짧은 형식 사용 여부
 * @returns {string} "1시간 30분" 또는 "1.5시간" 또는 "45초"
 */
function formatDuration(totalSeconds, short = false) {
  if (totalSeconds < 60) {
    // 60초 미만
    return `${totalSeconds}초`;
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (short) {
    // 짧은 형식: "1.5시간" 또는 "45분"
    if (hours > 0) {
      const decimalHours = (totalSeconds / 3600).toFixed(1);
      return `${decimalHours}시간`;
    }
    return `${minutes}분`;
  }

  // 긴 형식: "1시간 30분 15초"
  if (hours > 0) {
    if (seconds > 0) {
      return `${hours}시간 ${minutes}분 ${seconds}초`;
    }
    if (minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    return `${hours}시간`;
  }

  if (seconds > 0) {
    return `${minutes}분 ${seconds}초`;
  }

  return `${minutes}분`;
}

/**
 * ISO 날짜 문자열을 "YYYY-MM-DD" 형식으로 변환
 * @param {string} isoString - ISO 날짜 문자열
 * @returns {string} "YYYY-MM-DD"
 */
function formatDate(isoString) {
  return isoString.split('T')[0];
}

/**
 * ISO 날짜 문자열을 "YYYY년 MM월 DD일" 형식으로 변환
 * @param {string} isoString - ISO 날짜 문자열
 * @returns {string} "YYYY년 MM월 DD일"
 */
function formatDateKorean(isoString) {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}년 ${month}월 ${day}일`;
}

// ============================================
// 카테고리 관련 유틸리티
// ============================================

/**
 * 카테고리 코드를 이모지로 변환
 * @param {string} category - 카테고리 코드 (예: "pow-writing")
 * @returns {string} 이모지
 */
function getCategoryEmoji(category) {
  const emojiMap = {
    "pow-writing": "✒️",
    "pow-music": "🎵",
    "pow-study": "📝",
    "pow-art": "🎨",
    "pow-reading": "📚",
    "pow-service": "✝️",
  };
  return emojiMap[category] || "";
}

/**
 * 카테고리 코드를 한글명으로 변환
 * @param {string} category - 카테고리 코드
 * @returns {string} 한글명
 */
function getCategoryName(category) {
  const nameMap = {
    "pow-writing": "글쓰기",
    "pow-music": "음악",
    "pow-study": "공부",
    "pow-art": "예술",
    "pow-reading": "독서",
    "pow-service": "봉사",
    "all": "전체",
  };
  return nameMap[category] || category;
}

/**
 * 모든 카테고리 목록 반환
 * @returns {Array<{value: string, emoji: string, name: string}>}
 */
function getAllCategories() {
  return [
    { value: "all", emoji: "", name: "전체" },
    { value: "pow-writing", emoji: "✒️", name: "글쓰기" },
    { value: "pow-music", emoji: "🎵", name: "음악" },
    { value: "pow-study", emoji: "📝", name: "공부" },
    { value: "pow-art", emoji: "🎨", name: "예술" },
    { value: "pow-reading", emoji: "📚", name: "독서" },
    { value: "pow-service", emoji: "✝️", name: "봉사" },
  ];
}

// ============================================
// localStorage 캐싱 유틸리티
// ============================================

/**
 * 캐시된 데이터 가져오기 (만료 시간 체크)
 * @param {string} key - localStorage 키
 * @param {number} maxAge - 최대 캐시 시간 (밀리초)
 * @returns {any|null} 캐시된 데이터 또는 null
 */
function getCachedData(key, maxAge = 60000) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);
    const age = Date.now() - timestamp;

    if (age > maxAge) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    console.error('캐시 읽기 실패:', error);
    return null;
  }
}

/**
 * 데이터를 캐시에 저장
 * @param {string} key - localStorage 키
 * @param {any} data - 저장할 데이터
 */
function setCachedData(key, data) {
  try {
    const cached = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (error) {
    console.error('캐시 저장 실패:', error);
  }
}

/**
 * 캐시 삭제
 * @param {string} key - localStorage 키
 */
function clearCachedData(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error('캐시 삭제 실패:', error);
  }
}

// ============================================
// Discord 세션 관리 유틸리티
// ============================================

/**
 * Discord 세션 정보 가져오기
 * @returns {Promise<{authenticated: boolean, user: any}>}
 */
async function getDiscordSession() {
  try {
    const response = await fetch("/api/session");
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("세션 로드 실패:", error);
    return { authenticated: false, user: null };
  }
}

/**
 * 로그인 상태 확인
 * @returns {Promise<boolean>}
 */
async function isLoggedIn() {
  const session = await getDiscordSession();
  return session.authenticated && !!session.user;
}

/**
 * 현재 사용자 정보 가져오기
 * @returns {Promise<any|null>}
 */
async function getCurrentUser() {
  const session = await getDiscordSession();
  return session.user || null;
}

// ============================================
// 숫자 포맷팅 유틸리티
// ============================================

/**
 * 숫자를 천 단위 콤마 형식으로 변환
 * @param {number} num - 변환할 숫자
 * @returns {string} "1,000"
 */
function formatNumber(num) {
  return num.toLocaleString('ko-KR');
}

/**
 * sats 입력값에서 숫자만 추출
 * @param {string} value - 입력값
 * @returns {number} 숫자
 */
function parseSatsRate(value) {
  const cleaned = String(value || "").replace(/[^\d]/g, "");
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
}

// ============================================
// 배열 유틸리티
// ============================================

/**
 * 배열을 날짜별로 그룹화
 * @param {Array} items - 그룹화할 아이템 배열
 * @param {string} dateKey - 날짜 필드명 (기본: 'created_at')
 * @returns {Object} 날짜별로 그룹화된 객체
 */
function groupByDate(items, dateKey = 'created_at') {
  const grouped = {};
  items.forEach(item => {
    const date = formatDate(item[dateKey]);
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(item);
  });
  return grouped;
}

/**
 * 배열을 월별로 그룹화
 * @param {Array} items - 그룹화할 아이템 배열
 * @param {string} dateKey - 날짜 필드명
 * @returns {Object} 월별로 그룹화된 객체
 */
function groupByMonth(items, dateKey = 'created_at') {
  const grouped = {};
  items.forEach(item => {
    const month = formatDate(item[dateKey]).slice(0, 7); // YYYY-MM
    if (!grouped[month]) {
      grouped[month] = [];
    }
    grouped[month].push(item);
  });
  return grouped;
}

// ============================================
// DOM 유틸리티
// ============================================

/**
 * 요소 표시/숨김 토글
 * @param {HTMLElement} element - DOM 요소
 * @param {boolean} show - 표시 여부
 */
function toggleElement(element, show) {
  if (!element) return;

  if (show) {
    element.classList.remove('hidden');
  } else {
    element.classList.add('hidden');
  }
}

/**
 * 로딩 상태 표시
 * @param {HTMLElement} element - DOM 요소
 * @param {boolean} loading - 로딩 여부
 * @param {string} loadingText - 로딩 중 표시할 텍스트
 */
function setLoadingState(element, loading, loadingText = '로딩 중...') {
  if (!element) return;

  if (loading) {
    element.innerHTML = `<li class="hint">${loadingText}</li>`;
  }
}

/**
 * 에러 메시지 표시
 * @param {HTMLElement} element - DOM 요소
 * @param {string} message - 에러 메시지
 */
function showError(element, message) {
  if (!element) return;
  element.innerHTML = `<li class="hint error">${message}</li>`;
}

/**
 * 빈 상태 메시지 표시
 * @param {HTMLElement} element - DOM 요소
 * @param {string} message - 빈 상태 메시지
 */
function showEmpty(element, message) {
  if (!element) return;
  element.innerHTML = `<li class="hint">${message}</li>`;
}
