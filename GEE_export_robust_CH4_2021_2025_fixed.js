// ======================================================
// Robust Sentinel-5P CH4 mosaic, 2021-2025
// Safe for months with no source images.
// ======================================================

var startYear = 2021;
var endYear = 2025;
var ch4Band = 'CH4_column_volume_mixing_ratio_dry_air_bias_corrected';

// Counts are evaluated on the native ~1.1 km Earth Engine L3 grid, not on
// the final 7 km export grid. Keep these thresholds permissive in cloudy
// tropical regions; the monthly and across-year medians provide robustness.
var minimumObservationsPerMonth = 1;
var minimumYearsPerCalendarMonth = 2;
var minimumCalendarMonths = 6;
var minimumCH4 = 1650;
var maximumCH4 = 2100;
var exportScale = 7000;

var congoBasin = ee.FeatureCollection(
  'projects/tropsedslu/assets/CB/Basins/CB_outline'
);

var exportRegion = ee.Geometry.Rectangle([8, -14, 32, 8], null, false);

var rawCH4 = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4')
  .filterDate(
    ee.Date.fromYMD(startYear, 1, 1),
    ee.Date.fromYMD(endYear + 1, 1, 1)
  )
  .filterBounds(exportRegion);

function maskRetrieval(image) {
  var ch4 = image.select(ch4Band);
  // The Earth Engine CH4 product is already screened for retrieval validity
  // during ingestion. Retain broad physical bounds to reject gross outliers.
  // Extra uncertainty and viewing-angle filters caused severe data loss over
  // the cloudy Congo Basin and are intentionally not applied here.
  var valid = ch4.gte(minimumCH4)
    .and(ch4.lte(maximumCH4));

  return ch4.updateMask(valid)
    .rename('CH4')
    .copyProperties(image, ['system:time_start']);
}

var filteredCH4 = rawCH4.map(maskRetrieval);

// A correctly named but completely masked image keeps collection reductions
// one-banded when a month has no Sentinel-5P source images.
var emptyCH4 = ee.Image.constant(0)
  .rename('CH4')
  .updateMask(ee.Image.constant(0));

var years = ee.List.sequence(startYear, endYear);
var months = ee.List.sequence(1, 12);

var monthlyImages = ee.ImageCollection.fromImages(
  years.map(function(year) {
    year = ee.Number(year);
    return months.map(function(month) {
      month = ee.Number(month);
      var start = ee.Date.fromYMD(year, month, 1);
      var selected = filteredCH4.filterDate(start, start.advance(1, 'month'));
      var safeSelected = selected.merge(ee.ImageCollection([emptyCH4]));
      var count = safeSelected.count().rename('monthly_observation_count');
      var median = safeSelected.median()
        .rename('CH4')
        .updateMask(count.gte(minimumObservationsPerMonth));

      return median.addBands(count)
        .set('system:time_start', start.millis())
        .set('year', year)
        .set('month', month);
    });
  }).flatten()
);

var calendarMonthImages = ee.ImageCollection.fromImages(
  months.map(function(month) {
    month = ee.Number(month);
    var selected = monthlyImages
      .filter(ee.Filter.eq('month', month))
      .select('CH4');
    var count = selected.count().rename('valid_year_count');
    var median = selected.median()
      .rename('CH4')
      .updateMask(count.gte(minimumYearsPerCalendarMonth));

    return median.addBands(count)
      .set('month', month)
      .set('system:time_start', ee.Date.fromYMD(2000, month, 1).millis());
  })
);

var validCalendarMonthCount = calendarMonthImages.select('CH4')
  .count().rename('valid_calendar_months');
var sufficientCoverage = validCalendarMonthCount.gte(minimumCalendarMonths);

var robustMean = calendarMonthImages.select('CH4').mean()
  .rename('CH4_robust_mean').updateMask(sufficientCoverage);
var robustMedian = calendarMonthImages.select('CH4').median()
  .rename('CH4_robust_median').updateMask(sufficientCoverage);
var seasonalStdDev = calendarMonthImages.select('CH4')
  .reduce(ee.Reducer.stdDev())
  .rename('CH4_seasonal_stddev').updateMask(sufficientCoverage);
var validMonthlyCount = monthlyImages.select('CH4')
  .count().rename('valid_monthly_composites');

// Number of individual valid orbit observations across all five years.
var totalObservationCount = filteredCH4.count()
  .rename('valid_orbit_observations');

var output = robustMean
  .addBands(robustMedian)
  .addBands(validMonthlyCount)
  .addBands(validCalendarMonthCount)
  .addBands(totalObservationCount)
  .addBands(seasonalStdDev)
  .toFloat();

var ch4Vis = {
  min: 1780,
  max: 1920,
  palette: ['000004', '2C115F', '721F81', 'B73779', 'F1605D', 'FEB078', 'FCFDBF']
};

Map.setOptions('HYBRID');
Map.centerObject(congoBasin, 5);
Map.addLayer(robustMean, ch4Vis, 'Robust mean 2021-2025', true);
Map.addLayer(robustMedian, ch4Vis, 'Robust median 2021-2025', false);
Map.addLayer(validMonthlyCount,
  {min: 0, max: 60, palette: ['440154', '21918C', 'FDE725']},
  'Valid monthly composites', false);
Map.addLayer(validCalendarMonthCount,
  {min: 0, max: 12, palette: ['440154', '21918C', 'FDE725']},
  'Valid calendar months', false);
Map.addLayer(totalObservationCount,
  {min: 0, max: 100, palette: ['000000', '2C7BB6', 'FFFFBF', 'D7191C']},
  'Valid orbit observations', false);

print('Raw source images', rawCH4.size());
print('Monthly composites', monthlyImages.size());
print('Output bands', output.bandNames());

Export.image.toAsset({
  image: output,
  description: 'CH4_robust_5yr_2021_2025_v2',
  assetId: 'projects/tropsedslu/assets/CB/CH4/ch4_robust_5yr_2021_2025_v2',
  region: exportRegion,
  scale: exportScale,
  maxPixels: 1e9,
  pyramidingPolicy: {
    CH4_robust_mean: 'mean',
    CH4_robust_median: 'mean',
    valid_monthly_composites: 'mode',
    valid_calendar_months: 'mode',
    valid_orbit_observations: 'mode',
    CH4_seasonal_stddev: 'mean'
  }
});
