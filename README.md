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
   dissolves the retained footprint, and downloads the zipped shapefile. The
   preview displays peatland and retained water in contrasting colors.

The 500 m aggregation and area filtering are calculated in EPSG:6933, an
equal-area coordinate
system. The finished outline is reprojected to EPSG:4326 before export for
straightforward upload as a Google Earth Engine table asset.
