# Unequal Urban Nature in NYC

**Di Li, Jialin Sun, Xiaojing Jin, Chunman Li**

Unequal urban nature in NYC: linking street-tree condition, observed biodiversity, and socioeconomic inequities.

## Repository Contents

- `scripts/final_analysis.ipynb`: final analysis notebook. Run all cells to reproduce analytical tables, figures, and web-map assets from the processed tract-level dataset.
- `scripts/create_interactive_maps.py`: Python script that generates two interactive HTML maps in `visualizations/interactive/`.
- `src/atlas/`: interactive MapLibre + Deck.gl atlas for the final project.
- `visualizations/`: exported static figures and Python-generated interactive maps.
- `report.pdf` and `Final_Report.docx`: final written report.
- `data/`: local data folders. Large raw and processed data are intentionally not committed to GitHub.

## Running the Notebook

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Place the processed checkpoint at:

```text
data/processed/tract_indicators_full.gpkg
```

3. Open and run:

```text
scripts/final_analysis.ipynb
```

The notebook writes generated tables to `data/revised/`, figures to `visualizations/revised/`, and interactive-map assets to `src/atlas/assets/`.

4. Generate Python-built interactive maps:

```bash
python scripts/create_interactive_maps.py
```

This writes:

```text
visualizations/interactive/co_burden_interactive.html
visualizations/interactive/lisa_clusters_interactive.html
```

## GitHub Pages

The repository deploys as a static site through `.github/workflows/static.yml`. The root `index.html` links to the interactive atlas, final notebook, visualizations, and report.

- [Deployed project site](https://jialinsun-berkeley.github.io/Unequal-urban-nature-NYC/)
- [Interactive atlas](https://jialinsun-berkeley.github.io/Unequal-urban-nature-NYC/src/atlas/)

For local testing, do not open `index.html` or `src/atlas/index.html` directly from the file system. The atlas loads GeoJSON with `fetch()`, so it needs an HTTP server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```
