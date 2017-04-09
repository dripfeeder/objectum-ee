Ext.define ("$o.LayoutTotal.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layouttotal", "widget.$layouttotal"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
		me.value = me.value || {};
    	me.tbar = [{
    		text: $o.getString ("Clear"),
    		name: "delete",
    		iconCls: "gi_circle_minus",
    		scope: me,
    		handler: function () {
				me.value = {};
				me.build ();
				me.fireEvent ("change", me.value);		
    		}
    	}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	    	autoSync: true,
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "total", type: "string"
	        }],
	        listeners: {
	        	datachanged: me.datachanged,
	        	scope: me
	        }
	    });
		let cellEditing = new Ext.grid.plugin.CellEditing ({
	        clicksToEdit: 1
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Attribute"), dataIndex: "attr"
			}, {
				header: $o.getString ("Total"), width: 100, dataIndex: "total", editor: {
					xtype: "combo",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
				        data: [
				        	["sum", $o.getString ("Sum")],
				        	["avg", $o.getString ("Average")],
				        	["max", $o.getString ("Max")],
				        	["min", $o.getString ("Min")]
				        ]
					}),
					valueField: "id",
					displayField: "text"
				}, renderer: function (value, metaData, record, rowIndex, colIndex, store) {
					metaData.tdAttr += ' style=";border: 1px gray solid;"';
					switch (value) {
					case "sum":
						value = $o.getString ("Sum");
						break;
				    case "avg":
				    	value = $o.getString ("Average");
				    	break;
				    case "max":
				    	value = $o.getString ("Max");
				    	break;
				    case "min":
				    	value = $o.getString ("Min");
				    };
					return value;
			    }
			}],
			plugins: [cellEditing],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		me.build ();
		this.callParent (arguments);
	},
	datachanged: function () {
		let me = this;
		if (me.store) {
			me.value = {};
			for (let i = 0; i < me.store.getCount (); i ++) {
				if (me.store.getAt (i).get ("total")) {
					me.value [me.store.getAt (i).get ("attr")] = me.store.getAt (i).get ("total");
				};
			};
			me.fireEvent ("change", me.value);		
		};
	},
	setViewId: function (viewId) {
		let me = this;
		if (me.viewId != viewId) {
			me.value = {};
		};
		me.viewId = viewId;
		me.build ();
	},
	build: function () {
		let me = this;
		let view = $o.getView (me.viewId) || {};
		let data = [];
		for (let attr in view.attrs) {
			let va = view.attrs [attr];
			if (!va.get ("classAttr") || $o.getClassAttr (va.get ("classAttr")).get ("type") == 2) {
				data.push ([attr, me.value [attr]]);
			};
		};
		me.store.loadData (data);
	}
});
