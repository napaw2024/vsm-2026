import { sections } from "./content.js";
import { closeInfoPage, isInfoPageOpen, openInfoPage } from "./info-pages.js";

export function createMainNavigation() {
  const nav = document.createElement("nav");
  nav.className = "main-nav";
  nav.setAttribute("aria-label", "Story chapters");
  sections.forEach((section, index) => {
    const link = document.createElement("a");
    link.className = "main-nav__item";
    link.href = `#${section.id}`;
    link.dataset.sectionLink = section.id;
    link.innerHTML = `
    <span class="main-nav__number">${index + 1}</span>
    <span class="main-nav__label">${section.navigationLabel}</span>
  `;
    nav.append(link);
  });
  return nav;
}

// Build the side navigation and connect theme-aware logo and sound behavior.
// "overlay" is the About/References/Sources overlay built in info-pages.js -
// those three links open it directly instead of scrolling to find it.
export function createSideNavigation(overlay) {
  const aside = document.createElement("aside");
  aside.className = "side-nav side-nav--delayed";
  aside.setAttribute("aria-label", "Project information");
  aside.innerHTML = `
  <a class="side-nav__logo" href="#introduction" aria-label="Fragmented Reality home">
    <img class="side-nav__logo-image" src="media/Logo_DM.png" alt="" />
  </a>
  <nav class="side-nav__links" aria-label="Additional information">
    <a class="side-nav__link side-nav__link--brand" href="#introduction">Fragmented Reality</a>
    <a class="side-nav__link" href="#about" data-side-nav-link="about">About</a>
    <a class="side-nav__link" href="#references" data-side-nav-link="references">References</a>
    <a class="side-nav__link" href="#sources" data-side-nav-link="sources">Sources</a>
  </nav>
  <div class="sound-control">
    <button class="sound-control__button" type="button" aria-label="Enable sound" aria-pressed="false">
      <img src="media/sound_off_DM.svg" alt="" />
    </button>
    <p class="sound-control__hint">This website uses sound.<br />You can enable it here.</p>
  </div>
`;
  const button = aside.querySelector(".sound-control__button");
  const logoLink = aside.querySelector(".side-nav__logo");
  const logoImage = aside.querySelector(".side-nav__logo-image");
  // Select the bright-mode (BM) or dark-mode (DM) logo for the current section.
  const updateLogo = () => {
    if (!logoImage) return;
    const theme = document.querySelector(".site-shell")?.dataset.theme === "light" ? "BM" : "DM";
    logoImage.src = `media/Logo_${theme}.png`;
  };
  // Use the opposite logo artwork as the desktop hover state.
  const invertLogo = () => {
    if (!logoImage) return;
    const oppositeTheme = document.querySelector(".site-shell")?.dataset.theme === "light" ? "DM" : "BM";
    logoImage.src = `media/Logo_${oppositeTheme}.png`;
  };
  const supportsTrueHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (supportsTrueHover) {
    logoLink?.addEventListener("pointerenter", invertLogo);
    logoLink?.addEventListener("pointerleave", updateLogo);
    logoLink?.addEventListener("focus", invertLogo);
    logoLink?.addEventListener("blur", updateLogo);
  }
  logoImage?.addEventListener("error", () => {
    if (!logoImage.src.endsWith("/media/Logo_DM.png")) logoImage.src = "media/Logo_DM.png";
  });
  logoImage?.addEventListener("logothemechange", updateLogo);
  // Keep the speaker artwork synchronized with sound state and page theme.
  const updateIcon = () => {
    const icon = button?.querySelector("img");
    if (!button || !icon) return;
    const isEnabled = button.classList.contains("is-enabled");
    const theme = document.querySelector(".site-shell")?.dataset.theme === "light" ? "BM" : "DM";
    icon.src = `media/sound_${isEnabled ? "on" : "off"}_${theme}.svg`;
  };
  const soundIcon = button?.querySelector("img");
  soundIcon?.addEventListener("error", () => {
    const isEnabled = button?.classList.contains("is-enabled");
    const fallback = `media/sound_${isEnabled ? "on" : "off"}.svg`;
    if (!soundIcon.src.endsWith(fallback.replace("./", "/"))) soundIcon.src = fallback;
  });
  // One button controls page videos and the timed story audio tracks.
  button?.addEventListener("click", () => {
    const videos = document.querySelectorAll("video:not([data-story-shared-animation])");
    const soundWillBeEnabled = !button.classList.contains("is-enabled");
    videos.forEach((video) => {
      video.muted = !soundWillBeEnabled;
    });
    button.classList.toggle("is-enabled", soundWillBeEnabled);
    button.setAttribute("aria-pressed", String(soundWillBeEnabled));
    button.setAttribute("aria-label", soundWillBeEnabled ? "Disable sound" : "Enable sound");
    updateIcon();
    button.dispatchEvent(new CustomEvent("soundchange", {
      detail: { enabled: soundWillBeEnabled }
    }));
    if (soundWillBeEnabled) {
      const visibleVideo = Array.from(videos).find((video) => {
        const rect = video.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight && getComputedStyle(video).opacity !== "0";
      });
      if (visibleVideo) void visibleVideo.play().catch(() => void 0);
    }
  });
  button?.addEventListener("soundthemechange", updateIcon);
  const logo = aside.querySelector(".side-nav__logo");
  const closeMobileMenu = () => {
    aside.classList.remove("is-open");
    logo?.setAttribute("aria-expanded", "false");
  };
  // Below 900px the logo becomes the button that opens the narrow side menu.
  logo?.addEventListener("click", (event) => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    event.preventDefault();
    const isOpen = aside.classList.toggle("is-open");
    logo.setAttribute("aria-expanded", String(isOpen));
  });
  aside.querySelectorAll(".side-nav__link:not([data-side-nav-link])").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });
  // "About", "References", and "Sources" open the info overlay directly -
  // no scrolling involved, so switching between them (or back to the story)
  // is instant rather than a long scroll down a very tall page.
  aside.querySelectorAll("[data-side-nav-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.defaultPrevented) return;
      event.preventDefault();
      openInfoPage(overlay, link.dataset.sideNavLink, { focusTrigger: link });
    });
  });
  // Same-page navigation is handled manually everywhere else on this page
  // (see the ".scroll-arrow" handler in scrollytelling.js) rather than
  // relying on the browser's own default anchor-jump, which doesn't reliably
  // scroll on this page. The remaining side-nav links (logo, brand) need the
  // same explicit handling, and also need to close the info overlay first if
  // it's open, since they jump back into the scrolling story.
  //
  // This also doubles as the escape route for the "Explore the Data"
  // section's scroll lock (see explore-data.js): it locks page scroll while
  // fully in view, so any same-page jump from elsewhere needs to release
  // that lock first, or it gets treated as drift and snapped straight back.
  aside.querySelectorAll('a[href^="#"]:not([data-side-nav-link])').forEach((link) => {
    link.addEventListener("click", (event) => {
      // On mobile the logo's own handler (above) already used this same
      // click to open the menu instead of navigating - don't also scroll.
      if (event.defaultPrevented) return;
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;
      event.preventDefault();
      if (isInfoPageOpen()) closeInfoPage(overlay, { pushState: false });
      window.dispatchEvent(new Event("explore-data:leave"));
      history.pushState(null, "", link.getAttribute("href"));
      target.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    });
  });
  document.addEventListener("click", (event) => {
    if (!window.matchMedia("(max-width: 900px)").matches) return;
    if (isInfoPageOpen()) return;
    if (event.target instanceof Node && !aside.contains(event.target)) closeMobileMenu();
  });
  return aside;
}

// Return the reusable arrow link shown at important chapter transitions.
export function createScrollArrow(target) {
  const link = document.createElement("a");
  link.className = "scroll-arrow";
  link.href = target;
  link.setAttribute("aria-label", "Continue to the next chapter");
  link.innerHTML = '<span>Scroll</span><span aria-hidden="true">\u2193</span>';
  return link;
}
