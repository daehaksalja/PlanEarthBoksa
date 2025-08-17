// 환경 설정
const CONFIG = {
  // 개발 환경 판별
  isDevelopment: window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' || 
                 window.location.hostname.includes('dev'),
  
  // API 기본 URL
  apiBaseUrl: 'https://planearth-ga.jmlee710000.workers.dev',
  
  // 폴링 간격 (밀리초)
  realtimePollingInterval: 120000, // 2분
  
  // 최대 백오프 배수
  maxBackoffMultiplier: 8,
  
  // 로그 레벨
  logLevel: 'warn', // 'debug', 'info', 'warn', 'error', 'silent'
  
  // 캐시 TTL (밀리초)
  cacheTTL: 600000, // 10분
  
  // 리더 선택 타임아웃
  leaderElectionTimeout: 500
};

// 개발 환경에서만 디버그 로그 활성화
CONFIG.enableDebugLogs = CONFIG.isDevelopment;

// 글로벌 노출
window.CONFIG = CONFIG;
