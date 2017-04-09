Ext.define ("$o.CardDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.carddesigner", "widget.$carddesigner"],
	layout: "fit",
	border: 0,
	defaults: {
		border: 0
	},
	initComponent: function () {
		let me = this;
		me.counter = 1;
		me.data = {};
		me.treeStore = Ext.create ('Ext.data.TreeStore', {
	    	autoSync: true,
			root: {
				expanded: true,
				children: []
			}
		});
	    me.storeAttrs = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
	    me.storeViewAttrs = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
		});
		me.items = {
			layout: "border",
			border: false,
			style: "margin: 2px",
			defaults: {
				border: false
			},
			items: [{
			    split: true,
			    region: "west",
				width: "50%",
				layout: "fit",
			    items: {
			    	title: $o.getString ("Navigator"),
			    	iconCls: "gi_search",
					xtype: "treepanel",
					name: "tree",
					store: me.treeStore,
					selModel: Ext.create ("Ext.selection.TreeModel", {
						mode: "SINGLE",
						listeners: {
							selectionchange: {
								fn: me.selectionChange,
								scope: me
							}
						}
					}),
					rootVisible: false,
					viewConfig: {
		                plugins: {
		                    ptype: "treeviewdragdrop",
		                    containerScroll: true
		                },
						listeners: {
							beforedrop: function (node, data, model, pos, dropHandlers) {
								if (data.records [0].get ("text").substr (0, 5) != "Поле:" && model.parentNode.get ("text").substr (0, 10) == "Составное:") {
									// В составное поле можно класть только "Поле:"
									return false;
								} else {
									return true;
								};
							}
						}		                
		            },					
					listeners: {
						cellcontextmenu: function (tree, td, cellIndex, record, tr, rowIndex, e, eOpts) {
							me.down ("treepanel").getSelectionModel ().deselectAll ();
						}
					}
			    }
			},{
			    region: "center",
				layout: "fit",
			    items: {
			    	title: $o.getString ("Options"),
			    	iconCls: "gi_file",
			    	layout: "vbox",
			    	name: "card",
					hidden: true,
			    	bodyPadding: 5,
			    	items: [{
						xtype: "combo",
						fieldLabel: $o.getString ("Attribute"),
						name: "attr",
						width: "100%",
						mode: "local",
						queryMode: "local",
						editable: false,
						store: me.storeAttrs,
						valueField: "id",
						displayField: "text",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "textfield",
						fieldLabel: $o.getString ("Name"),
						width: "100%",
						name: "name",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Name width"),
						width: 200,
						name: "labelWidth",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "fieldcontainer",
						layout: "hbox",
						width: "100%",
						items: [{
							xtype: "numberfield",
							fieldLabel: $o.getString ("Width"),
							width: 200,
							name: "width",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "numberfield",
							fieldLabel: $o.getString ("Height"),
							width: 150,
							labelWidth: 50,
							style: "margin-left: 5px",
							name: "height",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}]
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Min value"),
						width: 200,
						name: "minValue",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "numberfield",
						fieldLabel: $o.getString ("Max value"),
						width: 200,
						name: "maxValue",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Read only"),
						name: "readOnly",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Show time"),
						name: "showTime",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "checkbox",
						fieldLabel: $o.getString ("Editor") + " HTML",
						name: "htmlEditor",
						cardDesigner: me,
						listeners: {
							change: me.onChange
						}
					}, {
						xtype: "fieldset",
						title: $o.getString ("Object selection"),
						name: "choose",
						width: "100%",
						collapsible: 1,
						items: [{
							xtype: "$conffield", 
							fieldLabel: $o.getString ("View"),
							labelWidth: 135,
							name: "view", 
							anchor: "100%",
							confRef: "view",
							choose: {
								type: "custom", fn: function () {
									let me = this;
									dialog.getView ({success: function (options) {
										me.setValue (options.id);
									}});
								}
							},
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "combo",
							fieldLabel: $o.getString ("View attribute"),
							labelWidth: 135,
							name: "viewAttr",
							anchor: "100%",
							mode: "local",
							queryMode: "local",
							editable: false,
							store: me.storeViewAttrs,
							valueField: "id",
							displayField: "text",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							fieldLabel: $o.getString ("Action before selection"),
							labelWidth: 135,
							xtype: "$conffield", 
							name: "filterAction", 
							anchor: "100%",
							confRef: "action",
							choose: {
								type: "custom", fn: function () {
									let f = this;
									dialog.getAction ({success: function (options) {
										f.setValue (options.id);
									}});
								}

							},
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}, {
							xtype: "fieldcontainer",
							layout: "hbox",
							width: "100%",
							items: [{
								xtype: "numberfield",
								fieldLabel: $o.getString ("Width"),
								width: 190,
								labelWidth: 90,
								name: "viewWidth",
								cardDesigner: me,
								listeners: {
									change: me.onChange
								}
							}, {
								xtype: "numberfield",
								fieldLabel: $o.getString ("Height"),
								width: 150,
								labelWidth: 50,
								style: "margin-left: 5px",
								name: "viewHeight",
								cardDesigner: me,
								listeners: {
									change: me.onChange
								}
							}]
						}, {
							xtype: "checkbox",
							fieldLabel: $o.getString ("Hide actions"),
							name: "hideActions",
							cardDesigner: me,
							listeners: {
								change: me.onChange
							}
						}]
			    	}]
			    }
			}]
		};
		me.tbar = [{
			text: $o.getString ("Add field"),
			name: "addField",
			iconCls: "gi_circle_plus",
			handler: me.addField,
			scope: me
		}, {
			text: $o.getString ("Add composite field"),
			name: "addComposite",
			iconCls: "gi_circle_plus",
			handler: me.addComposite,
			scope: me
		}, {
			text: $o.getString ("Add group"),
			name: "addGroup",
			iconCls: "gi_circle_plus",
			handler: me.addGroup,
			scope: me
		}, {
			text: $o.getString ("Remove"),
			disabled: true,
			name: "remove",
			iconCls: "gi_circle_minus",
			handler: me.remove,
			scope: me
		}];
		me.bbar = [{
			text: $o.getString ("Preview"),
			iconCls: "gi_search",
			handler: me.preview,
			scope: me
		}];
		me.on ("afterrender", function () {
			me.setClassId (me.classId);
			me.setValue (me.value);
		});
		this.callParent (arguments);
	},
	addField: function () {
		let me = this;
		let tree = me.down ("treepanel");
		let sm = tree.getSelectionModel ();
		let node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
			if (node.get ("text").substr (0, 5) == ($o.getString ("Field") + ":")) {
				node = node.parentNode;
			};
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        let rec = {
        	id: me.counter ++, text: $o.getString ("Field") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	addComposite: function () {
		let me = this;
		let tree = me.down ("treepanel");
		let sm = tree.getSelectionModel ();
		let node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        let rec = {
        	id: me.counter ++, text: $o.getString ("Composite") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	addGroup: function () {
		let me = this;
		let tree = me.down ("treepanel");
		let sm = tree.getSelectionModel ();
		let node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = tree.getStore ().getRootNode ();
        };
        node.expand ();
        let rec = {
        	id: me.counter ++, text: $o.getString ("Group") + ":", leaf: true
        };
        node.appendChild (rec);
	},
	selectionChange: function () {
		let me = this;
		let tree = me.down ("treepanel");
		let sm = tree.getSelectionModel ();
       	me.down ("*[name=addField]").enable ();
    	me.down ("*[name=addComposite]").enable ();
    	me.down ("*[name=addGroup]").enable ();
		if (sm.hasSelection ()) {
			me.down ("*[name=remove]").enable ();
			me.down ("*[name=card]").show ();
            let node = sm.getSelection ()[0];
            let kind = "field";
            if (node.get ("text").substr (0, 10) == ($o.getString ("Composite") + ":")) {
            	kind = "composite";
			};            
            if (node.get ("text").substr (0, 7) == ($o.getString ("Group") + ":")) {
            	kind = "group";
            };
            if (node.get ("text").substr (0, 6) == "xtype:") {
            	kind = "xtype";
            };
            if (kind == "field") {
            	me.down ("*[name=addComposite]").disable ();
            	me.down ("*[name=addGroup]").disable ();
            };
            if (kind == "composite") {
            	me.down ("*[name=addComposite]").disable ();
            	me.down ("*[name=addGroup]").disable ();
            };
            if (kind == "field") {
	            me.down ("*[name=attr]").show ();
            };
            if (kind == "composite") {
	            me.down ("*[name=attr]").hide ();
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").show ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=height]").hide ();
	            me.down ("*[name=showTime]").hide ();
	            me.down ("*[name=minValue]").hide ();
	            me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
            };
            if (kind == "group") {
	            me.down ("*[name=attr]").hide ();
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").hide ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=height]").show ();
	            me.down ("*[name=showTime]").hide ();
	            me.down ("*[name=minValue]").hide ();
	            me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
            };
            me.updateCard (node.get ("id"), kind);
		} else {
			me.down ("*[name=remove]").disable ();
			me.down ("*[name=card]").hide ();
		};
	},
	updateCard: function (id, kind) {
		let me = this;
		me.selectedId = id;
		me.data [id] = me.data [id] || {};
		let o = me.data [id];
		if (o.attr && (!me.tag || o.tag != me.tag)) {
	        me.down ("*[name=card]").disable ();
			return;
		} else {
	        me.down ("*[name=card]").enable ();
		};
		if (kind == "xtype") {
	        me.down ("*[name=card]").disable ();
			return;
		};
        me.down ("*[name=name]").setValue (o.name);
        me.down ("*[name=width]").setValue (o.width);
        me.down ("*[name=labelWidth]").setValue (o.labelWidth);
        me.down ("*[name=height]").setValue (o.height);
		if (kind == "field") {
	        me.down ("*[name=attr]").setValue (o.attr);
	        me.down ("*[name=showTime]").setValue (o.showTime);
	        me.down ("*[name=minValue]").setValue (o.minValue);
	        me.down ("*[name=maxValue]").setValue (o.maxValue);
	        me.down ("*[name=htmlEditor]").setValue (o.htmlEditor);
	        me.down ("*[name=readOnly]").setValue (o.readOnly);
	        if (o.attr) {
	            me.down ("*[name=name]").show ();
	            me.down ("*[name=labelWidth]").show ();
	            me.down ("*[name=width]").show ();
	            me.down ("*[name=readOnly]").show ();
	        	if (me.attrs [o.attr].get ("type") >= 1000) {
		            me.down ("*[name=choose]").show ();
			        me.down ("*[name=view]").setValue (o.view ? $o.getView (o.view).get ("id") : null);
			        me.down ("*[name=viewAttr]").setValue (o.viewAttr);
			        me.down ("*[name=filterAction]").setValue (o.filterAction ? $o.getAction (o.filterAction).get ("id") : null);
			        me.down ("*[name=viewWidth]").setValue (o.viewWidth);
			        me.down ("*[name=viewHeight]").setValue (o.viewHeight);
			        me.down ("*[name=hideActions]").setValue (o.hideActions);
		       	} else {
		            me.down ("*[name=choose]").hide ();
		       	};
	            if (me.attrs [o.attr].get ("type") == 3) {
	            	me.down ("*[name=showTime]").show ();
	            	me.down ("*[name=width]").hide ();
	            } else {
	            	me.down ("*[name=showTime]").hide ();
	            	me.down ("*[name=width]").show ();
	            };
	            if (me.attrs [o.attr].get ("type") == 2) {
	            	me.down ("*[name=minValue]").show ();
	            	me.down ("*[name=maxValue]").show ();
	            } else {
	            	me.down ("*[name=minValue]").hide ();
	            	me.down ("*[name=maxValue]").hide ();
	            };
	            if (me.attrs [o.attr].get ("type") == 1) {
	            	me.down ("*[name=height]").show ();
	            	me.down ("*[name=htmlEditor]").show ();
	            } else {
	            	me.down ("*[name=height]").hide ();
	            	me.down ("*[name=htmlEditor]").hide ();
	            };
		    } else {
	            me.down ("*[name=name]").hide ();
	            me.down ("*[name=labelWidth]").hide ();
	            me.down ("*[name=width]").hide ();
	            me.down ("*[name=height]").hide ();
	            me.down ("*[name=showTime]").hide ();
            	me.down ("*[name=minValue]").hide ();
            	me.down ("*[name=maxValue]").hide ();
	            me.down ("*[name=htmlEditor]").hide ();
	            me.down ("*[name=readOnly]").hide ();
	            me.down ("*[name=choose]").hide ();
		    };
	    };
	},
	onChange: function () {
		let me = this.cardDesigner;
		let field = this;
		me.data [me.selectedId] = me.data [me.selectedId] || {};
		let o = me.data [me.selectedId];
		o.tag = me.tag;
		o.classId = me.classId;
		if (field.name == "name") {
			o.name = field.getValue ();
			let node = me.down ("treepanel").getSelectionModel ().getSelection ()[0];
			let tokens = node.get ("text").split (":");
			node.set ("text", tokens [0] + ": " + o.name);
		};
		if (field.name == "labelWidth") {
			o.labelWidth = field.getValue ();
		};
		if (field.name == "width") {
			o.width = field.getValue ();
		};
		if (field.name == "height") {
			o.height = field.getValue ();
		};
		if (field.name == "showTime") {
			o.showTime = field.getValue ();
		};
		if (field.name == "minValue") {
			o.minValue = field.getValue ();
		};
		if (field.name == "maxValue") {
			o.maxValue = field.getValue ();
		};
		if (field.name == "htmlEditor") {
			o.htmlEditor = field.getValue ();
		};
		if (field.name == "readOnly") {
			o.readOnly = field.getValue ();
		};
		if (field.name == "viewWidth") {
			o.viewWidth = field.getValue ();
		};
		if (field.name == "viewHeight") {
			o.viewHeight = field.getValue ();
		};
		if (field.name == "hideActions") {
			o.hideActions = field.getValue ();
		};
		if (field.name == "attr") {
			o.attr = field.getValue ();
			me.updateCard (me.selectedId, "field");
			let cls = $o.getClass (me.classId);
			let data = [];
			for (let i = 0; i < cls.attrsArray.length; i ++) {
				let ca = cls.attrsArray [i];
				let has = 0;
				for (let id in me.data) {
					if (me.data [id].attr == ca.get ("code") && me.data [id].tag == me.tag) {
						has = 1;
					};
				};
				if (!has) {
					data.push ([ca.get ("code"), ca.toString ()]);
				};
			};
			me.storeAttrs.loadData (data);
			if (!me.down ("*[name=name]").getValue ()) {
				me.down ("*[name=name]").setValue (o.attr ? me.attrs [o.attr].get ("name") : null);
			};
		};
		if (field.name == "view") {
			let prevView = o.view;
			o.view = field.getValue () ? $o.getView (field.getValue ()).getFullCode () : null;
			if (prevView != o.view) {
				me.down ("*[name=viewAttr]").setValue (null);
			};
			let data = [];
			if (field.getValue ()) {
				let v = $o.getView (field.getValue ());
				if (v.get ("layout")) {
					data = me.layoutCard.getViewCmpAttrs (v.get ("layout"));
				} else {
    				for (let attr in v.attrs) {
    					data.push ([attr, v.attrs [attr].toString ()]);
    				};
    			};
			};
			me.storeViewAttrs.loadData (data);
		};
		if (field.name == "viewAttr") {
			o.viewAttr = field.getValue ();
		};
		if (field.name == "filterAction") {
			o.filterAction = field.getValue () ? $o.getAction (field.getValue ()).getFullCode () : null;
		};
	},
	setClassId: function (classId, tag) {
		let me = this;
		me.classId = classId;
		me.tag = tag;
		let data = [];
		if (classId) {
			let cls = $o.getClass (classId);
			me.attrs = cls.attrs;
			for (let i = 0; i < cls.attrsArray.length; i ++) {
				let ca = cls.attrsArray [i];
				data.push ([ca.get ("code"), ca.toString ()]);
			};
		};
		me.storeAttrs.loadData (data);
		/*
		me.data = {};
		let root = me.down ("treepanel").getRootNode ();
		for (let i = root.childNodes.length - 1; i >= 0; i --) {
			root.childNodes [i].remove ();
		};
		*/
	},
	getValue: function (options) {
		options = options || {};
		let me = this;
		let items = [];
		let getNodes = function (parent, items) {
			for (let i = 0; i < parent.childNodes.length; i ++) {
				let node = parent.childNodes [i];
				let o = me.data [node.get ("id")] || {};
				let oo = {};
				if (o.width) {
					oo.width = o.width;
				} else {
					oo.anchor = "100%";
				};
				switch (node.get ("text").split (":")[0]) {
				case $o.getString ("Field"):
					if (o.attr) {
						let cls = me.getClsByTag (o.tag);
						let attrs = cls.attrs;
						let typeId = attrs [o.attr].get ("type");
						oo.fieldLabel = o.name;
						oo.attr = o.attr;
						if (options.preview) {
							oo.objectId = $o.createObject (o.classId, "local").get ("id");
						} else {
							if (me.layoutCard.value.card.object.cmpAttr) {
								let tokens = o.tag.split (".");
								oo.id = tokens [0];
								oo.attr = tokens [1] + "." + o.attr;
							} else {
								oo.objectId = o.tag;
							};
						};
						if (typeId == 1) {
							if (o.height) {
								oo.xtype = "textarea";
								oo.height = o.height;
							};
							if (o.htmlEditor) {
								oo.xtype = "htmleditor";
								oo.height = oo.height || 100;
							};
						};
						if (o.labelWidth) {
							oo.labelWidth = o.labelWidth;
						};
						oo.readOnly = o.readOnly || undefined;
						if (typeId == 3) {
							oo.timefield = o.showTime ? true : false;
							oo.width = oo.labelWidth ? (oo.labelWidth + 100) : 200;
							if (o.showTime) {
								oo.width += 100;
							};
							delete oo.anchor;
						};
						if (typeId == 2) {
							oo.minValue = o.minValue;
							oo.maxValue = o.maxValue;
							if (o.width) {
								oo.width = o.width;
							} else {
								oo.width = oo.labelWidth ? (oo.labelWidth + 100) : 200;
							};
							delete oo.anchor;
						};
						if (typeId >= 1000) {
							oo.choose = {
								type: "view", id: o.view, attr: o.viewAttr,
								width: o.viewWidth || undefined,
								height: o.viewHeight || undefined,
								hideActions: o.hideActions ? true : false
							};
							if (o.filterAction) {
								oo.listeners = oo.listeners || {};
								oo.listeners.beforechoose = o.filterAction;
							};
						};
					} else {
						oo.empty = 1;
					};
					break;
				case $o.getString ("Composite"):
					oo.fieldLabel = o.name;
					oo.xtype = "fieldcontainer";
					oo.layout = "hbox";
					if (o.labelWidth) {
						oo.labelWidth = o.labelWidth;
					};
					break;
				case $o.getString ("Group"):
					oo.title = o.name;
					oo.height = o.height ? o.height : undefined;
					oo.xtype = "fieldset";
					oo.collapsible = 1;
					break;
				case "xtype":
					oo = o.item;
					break;
				};
				if (node.childNodes.length) {
					oo.items = [];
					getNodes (node, oo.items);
					if (node.get ("text").split (":")[0] == $o.getString ("Composite")) {
						for (let j = 0; j < oo.items.length; j ++) {
							let b = oo.items [j];
							//b.hideLabel = true;
							b.style = "margin-right: 10px";
							if (b.attr && !b.fieldLabel) {
								let typeId = me.attrs [b.attr].get ("type");
								if (typeId == 2 || typeId == 3) {
									b.width = 100;
								};
								if (typeId == 3 && b.timefield) {
									b.width = 200;
								};
							};
						};
					};
				};
				if (!oo.empty) {
					items.push (oo);
				};
			};
		};
		getNodes (me.treeStore.getRootNode (), items);
		return items;
	},
	getClsByTag: function (tag) {
		let me = this;
		let oo = me.layoutCard.value.card.object;
		for (let i = 0; i < oo.length; i ++) {
			if (oo [i].tag == tag) {
				let cls = $o.getClass (oo [i].cls);
				return cls;
			};
		};
	},
	setValue: function (items) {
		let me = this;
		items = items || [];
		let root = me.down ("treepanel").getRootNode ();
		for (let i = root.childNodes.length - 1; i >= 0; i --) {
			root.childNodes [i].remove ();
		};
		function getChildren (items, node) {
			for (let i = 0; i < items.length; i ++) {
				let item = items [i];
				let id = me.counter ++;
				let o;
				if (item.xtype == "fieldcontainer") {
					o = {
				        id: id, text: $o.getString ("Composite") + ": " + (item.fieldLabel || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: item.fieldLabel, width: item.width, labelWidth: item.labelWidth
					};
				} else
				if (item.xtype == "fieldset") {
					o = {
				        id: id, text: $o.getString ("Group") + ": " + (item.title || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: item.title, width: item.width, height: item.height
					};
				} else 
				if (!item.objectId) {
					o = {
				        id: id, text: "xtype: " + (item.xtype || ""), leaf: !(item.items && item.items.length)
					};
					me.data [id] = {
						name: "xtype: " + (item.xtype || ""), item: item
					};
				} else {
					let cls = me.getClsByTag (item.objectId);
					let attrs = cls.attrs;
					let attr = attrs [item.attr] || attrs [item.attr.split (".")[1]];
			        o = {
			        	id: id, text: $o.getString ("Field") + ": " + (item.fieldLabel || attr.get ("name")), leaf: true
			        };
					me.data [id] = {
						name: item.fieldLabel, width: item.width, height: item.height, 
						showTime: item.timefield ? true : false,
						minValue: item.minValue,
						maxValue: item.maxValue,
						htmlEditor: item.xtype == "htmleditor" ? true : false,
						labelWidth: item.labelWidth,
						readOnly: item.readOnly,
						attr: attr.get ("code"),
						tag: item.objectId,
						classId: cls.get ("id")
					};
					if (item.choose) {
						me.data [id].viewWidth = item.choose.width;
						me.data [id].viewHeight = item.choose.height;
						me.data [id].view = item.choose.id;
						me.data [id].viewAttr = item.choose.attr;
						me.data [id].filterAction = item.listeners ? item.listeners.beforechoose : undefined;
						me.data [id].hideActions = item.choose.hideActions;
					};
					for (let j = 0; j < me.storeAttrs.getCount (); j ++) {
						if (me.storeAttrs.getAt (j).get ("id") == attr.get ("code")) {
							me.storeAttrs.removeAt (j);
							break;
						};
					};
				};
				if (item.items && item.items.length) {
					o.children = [];
					getChildren (item.items, o.children);
				};
				if (node == root) {
					node.appendChild (o);
				} else {
					node.push (o);
				};
			};
		};
		getChildren (items, root);
	},
	remove: function () {
		let me = this;
		let tree = me.down ("treepanel");
		let sm = tree.getSelectionModel ();
        let node = sm.getSelection ()[0];
        let parentNode = node.parentNode;
        delete me.data [node.get ("id")];
        me.down ("*[name=attr]").setValue (null);
		node.remove ();
		if (parentNode != tree.getStore ().getRootNode () && !parentNode.childNodes.length) {
			parentNode.set ("leaf", true);
		};
	},
	preview: function (classId) {
		let me = this;
		let win = Ext.create ("Ext.Window", {
			width: 800,
			height: 600,
			layout: "fit",
		    bodyPadding: 5,
			border: false,
			resizable: true,
			closable: true,
			modal: true,
			items: {
				xtype: "$layout",
				$layout: {
					card: {
						hideToolbar: 1,
						items: me.getValue ({preview: 1})
					}
				}
			}
		});
		win.show ();
	}
});
