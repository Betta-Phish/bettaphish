const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReduced) document.documentElement.style.scrollBehavior = 'smooth';

(() => {
  const tablist = document.querySelector('.tabs[role="tablist"]');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('.tab[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('.panel[role="tabpanel"]'));
  if (!tabs.length || !panels.length) return;

  const panelById = new Map(panels.map(p => [p.id, p]));

  function ensureValidState() {
    let selected = tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0];
    tabs.forEach(t => {
      const on = t === selected;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const pid = t.getAttribute('aria-controls');
      const panel = panelById.get(pid);
      if (panel) panel.hidden = !on;
    });
  }

  function activateTab(tab, { focus = true, updateHash = true } = {}) {
    if (!tab || tab.getAttribute('aria-selected') === 'true') return;

    tabs.forEach(t => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });

    panels.forEach(p => {
      p.hidden = (p.id !== tab.getAttribute('aria-controls'));
      p.classList.remove('enter', 'enter-active');
    });

    const activePanel = document.getElementById(tab.getAttribute('aria-controls'));
    if (activePanel && !prefersReduced) {
      activePanel.classList.add('enter');
      requestAnimationFrame(() => activePanel.classList.add('enter-active'));
    }

    if (focus) tab.focus();

    if (updateHash) {
      const section = tab.id.replace('tab-', ''); 
      if (section) history.replaceState(null, '', `#${section}`);
    }
  }

  tablist.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab[role="tab"]');
    if (!btn) return;
    activateTab(btn, { focus: true, updateHash: true });
  });

  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;

    let nextIndex = i;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown': nextIndex = (i + 1) % tabs.length; break;
      case 'ArrowLeft':
      case 'ArrowUp':   nextIndex = (i - 1 + tabs.length) % tabs.length; break;
      case 'Home':      nextIndex = 0; break;
      case 'End':       nextIndex = tabs.length - 1; break;
      case 'Enter':
      case ' ':
        activateTab(tabs[i], { focus: true, updateHash: true });
        return;
      default: return;
    }
    e.preventDefault();
    tabs[nextIndex].focus();
  });

  function openFromHash() {
    const key = (location.hash || '#demo').slice(1).toLowerCase();
    const target = document.getElementById(`tab-${key}`);
    if (target) {
      activateTab(target, { focus: false, updateHash: false });
    } else {
      ensureValidState();
    }
  }

  ensureValidState();
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;

  const id = a.getAttribute('href').slice(1);
  if (!id) return;

  const maybeTab = document.getElementById(`tab-${id}`);
  if (maybeTab) return;

  const el = document.getElementById(id);
  if (!el) return;

  e.preventDefault();
  el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

const form = document.getElementById('betaForm');
const successEl = document.getElementById('formSuccess');

function setFieldError(fieldEl, msg) {
  const wrapper = fieldEl && fieldEl.closest ? fieldEl.closest('.field') : null;
  if (!wrapper) return;
  wrapper.classList.toggle('invalid', Boolean(msg));
  const err = wrapper.querySelector('.err');
  if (err) err.textContent = msg || '';
}

function validate(formEl) {
  let ok = true;
  if (!formEl) return false;

  const name = formEl.elements['name'];
  const email = formEl.elements['email'];
  const consent = formEl.elements['consent'];

  if (name) {
    const v = name.value.trim();
    if (!v) { setFieldError(name, 'Please enter your name.'); ok = false; }
    else setFieldError(name, '');
  }

  if (email) {
    const v = email.value.trim();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    if (!re.test(v)) { setFieldError(email, 'Enter a valid email address.'); ok = false; }
    else setFieldError(email, '');
  }

  if (consent && !consent.checked) {
    consent.focus();
    ok = false;
  }

  return ok;
}

async function submitForm(e){
  e.preventDefault();
  if (!validate(form)) return;

  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  form.setAttribute('aria-busy','true');

  const gotcha = form.elements['_gotcha'];
  if (gotcha && gotcha.value.trim() !== '') {
    if (successEl) successEl.classList.remove('hide');
    if (submitBtn) submitBtn.disabled = false;
    form.removeAttribute('aria-busy');
    form.reset();
    return;
  }

  try {
    const data = new FormData(form);
    const res = await fetch(form.action, { method:'POST', body:data, headers: { 'Accept':'application/json' } });
    if (res.ok) {
      if (successEl) successEl.classList.remove('hide');
      form.reset();
    } else {
      const txt = await res.text();
      alert('Submission failed. Please try again.\n\n' + txt);
    }
  } catch (err) {
    alert('Network error. Please check your connection and try again.');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    form.removeAttribute('aria-busy');
  }
}

if (form) form.addEventListener('submit', submitForm);

const privacy = document.getElementById('privacy');
if (privacy) privacy.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Privacy Notice: We only use your info to reach you about Hooked? updates. No third-party sharing.');
});

/* ========= Fast PDF slide deck (PDF.js) ========= */
document.addEventListener('DOMContentLoaded', () => {
  const decks = document.querySelectorAll('.pdf-deck.fast');
  if (!decks.length || !window.pdfjsLib) return;

  decks.forEach(async (deck) => {
    const src = deck.getAttribute('data-src');
    const canvas = deck.querySelector('.pdf-canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    const prevBtn = deck.querySelector('.prev');
    const nextBtn = deck.querySelector('.next');
    const status  = deck.querySelector('.deck-status');
    const loading = deck.querySelector('.deck-loading');

    if (!src || !canvas) return;

    // State
    let pdf = null;
    let page = Math.max(1, parseInt(deck.getAttribute('data-initial') || '1', 10));
    let total = 1;
    let rendering = false;
    const cache = new Map(); // page -> ImageBitmap

    const showLoading = (on) => loading && loading.classList.toggle('show', !!on);

    // Load once
    try {
      showLoading(true);
      pdf = await pdfjsLib.getDocument(src).promise;
      total = pdf.numPages;
      page = Math.min(page, total);
    } catch (e) {
      showLoading(false);
      status.textContent = 'Error loading PDF';
      console.error(e);
      return;
    }

    function updateControls() {
      status.textContent = `${page} / ${total}`;
      prevBtn.hidden = (page === 1);
      nextBtn.hidden = (page === total);
    }

    async function renderPage(p) {
      if (rendering) return;
      rendering = true;
      showLoading(true);

      const wrap = canvas.parentElement; 
      const wrapWidth = wrap.clientWidth;
      const wrapHeight = wrap.clientHeight;

      const pdfPage = await pdf.getPage(p);
      const unscaledViewport = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(wrapWidth / unscaledViewport.width, wrapHeight / unscaledViewport.height);

      const viewport = pdfPage.getViewport({ scale });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      let bmp = cache.get(`${p}@${canvas.width}x${canvas.height}`);
      if (!bmp) {
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = canvas.height;
        const tmpCtx = tmp.getContext('2d', { alpha:false });

        await pdfPage.render({ canvasContext: tmpCtx, viewport }).promise;
        bmp = await createImageBitmap(tmp);
        cache.clear(); 
        cache.set(`${p}@${canvas.width}x${canvas.height}`, bmp);
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0);
      rendering = false;
      showLoading(false);
    }

    async function preRenderNeighbor(dir) {
      const target = page + dir;
      if (target < 1 || target > total) return;
      const wrap = canvas.parentElement;
      const wrapWidth = wrap.clientWidth;
      const wrapHeight = wrap.clientHeight;

      const pdfPage = await pdf.getPage(target);
      const unscaledViewport = pdfPage.getViewport({ scale: 1 });
      const scale = Math.min(wrapWidth / unscaledViewport.width, wrapHeight / unscaledViewport.height);
      const viewport = pdfPage.getViewport({ scale });

      const key = `${target}@${Math.floor(viewport.width)}x${Math.floor(viewport.height)}`;
      if (cache.has(key)) return;

      const tmp = document.createElement('canvas');
      tmp.width = Math.floor(viewport.width);
      tmp.height = Math.floor(viewport.height);
      const tmpCtx = tmp.getContext('2d', { alpha:false });
      await pdfPage.render({ canvasContext: tmpCtx, viewport }).promise;
      const bmp = await createImageBitmap(tmp);
      cache.set(key, bmp);
    }

    async function go(delta) {
      const next = page + delta;
      if (next < 1 || next > total) return;
      page = next;
      updateControls();
      await renderPage(page);
      preRenderNeighbor(delta); 
    }

    prevBtn.addEventListener('click', () => go(-1));
    nextBtn.addEventListener('click', () => go(1));
    deck.tabIndex = 0;
    deck.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    });

    updateControls();
    await renderPage(page);
    preRenderNeighbor(1);

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => renderPage(page), 120);
    });
  });
});


