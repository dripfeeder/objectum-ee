Ext.define ("$o.QueryDesigner.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.querydesigner", "widget.$querydesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	initComponent: function () {
		let me = this;
		me.store = new Ext.data.ArrayStore ({
			fields: ["id", "text"],
			data: []
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
				    region: "north",
					height: 315,
					layout: "fit",
					border: 0,
				    items: {
				    	layout: "vbox",
				    	bodyPadding: 5,
				    	items: [{
				    		xtype: "compositefield",
				    		items: [{
								xtype: "$conffield", 
								fieldLabel: $o.getString ("Class"),
								name: "class", 
								width: 400,
								confRef: "class",
								choose: {
									type: "custom", fn: function () {
										let objectfield = this;
										dialog.getClass ({success: function (options) {
											objectfield.setValue (options.id);
										}});
									}
								},
								listeners: {
									change: function () {
										me.updateAttrsStore ();
										me.validator ();
										me.updateFrom ();
										me.updateClasses ();
									}
								}
							}, {
								xtype: "displayfield",
								value: $o.getString ("Alias") + ":",
								style: "margin-left: 5px",
								width: 70
							}, {
								xtype: "textfield",
								name: "alias",
								width: 100,
								listeners: {
									change: function () {
										me.updateAttrsStore ();
										me.validator ();
										me.updateFrom ();
										me.updateClasses ();
									}
								}
							}]
						}, {
							title: $o.getString ("Additional classes"),
					    	iconCls: "gi_cogwheels",
							flex: 1,
							width: "100%",
							layout: "hbox",
							name: "classes",
							autoScroll: true,
							bodyPadding: 5,
					    	tbar: [{
					    		text: $o.getString ("Add"),
					    		iconCls: "gi_circle_plus",
					    		handler: me.addClass,
					    		scope: me
					    	}]
				    	}]
				    }
				}, {
				    region: "center",
					layout: "border",
					border: 0,
				    items: [{
					    split: true,
						width: 300,
					    region: "west",
						layout: "fit",
						border: 1,
						bodyPadding: 1,
					    items: {
					    	title: $o.getString ("Attributes"),
					    	iconCls: "gi_file",
					    	xtype: "$queryselect",
							name: "attrs",
					    	listeners: {
					    		change: function (value) {
									let v = me.decodeQuery ();
									if (!v) {
										return;
									};
									v.select = value;
									me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
					    		}
					    	}
						}
					}, {
					    region: "center",
						layout: "fit",
						border: 0,
					    items: {
							layout: "border",
							border: 0,
						    items: [{
							    split: true,
								width: 300,
							    region: "west",
								layout: "fit",
								border: 1,
								bodyPadding: 1,
							    items: {
							    	title: $o.getString ("Filter"),
							    	iconCls: "gi_filter",
									xtype: "$layoutfilter",
									name: "filter",
									classMode: 1,
									listeners: {
										change: me.updateFilter,
										scope: me
									}
								}
							}, {
							    region: "center",
								layout: "fit",
								border: 1,
								bodyPadding: 1,
							    items: {
							    	title: $o.getString ("Sort"),
							    	iconCls: "gi_sort-by-order",
							    	name: "sort",
							    	xtype: "$querysort",
							    	listeners: {
							    		change: function (value) {
											let v = me.decodeQuery ();
											if (!v) {
												return;
											};
											v.order = value;
											me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
							    		}
							    	}
							    }
							}]
					    }
					}]
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
		this.callParent (arguments);
	},
	decodeQuery: function () {
		let me = this;
		let container = me.down ("*[name=constructor]");
		container.getEl ().unmask (true);
		let v = me.down ("codemirrortextarea[name='json']").getValue ();
		try {
			v = JSON.parse (v);
			return v;
		} catch (e) {
			container.getEl ().mask ($o.getString ("Sorry, we could not decode the source code layout"));
			me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
		};
	},
	updateFrom: function () {
		let me = this;
		// class
		let selectedClass = me.down ("*[name=class]").getValue ();
		if (!selectedClass) {
			return;
		};
		let selectedClassCode = $o.getClass (selectedClass).getFullCode ();
		let v = me.decodeQuery ();
		if (!v) {
			return;
		};
		v.from = [{"a": selectedClassCode}];
		// classes
		let sc = me.down ("*[name=classes]").query ("panel");
		for (let i = 0; i < sc.length; i ++) {
			let n = sc [i].n;
			let clsId = me.down ("*[name=class_" + n + "]").getValue ();
			let attr1 = me.down ("*[name=attr1_" + n + "]").getValue ();
			let attr2 = me.down ("*[name=attr2_" + n + "]").getValue ();
			let join = me.down ("*[name=join_" + n + "]").getValue ();
			if (clsId && attr1 && attr2 && join) {
				let cls = {};
				cls [n] = $o.getClass (clsId).getFullCode ();
				v.from = v.from.concat (join, cls, "on");
				let a1 = {};
				a1 [attr1.split (":")[0]] = attr1.split (":")[1];
				let a2 = {};
				a2 [attr2.split (":")[0]] = attr2.split (":")[1];
				v.from.push ([a1, "=", a2]);
			};
		};
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
	},
	addClass: function (n) {
		if (typeof (n) == "object") {
			n = null;
		};
		let me = this;
		let classes = me.down ("*[name=classes]");
		if (!n) {
			let panels = classes.query ("panel");
			let aliases = "abcdefghijklmnopqrstuvwxyz";
			for (let i = 0; i < aliases.length; i ++) {
				let has = 0;
				for (let j = 0; j < panels.length; j ++) {
					if (panels [j].n == aliases [i]) {
						has = 1;
						break;
					};
				};
				if (!has && aliases [i] != me.down ("*[name=alias]").getValue ()) {
					n = aliases [i];
					break;
				};
			};
		};
		classes.add ({
			layout: "vbox",
			bodyPadding: 5,
			width: 300,
			n: n,
			style: "margin-right: 5px",
			items: [{
				xtype: "$conffield", 
				fieldLabel: $o.getString ("Class"),
				width: "100%",
				labelWidth: 100,
				name: "class_" + n, 
				confRef: "class",
				choose: {
					type: "layout", attr: "olap.id", width: 500, height: 400, layout: {
						treegrid: {
							id: "olap",
							view: "system.classes",
						    fields: {
						        id: "id",
						        parent: "parent_id"
						    },
						    filter: {
						        fn: function () {return ["id", ">=", 1000, "and", "end_id", "=", 2147483647]}
						    }
						}
					}
				},
				listeners: {
					change: function () {
						me.updateAttrsStore ();
						let attr1 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Attribute") + " 1']");
						let attr2 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Attribute") + " 2']");
						if (!attr1.getValue () && !attr2.getValue ()) {
							let cls1 = me.down ("*[name=class]").getValue ();
							let cls2 = this.getValue ();
							if (cls1 && cls2) {
								let attrs1 = $o.getClass (cls1).attrs;
								let alias1 = me.down ("*[name=alias]").getValue ();
								let alias2 = this.up ("*").down ("*[fieldLabel='" + $o.getString ("Alias") + "']").getValue ();
								for (let attr in attrs1) {
									let ca = attrs1 [attr];
									if (ca.get ("type") == cls2) {
										attr1.setValue (alias1 + ":" + attr);
										attr2.setValue (alias2 + ":id");
										break;
									};
								};
							};
						};
						me.validator ();
						me.updateFrom ();
						me.updateClasses ();
					}
				}
			}, {
				xtype: "textfield",
				fieldLabel: $o.getString ("Alias"),
				name: "alias_" + n,
				value: n,
				listeners: {
					change: function () {
						me.updateAttrsStore ();
						me.validator ();
						me.updateFrom ();
						me.updateClasses ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute") + " 1",
				name: "attr1_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: me.store,
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Attribute") + " 2",
				name: "attr2_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: me.store,
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "combo",
				fieldLabel: $o.getString ("Union"),
				name: "join_" + n,
				width: "100%",
				labelWidth: 100,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [["left-join", $o.getString ("External")], ["inner-join", $o.getString ("Internal")]]
				}),
				value: "left-join",
				valueField: "id",
				displayField: "text",
				listeners: {
					select: function () {
						me.validator ();
						me.updateFrom ();
					}
				}
			}, {
				xtype: "button",
				text: $o.getString ("Remove"),
				iconCls: "gi_circle_minus",
				style: "margin-top: 5px",
				handler: function () {
					let p = this.up ("panel");
					classes.remove (p);
					classes.doLayout ();
					me.updateAttrsStore ();
					me.validator ();
					me.updateFrom ();
					me.updateClasses ();

				}
			}]
		});
		classes.doLayout ();
	},
	updateFilter: function (value) {
		let me = this;
		let v = me.decodeQuery ();
		if (!v) {
			return;
		};
		v.where = value;
		me.down ("codemirrortextarea[name='json']").setValue (JSON.stringify (v, null, "\t"));
	},
	updateClasses: function () {
		let me = this;
		let classArr = [], classAliases = {}, aliases = [];
		function setAlias (clsId, alias) {
			classAliases [clsId] = alias;
			let cls = $o.getClass (clsId);
			if (cls.get ("parent")) {
				setAlias (cls.get ("parent"), alias);
			};
		};
		let clsId = me.down ("*[name=class]").getValue (), cls;
		if (clsId) {
			classArr.push (clsId);
			setAlias (clsId, me.down ("*[name=alias]").getValue ());
			aliases.push (me.down ("*[name=alias]").getValue ());
		};
		let classes = me.down ("*[name=classes]").query ("panel");
		for (let i = 0; i < classes.length; i ++) {
			let clsId = me.down ("*[name=class_" + classes [i].n + "]").getValue ();
			let alias = me.down ("*[name=alias_" + classes [i].n + "]").getValue ();
			if (clsId) {
				classArr.push (clsId);
				setAlias (clsId, alias);
				aliases.push (alias);
			};
		};
		me.down ("*[name=attrs]").setClasses (classArr, classAliases, aliases);
		me.down ("*[name=filter]").setClasses (classArr, classAliases, aliases);
		me.down ("*[name=sort]").setClasses (classArr, classAliases, aliases);
	},
	validator: function () {
		let me = this;
	},
	clear: function () {
		let me = this;
		me.down ("*[name=class]").setValue (null);
		me.down ("*[name=classes]").removeAll ();
		me.down ("*[name=attrs]").setValue (null);
		me.down ("*[name=filter]").setValue (null);
		me.down ("*[name=sort]").setValue (null);
	},
	buildForm: function (v) {
		let me = this;
		v = v || {};
		me.down ("*[name=alias]").setValue ("a");
		if (v.from && v.from.length) {
			let clsCode; for (clsCode in v.from [0]) {break;};
			me.down ("*[name=alias]").setValue (clsCode);
			clsCode = v.from [0][clsCode];
			let cls = $o.getClass (clsCode);
			me.down ("*[name=class]").setValue (cls.get ("id"));
			for (let i = 1; i < v.from.length; i += 4) {
				let alias; for (alias in v.from [i + 1]) {break;};
				let n = alias;
				me.addClass (n);
				let clsAdd = $o.getClass (v.from [i + 1][alias]);
				me.down ("*[name=class_" + n + "]").setValue (clsAdd.get ("id"));
				let attr1 = v.from [i + 3][0];
				for (alias in attr1) {
					me.down ("*[name=attr1_" + n + "]").setValue (alias + ":" + attr1 [alias]);
					break;
				};
				let attr2 = v.from [i + 3][2];
				for (alias in attr2) {
					me.down ("*[name=attr2_" + n + "]").setValue (alias + ":" + attr2 [alias]);
					break;
				};
				if (v.from [i] == "left-join") {
					me.down ("*[name=join_" + n + "]").setValue ("left-join");
				} else {
					me.down ("*[name=join_" + n + "]").setValue ("inner-join");
				};
			};
		};
		if (v.select) {
			me.down ("*[name=attrs]").setValue (v.select);
		};
		if (v.where) {
			me.down ("*[name=filter]").setValue (v.where);
		};
		if (v.order) {
			me.down ("*[name=sort]").setValue (v.order);
		};
	},
	getValue: function () {
		let me = this;
		return me.down ("codemirrortextarea[name='json']").getValue ();
	},
	updateAliases: function (v) {
		if (!v) {
			return;
		};
		let me = this;
		let aliases = {}, alias;
		if (v.from) {
			for (alias in v.from [0]) {break;};
			aliases [alias] = "a";
			let n = 1;
			for (let i = 1; i < v.from.length; i += 4) {
				for (alias in v.from [i + 1]) {break;};
				aliases [alias] = "c" + n;
				n ++;
			};
			function update (o) {
				if (!o) {
					return;
				};
				if (Ext.isArray (o)) {
					for (let i = 0; i < o.length; i ++) {
						update (o [i]);
					};
				} else
				if (typeof (o) == "object") {
					for (alias in o) {break;};
					if (alias != aliases [alias]) {
						o [aliases [alias]] = o [alias];
						delete o [alias];
					};
				};
			};
			update (v.select);
			update (v.from);
			update (v.where);
			update (v.order);
		};
	},
	setValue: function (value) {
		let me = this;
		let container = me.down ("*[name=constructor]");
		container.getEl ().unmask (true);
		if (!value) {
			value = {
				designer: 1
			};
		};
		let text = typeof (value) == "object" ? JSON.stringify (value, null, "\t") : value;
		me.down ("codemirrortextarea[name='json']").setValue (text);
		if (typeof (value) == "string") {
			try {
				value = JSON.parse (value);
				if (!value.designer) {
					throw "invalid";
				};
			} catch (e) {
				container.getEl ().mask ($o.getString ("Sorry, we could not decode the source code layout"));
				me.down ("tabpanel").setActiveTab (me.down ("panel[name=source]"));
				return;
			};
		};
		me.clear ();
		//me.updateAliases (value);
		me.buildForm (value);
		me.down ("codemirrortextarea[name='json']").setValue (text);
	},
	setReadOnly: function (ro) {
		let me = this;
		/*
		if (ro) {
			me.disable ();
		} else {
			me.enable ();
		};
		me.ro = ro;
		*/
	},
	updateAttrsStore: function () {
		let me = this;
		let data = [];
		let classes = me.query ("*[confRef=class]");
		let aliases = [me.down ("*[name=alias]")].concat (me.query ("*[fieldLabel=" + $o.getString ("Alias") + "]"));
		for (let i = 0; i < classes.length; i ++) {
			if (!classes [i].getValue () || !aliases [i].getValue ()) {
				continue;
			};
			let alias;
			for (let j = 0; j < aliases.length; j ++) {
				if ((classes [i].name.split ("_") == 1 && aliases [j].name.split ("_") == 1) ||
					(classes [i].name.split ("_")[1] == aliases [j].name.split ("_")[1])
				) {
					alias = aliases [j].getValue ();
					break;
				};
			};
			data.push ([alias + ":id", alias + ":id"]);
			let clsId = classes [i].getValue ();
			let cls = $o.getClass (clsId);
			for (let attr in cls.attrs) {
				let ca = cls.attrs [attr];
				if (ca.get ("type") == 2 || ca.get ("type") == 12 || ca.get ("type") >= 1000) {
					data.push ([alias + ":" + attr, alias + ":" + ca.toString ()]);
				};
			};
		};
		me.store.loadData (data);
	}
});

