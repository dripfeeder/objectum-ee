Ext.define ("$o.LayoutCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutcondition", "widget.$layoutcondition"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.filter = me.filter || [];
		me.value = {};
		me.tbar = [{
			text: "Ок",
			iconCls: "gi_ok",
			name: "save",
			disabled: 1,
			handler: me.save,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		var dataAttrs = [];
		for (var attr in me.$view.attrs) {
			var a = me.$view.attrs [attr];
			dataAttrs.push ([attr, a.toString ()]);
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: $o.getString ("And", "/", "Or"),
			labelWidth: 200,
			name: "and_or",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", $o.getString ("And")],
					["or", $o.getString ("Or")]
				]
			}),
			valueField: "id",
			displayField: "text"
			/*
		}, {
			xtype: "checkbox",
			name: "brackets",
			labelWidth: 200,
			fieldLabel: "Условие в скобках"
			*/
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute of this component"),
			name: "attr",
			width: "100%",
			labelWidth: 200,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: dataAttrs
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Operator"),
			labelWidth: 200,
			name: "oper",
			width: 350,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["=", $o.getString ("equal") + " (=)"],
					["<>", $o.getString ("not equal") + " (<>)"],
					["<", $o.getString ("less") + " (<)"],
					[">", $o.getString ("more") + " (>)"],
					["<=", $o.getString ("less or equal") + " (<=)"],
					[">=", $o.getString ("more or equal") + " (>=)"],
					["is null", $o.getString ("empty") + " (is null)"],
					["is not null", $o.getString ("not null") + " (is not null)"],
					["in", $o.getString ("one of list") + " (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					var v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
						me.down ("*[name='attrValue']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
						if (v == "in") {
							me.down ("*[name='attrValue']").disable ();
						} else {
							me.down ("*[name='attrValue']").enable ();
						};
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: $o.getString ("Value"),
			labelWidth: 200,
			width: "100%",
			name: "value",
			validator: me.validator
		}, {			
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute of another component"),
			name: "attrValue",
			width: "100%",
			labelWidth: 200,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: me.getOtherAttrs ()
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
		}];
		if (!me.filter.length) {
			me.items.splice (0, 1);
		};
		me.items [0].style = "margin-top: 5px;";
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function (value) {
		var me = this.up ("panel");
		var andOrField = me.down ("*[name='and_or']");
		var attrField = me.down ("*[name='attr']");
		var operField = me.down ("*[name='oper']");
		var valueField = me.down ("*[name='value']");
		var attrValueField = me.down ("*[name='attrValue']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attrField.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue () || attrValueField.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [attrField.getValue (), operField.getValue ()];
			} else {
				var val = valueField.getValue ();
				if (attrValueField.getValue ()) {
					var v = attrValueField.getValue ();
					val = {id: v.split (":")[0], attr: v.split (":")[1]};
				};
				me.value = [attrField.getValue (), operField.getValue (), val];
			};
//			var bracketsField = me.down ("*[name='brackets']");
//			if (bracketsField && bracketsField.getValue ()) {
//				me.value = [andOrField.getValue (), [me.value]];
//			} else {
			if (andOrField) {
				me.value = [andOrField.getValue ()].concat (me.value);
			};
//			};
		} else {
			me.down ("button[name='save']").disable ();
			me.value = [];
		};
		return true;
	},
	getOtherAttrs: function () {
		var me = this;
		var r = [];
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id && layout [a].view && layout [a].id != me.$cmpId) {
						var v = $o.getView (layout [a].view);
						for (var attr in v.attrs) {
							r.push ([layout [a].id + ":" + attr, layout [a].id + ":" + v.attrs [attr].toString ()]);
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	save: function () {
		var me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
