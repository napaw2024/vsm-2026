import { about, references, sources } from "./content.js";

const INFO_PAGE_IDS = ["about", "references", "sources"];

function aboutPanelHTML() {
  return `
    <div class="info-section__grid">
      <div class="info-section__column">
        <h2>${about.aboutHeading}</h2>
        ${about.aboutParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join("")}
      </div>
      <div class="info-section__column">
        <h2>${about.creditsHeading}</h2>
        <p>${about.creditsCopy}</p>
        <h2>${about.learnMoreHeading}</h2>
        <ul class="info-section__links">
          ${about.learnMoreLinks.map((link) => (link.url
            ? `<li><a href="${link.url}" target="_blank" rel="noreferrer">${link.label}</a></li>`
            : `<li>${link.label}</li>`)).join("")}
        </ul>
        <div class="info-section__legal">
          ${about.legalLinks.map((link) => `<a href="${link.url || "#"}">${link.label}</a>`).join("")}
        </div>
      </div>
    </div>
    <img class="info-section__watermark" src="media/Fragmented%20Reality_end.svg" alt="" aria-hidden="true" />
  `;
}

function referencesPanelHTML() {
  return `
    <h2>${references.heading}</h2>
    <ol class="info-section__list">
      ${references.items.map((item) => `<li>${item}</li>`).join("")}
    </ol>
  `;
}

function sourcesPanelHTML() {
  return `
    <h2>${sources.heading}</h2>
    <div class="info-section__list info-section__list--unnumbered">
      ${sources.items.map((item) => `<p>${item}</p>`).join("")}
    </div>
  `;
}

const PANEL_BUILDERS = {
  about: aboutPanelHTML,
  references: referencesPanelHTML,
  sources: sourcesPanelHTML
};

// Build the overlay that hosts the About, References, and Sources screens.
// These are reached from the side navigation but, unlike the rest of the
// site, aren't part of the long scrolling story - they open instantly as
// their own full-screen page instead of scrolling the whole document down
// to reach them.
export function createInfoOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "info-overlay";
  overlay.dataset.theme = "light";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <button type="button" class="info-overlay__close">
      <span class="info-overlay__close-arrow" aria-hidden="true">&larr;</span>
      <span>Back to story</span>
    </button>
    ${INFO_PAGE_IDS.map((id) => `
      <section id="${id}" class="info-overlay__panel info-section" data-info-page="${id}">
        ${PANEL_BUILDERS[id]()}
      </section>
    `).join("")}
  `;
  return overlay;
}

let activeInfoPage = null;
let returnScrollY = 0;
let returnFocus = null;

function isInfoPageId(id) {
  return INFO_PAGE_IDS.includes(id);
}

export function isInfoPageOpen() {
  return activeInfoPage !== null;
}

// Show one of the three panels, opening the overlay first if it's closed.
// Switching between panels while already open is instant, no re-animation.
export function openInfoPage(overlay, id, { pushState = true, focusTrigger = null } = {}) {
  if (!isInfoPageId(id)) return;
  const wasOpen = activeInfoPage !== null;
  if (!wasOpen) {
    returnScrollY = window.scrollY;
    returnFocus = focusTrigger;
    document.body.classList.add("has-info-overlay-open");
    const sideNav = document.querySelector(".side-nav");
    if (window.matchMedia("(max-width: 900px)").matches) {
      sideNav?.classList.add("is-open");
      sideNav?.querySelector(".side-nav__logo")?.setAttribute("aria-expanded", "true");
    }
  }
  activeInfoPage = id;
  overlay.setAttribute("aria-hidden", "false");
  overlay.classList.add("is-open");
  overlay.querySelectorAll(".info-overlay__panel").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.infoPage === id);
  });
  overlay.scrollTop = 0;
  if (pushState && location.hash !== `#${id}`) {
    history.pushState({ infoPage: id }, "", `#${id}`);
  }
  document.querySelectorAll("[data-side-nav-link]").forEach((link) => {
    link.classList.toggle("is-active", link.dataset.sideNavLink === id);
  });
  if (!wasOpen) overlay.querySelector(".info-overlay__close")?.focus();
}

// Hide the overlay and return to exactly where the story was left off.
export function closeInfoPage(overlay, { pushState = true } = {}) {
  if (activeInfoPage === null) return;
  activeInfoPage = null;
  overlay.setAttribute("aria-hidden", "true");
  overlay.classList.remove("is-open");
  document.body.classList.remove("has-info-overlay-open");
  document.querySelectorAll("[data-side-nav-link]").forEach((link) => link.classList.remove("is-active"));
  if (pushState) {
    history.pushState(null, "", `${location.pathname}${location.search}`);
  }
  window.scrollTo({ top: returnScrollY, left: 0, behavior: "instant" });
  (returnFocus ?? document.body).focus?.();
  returnFocus = null;
}

// Wire the overlay's own controls and keep it in sync with the URL: a
// direct link/refresh with an info-page hash opens straight into it, and
// the browser's Back button closes it like any other "page".
export function setupInfoPages(overlay) {
  overlay.querySelector(".info-overlay__close")?.addEventListener("click", () => closeInfoPage(overlay));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isInfoPageOpen()) closeInfoPage(overlay);
  });
  window.addEventListener("popstate", () => {
    const id = location.hash.slice(1);
    if (isInfoPageId(id)) openInfoPage(overlay, id, { pushState: false });
    else if (isInfoPageOpen()) closeInfoPage(overlay, { pushState: false });
  });
  const initialId = location.hash.slice(1);
  if (isInfoPageId(initialId)) openInfoPage(overlay, initialId, { pushState: false });
}
