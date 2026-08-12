# Matti_CH4

Colab notebook for visualizing the Crezee 2022 classified GeoTIFF stored in
Google Drive and exporting all non-savannah land-cover areas as an ESRI
Shapefile. The notebook treats the most frequent valid raster class as
savannah.

## Run in Google Colab

1. Open [`Crezee_2022_map_outline.ipynb`](Crezee_2022_map_outline.ipynb) in Colab.
2. Run the cells from top to bottom.
3. Approve the Google Drive mount when prompted.
4. The notebook finds `Crezee_2022*.tif` in
   `My Drive/Colab Notebooks/PanAfrica_LU`, displays a downsampled map, detects
   the most frequent class as savannah, polygonizes and dissolves all other
   valid pixels, zips the shapefile components, and downloads the ZIP.

The output polygon retains the GeoTIFF's native coordinate reference system.
