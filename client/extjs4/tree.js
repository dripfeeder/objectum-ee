/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Tree.Widget", {
	extend: "Ext.tree.Panel",
	mixins: {
		baseGrid: "$o.Base.Grid"
	},
	alias: ["widget.$o.tree"],
    useArrows: true,
    rootVisible: false,
    multiSelect: true,
	columnLines: true,
	rowLines: true,
	scroll: true,
	layout: "anchor",
  	initComponent: function () {		
		var me= this;
		var view = me.$view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
		var viewId = me.viewId = view.get ("id");
		var query = view.get ("query");
		delete me.query;
		var fields = me.createViewModel ({view: view});
		Ext.define ("$o.View." + viewId + ".Model", {
			extend: "Ext.data.Model",
			fields: fields
		});
		me.columns = [];
	    // Открытые узлы (id)
	    me.$opened = [];
		for (var i = 0; i < fields.length; i ++) {
			var f = fields [i];
			var column = {
				text: $o.getString (f.header),
				tooltip: $o.getString (f.header),
				dataIndex: f.name,
				hidden: f.area != 1,
				width: f.width,
				renderer: me.cellRenderer,
				scope: me
            };
			if (!i) {
				column.xtype = "treecolumn";
				column.locked = true;
			};
			if (f.type == "bool") {
				column.renderer = function (v, meta, rec, row, col, store) {
					if (v) {
						v = "Да";
					} else {
//					if (v == 0 || v == false) {
						v = "Нет";
					};
					return me.cellRenderer (v, meta, rec, row, col, store);
				};
//				column.xtype = "booleancolumn";
//				column.trueText = "Да";
//				column.falseText = "Нет";
			};
			me.columns.push (column);
		};
	    me.store = Ext.create ("Ext.data.TreeStore", {
	        model: "$o.View." + viewId + ".Model",
	        autoLoad: false,
	        root: {
	        	expanded: false
	        },
	        proxy: {
	            type: "ajax",
				api: {
					"create": "treegrid?create=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"read": "treegrid?read=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"update": "treegrid?update=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id,
					"delete": "treegrid?delete=1&id=" + viewId + "&cmpId=" + me.id + "&fieldParent=" + me.fields.parent + "&fieldId=" + me.fields.id
				}
	            //reader: {
	            //	idProperty: "task"
	            //}
	        },
//	        folderSort: true,
	        listeners: {
	        	load: me.loadListener,
				expand: me.expandListener,
				collapse: me.collapseListener,
	        	scope: me
	        }
	    });
		me.selModel = Ext.create ("Ext.selection.TreeModel", {
			mode: me.singleSelect == false ? "MULTI" : "SINGLE",
			listeners: {
				beforeselect: {
					fn: me.beforeSelectListener,
					scope: me
				},
				selectionchange: {
					fn: me.selectionChangeListener,
					scope: me
				}
			}
		});
		me.bbar = [{
			iconCls: "refresh",
			handler: me.refresh,
			scope: me
		}];
		me.on ("beforerender", me.beforeRenderListener, me);
		me.on ("render", me.renderListener, me);
		me.on ("itemdblclick", function () {
			me.userEventListener ({event: "dblclick"});
		}, me);
		me.on ("cellcontextmenu", function () {
			me.getSelectionModel ().deselectAll ();
		}, me);
		me.buildToolbar ();
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.callParent (arguments);
    },
	beforeRenderListener: function () {
		if (this.getFilter ()) {
			this.store.getRootNode ().expand ();
		};
	},
	renderListener: function () {
		this.checkActions ();
	},
	expandListener: function (rec) {
		if (rec.isRoot ()) {
			return;
		};
		if (this.$opened.indexOf (rec.get (this.fields.id)) == -1) {
			this.$opened.push (rec.get (this.fields.id))
		};
	},
	collapseListener: function (rec) {
		if (rec.isRoot ()) {
			return;
		};
		this.$opened.splice (this.$opened.indexOf (rec.get (this.fields.id)), 1)
	},
	refresh: function (options) {
		var me = this;
		options = options || {};
		var callback = options.callback;
		var record;
		if (me.getSelectionModel ().hasSelection ()) {
			record = me.getSelectionModel ().getSelection ();
			record = record [0];
		};
		if (me.getFilter ()) {
			if (me.store.getRootNode ().isExpanded ()) {
//				me.store.load (Ext.apply (options, {callback: function () {
				me.store.load ({callback: function () {
					if (record && me.getRootNode ().findChild (me.fields.id, record.get (me.fields.id))) {
						for (var i = 0; i < me.records.length; i ++) {
							var rec = me.records [i];
							if (rec.get (me.fields.id) == record.get (me.fields.id)) {
								me.getSelectionModel ().deselectAll ();
								me.getSelectionModel ().select (rec);
								break;
							};
						};
					};
					//me.getSelectionModel ().select (record);
					if (callback) {
						callback.call (me, record, me.getStore (), true);
					};
				}});
			} else {
				me.store.getRootNode ().expand ();
			};
			this.checkActions ();
		};
	},
	loadListener: function (treeStore, node, records, successful, eOpts) {
		var me = this;
		me.records = me.records || [];
		var fieldId = me.fields.id;
		var process = function (records) {
			for (var i = 0; i < records.length; i ++) {
				var rec1 = records [i];
				var has = false;
				for (var j = 0; j < me.records.length; j ++) {
					var rec2 = me.records [j];
					if (rec1.get (fieldId) == rec2.get (fieldId)) {
						me.records [j] = rec1;
						has = true;
						break;
					};
				};
				if (!has) {
					me.records.push (rec1);
				};
				if (rec1.childNodes) {
					process (rec1.childNodes);
				};
			};
		};
		process (records);
	},
	// {filter: ["&id", "=", id]}
	selectRow: function (options) {
		var me = this;
		if (options.filter) {
			var id = options.filter [2];
			for (var i = 0; i < me.records.length; i ++) {
				var rec = me.records [i];
				if (rec.get (me.fields.id) == id) {
					me.getSelectionModel ().deselectAll ();
					me.getSelectionModel ().select (rec);
					break;
				};
			};
		};
	}
});
