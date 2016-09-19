/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

//Ext.require ([
//    "Ext.ux.form.MultiSelect"
//]);
/*
	compositefield -> fieldcontainer
*/
$o.pushFn (function () {

Ext.define ("$o.CompositeField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: "widget.compositefield",
	layout: "hbox",
	initComponent: function () {
		this.callParent (arguments);
	}
});
/*
	ObjectField
*/
Ext.define ("$o.ObjectField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.objectfield", "widget.$objectfield", "widget.$o.objectfield"],
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_edit",
			style: {
				marginRight: 1
			},
			handler: function () {
				var me = this;
				if (me.ro) {
					return;
				};
				me.choose = me.choose || {};
				var winWidth = me.choose.width || 800;
				var winHeight = me.choose.height || 600;
				if (me.choose.fn && me.choose.type == "custom") {
					me.choose.fn.call (me);
					return;
				};
				if (me.choose.fn) {
					me.choose.fn.call (me);
				};
				if (me.choose.listeners && me.choose.listeners.beforeShow) {
					me.choose.listeners.beforeShow.call (me);
				};
				var layout;
				var view;
				if (me.choose.type == "layout") {
					layout = $o.util.clone (me.choose.layout);
				} else {
					if (me.choose.id) {
						view = $o.getView ({code: me.choose.id});
						layout = view.get ("layout") || {
							olap: {
								id: "olap",
								view: me.choose.id
							}
						};
					} else {
						// classView
						var o = $o.getObject (me.objectId);
						var cls = $o.getClass (o.get ("classId"));
						var ca = cls.attrs [me.attr];
						layout = {
							olap: {
								id: "olap",
								classView: ca.get ("type")
							}
						};
						me.choose.attr = "olap.id";
					};
				};
				if (typeof (layout) == "string") {
					layout = eval ("(" + layout + ")");
				};
				me.fireEvent ("beforechoose", {
					layout: layout
				});
				var attrs = me.choose.attr.split (".");
				var olap;
				var view = Ext.create ("$o.Layout.Widget", {
					record: view || $zs.views.ser.card,
					$layout: layout,
					listeners: {
						afterrender: function () {
							var tb;
							if (attrs.length > 1) {
								olap = view.relatives [attrs [0]];
								if (olap) {
									tb = olap.getDockedItems ("toolbar[dock='top']")[0];
									if (tb) {
										tb.insert (0, [btnChoose, btnCancel]);
										tb.doLayout ();
									} else {
									};
								} else {
									common.message ("Элемент '" + attrs [0] + "' не найден.");
									return;
								};
							} else {
								olap = view.items.items [0];
							}
							olap.selModel.on ('selectionchange', function () {
								if (olap.getCurrentValue (attrs [attrs.length - 1])) {
									btnChoose.setDisabled (false);
								} else {
									btnChoose.setDisabled (true);
								}
							}, this);
							if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
								delete olap.lconfig.listeners.dblclick;
							};
							olap.on ("itemdblclick", function () {
								//btnChoose.handler.call (me);
								me.onChoose (view);
								setTimeout (function () {
									win.close ();
								}, 100);
							}, me);
							if (!tb) {
								tb = win.getDockedItems ("toolbar[dock='top']")[0];
								tb.add ([btnChoose, btnCancel]);
								tb.doLayout ();
								tb.setVisible (true);
							};
							if (me.choose.hideActions) {
								var b = win.query ("button");
								for (var i = 0; i < b.length; i ++) {
									if ([$o.getString ("Add"), $o.getString ("Open"), $o.getString ("Remove")].indexOf (b [i].text) > -1) {
										b [i].hide ();
									}; 
								};
							};
						},
						scope: me
					}
				});
				var btnChoose = Ext.create ("Ext.Button", {
					text: $o.getString ("Choose"),
					iconCls: "ok",
					disabled: true,
					handler: function () {
						me.onChoose (view);
						win.close ();
					},
					scope: me
				});
				var btnCancel = Ext.create ("Ext.Button", {
					text: $o.getString ("Cancel"),
					iconCls: "cancel",
					handler: function () {
						win.close ();
					}
				});
				var win = Ext.create ("Ext.Window", {
					title: $o.getString ("Choose object"),
					resizable: true,
					closable: true,
					height: winHeight,
					width: winWidth,
					layout: "fit",
					modal: true,
					tbar: Ext.create ("Ext.Toolbar", {
						hidden: true
					}),
					items: [view]
				});
				win.show ();
			},
			scope: me
		}, {
			xtype: "button",
			iconCls: "gi_remove",
			style: {
				marginRight: 1
			},
			handler: function () {
				me.setValue (null);
				if (me.choose.listeners && me.choose.listeners.afterChoose) {
					me.choose.listeners.afterChoose.call (me);
				};
				me.fireEvent ("change", null);
			}
		}, {
			xtype: "textfield",
			flex: 1,
			readOnly: true,
			objectField: me,
			listeners: {
				render: function (c) {
					me.valueField = c;
					if (me.value) {
						me.setValue (me.value);
					};
	                c.getEl ().on ("mousedown", function (e, t, eOpts) {
	                	if (me.down ("button[iconCls=gi_edit]")) {
							me.down ("button[iconCls=gi_edit]").handler.call (me);
						};
	                });
					me.getActiveError = function () {
						return me.valueField.getActiveError.call (me.valueField, arguments);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}];
		if (me.hasOwnProperty ("allowBlank")) {
			me.items [me.items.length - 1].allowBlank = me.allowBlank;
		};
		if (me.readOnly) {
			me.items.splice (0, 2);
			me.addCls ("readonly-field");
		};
		if (this.hasOwnProperty ("allowBlank") && !this.allowBlank && this.fieldLabel) {
			this.fieldLabel = this.fieldLabel + "<span style='color: red !important'>*</span>";
		};
		me.addEvents ("change", "beforechoose");
		if (me.listeners && me.listeners.beforechoose && typeof (me.listeners.beforechoose) == "string") {
			me.listeners.beforechoose = eval (me.listeners.beforechoose);
		};
		me.callParent (arguments);
	},
	onChoose: function (view) {
		var me = this;
		var tokens = (me.choose.attr ? me.choose.attr : "olap.id").split (".");
		var wId, field, value;
		if (tokens.length == 1) {
			for (wId in view.relatives) {
				break;
			};
			field = tokens [0];
		} else {
			wId = tokens [0];
			field = tokens [1];
		};
		var oldValue = me.getValue ();
		value = view.relatives [wId].getCurrentValue (field);
		me.setValue (value);
		if (me.choose.listeners && me.choose.listeners.afterChoose) {
			me.choose.listeners.afterChoose.call (me, oldValue, value);
		};
	},
	setValue: function (v) {
		var me = this;
		me.value = v;
		if (v) {
			var o = $o.getObject (v);
			if (o) {
				v = o.toString ();
			} else {
				v = null;
			};
		};
		if (me.valueField) {
			me.valueField.setValue (v);
			if (v) {
				Ext.tip.QuickTipManager.register ({
					target: me.valueField.id,
					text: v,
					width: 300,
					dismissDelay: 3000
				});			
			} else {
				Ext.tip.QuickTipManager.unregister (me.valueField.getEl ());
			};
		};
		me.fireEvent ("change", me.value);
	},
	getValue: function () {
		return this.value;
	},
	setReadOnly: function (ro) {
		var me = this;
		me.ro = ro;
		if (ro) {
			me.items.getAt (0).hide ();
			me.items.getAt (1).hide ();
			me.addCls ("readonly-field");
		} else {
			me.items.getAt (0).show ();
			me.items.getAt (1).show ();
			me.removeCls ("readonly-field");
		};
	},
	validate: function () {
		return this.valueField.validate.call (this.valueField, arguments);
	},
	isValid: function () {
		return this.valueField.isValid.call (this.valueField, arguments);
	}
});
/*
	DateTimeField
*/
Ext.define ("$o.DateTimeField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.datetimefield", "widget.$datetimefield"],
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "datefield",
			width: 90,
			readOnly: me.readOnly,
			listeners: {
				render: function (c) {
					me.dateField = c;
					if (me.value) {
						me.setValue (me.value);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}, {
			xtype: "timefield",
			width: 80,
			readOnly: me.readOnly,
			style: {
				marginLeft: 1
			},
			listeners: {
				render: function (c) {
					me.timeField = c;
					if (me.value) {
						me.setValue (me.value);
					};
				},
				focus: function () {
					me.fireEvent ("focus", me);
				}
			}
		}];
		me.callParent (arguments);
	},
	setValue: function (v) {
		var me = this;
		me.value = v;
		if (me.dateField && me.timeField) {
			me.dateField.setValue (v);
			me.timeField.setValue (v);
		};
	},
	getValue: function () {
		var v = this.dateField.getValue ();
		var tv = this.timeField.getValue ();
		if (tv) {
			v.setHours (tv.getHours ());
			v.setMinutes (tv.getMinutes ());
			v.setSeconds (tv.getSeconds ());
		};
		return v;
	}
});
/*
	$multiselect (title, toolbar)
*/
Ext.define ("$o.MultiSelect.Widget", {
	extend: "Ext.panel.Panel",
	alias: "widget.$multiselect",
	border: true,
	layout: "fit",
	initComponent: function () {
		var me = this;
		me.title = me.fieldLabel || me.title;
		var listeners = {
			render: function (c) {
				me.$multiselect = c;
			}
		};
		if (me.listeners && me.listeners.change) {
			listeners.change = me.listeners.change;
		};
		me.items = {
			xtype: "multiselect",
			store: me.store,
			valueField: me.valueField,
			displayField: me.displayField,
			ddReorder: me.ddReorder,
			listeners: listeners
		};
		me.callParent (arguments);
	},
	getStore: function () {
		return this.$multiselect.getStore ();
	},
	getValue: function () {
		return this.$multiselect.getValue ();
	}
});
/*
	FileField
*/
Ext.define ("$o.FileField.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: "widget.$filefield",
	layout: "hbox",
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_upload",
			tooltip: $o.getString ("Choose and upload file"),
			disabled: me.readOnly,
			style: {
				marginRight: 1
			},
			handler: function () {
				var fileField = Ext.create ("Ext.form.field.File", {
					fieldLabel: $o.getString ("File"),
					buttonText: $o.getString ("Choose"),
					name: 'file-path'
				});
				var fp = Ext.create ("Ext.form.Panel", {
					defaults: {
						anchor: '95%'
					},
					bodyStyle: 'padding: 10px 10px 0 10px;',
					items: [{
						hidden: true,
						xtype: "textfield",
						name: "objectId",
						value: me.objectId
//						html: '<input type=hidden name=objectId value=' + me.objectId + '>'
					}, {
						hidden: true,
						xtype: "textfield",
						name: "classAttrId",
						value: me.ca.get ("id")
//						html: '<input type=hidden name=classAttrId value=' + me.ca.get ("id") + '>'
					}, 
						fileField
					],
					buttons: [{
						text: $o.getString ("Upload"),
						iconCls: "gi_upload",
						handler: function () {
							me.card.save ({autoSave: true});
							fp.down ("textfield[name=objectId]").setValue (me.objectId);
							fp.getForm ().submit ({
								url: 'upload?sessionId=' + $sessionId + "&username=" + $o.currentUser,
								waitMsg: $o.getString ("File uploading") + " ...",
								success: function (fp, o) {
									if (o.result.success) {
										me.setValue (o.result.file);
										me.card.save (/*{filefield: true}*/);
										win.close ();
										common.message ($o.getString ("File") + " " + o.result.file + " " + $o.getString ("uploaded"));
									} else {
										common.message ($o.getString ("File") + " " + o.result.file + " " + $o.getString ("failed to send"));
									};
								},
								failure: function (form, action) {
									common.message ($o.getString ("File", "failed to send", ".", "Error", ": ") + action.result.error);
								}
							});
						}
					},{
						text: $o.getString ("Remove"),
						iconCls: "gi_remove",
						handler: function () {
							if (!me.getValue ()) {
								return;
							}
							common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
								if (btn == "yes") {
									me.setValue (null);
									me.card.save ({filefield: true}); // todo: erase file on server side
								};
							}});
						}
					}]
				});	
				var win = new Ext.Window ({
					title: $o.getString ("File uploading"),
					resizable: false,
					closable: true,
					height: 114,
					width: 500,
					layout: "fit",
					modal: true,
					items: fp
				});
				win.show ();
			},
			scope: me
		}, {
			xtype: "button",
			iconCls: "gi_download",
			tooltip: $o.getString ("Download"),
			disabled: me.readOnly,
			style: {
				marginRight: 1
			},
			handler: function () {
				me.download ();
			}
		}, {
			xtype: "textfield",
			flex: 1,
			readOnly: true,
			listeners: {
				render: function (c) {
					if (me.value) {
						me.setValue (me.value);
					};
	                //c.getEl ().on ("mousedown", function (e, t, eOpts) {
					//	me.down ("button[iconCls=gi_upload]").handler.call (me);
	                //});
				}
			}
		}];
		me.callParent (arguments);
	},
	setValue: function (v) {
		this.down ("field").setValue (v);
	},
	getValue: function () {
		return this.down ("field").getValue ();
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.items.getAt (0).hide ();
			me.items.getAt (1).hide ();
			me.addCls ("readonly-field");
		} else {
			me.items.getAt (0).show ();
			me.items.getAt (1).show ();
			me.removeCls ("readonly-field");
		};
	},
	download: function () {
		var me = this;
		var filename = me.getValue ();
		if (filename) {
			var fileUri = "files/" + me.objectId + "-" + me.ca.get ("id") + "-" + filename;
//			var w = window.open (fileUri, "w" + me.objectId + "-" + me.ca.get ("id"), "resizable=yes, scrollbars=yes, status=yes, width=600, height=400");
			var w = window.open (fileUri);
			w.focus ();
		}
	}
});
/*
	ConfField
*/
Ext.define ("$o.ConfField.Widget", {
	extend: "$o.ObjectField.Widget",
	alias: ["widget.conffield", "widget.$conffield"],
	initComponent: function () {
		var me = this;
		me.addEvents ("change");
		me.callParent (arguments);
		me.setValue = function (v) {
			var me = this;
			me.value = v;
			if (v) {
				var o = $o.getConfObject (me.confRef, v);
				v = o.toString ();
			};
			if (me.valueField) {
				me.valueField.setValue (v);
			};
			me.fireEvent ("change", me.value);
		}
	}
});
/*
	CodeMirrorTextArea
*/
Ext.define ("$o.CodeMirrorTextArea.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.codemirrortextarea"],
	layout: "fit",
	border: 0,
	initComponent: function () {
		var me = this;
		me.items = {
			xtype: "textarea",
			width: "100%",
			height: "100%",
			value: me.value,
			listeners: {
				afterrender: function () {
					var ta = this;
					dom = ta.inputEl.dom;
					var makeEditor = function () {
						me.editor = CodeMirror.fromTextArea (dom, {
							lineNumbers: true,
							indentUnit: 4,
							readOnly: false,
							mode: me.mode || "javascript",
							viewportMargin: Infinity
						});
						me.editor.setSize (ta.getWidth (), ta.getHeight ());
						me.editor.on ("change", function () {
							me.fireEvent ("change");
						});
					};
					if (!window.CodeMirror) {
						$o.util.loadCSS ("/third-party/codemirror/codemirror-4.3.css", function () {
							$o.util.loadJS ("/third-party/codemirror/codemirror-4.3.min.js", function () {
								makeEditor ();
							});
						});
					} else {
						makeEditor ();
					};
				},
				resize: function (c, width, height, oldWidth, oldHeight, eOpts) {
					if (me.editor) {
						me.editor.setSize (width, height);
					};
				}
			}
		}; 
		me.addEvents ("change");
		me.callParent (arguments);
	},
	setValue: function (value) {
		var me = this;
		value = value || "";
		if (me.editor) {
			me.editor.setValue (value);
		} else {
			me.down ("textarea").setValue (value);
		};
	},
	getValue: function () {
		var me = this;
		if (me.editor) {
			return this.editor.getValue ();
		} else {
			return me.down ("textarea").getValue ();
		};
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
	}
});
/*
	IconSelector
*/
Ext.define ("$o.IconSelector.Widget", {
	extend: "Ext.form.FieldContainer",
	alias: ["widget.$o.iconselector", "widget.$iconselector"],
	layout: "hbox",
	fieldLabel: $o.getString ("Icon"),
	initComponent: function () {
		var me = this;
		me.items = [{
			xtype: "button",
			iconCls: "gi_edit",
			name: "choose",
			height: 22,
			handler: me.choose,
			scope: me,
			style: {
				marginRight: 1
			}
		}, {
			xtype: "button",
			iconCls: "gi_remove",
			height: 22,
			style: {
				marginRight: 5
			},
			handler: function () {
				me.setValue (null);
				me.fireEvent ("change", null);
			}
		}, {
			xtype: "button",
			name: "icon",
			width: 22,
			height: 22,
			iconCls: me.value,
			handler: me.choose,
			scope: me,
			style: {
				marginRight: 1
			}
		}, {
			xtype: "textfield",
			name: "name",
			flex: 1,
			readOnly: true,
			value: me.value ? me.value : "",
			listeners: {
				render: function (c) {
	                c.getEl ().on ("mousedown", function (e, t, eOpts) {
						me.down ("button[name=choose]").handler.call (me);
	                });
				}
			}
		}]; 
		me.addEvents ("change");
		me.callParent (arguments);
	},
	getValue: function () {
		var me = this;
		return me.value;
	},
	setValue: function (value) {
		var me = this;
		me.value = value;
		me.down ("button[name='icon']").setIconCls (value ? value : "");
		me.down ("textfield[name='name']").setValue (value ? value : "");
	},
	getIconData: function () {
		var result = [];
		var ss = document.styleSheets;
		for (var i = 0; i < ss.length; i ++) {
			var href = ss [i].href;
			if (href && href.indexOf ("images.css") != -1) {
				var rules = ss [i].cssRules;
				if (!rules) {
					rules = ss [i].rules;
				};
				for (var j = 0; j < rules.length; j ++) {
					var v = rules [j].selectorText;
					if (!v) {
						continue;
					};
					if (v.length) {
						v = v.substr (1);
					};
					if (v.substr (0, 3) != "gi_") {
						continue;
					};
					var o = {};
					var url = rules [j].cssText;
					url = url.split ("(")[1].split (")")[0];
					o.url = url;
					o.iconCls = v;
					result.push (o);
				}
			}
		}
		var cmp = function (o1, o2) {
			var v1 = o1.iconCls;
			var v2 = o2.iconCls;
			if (v1 > v2) {
				return 1;
			} else if (v1 < v2) {
				return -1;
			} else {
				return 0;		
			}
		};
		result.sort (cmp);
		return result;
	},
	setReadOnly: function (ro) {
		var me = this;
		if (ro) {
			me.down ("button[name='choose']").disable ();
		} else {
			me.down ("button[name='choose']").enable ();
		};
	},
	choose: function () {
		var me = this;
		var data = me.getIconData ();
		var onClick = function () {
			win.close ();
			me.setValue (this.iconCls);
			me.fireEvent ("change", this.iconCls);
		};
		var items = [], row = [];
		for (var i = 0; i < data.length; i ++) {
			row.push ({
				iconCls: data [i].iconCls
			});
			if (row.length > 20) {
				items.push ({
					layout: "hbox",
					defaults: {
						xtype: "button",
						handler: onClick,
						style: "margin-right: 1px; margin-bottom: 1px"
					},
					items: row
				});
				row = [];
			};
		};
		if (row.length) {
			items.push ({
				layout: "hbox",
				defaults: {
					xtype: "button",
					handler: onClick,
					style: "margin-right: 1px; margin-bottom: 1px"
				},
				items: row
			});
		};
		var win = Ext.create ("Ext.Window", {
			width: 500,
			height: 570,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			title: $o.getString ("Choose icon"),
			bodyPadding: 5,
			modal: 1,
			items: {
				layout: "vbox",
				border: 0,
				defaults: {
					border: 0
				},
				items: items
			}
		});
		win.show ();
	}
});

});
