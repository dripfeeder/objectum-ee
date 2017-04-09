Ext.define ("$o.ActionArgs.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.actionargs", "widget.$actionargs"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
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
		let me = this;
		let data = [];
		for (let arg in me.value) {
			data.push ({
				arg: arg, value: me.value [arg]
			});
		};
		return data;
	},
    cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
    	let me = this;
    	let field = metaData.column.dataIndex;
		metaData.tdAttr += ' style=";border: 1px gray solid;"';
		return value;
    },
	datachanged: function () {
		let me = this;
		if (me.store) {
			let v = {};
			for (let i = 0; i < me.store.getCount (); i ++) {
				let rec = me.store.getAt (i);
				if (rec.get ("arg") && rec.get ("value")) {
					v [rec.get ("arg")] = rec.get ("value");
				};
			};
			me.value = v;
			me.fireEvent ("change", me.value);
		};
	},
	create: function () {
		let me = this;
		me.store.insert (me.store.getCount (), {});
	},
	remove: function () {
		let me = this;
		if (me.grid.getSelectionModel ().hasSelection ()) {
			let rec = me.grid.getSelectionModel ().getSelection ()[0];
			me.store.remove (rec);
			let arg = rec.get ("arg");
			delete me.value [arg];
		};
	}
});
