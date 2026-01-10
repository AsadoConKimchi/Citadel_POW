// Citadel POW 대시보드 - study-history.html 전용 스크립트
// Phase 3: 대시보드 + 인기 기록 기능

// ============================================
// DOM 요소 선택
// ============================================

const powCategoryFilter = document.getElementById("pow-category-filter");
const dashboardTab = document.getElementById("dashboard-tab");
const popularRecordsTab = document.getElementById("popular-records-tab");

// 대시보드 요소
const dashboardLeaderboardTitle = document.getElementById("dashboard-leaderboard-title");
const dashboardLeaderboard = document.getElementById("dashboard-leaderboard");
const rankingTypeButtons = document.querySelectorAll("[data-ranking-type]");

// 인기 기록 요소
const popularCarouselContainer = document.getElementById("popular-carousel-container");
const popularCarouselTrack = document.getElementById("popular-carousel-track");
const popularCarouselPrev = document.getElementById("popular-carousel-prev");
const popularCarouselNext = document.getElementById("popular-carousel-next");
const popularCarouselIndicator = document.getElementById("popular-carousel-indicator");
const popularRecordsEmpty = document.getElementById("popular-records-empty");

// 탭 버튼
const tabButtons = document.querySelectorAll(".toggle-button[data-tab]");

// ============================================
// 상태 관리
// ============================================

let currentTab = "dashboard";
let currentCategory = "all";
let currentRankingType = "time"; // 'time' | 'donation'
let currentUser = null;

// ============================================
// 함수 선언 (호이스팅을 위해 먼저 배치)
// ============================================

/**
 * 대시보드 타이틀 업데이트
 */
function updateDashboardTitle() {
  const categoryName = getCategoryName(currentCategory);
  const typeName = currentRankingType === "time" ? "POW 시간" : "기부 금액";

  if (currentCategory === "all") {
    dashboardLeaderboardTitle.textContent = `${typeName} TOP 5`;
  } else {
    dashboardLeaderboardTitle.textContent = `${categoryName} ${typeName} TOP 5`;
  }
}

/**
 * 인기 기록 카드 렌더링 함수
 * @param {Object} post - 인기 게시물 데이터
 * @param {number} index - 인덱스
 * @param {number} currentIndex - 현재 활성화된 인덱스
 * @returns {string} HTML 문자열
 */
function renderPopularCard(post, index, currentIndex) {
  const isActive = index === currentIndex;
  const photoUrl = post.photo_url;
  const reactionCount = post.reaction_count || 0;
  const username = post.discord_username || "알 수 없음";
  const minutes = post.duration_minutes || 0;
  const plan = post.plan_text || "계획 없음";
  const rank = index + 1;

  // 메달 표시
  let rankBadge = `#${rank}`;
  if (rank === 1) rankBadge = "🥇";
  else if (rank === 2) rankBadge = "🥈";
  else if (rank === 3) rankBadge = "🥉";

  if (photoUrl && photoUrl !== "data:,") {
    // 인증카드 이미지가 있으면 이미지 표시
    return `
      <div class="carousel-card ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="popular-card-header">
          <span class="popular-rank">${rankBadge}</span>
          <span class="popular-reactions">❤️ ${formatNumber(reactionCount)}</span>
        </div>
        <img src="${photoUrl}" alt="POW 인증카드" class="pow-badge-image" loading="lazy" />
        <div class="popular-card-footer">
          <span class="popular-username">${username}</span>
          <span class="popular-time">${minutes}분</span>
        </div>
      </div>
    `;
  } else {
    // 인증카드 이미지가 없으면 텍스트 표시
    return `
      <div class="carousel-card ${isActive ? 'active' : ''}" data-index="${index}">
        <div class="pow-text-card">
          <div class="popular-card-header">
            <span class="popular-rank">${rankBadge}</span>
            <span class="popular-reactions">❤️ ${formatNumber(reactionCount)}</span>
          </div>
          <div class="pow-text-time">${minutes}분</div>
          <div class="pow-text-plan">${plan}</div>
          <div class="popular-card-footer">
            <span class="popular-username">${username}</span>
          </div>
        </div>
      </div>
    `;
  }
}

// ============================================
// 컴포넌트 초기화
// ============================================

// TabSwitcher 초기화
const tabSwitcher = new TabSwitcher({
  tabButtons: tabButtons,
  tabContents: [dashboardTab, popularRecordsTab],
  initialTab: "dashboard",
  onTabChange: (tabName) => {
    currentTab = tabName;
    if (tabName === "dashboard") {
      loadDashboard();
    } else if (tabName === "popular-records") {
      loadPopularRecords();
    }
  },
  storageKey: "citadel-pow-tab",
});

// Leaderboard 컴포넌트 초기화
const leaderboard = new Leaderboard({
  container: dashboardLeaderboard,
  type: currentRankingType,
  category: currentCategory,
  limit: 5,
});

// Carousel 컴포넌트 초기화 (인기 기록용)
const popularCarousel = new Carousel({
  container: popularCarouselContainer,
  track: popularCarouselTrack,
  prevButton: popularCarouselPrev,
  nextButton: popularCarouselNext,
  indicator: popularCarouselIndicator,
  renderCard: renderPopularCard,
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
    }
  } catch (error) {
    console.error("세션 로드 실패:", error);
  }
};

// ============================================
// 대시보드 로드
// ============================================

async function loadDashboard() {
  try {
    // 리더보드 타이틀 업데이트
    updateDashboardTitle();

    // Leaderboard 설정 및 데이터 가져오기
    await leaderboard
      .setType(currentRankingType)
      .setCategory(currentCategory)
      .reload();
  } catch (error) {
    console.error("대시보드 로드 실패:", error);
    showError(dashboardLeaderboard, "데이터를 불러올 수 없습니다.");
  }
}

// ============================================
// 인기 기록 로드
// ============================================

async function loadPopularRecords() {
  try {
    // API에서 인기 게시물 가져오기 (캐싱 적용)
    const endpoint = `${window.BACKEND_API_URL || ''}/api/discord-posts/popular`;
    const params = { category: currentCategory, limit: 5 };
    const queryString = new URLSearchParams(params).toString();

    const result = await cachedFetch(
      `${endpoint}?${queryString}`,
      {},
      { useCache: true, params }
    );

    if (!result.success) {
      throw new Error(result.error || '데이터를 불러올 수 없습니다.');
    }

    const popularPosts = result.data || [];

    if (popularPosts.length === 0) {
      // 인기 기록이 없을 때
      popularCarousel.hide();
      toggleElement(popularRecordsEmpty, true);
      popularRecordsEmpty.textContent = "아직 인기 기록이 없습니다.";
    } else {
      // Carousel에 데이터 설정
      popularCarousel.setItems(popularPosts, 0);
      toggleElement(popularRecordsEmpty, false);
    }
  } catch (error) {
    console.error("인기 기록 로드 실패:", error);
    popularCarousel.hide();
    toggleElement(popularRecordsEmpty, true);
    popularRecordsEmpty.textContent = "데이터를 불러올 수 없습니다.";
  }
}

// ============================================
// 이벤트 리스너
// ============================================

// 분야 선택 변경
powCategoryFilter?.addEventListener("change", (e) => {
  currentCategory = e.target.value;

  // 현재 탭에 따라 데이터 리로드
  if (currentTab === "dashboard") {
    loadDashboard();
  } else if (currentTab === "popular-records") {
    loadPopularRecords();
  }
});

// 랭킹 타입 변경 (POW 시간 / 기부 금액)
rankingTypeButtons.forEach(button => {
  button.addEventListener("click", () => {
    const type = button.dataset.rankingType;
    if (type) {
      // 버튼 활성화 상태 변경
      rankingTypeButtons.forEach(btn => {
        if (btn.dataset.rankingType === type) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });

      // 랭킹 타입 변경 및 리로드
      currentRankingType = type;
      loadDashboard();
    }
  });
});

// ============================================
// 초기화
// ============================================

(async () => {
  await loadSession();

  // 초기 탭 로드
  if (currentTab === "dashboard") {
    loadDashboard();
  } else if (currentTab === "popular-records") {
    loadPopularRecords();
  }
})();
