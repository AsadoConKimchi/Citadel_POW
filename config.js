// 백엔드 API URL 설정
const BACKEND_CONFIG = {
  // 로컬 개발 환경
  development: 'http://localhost:8787',

  // 프로덕션 환경 (Cloudflare Workers)
  production: 'https://citadel-pow-backend.workers.dev',
};

// 현재 환경 감지
const isDevelopment = window.location.hostname === 'localhost' ||
                      window.location.hostname === '127.0.0.1';

// 백엔드 URL 설정
window.BACKEND_API_URL = isDevelopment
  ? BACKEND_CONFIG.development
  : BACKEND_CONFIG.production;

console.log('🔗 Backend API URL:', window.BACKEND_API_URL);
