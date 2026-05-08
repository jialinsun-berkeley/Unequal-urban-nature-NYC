const DATA_URL = "./assets/nyc_tree_final_tracts.geojson";
const SUMMARY_URL = "./assets/summary.json";
const BASE_STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

const INITIAL_VIEW = {
  center: [-73.944, 40.713],
  zoom: 9.55,
  pitch: 50,
  bearing: -10,
};

const EMPTY_FC = { type: "FeatureCollection", features: [] };

const BURDEN_BREAKS = [0.2, 0.4, 0.6, 0.8];
const BURDEN_LABELS = [
  "0-20th percentile",
  "20-40th percentile",
  "40-60th percentile",
  "60-80th percentile",
  "80-100th percentile",
];
const BURDEN_COLORS = [
  [248, 241, 228],
  [238, 215, 183],
  [225, 183, 141],
  [205, 131, 95],
  [160, 72, 58],
];
const NO_DATA_COLOR = [233, 232, 228, 228];

const PRIORITY_FILL = {
  "Top 10% high priority": [146, 56, 45, 220],
  "Top 20% priority": [217, 136, 82, 212],
  "Other included tracts": [229, 227, 222, 168],
  "Ineligible / no data": NO_DATA_COLOR,
};

const PRIORITY_LINE = {
  "Top 10% high priority": [110, 34, 26, 240],
  "Top 20% priority": [170, 91, 48, 230],
  "Other included tracts": [196, 193, 187, 110],
  "Ineligible / no data": [200, 198, 194, 70],
};

const LISA_ORDER = [
  "High-High cluster",
  "Low-Low cluster",
  "High-Low outlier",
  "Low-High outlier",
  "Not significant",
  "No data",
];

const LISA_COLORS = {
  "High-High cluster": [47, 107, 79, 225],
  "Low-Low cluster": [182, 90, 74, 225],
  "High-Low outlier": [216, 162, 74, 225],
  "Low-High outlier": [110, 127, 168, 225],
  "Not significant": [230, 228, 223, 200],
  "No data": [248, 248, 248, 232],
};

const LAYERS = {
  co_burden: {
    title: "Composite co-burden index",
    type: "burden",
    field: "co_burden_equal_weight",
    note:
      "Composite co-burden is calculated as the equal-weighted average of four standardized burden dimensions. Higher values indicate stronger spatial overlap of multiple disadvantages.",
  },
  priority: {
    title: "Priority intervention tracts",
    type: "priority",
    field: "priority_tier",
    note:
      "Priority tracts identify the top 20% and top 10% of included residential or built-up tracts based on composite co-burden. These categories support intervention prioritization rather than causal ranking.",
  },
  low_street_tree: {
    title: "Low street-tree quality burden",
    type: "burden",
    field: "low_street_tree_quality_burden",
    note:
      "Single-burden layers show the percentile class of each individual disadvantage dimension, including street-tree quality, social vulnerability, built-environment intensity, and landscape fragmentation. This layer is limited to eligible residential and built-up tracts.",
  },
  high_svi: {
    title: "High social vulnerability burden",
    type: "burden",
    field: "high_social_vulnerability_burden",
    note:
      "Single-burden layers show the percentile class of each individual disadvantage dimension, including street-tree quality, social vulnerability, built-environment intensity, and landscape fragmentation. This layer represents the SVI percentile score.",
  },
  high_built: {
    title: "High built-environment intensity burden",
    type: "burden",
    field: "high_built_environment_intensity_burden",
    note:
      "Single-burden layers show the percentile class of each individual disadvantage dimension, including street-tree quality, social vulnerability, built-environment intensity, and landscape fragmentation. This layer combines building height, building coverage, and imperviousness.",
  },
  high_fragmentation: {
    title: "High landscape fragmentation burden",
    type: "burden",
    field: "high_landscape_fragmentation_burden",
    note:
      "Single-burden layers show the percentile class of each individual disadvantage dimension, including street-tree quality, social vulnerability, built-environment intensity, and landscape fragmentation. Higher values indicate higher patch density and edge density, together with lower LPI and AI.",
  },
  lisa_health: {
    title: "LISA: Tree Health Index",
    type: "lisa",
    field: "lisa_tree_health_index_cluster",
    note:
      "LISA cluster layers show local spatial clustering patterns for tree-related outcomes. They indicate cluster type rather than the raw Local Moran's I statistic.",
  },
  lisa_density: {
    title: "LISA: Street Tree Density",
    type: "lisa",
    field: "lisa_street_tree_density_cluster",
    note:
      "LISA cluster layers show local spatial clustering patterns for tree-related outcomes. They indicate cluster type rather than the raw Local Moran's I statistic.",
  },
  lisa_diversity: {
    title: "LISA: Species Diversity",
    type: "lisa",
    field: "lisa_species_diversity_cluster",
    note:
      "LISA cluster layers show local spatial clustering patterns for tree-related outcomes. They indicate cluster type rather than the raw Local Moran's I statistic.",
  },
};

const state = {
  tractData: null,
  summaryData: null,
  studyBounds: null,
  activeLayer: "co_burden",
  overlay: null,
  hoveredFeature: null,
  selectedFeature: null,
  showBuildings: true,
  showTractOutlines: true,
};

const map = new maplibregl.Map({
  container: "map",
  style: BASE_STYLE_URL,
  center: INITIAL_VIEW.center,
  zoom: INITIAL_VIEW.zoom,
  pitch: INITIAL_VIEW.pitch,
  bearing: INITIAL_VIEW.bearing,
  antialias: true,
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-right");

map.once("style.load", async () => {
  tuneBasemap();
  ensureBuildingLayer();

  state.overlay = new deck.MapboxOverlay({ interleaved: false, layers: [] });
  map.addControl(state.overlay);

  bindUI();
  await loadData();
});

async function loadData() {
  try {
    const [geojson, summary] = await Promise.all([
      fetch(DATA_URL).then((response) => response.json()),
      fetch(SUMMARY_URL).then((response) => response.json()),
    ]);

    state.tractData = enrichTractData(geojson);
    state.summaryData = summary;
    state.studyBounds = computeBounds(geojson);

    updateSummary(summary);
    updateLayerText();
    renderScene();
    fitStudyArea(0);
    setStatus("Hover to inspect a tract. Click to pin tract details.");
  } catch (error) {
    console.error(error);
    setStatus("Data could not be loaded. Start a local server from the docs folder and reopen the page.");
  }
}

function bindUI() {
  document.querySelectorAll(".layer-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".layer-button").forEach((el) => el.classList.remove("active"));
      button.classList.add("active");
      state.activeLayer = button.dataset.layer;
      state.hoveredFeature = null;
      updateLayerText();
      renderScene();
      renderTooltip();
    });
  });

  document.getElementById("reset-view").addEventListener("click", () => {
    fitStudyArea(900);
  });

  document.getElementById("toggle-buildings").addEventListener("change", (event) => {
    state.showBuildings = event.target.checked;
    updateBuildingVisibility();
  });

  document.getElementById("toggle-tracts").addEventListener("change", (event) => {
    state.showTractOutlines = event.target.checked;
    renderScene();
  });

  document.getElementById("clear-selection").addEventListener("click", () => {
    state.selectedFeature = null;
    renderSelection();
    renderScene();
  });
}

function tuneBasemap() {
  if (map.getLayer("building")) {
    map.setPaintProperty("building", "fill-color", "#e4e3de");
    map.setPaintProperty("building", "fill-outline-color", "#d7d4cd");
  }
}

function ensureBuildingLayer() {
  if (!map.getSource("openmaptiles") || map.getLayer("context-buildings")) return;

  const firstSymbolId = map
    .getStyle()
    .layers.find((layer) => layer.type === "symbol" && layer.layout?.["text-field"])?.id;

  map.addLayer(
    {
      id: "context-buildings",
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 11,
      paint: {
        "fill-extrusion-color": "#d8d7d1",
        "fill-extrusion-height": [
          "coalesce",
          ["get", "render_height"],
          ["get", "height"],
          0,
        ],
        "fill-extrusion-base": [
          "coalesce",
          ["get", "render_min_height"],
          ["get", "min_height"],
          0,
        ],
        "fill-extrusion-opacity": 0.22,
      },
    },
    firstSymbolId,
  );

  updateBuildingVisibility();
}

function updateBuildingVisibility() {
  if (map.getLayer("context-buildings")) {
    map.setLayoutProperty("context-buildings", "visibility", state.showBuildings ? "visible" : "none");
  }
}

function enrichTractData(geojson) {
  const densityValues = geojson.features
    .map((feature) => Number(feature.properties.tree_density))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const diversityValues = geojson.features
    .map((feature) => Number(feature.properties.species_diversity))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  geojson.features.forEach((feature) => {
    const props = feature.properties;
    const density = Number(props.tree_density);
    const diversity = Number(props.species_diversity);

    props.priority_display = classifyPriority(props);
    props.tree_density_burden = Number.isFinite(density)
      ? 1 - percentileRank(densityValues, density)
      : null;
    props.species_diversity_burden = Number.isFinite(diversity)
      ? 1 - percentileRank(diversityValues, diversity)
      : null;
  });

  return geojson;
}

function percentileRank(sortedValues, value) {
  if (!sortedValues.length) return null;
  let low = 0;
  let high = sortedValues.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (sortedValues[mid] <= value) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return sortedValues.length === 1 ? 0 : (low - 1) / (sortedValues.length - 1);
}

function classifyPriority(props) {
  if (props.priority_tier === "Top 10% high priority") return props.priority_tier;
  if (props.priority_tier === "Top 20% priority") return props.priority_tier;
  if (props.co_burden_main_sample_mask) return "Other included tracts";
  return "Ineligible / no data";
}

function computeBounds(geojson) {
  const bounds = new maplibregl.LngLatBounds();

  geojson.features.forEach((feature) => {
    extendBounds(feature.geometry.coordinates, bounds);
  });

  return bounds;
}

function extendBounds(coords, bounds) {
  if (!Array.isArray(coords?.[0])) {
    bounds.extend(coords);
    return;
  }

  coords.forEach((item) => extendBounds(item, bounds));
}

function fitStudyArea(duration = 0) {
  if (!state.studyBounds) {
    map.easeTo({
      center: INITIAL_VIEW.center,
      zoom: INITIAL_VIEW.zoom,
      pitch: INITIAL_VIEW.pitch,
      bearing: INITIAL_VIEW.bearing,
      duration,
    });
    return;
  }

  map.fitBounds(state.studyBounds, {
    duration,
    bearing: INITIAL_VIEW.bearing,
    pitch: INITIAL_VIEW.pitch,
    padding: {
      top: 58,
      right: 340,
      bottom: 44,
      left: 356,
    },
  });
}

function updateSummary(summary) {
  document.getElementById("tract-count").textContent = formatInt(summary.tracts);
  document.getElementById("included-count").textContent = formatInt(summary.included_tracts);
  document.getElementById("priority-count").textContent = formatInt(summary.priority_top_20);
  document.getElementById("high-priority-count").textContent = formatInt(summary.priority_top_10);
}

function updateLayerText() {
  const config = LAYERS[state.activeLayer];
  document.getElementById("active-layer-title").textContent = config.title;
  document.getElementById("layer-note").textContent = config.note;
  renderLegend(config);
}

function renderScene() {
  if (!state.overlay || !state.tractData) return;

  const config = LAYERS[state.activeLayer];
  const layers = [
    createTractLayer(config),
    createHoverLayer(),
    createSelectionLayer(),
  ];

  state.overlay.setProps({ layers });
  renderSelection();
}

function createTractLayer(config) {
  return new deck.GeoJsonLayer({
    id: `tracts-${state.activeLayer}`,
    data: state.tractData,
    pickable: true,
    filled: true,
    stroked: state.showTractOutlines,
    extruded: false,
    lineWidthMinPixels: state.showTractOutlines ? 0.45 : 0,
    getFillColor: (feature) => getFillColor(feature.properties, config),
    getLineColor: (feature) => getLineColor(feature.properties, config),
    onHover: ({ object, x, y }) => {
      state.hoveredFeature = object || null;
      map.getCanvas().style.cursor = object ? "pointer" : "";
      renderTooltip(x, y);
      renderScene();
    },
    onClick: ({ object }) => {
      state.selectedFeature = object || null;
      renderSelection();
      renderScene();
    },
    updateTriggers: {
      getFillColor: [state.activeLayer],
      getLineColor: [state.activeLayer, state.showTractOutlines],
    },
  });
}

function createHoverLayer() {
  if (!state.hoveredFeature) return new deck.GeoJsonLayer({ id: "hover-empty", data: EMPTY_FC, pickable: false });

  return new deck.GeoJsonLayer({
    id: "hover-outline",
    data: featureCollection([state.hoveredFeature]),
    pickable: false,
    filled: false,
    stroked: true,
    lineWidthMinPixels: 2.2,
    getLineColor: [245, 243, 239, 255],
  });
}

function createSelectionLayer() {
  if (!state.selectedFeature) {
    return new deck.GeoJsonLayer({ id: "selection-empty", data: EMPTY_FC, pickable: false });
  }

  return new deck.GeoJsonLayer({
    id: "selection-outline",
    data: featureCollection([state.selectedFeature]),
    pickable: false,
    filled: false,
    stroked: true,
    lineWidthMinPixels: 2.8,
    getLineColor: [34, 30, 27, 255],
  });
}

function getFillColor(props, config) {
  if (config.type === "priority") {
    return PRIORITY_FILL[props.priority_display] || NO_DATA_COLOR;
  }

  if (config.type === "lisa") {
    return LISA_COLORS[normalizeLisaValue(props[config.field])] || LISA_COLORS["No data"];
  }

  const value = Number(props[config.field]);
  if (!Number.isFinite(value)) return NO_DATA_COLOR;
  return [...BURDEN_COLORS[burdenBin(value)], 218];
}

function getLineColor(props, config) {
  if (!state.showTractOutlines) return [0, 0, 0, 0];

  if (config.type === "priority") {
    return PRIORITY_LINE[props.priority_display] || [201, 198, 193, 110];
  }

  return [201, 198, 193, 105];
}

function normalizeLisaValue(value) {
  return value && LISA_COLORS[value] ? value : "No data";
}

function burdenBin(value) {
  if (value < BURDEN_BREAKS[0]) return 0;
  if (value < BURDEN_BREAKS[1]) return 1;
  if (value < BURDEN_BREAKS[2]) return 2;
  if (value < BURDEN_BREAKS[3]) return 3;
  return 4;
}

function renderLegend(config) {
  const legend = document.getElementById("legend");
  const swatch = (color) => `rgb(${color.slice(0, 3).join(",")})`;

  if (config.type === "lisa") {
    legend.innerHTML = `
      <div class="legend-title">${config.title}</div>
      ${LISA_ORDER.map(
        (label) =>
          `<div class="legend-row"><span class="swatch" style="background: ${swatch(LISA_COLORS[label])}"></span><span>${label}</span></div>`,
      ).join("")}
    `;
    return;
  }

  if (config.type === "priority") {
    legend.innerHTML = `
      <div class="legend-title">${config.title}</div>
      ${[
        "Top 10% high priority",
        "Top 20% priority",
        "Other included tracts",
        "Ineligible / no data",
      ]
        .map(
          (label) =>
            `<div class="legend-row"><span class="swatch" style="background: ${swatch(PRIORITY_FILL[label])}"></span><span>${label}</span></div>`,
        )
        .join("")}
    `;
    return;
  }

  legend.innerHTML = `
    <div class="legend-title">${config.title}</div>
    ${BURDEN_LABELS.map(
      (label, index) =>
        `<div class="legend-row"><span class="swatch" style="background: ${swatch(BURDEN_COLORS[index])}"></span><span>${label}</span></div>`,
    ).join("")}
    <div class="legend-row"><span class="swatch" style="background: ${swatch(NO_DATA_COLOR)}"></span><span>Ineligible / no data</span></div>
  `;
}

function renderTooltip(x, y) {
  const tooltip = document.getElementById("tooltip");

  if (!state.hoveredFeature) {
    tooltip.hidden = true;
    return;
  }

  const props = state.hoveredFeature.properties;
  const config = LAYERS[state.activeLayer];
  const currentValue = describeCurrentLayerValue(props, config);

  tooltip.hidden = false;
  tooltip.style.left = `${x + 16}px`;
  tooltip.style.top = `${y + 16}px`;
  tooltip.innerHTML = `
    <strong>${props.NAMELSAD || props.GEOID}</strong><br />
    Borough: ${props.borough || "-"}<br />
    Tract ID: ${props.GEOID || "-"}<br />
    ${config.title}: ${currentValue}<br />
    Priority status: ${props.priority_display}<br />
    Composite score: ${formatNumber(props.co_burden_equal_weight, 3)}
  `;
}

function renderSelection() {
  const emptyState = document.getElementById("selection-empty");
  const content = document.getElementById("selection-content");
  const clearButton = document.getElementById("clear-selection");

  if (!state.selectedFeature) {
    emptyState.hidden = false;
    content.hidden = true;
    clearButton.hidden = true;
    return;
  }

  const props = state.selectedFeature.properties;
  emptyState.hidden = true;
  content.hidden = false;
  clearButton.hidden = false;

  document.getElementById("selected-tract-title").textContent = `${props.NAMELSAD || props.GEOID} · ${
    props.borough || "Unknown borough"
  }`;

  document.getElementById("detail-list").innerHTML = [
    ["Composite co-burden score", formatNumber(props.co_burden_equal_weight, 3)],
    ["Tree health burden", formatBurdenValue(props.low_street_tree_quality_burden)],
    ["Tree density burden", formatBurdenValue(props.tree_density_burden)],
    ["Species diversity burden", formatBurdenValue(props.species_diversity_burden)],
    ["Social vulnerability burden", formatBurdenValue(props.high_social_vulnerability_burden)],
    ["Built-environment intensity burden", formatBurdenValue(props.high_built_environment_intensity_burden)],
    ["Landscape fragmentation burden", formatBurdenValue(props.high_landscape_fragmentation_burden)],
    ["Priority category", props.priority_display],
  ]
    .map(([label, value]) => `<dt>${label}</dt><dd>${value}</dd>`)
    .join("");
}

function describeCurrentLayerValue(props, config) {
  if (config.type === "priority") {
    return props.priority_display;
  }

  if (config.type === "lisa") {
    return normalizeLisaValue(props[config.field]);
  }

  const value = Number(props[config.field]);
  if (!Number.isFinite(value)) return "Ineligible / no data";
  return `${formatNumber(value, 3)} (${BURDEN_LABELS[burdenBin(value)]})`;
}

function formatBurdenValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Ineligible / no data";
  return `${formatNumber(numeric, 3)} (${BURDEN_LABELS[burdenBin(numeric)]})`;
}

function featureCollection(features) {
  return { type: "FeatureCollection", features };
}

function formatNumber(value, digits = 2) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatInt(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  return Math.round(numeric).toLocaleString("en-US");
}

function setStatus(message) {
  document.getElementById("status-note").textContent = message;
}
