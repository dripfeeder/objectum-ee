Ext.define ("$o.QueryCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querycondition", "widget.$querycondition"],
	layout: "vbox",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
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
		let data = [];
		for (let i = 0; i < me.$classes.length; i ++) {
			let cls = $o.getClass (me.$classes [i]);
			data.push ([me.$aliases [i] + ":id", me.$aliases [i] + ":id"]);
			for (let attr in cls.attrs) {
				data.push ([me.$aliases [i] + ":" + attr, me.$aliases [i] + ":" + cls.attrs [attr].toString ()]);
			};
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: $o.getString ("And/or"),
			name: "and_or",
			width: 250,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", $o.getString ("and")],
					["or", $o.getString ("or")]
				]
			}),
			valueField: "id",
			displayField: "text",
			validator: me.validator
			/*
		}, {
			xtype: "checkbox",
			name: "brackets",
			labelWidth: 200,
			fieldLabel: "Условие в скобках"
			*/
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute") + " 1",
			name: "attr1",
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
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Operator"),
			name: "oper",
			width: 250,
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
					[">=", $o.getString ("more  or equal") + " (>=)"],
					["is null", $o.getString ("null") + " (is null)"],
					["is not null", $o.getString ("not null") + " (is not null)"],
					["in", $o.getString ("one of list") + " (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					let v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
						me.down ("*[name='attr2']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
						if (v == "in") {
							me.down ("*[name='attr2']").disable ();
						} else {
							me.down ("*[name='attr2']").enable ();
						};
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: $o.getString ("Value"),
			width: "100%",
			name: "value",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: $o.getString ("Attribute") + " 2",
			name: "attr2",
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
						me.down ("*[name=save]").enable ();
					} else {
						me.down ("*[name=save]").disable ();
					};
					me.validator ();
				}
			}
		}];
		if (!me.filter.length) {
			me.items.splice (0, 1);
		};
		me.items [0].style = "margin-top: 5px;";
		me.addEvents ("aftersave");
		this.callParent (arguments);
	},
	validator: function (value) {
		let me = this.up ("panel");
		let andOrField = me.down ("*[name='and_or']");
		let attr1Field = me.down ("*[name='attr1']");
		let operField = me.down ("*[name='oper']");
		let valueField = me.down ("*[name='value']");
		let attr2Field = me.down ("*[name='attr2']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attr1Field.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue () || attr2Field.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			let attr1 = attr1Field.getValue ();
			let o1 = {};
			o1 [attr1.split (":")[0]] = attr1.split (":")[1];
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [o1, operField.getValue ()];
			} else {
				let val = valueField.getValue ();
				if (attr2Field.getValue ()) {
					let attr2 = attr2Field.getValue ();
					val = {};
					val [attr2.split (":")[0]] = attr2.split (":")[1];
				};
				me.value = [o1, operField.getValue (), val];
			};
//			let bracketsField = me.down ("*[name='brackets']");
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
	save: function () {
		let me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		let me = this;
		return me.value;
	}
});
