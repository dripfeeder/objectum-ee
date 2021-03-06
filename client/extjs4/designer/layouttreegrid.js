Ext.define ("$o.LayoutTreegrid.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layouttreegrid", "widget.$layouttreegrid"],
	cmpCode: "treegrid",
	initComponent: function () {
		let me = this;
		me.value = me.value || {
			treegrid: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		let dataAttrs = me.getData ();
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
					value: me.value.treegrid.id,
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
					value: me.value.treegrid.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					},
					validator: me.validator
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.treegrid.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "$conffield", 
					fieldLabel: $o.getString ("Query"),
					name: "view", 
					value: me.value.treegrid.view, 
					width: "100%",
					confRef: "view",
					choose: {
						type: "custom", fn: function () {
							let field = this;
							dialog.getView ({hasQuery: 1, success: function (options) {
								field.setValue (options.id);
								me.changeAttr ("view", options.id ? $o.getView (options.id).getFullCode () : undefined)
								let data = me.getData ();
								me.down ("*[name='idAttr']").getStore ().loadData (data);
								me.down ("*[name='idAttr']").setValue (null);
								me.down ("*[name='parent']").getStore ().loadData (data);
								me.down ("*[name='parent']").setValue (null);
								me.validator.call (field);
							}});
						}
					},
					listeners: {
						afterrender: function () {
							me.validator.call (this);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Node identifier"),
					name: "idAttr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: dataAttrs
					}),
					valueField: "id",
					displayField: "text",
					value: me.value.treegrid.fields ? me.value.treegrid.fields.id : null,
					validator: me.validator
				}, {
					xtype: "combo",
					fieldLabel: $o.getString ("Parent node identifier"),
					name: "parent",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
						data: dataAttrs
					}),
					valueField: "id",
					displayField: "text",
					value: me.value.treegrid.fields ? me.value.treegrid.fields.parent : null,
					validator: me.validator
				}, {
					layout: "fit",
					width: "100%",
					flex: 1,
					title: $o.getString ("Menu"),
					iconCls: "gi_list",
					bodyPadding: 2,
					items: {
						xtype: "$actiondesigner",
						name: "actions",
						value: me.value.treegrid.actions,
						listeners: {
							change: function (value) {
								me.changeAttr ("actions", value)
							}
						}
					}
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Events"),
				iconCls: "gi_wifi_alt",
				border: 0,
				items: {
					xtype: "$eventdesigner",
					name: "events",
					value: me.value.treegrid.listeners,
					$events: ["dblclick"],
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
	getData: function () {
		let me = this;
		let r = [];
		if (me.value.treegrid.view) {
			let v = $o.getView (me.value.treegrid.view);
			for (let attr in v.attrs) {
				let va = v.attrs [attr];
				if (va.get ("classAttr")) {
					let ca = $o.getClassAttr (va.get ("classAttr"));
					if (!(ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000)) {
						continue;
					};
				};
				r.push ([attr, va.toString ()]);
			};
		};
		return r;
	},
	validator: function () {
		let me = this.up ("panel[cmpCode='treegrid']");
		let of = me.down ("*[name='view']");
		let idField = me.down ("*[name='idAttr']");
		let parentField = me.down ("*[name='parent']");
		if (!idField.getValue () || !parentField.getValue () || idField.getValue () == parentField.getValue ()) {
			me.down ("button[name='ok']").disable ();
			return true;
		};
		if (idField.getValue () && parentField.getValue ()) {
			me.changeAttr ("fields", {
				id: idField.getValue (),
				parent: parentField.getValue ()
			})
		};
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
