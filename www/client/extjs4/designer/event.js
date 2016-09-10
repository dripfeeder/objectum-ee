Ext.define ("$o.EventDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.eventdesigner", "widget.$eventdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: "Открыть",
			iconCls: "gi_edit",
			handler: me.edit,
			scope: me
		}, {
			text: "Добавить",
			iconCls: "gi_circle_plus",
			handler: me.create,
			scope: me
		}, {
			text: "Удалить",
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "event", type: "string"
			}, {
	        	name: "action", type: "string"
			}, {
	        	name: "fn", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: "Событие", flex: 1, dataIndex: "event", renderer: me.cellRenderer
			}, {
				header: "Действие", flex: 2, dataIndex: "action", renderer: me.cellRenderer
			}, {
				header: "fn", width: 100, dataIndex: "fn", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.on ("afterrender", function () {
			me.setValue (me.value);
		});
		me.addEvents ("changeevent");
		this.callParent (arguments);
	},
	create: function () {
		var me = this;
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: "Событие",
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$eventcard",
				$events: me.$events,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [value.event] = value;
						delete value.event;
						me.build ();
						me.fireEvent ("changeevent", me.value);		
					}
				}
			}
		});
		win.show ();
	},
	edit: function () {
		var me = this;
		var v;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			v = me.value [rec.get ("event")];
			v.event = rec.get ("event");
		} else {
			return;
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: "Событие",
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$eventcard",
				value: v,
				$events: me.$events,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [value.event] = value;
						delete value.event;
						me.build ();
						me.fireEvent ("changeevent", me.value);
					}
				}
			}
		});
		win.show ();
	},
	remove: function () {
		var me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			delete me.value [rec.get ("event")];
			me.build ();
			me.fireEvent ("changeevent", me.value);
		};
	},
	build: function () {
		var me = this;
		var data = [];
		for (var event in me.value) {
			var action = $o.getAction (me.value [event].fn);
			data.push ({
				event: event,
				action: action ? action.toString () : me.value [event].fn,
				fn: me.value [event].fn
			});
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		value = value || {};
		for (var event in value) {
			if (typeof (value [event]) == "string") {
				value [event] = {
					fn: value [event]
				};
			};
		};
		me.value = value;
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
