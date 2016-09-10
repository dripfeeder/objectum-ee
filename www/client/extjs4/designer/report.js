Ext.define ("$o.ReportDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportdesigner", "widget.$reportdesigner"],
	layout: "vbox",
	border: 0,
	initComponent: function () {
		var me = this;
		me.startRowsNum = 10;
		me.startColsNum = 50;
		var rows = [];
		for (var i = 0; i < me.startRowsNum; i ++) {
			var cells = [];
			for (var j = 0; j < me.startColsNum; j ++) {
				cells.push ({text: "", style: "s1"});
			};
			rows.push ({
				height: 20, cells: cells
			});
		};
		var columns = [];
		for (var i = 0; i < me.startColsNum; i ++) {
			columns.push (50);
		};
		me.value = me.value || {
			name: undefined,
			code: undefined,
			query: [],
			styles: {
				s1: {
					hAlign: "Left",
					vAlign: "Top",
					wrap: true,
					fontSize: 10
				}
			},
			sheets: [{
				name: "Лист1",
				columns: columns,
				rows: rows
			}]
		};
		me.divId = "div-" + (++ Ext.Component.AUTO_ID);
		me.items = [{
			xtype: "tabpanel",
			width: "100%",
			deferredRender: false,
			flex: 1,
			items: [{
				title: "Шаблон",
				iconCls: "gi_edit",
				autoScroll: true,
				tbar: [{
					text: "Объединить",
					iconCls: "gi_resize_small",
					handler: function () {
						if (me.selectedRange) {
							me.ht.mergeCells.mergeOrUnmergeSelection (me.selectedRange);
							me.ht.render ();
						};
					}
				}, {
					iconCls: "gi_bold",
					tooltip: "Полужирный",
					handler: function () {
						me.updateProp ("bold", "bool");
					}
				}, {
					iconCls: "gi_italic",
					tooltip: "Курсив",
					handler: function () {
						me.updateProp ("italic", "bool");
					}
				}, {
					iconCls: "gi_unchecked",
					tooltip: "Рамка",
					handler: function () {
						me.updateProp ("borders", "bool");
					}
				}, "-", {
					iconCls: "gi_align_left",
					tooltip: "Горизонтально: Слева",
					handler: function () {
						me.updateProp ("hAlign", "Left");
					}
				}, {
					iconCls: "gi_align_center",
					tooltip: "Горизонтально: По центру",
					handler: function () {
						me.updateProp ("hAlign", "Center");
					}
				}, {
					iconCls: "gi_align_right",
					tooltip: "Горизонтально: Справа",
					handler: function () {
						me.updateProp ("hAlign", "Right");
					}
				}, "-", {
					iconCls: "gi_up_arrow",
					tooltip: "Вертикально: Сверху",
					handler: function () {
						me.updateProp ("vAlign", "Top");
					}
				}, {
					iconCls: "gi_minus",
					tooltip: "Вертикально: По центру",
					handler: function () {
						me.updateProp ("vAlign", "Middle");
					}
				}, {
					iconCls: "gi_down_arrow",
					tooltip: "Вертикально: Внизу",
					handler: function () {
						me.updateProp ("vAlign", "Bottom");
					}
				}/*, "-", {
					iconCls: "gi_circle_plus",
					tooltip: "Добавить строку",
					handler: function () {
						me.addRow ();
					}
				}, {
					iconCls: "gi_circle_minus",
					tooltip: "Удалить строку",
					handler: function () {
						me.removeRow ();
					}
				}*/],
				html: "<div id='" + me.divId + "' style='width: 100%; height: 100%;'></div>"
			}, {
				title: "Настройка",
				iconCls: "gi_settings",
				layout: "vbox",
				bodyPadding: 3,
				border: false,
				items: [{
					xtype: "textfield",
					name: "name",
					fieldLabel: "Наименование",
					width: "100%",
					value: me.value.name
				}, {
					xtype: "textfield",
					name: "code",
					fieldLabel: "Код",
					width: "100%",
					value: me.value.code
				}, {
					xtype: "combo",
					fieldLabel: "Ориентация",
					name: "orientation",
					width: 250,
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: [
							["portrait", "Книжная"],
							["landscape", "Альбомная"]
						]
					}),
					value: me.value.sheets [0].orientation ? me.value.sheets [0].orientation : "portrait",
					valueField: "id",
					displayField: "text"
				}, {
					xtype: "$o.reportquery",
					width: "100%",
					flex: 1,
					value: me.value.query,
					listeners: {
						change: function (value) {
							me.value.query = value;
						}
					}
				}]
			}]
		}];
		me.on ("afterrender", function () {
			if (window.Handsontable) {
				me.make ();
			} else {
				$o.util.loadJS ("/third-party/js/jquery-2.1.1.min.js", function () {
					$o.util.loadCSS ("/third-party/handsontable/jquery.handsontable.full.css", function () {
						$o.util.loadJS ("/third-party/handsontable/jquery.handsontable.full.min.js", function () {
							$(document).ready (function () {
								me.make ();
							});
						});
					});
				});
			};
		}, me);
		me.addEvents ("change");
		me.callParent (arguments);
	},
	updateProp: function (prop, value) {
		var me = this;
		var sa = me.selectedArea;
		if (!sa) {
			return;
		};
		for (var i = sa.row; i < (sa.row + sa.rowspan); i ++) {
			for (var j = sa.col; j < (sa.col + sa.colspan); j ++) {
				if (value == "bool") {
					var v = true;
					if (me.styleObjects [me.cellStyle [i + "_" + j]]) {
						v = me.styleObjects [me.cellStyle [i + "_" + j]][prop] ? false : true;
					};
					var style = me.createStyle (me.cellStyle [i + "_" + j], prop, v);
					me.cellStyle [i + "_" + j] = style;
				} else {
					var style = me.createStyle (me.cellStyle [i + "_" + j], prop, value);
					me.cellStyle [i + "_" + j] = style;
				};
			};
		};
		me.ht.selectCell (sa.row, sa.col, sa.row + sa.rowspan - 1, sa.col + sa.colspan - 1);
		me.ht.render ();
	},
	addCol: function () {
		var me = this;
		me.ht.alter ("insert_col", me.selectedArea.col, 1);
	},
	removeCol: function () {
		var me = this;
		me.ht.alter ("remove_col", me.selectedArea.col, 1);
	},
	addRow: function () {
		var me = this;
		me.ht.alter ("insert_row", me.selectedArea.row, 1);
	},
	removeRow: function () {
		var me = this;
		me.ht.alter ("remove_row", me.selectedArea.row, 1);
	},
	createStyle: function (style, prop, value) {
		var me = this;
		var o = style ? $o.util.clone (me.styleObjects [style]) : {};
		o [prop] = value;
		var has, maxN = 0;
		for (var style in me.styleObjects) {
			var so = me.styleObjects [style];
			if (JSON.stringify (so).length == JSON.stringify (o).length) {
				var equal = 1;
				for (var p in o) {
					if (o [p] != so [p]) {
						equal = 0;
						break;
					};
				};
				if (equal) {
					has = style;
					break;
				};
			};
			if (maxN < Number (style.substr (1))) {
				maxN = Number (style.substr (1));
			};
		};
		if (has) {
			return has;
		} else {
			me.styleObjects ["s" + (maxN + 1)] = o;
			return "s" + (maxN + 1);
		};
	},
	getData: function () {
		var me = this;
		var rows = me.value.sheets [0].rows;
		var data = [], i;
		me.cellStyle = {};
		for (i = 0; i < rows.length; i ++) {
			var row = {}, cells = rows [i].cells, j;
			for (j = 0; j < cells.length; j ++) {
				row ["c" + j] = cells [j].text;
				me.cellStyle [i + "_" + j] = cells [j].style;
			};
			for (; j < me.startColsNum; j ++) {
				row ["c" + j] = "";
			};
			data.push (row);
		};
		return data;
	},
	getColWidths: function () {
		var me = this;
		var colWidths = me.value.sheets [0].columns;
		for (var i = colWidths.length; i < me.startColsNum; i ++) {
			colWidths.push (50);
		};
		return colWidths;
	},
	getColumns: function () {
		var me = this;
		var rows = me.value.sheets [0].rows;
		var colNum = me.startColsNum;
		for (var i = 0; i < rows.length; i ++) {
			if (rows [i].cells.length > colNum) {
				colNum = rows [i].cells.length;
			};
		};
		var columns = [];
		for (var i = 0; i < colNum; i ++) {
			columns.push ({
				data: "c" + i,
				renderer: me.cellRenderer
			});
		};
		return columns;
	},
	setStyles: function () {
		var me = this;
		me.styleObjects = me.value.styles;
	},
	getRowHeights: function () {
		var me = this;
		var heights = [];
		var rows = me.value.sheets [0].rows;
		for (var i = 0; i < rows.length; i ++) {
			heights.push (rows [i].height);
		};
		return heights;
	},
	getMergeCells: function () {
		var me = this;
		var mergeCells = me.value.sheets [0].mergeCells;
		return mergeCells || true;
	},
	make: function () {
		var me = this;
		Handsontable.cmp = Handsontable.cmp || {};
		Handsontable.cmp [me.divId] = me;
		me.setStyles ();
		var options = {
			data: me.getData (),
			colWidths: me.getColWidths (),
			columns: me.getColumns (),
			rowHeights: me.getRowHeights (),
			mergeCells: me.getMergeCells (),
			manualColumnResize: true,
			manualRowResize: true,
			rowHeaders: true,
			colHeaders: true,
			minSpareRows: 1,
			minSpareCols: 1,
			contextMenu: true,
			beforeRender: function () {
				this.cmp = me;
				me.ht = this;
			},
			afterSelectionEnd: function (r, c, r2, c2) {
				me.selectedArea = {
					row: r,
					col: c,
					rowspan: r2 - r + 1,
					colspan: c2 - c + 1
				};
				me.selectedRange = this.getSelectedRange ();
			}
		};
		$("#" + me.divId).handsontable (options);
	},
	cellRenderer: function (instance, td, row, col) {
		var me = instance.cmp;
		Handsontable.renderers.TextRenderer.apply (this, arguments);
		td.style.fontFamily = "sans-serif";
		var styleObject = me.styleObjects [me.cellStyle [row + "_" + col]] || {};
		if (styleObject.fontSize) {
			td.style.fontSize = styleObject.fontSize + "pt";
		} else {
			td.style.fontSize = "10pt";
		};
		if (styleObject.hAlign) {
			td.style.textAlign = styleObject.hAlign.toLowerCase ();
		} else {
			td.style.textAlign = "left";
		};
		if (styleObject.vAlign) {
			td.style.verticalAlign = styleObject.vAlign.toLowerCase ();
		} else {
			td.style.verticalAlign = "top";
		};
		if (styleObject.bold) {
			td.style.fontWeight = "bold";
		};
		if (styleObject.italic) {
			td.style.fontStyle = "italic";
		};
		if (styleObject.borders) {
			td.style.border = "1px solid black";
		};
		return td;
	},
	getValue: function () {
		var me = this;
		var data = me.ht.getData ();
		var rows = [];
		for (var i = 0; i < data.length; i ++) {
			var cells = [];
			for (var j = 0; j < me.ht.countCols (); j ++) {
				cells.push ({
					text: data [i]["c" + j], style: me.cellStyle [i + "_" + j]
				});
			};
			rows.push ({
				height: me.ht.getRowHeight (i),
				cells: cells
			});
		};
		var columns = [];
		for (var i = 0; i < me.ht.countCols (); i ++) {
			columns.push (me.ht.getColWidth (i));
		};
		var value = {
			name: me.down ("textfield[name=name]").getValue (),
			code: me.down ("textfield[name=code]").getValue (),
			query: me.value.query,
			styles: me.styleObjects,
			sheets: [{
				name: "Sheet1",
				orientation: me.down ("*[name=orientation]").getValue (),
				columns: columns,
				rows: rows,
				mergeCells: me.ht.mergeCells.mergedCellInfoCollection,
				countEmptyRows: me.ht.countEmptyRows (true),
				countEmptyCols: me.ht.countEmptyCols (true)
			}]
		};
		return value;
	},
	build: function (options) {
		var me = this;
		me.processTags (options);
		if (options.preview) {
			me.generateXMLSS ().preview ();
		} else
		if (options.html) {
			var html = me.generateHTML ();
			me.previewHTML (html);
		} else {
			var report = me.generateXMLSS ();
			if (options.pdf) {
				report.createPDF ();
			} else {
				report.create ();
			};
		};
	},	
	generateXMLSS: function () {
		var me = this;
		var r = [], rows = me.value.sheets [0].rows;
		var mc = me.value.sheets [0].mergeCells;
		for (var i = 0; i < rows.length; i ++) {
			var c = [], cells = rows [i].cells;
			for (var j = 0; j < cells.length; j ++) {
				var colspan = 1, rowspan = 1;
				var skip = 0;
				for (var k = 0; k < mc.length; k ++) {
					if (mc [k].row == i && mc [k].col == j) {
						colspan = mc [k].colspan;
						rowspan = mc [k].rowspan;
						break;
					} else
					if (i >= mc [k].row && i < (mc [k].row + mc [k].rowspan) && j >= mc [k].col && j < (mc [k].col + mc [k].colspan)) {
						skip = 1;
						break;
					};
				};
				if (skip) {
					continue;
				};
				c.push ({
					text: cells [j].text,
					style: cells [j].style,
					colspan: colspan,
					rowspan: rowspan,
					startIndex: j + 1
				});
			};
			r.push ({
				height: rows [i].height * 0.75,
				cells: c
			});
		};
		var s = {
			'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:10'
		}, styles = me.value.styles;
		for (var key in styles) {
			var o = styles [key];
			var ss = ["wrap:true"];
			if (o.fontSize) {
				ss.push ("fontSize:" + o.fontSize);
			};
			if (o.hAlign) {
				ss.push ("hAlign:" + o.hAlign);
			};
			if (o.vAlign) {
				ss.push ("vAlign:" + (o.vAlign == "Middle" ? "Center" : o.vAlign));
			};
			if (o.bold) {
				ss.push ("bold:true");
			};
			if (o.italic) {
				ss.push ("italic:true");
			};
			if (o.borders) {
				ss.push ("borders:All");
			};
			s [key] = ss.join (",");
		};
		var c = [], columns = me.value.sheets [0].columns;
		for (var i = 0; i < columns.length; i ++) {
			c.push (columns [i] / 7);
		};
		var report = new $report.xmlss ();
		report.styles = s;
		report.sheets = [new $report.sheet ({
			name: 'Лист1', 
			orientation: me.value.sheets [0].orientation,
			margins: {
				left: 15,
				top: 15,
				right: 15,
				bottom: 15
			},
			columns: c,
			rows: r
		})];
		return report;
	},
	generateHTML: function (options) {
		var me = this;
		var html = "";
		var rows = me.value.sheets [0].rows;
		var columns = me.value.sheets [0].columns;
		var mc = me.value.sheets [0].mergeCells;
		var borderCells = {};
		for (var i = 0; i < rows.length; i ++) {
			var row = rows [i];
			var cells = row.cells;
			var r = "<tr style='height:" + row.height + "px'>";
			for (var j = 0; j < cells.length; j ++) {
				var colspan = 1, rowspan = 1;
				var skip = 0;
				for (var k = 0; k < mc.length; k ++) {
					if (mc [k].row == i && mc [k].col == j) {
						colspan = mc [k].colspan;
						rowspan = mc [k].rowspan;
						break;
					} else
					if (i >= mc [k].row && i < (mc [k].row + mc [k].rowspan) && j >= mc [k].col && j < (mc [k].col + mc [k].colspan)) {
						skip = 1;
						break;
					};
				};
				if (skip) {
					continue;
				};
				var style = "";
				var cell = cells [j];
				var v = cell.text;
				if (v === undefined || v === null || v === "") {
					v = "<img width=1 height=1>";
				};
				var cellStyle = me.value.styles [cell.style];
				cellStyle = cellStyle || {};
				if (cellStyle.bold > -1) {
					style = "font-weight:bold;";
				};
				if (cellStyle.italic > -1) {
					style = "font-style:italic;";
				};
				if (cellStyle.hAlign) {
					style += "text-align:" + cellStyle.hAlign.toLowerCase () + ";";
				};
				if (cellStyle.vAlign) {
					style += "vertical-align:" + cellStyle.vAlign.toLowerCase () + ";";
				};
				if (cellStyle.borders) {
					borderCells [i] = borderCells [i] || {};
					borderCells [i][j] = 1;
					if (!borderCells [i - 1] || !borderCells [i - 1][j]) {
						style += "border-top:1px solid black;";
					};
					if (!borderCells [i][j - 1]) {
						style += "border-left:1px solid black;";
					};
					style += "border-right:1px solid black;";
					style += "border-bottom:1px solid black;";
				};
				style += "width:" + columns [j] + "px;padding:2px;";
				r += "<td class='tb-text' colspan=" + colspan + " rowspan=" + rowspan + " style='" + style + "'>" + v + "</td>";
			};
			r += "</tr>\n";
			html += r;
		};
		return html;
	},
	previewHTML: function (html) {
		var me = this;
		r =
			"<style type='text/css'>\n" +
			"* {\n" +
			"   font-family: Tahoma;\n" +
			"   font-size: 8pt;\n" +
			"}\n" +
			"</style>\n"
		;
		if (me.value.sheets [0].orientation == "landscape") {
			r +=
				'<style type="text/css" media="print">\n' +
				'\t@page { size: landscape; }\n' +
				'</style>\n'
			;
		};
		r +=
			"<table cellpadding=0 cellspacing=0>" +
			html +
			"</table>"
		;
		w = window.open ("", "window1", "width=800, height=600, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
		w.document.open ();
		w.document.write (r);
		w.document.close ();
		w.print ();
	},
	processObject: function (t, row, args, tags, rowNum) {
		var me = this;
		var r = [], cells = row.cells;
		var a = args [t];
		var num = 0;
		for (var i in a) {
			var c = [];
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text;
				for (var k = 0; k < tags.length; k ++) {
					var tag = tags [k];
					var v = args [tag] == undefined ? "" : args [tag];
					var tokens = tag.split (".");
					if (tokens [0] == t && tokens.length > 1) {
						for (var l = 1, v = a [i]; l < tokens.length; l ++) {
							v = v ? v [tokens [l]] : undefined;
						};
					};
					if (v == undefined) {
						v = "";
					};
					text = text.split ("[#" + tags [k] + "]").join (v);
				};
				c.push ({
					text: text,
					style: cells [j].style
				});
			};
			r.push ({
				height: row.height,
				cells: c
			});
			num ++;
			if (num > 1) {
				me.moveMergeCells (rowNum);
			};
		};
		return r;
	},
	processQuery: function (t, query, row, args, tags, rowNum) {
		var me = this;
		var r = [], cells = row.cells;
		var v = $o.getView (query.view);
		var sql = JSON.parse (v.get ("query"));
		if (query.filter && query.filter.length) {
			var filter = query.filter;
			for (var i = 0; i < filter.length; i ++) {
				var f = filter [i];
				if (f [0] == "[" && f [1] == "#") {
					filter [i] = args [f.substr (2, f.length - 3)];
				};
				for (var j = 1; j < sql.select.length; j += 2) {
					if (sql.select [j] == f) {
						filter [i] = sql.select [j - 1];
					};
				};
			};
			sql.where = sql.where || [];
			if (sql.where.length) {
				sql.where = [sql.where, "and"];
			};
			sql.where.push (filter);
		};
		var q = $o.execute (sql);
		var num = 0;
		for (var i = 0; i < q.length; i ++) {
			var c = [];
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text;
				for (var k = 0; k < tags.length; k ++) {
					var tag = tags [k];
					var v = args [tag] == undefined ? "" : args [tag];
					var tokens = tag.split (".");
					if (tokens [0] == t && tokens.length > 1) {
						v = q.get (i, tokens [1]);
					};
					text = text.split ("[#" + tags [k] + "]").join (v);
				};
				c.push ({
					text: text,
					style: cells [j].style
				});
			};
			r.push ({
				height: row.height,
				cells: c
			});
			num ++;
			if (num > 1) {
				me.moveMergeCells (rowNum);
			};
		};
		return r;
	},
	moveMergeCells: function (row) {
		var me = this;
		var mc = me.value.sheets [0].mergeCells;
		for (var i = 0; i < mc.length; i ++) {
			if (mc [i].row >= row) {
				mc [i].row ++;
			};
		};
	},
	processTags: function (args) {
		var me = this;
		var r = [], rows = me.value.sheets [0].rows;
		var query = {};
		for (var i = 0; i < me.value.query.length; i ++) {
			query [me.value.query [i].alias] = me.value.query [i];
		};
		for (var i = 0; i < rows.length; i ++) {
			var cells = rows [i].cells;
			var tags = [], isArray = "", isQuery = "";
			for (var j = 0; j < cells.length; j ++) {
				var text = cells [j].text || "";
				for (var k = 1; k < text.length; k ++) {
					if (text [k] == "#" && text [k - 1] == "[") {
						var tag = "";
						for (k ++; k < text.length; k ++) {
							if (text [k] == "]") {
								break;
							} else {
								tag += text [k];
							};
						};
						if (tags.indexOf (tag) == -1) {
							tags.push (tag);
							if (Ext.isArray (args [tag.split (".")[0]])) {
//							if (typeof (args [tag.split (".")[0]]) == "object") {
								isArray = tag.split (".")[0];
							};
							if (query [tag.split (".")[0]]) {
								isQuery = tag.split (".")[0];
							};
						};
					};
				};
			};
			if (isQuery) {
				r = r.concat (me.processQuery (isQuery, query [isQuery], rows [i], args, tags, r.length));
			} else
			if (isArray) {
				r = r.concat (me.processObject (isArray, rows [i], args, tags, r.length));
			} else {
				var c = [];
				for (var j = 0; j < cells.length; j ++) {
					var text = cells [j].text || "";
					for (var k = 0; k < tags.length; k ++) {
						var tag = tags [k];
						var tokens = tag.split (".");
						for (var l = 0, v = args; l < tokens.length; l ++) {
							v = v ? (v [tokens [l]] || "") : "";
						};
						text = text.split ("[#" + tag + "]").join (v);
					};
					c.push ({
						text: text,
						style: cells [j].style
					});
				};
				r.push ({
					height: rows [i].height,
					cells: c
				});
			};
		};
		me.value.sheets [0].rows = r;		
	}
});
