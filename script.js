/* ========= Motion preference + smooth scroll ========= */
const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!prefersReduced) document.documentElement.style.scrollBehavior = 'smooth';

/* ========= Tabs: robust init + ARIA + deep linking ========= */
(() => {
  const tablist = document.querySelector('.tabs[role="tablist"]');
  if (!tablist) return;

  const tabs = Array.from(tablist.querySelectorAll('.tab[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('.panel[role="tabpanel"]'));
  if (!tabs.length || !panels.length) return;

  const panelById = new Map(panels.map(p => [p.id, p]));

  function ensureValidState() {
    // Pick the currently marked tab or default to the first.
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

    // Sync the hash so links are shareable (#features, etc.)
    if (updateHash) {
      const section = tab.id.replace('tab-', ''); // demo, features, founders, faq
      if (section) history.replaceState(null, '', `#${section}`);
    }
  }

  // Click to activate
  tablist.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab[role="tab"]');
    if (!btn) return;
    activateTab(btn, { focus: true, updateHash: true });
  });

  // Keyboard support
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

  // Deep link support (#features, #founders, #faq, #demo)
  function openFromHash() {
    const key = (location.hash || '#demo').slice(1).toLowerCase();
    const target = document.getElementById(`tab-${key}`);
    if (target) {
      activateTab(target, { focus: false, updateHash: false });
    } else {
      ensureValidState();
    }
  }

  // Initialize state and then apply hash (if any)
  ensureValidState();
  openFromHash();
  window.addEventListener('hashchange', openFromHash);
})();

/* ========= Anchor smooth scroll (non-tab anchors) ========= */
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;

  // Ignore tab buttons (we handle those above) and empty hashes
  const id = a.getAttribute('href').slice(1);
  if (!id) return;

  // If this anchor points to a tab section, let the tab handler deal with it via hashchange
  const maybeTab = document.getElementById(`tab-${id}`);
  if (maybeTab) return;

  const el = document.getElementById(id);
  if (!el) return;

  e.preventDefault();
  el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
});

/* ========= Dynamic year ========= */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ========= Waitlist Form (Formspree) ========= */
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

  // Honeypot: quietly drop if filled
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

/* ========= Privacy link placeholder ========= */
const privacy = document.getElementById('privacy');
if (privacy) privacy.addEventListener('click', (e) => {
  e.preventDefault();
  alert('Privacy Notice: We only use your info to reach you about Hooked? updates. No third-party sharing.');
});
