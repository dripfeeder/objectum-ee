Ext.define ("$o.LayoutChart.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutchart", "widget.$layoutchart"],
	cmpCode: "chart",
	border: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			chart: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.storeMark = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.storeValue = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: $o.getString ("Commons"),
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.chart.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.chart.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.chart.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					name: "view", 
					value: me.value.chart.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							var me = this;
							system.view.selectQuery ({success: function (options) {
								me.setValue (options.value);
								me.fireEvent ("change", options.value);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator ();
						},
						change: function () {
							me.validator.call (this);
							var viewCode = this.getValue () ? $o.getView (this.getValue ()).getFullCode () : undefined;
							me.changeAttr ("view", viewCode)
							me.down ("*[name=filter]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
							me.updateStores (this.getValue ());
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Mark", ":", "Attribute"),
					name: "attrMark",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.storeMark,
					value: me.value.chart.attrMark,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attrMark", this.getValue ());
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Value", ":", "Attribute"),
					name: "attrValue",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.storeValue,
					value: me.value.chart.attrValue,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attrValue", this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Title of marks"),
					width: "100%",
					name: "titleMark",
					validator: me.validator,
					value: me.value.chart.titleMark,
					listeners: {
						change: function () {
							me.changeAttr ("titleMark", this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Title of values"),
					width: "100%",
					name: "titleValue",
					validator: me.validator,
					value: me.value.chart.titleValue,
					listeners: {
						change: function () {
							me.changeAttr ("titleValue", this.getValue ());
						}
					}
				}, {
					layout: "fit",
					width: "100%",
					flex: 1,
					title: $o.getString ("Filter"),
					iconCls: "gi_filter",
					bodyPadding: 2,
					items: {
						xtype: "$layoutfilter",
						name: "filter",
						layoutDesigner: me.layoutDesigner,
						value: me.value.chart.filter,
						$cmpId: me.value.chart.id,
						$viewId: me.value.chart.view,
						listeners: {
							change: function (value) {
								me.changeAttr ("filter", value);
								me.validator.call (this);
							}
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
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
		this.callParent (arguments);
	},
	updateStores: function (viewId) {
		var me = this;
		me.down ("*[name=attrMark]").setValue (null);
		me.down ("*[name=attrValue]").setValue (null);
		var data = [];
		if (viewId) {
			var view = $o.getView (viewId);
			for (var attr in view.attrs) {
				data.push ([attr, view.attrs [attr].toString ()]);
			};
		};
		me.storeMark.loadData (data);
		data = [];
		if (viewId) {
			var view = $o.getView (viewId);
			for (var attr in view.attrs) {
				var va = view.attrs [attr];
				if (!va.get ("classAttr") || $o.getClassAttr (va.get ("classAttr")).get ("type") == 2) {
					data.push ([attr, va.toString ()]);
				};
			};
		};
		me.storeValue.loadData (data);
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=view]").getValue () && me.down ("*[name=attrMark]").getValue () && me.down ("*[name=attrValue]").getValue ()) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});
