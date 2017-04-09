/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/
//Ext.require ([
//    "Ext.ux.GroupTabRenderer",
//    "Ext.ux.GroupTabPanel"
//]);
Ext.define ("$o.Layout.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layout", "widget.$layout"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		this.relatives = {};
		let layout = this.$layout;
		if (!layout && this.record && this.record.stub) {
			layout = this.record.stub.get ("layout");
			if (!layout && this.record.get ("query")) {
				layout = {
					olap: {
						id: "olap",
						view: this.record.getFullCode ()
					}
				};
			};
		};
		if (typeof (layout) != "object") {
			layout = eval ("(" + layout + ")");
			if (typeof (layout) == "function") {
				layout = layout ();
			};
		};
		delete this.layout;
		this.addEvents (
			"load"
		);
		this.on ("afterrender", function () {
			this.fireEvent ("load");
		}, this);
		this.record = this.record || {};
		this.record.stub = this.record.stub || {};
		this.record.stub.get = this.record.stub.get || function () {};
		$o.app.fireEvent ("viewLayout", {record: this.record, layout: layout});
		this.items = this.process (layout);
		try {
			this.viewFullCode = $o.getView (this.record.get ("id")).getFullCode ();
		} catch (e) {
		};
		this.callParent (arguments);
	},
	processTab: function (o) {
		let item = {
			xtype: "tabpanel",
			zid: o.id,
			items: []
		};
		o.items = o.pages || o.items;
		for (let i = 0; i < o.items.length; i ++) {
			item.items.push (this.process (o.items [i]));
		};
		delete o.id;
		return item;
	},
	processSplit: function (o) {
		let item = {
			layout: "border",
			border: false,
			zid: o.id,
			defaults: {
				border: false
			}
		};
		if (o.orientation == "horizontal") {
			item.items = [{
			    split: true,
			    region: "west",
				width: o.width,
				layout: "fit",
			    items: this.process (o.pages ? o.pages [0] : o.items [0])
			},{
			    region: "center",
				layout: "fit",
			    items: this.process (o.pages ? o.pages [1] : o.items [1])
			}]
		} else {
			item.items = [{
			    split: true,
			    region: "north",
				height: o.height || o.width,
				layout: "fit",
			    items: this.process (o.pages ? o.pages [0] : o.items [0])
			},{
			    region: "center",
				layout: "fit",
				items: this.process (o.pages ? o.pages [1] : o.items [1])
			}]
		};
		delete o.id;
		return item;
	},
	processOlap: function (o) {
		let item = {
			xtype: "$o.grid",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id,
			lconfig: {
				listeners: {}
			}
		};
		if (o.listeners && o.listeners.dblclick) {
			item.lconfig.listeners.dblclick = $o.util.clone (o.listeners.dblclick);
			delete o.listeners.dblclick;
		};
		if (o.listeners && o.listeners.cellRenderer) {
			item.lconfig.listeners.cellRenderer = $o.util.clone (o.listeners.cellRenderer);
			delete o.listeners.cellRenderer;
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processChart: function (o) {
		let item = {
			xtype: "$o.chart",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processImage: function (o) {
		let item = {
			xtype: "$o.image",
			zview: this,
			relatives: this.relatives,
			url: o.url,
			attr: o.attr,
			width: o.width,
			height: o.height,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processFrame: function (o) {
		let item = {
			xtype: "$o.frame",
			zview: this,
			relatives: this.relatives,
			url: o.url,
			attr: o.attr,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processTreegrid: function (o) {
		let item = {
			xtype: "$o.tree",
			zview: this,
			relatives: this.relatives,
			$query: o.view,
			zid: o.id,
			lconfig: {
				listeners: {}
			}
		};
		if (o.listeners && o.listeners.dblclick) {
			item.lconfig.listeners.dblclick = $o.util.clone (o.listeners.dblclick);
			delete o.listeners.dblclick;
		};
		if (o.listeners && o.listeners.cellRenderer) {
			item.lconfig.listeners.cellRenderer = $o.util.clone (o.listeners.cellRenderer);
			delete o.listeners.cellRenderer;
		};
		delete o.view;
		delete o.id;
		return item;
	},
	processCard: function (o) {
		let item = {
			xtype: "$o.card",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
//		delete o.listeners;
		delete o.id;
		return item;
	},
	processCardConf: function (o) {
		let item = {
			xtype: "$o.cardConf",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	processPanel: function (o) {
		let item = {
			xtype: "panel",
			zview: this,
			relatives: this.relatives,
			zid: o.id
		};
		delete o.id;
		return item;
	},
	process: function (l) {
		let item = {};
		for (let c in l) {
			let o = l [c];
			switch (c) {
			case "tab":
				item = this.processTab (o);
				break;
			case "split":
				item = this.processSplit (o);
				break;
			case "olap":
				item = this.processOlap (o);
				break;
			case "treegrid":
				item = this.processTreegrid (o);
				break;
			case "card":
				item = this.processCard (o);
				break;
			case "cardConf":
				item = this.processCardConf (o);
				break;
			case "panel":
				item = this.processPanel (o);
				break;
			case "chart":
				item = this.processChart (o);
				break;
			case "image":
				item = this.processImage (o);
				break;
			case "frame":
				item = this.processFrame (o);
				break;
			case "calendar":
				break;
			case "designer":
				break;
			default:
				return l;
			};
			o.title = $o.locale.getString (o.title) || $o.locale.getString (o.caption);
			Ext.applyIf (item, o);
		};
		return item;
	},
	getCurrentValue: function (wId, field) {
		let v;
		let w = this.relatives [wId];
		if (w) {
			v = w.getCurrentValue (field);
		};
		return v;
	}
});
