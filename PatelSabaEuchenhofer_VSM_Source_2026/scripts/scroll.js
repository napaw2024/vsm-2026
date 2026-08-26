/* ==========================================================================
   scroll.js — scrollytelling controller (built up section by section).
   Current: smooth anchor scroll, §2 news entrance + drag-to-scroll.
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Smooth in-page anchor scrolling ----------------------------------- */
  document.addEventListener("click", function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;
    var id = link.getAttribute("href").slice(1);
    if (!id) return;
    var target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  });

  /* ---- §2 News: entrance (tiles slide in from the left) ------------------ */
  function initNewsEntrance() {
    var news = document.querySelector(".news");
    if (!news) return;
    if (!("IntersectionObserver" in window)) { news.classList.add("is-in"); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { news.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.25 });
    io.observe(news);
  }

  /* ---- §2 News: click-and-drag horizontal scroll ------------------------- */
  /* Vertical wheel is left untouched so the narrative can still advance;
     horizontal trackpad / shift+wheel work natively, and this adds mouse drag. */
  function initNewsDrag() {
    var row = document.querySelector(".news__row");
    if (!row) return;
    var down = false, startX = 0, startLeft = 0, moved = false;

    row.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch") return;      // native touch scroll handles this
      down = true; moved = false;
      startX = e.clientX; startLeft = row.scrollLeft;
      row.classList.add("is-grabbing");
    });
    row.addEventListener("pointermove", function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      row.scrollLeft = startLeft - dx;
    });
    function end() {
      down = false;
      row.classList.remove("is-grabbing");
    }
    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", end);
    row.addEventListener("pointerleave", end);
    /* prevent an accidental drag from triggering a click/anchor */
    row.addEventListener("click", function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);

    /* Wheel over the strip → horizontal scroll, passing through to the page
       at either end so the narrative can still advance. */
    row.addEventListener("wheel", function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;  // native horizontal input
      var max = row.scrollWidth - row.clientWidth;
      if (max <= 1) return;                                  // nothing to scroll here
      var atStart = row.scrollLeft <= 0;
      var atEnd = row.scrollLeft >= max - 1;
      if ((e.deltaY > 0 && atEnd) || (e.deltaY < 0 && atStart)) return;  // pass through
      e.preventDefault();
      row.scrollLeft += e.deltaY;
    }, { passive: false });
  }

  /* ---- Scroll scenes (§3, §4, …): pinned visual + travelling narrative ---- */
  /* White title/visual are pinned (sticky) and fade in on enter; each
     .narr-box travels vertically through the scene from its data-travel. */
  function initScrollScenes() {
    var updaters = [];
    document.querySelectorAll(".scroll-scene").forEach(function (scene) {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) scene.classList.add("is-in"); });
        }, { threshold: 0.12 });
        io.observe(scene);
      } else {
        scene.classList.add("is-in");
      }

      scene.querySelectorAll(".narr-box").forEach(function (box) {
        if (reduce) { box.style.setProperty("--narr-y", "0px"); return; }
        var travel = parseFloat(box.getAttribute("data-travel")) || 1520;
        updaters.push(function () {
          var vh = window.innerHeight;
          var total = scene.offsetHeight - vh;
          var scrolled = -scene.getBoundingClientRect().top;
          var p = Math.max(0, Math.min(1, total > 0 ? scrolled / total : 0));
          box.style.setProperty("--narr-y", ((0.5 - p) * travel).toFixed(1) + "px");
        });
      });
    });

    if (!updaters.length) return;
    var ticking = false;
    function run() { updaters.forEach(function (u) { u(); }); ticking = false; }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ---- Build scenes (§5, …): reveal elements one step at a time ---------- */
  /* Title fades in on enter; each [data-appear] element toggles .is-on when
     scroll progress passes its threshold (reversible on scroll up). */
  function initBuildScenes() {
    var updaters = [];
    document.querySelectorAll(".build-scene").forEach(function (scene) {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) scene.classList.add("is-in"); });
        }, { threshold: 0.05 });
        io.observe(scene);
      } else {
        scene.classList.add("is-in");
      }

      var items = Array.prototype.slice.call(scene.querySelectorAll("[data-appear]"));
      if (!items.length) return;
      if (reduce) { items.forEach(function (el) { el.classList.add("is-on"); }); return; }

      updaters.push(function () {
        var vh = window.innerHeight;
        var total = scene.offsetHeight - vh;
        var scrolled = -scene.getBoundingClientRect().top;
        var p = Math.max(0, Math.min(1, total > 0 ? scrolled / total : 0));
        items.forEach(function (el) {
          el.classList.toggle("is-on", p >= (parseFloat(el.getAttribute("data-appear")) || 0));
        });
      });
    });

    if (!updaters.length) return;
    var ticking = false;
    function run() { updaters.forEach(function (u) { u(); }); ticking = false; }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ---- Map scenes (§6, …): pinned title per sub-section; map/legend/box
     cross-fade per step; active box travels gently within its step. -------- */
  function initMapScenes() {
    var updaters = [];
    document.querySelectorAll(".map-scene").forEach(function (scene) {
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { if (en.isIntersecting) scene.classList.add("is-in"); });
        }, { threshold: 0.05 });
        io.observe(scene);
      } else {
        scene.classList.add("is-in");
      }

      var steps = parseInt(scene.getAttribute("data-steps"), 10) || 1;
      var stepEls = Array.prototype.slice.call(scene.querySelectorAll("[data-step]"));
      stepEls.forEach(function (el) {
        el._steps = el.getAttribute("data-step").split(",").map(function (s) { return parseInt(s, 10); });
      });
      // design-px the box travels fully (below → above) each step; per-scene override
      var TRAVEL = parseFloat(scene.getAttribute("data-box-travel")) || 1650;

      updaters.push(function () {
        var vh = window.innerHeight;
        var total = scene.offsetHeight - vh;
        var scrolled = -scene.getBoundingClientRect().top;
        var p = Math.max(0, Math.min(0.99999, total > 0 ? scrolled / total : 0));
        var active = Math.floor(p * steps);
        var within = (p * steps) - active;
        stepEls.forEach(function (el) {
          var on = el._steps.indexOf(active) >= 0;
          el.classList.toggle("is-active", on);
          if (el.classList.contains("s6-box") || el.classList.contains("s8-box")) {
            var y = on ? (reduce ? 0 : (0.5 - within) * TRAVEL) : 1100;
            el.style.setProperty("--box-y", y.toFixed(1) + "px");
          }
        });
      });
    });

    if (!updaters.length) return;
    var ticking = false;
    function run() { updaters.forEach(function (u) { u(); }); ticking = false; }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ---- Thermal scene (§8): one pinned stage runs BOTH phases so the map is
     continuous. Phase A (p < split) = the 6-step map/box/legend build (like a
     map-scene). Phase B (p ≥ split) = the same map 6 zooms in → holds on the
     hot spot → pans to the cold spot; the phase-A overlays fade out and the
     hot/cold callouts cross-fade in. No unpin/re-pin, so no map reset. ------- */
  function initThermalScene() {
    var scene = document.querySelector(".thermal-scene");
    if (!scene) return;

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { if (en.isIntersecting) scene.classList.add("is-in"); });
      }, { threshold: 0.03 });
      io.observe(scene);
    } else { scene.classList.add("is-in"); }

    function smooth(a, b, p) {                       // smoothstep 0→1 over [a,b]
      if (p <= a) return 0;
      if (p >= b) return 1;
      var t = (p - a) / (b - a);
      return t * t * (3 - 2 * t);
    }
    function easeOut(a, b, p) {                       // ease-out (decelerate) over [a,b]
      if (p <= a) return 0;
      if (p >= b) return 1;
      var t = (p - a) / (b - a);
      return 1 - (1 - t) * (1 - t);
    }
    function eo(t) {                                  // ease-out on a 0..1 value
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return 1 - (1 - t) * (1 - t);
    }
    function lerp(a, b, t) { return a + (b - a) * t; }

    var steps = parseInt(scene.getAttribute("data-steps"), 10) || 6;
    var splitAB = parseFloat(scene.getAttribute("data-split-ab")) || 0.461;   // A→B (steps→zoom)
    var splitBC = parseFloat(scene.getAttribute("data-split-bc")) || 0.671;   // B→C (zoom→numbers)
    var TRAVEL = parseFloat(scene.getAttribute("data-box-travel")) || 1650;
    var stepEls = Array.prototype.slice.call(scene.querySelectorAll("[data-step]"));
    stepEls.forEach(function (el) {
      el._steps = el.getAttribute("data-step").split(",").map(function (s) { return parseInt(s, 10); });
    });
    var beatEls = Array.prototype.slice.call(scene.querySelectorAll("[data-beat]"));
    var zmap = scene.querySelector("[data-pan-map]");
    var map3 = scene.querySelector(".s8-map--finale");
    var cTitle = scene.querySelector(".s8c-title");
    var cChart = scene.querySelector(".s8c-chart");
    var cBox1 = scene.querySelector(".s8c-box1");
    var cBox2 = scene.querySelector(".s8c-box2");
    function kf(n) {
      return { s: parseFloat(zmap.getAttribute("data-" + n + "-scale")),
               x: parseFloat(zmap.getAttribute("data-" + n + "-x")),
               y: parseFloat(zmap.getAttribute("data-" + n + "-y")) };
    }
    var K0 = kf("k0"), KA = kf("ka"), KB = kf("kb"), KC = kf("kc"), KD = kf("kd");

    function setStepsForZoom() {                       // map 6 only; boxes off; legend rows lit
      stepEls.forEach(function (el) {
        if (el.classList.contains("s8-map")) el.classList.toggle("is-active", el.getAttribute("data-step") === "5");
        else if (el.classList.contains("s8-legend-row")) el.classList.add("is-active");
        else el.classList.remove("is-active");
      });
    }
    function setOpacity(el, v) { if (el) el.style.opacity = v.toFixed(3); }
    function hidePhaseC() {
      setOpacity(map3, 0); setOpacity(cTitle, 0); setOpacity(cChart, 0);
      setOpacity(cBox1, 0); setOpacity(cBox2, 0);
    }

    function frame() {
      var vh = window.innerHeight;
      var total = scene.offsetHeight - vh;
      var scrolled = -scene.getBoundingClientRect().top;
      var p = Math.max(0, Math.min(0.999999, total > 0 ? scrolled / total : 0));

      if (p < splitAB) {
        /* PHASE A — 6-step build; map held at the full (K0) framing */
        scene.classList.remove("is-zoom");
        var sp = p / splitAB;
        var active = Math.min(steps - 1, Math.floor(sp * steps));
        var within = sp * steps - active;
        stepEls.forEach(function (el) {
          var on = el._steps.indexOf(active) >= 0;
          el.classList.toggle("is-active", on);
          if (el.classList.contains("s8-box")) {
            var y = on ? (reduce ? 0 : (0.5 - eo(within)) * TRAVEL) : 1100;
            el.style.setProperty("--box-y", y.toFixed(1) + "px");
          }
        });
        if (zmap) { zmap.style.transform = "translate(" + K0.x + "px," + K0.y + "px) scale(" + K0.s + ")"; zmap.style.opacity = ""; }
        beatEls.forEach(function (el) { el.style.opacity = "0"; });
        hidePhaseC();

      } else if (p < splitBC) {
        /* PHASE B — zoom/pan on map 6; hot/cold callouts cross-fade */
        scene.classList.add("is-zoom");
        setStepsForZoom();
        if (zmap) zmap.style.opacity = "";
        var zp = (p - splitAB) / (splitBC - splitAB);
        var s, x, y, oa, ob;
        if (reduce) {
          var K = zp < 0.5 ? KA : KB; s = K.s; x = K.x; y = K.y;
          oa = zp < 0.5 ? 1 : 0; ob = zp < 0.5 ? 0 : 1;
        } else {
          var t1 = easeOut(0.00, 0.22, zp);           // zoom in  K0 → KA (ease-out)
          var t2 = easeOut(0.46, 0.66, zp);           // pan      KA → KB (ease-out)
          s = lerp(lerp(K0.s, KA.s, t1), KB.s, t2);
          x = lerp(lerp(K0.x, KA.x, t1), KB.x, t2);
          y = lerp(lerp(K0.y, KA.y, t1), KB.y, t2);
          oa = smooth(0.16, 0.26, zp) * (1 - smooth(0.40, 0.47, zp));
          ob = smooth(0.66, 0.76, zp);
        }
        if (zmap) zmap.style.transform = "translate(" + x.toFixed(1) + "px," + y.toFixed(1) + "px) scale(" + s.toFixed(3) + ")";
        beatEls.forEach(function (el) {
          el.style.opacity = (el.getAttribute("data-beat") === "0" ? oa : ob).toFixed(3);
        });
        hidePhaseC();

      } else {
        /* PHASE C — Part 3: numbers (title + chart) → box 1 TRAVELS up and
           leaves → map 6 cross-fades to the blue-only map 3 → the WARNING
           travels in and settles. Boxes travel (like Part 1); motion eased-out. */
        scene.classList.add("is-zoom");
        setStepsForZoom();
        beatEls.forEach(function (el) { el.style.opacity = "0"; });
        var cC = (p - splitBC) / (1 - splitBC);

        var m1 = easeOut(0.00, 0.12, cC);             // KB → KC (zoom out to full, right)
        var m2 = easeOut(0.46, 0.62, cC);             // KC → KD (settle for the finale)
        var sc = lerp(lerp(KB.s, KC.s, m1), KD.s, m2);
        var xc = lerp(lerp(KB.x, KC.x, m1), KD.x, m2);
        var yc = lerp(lerp(KB.y, KC.y, m1), KD.y, m2);
        if (zmap) zmap.style.transform = "translate(" + xc.toFixed(1) + "px," + yc.toFixed(1) + "px) scale(" + sc.toFixed(3) + ")";

        /* map 6 → map 3 cross-fade, only AFTER box 1 has travelled off the top */
        var fo = reduce ? (cC < 0.55 ? 0 : 1) : smooth(0.46, 0.58, cC);
        if (zmap) zmap.style.opacity = (1 - fo).toFixed(3);
        setOpacity(map3, fo);

        setOpacity(cTitle, smooth(0.04, 0.14, cC) * (1 - smooth(0.46, 0.56, cC)));
        setOpacity(cChart, smooth(0.06, 0.16, cC) * (1 - smooth(0.44, 0.54, cC)));

        /* box 1 — full scroll-linked travel (rise → read → exit top), eased-out */
        var w1 = (cC - 0.14) / 0.28;
        setOpacity(cBox1, smooth(0.13, 0.17, cC) * (1 - smooth(0.40, 0.44, cC)));
        if (cBox1) cBox1.style.setProperty("--box-y", (reduce ? 0 : (0.5 - eo(w1)) * TRAVEL).toFixed(1) + "px");

        /* box 2 (WARNING) — travels in from below, eases into place, holds to the end */
        var w2 = (cC - 0.58) / 0.22;
        setOpacity(cBox2, smooth(0.58, 0.66, cC));
        if (cBox2) cBox2.style.setProperty("--box-y", (reduce ? 0 : 650 * (1 - eo(w2))).toFixed(1) + "px");
      }
    }

    var ticking = false;
    function run() { frame(); ticking = false; }
    window.addEventListener("scroll", function () {
      if (!ticking) { window.requestAnimationFrame(run); ticking = true; }
    }, { passive: true });
    window.addEventListener("resize", run);
    run();
  }

  /* ---- Data maps (§6+): <canvas data-var="…"> rendered from the 100m grid
     in assets/data/frankfurt-grid.json — one canvas pixel per data cell, so
     hover always reads the exact source value, no coordinate calibration. -- */
  function initDataMaps() {
    var canvases = Array.prototype.slice.call(document.querySelectorAll("canvas.s6-map[data-var]"));
    if (!canvases.length) return;

    /* colors sampled directly from the topic's own map-*.png pixels (not the
       legend swatches — those turned out to render a paler, different tint
       than the actual map fill). LST Day/Night are genuinely a 6-class
       choropleth (six flat colors, confirmed by sampling — these ARE the
       real colors); PET's map didn't show 6 clean classes on sampling, just
       a continuous-looking spread, so it stays a smooth ramp built from its
       real light→dark hues instead of guessing 6 discrete steps. */
    var CLASSES_BY_VAR = {
      /* [breakpoint, breakpoint, …] low→high, one fewer than colors.length */
      /* Frankfurt's own lst_day never goes below 24.1°C, so the legend's
         round-number breaks (14.5/19.5/…) left the two palest classes
         unused. These are quantile breaks fit to Frankfurt's actual
         distribution so all 6 colors appear in roughly the same proportion
         as the real map-lst-day.png (sampled directly from its pixels). */
      lst_day:   { breaks: [27.9, 30.2, 33.1, 36.5, 40],   colors: ["#d4b896", "#f4a261", "#f88a21", "#d15205", "#ac3d03", "#6b1f02"] },
      lst_night: { breaks: [13, 13.5, 14, 14.5, 15],        colors: ["#d4b896", "#f4a261", "#f88a21", "#d15205", "#ac3d03", "#6b1f02"] }
    };
    var RAMP_BY_VAR = {
      pet: ["#ffb496", "#ff9878", "#f47040", "#e04800"]
    };
    function hexToRgb(h) {
      h = h.replace("#", "");
      return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
    }
    function makeClassColor(spec) {
      var rgbs = spec.colors.map(hexToRgb);
      return function (v) {
        var i = 0;
        while (i < spec.breaks.length && v >= spec.breaks[i]) i++;
        return rgbs[i];
      };
    }
    function makeRampColor(hexStops) {
      var STOPS = hexStops.map(hexToRgb);
      return function (v, min, max) {
        var t = Math.max(0, Math.min(1, (v - min) / (max - min)));
        var n = STOPS.length - 1;
        var seg = t * n;
        var i = Math.min(n - 1, Math.floor(seg));
        var lt = seg - i;
        var a = STOPS[i], b = STOPS[i + 1];
        return [
          Math.round(a[0] + (b[0] - a[0]) * lt),
          Math.round(a[1] + (b[1] - a[1]) * lt),
          Math.round(a[2] + (b[2] - a[2]) * lt)
        ];
      };
    }

    var LABELS = { pet: "PET", lst_day: "LST Day", lst_night: "LST Night", tropical_nights: "Tropical nights" };
    var UNITS = { pet: "°C", lst_day: "°C", lst_night: "°C", tropical_nights: " nights/yr" };

    /* the Figma frame these maps sit in (confirmed by the user from the
       Figma inspector — same frame for all four §6 topic images):
       1129×964, image fill background-size 99.827% / 107.44%, position
       -9.022px 0. That's NOT the same aspect as the raw PNGs (1120×1080) —
       Figma stretches the fill anisotropically to the frame, which is what
       earlier read as a "rotation" mismatch against the untouched 4th map;
       it was an aspect distortion, not an angle. Match the frame directly
       instead of contain-fitting the raw PNG size (also drops the earlier
       true-north rotate() guess, which didn't fix it). */
    var FRAME_W = 1129, FRAME_H = 964;
    var FILL_SX = 0.99827, FILL_SY = 1.0744;
    var FILL_OX = -9.022, FILL_OY = 0;
    var SUPERSAMPLE = 4;    // draw each 100m cell as a 4×4 block so the canvas
                             // has real resolution to scale down from, instead
                             // of stretching a 1px-per-cell buffer up (soft edges).

    /* the untouched PNGs (map-pet-green.png etc.) aren't full-bleed inside
       their 1120×1080 file — the actual city shape only occupies a
       1100×936 region in the middle (measured directly off the pixels:
       x 8–1108, y 72–1008). Our grid has no such margin (it fills its
       source rectangle edge to edge), so even with an identical outer box
       the shape would render visibly bigger than the untouched map. Pad
       the canvas buffer by the same fraction so the *visible shape* ends
       up the same size, not just the bounding box. */
    var CONTENT_FRAC_X = 1100 / 1120, CONTENT_FRAC_Y = 936 / 1080;

    fetch("assets/data/frankfurt-grid.json").then(function (r) { return r.json(); }).then(function (data) {
      var rows = data.rows, cols = data.cols;

      var tip = document.createElement("div");
      tip.className = "grid-tip";
      document.body.appendChild(tip);

      canvases.forEach(function (canvas) {
        var key = canvas.getAttribute("data-var");
        var vals = data.variables[key];
        if (!vals) return;
        var present = vals.filter(function (v) { return v !== null; });
        var min = Math.min.apply(null, present), max = Math.max.apply(null, present);

        var buf = SUPERSAMPLE, gridCols = cols * buf, gridRows = rows * buf;
        var bufCols = Math.round(gridCols / CONTENT_FRAC_X);
        var bufRows = Math.round(gridRows / CONTENT_FRAC_Y);
        var padLeft = Math.round((bufCols - gridCols) / 2);
        var padTop = Math.round((bufRows - gridRows) / 2);
        canvas.width = bufCols;
        canvas.height = bufRows;

        /* size the canvas to the frame's fill dimensions directly, in the
           same "design px" space as the existing left/top (1090, 548) —
           the .stage ancestor's own responsive transform scales this
           along with everything else, same as it already does for the
           plain <img> siblings' max-width/max-height. No extra scale math
           needed. */
        var fillW = FRAME_W * FILL_SX, fillH = FRAME_H * FILL_SY;
        canvas.style.width = fillW + "px";
        canvas.style.height = fillH + "px";
        canvas.style.transform = "translate(-50%, -50%) translate(" + FILL_OX + "px, " + FILL_OY + "px)";

        var toRgb = CLASSES_BY_VAR[key] ? makeClassColor(CLASSES_BY_VAR[key])
          : makeRampColor(RAMP_BY_VAR[key] || RAMP_BY_VAR.pet);
        var ctx = canvas.getContext("2d");
        var img = ctx.createImageData(bufCols, bufRows);
        for (var i = 0; i < vals.length; i++) {
          var v = vals[i];
          if (v === null) continue;
          var rgb = CLASSES_BY_VAR[key] ? toRgb(v) : toRgb(v, min, max);
          var cellRow = Math.floor(i / cols), cellCol = i % cols;
          for (var dy = 0; dy < buf; dy++) {
            var o = ((padTop + cellRow * buf + dy) * bufCols + (padLeft + cellCol * buf)) * 4;
            for (var dx = 0; dx < buf; dx++) {
              img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255;
              o += 4;
            }
          }
        }
        ctx.putImageData(img, 0, 0);

        canvas.addEventListener("mousemove", function (e) {
          var rect = canvas.getBoundingClientRect();
          var x = (e.clientX - rect.left) / rect.width;
          var y = (e.clientY - rect.top) / rect.height;
          var col = Math.floor((x * bufCols - padLeft) / buf);
          var row = Math.floor((y * bufRows - padTop) / buf);
          if (col < 0 || col >= cols || row < 0 || row >= rows) { tip.classList.remove("is-visible"); return; }
          var idx = row * cols + col;
          var v = vals[idx];
          if (v === null || v === undefined) { tip.classList.remove("is-visible"); return; }
          tip.style.left = e.clientX + "px";
          tip.style.top = e.clientY + "px";
          tip.textContent = (LABELS[key] || key) + ": " + v + (UNITS[key] || "");
          tip.classList.add("is-visible");
        });
        canvas.addEventListener("mouseleave", function () { tip.classList.remove("is-visible"); });
      });
    }).catch(function (err) {
      /* The grid never loaded (offline, blocked, or the page was opened as a
         file:// URL where fetch() is CORS-blocked). Rather than leave three
         blank maps with no explanation, fall back to the static PNG exports —
         the section still reads correctly, only the hover read-out is lost. */
      console.error(
        "[§6] Could not load assets/data/frankfurt-grid.json — falling back to " +
        "static map PNGs. If you opened this file directly, serve it over http " +
        "instead (e.g. `python3 -m http.server 8125`).", err
      );
      var PNG = { lst_day: "map-lst-day.png", lst_night: "map-lst-night.png", pet: "map-pet.png" };
      canvases.forEach(function (canvas) {
        var file = PNG[canvas.getAttribute("data-var")];
        if (!file) return;
        canvas.style.width = (FRAME_W * FILL_SX) + "px";
        canvas.style.height = (FRAME_H * FILL_SY) + "px";
        canvas.style.transform = "translate(-50%, -50%) translate(" + FILL_OX + "px, " + FILL_OY + "px)";
        canvas.style.background = "url(assets/section-6/" + file + ") center / 100% 100% no-repeat";
        canvas.style.cursor = "default";
      });
    });
  }

  /* ---- Reveal scenes (§9): add .is-in once on enter; CSS handles the rest -- */
  function initRevealScenes() {
    var scenes = document.querySelectorAll(".reveal-scene");
    if (!scenes.length) return;
    if (!("IntersectionObserver" in window)) {
      scenes.forEach(function (s) { s.classList.add("is-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.35 });
    scenes.forEach(function (s) { io.observe(s); });
  }

  function boot() { initNewsEntrance(); initNewsDrag(); initScrollScenes(); initBuildScenes(); initMapScenes(); initDataMaps(); initThermalScene(); initRevealScenes(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
