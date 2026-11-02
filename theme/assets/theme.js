/* SEOUL GLOW MAISON — theme.js (no dependencies) */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isRTL = document.documentElement.dir === 'rtl';
  const SG = window.SG || { routes: {}, strings: {} };

  /* ---------- Preloader & ready ---------- */
  const ready = () => document.body.classList.add('is-ready');
  const pre = $('[data-preloader]');
  if (pre) {
    let seen = false;
    try { seen = sessionStorage.getItem('sg-intro') === '1'; } catch (e) {}
    if (seen || reduce) { pre.remove(); ready(); }
    else {
      try { sessionStorage.setItem('sg-intro', '1'); } catch (e) {}
      setTimeout(() => { pre.classList.add('is-done'); setTimeout(ready, 250); setTimeout(() => pre.remove(), 1300); }, 1650);
    }
  } else { requestAnimationFrame(ready); }

  /* ---------- Toast ---------- */
  const toastEl = $('[data-toast]');
  let toastT;
  const toast = (msg) => {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('is-visible');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-visible'), 2600);
  };

  /* ---------- Header behaviour ---------- */
  const headerSection = $('.section-header');
  const header = $('[data-header]');
  const announce = $('.section-announce');
  const setAnnounceH = () => document.documentElement.style.setProperty('--announce-h', (announce ? announce.offsetHeight : 0) + 'px');
  setAnnounceH();
  window.addEventListener('resize', setAnnounceH);
  let lastY = 0;
  const onScroll = () => {
    const y = window.scrollY;
    if (header) header.classList.toggle('is-solid', y > 60);
    if (headerSection) {
      headerSection.classList.toggle('is-scrolled', y > (announce ? announce.offsetHeight : 0));
      const goingDown = y > lastY && y > 400;
      const megaOpen = header && header.matches(':hover');
      headerSection.classList.toggle('is-hidden', goingDown && !megaOpen);
    }
    lastY = y;
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- Drawers ---------- */
  let activeDrawer = null;
  const openDrawer = (name) => {
    const d = $(`[data-drawer="${name}"]`);
    if (!d) return false;
    closeDrawer();
    d.classList.add('is-open');
    d.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-locked');
    activeDrawer = d;
    const focusable = $('input[type="search"], button, a', d);
    setTimeout(() => focusable && focusable.focus({ preventScroll: true }), 350);
    return true;
  };
  const closeDrawer = () => {
    if (!activeDrawer) return;
    activeDrawer.classList.remove('is-open');
    activeDrawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-locked');
    activeDrawer = null;
  };
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-drawer-open]');
    if (opener) {
      const name = opener.getAttribute('data-drawer-open');
      if (name === 'cart' && document.body.classList.contains('template-cart')) return;
      if (openDrawer(name)) e.preventDefault();
      return;
    }
    if (e.target.closest('[data-drawer-close]')) { e.preventDefault(); closeDrawer(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- Cart (AJAX + section rendering) ---------- */
  const fetchJSON = (url, opts) => fetch(url, opts).then((r) => r.json().then((j) => (r.ok ? j : Promise.reject(j))));
  const refreshCart = async (open = false) => {
    try {
      const res = await fetch(`${SG.routes.root.replace(/\/$/, '')}/?sections=cart-drawer`);
      const data = await res.json();
      const html = data['cart-drawer'];
      if (!html) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const fresh = $('[data-cart-drawer]', tmp);
      const current = $('[data-cart-drawer]');
      if (fresh && current) {
        const wasOpen = current.classList.contains('is-open');
        fresh.classList.toggle('is-open', wasOpen || open);
        fresh.setAttribute('aria-hidden', wasOpen || open ? 'false' : 'true');
        current.replaceWith(fresh);
        if (wasOpen || open) { activeDrawer = fresh; document.body.classList.add('is-locked'); }
        const count = fresh.getAttribute('data-count');
        $$('[data-cart-count]').forEach((el) => {
          el.textContent = count;
          el.classList.toggle('is-empty', count === '0');
          el.classList.remove('is-bump'); void el.offsetWidth; el.classList.add('is-bump');
        });
        if (open && !wasOpen) openDrawer('cart');
      }
    } catch (e) { /* noop */ }
  };
  const addToCart = async (id, qty = 1, btn) => {
    if (btn) btn.classList.add('is-loading');
    try {
      await fetchJSON(SG.routes.cartAdd + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: Number(id), quantity: Number(qty) || 1 }] })
      });
      document.dispatchEvent(new CustomEvent('sg:added'));
      await refreshCart(true);
      toast(SG.strings.added || 'Added to bag');
    } catch (err) {
      toast((err && (err.description || err.message)) || SG.strings.error || 'Error');
    } finally {
      if (btn) btn.classList.remove('is-loading');
    }
  };
  document.addEventListener('click', (e) => {
    const q = e.target.closest('[data-quick-add]');
    if (q) { e.preventDefault(); addToCart(q.getAttribute('data-quick-add'), 1, q); return; }
    const c = e.target.closest('[data-cart-qty]');
    if (c) {
      e.preventDefault();
      const line = $('.cart-line[data-line="' + c.getAttribute('data-cart-qty') + '"]');
      if (line) line.style.opacity = '.4';
      fetchJSON(SG.routes.cartChange + '.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ line: Number(c.getAttribute('data-cart-qty')), quantity: Number(c.getAttribute('data-qty')) })
      }).then(() => refreshCart()).catch((err) => { toast((err && err.description) || SG.strings.error); refreshCart(); });
    }
  });

  /* ---------- Reveal on scroll ---------- */
  if ('IntersectionObserver' in window && document.body.classList.contains('has-reveal')) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    const watch = (root = document) => $$('[data-reveal]:not(.is-in), .line', root).forEach((el) => io.observe(el));
    watch();
    window.SGwatch = watch;
  } else {
    $$('[data-reveal], .line').forEach((el) => el.classList.add('is-in'));
    window.SGwatch = (root = document) => $$('[data-reveal], .line', root).forEach((el) => el.classList.add('is-in'));
  }

  /* ---------- Parallax ---------- */
  const px = $$('[data-parallax]');
  if (px.length && !reduce) {
    let ticking = false;
    const run = () => {
      const vh = window.innerHeight;
      px.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });
      ticking = false;
    };
    window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(run); ticking = true; } }, { passive: true });
    run();
  }

  /* ---------- Magnetic buttons ---------- */
  if (window.matchMedia('(hover: hover)').matches && !reduce) {
    $$('[data-magnetic]').forEach((b) => {
      b.addEventListener('mousemove', (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.32;
        b.style.transform = `translate(${x}px, ${y}px)`;
      });
      b.addEventListener('mouseleave', () => { b.style.transform = ''; });
    });
  }

  /* ---------- Rails (progress, arrows, drag) ---------- */
  const initRail = (track) => {
    if (track.dataset.ready) return;
    track.dataset.ready = '1';
    const scope = track.closest('.rail__panel, section') || document;
    const bar = $('[data-rail-progress]', scope);
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const ratio = track.clientWidth / track.scrollWidth;
      const pos = max > 0 ? Math.abs(track.scrollLeft) / max : 0;
      if (bar) { bar.style.width = Math.max(ratio * 100, 8) + '%'; bar.style.transform = `translateX(${(isRTL ? -1 : 1) * pos * (1 / Math.max(ratio, .08) - 1) * 100}%)`; }
    };
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
    const step = () => (track.querySelector(':scope > *') || track).getBoundingClientRect().width * 1.5;
    const prev = $('[data-rail-prev]', scope); const next = $('[data-rail-next]', scope);
    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: (isRTL ? 1 : -1) * step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: (isRTL ? -1 : 1) * step(), behavior: 'smooth' }));
    if (track.hasAttribute('data-drag') && window.matchMedia('(pointer: fine)').matches) {
      let down = false, sx = 0, sl = 0, moved = false;
      track.addEventListener('pointerdown', (e) => { down = true; moved = false; sx = e.clientX; sl = track.scrollLeft; });
      window.addEventListener('pointermove', (e) => {
        if (!down) return;
        const dx = e.clientX - sx;
        if (Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
        track.scrollLeft = sl - dx;
      });
      window.addEventListener('pointerup', () => { down = false; setTimeout(() => track.classList.remove('is-dragging'), 0); });
      track.addEventListener('click', (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
      track.addEventListener('dragstart', (e) => e.preventDefault());
    }
  };
  $$('[data-rail]').forEach(initRail);

  /* ---------- Tabs ---------- */
  $$('[data-tabs]').forEach((wrap) => {
    $$('[data-tab]', wrap).forEach((tab) => tab.addEventListener('click', () => {
      const i = tab.getAttribute('data-tab');
      $$('[data-tab]', wrap).forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-selected', t === tab); });
      $$('[data-panel]', wrap).forEach((p) => p.classList.toggle('is-active', p.getAttribute('data-panel') === i));
      const panel = $(`[data-panel="${i}"]`, wrap);
      if (panel) { $$('[data-reveal]', panel).forEach((el) => el.classList.add('is-in')); $$('[data-rail]', panel).forEach((t) => { initRail(t); t.dispatchEvent(new Event('scroll')); }); }
    }));
  });

  /* ---------- Ritual steps ---------- */
  $$('[data-ritual]').forEach((sec) => {
    const steps = $$('[data-ritual-step]', sec);
    const imgs = $$('[data-ritual-img]', sec);
    const num = $('[data-ritual-num]', sec);
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const i = en.target.getAttribute('data-ritual-step');
        steps.forEach((s) => s.classList.toggle('is-active', s === en.target));
        imgs.forEach((im) => im.classList.toggle('is-active', im.getAttribute('data-ritual-img') === i));
        if (num) num.textContent = String(Number(i) + 1).padStart(2, '0');
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
  });

  /* ---------- Lookbook word ---------- */
  $$('[data-lookbook]').forEach((lb) => {
    const t = $('.lookbook__titles', lb);
    if (t && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) { t.classList.add('is-in'); io.disconnect(); } }, { threshold: .3 });
      io.observe(t);
    } else if (t) t.classList.add('is-in');
  });

  /* ---------- Skin quiz ---------- */
  $$('[data-quiz]').forEach((quiz) => {
    const steps = $$('[data-quiz-step]', quiz);
    const bar = $('[data-quiz-bar]', quiz);
    const answers = {};
    const go = (n) => {
      steps.forEach((s) => s.classList.toggle('is-active', Number(s.getAttribute('data-quiz-step')) === n));
      if (bar) bar.style.width = `${(n / (steps.length - 1)) * 100}%`;
    };
    const showResult = async () => {
      go(3);
      const box = $('[data-quiz-products]', quiz);
      const more = $('[data-quiz-more]', quiz);
      const url = answers.concern || answers.type || '/collections/all';
      if (more) more.href = url;
      box.innerHTML = '<div class="loader"></div>';
      try {
        const res = await fetch(`${url}?section_id=quiz-results`);
        const html = await res.text();
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const list = $('.quiz-results', tmp);
        if (list) {
          const max = Number(answers.level || 4);
          $$('.quiz-results__item', list).forEach((it, i) => { if (i >= max) it.remove(); });
          box.innerHTML = '';
          box.appendChild(list);
          $$('[data-reveal]', box).forEach((el) => el.classList.add('is-in'));
        } else box.innerHTML = '';
      } catch (e) { box.innerHTML = ''; }
    };
    quiz.addEventListener('click', (e) => {
      const opt = e.target.closest('[data-answer]');
      if (opt) {
        const key = opt.getAttribute('data-answer');
        answers[key] = opt.getAttribute('data-value');
        $$(`[data-answer="${key}"]`, quiz).forEach((o) => o.classList.toggle('is-picked', o === opt));
        const cur = Number(opt.closest('[data-quiz-step]').getAttribute('data-quiz-step'));
        setTimeout(() => (cur >= 2 ? showResult() : go(cur + 1)), 380);
        return;
      }
      if (e.target.closest('[data-quiz-restart]')) {
        Object.keys(answers).forEach((k) => delete answers[k]);
        $$('.is-picked', quiz).forEach((o) => o.classList.remove('is-picked'));
        go(0);
      }
    });
  });

  /* ---------- Product page ---------- */
  const initProduct = (root) => {
    if (root.dataset.init) return;
    root.dataset.init = '1';
    const form = $('[data-product-form]', root);
    const jsonEl = $('[data-product-json]', root);
    const data = jsonEl ? JSON.parse(jsonEl.textContent) : null;
    const idInput = $('[data-variant-id]', root);
    const addBtn = $('[data-add-btn]', root);
    const addText = $('[data-add-text]', root);
    const priceEl = $('[data-price]', root);
    const stockEl = $('[data-low-stock]', root);
    const stockText = $('[data-low-stock-text]', root);
    const stickyPrice = $('[data-sticky-price]', root);
    const stickyAdd = $('[data-sticky-add]', root);

    // Gallery
    const slides = $$('.pdp__slide', root);
    const thumbs = $$('[data-thumb]', root);
    let idx = 0;
    const show = (i) => {
      if (!slides.length) return;
      idx = (i + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === idx));
      thumbs.forEach((t, k) => t.classList.toggle('is-active', k === idx));
      const main = $('.pdp__main', root); if (main) main.classList.remove('is-zoom');
    };
    const showMedia = (id) => { const k = slides.findIndex((s) => s.getAttribute('data-media-id') === String(id)); if (k > -1) show(k); };
    thumbs.forEach((t, k) => t.addEventListener('click', () => show(k)));
    const prevB = $('[data-gallery-prev]', root), nextB = $('[data-gallery-next]', root);
    if (prevB) prevB.addEventListener('click', () => show(idx + (isRTL ? 1 : -1)));
    if (nextB) nextB.addEventListener('click', () => show(idx + (isRTL ? -1 : 1)));
    const main = $('.pdp__main', root);
    if (main) {
      let sx = null;
      main.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      main.addEventListener('touchend', (e) => {
        if (sx === null) return;
        const dx = e.changedTouches[0].clientX - sx;
        if (Math.abs(dx) > 40) show(idx + ((dx < 0) !== isRTL ? 1 : -1));
        sx = null;
      });
      if (window.matchMedia('(hover: hover)').matches) {
        main.addEventListener('click', (e) => { if (e.target.closest('button')) return; if (e.target.tagName === 'IMG') main.classList.toggle('is-zoom'); });
        main.addEventListener('mousemove', (e) => {
          if (!main.classList.contains('is-zoom')) return;
          const r = main.getBoundingClientRect();
          const img = $('.pdp__slide.is-active img', main);
          if (img) img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
        });
      }
    }

    // Variants
    const update = () => {
      if (!data || !form) return;
      const selected = $$('fieldset[data-option-index]', form).map((fs) => { const c = $('input:checked', fs); return c ? c.value : null; });
      $$('fieldset[data-option-index]', form).forEach((fs, i) => { const v = $('[data-option-value]', fs); if (v) v.textContent = selected[i]; });
      const variant = data.variants.find((v) => v.options.every((o, i) => o === selected[i]));
      // mark unavailable values for single-option products
      if ($$('fieldset[data-option-index]', form).length === 1) {
        $$('.pill', form).forEach((p) => { const val = $('input', p).value; const v = data.variants.find((x) => x.options[0] === val); p.classList.toggle('is-unavailable', !v || !v.available); });
      }
      if (!variant) {
        if (addBtn) addBtn.disabled = true;
        if (addText) addText.textContent = SG.strings.unavailable;
        return;
      }
      idInput.value = variant.id;
      if (addBtn) addBtn.disabled = !variant.available;
      if (stickyAdd) stickyAdd.disabled = !variant.available;
      if (addText) addText.textContent = variant.available ? SG.strings.addToCart : SG.strings.soldOut;
      if (priceEl) {
        priceEl.classList.toggle('price--sale', !!variant.compare);
        priceEl.innerHTML = `<span class="price__now">${variant.price}</span>` + (variant.compare ? `<s class="price__was">${variant.compare}</s><span class="price__save">−${variant.save}%</span>` : '');
      }
      if (stickyPrice) stickyPrice.textContent = variant.price.replace(/<[^>]+>/g, '');
      if (stockEl) {
        const low = variant.qty !== null && variant.qty > 0 && variant.qty <= data.lowStock;
        stockEl.classList.toggle('is-hidden', !low);
        if (low && stockText) stockText.textContent = data.onlyLeft.replace('__N__', variant.qty);
      }
      if (variant.media) showMedia(variant.media);
      if (!root.hasAttribute('data-quickview')) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());
      }
    };
    if (form) {
      form.addEventListener('change', (e) => { if (e.target.name && e.target.name.startsWith('option-')) update(); });
      $$('[data-qty-step]', form).forEach((b) => b.addEventListener('click', () => {
        const inp = $('input[name="quantity"]', form);
        inp.value = Math.max(1, (Number(inp.value) || 1) + Number(b.getAttribute('data-qty-step')));
      }));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const qty = $('input[name="quantity"]', form).value;
        addToCart(idInput.value, qty, addBtn);
      });
      update();
    }
    if (stickyAdd) stickyAdd.addEventListener('click', () => addToCart(idInput.value, 1, stickyAdd));
    const sticky = $('[data-sticky-atc]', root);
    if (sticky && addBtn && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([en]) => sticky.classList.toggle('is-visible', !en.isIntersecting && en.boundingClientRect.top < 0), { threshold: 0 });
      io.observe(addBtn);
    }
  };
  $$('[data-product]').forEach(initProduct);

  /* ---------- Recommendations (lazy) ---------- */
  $$('[data-recs]').forEach((sec) => {
    const url = sec.getAttribute('data-url');
    if (!url || sec.children.length) return;
    fetch(url).then((r) => r.text()).then((html) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = html;
      const fresh = $('[data-recs]', tmp);
      if (fresh && fresh.innerHTML.trim()) {
        sec.innerHTML = fresh.innerHTML;
        $$('[data-rail]', sec).forEach(initRail);
        window.SGwatch && window.SGwatch(sec);
      }
    }).catch(() => {});
  });

  /* ---------- Collection filters / sort / grid ---------- */
  $$('[data-filter-form]').forEach((form) => {
    const submit = () => {
      const params = new URLSearchParams(new FormData(form));
      window.location.search = params.toString();
    };
    form.addEventListener('change', submit);
    form.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
    document.addEventListener('click', (e) => { $$('.fdrop[open]', form).forEach((d) => { if (!d.contains(e.target)) d.removeAttribute('open'); }); });
  });
  $$('[data-cols]').forEach((b) => b.addEventListener('click', () => {
    const grid = $('[data-grid]');
    if (!grid) return;
    grid.classList.toggle('is-2', b.getAttribute('data-cols') === '2');
    $$('[data-cols]').forEach((x) => x.classList.toggle('is-active', x === b));
  }));

  /* ---------- Predictive search ---------- */
  const sForm = $('[data-predictive-search]');
  if (sForm) {
    const input = $('[data-search-input]', sForm);
    const out = $('[data-search-results]');
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value.trim();
      if (q.length < 2) { out.innerHTML = ''; return; }
      t = setTimeout(async () => {
        try {
          const res = await fetch(`${SG.routes.search}?q=${encodeURIComponent(q)}&resources[type]=product,collection&resources[limit]=6&section_id=predictive-search`);
          const html = await res.text();
          const tmp = document.createElement('div');
          tmp.innerHTML = html;
          const ps = $('.ps', tmp);
          out.innerHTML = ps ? ps.outerHTML : '';
        } catch (e) { out.innerHTML = ''; }
      }, 220);
    });
  }

  /* ---------- Quick view ---------- */
  const qv = $('[data-quickview-modal]');
  const qvBody = qv ? $('[data-quickview-body]', qv) : null;
  const closeQV = () => { if (!qv) return; qv.classList.remove('is-open'); qv.setAttribute('aria-hidden', 'true'); if (!activeDrawer) document.body.classList.remove('is-locked'); };
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-quickview]');
    if (b && qv && !b.closest('[data-quickview-modal]')) {
      e.preventDefault();
      qvBody.innerHTML = '<div class="loader"></div>';
      qv.classList.add('is-open'); qv.setAttribute('aria-hidden', 'false');
      document.body.classList.add('is-locked');
      try {
        const res = await fetch(b.getAttribute('data-quickview') + (b.getAttribute('data-quickview').includes('?') ? '&' : '?') + 'section_id=quick-view');
        const tmp = document.createElement('div');
        tmp.innerHTML = await res.text();
        const node = $('[data-product]', tmp);
        qvBody.innerHTML = '';
        if (node) { qvBody.appendChild(node); initProduct(node); }
      } catch (err) { qvBody.innerHTML = ''; closeQV(); }
      return;
    }
    if (e.target.closest('[data-quickview-close]')) { e.preventDefault(); closeQV(); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeQV(); });
  document.addEventListener('sg:added', closeQV);

  /* ---------- Delivery estimate (Dubai time, 4pm cutoff, no Friday dispatch) ---------- */
  $$('[data-eta]').forEach((el) => {
    const lang = document.documentElement.lang === 'ar' ? 'ar-AE' : 'en-GB';
    const cutoff = Number(el.getAttribute('data-cutoff') || 16);
    const minD = Number(el.getAttribute('data-min') || 1), maxD = Number(el.getAttribute('data-max') || 2);
    const dubaiNow = () => { const n = new Date(); return new Date(n.getTime() + (n.getTimezoneOffset() + 240) * 60000); };
    const isFri = (d) => d.getDay() === 5;
    const addWorking = (d, n) => { const x = new Date(d); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (!isFri(x)) k++; } return x; };
    const render = () => {
      const now = dubaiNow();
      let dispatch = new Date(now);
      const today = !isFri(now) && now.getHours() < cutoff;
      if (!today) { do { dispatch.setDate(dispatch.getDate() + 1); } while (isFri(dispatch)); }
      const fmt = new Intl.DateTimeFormat(lang, { weekday: 'short', day: 'numeric', month: 'short' });
      const a = fmt.format(addWorking(dispatch, minD)), b = fmt.format(addWorking(dispatch, maxD));
      let lead = '';
      if (today) {
        const left = new Date(now); left.setHours(cutoff, 0, 0, 0);
        const mins = Math.max(0, Math.round((left - now) / 60000));
        const h = Math.floor(mins / 60), m = mins % 60;
        lead = (el.getAttribute('data-today') || '').replace('__T__', `<b>${h ? h + (lang.startsWith('ar') ? 'س ' : 'h ') : ''}${m}${lang.startsWith('ar') ? 'د' : 'm'}</b>`);
      } else {
        lead = el.getAttribute('data-next') || '';
      }
      el.innerHTML = `${lead} <span>${(el.getAttribute('data-arrives') || '').replace('__A__', `<b>${a}</b>`).replace('__B__', `<b>${b}</b>`)}</span>`;
    };
    render();
    setInterval(render, 60000);
  });

  /* ---------- Recently viewed ---------- */
  const RV_KEY = 'sg-recent';
  const readRV = () => { try { return JSON.parse(localStorage.getItem(RV_KEY) || '[]'); } catch (e) { return []; } };
  const cur = document.querySelector('[data-product-url]');
  if (cur) {
    const url = cur.getAttribute('data-product-url');
    const list = [url].concat(readRV().filter((u) => u !== url)).slice(0, 12);
    try { localStorage.setItem(RV_KEY, JSON.stringify(list)); } catch (e) {}
  }
  $$('[data-recently-viewed]').forEach(async (sec) => {
    const exclude = cur ? cur.getAttribute('data-product-url') : '';
    const urls = readRV().filter((u) => u !== exclude).slice(0, Number(sec.getAttribute('data-limit') || 8));
    if (!urls.length) return;
    const track = $('[data-rail]', sec);
    const cards = await Promise.all(urls.map((u) => fetch(`${u}?section_id=quick-card`).then((r) => (r.ok ? r.text() : '')).catch(() => '')));
    cards.forEach((html) => {
      if (!html) return;
      const tmp = document.createElement('div'); tmp.innerHTML = html;
      const card = $('.card', tmp);
      if (card) { const item = document.createElement('div'); item.className = 'rail__item'; card.classList.add('is-in'); item.appendChild(card); track.appendChild(item); }
    });
    if (track.children.length) { sec.hidden = false; initRail(track); track.dispatchEvent(new Event('scroll')); }
  });

  /* ---------- Welcome popup ---------- */
  const pop = $('[data-popup]');
  if (pop) {
    const KEY = 'sg-popup';
    const show = () => { pop.classList.add('is-open'); pop.setAttribute('aria-hidden', 'false'); };
    const hide = () => { pop.classList.remove('is-open'); pop.setAttribute('aria-hidden', 'true'); try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {} };
    let last = 0; try { last = Number(localStorage.getItem(KEY) || 0); } catch (e) {}
    const days = Number(pop.getAttribute('data-days') || 7);
    if (pop.hasAttribute('data-posted')) show();
    else if (Date.now() - last > days * 864e5) {
      let fired = false;
      const fire = () => { if (fired || document.body.classList.contains('is-locked')) return; fired = true; show(); };
      setTimeout(fire, Number(pop.getAttribute('data-delay') || 12) * 1000);
      document.addEventListener('mouseout', (e) => { if (!e.relatedTarget && e.clientY < 10) fire(); });
    }
    $$('[data-popup-close]', pop).forEach((b) => b.addEventListener('click', hide));
    const copy = $('[data-copy]', pop);
    if (copy) copy.addEventListener('click', () => { navigator.clipboard && navigator.clipboard.writeText(copy.getAttribute('data-copy')); toast(copy.getAttribute('data-copied') || '✓'); });
  }

  /* ---------- Hero video safety ---------- */
  $$('.hero__video').forEach((v) => { v.muted = true; const p = v.play && v.play(); if (p && p.catch) p.catch(() => {}); });
})();
