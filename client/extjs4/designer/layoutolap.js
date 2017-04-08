Ext.define ("$o.LayoutOlap.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutolap", "widget.$layoutolap"],
	cmpCode: "olap",
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			olap: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		var filterAction = null;
		if (me.value.olap.filter && typeof (me.value.olap.filter) == "string") {
			filterAction = $o.getAction (me.value.olap.filter).get ("id");
		};
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
					labelWidth: 150,
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.olap.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					labelWidth: 150,
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.olap.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					labelWidth: 150,
					width: "100%", 
					name: "iconCls",
					value: me.value.olap.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					labelWidth: 150,
					name: "view", 
					value: me.value.olap.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							var objectfield = this;
							dialog.getView ({hasQuery: 1, success: function (options) {
								objectfield.setValue (options.id);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator ();
						},
						change: function () {
							me.validator ();
							var viewCode = this.getValue () ? $o.getView (this.getValue ()).getFullCode () : undefined;
							me.changeAttr ("view", viewCode)
							//me.down ("*[name=filter]").setValue ([]);
							me.down ("*[name=filter]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
							me.down ("*[name=total]").setViewId (viewCode ? $o.getView (viewCode).get ("id") : null);
						}
					}
				}, {
					xtype: "checkbox",
					width: "100%", 
					name: "wordWrap",
					labelWidth: 150,
					fieldLabel: $o.getString ("Word wrap"),
					checked: me.value.olap.wordWrap,
					listeners: {
						change: function () {
							me.changeAttr ("wordWrap", this.getValue ())
						}
					}
				}, {
					xtype: "checkbox",
					width: "100%", 
					name: "groupedColumns",
					labelWidth: 150,
					fieldLabel: $o.getString ("Grouped header"),
					checked: me.value.olap.groupedColumns,
					listeners: {
						change: function () {
							me.changeAttr ("groupedColumns", this.getValue ())
						}
					}
				}, {
					fieldLabel: $o.getString ("Filter from action"),
					xtype: "$conffield", 
					labelWidth: 150,
					name: "filterAction", 
					value: filterAction,
					width: "100%",
					confRef: "action",
					choose: {
						type: "custom", fn: function () {
							var f = this;
							dialog.getAction ({success: function (options) {
								f.setValue (options.id);
							}});
						}

					},
					listeners: {
						change: function (value) {
							if (value) {
								value = $o.getAction (value).getFullCode ();
								me.down ("*[name=filter]").setValue (null);
								me.down ("*[name=filter]").disable ();
							} else {
								me.down ("*[name=filter]").enable ();
							};
							me.changeAttr ("filter", value);
						}
					}
				}, {
					layout: "hbox",
					width: "100%",
					border: 0,
					flex: 1,
					items: [{
						layout: "fit",
						width: "30%",
						height: "100%",
						title: $o.getString ("Menu"),
						iconCls: "gi_list",
						bodyPadding: 2,
						items: {
							xtype: "$actiondesigner",
							name: "actions",
							value: me.value.olap.actions,
							listeners: {
								change: function (value) {
									me.changeAttr ("actions", value)
								}
							}
						}
					}, {
						layout: "fit",
						width: "40%",
						height: "100%",
						title: $o.getString ("Filter"),
						iconCls: "gi_filter",
						bodyPadding: 2,
						style: "margin-left: 1px",
						items: {
							xtype: "$layoutfilter",
							name: "filter",
							layoutDesigner: me.layoutDesigner,
							disabled: filterAction ? true : false,
							value: filterAction ? null : me.value.olap.filter,
							$cmpId: me.value.olap.id,
							$viewId: me.value.olap.view,
							listeners: {
								change: function (value) {
									me.changeAttr ("filter", value);
									me.validator.call (this);
								}
							}
						}
					}, {
						layout: "fit",
						width: "30%",
						height: "100%",
						title: $o.getString ("Totals"),
						iconCls: "gi_calculator",
						bodyPadding: 2,
						style: "margin-left: 1px",
						items: {
							xtype: "$layouttotal",
							name: "total",
							layoutDesigner: me.layoutDesigner,
							value: me.value.olap.total,
							viewId: me.value.olap.view ? $o.getView (me.value.olap.view).get ("id") : null,
							listeners: {
								change: function (value) {
									me.changeAttr ("total", value)
								}
							}
						}
					}]
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.olap.listeners,
					$events: ["afterrender", "dblclick", "cellRenderer"],
					listeners: {
						changeevent: function (value) {
							me.changeAttr ("listeners", value)
						}
					}
				}
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
	validator: function () {
		var me = this;
		var of = me.down ("*[name='view']");
		if (of.getValue ()) {
			if (!$o.getView (of.getValue ()).get ("query")) {
				common.message ($o.getString ("Selected view does not contain a query"));
				me.down ("button[name='ok']").disable ();
			} else {
				me.down ("button[name='ok']").enable ();
			};
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});
