import { createMainNavigation, createSideNavigation } from "./navigation.js";
import { createSections } from "./sections.js";
import { createInfoOverlay, setupInfoPages } from "./info-pages.js";
import {
  observeSections,
  refreshCurrentMapStep,
  registerPseudoreliefUpdater,
  setupScrollScenes
} from "./scrollytelling.js";

const app = document.querySelector("#app");
if (!app) throw new Error("App root not found");

const shell = document.createElement("div");
shell.className = "site-shell";
shell.dataset.theme = "dark";

const main = document.createElement("main");
main.id = "main-content";
main.append(...createSections());

const infoOverlay = createInfoOverlay();

shell.append(createMainNavigation(), createSideNavigation(infoOverlay), main, infoOverlay);
app.append(shell);

setupInfoPages(infoOverlay);

const decorativeLoops = Array.from(document.querySelectorAll("video[muted][loop]"));
const loopVisibilityObserver = new IntersectionObserver((entries) => {
  entries.forEach(({ target: video, isIntersecting }) => {
    video.muted = true;
    if (isIntersecting) void video.play().catch(() => void 0);
    else video.pause();
  });
}, { rootMargin: "150px 0px" });

document.querySelectorAll("video:not([data-story-shared-animation])").forEach((video) => {
  video.muted = video.hasAttribute("muted");
  if (decorativeLoops.includes(video)) loopVisibilityObserver.observe(video);
});

observeSections(shell);
setupScrollScenes();

let visualizationsHaveLoaded = false;
let visualizationsAreLoading = false;
let forestMapHasLoaded = false;
let pseudoreliefHasLoaded = false;
const loadVisualizations = async () => {
  if (visualizationsHaveLoaded || visualizationsAreLoading) return;
  visualizationsAreLoading = true;
  try {
    const [{ setupForestMap }, pseudorelief] = await Promise.all([
      import("./forest-map.js"),
      import("./pseudorelief-model.js")
    ]);
    if (!forestMapHasLoaded) {
      await setupForestMap(refreshCurrentMapStep);
      forestMapHasLoaded = true;
    }
    if (!pseudoreliefHasLoaded) {
      registerPseudoreliefUpdater(pseudorelief.updatePseudorelief);
      pseudorelief.setupPseudoreliefModel();
      pseudoreliefHasLoaded = true;
    }
    refreshCurrentMapStep();
    visualizationsHaveLoaded = forestMapHasLoaded && pseudoreliefHasLoaded;
  } catch (error) {
    console.error("Unable to load the route visualizations", error);
  } finally {
    visualizationsAreLoading = false;
  }
};

// Prepare the map and model shortly before the route section enters view.
const routeSection = document.querySelector("#route");
if (routeSection) {
  const routeObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      void loadVisualizations().then(() => {
        if (visualizationsHaveLoaded) routeObserver.disconnect();
      });
    },
    { rootMargin: "100% 0px" }
  );
  routeObserver.observe(routeSection);
}

let exploreDataHasLoaded = false;
const exploreDataSection = document.querySelector("#explore-data");
if (exploreDataSection) {
  const exploreDataObserver = new IntersectionObserver(
    (entries) => {
      if (exploreDataHasLoaded || !entries.some((entry) => entry.isIntersecting)) return;
      exploreDataHasLoaded = true;
      exploreDataObserver.disconnect();
      // Keep a revision on this lazy module: long-running preview tabs can
      // otherwise retain an older Explore implementation across reloads.
      import("./explore-data.js?rev=20260904-3").then(({ setupExploreData }) => setupExploreData());
    },
    { rootMargin: "50% 0px" }
  );
  exploreDataObserver.observe(exploreDataSection);
}
