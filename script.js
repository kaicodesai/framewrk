(function () {
  'use strict';

  /* --------------------------------------------------------------------
     Nav: solidify on scroll (rAF-throttled)
     -------------------------------------------------------------------- */
  var nav = document.getElementById('nav');
  var lastScrollState = null;
  var ticking = false;

  function updateNav() {
    var scrolled = window.scrollY > 40;
    if (scrolled !== lastScrollState) {
      nav.classList.toggle('scrolled', scrolled);
      lastScrollState = scrolled;
    }
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(updateNav);
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateNav();

  /* --------------------------------------------------------------------
     Mobile menu toggle
     -------------------------------------------------------------------- */
  var navToggle = document.getElementById('navToggle');
  var mobileMenu = document.getElementById('mobileMenu');

  function closeMenu() {
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    mobileMenu.classList.remove('open');
  }

  function toggleMenu() {
    var isOpen = navToggle.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu();
    } else {
      navToggle.setAttribute('aria-expanded', 'true');
      navToggle.setAttribute('aria-label', 'Close menu');
      mobileMenu.classList.add('open');
    }
  }

  navToggle.addEventListener('click', toggleMenu);

  mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  /* --------------------------------------------------------------------
     Scroll reveal via IntersectionObserver
     -------------------------------------------------------------------- */
  var revealEls = document.querySelectorAll('.reveal');

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry, i) {
          if (entry.isIntersecting) {
            var el = entry.target;
            var delay = (i % 6) * 80;
            setTimeout(function () {
              el.classList.add('is-visible');
            }, delay);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -60px 0px' }
    );

    revealEls.forEach(function (el) {
      observer.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }
})();
