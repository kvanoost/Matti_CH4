// ======================================================
// Congo Basin CH4 App
// Uses precomputed long-term mean asset (2019-2025)
// User draws a polygon to get:
//   1) monthly CH4 time series (2019-2025)
//   2) average monthly concentration (Jan-Dec climatology)
// Added:
//   - count layer toggle
//   - count map loaded from asset
//   - separate legend for count layer
//   - number of observations used in the graphics
// ======================================================

// ------------------------------
// 1. DATA
// ------------------------------
var congoBasin = ee.FeatureCollection('projects/tropsedslu/assets/CB/Basins/CB_outline');
var cuvetteCentral = ee.FeatureCollection(
  'projects/tropsedslu/assets/CB/CH4/Crezee_cuvette'
);
var cuvettePeat = cuvetteCentral.filter(ee.Filter.eq('type', 'peatland'));
var cuvetteWater = cuvetteCentral.filter(ee.Filter.eq('type', 'open_water'));

// Precomputed combined peatland/open-water mask.
var cuvetteMask = ee.Image(
  'projects/tropsedslu/assets/CB/CH4/Crezee_cuvette_mask_10km'
).select('cuvette_mask').selfMask();

// A simple rectangle avoids reductions over complex vector geometry.
var cuvetteReductionRegion = ee.Geometry.Rectangle(
  [8, -14, 32, 8], null, false
);
var maskAnalysisScale = 10000;

// Precomputed assets
var longTermMean = ee.Image('projects/tropsedslu/assets/CB/CH4/ch4_mean_2019_2025');
var longTermCount = ee.Image('projects/tropsedslu/assets/CB/CH4/ch4_count_2019_2025');

// Original collection only for polygon charts
var ch4Collection = ee.ImageCollection('COPERNICUS/S5P/OFFL/L3_CH4');
var ch4Band = 'CH4_column_volume_mixing_ratio_dry_air_bias_corrected';

// Analysis period
var startDate = ee.Date('2019-01-01');
var endDate   = ee.Date('2026-01-01');   // exclusive, includes all of 2025

var ch4Filtered = ch4Collection
  .filterDate(startDate, endDate)
  .filterBounds(congoBasin)
  .select(ch4Band);

// ------------------------------
// 2. BASIN MEAN FROM ASSET
// ------------------------------
var basinMeanValue = longTermMean.reduceRegion({
  reducer: ee.Reducer.mean(),
  geometry: congoBasin.geometry(),
  scale: 5000,
  maxPixels: 1e13
}).values().get(0);

// ------------------------------
// 3. MONTHLY IMAGE COLLECTION (2019-2025)
// ------------------------------
var years = ee.List.sequence(2019, 2025);
var months = ee.List.sequence(1, 12);

var monthlyCH4 = ee.ImageCollection.fromImages(
  years.map(function(y) {
    y = ee.Number(y);
    return months.map(function(m) {
      m = ee.Number(m);
      var start = ee.Date.fromYMD(y, m, 1);
      var end = start.advance(1, 'month');

      var img = ch4Filtered
        .filterDate(start, end)
        .mean()
        .clip(congoBasin)
        .rename(ch4Band)
        .set('system:time_start', start.millis())
        .set('year', y)
        .set('month', m)
        .set('month_label', start.format('MMM'))
        .set('year_month', start.format('YYYY-MM'));

      return img;
    });
  }).flatten()
);

// ------------------------------
// 4. MONTHLY CLIMATOLOGY (Jan-Dec mean over 2019-2025)
// ------------------------------
var monthlyClimatology = ee.ImageCollection.fromImages(
  months.map(function(m) {
    m = ee.Number(m);

    var img = monthlyCH4
      .filter(ee.Filter.eq('month', m))
      .mean()
      .rename(ch4Band)
      .set('month', m)
      .set('system:time_start', ee.Date.fromYMD(2000, m, 1).millis())
      .set('month_label', ee.Date.fromYMD(2000, m, 1).format('MMM'));

    return img;
  })
);

// ------------------------------
// 5. MAP DISPLAY
// ------------------------------
var outline = ee.Image().byte().paint({
  featureCollection: congoBasin,
  color: 1,
  width: 2
});

var ch4Vis = {
  min: 1750,
  max: 1920,
  palette: ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
};

var countVis = {
  min: 0,
  max: 2000,
  palette: ['000000', '2c7bb6', 'abd9e9', 'ffffbf', 'fdae61', 'd7191c']
};

// ------------------------------
// 6. UI LAYOUT
// ------------------------------
ui.root.clear();

var map = ui.Map();
map.centerObject(congoBasin, 5);
map.setOptions('HYBRID');
map.style().set('cursor', 'crosshair');

var meanLayer = ui.Map.Layer(longTermMean, ch4Vis, 'Mean CH4 2019-2025', true);
var countLayer = ui.Map.Layer(longTermCount, countVis, 'Observation count 2019-2025', false);
var outlineLayer = ui.Map.Layer(outline, {palette: ['FF0000']}, 'Congo Basin outline', true);
var cuvettePeatOutline = ee.Image().byte().paint({
  featureCollection: cuvettePeat,
  color: 1
});
var cuvetteWaterOutline = ee.Image().byte().paint({
  featureCollection: cuvetteWater,
  color: 1
});
var cuvettePeatLayer = ui.Map.Layer(
  cuvettePeatOutline,
  {palette: ['00FF66']},
  'Cuvette Central peatland',
  false,
  0.4
);
var cuvetteWaterLayer = ui.Map.Layer(
  cuvetteWaterOutline,
  {palette: ['00BFFF']},
  'Cuvette Central open water',
  false,
  0.4
);

map.layers().reset([
  meanLayer,
  countLayer,
  outlineLayer,
  cuvettePeatLayer,
  cuvetteWaterLayer
]);

// On-map instruction
var mapInstruction = ui.Label('Draw a polygon or load Cuvette Central to generate the figures', {
  position: 'top-center',
  fontWeight: 'bold',
  fontSize: '14px',
  padding: '8px',
  backgroundColor: 'rgba(255,255,255,0.8)'
});
map.add(mapInstruction);

var panel = ui.Panel({
  style: {
    width: '430px',
    padding: '12px'
  }
});

var title = ui.Label('Congo Basin CH4 (2019–2025)', {
  fontWeight: 'bold',
  fontSize: '20px',
  margin: '0 0 8px 0'
});

var subtitle = ui.Label(
  'Map shows the long-term mean CH4 concentration from a precomputed asset. Draw a polygon or load the predefined Cuvette Central polygon to see the monthly time series (2019–2025), the average monthly seasonal cycle, and the number of observations used.',
  {margin: '0 0 12px 0', color: '#444'}
);

var meanTitle = ui.Label('Long-term basin mean', {
  fontWeight: 'bold',
  margin: '8px 0 4px 0'
});

var meanValueLabel = ui.Label('Calculating...', {
  fontSize: '18px',
  color: '#1d6b99',
  margin: '0 0 12px 0'
});

// Drawing controls in side panel
var drawTitle = ui.Label('Polygon selection', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

var drawInfo = ui.Label(
  'Draw a polygon on the map, or load the predefined Cuvette Central polygon. Drawn polygons remain editable and the figures update automatically.',
  {margin: '0 0 8px 0', color: '#444'}
);

var statusLabel = ui.Label('No polygon selected yet.', {
  margin: '0 0 8px 0',
  color: '#444'
});

var drawButton = ui.Button({
  label: 'Draw polygon',
  onClick: function() {
    useCuvetteCentral = false;
    cuvettePeatLayer.setShown(false);
    cuvetteWaterLayer.setShown(false);
    resetDrawing();
    drawingTools.setShape('polygon');
    drawingTools.draw();
    statusLabel.setValue('Drawing mode active: create a polygon on the map.');
  }
});

var loadCuvetteButton = ui.Button({
  label: 'Load Cuvette Central',
  onClick: function() {
    clearGeometry();
    useCuvetteCentral = true;
    cuvettePeatLayer.setShown(true);
    cuvetteWaterLayer.setShown(true);
    map.centerObject(cuvetteCentral, 7);
    statusLabel.setValue('Cuvette Central selected. Updating figures...');
    updateChartsFromPolygon();
  }
});

var clearButton = ui.Button({
  label: 'Clear selection',
  onClick: function() {
    useCuvetteCentral = false;
    cuvettePeatLayer.setShown(false);
    cuvetteWaterLayer.setShown(false);
    clearGeometry();
    chartPanel1.clear();
    chartPanel2.clear();
    polyMeanLabel.setValue('No polygon selected.');
    tsCountLabel.setValue('Observations in monthly time series: —');
    climCountLabel.setValue('Observations in monthly climatology: —');
    statusLabel.setValue('Selection cleared. Draw a polygon or load Cuvette Central.');
  }
});

// Layer toggle
var layerTitle = ui.Label('Map layers', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

var countCheckbox = ui.Checkbox({
  label: 'Show observation count layer',
  value: false,
  onChange: function(checked) {
    countLayer.setShown(checked);
    ch4LegendPanel.style().set('shown', !checked);
    countLegendPanel.style().set('shown', checked);
  }
});

// ------------------------------
// 7. LEGENDS
// ------------------------------
var legendTitle = ui.Label('Map legend', {
  fontWeight: 'bold',
  margin: '8px 0 6px 0'
});

// --- CH4 legend
var ch4LegendPanel = ui.Panel();

var ch4LegendLabel = ui.Label('CH4 concentration (ppb)', {
  fontWeight: 'bold',
  margin: '0 0 6px 0'
});

var ch4Gradient = ee.Image.pixelLonLat().select('longitude')
  .multiply((ch4Vis.max - ch4Vis.min) / 100.0)
  .add(ch4Vis.min);

var ch4LegendImage = ch4Gradient.visualize(ch4Vis);

var ch4ColorBar = ui.Thumbnail({
  image: ch4LegendImage,
  params: {bbox: [0, 0, 100, 10], dimensions: '280x18'},
  style: {stretch: 'horizontal', margin: '0px 8px'}
});

var ch4LegendLabels = ui.Panel(
  [
    ui.Label(String(ch4Vis.min)),
    ui.Label(String((ch4Vis.min + ch4Vis.max) / 2), {
      stretch: 'horizontal',
      textAlign: 'center'
    }),
    ui.Label(String(ch4Vis.max))
  ],
  ui.Panel.Layout.flow('horizontal')
);

ch4LegendPanel.add(ch4LegendLabel);
ch4LegendPanel.add(ch4ColorBar);
ch4LegendPanel.add(ch4LegendLabels);

// --- Count legend
var countLegendPanel = ui.Panel({
  style: {shown: false}
});

var countLegendLabel = ui.Label('Observation count (2019–2025)', {
  fontWeight: 'bold',
  margin: '0 0 6px 0'
});

var countGradient = ee.Image.pixelLonLat().select('longitude')
  .multiply((countVis.max - countVis.min) / 100.0)
  .add(countVis.min);

var countLegendImage = countGradient.visualize(countVis);

var countColorBar = ui.Thumbnail({
  image: countLegendImage,
  params: {bbox: [0, 0, 100, 10], dimensions: '280x18'},
  style: {stretch: 'horizontal', margin: '0px 8px'}
});

var countLegendLabels = ui.Panel(
  [
    ui.Label(String(countVis.min)),
    ui.Label(String((countVis.min + countVis.max) / 2), {
      stretch: 'horizontal',
      textAlign: 'center'
    }),
    ui.Label(String(countVis.max))
  ],
  ui.Panel.Layout.flow('horizontal')
);

countLegendPanel.add(countLegendLabel);
countLegendPanel.add(countColorBar);
countLegendPanel.add(countLegendLabels);

// ------------------------------
// 8. POLYGON-BASED CHARTS
// ------------------------------
var clickTitle = ui.Label('Selected polygon', {
  fontWeight: 'bold',
  margin: '10px 0 4px 0'
});

var polyMeanTitle = ui.Label('Mean CH4 for selected polygon (2019–2025)', {
  fontWeight: 'bold',
  margin: '8px 0 4px 0'
});

var polyMeanLabel = ui.Label('No polygon selected.', {
  fontSize: '16px',
  color: '#1d6b99',
  margin: '0 0 12px 0'
});

var pointChartTitle1 = ui.Label('1. Monthly CH4 time series (2019–2025)', {
  fontWeight: 'bold',
  margin: '10px 0 6px 0'
});

var tsCountLabel = ui.Label('Observations in monthly time series: —', {
  margin: '0 0 6px 0',
  color: '#444'
});

var chartPanel1 = ui.Panel();

var pointChartTitle2 = ui.Label('2. Average monthly concentration (Jan–Dec)', {
  fontWeight: 'bold',
  margin: '10px 0 6px 0'
});

var climCountLabel = ui.Label('Observations in monthly climatology: —', {
  margin: '0 0 6px 0',
  color: '#444'
});

var chartPanel2 = ui.Panel();

// ------------------------------
// 9. DRAWING TOOLS
// ------------------------------
var drawingTools = map.drawingTools();
var useCuvetteCentral = false;
drawingTools.setShown(true);
drawingTools.setLinked(false);
drawingTools.setDrawModes(['polygon']);

// Keep only one editable geometry layer
while (drawingTools.layers().length() > 0) {
  drawingTools.layers().remove(drawingTools.layers().get(0));
}
drawingTools.addLayer([], 'selection', 'white');

function clearGeometry() {
  var layers = drawingTools.layers();
  if (layers.length() > 0) {
    var layer = layers.get(0);
    var geoms = layer.geometries();
    while (geoms.length() > 0) {
      geoms.remove(geoms.get(0));
    }
  }
}

function resetDrawing() {
  clearGeometry();
}

function getDrawnGeometry() {
  var layers = drawingTools.layers();
  if (layers.length() === 0) return null;
  var layer = layers.get(0);
  var geomList = layer.geometries();
  if (geomList.length() === 0) return null;
  return layer.toGeometry();
}

function meanOverCuvetteMask(image) {
  image = image.select([0], [ch4Band]);
  return image.updateMask(cuvetteMask).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: cuvetteReductionRegion,
    scale: maskAnalysisScale,
    maxPixels: 1e8,
    tileScale: 4
  }).get(ch4Band);
}

function buildSampledSeries(collection) {
  return ee.FeatureCollection(collection.map(function(image) {
    return ee.Feature(null, {
      Cuvette: meanOverCuvetteMask(image),
      system_time_start: image.get('system:time_start'),
      month: image.get('month')
    });
  }));
}

function updateCuvetteChartsFromSamples() {
  var sampledMonthly = buildSampledSeries(monthlyCH4);
  var sampledClimatology = ee.FeatureCollection(months.map(function(month) {
    month = ee.Number(month);
    var matchingMonths = sampledMonthly.filter(ee.Filter.eq('month', month));
    return ee.Feature(null, {
      Cuvette: matchingMonths.aggregate_mean('Cuvette'),
      system_time_start: ee.Date.fromYMD(2000, month, 1).millis(),
      month: month
    });
  }));

  meanOverCuvetteMask(longTermMean).evaluate(function(mean) {
    polyMeanLabel.setValue(mean === null
      ? 'No data'
      : Number(mean).toFixed(1) + ' ppb');
  });

  // Avoid two additional server evaluations that duplicate the complete
  // monthly and climatology calculations merely to count non-null values.
  tsCountLabel.setValue(
    'Combined peatland and water from precomputed 10 km mask'
  );
  climCountLabel.setValue(
    'Climatology calculated from the sampled monthly means'
  );

  var tsChart = ui.Chart.feature.byFeature({
    features: sampledMonthly,
    xProperty: 'system_time_start',
    yProperties: ['Cuvette']
  }).setChartType('LineChart').setOptions({
    title: '',
    hAxis: {title: 'Date', format: 'YYYY-MM'},
    vAxis: {title: 'CH4 (ppb)'},
    lineWidth: 1,
    pointSize: 3,
    legend: {position: 'none'},
    series: {
      0: {color: '#8E44AD'}
    }
  });

  var climChart = ui.Chart.feature.byFeature({
    features: sampledClimatology,
    xProperty: 'system_time_start',
    yProperties: ['Cuvette']
  }).setChartType('LineChart').setOptions({
    title: '',
    hAxis: {title: 'Month', format: 'MMM'},
    vAxis: {title: 'Mean CH4 (ppb)'},
    lineWidth: 2,
    pointSize: 5,
    legend: {position: 'none'},
    series: {
      0: {color: '#8E44AD'}
    }
  });

  chartPanel1.add(tsChart);
  chartPanel2.add(climChart);
  statusLabel.setValue(
    'Cuvette Central calculated from the 10 km raster mask. Figures updated.'
  );
}

function updateChartsFromPolygon() {
  chartPanel1.clear();
  chartPanel2.clear();

  var drawnRegion = useCuvetteCentral ? null : getDrawnGeometry();

  if (!useCuvetteCentral && drawnRegion === null) {
    polyMeanLabel.setValue('No polygon selected.');
    tsCountLabel.setValue('Observations in monthly time series: —');
    climCountLabel.setValue('Observations in monthly climatology: —');
    statusLabel.setValue('No polygon selected yet.');
    return;
  }

  var selectionName = useCuvetteCentral ? 'Cuvette Central' : 'Drawn polygon';
  statusLabel.setValue(selectionName + ' selected. Updating figures...');

  if (useCuvetteCentral) {
    updateCuvetteChartsFromSamples();
    return;
  }

  // Use two separately labelled regions for the asset, or one region for a
  // polygon drawn by the user. This lets the charts report both land-cover
  // types independently rather than averaging them together.
  var analysisRegions = useCuvetteCentral
    ? ee.FeatureCollection([
        ee.Feature(cuvettePeat.geometry(), {zone: 'Peatland'}),
        ee.Feature(cuvetteWater.geometry(), {zone: 'Open water'})
      ])
    : ee.FeatureCollection([
        ee.Feature(drawnRegion, {zone: 'Drawn polygon'})
      ]);

  var regionMeans = longTermMean.reduceRegions({
    collection: analysisRegions,
    reducer: ee.Reducer.mean(),
    scale: 5000
  });

  regionMeans.aggregate_array('zone').zip(
    regionMeans.aggregate_array('mean')
  ).evaluate(function(rows) {
    var labels = [];
    rows.forEach(function(row) {
      if (row[1] !== null) {
        labels.push(row[0] + ': ' + Number(row[1]).toFixed(1) + ' ppb');
      } else {
        labels.push(row[0] + ': no data');
      }
    });
    if (labels.length > 0) {
      polyMeanLabel.setValue(labels.join(' | '));
    } else {
      polyMeanLabel.setValue('No data in selected region');
    }
  });

  function countValidImages(collection, region) {
    var values = ee.FeatureCollection(collection.map(function(img) {
      var value = img.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: region,
        scale: 10000,
        maxPixels: 1e13
      }).get(ch4Band);

      return ee.Feature(null, {
        value: value
      });
    }));
    return values.filter(ee.Filter.notNull(['value'])).size();
  }

  var peatGeometry = cuvettePeat.geometry();
  var waterGeometry = cuvetteWater.geometry();

  if (useCuvetteCentral) {
    ee.Dictionary({
      peat: countValidImages(monthlyCH4, peatGeometry),
      water: countValidImages(monthlyCH4, waterGeometry)
    }).evaluate(function(counts) {
      tsCountLabel.setValue(
        'Valid monthly values — Peatland: ' + counts.peat +
        ' / 84 | Open water: ' + counts.water + ' / 84'
      );
    });

    ee.Dictionary({
      peat: countValidImages(monthlyClimatology, peatGeometry),
      water: countValidImages(monthlyClimatology, waterGeometry)
    }).evaluate(function(counts) {
      climCountLabel.setValue(
        'Valid climatology months — Peatland: ' + counts.peat +
        ' / 12 | Open water: ' + counts.water + ' / 12'
      );
    });
  } else {
    countValidImages(monthlyCH4, drawnRegion).evaluate(function(n) {
      tsCountLabel.setValue('Valid monthly values: ' + n + ' / 84');
    });
    countValidImages(monthlyClimatology, drawnRegion).evaluate(function(n) {
      climCountLabel.setValue('Valid climatology months: ' + n + ' / 12');
    });
  }

  var tsChart = ui.Chart.image.seriesByRegion({
    imageCollection: monthlyCH4,
    regions: analysisRegions,
    reducer: ee.Reducer.mean(),
    band: ch4Band,
    scale: 10000,
    xProperty: 'system:time_start',
    seriesProperty: 'zone'
  }).setOptions({
    title: '',
    hAxis: {title: 'Date', format: 'YYYY-MM'},
    vAxis: {title: 'CH4 (ppb)'},
    lineWidth: 1,
    pointSize: 3,
    legend: {position: useCuvetteCentral ? 'top' : 'none'},
    series: {
      0: {color: '#00a651'},
      1: {color: '#0099e5'}
    }
  });

  var climChart = ui.Chart.image.seriesByRegion({
    imageCollection: monthlyClimatology,
    regions: analysisRegions,
    reducer: ee.Reducer.mean(),
    band: ch4Band,
    scale: 10000,
    xProperty: 'system:time_start',
    seriesProperty: 'zone'
  }).setOptions({
    title: '',
    hAxis: {title: 'Month', format: 'MMM'},
    vAxis: {title: 'Mean CH4 (ppb)'},
    lineWidth: 2,
    pointSize: 5,
    legend: {position: useCuvetteCentral ? 'top' : 'none'},
    series: {
      0: {color: '#00a651'},
      1: {color: '#0099e5'}
    }
  });

  chartPanel1.add(tsChart);
  chartPanel2.add(climChart);
  statusLabel.setValue(selectionName + ' selected. Figures updated.');
}

function updateChartsFromDrawing() {
  useCuvetteCentral = false;
  cuvettePeatLayer.setShown(false);
  cuvetteWaterLayer.setShown(false);
  updateChartsFromPolygon();
}

drawingTools.onDraw(updateChartsFromDrawing);
drawingTools.onEdit(updateChartsFromDrawing);
drawingTools.onErase(updateChartsFromDrawing);

// ------------------------------
// 10. ASSEMBLE APP
// ------------------------------
panel.add(title);
panel.add(subtitle);
panel.add(meanTitle);
panel.add(meanValueLabel);
panel.add(drawTitle);
panel.add(drawInfo);
panel.add(statusLabel);
panel.add(ui.Panel(
  [drawButton, loadCuvetteButton, clearButton],
  ui.Panel.Layout.flow('horizontal')
));
panel.add(layerTitle);
panel.add(countCheckbox);
panel.add(legendTitle);
panel.add(ch4LegendPanel);
panel.add(countLegendPanel);
panel.add(clickTitle);
panel.add(polyMeanTitle);
panel.add(polyMeanLabel);
panel.add(pointChartTitle1);
panel.add(tsCountLabel);
panel.add(chartPanel1);
panel.add(pointChartTitle2);
panel.add(climCountLabel);
panel.add(chartPanel2);

ui.root.add(panel);
ui.root.add(map);

// ------------------------------
// 11. FILL LONG-TERM BASIN MEAN
// ------------------------------
ee.Number(basinMeanValue).evaluate(function(val) {
  if (val !== null) {
    meanValueLabel.setValue(Number(val).toFixed(1) + ' ppb');
  } else {
    meanValueLabel.setValue('No data');
  }
});
