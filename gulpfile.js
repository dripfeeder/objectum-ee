"use strict"
var gulp = require ("gulp");
var concat = require ("gulp-concat");
var uglify = require ("gulp-uglifyjs");
var fs = require ("fs");
var prepareSQL = function () {
    var r =
        "\nvar dbTablesSQL = " + JSON.stringify (fs.readFileSync ("./server/db/tables.sql", "utf8")) + ";\n" +
        "\nvar dbIndexesSQL = " + JSON.stringify (fs.readFileSync ("./server/db/indexes.sql", "utf8")) + ";\n" +
        "\nvar dbDataSQL = " + JSON.stringify (fs.readFileSync ("./server/db/data.sql", "utf8")) + ";\n"
    ;
    fs.writeFileSync ("./server/db/sql.js", r);
};
var jsServer = [
    "./server/header.js",
    "./server/modules.js",
    "./server/common.js",
    "./server/export.js",
    "./server/import.js",
    "./server/mail.js",
    "./server/meta.js",
    "./server/mimetypes.js",
    "./server/projects.js",
    "./server/query.js",
    "./server/server.js",
    "./server/sha.js",
    "./server/storage.js",
    "./server/db/client.js",
    "./server/db/postgres.js",
    "./server/db/mssql.js",
    "./server/db/sql.js",
    "./server/report/dbf.js",
    "./server/report/xmlss.js",
    "./server/report/pdf.js",
    "./server/report/xlsx.js",
    "./server/toc.js",
    "./server/ose.js",
    "./server/deprecated/*.js",
    "./server/footer.js"
];
var jsClient = [
    "./www/client/api/async.js",
    "./www/client/api/sha1.js",
    "./www/client/api/underscore.js",
    "./www/client/api/backbone.js",
    "./www/client/api/api.js",
    "./www/client/api/util.js",
    "./www/client/api/json2.js",
    "./www/client/extjs4/grid.js",
    "./www/client/extjs4/fields.js",
    "./www/client/extjs4/card.js",
    "./www/client/extjs4/cardConf.js",
    "./www/client/extjs4/tree.js",
    "./www/client/extjs4/chart.js",
    "./www/client/extjs4/image.js",
    "./www/client/extjs4/frame.js",
    "./www/client/extjs4/layout.js",
    "./www/client/extjs4/designer/classes.js",
    "./www/client/extjs4/designer/views.js",
    "./www/client/extjs4/designer/layouteditor.js",
    "./www/client/extjs4/designer/layoutolap.js",
    "./www/client/extjs4/designer/layouttreegrid.js",
    "./www/client/extjs4/designer/layoutsplit.js",
    "./www/client/extjs4/designer/layouttab.js",
    "./www/client/extjs4/designer/layoutcondition.js",
    "./www/client/extjs4/designer/layoutfilter.js",
    "./www/client/extjs4/designer/layoutcard.js",
    "./www/client/extjs4/designer/layouttotal.js",
    "./www/client/extjs4/designer/layoutchart.js",
    "./www/client/extjs4/designer/layoutimage.js",
    "./www/client/extjs4/designer/layoutframe.js",
    "./www/client/extjs4/designer/action.js",
    "./www/client/extjs4/designer/actioncard.js",
    "./www/client/extjs4/designer/actionargs.js",
    "./www/client/extjs4/designer/event.js",
    "./www/client/extjs4/designer/eventcard.js",
    "./www/client/extjs4/designer/layout.js",
    "./www/client/extjs4/designer/querysort.js",
    "./www/client/extjs4/designer/queryselect.js",
    "./www/client/extjs4/designer/querycondition.js",
    "./www/client/extjs4/designer/query.js",
    "./www/client/extjs4/designer/querycolumns.js",
    "./www/client/extjs4/designer/report.js",
    "./www/client/extjs4/designer/reportquery.js",
    "./www/client/extjs4/designer/reportcondition.js",
    "./www/client/extjs4/designer/project.js",
    "./www/client/extjs4/designer/card.js",
    "./www/client/extjs4/app.js",
    "./www/client/extjs4/view.js",
    "./www/client/extjs4/adapter.js",
    "./www/client/extjs4/scripts.js",
    "./www/client/extjs4/system.js",
    "./www/client/extjs4/csv.js",
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
    prepareSQL ();
    gulp.src (jsServer)
        .pipe (concat ("objectum-debug.js"))
        .pipe (gulp.dest ("."))
        .pipe (uglify ("objectum.js"))
        .pipe (gulp.dest ("."))
    ;
    gulp.src (jsClient)
        .pipe (concat ("all-debug.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
        .pipe (uglify ("all.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
    ;
});
gulp.task ("server", function () {
    prepareSQL ();
    gulp.src (jsServer)
        .pipe (concat ("objectum-debug.js"))
        .pipe (gulp.dest ("."))
        .pipe (uglify ("objectum.js"))
        .pipe (gulp.dest ("."))
    ;
});
gulp.task ("server-debug", function () {
    prepareSQL ();
    gulp.src (jsServer)
        .pipe (concat ("objectum-debug.js"))
        .pipe (gulp.dest ("."))
    ;
});
gulp.task ("client", function () {
    gulp.src (jsClient)
        .pipe (concat ("all-debug.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
        .pipe (uglify ("all.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
    ;
});
gulp.task ("client-debug", function () {
    gulp.src (jsClient)
        .pipe (concat ("all-debug.js"))
        .pipe (gulp.dest ("./www/client/extjs4"))
    ;
});
gulp.task ("default", ["bundle"]);

