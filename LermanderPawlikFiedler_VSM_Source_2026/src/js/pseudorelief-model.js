import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clamp } from "./utils.js";

let pseudoreliefViewer = null;
let pseudoreliefProgress = 0;

// Set up the Three.js scene, load the compact GLB model, and expose scroll controls.
export function setupPseudoreliefModel() {
  const host = document.querySelector(".pseudorelief-model");
  if (!host) return;

  // A scene contains the camera, lights, and visible 3D objects.
  const scene = new THREE.Scene();
  // PerspectiveCamera makes distant parts appear smaller, like a real camera.
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);
  camera.position.set(0, 0.4, 4.2);

  // The WebGL renderer draws the scene into a canvas inserted inside `host`.
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.append(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8f8798, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);

  // Rotating this group rotates every model placed inside it as one unit.
  const turntable = new THREE.Group();
  scene.add(turntable);
  const callout = host.parentElement?.querySelector(".pseudorelief-callout");
  const calibration = host.parentElement?.querySelector(".pseudorelief-calibration");
  const calibrationEnabled = new URLSearchParams(window.location.search).get("calibrate") === "stub-roads";
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let stubAnchors = [];

  try {
    const savedAnchors = JSON.parse(localStorage.getItem("pseudorelief-stub-anchors") || "[]");
    if (Array.isArray(savedAnchors)) {
      stubAnchors = savedAnchors.slice(0, 3).map(({ x, y, z }) => new THREE.Vector3(x, y, z));
    }
  } catch {}

  if (calibrationEnabled && calibration) calibration.hidden = false;

  // Project saved 3D anchor points into responsive 2D SVG line coordinates.
  const updateCallout = () => {
    const topView = turntable.userData.topView;
    if (!callout || !topView) return;
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    callout.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
    const label = host.parentElement?.querySelector(".pseudorelief-callout__label");
    const labelRect = label?.getBoundingClientRect();
    const startX = labelRect ? labelRect.right - rect.left + 8 : rect.width * 0.18;
    const startY = labelRect ? labelRect.top - rect.top + labelRect.height * 0.5 : rect.height * 0.1;
    const jointX = startX + rect.width * 0.2;
    const jointY = startY;
    const fallbackPoints = [
      { x: rect.width * 0.54, y: rect.height * 0.27 },
      { x: rect.width * 0.42, y: rect.height * 0.36 },
      { x: rect.width * 0.38, y: rect.height * 0.27 }
    ];
    const points = stubAnchors.length === 3
      ? stubAnchors.map((anchor) => {
          const projected = topView.localToWorld(anchor.clone()).project(camera);
          return {
            x: (projected.x * 0.5 + 0.5) * rect.width,
            y: (-projected.y * 0.5 + 0.5) * rect.height
          };
        })
      : fallbackPoints;
    points.forEach(({ x, y }, index) => {
      const path = callout.querySelector(`[data-stub-path="${index}"]`);
      const dot = callout.querySelector(`[data-stub-dot="${index}"]`);
      path?.setAttribute("d", index === 0
        ? `M ${startX} ${startY} L ${jointX} ${jointY} L ${x} ${y}`
        : `M ${jointX} ${jointY} L ${x} ${y}`);
      dot?.setAttribute("cx", x);
      dot?.setAttribute("cy", y);
      dot?.setAttribute("r", "3");
    });
  };

  const render = () => renderer.render(scene, camera);
  let lastGradientReveal = { red: -1, purple: -1, green: -1 };
  // Keep camera proportions and canvas resolution correct after browser resizing.
  const resize = () => {
    const rect = host.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    updateCallout();
    render();
  };

  pseudoreliefViewer = {
    setProgress(progress, topViewProgress = progress) {
      pseudoreliefProgress = progress;
      const rotationProgress = clamp(progress / 0.36);
      const redReveal = clamp((progress - 0.36) / 0.18);
      const purpleReveal = clamp((progress - 0.56) / 0.18);
      const greenReveal = clamp((progress - 0.76) / 0.2);
      turntable.rotation.y = Math.PI + rotationProgress * Math.PI;
      turntable.rotation.x = 0.2 + rotationProgress * 0.12;
      const gradientChanged = Math.abs(redReveal - lastGradientReveal.red) >= 0.01
        || Math.abs(purpleReveal - lastGradientReveal.purple) >= 0.01
        || Math.abs(greenReveal - lastGradientReveal.green) >= 0.01;
      if (gradientChanged) {
        turntable.userData.applyGradient?.(0, { redReveal, purpleReveal, greenReveal });
        lastGradientReveal = { red: redReveal, purple: purpleReveal, green: greenReveal };
      }
      if (turntable.userData.topView) {
        const topViewReveal = clamp(topViewProgress);
        turntable.userData.topView.visible = topViewReveal > 0;
        turntable.userData.topView.scale.setScalar(turntable.userData.topViewBaseScale * topViewReveal);
        host.parentElement?.style.setProperty("--pseudo-callout-reveal", topViewReveal.toFixed(3));
      }
      if (turntable.userData.mainModel) {
        turntable.userData.mainModel.visible = progress > 0;
        turntable.userData.mainModel.scale.setScalar(turntable.userData.mainModelBaseScale * clamp(progress / 0.16));
      }
      host.parentElement?.style.setProperty("--pseudo-low-label", redReveal.toFixed(3));
      host.parentElement?.style.setProperty("--pseudo-high-label", greenReveal.toFixed(3));
      updateCallout();
      render();
    },
    resize
  };

  new ResizeObserver(resize).observe(host);
  // Normalize the loaded geometry, duplicate its two views, and apply materials.
  const addModel = (model) => {
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const softenColor = (hex) => {
        const color = new THREE.Color(hex);
        const hsl = {};
        color.getHSL(hsl);
        return color.setHSL(hsl.h, hsl.s * 0.88, hsl.l);
      };
      const lowColor = softenColor("#DD2122");
      const middleColor = softenColor("#917DD2");
      const highColor = new THREE.Color("#ffffff");
      const neutralColor = new THREE.Color("#63973e");
      const vertex = new THREE.Vector3();
      const color = new THREE.Color();
      const gradientMeshes = [];

      model.updateMatrixWorld(true);
      model.traverse((child) => {
        if (!child.isMesh) return;
        const positions = child.geometry.getAttribute("position");
        const sourceVertices = new Float32Array(positions.count * 3);
        const colors = new Float32Array(positions.count * 3);
        for (let index = 0; index < positions.count; index += 1) {
          vertex.fromBufferAttribute(positions, index).applyMatrix4(child.matrixWorld);
          sourceVertices[index * 3] = vertex.x;
          sourceVertices[index * 3 + 1] = vertex.y;
          sourceVertices[index * 3 + 2] = vertex.z;
        }
        const colorAttribute = new THREE.BufferAttribute(colors, 3);
        child.geometry.setAttribute("color", colorAttribute);
        gradientMeshes.push({ sourceVertices, colorAttribute });
        child.material = new THREE.MeshStandardMaterial({
          vertexColors: true,
          metalness: 0,
          roughness: 0.72,
          side: THREE.DoubleSide
        });
      });

      // Recalculate vertex colors as scroll reveals the gradient zones.
      const applyGradient = (angle, reveals = {}) => {
        const redReveal = reveals.redReveal ?? 0;
        const purpleReveal = reveals.purpleReveal ?? 0;
        const greenReveal = reveals.greenReveal ?? 0;
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        let minimum = Infinity;
        let maximum = -Infinity;

        gradientMeshes.forEach(({ sourceVertices }) => {
          for (let index = 0; index < sourceVertices.length; index += 3) {
            const tiltedHeight = sourceVertices[index + 1] * cosine - sourceVertices[index + 2] * sine;
            minimum = Math.min(minimum, tiltedHeight);
            maximum = Math.max(maximum, tiltedHeight);
          }
        });

        const heightRange = maximum - minimum || 1;
        gradientMeshes.forEach(({ sourceVertices, colorAttribute }) => {
          const colors = colorAttribute.array;
          for (let index = 0; index < sourceVertices.length; index += 3) {
            const tiltedHeight = sourceVertices[index + 1] * cosine - sourceVertices[index + 2] * sine;
            const height = THREE.MathUtils.clamp((tiltedHeight - minimum) / heightRange, 0, 1);
            let colorReveal;
          if (height <= 0.25) {
            color.copy(lowColor);
            colorReveal = redReveal;
          } else if (height < 0.36) {
            const redToPurple = THREE.MathUtils.smoothstep(height, 0.25, 0.36);
            color.copy(lowColor).lerp(middleColor, redToPurple);
            colorReveal = THREE.MathUtils.lerp(redReveal, purpleReveal, redToPurple);
          } else if (height <= 0.42) {
            color.copy(middleColor);
            colorReveal = purpleReveal;
          } else {
            const purpleToGreen = THREE.MathUtils.smoothstep(height, 0.42, 1);
            color.copy(middleColor).lerp(highColor, purpleToGreen);
            colorReveal = THREE.MathUtils.lerp(purpleReveal, greenReveal, purpleToGreen);
          }
            color.lerpColors(neutralColor, color, colorReveal);
            colors[index] = color.r;
            colors[index + 1] = color.g;
            colors[index + 2] = color.b;
          }
          colorAttribute.needsUpdate = true;
        }
        );
      };
      turntable.userData.applyGradient = applyGradient;
      applyGradient(0);

      if (stubAnchors.length !== 3 && gradientMeshes.length) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        gradientMeshes.forEach(({ sourceVertices }) => {
          for (let index = 0; index < sourceVertices.length; index += 3) {
            minX = Math.min(minX, sourceVertices[index]);
            maxX = Math.max(maxX, sourceVertices[index]);
            minZ = Math.min(minZ, sourceVertices[index + 2]);
            maxZ = Math.max(maxZ, sourceVertices[index + 2]);
          }
        });
        const anchorTargets = [
          [0.66, 0.62],
          [0.45, 0.4],
          [0.3, 0.62]
        ];
        stubAnchors = anchorTargets.map(([targetX, targetZ]) => {
          const xGoal = THREE.MathUtils.lerp(minX, maxX, targetX);
          const zGoal = THREE.MathUtils.lerp(minZ, maxZ, targetZ);
          let closest = new THREE.Vector3();
          let closestDistance = Infinity;
          gradientMeshes.forEach(({ sourceVertices }) => {
            for (let index = 0; index < sourceVertices.length; index += 3) {
              const dx = sourceVertices[index] - xGoal;
              const dz = sourceVertices[index + 2] - zGoal;
              const distance = dx * dx + dz * dz;
              if (distance < closestDistance) {
                closestDistance = distance;
                closest.set(sourceVertices[index], sourceVertices[index + 1], sourceVertices[index + 2]);
              }
            }
          });
          return closest;
        });
      }

      model.position.sub(center);
      const largestSide = Math.max(size.x, size.y, size.z) || 1;
      model.scale.setScalar((2.65 * 0.8 * 0.8) / largestSide);
      model.position.y -= 0.28;
      turntable.add(model);
      turntable.userData.mainModel = model;
      turntable.userData.mainModelBaseScale = model.scale.x;

      const topView = model.clone(true);
      topView.position.y = 0.72;
      topView.rotation.x = Math.PI / 2;
      topView.visible = false;
      scene.add(topView);
      turntable.userData.topView = topView;
      turntable.userData.topViewBaseScale = topView.scale.x;
      updateCallout();
      host.classList.add("is-loaded");
      resize();
      pseudoreliefViewer?.setProgress(pseudoreliefProgress);
  };

  new GLTFLoader().setPath("media/").load(
    "pseudorelief.glb",
    (gltf) => addModel(gltf.scene),
    undefined,
    (error) => console.error("Unable to load pseudorelief.glb", error)
  );

  host.addEventListener("pointerdown", (event) => {
    if (!calibrationEnabled || !turntable.userData.topView) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(turntable.userData.topView, true)[0];
    if (!hit) return;
    if (stubAnchors.length >= 3) stubAnchors = [];
    stubAnchors.push(turntable.userData.topView.worldToLocal(hit.point.clone()));
    if (stubAnchors.length === 3) {
      localStorage.setItem("pseudorelief-stub-anchors", JSON.stringify(stubAnchors));
    }
    if (calibration) {
      const status = calibration.querySelector("span");
      if (status) status.textContent = stubAnchors.length === 3
        ? "Three anchors saved. Resize the window to test them."
        : `${stubAnchors.length}/3 points selected.`;
    }
    updateCallout();
  });

  calibration?.querySelector("[data-reset-stub-anchors]")?.addEventListener("click", () => {
    stubAnchors = [];
    localStorage.removeItem("pseudorelief-stub-anchors");
    const status = calibration.querySelector("span");
    if (status) status.textContent = "Click three locations on the top model.";
  });
}
export function updatePseudorelief(progress, topViewProgress = progress) {
  pseudoreliefViewer?.setProgress(progress, topViewProgress);
}
