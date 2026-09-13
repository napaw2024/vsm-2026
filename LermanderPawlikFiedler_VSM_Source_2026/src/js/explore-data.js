import { geoIdentity, geoPath, json, select, zoom, zoomIdentity } from "d3";
import { feature } from "topojson-client";
import { exploreData as exploreDataContent } from "./content.js";

const GERMANY_TOPOJSON_URL = "data/wald_expo/deut.topojson";
const DEFAULT_STATE_AGS = "09";
const MAP_VIEW_SIZE = 760;
// Bayern renders at 60% of its original size (712px inner side at margin 24
// -> 427px), asymmetric so it sits near the top of the box (close to the
// legend above it) instead of centred with empty space on all sides. The
// SVG's own viewBox height is also trimmed to just past this box, so there's
// no leftover dead space below it for preserveAspectRatio to centre around.
const MAP_INNER_SIDE = 712 * 0.6;
const MAP_MARGIN_TOP = 20;
const MAP_MARGIN_X = (MAP_VIEW_SIZE - MAP_INNER_SIDE) / 2;
const MESH_CSV_URL = "data/U06KG__2024.csv";
// Only used as a walking-time fallback for states missing state_stats.json.
const WALK_SPEED_KMH = 5;
// Height of the "all states" ranking canvas; width is derived from the
// states' own summed widths so the row can overflow into horizontal scroll.
// The SVG's rendered CSS height is fixed by its flex container regardless of
// this number, so shrinking the viewBox's height denominator (states' own
// size in viewBox units is unchanged) is what makes states render bigger -
// /1.1 here is a deliberate +10% render-size bump.
const RANKING_VIEW_HEIGHT = 700 / 1.1;
const RANKING_GAP = 24;
// Extra room past the last (smallest-mesh) state so it isn't flush against
// the edge of the scrollable area when scrolled all the way right.
const RANKING_TRAILING_SPACE = 60;
const RANKING_SCROLL_STEP = 360;
// Kept in sync with the transition duration on the detail/ranking elements
// in sections.css, so the display swap waits for the fade-out to finish.
const RANKING_FADE_MS = 220;
const MAP_ZOOM_MAX = 6;
const OVERVIEW_ZOOM_MAX = 6;
// Keep the largest real-world patch inside the overview frame. Zoom remains
// available for inspection, but selecting a state must not begin cropped.
const OVERVIEW_BASE_SCALE = 1;
// Largest patch dimension in the packaged datasets, precomputed at build
// time so Explore does not need to parse every state's GeoJSON on startup.
const PATCH_SCALE_REFERENCE_M = 34427.5;
const DETAIL_VIEW_SELECTOR = ".explore-data__header, .explore-data__cards, .explore-data__map-wrap, .explore-data__overview, .explore-data__overview-caption, .explore-data__overview-nav, .explore-data__state-nav";
const RANKING_VIEW_SELECTOR = ".explore-data__ranking-wrap";

// Every state's assets live under its own lower-cased folder name, e.g.
// "Nordrhein-Westfalen" -> /data/satellite/nordrhein-westfalen/. The folder
// names committed with this project use precomposed Unicode (NFC), matching
// the names from the CSV. Using NFD would produce a different URL for states
// with umlauts (Baden-Württemberg, Thüringen) and make their data 404.
function dataRootFor(stateName) {
  return `data/satellite/${stateName.toLowerCase().normalize("NFC")}`;
}

// Fits one state's boundary to the detail map's display box. Used both to
// actually position/size that state's own boundary and patches, and - once,
// for Bayern only - to derive a fixed reference scale for the mesh pattern
// (see loadStateDetail): reusing this same box means that reference is
// exactly what Bayern's own projection produces, so Bayern's appearance is
// unchanged by the fix.
function fitStateProjection(stateFeature) {
  return geoIdentity()
    .reflectY(true)
    .fitExtent([[MAP_MARGIN_X, MAP_MARGIN_TOP], [MAP_VIEW_SIZE - MAP_MARGIN_X, MAP_MARGIN_TOP + MAP_INNER_SIDE]], stateFeature);
}

function formatKm2(value) {
  return Number.isFinite(value) ? `${value.toFixed(2).replace(".", ",")} km²` : "—";
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1).replace(".", ",")}%` : "—";
}

// U06KG__2024.csv uses German `;`-separated rows and comma decimals.
function parseMeshCsv(text) {
  return new Map(
    text
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .filter((line) => /^\d+;/.test(line.trim()))
      .map((line) => {
        const [, stateCode, stateName, rawValue] = line.split(";");
        return [stateCode, { stateName, valueKm2: Number(rawValue.replace(",", ".").trim()) }];
      })
  );
}

function meshPattern(defsSelection, id, valueKm2, projectionScale) {
  const cellSideMetres = Math.sqrt(valueKm2 * 1e6);
  const cellSidePixels = cellSideMetres * projectionScale;
  const pattern = defsSelection.append("pattern")
    .attr("id", id)
    .attr("patternUnits", "userSpaceOnUse")
    .attr("width", cellSidePixels)
    .attr("height", cellSidePixels);
  pattern.append("path")
    .attr("d", `M ${cellSidePixels} 0 L 0 0 0 ${cellSidePixels}`)
    .attr("class", "explore-data__mesh-line");
  return cellSidePixels;
}

export async function setupExploreData() {
  const root = document.querySelector(".explore-data");
  const svg = root?.querySelector(".explore-data__map-svg");
  const rankingSvg = root?.querySelector(".explore-data__ranking-svg");
  const status = root?.querySelector(".explore-data__status");
  if (!root || !svg || !rankingSvg) return;

  // Explore must always enter on the ranking. Keep this explicit in the
  // setup as well as in the initial markup so an earlier detail selection
  // can never flash while the data is loading or when setup is re-run.
  root.classList.add("is-all-states");
  root.removeAttribute("data-current-ags");
  const introCopy = root.querySelector(".explore-data__intro-copy");
  if (introCopy) introCopy.innerHTML = exploreDataContent.detail.introCopyRanking;

  try {
    const [germanyTopology, meshCsvText] = await Promise.all([
      json(GERMANY_TOPOJSON_URL),
      fetch(MESH_CSV_URL).then((response) => response.text())
    ]);

    const germany = feature(germanyTopology, germanyTopology.objects.data);
    const meshValues = parseMeshCsv(meshCsvText);

    // Each state's boundary is fit to the same pixel box, so a tiny state
    // (e.g. Berlin) ends up zoomed in far more than a huge one (e.g.
    // Nordrhein-Westfalen) just to fill it. Sizing the mesh pattern off that
    // per-state zoom (projection.scale()) would make cell size reflect the
    // state's physical size rather than its actual mesh value - a smaller,
    // more zoomed-in state could show a coarser grid than a state with a
    // genuinely bigger mesh. Fixing the pattern's scale to Bayern's own
    // (used as the default/reference state) keeps it comparable across
    // every state, at the cost of very small or very large states showing a
    // correspondingly sparse or dense grid relative to their own outline -
    // which is the accurate picture, not a bug.
    const bayernFeature = germany.features.find((f) => f.properties.AGS === DEFAULT_STATE_AGS);
    const meshReferenceScale = fitStateProjection(bayernFeature).scale();

    // Render the ranking boundaries immediately. Large per-state forest files
    // are added later during idle time instead of blocking entry into Explore.
    const forestPatchesByState = new Map();
    root._patchScaleReferenceM = PATCH_SCALE_REFERENCE_M;

    const selectState = (ags) => loadStateDetail(root, svg, rankingSvg, germany, meshValues, ags, meshReferenceScale);
    root._selectState = selectState;

    const rankedStates = renderRanking(rankingSvg, germany, meshValues, forestPatchesByState, (ags) => {
      switchExploreDataView(root, false);
      void selectState(ags);
    });
    // Same ranked (mesh-size descending) order as the horizontal ranking
    // list, reused so the desktop state-nav arrows (wireStateNav) step
    // through states in the order the user already sees them ranked in.
    root._rankedStateCodes = rankedStates.map(({ stateCode }) => stateCode);
    wireAllStatesToggle(root);
    wireRankingDrag(root);
    wireMapZoom(root, svg);
    wireOverviewNav(root);
    wireOverviewZoom(root);
    wireStateNav(root, selectState);
    wireFinishStory(root);
    wireScrollLock(root);
    window.addEventListener("resize", () => root._overviewRescale?.());

    status?.remove();
    root.classList.add("is-ready");
    void loadRankingPatchesWhenIdle(root, rankingSvg, meshValues, forestPatchesByState);
  } catch (error) {
    console.error("Unable to render the Explore the Data section", error);
    if (status) status.textContent = exploreDataContent.detail.errorStatus;
  }
}

// Loads and renders one state's detail view (cards, map, forest overview).
// Called once up front for the default state, then again on every ranking
// click - each call fully replaces the previous state's content in place.
async function loadStateDetail(root, svg, rankingSvg, germany, meshValues, ags, meshReferenceScale, highlightRankingState = true) {
  const stateFeature = germany.features.find((f) => f.properties.AGS === ags);
  const meshEntry = meshValues.get(ags);
  if (!stateFeature || !meshEntry) throw new Error(`No boundary or mesh value found for AGS ${ags}`);
  const dataRoot = dataRootFor(meshEntry.stateName);

  const [stateStats, forestPatches] = await Promise.all([
    fetchStateStats(dataRoot, meshEntry),
    json(`${dataRoot}/forest_patches.geojson`).catch(() => null)
  ]);

  const projection = fitStateProjection(stateFeature);
  const path = geoPath(projection);

  root.dataset.dataRoot = dataRoot;
  root.dataset.currentAgs = ags;
  renderCards(root, stateStats);
  const patchSelection = renderMap(svg, path, stateFeature, forestPatches, stateStats.meff_km2, meshReferenceScale);
  showRandomPatch(root, patchSelection);
  if (highlightRankingState) setActiveRankingState(rankingSvg, ags);
  root._resetMapZoom?.();
  return forestPatches;
}

// state_stats.json isn't complete for every state yet (Mecklenburg-
// Vorpommern, at least, is missing meff_km2/walking_time_min while still
// having real unfragmented-forest figures) - fill in just the missing
// fields from the mesh-size CSV (which does cover all 16) rather than
// discarding the rest of a state's real published stats whenever any one
// field is absent. Fields with no CSV equivalent (unfragmented-forest
// share/area) stay unset if genuinely missing, rather than guessing.
async function fetchStateStats(dataRoot, meshEntry) {
  const cellSideMetres = Math.sqrt(meshEntry.valueKm2 * 1e6);
  const diagonalMetres = cellSideMetres * Math.SQRT2;
  const fallback = {
    state: meshEntry.stateName,
    meff_km2: meshEntry.valueKm2,
    walking_time_min: (diagonalMetres / 1000 / WALK_SPEED_KMH) * 60,
    unfragmented_forest_pct: null,
    unfragmented_forest_km2: null
  };
  try {
    const stats = await json(`${dataRoot}/state_stats.json`);
    return { ...fallback, ...stats };
  } catch {
    return fallback;
  }
}

// Picks one forest patch to show by default rather than a whole-state image.
// Also stashes the full patch list on root so the overview's prev/next
// buttons (see wireOverviewNav) can step through them without needing their
// own reference to the current state's patchSelection.
function showRandomPatch(root, patchSelection) {
  const nodes = patchSelection.nodes();
  root._patchNodes = nodes;
  const nav = root.querySelector(".explore-data__overview-nav");
  if (!nodes.length) {
    root._patchIndex = -1;
    if (nav) nav.style.display = "none";
    clearOverview(root);
    return;
  }
  if (nav) nav.style.display = "";
  // Start with a representative patch rather than a random outlier. Random
  // selection could make a state's first image unexpectedly enormous.
  const byArea = nodes
    .map((node, index) => ({ index, area: Number(node.__data__?.properties?.area_ha) || 0 }))
    .sort((a, b) => a.area - b.area);
  const index = byArea[Math.floor(byArea.length / 2)].index;
  root._patchIndex = index;
  showPatchInOverview(root, nodes[index].__data__.properties, nodes[index]);
}

// A handful of states (Berlin, Bremen, Hamburg, Saarland, Schleswig-
// Holstein) genuinely have zero forest patches over the 50 km² threshold -
// clear any previous state's leftover image rather than show it stale.
function clearOverview(root) {
  const overview = root.querySelector(".explore-data__overview");
  const image = root.querySelector(".explore-data__overview-image");
  const square = root.querySelector(".explore-data__overview-square");
  const caption = root.querySelector(".explore-data__overview-caption");
  if (overview) overview.style.display = "none";
  if (image) { image.removeAttribute("src"); image.alt = ""; }
  if (square) { square.style.width = "0"; square.style.height = "0"; }
  if (caption) caption.textContent = exploreDataContent.detail.noForestCopy;
  root.querySelectorAll(".explore-data__patch.is-selected").forEach((patch) => patch.classList.remove("is-selected"));
  root._overviewRescale = undefined;
  root._resetOverviewZoom?.();
}

// Steps the overview to the previous/next forest patch, wrapping around at
// either end. Shares state with showRandomPatch/showPatchInOverview via
// root._patchNodes/_patchIndex, so it stays in sync whichever way a patch
// was last selected (random default, clicking the map, or these buttons).
function wireOverviewNav(root) {
  const step = (delta) => {
    const nodes = root._patchNodes;
    if (!nodes || !nodes.length) return;
    root._patchIndex = (root._patchIndex + delta + nodes.length) % nodes.length;
    const node = nodes[root._patchIndex];
    showPatchInOverview(root, node.__data__.properties, node);
    root._centerMapOnPatch?.(node);
  };
  root.querySelector(".explore-data__overview-prev")?.addEventListener("click", () => step(-1));
  root.querySelector(".explore-data__overview-next")?.addEventListener("click", () => step(1));
}

// Desktop-only counterpart to wireOverviewNav (see the CSS swap in
// sections.css): rather than stepping through the current state's forest
// photos, these arrows step through *states* themselves, in the same
// ranked (mesh-size descending) order as the horizontal ranking list
// (root._rankedStateCodes, set once in setupExploreData).
function wireStateNav(root, selectState) {
  const step = (delta) => {
    const codes = root._rankedStateCodes;
    if (!codes || !codes.length) return;
    const currentIndex = codes.indexOf(root.dataset.currentAgs);
    const nextIndex = (currentIndex + delta + codes.length) % codes.length;
    void selectState(codes[nextIndex]);
  };
  root.querySelector(".explore-data__state-prev")?.addEventListener("click", () => step(-1));
  root.querySelector(".explore-data__state-next")?.addEventListener("click", () => step(1));
}

// Crossfades the media panel between the Bayern detail view and the ranked
// overview: fade the current view out, swap which is in the document flow
// once it's invisible, then fade the new one in. Avoids the two views ever
// being stacked on top of each other mid-transition.
// Guards against re-entrant calls while a crossfade is already running (e.g.
// several rapid scroll-up ticks while still on the detail view - see
// preventScrollWheel/-Touch/-Key/-Drift below, which all redirect a first
// scroll-up into this view switch rather than letting the page leave).
let viewTransitionInProgress = false;

function switchExploreDataView(root, toAllStates) {
  if (viewTransitionInProgress || root.classList.contains("is-all-states") === toAllStates) return;
  viewTransitionInProgress = true;
  const outgoing = root.querySelectorAll(toAllStates ? DETAIL_VIEW_SELECTOR : RANKING_VIEW_SELECTOR);
  const incoming = root.querySelectorAll(toAllStates ? RANKING_VIEW_SELECTOR : DETAIL_VIEW_SELECTOR);
  const introCopy = root.querySelector(".explore-data__intro-copy");

  outgoing.forEach((el) => { el.style.opacity = "0"; });
  window.setTimeout(() => {
    root.classList.toggle("is-all-states", toAllStates);
    if (introCopy) introCopy.innerHTML = toAllStates ? exploreDataContent.detail.introCopyRanking : exploreDataContent.detail.introCopy;
    incoming.forEach((el) => { el.style.opacity = "0"; });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        incoming.forEach((el) => { el.style.opacity = "1"; });
        viewTransitionInProgress = false;
      });
    });
  }, RANKING_FADE_MS);
}

// "All States" swaps the media panel between the Bayern detail view and the
// ranked overview in place - no navigation, no scroll, same screen.
function wireAllStatesToggle(root) {
  root.querySelector(".explore-data__header-back")?.addEventListener("click", () => {
    switchExploreDataView(root, true);
  });
  root.querySelector(".explore-data__ranking-prev")?.addEventListener("click", () => {
    root.querySelector(".explore-data__ranking-scroll")?.scrollBy({ left: -RANKING_SCROLL_STEP, behavior: "smooth" });
  });
  root.querySelector(".explore-data__ranking-next")?.addEventListener("click", () => {
    root.querySelector(".explore-data__ranking-scroll")?.scrollBy({ left: RANKING_SCROLL_STEP, behavior: "smooth" });
  });
}

// Click-and-drag panning for the ranking row. Pointer capture is deferred
// until real movement is seen, so a plain click on Bayern's shape still
// reaches its own handler instead of being swallowed as a zero-distance drag.
function wireRankingDrag(root) {
  const scrollEl = root.querySelector(".explore-data__ranking-scroll");
  if (!scrollEl) return;
  let isDown = false;
  let dragMoved = false;
  let startX = 0;
  let startScrollLeft = 0;
  let pointerId = null;

  scrollEl.addEventListener("pointerdown", (event) => {
    isDown = true;
    dragMoved = false;
    startX = event.clientX;
    startScrollLeft = scrollEl.scrollLeft;
    pointerId = event.pointerId;
  });
  scrollEl.addEventListener("pointermove", (event) => {
    if (!isDown) return;
    const deltaX = event.clientX - startX;
    if (!dragMoved && Math.abs(deltaX) > 6) {
      dragMoved = true;
      scrollEl.setPointerCapture(pointerId);
      scrollEl.classList.add("is-dragging");
    }
    if (dragMoved) {
      scrollEl.scrollLeft = startScrollLeft - deltaX;
      event.preventDefault();
    }
  });
  const endDrag = () => {
    isDown = false;
    scrollEl.classList.remove("is-dragging");
  };
  scrollEl.addEventListener("pointerup", endDrag);
  scrollEl.addEventListener("pointercancel", endDrag);
  scrollEl.addEventListener("click", (event) => {
    if (dragMoved) event.stopPropagation();
  }, true);
}

// Lets the user zoom into the detail map (wheel/pinch/drag-to-pan), but
// scaleExtent's floor of 1 means "zooming out" only ever returns to the
// natural framing - it can never shrink past it. The transform is applied as
// a CSS transform on the <svg> element itself (not an inner viewBox-space
// <g>), so it's in the same CSS-pixel coordinate system d3-zoom's pointer
// tracking already uses - no viewBox-vs-screen-pixel unit conversion needed.
function wireMapZoom(root, svg) {
  const wrap = svg.closest(".explore-data__map-wrap");
  if (!wrap) return;
  svg.style.transformOrigin = "0 0";
  let currentTransform = zoomIdentity;
  const zoomBehavior = zoom()
    .scaleExtent([1, MAP_ZOOM_MAX])
    // Wheel and touch/pinch remain handled by d3. Mouse/pen dragging is
    // handled explicitly below because nested interactive patch paths can
    // otherwise prevent d3's legacy mousedown drag from starting reliably.
    .filter((event) => event.type !== "mousedown" && (!event.ctrlKey || event.type === "wheel") && !event.button)
    .on("zoom", (event) => {
      currentTransform = event.transform;
      svg.style.transform = `translate(${event.transform.x}px, ${event.transform.y}px) scale(${event.transform.k})`;
      wrap.classList.toggle("is-zoomed", event.transform.k > 1);
    });
  const applyExtent = () => {
    const rect = wrap.getBoundingClientRect();
    // Keep gesture coordinates current without constraining translation.
    // The previous translateExtent could clamp a valid drag straight back
    // to the centred position, especially with the responsive SVG sizing.
    zoomBehavior.extent([[0, 0], [rect.width, rect.height]]);
  };
  applyExtent();
  window.addEventListener("resize", applyExtent);
  select(wrap).call(zoomBehavior);

  let panPointerId = null;
  let panX = 0;
  let panY = 0;
  wrap.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    panPointerId = event.pointerId;
    panX = event.clientX;
    panY = event.clientY;
    wrap.setPointerCapture(panPointerId);
    wrap.classList.add("is-panning");
    event.preventDefault();
  });
  wrap.addEventListener("pointermove", (event) => {
    if (event.pointerId !== panPointerId) return;
    const dx = event.clientX - panX;
    const dy = event.clientY - panY;
    panX = event.clientX;
    panY = event.clientY;
    select(wrap).call(zoomBehavior.translateBy, dx / currentTransform.k, dy / currentTransform.k);
    event.preventDefault();
  });
  const endPan = (event) => {
    if (event.pointerId !== panPointerId) return;
    if (wrap.hasPointerCapture(panPointerId)) wrap.releasePointerCapture(panPointerId);
    panPointerId = null;
    wrap.classList.remove("is-panning");
  };
  wrap.addEventListener("pointerup", endPan);
  wrap.addEventListener("pointercancel", endPan);

  root._resetMapZoom = () => select(wrap).call(zoomBehavior.transform, zoomIdentity);
  root._centerMapOnPatch = (patchNode) => {
    if (!patchNode || currentTransform.k <= 1) return;
    const patchBounds = patchNode.getBBox();
    const viewBox = svg.viewBox.baseVal;
    const rect = wrap.getBoundingClientRect();
    if (!viewBox.width || !viewBox.height || !rect.width || !rect.height) return;
    const patchCenterX = ((patchBounds.x + patchBounds.width / 2 - viewBox.x) / viewBox.width) * rect.width;
    const patchCenterY = ((patchBounds.y + patchBounds.height / 2 - viewBox.y) / viewBox.height) * rect.height;
    const centredTransform = zoomIdentity
      .translate(
        rect.width / 2 - patchCenterX * currentTransform.k,
        rect.height / 2 - patchCenterY * currentTransform.k
      )
      .scale(currentTransform.k);
    select(wrap).call(zoomBehavior.transform, centredTransform);
  };
}

// Same wheel/pinch/drag-to-pan zoom as the detail map (wireMapZoom above),
// applied to the forest overview photo instead. The transform lands on
// .explore-data__overview-zoom - a plain wrapper around the image and its
// mesh-size square - rather than on .explore-data__overview itself, so the
// container's overflow: hidden keeps clipping the zoomed-in content instead
// of the whole box growing with it. Wired once at setup since the container
// is never replaced, only its image/caption content changes; each new patch
// resets back to unzoomed via root._resetOverviewZoom (see showPatchInOverview
// and clearOverview).
function wireOverviewZoom(root) {
  const container = root.querySelector(".explore-data__overview");
  const layer = root.querySelector(".explore-data__overview-zoom");
  if (!container || !layer) return;
  let appliedTransform = zoomIdentity;
  let isApplyingScale = false;
  const zoomBehavior = zoom()
    .scaleExtent([1, OVERVIEW_ZOOM_MAX])
    .filter((event) => event.type !== "mousedown" && (!event.ctrlKey || event.type === "wheel") && !event.button)
    .on("zoom", (event) => {
      let transform = event.transform;
      const scaleChanged = Math.abs(transform.k - appliedTransform.k) > 0.0001;
      if (scaleChanged && !isApplyingScale) {
        const rect = container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const scaleRatio = event.transform.k / appliedTransform.k;
        // Scale around the viewport centre while retaining whichever image
        // point the user moved there. This avoids drifting back to the
        // image's original centre during zoom-out after a drag.
        transform = zoomIdentity
          .translate(
            centerX - (centerX - appliedTransform.x) * scaleRatio,
            centerY - (centerY - appliedTransform.y) * scaleRatio
          )
          .scale(event.transform.k);
        isApplyingScale = true;
        select(container).call(zoomBehavior.transform, transform);
        isApplyingScale = false;
        return;
      }
      appliedTransform = transform;
      layer.style.transform = `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`;
      container.classList.toggle("is-zoomed", transform.k > 1);
    });
  const applyExtent = () => {
    const rect = container.getBoundingClientRect();
    // Keep pointer geometry responsive, but deliberately leave translation
    // unconstrained. A finite translateExtent pulls a manually panned image
    // back to centre whenever its scale decreases.
    zoomBehavior.extent([[0, 0], [rect.width, rect.height]]);
  };
  applyExtent();
  window.addEventListener("resize", applyExtent);
  select(container).call(zoomBehavior);

  // Explicit mouse/pen panning mirrors the state-map behavior. It remains
  // active only after zooming, while d3 continues to own wheel and pinch.
  let panPointerId = null;
  let panX = 0;
  let panY = 0;
  container.addEventListener("pointerdown", (event) => {
    if (appliedTransform.k <= 1 || event.button !== 0 || event.pointerType === "touch") return;
    panPointerId = event.pointerId;
    panX = event.clientX;
    panY = event.clientY;
    container.setPointerCapture(panPointerId);
    container.classList.add("is-panning");
    event.preventDefault();
  });
  container.addEventListener("pointermove", (event) => {
    if (event.pointerId !== panPointerId) return;
    const dx = event.clientX - panX;
    const dy = event.clientY - panY;
    panX = event.clientX;
    panY = event.clientY;
    select(container).call(zoomBehavior.translateBy, dx / appliedTransform.k, dy / appliedTransform.k);
    event.preventDefault();
  });
  const endPan = (event) => {
    if (event.pointerId !== panPointerId) return;
    if (container.hasPointerCapture(panPointerId)) container.releasePointerCapture(panPointerId);
    panPointerId = null;
    container.classList.remove("is-panning");
  };
  container.addEventListener("pointerup", endPan);
  container.addEventListener("pointercancel", endPan);

  root._resetOverviewZoom = () => select(container).call(zoomBehavior.transform, zoomIdentity);
}

// Plain anchor by default; just make sure the lock releases before it jumps.
function wireFinishStory(root) {
  root.querySelector(".explore-data__continue")?.addEventListener("click", () => {
    beginNavigatingAway();
  });
}

// ---------------------------------------------------------------------------
// Scroll lock: once this screen is fully in view, scrolling *further down*
// (deeper into the story, past this screen) is blocked - the only ways
// past it are the header's back control or the Finish Story link. Scrolling
// *up* is always left alone in the sense that it's never fought to a stop,
// but where it takes the user depends on which sub-view they're on: from the
// detail view, a scroll-up switches to the "All States" ranking view (same
// screen, just the crossfade) instead of leaving the section; only a scroll
// -up from the ranking view actually exits back toward the Fragmentation
// chapter.
//
// Blocking wheel/touchmove/keydown covers the common input paths, but not
// every way a page can scroll - dragging the browser's own scrollbar thumb,
// for one, is a native mousedown/mousemove sequence that never dispatches
// any of those three event types, so it slipped straight through. Rather
// than trying to enumerate every possible input, preventScrollDrift adds a
// second layer that just enforces the *result*: while locked, a "scroll"
// event (fired for literally any reason - scrollbar drag included) that
// left the page further down than the locked position snaps it straight
// back, and one that drifted up while still on the detail view is treated
// the same as any other scroll-up input - redirected into the view switch.
// ---------------------------------------------------------------------------

const SCROLL_LOCK_THRESHOLD = 0.95;
// Long enough to cover the browser's default smooth-scroll duration for the
// header-back jump (the longest of the two escape routes).
const NAVIGATE_AWAY_SUPPRESS_MS = 1500;
// Only the keys that move further down the page are blocked; Up/PageUp/Home
// are left alone so keyboard users can always navigate back out (or, from
// the detail view, into the ranking view - see redirectScrollUp below).
const SCROLL_DOWN_KEYS = new Set(["ArrowDown", "PageDown", "End", " "]);
const SCROLL_UP_KEYS = new Set(["ArrowUp", "PageUp", "Home"]);
let scrollLockActive = false;
let lockedScrollY = 0;
let touchStartY = 0;
// The locked section's root, so the scroll handlers below can tell whether
// a scroll-up should redirect into the ranking view (detail view) or be left
// alone to exit the section (ranking view already showing).
let lockedRoot = null;
// A single scroll-up gesture (trackpad momentum, a held key, several quick
// wheel ticks) fires many events in a row. Without this, the very first
// event switched to the ranking view but the rest of the *same* gesture then
// read "already on the ranking view" and fell straight through, exiting the
// section before the overview had a chance to actually show on screen. This
// cooldown keeps absorbing scroll-up input for a bit after the switch, so
// only a later, distinct scroll-up (after the user has seen the view) exits.
const SCROLL_UP_EXIT_COOLDOWN_MS = 900;
let rankingSwitchedAt = 0;

function isMapGesture(event) {
  return event.target instanceof Element
    && Boolean(event.target.closest(".explore-data__map-wrap, .explore-data__overview"));
}

// Explore always opens and remains on the all-states ranking until the user
// explicitly chooses a state. Downward scrolling must not auto-open one.
function redirectScrollDown() {
  if (!lockedRoot) return false;
  if (lockedRoot.classList.contains("is-all-states")) {
    return true;
  }
  return false;
}

// A scroll-up attempt while still on the detail view switches to the ranking
// view instead of letting the page scroll away. Returns true if it redirected
// or is still being absorbed by the post-switch cooldown above (caller should
// treat the input as consumed), false if the scroll-up should proceed
// normally (already on the ranking view, cooldown elapsed, or nothing locked).
function redirectScrollUp() {
  if (!lockedRoot) return false;
  if (!lockedRoot.classList.contains("is-all-states")) {
    switchExploreDataView(lockedRoot, true);
    rankingSwitchedAt = Date.now();
    return true;
  }
  return Date.now() - rankingSwitchedAt < SCROLL_UP_EXIT_COOLDOWN_MS;
}
// While true, the observer won't re-snap/re-lock. This can't be driven by
// intersection ratio: the panel is shorter than the viewport, so "no longer
// >= 95% visible" isn't reliably true until well after the escape scroll has
// settled - checking it mid-animation just snaps straight back and cancels
// the navigation the user clicked to start. A fixed cooldown sidesteps that.
let isNavigatingAway = false;
let navigatingAwayTimer = null;

// Wheel: deltaY > 0 means scrolling down (content moves up) - block that.
// deltaY < 0 (scrolling up) redirects into the ranking view while still on
// the detail view; once redirectScrollUp returns false, the scroll proceeds.
function preventScrollWheel(event) {
  // d3-zoom owns wheel gestures over either zoomable view. Letting the page
  // scroll lock also interpret them can switch views during map interaction.
  if (isMapGesture(event)) return;
  if (event.deltaY > 0) {
    event.preventDefault();
    redirectScrollDown();
  } else if (event.deltaY < 0 && redirectScrollUp()) {
    event.preventDefault();
  }
}

// Touch has no per-event delta like wheel does, so direction is inferred by
// comparing the current finger position against where the touch started:
// finger moving up the screen scrolls the page down, finger moving down
// scrolls the page up.
function recordTouchStart(event) {
  if (isMapGesture(event)) return;
  touchStartY = event.touches[0]?.clientY ?? 0;
}

function preventScrollTouch(event) {
  // Drag and pinch gestures inside the maps belong to d3-zoom, not to the
  // section-level navigation lock. In particular, a downward map pan used
  // to be mistaken for “return to ranking,” making panning appear broken.
  if (isMapGesture(event)) return;
  const currentY = event.touches[0]?.clientY ?? touchStartY;
  if (currentY < touchStartY) {
    event.preventDefault();
    redirectScrollDown();
  } else if (currentY > touchStartY && redirectScrollUp()) {
    event.preventDefault();
  }
}

function preventScrollKey(event) {
  if (SCROLL_DOWN_KEYS.has(event.key)) {
    event.preventDefault();
    redirectScrollDown();
  } else if (SCROLL_UP_KEYS.has(event.key) && redirectScrollUp()) {
    event.preventDefault();
  }
}

// Catches every other way the page could scroll (scrollbar drag, browser
// extensions, etc.) without going through the handlers above: downward
// drift always snaps back, and upward drift is redirected into the ranking
// view the same way a direct scroll-up input would be, while still on the
// detail view.
function preventScrollDrift() {
  if (window.scrollY > lockedScrollY) {
    redirectScrollDown();
    window.scrollTo({ top: lockedScrollY, left: window.scrollX, behavior: "instant" });
  } else if (window.scrollY < lockedScrollY) {
    if (redirectScrollUp()) {
      window.scrollTo({ top: lockedScrollY, left: window.scrollX, behavior: "instant" });
    }
  }
}

function lockScroll(root) {
  lockedScrollY = window.scrollY;
  lockedRoot = root;
  if (scrollLockActive) return;
  scrollLockActive = true;
  window.addEventListener("wheel", preventScrollWheel, { passive: false });
  window.addEventListener("touchstart", recordTouchStart, { passive: true });
  window.addEventListener("touchmove", preventScrollTouch, { passive: false });
  window.addEventListener("keydown", preventScrollKey, { passive: false });
  window.addEventListener("scroll", preventScrollDrift, { passive: true });
}

function unlockScroll() {
  lockedRoot = null;
  if (!scrollLockActive) return;
  scrollLockActive = false;
  window.removeEventListener("wheel", preventScrollWheel);
  window.removeEventListener("touchstart", recordTouchStart);
  window.removeEventListener("touchmove", preventScrollTouch);
  window.removeEventListener("keydown", preventScrollKey);
  window.removeEventListener("scroll", preventScrollDrift);
}

function beginNavigatingAway() {
  isNavigatingAway = true;
  unlockScroll();
  clearTimeout(navigatingAwayTimer);
  navigatingAwayTimer = setTimeout(() => { isNavigatingAway = false; }, NAVIGATE_AWAY_SUPPRESS_MS);
}

function wireScrollLock(root) {
  const observer = new IntersectionObserver(
    (entries) => {
      if (isNavigatingAway) return;
      const entry = entries[0];
      if (entry.isIntersecting && entry.intersectionRatio >= SCROLL_LOCK_THRESHOLD) {
        root.scrollIntoView({ behavior: "instant", block: "start" });
        lockScroll(root);
        forceExploreDataNav();
      } else {
        unlockScroll();
      }
    },
    { threshold: [0, 0.5, SCROLL_LOCK_THRESHOLD, 1] }
  );
  observer.observe(root);
  // Any other same-page link (side navigation, logo, etc.) that jumps
  // straight to a different section also needs to release the lock first,
  // the same way the back control and Finish Story link already do -
  // otherwise their jump gets treated as drift and snapped straight back.
  window.addEventListener("explore-data:leave", beginNavigatingAway);
}

// The Fragmentation chapter's own pinned scroll-jacking (applyMapStep in
// scrollytelling.js) writes nav-link highlighting directly on every scroll
// tick while it's active, and can occasionally race with this section's own
// arrival right at the handoff boundary, leaving "4 Fragmentation"
// highlighted a moment after the user has genuinely landed here. Once this
// section is confirmed locked-in (see wireScrollLock above), assert
// "5 Explore the Data" as the definitive answer rather than trusting
// whichever system happened to write last.
function forceExploreDataNav() {
  document.querySelectorAll("[data-section-link]").forEach((link) => {
    const isActive = link.dataset.sectionLink === "explore-data";
    link.classList.toggle("is-active", isActive);
    link.setAttribute("aria-current", isActive ? "location" : "false");
  });
}

// ---------------------------------------------------------------------------
// Detail screen: info cards
// ---------------------------------------------------------------------------

function renderCards(root, stateStats) {
  setCard(root, "mesh_size", formatKm2(stateStats.meff_km2));
  setCard(root, "walking_time", `${Math.round(stateStats.walking_time_min)} min`);
  setCard(root, "pct_unfragmented", formatPercent(stateStats.unfragmented_forest_pct));
  setCard(root, "unfragmented_km2", formatKm2(stateStats.unfragmented_forest_km2));
  root.querySelector('.explore-data__state-name').textContent = stateStats.state;
  root.dataset.meshKm2 = String(stateStats.meff_km2);
}

function setCard(root, key, value) {
  const valueEl = root.querySelector(`[data-card="${key}"] .explore-data__card-value`);
  if (valueEl) valueEl.textContent = value;
}

// ---------------------------------------------------------------------------
// Detail screen: map
// ---------------------------------------------------------------------------

// Called once per selected state, so any previous state's defs/boundary are
// cleared first rather than left piling up underneath the new ones. Takes
// path (the current state's own fit-to-box projection, for shape/position)
// and meshReferenceScale (a fixed, state-independent scale - see
// setupExploreData) separately, so the mesh pattern's cell size reflects
// the real mesh value consistently across states rather than each state's
// own zoom level.
function renderMap(svg, path, stateFeature, forestPatches, valueKm2, meshReferenceScale) {
  const svgSel = select(svg);
  const defs = svgSel.select(".explore-data__mesh-defs");
  defs.selectAll("*").remove();
  meshPattern(defs, "explore-data-mesh-pattern", valueKm2, meshReferenceScale);

  svgSel.select(".explore-data__layer--boundary")
    .selectAll("path")
    .data([stateFeature])
    .join("path")
    .attr("class", "explore-data__boundary")
    .attr("fill", "url(#explore-data-mesh-pattern)")
    .attr("d", path);

  const patches = forestPatches?.features ?? [];
  const patchSelection = svgSel.select(".explore-data__layer--patches")
    .selectAll("path")
    .data(patches)
    .join("path")
    .attr("class", "explore-data__patch")
    .attr("d", path)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (d) => `${d.properties.id}, ${d.properties.area_ha.toFixed(0)} hectares`)
    .on("click", function (event, d) { showPatchInOverview(svg.closest(".explore-data"), d.properties, this); })
    .on("pointerenter", function (event, d) { showPatchInOverview(svg.closest(".explore-data"), d.properties, this); })
    .on("focus", function (event, d) { showPatchInOverview(svg.closest(".explore-data"), d.properties, this); })
    .on("keydown", function (event, d) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        showPatchInOverview(svg.closest(".explore-data"), d.properties, this);
      }
    });

  return patchSelection;
}

// ---------------------------------------------------------------------------
// "All States" ranking overview
// ---------------------------------------------------------------------------

// Lays every mesh-value state out in one row, ranked highest to lowest, and
// renders it as a static (non-scroll-driven) SVG the "All States" toggle
// reveals in place. Every state is clickable - onSelectState(stateCode) is
// called with the clicked state's AGS code, and the currently-selected one
// is kept highlighted via setActiveRankingState(). Each state shows the same
// mesh-grid + forest-patches picture as the detail view, via
// forestPatchesByState (stateCode -> forest_patches.geojson, fetched
// up front in setupExploreData). Returns the ranked state list (highest
// mesh size first) so the caller can reuse the same order elsewhere - see
// root._rankedStateCodes/wireStateNav.
function renderRanking(svg, germany, meshValues, forestPatchesByState, onSelectState) {
  const projection = geoIdentity().reflectY(true).fitExtent([[34, 34], [966, 966]], germany);
  const path = geoPath(projection);
  const svgSel = select(svg);
  const defs = svgSel.select(".explore-data__ranking-mesh-defs");

  const stateFeatureGroups = new Map();
  germany.features.forEach((featureItem) => {
    const stateCode = featureItem.properties.AGS;
    if (!meshValues.has(stateCode)) return;
    if (!stateFeatureGroups.has(stateCode)) stateFeatureGroups.set(stateCode, []);
    stateFeatureGroups.get(stateCode).push(featureItem);
  });

  meshValues.forEach(({ valueKm2 }, stateCode) => {
    meshPattern(defs, `explore-data-ranking-mesh-${stateCode}`, valueKm2, projection.scale());
  });

  const rankedStates = Array.from(stateFeatureGroups, ([stateCode, features]) => {
    const { stateName, valueKm2 } = meshValues.get(stateCode);
    const stateCollection = { type: "FeatureCollection", features };
    const [[x0, y0], [x1, y1]] = path.bounds(stateCollection);
    return { stateCode, stateName, valueKm2, stateCollection, width: x1 - x0, height: y1 - y0, x0, y0 };
  }).sort((a, b) => b.valueKm2 - a.valueKm2);

  const tallestState = Math.max(...rankedStates.map((item) => item.height));
  const rowY = RANKING_VIEW_HEIGHT / 2 - tallestState / 2;
  const rowBottom = rowY + tallestState;
  const labelY = rowBottom + 40;
  // Give every state the same visual/clickable card instead of letting the
  // irregular state outline define its hover target.
  const rankingCellWidth = Math.max(150, Math.ceil(Math.max(...rankedStates.map((item) => item.width)) + 48));
  const rankingCellY = Math.max(0, rowY - 24);
  const rankingCellHeight = Math.min(RANKING_VIEW_HEIGHT - rankingCellY, labelY + 46 - rankingCellY);
  let cursor = 0;
  const rankingItems = rankedStates.map((item) => {
    const cellX = cursor;
    const targetX = cellX + rankingCellWidth / 2;
    const dx = targetX - (item.x0 + item.width / 2);
    // Align every state along the same baseline, bringing smaller states
    // visually closer to their labels below.
    const dy = rowBottom - (item.y0 + item.height);
    cursor += rankingCellWidth + RANKING_GAP;
    return { ...item, cellX, dx, dy, targetX };
  });
  svg.setAttribute("viewBox", `0 0 ${Math.max(cursor - RANKING_GAP + RANKING_TRAILING_SPACE, 1)} ${RANKING_VIEW_HEIGHT}`);

  const statesLayer = svgSel.select(".explore-data__ranking-states");
  const stateGroups = statesLayer.selectAll("g")
    .data(rankingItems)
    .join("g")
    .attr("class", "explore-data__ranking-item")
    .attr("data-state-code", ({ stateCode }) => stateCode)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", ({ stateName }) => `Show ${stateName}`);

  stateGroups.append("rect")
    .attr("class", "explore-data__ranking-card")
    .attr("x", ({ cellX }) => cellX)
    .attr("y", rankingCellY)
    .attr("width", rankingCellWidth)
    .attr("height", rankingCellHeight);

  // Keep each boundary and its forest patches in one geometry group. This
  // ensures hover scaling treats the forest as part of the state, rather than
  // transforming every patch around its own centre.
  const geometryGroups = stateGroups.append("g")
    .attr("class", "explore-data__ranking-geometry")
    .style("--ranking-dx", ({ dx }) => `${dx}px`)
    .style("--ranking-dy", ({ dy }) => `${dy}px`);

  // Opaque base below the mesh pattern: the card hover colour must remain
  // behind the state rather than shining through its unpainted grid cells.
  geometryGroups.append("path")
    .attr("class", "explore-data__ranking-state-base")
    .attr("d", ({ stateCollection }) => path(stateCollection));

  geometryGroups.append("path")
    .attr("class", "explore-data__ranking-state")
    .attr("data-state-code", ({ stateCode }) => stateCode)
    .attr("d", ({ stateCollection }) => path(stateCollection))
    .attr("fill", ({ stateCode }) => `url(#explore-data-ranking-mesh-${stateCode})`);

  // Forest patches sit on top of the mesh-filled boundary in the same
  // geometry group, so they share both its placement and hover scale.
  geometryGroups.each(function (d) {
    const patches = forestPatchesByState.get(d.stateCode)?.features ?? [];
    select(this).selectAll(".explore-data__ranking-patch")
      .data(patches)
      .join("path")
      .attr("class", "explore-data__ranking-patch")
      .attr("d", path);
  });

  // Allow the large forest overlays to arrive incrementally after the
  // lightweight state ranking is already interactive.
  svg._setRankingPatches = (stateCode, collection) => {
    stateGroups
      .filter((d) => d.stateCode === stateCode)
      .select(".explore-data__ranking-geometry")
      .selectAll(".explore-data__ranking-patch")
      .data(collection?.features ?? [])
      .join("path")
      .attr("class", "explore-data__ranking-patch")
      .attr("d", path);
  };

  stateGroups.append("line")
    .attr("class", "explore-data__ranking-leader")
    .attr("x1", ({ targetX }) => targetX)
    .attr("y1", rowY + Math.max(...rankedStates.map((item) => item.height)) + 6)
    .attr("x2", ({ targetX }) => targetX)
    .attr("y2", labelY - 24);

  const labels = stateGroups.append("text")
    .attr("class", "explore-data__ranking-label")
    .attr("data-state-code", ({ stateCode }) => stateCode)
    .attr("x", ({ targetX }) => targetX)
    .attr("y", labelY);
  labels.append("tspan")
    .attr("x", ({ targetX }) => targetX)
    .text(({ stateName }) => stateName);
  labels.append("tspan")
    .attr("class", "explore-data__ranking-label-value")
    .attr("x", ({ targetX }) => targetX)
    .attr("dy", 18)
    .text(({ valueKm2 }) => `${valueKm2.toFixed(2)} km²`);

  const selectFromEvent = (event) => {
    const stateCode = event.currentTarget.dataset.stateCode;
    if (stateCode) onSelectState(stateCode);
  };
  stateGroups
    .on("click", selectFromEvent)
    .on("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectFromEvent(event);
      }
    });

  return rankedStates;
}

function waitForIdle() {
  return new Promise((resolve) => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(resolve);
    else window.setTimeout(resolve, 120);
  });
}

// Fetch and draw one state's forest overlay at a time. The previous version
// fetched every multi-megabyte GeoJSON concurrently, then parsed and rendered
// all of them before Explore became usable, causing a pronounced loading and
// scrolling stall near the end of the story.
async function loadRankingPatchesWhenIdle(root, svg, meshValues, cache) {
  for (const [stateCode, entry] of meshValues) {
    if (cache.has(stateCode)) continue;
    await waitForIdle();
    const patches = await json(`${dataRootFor(entry.stateName)}/forest_patches.geojson`).catch(() => null);
    if (!patches) continue;
    cache.set(stateCode, patches);
    await waitForIdle();
    svg._setRankingPatches?.(stateCode, patches);
    if (!root.isConnected) return;
  }
}

// Moves the ranking's highlighted-state styling to whichever state is
// currently shown in the detail view.
function setActiveRankingState(svg, ags) {
  select(svg).selectAll(".explore-data__ranking-state, .explore-data__ranking-label")
    .classed("is-active", function () { return this.dataset.stateCode === ags; });
}

// ---------------------------------------------------------------------------
// Detail screen: forest overview panel
// ---------------------------------------------------------------------------

// Sizes the overview photo and its mesh-size square both from one fixed,
// state-independent metres-per-pixel ratio (root._patchScaleReferenceM, set
// in setupExploreData), so a photo's on-screen size is genuinely
// proportional to its real-world footprint instead of every patch being
// stretched to fill the same box. The ratio is calibrated to the single
// largest patch dimension seen across every state, so that patch fills the
// box edge-to-edge and every other, smaller patch renders smaller still,
// centred with empty space around it - nothing is ever cropped.
function setOverviewScale(root, image, square, widthMetres, heightMetres, valueKm2) {
  const cellSideMetres = Math.sqrt(valueKm2 * 1e6);
  const container = root.querySelector(".explore-data__overview");
  const scaleReferenceM = root._patchScaleReferenceM;
  const applyScale = () => {
    if (!container || !scaleReferenceM) return;
    const containerRect = container.getBoundingClientRect();
    if (!containerRect.width || !containerRect.height) return;
    const pixelsPerMetre = Math.min(containerRect.width, containerRect.height) / scaleReferenceM * OVERVIEW_BASE_SCALE;
    image.style.width = `${widthMetres * pixelsPerMetre}px`;
    image.style.height = `${heightMetres * pixelsPerMetre}px`;
    const sidePx = Math.max(cellSideMetres * pixelsPerMetre, 8);
    square.style.width = `${sidePx}px`;
    square.style.height = `${sidePx}px`;
  };
  root._overviewRescale = applyScale;
  // Width/height come from GeoJSON metadata and do not depend on decoding
  // the bitmap. Apply them immediately: when a cached image finishes between
  // assigning src and registering `load`, that event can be missed and the
  // browser otherwise displays the image at its huge intrinsic dimensions.
  applyScale();
  if (!image.complete) image.addEventListener("load", applyScale, { once: true });
}

function showPatchInOverview(root, patchProps, patchEl) {
  if (!root) return;
  const overview = root.querySelector(".explore-data__overview");
  const image = root.querySelector(".explore-data__overview-image");
  const square = root.querySelector(".explore-data__overview-square");
  const caption = root.querySelector(".explore-data__overview-caption");
  const valueKm2 = root.dataset.meshKm2 ? Number(root.dataset.meshKm2) : null;
  if (!image || !square || !valueKm2) return;

  if (overview) overview.style.display = "";
  image.src = `${root.dataset.dataRoot}/forests/${patchProps.image}`;
  image.alt = `Satellite image of ${patchProps.id}`;
  if (caption) caption.textContent = `${exploreDataContent.detail.overviewSizeLabel}: ${(patchProps.area_ha / 100).toFixed(1)} km². ${exploreDataContent.detail.overviewCaptionSuffix}`;
  root.querySelectorAll(".explore-data__patch.is-selected").forEach((patch) => patch.classList.remove("is-selected"));
  patchEl?.classList.add("is-selected");

  // Keep the overview nav's prev/next position in sync even when the patch
  // was picked by clicking/keying the map directly rather than stepping.
  if (patchEl && root._patchNodes) {
    const index = root._patchNodes.indexOf(patchEl);
    if (index !== -1) root._patchIndex = index;
  }

  setOverviewScale(root, image, square, patchProps.real_width_m, patchProps.real_height_m, valueKm2);
  root._resetOverviewZoom?.();
}
