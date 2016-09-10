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
				title: "Общие",
				layout: "form",
				tbar: [{
					text: "Сохранить",
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
					fieldLabel: "Наименование",
					value: record.get ("name")
				}, {
					xtype: "textfield",
					fieldLabel: "Код",
					value: record.get ("code")
				}, {
					xtype: "textfield",
					fieldLabel: "Родитель",
					value: record.get ("parent") ? $o.getView (record.get ("parent")).toString () : ""
				}, {
					xtype: "textfield",
					fieldLabel: "Иконка",
					value: record.get ("iconCls")
				}, {
					xtype: "textarea",
					fieldLabel: "Описание",
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
