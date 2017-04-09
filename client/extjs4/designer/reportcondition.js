Ext.define ("$o.ReportCondition.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportcondition", "widget.$reportcondition"],
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
			text: "Отмена",
			iconCls: "gi_remove",
			name: "cancel",
			handler: function () {
				me.up ("window").close ();
			}
		}];
		let dataAttrs = [];
		for (let attr in me.$view.attrs) {
			let a = me.$view.attrs [attr];
			dataAttrs.push ([attr, a.toString ()]);
		};
		me.items = [{
			xtype: "combo",
			fieldLabel: "И/ИЛИ",
			labelWidth: 200,
			name: "and_or",
			width: 350,
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
			fieldLabel: "Атрибут",
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
			fieldLabel: "Оператор",
			labelWidth: 200,
			name: "oper",
			width: 350,
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
					let v = this.getValue ();
					if (v == "is null" || v == "is not null") {
						me.down ("*[name='value']").disable ();
					} else {
						me.down ("*[name='value']").enable ();
					};
				}
			},
			validator: me.validator
		}, {
			xtype: "textfield",
			fieldLabel: "Значение",
			labelWidth: 200,
			width: "100%",
			name: "value",
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
		let me = this.up ("panel");
		let andOrField = me.down ("*[name='and_or']");
		let attrField = me.down ("*[name='attr']");
		let operField = me.down ("*[name='oper']");
		let valueField = me.down ("*[name='value']");
		if (andOrField && !andOrField.getValue ()) {
			me.down ("button[name='save']").disable ();
			return true;
		};
		if (attrField.getValue () && operField.getValue () && (
			operField.getValue () == "is null" || operField.getValue () == "is not null" || valueField.getValue ()
		)) {
			me.down ("button[name='save']").enable ();
			if (operField.getValue () == "is null" || operField.getValue () == "is not null") {
				me.value = [attrField.getValue (), operField.getValue ()];
			} else {
				let val = valueField.getValue ();
				me.value = [attrField.getValue (), operField.getValue (), val];
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
