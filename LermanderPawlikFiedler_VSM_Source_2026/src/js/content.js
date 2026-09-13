export const sections = [
  {
    id: "introduction",
    navigationLabel: "Introduction",
    eyebrow: "Fragmented Reality",
    title: "An introduction to fragmented habitats",
    theme: "dark",
    className: "intro-section"
  },
  {
    id: "perspective-shift",
    navigationLabel: "Perspective Shift",
    eyebrow: "Perspective Shift",
    title: "A landscape seen from another point of view",
    theme: "dark",
    className: "sequence-section"
  },
  {
    id: "route",
    navigationLabel: "The Route",
    eyebrow: "The Route",
    title: "Five stories of movement and interruption",
    theme: "light",
    className: "story-chapter-section"
  },
  {
    id: "fragmentation",
    navigationLabel: "Fragmentation",
    eyebrow: "Fragmentation",
    title: "The landscape does not end at the edge of the road.",
    theme: "dark",
    className: "interlude-section"
  },
  {
    id: "explore-data",
    navigationLabel: "Explore the Data",
    eyebrow: "Explore the Data",
    title: "Fragmentation across the landscape",
    theme: "light",
    className: "map-section"
  }
];

// Text for the "Explore the Data" standalone state-detail screen, reached by
// scrolling straight through from the Fragmentation map chapter.
export const exploreData = {
  detail: {
    heading: "Explore the Data",
    introCopy: "Explore and interact with your state’s unfragmented forests.",
    introCopyRanking: "You may now explore the ranking and explore <strong><em>the unfragmented forests.</em></strong><br /><br />or finish the <strong><em>story</em></strong>",
    continueLabel: "Finish the Story",
    backLabel: "All States",
    loadingStatus: "Loading state data…",
    errorStatus: "Data for this state could not be loaded.",
    overviewSizeLabel: "Forest size",
    overviewCaptionSuffix: "The purple square shows the mesh size at true scale, drawn to match the same real-world size as the forest behind it.",
    noForestCopy: "This state has no unfragmented forest patches larger than 50 km².",
    overviewPrevLabel: "Show the previous forest patch",
    overviewNextLabel: "Show the next forest patch",
    statePrevLabel: "Show the previous state",
    stateNextLabel: "Show the next state",
    walkingTimeTooltip: "The mesh walking time is based on the mesh size for this state, converted to a square patch and measured corner to corner (the longest way across), assuming a walking speed of 5 km/h.",
    cardLabels: {
      mesh_size: "Mesh size",
      walking_time: "Walking Time per Mesh patch",
      pct_unfragmented: "Unfragmented forests ≥50 km² ",
      unfragmented_km2: "Total unfragmented forest (km²)"
    },
    legend: {
      mesh: "Mesh size",
      patch: "Forest Patch (>50 km²)"
    }
  },
  ranking: {
    scaleHigh: "Highest mesh size",
    scaleLow: "Lowest mesh size",
    prevLabel: "Show the previous states",
    nextLabel: "Show the next states"
  }
};

// Text for the standalone "About" screen, reached via the side navigation.
// Edit any of these strings to update the page — HTML tags (like <a>) are
// allowed since they are inserted as-is.
export const about = {
  aboutHeading: "About the project",
  aboutParagraphs: [
    "This data visualization project was created during the summer semester of 2026 as part of the seminar “Visualizing Sustainability Models” supervised by Dr. Francesca Morini and Erik Weiss, at the University of Applied Sciences Potsdam.",
    "A project by Gregor Fiedler, Jenny Lermander, Natalia Pawlik.",
    "Published in one of the hottest summer – 2026."
  ],
  creditsHeading: "Credits",
  creditsCopy: "Thanks to Tobias Krüger at Leibniz Institute of Ecological Urban and Regional Development for providing the data and for helpful conversations and input.",
  learnMoreHeading: "Would you like to learn more?",
  learnMoreLinks: [
    { label: "Leibniz Institute of Ecological Urban and Regional Development", url: "" },
    { label: "IÖR Monitor", url: "https://monitor.ioer.de/" }
  ],
  legalLinks: [
    { label: "Datenschutzhinweis", url: "https://www.fh-potsdam.de/datenschutz" },
    { label: "Impressum", url: "https://www.fh-potsdam.de/impressum" }
  ]
};

// Numbered citation list for the "References" screen. Each entry may contain
// HTML (e.g. an <a href="..."> around the URL) since it is inserted as-is.
export const references = {
  heading: "References",
  items: [
    "Märtz, J., & Brieger, F. (2025, October 23). When the road contributes to the hunting bag. Waldwissen.net. <a href=\"https://www.waldwissen.net/en/forest-ecology/forest-and-game/game-management/documentation-of-wildlife-accidents#c122747\" target=\"_blank\" rel=\"noreferrer\">https://www.waldwissen.net/en/forest-ecology/forest-and-game/game-management/documentation-of-wildlife-accidents#c122747</a>",
    "Tierpark Hellabrunn. (n.d.). Eurasian lynx. Retrieved June 14, 2026, from <a href=\"https://www.hellabrunn.de/en/animals/europe/eurasian-lynx\" target=\"_blank\" rel=\"noreferrer\">https://www.hellabrunn.de/en/animals/europe/eurasian-lynx</a>",
    "Duquette, C. A., Loss, S. R., & Hovick, T. J. (2021). A meta-analysis of the influence of anthropogenic noise on terrestrial wildlife communication strategies. Journal of Applied Ecology, 58(6), 1112–1121. <a href=\"https://doi.org/10.1111/1365-2664.13880\" target=\"_blank\" rel=\"noreferrer\">https://doi.org/10.1111/1365-2664.13880</a>",
    "Kok, A. C. M., Berkhout, B. W., Carlson, N. V., Evans, N. P., Khan, N., Potvin, D. A., et al. (2023). How chronic anthropogenic noise can affect wildlife communities. Frontiers in Ecology and Evolution, 11, Article 1130075. <a href=\"https://doi.org/10.3389/fevo.2023.1130075\" target=\"_blank\" rel=\"noreferrer\">https://doi.org/10.3389/fevo.2023.1130075</a>",
    "Zheltuchin, A. (1992). Distribution and numbers of lynx in the Soviet Union. In Council of Europe (Ed.), The situation, conservation needs and reintroduction of lynx in Europe (Environmental Encounters No. 11, pp. 19–29). Council of Europe Press.",
    "Walz, U., Schumacher, U., & Krüger, T. (2023). Landschaftszerschneidung und Waldfragmentierung in Deutschland—Ergebnisse aus einem Monitoring im Kontext von Schutzgebieten und Hemerobie. Naturschutz und Landschaftsplanung. <a href=\"https://doi.org/10.19217/NUL2022-02-04\" target=\"_blank\" rel=\"noreferrer\">https://doi.org/10.19217/NUL2022-02-04</a>",
    "Gräfe, A. (2023). GIS-gestützte Erfassung von Grünbrücken in Deutschland [Master’s thesis, Hochschule für Technik und Wirtschaft Dresden]."
  ]
};

// Unnumbered citation list for the "Sources" screen (the underlying datasets).
// Each entry may contain HTML (e.g. an <a href="..."> around the URL).
export const sources = {
  heading: "Data Sources",
  items: [
    "Bund für Umwelt und Naturschutz Deutschland (BUND). (n.d.) Gefahren für den Luchs: Verkehr, Jagd, Krankheit. <a href=\"https://www.bund.net/themen/tiere-pflanzen/luchs/gefahren/\" target=\"_blank\" rel=\"noreferrer\">https://www.bund.net/themen/tiere-pflanzen/luchs/gefahren/</a>",
    "Bund für Umwelt und Naturschutz Deutschland (BUND). (2018, 8. März). Schon wieder zwei Luchse im Bayerischen Wald überfahren. <a href=\"https://www.bund.net/themen/aktuelles/detail-aktuelles/news/schon-wieder-zwei-luchse-im-bayerischen-wald-ueberfahren/\" target=\"_blank\" rel=\"noreferrer\">https://www.bund.net/themen/aktuelles/detail-aktuelles/news/schon-wieder-zwei-luchse-im-bayerischen-wald-ueberfahren/</a>",
    "Leibniz-Institut für ökologische Raumentwicklung (IÖR). (2024). Monitor der Siedlungs- und Freiraumentwicklung (IÖR-Monitor) [Interaktive Karte]. <a href=\"https://monitor.ioer.de/\" target=\"_blank\" rel=\"noreferrer\">https://monitor.ioer.de/</a>",
    "Walz, U., Krüger, T., & Schumacher, U. (2011). Landschaftszerschneidung und Waldfragmentierung – Neue Indikatoren des IÖR-Monitors. In G. Meinel & U. Schumacher (Hrsg.), Flächennutzungsmonitoring III: Erhebung – Analyse – Bewertung (IÖR Schriften 58, S. 163–170). Rhombos.",
    "Walz, U., Krüger, T., & Schumacher, U. (2013). Fragmentierung von Wäldern in Deutschland—Neue Indikatoren zur Flächennutzung. 0028-0615, 88(3), 118–127. <a href=\"https://doi.org/10.17433/3.2013.50153211.118-127\" target=\"_blank\" rel=\"noreferrer\">https://doi.org/10.17433/3.2013.50153211.118-127</a>",
    "Walz, U., Krüger, T., & Schumacher, U. (2021). Landschaftszerschneidung und Waldfragmentierung in Deutschland: Analyseergebnisse aus dem IÖR-Monitor (pp. 127–137). Rhombos-Verlag, Berlin. <a href=\"https://doi.org/10.26084/13DFNS-P012\" target=\"_blank\" rel=\"noreferrer\">https://doi.org/10.26084/13DFNS-P012</a>"
  ]
};

export const stories = [
  {
    title: "",
    copy: "You start your journey from the Bavarian forest and reach a small road. Traffic is light, but you still wait before crossing. One wrong decision could end your journey before it begins.",
    facts: ["Roads may seem like minor barriers, but they pose a significant mortality risk. The German Hunting Association estimates around 1 million wildlife-vehicle collisions go unrecorded every year, while some researchers estimate that road traffic kills up to 3 million wild animals annually in Germany."],
    // All stories use one small, fully preloadable WebM file.
    // The still image remains the fallback until the video is ready.
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 0, end: 5 },
    audio: { src: "media/story_sound.aac", start: 0, end: 30, loopStart: 5 },
    scrollOffset: 0.55
  },
  {
    title: "",
    copy: "Back under the trees, you should feel safe. Instead, long before the highway comes into view, you can already hear it. You search for signs of another lynx, but the forest feels empty and frightening.",
    facts: ["The black tufts on a lynx’s ears help collect and amplify sound.<sup>2</sup> Anthropogenic noise can affect entire ecosystems.<sup>3,4</sup> This forest has also been heavily altered. In areas where approximately 80 % of the forest was clear-cut, lynx signs were found about 15 times less frequently than in forests with much higher mature forest cover.<sup>5</sup>",""],
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 5, end: 10 },
    audio: { src: "media/story_sound.aac", start: 30, end: 60, loopStart: 35 },
    scrollOffset: 0.55
  },
  {
    title: "",
    copy: "You move on. A multi-lane highway stretches across the landscape. Beside it stands a fenced solar park. Together they leave almost no safe route forward.",
    facts: ["Highways are among the strongest barriers for terrestrial wildlife. Fencing, traffic, noise, and artificial light all reduce landscape connectivity. Renewable energy infrastructure is essential for climate goals, but can add to habitat fragmentation and restrict wildlife movement.", ""],
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 10, end: 17 },
    audio: { src: "media/story_sound.aac", start: 60, end: 90, loopStart: 65 },
    scrollOffset: 0.55
  },
  {
    title: "",
    copy: "A canal blocks your path. Ships move through the water while harbor lights reflect across the surface. You begin to swim. The reflections blind you on your course.",
    facts: ["A Eurasian lynx’s eyes are approximately six times more sensitive than human eyes, allowing excellent night vision.<sup>2</sup> However, artificial lighting can disrupt natural darkness. Light pollution around ports, roads, and settlements alters habitats and can affect the behaviour of many nocturnal species.", ""],
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 17, end: 23 },
    audio: { src: "media/story_sound.aac", start: 90, end: 120, loopStart: 95 },
    scrollOffset: 0.55
  },
  {
    title: "",
    copy: "Just when the barriers seems impossible to cross, you find a wildlife bridge. Trees and shrubs cover the structure, making it feel like part of the forest. You cross safely above the traffic still roaring underneath you.",
    facts: ["Wildlife crossings reconnect habitats separated by infrastructure and reduce wildlife-vehicle collisions. Germany has constructed more than 100 wildlife crossings, helping animals to move between fragmented habitats.<sup>7</sup>", ""],
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 23, end: 29 },
    audio: { src: "media/story_sound.aac", start: 120, end: 150, loopStart: 125 },
    scrollOffset: 0.55
  },
  {
    title: "",
    copy: "The air smells different here. The scent of traffic fades, replaced by damp soil, trees, and moss. For the first time, finding another lynx seems possible.",
    facts: ["", ""],
    image: "media/story_placeholder.webp",
    animation: { src: "media/story.webm", start: 29, end: 33 },
    audio: { src: "media/story_sound.aac", start: 150, end: 180, loopStart: null },
    scrollOffset: 0.55
  }
];
