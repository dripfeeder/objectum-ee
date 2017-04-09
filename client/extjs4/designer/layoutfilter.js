Ext.define ("$o.LayoutFilter.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutfilter", "widget.$layoutfilter"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
		me.value = me.value || [];
		if (!me.classMode) {
			me.$view = $o.getView (me.$viewId);
		};
		let grid = me.getItems ();
		grid.width = "100%";
		grid.flex = 1;
		me.items = grid;
    	me.tbar = [{
    		text: $o.getString ("Add"),
    		name: "create",
    		iconCls: "gi_circle_plus",
    		handler: me.createCondition,
    		scope: me
    	}, {
    		text: $o.getString ("Clear"),
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
		let me = this;
		let items = me.getItems ();
		me.removeAll ();
		me.add (items);
		me.doLayout ();
	},
	createCondition: function () {
		let me = this;
		let conditionType = "$o.layoutcondition"
		if (me.classMode) {
			conditionType = "$o.querycondition"; 
		};
		if (me.reportMode) {
			conditionType = "$o.reportcondition"; 
		};
		let win = Ext.create ("Ext.Window", {
			width: 600,
			height: 400,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Condition"),
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
		let me = this;
		let data = [];
		function getConditions (arr, n) {
			for (let i = 0; i < arr.length; i ++) {
				let npp = (n ? n : "") + (i + 1) + ".";
				let space = "";
				if (npp.split (".").length > 2) {
					for (let j = 0; j < npp.length; j ++) {
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
	    let store = Ext.create ("Ext.data.Store", {
	        data: data,
	        fields: [{
	        	name: "attr", type: "string"
			}, {
	        	name: "oper", type: "string"
			}, {
	        	name: "value", type: "string"
	        }]
	    });
		let grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: $o.getString ("Attribute"), width: 100, dataIndex: "attr", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Operator"), width: 100, dataIndex: "oper", renderer: me.cellRenderer
			}, {
				header: $o.getString ("Value"), width: 100, dataIndex: "value", renderer: me.cellRenderer
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		return grid;
	},
	getAttrName: function (attr, viewCode) {
		let me = this;
		let r = attr;
		if (viewCode && $o.getView (viewCode).attrs [attr]) {
			r = $o.getView (viewCode).attrs [attr].toString ();
		} else
		if (!me.classMode && me.$view.attrs [attr]) {
			r = me.$view.attrs [attr].toString ();
		} else
		if (me.classMode && typeof (attr) == "object") {
			let clsId, alias; for (alias in attr) {break;};
			for (let i = 0; i < me.$aliases.length; i ++) {
				if (me.$aliases [i] == alias) {
					let cls = $o.getClass (me.$classes [i]);
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
		let o = {};
		o ["="] = $o.getString ("equal") + " (=)";
		o ["<>"] = $o.getString ("not equal") + " (<>)";
		o ["<"] = $o.getString ("less") + " (<)";
		o [">"] = $o.getString ("more") + " (>)";
		o ["<="] = $o.getString ("less or equal") + " (<=)";
		o [">="] = $o.getString ("more or equal") + " (>=)";
		o ["is null"] = $o.getString ("empty") + " (is null)";
		o ["is not null"] = $o.getString ("not null") + " (is not null)";
		o ["in"] = $o.getString ("one of list") + " (in)";
		return o [oper];
	},
	getValueName: function (v) {
		let me = this;
		if (Ext.isArray (v)) {
			return v.join (", ");
		} else
		if (typeof (v) == "object") {
			if (me.classMode) {
				return me.getAttrName (v);
			} else {
				let cmp = me.layoutDesigner.getCmp (v.id);
				let cmpCode = me.layoutDesigner.getCmpCode (v.id);
				let otherView = cmp [cmpCode].view;
				return me.getAttrName (v.attr, otherView);
			};
		} else {
			return v;
		};
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		if (value) {
			let tip = value;
			if (typeof (tip) == "string") {
				tip = tip.split ('"').join ("'");
			}
			metaData.tdAttr = 'data-qtip="' + tip + '"';
		};
		return value;
	},
	setValue: function (value) {
		let me = this;
		me.value = value;
		me.build ();
	},
	setViewId: function (id) {
		let me = this;
		me.$viewId = id;
		me.$view = $o.getView (me.$viewId);
	},
	setCmpId: function (id) {
		let me = this;
		me.$cmpId = id;
	},
	setClasses: function (classes, classAliases, aliases) {
		let me = this;
		me.$classes = classes;
		me.$classAliases = classAliases;
		me.$aliases = aliases;
	},
	getValue: function () {
		let me = this;
		return me.value;
	}
});
