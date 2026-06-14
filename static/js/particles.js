// Animated floating background dots
(function () {
  const container = document.getElementById('bgParticles');
  if (!container) return;
  const COUNT = 28;
  for (let i = 0; i < COUNT; i++) {
    const dot = document.createElement('div');
    dot.className = 'bg-particle-dot';
    const size = 3 + Math.random() * 5;
    const left = Math.random() * 100;
    const delay = Math.random() * 12;
    const dur   = 8 + Math.random() * 14;
    const colors = ['rgba(167,139,250,0.5)','rgba(244,114,182,0.5)','rgba(52,211,153,0.4)','rgba(251,191,36,0.4)','rgba(56,189,248,0.4)'];
    dot.style.cssText = `
      width:${size}px;height:${size}px;
      left:${left}%;bottom:-10px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      animation-duration:${dur}s;
      animation-delay:-${delay}s;
      box-shadow:0 0 ${size*2}px currentColor;
    `;
    container.appendChild(dot);
  }

  // Simple AOS-like scroll observer
  const aosEls = document.querySelectorAll('[data-aos]');
  if (!aosEls.length) return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('aos-animate'); });
  }, { threshold: 0.15 });
  aosEls.forEach(el => {
    const delay = el.dataset.aosDelay || 0;
    el.style.transitionDelay = delay + 'ms';
    observer.observe(el);
  });
})();
