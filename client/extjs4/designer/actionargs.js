Ext.define ("$o.ActionArgs.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actionargs", "widget.$actionargs"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
		me.tbar = [{
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
	    	autoSync: true,
	        data: me.getData (),
	        fields: [{
	        	name: "arg", type: "string"
			}, {
	        	name: "value", type: "string"
	        }],
	        listeners: {
	        	datachanged: me.datachanged,
	        	scope: me
	        }
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Option"), width: 150, dataIndex: "arg", renderer: me.cellRenderer, editor: {
		            xtype: "textfield"
		        }
			}, {
				header: $o.getString ("Value"), flex: 1, dataIndex: "value", renderer: me.cellRenderer, editor: {
		            xtype: "textfield"
		        }
			}],
			plugins: [Ext.create ("Ext.grid.plugin.CellEditing", {
		        clicksToEdit: 1
		    })],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		this.callParent (arguments);
	},
	getData: function () {
		var me = this;
		var data = [];
		for (var arg in me.value) {
			data.push ({
				arg: arg, value: me.value [arg]
			});
		};
		return data;
	},
    cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
    	var me = this;
    	var field = metaData.column.dataIndex;
		metaData.tdAttr += ' style=";border: 1px gray solid;"';
		return value;
    },
	datachanged: function () {
		var me = this;
		if (me.store) {
			var v = {};
			for (var i = 0; i < me.store.getCount (); i ++) {
				var rec = me.store.getAt (i);
				if (rec.get ("arg") && rec.get ("value")) {
					v [rec.get ("arg")] = rec.get ("value");
				};
			};
			me.value = v;
			me.fireEvent ("change", me.value);
		};
	},
	create: function () {
		var me = this;
		me.store.insert (me.store.getCount (), {});
	},
	remove: function () {
		var me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			var rec = me.grid.getSelectionModel ().getSelection ()[0];
			me.store.remove (rec);
			var arg = rec.get ("arg");
			delete me.value [arg];
		};
	}
});
