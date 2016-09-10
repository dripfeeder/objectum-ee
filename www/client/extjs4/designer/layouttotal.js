Ext.define ("$o.LayoutTotal.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layouttotal", "widget.$layouttotal"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || {};
    	me.tbar = [{
    		text: "Очистить",
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
		var cellEditing = new Ext.grid.plugin.CellEditing ({
	        clicksToEdit: 1
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: "Атрибут", dataIndex: "attr"
			}, {
				header: "Итог", width: 100, dataIndex: "total", editor: {
					xtype: "combo",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: new Ext.data.ArrayStore ({
						fields: ["id", "text"],
				        data: [
				        	["sum", "Сумма"],
				        	["avg", "Среднее"],
				        	["max", "Максимальное"],
				        	["min", "Минимальное"]
				        ]
					}),
					valueField: "id",
					displayField: "text"
				}, renderer: function (value, metaData, record, rowIndex, colIndex, store) {
					metaData.tdAttr += ' style=";border: 1px gray solid;"';
					switch (value) {
					case "sum":
						value = "Сумма";
						break;
				    case "avg":
				    	value = "Среднее";
				    	break;
				    case "max":
				    	value = "Максимальное";
				    	break;
				    case "min":
				    	value = "Минимальное";
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
		var me = this;
		if (me.store) {
			me.value = {};
			for (var i = 0; i < me.store.getCount (); i ++) {
				if (me.store.getAt (i).get ("total")) {
					me.value [me.store.getAt (i).get ("attr")] = me.store.getAt (i).get ("total");
				};
			};
			me.fireEvent ("change", me.value);		
		};
	},
	setViewId: function (viewId) {
		var me = this;
		if (me.viewId != viewId) {
			me.value = {};
		};
		me.viewId = viewId;
		me.build ();
	},
	build: function () {
		var me = this;
		var view = $o.getView (me.viewId) || {};
		var data = [];
		for (var attr in view.attrs) {
			var va = view.attrs [attr];
			if (!va.get ("classAttr") || $o.getClassAttr (va.get ("classAttr")).get ("type") == 2) {
				data.push ([attr, me.value [attr]]);
			};
		};
		me.store.loadData (data);
	}
});
