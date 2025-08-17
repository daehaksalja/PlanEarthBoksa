// 보안 강화 헤더 및 설정
(function() {
  'use strict';
  
  // CSP 설정 (개발 환경에서는 더 관대하게)
  if (!window.CONFIG?.isDevelopment) {
    // 프로덕션 환경에서의 보안 강화
    
    // 우클릭 비활성화 (선택사항)
    document.addEventListener('contextmenu', e => {
      if (!window.CONFIG?.isDevelopment) {
        e.preventDefault();
      }
    });
    
    // 개발자 도구 감지 (선택사항)
    let devtools = {open: false, orientation: null};
    const threshold = 160;
    
    setInterval(() => {
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!devtools.open) {
          devtools.open = true;
          console.clear();
          console.warn('개발자 도구가 감지되었습니다.');
        }
      } else {
        devtools.open = false;
      }
    }, 500);
  }
  
  // 민감한 정보 제거
  if (typeof console !== 'undefined') {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    
    console.log = function(...args) {
      if (window.CONFIG?.isDevelopment) {
        originalLog.apply(console, args);
      }
    };
    
    console.warn = function(...args) {
      originalWarn.apply(console, args);
    };
    
    console.error = function(...args) {
      originalError.apply(console, args);
    };
  }
})();
