//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var pdf = {};
/*
	session
	sheet
*/
pdf.buildReportFromXMLSS = function (options, cb) {
	var session = options.session;
	var sheet = options.sheet;
	var columns = sheet.columns;
	var orientation = sheet.orientation;
	var rows = sheet.rows;
	var html =
		'<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n' +
		"<style type='text/css'>\n" +
		"* {\n" +
		"   font-family: Arial;\n" +
		"   font-size: 10pt;\n" +
		"}\n" +
		"</style>\n" +
		"</head>\n<body>\n"
	;
	if (sheet.ell == "%") {
		html += "<table cellspacing=0 width=100% border=1>\n";
	} else {
		html += "<table cellspacing=0 border=1>\n";
	};
	for (var i = 0; i < rows.length; i ++) {
		var row = rows [i];
		var cells = row.cells;
		var r = "<tr height=20>\n";
		var curCol = 1;
		for (var j = 0; j < cells.length; j ++) {
			var cell = cells [j];
			cell.text = cell.text || "";
			cell.style = cell.style || "";
			cell.colspan = cell.colspan || 1;
			cell.rowspan = cell.rowspan || 1;
			var v = cell.text;
			if (v === undefined || v === null || v === "") {
				v = "<img width=1 height=1>";
			};
			if (cell.style.indexOf ("bold") > -1) {
				v = "<b>" + v + "</b>";
			};
			var style = "";
			var width = 0;
			for (var k = curCol; k < (curCol + cell.colspan); k ++) {
				width += columns [k] ? (columns [k].width || 0) : 0;
			};
			if (width) {
				style += "width: " + width + sheet.ell + ";";
			};
			if (cell.style.indexOf ("underline") > -1) {
				style += "border-bottom: 1px solid #000000;";
			};
			var align = "";
			if (cell.style.indexOf ("center") > -1) {
				align = " align=center ";
			};
			r += "\t<td colspan=" + cell.colspan + " rowspan=" + cell.rowspan + align + " style='" + style + "'>" + v + "</td>\n";
			curCol += cell.colspan;
		};
		r += "</tr>\n";
		html += r;
	};
	html += "</table>\n</body>\n</html>\n";
	fs.writeFile (__dirname + "/report/pdf/" + session.id + ".html", html, function (err) {
		if (err) {
			return cb (err);
		};
		var spawn = require ('child_process').spawn;
		var args = [
			"--orientation", orientation == "landscape" ? "Landscape" : "Portrait", "--dpi", 300, "--page-size", "A4",
			__dirname + "/report/pdf/" + session.id + ".html",
			__dirname + "/report/pdf/" + session.id + ".pdf"
		];
//		if (sheet.margins) {
//			args = args.concat ("--margin-left", sheet.margins.left, "--margin-top", sheet.margins.top, "--margin-right", sheet.margins.right, "--margin-bottom", sheet.margins.bottom);
//		};
		var filePath = __dirname + "/report/pdf/wkhtmltopdf";
		if (config.report && config.report.pdf) {
			filePath = config.report.pdf;
		}
		var cp = spawn (filePath, args);
		cp.stdout.on ("data", function (data) {
			console.log ("stdout: " + data);
		});
		cp.stderr.on ("data", function (data) {
			console.log ("stderr: " + data);
		});
		cp.on ("close", function (code) {
			fs.unlink (__dirname + "/report/pdf/" + session.id + ".html", function (err) {
				if (err) {
					return cb (err);
				}
				fs.readFile (__dirname + "/report/pdf/" + session.id + ".pdf", function (err, data) {
					if (err) {
						return cb (err);
					}
					fs.unlink (__dirname + "/report/pdf/" + session.id + ".pdf", function (err) {
						if (err) {
							return cb (err);
						}
						cb (null, data);
					});
				});
			});
		});
	});
};
pdf.report = function (request, response, next) {
	var session = request.session;
	var storage = session.storage;
	if (request.url.indexOf ('/pdf?') > -1 && projects.sessions [session.id]) {
		var options = {};
		var body = request.body;
		if (body) {
			body = body.split ("+").join ("%20");
			body = unescape (body);
			body = new Buffer (body, "ascii").toString ("utf8");
			var fields = body.split ("&");
			for (var i = 0; i < fields.length; i ++) {
				var tokens = fields [i].split ("=");
				options [tokens [0]] = JSON.parse (tokens [1]);
			};
		};
		var sheet = options ["sheets"][0];
		pdf.buildReportFromXMLSS ({
			sheet: sheet, session: session
		}, function (err, data) {
			if (err) {
				response.end ("{success: false, error: '" + err + "'}");
			} else {
				response.header ("Content-Type", "application/x-download;");
				response.header ("Content-Disposition", "attachment; filename=report.pdf");
				response.header ("Expires", "-1");
				response.header ("Content-Length", data.length);
				response.statusCode = 200;
				response.end (data);
			}
		});
	} else {
		next ();
	};
};

