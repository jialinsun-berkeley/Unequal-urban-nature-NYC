"""Generate lightweight Python-built interactive HTML maps for the final page.

The main atlas in ``src/atlas`` is a richer Deck.gl/MapLibre application. These
two maps are generated from Python so the repository also includes reproducible
interactive map artifacts in ``visualizations/interactive``.
"""

from __future__ import annotations

import json
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
ATLAS_GEOJSON = PROJECT / "src" / "atlas" / "assets" / "nyc_tree_final_tracts.geojson"
OUT_DIR = PROJECT / "visualizations" / "interactive"


def load_features() -> dict:
    with ATLAS_GEOJSON.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_html(path: Path, title: str, subtitle: str, body_script: str) -> None:
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>{title}</title>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map {{ height: 100%; margin: 0; }}
      body {{ font-family: Aptos, "Segoe UI", Arial, sans-serif; }}
      .panel {{
        position: absolute; z-index: 900; top: 16px; left: 16px; width: min(330px, calc(100% - 32px));
        background: rgba(255,255,255,0.94); border: 1px solid rgba(30,28,24,0.16);
        padding: 14px 15px; box-shadow: 0 10px 28px rgba(0,0,0,0.12);
      }}
      .panel h1 {{ margin: 0 0 8px; font-size: 19px; line-height: 1.15; }}
      .panel p {{ margin: 0 0 10px; color: #514b44; font-size: 13px; line-height: 1.45; }}
      .legend {{ display: grid; gap: 6px; margin-top: 10px; font-size: 12px; color: #514b44; }}
      .row {{ display: grid; grid-template-columns: 18px 1fr; gap: 7px; align-items: center; }}
      .swatch {{ width: 18px; height: 12px; border: 1px solid rgba(0,0,0,0.18); }}
      .note {{ font-size: 11px; color: #6a625a; }}
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div class="panel">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      <div id="legend" class="legend"></div>
      <p class="note">Aggregation level: Census tract. Data sources: NYC Street Tree Census, ACS, CDC SVI, UrbanWatch, PLUTO, buildings, parks.</p>
    </div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      {body_script}
    </script>
  </body>
</html>
"""
    path.write_text(html, encoding="utf-8")


def build_coburden_map(data: dict) -> str:
    return f"""
const data = {json.dumps(data, separators=(",", ":"))};
const breaks = [0.2, 0.4, 0.6, 0.8];
const colors = ["#fbf3e6", "#f3d8a6", "#eab870", "#d98952", "#b75a4a"];
const labels = ["0-20th percentile", "20-40th percentile", "40-60th percentile", "60-80th percentile", "80-100th percentile"];
function bin(v) {{ if (v < breaks[0]) return 0; if (v < breaks[1]) return 1; if (v < breaks[2]) return 2; if (v < breaks[3]) return 3; return 4; }}
function style(feature) {{
  const v = Number(feature.properties.co_burden_equal_weight);
  const noData = !Number.isFinite(v);
  return {{ color: "#7d746b", weight: 0.35, fillOpacity: noData ? 0.25 : 0.74, fillColor: noData ? "#e8e8e8" : colors[bin(v)] }};
}}
function popup(feature, layer) {{
  const p = feature.properties;
  const v = Number(p.co_burden_equal_weight);
  layer.bindPopup(`<strong>${{p.NAMELSAD || p.GEOID}}</strong><br>Borough: ${{p.borough || "-"}}<br>Composite co-burden: ${{Number.isFinite(v) ? v.toFixed(3) : "No data"}}<br>Priority: ${{p.priority_tier || "-"}}`);
  layer.on("mouseover", () => layer.setStyle({{weight: 2, color: "#1e1b18"}}));
  layer.on("mouseout", () => geojson.resetStyle(layer));
}}
const map = L.map("map", {{ zoomControl: true }}).setView([40.713, -73.944], 10);
L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{ maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }}).addTo(map);
const geojson = L.geoJSON(data, {{ style, onEachFeature: popup }}).addTo(map);
map.fitBounds(geojson.getBounds(), {{ padding: [20, 20] }});
document.getElementById("legend").innerHTML = labels.map((label, i) => `<div class="row"><span class="swatch" style="background:${{colors[i]}}"></span><span>${{label}}</span></div>`).join("") + `<div class="row"><span class="swatch" style="background:#e8e8e8"></span><span>Ineligible / no data</span></div>`;
"""


def build_lisa_map(data: dict) -> str:
    return f"""
const data = {json.dumps(data, separators=(",", ":"))};
const fields = {{
  "Tree Health Index": "lisa_tree_health_index_cluster",
  "Street Tree Density": "lisa_street_tree_density_cluster",
  "Species Diversity": "lisa_species_diversity_cluster"
}};
const colors = {{
  "High-High cluster": "#2f6f55",
  "Low-Low cluster": "#b75a4a",
  "High-Low outlier": "#d9a24c",
  "Low-High outlier": "#6e7fa8",
  "Not significant": "#e6e4df",
  "No data": "#f8f8f8"
}};
let activeField = fields["Tree Health Index"];
function value(feature) {{ return feature.properties[activeField] || "No data"; }}
function style(feature) {{ const v = value(feature); return {{ color: "#7d746b", weight: 0.35, fillOpacity: 0.76, fillColor: colors[v] || colors["No data"] }}; }}
function popup(feature, layer) {{
  const p = feature.properties;
  layer.bindPopup(`<strong>${{p.NAMELSAD || p.GEOID}}</strong><br>Borough: ${{p.borough || "-"}}<br>LISA cluster: <span class="cluster">${{value(feature)}}</span>`);
  layer.on("mouseover", () => layer.setStyle({{weight: 2, color: "#1e1b18"}}));
  layer.on("mouseout", () => geojson.resetStyle(layer));
}}
const map = L.map("map", {{ zoomControl: true }}).setView([40.713, -73.944], 10);
L.tileLayer("https://tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png", {{ maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }}).addTo(map);
const control = L.control({{ position: "topright" }});
control.onAdd = function() {{
  const div = L.DomUtil.create("div", "panel");
  div.style.position = "static";
  div.style.width = "230px";
  div.innerHTML = `<label for="layer-select"><strong>Outcome</strong></label><br><select id="layer-select">${{Object.keys(fields).map(k => `<option>${{k}}</option>`).join("")}}</select>`;
  L.DomEvent.disableClickPropagation(div);
  return div;
}};
control.addTo(map);
const geojson = L.geoJSON(data, {{ style, onEachFeature: popup }}).addTo(map);
map.fitBounds(geojson.getBounds(), {{ padding: [20, 20] }});
document.getElementById("layer-select").addEventListener("change", (event) => {{ activeField = fields[event.target.value]; geojson.setStyle(style); }});
document.getElementById("legend").innerHTML = Object.keys(colors).map(label => `<div class="row"><span class="swatch" style="background:${{colors[label]}}"></span><span>${{label}}</span></div>`).join("");
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    data = load_features()
    write_html(
        OUT_DIR / "co_burden_interactive.html",
        "Interactive Map 1. Composite Co-burden Index",
        "Tract-level percentile burden map. Darker colors indicate stronger overlap of low street-tree quality, high social vulnerability, built intensity, and canopy fragmentation.",
        build_coburden_map(data),
    )
    write_html(
        OUT_DIR / "lisa_clusters_interactive.html",
        "Interactive Map 2. LISA Cluster Explorer",
        "Use the outcome selector to compare Local Moran's I cluster categories for tree health, street-tree density, and species diversity.",
        build_lisa_map(data),
    )


if __name__ == "__main__":
    main()
