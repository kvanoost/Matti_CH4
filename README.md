# Matti_CH4

Colab notebook for visualizing the Crezee 2022 median peat-thickness GeoTIFF
stored in Google Drive and exporting peatland together with nearby open water
as an ESRI Shapefile.

## Run in Google Colab

1. Open [`Crezee_2022_map_outline.ipynb`](Crezee_2022_map_outline.ipynb) in Colab.
2. Run the cells from top to bottom.
3. Approve the Google Drive mount when prompted.
4. The notebook finds the peat-thickness and land-cover GeoTIFFs in
   `My Drive/Colab Notebooks/PanAfrica_LU`, selects peat thickness above 0.01 m
   and open-water class 1, aggregates both to a shared 500 m equal-area grid,
   retains all open-water cells within 200 km of peatland, removes 4-neighbour
   connected grid components smaller than 5,000 cells (1,250 km²) before polygonization,
   fills enclosed background holes smaller than the same threshold, and
   downloads the zipped shapefile. Peatland and water are exported as separate
   dissolved features identified by `type = peatland` and `type = open_water`.

The 500 m aggregation and area filtering are calculated in EPSG:6933, an
equal-area coordinate
system. The finished outline is reprojected to EPSG:4326 before export for
straightforward upload as a Google Earth Engine table asset.

## Quarterly-balanced CH4 mosaic (2021–2025)

[`GEE_export_CH4_quarterly_balanced_2021_2025.js`](GEE_export_CH4_quarterly_balanced_2021_2025.js)
creates a five-year Sentinel-5P/TROPOMI mosaic of bias-corrected,
column-averaged methane (`XCH4`). Gross outliers outside 1,500–2,200 ppb are
excluded. Valid retrievals are grouped into four three-month periods per year,
and their median is calculated for each year-quarter to reduce sensitivity to
anomalous retrievals and orbital striping. A year-quarter is retained when at
least one valid retrieval is available.

For each seasonal quarter (Q1–Q4), the script calculates the median across
2021–2025. The final mosaic is the equally weighted mean of the represented
seasonal-quarter composites, preventing seasons with more observations from
dominating the result. Pixels are retained when at least two of the four
seasonal quarters are represented. The product is exported at 10 km resolution
with diagnostic bands for valid year-quarters, represented seasonal quarters,
total valid retrievals, and temporal variability. Pixels with limited seasonal
representation should be interpreted cautiously, particularly over persistently
cloudy equatorial forest.
