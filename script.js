/* ==========================================================================
   FIXORA — script.js (Step 3 of 3)
   Works with index.html + styles.css. Plain JavaScript, no libraries.
   Sections: 0 Settings · 1 Helpers · 2 Mobile menu · 3 Nav highlight ·
             4 Modals · 5 Forms + sign-in flow (credentials -> role -> password check -> dashboard) ·
             6 Search & filters · 7 Small extras (includes the logo fallback)
   Everything sits inside one function so nothing leaks into the global scope.
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 0. SETTINGS — flip useServer to true once your PHP endpoints exist ---------- */
  const CONFIG = {
    useServer: false,                                            // false = pretend the server replied (prototype)
    endpoints: { login: 'php/login.php', register: 'php/register.php', confirm: 'php/confirm.php' },
    sessionKey: 'fixora.session',                                // what the dashboards read: { name, email, role, signedInAt } (never the password)
    dashboardsReady: { client: true, professional: true, store: true }   // flip each to true once its dashboard page exists
  };

  /* ---------- 1. HELPERS ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const scrollBehavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const ERROR_RED = '#ff6b6b';

  /* ---------- 2. MOBILE MENU (styles.css shows it when .primary-nav has .is-open) ---------- */
  const nav = $('#primary-nav');
  const toggle = $('.nav-toggle');

  function setMenu(open) {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    $('use', toggle).setAttribute('href', open ? '#i-close' : '#i-menu');   // hamburger <-> close icon
  }
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });        // choosing a link closes it
  document.addEventListener('click', e => { if (!e.target.closest('.site-header')) setMenu(false); });   // so does tapping outside
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });
  matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

  /* ---------- 3. NAV HIGHLIGHT — follows the link you used, Home at the top, Contact at the bottom ---------- */
  const navLinks = $$('.nav-links a');
  let manualUntil = 0;                                           // pause scroll-tracking while a smooth scroll runs

  function setActive(hash) {
    navLinks.forEach(a => {
      const on = a.hash === hash;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  navLinks.forEach(a => a.addEventListener('click', () => {
    setActive(a.hash);
    manualUntil = Date.now() + 1000;
    const target = $(a.hash);
    if (target && target.style.display === 'none') resetSearch();   // a filter is hiding the panel we are heading to
  }));
  window.addEventListener('scroll', () => {
    if (Date.now() < manualUntil) return;
    const atBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
    if (scrollY < 80) setActive('#top'); else if (atBottom) setActive('#contact');
  }, { passive: true });
  if (location.hash) setActive(location.hash);

  /* ---------- 4. MODALS — native <dialog>: Esc key and focus trapping come free ---------- */
  function unlockPage() {
    if ($('dialog[open]')) return;                               // another modal is still open (e.g. switching)
    document.documentElement.style.overflow = '';
    document.documentElement.style.paddingRight = '';
  }
  function openModal(name) {
    const dlg = $('#modal-' + name);
    if (!dlg) return;
    setMenu(false);
    const scrollbar = innerWidth - document.documentElement.clientWidth;   // stop the page jumping sideways
    document.documentElement.style.overflow = 'hidden';                    // lock background scrolling
    if (scrollbar > 0) document.documentElement.style.paddingRight = scrollbar + 'px';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    $('input, select', dlg)?.focus();                                      // start typing straight away
  }
  function closeModal(dlg) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }

  document.addEventListener('click', e => {                     // one listener handles every modal control
    const opener = e.target.closest('[data-modal-open]');
    if (opener) return openModal(opener.dataset.modalOpen);
    const swap = e.target.closest('[data-modal-switch]');
    if (swap) { e.preventDefault(); closeModal(swap.closest('dialog')); return openModal(swap.dataset.modalSwitch); }
    const closer = e.target.closest('[data-modal-close]');
    if (closer) return closeModal(closer.closest('dialog'));
    // (the access pop-up ignores backdrop clicks: closing it would throw the sign-in away)
    if (e.target.matches('dialog.modal') && e.target.id !== 'modal-access') {                     // a click on the dark backdrop closes the modal
      const r = e.target.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal(e.target);
    }
    if (e.target.closest('a[href="#"]')) e.preventDefault();    // placeholder links (legal pages not built yet)
  });

  /* ---------- 5. FORMS — client-side checks for a good experience; PHP must re-check everything ---------- */
  function setPasswordVisible(btn, show) {
    $('input', btn.closest('.field')).type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.setAttribute('aria-pressed', String(show));
    btn.style.color = show ? 'var(--orange)' : '';               // orange eye = password is visible
  }
  $$('[data-toggle-password]').forEach(btn =>
    btn.addEventListener('click', () => setPasswordVisible(btn, btn.getAttribute('aria-pressed') !== 'true')));

  function say(form, text, ok = false) {                        // message line under the submit button
    const line = $('.form-status', form);
    line.textContent = text;
    line.style.color = ok ? '' : ERROR_RED;
  }
  function clearState(form) {
    say(form, '', true);
    $$('input, select', form).forEach(el => {
      el.setCustomValidity('');
      el.removeAttribute('aria-invalid');
      const box = el.closest('.field'); if (box) box.style.boxShadow = '';
    });
  }

  // Live checks on the Register form
  const pw = $('#reg-password'), confirm = $('#reg-confirm'), phone = $('#reg-phone');
  const checkMatch = () => confirm.setCustomValidity(confirm.value && pw.value !== confirm.value ? 'Passwords do not match.' : '');
  const checkPhone = () => {
    const digits = phone.value.replace(/\D/g, '').length;
    phone.setCustomValidity(phone.value && (digits < 9 || digits > 13) ? 'Enter a valid phone number.' : '');
  };
  pw.addEventListener('input', checkMatch);
  confirm.addEventListener('input', checkMatch);
  phone.addEventListener('input', checkPhone);

  async function sendAuth(form, kind) {
    if (!CONFIG.useServer) {                                    // prototype mode
      await new Promise(done => setTimeout(done, 700));
      return { ok: true, message: (kind === 'login' ? 'Welcome back!' : 'Account created!') + ' (prototype mode: no server connected yet)' };
    }
    const res = await fetch(CONFIG.endpoints[kind], { method: 'POST', body: new FormData(form) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message || (res.ok ? 'Success.' : 'Something went wrong. Please try again.') };
  }

  function firstProblem(form) {                                  // highlight every invalid field, hand back the first one
    const invalid = $$('input, select', form).filter(el => !el.checkValidity());
    invalid.forEach(el => {
      el.setAttribute('aria-invalid', 'true');
      const box = el.closest('.field'); if (box) box.style.boxShadow = `inset 0 0 0 1px ${ERROR_RED}`;
    });
    return invalid[0] || null;
  }
  function busy(form, on) {                                      // stop double-clicks while waiting
    const btn = $('[type="submit"]', form);
    btn.disabled = on; btn.style.opacity = on ? '.6' : '';
  }
  $$('.auth-form').forEach(form => form.addEventListener('input', e => {   // typing removes the red highlight
    e.target.removeAttribute('aria-invalid');
    const box = e.target.closest('.field'); if (box) box.style.boxShadow = '';
  }));

  /* Step 1 of the flow: Login / Register credentials. Accepted -> swap straight to the access pop-up. */
  let pending = null;                                            // { name, email, password } kept in memory only, never saved anywhere
  ['login-form', 'register-form'].forEach(id => {
    const form = $('#' + id);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const bad = firstProblem(form);
      if (bad) { say(form, bad.validationMessage || 'Please complete the highlighted fields.'); bad.focus(); return; }
      busy(form, true); say(form, 'Please wait…', true);
      try {
        const result = await sendAuth(form, id === 'login-form' ? 'login' : 'register');
        if (!result.ok) { say(form, result.message); return; }
        const data = new FormData(form);                         // grab the values BEFORE closing, because closing resets the form
        pending = { name: data.get('name') || '', email: data.get('email'), password: data.get('password') };
        closeModal(form.closest('dialog'));
        openAccess();
      } catch {
        say(form, 'Network problem. Please try again.');
      } finally {
        busy(form, false);
      }
    });
  });

  /* Steps 2 and 3: choose a role, then re-enter the password. Both stages live in #modal-access. */
  const access = $('#modal-access');
  const stages = $$('.stage', access);
  const confirmForm = $('#confirm-form');
  const confirmField = $('#confirm-password');
  let chosen = null;                                             // { role, dashboard, label, icon, card }

  function showStage(name, { focus = true } = {}) {
    stages.forEach(s => { s.hidden = s.dataset.stage !== name; });
    access.setAttribute('aria-labelledby', $('.stage:not([hidden]) h2', access).id);   // screen readers announce the stage
    if (!focus) return;
    if (name === 'role') (chosen?.card || $('.role-card', access)).focus(); else confirmField.focus();
  }
  function openAccess() { openModal('access'); showStage('role'); }

  $$('.role-card', access).forEach(card => card.addEventListener('click', () => {
    chosen = { role: card.dataset.role, dashboard: card.dataset.dashboard, label: $('.role-name', card).textContent,
               icon: $('use', card).getAttribute('href'), card };
    $('[data-role-label]', access).textContent = chosen.label;                 // the chip above the heading
    $('[data-role-icon]', access).setAttribute('href', chosen.icon);
    $('.modal-sub', confirmForm.closest('.stage')).textContent = `Enter your password again to open your ${chosen.label} dashboard`;
    showStage('confirm');
  }));
  $('[data-stage-back]', access).addEventListener('click', e => {
    e.preventDefault();
    confirmForm.reset(); clearState(confirmForm);
    showStage('role');
  });

  async function verifyPassword(typed) {
    if (!CONFIG.useServer) {                                     // prototype: compare with what was typed a moment ago
      await new Promise(done => setTimeout(done, 500));
      return typed === pending?.password ? { ok: true } : { ok: false, message: 'That password does not match. Please try again.' };
    }
    const body = new FormData(confirmForm); body.append('role', chosen.role);   // real mode: PHP checks the password (and should limit attempts)
    const res = await fetch(CONFIG.endpoints.confirm, { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, message: data.message || 'Verification failed. Please try again.' };
  }

  confirmForm.addEventListener('submit', async e => {
    e.preventDefault();
    const bad = firstProblem(confirmForm);
    if (bad) { say(confirmForm, 'Please enter your password.'); bad.focus(); return; }
    let leaving = false;
    busy(confirmForm, true); say(confirmForm, 'Verifying…', true);
    try {
      const result = await verifyPassword(confirmField.value);
      if (!result.ok) {                                          // wrong password: stay here and let them retry
        confirmField.setAttribute('aria-invalid', 'true');
        confirmField.closest('.field').style.boxShadow = `inset 0 0 0 1px ${ERROR_RED}`;
        say(confirmForm, result.message); confirmField.select(); return;
      }
      sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify({ name: pending.name, email: pending.email, role: chosen.role, signedInAt: Date.now() }));
      if (CONFIG.dashboardsReady[chosen.role]) {
        leaving = true;
        say(confirmForm, `Verified. Opening your ${chosen.label} dashboard…`, true);
        setTimeout(() => { location.href = chosen.dashboard; }, 500);
      } else {                                                   // page not built yet: say so instead of landing on a browser error
        say(confirmForm, `Verified as ${chosen.label}. ${chosen.dashboard} is not built yet. Set it to true in CONFIG.dashboardsReady when it exists.`, true);
      }
    } catch {
      say(confirmForm, 'Network problem. Please try again.');
    } finally {
      if (!leaving) busy(confirmForm, false);
    }
  });

  $$('dialog.modal').forEach(dlg => dlg.addEventListener('close', () => {   // tidy up whenever a modal closes
    const form = $('form', dlg);
    form.reset(); clearState(form);
    $$('[data-toggle-password]', dlg).forEach(btn => setPasswordVisible(btn, false));
    if (dlg === access) { pending = null; chosen = null; showStage('role', { focus: false }); }   // a closed sign-in starts over
    unlockPage();
  }));

  /* ---------- 6. SEARCH & CATEGORY FILTERS — filters the job / professional / hardware rows on the page ---------- */
  const searchForm = $('#search-form'), queryInput = $('#search-q'), categorySelect = $('#search-cat');
  const CATEGORY_MATCH = {                                      // how each category recognises rows (matched on the row's text)
    Builders: /\bbuilder\b|construction|renovation/, Electricians: /electric/, Plumbers: /plumb/, Painters: /paint/,
    Architects: /architect/, Carpenters: /carpent|timber|wood/, Roofing: /roof|iron sheet/
  };

  // "3 results…" line with a Clear button, created on first use and placed above the panels
  const results = document.createElement('div');
  results.className = 'container form-status';
  results.setAttribute('role', 'status');
  Object.assign(results.style, { display: 'none', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', fontSize: '1rem' });
  const resultsText = document.createElement('span');
  const clearBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn-ghost', textContent: 'Clear search' });
  Object.assign(clearBtn.style, { minHeight: '38px', padding: '.4rem 1rem' });
  results.append(resultsText, clearBtn);
  $('.panels').before(results);

  function rowMatches(row, term, category) {
    const text = row.textContent.toLowerCase();
    if (term && !text.includes(term)) return false;
    if (!category) return true;
    if (category === 'Hardware Stores') return Boolean(row.closest('#hardware'));
    return CATEGORY_MATCH[category].test(text);
  }

  function runSearch({ scroll = true } = {}) {
    const term = queryInput.value.trim().toLowerCase();
    const category = categorySelect.value;
    const active = Boolean(term || category);
    let total = 0;
    $$('.panel').forEach(panel => {
      let shown = 0;
      $$('.row', panel).forEach(row => {
        const ok = rowMatches(row, term, category);
        row.style.display = ok ? '' : 'none';                   // inline style: [hidden] would lose to .row{display:grid}
        if (ok) shown++;
      });
      panel.style.display = shown || !active ? '' : 'none';     // hide panels with nothing to show
      total += shown;
    });
    results.style.display = active ? 'flex' : 'none';
    const what = [term && `for “${queryInput.value.trim()}”`, category && `in ${category}`].filter(Boolean).join(' ');
    resultsText.textContent = total
      ? `${total} result${total === 1 ? '' : 's'} ${what}`
      : `No results ${what}. Try another keyword or category.`;
    if (active && scroll) results.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
  }
  function resetSearch() {
    queryInput.value = ''; categorySelect.value = '';
    runSearch({ scroll: false });
  }

  searchForm.addEventListener('submit', e => { e.preventDefault(); runSearch(); });
  queryInput.addEventListener('search', () => { if (!queryInput.value) runSearch({ scroll: false }); });   // the little × in the field
  clearBtn.addEventListener('click', resetSearch);
  $$('.cat-card').forEach(card => card.addEventListener('click', e => {      // category tile = one-click filter
    e.preventDefault();
    queryInput.value = '';
    categorySelect.value = card.dataset.category;
    runSearch();
  }));

  /* ---------- 7. SMALL EXTRAS ---------- */
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });      // footer © year
  $('[data-back-to-top]').addEventListener('click', e => {
    e.preventDefault();
    manualUntil = Date.now() + 1000;
    setActive('#top');
    scrollTo({ top: 0, behavior: scrollBehavior });
  });

  // Logo: the HTML points at images/fixora-logo.svg. If that file is missing try the .png twin, then show the dashed placeholder box.
  $$('img.logo-img').forEach(img => {
    const svg = img.getAttribute('src'), png = svg.replace(/\.svg$/i, '.png');
    let triedPng = false;
    img.addEventListener('error', () => {
      if (!triedPng && png !== svg) { triedPng = true; img.src = png; return; }
      const slot = document.createElement('span');
      slot.className = 'logo-slot'; slot.setAttribute('aria-hidden', 'true');
      img.replaceWith(slot);
    });
    img.src = svg;                                               // restart the load now the listener exists, so an early failure is not missed
  });
})();