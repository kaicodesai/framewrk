(function () {
  "use strict";

  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var navToggle = document.getElementById("navToggle");
  var mainNav = document.getElementById("main-nav");

  if (navToggle && mainNav) {
    navToggle.addEventListener("click", function () {
      var isOpen = mainNav.classList.toggle("open");
      navToggle.classList.toggle("open", isOpen);
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });

    mainNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mainNav.classList.remove("open");
        navToggle.classList.remove("open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var header = document.querySelector(".site-header");
  if (header) {
    var toggleHeaderState = function () {
      header.classList.toggle("scrolled", window.scrollY > 12);
    };
    toggleHeaderState();
    window.addEventListener("scroll", toggleHeaderState, { passive: true });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scroll-reveal: fade/rise elements into place once, on entry.
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
      );
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  // Parallax drift: elements move at slightly different speeds on scroll,
  // each at its own data-parallax factor, so nothing moves in lockstep.
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  if (parallaxEls.length && !reduceMotion) {
    var ticking = false;
    var viewportH = window.innerHeight;

    var updateParallax = function () {
      ticking = false;
      parallaxEls.forEach(function (el) {
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        var rect = el.getBoundingClientRect();
        var centerOffset = rect.top + rect.height / 2 - viewportH / 2;
        var shift = centerOffset * speed * -1;
        el.style.transform = (el.dataset.baseTransform || "") + " translateY(" + shift.toFixed(1) + "px)";
      });
    };

    // preserve any static rotation classes already applied via CSS by reading
    // computed rotation once and folding it into the JS transform as a fallback-safe string
    parallaxEls.forEach(function (el) {
      if (el.classList.contains("card-rotate-l")) el.dataset.baseTransform = "rotate(-2deg)";
      if (el.classList.contains("card-rotate-r")) el.dataset.baseTransform = "rotate(1.5deg)";
    });

    var onScroll = function () {
      if (!ticking) {
        window.requestAnimationFrame(updateParallax);
        ticking = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () {
      viewportH = window.innerHeight;
      onScroll();
    });
    updateParallax();
  }
})();
