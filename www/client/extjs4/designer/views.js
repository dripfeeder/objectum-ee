Ext.define ("$o.Views.Widget", {
	extend: "$o.Layout.Widget",
	alias: ["widget.$o.views", "widget.$views"],
	initComponent: function () {
		var me = this;
		me.$layout = {
			split: {
				orientation: "horizontal",
				width: 290,
				pages: [{
					treegrid: {
						id: "olap",
						view: "system.views",
						fields: {
							id: "id",
							parent: "parent_id"
						},
						filter: {
				    		fn: function () {return ["system", "is null", "and", "end_id", "=", 2147483647]},
				    		all: true
	//						fn: function () {return ["system", "is null"]},
	//						childsFn: function () {return [{"___childs": "___fsystem"}, "is null", "and", {"___childs": "___fend_id"}, "=", 2147483647]}
						},
						actions: [{
							fn: function () {
								$zu.dialog.getNameAndCode ({title: $o.getString ("View", ":", "Adding"), success: function (name, code) {
									var tr = $o.startTransaction ({description: 'Create view'});
									var o = $o.createView ();
									o.set ("parent", this.getCurrentValue ("id"));
									o.set ("name", name);
									o.set ("code", code);
									o.sync ();
									$o.commitTransaction (tr);
									this.refresh ({
										callback: function (record, store, success) {
											if (success) {
												this.selectRow ({filter: ["&id", "=", o.get ("id")]});
											};
										},
										scope: this
									});
								}, scope: this});
							},  
							caption: "create",
							icon: "new"
						}, {
							fn: function () {
								common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
									if (btn == "yes") {
										var id = this.getCurrentValue ("id");
										var tr = $o.startTransaction ({description: 'Remove view ' + id});
										var o = $o.getView (id);
										o.remove ();
										o.sync ();
										$o.commitTransaction (tr);
										this.refresh ();
									};
								}});
							},
							active: {
								fn: function () {
									var r = this.getCurrentValue ("id") && !this.getCurrentValue ("schema_id");
									return r;
								}
							},
							caption: "delete",
							icon: "delete"
						}, {
							fn: function () {
								var record = $o.viewsMap [this.getCurrentValue ("id")];
								$o.app.show.call ($o.app, {record: record});
							},  
							active: {
								fn: function () {
									var r = this.getCurrentValue ("id");
									return r;
								}
							},
							caption: $o.getString ("Review"),
							iconCls: "gi_eye_open"
						}]
					}
				}, {
					tab: {
						listeners: {
							tabchangeTODO: function (tabPanel, panel) {	
								var me = this;
								if (panel.title == $o.getString ("Query") || panel.title == $o.getString ("Layout")) {
									var field = panel.getItems () [0];
									var value = field.getValue ();
									var dom = Ext.getDom (field.inputEl);
									if (me.editor) {
										me.editor.toTextArea ();
									};
									var height = panel.getHeight (true);
									Ext.util.CSS.updateRule (".CodeMirror-scroll", "height", height + "px");
									me.editor = CodeMirror.fromTextArea (dom, {
										lineNumbers: true,
										indentUnit: 4,
										readOnly: false,
										mode: {
											name: 'javascript',
											json: true
										}
									});
									me.editor.setValue (value);
								};
							}
						},
						pages: [{
							cardConf: {
								id: "commonCard",
								title: $o.getString ("Commons"),
								iconCls: "gi_edit",
								tbar: [{
									text: $o.getString ("Dependencies"),
									iconCls: "gi_link",
									handler: function () {
										var viewId = this.up ("*[name=views]").relatives ["olap"].getValue ("id");
										var path = $o.getView (viewId).getFullCode ();
										var data = [];
										_.each ($o.viewsMap, function (o, id) {
											if (o.get ("layout") && o.get ("layout").indexOf (path) > -1) {
												data.push ({
													id: o.get ("id"), path: o.getFullCode (), name: o.get ("name")
												});
											};
										});
										var win = Ext.create ("Ext.Window", {
											width: 600,
											height: 600,
											layout: "fit",
											frame: false,
											border: false,
											style: "background-color: #ffffff",
											bodyStyle: "background-color: #ffffff",
											title: $o.getString ("Dependencies") + ": " + $o.getString ("Views"),
											iconCls: "gi_link",
											bodyPadding: 5,
											modal: 1,
											items: {
												xtype: "grid",
												name: "grid",
												store: {
													type: "json",
													fields: ["id", "path", "name"],
													data: data
												},
												columns: [{
													text: "id",
													dataIndex: "id"
												}, {
													text: $o.getString ("Code"),
													dataIndex: "path"
												}, {
													text: $o.getString ("Name"),
													dataIndex: "name"
												}],
												width: "100%",
												forceFit: true,
												columnLines: true,
												rowLines: true
											}
										});
										win.show ();
									}
								}],
								items: [{
									conf: "view", id: "olap", attr: "id.name", fieldLabel: $o.getString ("Name")
								}, {
									conf: "view", id: "olap", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, maskRe: /[A-Za-z0-9\_]/
								}, {
									conf: "view", id: "olap", attr: "id.parent", fieldLabel: $o.getString ("Parent"), confRef: "view", choose: {type: "view", id: "system.views", attr: "olap.id", width: 500, height: 400}
								}, {
									conf: "view", id: "olap", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 150
								}, {
									conf: "view", id: "olap", attr: "id.iconCls", fieldLabel: $o.getString ("Icon"), xtype: "$iconselector"
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							cardConf: {
								id: "queryCard",
								title: $o.getString ("Query"),
								iconCls: "gi_cogwheel",
								tbar: [{
									text: $o.getString ("Setting the table columns"),
									iconCls: "gi_table",
									handler: function () {
										var win = Ext.create ("Ext.Window", {
											width: 800,
											height: 600,
											layout: "fit",
											frame: false,
											border: false,
											style: "background-color: #ffffff",
											bodyStyle: "background-color: #ffffff",
											title: $o.getString ("Setting the table columns"),
											bodyPadding: 5,
											modal: 1,
											maximizable: true,
											items: {
												xtype: "$querycolumns",
												viewId: this.up ("*[name=views]").relatives ["olap"].getValue ("id"),
												schemaId: this.up ("*[name=views]").relatives ["olap"].getCurrentValue ("schema_id")
											}
										});
										win.show ();
									}
								}],
								listeners: {
									beforeSave: function () {
										var me = this;
										var query = me.down ("*[attr=id.query]").getValue ();
										query = eval ("(" + query + ")");
										var r = $o.execute ({sql: query, noException: 1});
										if (r.error) {
											common.message ($o.getString ("Error in query") + ":\n" + r.error);
										};
									}
								},
								items: [{
									/*
									conf: "view", id: "olap", attr: "id.query", hideLabel: true, xtype: "textarea", anchor: "100% 100%", fieldStyle: {
										"fontFamily": "courier new",
										"fontSize": "11px"
									}
									*/
									//anchor: "100% 100%",
									flex: 1, width: "100%",
									border: 0,
									layout: "fit",
									items: [{
										conf: "view", id: "olap", attr: "id.query", hideLabel: true, xtype: "$querydesigner"
									}]
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							cardConf: {
								id: "layoutCard",
								title: $o.getString ("Layout"),
								iconCls: "gi_table",
								items: [{
									//anchor: "100% 100%",
									flex: 1, width: "100%",
									border: 0,
									layout: "fit",
									items: [{
										/*
										conf: "view", id: "olap", attr: "id.layout", hideLabel: true, xtype: "textarea", fieldStyle: {
											"fontFamily": "courier new",
											"fontSize": "11px"
										}
										*/
										conf: "view", id: "olap", attr: "id.layout", hideLabel: true, xtype: "$layoutdesigner"
									}]
								}],
								active: {
									fn: function () {
										return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}/*, {
							split: {
								title: "Атрибуты",
								iconCls: "gi_file",
								orientation: "vertical",
								height: 300,
								pages: [{
									olap: {
										id: "olapAttrs",
										view: "system.viewAttrs",
										filter: ["view_id", "=", {id: "olap", attr: "id"}],
										actions: [{
											fn: function () {
												$zu.dialog.getNameAndCode ({title: "Добавление атрибута представления", success: function (name, code) {
													var tr = $o.startTransaction ({description: 'Create view attr'});
													var o = $o.createViewAttr ();
													o.set ("view", this.relatives ["olap"].getCurrentValue ("id"));
													o.set ("name", name);
													o.set ("code", code);
													o.set ("area", 1);
													o.set ("width", 75);
													o.sync ();
													$o.commitTransaction (tr);
													this.refresh ({
														callback: function (record, store, success) {
															if (success) {
																this.selectRow ({filter: ["&id", "=", o.get ("id")]});
															};
														},
														scope: this
													});
												}, scope: this});
											},  
											caption: "create",
											icon: "new",
											active: {
												fn: function () {
													return !this.relatives ["olap"].getCurrentValue ("schema_id");
												}
											}
										}, {
											fn: function () {
												common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														var id = this.getCurrentValue ("id");
														var tr = $o.startTransaction ({description: 'Remove view attr ' + id});
														var o = $o.getViewAttr (id);
														o.remove ();
														o.sync ();
														$o.commitTransaction (tr);
														this.refresh ();
													};
												}});
											},
											active: {
												fn: function () {
													return this.getCurrentValue ("id") && !this.relatives ["olap"].getCurrentValue ("schema_id");
												}
											},
											caption: "delete",
											icon: "delete"
										}]
									}
								}, {
									cardConf: {
										id: "attrCard",
										items: [{
											conf: "viewAttr", id: "olapAttrs", attr: "id.name", fieldLabel: "Наименование"
										}, {
											conf: "viewAttr", id: "olapAttrs", attr: "id.code", fieldLabel: "Код", allowBlank: false, maskRe: /[A-Za-z0-9\_]/
										}, {
											xtype: "compositefield", fieldLabel: "Видимый",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.area", xtype: "checkbox", width: 100
											}]
										}, {
											xtype: "compositefield", fieldLabel: "№ пп",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.order", xtype: "numberfield", width: 100
											}]
										}, {
											xtype: "compositefield", fieldLabel: "Ширина",
											items: [{
												conf: "viewAttr", id: "olapAttrs", attr: "id.width", xtype: "numberfield", width: 100
											}]
										}],
										active: {
											fn: function () {
												return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}*/]
					}
				}]
			}
		};
		me.callParent (arguments);
	}
});
