Ext.define ("$o.LayoutDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.layoutdesigner", "widget.$layoutdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		var me = this;
		me.initCounter (me.value);
		me.value = me.value || me.createEmpty ();
		me.treeStore = Ext.create ('Ext.data.TreeStore', {
		    root: {
		        expanded: true,
		        children: []
		    }
		});
		me.items = {
			xtype: "tabpanel",
			items: [{
				title: $o.getString ("Constructor"),
				iconCls: "gi_adjust_alt",
				layout: "border",
				name: "constructor",
				border: false,
				items: [{
				    split: true,
					width: 230,
				    region: "east",
					layout: "fit",
				    items: {
			    		xtype: "treepanel",
					    store: me.treeStore,
					    rootVisible: false,
				    	title: $o.getString ("Navigator"),
				    	iconCls: "gi_search",
				    	border: 0,
				    	tbar: [{
				    		text: $o.getString ("Open"),
				    		iconCls: "gi_edit",
				    		name: "edit",
				    		handler: me.edit,
				    		scope: me,
				    		disabled: 1
				    	}, {
				    		text: $o.getString ("Add"),
				    		iconCls: "gi_circle_plus",
				    		name: "create",
				    		handler: function () {
								var cmp = me.createEmpty ();
								cmp.panel.title = "Закладка";
								var tp = me.getCmp (me.selected.id);
								tp.tab.items.push (cmp);
								me.addCmp (cmp.panel.id);
				    		},
				    		scope: me,
				    		disabled: 1
				    	}, {
				    		text: $o.getString ("Remove"),
				    		iconCls: "gi_circle_minus",
				    		name: "delete",
				    		handler: function () {
								common.confirm ({message: "Вы уверены?", scope: this, fn: function (btn) {
									if (btn == "yes") {
										if (!me.removeTab (me.selected.id)) {
											var cmp = me.createEmpty ();
											var c = me.getCmp (me.selected.id);
											for (var a in c) {
												delete c [a];
											};
											Ext.apply (c, cmp);
											me.value.designer = 1;
										};
					    				me.down ("button[name='delete']").disable ();
										me.build ();
									}
								}});
				    		},
				    		scope: me,
				    		disabled: 1
				    	}],
				    	bbar: [{
				    		text: $o.getString ("Cancel action"),
				    		iconCls: "gi_history",
				    		name: "prevValue",
				    		disabled: 1,
				    		handler: function () {
				    			me.value = JSON.parse (me.prevValue.pop ());
				    			if (!me.prevValue.length) {
									me.down ("button[name='prevValue']").disable ();
				    			};
				    			me.build ({back: 1});
				    		}
				    	}],
				    	listeners: {
				    		select: function (srm, record, index, eOpts) {
				    			if (record) {
									var id = record.get ("text").split ("(id:")[1].split (")")[0];
									var code = me.getCmpCode (id);
									if (code != "panel") {
					    				me.down ("button[name='edit']").enable ();
					    				me.selected = {
					    					record: record,
					    					id: id,
					    					code: code
					    				};
					    			} else {
					    				me.down ("button[name='edit']").disable ();
					    			};
					    			if (code == "tab") {
					    				me.down ("button[name='create']").enable ();
					    			} else {
					    				me.down ("button[name='create']").disable ();
					    			};
					    			if (code != "panel") {
				    					me.down ("button[name='delete']").enable ();
				    				} else {
				    					me.down ("button[name='delete']").disable ();
				    				};
				    			}
				    		}
				    	}
				    }
				}, {
				    region: "center",
					layout: "fit",
					border: 0,
					style: "border: 1px solid #00ff00; margin: 1px",
					bodyPadding: 1,
				    items: {
						xtype: "$o.layout",
						$layout: $o.util.clone (me.value)
				    }
				}]
			}, {
				layout: "fit",
				title: $o.getString ("Source code"),
				iconCls: "gi_notes",
				name: "source",
				items: {
					xtype: "codemirrortextarea",
					mode: "application/ld+json",
					name: "json",
					value: JSON.stringify (me.value, null, "\t")
				}
			}]
		};
		me.addEvents ("change");
		me.on ("afterrender", me.setHandlers);
		this.callParent (arguments);
	},
	edit: function () {
		var me = this;
		var id = me.selected.id;
		var code = me.selected.code;
		var win = Ext.create ("Ext.Window", {
			width: me.getCmpWidth (code),
			height: me.getCmpHeight (code),
		    resizeable: false,
			border: false,
			title: me.getCmpName (code),
			iconCls: me.getCmpIconCls (code),
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "fit",
			items: {
				xtype: "$o.layout" + code,
				layoutDesigner: me,
				value: me.getCmpValue (id),
				listeners: {
					aftersave: function () {
						win.close ();
						me.replaceCmp (id, this.getValue ());
						me.build ();
						me.fireEvent ("change", me.getValue ());
					}
				}
			}
		});
		win.show ();
	},
	getCmpCode: function (id) {
		var me = this;
		var find = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (layout [a].id == id) {
							return a;
						};
						var r = find (layout [a]);
						if (r) {
							return r;
						};
					};
				};
			};
			if (layout.items) {
				for (var i = 0; i < layout.items.length; i ++) {
					var r = find (layout.items [i]);
					if (r) {
						return r;
					};
				};
			};
		};
		return find (me.value);
	},
	getCmpValue: function (id) {
		var me = this;
		var find = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (layout [a].id == id) {
							return layout;
						};
						var r = find (layout [a]);
						if (r) {
							return r;
						};
					};
				};
			};
			if (layout.items) {
				for (var i = 0; i < layout.items.length; i ++) {
					var r = find (layout.items [i]);
					if (r) {
						return r;
					};
				};
			};
		};
		return find (me.value);
	},
	getCmpName: function (code) {
		switch (code) {
		case "split":
			return $o.getString ("Splitter");
			break;
		case "tab":
			return $o.getString ("Tabs");
			break;
		case "olap":
			return $o.getString ("Table");
			break;
		case "treegrid":
			return $o.getString ("Tree");
			break;
		case "card":
			return $o.getString ("Card");
			break;
		case "chart":
			return $o.getString ("Chart");
			break;
		case "image":
			return $o.getString ("Image");
			break;
		case "frame":
			return $o.getString ("Frame");
			break;
		case "panel":
			return $o.getString ("Empty");
			break;
		};
	},
	getCmpIconCls: function (code) {
		switch (code) {
		case "split":
			return "gi_share_alt";
			break;
		case "tab":
			return "gi_share_alt";
			break;
		case "olap":
			return "gi_table";
			break;
		case "treegrid":
			return "gi_leaf";
			break;
		case "card":
			return "gi_edit";
			break;
		case "chart":
			return "gi_charts";
			break;
		case "image":
			return "gi_picture";
			break;
		case "frame":
			return "gi_globe_af";
			break;
		case "panel":
			return "gi_file";
			break;
		};
	},
	getCmpWidth: function (code) {
		switch (code) {
		case "split":
			return 600;
			break;
		case "tab":
			return 600;
			break;
		case "olap":
			return 800;
			break;
		case "treegrid":
			return 600;
			break;
		case "card":
			return 800;
			break;
		case "chart":
			return 600;
			break;
		case "image":
			return 600;
			break;
		case "frame":
			return 600;
			break;
		}
	},
	getCmpHeight: function (code) {
		switch (code) {
		case "split":
			return 400;
			break;
		case "tab":
			return 400;
			break;
		case "olap":
			return 600;
			break;
		case "treegrid":
			return 600;
			break;
		case "card":
			return 600;
			break;
		case "chart":
			return 600;
			break;
		case "image":
			return 600;
			break;
		case "frame":
			return 600;
			break;
		}
	},
	getTreeRecord: function (layout) {
		var me = this;
		layout = layout || me.value;
		var code; for (code in layout) {if (code != "designer") break;};
		var cmp = layout [code];
		var rec = {
			text: me.getCmpName (code) + (cmp.title ? (": " + cmp.title) : "") + " (id:" + cmp.id + ")"
		};
		if (cmp.items && code != "panel" && code != "card") {
			rec.expanded = 0;
			rec.children = [];
			for (var i = 0; i < cmp.items.length; i ++) {
				rec.children.push (me.getTreeRecord (cmp.items [i]));
			};
		} else {
			rec.leaf = 1;
		}
		return rec;
	},
	initCounter: function (l) {
		var me = this;
		l = l || {};
		me.counter = me.counter || 1;
		if (typeof (l) == "object") {
			for (var a in l) {
				if (l [a]) {
					me.initCounter (l [a]);
				};
			};
		};
		if (l.items) {
			for (var i = 0; i < l.items.length; i ++) {
				me.initCounter (l.items [i]);
			};
		};
		if (l.id) {
			var n = l.id.split ("-");
			if (n.length > 1 && Number (n [1]) >= me.counter) {
				me.counter = Number (n [1]) + 1;
			};
		};
	},
	createEmpty: function () {
		var me = this;
		var id = "cmp-" + (me.counter ++);
		var cmp = {
			panel: {
				id: id,
				layout: {
					type: "vbox",
					align: "center",
					pack: "center"
				}, 
				items: [{
					xtype: "button",
					text: $o.getString ("Select", "component"),
					iconCls: "gi_edit",
					name: "selectCmp",
					cmpId: id
				}]
			}
		};
		return cmp;
	},
	build: function (options) {
		var me = this;
		options = options || {};
		var container = me.down ("*[region='center']");
		container.removeAll ();
		container.add ({
			xtype: "$o.layout",
			$layout: me.updateLayoutTags ($o.util.clone (me.value))
//			$layout: $o.util.clone (me.value)
		});
		container.doLayout ();
		me.setHandlers ();
		me.treeStore.getRootNode ().removeAll ();
		me.treeStore.getRootNode ().appendChild (
		    me.getTreeRecord ()
		);
		me.down ("button[name='edit']").disable ();
		if (!options.back) {
			me.prevValue = me.prevValue || [];
			me.prevValue.push (me.down ("codemirrortextarea[name='json']").getValue ());
			me.down ("button[name='prevValue']").enable ();
		};
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (me.value, null, "\t"));
	},
	selectCmp: function (options) {
		var me = this;
		var onClick = function () {
			options.success (this.cmpCode);
			win.close ();
		};
		var win = Ext.create ("Ext.Window", {
			width: 560,
			height: 100,
		    bodyPadding: 5,
		    resizeable: false,
			border: false,
			title: $o.getString ("Select", "component"),
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			modal: 1,
			layout: "hbox",
			items: [{
				xtype: "button",
				text: $o.getString ("Table"),
				cmpCode: "olap",
				iconCls: "gib_table",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Tree"),
				cmpCode: "treegrid",
				iconCls: "gib_leaf",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Card"),
				cmpCode: "card",
				iconCls: "gib_edit",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Chart"),
				cmpCode: "chart",
				iconCls: "gib_charts",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Image"),
				cmpCode: "image",
				iconCls: "gib_picture",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Frame"),
				cmpCode: "frame",
				iconCls: "gib_globe_af",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Splitter"),
				cmpCode: "split",
				iconCls: "gib_share_alt",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}, {
				xtype: "button",
				text: $o.getString ("Tabs"),
				cmpCode: "tab",
				iconCls: "gib_bookmark",
				iconAlign: "top",
				scale: "large",
				style: "margin-left: 5px;",
				handler: onClick
			}]
		});
		win.show ();
	},
	getCmp: function (id) {
		var me = this;
		var get = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id == id) {
						return layout;
					};
					var c = get (layout [a]);
					if (c) {
						return c;
					};
				};
			};
		};
		return get (me.value);
	},
	// Удаляет закладку (последнюю не удаляет)
	removeTab: function (id) {
		var me = this;
		var remove = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (a == "tab" && layout [a].items.length > 1) {
						for (var i = 0; i < layout [a].items.length; i ++) {
							var code; for (code in layout [a].items [i]) {break;};
							if (layout [a].items [i][code].id == id) {
								layout [a].items.splice (i, 1);
								return 1;
							};
						};
					};
					var i = remove (layout [a]);
					if (i) {
						return i;
					};
				};
			};
		};
		return remove (me.value);
	},
	replaceCmp: function (id, cmpNew) {
		var me = this;
		var replace = function (layout) {
			if (typeof (layout) != "object") {
				return;
			};
			for (var a in layout) {
				if (layout [a]) {
					if (layout [a].id == id && ["split", "tab", "olap", "treegrid", "card", "cardConf", "chart", "image", "frame", "panel"].indexOf (a) > -1) {
						delete layout [a];
						Ext.apply (layout, cmpNew);
						return;
					};
					replace (layout [a]);
				};
			};
		};
		replace (me.value);
	},
	addCmp: function (id) {
		var me = this;
		me.addCmpActive = 1;
		me.selectCmp ({success: function (code) {
			var win = Ext.create ("Ext.Window", {
				width: me.getCmpWidth (code),
				height: me.getCmpHeight (code), 
			    resizeable: false,
				border: false,
				title: me.getCmpName (code),
				iconCls: me.getCmpIconCls (code),
				style: "background-color: #ffffff",
				bodyStyle: "background-color: #ffffff",
				modal: 1,
				layout: "fit",
				items: {
					xtype: "$o.layout" + code,
					layoutDesigner: me,
					listeners: {
						aftersave: function () {
							me.addCmpActive = 0;
							win.close ();
							me.replaceCmp (id, this.getValue ());
							me.build ();
							me.fireEvent ("change", me.getValue ());
						}
					}
				}
			});
			win.show ();
		}});
	},
	getValue: function () {
		var me = this;
		var v = me.down ("codemirrortextarea[name='json']").getValue ();
		return v;
	},
	setValue: function (value) {
		var me = this;
		if (!value) {
			me.counter = 1;
			value = me.createEmpty ();
			value.designer = 1;
		} else
		if (typeof (value) == "string") {
			try {
				value = JSON.parse (value);
				if (!value.designer) {
					throw "invalid";
				};
			} catch (e) {
				var container = me.down ("*[region='center']");
				container.removeAll ();
				container.add ({
					layout: {
						type: "vbox",
						align: "center",
						pack: "center"
					}, 
					items: [{
						xtype: "label",
						text: $o.getString ("Sorry, we could not decode the source code layout")
					}]
				});
				me.treeStore.getRootNode ().removeAll ();
				me.down ("button[name='edit']").disable ();
				me.down ("button[name='create']").disable ();
				me.down ("button[name='delete']").disable ();
				me.down ("button[name='prevValue']").disable ();
				me.value = value;
				me.down ("codemirrortextarea[name='json']").setValue (value);
				me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
				return;
			};
		};
		me.value = value;
		me.initCounter (me.value);
		me.build ();
		me.prevValue = [];
		me.down ("button[name='prevValue']").disable ();
	},
	setReadOnly: function (ro) {
		var me = this;
		/*
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
		*/
	},
	/*
		each.card: {
			items: [{
				objectId: "[#id]" -> $o.createObject (card.object.cls, "local")
			}]
			-> readOnly: 1
		}
	*/
	updateLayoutTags: function (l) {
		var me = this;
		var noCls = null;
		var process = function (layout) {
			if (typeof (layout) == "object") {
				for (var a in layout) {
					if (layout [a]) {
						if (a == "card" && layout [a].object) {
							layout [a].readOnly = 1;
							var id = {};
							var tags = layout [a].object.length ? layout [a].object : [layout [a].object];
							for (var j = 0; j < tags.length; j ++) {
								var o = $o.createObject (tags [j].cls, "local");
								id [tags [j].tag] = o.get ("id");
							};
							function processItems (items) {
								for (var i = 0; i < items.length; i ++) {
									var item = items [i];
									if (item.objectId && item.objectId.substr && item.objectId.substr (0, 2) == "[#") {
										if (id [item.objectId]) {
											item.objectId = id [item.objectId];
										} else {
											noCls = layout [a].id;
										};
									};
									if (item.items) {
										processItems (item.items);
									};
								};
							};
							processItems (layout [a].items);
						} else
						if (a == "card" && !layout [a].object) {
							layout [a].items = [];
						} else
						/*
						if (Ext.isArray (layout [a])) {
							for (var i = 0; i < layout [a].length; i ++) {
								if (layout [a][i] && layout [a][i].substr && layout [a][i].substr (0, 2) == "[#") {
									layout [a][i] = 0;
								};
							};
						} else
						*/
						if (typeof (layout [a]) == "string") {
							if (layout [a].substr (0, 2) == "[#") {
								layout [a] = 0;
							};
						} else {
							process (layout [a]);
						};
					};
				};
				if (layout.items) {
					for (var i = 0; i < layout.items.length; i ++) {
						process (layout.items [i]);
					};
				};
			};
		};
		process (l);
		if (noCls) {
			common.message ($o.getString ("Class of object in the card is not defined") + ": " + noCls);
		};
		return l;
	},
	setHandlers: function () {
		var me = this;
		var buttons = me.query ("button[name='selectCmp']");
		for (var i = 0; i < buttons.length; i ++) {
			buttons [i].on ("click", function () {
				if (!me.addCmpActive) {
					me.addCmp (this.cmpId);
				};
			});
		};
	}
});
 