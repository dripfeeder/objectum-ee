Ext.define ("$o.EventCard.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.eventcard", "widget.$eventcard"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: me.save,
			name: "save",
			disabled: 1,
			scope: me
		}, {
			text: "Отмена",
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			},
			name: "cancel"
		}];
		var action = $o.getAction (me.value.fn);
		var data = [];
		for (var i = 0; i < me.$events.length; i ++) {
			data.push ([me.$events [i], me.$events [i]]);
		};
		me.items = [{
			xtype: "combo",
			name: "event",
			fieldLabel: "Событие",
			width: "100%",
			triggerAction: "all",
			lazyRender: true,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: data
			}),
			value: me.value.event,
			validator: me.validator,
			style: "margin-top: 5px",
			valueField: "id",
			displayField: "text"
		}, {
			xtype: "$conffield", 
			fieldLabel: "Действие",
			name: "action", 
			width: "100%",
			confRef: "action",
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
						var a = $o.getAction (this.getValue ());
						var cls = $o.getClass (a.get ("class"));
						/*
						var fn = cls.getFullCode () + "." + a.get ("code");
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
					};
					me.validator ();
				}
			}
		}, {
			xtype: "textfield",
			width: "100%",
			fieldLabel: "Функция",
			name: "fn",
			value: action ? "" : me.value.fn,
			validator: me.validator
		}, {
			title: "Параметры",
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
			if (action) {
				me.down ("*[name=action]").setValue (action.get ("id"));
			};
		});
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function () {
		var panel = this.up ("panel");
		if (panel.down ("*[name=event]").getValue () && (
			panel.down ("*[name=action]").getValue () || panel.down ("*[name=fn]").getValue ()
		)) {
			panel.down ("*[name=save]").enable ();
		} else {
			panel.down ("*[name=save]").disable ();
		};
		return true;
	},
	save: function () {
		var me = this;
		var fn;
		var actionId = me.down ("*[name=action]").getValue ();
		if (actionId) {
			var action = $o.getAction (actionId);
			var cls = $o.getClass (action.get ("class"));
			fn = cls.getFullCode () + "." + action.get ("code"); 
		} else {
			fn = me.down ("*[name=fn]").getValue ();
		};
		var v = me.value;
		v.fn = fn;
		v.event = me.down ("*[name=event]").getValue ();
		me.fireEvent ("aftersave", v);
	}
});


