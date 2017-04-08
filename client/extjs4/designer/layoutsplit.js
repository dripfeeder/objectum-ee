Ext.define ("$o.LayoutSplit.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutsplit"],
	cmpCode: "split",
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			split: {
				id: "cmp-" + (me.layoutDesigner.counter ++),
				orientation: "horizontal",
				width: "50%",
				items: [
					me.layoutDesigner.createEmpty (), me.layoutDesigner.createEmpty ()
				]
			}
		};
		var w = me.value.split.width || me.value.split.height;
		var ed;
		if (typeof (w) == "string") {
			ed = "%";
			w = w.substr (0, w.length - 1);
		} else {
			ed = "px";
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
					fieldLabel: $o.getString ("Identifier"),
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.split.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Title"),
					name: "title",
					value: me.value.split.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.split.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Orientation"),
					name: "orientation",
					width: "100%",
					triggerAction: "all",
					lazyRender: true,
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: [
							["horizontal", $o.getString ("Horizontal")],
							["vertical", $o.getString ("Vertical")]
						]
					}),
					valueField: "id",
					displayField: "text",
					style: "margin-top: 5px;",
					value: me.value.split.orientation,
					listeners: {
						select: function () {
							me.changeAttr ("orientation", this.getValue ());
						}
					}
				}, {
					xtype: "compositefield",
					fieldLabel: $o.getString ("Width (height) of left (top) component"),
					items: [{
						xtype: "numberfield",
						name: "width",
						value: w,
						width: 100,
						validator: function (value) {
							if (this.getValue ()) {
								me.down ("button[name='ok']").enable ();
							} else {
								me.down ("button[name='ok']").disable ();
							};
							if (me.down ("*[name=ed]").getValue () == "%") {
								me.changeAttr ("width", this.getValue () + "%");
							} else {
								me.changeAttr ("width", Number (this.getValue ()));
							};
							return true;
						}
					}, {
						xtype: "combo",
						name: "ed",
						width: 50,
						triggerAction: "all",
						lazyRender: true,
						mode: "local",
						queryMode: "local",
						editable: false,
						store: new Ext.data.ArrayStore ({
							fields: ["id", "text"],
							data: [
								["%", "%"],
								["px", "px"]
							]
						}),
						valueField: "id",
						displayField: "text",
						style: "margin-left: 2px;",
						value: ed,
						listeners: {
							select: function () {
								if (this.getValue () == "%") {
									if (me.down ("*[name=width]").getValue () > 90) {
										me.down ("*[name=width]").setValue (90)
									};
									me.changeAttr ("width", me.down ("*[name=width]").getValue () + "%");
								} else {
									me.changeAttr ("width", Number (me.down ("*[name=width]").getValue ()));
								};
							}
						}
					}]
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
	}
});
