/**
 * FRAGMENTED REALITY – AUSFÜHRLICH KOMMENTIERTE JS-EINSTIEGSVERSION
 * =================================================================
 *
 * Diese Datei ist eine verständlich dokumentierte Alternative zu `script.js`.
 * Die produktive Website lädt weiterhin die kurze Datei `script.js`, die auf
 * `src/js/main.js` verweist. Dadurch bleiben Build und Browser-Download klein.
 *
 * Wenn du diese kommentierte Version testweise als Einstieg verwenden willst,
 * kannst du in `index.html` den Script-Pfad von `/script.js` auf
 * `/script_kommentiert.js` ändern. Beide Varianten bauen dieselbe Website auf.
 * Niemals beide Dateien gleichzeitig laden: Sonst würden Navigation und
 * Sections doppelt in `#app` eingefügt.
 *
 * WARUM IST DER CODE IN MODULE GETEILT?
 * ------------------------------------
 * `content.js`              Zentrale Text-/Section-Daten.
 * `navigation.js`           Hauptnavigation, Seitennavigation und Sound.
 * `sections.js`             Erzeugt das HTML aller Story-Abschnitte.
 * `scrollytelling.js`       Berechnet Scrollfortschritt und Animationen.
 * `forest-map.js`           Lädt und zeichnet D3-/TopoJSON-Kartendaten.
 * `pseudorelief-model.js`   Lädt und animiert das Three.js-GLB-Modell.
 * `utils.js`                Kleine mathematische Hilfsfunktionen.
 *
 * Diese Trennung ist wichtig: Navigation, Inhalt, Scrollytelling, D3 und
 * Three.js können unabhängig verändert werden, ohne eine riesige Datei zu
 * durchsuchen. Die folgende Einstiegsversion verbindet diese Teile.
 */

// Erzeugt die obere Hauptnavigation und die seitliche Projekt-/Soundnavigation.
import {
  createMainNavigation,
  createSideNavigation
} from "./src/js/navigation.js";

// Erzeugt alle Sections als DOM-Elemente aus den Daten in `content.js`.
import { createSections } from "./src/js/sections.js";

// Diese Funktionen verbinden DOM, Navigation und Scrollama:
// - `observeSections` setzt Theme und aktive Navigation.
// - `setupScrollScenes` startet sämtliche Scrollama-Szenen.
// - `registerPseudoreliefUpdater` verbindet Scrollama später mit Three.js.
// - `refreshCurrentMapStep` berechnet den aktuellen Kartenstand erneut,
//   sobald die asynchron geladenen Geodaten bereit sind.
import {
  observeSections,
  refreshCurrentMapStep,
  registerPseudoreliefUpdater,
  setupScrollScenes
} from "./src/js/scrollytelling.js";

/**
 * 1. APP-WURZEL FINDEN
 * --------------------
 * `#app` steht bereits in `index.html`. Die gesamte Website wird anschließend
 * per JavaScript darin aufgebaut. Ein harter Fehler ist hier sinnvoll: Ohne
 * diesen Container könnte nichts gerendert werden und ein stiller Fehler wäre
 * später schwieriger zu finden.
 */
const app = document.querySelector("#app");
if (!app) throw new Error("App root not found");

/**
 * 2. GEMEINSAME WEBSITE-HÜLLE
 * --------------------------
 * `.site-shell` enthält Navigation und Hauptinhalt. `data-theme` ist der
 * globale Theme-Schalter. CSS liest ihn beispielsweise so:
 *
 *   .site-shell[data-theme='light'] { ... }
 *
 * Beim Scrollen ändert `observeSections()` diesen Wert automatisch entsprechend
 * der aktuell sichtbaren Section.
 */
const shell = document.createElement("div");
shell.className = "site-shell";
shell.dataset.theme = "dark";

/**
 * 3. SEMANTISCHEN HAUPTINHALT ERZEUGEN
 * ------------------------------------
 * Das `<main>`-Element verbessert Accessibility und Dokumentstruktur.
 * `createSections()` gibt ein Array fertiger Section-Elemente zurück.
 * Der Spread-Operator `...` übergibt jedes Element einzeln an `append()`.
 */
const main = document.createElement("main");
main.id = "main-content";
main.append(...createSections());

/**
 * 4. NAVIGATION UND INHALT IN DIE SEITE EINSETZEN
 * ------------------------------------------------
 * Reihenfolge im DOM:
 *   1. Hauptnavigation oben
 *   2. Seitennavigation mit Logo/Sound
 *   3. Der eigentliche Story-Inhalt
 */
shell.append(
  createMainNavigation(),
  createSideNavigation(),
  main
);
app.append(shell);

/**
 * 5. GLOBALER SOUND-STARTZUSTAND
 * -----------------------------
 * Alle Videos starten zunächst mit aktiviertem Sound. Browser können Autoplay
 * mit Ton blockieren; die jeweilige `play()`-Behandlung in den Komponenten
 * fängt das ab. Der Sound-Button in `navigation.js` setzt später für jedes
 * Video gemeinsam `muted` und hält Icon/ARIA-Zustand synchron.
 */
document.querySelectorAll("video").forEach((video) => {
  video.muted = false;
});

/**
 * 6. THEME UND AKTIVE NAVIGATION BEOBACHTEN
 * -----------------------------------------
 * `observeSections(shell)` verwendet einen IntersectionObserver. Sobald eine
 * Section relevant sichtbar wird, werden:
 *
 * - Dark/Bright Mode aktualisiert,
 * - das richtige Logo gewählt,
 * - das passende Sound-Icon gewählt,
 * - der aktive Hauptnavigationspunkt markiert.
 */
observeSections(shell);

/**
 * 7. SCROLLAMA UND SCROLL-ANIMATIONEN STARTEN
 * -------------------------------------------
 * `setupScrollScenes()` registriert die Scrollama-Steps und einen zentralen
 * render/update-Zyklus. Der Scrollfortschritt wird möglichst als Zahl zwischen
 * 0 und 1 behandelt. Dadurch entstehen fließende Übergänge statt vieler
 * voneinander unabhängiger Scroll-Listener.
 *
 * Wichtige Zustände, die dort berechnet werden:
 * - Intro-Video und Loop zwischen 4.18 s und 8 s
 * - Intro-/Endbildsequenzen
 * - Storytexte und Facts
 * - Barrier-, Forest-, Pseudorelief-, Mesh- und Ranking-Schritte
 * - Responsive Positionen für Desktop, Column View und Telefon
 */
setupScrollScenes();

/**
 * 8. SCHWERE VISUALISIERUNGEN NUR EINMAL LADEN
 * --------------------------------------------
 * D3/TopoJSON und Three.js sind die schwersten JS-Bestandteile. Dynamische
 * Imports erzeugen getrennte Build-Chunks. Der normale Seitenaufbau bleibt
 * dadurch klein und sofort verfügbar.
 *
 * Die Dateien werden trotzdem direkt nach dem Grundaufbau angefordert, damit
 * Waldkarte und Deep-Zoom vollständig vorbereitet sind, bevor der User zu
 * diesem Kapitel scrollt. Das ist bewusstes Preloading – kein wiederholtes
 * Laden pro Scroll-Step.
 */
let visualizationsHaveLoaded = false;

const loadVisualizations = async () => {
  // Schutz gegen doppelte Initialisierung. Ohne diesen Guard würden zwei
  // Canvas/SVG-Instanzen entstehen und Events mehrfach registriert werden.
  if (visualizationsHaveLoaded) return;
  visualizationsHaveLoaded = true;

  /**
   * Beide Visualisierungen werden parallel geladen:
   * - `forest-map.js` bringt D3 und TopoJSON mit.
   * - `pseudorelief-model.js` bringt Three.js und GLTFLoader mit.
   * `Promise.all` wartet, bis beide Module verfügbar sind.
   */
  const [{ setupForestMap }, pseudorelief] = await Promise.all([
    import("./src/js/forest-map.js"),
    import("./src/js/pseudorelief-model.js")
  ]);

  /**
   * Scrollama kennt Three.js nicht direkt. Stattdessen wird die exportierte
   * Update-Funktion als Callback registriert. So bleibt `scrollytelling.js`
   * unabhängig von der konkreten 3D-Implementierung.
   */
  registerPseudoreliefUpdater(pseudorelief.updatePseudorelief);

  // Erzeugt Szene, Kamera, Licht, Renderer und lädt `pseudorelief.glb`.
  pseudorelief.setupPseudoreliefModel();

  /**
   * Lädt parallel:
   * - Deutschland-/Bundesland-Topologie,
   * - komprimierte Gesamtwaldflächen,
   * - Waldflächen über 50 km²,
   * - den kleinen hochaufgelösten Deep-Zoom-Ausschnitt,
   * - Mesh-Size-CSV,
   * - Barrier-Raster und Worldfile.
   *
   * Nach Fertigstellung ruft die Karte `refreshCurrentMapStep` auf. Dadurch
   * springt sie direkt zum momentan gescrollten Zustand und nicht kurz zur
   * Ausgangsansicht.
   */
  setupForestMap(refreshCurrentMapStep);

  // Zusätzliche direkte Synchronisierung für den Fall, dass alle Daten bereits
  // aus dem Browsercache kamen und ohne sichtbare Ladezeit bereitstehen.
  refreshCurrentMapStep();
};

// `void` zeigt: Das Promise wird absichtlich nicht weiter zurückgegeben.
// Fehler innerhalb der einzelnen Loader besitzen eigene Error-Callbacks.
void loadVisualizations();

/**
 * DETAILÜBERSICHT DER MODULE
 * ==========================
 *
 * content.js
 * ----------
 * Enthält die grundlegenden Navigations-/Section-Metadaten sowie Storydaten.
 * Inhalte, die mehrfach gebraucht werden, sollen dort statt in Animationen
 * stehen. Dadurch bleiben Texte von Scrolllogik getrennt.
 *
 * navigation.js
 * -------------
 * Baut beide Navigationen auf. Die Hauptnavigation verwendet `data-section-link`
 * als stabile Verbindung zu den Storyzuständen. Die Seitennavigation tauscht
 * `Logo_DM.png`/`Logo_BM.png` und Sound-Icons themeabhängig. Bei ≤900 px wird
 * sie als kompaktes Menü geöffnet und durch Klick außerhalb wieder geschlossen.
 * Der Soundbutton verändert alle vorhandenen `<video>`-Elemente gemeinsam.
 *
 * sections.js
 * -----------
 * Erstellt reines HTML/DOM für Intro, Bildsequenz, Story, Kartenabschnitt,
 * Outro und Infosections. Medienpfade beginnen mit `/media/`, weil Vite alles
 * aus `public/media` an der Root-URL bereitstellt. Responsive Bilder verwenden
 * `<picture>` und laden auf Telefonen nur die passende Mobile-Datei.
 *
 * scrollytelling.js
 * ----------------
 * Besitzt die zentrale zeitliche Choreografie. `clamp()` begrenzt Fortschritte
 * auf 0…1, `lerp()` interpoliert Positionen/Zoomwerte. Scrollama liefert aktive
 * Steps; ein gemeinsames Update setzt Transformationen, Opacity und CSS Custom
 * Properties. Der Kartenabschnitt nutzt u. a.:
 *
 *   --barrier-reveal
 *   --forest-stage-reveal
 *   --large-forest-reveal
 *   --forest-zoom-detail
 *   --pseudorelief-reveal
 *   --mesh-reveal
 *   --ranking-reveal
 *
 * CSS rendert daraus Übergänge, während JS nur normalisierte Zustände liefert.
 *
 * forest-map.js
 * -------------
 * D3 projiziert die bereits projizierten Geodaten mit `geoIdentity` in die
 * SVG-ViewBox 0 0 1000 1000. TopoJSON reduziert doppelte Geometrie. Für den
 * starken Wald-Zoom wird eine kleine regionale Detaildatei verwendet, während
 * die Deutschlandübersicht stark komprimiert bleibt. Bundeslandlabels sind
 * HTML statt SVG, damit ihre Schriftgröße beim Zoomen konstant bleibt.
 *
 * pseudorelief-model.js
 * ---------------------
 * Three.js lädt ein kompaktes GLB. Das Material wird im Code erzeugt, damit der
 * Höhenfarbverlauf scrollabhängig von Grün über Violett bis Rot animiert werden
 * kann. Das Modell wird einmal geladen und für Haupt-/Top-View geklont. Callout-
 * Punkte werden aus 3D-Koordinaten in responsive 2D-Bildschirmpositionen
 * projiziert.
 *
 * utils.js
 * --------
 * `clamp(value)` begrenzt Werte auf 0…1.
 * `lerp(start, end, amount)` interpoliert linear zwischen zwei Zahlen.
 * Diese Hilfen verhindern unterschiedliche Formeln in mehreren Modulen.
 *
 * RESPONSIVE LOGIK
 * ----------------
 * JavaScript fragt Breakpoints nur ab, wenn Animationskoordinaten wirklich
 * davon abhängen. Das visuelle Layout bleibt in CSS:
 *
 * > 900 px   Desktop: 38,2 % Text / 61,8 % Medien.
 * ≤ 900 px   Column View: Medien oben, Textpanel unten; mobile Typografie.
 * ≤ 700 px   Phone: rotierte Sequenzmedien und kompaktere Sonderregeln.
 * ≤ 1100 px  Nur Fit-/Spacing-Anpassungen, kein neuer Layoutzustand.
 * ≤ 1350 px  Nur Navigation-Fit, kein neuer Layoutzustand.
 *
 * PERFORMANCE-REGELN
 * ------------------
 * - Große Daten/Three.js werden als getrennte Chunks geladen.
 * - TopoJSON, Zoom-Topologie und Barrier-Raster werden vorab angefordert.
 * - WebP-Sequenzen benutzen Layer-Reveals statt Canvas-Neuzeichnungen.
 * - Das GLB wird nur einmal übertragen und für die zweite Ansicht geklont.
 * - Update-Funktionen verändern überwiegend transform/opacity/CSS-Variablen.
 * - Jeder Loader und jede Scrollszene wird genau einmal initialisiert.
 */
