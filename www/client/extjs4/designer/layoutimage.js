Ext.define ("$o.LayoutImage.Widget", {
	extend: "$o.LayoutEditor",
	alias: ["widget.$o.layoutimage", "widget.$layoutimage"],
	cmpCode: "image",
	border: 1,
	initComponent: function () {
		var me = this;
		me.value = me.value || {
			image: {
				id: "cmp-" + (me.layoutDesigner.counter ++)
			}
		};
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: me.getOtherAttrs ()
		});
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
					value: me.value.image.id,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("id", this.getValue ())
							me.down ("*[name=filter]").setCmpId (this.getValue ());
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: "Заголовок",
					name: "title",
					value: me.value.image.title,
					listeners: {
						change: function () {
							me.changeAttr ("title", this.getValue ())
						}
					}
				}, {
					xtype: "$iconselector",
					width: "100%", 
					name: "iconCls",
					value: me.value.image.iconCls,
					listeners: {
						change: function () {
							me.changeAttr ("iconCls", this.getValue ())
						}
					}
				}, {
					xtype: "textfield",
					width: "100%", 
					fieldLabel: "Ссылка (URL)",
					name: "url",
					value: me.value.image.url,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("url", this.getValue ());
							me.down ("*[name=attr]").setValue (null);
						}
					}
				}, {
					xtype: "combo",
					fieldLabel: "Атрибут компонента",
					name: "attr",
					width: "100%",
					mode: "local",
					queryMode: "local",
					editable: false,
					store: me.store,
					value: me.value.image.attr,
					valueField: "id",
					displayField: "text",
					validator: me.validator,
					listeners: {
						select: function () {
							me.changeAttr ("attr", this.getValue ());
							me.down ("*[name=url]").setValue (null);
						}
					}
				}, {
					xtype: "numberfield",
					width: 300, 
					fieldLabel: "Ширина",
					name: "width",
					value: me.value.image.width,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("width", this.getValue ());
						}
					}
				}, {
					xtype: "numberfield",
					width: 300, 
					fieldLabel: "Высота",
					name: "height",
					value: me.value.image.height,
					validator: me.validator,
					listeners: {
						change: function () {
							me.changeAttr ("height", this.getValue ());
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
					if (layout [a].id && layout [a].id != me.$cmpId) {
						if (layout [a].view) {
							var v = $o.getView (layout [a].view);
							for (var attr in v.attrs) {
								var va = v.attrs [attr];
								//if ((a == "card" && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 5) || 
								//	(a != "card" && va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 1)
								if (va.get ("classAttr") && $o.getClassAttr (va.get ("classAttr")).get ("type") == 5) {
									r.push ([layout [a].id + "." + attr, layout [a].id + ":" + va.toString ()]);
								};
							};
						};
						if (a == "card" && layout [a].object && layout [a].object.cls) {
							var cls = $o.getClass (layout [a].object.cls);
							function getAttrs (items) {
								if (items) {
									for (var i = 0; i < items.length; i ++) {
										var item = items [i];
										var ca = cls.attrs [item.attr];
										if (item.objectId && item.attr && ca && ca.get ("type") == 5) {
											r.push ([layout [a].id + "." + item.attr, layout [a].id + ":" + ca.toString ()]);
										};
										if (item.items) {
											getAttrs (item.items);
										};
									};
								};
							};
							getAttrs (layout [a].items);
						};
					};
					get (layout [a]);
				};
			};
		};
		get (me.layoutDesigner.value);
		return r;
	},
	validator: function () {
		var me = this.up ("window");
		if (me.down ("*[name=id]").getValue () && (me.down ("*[name=url]").getValue () || me.down ("*[name=attr]").getValue ())) {
			me.down ("button[name='ok']").enable ();
		} else {
			me.down ("button[name='ok']").disable ();
		};
		return true;
	}
});
