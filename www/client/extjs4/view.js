/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/
Ext.define ("$o.app.view", {
	singleton: true,
	getItems: function (record) {
		var me = this;
		var items = {
			id: "e" + record.get ("id"),
			xtype: "tabpanel",
			title: record.get ("name") || record.get ("code"),
			iconCls: "gi_eye_open",
			layout: "fit",
			defaults: {
				bodyPadding: 5
			},
			items: [{
				title: $o.getString ("Commons"),
				layout: "form",
				tbar: [{
					text: $o.getString ("Save"),
					iconCls: "gi_floppy_save",
					handler: me.saveCommon
				}],
				items: [{
					xtype: "textfield",
					fieldLabel: "ID",
					value: record.get ("id"),
					readOnly: true
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Name"),
					value: record.get ("name")
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Code"),
					value: record.get ("code")
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Parent"),
					value: record.get ("parent") ? $o.getView (record.get ("parent")).toString () : ""
				}, {
					xtype: "textfield",
					fieldLabel: $o.getString ("Icon"),
					value: record.get ("iconCls")
				}, {
					xtype: "textarea",
					fieldLabel: $o.getString ("Description"),
					value: record.get ("description")
				}]
			}]
		};
		return items;
	},
	saveCommon: function () {
		var me = this;
		console.log (me);
	}
});
