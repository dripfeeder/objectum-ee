Ext.define ("$o.ActionCard.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actioncard", "widget.$actioncard"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 1,
	initComponent: function () {
		let me = this;
		me.value = me.value || {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: me.save,
			name: "save",
			disabled: 1,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			},
			name: "cancel"
		}];
		me.items = [{
			xtype: "$conffield", 
			fieldLabel: $o.getString ("Action"),
			name: "action", 
			width: "100%",
			confRef: "action",
			style: "margin-top: 5px",
			choose: {
				type: "layout", attr: "olap.id", width: 600, height: 400, layout: {
					split: {
						orientation: "horizontal",
						width: 300,
						items: [{
							treegrid: {
								id: "olapClasses",
								view: "system.classes",
							    fields: {
							        id: "id",
							        parent: "parent_id"
							    },
							    filter: {
							        fn: function () {return ["id", ">=", 1000]}
							    }
							}
						}, {
							olap: {
								id: "olap",
								view: "system.actions",
								filter: ["class_id", "=", {id: "olapClasses", attr: "id"}]
							}
						}]
					}
				}
			},
			listeners: {
				change: function () {
					if (this.getValue ()) {
						let a = $o.getAction (this.getValue ());
						let cls = $o.getClass (a.get ("class"));
						/*
						let fn = cls.getFullCode () + "." + a.get ("code");
						try {
							fn = eval (fn);
						} catch (e) {
							fn = null;
						};
						if (!fn) {
							this.setValue (null);
							common.message ("Для выбора данного действия необходима сборка проекта и перезагрузка страницы веб-обозревателя.");
							return;
						};
						*/
//						me.down ("*[name=class]").setValue (cls.toString ());
						me.down ("*[name=name]").setValue (a.get ("name"));
						if (a.get ("layout")) {
							let l = JSON.parse (a.get ("layout"));
							if (l ["type"] == "create") {
								me.down ("*[name=iconCls]").setValue ("gi_circle_plus");
							};
							if (l ["type"] == "remove") {
								me.down ("*[name=iconCls]").setValue ("gi_circle_minus");
								me.down ("*[name=activeRecordSelected]").setValue (1);
							};
							if (l ["type"] == "card") {
								me.down ("*[name=iconCls]").setValue ("gi_edit");
								me.down ("*[name=activeRecordSelected]").setValue (1);
							};
						};
//					} else {
//						me.down ("*[name=class]").setValue ("");
					};
					me.validator ();
				}
			}
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: $o.getString ("Function"),
			name: "fn",
			value: me.value.actionId ? "" : me.value.fn,
			validator: me.validator
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: $o.getString ("Name"),
			name: "name",
			value: me.value.text
		}, {
			xtype: "$iconselector",
			width: "100%", 
			name: "iconCls",
			value: me.value.iconCls
		}, {
			xtype: "checkbox",
			name: "activeRecordSelected",
			fieldLabel: $o.getString ("Active when record selected"),
			checked: me.value.active == "common.recordSelected"
		}, {
			title: $o.getString ("Options"),
			width: "100%",
			flex: 1,
			xtype: "$actionargs",
			value: me.value.arguments,
			listeners: {
				change: function (value) {
					me.value.arguments = value;
				}
			}
		}];
		me.on ("afterrender", function () {
			me.down ("*[name=action]").setValue (me.value.actionId);
		});
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function () {
		let panel = this.up ("panel");
		if (panel.down ("*[name=action]").getValue () || panel.down ("*[name=fn]").getValue ()) {
			panel.down ("*[name=save]").enable ();
		} else {
			panel.down ("*[name=save]").disable ();
		};
		return true;
	},
	save: function () {
		let me = this;
		let actionId = me.down ("*[name=action]").getValue ();
		let fn;
		let v = me.value;
		if (actionId) {
			v.actionId = actionId;
			let action = $o.getAction (actionId);
			let cls = $o.getClass (action.get ("class"));
			fn = cls.getFullCode () + "." + action.get ("code"); 
		} else {
			fn = me.down ("*[name=fn]").getValue ();
		};
		v.fn = fn;
		if (me.down ("*[name=name]").getValue ()) {
			v.text = me.down ("*[name=name]").getValue ();
		};
		if (me.down ("*[name=iconCls]").getValue ()) {
			v.iconCls = me.down ("*[name=iconCls]").getValue ();
		};
		if (me.down ("*[name=activeRecordSelected]").getValue ()) {
			v.active = "common.recordSelected";
		};
		me.fireEvent ("aftersave", v);
	}
});


