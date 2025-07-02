
  // 애니메이션 끝난 뒤 헤더 텍스트 생성
  setTimeout(() => {
    const header = document.getElementById("header");
    header.innerHTML = `PLANEARTH ARCHITECTS`;
    header.style.opacity = 1;
  }, 3400); // .main-logo 애니메이션 끝나는 시점과 맞춤!
