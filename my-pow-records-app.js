// 나의 POW 기록 - my-pow-records.html 전용 스크립트
// Phase 4: 필터링 + Carousel

// ============================================
// DOM 요소 선택
// ============================================

const loginRequired = document.getElementById("login-required");
const filterPanel = document.getElementById("filter-panel");
const statsSummary = document.getElementById("stats-summary");
const totalMinutesEl = document.getElementById("total-minutes");
const sessionCountEl = document.getElementById("session-count");

const categoryFilter = document.getElementById("category-filter");
const dateFilter = document.getElementById("date-filter");
const periodButtons = document.querySelectorAll("[data-period]");

const recordsCarouselContainer = document.getElementById("records-carousel-container");
const recordsCarouselTrack = document.getElementById("records-carousel-track");
const recordsCarouselPrev = document.getElementById("records-carousel-prev");
const recordsCarouselNext = document.getElementById("records-carousel-next");
const recordsCarouselIndicator = document.getElementById("records-carousel-indicator");
const recordsEmpty = document.getElementById("records-empty");

// ============================================
// 상태 관리
// ============================================

let currentUser = null;
let allSessions = []; // 모든 세션 데이터 (캐시)
let filteredSessions = []; // 필터링된 세션 데이터

// ============================================
// 컴포넌트 초기화
// ============================================

// Filter 컴포넌트 초기화
const filter = new Filter({
  categorySelect: categoryFilter,
  dateInput: dateFilter,
  periodButtons: periodButtons,
  onChange: (filters) => {
    console.log("필터 변경:", filters);
    applyFilters();
  },
  initialValues: {
    category: 'all',
    date: null,
    period: null,
  },
});

// Carousel 컴포넌트 초기화
const recordsCarousel = new Carousel({
  container: recordsCarouselContainer,
  track: recordsCarouselTrack,
  prevButton: recordsCarouselPrev,
  nextButton: recordsCarouselNext,
  indicator: recordsCarouselIndicator,
  renderCard: renderRecordCard,
});

// ============================================
// 세션 로드
// ============================================

const loadSession = async () => {
  try {
    const session = await getDiscordSession();
    if (session.authenticated && session.user) {
      currentUser = session.user;
      console.log("로그인된 사용자:", currentUser.username);
      return true;
    } else {
      // 로그인되지 않음
      toggleElement(loginRequired, true);
      toggleElement(filterPanel, false);
      toggleElement(statsSummary, false);
      toggleElement(recordsEmpty, false);
      recordsCarousel.hide();
      return false;
    }
  } catch (error) {
    console.error("세션 로드 실패:", error);
    return false;
  }
};

// ============================================
// POW 세션 데이터 로드
// ============================================

const loadSessions = async () => {
  if (!currentUser) {
    console.error("로그인되지 않음");
    return;
  }

  try {
    console.log("현재 사용자 정보:", currentUser);
    console.log("API 호출 파라미터 - discord_id:", currentUser.id);

    // API에서 사용자의 모든 세션 가져오기
    const response = await StudySessionAPI.getByUser(currentUser.id, 500);

    if (!response.success) {
      throw new Error(response.error || '데이터를 불러올 수 없습니다.');
    }

    allSessions = response.data || [];
    console.log(`${allSessions.length}개의 POW 세션 로드됨`);

    // 첫 번째 세션의 photo_url 확인
    if (allSessions.length > 0) {
      console.log("첫 번째 세션 데이터:", allSessions[0]);
      console.log("discord_posts 타입:", typeof allSessions[0].discord_posts, Array.isArray(allSessions[0].discord_posts));
      console.log("discord_posts 값:", allSessions[0].discord_posts);

      let photoUrl = allSessions[0].photo_url;
      if (allSessions[0].discord_posts) {
        if (Array.isArray(allSessions[0].discord_posts) && allSessions[0].discord_posts.length > 0) {
          photoUrl = allSessions[0].discord_posts[0].photo_url || photoUrl;
        } else if (typeof allSessions[0].discord_posts === 'object' && allSessions[0].discord_posts.photo_url) {
          photoUrl = allSessions[0].discord_posts.photo_url;
        }
      }
      console.log("최종 photo_url:", photoUrl);
    }

    // 필터 적용
    applyFilters();
  } catch (error) {
    console.error("POW 세션 로드 실패:", error);
    toggleElement(recordsEmpty, true);
    recordsEmpty.textContent = "데이터를 불러올 수 없습니다.";
    recordsCarousel.hide();
  }
};

// ============================================
// 필터 적용
// ============================================

const applyFilters = () => {
  if (allSessions.length === 0) {
    // 데이터가 없으면 빈 상태 표시
    filteredSessions = [];
    updateUI();
    return;
  }

  const filters = filter.getFilters();
  console.log("필터 적용:", filters);

  // 필터링 시작
  filteredSessions = allSessions.filter(session => {
    // 1. 카테고리 필터
    if (filters.category && filters.category !== 'all') {
      if (session.donation_mode !== filters.category) {
        return false;
      }
    }

    // 2. 날짜 필터
    if (filters.date) {
      const sessionDate = formatDate(session.created_at);
      if (sessionDate !== filters.date) {
        return false;
      }
    }

    // 3. 기간 필터
    if (filters.period) {
      const sessionDate = new Date(session.created_at);
      const now = new Date();

      if (filters.period === 'today') {
        const today = new Date(now);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (sessionDate < today || sessionDate >= tomorrow) {
          return false;
        }
      } else if (filters.period === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        if (sessionDate < weekAgo) {
          return false;
        }
      } else if (filters.period === 'month') {
        const monthStart = new Date(now);
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        if (sessionDate < monthStart) {
          return false;
        }
      }
    }

    return true;
  });

  console.log(`필터링 결과: ${filteredSessions.length}개`);

  // UI 업데이트
  updateUI();
};

// ============================================
// UI 업데이트
// ============================================

const updateUI = () => {
  // 통계 업데이트
  updateStats();

  // Carousel 업데이트
  if (filteredSessions.length === 0) {
    recordsCarousel.hide();
    toggleElement(recordsEmpty, true);
    recordsEmpty.textContent = "선택한 조건에 맞는 POW 기록이 없습니다.";
  } else {
    // 날짜 내림차순 정렬
    filteredSessions.sort((a, b) => {
      return new Date(b.created_at) - new Date(a.created_at);
    });

    recordsCarousel.setItems(filteredSessions, 0);
    toggleElement(recordsEmpty, false);
  }
};

// ============================================
// 통계 업데이트
// ============================================

const updateStats = () => {
  if (filteredSessions.length === 0) {
    toggleElement(statsSummary, false);
    return;
  }

  // duration_seconds 합산 (duration_seconds 우선, 없으면 duration_minutes * 60)
  const totalSeconds = filteredSessions.reduce((sum, session) => {
    const seconds = session.duration_seconds ?? (session.duration_minutes ? session.duration_minutes * 60 : 0);
    return sum + seconds;
  }, 0);

  totalMinutesEl.textContent = formatDuration(totalSeconds, false);
  sessionCountEl.textContent = `${filteredSessions.length}개`;

  toggleElement(statsSummary, true);
};

// ============================================
// 카드 렌더링
// ============================================

/**
 * POW 기록 카드 렌더링 함수
 * @param {Object} session - POW 세션 데이터
 * @param {number} index - 인덱스
 * @param {number} currentIndex - 현재 활성화된 인덱스
 * @returns {string} HTML 문자열
 */
function renderRecordCard(session, index, currentIndex) {
  const isActive = index === currentIndex;
  // discord_posts에서 photo_url 가져오기 (없으면 session.photo_url 사용)
  let photoUrl = session.photo_url;
  if (session.discord_posts) {
    if (Array.isArray(session.discord_posts) && session.discord_posts.length > 0) {
      photoUrl = session.discord_posts[0].photo_url || photoUrl;
    } else if (typeof session.discord_posts === 'object' && session.discord_posts.photo_url) {
      photoUrl = session.discord_posts.photo_url;
    }
  }
  const seconds = session.duration_seconds ?? (session.duration_minutes ? session.duration_minutes * 60 : 0);
  const timeText = seconds > 0 ? formatDuration(seconds, false) : "0분";
  const plan = session.plan_text || "계획 없음";
  const date = formatDate(session.created_at);
  const categoryEmoji = getCategoryEmoji(session.donation_mode);
  const categoryName = getCategoryName(session.donation_mode);

  if (photoUrl && photoUrl !== "data:,") {
    // 인증카드 이미지가 있으면 이미지 표시 (인기 기록과 동일한 구조)
    return `
      <div class="carousel-card ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="record-card-header">
          <span class="record-date">${date}</span>
          <span class="record-category">${categoryEmoji} ${categoryName}</span>
        </div>
        <img src="${photoUrl}" alt="POW 인증카드" class="pow-badge-image" loading="lazy" />
        <div class="record-card-footer">
          <span class="record-time">${timeText}</span>
        </div>
      </div>
    `;
  } else {
    // 인증카드 이미지가 없으면 텍스트 표시
    return `
      <div class="carousel-card ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="pow-text-card">
          <div class="record-card-header">
            <span class="record-date">${date}</span>
            <span class="record-category">${categoryEmoji} ${categoryName}</span>
          </div>
          <div class="pow-text-time">${timeText}</div>
          <div class="pow-text-plan">${plan}</div>
        </div>
      </div>
    `;
  }
}

// ============================================
// 초기화
// ============================================

(async () => {
  const loggedIn = await loadSession();

  if (loggedIn) {
    // 로그인 상태면 데이터 로드
    await loadSessions();
  }
})();
