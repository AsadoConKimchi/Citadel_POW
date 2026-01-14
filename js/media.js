/**
 * Citadel POW - 미디어/인증카드 모듈
 */

import { formatTime, donationModeLabels, readFileAsDataUrl } from './utils.js';
import { getLastSessionSeconds } from './storage.js';

// DOM 요소 참조
let photoPreview = null;
let snapshotCanvas = null;
let badgeCanvas = null;
let cameraVideo = null;
let downloadLink = null;

// 미디어 상태
let photoSource = null;
let mediaPreviewUrl = null;
let selectedVideoDataUrl = null;
let selectedVideoFilename = "";

// 초기화
export const initMedia = (elements) => {
  photoPreview = elements.photoPreview;
  snapshotCanvas = elements.snapshotCanvas;
  badgeCanvas = elements.badgeCanvas;
  cameraVideo = elements.cameraVideo;
  downloadLink = elements.downloadLink;
};

// 미디어 미리보기 초기화
export const resetMediaPreview = () => {
  if (mediaPreviewUrl) {
    URL.revokeObjectURL(mediaPreviewUrl);
    mediaPreviewUrl = null;
  }
  selectedVideoDataUrl = null;
  selectedVideoFilename = "";
  photoSource = null;

  if (photoPreview) {
    photoPreview.src = "";
    photoPreview.style.display = "none";
  }
  if (snapshotCanvas) {
    snapshotCanvas.style.display = "none";
  }
  if (badgeCanvas) {
    badgeCanvas.style.display = "none";
  }
  if (cameraVideo) {
    cameraVideo.pause();
    cameraVideo.removeAttribute("src");
    cameraVideo.load();
    cameraVideo.style.display = "none";
  }
};

// 비디오 썸네일 로드
const loadVideoThumbnail = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    mediaPreviewUrl = url;
    cameraVideo.src = url;
    cameraVideo.muted = true;
    cameraVideo.playsInline = true;

    const cleanup = () => {
      cameraVideo.removeEventListener("loadeddata", onLoadedData);
      cameraVideo.removeEventListener("error", onError);
    };

    const onLoadedData = () => {
      try {
        cameraVideo.currentTime = Math.min(0.1, cameraVideo.duration || 0);
      } catch (error) {
        cleanup();
        reject(error);
        return;
      }

      const onSeeked = () => {
        cameraVideo.removeEventListener("seeked", onSeeked);
        snapshotCanvas.width = cameraVideo.videoWidth || snapshotCanvas.width;
        snapshotCanvas.height = cameraVideo.videoHeight || snapshotCanvas.height;
        const context = snapshotCanvas.getContext("2d");
        context.drawImage(cameraVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        const dataUrl = snapshotCanvas.toDataURL("image/png");
        photoPreview.src = dataUrl;
        photoPreview.style.display = "block";
        snapshotCanvas.style.display = "none";
        cameraVideo.style.display = "none";
        cleanup();
        resolve();
      };
      cameraVideo.addEventListener("seeked", onSeeked);
    };

    const onError = () => {
      cleanup();
      reject(new Error("video-load-failed"));
    };

    cameraVideo.addEventListener("loadeddata", onLoadedData);
    cameraVideo.addEventListener("error", onError);
  });

// 미디어 파일 처리
export const handleMediaFile = async (file) => {
  if (!file) return;

  resetMediaPreview();

  if (file.type.startsWith("video/")) {
    try {
      // 동영상 재생 시간 체크 (10초 제한)
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);

      await new Promise((resolve, reject) => {
        video.addEventListener('loadedmetadata', () => {
          if (video.duration > 10) {
            reject(new Error(`동영상은 10초 이내로 업로드해주세요. (현재: ${Math.round(video.duration)}초)`));
          } else {
            resolve(null);
          }
          URL.revokeObjectURL(video.src);
        });
        video.addEventListener('error', () => {
          reject(new Error('동영상 메타데이터를 불러올 수 없습니다.'));
          URL.revokeObjectURL(video.src);
        });
      });

      const dataUrl = await readFileAsDataUrl(file);
      selectedVideoDataUrl = dataUrl;
      selectedVideoFilename = file.name || "study-video";
      await loadVideoThumbnail(file);
      photoSource = photoPreview;
    } catch (error) {
      alert(error.message || "동영상을 불러올 수 없습니다. 다른 파일을 선택해주세요.");
      return;
    }
    return;
  }

  // 이미지 파일
  const url = URL.createObjectURL(file);
  mediaPreviewUrl = url;
  photoPreview.src = url;
  photoPreview.style.display = "block";
  snapshotCanvas.style.display = "none";
  cameraVideo.style.display = "none";
  badgeCanvas.style.display = "none";
  photoSource = photoPreview;
};

// 인증 카드 그리기
export const drawBadge = (options = {}) => {
  const {
    sessionOverride = null,
    donationModeValue = "pow-writing",
    planText = "",
  } = options;

  if (!badgeCanvas) return;

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

  const lastSession = sessionOverride || getLastSessionSeconds();
  const lastGoalRate = lastSession.goalMinutes
    ? Math.min(100, (lastSession.durationSeconds / 60 / lastSession.goalMinutes) * 100)
    : 0;
  const overlayHeight = 380;

  context.fillStyle = "rgba(15, 23, 42, 0.65)";
  context.fillRect(0, badgeCanvas.height - overlayHeight, badgeCanvas.width, overlayHeight);

  context.fillStyle = "#f8fafc";
  context.font = "bold 52px sans-serif";
  context.fillText("오늘의 POW 인증", 60, badgeCanvas.height - overlayHeight + 90);

  context.font = "bold 36px sans-serif";
  const plan = planText || lastSession.plan || "목표 미입력";
  context.fillText(`목표: ${plan}`, 60, badgeCanvas.height - overlayHeight + 150);

  context.font = "32px sans-serif";
  const modeLabel = donationModeLabels[donationModeValue] || "POW";
  context.fillText(`POW 분야: ${modeLabel}`, 60, badgeCanvas.height - overlayHeight + 200);

  context.font = "28px sans-serif";
  const studyTimeLabel = formatTime(lastSession.durationSeconds || 0);
  context.fillText(`POW Time: ${studyTimeLabel}`, 60, badgeCanvas.height - overlayHeight + 245);
  context.fillText(`Goal Rate: ${lastGoalRate.toFixed(1)}%`, 60, badgeCanvas.height - overlayHeight + 285);

  context.font = "24px sans-serif";
  const date = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  context.fillText(date, badgeCanvas.width - 300, badgeCanvas.height - 36);

  const dataUrl = badgeCanvas.toDataURL("image/png");
  if (downloadLink) {
    downloadLink.href = dataUrl;
    downloadLink.style.display = "inline-flex";
  }
  badgeCanvas.style.display = "block";
  if (snapshotCanvas) snapshotCanvas.style.display = "none";
  if (cameraVideo) cameraVideo.style.display = "none";
  if (photoPreview) photoPreview.style.display = "none";
};

// 인증 카드 Data URL 가져오기 (압축)
export const getBadgeDataUrl = () => {
  if (!badgeCanvas) return "";

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

// photoSource 존재 여부
export const hasPhotoSource = () => !!photoSource;

// 선택된 비디오 정보 가져오기
export const getSelectedVideo = () => ({
  dataUrl: selectedVideoDataUrl,
  filename: selectedVideoFilename,
});
