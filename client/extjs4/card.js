/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
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
		let me = this;
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
		let me = this;
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
		let me = this;
		me.listeners = me.listeners || {};
		me.listeners.scope = me.listeners.scope || me;
		for (let i in me.listeners) {
			if (i == "scope") {
				continue;
			};
			let l = me.listeners [i];
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
							let fn = eval (l.fn);
							let args = l.arguments || {};
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
						let args = l.arguments || {};
						l.fn = eval (
							"function () {\n" + 
							"\tlet args = " + JSON.stringify (args) + ";\n" +
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
		let me = this;
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
		let container = me.up ("window") || me.up ("*[isTab=1]");
		if (container) {
			let onBeforeClose = function () {
				if (me.enabledUnloadMessage) {
					common.confirm ({message: $o.getString ("Data is not saved. Close?"), scope: this, fn: function (btn) {
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
		let me = this;
		let r;
		if (item.objectId) {
			let o = $o.getObject (item.objectId);
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
			let objAttr = item.attr.split (".")[0];
			let attr = item.attr.split (".")[1];
			me.$source = me.relatives [item.id];
			me.relatives [item.id].targets [me.zid] = me;
//			let viewId = me.relatives [item.id].viewId;
//			let attrs = $o.viewsMap [viewId].attrs;
			let attrs = me.relatives [item.id].$view.attrs;
			let cls;
			if (attrs [objAttr].get ("classAttr")) {
				let caId = attrs [objAttr].get ("classAttr");
				let ca = $o.classAttrsMap [caId];
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
		let me = this;
		let fieldType = ca.getFieldType ();
		let n = {
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
			let o = $o.getObject (item.objectId);
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
		item.fieldLabel = $o.getString (item.fieldLabel);
	},
	createFields: function () {
		let me = this;
		let processItem = function (item, parentItem) {
			if (!item) {
				console.log (item, parentItem);
			};
			let ca = me.getClassAttr (item);
			if (ca == -1) {
				Ext.apply (item, {
					xtype: "textfield",
					anchor: "-20",
					fieldLabel: $o.getString (item.caption || item.fieldLabel || "unknown"),
					labelStyle: "color: red;",
					style: "color: red;",
					readOnly: true,
					value: $o.getString ("Attribute not exists in storage")
				});
			} else
			if (ca) {
				me.updateItem (item, ca, parentItem);
			};
			if (item.items) {
				for (let i = 0; i < item.items.length; i ++) {
					processItem (item.items.getAt ? item.items.getAt (i) : item.items [i], item);
				};
			};
		};
		for (let i = 0; i < me.$items.length; i ++) {
			processItem (me.$items [i], null);
		};
		me.add (me.$items);
		me.doLayout ();
	},
	getItems: function (options) {
		let me = this;
		let items = [];
		let get = function (item) {
			if (item.$attr && (
				(options && options.hidden) || (item.isVisible && item.isVisible ())
			)) {
				items.push (item);
			};
			if (item.items) {
				for (let i = 0; i < item.items.getCount (); i ++) {
					get (item.items.getAt (i));
				};
			};
		};
		for (let i = 0; i < me.items.getCount (); i ++) {
			get (me.items.getAt (i));
		};
		return items;
	},
	getFields: function (options) {
		let me = this;
		let fields = {};
		let items = me.getItems (options);
		for (let i = 0; i < items.length; i ++) {
			let item = items [i];
			if (item.$attr) {
				fields [item.$attr] = item;
			};
		};
		return fields;
	},
	updateFields: function () {
		let me = this;
		let items = me.getItems ();
		for (let i = 0; i < items.length; i ++) {
			let item = items [i];
			if (!item.$attr) {
				continue;
			};
			let objectId = item.objectId = item.$relative ? item.$relative.getCurrentValue (item.$objAttr) : item.objectId;
			let o = $o.getObject (objectId);
			if (!item.setValue) {
				console.log (item);
			};
			item.setValue (o.get (item.$attr));
			item.originalValue = o.get (item.$attr);
		};
	},
	activeCondition: function () {
		let me = this;
		if (me.active) {
			let active = me.active.fn.call (me, me.active.arguments);
			let items = me.getItems ();
			for (i = 0; i < items.length; i ++) {
				let item = items [i];
				if (item.readOnly) {
					continue;
				};
				item.setReadOnly (!active);
			}
			if (!me.readOnly && !me.hideToolbar && !me.autoSave) {
				let tb = me.getDockedItems ("toolbar[dock='top']");
				if (tb && tb.length) {
					tb [0].setDisabled (!active);
				};
			}
		};
	},
	refresh: function () {
		let me = this;
		let src = me.$source;
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
		for (let id in this.targets) {
			let w = this.targets [id];
			if (w.refresh) {
				w.refresh ({moveFirst: 1});
			};
		};
		me.disableUnloadMessage ();
		me.fireEvent ("refresh");
	},
	save: function (options) {
		options = options || {};
		let me = this;
		let saveFn = function () {
			let items = me.getItems ();
			let objects = {};
			let changed = false;
			for (let i = 0; i < items.length; i ++) {
				let item = items [i];
				if (options.filefield && item.xtype != "$filefield") {
					continue;
				};
				let objectId = item.objectId;
				if (!objectId) {
					continue;
				};
				let o = $o.getObject (objectId);
				if (!o) {
					continue;
				};
				objects [objectId] = o;
				let v = item.getValue ();
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
					for (let objectId in objects) {
						let o = objects [objectId];
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
					common.message ("<font color=red>" + $o.getString ("Could not save data") + "</font><br>Error: " + e + "<br>Stack: " + e.stack);
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
			for (let id in me.targets) {
				let w = me.targets [id];
				if (w.refresh) {
					w.refresh ({moveFirst: 1});
				};
			};
			if (options && options.success) {
				options.success.call (options.scope || me);
			};
			if (me.up ("window") && common.getConf ({code: "closeWindowAfterSave"}).used) {
				me.up ("window").close ();
				common.message ($o.getString ("Information saved"));
			}
		};
		if (options.autoSave) {
			saveFn ();
		} else {
			let items = me.getItems ();
			let msg = "";
			for (let i = 0; i < items.length; i ++) {
				let item = items [i];
				if (item.getActiveError && item.getActiveError ()) {
					let name = item.fieldLabel;
					if (!name && item.ownerCt && item.ownerCt.fieldLabel)  {
						name = item.ownerCt.fieldLabel;
					};
					msg += "<b>" + name + ": " + (item.getValue () == null ? "" : item.getValue ()) + "</b> " + item.getActiveError () + "<br>";
				};
			};
			if (msg) {
				common.message ("<font color=red>" + $o.getString ("Form contains errors") + ":</font><br><br>" + msg);
			} else {
				if (me.getEl ()) {
					me.getEl ().mask ("Сохранение ...");
				};
				setTimeout (saveFn, 300);
			};
		};
	},
	onHighlight: function () {
		let me = this;
		let objectId = [];
		_.each (me.query ("*"), function (c) {
			if (c.objectId) {
				objectId.push (c.objectId);
			}
		});
		objectId = _.uniq (objectId);
		let rows = $o.execute ({
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
		let changeNum = {};
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
		let me = this;
		let objectId = typeof (_objectId) == "number" ? _objectId : me.focusedField.objectId;
		let attr = typeof (_objectId) == "number" ? _attr : me.focusedField.$attr;
		let o = $o.getObject (objectId);
		let cls = $o.getClass (o.get ("classId"));
		let ca = cls.attrs [attr];
		let r = $o.execute ({
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
		let data = [];
		for (let i = 0; i < r.length; i ++) {
			let subject;
			if (r.get (i, "fsubject_id")) {
				let oSubject = $o.getObject (r.get (i, "fsubject_id"));
				let subject = _.filter (_.map (["login", "surname", "forename", "patronymic", "email", "phone"], function (s) {
					return oSubject.get (s);
				}), function (s) {
					if (s) {
						return true;
					};
				}).join (", ");
			} else {
				subject = "admin";
			};
			let o = {
				date: r.get (i, "fdate"),
				subject: subject,
				ip: r.get (i, "fremote_addr"),
				description: r.get (i, "fdescription")
			};
			let value = "";
			if (r.get (i, "fstring")) {
				value = r.get (i, "fstring");
			} else
			if (r.get (i, "ftime")) {
				value = common.getTimestamp (r.get (i, "ftime"));
			} else
			if (r.get (i, "fnumber")) {
				value = r.get (i, "fnumber");
				if (ca.get ("type") >= 1000) {
					let oValue = $o.getObject (r.get (i, "fnumber"));
					value = oValue.toString ();
				};
			};
			o.value = value;
			data.push (o);
		};
	    let store = Ext.create ("Ext.data.Store", {
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
		let cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
			if (value) {
				let tip = value;
				tip = tip.split ('"').join ("'");
				metaData.tdAttr = 'data-qtip="' + tip + '"';
			};
			metaData.style = "white-space: normal;";
			return value;
		};
		let grid = Ext.create ("Ext.grid.Panel", {
			store: store,
			columns: [{
				header: $o.getString ("Date"), width: 100, dataIndex: "date", renderer: cellRenderer
			}, {
				header: $o.getString ("Value"), width: 150, dataIndex: "value", renderer: cellRenderer
			}, {
				header: $o.getString ("User"), width: 150, dataIndex: "subject", renderer: cellRenderer
			}, {
				header: "IP", width: 100, dataIndex: "ip", renderer: cellRenderer
			}, {
				header: $o.getString ("Revision comment"), width: 150, dataIndex: "description", renderer: cellRenderer, hidden: true
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		let win = new Ext.Window ({
			title: $o.getString ("Revision History"),
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
		let me = this;
		me.tbarUser = me.tbar || [];
		me.tbar = [];
		if (!me.hideToolbar && !me.readOnly && !me.autoSave && !$o.isReadOnly ()) {
			me.tbar = [{
				text: $o.getString ("Save"),
				iconCls: "save",
				handler: me.save,
				scope: me
			}, {
				text: $o.getString ("Refresh"),
				iconCls: "refresh",
				handler: me.refresh,
				scope: me
			}];
			if (me.showSaveAndClose) {
				me.tbar.push ({
					text: $o.getString ("Save and close"),
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
						text: $o.getString ("Changes"),
						iconCls: "gi_history",
						menu: [{
							text: $o.getString ("Revision History"),
							iconCls: "gi_history",
							name: "fieldChanges",
							disabled: 1,
							handler: me.onFieldChanges,
							scope: me
						}, {
							text: $o.getString ("Show changed fields"),
							iconCls: "gi_history",
							handler: me.onHighlight,
							scope: me
						}]
					});
				} else {
					me.tbar.push ({
						text: $o.getString ("Changes"),
						iconCls: "gi_history",
						name: "fieldChanges",
						disabled: 1,
						handler: me.onFieldChanges,
						scope: me
					});
				}
			};
		};
		for (let i = 0; i < me.tbarUser.length; i ++) {
			me.tbar.push (me.tbarUser [i]);
		};
	},
	/*
		Возвращает массив с измененными полями (attr, oldValue, newValue).
	*/
	getChanged: function () {
		let me = this;
		let result = [];
		let items = me.getItems ();
		for (i = 0; i < items.length; i ++) {
			let item = items [i];
			if (item.isDirty ()) {
				let value = item.getValue ();
				if (item.ca.get ("secure")) {
					value = $o.util.sha1 (value);
				};
				let o = {};
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
		    let message = $o.getString ("Data is not saved. You will lose changes if you leave the page");
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
