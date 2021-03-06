/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/
//Ext.Loader.setPath ("Ext.ux", "/third-party/extjs4/examples/ux");
//Ext.require ("Ext.ux.grid.FiltersFeature");
Ext.define ("$o.Base.Grid", {
	/*
		Создает компонент кнопки из макета action
	*/
	createButton: function (action) {
		let me = this;
		let item = {
			scope: me,
			handler: function () {
				if (action.type && action.type == "report") {
					me.report (action);
				} else
				if (_fn) {
					item.noTransaction = item.noTransaction || (item.arguments ? item.arguments.noTransaction : null);
					try {
						_fn = typeof (_fn) == "string" ? eval ("(" + _fn + ")") : _fn;
					} catch (e) {
						common.message ($o.getString ("Function not exists") + ": " + _fn);
						throw new Error ("action.fn exception: " + _fn + "\nexception: " + e);
					};
					if (!item.noTransaction) {
						$o.startTransaction ({description: '***prepare_transaction*** action started'});
					};
					let a = $o.util.clone (item.arguments);
					if ($o.debug || (a && a.debug)) {
						_fn.call (me, a || {});
						if (!item.noTransaction) {
							$o.commitTransaction ();
						};
					} else {
						try {
							_fn.call (me, a || {});
							if (!item.noTransaction) {
								$o.commitTransaction ();
							};
						} catch (e) {
							if (!item.noTransaction) {
								$o.rollbackTransaction ();
							};
							console.log (e.stack);
							throw new Error (e);
						};
					};
				};
			}
		};
		Ext.apply (item, action);
		if (action.code) {
			item.text = $o.locale.getString (action.code);
			item.iconCls = action.code;
		};
		item.iconCls = item.iconCls || item.icon;
		item.text = $o.locale.getString (action.text || action.caption);
		if (action.actions) {
			item.menu = {
				items: []
			};
			for (let i = 0; i < action.actions.length; i ++) {
				item.menu.items.push (me.createButton (action.actions [i]));
			};
		};
		let _fn = item.fn || item.id;
		item.id = undefined;
		return item;
	},
	/*
		action.type: report
	*/
	report: function (action) {
		let me = this;
		let createReport = function () {
			let reportUri = "report?";			
			let key;
			for (key in action.arguments) {
				if (Ext.isArray (action.arguments [key])) {
					reportUri += key + "=" + me.zview.getCurrentValue (action.arguments [key][0], action.arguments [key][1]) + "&";
				} else {
					reportUri += key + "=" + action.arguments [key] + "&";
				};
			};
			reportUri += "storage=" + $o.code + '&sessionId=' + $sessionId + "&username=" + $o.currentUser + "&time_offset_min=" + (new Date ()).getTimezoneOffset ();
			let w = window.open (reportUri);
			w.focus ();
		}
		if (action.fn) {
			action.arguments.success = function () {
				createReport ();
			};
			try {
				action.fn.call (me, action.arguments);
			} catch (e) {
				alert (e);
				return;
			}
		}
		if (!action.arguments.hasCallback) {
			createReport (me);
		}
	},	
	/*
		Создает модель для представления
	*/
	createViewModel: function (options) {
		let view = options.view;
		let viewId = view.get ("id");
		$o.updateViewAttrsType ({view: view});
//		if (view.orderedFields) {
//			return view.orderedFields;
//		};
		let fields = [];
		for (let attr in view.attrs) {
			let va = view.attrs [attr];
			let dataType = va.get ("classAttr") == null ? "number" : $o.classAttrsMap [va.get ("classAttr")].getDataType ();
			let filterDataType = va.get ("classAttr") == null ? "numeric" : $o.classAttrsMap [va.get ("classAttr")].getFilterDataType ();
			fields.push ({
				name: va.get ("code"),
				header: va.get ("name"),
				type: dataType,
				filterType: filterDataType,
				order: va.get ("order"),
				id: va.get ("id"),
				area: va.get ("area"),
				width: va.get ("width"),
				useNull: true
			});
		};
		fields.sort (function (a, b) {
			if (a.order !== null && b.order !== null && a.order < b.order) {
				return -1;
			};
			if (a.order != null && b.order == null) {
				return -1;
			};
			if (a.order == b.order && a.id < b.id) {
				return -1;
			};
			if (a.order !== null && b.order !== null && a.order > b.order) {
				return 1;
			};
			if (a.order == null && b.order != null) {
				return 1;
			};
			if (a.order == b.order && a.id > b.id) {
				return 1;
			};
			return 0;
		});
		view.orderedFields = $o.util.clone (fields);
		return fields;
	},
	beforeSelectListener: function (selModel) {
	},
	selectionChangeListener: function (selModel) {
		for (let id in this.targets) {
			let w = this.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		this.checkActions ();
	},
	checkActions: function () {
		let tbar = this.getDockedItems ("toolbar[dock='top']")[0];
		if (!tbar) {
			return;
		};
		for (let i = 0; i < tbar.items.getCount (); i ++) {
			let b = tbar.items.getAt (i);
			if (b.active) {
				let fn, args;
				if (typeof (b.active) == "function") {
					fn = b.active;
				} else
				if (typeof (b.active) == "string") {
					fn = eval (b.active);
				} else
				if (typeof (b.active) == "object") {
					fn = b.active.fn;
					args = b.active.arguments;
				};
				let active = fn.call (this, args);
				if (active) {
					b.enable ();
				} else {
					b.disable ();
				};
			};
		};
	},
	buildToolbar: function () {
		let me = this;
		if (!me.actions) {
			return;
		};
		let items = [];
		for (let i = 0; i < me.actions.length; i ++) {
			items.push (me.createButton (me.actions [i]));
		};
		if (items.length) {
			me.dockedItems = me.dockedItems || [];
			me.dockedItems.push ({
			    xtype: "toolbar",
			    dock: me.actionsDock || "top",
			    items: items
			});
		};
	},
	getCurrentValue: function (field) {
		let val;
		if (this.getSelectionModel ().hasSelection ()) {
			let record = this.getSelectionModel ().getSelection ()[0];
			val = record.get (field);
		};
		return val;
	},
	getValue: function (field) {
		return this.getCurrentValue (field);
	},
	getCurrentValues: function (field) {
		let va = [];
		if (this.getSelectionModel ().hasSelection ()) {
			let records = this.getSelectionModel ().getSelection ();
			for (let i = 0; i < records.length; i ++) {
				va.push (records [i].get (field));
			};
		};
		return va;
	},
	getValues: function (field) {
		return this.getCurrentValues (field);
	},
	/*
		User filter (grid filter menu)
	*/
	getUserFilter: function () {
		let me = this;
		if (!me.filters) {
			return [];
		};
		let fd = me.filters.getFilterData ();
		let r = [];
		let operMap = {
			"eq": "=",
			"lt": "<",
			"gt": ">",
			"neq": "<>",
			"lte": "<=",
			"gte": ">="
		};
		for (let i = 0; i < fd.length; i ++) {
			if (i) {
				r.push ("and");
			};
			let f = fd [i];
			if (typeof (f.data.value) == "object" && f.data.value.isNotNull) {
				r.push (f.field);
				r.push ("is not null");
			} else
			if (typeof (f.data.value) == "object" && f.data.value.isNull) {
				r.push (f.field);
				r.push ("is null");
			} else
			if (f.data.type && f.data.type == "boolean") {
				if (f.data.value) {
					r.push ([f.field, "=", 1]);
				} else {
					r.push ([f.field, "=", 0, "or", f.field, "is null"]);
				}
			} else {
				r.push (f.field);
				let oper = "like";
				if (f.data.comparison) {
					oper = operMap [f.data.comparison];
				};
				let v = f.data.value;
				if (oper == "like" && v) {
					if (typeof (v) == "object") {
						if (v.notLike) {
							oper = "not like";
						}
						if (v.value.indexOf (",") > -1) {
							if (v.notLike) {
								oper = "not in";
							} else {
								oper = "in";
							}
							f.data.value = v.value.split (",").join (".,.").split (".");
						} else {
							f.data.value = v.value + "%";
						}
					} else {
						f.data.value += "%";
					}
				};
				r.push (oper);
				r.push (f.data.value);
			};
		};
		return r;
	},
	/*
		Full filter
	*/
	getFilter: function () {
		let me = this;
		// custom filter
		let cf = [];
		// user filter
		let uf = me.getUserFilter ();
		if (!me.filter) {
			return uf;
		};
		if (typeof (me.filter) == "string") {
			me.filter = {
				fn: eval (me.filter)
			};
		};
		if (typeof (me.filter) == "function") {
			me.filter = {
				fn: me.filter
			};
		};
		let disabled = false;
		let get = function (a) {
			if (Object.prototype.toString.apply (a) === "[object Array]") {
				let g = [];
				for (let i = 0; i < a.length; i ++) {
					g.push (get (a [i]));
				};
				return g;
			} else {
				if (typeof (a) == "object" && a.id) {
					me.relatives [a.id].targets [me.zid] = me;
					let v = me.zview.getCurrentValue (a.id, a.attr);
					if (v == undefined) {
						me.setDisabled (true);
						disabled = true;
						return undefined;
					} else {
						me.setDisabled (false);
						return v;
					};
				} else {
					return a;
				};
			};
		};
		if (me.filter.fn) {
			cf = me.filter.fn.call (me, me.filter.arguments);
			cf = get (cf);
			if (disabled) {
				cf = undefined;
			};
			if (cf == undefined) {
				me.setDisabled (true);
				return undefined;
			} else {
				me.setDisabled (false);
			};
		} else {
			cf = get (me.filter);
			if (disabled) {
				cf = undefined;
			};
		};
		if (Object.prototype.toString.apply (cf) === "[object Array]") {
			if (cf.length && uf.length) {
				cf.push ("and");
			};
			cf = cf.concat (uf);
		};
		return cf;
	},
	getFullFilter: function () {
		return this.getFilter ();
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		metaData.userStyle = undefined; // shared option
		if (this.lconfig && this.lconfig.listeners && this.lconfig.listeners.cellRenderer) {
			if (typeof (this.lconfig.listeners.cellRenderer) == "string") {
				this.lconfig.listeners.cellRenderer = eval (this.lconfig.listeners.cellRenderer);
			};
			let scope = this.lconfig.listeners.cellRenderer.scope || this.lconfig.listeners.scope || this;
			if (scope == 'view') {
				scope = this.zview;
			};
			if (scope === 'this') {
				scope = this;
			};
			let _fn = this.lconfig.listeners.cellRenderer.fn || this.lconfig.listeners.cellRenderer;
			if (typeof (_fn) == "string") {
				_fn = eval (_fn);
			};
			value = _fn.call (scope, value, metaData, record, rowIndex, colIndex, store, this.lconfig.listeners.cellRenderer.arguments);
		};
		if (value) {
			let tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		if (metaData.userStyle) {
			let style = '';
			style += metaData.userStyle || '';
			metaData.tdAttr += ' style="' + style + '"';
		};
		if (this.wordWrap) {
			metaData.style = "white-space: normal;";
		};
		return value;
	},
	userEventListener: function (options) {
		if (!this.lconfig) {
			return;
		};
		let listeners = this.lconfig.listeners;
		let scope = this;
		if (listeners && listeners.scope) {
			scope = listeners.scope;
		}
		if (listeners && listeners [options.event]) {
			if (listeners [options.event].fn) {
				if (listeners [options.event].scope) {
					scope = listeners [options.event].scope;
				}
				let fn = typeof (listeners [options.event].fn) == "string" ? eval ("(" + listeners [options.event].fn + ")") : listeners [options.event].fn;
				let args = $o.util.clone (listeners [options.event].arguments);
				fn.call (scope, args || {});
			} else {
				let fn = typeof (listeners [options.event]) == "string" ? eval ("(" + listeners [options.event] + ")") : listeners [options.event];
				fn.call (scope, {});
			}
		}
	},
	getGroupedColumns: function (columns) {
		let getRows = function (cols) {
		    let rowNum = (function (cols) {
		    	let r = 0;
			    for (let i = 0; i < cols.length; i ++) {
			    	let a = cols [i].split (":");
			    	if (a.length > r) {
			    		r = a.length;
			    	};
			    };
			    return r;
			}) (cols);
			// init matrix
		    let m = [];
		    for (let i = 0; i < cols.length; i ++) {
		    	let a = cols [i].split (":");
		    	for (let j = 0; j < a.length; j ++) {
		    		a [j] = {text: a[j].trim (), colspan: 1, rowspan: 1};
		    	};
		    	for (let j = 0, len = rowNum - a.length; j < len; j ++) {
		    		a.push ({text: null, colspan: 1, rowspan: 1});
		    	};
		    	m.push (a);
		    };
		    // merge cols
		    for (let i = 1; i < cols.length; i ++) {
				for (let j = 0; j < rowNum; j ++) {
					let ref = m [i - 1][j].hasOwnProperty ('ref') ? m [i - 1][j].ref :  i - 1;
					if (m [i][j].text != null && m [i][j].text == m [ref][j].text) {
						m [ref][j].colspan ++;
						m [i][j].ref = ref;
					};
				};
		    };
		    // merge rows
			for (let i = 0; i < cols.length; i ++) {
				for (let j = 1; j < rowNum; j ++) {
					let refR = m [i][j - 1].hasOwnProperty ('refR') ? m [i][j - 1].refR : j - 1;
					if (m [i][j].text == null) {
						m [i][refR].rowspan ++;
						m [i][j].refR = refR;
					};
				};
			};
			// rows
			let rows = [];
			for (let i = 0; i < rowNum; i ++) {
				let cells = [], index = 1;
				for (let j = 0; j < cols.length; j ++) {
					if (m [j][i].hasOwnProperty ('refR')) {
						index += m [j][i].colspan;
						continue;
					};
					if (!m [j][i].hasOwnProperty ('ref')) {
						cells.push ({
							text: m [j][i].text, 
							colspan: m [j][i].colspan,
							rowspan: m [j][i].rowspan, 
							index: index
						});
						index += m [j][i].colspan;
					};
				};
				rows.push (cells);
			};
			return rows;
		};
		let convert = function (rows, columns) {
			let getRow = function (level, parent) {
				let cols = [];
				_.each (rows [level], function (col) {
					if (!parent || (col.index >= parent.index && col.index < parent.index + parent.colspan)) {
						let childs = [];
						if (level + 1 < rows.length) {
							childs = getRow (level + 1, col);
						};
						if (childs.length) {
							cols.push ({
								text: col.text,
								columns: childs
							});
						} else {
							columns [col.index - 1].header = col.text;
							columns [col.index - 1].tooltip = col.text;
							cols.push (columns [col.index - 1]);
						};
					};
				});
				return cols;
			};
			let cols = getRow (0);
			return cols;
		};
		let rows = getRows (_.map (columns, function (col) {
			return col.header;
		}));
		let r = convert (rows, columns);
		return r;
	}
});
Ext.define ("$o.Grid.Widget", {
	extend: "Ext.grid.Panel",
	mixins: {
		baseGrid: "$o.Base.Grid"
	},
    alias: ["widget.$o.grid"],
	columnLines: true,
	rowLines: true,
	total: {},
	totalValues: {},
	groupedColumns: true,
	initComponent: function () {		
		let me = this;
		let view, viewId;
		if (me.classView) {
			let cls = $o.getClass (me.classView);
			function createView () {
				let inTransaction = $o.inTransaction;
				if (!inTransaction) {
					$o.startTransaction ();
				}
				cls.updateDefault ();
				if (!inTransaction) {
					$o.commitTransaction ();
				}
			}
			if (!cls.get ("view")) {
				createView ();
			}
			view = $o.getView (cls.get ("view"));
			if (me.recreateView || view.get ("query").indexOf ("left-join") > -1) {
				let inTransaction = $o.inTransaction;
				if (!inTransaction) {
					$o.startTransaction ();
				}
				view.remove ();
				view.sync ();
				cls.set ("view", null);
				cls.sync ();
				createView ();
				if (!inTransaction) {
					$o.commitTransaction ();
				}
			}
			viewId = cls.get ("view");
		} else {
			view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
			viewId = me.viewId = view.get ("id");
		};
		me.$view = view;
		let query = view.get ("query");
		delete me.query;
		let fields = me.createViewModel ({view: view});
		me.columns = [];
		for (let i = 0; i < fields.length; i ++) {
			let f = fields [i];
			let column = {
				header: $o.getString (f.header),
				tooltip: $o.getString (f.header),
				dataIndex: f.name,
				hidden: f.area != 1,
				width: f.width,
				filter: {
					type: f.filterType
				},
				$field: f,
				renderer: me.cellRenderer,
				scope: me,
				summaryType: 'count',
				summaryRenderer: me.summaryRenderer
			};
			if (f.type == "bool") {
				column.renderer = function (v, meta, rec, row, col, store) {
					if (v) {
						v = $o.getString ("Yes");
					} else {
//					if (v == 0 || v == false) {
						v = $o.getString ("No");
					};
					return me.cellRenderer (v, meta, rec, row, col, store);
				};
			};
			me.columns.push (column);
		};
		if (me.groupedColumns) {
			me.columns = me.getGroupedColumns (me.columns);
		};
		_.each (me.fields, function (f) {
			f.header = "";
		});
		Ext.define ("$o.View." + viewId + ".Model", {
			extend: "Ext.data.Model",
			fields: fields
		});
		me.store = Ext.create ("Ext.data.Store", {
			model: "$o.View." + viewId + ".Model",
			pageSize: 30,
			remoteSort: true,
			clearOnPageLoad: true,
			proxy: {
				type: "ajax",
				api: {
					"create": "view?create=1&id=" + viewId + "&cmpId=" + me.id,
					"read": "view?read=1&id=" + viewId + "&cmpId=" + me.id,
					"update": "view?update=1&id=" + viewId + "&cmpId=" + me.id,
					"delete": "view?delete=1&id=" + viewId + "&cmpId=" + me.id
				},
				reader: {
					"type": "json",
					"root": "data"
				}
			},
			listeners: {
				load: function (records, successful, eOpts) {
					if (me.down ("*[name=rowsNum]")) {
						me.down ("*[name=rowsNum]").setText ($o.getString ("Amount") + ": " + (me.countOverflow ? ">" : "") + this.totalCount);
					};
					if (me.needReconfigureColumns) {
						me.needReconfigureColumns = false;
						me.reconfigureColumns ();
					};
				}
			}
		});
		me.dockedItems = me.dockedItems || [];
		if (!me.hideBottomToolbar) {
			let items = [];
			if (!me.hidePrint) {
				items.push ({
					iconCls: "gi_print",
					tooltip: "Печать",
					menu: {
						items: [{
							text: "*.xml (" + $o.getString ("Table") + " XML - Microsoft Excel)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "xmlss");
							}
						}, {
							text: "*.csv (CSV - " + $o.getString ("encoding") + " win-1251)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "csv", "win1251");
							}
						}, {
							text: "*.csv (CSV - " + $o.getString ("encoding") + " utf-8)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "csv", "utf8");
							}
						}, {
							text: "*.xlsx (XLSX - Microsoft Excel)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "xlsx");
							}
						}, {
							text: "*.pdf (PDF)",
							iconCls: "gi_print",
							hidden: !common.getConf ({code: "reportPDF"}).used,
							handler: function () {
								me.printOlap.call (this, "pdf");
							}
						}, {
							text: "*.ods (ODF - Open Document Format)",
							iconCls: "gi_print",
							handler: function () {
								me.printOlap.call (this, "ods");
							}
						}]
					}
				});
			};
			if (!me.hideHeaders) {
				items.push ({
					iconCls: "gi_restart",
					tooltip: $o.getString ("Reset filters and totals"),
					handler: function () {
						me.filters.clearFilters ();
						me.total = {};
						me.totalValues = {};
						let summary = me.down ("*[itemId=summaryBar]");
						summary.hide ();
						me.refresh ();
					}
				});
				items.push ({
					xtype: "label",
					name: "rowsNum",
					text: ""
				});
			};
			me.dockedItems.push ({
				xtype: "pagingtoolbar",
				store: me.store,
				dock: "bottom",
				beforePageText: "",
				afterPageText: $o.getString ("of") + " {0}",
				items: items
			});
		};
		me.filters = {
			ftype: "filters",
			encode: true,
			local: false
		};	
		me.features = [me.filters, {
			ftype: "summary",
			dock: "bottom",
			name: "summary"
		}];
		me.buildToolbar ();
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("render", me.renderListener, me);
		me.on ("itemdblclick", function () {
			me.userEventListener ({event: "dblclick"});
		}, me);
		me.selModel = me.selModel || Ext.create ("Ext.selection.RowModel", {
			mode: me.singleSelect == false ? "MULTI" : "SINGLE",
			listeners: {
				beforeselect: {
					fn: me.beforeSelectListener,
					scope: me
				},
				selectionchange: {
					fn: me.selectionChangeListener,
					scope: me
				}
			}
		});
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
		Ext.ux.grid.FiltersFeature.prototype.menuFilterText = $o.getString ("Filter");
		Ext.ux.grid.filter.BooleanFilter.prototype.yesText = $o.getString ("Yes");
		Ext.ux.grid.filter.BooleanFilter.prototype.noText = $o.getString ("No");
		Ext.ux.grid.filter.DateFilter.prototype.beforeEqText = $o.getString ("Less or equal");
		Ext.ux.grid.filter.DateFilter.prototype.beforeText = $o.getString ("Less");
		Ext.ux.grid.filter.DateFilter.prototype.afterEqText = $o.getString ("More or equal");
		Ext.ux.grid.filter.DateFilter.prototype.afterText = $o.getString ("More");
		Ext.ux.grid.filter.DateFilter.prototype.nonText = $o.getString ("Not equal");
		Ext.ux.grid.filter.DateFilter.prototype.onText = $o.getString ("Equal");
		Ext.ux.grid.filter.DateFilter.prototype.dateFormat = "d.m.Y";
		Ext.ux.grid.menu.RangeMenu.prototype.menuItemCfgs.emptyText = $o.getString ("Enter number") + " ...",
		me.on ("columnshow", function () {
			me.needReconfigureColumns = true;
		});
		me.addEvents (
			"refresh"
		);
		me.callParent (arguments);
	},
	beforeRenderListener: function () {
		if (this.getFilter ()) {
			this.store.load ();
		};
	},
	renderListener: function () {
		let me = this;
		me.checkActions ();
		if ($o.util.isEmptyObject (me.total)) {
			let summary = me.down ("*[itemId=summaryBar]");
			if (summary) {
				summary.hide ();
			};
		};
		let onActivate = function () {
			if (this.down ("*[name=totals]")) {
				this.remove (this.down ("*[name=totals]"));
			};
			let columns = me.query ("gridcolumn");
			let numberColumn = 0;
			for (let i = 0; i < columns.length; i ++) {
				if (columns [i].$field && columns [i].$field.name == menu.activeHeader.dataIndex) {
					if (columns [i].$field.type == "number") {
						numberColumn = 1;
					};
					break;
				};
			};
			if (numberColumn) {
				this.add ([{
					text: $o.getString ("Totals"),
					name: "totals",
					iconCls: "gi_calculator",
					menu: {
						defaults: {
							handler: function () {
								me.total [menu.activeHeader.dataIndex] = this.name;
								me.refresh ();
								let summary = me.down ("*[itemId=summaryBar]");
								summary.show ();
							}
						},
						items: [{
							text: $o.getString ("Sum"),
							iconCls: "gi_calculator",
							name: "sum"
						}, {
							text: $o.getString ("Average"),
							iconCls: "gi_calculator",
							name: "avg"
						}, {
							text: $o.getString ("Max"),
							iconCls: "gi_calculator",
							name: "max"
						}, {
							text: $o.getString ("Min"),
							iconCls: "gi_calculator",
							name: "min"
						}]
					}
				}]);           
			};
		};
		let menu = me.headerCt.getMenu ();
		menu.on ("activate", onActivate);
		me.on ("reconfigure", function () {
			menu = me.headerCt.getMenu ();
			menu.on ("activate", onActivate);
		});
	},
    summaryRenderer: function(value, summaryData, dataIndex) {
	    let field = summaryData.column.dataIndex;
		return this.totalValues [field];
	},
	refresh: function (options) {
		let me = this;
		if (me.getFilter ()) {
			if (options && options.moveFirst) {
				let pt = me.getDockedItems ("pagingtoolbar");
				if (pt && pt.length) {
					pt [0].moveFirst ();
				};
			};
			me.store.reload (options);
			me.checkActions ();
		};
		for (let id in me.targets) {
			let w = me.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		me.fireEvent ("refresh");
	},
	reconfigureColumns: function () {
		let me = this;
    	let cols = [];
    	let columns = me.down ("headercontainer").getGridColumns ();
    	for (let i = 0; i < columns.length; i ++) {
    		let col = columns [i];
    		let c = {
				header: col.text,
				tooltip: col.tooltip,
				dataIndex: col.dataIndex,
				hidden: col.hidden,
				width: col.width,
				filter: {
					type: col.filter.type
				},
				$field: col.$field,
				renderer: col.renderer,
				scope: col.scope
    		};
    		cols.push (c);
    	};
    	me.reconfigure (null, cols);
	},
	selectRow: function (options) {
		let me = this;
		let viewFilter = me.getFilter ();
		let r = Ext.Ajax.request ({
			url: "?sessionId=" + $sessionId,
			params: $o.code + ".View.selectRows(" + me.viewId + ", null, [!" + Ext.encode ({viewFilter: viewFilter, selectFilter: options.filter}) + '!])',
			async: false
		});
		let rows = eval ("(" + r.responseText + ")").data;
		if (rows.length > 0) {
			me.store.getProxy ().extraParams = {
				start: Math.floor (rows [0] / me.store.pageSize) * me.store.pageSize,
				limit: me.store.pageSize
			};
			me.store.load (function () {
				me.getSelectionModel ().deselectAll ();
				me.getSelectionModel ().select (rows [0] % me.store.pageSize);
			});
		}
	},
	printOlap: function (format, coding) {
		let me = this;
		// reportUri
		let viewId = me.up ("grid").viewId;
		if (!viewId && me.up ("grid").classView) {
			viewId = $o.getClass (me.up ("grid").classView).get ("view");
		};
		let reportUri = "report?";			
		reportUri += "format=" + format + "&view=" + viewId + "&storage=" + $o.code;
		if (coding) {
			reportUri += "&coding=" + coding;
		}
		let grid = me.up ("grid");
		let tp = me.up ("tabpanel");
		let tabTitle;
		if (tp) {
			tabTitle = tp.getActiveTab ().title;
		};
		if (tabTitle || grid.title) {
			let name = "";
			if (tabTitle) {
				name += tabTitle;
			};
			if (grid.title) {
				if (name) {
					name += " - ";
				};
				name += grid.title;
			};
			reportUri += "&filename=" + name;
			if (format == "xmlss") {
				reportUri += ".xml";
			} else {
				reportUri += "." + format;
			}
		};
		let store = grid.getStore ();
		let filter = JSON.stringify (grid.getFilter ());
		let order;
		if (store.sorters.getCount ()) {
			order = '["' + store.sorters.getAt (0).property + '","' + store.sorters.getAt (0).direction + '"]';
		} else {
			order = 'null';
		};
		let cd = new Date ();
		reportUri += '&sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&time_offset_min=" + cd.getTimezoneOffset ();
		// cols
		let cols = me.up ("grid").query ("gridcolumn");
		let colsData = [];
		for (let i = 0; i < cols.length; i ++) {
			let f = cols [i].$field;
			if (f) {
				let o = {
					attrId: f.id,
					attr: f.name,
					header: f.header,
					code: f.id,
					hidden: cols [i].hidden ? 1 : 0,
					width: cols [i].width || 75
				};
	//			if (config [i].total) {
	//				o.total = config [i].total;
	//			}
				colsData.push (o);
			}
		}
		// submit
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + reportUri + "'>" +
			"<textarea style='display: none' name='cols'>" + JSON.stringify (colsData) + "</textarea>" +
			"<textarea style='display: none' name='filter'>" + filter + "</textarea>" +
			"<textarea style='display: none' name='total'>" + JSON.stringify (grid.total) + "</textarea>" +
			"<textarea style='display: none' name='order'>" + order + "</textarea>" +
			"<textarea style='display: none' name='options'>" + JSON.stringify ({dateAttrs: grid.dateAttrs}) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();		
	}
});
