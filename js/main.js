(function () {
  'use strict';

  var header = document.getElementById('siteHeader');
  var nav = document.getElementById('mainNav');
  var navToggle = document.querySelector('.nav-toggle');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Sticky header background on scroll
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 24);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile nav toggle
  var navToggleIcon = navToggle && navToggle.querySelector('use');

  function setNavOpen(open) {
    nav.classList.toggle('is-open', open);
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
    if (navToggleIcon) navToggleIcon.setAttribute('href', open ? '#icon-close' : '#icon-menu');
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      setNavOpen(!nav.classList.contains('is-open'));
    });
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { setNavOpen(false); });
    });
  }

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    revealEls.forEach(function (el) { io.observe(el); });
  }

  // Newsletter (front-end only placeholder — wire up to a real provider later)
  var form = document.getElementById('newsletterForm');
  var note = document.getElementById('newsletterNote');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = document.getElementById('newsletterEmail');
      if (input && input.checkValidity()) {
        input.setAttribute('aria-invalid', 'false');
        note.textContent = 'Bedankt! Bevestig je aanmelding via de e-mail die we je sturen.';
        form.reset();
      } else {
        input.setAttribute('aria-invalid', 'true');
        note.textContent = 'Vul een geldig e-mailadres in.';
        input.focus();
      }
    });
  }

  // Cart count (placeholder — wire up to real cart state later)
  document.querySelectorAll('.btn-add').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var countEl = document.querySelector('.cart-count');
      var cartBtn = document.querySelector('.cart-btn');
      if (!countEl) return;
      var next = (parseInt(countEl.textContent, 10) || 0) + 1;
      countEl.textContent = String(next);
      cartBtn.setAttribute('aria-label', 'Winkelwagen, ' + next + ' items');
      var original = btn.textContent;
      btn.textContent = 'Toegevoegd';
      setTimeout(function () { btn.textContent = original; }, 1200);
    });
  });

  // Footer year
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
