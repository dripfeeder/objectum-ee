/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

/*
	Card
*/
Ext.define ("$o.Card.Widget", {
	//extend: "Ext.form.Panel",
	extend: "Ext.panel.Panel",
	layout: "vbox",
	objectumCmp: "card",
	defaults: {
		width: "100%"
	},
	alias: ["widget.$o.card", "widget.$card"],
	bodyPadding: 5,
	autoScroll: true,
	initComponent: function () {
		var me = this;
		me.items = me.items || me.fields;
//		me.setFieldValues ();
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("afterrender", me.afterRenderListener, me);
		me.on ("beforedestroy", me.beforeDestroyListener, me);
		me.$items = me.items;
		me.items = undefined;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
		me.$source = null;
		me.buildToolbar ();
		me.addEvents ("beforeSave", "aftersave", "refresh");
		me.processListeners ();
		me.readOnly = me.readOnly || $o.isReadOnly ();
		me.on ("destroy", function () {
			me.disableUnloadMessage ();
		});
		me.callParent (arguments);
	},
	setFieldValues: function () {
		var me = this;
		_.each (me.items, function (item) {
			if (item.objectId && item.attr && !item.value) {
				try {
					item.value = $o.getObject (item.objectId).get (item.attr);
				} catch (e) {
				};			
			};
		});
	},
	processListeners: function () {
		var me = this;
		me.listeners = me.listeners || {};
		me.listeners.scope = me.listeners.scope || me;
		for (var i in me.listeners) {
			if (i == "scope") {
				continue;
			};
			var l = me.listeners [i];
			if (typeof (l) == "string") {
				try {
					l = me.listeners [i] = eval (l);
				} catch (e) {
				};
			};
			if (typeof (l) == "function") {
				me.on (i, l, me.listeners.scope);
			} else {
				if (l.fn) {
					if (typeof (l.fn) == "string") {
						// vo
						try {
							var fn = eval (l.fn);
							var args = l.arguments || {};
							args.card = me;
							l.fn = _.bind (fn, me, args);
							/*
							l.fn = function () {
								fn.call (me, args);
							};
							*/
						} catch (e) {
							console.error (l.fn, e);
						};
						/*
						var args = l.arguments || {};
						l.fn = eval (
							"function () {\n" + 
							"\tvar args = " + JSON.stringify (args) + ";\n" +
							"\targs.card = this;\n" +
							"\t" + l.fn + ".call (args);\n" +
							"}"
						);
						args.card = me;
						*/
					} else {
						me.on (i, l.fn, l.scope || me.listeners.scope);
					};
				};
			};
		};
	},
	beforeRenderListener: function () {
		this.createFields ();
	},
	afterRenderListener: function () {
		var me = this;
		_.each (me.getItems (), function (item) {
			item.on ("change", function () {
				if (!me.autoSave) {
					if (this.originalValue != this.getValue ()) {
						me.enableUnloadMessage ();
					};
				};
			});
		});
		me.refresh ();
		var container = me.up ("window") || me.up ("*[isTab=1]");
		if (container) {
			var onBeforeClose = function () {
				if (me.enabledUnloadMessage) {
					common.confirm ({message: "Данные не сохранены. Закрыть?", scope: this, fn: function (btn) {
						if (btn == "yes") {
							container.un ("beforeclose", onBeforeClose);
							container.close ();
						};
					}});
					return false;
				};
			};
			container.on ("beforeclose", onBeforeClose);
		};
	},
	beforeDestroyListener: function () {
		if (this.autoSave) {
			this.save ({autoSave: true});
		};
	},
	getClassAttr: function (item) {
		var me = this;
		var r;
		if (item.objectId) {
			var o = $o.getObject (item.objectId);
			if (!o) {
				console.error ("bad objectId", item);
			};
			r = o.getClassAttr (item.attr);
			if (r) {
				item.$attr = item.attr;
			} else {
//				common.message ("Атрибут отсутствует: " + item.attr);
				r = -1;
			};
		} else 
		if (item.id && item.attr) {
			var objAttr = item.attr.split (".")[0];
			var attr = item.attr.split (".")[1];
			me.$source = me.relatives [item.id];
			me.relatives [item.id].targets [me.zid] = me;
//			var viewId = me.relatives [item.id].viewId;
//			var attrs = $o.viewsMap [viewId].attrs;
			var attrs = me.relatives [item.id].$view.attrs;
			var cls;
			if (attrs [objAttr].get ("classAttr")) {
				var caId = attrs [objAttr].get ("classAttr");
				var ca = $o.classAttrsMap [caId];
				cls = $o.classesMap [ca.get ("type")];
			} else {
				cls = $o.classesMap [attrs [objAttr].get ("class")];
			};
			r = cls.attrs [attr];
			if (r) {
				item.$relative = me.relatives [item.id];
				item.$objAttr = objAttr;
				item.$attr = attr;
				item.id = undefined;
			} else {
//				common.message ("Атрибут отсутствует: " + item.attr);
				r = -1;
			};
		};
		return r;
	},
	updateItem: function (item, ca, parentItem) {
		var me = this;
		var fieldType = ca.getFieldType ();
		var n = {
			fieldLabel: item.caption || item.fieldLabel || ca.get ("name"),
			xtype: fieldType,
			card: this,
			ca: ca
		};
		if (me.readOnly) {
			n.readOnly = true;
		};
		if (ca.get ("secure")) {
			n.inputType = "password";
		};
		if (ca.get ("notNull")) {
			item.allowBlank = false;
		};
		if (item.objectId) {
			var o = $o.getObject (item.objectId);
			n.value = n.originalValue = o.get (item.attr);
		};
		if (fieldType == "textfield" || fieldType == "objectfield" || fieldType == "$filefield") {
			if (!item.width) {
				n.anchor = "-20";
			};
		};
		if (fieldType == "textfield" && item.height) {
			n.xtype = "textarea";
		};
		if (fieldType == "numberfield") {
			n.keyNavEnabled = false;
			n.decimalPrecision = 3;
		};
		if (fieldType == "datefield" && (!item.hasOwnProperty ("timefield") || item.timefield)) {
			n.xtype = "datetimefield";
		};
		if (parentItem && parentItem.xtype == "compositefield") {
			n.style = {
				marginRight: 5
			};
			delete n.fieldLabel;
		};
		item.listeners = item.listeners || {};
		item.listeners.focus = function () {
			if (me.down ("*[name=fieldChanges]")) {
				me.down ("*[name=fieldChanges]").enable ();
			};
			me.focusedField = this;
		};
		/*
		item.listeners.change = function () {
			if (!me.autoSave) {
				me.enableUnloadMessage ();
			};
		};
		*/
		if (item.allowBlank == false) {
			// Чтобы не позволял сохранить пустое поле
			if (!item.listeners.afterrender) {
				item.listeners.afterrender = function () {
					if (this.validate) {
						this.validate ();
					};
				};
			};
		};
		n.vtype = ca.getVType ();
		Ext.applyIf (item, n);
	},
	createFields: function () {
		var me = this;
		var processItem = function (item, parentItem) {
			if (!item) {
				console.log (item, parentItem);
			};
			var ca = me.getClassAttr (item);
			if (ca == -1) {
				Ext.apply (item, {
					xtype: "textfield",
					anchor: "-20",
					fieldLabel: item.caption || item.fieldLabel || "unknown",
					labelStyle: "color: red;",
					style: "color: red;",
					readOnly: true,
					value: "Атрибут отсутствует в хранилище."
				});
			} else
			if (ca) {
				me.updateItem (item, ca, parentItem);
			};
			if (item.items) {
				for (var i = 0; i < item.items.length; i ++) {
					processItem (item.items.getAt ? item.items.getAt (i) : item.items [i], item);
				};
			};
		};
		for (var i = 0; i < me.$items.length; i ++) {
			processItem (me.$items [i], null);
		};
		me.add (me.$items);
		me.doLayout ();
	},
	getItems: function (options) {
		var me = this;
		var items = [];
		var get = function (item) {
			if (item.$attr && (
				(options && options.hidden) || (item.isVisible && item.isVisible ())
			)) {
				items.push (item);
			};
			if (item.items) {
				for (var i = 0; i < item.items.getCount (); i ++) {
					get (item.items.getAt (i));
				};
			};
		};
		for (var i = 0; i < me.items.getCount (); i ++) {
			get (me.items.getAt (i));
		};
		return items;
	},
	getFields: function (options) {
		var me = this;
		var fields = {};
		var items = me.getItems (options);
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (item.$attr) {
				fields [item.$attr] = item;
			};
		};
		return fields;
	},
	updateFields: function () {
		var me = this;
		var items = me.getItems ();
		for (var i = 0; i < items.length; i ++) {
			var item = items [i];
			if (!item.$attr) {
				continue;
			};
			var objectId = item.objectId = item.$relative ? item.$relative.getCurrentValue (item.$objAttr) : item.objectId;
			var o = $o.getObject (objectId);
			if (!item.setValue) {
				console.log (item);
			};
			item.setValue (o.get (item.$attr));
			item.originalValue = o.get (item.$attr);
		};
	},
	activeCondition: function () {
		var me = this;
		if (me.active) {
			var active = me.active.fn.call (me, me.active.arguments);
			var items = me.getItems ();
			for (i = 0; i < items.length; i ++) {
				var item = items [i];
				if (item.readOnly) {
					continue;
				};
				item.setReadOnly (!active);
			}
			if (!me.readOnly && !me.hideToolbar && !me.autoSave) {
				var tb = me.getDockedItems ("toolbar[dock='top']");
				if (tb && tb.length) {
					tb [0].setDisabled (!active);
				};
			}
		};
	},
	refresh: function () {
		var me = this;
		var src = me.$source;
		if (src) {
			if (src.getSelectionModel ().hasSelection ()) {
				me.setDisabled (false);
				me.updateFields ();
			} else {
				me.setDisabled (true);
			};
		} else {
			me.updateFields ();
		};
		me.activeCondition ();
		for (var id in this.targets) {
			var w = this.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		me.disableUnloadMessage ();
		me.fireEvent ("refresh");
	},
	save: function (options) {
		options = options || {};
		var me = this;
		var saveFn = function () {
			var items = me.getItems ();
			var objects = {};
			var changed = false;
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				if (options.filefield && item.xtype != "$filefield") {
					continue;
				};
				var objectId = item.objectId;
				if (!objectId) {
					continue;
				};
				var o = $o.getObject (objectId);
				if (!o) {
					continue;
				};
				objects [objectId] = o;
				var v = item.getValue ();
				if (o.get (item.$attr) != v) {
					if (o.getClassAttr (item.$attr).get ("secure")) {
						v = $o.util.sha1 (v);
					};
					o.set (item.$attr, v);
					changed = true;
				};
			};
			if (changed || me.hasListener ("beforeSave") || me.hasListener ("aftersave")) {
				$o.startTransaction ({description: "Card saving"});
				try {
					try {
						me.fireEvent ("beforeSave", {card: me});
					} catch (e) {
						console.error (e);
					};
					for (var objectId in objects) {
						var o = objects [objectId];
						o.commit ("local");
						if (objectId < 0) {
							_.each (items, function (item) {
								if (item.objectId == objectId) {
									item.objectId = o.get ("id");
								}
							});
						}
					};
					try {
						me.fireEvent ("aftersave", {card: me});
					} catch (e) {
						console.error (e);
						console.error (e.stack);
					};
					$o.commitTransaction ();
					if (me.$source) {
						me.$source.refresh ();
					};
				} catch (e) {
					if (me.getEl ()) {
						me.getEl ().unmask (true);
					};
					common.message ("<font color=red>Не удалось сохранить данные</font><br>Error: " + e + "<br>Stack: " + e.stack);
					$o.rollbackTransaction ();
					throw e;
				};
			};
			if (!options.autoSave) {
				if (me.getEl ()) {
					me.getEl ().unmask (true);
				};
				me.disableUnloadMessage ();
			};
			for (var id in me.targets) {
				var w = me.targets [id];
				if (w.refresh) {
					w.refresh ({moveFirst: 1});
				};
			};
			if (options && options.success) {
				options.success.call (options.scope || me);
			};
			if (me.up ("window") && common.getConf ({code: "closeWindowAfterSave"}).used) {
				me.up ("window").close ();
				common.message ("Информация сохранена.");
			}
		};
		if (options.autoSave) {
			saveFn ();
		} else {
			var items = me.getItems ();
			var msg = "";
			for (var i = 0; i < items.length; i ++) {
				var item = items [i];
				if (item.getActiveError && item.getActiveError ()) {
					var name = item.fieldLabel;
					if (!name && item.ownerCt && item.ownerCt.fieldLabel)  {
						name = item.ownerCt.fieldLabel;
					};
					msg += "<b>" + name + ": " + (item.getValue () == null ? "" : item.getValue ()) + "</b> " + item.getActiveError () + "<br>";
				};
			};
			if (msg) {
				common.message ("<font color=red>Форма содержит ошибки в заполнении:</font><br><br>" + msg);
			} else {
				if (me.getEl ()) {
					me.getEl ().mask ("Сохранение ...");
				};
				setTimeout (saveFn, 300);
			};
		};
	},
	onHighlight: function () {
		var me = this;
		var objectId = [];
		_.each (me.query ("*"), function (c) {
			if (c.objectId) {
				objectId.push (c.objectId);
			}
		});
		objectId = _.uniq (objectId);
		var rows = $o.execute ({
			asArray: true,
			"select": [
				{"a":"___fobject_id"}, "objectId",
				{"b":"___fcode"}, "classAttrCode"
			],
			"from": [
				{"a":"system.object_attr"},
				"left-join", {"b":"system.class_attr"}, "on", [{"a":"___fclass_attr_id"}, "=", {"b":"___fid"}]
			],
			"where": [
				{"a":"___fobject_id"}, "in", objectId.join (".,.").split (".")
			]
		});
		var changeNum = {};
		_.each (rows, function (row) {
			changeNum [row.objectId] = changeNum [row.objectId] || {};
			changeNum [row.objectId][row.classAttrCode] = changeNum [row.objectId][row.classAttrCode] || 0;
			changeNum [row.objectId][row.classAttrCode] ++;
		});
		_.each (me.query ("*"), function (c) {
			if (c.objectId && changeNum [c.objectId] && changeNum [c.objectId][c.attr] > 1) {
				c.setFieldStyle ("border: 2px solid orange");
			}
		});
	},
	onFieldChanges: function (_objectId, _attr) {
		var me = this;
		var objectId = typeof (_objectId) == "number" ? _objectId : me.focusedField.objectId;
		var attr = typeof (_objectId) == "number" ? _attr : me.focusedField.$attr;
		var o = $o.getObject (objectId);
		var cls = $o.getClass (o.get ("classId"));
		var ca = cls.attrs [attr];
		var r = $o.execute ({
			"select": [
				{"a":"___fid"}, "fid",
				{"a":"___fstring"}, "fstring",
				{"a":"___fnumber"}, "fnumber",
				{"a":"___ftime"}, "ftime",
				{"b":"___fdate"}, "fdate",
				{"b":"___fsubject_id"}, "fsubject_id",
				{"b":"___fremote_addr"}, "fremote_addr",
				{"b":"___fdescription"}, "fdescription",
				{"c":"name"}, "subject"
			],
			"from": [
				{"a":"system.object_attr"},
				"left-join", {"b":"system.revision"}, "on", [{"a":"___fstart_id"}, "=", {"b":"___fid"}],
				"left-join", {"c":"subject"}, "on", [{"b":"___fsubject_id"}, "=", {"c":"id"}]
			],
			"where": [
				{"a":"___fobject_id"}, "=", objectId, "and", {"a":"___fclass_attr_id"}, "=", ca.get ("id")
			],
			"order": [
				{"b":"___fdate"}, "desc"
			]
		});
		var data = [];
		for (var i = 0; i < r.length; i ++) {
			var subject;
			if (r.get (i, "fsubject_id")) {
				var oSubject = $o.getObject (r.get (i, "fsubject_id"));
				var subject = _.filter (_.map (["login", "surname", "forename", "patronymic", "email", "phone"], function (s) {
					return oSubject.get (s);
				}), function (s) {
					if (s) {
						return true;
					};
				}).join (", ");
			} else {
				subject = "admin";
			};
			var o = {
				date: r.get (i, "fdate"),
				subject: subject,
				ip: r.get (i, "fremote_addr"),
				description: r.get (i, "fdescription")
			};
			var value = "";
			if (r.get (i, "fstring")) {
				value = r.get (i, "fstring");
			} else
			if (r.get (i, "ftime")) {
				value = common.getTimestamp (r.get (i, "ftime"));
			} else
			if (r.get (i, "fnumber")) {
				value = r.get (i, "fnumber");
				if (ca.get ("type") >= 1000) {
					var oValue = $o.getObject (r.get (i, "fnumber"));
					value = oValue.toString ();
				};
			};
			o.value = value;
			data.push (o);
		};
	    var store = Ext.create ("Ext.data.Store", {
	        data: data,
	        fields: [{
	        	name: "date", type: "string"
			}, {
	        	name: "value", type: "string"
			}, {
	        	name: "subject", type: "string"
			}, {
	        	name: "ip", type: "string"
			}, {
	        	name: "description", type: "string"
	        }]
	    });
		var cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
			if (value) {
				var tip = value;
				tip = tip.split ('"').join ("'");
				metaData.tdAttr = 'data-qtip="' + tip + '"';
			};
			metaData.style = "white-space: normal;";
			return value;
		};
		var grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: "Дата", width: 100, dataIndex: "date", renderer: cellRenderer
			}, {
				header: "Значение", width: 150, dataIndex: "value", renderer: cellRenderer
			}, {
				header: "Пользователь", width: 150, dataIndex: "subject", renderer: cellRenderer
			}, {
				header: "IP-адрес", width: 100, dataIndex: "ip", renderer: cellRenderer
			}, {
				header: "Комментарий ревизии", width: 150, dataIndex: "description", renderer: cellRenderer, hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		var win = new Ext.Window ({
			title: "Хронология изменений",
			resizable: true,
			closable: true,
			modal: true,
			width: 600,
			height: 600,
			border: false,
			iconCls: "gi_history",
			layout: "fit",
			items: grid
		});
		win.show ();
	},
	buildToolbar: function () {
		var me = this;
		me.tbarUser = me.tbar || [];
		me.tbar = [];
		if (!me.hideToolbar && !me.readOnly && !me.autoSave && !$o.isReadOnly ()) {
			me.tbar = [{
				text: "Сохранить",
				iconCls: "save",
				handler: me.save,
				scope: me
			}, {
				text: "Обновить",
				iconCls: "refresh",
				handler: me.refresh,
				scope: me
			}];
			if (me.showSaveAndClose) {
				me.tbar.push ({
					text: "Сохранить и закрыть",
					iconCls: "ok",
					handler: function () {
						this.save ({success: function () {
							this.up ("window").close ();
						}});
					},
					scope: me
				});
			};
			if ($o.visualObjectum && $o.visualObjectum.timeMachine && $o.visualObjectum.timeMachine.cardButton) {
				if ($o.visualObjectum.timeMachine.cardHighlight || window.monu) {
					me.tbar.push ({
						text: "Изменения",
						iconCls: "gi_history",
						menu: [{
							text: "Хронология изменений",
							iconCls: "gi_history",
							name: "fieldChanges",
							disabled: 1,
							handler: me.onFieldChanges,
							scope: me
						}, {
							text: "Показать измененные поля",
							iconCls: "gi_history",
							handler: me.onHighlight,
							scope: me
						}]
					});
				} else {
					me.tbar.push ({
						text: "Изменения",
						iconCls: "gi_history",
						name: "fieldChanges",
						disabled: 1,
						handler: me.onFieldChanges,
						scope: me
					});
				}
			};
		};
		for (var i = 0; i < me.tbarUser.length; i ++) {
			me.tbar.push (me.tbarUser [i]);
		};
	},
	/*
		Возвращает массив с измененными полями (attr, oldValue, newValue).
	*/
	getChanged: function () {
		var me = this;
		var result = [];
		var items = me.getItems ();
		for (i = 0; i < items.length; i ++) {
			var item = items [i];
			if (item.isDirty ()) {
				var value = item.getValue ();
				if (item.ca.get ("secure")) {
					value = $o.util.sha1 (value);
				};
				var o = {};
				o.attr = item.$attr;
				o.oldValue = item.originalValue;
				o.newValue = value;
				o.fieldLabel = item.fieldLabel;
				o.xtype = item.xtype;
				result.push (o);
			};
		};
		return result;
	},
	enableUnloadMessage: function () {
		this.enabledUnloadMessage = true;
		window.onbeforeunload = function (evt) {
		    var message = "Данные не сохранены. Вы потеряете изменения если покинете страницу.";
		    if (typeof evt == "undefined") {
		        evt = window.event;
		    };
		    if (evt) {
		        evt.returnValue = message;
		    };
		    return message;
		};
	},
	disableUnloadMessage: function () {
		this.enabledUnloadMessage = false;
		window.onbeforeunload = undefined;
	}
});
