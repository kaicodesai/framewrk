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
    var toggleHeaderState = function () { header.classList.toggle("scrolled", window.scrollY > 12); };
    toggleHeaderState();
    window.addEventListener("scroll", toggleHeaderState, { passive: true });
  }

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(pointer: fine)").matches;

  // ---- Scroll-reveal ----
  var revealEls = document.querySelectorAll("[data-reveal]");
  if (revealEls.length) {
    if (reduceMotion || !("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
      revealEls.forEach(function (el) { revealObserver.observe(el); });
    }
  }

  if (reduceMotion) return;

  // ---- Scroll-driven depth parallax ----
  // Each [data-parallax] layer drifts vertically at its own speed and pulses
  // scale slightly as it nears/leaves the viewport center, so distinct
  // layers (background/midground/foreground) read as physically separated.
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-parallax]"));
  var viewportH = window.innerHeight;
  var scrollTicking = false;

  var updateParallax = function () {
    scrollTicking = false;
    parallaxEls.forEach(function (el) {
      var speed = parseFloat(el.getAttribute("data-parallax")) || 0;
      var rect = el.getBoundingClientRect();
      var centerOffset = rect.top + rect.height / 2 - viewportH / 2;
      var shift = centerOffset * speed * -1;
      el.style.setProperty("--scroll-shift", shift.toFixed(1) + "px");

      if (el.hasAttribute("data-depth")) {
        var progress = 1 - Math.min(1, Math.abs(centerOffset) / (viewportH * 0.9));
        var scale = 0.94 + progress * 0.06;
        el.style.setProperty("--scroll-scale", scale.toFixed(3));
      }
    });
  };

  var onScroll = function () {
    if (!scrollTicking) { window.requestAnimationFrame(updateParallax); scrollTicking = true; }
  };
  if (parallaxEls.length) {
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { viewportH = window.innerHeight; onScroll(); });
    updateParallax();
  }

  // ---- Cursor-driven 3D tilt ----
  // Each [data-tilt] panel rotates toward the cursor's position relative to
  // its own center (small range, eased/damped toward the target each frame
  // rather than snapping) so panels feel like they occupy real depth.
  if (finePointer) {
    var tiltEls = Array.prototype.slice.call(document.querySelectorAll("[data-tilt]"));
    var tiltState = tiltEls.map(function (el) {
      return { el: el, curX: 0, curY: 0, targetX: 0, targetY: 0 };
    });
    var maxDeg = 6;
    var pointerX = null;
    var pointerY = null;

    window.addEventListener("mousemove", function (e) {
      pointerX = e.clientX;
      pointerY = e.clientY;
    }, { passive: true });

    var tiltFrame = function () {
      if (pointerX !== null) {
        tiltState.forEach(function (state) {
          var rect = state.el.getBoundingClientRect();
          if (rect.width === 0 || rect.bottom < -200 || rect.top > viewportH + 200) return;
          var cx = rect.left + rect.width / 2;
          var cy = rect.top + rect.height / 2;
          var dx = (pointerX - cx) / (rect.width / 2);
          var dy = (pointerY - cy) / (rect.height / 2);
          dx = Math.max(-1, Math.min(1, dx));
          dy = Math.max(-1, Math.min(1, dy));
          state.targetY = dx * maxDeg;
          state.targetX = dy * -maxDeg;
        });
      }
      tiltState.forEach(function (state) {
        state.curX += (state.targetX - state.curX) * 0.08;
        state.curY += (state.targetY - state.curY) * 0.08;
        if (Math.abs(state.curX) < 0.01 && Math.abs(state.curY) < 0.01 && pointerX === null) return;
        state.el.style.transform =
          "perspective(1600px) rotateX(" + state.curX.toFixed(2) + "deg) rotateY(" + state.curY.toFixed(2) + "deg) translateZ(10px)";
      });
      window.requestAnimationFrame(tiltFrame);
    };
    window.requestAnimationFrame(tiltFrame);
  }
})();
