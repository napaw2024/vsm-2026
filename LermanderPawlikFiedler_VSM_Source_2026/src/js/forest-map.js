import { geoIdentity, geoPath, json, select } from "d3";
import { feature, mesh } from "topojson-client";

const barrierRasterPreload = new Image();
barrierRasterPreload.decoding = "async";
barrierRasterPreload.fetchPriority = "high";
barrierRasterPreload.src = "media/barriers_1.webp";
const barrierRasterReady = barrierRasterPreload.decode().catch(() => undefined);

// The former route raster was 3011 × 4096 px. Its red dash centres are kept
// as lightweight source-image coordinates and rendered as animated SVG paws.
const ROUTE_SOURCE_SIZE = { naturalWidth: 3011, naturalHeight: 4096 };
const ROUTE_PAW_POINTS = [
  [2455.23, 3149.94], [2303.53, 3121.29], [2148.06, 3103.56],
  [2006.52, 3038.80], [1926.88, 2911.86], [1869.79, 2766.63],
  [1750.35, 2673.37], [1689.81, 2534.63], [1642.11, 2385.21],
  [1623.04, 2232.14], [1622.43, 2078.30], [1658.92, 1925.61]
];

function worldFileBounds(worldFile, image) {
  const [pixelWidth, , , pixelHeight, upperLeftX, upperLeftY] = worldFile
    .trim()
    .split(/\s+/)
    .map(Number);
  const sourceMinX = upperLeftX - pixelWidth / 2;
  const sourceMaxY = upperLeftY - pixelHeight / 2;
  return {
    minX: sourceMinX,
    maxY: sourceMaxY,
    maxX: sourceMinX + pixelWidth * image.naturalWidth,
    minY: sourceMaxY + pixelHeight * image.naturalHeight
  };
}

export async function setupForestMap(onReady) {
  const root = document.querySelector(".forest-map");
  const svg = root?.querySelector(".forest-map__svg");
  const status = root?.querySelector(".forest-map__status");
  if (!root || !svg) return;

  try {
    const [germanyTopology, barrierWorldFile, routeWorldFile, allForestsTopology, largeForestsTopology, zoomForestsTopology, meshCsv] = await Promise.all([
      json("data/wald_expo/deut.topojson"),
      fetch("media/barriers_1.pgw").then((response) => response.text()),
      fetch("media/route_overlay.pgw").then((response) => response.text()),
      json("data/wald_expo/wald_alles_balanced.topojson"),
      json("data/wald_expo/wald_50.topojson"),
      json("data/wald_expo/wald_50_zoom.topojson"),
      fetch("data/U06KG__2024.csv").then((response) => response.text())
    ]);
    await barrierRasterReady;
    const germany = feature(germanyTopology, germanyTopology.objects.data);
    const allForests = feature(allForestsTopology, allForestsTopology.objects.data);
    const largeForests = feature(largeForestsTopology, largeForestsTopology.objects.data);
    const zoomForestsObject = zoomForestsTopology.objects[Object.keys(zoomForestsTopology.objects)[0]];
    const zoomForests = feature(zoomForestsTopology, zoomForestsObject);
    // Fit the source coordinates into the SVG's 1000 × 1000 viewBox.
    const projection = geoIdentity().reflectY(true).fitExtent([[34, 34], [966, 966]], germany);
    const path = geoPath(projection);
    const stateBoundaries = mesh(germanyTopology, germanyTopology.objects.data);
    const meshValues = new Map(
      meshCsv
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => /^\d+;/.test(line.trim()))
        .map((line) => {
          const [, stateCode, stateName, rawValue] = line.split(";");
          return [stateCode, { stateName, valueKm2: Number(rawValue.replace(",", ".").trim()) }];
        })
    );
    const meshDefs = select(svg).select(".forest-map__mesh-defs");
    meshValues.forEach(({ stateName, valueKm2 }, stateCode) => {
      const cellSideMetres = Math.sqrt(valueKm2 * 1e6);
      const cellSidePixels = cellSideMetres * projection.scale();
      const pattern = meshDefs.append("pattern")
        .attr("id", `mesh-pattern-${stateCode}`)
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", cellSidePixels)
        .attr("height", cellSidePixels)
        .attr("data-state", stateName)
        .attr("data-value-km2", valueKm2);
      pattern.append("path")
        .attr("d", `M ${cellSidePixels} 0 L 0 0 0 ${cellSidePixels}`)
        .attr("class", "forest-map__mesh-line");
    });

    const barrierBounds = worldFileBounds(barrierWorldFile, barrierRasterPreload);
    const [barrierX0, barrierY0] = projection([barrierBounds.minX, barrierBounds.maxY]);
    const [barrierX1, barrierY1] = projection([barrierBounds.maxX, barrierBounds.minY]);
    const barrierLayer = select(svg).select(".forest-map__layer--barriers");
    barrierLayer
      .append("image")
      .attr("class", "forest-map__barrier-raster")
      .attr("href", "media/barriers_1.webp")
      .attr("x", barrierX0)
      .attr("y", barrierY0)
      .attr("width", barrierX1 - barrierX0)
      .attr("height", barrierY1 - barrierY0)
      .attr("preserveAspectRatio", "none");
    barrierLayer
      .attr("data-bounds-x", barrierX0)
      .attr("data-bounds-y", barrierY0)
      .attr("data-bounds-width", barrierX1 - barrierX0)
      .attr("data-bounds-height", barrierY1 - barrierY0);

    const routeBounds = worldFileBounds(routeWorldFile, ROUTE_SOURCE_SIZE);
    const [routeX0, routeY0] = projection([routeBounds.minX, routeBounds.maxY]);
    const [routeX1, routeY1] = projection([routeBounds.maxX, routeBounds.minY]);
    const routeWidth = routeX1 - routeX0;
    const routeHeight = routeY1 - routeY0;
    const routePoints = ROUTE_PAW_POINTS.map(([sourceX, sourceY]) => [
      routeX0 + (sourceX / ROUTE_SOURCE_SIZE.naturalWidth) * routeWidth,
      routeY0 + (sourceY / ROUTE_SOURCE_SIZE.naturalHeight) * routeHeight
    ]);
    const routePaws = select(svg).select(".forest-map__layer--route")
      .selectAll("g")
      .data(routePoints)
      .join("g")
      .attr("class", "forest-map__route-paw")
      .style("--paw-index", (_, index) => index)
      .attr("transform", ([x, y], index) => {
        const previous = routePoints[Math.max(0, index - 1)];
        const next = routePoints[Math.min(routePoints.length - 1, index + 1)];
        const angle = Math.atan2(next[1] - previous[1], next[0] - previous[0]) * 180 / Math.PI + 90;
        return `translate(${x} ${y}) rotate(${angle})`;
      });
    routePaws.append("ellipse").attr("class", "forest-map__route-paw-pad").attr("cx", 0).attr("cy", 3).attr("rx", 5.2).attr("ry", 6.2);
    [[-5, -5], [-1.8, -8], [1.8, -8], [5, -5]].forEach(([cx, cy]) => {
      routePaws.append("ellipse").attr("class", "forest-map__route-paw-toe").attr("cx", cx).attr("cy", cy).attr("rx", 2.1).attr("ry", 2.8);
    });

    select(svg).select(".forest-map__layer--all")
      .append("path")
      .datum(allForests)
      .attr("class", "forest-map__forests forest-map__forests--all")
      .attr("d", path);
    select(svg).select(".forest-map__layer--large")
      .selectAll("path")
      .data(largeForests.features)
      .join("path")
      .attr("class", "forest-map__forests forest-map__forests--large")
      .attr("d", path);
    select(svg).select(".forest-map__layer--zoom-detail")
      .selectAll("path")
      .data(zoomForests.features)
      .join("path")
      .attr("class", "forest-map__forests forest-map__forests--zoom-detail")
      .attr("d", path);
    const meshStates = select(svg).select(".forest-map__layer--mesh")
      .selectAll("path")
      .data(germany.features.filter((feature) => meshValues.has(feature.properties.AGS)))
      .join("path")
      .attr("class", "forest-map__mesh-state")
      .attr("data-state", (feature) => feature.properties.GEN)
      .attr("data-value-km2", (feature) => meshValues.get(feature.properties.AGS).valueKm2)
      .attr("tabindex", 0)
      .attr("fill", (feature) => `url(#mesh-pattern-${feature.properties.AGS})`)
      .attr("d", path);
    const stateFeatureGroups = new Map();
    germany.features.forEach((feature) => {
      const stateCode = feature.properties.AGS;
      if (!meshValues.has(stateCode)) return;
      if (!stateFeatureGroups.has(stateCode)) stateFeatureGroups.set(stateCode, []);
      stateFeatureGroups.get(stateCode).push(feature);
    });
    const meshLabels = Array.from(stateFeatureGroups, ([stateCode, features]) => {
      const value = meshValues.get(stateCode);
      const centroid = path.centroid({ type: "FeatureCollection", features });
      return { stateCode, ...value, centroid };
    });
    const leftLabels = meshLabels.filter(({ centroid }) => centroid[0] < 500).sort((a, b) => a.centroid[1] - b.centroid[1]);
    const rightLabels = meshLabels.filter(({ centroid }) => centroid[0] >= 500).sort((a, b) => a.centroid[1] - b.centroid[1]);
    // Place label rows outside the map while retaining each state's anchor point.
    const positionLabels = (items, side) => items.map((item, index) => ({
      ...item,
      side,
      labelY: items.length === 1 ? 500 : 120 + index * (760 / (items.length - 1))
    }));
    const positionedLabels = [...positionLabels(leftLabels, "left"), ...positionLabels(rightLabels, "right")];
    const labelGroups = select(svg).select(".forest-map__layer--mesh-labels")
      .selectAll("g")
      .data(positionedLabels)
      .join("g")
      .attr("class", "forest-map__mesh-label")
      .attr("data-state", ({ stateName }) => stateName);
    labelGroups.append("path")
      .attr("class", "forest-map__mesh-leader")
      .attr("d", ({ centroid: [x, y], side, labelY }) => {
        const elbowX = side === "left" ? 190 : 810;
        const endX = side === "left" ? 170 : 830;
        return `M ${x} ${y} L ${elbowX} ${labelY} L ${endX} ${labelY}`;
      });
    labelGroups.append("circle")
      .attr("class", "forest-map__mesh-dot")
      .attr("cx", ({ centroid }) => centroid[0])
      .attr("cy", ({ centroid }) => centroid[1])
      .attr("r", 3);
    const labelText = labelGroups.append("text")
      .attr("class", "forest-map__mesh-label-text")
      .attr("x", ({ side }) => side === "left" ? 162 : 838)
      .attr("y", ({ labelY }) => labelY - 4)
      .attr("text-anchor", ({ side }) => side === "left" ? "end" : "start");
    labelText.append("tspan")
      .attr("x", ({ side }) => side === "left" ? 162 : 838)
      .text(({ stateName }) => stateName);
    labelText.append("tspan")
      .attr("x", ({ side }) => side === "left" ? 162 : 838)
      .attr("dy", 16)
      .attr("class", "forest-map__mesh-label-value")
      .text(({ valueKm2 }) => `${valueKm2.toFixed(2)} km²`);
    const meshHtmlHost = root.querySelector(".forest-map__mesh-labels-html");
    if (meshHtmlHost) {
      meshHtmlHost.innerHTML = positionedLabels.map(({ stateName, valueKm2, side, labelY }) => {
        const anchorX = side === "left" ? 162 : 838;
        return `
          <div class="forest-map__mesh-label forest-map__mesh-label-html forest-map__mesh-label-html--${side}" data-state="${stateName}" data-anchor-x="${anchorX}" data-anchor-y="${labelY}">
            <span>${stateName}</span>
            <strong>${valueKm2.toFixed(2)} km²</strong>
          </div>
        `;
      }).join("");
    }
    // State labels remain HTML so their font size does not scale with the SVG.
    const toggleMeshLabel = (stateName, visible) => {
      labelGroups.classed("is-visible", ({ stateName: labelState }) => visible && labelState === stateName);
      root.querySelectorAll(".forest-map__mesh-label-html").forEach((label) => {
        label.classList.toggle("is-visible", visible && label.dataset.state === stateName);
      });
    };
    meshStates.nodes().forEach((state) => {
      const showLabel = () => toggleMeshLabel(state.dataset.state, true);
      const hideLabel = () => toggleMeshLabel(state.dataset.state, false);
      state.addEventListener("pointerenter", showLabel);
      state.addEventListener("pointerleave", hideLabel);
      state.addEventListener("focus", showLabel);
      state.addEventListener("blur", hideLabel);
    });
    const rankedStates = meshLabels
      .slice()
      .sort((a, b) => b.valueKm2 - a.valueKm2);
    const rankingLayer = select(svg).select(".forest-map__layer--ranking");
    const rankingGeometry = rankedStates.map((item) => {
      const features = stateFeatureGroups.get(item.stateCode);
      const stateCollection = { type: "FeatureCollection", features };
      const [[x0, y0], [x1, y1]] = path.bounds(stateCollection);
      return {
        ...item,
        stateCollection,
        centerX: (x0 + x1) / 2,
        centerY: (y0 + y1) / 2,
        stateWidth: x1 - x0,
        stateHeight: y1 - y0
      };
    });
    const rankingLabelY = 470 + Math.max(...rankingGeometry.map(({ stateHeight }) => stateHeight)) / 2 + 24;
    let rankingCursor = -60;
    const rankingItems = rankingGeometry.map((item) => {
      const targetX = rankingCursor + item.stateWidth / 2;
      rankingCursor += item.stateWidth + 24;
      return {
        ...item,
        targetX,
        targetY: 470,
        targetScale: 1,
        labelY: rankingLabelY
      };
    });
    rankingLayer.selectAll("path.forest-map__ranking-state")
      .data(rankingItems)
      .join("path")
      .attr("class", "forest-map__ranking-state")
      .attr("data-state-code", ({ stateCode }) => stateCode)
      .attr("d", ({ stateCollection }) => path(stateCollection))
      .attr("fill", ({ stateCode }) => `url(#mesh-pattern-${stateCode})`)
      .attr("data-center-x", ({ centerX }) => centerX)
      .attr("data-center-y", ({ centerY }) => centerY)
      .attr("data-target-x", ({ targetX }) => targetX)
      .attr("data-target-y", ({ targetY }) => targetY)
      .attr("data-target-scale", ({ targetScale }) => targetScale);
    const rankingLabels = rankingLayer.selectAll("text.forest-map__ranking-label")
      .data(rankingItems)
      .join("text")
      .attr("class", "forest-map__ranking-label")
      .attr("data-state-code", ({ stateCode }) => stateCode)
      .attr("data-target-x", ({ targetX }) => targetX)
      .attr("data-label-y", ({ labelY }) => labelY)
      .attr("x", ({ targetX }) => targetX)
      .attr("y", ({ labelY }) => labelY)
      .attr("text-anchor", "end")
      .attr("transform", ({ targetX, labelY }) => `rotate(-55 ${targetX} ${labelY})`);
    rankingLabels.append("tspan")
      .attr("x", ({ targetX }) => targetX)
      .text(({ stateName }) => stateName);
    rankingLabels.append("tspan")
      .attr("x", ({ targetX }) => targetX)
      .attr("dy", 14)
      .attr("class", "forest-map__ranking-value")
      .text(({ valueKm2 }) => `${valueKm2.toFixed(2)} km²`);
    const rankingHtmlHost = root.querySelector(".forest-map__ranking-labels-html");
    if (rankingHtmlHost) {
      rankingHtmlHost.innerHTML = rankingItems.map(({ stateCode, stateName, valueKm2, targetX, labelY }) => `
        <div class="forest-map__ranking-label-html" data-state-code="${stateCode}" data-target-x="${targetX}" data-label-y="${labelY}">
          <span>${stateName}</span>
          <strong>${valueKm2.toFixed(2)} km²</strong>
        </div>
      `).join("");
    }
    select(svg).select(".forest-map__layer--states")
      .append("path")
      .datum(stateBoundaries)
      .attr("class", "forest-map__state")
      .attr("d", path);

    root.classList.add("is-ready");
    status?.remove();
    onReady?.();
  } catch (error) {
    console.error("Unable to render the forest map", error);
    if (status) status.textContent = "Forest map could not be loaded.";
    throw error;
  }
}
