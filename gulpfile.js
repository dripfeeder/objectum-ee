"use strict"
const gulp = require ("gulp");
const concat = require ("gulp-concat");
const uglify = require ("gulp-uglifyjs");
const fs = require ("fs");
const babel = require ("gulp-babel");
const js = [
    "./www/third-party/js/async.js",
    "./www/third-party/js/sha1.js",
    "./www/third-party/js/lodash.min.js",
    "./www/third-party/js/backbone.js",
    "./client/api/api.js",
    "./client/api/util.js",
    "./www/third-party/js/json2.js",
    "./client/extjs4/grid.js",
    "./client/extjs4/fields.js",
    "./client/extjs4/card.js",
    "./client/extjs4/cardConf.js",
    "./client/extjs4/tree.js",
    "./client/extjs4/chart.js",
    "./client/extjs4/image.js",
    "./client/extjs4/frame.js",
    "./client/extjs4/layout.js",
    "./client/extjs4/designer/classes.js",
    "./client/extjs4/designer/views.js",
    "./client/extjs4/designer/layouteditor.js",
    "./client/extjs4/designer/layoutolap.js",
    "./client/extjs4/designer/layouttreegrid.js",
    "./client/extjs4/designer/layoutsplit.js",
    "./client/extjs4/designer/layouttab.js",
    "./client/extjs4/designer/layoutcondition.js",
    "./client/extjs4/designer/layoutfilter.js",
    "./client/extjs4/designer/layoutcard.js",
    "./client/extjs4/designer/layouttotal.js",
    "./client/extjs4/designer/layoutchart.js",
    "./client/extjs4/designer/layoutimage.js",
    "./client/extjs4/designer/layoutframe.js",
    "./client/extjs4/designer/action.js",
    "./client/extjs4/designer/actioncard.js",
    "./client/extjs4/designer/actionargs.js",
    "./client/extjs4/designer/event.js",
    "./client/extjs4/designer/eventcard.js",
    "./client/extjs4/designer/layout.js",
    "./client/extjs4/designer/querysort.js",
    "./client/extjs4/designer/queryselect.js",
    "./client/extjs4/designer/querycondition.js",
    "./client/extjs4/designer/query.js",
    "./client/extjs4/designer/querycolumns.js",
    "./client/extjs4/designer/report.js",
    "./client/extjs4/designer/reportquery.js",
    "./client/extjs4/designer/reportcondition.js",
    "./client/extjs4/designer/project.js",
    "./client/extjs4/designer/card.js",
    "./client/extjs4/app.js",
    "./client/extjs4/view.js",
    "./client/extjs4/adapter.js",
    "./client/extjs4/scripts.js",
    "./client/extjs4/system.js",
    "./client/extjs4/csv.js",
    "./www/third-party/extjs4/examples/ux/GroupTabRenderer.js",
    "./www/third-party/extjs4/examples/ux/GroupTabPanel.js",
    "./www/third-party/extjs4/examples/ux/form/MultiSelect.js",
    "./www/third-party/extjs4/examples/ux/grid/FiltersFeature.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/Filter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/DateFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/BooleanFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/DateTimeFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/ListFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/NumericFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/filter/StringFilter.js",
    "./www/third-party/extjs4/examples/ux/grid/menu/ListMenu.js",
    "./www/third-party/extjs4/examples/ux/grid/menu/RangeMenu.js"
];
gulp.task ("bundle", function () {
    gulp.src (js)
        .pipe (concat ("all-debug.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
		.pipe (babel ({
			compact: true,
			presets: ["es2015"]
		}))
        .pipe (uglify ("all.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
    ;
});
gulp.task ("debug", function () {
    gulp.src (js)
        .pipe (concat ("all-debug.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
    ;
});
gulp.task ("default", ["bundle"]);
