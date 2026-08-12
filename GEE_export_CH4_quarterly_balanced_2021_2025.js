// =============================================================
// Quarterly-balanced Sentinel-5P CH4 mosaic, 2021-2025
// Maximum-coverage 10 km version for equatorial Africa.
//
// Output bands:
//   CH4_quarterly_balanced_mean
//   CH4_quarterly_balanced_median
//   valid_quarters                 (0-20 year-quarters)
//   represented_seasonal_quarters (0-4 Q1/Q2/Q3/Q4)
//   CH4_interannual_stddev         (variability among year-quarters)
//   CH4_seasonal_stddev            (variability among Q1/Q2/Q3/Q4)
//   valid_orbit_observations
// =============================================================

// ------------------------------
// 1. SETTINGS
// ------------------------------
var startYear = 2021;
var endYear = 2025;

var ch4Band =
  'CH4_column_volume_mixing_ratio_dry_air_bias_corrected';

// Maximum-coverage settings for cloudy equatorial Africa.
// Coverage diagnostics must be used to identify weakly supported pixels.
var minimumObservationsPerQuarter = 1;

// A seasonal quarter (for example Q1) must occur in this many years.
var minimumYearsPerSeasonalQuarter = 1;

// Final mosaic requires this many represented seasons out of Q1-Q4.
var minimumRepresentedSeasonalQuarters = 2;

// Broad bounds remove only gross retrieval outliers.
var minimumCH4 = 1500;
var maximumCH4 = 2200;

var exportScale = 10000;

var congoBasin = ee.FeatureCollection(
  'projects/tropsedslu/assets/CB/Basins/CB_outline'
);

// Simple region avoids expensive operations on a complex export boundary.
var exportRegion = ee.Geometry.Rectangle([8, -14, 32, 8], null, false);

// ------------------------------
// 2. LOAD AND FILTER CH4
// ------------------------------
var rawCH4 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4')
  .filterDate(
    ee.Date.fromYMD(startYear, 1, 1),
    ee.Date.fromYMD(endYear + 1, 1, 1)
  )
  .filterBounds(exportRegion);

function maskRetrieval(image) {
  var ch4 = image.select(ch4Band);
  var valid = ch4.gte(minimumCH4).and(ch4.lte(maximumCH4));

  return ch4
    .updateMask(valid)
    .rename('CH4')
    .copyProperties(image, ['system:time_start']);
}

var filteredCH4 = rawCH4.map(maskRetrieval);

// Fully masked placeholder prevents zero-band errors in empty quarters.
// It contributes neither values nor counts.
var emptyCH4 = ee.Image.constant(0)
  .rename('CH4')
  .updateMask(ee.Image.constant(0));

var years = ee.List.sequence(startYear, endYear);
var quarters = ee.List.sequence(1, 4);

// ------------------------------
// 3. BUILD 20 YEAR-QUARTER COMPOSITES
// ------------------------------
var quarterlyImages = ee.ImageCollection.fromImages(
  years.map(function(year) {
    year = ee.Number(year);

    return quarters.map(function(quarter) {
      quarter = ee.Number(quarter);
      var startMonth = quarter.subtract(1).multiply(3).add(1);
      var start = ee.Date.fromYMD(year, startMonth, 1);
      var end = start.advance(3, 'month');

      var selected = filteredCH4.filterDate(start, end);
      var safeSelected = selected.merge(ee.ImageCollection([emptyCH4]));

      var observationCount = safeSelected.count()
        .rename('quarter_observation_count');

      // Median reduces sensitivity to orbit stripes and isolated outliers.
      var quarterlyMedian = safeSelected.median()
        .rename('CH4')
        .updateMask(
          observationCount.gte(minimumObservationsPerQuarter)
        );

      return quarterlyMedian
        .addBands(observationCount)
        .set('system:time_start', start.millis())
        .set('year', year)
        .set('quarter', quarter)
        .set('year_quarter',
          year.format().cat('-Q').cat(quarter.format()));
    });
  }).flatten()
);

// ------------------------------
// 4. BUILD Q1-Q4 COMPOSITES ACROSS YEARS
// ------------------------------
var seasonalQuarterImages = ee.ImageCollection.fromImages(
  quarters.map(function(quarter) {
    quarter = ee.Number(quarter);

    var selected = quarterlyImages
      .filter(ee.Filter.eq('quarter', quarter))
      .select('CH4');

    var validYearCount = selected.count().rename('valid_years');

    // Median across years prevents one anomalous year from dominating.
    var seasonalMedian = selected.median()
      .rename('CH4')
      .updateMask(
        validYearCount.gte(minimumYearsPerSeasonalQuarter)
      );

    return seasonalMedian
      .addBands(validYearCount)
      .set('quarter', quarter)
      .set('system:time_start',
        ee.Date.fromYMD(2000, quarter.subtract(1).multiply(3).add(1), 1)
          .millis());
  })
);

// ------------------------------
// 5. FINAL BALANCED MOSAIC AND DIAGNOSTICS
// ------------------------------

// Number of valid year-quarter composites: 0-20.
var validQuarters = quarterlyImages.select('CH4')
  .count()
  .rename('valid_quarters');

// Number of represented seasonal quarters: 0-4.
var representedSeasonalQuarters = seasonalQuarterImages.select('CH4')
  .count()
  .rename('represented_seasonal_quarters');

var sufficientCoverage = representedSeasonalQuarters
  .gte(minimumRepresentedSeasonalQuarters);

// Q1-Q4 each contribute one image, so seasons receive equal weight.
var balancedMean = seasonalQuarterImages.select('CH4')
  .mean()
  .rename('CH4_quarterly_balanced_mean')
  .updateMask(sufficientCoverage);

var balancedMedian = seasonalQuarterImages.select('CH4')
  .median()
  .rename('CH4_quarterly_balanced_median')
  .updateMask(sufficientCoverage);

// Variation among all available year-quarter composites (up to 20).
var interannualStdDev = quarterlyImages.select('CH4')
  .reduce(ee.Reducer.stdDev())
  .rename('CH4_interannual_stddev')
  .updateMask(sufficientCoverage);

// Variation among the four across-year seasonal composites.
var seasonalStdDev = seasonalQuarterImages.select('CH4')
  .reduce(ee.Reducer.stdDev())
  .rename('CH4_seasonal_stddev')
  .updateMask(sufficientCoverage);

var validOrbitObservations = filteredCH4.count()
  .rename('valid_orbit_observations');

var output = balancedMean
  .addBands(balancedMedian)
  .addBands(validQuarters)
  .addBands(representedSeasonalQuarters)
  .addBands(interannualStdDev)
  .addBands(seasonalStdDev)
  .addBands(validOrbitObservations)
  .toFloat();

// ------------------------------
// 6. MAP DISPLAY
// ------------------------------
var ch4Vis = {
  min: 1780,
  max: 1920,
  palette: [
    '000004', '2C115F', '721F81', 'B73779',
    'F1605D', 'FEB078', 'FCFDBF'
  ]
};

var count20Vis = {
  min: 0,
  max: 20,
  palette: ['440154', '3B528B', '21918C', '5DC963', 'FDE725']
};

var stdDevVis = {
  min: 0,
  max: 30,
  palette: ['FFFFFF', 'FFFFB2', 'FECC5C', 'FD8D3C', 'E31A1C']
};

Map.setOptions('HYBRID');
Map.centerObject(congoBasin, 5);

Map.addLayer(
  balancedMean,
  ch4Vis,
  'Quarterly-balanced CH4 mean 2021-2025',
  true
);

Map.addLayer(
  balancedMedian,
  ch4Vis,
  'Quarterly-balanced CH4 median 2021-2025',
  false
);

Map.addLayer(
  validQuarters,
  count20Vis,
  'Valid year-quarters (0-20)',
  false
);

Map.addLayer(
  representedSeasonalQuarters,
  {min: 0, max: 4, palette: ['440154', '31688E', '35B779', 'FDE725']},
  'Represented seasonal quarters (0-4)',
  false
);

Map.addLayer(
  interannualStdDev,
  stdDevVis,
  'Interannual/quarterly CH4 standard deviation',
  false
);

Map.addLayer(
  seasonalStdDev,
  stdDevVis,
  'Seasonal CH4 standard deviation',
  false
);

// Optional visual check for land-cover-shaped CH4 artefacts.
// This layer is not used in the mosaic calculation.
var worldCover = ee.ImageCollection('ESA/WorldCover/v200').first();
Map.addLayer(
  worldCover,
  {},
  'ESA WorldCover 2021 (artefact comparison)',
  false
);

Map.addLayer(
  congoBasin.style({
    color: 'FF0000',
    fillColor: '00000000',
    width: 2
  }),
  {},
  'Congo Basin outline',
  true
);

// ------------------------------
// 7. CHECKS
// ------------------------------
print('Raw orbit images', rawCH4.size());
print('Year-quarter composites (expected 20)', quarterlyImages.size());
print('Seasonal-quarter composites (expected 4)', seasonalQuarterImages.size());
print('Output bands', output.bandNames());
print('Output image', output);

// ------------------------------
// 8. EXPORT
// ------------------------------
Export.image.toAsset({
  image: output,
  description: 'CH4_quarterly_balanced_10km_2021_2025',
  assetId:
    'projects/tropsedslu/assets/CB/CH4/' +
    'ch4_quarterly_balanced_10km_2021_2025',
  region: exportRegion,
  scale: exportScale,
  maxPixels: 1e9,
  pyramidingPolicy: {
    CH4_quarterly_balanced_mean: 'mean',
    CH4_quarterly_balanced_median: 'mean',
    valid_quarters: 'mode',
    represented_seasonal_quarters: 'mode',
    CH4_interannual_stddev: 'mean',
    CH4_seasonal_stddev: 'mean',
    valid_orbit_observations: 'mode'
  }
});
