const supabaseUrl = 'https://feprvneoartflrnmefxz.supabase.co';
const supabaseKey = 'sb_publishable_LW3f112nFPSSUUNvrXl19A__y73y2DE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const params = new URLSearchParams(window.location.search);
const workId = params.get('id');

let images = [];
let currentIndex = 0;
let isSliding = false;
// 1. DB에서 데이터 불러오기
async function loadWorkAndImages() {
  // 1) works 정보
  const { data: work, error: workError } = await supabase
    .from('works')
    .select('*')
    .eq('id', workId)
    .single();

  if (workError || !work) {
    document.querySelector('#gallery').innerHTML = '프로젝트 정보 불러오기 실패!';
    return;
  }

  // 2) images 정보
  const { data: imgs, error: imgError } = await supabase
    .from('images')
    .select('*')
    .eq('work_id', workId)
    .order('id', { ascending: true });

  if (imgError || !imgs || imgs.length === 0) {
    document.querySelector('#gallery').innerHTML = '이미지 불러오기 실패!';
    return;
  }
  images = imgs;
  currentIndex = 0;

  // 3) 상세정보 출력
  document.getElementById('work-title').textContent = work.title || '';
  document.getElementById('work-subtitle').textContent = work.subtitle || '';
  document.getElementById('work-since').textContent = work.since || '';

  // 4) 갤러리 UI 최초 1번만 생성
  renderGallery();
  // 5) 첫 이미지 보여줌
  showImage(currentIndex);
}

// 2. 갤러리 구조 한 번만 생성
function renderGallery() {
  const gallery = document.getElementById('gallery');
  gallery.innerHTML = `
    <div class="gallery-img-box">
      <img id="galleryImgPrev" class="gallery-img slide" src="" alt="" style="z-index:1; display:none;">
      <img id="galleryImg" class="gallery-img slide" src="" alt="" style="z-index:2;">
      <button class="gallery-nav left" id="galleryNavLeft">&lt;</button>
      <button class="gallery-nav right" id="galleryNavRight">&gt;</button>
    </div>
  `;

  document.getElementById('galleryNavLeft').onclick = function() {
    if (currentIndex > 0 && !isSliding) {
      currentIndex--;
      showImage(currentIndex, -1); // ← 왼쪽(-1)
    }
  };
  document.getElementById('galleryNavRight').onclick = function() {
    if (currentIndex < images.length - 1 && !isSliding) {
      currentIndex++;
      showImage(currentIndex, 1); // ← 오른쪽(1)
    }
  };
}
function updateGalleryNavButtons() {
  const leftBtn = document.getElementById('galleryNavLeft');
  const rightBtn = document.getElementById('galleryNavRight');

  if (currentIndex === 0) leftBtn.classList.add('fadeout');
  else leftBtn.classList.remove('fadeout');
  if (currentIndex === images.length - 1) rightBtn.classList.add('fadeout');
  else rightBtn.classList.remove('fadeout');
}

// 3. 이미지/버튼 상태만 바꿈 (DOM은 그대로)
function showImage(idx, direction = 0) {
  if (!images[idx] || isSliding) return;
  isSliding = true;

  const prevImg = document.getElementById('galleryImgPrev');
  const currImg = document.getElementById('galleryImg');

  // 1. 이전 이미지 -> prevImg에 세팅, 보이게
  prevImg.src = currImg.src || images[idx].image_url;
  prevImg.alt = currImg.alt || images[idx].image_url;
  prevImg.style.display = currImg.src ? 'block' : 'none';
  prevImg.style.transition = 'none';
  prevImg.style.transform = 'translateX(0%)';

  // 2. 새 이미지 프리로드!
  const preloader = new window.Image();
  preloader.onload = () => {
    // 2-1. 새 이미지 세팅 (슬라이드 바깥 위치)
    currImg.src = images[idx].image_url;
    currImg.alt = images[idx].image_url;
    currImg.style.transition = 'none';
    currImg.style.transform = `translateX(${direction === 1 ? '100%' : direction === -1 ? '-100%' : '0%'})`;

    // 3. 한 프레임 쉬고 슬라이드 애니 시작
    setTimeout(() => {
      currImg.style.transition = 'transform 0.45s cubic-bezier(.77,0,.18,1)';
      prevImg.style.transition = 'transform 0.45s cubic-bezier(.77,0,.18,1)';
      prevImg.style.transform = `translateX(${direction === 1 ? '-100%' : direction === -1 ? '100%' : '0%'})`;
      currImg.style.transform = 'translateX(0%)';
    }, 16);

    // 4. 애니 끝나면 prevImg 숨김, 상태 갱신
    setTimeout(() => {
      prevImg.style.display = 'none';
      prevImg.style.transition = 'none';
      prevImg.style.transform = 'translateX(0%)';
      isSliding = false;
      updateGalleryNavButtons();
      updatePagination();
    }, 470);
  };

  // 진짜 프리로드 시작!
  preloader.src = images[idx].image_url;
}

// 5. 페이지네이션
function updatePagination() {
  const pag = document.querySelector('.gallery-pagination');
  if (!pag) return;
  let dots = '';
  for (let i = 0; i < images.length; i++) {
    dots += `<span class="page-dot${i === currentIndex ? ' active' : ''}"></span>`;
  }
  pag.innerHTML = dots;
}

// 6. 실행!
loadWorkAndImages();
