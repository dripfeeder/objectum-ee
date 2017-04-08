Ext.define ("$o.LayoutCard.Widget", {
	extend: "$o.LayoutEditor",
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	alias: ["widget.$o.layoutcard", "widget.$layoutcard"],
	cmpCode: "card",
	initComponent: function () {
		var me = this;
		var id = me.layoutDesigner ? ("cmp-" + me.layoutDesigner.counter ++) : "card";
		me.value = me.value || {
			card: {
				id: id,
				items: []
			}
		};
		me.value.card.object = me.value.card.object || [];
		if (!Ext.isArray (me.value.card.object)) {
			me.value.card.object = [me.value.card.object];
		};
		var items = [{
			layout: "column",
			border: 0,
			width: "100%",
			items: [{
				columnWidth: 0.5,
				border: 0,
				items: [{
					xtype: "compositefield",
					width: 375,
					labelWidth: 100,
					fieldLabel: $o.getString ("Identifier"),
					style: "margin-top: 5px;",
					items: [{
						xtype: "textfield",
						name: "id",
						value: me.value.card.id,
						listeners: {
							change: function () {
								me.changeAttr ("id", this.getValue ());
							}
						}
					}, {
						xtype: "displayfield", value: $o.getString ("Read only") + ":", style: "margin-left: 5px;"
					}, {
						xtype: "checkbox",
						name: "readOnly",
						value: me.value.card.readOnly,
						listeners: {
							change: function () {
								me.changeAttr ("readOnly", this.getValue ());
							}
						}
					}]
				}, {
					xtype: "textfield",
					labelWidth: 100,
					width: 375,
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.card.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					labelWidth: 100,
					width: 375, 
					name: "iconCls",
					value: me.value.card.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}]
			}, {
				columnWidth: 0.5,
				border: 0,
				style: "margin-left: 5px",
				items: [{
					xtype: "grid",
					name: "tags",
					store: {
						xtype: "store",
						fields: ["clsName", "cls", "tag", "cmpAttrName", "cmpAttr"],
						data: []
					},
					columns: [{
						text: $o.getString ("Class of object"), dataIndex: "clsName", flex: 2
					}, {
						text: $o.getString ("Tag of object"), dataIndex: "tag", flex: 1
					}, {
						text: $o.getString ("Object by attribute of component"), dataIndex: "cmpAttrName", flex: 2
					}, {
						text: "cls", dataIndex: "cls", hidden: true
					}, {
						text: "cmpAttr", dataIndex: "cmpAttr", hidden: true
					}],
					tbar: [{
						text: $o.getString ("Add"),
						iconCls: "gi_circle_plus",
						handler: function () {
							var win = Ext.create ("Ext.Window", {
								title: $o.getString ("Tag", ":", "Adding"),
								width: 600,
								height: 400,
								layout: "vbox",
							    bodyPadding: 5,
								border: false,
								resizable: true,
								closable: true,
								style: "background-color: #ffffff",
								bodyStyle: "background-color: #ffffff",
								tbar: [{
									text: $o.getString ("Add"),
									iconCls: "gi_circle_plus",
									handler: function () {
										var store = me.down ("*[name=tags]").getStore ();
										var clsId = win.down ("*[name=cls]").getValue ();
										var tag = win.down ("*[name=tag]").getValue ();
										store.insert (store.getCount (), {
											cls: clsId,
											clsName: clsId ? $o.getClass (clsId).toString () : null,
											tag: tag,
											cmpAttr: win.down ("*[name=cmpAttr]").getValue ()
										});
										if (clsId) {
											me.value.card.object.push ({cls: $o.getClass (clsId).getFullCode (), tag: tag});
										} else {
											me.value.card.object.push ({tag: tag});
										};
										win.close ();
									}
								}],
								items: [{
									xtype: "$conffield", 
									fieldLabel: $o.getString ("Object class"),
									labelWidth: 200,
									name: "cls", 
									width: "100%",
									confRef: "class",
									choose: {
										type: "custom", fn: function () {
											var field = this;
											dialog.getClass ({success: function (options) {
												field.setValue (options.id);
											}});
										}
									}
								}, {
									xtype: "textfield",
									fieldLabel: $o.getString ("Tag of object"),
									labelWidth: 200,
									width: "100%",
									name: "tag"
								}, {
									xtype: "combo",
									fieldLabel: $o.getString ("Object by attribute of component"),
									name: "cmpAttr",
									anchor: "100%",
									labelWidth: 200,
									mode: "local",
									queryMode: "local",
									editable: false,
									store: new Ext.data.ArrayStore ({
										fields: ["id", "text"],
										data: me.layoutDesigner ? me.getViewCmpAttrs (JSON.parse (me.layoutDesigner.getValue ())) : []
									}),
									width: "100%",
									valueField: "id",
									displayField: "text"
								}]
							});
							win.show ();							
						}
					}, {
						text: $o.getString ("Remove"),
						iconCls: "gi_circle_minus",
						handler: function () {
							var grid = me.down ("*[name=tags]");
							if (grid.getSelectionModel ().hasSelection ()) {
								var rec = grid.getSelectionModel ().getSelection ()[0];
								for (var i = 0; i < me.value.card.object.length; i ++) {
									if (rec.get ("cls")) {
										var cls = $o.getClass (rec.get ("cls"));
										if (cls.getFullCode () == me.value.card.object [i].cls) {
											me.value.card.object.splice (i, 1);
											break;
										};
									};
									if (rec.get ("cmpAttr")) {
										if (rec.get ("cmpAttr") == me.value.card.object [i].cmpAttr) {
											me.value.card.object.splice (i, 1);
											break;
										};
									};
								};
								grid.getStore ().remove (rec);
							};
						}
					}],
					width: "100%",
					forceFit: true,
					height: 90,
					border: 1,
					selModel: Ext.create ("Ext.selection.RowModel", {
						mode: "SINGLE",
						listeners: {
							selectionchange: function (sm, records) {
								if (records.length) {
									var clsId = records [0].get ("cls");
									me.down ("*[name=cardDesigner]").setClassId (clsId, records [0].get ("tag"));
									me.down ("*[name=cardDesigner]").down ("*[name=tree]").getSelectionModel ().deselectAll ();
								};
							},
							scope: me
						}
					}),
					listeners: {
						afterrender: function () {
							if (me.value.card.object) {
								if (!Ext.isArray (me.value.card.object)) {
									me.value.card.object = [me.value.card.object];
								};
								for (var i = 0; i < me.value.card.object.length; i ++) {
									var cls = $o.getClass (me.value.card.object [i].cls);
									me.value.card.object [i].cls = cls.get ("id");
									me.value.card.object [i].clsName = cls.toString ();
								};
								this.getStore ().loadData (me.value.card.object);
							};
						}
					}
				}]
			}]
		}];
		items.push ({
			layout: "fit",
			title: $o.getString ("Card", ":", "Attributes"),
			name: "cardDesigner",
			width: "100%",
			border: 1,
			flex: 1,
			xtype: "$carddesigner",
			layoutCard: me,
			value: me.value.card.items
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: items
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.card.listeners,
					$events: ["aftersave", "afterrender", "beforerender"],
					listeners: {
						changeevent: function (value) {
							me.changeAttr ("listeners", value)
						}
					}
				}
			}, {
				layout: "fit",
				title: "Исходный код",
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		me.addEvents ("change");
		me.on ("beforesave", function (options) {
			if (!options.convertion) {
				me.value.card.items = me.down ("*[name=cardDesigner]").getValue ();
				for (var i = 0; i < me.value.card.object.length; i ++) {
					delete me.value.card.object [i].clsName;
					me.value.card.object [i].cls = $o.getClass (me.value.card.object [i].cls).getFullCode ();
				};
				me.down ("*[name=json]").setValue (JSON.stringify (me.value, null, "\t"));
			};
		});
		this.callParent (arguments);
	},
	validator: function () {
		var me = this.up ("panel");
		if (me.down ("*[name=cls]").getValue () && (me.down ("*[name=tag]").getValue () || me.down ("*[name=cmpAttr]").getValue ())) {
			me.up ("window").down ("button[name=ok]").enable ();
		} else {
			me.up ("window").down ("button[name=ok]").disable ();
		};
		return true;
	},
	getViewCmpAttrs: function (layout) {
		var me = this;
		try {
			if (typeof (layout) == "string") {
				layout = eval ("(" + layout + ")");
			};
		} catch (e) {
		};
		if (!layout) {
			return [];
		};
		var data = [];
		me.cmpAttrId = {};
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view) {
						v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							var va = v.attrs [attr];
							if (va.get ("classAttr")) {
								var ca = $o.getClassAttr (va.get ("classAttr"));
								if (!(ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000)) {
									continue;
								};
							};
							data.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
							me.cmpAttrId [layout [a].id + "." + attr] = va.get ("id");
						};
					};
					get (layout [a]);
				};
			};
		};
		get (layout);
		return data;
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.value.card.object = me.value.card.object || [];
		if (!Ext.isArray (me.value.card.object)) {
			me.value.card.object = [me.value.card.object];
		};
		me.down ("*[name=json]").setValue (JSON.stringify (value, null, "\t"));
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
