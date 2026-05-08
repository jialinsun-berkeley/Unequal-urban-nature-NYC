# Interactive Atlas

This folder contains the static MapLibre + Deck.gl atlas for the final project.
It does not require a Mapbox token.

## Local Preview

Do not open `index.html` directly from the file system. The atlas loads GeoJSON with `fetch()`, so it needs an HTTP server.

Run a static server from the repository root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/src/atlas/
```

The atlas reads:

```text
src/atlas/assets/nyc_tree_final_tracts.geojson
src/atlas/assets/summary.json
```
