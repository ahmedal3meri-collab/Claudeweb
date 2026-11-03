/* Seoul Glow — 인생네컷 photo booth. Everything runs on-device; nothing is uploaded. */
(() => {
  const root = document.querySelector('[data-booth]');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const video = $('[data-booth-video]'), idle = $('[data-booth-idle]'), countEl = $('[data-booth-count]');
  const flash = $('[data-booth-flash]'), dots = Array.from(root.querySelectorAll('[data-booth-dots] i'));
  const resultImg = $('[data-booth-result]'), startBtn = $('[data-booth-start]'), upload = $('[data-booth-upload]');
  const done = $('[data-booth-done]'), shareBtn = $('[data-booth-share]'), dl = $('[data-booth-download]');
  const retake = $('[data-booth-retake]'), copyBtn = $('[data-booth-copy]'), errEl = $('[data-booth-error]');
  const controls = $('.booth__controls'), filtersEl = $('[data-booth-filters]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const W = 1080, H = 1920, PW = 480, PH = 640; // story canvas + each frame (3:4)
  let filter = 'film', stream = null, busy = false, lastBlob = null, lastURL = null;

  filtersEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]'); if (!b) return;
    filter = b.dataset.filter;
    filtersEl.querySelectorAll('[data-filter]').forEach((x) => { const on = x === b; x.classList.toggle('is-on', on); x.setAttribute('aria-checked', String(on)); });
    root.dataset.filter = filter;
  });
  root.dataset.filter = filter;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const showError = (msg) => { errEl.textContent = msg; errEl.hidden = !msg; };

  // ---- image processing -------------------------------------------------
  const crop34 = (src, sw, sh, mirror) => {
    const c = document.createElement('canvas'); c.width = PW; c.height = PH;
    const x = c.getContext('2d');
    const target = PW / PH; let cw = sw, ch = sh;
    if (sw / sh > target) cw = sh * target; else ch = sw / target;
    const sx = (sw - cw) / 2, sy = (sh - ch) / 2;
    if (mirror) { x.translate(PW, 0); x.scale(-1, 1); }
    x.drawImage(src, sx, sy, cw, ch, 0, 0, PW, PH);
    return c;
  };

  const grade = (c, kind) => {
    const x = c.getContext('2d');
    const img = x.getImageData(0, 0, c.width, c.height), d = img.data;
    const cx = c.width / 2, cy = c.height * 0.45, maxR = Math.hypot(cx, cy);
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      const p = i / 4, px = p % c.width, py = (p / c.width) | 0;
      const v = Math.hypot(px - cx, py - cy) / maxR; // 0 centre → 1 corner
      if (kind === 'flash') {
        let l = 0.3 * r + 0.59 * g + 0.11 * b;
        l = (l - 128) * 1.38 + 136;
        r = g = b = l;
      } else if (kind === 'night') {
        r = r * 1.14 + 6; g = g * 0.9; b = b * 0.92 + 4;
        r = (r - 128) * 1.22 + 122; g = (g - 128) * 1.22 + 116; b = (b - 128) * 1.22 + 116;
      } else { // film: warm, lifted blacks, soft contrast
        const l = 0.3 * r + 0.59 * g + 0.11 * b;
        r = l + (r - l) * 0.86; g = l + (g - l) * 0.86; b = l + (b - l) * 0.86;
        r = r * 1.07 + 14; g = g * 1.0 + 8; b = b * 0.88 + 6;
        r = (r - 128) * 1.08 + 128; g = (g - 128) * 1.08 + 128; b = (b - 128) * 1.08 + 128;
      }
      // flash hot-spot + vignette
      const vig = 1 - Math.pow(v, 2.2) * (kind === 'night' ? 0.75 : 0.5);
      const hot = (1 - Math.min(1, v * 1.6)) * (kind === 'flash' ? 18 : 10);
      const n = (Math.random() - 0.5) * (kind === 'flash' ? 34 : 24); // grain
      d[i] = Math.max(0, Math.min(255, r * vig + hot + n));
      d[i + 1] = Math.max(0, Math.min(255, g * vig + hot + n));
      d[i + 2] = Math.max(0, Math.min(255, b * vig + hot + n));
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  const compose = async (frames) => {
    try { await Promise.all([document.fonts.load('800 60px "Inter Tight"'), document.fonts.load('500 28px "IBM Plex Mono"'), document.fonts.load('300 30px "Noto Serif KR"')]); } catch (e) {}
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const paper = '#F3ECDF', ink = '#0B0A09', lime = '#A6FF3B', red = '#BF2A1F';
    x.fillStyle = ink; x.fillRect(0, 0, W, H);
    // film sprockets
    x.fillStyle = '#1E1B18';
    for (let y = 24; y < H - 20; y += 64) { x.fillRect(14, y, 18, 34); x.fillRect(W - 32, y, 18, 34); }
    // header
    x.textAlign = 'center'; x.fillStyle = paper;
    x.font = '300 30px "Noto Serif KR", serif';
    if ('letterSpacing' in x) x.letterSpacing = '18px';
    x.fillText(root.dataset.brandKr || '서울 글로우', W / 2 + 9, 92);
    x.font = '800 74px "Inter Tight", "Helvetica Neue", Arial, sans-serif';
    if ('letterSpacing' in x) x.letterSpacing = '16px';
    x.fillText((root.dataset.brand || 'SEOUL GLOW').toUpperCase(), W / 2 + 8, 178);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    // frames 2×2
    const gx = 50, gy = 236, gap = 20;
    frames.forEach((f, k) => {
      const col = k % 2, row = (k / 2) | 0;
      const fx = gx + col * (PW + gap), fy = gy + row * (PH + gap);
      x.drawImage(f, fx, fy, PW, PH);
      x.font = '500 20px "IBM Plex Mono", monospace'; x.textAlign = 'left';
      x.fillStyle = 'rgba(255,214,140,.9)';
      x.fillText(`▸ ${k + 1}A  SG-400`, fx + 16, fy + PH - 18);
    });
    // footer
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}  ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    x.textAlign = 'center'; x.fillStyle = paper;
    x.font = '500 28px "IBM Plex Mono", monospace';
    x.fillText(`${stamp}  ·  SEOUL → UAE`, W / 2, 1620);
    x.font = '800 54px "Inter Tight", "Helvetica Neue", Arial, sans-serif';
    x.fillText('NOT YOUR USUAL SEOUL', W / 2, 1710);
    // lime tag
    const tag = '#SEOULGLOWBOOTH';
    x.font = '800 30px "Inter Tight", Arial, sans-serif';
    const tw = x.measureText(tag).width + 56;
    x.fillStyle = lime;
    const tx = W / 2 - tw / 2, ty = 1752, th = 58, rr = 29;
    x.beginPath(); x.moveTo(tx + rr, ty); x.arcTo(tx + tw, ty, tx + tw, ty + th, rr); x.arcTo(tx + tw, ty + th, tx, ty + th, rr); x.arcTo(tx, ty + th, tx, ty, rr); x.arcTo(tx, ty, tx + tw, ty, rr); x.closePath(); x.fill();
    x.fillStyle = ink; x.fillText(tag, W / 2, ty + 40);
    x.fillStyle = 'rgba(243,236,223,.55)'; x.font = '500 22px "IBM Plex Mono", monospace';
    x.fillText(root.dataset.site || '', W / 2, 1866);
    // red film date dot
    x.fillStyle = red; x.beginPath(); x.arc(W - 86, 132, 10, 0, Math.PI * 2); x.fill();
    return c;
  };

  const finish = async (frames) => {
    const sheet = await compose(frames);
    const blob = await new Promise((r) => sheet.toBlob(r, 'image/jpeg', 0.92));
    lastBlob = blob;
    if (lastURL) URL.revokeObjectURL(lastURL);
    lastURL = URL.createObjectURL(blob);
    resultImg.src = lastURL; resultImg.hidden = false;
    dl.href = lastURL;
    video.hidden = true; idle.hidden = true;
    controls.hidden = true; filtersEl.hidden = true;
    done.hidden = false;
    root.classList.add('is-done');
    busy = false;
  };

  const stopStream = () => { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } };

  // ---- camera run --------------------------------------------------------
  const run = async () => {
    if (busy) return; busy = true; showError('');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 1280 } }, audio: false });
    } catch (e) {
      busy = false; showError(root.dataset.denied); return;
    }
    video.srcObject = stream; video.hidden = false; idle.hidden = true;
    root.classList.add('is-live');
    try { await video.play(); } catch (e) {}
    await sleep(500);
    const frames = [];
    for (let k = 0; k < 4; k++) {
      for (let n = 3; n > 0; n--) { countEl.textContent = n; countEl.classList.remove('pop'); void countEl.offsetWidth; countEl.classList.add('pop'); await sleep(reduce ? 600 : 900); }
      countEl.textContent = '';
      flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
      const f = crop34(video, video.videoWidth || 640, video.videoHeight || 480, true);
      frames.push(grade(f, filter));
      dots[k] && dots[k].classList.add('on');
      await sleep(450);
    }
    stopStream(); root.classList.remove('is-live');
    await finish(frames);
  };

  startBtn.addEventListener('click', () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showError(root.dataset.denied); return; }
    run();
  });

  upload.addEventListener('change', async () => {
    const files = Array.from(upload.files || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length || busy) return;
    busy = true; showError('');
    const load = (file) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    try {
      const imgs = await Promise.all(files.slice(0, 4).map(load));
      while (imgs.length < 4) imgs.push(imgs[imgs.length % Math.max(1, files.length)]);
      const frames = imgs.map((im) => grade(crop34(im, im.naturalWidth, im.naturalHeight, false), filter));
      dots.forEach((d) => d.classList.add('on'));
      await finish(frames);
    } catch (e) { busy = false; }
    upload.value = '';
  });

  shareBtn.addEventListener('click', async () => {
    if (!lastBlob) return;
    const file = new File([lastBlob], 'seoul-glow-booth.jpg', { type: 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: 'Seoul Glow', text: '#SEOULGLOWBOOTH' }); } catch (e) {}
    } else { dl.click(); }
  });

  retake.addEventListener('click', () => {
    resultImg.hidden = true; done.hidden = true; controls.hidden = false; filtersEl.hidden = false; idle.hidden = false;
    dots.forEach((d) => d.classList.remove('on'));
    root.classList.remove('is-done');
  });

  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const code = root.dataset.code;
    try { await navigator.clipboard.writeText(code); } catch (e) {}
    const span = copyBtn.querySelector('span'); const old = span.textContent;
    span.textContent = root.dataset.copied; setTimeout(() => { span.textContent = old; }, 1800);
  });

  window.addEventListener('pagehide', stopStream);
})();
