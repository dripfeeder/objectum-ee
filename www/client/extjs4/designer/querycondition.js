Ext.define ("$o.QueryCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querycondition", "widget.$querycondition"],
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
			text: "Отмена",
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		var data = [];
		for (var i = 0; i < me.$classes.length; i ++) {
			var cls = $o.getClass (me.$classes [i]);
			data.push ([me.$aliases [i] + ":id", me.$aliases [i] + ":id"]);
			for (var attr in cls.attrs) {
				data.push ([me.$aliases [i] + ":" + attr, me.$aliases [i] + ":" + cls.attrs [attr].toString ()]);
			};
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: "И/ИЛИ",
			name: "and_or",
			width: 250,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["and", "И"],
					["or", "ИЛИ"]
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
			fieldLabel: "Атрибут 1",
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
			fieldLabel: "Оператор",
			name: "oper",
			width: 250,
			mode: "local",
			queryMode: "local",
			editable: false,
			store: new Ext.data.ArrayStore ({
				fields: ["id", "text"],
				data: [
					["=", "равно (=)"],
					["<>", "не равно (<>)"],
					["<", "меньше (<)"],
					[">", "больше (>)"],
					["<=", "меньше или равно (<=)"],
					[">=", "больше или равно (>=)"],
					["is null", "пусто (is null)"],
					["is not null", "не пусто (is not null)"],
					["in", "одно из перечня (in)"]
				]
			}),
			valueField: "id",
			displayField: "text",
			listeners: {
				select: function () {
					var v = this.getValue ();
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
			fieldLabel: "Значение",
			width: "100%",
			name: "value",
			validator: me.validator
		}, {
			xtype: "combo",
			fieldLabel: "Атрибут 2",
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
		var me = this.up ("panel");
		var andOrField = me.down ("*[name='and_or']");
		var attr1Field = me.down ("*[name='attr1']");
		var operField = me.down ("*[name='oper']");
		var valueField = me.down ("*[name='value']");
		var attr2Field = me.down ("*[name='attr2']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attr1Field.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue () || attr2Field.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			var attr1 = attr1Field.getValue ();
			var o1 = {};
			o1 [attr1.split (":")[0]] = attr1.split (":")[1];
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [o1, operField.getValue ()];
			} else {
				var val = valueField.getValue ();
				if (attr2Field.getValue ()) {
					var attr2 = attr2Field.getValue ();
					val = {};
					val [attr2.split (":")[0]] = attr2.split (":")[1];
				};
				me.value = [o1, operField.getValue (), val];
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
	save: function () {
		var me = this;
		me.fireEvent ("aftersave", me.value);
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
