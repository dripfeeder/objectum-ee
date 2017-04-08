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
