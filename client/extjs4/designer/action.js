Ext.define ("$o.ActionDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actiondesigner", "widget.$actiondesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: $o.getString ("Open"),
			iconCls: "gi_edit",
			handler: me.edit,
			scope: me
		}, {
			text: $o.getString ("Add"),
			iconCls: "gi_circle_plus",
			handler: me.create,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "action", type: "string"
			}, {
	        	name: "id", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Action"), width: 100, dataIndex: "action", renderer: me.cellRenderer
			}, {
				header: "id", width: 100, dataIndex: "id", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false,
			viewConfig: {
				plugins: {
					ptype: "gridviewdragdrop"
				},
				listeners: {
					drop: function (node, data, dropRec, dropPosition) {
						var list = [];
						for (var j = 0; j < me.store.getCount (); j ++) {
							for (var i = 0; i < me.value.length; i ++) {
								if (me.value [i].actionId == me.store.getAt (j).get ("id")) {
									list.push (me.value [i]);
									break;
								};
							};
						};
						me.value = list;
						me.fireEvent ("change", me.value);		
					}
				}
			}
		});
		me.items = me.grid;
		me.on ("afterrender", function () {
			if (me.value) {
				me.setValue (me.value);
			};
		});
		this.callParent (arguments);
	},
	create: function () {
		var me = this;
		dialog.getObject ({
			title: $o.getString ("Select", "actions"),
			width: 800,
			height: 600,
			layout: {
				split: {
					orientation: "horizontal",
					width: 300,
					items: [{
						treegrid: {
							id: "olapClasses",
							title: $o.getString ("Classes"),
							view: "system.classes",
						    fields: {
						        id: "id",
						        parent: "parent_id"
						    },
						    filter: ["id", ">=", 1000]
						}
					}, {
						olap: {
							id: "olap",
							title: $o.getString ("Actions"),
							view: "system.actions",
							singleSelect: false,
							filter: ["class_id", "=", {id: "olapClasses", attr: "id"}]
						}
					}]
				}
			},
			attr: "olap.id",
			success: function (options) {
				var values = options.values;
				for (var i = 0; i < values.length; i ++) {
					var a = $o.getAction (values [i]);
					var cls = $o.getClass (a.get ("class"));
					var fn = cls.getFullCode () + "." + a.get ("code");
					var o = {
						actionId: a.get ("id"),
						fn: fn,
						text: a.get ("name")
					};
					if (a.get ("layout")) {
						var l = JSON.parse (a.get ("layout"));
						if (l ["type"] == "create") {
							o.iconCls = "gi_circle_plus";
						};
						if (l ["type"] == "remove") {
							o.iconCls = "gi_circle_minus";
							o.active = "common.recordSelected";
						};
						if (l ["type"] == "card") {
							o.iconCls = "gi_edit";
							o.active = "common.recordSelected";
						};
					};
					me.value = me.value || [];
					me.value.push (o);
				};
				me.build ();
				me.fireEvent ("change", me.value);		
			}
		});
	},
	edit: function () {
		var me = this;
		var v, i;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			var actionId = rec.get ("id");
			for (i = 0; i < me.value.length; i ++) {
				if (me.value [i].actionId == actionId || me.value [i].fn == actionId) {
					v = me.value [i];
					break;
				};
			};
		} else {
			return;
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 600,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Action"),
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: "$actioncard",
				value: v,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value [i] = value;
						me.build ();
						if (value.actionId) {
							var a = $o.getAction (value.actionId);
							a.initAction ();
						};
						me.fireEvent ("change", me.value);		
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
			var actionId = rec.get ("id");
			for (var i = 0; i < me.value.length; i ++) {
				if (me.value [i].actionId == actionId || me.value [i].fn == actionId) {
					me.value.splice (i, 1);
					break;
				};
			};
			me.build ();
			me.fireEvent ("change", me.value);
		};
	},
	build: function () {
		var me = this;
		var data = [];
		for (var i = 0; i < me.value.length; i ++) {
			if (me.value [i].actionId) {
				var action = $o.getAction (me.value [i].actionId);
				data.push ({
					action: action.toString (),
					id: me.value [i].actionId
				});
			} else {
				data.push ({
					action: me.value [i].text,
					id: me.value [i].fn
				});
			};
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
