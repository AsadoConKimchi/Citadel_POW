/**
 * Group Meetups Main App
 * 그룹 POW Meet-up 페이지 메인 로직
 */

// ============================================
// 설정
// ============================================

/**
 * Organizer 역할 확인
 *
 * NOTE: Organizer 역할은 Render 서버의 환경변수 ORGANIZER_ROLE_IDS에서 관리됩니다.
 * 프론트엔드는 세션 응답의 isOrganizer 필드를 사용합니다.
 * 실제 권한 검증은 백엔드 API에서 수행됩니다.
 */

// 전역 변수
let currentUser = null;
let meetupList = null;
let meetupCreator = null;
let currentStatus = 'scheduled';

/**
 * Discord 세션 가져오기
 */
async function getDiscordSession() {
  try {
    const response = await fetch('/api/session');
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('세션 가져오기 오류:', error);
    return null;
  }
}

/**
 * 초기화
 */
async function initialize() {
  // Discord 세션 확인
  const session = await getDiscordSession();

  if (!session || !session.authenticated || !session.user) {
    // 로그인 필요 표시
    const loginRequired = document.getElementById('login-required');
    if (loginRequired) {
      loginRequired.classList.remove('hidden');
    }
    return;
  }

  // 현재 사용자 설정
  currentUser = {
    discord_id: session.user.id,
    discord_username: session.user.username,
    discord_avatar: session.user.avatar,
    roles: session.guild?.roles || [],
  };

  // 백엔드에 사용자 등록/업데이트
  try {
    await UserAPI.upsert(
      currentUser.discord_id,
      currentUser.discord_username,
      currentUser.discord_avatar
    );
  } catch (error) {
    console.error('사용자 등록 오류:', error);
  }

  // Organizer 여부 확인 (세션에서 제공)
  const isOrganizer = session.isOrganizer || false;

  // UI 초기화
  initializeUI(isOrganizer);

  // 미완료 기부 확인
  await checkPendingDonations();
}


/**
 * UI 초기화
 */
function initializeUI(isOrganizer) {
  // Organizer 액션 버튼 표시
  const organizerActions = document.getElementById('organizer-actions');
  if (isOrganizer && organizerActions) {
    organizerActions.classList.remove('hidden');
  }

  // Meet-up 생성 버튼
  const createBtn = document.getElementById('create-meetup-btn');
  if (createBtn) {
    createBtn.addEventListener('click', showMeetupCreator);
  }

  // 탭 버튼
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const status = e.target.dataset.status;
      changeTab(status);
    });
  });

  // 참여 모달 닫기
  const joinModal = document.getElementById('join-modal');
  if (joinModal) {
    const overlay = joinModal.querySelector('.modal-overlay');
    const closeBtn = joinModal.querySelector('.modal-close');
    const cancelBtn = document.getElementById('join-cancel-btn');

    if (overlay) {
      overlay.addEventListener('click', () => hideJoinModal());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => hideJoinModal());
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => hideJoinModal());
    }
  }

  // Meet-up 리스트 초기화
  const listContainer = document.getElementById('meetups-list-container');
  if (listContainer) {
    meetupList = new MeetupList(listContainer, {
      status: currentStatus,
      currentUser: currentUser,
      onJoin: showJoinModal,
      onView: showMeetupDetails,
    });
    meetupList.render();
  }

  // Meet-up 생성 컴포넌트 초기화
  const creatorContainer = document.getElementById('meetup-creator-container');
  if (creatorContainer) {
    meetupCreator = new MeetupCreator(creatorContainer, {
      currentUser: currentUser,
      onSuccess: handleMeetupCreated,
      onCancel: hideMeetupCreator,
    });
  }
}

/**
 * 탭 변경
 */
function changeTab(status) {
  currentStatus = status;

  // 탭 버튼 활성화 상태 변경
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach((btn) => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // 리스트 재렌더링
  if (meetupList) {
    meetupList.changeStatus(status);
  }
}

/**
 * Meet-up 생성 폼 표시
 */
function showMeetupCreator() {
  if (meetupCreator) {
    meetupCreator.show();
  }

  // 리스트 숨기기
  const listContainer = document.getElementById('meetups-list-container');
  if (listContainer) {
    listContainer.classList.add('hidden');
  }

  // 개최 버튼 숨기기
  const organizerActions = document.getElementById('organizer-actions');
  if (organizerActions) {
    organizerActions.classList.add('hidden');
  }
}

/**
 * Meet-up 생성 폼 숨기기
 */
function hideMeetupCreator() {
  if (meetupCreator) {
    meetupCreator.hide();
  }

  // 리스트 표시
  const listContainer = document.getElementById('meetups-list-container');
  if (listContainer) {
    listContainer.classList.remove('hidden');
  }

  // 개최 버튼 표시
  const organizerActions = document.getElementById('organizer-actions');
  if (organizerActions) {
    organizerActions.classList.remove('hidden');
  }
}

/**
 * Meet-up 생성 완료 핸들러
 */
function handleMeetupCreated(meetup) {
  console.log('Meet-up 생성 완료:', meetup);

  // 폼 숨기기
  hideMeetupCreator();

  // 리스트 새로고침
  if (meetupList) {
    meetupList.render();
  }
}

/**
 * 참여 모달 표시
 */
function showJoinModal(meetupId) {
  const modal = document.getElementById('join-modal');
  const form = document.getElementById('join-form');

  if (!modal || !form) return;

  // 폼 데이터 설정
  form.dataset.meetupId = meetupId;

  // 폼 제출 이벤트
  form.onsubmit = async (e) => {
    e.preventDefault();

    const pledgedAmount = parseInt(form.pledged_amount.value);
    if (!pledgedAmount || pledgedAmount < 1) {
      alert('유효한 금액을 입력해주세요.');
      return;
    }

    try {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '참여 중...';
      }

      await MeetupAPI.join(meetupId, currentUser.discord_id, pledgedAmount);

      alert('Meet-up에 참여했습니다!');
      hideJoinModal();

      // 리스트 새로고침
      if (meetupList) {
        meetupList.render();
      }
    } catch (error) {
      alert(error.message || '참여에 실패했습니다.');
    } finally {
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '참여하기';
      }
    }
  };

  // 모달 표시
  modal.classList.remove('hidden');
}

/**
 * 참여 모달 숨기기
 */
function hideJoinModal() {
  const modal = document.getElementById('join-modal');
  const form = document.getElementById('join-form');

  if (modal) {
    modal.classList.add('hidden');
  }

  if (form) {
    form.reset();
    form.dataset.meetupId = '';
  }
}

/**
 * Meet-up 상세 보기
 */
async function showMeetupDetails(meetupId) {
  try {
    // API에서 상세 정보 가져오기
    const response = await MeetupAPI.get(meetupId);

    if (!response.success) {
      throw new Error(response.error || '상세 정보를 가져올 수 없습니다.');
    }

    const meetup = response.data;

    // 상세 모달 표시
    const modal = document.getElementById('meetup-details-modal');
    const content = document.getElementById('meetup-details-content');

    if (!modal || !content) return;

    // 상세 내용 렌더링
    content.innerHTML = renderMeetupDetails(meetup);

    // 모달 표시
    modal.classList.remove('hidden');

    // 닫기 이벤트
    const overlay = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');

    if (overlay) {
      overlay.onclick = () => modal.classList.add('hidden');
    }
    if (closeBtn) {
      closeBtn.onclick = () => modal.classList.add('hidden');
    }

    // 추가 버튼 이벤트 설정 (QR 생성, 참여 취소 등)
    setupDetailsActions(meetup);
  } catch (error) {
    console.error('상세 정보 조회 오류:', error);
    alert(error.message || '상세 정보를 가져올 수 없습니다.');
  }
}

/**
 * Meet-up 상세 렌더링
 */
function renderMeetupDetails(meetup) {
  const {
    title,
    description,
    image_url,
    scheduled_at,
    duration_minutes,
    target_donation_amount,
    status,
    organizer,
    participants,
    total_pledged,
    participant_count,
  } = meetup;

  const isOrganizer = currentUser && organizer.discord_id === currentUser.discord_id;
  const isParticipant = participants.some((p) => p.user_id === currentUser?.discord_id);
  const currentParticipant = participants.find((p) => p.user_id === currentUser?.discord_id);

  return `
    ${image_url ? `<img src="${image_url}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 16px;" />` : ''}
    <h2>${title}</h2>
    ${description ? `<p style="color: #64748b; margin: 12px 0;">${description}</p>` : ''}

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 20px 0;">
      <div>
        <div style="font-size: 12px; color: #94a3b8;">참여자</div>
        <div style="font-size: 20px; font-weight: 700;">${participant_count}명</div>
      </div>
      <div>
        <div style="font-size: 12px; color: #94a3b8;">약속 금액</div>
        <div style="font-size: 20px; font-weight: 700;">${total_pledged} / ${target_donation_amount} sats</div>
      </div>
    </div>

    <div style="margin: 20px 0;">
      <div style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">참여자 목록</div>
      <div class="participants-list">
        ${participants.length === 0 ? '<p style="color: #94a3b8; text-align: center;">아직 참여자가 없습니다.</p>' : participants.map(p => `
          <div class="participant-item">
            ${p.discord_avatar
              ? `<img src="https://cdn.discordapp.com/avatars/${p.user_id}/${p.discord_avatar}.png" class="participant-avatar" />`
              : `<div class="participant-avatar-fallback">${p.discord_username.charAt(0).toUpperCase()}</div>`
            }
            <div class="participant-info">
              <div class="participant-name">${p.discord_username}</div>
              <div class="participant-meta">${p.pledged_amount} sats</div>
            </div>
            <div class="participant-status ${p.attended ? 'attended' : 'not-attended'}">
              ${p.attended ? '✓ 출석' : '미출석'}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    ${isOrganizer ? `
      <div style="margin-top: 20px;">
        <button type="button" class="btn btn-primary" id="generate-qr-btn" style="width: 100%;">
          QR 코드 생성
        </button>
      </div>
    ` : ''}

    ${isParticipant && !isOrganizer && !currentParticipant?.attended ? `
      <div style="margin-top: 20px; display: flex; gap: 12px;">
        <button type="button" class="btn btn-primary" id="scan-qr-btn" style="flex: 1;">
          출석 체크 (QR 스캔)
        </button>
        <button type="button" class="btn btn-secondary" id="leave-meetup-btn" style="flex: 1;">
          참여 취소
        </button>
      </div>
    ` : ''}

    ${isParticipant && !isOrganizer && currentParticipant?.attended ? `
      <div style="margin-top: 20px;">
        <button type="button" class="btn btn-secondary" id="leave-meetup-btn" style="width: 100%;">
          참여 취소
        </button>
      </div>
    ` : ''}
  `;
}

/**
 * 상세 모달 액션 설정
 */
function setupDetailsActions(meetup) {
  // QR 생성 버튼 (Organizer)
  const generateQRBtn = document.getElementById('generate-qr-btn');
  if (generateQRBtn) {
    generateQRBtn.addEventListener('click', async () => {
      // 상세 모달을 QR 생성 뷰로 전환
      const content = document.getElementById('meetup-details-content');
      if (!content) return;

      // QR Generator 컨테이너 생성
      content.innerHTML = `
        <h2>${meetup.title}</h2>
        <div id="qr-generator-container"></div>
        <div style="margin-top: 20px;">
          <button type="button" class="btn btn-secondary" id="back-to-details-btn" style="width: 100%;">
            뒤로 가기
          </button>
        </div>
      `;

      const qrContainer = content.querySelector('#qr-generator-container');
      if (qrContainer) {
        const qrGenerator = new QRGenerator(qrContainer, meetup.id, currentUser);
        qrGenerator.render();
      }

      // 뒤로 가기 버튼
      const backBtn = content.querySelector('#back-to-details-btn');
      if (backBtn) {
        backBtn.addEventListener('click', async () => {
          // 상세 정보 다시 로드
          const response = await MeetupAPI.get(meetup.id);
          if (response.success) {
            content.innerHTML = renderMeetupDetails(response.data);
            setupDetailsActions(response.data);
          }
        });
      }
    });
  }

  // QR 스캔 버튼 (Participant)
  const scanQRBtn = document.getElementById('scan-qr-btn');
  if (scanQRBtn) {
    scanQRBtn.addEventListener('click', () => {
      showQRScanner(meetup.id);
    });
  }

  // 참여 취소 버튼
  const leaveBtn = document.getElementById('leave-meetup-btn');
  if (leaveBtn) {
    leaveBtn.addEventListener('click', async () => {
      if (!confirm('정말 참여를 취소하시겠습니까?')) return;

      try {
        await MeetupAPI.leave(meetup.id, currentUser.discord_id);
        alert('참여가 취소되었습니다.');

        // 모달 닫기
        const modal = document.getElementById('meetup-details-modal');
        if (modal) modal.classList.add('hidden');

        // 리스트 새로고침
        if (meetupList) meetupList.render();
      } catch (error) {
        alert(error.message || '참여 취소에 실패했습니다.');
      }
    });
  }
}

/**
 * QR 스캐너 모달 표시
 */
function showQRScanner(meetupId) {
  const modal = document.getElementById('qr-scanner-modal');
  const container = document.getElementById('qr-scanner-container');

  if (!modal || !container) return;

  // QRScanner 인스턴스 생성
  const qrScanner = new QRScanner(
    container,
    meetupId,
    currentUser,
    async (data) => {
      // 출석 성공 콜백
      console.log('출석 확인 완료:', data);

      // 스캐너 모달 닫기
      hideQRScanner();

      // 상세 모달도 닫기
      const detailsModal = document.getElementById('meetup-details-modal');
      if (detailsModal) detailsModal.classList.add('hidden');

      // 리스트 새로고침
      if (meetupList) meetupList.render();
    }
  );

  // 스캐너 표시
  qrScanner.show();
  modal.classList.remove('hidden');

  // 모달 닫기 이벤트
  const overlay = modal.querySelector('.modal-overlay');
  const closeBtn = modal.querySelector('.modal-close');

  const closeHandler = async () => {
    await qrScanner.hide();
    modal.classList.add('hidden');
  };

  if (overlay) {
    overlay.onclick = closeHandler;
  }
  if (closeBtn) {
    closeBtn.onclick = closeHandler;
  }
}

/**
 * QR 스캐너 모달 숨기기
 */
function hideQRScanner() {
  const modal = document.getElementById('qr-scanner-modal');
  const container = document.getElementById('qr-scanner-container');

  if (modal) {
    modal.classList.add('hidden');
  }

  if (container) {
    container.innerHTML = '';
  }
}

/**
 * 미완료 기부 확인
 */
async function checkPendingDonations() {
  try {
    const response = await MeetupAPI.getPendingDonations(currentUser.discord_id);

    if (response.success && response.data.length > 0) {
      // 기부 팝업 표시
      const donationPopupContainer = document.getElementById('donation-popup-content');
      if (donationPopupContainer) {
        const donationPopup = new DonationPopup(
          donationPopupContainer,
          response.data,
          currentUser,
          {
            onSuccess: () => {
              // 기부 완료 후 리스트 새로고침
              if (meetupList) {
                meetupList.render();
              }
            },
          }
        );
        donationPopup.show();
      }
    }
  } catch (error) {
    console.error('미완료 기부 확인 오류:', error);
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', initialize);
