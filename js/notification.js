/**
 * Citadel POW - 알림 시스템 모듈
 * iOS 17+ PWA 환경에서의 Push 알림, 소리, 진동 지원
 */

// 알림 권한 상태
let notificationPermission = 'default';

// 알림 소리 (Base64로 짧은 비프음)
const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleKt0HO7N/rKP7O6q2//73/3w9/Ly8vL+/v7+';

// 알림 소리 재생
export const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.log('소리 재생 실패 (사용자 상호작용 필요):', err);
    });
  } catch (error) {
    console.error('소리 재생 오류:', error);
  }
};

// 진동 (지원되는 경우)
export const vibrate = (pattern = [200, 100, 200]) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.error('진동 오류:', error);
    }
  }
  return false;
};

// 알림 권한 요청
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.log('이 브라우저는 알림을 지원하지 않습니다.');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    notificationPermission = 'granted';
    return 'granted';
  }

  if (Notification.permission !== 'denied') {
    try {
      const permission = await Notification.requestPermission();
      notificationPermission = permission;
      return permission;
    } catch (error) {
      console.error('알림 권한 요청 오류:', error);
      return 'denied';
    }
  }

  return Notification.permission;
};

// 로컬 알림 표시 (앱이 포그라운드일 때)
export const showLocalNotification = (title, options = {}) => {
  if (notificationPermission !== 'granted') {
    console.log('알림 권한이 없습니다.');
    return null;
  }

  try {
    const notification = new Notification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    return notification;
  } catch (error) {
    console.error('알림 표시 오류:', error);
    return null;
  }
};

// Service Worker를 통한 Push 알림 (앱이 백그라운드일 때)
export const showPushNotification = async (title, options = {}) => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker를 지원하지 않습니다.');
    return showLocalNotification(title, options);
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: 'pow-timer',
      renotify: true,
      ...options,
    });
    return true;
  } catch (error) {
    console.error('Push 알림 오류:', error);
    return showLocalNotification(title, options);
  }
};

// 타이머 완료 알림 (모든 방법 동시 사용)
export const notifyTimerComplete = async (goalMinutes) => {
  const title = '🎉 POW 목표 달성!';
  const body = `${goalMinutes}분 목표를 달성했습니다. 인증 카드를 만들어보세요!`;

  // 1. 소리 재생
  playNotificationSound();

  // 2. 진동
  vibrate([200, 100, 200, 100, 200]);

  // 3. Push 알림 (또는 로컬 알림)
  await showPushNotification(title, { body });

  // 4. 화면 팝업 (사용자에게 직접 표시)
  return { title, body };
};

// 앱이 포그라운드로 돌아왔을 때 알림 확인
export const checkPendingNotification = () => {
  const pendingNotification = localStorage.getItem('citadel-pending-notification');
  if (pendingNotification) {
    localStorage.removeItem('citadel-pending-notification');
    try {
      return JSON.parse(pendingNotification);
    } catch (error) {
      return null;
    }
  }
  return null;
};

// 백그라운드에서 알림 예약 (Service Worker + localStorage)
export const scheduleNotification = async (goalMinutes, endTime) => {
  const notification = {
    title: '🎉 POW 목표 달성!',
    body: `${goalMinutes}분 목표를 달성했습니다.`,
    scheduledTime: endTime,
  };

  // localStorage에도 저장 (앱이 포그라운드로 돌아왔을 때 확인용)
  localStorage.setItem('citadel-pending-notification', JSON.stringify(notification));

  // BUG FIX: Service Worker에 알림 예약 메시지 전송
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const delay = endTime - Date.now();
      if (delay > 0) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SCHEDULE_NOTIFICATION',
          title: notification.title,
          body: notification.body,
          delay: delay,
        });
        console.log(`📅 Service Worker에 알림 예약됨: ${Math.round(delay / 1000)}초 후`);
      }
    } catch (error) {
      console.error('Service Worker 알림 예약 실패:', error);
    }
  }
};

// Service Worker 등록
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker를 지원하지 않습니다.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker 등록 성공:', registration.scope);
    return registration;
  } catch (error) {
    console.error('Service Worker 등록 실패:', error);
    return null;
  }
};

// 초기화 함수 (앱 시작 시 호출)
export const initNotifications = async () => {
  // Service Worker 등록
  await registerServiceWorker();

  // 알림 권한 확인 (아직 요청하지 않음 - 사용자 액션 시 요청)
  if ('Notification' in window) {
    notificationPermission = Notification.permission;
  }

  // 백그라운드에서 돌아왔을 때 대기 중인 알림 확인
  const pending = checkPendingNotification();
  if (pending) {
    const now = Date.now();
    if (pending.scheduledTime && now >= pending.scheduledTime) {
      // 예약된 시간이 지났으면 알림 표시
      showLocalNotification(pending.title, { body: pending.body });
      playNotificationSound();
      vibrate();
    }
  }
};
