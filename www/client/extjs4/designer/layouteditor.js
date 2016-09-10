Ext.define ("$o.LayoutEditor", {
	extend: "Ext.panel.Panel",
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.tbar = [{
			text: "Ок",
			name: "ok",
			iconCls: "gi_ok",
			handler: me.save,
			scope: me
		}, {
			text: "Отмена",
			name: "cancel",
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			}
		}, {
			text: "Преобразовать в разделитель",
			name: "make_split",
			iconCls: "gi_share_alt",
			handler: function () {
				var ta = me.down ("codemirrortextarea[name='json']");
				var cmp = {
					split: {
						id: "cmp-" + (me.layoutDesigner.counter ++),
						orientation: "horizontal",
						width: "50%",
						items: [JSON.parse (ta.getValue ()), me.layoutDesigner.createEmpty ()]
					}
				};
				ta.setValue (JSON.stringify (cmp, null, "\t"));
				me.save ({convertion: 1});
			},
			scope: me
		}, {
			text: "Преобразовать в закладки",
			name: "make_tab",
			iconCls: "gi_bookmark",
			handler: function () {
				var ta = me.down ("codemirrortextarea[name='json']");
				var tabCmp = JSON.parse (ta.getValue ());
				tabCmp [me.cmpCode].title = tabCmp [me.cmpCode].title || "Закладка";
				var cmp = {
					tab: {
						id: "cmp-" + (me.layoutDesigner.counter ++),
						items: [tabCmp]
					}
				};
				ta.setValue (JSON.stringify (cmp, null, "\t"));
				me.save ({convertion: 1});
			},
			scope: me
		}];
		me.addEvents ("beforesave", "aftersave", "change");
		this.callParent (arguments);
	},
	changeAttr: function (attr, value) {
		var me = this;
		var ta = me.down ("codemirrortextarea[name='json']");
		var cmp = ta.getValue ();
		cmp = JSON.parse (cmp);
		var tokens = attr.split (".");
		var root = cmp [me.cmpCode];
		for (var i = 0; i < tokens.length; i ++) {
			root [tokens [i]] = root [tokens [i]] || {};
			if (i == tokens.length - 1) {
				root [tokens [i]] = value;
				break;
			};
			root = root [tokens [i]];
		};
		if (attr == "title" && !value) {
			delete cmp [me.cmpCode][attr];
		};
		if (attr == "filter" && (!value || value.length == 0)) {
			delete cmp [me.cmpCode][attr];
		};
		me.value = cmp;
		ta.setValue (JSON.stringify (cmp, null, "\t"));
	},
	save: function (options) {
		var me = this;
		me.fireEvent ("beforesave", options);
		var ta = me.down ("codemirrortextarea[name='json']");
//		try {
			var value = JSON.parse (ta.getValue ());
			me.value = value;
			me.fireEvent ("aftersave", value);
			me.fireEvent ("change", value);
//		} catch (e) {
//			common.message ("Ошибка: " + (e.message || e));
//		};
	},
	getValue: function () {
		var me = this;
		return me.value;
	}
});
