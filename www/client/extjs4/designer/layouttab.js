Ext.define ("$o.LayoutTab.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layouttab"],
	cmpCode: "tab",
	initComponent: function () {
		var me = this;
		var cmp = me.layoutDesigner.createEmpty ();
		cmp.panel.title = "Закладка";
		me.value = me.value || {
			tab: {
				id: "cmp-" + (me.layoutDesigner.counter ++),
				items: [cmp]
			}
		};
		me.items = {
			xtype: "tabpanel",
			items: [{
				layout: "vbox",
				title: "Общие",
				iconCls: "gi_edit",
				bodyPadding: 5,
				items: [{
					xtype: "textfield",
					width: "100%", 
					fieldLabel: "Идентификатор",
					name: "id",
					style: "margin-top: 5px;",
					value: me.value.tab.id,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: "Заголовок",
					name: "title",
					value: me.value.tab.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.tab.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}]
			}, {
				layout: "fit",
				title: "Исходный код",
				iconCls: "gi_notes",
				border: 0,
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};			
		this.callParent (arguments);
	}
});
