Ext.define ("$o.LayoutFilter.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutfilter", "widget.$layoutfilter"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.value = me.value || [];
		if (!me.classMode) {
			me.$view = $o.getView (me.$viewId);
		};
		var grid = me.getItems ();
		grid.width = "100%";
		grid.flex = 1;
		me.items = grid;
    	me.tbar = [{
    		text: "Добавить",
    		name: "create",
    		iconCls: "gi_circle_plus",
    		handler: me.createCondition,
    		scope: me
    	}, {
    		text: "Очистить",
    		name: "delete",
    		iconCls: "gi_circle_minus",
    		scope: me,
    		handler: function () {
				me.value = [];
				me.build ();
				me.fireEvent ("change", me.value);		
    		}
    	}];
		me.addEvents ("change");
		this.callParent (arguments);
	},
	build: function () {
		var me = this;
		var items = me.getItems ();
		me.removeAll ();
		me.add (items);
		me.doLayout ();
	},
	createCondition: function () {
		var me = this;
		var conditionType = "$o.layoutcondition"
		if (me.classMode) {
			conditionType = "$o.querycondition"; 
		};
		if (me.reportMode) {
			conditionType = "$o.reportcondition"; 
		};
		var win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: "Условие",
			iconCls: "gi_filter",
			bodyPadding: 5,
			modal: 1,
			items: {
				xtype: conditionType,
				filter: me.value,
				$cmpId: me.$cmpId,
				$view: me.$view,
				$classes: me.$classes,
				$classAliases: me.$classAliases,
				$aliases: me.$aliases,
				layoutDesigner: me.layoutDesigner,
				listeners: {
					aftersave: function (value) {
						win.close ();
						me.value = me.value || [];
						me.value = me.value.concat (value);
						me.build ();
						me.fireEvent ("change", me.value);		
					}
				}
			}
		});
		win.show ();
	},
	getItems: function () {
		var me = this;
		var data = [];
		function getConditions (arr, n) {
			for (var i = 0; i < arr.length; i ++) {
				var npp = (n ? n : "") + (i + 1) + ".";
				var space = "";
				if (npp.split (".").length > 2) {
					for (var j = 0; j < npp.length; j ++) {
						space += "_";
					};
				};
				if (Ext.isArray (arr [i])) {
					getConditions (arr [i], npp);
				} else {
					if (arr [i + 2] == "and" || arr [i + 2] == "or" || i == arr.length - 2) {
						data.push ({
							attr: space + me.getAttrName (arr [i]),
							oper: me.getOperName (arr [i + 1])
						});
						i += 2;
					} else {
						data.push ({
							attr: space + me.getAttrName (arr [i]),
							oper: me.getOperName (arr [i + 1]),
							value: me.getValueName (arr [i + 2])
						});
						i += 3;
					};
					if (i < arr.length) {
						data.push ({
							attr: space + (arr [i] == "and" ? "И" : "ИЛИ")
						});
					};
				};
			};
		};
		if (me.value) {
			getConditions (me.value);
		};
	    var store = Ext.create ("Ext.data.Store", {
	        data: data,
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "oper", type: "string"
			}, {
	        	name: "value", type: "string"
	        }]
	    });
		var grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: "Атрибут", width: 100, dataIndex: "attr", renderer: me.cellRenderer
			}, {
				header: "Оператор", width: 100, dataIndex: "oper", renderer: me.cellRenderer
			}, {
				header: "Значение", width: 100, dataIndex: "value", renderer: me.cellRenderer
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		return grid;
	},
	getAttrName: function (attr, viewCode) {
		var me = this;
		var r = attr;
		if (viewCode && $o.getView (viewCode).attrs [attr]) {
			r = $o.getView (viewCode).attrs [attr].toString ();
		} else
		if (!me.classMode && me.$view.attrs [attr]) {
			r = me.$view.attrs [attr].toString ();
		} else
		if (me.classMode && typeof (attr) == "object") {
			var clsId, alias; for (alias in attr) {break;};
			for (var i = 0; i < me.$aliases.length; i ++) {
				if (me.$aliases [i] == alias) {
					var cls = $o.getClass (me.$classes [i]);
					if (cls.attrs [attr [alias]]) {
						r = alias + ":" + cls.attrs [attr [alias]].toString ();
						break;
					};
				};
			};
		};
		return r;
	},
	getOperName: function (oper) {
		var o = {};
		o ["="] = "равно (=)";
		o ["<>"] = "не равно (<>)";
		o ["<"] = "меньше (<)";
		o [">"] = "больше (>)";
		o ["<="] = "меньше или равно (<=)";
		o [">="] = "больше или равно (>=)";
		o ["is null"] = "пусто (is null)";
		o ["is not null"] = "не пусто (is not null)";
		o ["in"] = "одно из перечня (in)";
		return o [oper];
	},
	getValueName: function (v) {
		var me = this;
		if (Ext.isArray (v)) {
			return v.join (", ");
		} else
		if (typeof (v) == "object") {
			if (me.classMode) {
				return me.getAttrName (v);
			} else {
				var cmp = me.layoutDesigner.getCmp (v.id);
				var cmpCode = me.layoutDesigner.getCmpCode (v.id);
				var otherView = cmp [cmpCode].view;
				return me.getAttrName (v.attr, otherView);
			};
		} else {
			return v;
		};
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
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.build ();
	},
	setViewId: function (id) {
		var me = this;
		me.$viewId = id;
		me.$view = $o.getView (me.$viewId);
	},
	setCmpId: function (id) {
		var me = this;
		me.$cmpId = id;
	},
	setClasses: function (classes, classAliases, aliases) {
		var me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
