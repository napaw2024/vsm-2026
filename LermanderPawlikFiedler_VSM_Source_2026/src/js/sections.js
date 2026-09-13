import { sections, stories, exploreData } from "./content.js";
import { createScrollArrow } from "./navigation.js";

function baseSection(index) {
  const definition = sections[index];
  const section = document.createElement("section");
  section.id = definition.id;
  section.className = `story-section ${definition.className}`;
  section.dataset.theme = definition.theme;
  section.dataset.section = definition.id;
  return section;
}
// Create the opening video section.
function createIntro() {
  const section = baseSection(0);
  section.innerHTML = `
  <video class="intro-section__video" autoplay muted playsinline preload="auto" aria-label="Introductory forest film">
    <source src="media/start_first.webm" type="video/webm" />
  </video>
  <div class="intro-section__heading">
    <h1>Fragmented Reality</h1>
    <p>Explore forest fragmentation based on scientific data.</p>
  </div>
`;
  section.append(createScrollArrow("#introduction-sequence"));
  return section;
}
// Create the layered intro PNG sequence; scrolling later changes frame opacity.
function createImageSequence() {
  const section = baseSection(1);
  section.id = "introduction-sequence";
  section.dataset.section = "introduction";
  const frames = Array.from({ length: 6 }, (_, index) => {
    const frame = index + 1;
    const mobileSource = frame === 6
      ? `<source media="(max-width: 700px)" srcset="media/intro6_mobile.webp" />`
      : "";
    return `<picture>${mobileSource}<img class="sequence-section__frame${index === 0 ? " is-revealed" : ""}" src="media/intro${frame}.webp" alt="" data-sequence-frame="${index}" style="--frame-layer: ${index}" /></picture>`;
  }).join("");
  section.innerHTML = `
  <div class="sequence-section__stage">
    <div class="sequence-section__media" aria-hidden="true">
      ${frames}
    </div>
    <div class="sequence-section__texts">
      <div class="sequence-section__text" data-sequence-text="0">
        <p>These are the two perspectives on land fragmentation, which describes the disruption of natural ecological connections caused by humans.</p>
      </div>
      <div class="sequence-section__text" data-sequence-text="1">
        <p>Let’s experience fragmentation through the eyes of the lynx on their route from the Bavarian Forest to the Harz Mountains.</p>
      </div>
      <div class="sequence-section__text" data-sequence-text="2">
        <p>The lynx populations in these areas of Germany are so isolated from one another that natural genetic exchange is virtually impossible, which increases the risk of inbreeding and genetic erosion.</p>
      </div>
    </div>
  </div>
`;
  return section;
}
// Create all five story cards inside one sticky scrollytelling chapter.
function createStorySections() {
  const section = document.createElement("section");
  section.id = "perspective-shift";
  section.className = "story-section story-chapter-section story-chapter-section--journey";
  section.dataset.theme = "dark";
  section.dataset.section = "perspective-shift";
  const cards = stories.map((story, index) => `
    <article class="story-card" data-story-card="${index}">
      <h2>${story.title}</h2>
      <p>${story.copy}</p>
      <ul class="story-card__facts">
        ${story.facts.map((fact) => `<li>${fact}</li>`).join("")}
      </ul>
    </article>
  `).join("");
  const sharedAnimationSrc = stories.find((story) => story.animation?.src)?.animation.src;
  const media = stories.map((story, index) => {
    const visual = `<img class="story-chapter-section__visual" src="${story.image}" alt="" decoding="async" />`;
    const audio = story.audio?.src
      ? `<audio data-story-audio="${index}" src="${story.audio.src}" preload="metadata"></audio>`
      : "";
    return `<div class="story-chapter-section__media-item" data-story-media="${index}">${visual}${audio}</div>`;
  }).join("");
  // The cards are visually stacked, so separate document-positioned trigger
  // elements give Scrollama one real scroll range per story.
  const storyScrollRange = 88;
  const triggers = stories.map((story, index) => `
    <div class="story-scroll-trigger" data-story-trigger="${index}" data-offset="${story.scrollOffset ?? 0.55}" style="--story-trigger-start: ${index * (storyScrollRange / stories.length)}%; --story-trigger-size: ${storyScrollRange / stories.length}%;" aria-hidden="true"></div>
  `).join("");
  section.innerHTML = `
    <div class="story-chapter-section__stage">
      <div class="story-chapter-section__panel">${cards}</div>
      <div class="story-chapter-section__media" aria-hidden="true">
        ${media}
        ${sharedAnimationSrc ? `<video class="story-chapter-section__visual story-chapter-section__shared-animation" data-story-shared-animation src="${sharedAnimationSrc}" poster="${stories[0]?.image ?? ""}" muted playsinline preload="metadata" aria-label="Story animation"></video>` : ""}
      </div>
      <div class="story-outro">
        <picture>
          <source media="(max-width: 700px)" srcset="media/intro8_mobile.webp" />
          <img class="story-outro__image" src="media/intro8.webp" alt="" aria-hidden="true" />
        </picture>
        <p class="story-outro__text">
          Your journey is completed.<br />
          You reached the other side.<br />
          But in reality, many lynx never do.
        </p>
        <a class="scroll-arrow story-outro__arrow" href="#route" aria-label="Explore the data in the next part">
          <span>Explore the data in the next part</span>
          <span aria-hidden="true">&darr;</span>
        </a>
      </div>
    </div>
    ${triggers}
  `;
  return [section];
}
// Build the combined barrier, forest, pseudo-relief, and mesh-size map chapter.
function createMap() {
  const section = baseSection(4);
  section.id = "route";
  section.dataset.section = "route";
  section.innerHTML = `
  <div class="map-section__stage">
    <div class="map-section__copy">
      <div class="map-section__step map-section__step--barriers">
        <div class="map-section__title-row">
          <h2>
            <span class="map-section__marks" aria-hidden="true">
              <img class="map-section__mark" src="media/route.svg" alt="" />
              <img class="map-section__mark" src="media/bar_types.svg" alt="" />
            </span><span class="map-section__title-text">The Route: Barrier Types</span>
          </h2>
        </div>
        <div class="map-section__intro-copy">
          <p>During your journey, you encountered various types and barrier strengths, each affecting your movement and perception in different ways.</p>
          <p>In reality, however, a dispersing lynx would face many more barriers.</p>
        </div>
      </div>
      <div class="map-section__step map-section__step--intro map-section__intro">
        <div class="map-section__title-row map-section__forest-title">
          <h2><span class="map-section__marks" aria-hidden="true"><img class="map-section__mark" src="media/forests.svg" alt="" /></span><span class="map-section__title-text">Germany’s Federal States: Forests</span></h2>
        </div>
        <div class="map-section__intro-copy">
          <p>To explore the whole picture of fragmentation in Germany, we first look at the different indicators.</p>
          <p>A ‘good forest’, which is essential for biodiversity, is considered to be an area above 50 km\xB2.</p>
        </div>
      </div>
      <div class="map-section__step map-section__step--detail">
        <p class="map-section__reveal-text">If we only consider forests larger than 50 km\xB2, this is what the total area looks like.</p>
        <p class="map-section__facts">The indicator measures the Percentage of Undivided Forests relative to Total Land Area.</p>
      </div>
      <div class="map-section__step map-section__step--pseudo">
        <div class="map-section__title-row map-section__pseudo-title">
          <h2><span class="map-section__marks" aria-hidden="true"><img class="map-section__mark" src="media/stubroads.svg" alt="" /></span><span class="map-section__title-text">Hidden fragmentation: Stub roads and Pseudo-relief</span></h2>
        </div>
        <p class="map-section__reveal-text">It’s not just the forest size that matters; shape has an impact too.</p>
        <p class="map-section__reveal-text map-section__stub-copy">So-called stub roads are not classified as fragmentation, yet they significantly reduce the depth of quiet, unfragmented core areas.</p>
        <p class="map-section__facts map-section__pseudo-facts-copy">Pseudo-relief and mean distance to the nearest fragmented area are used to better capture the effect of stub roads. High pseudo-volume (white) marks a compact area with a large, deep core far from human disturbance. Low pseudo-volume (red) marks an area that is either narrow or “punctured” by stub roads.</p>
      </div>
      <div class="map-section__step map-section__step--mesh">
        <div class="map-section__title-row map-section__mesh-title">
          <h2><span class="map-section__marks" aria-hidden="true"><img class="map-section__mark" src="media/diagonal.svg" alt="" /><img class="map-section__mark" src="media/meshsize.svg" alt="" /></span><span class="map-section__title-text">Mesh size</span></h2>
        </div>
        <p class="map-section__reveal-text map-section__mesh-intro-copy">To gain a fuller picture of fragmentation, scientists use the indicator mesh sizes. This makes it easier to compare states.</p>
        <p class="map-section__facts map-section__mesh-fact map-section__mesh-fact--intro">Effective mesh size quantifies landscape fragmentation by estimating the probability that two randomly chosen points remain within the same contiguous habitat patch.</p>
        <video class="map-section__mesh-animation" src="media/meshsize.mp4" autoplay muted loop playsinline aria-label="Mesh-size animation"></video>
        <p class="map-section__facts map-section__mesh-fact map-section__mesh-fact--outro">Larger mesh sizes indicate lower fragmentation, greater ecological connectivity, and better conditions for wildlife movement.</p>
        <p class="map-section__reveal-text map-section__mesh-route-copy">The original route of the lynx passes through two federal states which are among the least fragmented regions.</p>
        <p class="map-section__reveal-text map-section__mesh-bayern-copy">Bayern, with a mesh size of <strong>8,47</strong> km².</p>
        <p class="map-section__reveal-text map-section__mesh-thueringen-copy">Thüringen, with a mesh size of <strong>7,38</strong> km².</p>
        <div class="map-section__mesh-diagonal-step">
          <p class="map-section__reveal-text">To make this number of km² more relatable, imagine walking the distance diagonally, as this is the longest distance in a square-shaped geometry.</p>
          <video class="map-section__diagonal-animation" src="media/diagonal.mp4" autoplay muted loop playsinline aria-label="Diagonal walking-distance animation"></video>
          <p class="map-section__facts">The walking pace used for the calculation<br class="mobile-only-break" /> is 5 km/h.</p>
          <p class="map-section__reveal-text map-section__mesh-bayern-time">It would take around <strong>49</strong> minutes to walk undisturbed in Bayern without encountering any fragmentation barriers.</p>
          <p class="map-section__reveal-text map-section__mesh-thueringen-time">In Thüringen it would take around <strong>46</strong> minutes.</p>
        </div>
      </div>
    </div>
    <div class="map-section__media">
      <div class="forest-map" aria-live="polite">
        <p class="forest-map__status">Loading forest data…</p>
        <svg class="forest-map__svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Forests in Germany" aria-describedby="forest-map-description">
          <desc id="forest-map-description">An SVG map showing Germany’s federal states and forest areas. Scrolling changes the display from all forests to forests larger than 50 square kilometres.</desc>
          <defs class="forest-map__mesh-defs"></defs>
          <g class="forest-map__layer forest-map__layer--barriers"></g>
          <g class="forest-map__layer forest-map__layer--all"></g>
          <g class="forest-map__layer forest-map__layer--route"></g>
          <g class="forest-map__layer forest-map__layer--large"></g>
          <g class="forest-map__layer forest-map__layer--zoom-detail"></g>
          <g class="forest-map__layer forest-map__layer--mesh"></g>
          <g class="forest-map__layer forest-map__layer--states"></g>
          <g class="forest-map__layer forest-map__layer--mesh-labels"></g>
          <g class="forest-map__layer forest-map__layer--ranking"></g>
        </svg>
        <div class="forest-map__mesh-labels-html" aria-hidden="true"></div>
        <div class="forest-map__ranking-labels-html" aria-hidden="true"></div>
        <div class="forest-map__mesh-legend" aria-label="Mesh-size scale from highest to lowest">
          <div class="forest-map__mesh-legend-row">
            <div class="forest-map__mesh-legend-title">
              <img src="media/meshsize-purple.svg" alt="" />
              <span>Mesh size</span>
            </div>
          </div>
          <div class="forest-map__mesh-legend-scale">
            <span>Highest mesh size</span>
            <span class="forest-map__mesh-legend-arrow" aria-hidden="true">→</span>
            <span>Lowest mesh size</span>
          </div>
        </div>
        <div class="pseudorelief-model" aria-label="Rotating three-dimensional pseudorelief model"></div>
        <span class="pseudorelief-callout__label">Stub roads</span>
        <svg class="pseudorelief-callout" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g class="pseudorelief-callout__leader pseudorelief-callout__leader--one">
            <path data-stub-path="0" d="M 8 15 L 28 15 L 54 27" />
            <circle data-stub-dot="0" cx="54" cy="27" r="0.45" />
          </g>
          <g class="pseudorelief-callout__leader pseudorelief-callout__leader--two">
            <path data-stub-path="1" d="M 28 15 L 42 36" />
            <circle data-stub-dot="1" cx="42" cy="36" r="0.45" />
          </g>
          <g class="pseudorelief-callout__leader pseudorelief-callout__leader--three">
            <path data-stub-path="2" d="M 28 15 L 38 27" />
            <circle data-stub-dot="2" cx="38" cy="27" r="0.45" />
          </g>
        </svg>
        <div class="pseudorelief-calibration" hidden>
          <strong>Stub-road anchors</strong>
          <span>Click three locations on the top model.</span>
          <button type="button" data-reset-stub-anchors>Reset points</button>
        </div>
        <div class="pseudorelief-annotation pseudorelief-annotation--low">
          <strong>Low pseudo volume</strong>
          <span>High potential of human disturbance</span>
        </div>
        <div class="pseudorelief-annotation pseudorelief-annotation--high">
          <strong>High pseudo volume</strong>
          <span>Far from human disturbance</span>
        </div>
      </div>
      <div class="barrier-breakdown" aria-label="Barrier types along the route: 79 streets, 48 settlements, 13 railways, and 2 airports.">
        <div class="barrier-breakdown__item barrier-breakdown__item--streets" tabindex="0" style="--barrier-share: 56" title="79 Streets (56 %)">
          <span>79 Streets</span><strong>(56 %)</strong>
        </div>
        <div class="barrier-breakdown__item barrier-breakdown__item--settlements" tabindex="0" style="--barrier-share: 34" title="48 Settlements (34 %)">
          <span>48 Settlements</span><strong>(34 %)</strong>
        </div>
        <div class="barrier-breakdown__item barrier-breakdown__item--railways" tabindex="0" style="--barrier-share: 9" title="13 Railways (9 %)">
          <span>13 Railways</span><strong>(9 %)</strong>
        </div>
        <div class="barrier-breakdown__item barrier-breakdown__item--airports" tabindex="0" style="--barrier-share: 1" title="2 Airports (1 %)">
          <span>2 Airports</span><strong>(1 %)</strong>
        </div>
      </div>
    </div>
  </div>
  <div class="map-section__triggers" aria-hidden="true">
    <div class="map-scroll-step" data-map-step="-2"></div>
    <div class="map-scroll-step" data-map-step="-1"></div>
    <div id="fragmentation" class="map-scroll-step" data-map-step="0"></div>
    <div class="map-scroll-step" data-map-step="1"></div>
    <div class="map-scroll-step" data-map-step="2"></div>
    <div class="map-scroll-step" data-map-step="3"></div>
    <div class="map-scroll-step" data-map-step="4"></div>
    <div class="map-scroll-step map-scroll-step--hold" data-map-step="5"></div>
    <div class="map-scroll-step" data-map-step="6"></div>
    <div class="map-scroll-step" data-map-step="7"></div>
    ${window.matchMedia("(max-width: 900px)").matches ? '<div class="map-scroll-step map-scroll-step--mobile-mesh-detail" data-map-step="7.5"></div>' : ""}
    <div class="map-scroll-step" data-map-step="8"></div>
    <div class="map-scroll-step" data-map-step="9"></div>
    <div class="map-scroll-step" data-map-step="10"></div>
    <div class="map-scroll-step" data-map-step="11"></div>
    <div class="map-scroll-step" data-map-step="12"></div>
    <div class="map-scroll-step" data-map-step="13"></div>
    <div class="map-scroll-step map-scroll-step--hold" data-map-step="14"></div>
  </div>
`;
  return section;
}

function createExploreData() {
  const section = document.createElement("section");
  section.id = "explore-data";
  section.className = "story-section explore-data-section";
  section.dataset.theme = "light";
  section.dataset.section = "explore-data";
  section.innerHTML = `
    <div class="explore-data is-all-states" aria-live="polite">
      <div class="explore-data__stage">
        <div class="explore-data__copy">
          <div class="explore-data__title-row">
            <h2>
              <span class="explore-data__marks" aria-hidden="true">
                <img class="explore-data__mark" src="media/explore.svg" alt="" />
              </span><span class="explore-data__title-text">${exploreData.detail.heading}</span>
            </h2>
          </div>
          <p class="explore-data__intro-copy">${exploreData.detail.introCopyRanking}</p>
          <p class="explore-data__overview-caption"></p>
          <div class="explore-data__overview-frame">
            <div class="explore-data__overview">
              <div class="explore-data__overview-zoom">
                <img class="explore-data__overview-image" alt="" />
                <div class="explore-data__overview-square" aria-hidden="true"></div>
              </div>
            </div>
            <div class="explore-data__overview-nav">
              <button type="button" class="explore-data__overview-prev" aria-label="${exploreData.detail.overviewPrevLabel}"><img src="media/arrow_left.svg" alt="" /></button>
              <button type="button" class="explore-data__overview-next" aria-label="${exploreData.detail.overviewNextLabel}"><img src="media/arrow_right.svg" alt="" /></button>
            </div>
          </div>
        </div>
        <div class="explore-data__media">
          <div class="explore-data__header">
            <button type="button" class="explore-data__header-back">
              <span class="explore-data__header-back-arrow" aria-hidden="true">&larr;</span>
              <span>${exploreData.detail.backLabel}</span>
            </button>
            <div class="explore-data__header-state">
              <span class="explore-data__state-name">—</span>
            </div>
          </div>
          <div class="explore-data__cards">
            <div class="explore-data__card" data-card="mesh_size">
              <span class="explore-data__card-label">${exploreData.detail.cardLabels.mesh_size}</span>
              <span class="explore-data__card-value">—</span>
            </div>
            <div class="explore-data__card" data-card="walking_time">
              <span class="explore-data__card-label">${exploreData.detail.cardLabels.walking_time}<span class="explore-data__info-icon" tabindex="0" role="button" aria-label="${exploreData.detail.walkingTimeTooltip}">
                  <svg class="explore-data__info-icon-svg" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.3" />
                    <circle cx="8" cy="4.8" r="0.9" fill="currentColor" />
                    <rect x="7.25" y="7" width="1.5" height="5" rx="0.75" fill="currentColor" />
                  </svg>
                  <span class="explore-data__tooltip" role="tooltip">${exploreData.detail.walkingTimeTooltip}</span>
                </span></span>
              <span class="explore-data__card-value">—</span>
            </div>
            <div class="explore-data__card" data-card="pct_unfragmented">
              <span class="explore-data__card-label">${exploreData.detail.cardLabels.pct_unfragmented}</span>
              <span class="explore-data__card-value">—</span>
            </div>
            <div class="explore-data__card explore-data__card--highlight" data-card="unfragmented_km2">
              <span class="explore-data__card-label">${exploreData.detail.cardLabels.unfragmented_km2}</span>
              <span class="explore-data__card-value">—</span>
            </div>
          </div>
          <div class="explore-data__legend" aria-label="Mesh-size scale from highest to lowest and forest-patch symbol">
            <div class="explore-data__legend-mesh">
              <div class="explore-data__legend-title"><img class="explore-data__legend-icon" src="media/meshsize-purple.svg" alt="" /><span>${exploreData.detail.legend.mesh}</span></div>
              <div class="explore-data__legend-scale">
                <span>${exploreData.ranking.scaleHigh}</span>
                <span class="explore-data__legend-arrow" aria-hidden="true">→</span>
                <span>${exploreData.ranking.scaleLow}</span>
              </div>
            </div>
            <span class="explore-data__legend-item"><i class="explore-data__legend-swatch explore-data__legend-swatch--patch"></i>${exploreData.detail.legend.patch}</span>
          </div>
          <div class="explore-data__map-wrap">
            <svg class="explore-data__map-svg" viewBox="0 0 760 480" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mesh size and large forest patches">
              <defs class="explore-data__mesh-defs"></defs>
              <g class="explore-data__layer explore-data__layer--boundary"></g>
              <g class="explore-data__layer explore-data__layer--patches"></g>
            </svg>
            <p class="explore-data__status">${exploreData.detail.loadingStatus}</p>
          </div>
          <div class="explore-data__state-nav">
            <button type="button" class="explore-data__state-prev" aria-label="${exploreData.detail.statePrevLabel}"><img src="media/arrow_left.svg" alt="" /></button>
            <button type="button" class="explore-data__state-next" aria-label="${exploreData.detail.stateNextLabel}"><img src="media/arrow_right.svg" alt="" /></button>
          </div>
          <div class="explore-data__ranking-wrap">
            <div class="explore-data__ranking-scroll" tabindex="0" role="region" aria-label="All German states ranked by mesh size, scroll to see more">
              <svg class="explore-data__ranking-svg" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label="All German states ranked by mesh size">
                <defs class="explore-data__ranking-mesh-defs"></defs>
                <g class="explore-data__ranking-states"></g>
              </svg>
            </div>
            <div class="explore-data__ranking-nav">
              <button type="button" class="explore-data__ranking-prev" aria-label="${exploreData.ranking.prevLabel}"><img src="media/arrow_left.svg" alt="" /></button>
              <button type="button" class="explore-data__ranking-next" aria-label="${exploreData.ranking.nextLabel}"><img src="media/arrow_right.svg" alt="" /></button>
            </div>
          </div>
        </div>
      </div>
      <a class="scroll-arrow is-visible explore-data__continue" href="#conclusion" aria-label="Finish the story">
        <span>${exploreData.detail.continueLabel}</span>
        <span aria-hidden="true">&darr;</span>
      </a>
    </div>
  `;
  return section;
}
// Create the final eight-image sequence and its four centered text passages.
function createEndSequence() {
  const section = document.createElement("section");
  section.id = "conclusion";
  section.className = "story-section end-sequence-section";
  section.dataset.theme = "light";
  section.dataset.section = "explore-data";
  const media = Array.from({ length: 8 }, (_, index) => {
    const classes = `end-sequence-section__media${index === 0 ? " is-revealed" : ""}`;
    if (index === 7) {
      return `
        <picture class="${classes}" data-end-media="${index}" style="--end-layer: ${index}">
          <source media="(max-width: 700px)" srcset="media/end8_mobile.webp" />
          <img src="media/end8.webp" alt="" loading="lazy" decoding="async" />
        </picture>
      `;
    }
    return `<img class="${classes}" data-end-media="${index}" src="media/end${index + 1}.webp" alt="" loading="lazy" decoding="async" style="--end-layer: ${index}" />`;
  }).join("");
  section.innerHTML = `
    <div class="end-sequence-section__stage">
      <div class="end-sequence-section__media-stack" aria-hidden="true">${media}</div>
      <div class="end-sequence-section__texts">
        <p class="end-sequence-section__text" data-end-text="0">Although the two German federal states (Bundesländer) along the lynx migration route are generally less fragmented compared to others, there are still a significant number of barriers along the route that are often impassable and constitute a major obstacle to successful movement and dispersal for animals.</p>
        <p class="end-sequence-section__text" data-end-text="1">Preserving large, unfragmented forests is essential for wildlife and the environment. Yet, modern society is under constant pressure from competing land use demands, and the expansion of infrastructure risks further severing ecological connections and increasing the barrier strength of existing corridors.</p>
        <p class="end-sequence-section__text" data-end-text="2">Mitigation measures such as wildlife bridges, carefully located solar parks, and reduced deforestation are therefore key to preventing further fragmentation, so that nature and wildlife can thrive.</p>
        <p class="end-sequence-section__text end-sequence-section__text--final" data-end-text="3">All actors with their individual needs within the interconnected synergistic natural system should be treated as equals.</p>
      </div>
    </div>
  `;
  return section;
}
// Return every page section in its final document order. About, References,
// and Sources are not part of this scrolling flow - see info-pages.js.
export function createSections() {
  return [
    createIntro(),
    createImageSequence(),
    ...createStorySections(),
    createMap(),
    createExploreData(),
    createEndSequence()
  ];
}
