Ext.define ("$o.LayoutEditor", {
	extend: "Ext.panel.Panel",
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
		me.tbar = [{
			text: "Ок",
			name: "ok",
			iconCls: "gi_ok",
			handler: me.save,
			scope: me
		}, {
			text: $o.getString ("Cancel"),
			name: "cancel",
			iconCls: "gi_remove",
			handler: function () {
				me.up ("window").close ();
			}
		}, {
			text: $o.getString ("Convert to splitter"),
			name: "make_split",
			iconCls: "gi_share_alt",
			handler: function () {
				let ta = me.down ("codemirrortextarea[name='json']");
				let cmp = {
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
			text: $o.getString ("Convert to tabs"),
			name: "make_tab",
			iconCls: "gi_bookmark",
			handler: function () {
				let ta = me.down ("codemirrortextarea[name='json']");
				let tabCmp = JSON.parse (ta.getValue ());
				tabCmp [me.cmpCode].title = tabCmp [me.cmpCode].title || "Закладка";
				let cmp = {
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
		let me = this;
		let ta = me.down ("codemirrortextarea[name='json']");
		let cmp = ta.getValue ();
		cmp = JSON.parse (cmp);
		let tokens = attr.split (".");
		let root = cmp [me.cmpCode];
		for (let i = 0; i < tokens.length; i ++) {
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
		let me = this;
		me.fireEvent ("beforesave", options);
		let ta = me.down ("codemirrortextarea[name='json']");
//		try {
			let value = JSON.parse (ta.getValue ());
			me.value = value;
			me.fireEvent ("aftersave", value);
			me.fireEvent ("change", value);
//		} catch (e) {
//			common.message ("Ошибка: " + (e.message || e));
//		};
	},
	getValue: function () {
		let me = this;
		return me.value;
	}
});
