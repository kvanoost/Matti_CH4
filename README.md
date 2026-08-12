# Matti_CH4

Colab notebook for visualizing the Crezee 2022 median peat-thickness GeoTIFF
stored in Google Drive and exporting peatland—pixels with peat thickness above
0.01 m—as an ESRI Shapefile.

## Run in Google Colab

1. Open [`Crezee_2022_map_outline.ipynb`](Crezee_2022_map_outline.ipynb) in Colab.
2. Run the cells from top to bottom.
3. Approve the Google Drive mount when prompted.
4. The notebook finds `Crezee_2022_Median_Peat_thickness_RF_100runs*.tif` in
   `My Drive/Colab Notebooks/PanAfrica_LU`, displays a downsampled map, selects
   peat thickness above 0.01 m, aggregates peatland presence to a 1 km
   equal-area grid, polygonizes and dissolves the selected grid cells, zips the
   shapefile components, and downloads the ZIP.

The output uses the EPSG:6933 equal-area coordinate system, whose metre-based
coordinates support a consistent 1 km grid across Africa.
