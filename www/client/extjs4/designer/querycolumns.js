Ext.define ("$o.QueryColumns.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querycolumns", "widget.$querycolumns"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.$view = $o.getView (me.viewId);
		if (me.updateAttrs ()) {
			me.items = {
				/*
				anchor: "100% 100%",
				border: 0,
				layout: "fit",
				items: [{
					*/
					xtype: "$o.layout",
					border: 1,
					$layout: {
						split: {
							orientation: "vertical",
							height: 100,
							items: [{
								layout: "fit",
								xtype: "$o.layout",
								$layout: {
									olap: {
										id: "olap",
										view: me.$view.getFullCode (),
										hideBottomToolbar: 1,
										groupedColumns: true,
										listeners: {
											columnresize: me.onColumnResize,
											columnmove: me.onColumnMove,
											columnhide: me.onColumnHide,
											columnshow: me.onColumnShow,
											scope: me
										}
									}
								},
								listeners: {
									afterrender: function () {
										me.olapContainer = this;
									}
								}
							}, {
								split: {
									title: "Столбцы",
									iconCls: "gi_file",
									orientation: "vertical",
									height: 185,
									pages: [{
										olap: {
											id: "olapAttrs",
											view: "system.viewAttrs",
											filter: ["view_id", "=", me.viewId],
											listeners: {
												afterrender: function () {
													me.olapAttrs = this;
												}
											}
										}
									}, {
										cardConf: {
											id: "attrCard",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.name", fieldLabel: "Наименование"
											}, {
												conf: "viewAttr", id: "olapAttrs", attr: "id.code", fieldLabel: "Код", allowBlank: false, maskRe: /[A-Za-z0-9\_]/
											}, {
												xtype: "compositefield", fieldLabel: "Видимый",
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.area", xtype: "checkbox", width: 100
												}]
											}, {
												xtype: "compositefield", fieldLabel: "№ пп",
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.order", xtype: "numberfield", width: 100
												}]
											}, {
												xtype: "compositefield", fieldLabel: "Ширина",
												items: [{
													conf: "viewAttr", id: "olapAttrs", attr: "id.width", xtype: "numberfield", width: 100
												}]
											}],
											active: {
												fn: function () {
													return !me.schemaId;
												}
											},
											listeners: {
												afterSave: function () {
													me.olapContainer.removeAll ();
													me.olapContainer.add ({
														layout: "fit",
														xtype: "$o.layout",
														$layout: {
															olap: {
																id: "olap",
																view: me.$view.getFullCode (),
																hideBottomToolbar: 1,
																groupedColumns: true,
																listeners: {
																	columnresize: me.onColumnResize,
																	columnmove: me.onColumnMove,
																	columnhide: me.onColumnHide,
																	columnshow: me.onColumnShow
																}
															}
														}
													});
													me.olapContainer.updateLayout ();
												}
											}
										}
									}]
								}
							}]
						}
					}
				//}]
			};
			me.dockedItems = {
				dock: "top",
				height: 60,
				layout: "vbox",
				border: 0,
				bodyPadding: 5,
				defaults: {
					width: "100%"
				},
				items: [{
					xtype: "label",
					text: "- Чтобы скрыть/отобразить столбец используйте контекстное меню любого столбца."
				}, {
					xtype: "label",
					text: "- Перетащите столбец мышью для изменения его местоположения."
				}, {
					xtype: "label",
					text: "- Ширина столбцов настраивается в заголовке таблицы на границах столбцов."
				}]
			};
		};
		this.callParent (arguments);
	},
	getClassAndClassAttr: function (viewAttrCode, query) {
		var me = this;
		var classes = {}, alias;
		for (alias in query.from [0]) {break;};
		classes [alias] = $o.getClass (query.from [0][alias]);
		for (var i = 1; i < query.from.length; i += 4) {
			for (alias in query.from [i + 1]) {break;};
			classes [alias] = $o.getClass (query.from [i + 1][alias]);
		};
		for (var i = 1; i < query.select.length; i += 2) {
			if (query.select [i] == viewAttrCode) {
				for (alias in query.select [i - 1]) {break;};
				var caCode = query.select [i - 1][alias];
				return [classes [alias], classes [alias].attrs [caCode]];
			};
		};
	},
	updateAttrs: function () {
		var me = this;
		var query, attrs = [];
		try {
			query = JSON.parse (me.$view.get ("query"));
			// query attrs -> view attrs
			var npp = 1;
			for (var attr in me.$view.attrs) {
				if (me.$view.attrs [attr].order && me.$view.attrs [attr].order >= npp) {
					npp = me.$view.attrs [attr].order + 1;
				};
			};
			for (var i = 1; i < query.select.length; i += 2) {
				var attr = query.select [i];
				attrs.push (attr);
				if (!me.$view.attrs [attr]) {
					var cca = me.getClassAndClassAttr (attr, query);
					var name = cca [1] ? cca [1].get ("name") : attr;
					if (attr == "a_id" || (attr [0] == "c" && attr.substr (attr.length - 3, 3) == "_id")) {
						name = "id";
					};
					var va = $o.createViewAttr ({
			    		name: name,
			    		code: attr,
			    		view: me.viewId,
			    		area: 1,
			    		width: 75,
			    		"class": cca [0].get ("id"),
			    		order: npp ++,
			    		classAttr: cca [1] ? cca [1].get ("id") : null
					});
					va.sync ();
				};
			};
			// remove view attrs
			for (var attr in me.$view.attrs) {
				if (attrs.indexOf (attr) == -1) {
					var va = me.$view.attrs [attr];
					va.remove ();
					va.sync ();
				};
			};
			return 1;
		} catch (e) {
			me.items = {
				layout: {
					type: "vbox",
					align: "center",
					pack: "center"
				}, 
				items: [{
					xtype: "label",
					text: "Извините, не удалось декодировать исходный код запроса"
				}]
			};
		};
	},
	onColumnResize: function (ct, column, width) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("width", width);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnMove: function (ct, column, fromIdx, toIdx) {
		var me = this;
		var cols = ct.getGridColumns ();
		for (var i = 0; i < cols.length; i ++) {
			if (!cols [i].$field) {
				continue;
			};
			var va = $o.getViewAttr (cols [i].$field.id);
			if (va.get ("order") != i + 1) {
				va.set ("order", i + 1);
				va.sync ();
			};
		};
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnHide: function (ct, column) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("area", 0);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	},
	onColumnShow: function (ct, column) {
		if (!column.$field) {
			return;
		};
		var vaId = column.$field.id;
		var va = $o.getViewAttr (vaId);
		va.set ("area", 1);
		va.sync ();
		if (this.olapAttrs) {
			this.olapAttrs.refresh ();
		};
	}
});
