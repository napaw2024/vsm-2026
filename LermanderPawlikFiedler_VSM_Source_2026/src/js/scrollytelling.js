import scrollama from "../../vendor/scrollama/index.js";
import { stories } from "./content.js";
import { clamp, lerp } from "./utils.js";

let updatePseudorelief = () => {};
let activeStoryIndex = -1;
let storyAudioFadeFrame = null;
let storyAudioIsSuppressedForNavigation = false;

function isSoundEnabled() {
  return document.querySelector(".sound-control__button")?.classList.contains("is-enabled") ?? false;
}

function hasStoryAnimation(index) {
  const animation = stories[index]?.animation;
  return Boolean(
    animation?.src
    && Number.isFinite(animation.start)
    && Number.isFinite(animation.end)
    && animation.end > animation.start
  );
}

function hasStoryAudio(index) {
  const audio = stories[index]?.audio;
  return Boolean(
    audio?.src
    && Number.isFinite(audio.start)
    && Number.isFinite(audio.end)
    && audio.end > audio.start
    && (audio.loopStart == null || (Number.isFinite(audio.loopStart) && audio.loopStart >= audio.start && audio.loopStart < audio.end))
  );
}

function stopStoryAudio(audio) {
  audio.pause();
  audio.currentTime = 0;
  audio.volume = 1;
  delete audio.dataset.storyAudioPhase;
}

function cancelStoryAudioFade() {
  if (storyAudioFadeFrame != null) cancelAnimationFrame(storyAudioFadeFrame);
  storyAudioFadeFrame = null;
}

function fadeOutStoryAudio() {
  if (storyAudioFadeFrame != null) return;
  cancelStoryAudioFade();
  const activeAudio = document.querySelector(`[data-story-audio="${activeStoryIndex}"]`);
  if (!activeAudio || activeAudio.paused) return;
  const startedAt = performance.now();
  const duration = 450;
  const fade = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    activeAudio.volume = 1 - progress;
    if (progress < 1) {
      storyAudioFadeFrame = requestAnimationFrame(fade);
      return;
    }
    stopStoryAudio(activeAudio);
    activeStoryIndex = -1;
    storyAudioFadeFrame = null;
  };
  storyAudioFadeFrame = requestAnimationFrame(fade);
}

function playStoryAudio(audio, timing, { restart = true } = {}) {
  cancelStoryAudioFade();
  audio.volume = 1;
  if (!isSoundEnabled()) {
    audio.pause();
    return;
  }
  if (restart || !audio.dataset.storyAudioPhase) {
    audio.dataset.storyAudioPhase = "full";
    audio.currentTime = timing.start;
  }
  void audio.play().catch(() => void 0);
}

// Start the visual and sounds belonging to the story Scrollama has reached.
function activateStory(index, { restartAnimation = true } = {}) {
  const journey = document.querySelector(".story-chapter-section--journey");
  if (!journey || !Number.isFinite(index)) return;
  activeStoryIndex = index;
  journey.querySelectorAll("[data-story-media]").forEach((item) => {
    const isActive = Number(item.dataset.storyMedia) === index;
    item.classList.toggle("is-active", isActive);
    const audio = item.querySelector("audio[data-story-audio]");
    if (audio) {
      if (isActive && hasStoryAudio(index) && !storyAudioIsSuppressedForNavigation) {
        playStoryAudio(audio, stories[index].audio, { restart: restartAnimation });
      } else if (!isActive) {
        stopStoryAudio(audio);
      }
    }
  });
  const animationWindow = stories[index]?.animation;
  const sharedAnimation = journey.querySelector("[data-story-shared-animation]");
  const hasAnimation = Boolean(sharedAnimation && hasStoryAnimation(index));
  if (sharedAnimation) {
    if (hasAnimation) {
      sharedAnimation.muted = true;
      sharedAnimation.dataset.storyAnimationEnd = String(animationWindow.end);
      if (restartAnimation) sharedAnimation.currentTime = animationWindow.start;
      void sharedAnimation.play().catch(() => void 0);
    } else {
      sharedAnimation.pause();
      delete sharedAnimation.dataset.storyAnimationEnd;
    }
  }
  updateStories();
}

function syncStorySound({ enabled }) {
  if (activeStoryIndex >= 0) activateStory(activeStoryIndex, { restartAnimation: false });
  if (!enabled) document.querySelectorAll("audio[data-story-audio]").forEach((audio) => audio.pause());
}

function setupStoryAudio() {
  document.querySelectorAll("audio[data-story-audio]").forEach((audio) => {
    audio.addEventListener("timeupdate", () => {
      const index = Number(audio.dataset.storyAudio);
      const timing = stories[index]?.audio;
      if (!timing || activeStoryIndex !== index || !isSoundEnabled()) return;
      const loopStart = timing.loopStart ?? timing.start;
      if (audio.dataset.storyAudioPhase === "full" && audio.currentTime >= timing.end) {
        audio.dataset.storyAudioPhase = "loop";
        audio.currentTime = loopStart;
        void audio.play().catch(() => void 0);
      } else if (audio.dataset.storyAudioPhase === "loop" && audio.currentTime >= timing.end) {
        audio.currentTime = loopStart;
        void audio.play().catch(() => void 0);
      }
    });
  });
}

function setupSharedStoryAnimation() {
  const animation = document.querySelector("[data-story-shared-animation]");
  if (!animation) return;
  const journey = animation.closest(".story-chapter-section");
  if (journey) {
    const preloadObserver = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      animation.preload = "auto";
      animation.load();
      preloadObserver.disconnect();
    }, { rootMargin: "100% 0px" });
    preloadObserver.observe(journey);
  }
  animation.addEventListener("timeupdate", () => {
    const end = Number(animation.dataset.storyAnimationEnd);
    if (Number.isFinite(end) && animation.currentTime >= end) {
      animation.currentTime = end;
      animation.pause();
    }
  });
}

export function registerPseudoreliefUpdater(updater) {
  updatePseudorelief = updater;
}

let introUiHasRevealed = false;
// Reveal the side navigation and intro call-to-action once video/scroll permits it.
function revealIntroUi() {
  if (introUiHasRevealed) return;
  introUiHasRevealed = true;
  document.querySelector(".side-nav")?.classList.remove("side-nav--delayed");
  document.querySelector(".intro-section .scroll-arrow")?.classList.add("is-visible");
  document.querySelector(".intro-section__heading")?.classList.add("is-visible");
  const hint = document.querySelector(".sound-control__hint");
  hint?.classList.add("is-visible");
  window.setTimeout(() => hint?.classList.remove("is-visible"), 5e3);
}

// Watch visible sections and synchronize the theme plus active navigation.
export function observeSections(shell2) {
  const sections2 = document.querySelectorAll("[data-section]");
  const links = document.querySelectorAll("[data-section-link]");
  const activateSection = (section) => {
    shell2.dataset.theme = section.dataset.theme ?? "dark";
    document.querySelector(".sound-control__button")?.dispatchEvent(new Event("soundthemechange"));
    document.querySelector(".side-nav__logo-image")?.dispatchEvent(new Event("logothemechange"));
    links.forEach((link) => {
      const isActive = link.dataset.sectionLink === section.dataset.section;
      link.classList.toggle("is-active", isActive);
      link.setAttribute("aria-current", isActive ? "location" : "false");
    });
    // Static, never-changing section (unlike the map chapter's "route" /
    // "fragmentation", which flip via applyMapStep) - safe to keep the URL
    // in sync with it here, whether the user arrived by scrolling or a click.
    if (section.id === "explore-data" && location.hash !== "#explore-data") {
      history.replaceState(null, "", "#explore-data");
    }
  };

  if (typeof scrollama === "function") {
    const sectionScroller = scrollama();
    sectionScroller
      .setup({ step: "[data-section]", offset: 0.5, order: true })
      .onStepEnter(({ element }) => activateSection(element));
    window.addEventListener("resize", () => sectionScroller.resize());
    window.__sectionScroller = sectionScroller;
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        activateSection(visible.target);
      },
      { rootMargin: "-35% 0px -35% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] }
    );
    sections2.forEach((section) => observer.observe(section));
  }
  window.setTimeout(revealIntroUi, 4e3);
}

// Keep animation values inside a safe range, usually 0 (hidden) to 1 (shown).
// 4 seconds + 18 frames at 30 fps = 4.6 seconds.
const INTRO_LOOP_START = 4 + 18 / 30;
// At 8 seconds, playback returns to INTRO_LOOP_START.
const INTRO_LOOP_END = 8;
// Convert a section's document position into continuous progress from 0 to 1.
function sceneProgress(element) {
  const rect = element.getBoundingClientRect();
  const distance = element.offsetHeight - window.innerHeight;
  return distance <= 0 ? 0 : clamp(-rect.top / distance);
}
// Measure only the initial entrance of a section into the viewport.
function sectionEntryProgress(element) {
  const rect = element.getBoundingClientRect();
  return clamp((window.innerHeight - rect.top) / (window.innerHeight * 0.75));
}
// Mark the link matching the section nearest the viewport center.
function updateMainNavigation() {
  const intro = document.querySelector("#introduction");
  const nav = document.querySelector(".main-nav");
  if (!intro || !nav) return;
  const introRect = intro.getBoundingClientRect();
  const progress = clamp(-introRect.top / (window.innerHeight * 0.72));
  if (progress > 0.005) revealIntroUi();
  nav.style.setProperty("--nav-reveal", progress.toFixed(3));
  nav.classList.toggle("is-visible", progress > 0.02);
}
// Start the opening film and enforce its custom 4.6–8 second loop.
function setupIntroVideo() {
  const intro = document.querySelector("#introduction");
  const video = document.querySelector(".intro-section__video");
  if (!intro || !video) return;
  const play = () => {
    void video.play().catch(() => void 0);
  };
  video.addEventListener("loadeddata", play, { once: true });
  document.addEventListener("pointerdown", play, { once: true });
  video.addEventListener("timeupdate", () => {
    if (video.currentTime >= INTRO_LOOP_END) {
      video.currentTime = INTRO_LOOP_START;
      play();
    }
  });
  let introPlaybackScheduled = false;
  const syncIntroPlayback = () => {
    introPlaybackScheduled = false;
    const rect = intro.getBoundingClientRect();
    const introIsVisible = rect.bottom > 0 && rect.top < window.innerHeight;
    if (introIsVisible) play();
    else video.pause();
  };
  window.addEventListener("scroll", () => {
    if (introPlaybackScheduled) return;
    introPlaybackScheduled = true;
    requestAnimationFrame(syncIntroPlayback);
  }, { passive: true });
  play();
}
// Select PNG frames and move centered text from sequence scroll progress.
function updateImageSequence() {
  const section = document.querySelector(".sequence-section");
  if (!section) return;
  const rect = section.getBoundingClientRect();
  const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;
  if (!isVisible) return;
  const distance = section.offsetHeight - window.innerHeight;
  const progress = distance <= 0 ? 0 : clamp(-rect.top / distance);
  const frames = section.querySelectorAll("[data-sequence-frame]");
  const frameProgress = clamp(progress / 0.6);
  const activeFrame = Math.min(frames.length - 1, Math.floor(frameProgress * frames.length));
  frames.forEach((frame, index) => frame.classList.toggle("is-revealed", index <= activeFrame));
  const texts = section.querySelectorAll("[data-sequence-text]");
  texts.forEach((text, index) => {
    const centers = [0.14, 0.42, 0.7];
    const center = centers[index] ?? 0.5;
    const travel = clamp((progress - (center - 0.17)) / 0.34);
    const translateY = (1 - travel * 2) * window.innerHeight;
    text.style.opacity = "1";
    text.style.transform = `translateY(${translateY}px)`;
  });
}
// Move each story card through the fixed panel and reveal its media.
function updateStories() {
  const journey = document.querySelector(".story-chapter-section--journey");
  if (!journey) return;
  const journeyRect = journey.getBoundingClientRect();
  const journeyIsOutsideViewport = journeyRect.bottom <= 0 || journeyRect.top >= window.innerHeight;
  if (journeyIsOutsideViewport) {
    if (activeStoryIndex >= 0) fadeOutStoryAudio();
    storyAudioIsSuppressedForNavigation = false;
    return;
  }
  const cards = journey.querySelectorAll("[data-story-card]");
  // Reserve only a short scroll distance for the completed-journey outro.
  const storyRange = 0.88;
  const storySpan = storyRange / cards.length;
  const scrollProgress = sceneProgress(journey);
  const entryReveal = clamp((sectionEntryProgress(journey) - 0.15) / 0.6);
  // Let the first card settle roughly a third of a viewport below the top
  // while the chapter is entered, rather than snapping straight into place.
  const entryAdvance = storySpan * 0.35;
  const progress = entryReveal * entryAdvance + scrollProgress * (1 - entryAdvance);
  // Keep the final image-to-outro hand-off concise rather than spreading it
  // across a long final stretch of the chapter.
  const outroReveal = clamp((progress - storyRange) / 0.045);
  if (outroReveal > 0.02 && activeStoryIndex >= 0) fadeOutStoryAudio();
  cards.forEach((card, index) => {
    const travel = clamp((progress - index * storySpan) / storySpan);
    const factsIn = clamp((travel - 0.3) / 0.2);
    const factsOut = clamp((0.9 - travel) / 0.15);
    card.style.opacity = "1";
    card.style.transform = `translateY(${(1 - travel * 2) * 100}%)`;
    card.style.setProperty("--story-copy-offset", "0px");
    card.style.setProperty("--facts-reveal", Math.min(factsIn, factsOut).toFixed(3));
  });
  const mediaReveal = clamp(progress / (storySpan * 0.5));
  const mediaOpacity = (mediaReveal * (1 - outroReveal)).toFixed(3);
  const sharedAnimation = journey.querySelector("[data-story-shared-animation]");
  const activeStoryHasAnimation = hasStoryAnimation(activeStoryIndex);

  // The still image is the fallback for stories without an animation. The
  // shared video sits above it and receives the identical reveal/outro fade.
  journey.querySelectorAll("[data-story-media]").forEach((item) => {
    const isActiveFallback = Number(item.dataset.storyMedia) === activeStoryIndex
      && !activeStoryHasAnimation;
    item.style.opacity = isActiveFallback ? mediaOpacity : "0";
  });
  if (sharedAnimation) {
    sharedAnimation.style.opacity = activeStoryHasAnimation ? mediaOpacity : "0";
  }
  const storyOutroImage = document.querySelector(".story-outro__image");
  const storyOutroText = document.querySelector(".story-outro__text");
  const storyOutroArrow = document.querySelector(".story-outro__arrow");
  if (storyOutroImage) storyOutroImage.style.opacity = outroReveal.toFixed(3);
  if (storyOutroText) storyOutroText.style.transform = `translateY(${(1 - outroReveal) * 100}vh)`;
  storyOutroArrow?.classList.toggle("is-visible", progress >= 0.93);
}
// The map assets load asynchronously. Their first refresh must use the first
// barrier step, not the forest step that follows it, otherwise forest copy can
// flash through before Scrollama has supplied the actual scroll position.
let currentMapStep = -2;
let lastPseudoreliefProgress = -1;
let lastPseudoreliefTopViewProgress = -1;
let rankingWasVisible = false;
// Translate one map step into text, SVG, ranking, and 3D visual states.
function applyMapStep(stepIndex, stepProgress = 1) {
  const section = document.querySelector(".map-section");
  if (!section) return;
  const sectionRect = section.getBoundingClientRect();
  if (sectionRect.bottom <= 0 || sectionRect.top >= window.innerHeight) return;
  const barrierStep = document.querySelector(".map-section__step--barriers");
  const title = document.querySelector(".map-section__title-row");
  const forestTitle = document.querySelector(".map-section__forest-title");
  const intro = document.querySelector(".map-section__step--intro");
  const detail = document.querySelector(".map-section__step--detail");
  const pseudo = document.querySelector(".map-section__step--pseudo");
  const stubRoads = document.querySelector(".map-section__stub-copy");
  const pseudoFacts = document.querySelector(".map-section__pseudo-facts-copy");
  const meshStep = document.querySelector(".map-section__step--mesh");
  const meshTitle = document.querySelector(".map-section__mesh-title");
  const meshIntroCopy = document.querySelector(".map-section__mesh-intro-copy");
  const meshFactIntro = document.querySelector(".map-section__mesh-fact--intro");
  const meshAnimation = document.querySelector(".map-section__mesh-animation");
  const meshFactOutro = document.querySelector(".map-section__mesh-fact--outro");
  const meshRouteCopy = document.querySelector(".map-section__mesh-route-copy");
  const meshBayernCopy = document.querySelector(".map-section__mesh-bayern-copy");
  const meshThueringenCopy = document.querySelector(".map-section__mesh-thueringen-copy");
  const meshDiagonalStep = document.querySelector(".map-section__mesh-diagonal-step");
  const meshDiagonalIntro = meshDiagonalStep?.querySelector(":scope > .map-section__reveal-text");
  const meshDiagonalAnimation = meshDiagonalStep?.querySelector(".map-section__diagonal-animation");
  const meshDiagonalFact = meshDiagonalStep?.querySelector(":scope > .map-section__facts");
  const meshBayernTime = document.querySelector(".map-section__mesh-bayern-time");
  const meshThueringenTime = document.querySelector(".map-section__mesh-thueringen-time");
  const forestMap = document.querySelector(".forest-map");
  const forestMapSvg = document.querySelector(".forest-map__svg");
  const barrierLayer = document.querySelector(".forest-map__layer--barriers");
  const barrierBreakdown = document.querySelector(".barrier-breakdown");
  if (!section || !barrierStep || !title || !forestTitle || !intro || !detail || !pseudo || !stubRoads || !pseudoFacts || !meshStep || !meshTitle || !meshIntroCopy || !meshFactIntro || !meshAnimation || !meshFactOutro || !meshRouteCopy || !meshBayernCopy || !meshThueringenCopy || !meshDiagonalStep || !meshDiagonalIntro || !meshDiagonalAnimation || !meshDiagonalFact || !meshBayernTime || !meshThueringenTime || !forestMap || !forestMapSvg || !barrierLayer) return;
  currentMapStep = stepIndex;
  // Delay slightly, then complete the entrance within this trigger's central 58%.
  const arrival = clamp((stepProgress - 0.18) / 0.58);
  // The first map view should be complete as the chapter is reached, instead
  // of opening with an empty copy panel and a nearly white map.
  const barrierEntrance = clamp((stepProgress + 0.12) / 0.24);
  // Convert a normalized vertical position into actual viewport pixels.
  const y = (position) => `${position * window.innerHeight}px`;
  const barrierPosition = stepIndex < -2 ? 1 : stepIndex <= -1 ? 0 : stepIndex === 0 ? -arrival : -1;
  const barrierReveal = stepIndex < -2 ? 0 : stepIndex === -2 ? barrierEntrance : stepIndex === -1 ? 1 : stepIndex === 0 ? 1 - arrival : 0;
  const forestStageReveal = stepIndex < 0 ? 0 : stepIndex === 0 ? arrival : 1;
  // Keep the forest copy below the panel until its own transition starts.
  // Moving it from above to below between steps made it briefly travel across
  // the view due to the CSS transform transition.
  const introPosition = stepIndex < 0 ? 1 : stepIndex === 0 ? 1 - arrival : stepIndex === 1 ? 0 : stepIndex === 2 ? -arrival : -1;
  const detailPosition = stepIndex < 1 ? 1 : stepIndex === 1 ? 1 - arrival : stepIndex === 2 ? -arrival : -1;
  const pseudoPosition = stepIndex < 2 ? 1 : stepIndex === 2 ? 1 - arrival : stepIndex < 6 ? 0 : stepIndex === 6 ? -arrival : -1;
  const meshPosition = stepIndex < 6 ? 1 : stepIndex === 6 ? 1 - arrival : 0;
  const detailReveal = stepIndex < 1 ? 0 : stepIndex === 1 ? arrival : 1;
  const zoomReveal = stepIndex < 2 ? 0 : stepIndex === 2 ? arrival : stepIndex < 6 ? 1 : stepIndex === 6 ? 1 - arrival : 0;
  const stubRoadsReveal = stepIndex < 3 ? 0 : stepIndex === 3 ? arrival : 1;
  const factsReveal = stepIndex < 4 ? 0 : stepIndex === 4 ? arrival : 1;
  const pseudoreliefExit = stepIndex < 6 ? 0 : stepIndex === 6 ? arrival : 1;
  const meshFactsReveal = stepIndex < 7 ? 0 : stepIndex === 7 ? arrival : 1;
  const isColumnLayout = window.matchMedia("(max-width: 900px)").matches;
  const mobileMeshDetailReveal = !isColumnLayout || stepIndex < 7.5
    ? 0
    : stepIndex === 7.5
      ? arrival
      : 1;
  const meshReveal = stepIndex < 6 ? 0 : stepIndex === 6 ? arrival : 1;
  const meshRouteReveal = stepIndex < 8 ? 0 : stepIndex === 8 ? arrival : 1;
  const bayernReveal = stepIndex < 9 ? 0 : stepIndex === 9 ? arrival : 1;
  const thueringenReveal = stepIndex < 10 ? 0 : stepIndex === 10 ? arrival : 1;
  const diagonalReveal = stepIndex < 11 ? 0 : stepIndex === 11 ? arrival : 1;
  const bayernTimeReveal = stepIndex < 12 ? 0 : stepIndex === 12 ? arrival : 1;
  const thueringenTimeReveal = stepIndex < 13 ? 0 : stepIndex === 13 ? arrival : 1;
  const rankingReveal = meshRouteReveal;
  const rankingMobileOffsetY = window.matchMedia("(max-width: 700px)").matches
    ? 60
    : window.matchMedia("(max-width: 900px)").matches
      ? 250
      : 0;
  const rankingSwap = clamp(rankingReveal / 0.12);
  const rankingTravel = clamp((rankingReveal - 0.12) / 0.88);
  const meshFactIntroReveal = clamp(meshFactsReveal / 0.55);
  const meshAnimationReveal = clamp((meshFactsReveal - 0.18) / 0.55);
  const meshFactOutroReveal = isColumnLayout
    ? mobileMeshDetailReveal
    : clamp((meshFactsReveal - 0.36) / 0.55);
  const mobileMeshShift = isColumnLayout
    ? mobileMeshDetailReveal * (meshIntroCopy.offsetHeight + 24)
    : 0;
  const mobileDiagonalShift = isColumnLayout
    ? bayernTimeReveal * (meshDiagonalIntro.offsetHeight + 24)
    : 0;
  title.style.opacity = "1";
  title.style.transform = "none";
  forestTitle.style.opacity = "1";
  barrierStep.style.transform = `translateY(${y(barrierPosition)})`;
  intro.style.transform = `translateY(${y(introPosition)})`;
  detail.style.transform = `translateY(${y(detailPosition)})`;
  pseudo.style.transform = `translateY(${y(pseudoPosition)})`;
  meshStep.style.transform = `translateY(${y(meshPosition)})`;
  meshRouteCopy.style.top = `${meshTitle.offsetHeight}px`;
  meshIntroCopy.style.opacity = ((1 - meshRouteReveal) * (1 - mobileMeshDetailReveal)).toFixed(3);
  meshFactIntro.style.opacity = (meshFactIntroReveal * (1 - meshRouteReveal)).toFixed(3);
  meshFactIntro.style.transform = `translateY(${(1 - meshFactIntroReveal) * 40 - mobileMeshShift}px)`;
  meshAnimation.style.opacity = (meshAnimationReveal * (1 - meshRouteReveal)).toFixed(3);
  meshAnimation.style.transform = `translateY(${(1 - meshAnimationReveal) * 40 - mobileMeshShift}px)`;
  meshFactOutro.style.opacity = (meshFactOutroReveal * (1 - meshRouteReveal)).toFixed(3);
  meshFactOutro.style.transform = `translateY(${(1 - meshFactOutroReveal) * 40 - mobileMeshShift}px)`;
  meshRouteCopy.style.opacity = (meshRouteReveal * (1 - diagonalReveal)).toFixed(3);
  meshRouteCopy.style.transform = `translateY(${(1 - meshRouteReveal) * window.innerHeight}px)`;
  meshBayernCopy.style.top = `${meshTitle.offsetHeight + meshRouteCopy.offsetHeight + 16}px`;
  meshBayernCopy.style.opacity = (bayernReveal * (1 - diagonalReveal)).toFixed(3);
  meshBayernCopy.style.transform = `translateY(${(1 - bayernReveal) * window.innerHeight}px)`;
  meshThueringenCopy.style.top = `${meshTitle.offsetHeight + meshRouteCopy.offsetHeight + meshBayernCopy.offsetHeight + 32}px`;
  meshThueringenCopy.style.opacity = (thueringenReveal * (1 - diagonalReveal)).toFixed(3);
  meshThueringenCopy.style.transform = `translateY(${(1 - thueringenReveal) * window.innerHeight}px)`;
  meshDiagonalStep.style.top = `${meshTitle.offsetHeight}px`;
  meshDiagonalStep.style.opacity = diagonalReveal.toFixed(3);
  meshDiagonalStep.style.transform = `translateY(${(1 - diagonalReveal) * window.innerHeight}px)`;
  meshDiagonalIntro.style.opacity = (isColumnLayout ? 1 - bayernTimeReveal : 1).toFixed(3);
  meshDiagonalAnimation.style.transform = `translateY(${-mobileDiagonalShift}px)`;
  meshDiagonalFact.style.transform = `translateY(${-mobileDiagonalShift}px)`;
  meshBayernTime.style.opacity = bayernTimeReveal.toFixed(3);
  meshBayernTime.style.transform = `translateY(${(1 - bayernTimeReveal) * window.innerHeight - mobileDiagonalShift}px)`;
  meshThueringenTime.style.opacity = thueringenTimeReveal.toFixed(3);
  meshThueringenTime.style.transform = `translateY(${(1 - thueringenTimeReveal) * window.innerHeight - mobileDiagonalShift}px)`;
  stubRoads.style.opacity = stubRoadsReveal.toFixed(3);
  stubRoads.style.transform = `translateY(${(1 - stubRoadsReveal) * window.innerHeight}px)`;
  pseudoFacts.style.opacity = factsReveal.toFixed(3);
  pseudoFacts.style.transform = `translateY(${(1 - factsReveal) * 40}px)`;
  forestMap.style.opacity = (stepIndex === -2 ? barrierEntrance : 1).toFixed(3);
  forestMap.style.setProperty("--barrier-reveal", barrierReveal.toFixed(3));
  if (barrierBreakdown) {
    barrierBreakdown.style.opacity = barrierReveal.toFixed(3);
    barrierBreakdown.style.pointerEvents = barrierReveal > 0.01 ? "auto" : "none";
  }
  forestMap.style.setProperty("--forest-stage-reveal", forestStageReveal.toFixed(3));
  forestMap.style.setProperty("--large-forest-reveal", detailReveal.toFixed(3));
  forestMap.style.setProperty("--forest-zoom-detail", clamp((zoomReveal - 0.35) / 0.65).toFixed(3));
  forestMap.style.setProperty("--pseudorelief-reveal", (stubRoadsReveal * (1 - pseudoreliefExit)).toFixed(3));
  forestMap.style.setProperty("--pseudorelief-exit", pseudoreliefExit.toFixed(3));
  forestMap.style.setProperty("--mesh-reveal", meshReveal.toFixed(3));
  forestMap.style.setProperty("--ranking-reveal", rankingSwap.toFixed(3));
  forestMap.style.setProperty("--ranking-travel", rankingTravel.toFixed(3));
  forestMap.classList.toggle("is-ranking", rankingReveal > 0);
  forestMap.closest(".map-section__media")?.classList.toggle("is-ranking", rankingReveal > 0);
  const meshLabelsVisible = meshReveal > 0 && rankingReveal < 1;
  const rankingLabelsVisible = rankingReveal > 0 || rankingWasVisible;
  const labelsCtm = meshLabelsVisible || rankingLabelsVisible
    ? forestMapSvg.getScreenCTM()
    : null;
  const labelsRootRect = labelsCtm ? forestMap.getBoundingClientRect() : null;

  // Mesh labels are HTML overlays, so they must continue following the SVG
  // while the map moves and zooms during the mesh-size chapter.
  if (labelsCtm && labelsRootRect && meshLabelsVisible) {
    document.querySelectorAll(".forest-map__mesh-label-html").forEach((label) => {
      const point = forestMapSvg.createSVGPoint();
      point.x = Number(label.dataset.anchorX);
      point.y = Number(label.dataset.anchorY);
      const screenPoint = point.matrixTransform(labelsCtm);
      label.style.left = `${screenPoint.x - labelsRootRect.left}px`;
      label.style.top = `${screenPoint.y - labelsRootRect.top}px`;
    });
  }

  // Ranking labels require expensive SVG-to-screen coordinate measurement.
  // Skip them throughout the earlier Fragmentation steps, where the ranking
  // is fully invisible, but run one final pass when it fades out.
  if (rankingLabelsVisible) {
  document.querySelectorAll(".forest-map__ranking-state").forEach((state) => {
    const centerX = Number(state.dataset.centerX);
    const centerY = Number(state.dataset.centerY);
    const targetX = Number(state.dataset.targetX);
    const targetY = Number(state.dataset.targetY);
    const targetScale = Number(state.dataset.targetScale);
    const currentX = lerp(centerX, targetX, rankingTravel) - 100 * bayernReveal;
    const currentY = lerp(centerY, targetY - rankingMobileOffsetY, rankingTravel);
    const currentScale = lerp(1, targetScale, rankingTravel);
    state.setAttribute("transform", `translate(${currentX} ${currentY}) scale(${currentScale}) translate(${-centerX} ${-centerY})`);
    const baseOpacity = state.dataset.stateCode === "09" ? 1 : 1 - 0.8 * bayernReveal;
    const stateOpacity = state.dataset.stateCode === "16"
      ? lerp(baseOpacity, 1, thueringenReveal)
      : baseOpacity;
    state.style.opacity = stateOpacity.toFixed(3);
  });
  document.querySelectorAll(".forest-map__ranking-label").forEach((label) => {
    const baseOpacity = label.dataset.stateCode === "09" ? 1 : 1 - 0.8 * bayernReveal;
    const focusOpacity = label.dataset.stateCode === "16"
      ? lerp(baseOpacity, 1, thueringenReveal)
      : baseOpacity;
    const targetX = Number(label.dataset.targetX);
    const labelY = Number(label.dataset.labelY);
    const visibleLabelY = labelY - rankingMobileOffsetY;
    const shiftedX = targetX - 100 * bayernReveal;
    const visibleX = label.dataset.stateCode === "12" ? Math.max(24, shiftedX) : shiftedX;
    label.style.opacity = (rankingTravel * focusOpacity).toFixed(3);
    label.setAttribute("x", visibleX);
    label.setAttribute("y", visibleLabelY);
    label.setAttribute("transform", `rotate(-55 ${visibleX} ${visibleLabelY})`);
    label.querySelectorAll("tspan").forEach((line) => line.setAttribute("x", visibleX));
  });
  if (labelsCtm && labelsRootRect) {
    document.querySelectorAll(".forest-map__ranking-label-html").forEach((label) => {
      const baseOpacity = label.dataset.stateCode === "09" ? 1 : 1 - 0.8 * bayernReveal;
      const focusOpacity = label.dataset.stateCode === "16"
        ? lerp(baseOpacity, 1, thueringenReveal)
        : baseOpacity;
      const targetX = Number(label.dataset.targetX);
      const labelY = Number(label.dataset.labelY) - rankingMobileOffsetY;
      const shiftedX = targetX - 100 * bayernReveal;
      const visibleX = label.dataset.stateCode === "12" ? Math.max(24, shiftedX) : shiftedX;
      const point = forestMapSvg.createSVGPoint();
      point.x = visibleX;
      point.y = labelY;
      const screenPoint = point.matrixTransform(labelsCtm);
      label.style.left = `${screenPoint.x - labelsRootRect.left}px`;
      label.style.top = `${screenPoint.y - labelsRootRect.top}px`;
      label.style.opacity = (rankingTravel * focusOpacity).toFixed(3);
    });
  }
  }
  rankingWasVisible = rankingReveal > 0;
  forestMap.classList.toggle("is-large-forest-only", detailReveal >= 0.99);
  forestMapSvg.style.transform = "none";
  const rawBarrierX = Number(barrierLayer.dataset.boundsX);
  const rawBarrierY = Number(barrierLayer.dataset.boundsY);
  const rawBarrierWidth = Number(barrierLayer.dataset.boundsWidth);
  const rawBarrierHeight = Number(barrierLayer.dataset.boundsHeight);
  if ([rawBarrierX, rawBarrierY, rawBarrierWidth, rawBarrierHeight].every(Number.isFinite)) {
    const panelRect = forestMapSvg.getBoundingClientRect();
    const panelAspect = panelRect.width / Math.max(panelRect.height, 1);
    const frameForScale = (scale) => {
      let width = rawBarrierWidth * scale;
      let height = rawBarrierHeight * scale;
      if (width / height < panelAspect) width = height * panelAspect;
      else height = width / panelAspect;
      return {
        x: rawBarrierX + rawBarrierWidth / 2 - width / 2,
        y: rawBarrierY + rawBarrierHeight / 2 - height / 2,
        width,
        height
      };
    };
    const closeFrame = frameForScale(0.38);
    const wideFrame = frameForScale(0.82);
    const isBarrierTransition = stepIndex <= 0;
    // Start widening immediately, but distribute the zoom over both barrier
    // steps so it completes only as the forest-map transition begins.
    const barrierZoomOut = stepIndex < -2
      ? 0
      : stepIndex === -2
        ? clamp(stepProgress) * 0.5
        : stepIndex === -1
          ? 0.5 + clamp(stepProgress) * 0.5
          : 1;
    const forestTransition = stepIndex < 0 ? 0 : stepIndex === 0 ? arrival : 1;
    const barrierFrame = {
      x: lerp(closeFrame.x, wideFrame.x, barrierZoomOut),
      y: lerp(closeFrame.y, wideFrame.y, barrierZoomOut),
      width: lerp(closeFrame.width, wideFrame.width, barrierZoomOut),
      height: lerp(closeFrame.height, wideFrame.height, barrierZoomOut)
    };
    // Use a tighter centered viewBox so the detailed regional forest fills the media panel.
    const forestDetailWidth = 87.5;
    const forestDetailHeight = 87.5;
    const forestDetailX = 456.25;
    // Shift the SVG camera down by the map-unit equivalent of 100 CSS pixels,
    // which moves the visible forest geometry upward inside the media panel.
    const forestDetailY = 456.25 + (100 / Math.max(panelRect.height, 1)) * forestDetailHeight;
    const viewX = isBarrierTransition
      ? lerp(barrierFrame.x, 0, forestTransition)
      : lerp(0, forestDetailX, zoomReveal);
    const viewY = isBarrierTransition
      ? lerp(barrierFrame.y, 0, forestTransition)
      : lerp(0, forestDetailY, zoomReveal);
    const viewWidth = isBarrierTransition
      ? lerp(barrierFrame.width, 1000, forestTransition)
      : lerp(1000, forestDetailWidth, zoomReveal);
    const viewHeight = isBarrierTransition
      ? lerp(barrierFrame.height, 1000, forestTransition)
      : lerp(1000, forestDetailHeight, zoomReveal);
    const nextViewBox = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;
    if (forestMapSvg.getAttribute("viewBox") !== nextViewBox) {
      forestMapSvg.setAttribute("viewBox", nextViewBox);
    }
  }
  // The map visually blends into ranking-style mode from step 8 onward (see
  // "is-ranking" below), but the copy keeps narrating "Fragmentation" content
  // (mesh size, Bayern/Thueringen walking-distance facts) all the way through
  // the last map step - so this element's own nav label always stays
  // "fragmentation" (or "route" before the chapter starts). The real
  // "Explore the Data" chapter is a separate #explore-data section right
  // after this one, and switches the nav itself via observeSections() once
  // the user actually scrolls into it.
  const activeMapSection = stepIndex < 0 ? "route" : "fragmentation";
  section.dataset.section = activeMapSection;
  document.querySelectorAll("[data-section-link]").forEach((link) => {
    const isActive = link.dataset.sectionLink === activeMapSection;
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "location" : "false");
  });
  // WebGL rendering plus its HTML/SVG callout measurements are among the
  // most expensive operations in this chapter. Constant hidden/settled
  // values do not need to be rendered again on every scroll frame.
  if (Math.abs(factsReveal - lastPseudoreliefProgress) > 0.002
    || Math.abs(stubRoadsReveal - lastPseudoreliefTopViewProgress) > 0.002) {
    updatePseudorelief(factsReveal, stubRoadsReveal);
    lastPseudoreliefProgress = factsReveal;
    lastPseudoreliefTopViewProgress = stubRoadsReveal;
  }
}
// Switch end images and move four ending passages through the viewport.
function updateEndSequence() {
  const section = document.querySelector(".end-sequence-section");
  if (!section) return;
  const rect = section.getBoundingClientRect();
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
  const progress = sceneProgress(section);
  const mediaItems = section.querySelectorAll("[data-end-media]");
  const mediaProgress = clamp(progress / 0.88);
  const activeMedia = Math.min(mediaItems.length - 1, Math.floor(mediaProgress * mediaItems.length));
  mediaItems.forEach((media, index) => {
    media.classList.toggle("is-revealed", index <= activeMedia);
  });
  const centers = [0.14, 0.36, 0.58, 0.82];
  section.querySelectorAll("[data-end-text]").forEach((text, index) => {
    if (index === 3) {
      const finalEntrance = clamp((progress - 0.64) / 0.16);
      const finalOffset = (1 - finalEntrance) * window.innerHeight - finalEntrance * window.innerHeight * 0.22;
      text.style.transform = `translateY(${finalOffset}px)`;
      return;
    }
    const center = centers[index] ?? 0.82;
    const travel = clamp((progress - (center - 0.16)) / 0.32);
    text.style.transform = `translateY(${(1 - travel * 2) * window.innerHeight}px)`;
  });
}
// Connect Scrollama, links, resizing, and all animation update functions.
export function setupScrollScenes() {
  setupSharedStoryAnimation();
  setupStoryAudio();
  document.querySelector(".sound-control__button")?.addEventListener("soundchange", (event) => {
    syncStorySound(event.detail ?? {});
  });
  setupIntroVideo();
  document.querySelectorAll('.main-nav__item[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      if (activeStoryIndex < 0 || link.getAttribute("href") === "#perspective-shift") return;
      storyAudioIsSuppressedForNavigation = true;
      fadeOutStoryAudio();
    });
  });
  document.querySelectorAll(".map-section__mark").forEach((image) => {
    image.addEventListener("error", () => image.classList.add("has-error"));
  });
  const mapNavigationSteps = new Map([
    ["route", -2],
    ["fragmentation", 0]
  ]);
  mapNavigationSteps.forEach((stepIndex, sectionId) => {
    document.querySelectorAll(`.main-nav__item[data-section-link="${sectionId}"]`).forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetStep = document.querySelector(`.map-scroll-step[data-map-step="${stepIndex}"]`);
        if (!targetStep) return;
        event.preventDefault();
        history.pushState(null, "", `#${sectionId}`);
        const stepTop = window.scrollY + targetStep.getBoundingClientRect().top;
        const fullyRevealedProgress = 0.82;
        const targetY = stepTop + targetStep.offsetHeight * fullyRevealedProgress - window.innerHeight * 0.5;
        window.scrollTo({
          top: Math.max(0, targetY),
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
        });
      });
    });
  });
  document.querySelectorAll('.scroll-arrow[href^="#"]').forEach((arrow) => {
    arrow.addEventListener("click", (event) => {
      const target = document.querySelector(arrow.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      history.pushState(null, "", arrow.getAttribute("href"));
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
  document.querySelectorAll(".sequence-section__frame").forEach((image) => {
    image.addEventListener("error", () => image.classList.add("has-error"));
  });
  const update = () => {
      updateMainNavigation();
      updateImageSequence();
      updateStories();
      updateEndSequence();
    };
  let scheduled = false;
  // Allow at most one update per animation frame, preventing scroll jank.
  const requestUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      update();
      scheduled = false;
    });
  };

  let pendingMapStep = null;
  let mapStepScheduled = false;
  // Same one-update-per-frame guard as requestUpdate above, but for
  // applyMapStep specifically: Scrollama's progress-tracking observer can
  // call onStepEnter/onStepProgress more than once per frame, and each call
  // is expensive (layout reads/writes, 3D re-render) - coalesce to the latest.
  const requestMapStepUpdate = (stepIndex, stepProgress) => {
    pendingMapStep = [stepIndex, stepProgress];
    if (mapStepScheduled) return;
    mapStepScheduled = true;
    requestAnimationFrame(() => {
      mapStepScheduled = false;
      applyMapStep(...pendingMapStep);
    });
  };

  if (typeof scrollama === "function") {
    const isScrollamaDebug = new URLSearchParams(window.location.search).has("scrollama-debug");
    // Each story owns one explicit Scrollama range. onStepEnter fires in both
    // directions, so re-entering a story always restarts its clip.
    const storyScroller = scrollama();
    storyScroller
      .setup({
        step: "[data-story-trigger]",
        offset: 0.55,
        order: true,
        debug: isScrollamaDebug
      })
      .onStepEnter(({ element }) => activateStory(Number(element.dataset.storyTrigger)));
    // This instance controls the detailed numbered steps inside the map.
    const mapScroller = scrollama();
    mapScroller
      .setup({
        step: ".map-scroll-step",
        offset: 0.5,
        progress: true,
        threshold: 4,
        order: true
      })
      .onStepEnter(({ element, progress }) => {
        requestMapStepUpdate(Number(element.dataset.mapStep), progress ?? 0);
      })
      .onStepProgress(({ element, progress }) => {
        requestMapStepUpdate(Number(element.dataset.mapStep), progress);
      });
    // This instance watches whole chapters and refreshes general animations.
    const sceneScroller = scrollama();
    sceneScroller
      .setup({
        step: ".intro-section, .sequence-section, .story-chapter-section, .interlude-section, .route-section, .map-section, .end-sequence-section",
        offset: 0.9,
        progress: true,
        threshold: 4,
        order: true
      })
      .onStepEnter(requestUpdate)
      .onStepProgress(requestUpdate)
      .onStepExit(requestUpdate);
    window.addEventListener("resize", () => {
      mapScroller.resize();
      sceneScroller.resize();
      requestUpdate();
    });
    window.__mapScroller = mapScroller;
    window.__sceneScroller = sceneScroller;
  } else {
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
  }
  update();
}

/* APP BOOTSTRAP: execution starts here after the helpers are defined. */

export function refreshCurrentMapStep() {
  applyMapStep(currentMapStep, 1);
}
