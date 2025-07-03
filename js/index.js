function updateLogoMode() {
  const wrapper = document.getElementById('mainLogoWrapper');
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (w > h) {
    wrapper.classList.add('one-line');
    wrapper.classList.remove('two-line');
  } else {
    wrapper.classList.add('two-line');
    wrapper.classList.remove('one-line');
  }
}

window.addEventListener('load', updateLogoMode);
window.addEventListener('resize', updateLogoMode);
