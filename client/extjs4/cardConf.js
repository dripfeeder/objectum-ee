/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
	Configurator card (class, classAttr, view, viewAttr)
*/
Ext.define ("$o.CardConf.Widget", {
	extend: "$o.Card.Widget",
	alias: ["widget.$o.cardConf", "widget.$cardConf"],
	initComponent: function () {
		let me = this;
		me.callParent (arguments);
	},
	updateItem: function (item, parentItem) {
		let me = this;
		let n = {
			fieldLabel: item.fieldLabel || item.attr,
			xtype: "textfield",
			anchor: "-20",
			card: me,
			conf: item.conf
		};
		if (me.readOnly) {
			n.readOnly = true;
		};
		if (item.confRef) {
			n.xtype = "conffield";
		};
		if (typeof (item.id) == "number") {
			n.confId = item.id;
			let o = $o.getConfObject (item.conf, item.id);
			if (o) {
				n.value = n.originalValue = o.get (item.attr);
				item.$attr = item.attr;
			};
		} else 
		if (typeof (item.id) == "string") {
			let idAttr = item.attr.split (".")[0];
			let attr = item.attr.split (".")[1];
			me.$source = me.relatives [item.id];
			me.relatives [item.id].targets [me.zid] = me;
			n.$relative = me.relatives [item.id];
			n.$idAttr = idAttr;
			n.$attr = attr;
		};
		if (parentItem && parentItem.xtype == "compositefield") {
			n.style = {
				marginRight: 5
			};
			delete n.fieldLabel;
		};
		delete item.id;
		Ext.applyIf (item, n);
	},
	createFields: function () {
		let me = this;
		let processItem = function (item, parentItem) {
			if (item.conf && item.id && item.attr) {
				me.updateItem (item, parentItem);
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
	updateFields: function () {
		let me = this;
		let items = me.getItems ();
		for (let i = 0; i < items.length; i ++) {
			let item = items [i];
			if (!item.$attr) {
				continue;
			};
			let confId = item.confId = item.$relative ? item.$relative.getCurrentValue (item.$idAttr) : item.confId;
			if (confId) {
				let o = $o.getConfObject (item.conf, confId);
				if (!item.setValue) {
					console.log (item);
				};
				item.setValue (o.get (item.$attr));
				item.originalValue = o.get (item.$attr);
			};
		};
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
				let confId = item.confId;
				if (!confId) {
					continue;
				};
				let o = $o.getConfObject (item.conf, confId);
				if (!o) {
					continue;
				};
				objects [confId] = o;
				let v = item.getValue ();
				if (o.get (item.$attr) != v) {
					o.set (item.$attr, v);
					changed = true;
				};
			};
			if (changed) {
				me.fireEvent ("beforeSave");
				$o.startTransaction ({description: "CardConf saving"});
				try {
					for (let confId in objects) {
						let o = objects [confId];
						o.sync ();
					};
					me.fireEvent ("afterSave");
					$o.commitTransaction ();
					if (me.$source) {
						me.$source.refresh ();
					};
				} catch (e) {
					if (me.getEl ()) {
						me.getEl ().unmask (true);
					};
					$o.rollbackTransaction ();
					throw e;
				};
			};
			if (me.getEl ()) {
				me.getEl ().unmask (true);
			};
			if (options && options.success) {
				options.success.call (options.scope || me);
			};
		};
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
				me.getEl ().mask ($o.getString ("Saving") + " ...");
			};
			setTimeout (saveFn, 100);
		};
	}
});
