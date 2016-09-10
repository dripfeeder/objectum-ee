Ext.define ("$o.QuerySelect.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.queryselect", "widget.$queryselect"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		me.tbar = [{
    		text: "Выбрать",
    		iconCls: "gi_edit",
    		handler: me.addAttrs,
    		scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "name", type: "string"
			}, {
	        	name: "clsName", type: "string"
			}, {
	        	name: "clsFrom", type: "string"
			}, {
	        	name: "clsId", type: "number"
			}, {
	        	name: "attr", type: "string"
			}, {
	        	name: "alias", type: "string"
	        }],
			sorters: [{
				property: "name",
				direction: "ASC"
			}]	        
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: "Атрибут", width: 100, dataIndex: "name", renderer: me.cellRenderer
			}, {
				header: "Псевдоним", width: 100, dataIndex: "alias", renderer: me.cellRenderer
			}, {
				header: "Класс", width: 100, dataIndex: "clsName", renderer: me.cellRenderer
			}, {
				header: "clsFrom", width: 100, dataIndex: "clsFrom", hidden: true
			}, {
				header: "clsId", width: 100, dataIndex: "clsId", hidden: true
			}, {
				header: "attr", width: 100, dataIndex: "attr", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = me.grid;
		me.addEvents ("change");
		this.callParent (arguments);
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		if (value) {
			var tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		return value;
	},
	updateSelect: function () {
		var me = this;
		me.value = [];
		for (var i = 0; i < me.store.getCount (); i ++) {
			var o = {};
			o [me.store.getAt (i).get ("clsFrom")] = me.store.getAt (i).get ("attr");
			me.value.push (o);
			me.value.push (me.store.getAt (i).get ("alias"));
		};
		me.fireEvent ("change", me.value);
	},
	addAttrs: function () {
		var me = this;
		if (!me.$classes.length) {
			common.message ("Необходимо выбрать класс.");
			return;
		};
		var tabs = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			var data = [{
				attr: "id", name: "id", alias: i ? (me.$aliases [i] + "_id") : "id"
			}];
			var valueSelected = [];
			for (var j = 0; j < me.store.getCount (); j ++) {
				if (me.store.getAt (j).get ("clsFrom") == me.$aliases [i] && me.store.getAt (j).get ("attr") == "id") {
					valueSelected.push ("id");
					data [0].alias = me.store.getAt (j).get ("alias");
				};
			};
			for (var attr in cls.attrs) {
				var ca = cls.attrs [attr];
				var o = {
					attr: attr, 
					name: ca.toString (), 
					clsName: $o.getClass (ca.get ("class")).toString (),
					alias: i ? (me.$aliases [i] + "_" + attr) : attr
				};
				for (var j = 0; j < me.store.getCount (); j ++) {
					if (me.store.getAt (j).get ("clsFrom") == me.$aliases [i] && me.store.getAt (j).get ("attr") == attr) {
						valueSelected.push (attr);
						o.alias = me.store.getAt (j).get ("alias");
					};
				};
				data.push (o);
			};
		    var store = Ext.create ("Ext.data.Store", {
		        data: data,
		        fields: [{
		        	name: "name", type: "string"
				}, {
		        	name: "clsName", type: "string"
				}, {
		        	name: "attr", type: "string"
				}, {
		        	name: "alias", type: "string"
		        }],
				sorters: [{
					property: "name",
					direction: "ASC"
				}]	        
		    });
			var cellEditing = new Ext.grid.plugin.CellEditing ({
		        clicksToEdit: 1
		    });    
		    var clickedColIndex;
		    var selModel = Ext.create ("Ext.selection.CheckboxModel", {
				mode: "MULTI",
				valueSelected: valueSelected,
				checkOnly: true
			});
			var grid = Ext.create ("Ext.grid.Panel", {
				tbar: i ? [{
					text: "Псевдонимы по коду атрибута",
					iconCls: "gi_sort-by-alphabet",
					handler: function () {
						var store = this.up ("grid").getStore ();
						for (var i = 0; i < store.getCount (); i ++) {
							var rec = store.getAt (i);
							var a = rec.get ("alias");
							if (a.split ("_").length == 2) {
								rec.set ("alias", a.split ("_")[1]);
							};
						};
					}
				}] : [],
				store: store,
				columns: [{
					header: "Атрибут", width: 100, dataIndex: "name", renderer: me.cellRenderer
				}, {
					header: "Псевдоним", width: 100, dataIndex: "alias", renderer: me.cellRenderer,
			        editor: {
			            xtype: "textfield"
			        }
				}, {
					header: "Класс", width: 100, dataIndex: "clsName", renderer: me.cellRenderer
				}, {
					header: "attr", width: 100, dataIndex: "attr", hidden: true
				}],
				plugins: [cellEditing],
				selModel: selModel,
				forceFit: true,
				frame: false,
				deferRowRender: false,
				listeners: {
					afterrender: function () {
						for (var j = 0; j < this.getSelectionModel ().valueSelected.length; j ++) {
							this.getSelectionModel ().select (this.getStore ().findRecord ("attr", this.getSelectionModel ().valueSelected [j], 0, false, false, true), true);
						};
					}
				}
			});
			tabs.push ({
				title: me.$aliases [i] + ":" + cls.toString (),
				alias: me.$aliases [i],
				name: "tab",
				cls: cls,
				layout: "fit",
				selModel: selModel,
				items: grid
			});
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 600,
		    resizeable: false,
			border: false,
			title: "Выберите атрибуты (используйте указатель мыши и клавиши Shift, Ctrl)",
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "fit",
			items: {
				xtype: "tabpanel",
				deferredRender: false,
				items: tabs
			},
			tbar: [{
				text: "Ок",
				iconCls: "gi_ok",
				handler: function () {
					var data = [];
					var tabs = win.down ("tabpanel").query ("panel[name=tab]");
					for (var i = 0; i < tabs.length; i ++) {
						var tab = tabs [i];
						var selected = [];
						if (tab.selModel.hasSelection ()) {
							selected = tab.selModel.getSelection ();
						};
						for (var j = 0; j < selected.length; j ++) {
							data.push ({
								name: tabs [i].alias + ":" + (tab.cls.attrs [selected [j].get ("attr")] ? tab.cls.attrs [selected [j].get ("attr")].toString () : selected [j].get ("attr")),
								clsName: tab.cls.toString (),
								clsFrom: me.$aliases [i],
								clsId: tab.cls.get ("id"),
								attr: selected [j].get ("attr"),
								alias: selected [j].get ("alias")
							});
						};
					};
					me.store.loadData (data);
					win.close ();
					me.updateSelect ();
				}
			}, {
				text: "Отмена",
				iconCls: "gi_remove",
				handler: function () {
					win.close ();
				}
			}]
		});
		win.show ();
	},
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	build: function () {
		var me = this;
		var data = [];
		if (me.value) {
			for (var i = 0; i < me.value.length; i += 2) {
				var clsId, cls, alias; for (alias in me.value [i]) {break;};
				var attr = me.value [i][alias];
				for (var j = 0; j < me.$aliases.length; j ++) {
					if (me.$aliases [j] == alias) {
						cls = $o.getClass (me.$classes [j]);
					};
				};
				data.push ({
					name: alias + ":" + (cls.attrs [attr] ? cls.attrs [attr].toString () : attr),
					clsName: cls.toString (),
					clsFrom: alias,
					clsId: cls.get ("id"),
					attr: attr,
					alias: me.value [i + 1]
				});
			};
		};
		me.store.loadData (data);
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
		me.fireEvent ("change", value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
