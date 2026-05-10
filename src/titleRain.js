// ── TITLE SCREEN RAIN ANIMATION ──
(function(){
  const cv = document.getElementById('title-rain');
  if(!cv) return;
  const ctx = cv.getContext('2d');
  const CHARS = 'BLACKSITE01アイウエオカキクケコサシスセソタチツテト';
  let cols, drops, W, H;

  function resize(){
    W = cv.width = window.innerWidth;
    H = cv.height = window.innerHeight;
    cols = Math.floor(W / 20);
    drops = new Array(cols).fill(0).map(() => Math.random() * -H / 14);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawRain(){
    if(!document.getElementById('start-sc') || document.getElementById('start-sc').style.display === 'none') return;
    ctx.fillStyle = 'rgba(0,0,0,0.045)';
    ctx.fillRect(0, 0, W, H);
    for(let i = 0; i < cols; i++){
      const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
      const x = i * 20;
      const y = drops[i] * 14;
      // Lead char bright
      ctx.fillStyle = 'rgba(200,255,215,0.9)';
      ctx.font = '13px Courier New';
      ctx.fillText(ch, x, y);
      // Trail
      ctx.fillStyle = 'rgba(80,200,130,0.22)';
      ctx.fillText(CHARS[Math.floor(Math.random() * CHARS.length)], x, y - 14);
      if(y > H && Math.random() > 0.975) drops[i] = 0;
      drops[i] += 0.38;
    }
    requestAnimationFrame(drawRain);
  }
  drawRain();
})();
