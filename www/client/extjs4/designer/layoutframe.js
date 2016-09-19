Ext.define ("$o.LayoutFrame.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutframe", "widget.$layoutframe"],
	cmpCode: "frame",
	border: 0,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			frame: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: me.getOtherAttrs ()
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
					value: me.value.frame.id,
					validator: me.validator,
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
					value: me.value.frame.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.frame.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: $o.getString ("Reference") + " (URL)",
					name: "url",
					value: me.value.frame.url,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("url", this.getValue ());
							me.down ("*[name=attr]").setValue (null);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Component attribute"),
					name: "attr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.store,
					value: me.value.frame.attr,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attr", this.getValue ());
							me.down ("*[name=url]").setValue (null);
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
	getOtherAttrs: function () {
		var me = this;
		var r = [];
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view && layout [a].id != me.$cmpId) {
						var v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							var va = v.attrs [attr];
							if ((a == "olap" || a == "treegrid") && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 1) {
								r.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
							};
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=id]").getValue () && (me.down ("*[name=url]").getValue () || me.down ("*[name=attr]").getValue ())) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});
