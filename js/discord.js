/**
 * Citadel POW - Discord 인증 모듈
 * OAuth 2.0 인증, 프로필 관리, Discord 공유
 */

import { setCurrentDiscordId, currentDiscordId } from './storage.js';

// DOM 요소 참조
let discordAppLogin = null;
let discordWebLogin = null;
let discordRefresh = null;
let discordHint = null;
let discordStatus = null;
let discordLogout = null;
let mainContent = null;
let discordProfile = null;
let discordAvatar = null;
let discordUsername = null;
let discordGuild = null;
let allowedServer = null;
let loginUser = null;
let loginUserName = null;
let donationScope = null;
let donationMode = null;
let donationNote = null;
let shareStatus = null;

// 콜백 함수들
let onAuthSuccess = null;
let onAuthFail = null;

// 현재 사용자 정보
let currentUser = null;
let currentGuild = null;

// 토글 버튼들
let toggleButtons = [];
const donationScopeKey = 'citadel-donation-scope';

// 초기화
export const initDiscord = (elements, callbacks = {}) => {
  discordAppLogin = elements.discordAppLogin;
  discordWebLogin = elements.discordWebLogin;
  discordRefresh = elements.discordRefresh;
  discordHint = elements.discordHint;
  discordStatus = elements.discordStatus;
  discordLogout = elements.discordLogout;
  mainContent = elements.mainContent;
  discordProfile = elements.discordProfile;
  discordAvatar = elements.discordAvatar;
  discordUsername = elements.discordUsername;
  discordGuild = elements.discordGuild;
  allowedServer = elements.allowedServer;
  loginUser = elements.loginUser;
  loginUserName = elements.loginUserName;
  donationScope = elements.donationScope;
  donationMode = elements.donationMode;
  donationNote = elements.donationNote;
  shareStatus = elements.shareStatus;
  toggleButtons = elements.toggleButtons || [];

  onAuthSuccess = callbacks.onAuthSuccess;
  onAuthFail = callbacks.onAuthFail;

  // 이벤트 리스너 설정
  setupEventListeners();
};

// 이벤트 리스너 설정
const setupEventListeners = () => {
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

  discordRefresh?.addEventListener("click", async () => {
    discordRefresh.disabled = true;
    const originalLabel = discordRefresh.textContent;
    discordRefresh.textContent = "확인 중...";
    await loadSession({ ignoreUrlFlag: true });
    discordRefresh.textContent = originalLabel;
    discordRefresh.disabled = false;
  });
};

// Discord 프로필 업데이트
export const updateDiscordProfile = ({ user, guild, authorized, userLevel }) => {
  if (!discordProfile) return;

  const avatarUrl = user?.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : "https://cdn.discordapp.com/embed/avatars/0.png";

  if (discordAvatar) {
    discordAvatar.src = avatarUrl;
    discordAvatar.alt = user?.username ? `${user.username} avatar` : "Discord avatar";

    // 기존 클래스 제거
    discordAvatar.classList.remove(
      "status-ok", "status-pending",
      "user-level-1", "user-level-2", "user-level-3"
    );

    // 사용자 레벨별 클래스 추가
    if (userLevel) {
      discordAvatar.classList.add(`user-level-${userLevel}`);
    }

    if (authorized === true) {
      discordAvatar.classList.add("status-ok");

      // 백엔드에 사용자 등록/업데이트
      if (typeof window.UserAPI !== 'undefined' && user?.id) {
        window.UserAPI.upsert(user.id, user.username, user.avatar)
          .then(() => console.log('사용자 정보가 백엔드에 저장되었습니다.'))
          .catch(err => console.error('백엔드 사용자 저장 오류:', err));
      }
    } else if (authorized === false) {
      discordAvatar.classList.add("status-pending");
    }
  }

  if (discordUsername) {
    discordUsername.textContent = user?.username ?? "로그인된 사용자 없음";
  }

  if (discordGuild) {
    const guildName = guild?.name ?? "-";
    discordGuild.textContent = `서버: ${guildName}`;
  }

  if (loginUserName && user?.username) {
    loginUserName.textContent = user.username;
  }
};

// 인증 상태 설정
export const setAuthState = ({ authenticated, authorized, user, guild, error, userLevel }) => {
  currentUser = user;
  currentGuild = guild;

  if (error) {
    handleAuthError(error);
    return;
  }

  if (!authenticated) {
    handleUnauthenticated();
    return;
  }

  if (!authorized) {
    handleUnauthorized(user, guild, userLevel);
    return;
  }

  handleAuthorized(user, guild, userLevel);
};

// 인증 오류 처리
const handleAuthError = (error) => {
  if (discordStatus) {
    discordStatus.textContent = `로그인 상태: ${error}`;
  }
  if (discordHint) {
    discordHint.textContent = "서버 설정을 확인해주세요.";
  }
  if (mainContent) {
    mainContent.classList.add("locked");
  }
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

  if (onAuthFail) {
    onAuthFail({ error });
  }
};

// 미인증 상태 처리
const handleUnauthenticated = () => {
  if (discordStatus) {
    discordStatus.textContent = "로그인 상태: 미인증";
  }
  if (discordHint) {
    discordHint.textContent = "Discord 로그인 후 역할(Role) 검증이 완료됩니다.";
  }
  if (mainContent) {
    mainContent.classList.add("locked");
  }
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

  if (onAuthFail) {
    onAuthFail({ authenticated: false });
  }
};

// 미승인 상태 처리
const handleUnauthorized = (user, guild, userLevel) => {
  if (discordStatus) {
    discordStatus.textContent = "로그인 상태: 역할 미충족";
  }
  if (discordHint) {
    discordHint.textContent = "지정된 Role 권한이 필요합니다.";
  }
  if (mainContent) {
    mainContent.classList.add("locked");
  }
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

  if (onAuthFail) {
    onAuthFail({ authenticated: true, authorized: false, user, guild });
  }
};

// 승인 상태 처리
const handleAuthorized = (user, guild, userLevel) => {
  const roleName = guild?.roleName || "지정 역할";

  if (discordStatus) {
    discordStatus.textContent = `로그인 상태: 역할(${roleName}) 확인`;
  }
  if (discordHint) {
    discordHint.textContent = "역할(Role) 확인 완료. 모든 기능을 사용할 수 있습니다.";
  }
  if (mainContent) {
    mainContent.classList.remove("locked");
  }
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

  // Discord ID 설정
  if (user && user.id) {
    setCurrentDiscordId(user.id);
    loadUserSettings(user.id);
  }

  if (onAuthSuccess) {
    onAuthSuccess({ user, guild, userLevel });
  }
};

// 사용자 설정 로드
const loadUserSettings = async (discordId) => {
  if (typeof window.UserAPI === 'undefined') return;

  try {
    const response = await window.UserAPI.get(discordId);
    if (response.success && response.data) {
      const { donation_scope } = response.data;
      if (donation_scope && donationScope) {
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

        console.log(`백엔드에서 donation_scope 로드: ${donation_scope}`);
      }
    }
  } catch (error) {
    console.error('사용자 설정 로드 실패:', error);
  }
};

// 세션 로드
export const loadSession = async ({ ignoreUrlFlag = false } = {}) => {
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

// Discord 공유 API
export const shareToDiscordAPI = async ({
  sessionId,
  dataUrl,
  planText,
  durationSeconds,
  donationScope: scopeValue,
  donationSats,
  totalDonatedSats,
  totalAccumulatedSats,
  donationNote: noteValue,
}) => {
  const sessionResponse = await fetch('/api/session');
  const sessionData = await sessionResponse.json();

  if (!sessionData.authenticated || !sessionData.user?.id) {
    throw new Error("로그인이 필요합니다.");
  }

  const botPayload = {
    discord_id: sessionData.user.id,
    session_id: sessionId,
    photo_url: dataUrl,
    plan_text: planText || "목표 미입력",
    donation_mode: donationMode?.value || "pow-writing",
    duration_seconds: durationSeconds || 0,
    donation_scope: scopeValue,
    donation_sats: donationSats,
    total_donated_sats: totalDonatedSats,
    total_accumulated_sats: totalAccumulatedSats,
    donation_note: noteValue || "",
  };

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

// 현재 사용자 정보 가져오기
export const getCurrentUser = () => currentUser;
export const getCurrentGuild = () => currentGuild;
