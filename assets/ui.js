/* HaploReg v5 — info popovers, tooltips, theme and top bar, shared by the landing, Explore and Docs pages. */
(function (HR) {
  'use strict';

  var esc = HR.util.escape;
  var NEO = window.NEO = window.NEO || {};

  /* ------------------------------------------------------------ ⓘ buttons */

  NEO.info = function (termId) {
    var g = HR.GLOSSARY_BY_ID[termId];
    if (!g) return '';
    return '<button type="button" class="info" data-term="' + termId + '" aria-label="What is ' + esc(g.term) +
      '?" aria-expanded="false">i</button>';
  };

  var pop = null, popFor = null, pinned = false, hideTimer = null, showTimer = null;

  function ensurePop() {
    if (pop) return pop;
    pop = document.createElement('div');
    pop.className = 'popover';
    pop.setAttribute('role', 'tooltip');
    pop.hidden = true;
    pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
    pop.addEventListener('mouseleave', function () { if (!pinned) scheduleHide(); });
    document.body.appendChild(pop);
    return pop;
  }

  function show(btn) {
    var g = HR.GLOSSARY_BY_ID[btn.getAttribute('data-term')];
    if (!g) return;
    var p = ensurePop();
    if (popFor && popFor !== btn) popFor.setAttribute('aria-expanded', 'false');
    popFor = btn;
    btn.setAttribute('aria-expanded', 'true');
    p.innerHTML = '<h4>' + esc(g.term) + '</h4><p>' + esc(g.short) + '</p><a href="' + NEO.docsHref(g.id) + '">Full definition →</a>';
    p.hidden = false;
    var r = btn.getBoundingClientRect();
    var pw = p.offsetWidth, ph = p.offsetHeight;
    var left = Math.min(Math.max(8, r.left + r.width / 2 - pw / 2), window.innerWidth - pw - 8);
    var top = r.bottom + 8;
    if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 8);
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  }

  function hide() {
    if (!pop) return;
    pop.hidden = true;
    pinned = false;
    if (popFor) popFor.setAttribute('aria-expanded', 'false');
    popFor = null;
  }
  function scheduleHide() { clearTimeout(hideTimer); hideTimer = setTimeout(hide, 180); }

  // Pages set <body data-root="../"> (or "") so links resolve from any folder.
  NEO.root = function () { return document.body.getAttribute('data-root') || ''; };
  NEO.docsHref = function (id) {
    return (document.body.classList.contains('docs-page') ? '' : NEO.root() + 'docs/') + '#' + id;
  };

  document.addEventListener('mouseover', function (e) {
    var btn = e.target.closest && e.target.closest('.info');
    if (!btn || pinned) return;
    clearTimeout(hideTimer);
    clearTimeout(showTimer);
    showTimer = setTimeout(function () { show(btn); }, 120);
  });
  document.addEventListener('mouseout', function (e) {
    var btn = e.target.closest && e.target.closest('.info');
    if (!btn) return;
    clearTimeout(showTimer);
    if (!pinned) scheduleHide();
  });
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.info');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (pinned && popFor === btn) { hide(); return; }
      show(btn);
      pinned = true;
      return;
    }
    if (pop && !pop.hidden && !pop.contains(e.target)) hide();
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
  // A pinned popover follows its button while scrolling and closes once the button leaves the view.
  window.addEventListener('scroll', function () {
    if (!pop || pop.hidden) return;
    if (!pinned || !popFor) { hide(); return; }
    var r = popFor.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight || !popFor.isConnected) { hide(); return; }
    show(popFor);
  }, true);

  /* ------------------------------------------------------------ hover tooltips */

  var tip = null;
  NEO.tooltip = function (html, x, y) {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      document.body.appendChild(tip);
    }
    if (html == null) { tip.hidden = true; return; }
    tip.innerHTML = html;
    tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(x + 14, window.innerWidth - w - 8) + 'px';
    tip.style.top = (y + 16 + h > window.innerHeight ? y - h - 10 : y + 16) + 'px';
  };

  /* ------------------------------------------------------------ theme */

  function storedTheme() { try { return localStorage.getItem('hr5-theme'); } catch (e) { return null; } }
  function applyTheme(t) {
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
  }
  applyTheme(storedTheme());

  NEO.toggleTheme = function () {
    var cur = document.documentElement.getAttribute('data-theme') ||
      (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    var next = cur === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    try { localStorage.setItem('hr5-theme', next); } catch (e) { /* storage unavailable */ }
    document.dispatchEvent(new CustomEvent('hr5-theme', { detail: next }));
  };

  NEO.themeIcon = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.75a6.25 6.25 0 0 1 0 12.5z" fill="currentColor"/></svg>';

  /* ------------------------------------------------------------ top bar */

  document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = NEO.themeIcon;
      btn.addEventListener('click', NEO.toggleTheme);
    }
    var bar = document.querySelector('.topbar');
    if (bar) {
      var onScroll = function () { bar.classList.toggle('scrolled', window.scrollY > 4); };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
  });
})(window.HR);
