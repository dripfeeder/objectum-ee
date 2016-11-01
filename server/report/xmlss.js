//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var xmlss = {};

xmlss.customReport = function (options) {
	var styles = options ["styles"];
	var sheets = options ["sheets"];
	var xml = new XMLSS ();
	for (var name in styles) {
		xml.addStyle (name, styles [name]);
	};
	// todo: has rows but no sheets
	var xWidth = {
		1: 9, 2: 14.25, 3: 19.5, 4: 24.75, 5: 30,
		6: 35.25, 7: 40.5, 8: 45.75, 9: 51, 10: 56.25,
		11: 61.5, 12: 66.75, 13: 72, 14: 77.25, 15: 82.5,
		16: 87.75, 17: 93, 18: 98.25, 19: 103.5, 20: 108.75
	};
	for (var i = 0; i < sheets.length; i ++) {
		var sheet = sheets [i];
		var sheetName = sheet ["name"];
		xml.sheet.create (sheetName);
		var orientation = "Portrait";
		if (sheet ["orientation"]) {
			if (sheet ["orientation"] == "landscape") {
				orientation = "Landscape";
			} else {
				orientation = "Portrait";
			};
		};
		xml.sheet.orientation.push (orientation);
		xml.sheet.validation.push (sheet ["validation"]);
		xml.sheet.namedRange.push (sheet ["namedRange"]);
		var scale = sheet ["scale"] || "100";
		xml.sheet.scale.push (scale);
		var autoFitHeight = false;
		if (sheet ["autoFitHeight"]) {		
			autoFitHeight = true;
		};
		xml.sheet.autoFitHeight.push (autoFitHeight);
		var marginBottom = 2.5;
		var marginLeft = 2;
		var marginRight = 2;
		var marginTop = 2.5;
		if (sheet ["margins"]) {
			var margins = sheet ["margins"];
			if (margins ["left"]) {
				marginLeft = margins ["left"] / 10;			
			};
			if (margins ["top"]) {
				marginTop = margins ["top"] / 10;
			};
			if (margins ["right"]) {
				marginRight = margins ["right"] / 10;
			};
			if (margins ["bottom"]) {
				marginBottom = margins ["bottom"] / 10;
			};
		};
		xml.sheet.marginBottom.push (marginBottom);
		xml.sheet.marginLeft.push (marginLeft);
		xml.sheet.marginRight.push (marginRight);
		xml.sheet.marginTop.push (marginTop);
		var rows = sheet ["rows"];
		for (var j = 0; j < rows.length; j ++) {
			var row = rows [j];
			var cells = row ["cells"];
			var height = row ["height"];
			var startIndex = 0;
			if (row ["startIndex"]) {
				startIndex = row ["startIndex"];
			};
			xml.pushRow (height, startIndex);
			for (var k = 0; k < cells.length; k ++) {		
				var cell = cells [k];
				var style = "Default";
				if (cell ["style"]) {
					style = cell ["style"];
				}
				var colspan = 1;
				if (cell ["colspan"]) {
					colspan = cell ["colspan"];
				}
				var rowspan = 1;
				if (cell ["rowspan"]) {
					rowspan = cell ["rowspan"];
				}
				var index = 0;
				if (cell ["startIndex"]) {
					index = cell ["startIndex"];
				}
				var text = "";
				if (cell ["text"]) {
					text = String (cell ["text"]);
				}
				var text2 = "";
				for (var l = 0; l < text.length; l ++) {
					if (text [l] == '\n') {
						text2 += "&#10;";
					} else {
						text2 += text [l];
					};
				};
				xml.pushCell (text2, style, colspan, rowspan, index);
			};
		};
		if (rows.length == 0) {
			xml.pushRow ();
			xml.pushCell ("");
		};
		var columns = sheet ["columns"];
		for (var colId in columns) {
			var column = columns [colId];
			if (column ["width"]) {
				var width = column ["width"];
				width = xWidth [width] || (width * 5);
				xml.setColWidth (width, colId, colId, true);
			};
		};
	};
    var result = xml.content ();
    return result;
};
xmlss.XMLSS = XMLSS;
function Cell (text, style, colspan, rowspan, index) {
	var me = this;
	me.text = text || "";
	me.style = style || "none";
    me.colspan = colspan || 1;
    me.rowspan = rowspan || 1;
    me.index = index || 0;
};
function Sheet (xml) {
	this.xml = xml;
	this.colWidth = {};
	this.sheetName = [];
	this.rowSheetId = {};
	this.orientation = [];
	this.validation = [];
	this.namedRange = [];
	this.scale = [];
	this.marginTop = [];
	this.marginBottom = [];
	this.marginLeft = [];
	this.marginRight = [];
	this.autoFitHeight = [];
};
Sheet.prototype.create = function (name) {
	var sheetId = this.sheetName.length;
	this.sheetName.push (name);
	this.rowSheetId [this.xml.data.length] = sheetId;
};
Sheet.prototype.getSheetNum = function () {
	return this.sheetName.length;
};
Sheet.prototype.setColWidth = function (width, colId, colId2, directWidth) {
	var mul = 6;
	if (directWidth) {
		mul = 1;
	};
	var sheetId = this.sheetName.length - 1;
	this.colWidth [sheetId] = this.colWidth [sheetId] || {};
	if (colId2 == 0) {
		this.colWidth [sheetId][colId] = width * mul;
	} else 
	if (colId2 >= colId) {
		for (var i = colId; i <= colId2; i ++) {
			this.colWidth [sheetId][i] = width * mul;
		};
	};
};
Sheet.prototype.getColWidth = function (sheetId, colId) {
	if (this.colWidth [sheetId] && this.colWidth [sheetId][colId]) {
		return this.colWidth [sheetId][colId];
	} else {
		return 9; //50; // default column width
	};
};
Sheet.prototype.getHeader = function (sheetId) {
	var header = "";
	header += "<Worksheet ss:Name='" + this.sheetName [sheetId] + "'>\n";
	if (this.xml.printTitlesRow1 > 0) {
		header += "<Names>\n";
		header += "<NamedRange ss:Name='Print_Titles' ss:RefersTo='=Sheet1!R" + this.xml.printTitlesRow1 + ":R" + this.xml.printTitlesRow2 + "'/>\n";
		header += "</Names>\n";
	};
	header += "<Table ss:ExpandedColumnCount='255' ss:ExpandedRowCount='65535' x:FullColumns='1' x:FullRows='1'>\n";
	for (var i = 1; i <= 255; i ++) {
		header += "<Column ss:AutoFitWidth='0' ss:Width='";
		header += this.getColWidth (sheetId, i);
		header += "'/>\n";
	};
	return header;
};
Sheet.prototype.getFooter = function (sheetId) {
	var footer = "";
	var xml = this.xml;
	footer += "</Table>\n";
	footer += "<WorksheetOptions xmlns='urn:schemas-microsoft-com:office:excel'>\n";
	footer += "<PageSetup>\n";
	if (xml.sheet.orientation [sheetId] == "Landscape") {
		footer += "<Layout x:Orientation='Landscape'/>\n";
	};
	footer += "<PageMargins x:Bottom='" + (xml.sheet.marginBottom [sheetId] / 2.54);
	footer += "' x:Left='" + (xml.sheet.marginLeft [sheetId] / 2.54);
	footer += "' x:Right='" + (xml.sheet.marginRight [sheetId] / 2.54);
	footer += "' x:Top='" + (xml.sheet.marginTop [sheetId] / 2.54);
	footer += "'/>\n";
	footer += "</PageSetup>\n";
	if (xml.fitWidth || xml.fitHeight) {
		footer += "<FitToPage/>\n";
	};
	footer += "<Print>\n";
	if (xml.fitWidth) {
		footer += "<FitWidth>" + xml.fitWidth + "</FitWidth>\n";
	};
	if (xml.fitHeight) {
		footer += "<FitHeight>" + xml.fitHeight + "</FitHeight>\n";
	};
	footer += "<ValidPrinterInfo/>\n";
	footer += "<PaperSizeIndex>" + xml.paperSizeIndex + "</PaperSizeIndex>\n";
	footer += "<Scale>" + xml.sheet.scale [sheetId] + "</Scale>\n";
	footer += "<HorizontalResolution>600</HorizontalResolution>\n";
	footer += "<VerticalResolution>600</VerticalResolution>\n";
	footer += "</Print>\n";
	if (xml.showPageBreakZoom) {
		footer += "<ShowPageBreakZoom/>";
	};
	footer += "<Zoom>" + xml.zoom + "</Zoom>\n";
	footer += "<Selected/>\n";
	footer += "<Panes>\n";
	footer += "<Pane>\n";
	footer += "<Number>3</Number>\n";
	footer += "<ActiveRow>13</ActiveRow>\n";
	footer += "<ActiveCol>3</ActiveCol>\n";
	footer += "</Pane>\n";
	footer += "</Panes>\n";
	footer += "<ProtectObjects>False</ProtectObjects>\n";
	footer += "<ProtectScenarios>False</ProtectScenarios>\n";
	footer += "</WorksheetOptions>\n";
	if (xml.sheet.validation [sheetId] && xml.sheet.validation [sheetId].length) {
		var validation = xml.sheet.validation [sheetId];
		for (var i = 0; i < validation.length; i ++) {
			footer += "<DataValidation  xmlns=\"urn:schemas-microsoft-com:office:excel\">\n";
			var v = validation [i];
			var range = "";
			if (v.r1) {
				range += "R" + v.r1;
			};
			if (v.c1) {
				range += "C" + v.c1;
			};
			if (v.r2 || v.c2) {
				range += ":";
				if (v.r2) {
					range += "R" + v.r2;
				};
				if (v.c2) {
					range += "C" + v.c2;
				};
			};
			footer += "<Range>" + range + "</Range>\n";
			footer += "<Type>" + v.type + "</Type>\n";
			if (v.value) {
				if (typeof (v.value) == "object" && v.value.length) {
					footer += "<CellRangeList/>\n";
					footer += "<Value>&quot;" + v.value.join (",") + "&quot;</Value>\n";
				} else {
					footer += "<Value>" + v.value + "</Value>\n";
				};
			};
			if (v.min) {
				footer += "<Min>" + v.min + "</Min>\n";
			};
			if (v.max) {
				footer += "<Max>" + v.max + "</Max>\n";
			};
			footer += "</DataValidation>\n";
		};
	};
	footer += "</Worksheet>\n";
	return footer;
};
Sheet.prototype.hasStartRow = function (rowId) {
	return this.rowSheetId.hasOwnProperty (rowId);
};
Sheet.prototype.getSheetIdByRowId = function (rowId) {
	return this.rowSheetId [rowId];
};
function XMLSS (options) {
	options = options || {};
	var me = this;
	me.paperSizeIndex = 9; // A4
	me.fitWidth = 0;
	me.fitHeight = 0;
	me.zoom = 90;
	me.marginBottom = 2.5;
	me.marginLeft = 2;
	me.marginRight = 2;
	me.marginTop = 2.5;
	me.autoFitHeight = 0;
	me.workSheetName = "Sheet1";
	me.clearColWidth ();
    me.orientation = "Portrait";
    me.showPageBreakZoom = false;
    me.printTitlesRow1 = 0;
    me.printTitlesRow2 = 0;
    me.fontSize = 10;
    me.defRowHeight = options.defRowHeight || 12.75;
	me.setDefaultStyles ();
	me.sheet = new Sheet (this);
	me.data = [];
	me.rowStartIndex = [];
	me.rowHeight = [];
	me.colWidth = {};
};
XMLSS.prototype.setDefaultStyles = function () {
	this.xmlStyles = "";
	/*
	this.xmlStyles =
		"<Style ss:ID='Default' ss:Name='Normal'>\n" +
		"<Alignment ss:Horizontal='Left' ss:Vertical='Center'/>\n" +
		"<Borders/>\n" +
		"<Font ss:FontName='Arial Cyr' x:CharSet='204' ss:Size='" + this.fontSize + "' />\n" +
		"<Interior/>\n" +
		"<NumberFormat/>\n" +
		"<Protection/>\n" +
		"</Style>\n"
	;
	*/
};
XMLSS.prototype.clearColWidth = function () {
	this.colWidth = [];
	for (var i = 0; i < 257; i ++) {
		this.colWidth.push (50.58);
	};
};
XMLSS.prototype.setColWidth = function (width, colId, colId2, directWidth) {
	var mul = 6;
	if (directWidth) {
		mul = 1;
	};
	if (this.sheet.getSheetNum () == 0) {
		if (colId2 == 0) {
			this.colWidth [colId] = width * mul;
		} else 
		if (colId2 >= colId) {
			for (var i = colId; i <= colId2; i ++) {
				this.colWidth [i] = width * mul;
			};
		};
	} else {
		this.sheet.setColWidth (width, colId, colId2, directWidth);
	};
}
XMLSS.prototype.clearRowHeight = function () {
	this.rowHeight = [];
	for (var i = 0; i < this.data.length; i ++) {
		this.rowHeight.push (this.defRowHeight);
	};
};
XMLSS.prototype.clearRowStartIndex = function () {
	this.rowStartIndex = [];
	for (var i = 0; i < this.data.length; i ++) {
		this.rowStartIndex.push (0);
	};
}
//---------------------------------------------------------------------------
// Создание стиля. Всякие нестандартные стили надо создавать непосредственно в месте их использования (отчете)
// Example: AddStyle ("sTitleBorderGray", "hAlign:center,vAlign:center,bold:true,borders:all,fontSize:12")
// options:
//   hAlign, vAlign: Left Right Top Bottom Center
//   rotate: 90
//   wrap: true
//   numberFormat: #,##0.000
//   borders: All,Left,Top,Right,Bottom,AllDash
XMLSS.prototype.addStyle = function (styleName, options_) {
	var s = "";
	var i;
	// Парсинг
	var options = {}; // option, value
	var option;
	for (i = 0; i < options_.length; i ++) {
		var c = options_ [i];
		if (c == ',' || i == options_.length - 1) {
			if (i == options_.length - 1) {
				s += c;
			};
			options [option] = s;
			s = "";
		} else 
		if (c == ':') {
			option = s;
			s = "";
		} else {
			s += c;
		};
	};
	// Установка значений по умолчанию
	if (!options ["hAlign"]) {
		options ["hAlign"] = "Left";
	};
	if (!options ["vAlign"]) {
		options ["vAlign"] = "Center";
	};
	if (!options ["fontSize"]) {
		options ["fontSize"] = "10";
	};
	if (!options ["fontName"]) {
		options ["fontName"] = "Arial Cyr";
	};
	// Стиль
	var r = "";
	r += "<Style ss:ID='" + styleName + "'>\n";
	r += "<Alignment ss:Horizontal='" + options ["hAlign"] + "' ss:Vertical='" + options ["vAlign"] + "'";
	if (options ["rotate"]) {
		r += " ss:Rotate='" + options ["rotate"] + "'";
	};
	if (options ["wrap"] == "true") {
		r += " ss:WrapText='1'";
	};
	r += "/>\n";
	if (options ["numberFormat"]) {
		r += "<NumberFormat ss:Format='" + options ["numberFormat"] + "'/>";
	};
	r += "<Borders>\n";
	if (options ["borders"]) {
		var borders = options ["borders"];
		if (borders == "AllDash") {
    		borders = "LeftDash RightDash TopDash BottomDash";
		} else
		if (borders == "All") {
    		borders = "Left Right Top Bottom";
		};
		if (borders.indexOf ("LCont") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Continuous' ss:Weight='2'/>\n";
		};
		if (borders.indexOf ("BottomDash") != -1) {
			r += "<Border ss:Position='Bottom' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else	
		if (borders.indexOf ("Bottom") != -1) {
			r += "<Border ss:Position='Bottom' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("LeftDash") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Left") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("RightDash") != -1) {
			r += "<Border ss:Position='Right' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Right") != -1) {
			r += "<Border ss:Position='Right' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("TopDash") != -1) {
			r += "<Border ss:Position='Top' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Top") != -1) {
			r += "<Border ss:Position='Top' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
	};
	r += "</Borders>\n";
	r += "<Font ss:FontName='" + options ["fontName"] + "' x:CharSet='204'";
   	r += " ss:Size='" + options ["fontSize"] + "'";
	if (options ["bold"] == "true") {
		r += " ss:Bold='1'";
	};
	if (options ["italic"] == "true") {
		r += " ss:Italic='1'";
	};
	if (options ["underline"] == "true") {
		r += " ss:Underline='Single'";
	};
	if (options ["fontColor"]) {
		r += " ss:Color='" + options ["fontColor"] + "'";
	}
	r += "/>";   
	if (options ["bgColor"]) {
		r += "<Interior ss:Color='" + options ["bgColor"] + "' ss:Pattern='Solid'/>";
	};
	r += "</Style>\n";
    this.xmlStyles += r;
};
XMLSS.prototype.pushRow = function (height, rowStartIndex_) {
    if (height == 12.75) {
        height = this.defRowHeight;
    };
    this.rowStartIndex.push (rowStartIndex_);
    this.rowHeight.push (height);
    var row = [];
	this.data.push (row);
    this.row = row;
    return this.data.length - 1;
};
XMLSS.prototype.pushCell = function (s, style, colspan, rowspan, index) {
    if (!this.row.length && !index && this.rowStartIndex [this.rowStartIndex.length - 1] > 0) {
    	index = this.rowStartIndex [this.rowStartIndex.length - 1];
    };
	this.row.push (new Cell (s, style, colspan, rowspan, index));
    return this.row.length - 1;
};
XMLSS.prototype.content = function () {
	var s = this.getMultiSheetContent ();
    return s;
};
XMLSS.prototype.getMultiSheetContent = function () {
	var s, r = "";
    var fill = {};
    var x, y = 1, i, j, rowId = 0, sheetId;
    var digitNum, dotNum, textLen;
    for (var i = 0; i < this.data.length; i ++) {
    	var row = this.data [i];
		// Sheet header
		if (this.sheet.hasStartRow (rowId)) {
			sheetId = this.sheet.getSheetIdByRowId (rowId);
			if (rowId > 0) {
				r += this.sheet.getFooter (sheetId - 1);
			};
			r += this.sheet.getHeader (sheetId);
		};
		// Sheet rows
		if (this.sheet.autoFitHeight [sheetId] && this.rowHeight [y - 1] == this.defRowHeight) {
			r += "<Row ss:AutoFitHeight='1'>\n";
		} else {
			r += "<Row ss:AutoFitHeight='0' ss:Height='" + (this.rowHeight [y - 1]) + "'>\n";
		};
		x = 1;
		for (var j = 0; j < row.length; j ++) {
			var cell = row [j];
			if (cell.style != "" || cell.text != "") {
				r += "<Cell";
				if (cell.index > 0) {
            		r += " ss:Index='" + cell.index + "'";
				};
				if (cell.style != "") {
					r += " ss:StyleID='" + cell.style + "'";
				};
				if (cell.colspan > 1) {
					r += " ss:MergeAcross='" + (cell.colspan - 1) + "'";
				};
				if (cell.rowspan > 1) {
					r += " ss:MergeDown='" + (cell.rowspan - 1) + "'";
				};
				/*
				var nr = this.getNamedRange (this.sheet.namedRange [sheetId], y, x);
				if (nr) {
					r += " ss:Name='" + nr + "'";
				};
				*/
				digitNum = 0;
				dotNum = 0;
				textLen = cell.text.length;
				for (var k = 0; k < textLen; k ++) {
					if ("0123456789".indexOf (cell.text [k]) > -1) {
            			digitNum ++;
					};
					if (cell.text [k] == '.') {
            			dotNum ++;
					};
				};
				if (textLen > 0 && (digitNum + dotNum == textLen) && digitNum > 0 && dotNum <= 1) {
					r += "><Data ss:Type='String'>" + cell.text + "</Data></Cell>\n";
				} else {
					var v = cell.text.split ("<").join ("&lt;");
					v = v.split (">").join ("&gt;");
					r += "><Data ss:Type='String'>" + v + "</Data></Cell>\n";
				};
			};
			if (cell.index > 0) {
				x = cell.index + cell.colspan;
			} else {
				x += cell.colspan;
			};
		};
		r += "</Row>\n";
        y ++;
		rowId ++;
    };
	r += this.sheet.getFooter (sheetId);
	s = "<?xml version='1.0'?>\n";
	s += "<?mso-application progid='Excel.Sheet'?>\n";
	s += "<Workbook xmlns='urn:schemas-microsoft-com:office:spreadsheet'\n";
	s += "xmlns:o='urn:schemas-microsoft-com:office:office'\n";
	s += "xmlns:x='urn:schemas-microsoft-com:office:excel'\n";
	s += "xmlns:ss='urn:schemas-microsoft-com:office:spreadsheet'\n";
	s += "xmlns:html='http://www.w3.org/TR/REC-html40'>\n";
	s += "<DocumentProperties xmlns='urn:schemas-microsoft-com:office:office'>\n";
	s += "<Author>Dimas</Author>\n";
	s += "<LastAuthor>Dimas</LastAuthor>\n";
	s += "<Created>2008-04-10T14:18:34Z</Created>\n";
	s += "<Company>-</Company>\n";
	s += "<Version>11.5606</Version>\n";
	s += "</DocumentProperties>\n";
	s += "<ExcelWorkbook xmlns='urn:schemas-microsoft-com:office:excel'>\n";
	s += "<WindowHeight>10230</WindowHeight>\n";
	s += "<WindowWidth>14235</WindowWidth>\n";
	s += "<WindowTopX>480</WindowTopX>\n";
	s += "<WindowTopY>15</WindowTopY>\n";
	s += "<ProtectStructure>False</ProtectStructure>\n";
	s += "<ProtectWindows>False</ProtectWindows>\n";
	s += "</ExcelWorkbook>\n";
    s += "<Styles>\n" + this.xmlStyles + "</Styles>\n";
    s += "<Names>\n" + this.getNamedRangeList () + "</Names>\n";
    s += r;
	s += "</Workbook>\n";
	return s;
};
XMLSS.prototype.getNamedRange = function (namedRange, r, c) {
    for (var j = 0; j < namedRange.length; j ++) {
    	var o = namedRange [j];
    	if ((r >= o.r1 && c >= o.c1 && r <= o.r2 && c <= o.c2) ||
    		(r == o.r1 && (c == o.c1 || (c >= o.c1 && c <= o.c2) || !o.c1)) ||
    		(c == o.c1 && (r == o.r1 || (r >= o.r1 && r <= o.r2) || !o.r1))
    	) {
    		return o.name;
    	};
    };
};
XMLSS.prototype.getNamedRangeList = function () {
	var r = "";
    for (var i = 0; i < this.sheet.namedRange.length; i ++) {
    	var nr = this.sheet.namedRange [i];
    	if (nr && nr.length) {
		    for (var j = 0; j < nr.length; j ++) {
				var range = "";
				if (nr [j].r1) {
					range += "R" + nr [j].r1;
				};
				if (nr [j].c1) {
					range += "C" + nr [j].c1;
				};
				if (nr [j].r2 || nr [j].c2) {
					range += ":";
					if (nr [j].r2) {
						range += "R" + nr [j].r2;
					};
					if (nr [j].c2) {
						range += "C" + nr [j].c2;
					};
				};
		    	r += "<NamedRange ss:Name=\"" + nr [j].name + "\" ss:RefersTo=\"=" + this.sheet.sheetName [i] + "!" + range + "\"/>";
		    };
		};
    };
    return r;
};
// application.student.surname -> Иванов
xmlss.getAttr = function (options) {
	var storage = options.storage;
	var tags = options.tags;
	var success = options.success;
	var tokens = options.text.split (".");
	var onlyDate = false;
	if (tokens.length && tokens [tokens.length - 1] == "$date") {
		tokens.splice (tokens.length - 1, 1);
		onlyDate = true;
	};
	var o, attr;
	options.timeOffset = options.timeOffset || (-240 * 60 * 1000); // MSK +4
	var UTCDateToClientDate = function (value) {
		if (!value) {
			return value;
		};
		if (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ()) {
			value = new Date (value.getTime () - options.timeOffset);
			value = common.getUTCTimestamp (value);
			if (value.substr (11, 8) == "00:00:00") {
				value = value.substr (0, 10);
			};
		} else {
			value = common.getUTCDate (value);
		};
		return value;
	};
	async.reduce (tokens, 0, function (i, token, cb) {
		if (!i) {
			if (tokens.length > 1) {
				storage.getObject ({id: tags [token], success: function (options) {
					o = options.object;
					if (!o) {
						cb ("empty");
					} else {
						cb (null, i + 1);
					};
				}, failure: function (options) {
					cb ("empty");
				}});
			} else {
				attr = tags [token];
				cb (null, i + 1);
			};
		} else {
			attr = o.get (token);
			if (i < tokens.length - 1) {
				storage.getObject ({id: attr, success: function (options) {
					o = options.object;
					if (!o) {
						cb ("empty");
					} else {
						cb (null, i + 1);
					};
				}, failure: function (options) {
					cb ("empty");
				}});
			} else {
				cb (null, i + 1);
			};
		};
	}, function (err, result) {
		if (err == "empty" || attr == undefined || attr == null) {
			success ("");
		} else {
			if (onlyDate && attr) {
				attr = UTCDateToClientDate (attr);
				if (attr) {
					attr = attr.substr (0, 10);
				};
			} else
			if (attr && typeof (attr) == "object" && attr.getMonth) {
				attr = UTCDateToClientDate (attr);
			};
			success (attr);
		};
	});
};
xmlss.updateTags = function (options) {
	var success = options.success;
	options.timeOffset = options.request.query.time_offset_min * 60 * 1000;
	var tags = [];
	var r = options.data;
	for (var i = 1; i < r.length; i ++) {
		if (r [i] == "$" && r [i - 1] == "[") {
			var tag = "";
			for (i ++; i < r.length; i ++) {
				if (r [i] == "]") {
					break;
				} else {
					tag += r [i];
				};
			};
			if (tags.indexOf (tag) == -1) {
				tags.push (tag);
			};
		};
	};
	async.mapSeries (tags, function (tag, cb) {
		options.text = tag;
		options.success = function (result) {
			r = r.split ("[$" + tag + "]").join (result);
			cb ();
		};
		xmlss.getAttr (options);
	}, function (err, results) {
		success (r);
	});
};
xmlss.report = function (request, response, next) {
	if (request.url.indexOf ('/report?') > -1) {
		var url = request.url;
		if (request.query.custom != 1) {
			url = url.split ('&view').join ('&noview');
			url += '&custom=1';
		}
		var options = {};
		var body = request.body;
		if (body) {
			var fields = body.split ("&");
			for (var i = 0; i < fields.length; i ++) {
				var tokens = fields [i].split ("=");
				tokens [1] = tokens [1].split ("+").join ("%20");
				tokens [1] = unescape (tokens [1]);
				tokens [1] = new Buffer (tokens [1], "ascii").toString ("utf8");
				options [tokens [0]] = request.query.csv == 1 ? tokens [1] : JSON.parse (tokens [1]);
			};
			if (options.opts) {
				_.extend (options, options.opts);
			}
		};
		if (request.query.csv == 1) {
			var r = new Buffer (common.UnicodeToWin1251 (options ["body"]), "binary");
			response.header ("Content-Type", "application/x-download; charset=windows-1251");
			response.header ("Content-Disposition", "attachment; filename=report.csv");
			response.header ("Expires", "-1");
			response.header ("Content-Length", r.length);
			response.statusCode = 200;
			response.end (r);
		} else
		if (request.query.custom == 1) {
			var r = xmlss.customReport (options);
			response.header ("Content-Type", "application/x-download");
			response.header ("Content-Disposition", "attachment; filename=report.xml");
			response.header ("Expires", "-1");
			response.header ("Content-Length", Buffer.byteLength (r, "utf8"));
			response.statusCode = 200;
			response.end (r);
		} else
		if (request.query.view) {
			// olapReport
			var session = request.session;
			var storage = session.storage;
			var total = null;
			var viewId = request.query.view;
			var view = storage.viewsMap [viewId];
			var viewQuery = JSON.parse (view.get ('fquery'));
			var filter = options.filter || [];
			if (filter && filter.length) {
				viewQuery.where = viewQuery.where || [];
				if (viewQuery.where.length) {
					viewQuery.where.push ('and');				
				};
				var attrs = {};
				for (var i = 1; i < viewQuery.select.length; i += 2) {
					attrs [viewQuery.select [i]] = viewQuery.select [i - 1];
				};
				for (var i = 0; i < filter.length; i ++) {
					if (attrs [filter [i]]) {
						filter [i] = attrs [filter [i]];
					};
				};
				viewQuery.where.push (filter);
			}
			var order = null;
			if (request.query.order) {
				order = JSON.parse (request.query.order);
			}
			var dateAttrs = [];
			if (options.options) {
				dateAttrs = options.options.dateAttrs || [];
			};
			if (order && order.length) {
				viewQuery.order = order;
			};
			var colsArray = options.cols || [];
			var cols = {};
			for (var i = 0; i < colsArray.length; i ++) {
				cols [colsArray [i].attrId] = colsArray [i];
			};
			var query = new Query ({session: session, storage: storage, sql: viewQuery});
			query.generate ();
			storage.query ({sql: query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL + (storage.client.database != "mssql" ? ('\nlimit ' + config.query.maxRowNum + ' offset 0\n') : ""), success: function (options) {
				var rows = options.result.rows;
				var attrs = view.attrs, attrsNum = 0;
				var orderAttrs = [];
				for (var attrCode in attrs) {
					if (cols [attrs [attrCode].get ('fid')] && cols [attrs [attrCode].get ('fid')].hidden) {
						continue;
					};
					attrs [attrCode].set ('field', attrs [attrCode].get ('fcode').toLowerCase () + '_');
					orderAttrs.push (attrs [attrCode]);
					attrsNum ++;
				}
				orderAttrs.sort (function (a, b) {
					if (a.get ("forder") !== null && b.get ("forder") !== null && a.get ("forder") < b.get ("forder")) {
						return -1;
					};
					if (a.get ("forder") != null && b.get ("forder") == null) {
						return -1;
					};
					if (a.get ("forder") == b.get ("forder") && a.get ("fid") < b.get ("fid")) {
						return -1;
					};
					if (a.get ("forder") !== null && b.get ("forder") !== null && a.get ("forder") > b.get ("forder")) {
						return 1;
					};
					if (a.get ("forder") == null && b.get ("forder") != null) {
						return 1;
					};
					if (a.get ("forder") == b.get ("forder") && a.get ("fid") > b.get ("fid")) {
						return 1;
					};
					return 0;					
				});
				var reportColumns = {};
				for (var i = 0; i < orderAttrs.length; i ++) {
					reportColumns [i + 1] = {width: parseInt (orderAttrs [i].get ('fcolumn_width') / 6.5)};
					if (cols [orderAttrs [i].get ('fid')] && cols [orderAttrs [i].get ('fid')].width) {
						reportColumns [i + 1].width = cols [orderAttrs [i].get ('fid')].width / 6.5;
					};
				}
				var reportRows = [];
				var row = {height: 12.75, cells: []};
				for (var j = 0; j < orderAttrs.length; j ++) {
//					if (orderAttrs [j].get ('farea') != 1) {
//						continue;
//					}
					if (cols [orderAttrs [j].get ('fid')] && cols [orderAttrs [j].get ('fid')].hidden) {
						continue;
					};
					var name = orderAttrs [j].get ('fname');
					row.cells.push ({
						text: common.unescape (name), style: 'border_bold'
					});
				};
				reportRows.push (row);
				var timeOffset = request.query.time_offset_min * 60 * 1000;
				for (var i = 0; i < rows.length; i ++) {
					var row = {height: 12.75, cells: []};
					for (var j = 0; j < orderAttrs.length; j ++) {
//						if (orderAttrs [j].get ('farea') != 1) {
//							continue;
//						}
						if (cols [orderAttrs [j].get ('fid')] && cols [orderAttrs [j].get ('fid')].hidden) {
							continue;
						};
						var field = orderAttrs [j].get ('fcode').toLowerCase () + '_';
						var value = rows [i][field];
						if (typeof (value) == 'string') {
							value = value;
						} else
						if (value && typeof (value) == 'object' && value.getMonth) {
							if (dateAttrs.indexOf (orderAttrs [j].get ('fcode')) == -1 && (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ())) {
								value = new Date (value.getTime () - timeOffset);
								value = common.getUTCTimestamp (value);
							} else {
								value = common.getUTCDate (value);
							};
						} else
						if (query.fieldTypeId [field] == 4) {
							if (value) {
								value = "Да";//locale.getString ('Yes');
							} else {
								value = "Нет";//locale.getString ('No');
							}
						}
						row.cells.push ({
							text: value, style: 'border'
						});
					}
					reportRows.push (row);
				}
				if (request.query.format == "xmlss") {
					var r = xmlss.customReport ({
						styles: {
							'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
							'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
							'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
							'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
							'border': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All',
							'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
							'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
							'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
							'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
							'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
							'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
							'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
						},
						sheets: [{
							name: "Sheet",
							autoFitHeight: true,
							orientation: "landscape",
							scale: 100,
							margins: {
								left: 31,
								top: 32,
								right: 33,
								bottom: 34
							},
							columns: reportColumns,
							rows: reportRows
						}]
					});
					response.header ("Content-Type", "application/x-download");
					response.header ("Content-Disposition", "attachment; filename=report.xml");
					response.header ("Expires", "-1");
					response.header ("Content-Length", Buffer.byteLength (r, "utf8"));
					response.statusCode = 200;
					response.end (r);
				} else
				if (request.query.format == "pdf") {
					pdf.buildReportFromXMLSS ({
						session: session, sheet: {
							name: "Sheet",
							autoFitHeight: true,
							orientation: "landscape",
							scale: 100,
							margins: {
								left: 31,
								top: 32,
								right: 33,
								bottom: 34
							},
							columns: reportColumns,
							rows: reportRows
						}
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
				} else
				if (request.query.format == "ods") {
//					var AdmZip = require (config.rootDir + "/node_modules/adm-zip");
					var AdmZip = require ("adm-zip");
					var zip = new AdmZip ();
					var fs = require ("fs");
					zip.addLocalFolder (__dirname + "/report/template.ods");
					var fs = require ("fs");
					fs.readFile (__dirname + "/report/template.ods/content.xml", "utf8", function (err, data) {
//						var xml2js = require (config.rootDir + "/node_modules/xml2js");
						var xml2js = require ("xml2js");
						var parser = new xml2js.Parser ({explicitArray: false});
						parser.parseString (data, function (err, doc) {
							doc ["office:document-content"]["office:body"]["office:spreadsheet"]["table:table"]["table:table-row"] = [];
							_.each (reportRows, function (row) {
								var cells = [];
								_.each (row.cells ,function (cell) {
									cell.text = cell.text || "";
									cell.style = cell.style || "";
									cell.colspan = cell.colspan || 1;
									cell.rowspan = cell.rowspan || 1;
									var v = cell.text;
									cells.push ({
										"$": {
											"office:value-type": "string",
											"calcext:value-type": "string"
										},
										"text:p": v
									});
								});
								doc ["office:document-content"]["office:body"]["office:spreadsheet"]["table:table"]["table:table-row"].push ({
									"$": {
										"table:style-name": "ro1"
									},
									"table:table-cell": cells
								});
							});
							var builder = new xml2js.Builder ();
							var xml = builder.buildObject (doc);
							zip.updateFile ("content.xml", new Buffer (xml));
							var buf = zip.toBuffer ();
							response.header ("Content-Type", "application/x-download;");
							response.header ("Content-Disposition", "attachment; filename=report.ods");
							response.header ("Expires", "-1");
							response.header ("Content-Length", buf.length);
							response.statusCode = 200;
							response.end (buf);
						});
					});
				} else
				if (request.query.format == "csv") {
					var csv = "";
					_.each (reportRows, function (row) {
						_.each (row.cells, function (cell) {
							csv += (cell.text === null ? "" : cell.text) + ";";
						});
						csv += "\n";
					});
					if (request.query.coding == "win1251") {
						csv = common.UnicodeToWin1251 (csv);
						var r = new Buffer (csv, "binary");
						response.header ("Content-Type", "application/x-download; charset=windows-1251");
						response.header ("Content-Disposition", "attachment; filename=report.csv");
						response.header ("Expires", "-1");
						response.header ("Content-Length", csv.length);
						response.statusCode = 200;
						response.end (r);
					} else {
						response.header ("Content-Type", "application/x-download; charset=utf-8");
						response.header ("Content-Disposition", "attachment; filename=report.csv");
						response.header ("Expires", "-1");
						response.header ("Content-Length", Buffer.byteLength (csv, "utf8"));
						response.statusCode = 200;
						response.end (csv);
					}
				} else
				if (request.query.format == "xlsx") {
					var rep = new ReportXSLX ();
					options.styles = {
						'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
						'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
						'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
						'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
						'border': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All',
						'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
						'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
						'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
						'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
						'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
						'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
						'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
					};
					options.sheets = [{
						name: "Sheet",
						autoFitHeight: true,
						orientation: "landscape",
						scale: 100,
						margins: {
							left: 31,
							top: 32,
							right: 33,
							bottom: 34
						},
						columns: reportColumns,
						rows: reportRows
					}];
					rep.build (options);
					var buf = XLSX.write (rep.workbook, {
					    type: "base64"
					});
					var r = new Buffer (buf, "base64");
					response.header ("Content-Type", "application/x-download;");
					response.header ("Content-Disposition", "attachment; filename=report.xlsx");
					response.header ("Expires", "-1");
					response.header ("Content-Length", r.length);
					response.statusCode = 200;
					response.end (r);
					delete rep;
				}
			}});
		} else {
			// template
			var session = request.session;
			var storage = session.storage;
			var filename = config.storages [storage.code].rootDir + (request.query.files ? "/files/" : "/reports/") + request.query.template;
			var data;
			_.extend (options, request.query);
			if (options.format == "xmlss") {
				async.series ([
					function (cb) {
						fs.readFile (filename, function (err, _data) {
							data = _data;
							cb (err);
						});
					},
					function (cb) {
						if (options.showTags) {
							data = data.toString ();
							cb ();
						} else {
							xmlss.updateTags ({request: request, tags: options, storage: storage, data: data.toString (), success: function (r) {
								data = r;
								cb ();
							}});
						};
					}
				], function (err, results) {
					response.header ("Content-Type", "application/x-download");
					var tokens = options.template.split (".");
					var filename = "report." + tokens [tokens.length - 1];
					response.header ("Content-Disposition", "attachment; filename=" + filename);
					response.header ("Expires", "-1");
					response.header ("Content-Length", Buffer.byteLength (data, "utf8"));
					response.statusCode = 200;
					response.end (data);
				});
			}
			if (options.format == "docx") {
				async.series ([
					function (cb) {
						fs.readFile (filename, "binary", function (err, _data) {
							data = _data;
							cb (err);
						});
					}
				], function (err, results) {
//					var Docxtemplater = require (config.rootDir + "/node_modules/docxtemplater");
					var Docxtemplater = require ("docxtemplater");
					var doc = new Docxtemplater (data);
					doc.setOptions ({parser: function (tag) {
						return {
							get: function (scope) {
								if (tag === ".") {
									return scope;
								} else {
									return scope [tag];
								}
							}
						};
					}});
					doc.setData (options);
					if (!options.showTags) {
						doc.render ();
					}
					var buf = doc.getZip ().generate ({type: "nodebuffer"});
					response.header ("Content-Type", "application/x-download");
					response.header ("Content-Disposition", "attachment; filename=report.docx");
					response.header ("Expires", "-1");
					response.header ("Content-Length", buf.length);
					response.statusCode = 200;
					response.end (buf);
				});
			}
		};
	} else {
		next ();
	}
}

