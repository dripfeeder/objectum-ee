Ext.define ("$o.QuerySort.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querysort", "widget.$querysort"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		me.tbar = [{
			text: $o.getString ("Add"),
			handler: me.create,
			iconCls: "gi_circle_plus",
			scope: me
		}, {
			text: $o.getString ("Clear"),
			iconCls: "gi_circle_minus",
			handler: me.clear,
			scope: me
		}];
	    me.store = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "dir", type: "string"
			}, {
	        	name: "alias", type: "string"
			}, {
	        	name: "dir_id", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: $o.getString ("Attribute"), width: 100, dataIndex: "attr", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Sort"), width: 100, dataIndex: "dir", renderer: me.cellRenderer
			}, {
				header: "alias", width: 100, dataIndex: "attr_id", hidden: true
			}, {
				header: "dir_id", width: 100, dataIndex: "dir_id", hidden: true
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
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	/*
	chooseClassAttr: function () {
		var me = this;
		var dataCls = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			dataCls.push ({
				name: cls.toString (), id: cls.get ("id")
			});
		};
	    var storeCls = Ext.create ("Ext.data.Store", {
	        data: dataCls,
	        fields: [{
	        	name: "name", type: "string"
			}, {
	        	name: "id", type: "string"
	        }]
	    });
		var gridCls = Ext.create ("Ext.grid.Panel", {
			store: storeCls,
			columns: [{
				header: "Классы", width: 100, dataIndex: "name"
			}, {
				header: "id", width: 100, dataIndex: "id", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false,
			selModel: Ext.create ("Ext.selection.RowModel", {
				mode: "SINGLE",
				listeners: {
					selectionchange: function () {
						if (gridCls.getSelectionModel ().hasSelection ()) {
							var record = gridCls.getSelectionModel ().getSelection ()[0];
							var id = record.get ("id");
							loadClsAttrs (id);
						};
					}
				}
			})
		});
	    var storeAttrs = Ext.create ("Ext.data.Store", {
	        data: [],
	        fields: [{
	        	name: "name", type: "string"
			}, {
	        	name: "cls", type: "string"
			}, {
	        	name: "id", type: "string"
	        }],
			sorters: [{
				property: "name",
				direction: "ASC"
			}]	        
	    });
		var gridAttrs = Ext.create ("Ext.grid.Panel", {
			store: storeAttrs,
			columns: [{
				header: "Атрибуты", width: 100, dataIndex: "name"
			}, {
				header: "Класс", width: 80, dataIndex: "cls"
			}, {
				header: "id", width: 100, dataIndex: "id", hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false,
			listeners: {
				itemdblclick: function () {
					win.down ("*[name=choose]").handler ();
				}
			}
		});
		var loadClsAttrs = function (clsId) {
			var data = [];
			function get (clsId) {
				var cls = $o.getClass (Number (clsId));
				for (var attr in cls.attrs) {
					var ca = cls.attrs [attr];
					data.push ({
						name: ca.toString (), cls: cls.toString (), id: ca.get ("id")
					});
				};
				if (cls.get ("parent")) {
					get (cls.get ("parent"));
				};
			};
			get (clsId);
			storeAttrs.loadData (data);
		};
		var items;
		if (me.$classes.length == 1) {
			loadClsAttrs (me.$classes [0]);
			items = gridAttrs;
		} else {
			items = {
				layout: "border",
				border: 0,
				items: [{
				    split: true,
				    region: "west",
					width: 200,
					border: 0,
					layout: "fit",
				    items: gridCls
				},{
				    region: "center",
					border: 0,
					layout: "fit",
				    items: gridAttrs
				}]
			}
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 600,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: "Выберите атрибут",
			bodyPadding: 5,
			modal: 1,
			items: items,
			tbar: [{
				text: "Выбрать",
				name: "choose",
				handler: function () {
					if (gridAttrs.getSelectionModel ().hasSelection ()) {
						var record = gridAttrs.getSelectionModel ().getSelection ()[0];
						var id = record.get ("id");
						me.setValue (id);
						win.close ();
					};
				}
			}]
		});
		win.show ();
	},
	*/
	create: function () {
		var me = this;
		var data = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			data.push ([me.$aliases [i] + ":id", me.$aliases [i] + ":id"]);
			for (var attr in cls.attrs) {
				data.push ([me.$aliases [i] + ":" + attr, me.$aliases [i] + ":" + cls.attrs [attr].toString ()]);
			};
		};
		var win = Ext.create ("Ext.Window", {
			width: 400,
			height: 150,
			layout: "vbox",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Select", "attribute"),
			iconCls: "gi_file",
			bodyPadding: 5,
			modal: 1,
			tbar: [{
				text: "Ок",
				iconCls: "gi_ok",
				name: "create",
				disabled: 1,
				handler: function () {
					var attr = win.down ("*[name=attr]").getValue ();
					me.value = me.value || [];
					if (me.value.length) {
						me.value.push (",");
					};
					var o = {};
					o [attr.split (":")[0]] = attr.split (":")[1];
					me.value.push (o);
					if (win.down ("*[name=dir]").getValue () == "DESC") {
						me.value.push ("DESC");
					} else {
						me.value.push ("ASC");
					};
					me.build ();
					win.close ();
					me.fireEvent ("change", me.value);
				}
			}, {
				text: $o.getString ("Cancel"),
				iconCls: "gi_remove",
				handler: function () {
					win.close ();
				}
			}],
			items: [{
				/*
				xtype: "$conffield", 
				fieldLabel: "Атрибут",
				name: "attr", 
				width: "100%",
				confRef: "classAttr",
				$classes: me.$classes,
				choose: {
					type: "custom", fn: me.chooseClassAttr
				},
				listeners: {
					change: function (value) {
						if (value) {
							win.down ("*[name=create]").enable ();
						} else {
							win.down ("*[name=create]").disable ();
						};
					}
				}
				*/
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute"),
				name: "attr",
				width: "100%",
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: data
				}),
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						if (this.getValue ()) {
							win.down ("*[name=create]").enable ();
						} else {
							win.down ("*[name=create]").disable ();
						};
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Sort"),
				name: "dir",
				width: "100%",
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [
						["ASC", $o.getString ("Sort ascending")],
						["DESC", $o.getString ("Sort descending")]
					]
				}),
				valueField: "id",
				displayField: "text"
			}]
		});
		win.show ();
	},
	clear: function () {
		var me = this;
		me.setValue ([]);
	},
	build: function () {
		var me = this;
		var data = [];
		if (me.value) {
			for (var i = 0; i < me.value.length; i += 2) {
				if (me.value [i] == ",") {
					i ++;
				};
				var r = {};
				if (me.value [i + 1] == "DESC") {
					r.dir = $o.getString ("Sort descending");
					r.dir_id = "DESC";
				} else {
					r.dir = $o.getString ("Sort ascending");
					r.dir_id = "ASC";
				};
				var alias; for (alias in me.value [i]) {break;};
				var attr = me.value [i][alias];
				for (var j = 0; j < me.$aliases.length; j ++) {
					if (me.$aliases [j] == alias) {
						var cls = $o.getClass (me.$classes [j]);
						r.attr = alias + ":" + cls.attrs [attr].toString ();
						r.alias = alias;
						break;
					};
				};
				data.push (r);
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
