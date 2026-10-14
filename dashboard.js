/* ==========================================================================
   FIXORA — dashboard.js (Step 5 of 8)
   Shared by the Client, Professional and Hardware Store dashboards.
   Load it at the END of <body> on every dashboard page:  <script src="dashboard.js"></script>
   Plain JavaScript, no libraries. Sections:
     0 Settings · 1 Sign-in guard · 2 Who is signed in · 3 Mobile drawer ·
     4 Sections (nav -> views) · 5 Log out · 6 Small widgets (chips, chat, toasts) · 7 Logo fallback

   MARKUP IT EXPECTS (the full contract is at the top of dashboard.css):
     <body class="dash" data-role="client | professional | store">
     <aside class="dash-sidebar" id="dash-sidebar"> … <a class="dash-link" href="#my-jobs" data-view="my-jobs">…</a>
     <button class="dash-toggle" aria-controls="dash-sidebar"> · <div class="dash-scrim"> · <h1 class="dash-title">
     <section class="view" id="view-my-jobs" hidden> …     (link data-view="x"  <->  section id="view-x")
   OPTIONAL HOOKS:
     [data-user-name] [data-user-first] [data-user-email] [data-user-initials]   filled with the signed-in person
     [data-logout]                       ends the session           [data-goto="view-name"]   jumps to a section
     [data-toast="message"]              shows a small message      form[data-save="message"] shows it on submit
     .chips[data-filter-for="#table-id"] > .chip[data-filter="open"]   filters rows marked data-status="open"
     form.chat-compose                   adds your message to .chat-log
     input[data-user-input="name" | "email"]   starts with the signed-in person's details (Profile Settings)
   ========================================================================== */
(() => {
  'use strict';

  /* ---------- 0. SETTINGS ---------- */
  const CONFIG = {
    signInPage: 'index.html',
    sessionKey: 'fixora.session',      // written by script.js after the password check: { name, email, role, signedInAt }
    guard: true,                       // false = never send anyone away (handy while you are only styling pages)
    previewParam: 'preview'            // open any dashboard as  dashboard-client.html?preview  to view it without signing in
  };
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  /* ---------- 1. SIGN-IN GUARD ----------
     This only protects the prototype's pages. Real protection must be a PHP session check on the server,
     and the ?preview shortcut should be removed before the site goes live. */
  const role = document.body.dataset.role;
  const open = new URLSearchParams(location.search).has(CONFIG.previewParam) || !CONFIG.guard;   // true = do not enforce sign-in
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(CONFIG.sessionKey)); } catch { /* unreadable storage: treat as signed out */ }
  if (!session && open) session = { name: 'Demo User', email: 'demo@fixora.co.za', role };
  if (!open && (!session || session.role !== role)) {          // nobody signed in, or signed in as a different role
    location.replace(CONFIG.signInPage);                       // replace() so the Back button cannot bounce straight back here
    return;                                                    // stop: nothing below should run for someone being sent away
  }

  /* ---------- 2. WHO IS SIGNED IN ---------- */
  const email = session.email || '';
  const name = (session.name || '').trim() || prettify(email.split('@')[0]) || 'Member';   // Login has no name field, so fall back to the email
  function prettify(local) {                                   // "sipho.dlamini" -> "Sipho Dlamini"
    return local.split(/[._\-\s]+/).filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  const fill = (sel, text) => $$(sel).forEach(el => { el.textContent = text; });
  fill('[data-user-name]', name);
  fill('[data-user-first]', name.split(/\s+/)[0]);
  fill('[data-user-email]', email);
  fill('[data-user-initials]', name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase());
  $$('[data-user-input="name"]').forEach(el => { el.value = name; });      // inputs on Profile Settings start with the signed-in details
  $$('[data-user-input="email"]').forEach(el => { el.value = email; });

  /* ---------- 3. MOBILE DRAWER (the sidebar slides in below 960px) ---------- */
  const sidebar = $('.dash-sidebar'), scrim = $('.dash-scrim'), toggle = $('.dash-toggle');
  const small = matchMedia('(max-width: 960px)');
  const drawerOpen = () => sidebar.classList.contains('is-open');
  function syncInert() { sidebar.inert = small.matches && !drawerOpen(); }   // off-screen links must not be reachable with Tab
  function setDrawer(on) {
    sidebar.classList.toggle('is-open', on);
    scrim.classList.toggle('is-on', on);
    toggle.setAttribute('aria-expanded', String(on));
    document.body.style.overflow = on ? 'hidden' : '';                       // no background scrolling while it is open
    syncInert();
  }
  toggle.addEventListener('click', () => { const on = !drawerOpen(); setDrawer(on); if (on) $('.dash-link', sidebar)?.focus(); });
  scrim.addEventListener('click', () => { setDrawer(false); toggle.focus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawerOpen()) { setDrawer(false); toggle.focus(); } });
  small.addEventListener('change', () => { if (!small.matches) setDrawer(false); else syncInert(); });
  syncInert();

  /* ---------- 4. SECTIONS: the nav links switch between the page's views, using the URL hash (#my-jobs) ---------- */
  const links = $$('.dash-link[data-view]');
  const views = $$('.view');
  const title = $('.dash-title');
  const labelOf = a => a.dataset.title || [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();   // text only, not the icon or count

  function showView(name, userAction = false) {
    const link = links.find(a => a.dataset.view === name) || links[0];   // unknown or empty hash -> first section
    if (!link) return;
    const id = 'view-' + link.dataset.view;
    views.forEach(v => { v.hidden = v.id !== id; });
    links.forEach(a => {
      a.classList.toggle('is-active', a === link);
      if (a === link) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (title) title.textContent = labelOf(link);
    document.title = `${labelOf(link)} | Fixora`;
    scrollTo({ top: 0 });
    const heading = $('h2', $('#' + id));
    if (userAction && heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }   // screen readers land on the new section
  }
  const hashName = () => decodeURIComponent(location.hash.slice(1));
  window.addEventListener('hashchange', () => showView(hashName(), true));   // also makes Back/Forward move between sections
  sidebar.addEventListener('click', e => { if (e.target.closest('.dash-link')) setDrawer(false); });
  document.addEventListener('click', e => {                                  // any [data-goto="x"] jumps to that section
    const go = e.target.closest('[data-goto]');
    if (go) { e.preventDefault(); location.hash = go.dataset.goto; }
  });
  showView(hashName());

  /* ---------- 5. LOG OUT ---------- */
  document.addEventListener('click', e => {
    if (!e.target.closest('[data-logout]')) return;
    sessionStorage.removeItem(CONFIG.sessionKey);
    location.href = CONFIG.signInPage;
  });

  /* ---------- 6. SMALL WIDGETS ---------- */
  // Toast: a small message that fades after a moment. The element exists from the start so screen readers announce changes.
  const toastEl = Object.assign(document.createElement('div'), { className: 'toast', hidden: true });
  toastEl.setAttribute('role', 'status');
  document.body.append(toastEl);
  let toastTimer;
  function toast(message) {
    toastEl.textContent = message; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2800);
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-toast]');
    if (t) { e.preventDefault(); toast(t.dataset.toast); }
  });
  $$('form[data-save]').forEach(form => form.addEventListener('submit', e => { e.preventDefault(); toast(form.dataset.save || 'Changes saved'); }));

  // Filter chips: mark one active, and show only the rows whose data-status matches (data-filter="all" shows everything)
  $$('.chips').forEach(group => group.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    $$('.chip', group).forEach(c => c.classList.toggle('is-active', c === chip));
    const target = group.dataset.filterFor && $(group.dataset.filterFor);
    if (!target) return;
    const want = chip.dataset.filter || 'all';
    let shown = 0;
    $$('[data-status]', target).forEach(row => {
      const ok = want === 'all' || row.dataset.status === want;
      row.hidden = !ok;
      if (ok) shown++;
    });
    const empty = $('[data-empty]', target.closest('.card') || target.parentElement);   // optional "nothing here" message
    if (empty) empty.hidden = shown > 0;
  }));

  // Messages: pick a conversation, send a message (shown on the right, as in a chat app)
  $$('.chat').forEach(chat => {
    const log = $('.chat-log', chat), form = $('.chat-compose', chat), items = $$('.chat-item', chat);
    items.forEach(item => item.addEventListener('click', () => items.forEach(i => i.classList.toggle('is-active', i === item))));
    if (!form || !log) return;
    form.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('input', form), text = input.value.trim();
      if (!text) return;
      const bubble = document.createElement('div');
      bubble.className = 'bubble me';
      bubble.append(text);                                     // append(text) inserts plain text, never HTML, so nothing typed can run as code
      const time = document.createElement('time');
      time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      bubble.append(time);
      log.append(bubble);
      input.value = '';
      log.scrollTop = log.scrollHeight;
    });
  });

  /* ---------- 7. LOGO FALLBACK ---------- */
  // The HTML points at images/fixora-logo.svg. If that file is missing try the .png twin, then show the dashed placeholder box.
  $$('img.logo-img').forEach(img => {
    const svg = img.getAttribute('src'), png = svg.replace(/\.svg$/i, '.png');
    let triedPng = false;
    img.addEventListener('error', () => {
      if (!triedPng && png !== svg) { triedPng = true; img.src = png; return; }
      const slot = document.createElement('span');
      slot.className = 'logo-slot'; slot.setAttribute('aria-hidden', 'true');
      img.replaceWith(slot);
    });
    img.src = svg;                                             // restart the load now the listener exists, so an early failure is not missed
  });
})();