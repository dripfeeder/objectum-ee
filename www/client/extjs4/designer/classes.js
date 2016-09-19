Ext.define ("$o.Classes.Widget", {
	extend: "$o.Layout.Widget",
	alias: ["widget.$o.classes", "widget.$classes"],
	initComponent: function () {
		var me = this;
		me.$layout = {
			split: {
				orientation: "horizontal",
				width: 290,
				pages: [{
					treegrid: {
						id: "olap",
				    	view: "system.classes",
				    	fields: {
				    		id: "id",
				    		parent: "parent_id"
				    	},
				    	filter: {
//				    		fn: function () {return ["id", ">=", 1000]},
//				    		childsFn: function () {return [{"___childs": "___fend_id"}, "=", 2147483647, "and", {"___childs": "___fid"}, ">=", 1000]}
				    		fn: function () {return ["end_id", "=", 2147483647, "and", "id", ">=", 1000]},
				    		all: true
				    	},
					    actions: [{
					        fn: function () {
					        	var grid = this;
								$zu.dialog.getNameAndCode ({title: $o.getString ("Class", ":", "Adding"), success: function (name, code) {
									var createSpr = false;
									async.series ([
										function (cb) {
											var clsParent = $o.getClass (grid.getCurrentValue ("id"));
											if (clsParent && clsParent.getFullCode ().split (".")[0] == "spr") {
												common.confirm ({message: $o.getString ("Create standard dictionary (card, view)?"), scope: this, fn: function (btn) {
													if (btn == "yes") {
														createSpr = true;
													}
													cb ();
												}});
											} else {
												cb ();
											}
										}
									], function (err) {
										var tr = $o.startTransaction ({description: 'Create class '});
							        	var o = $o.createClass ();
							        	o.set ("parent", grid.getCurrentValue ("id"));
							        	o.set ("name", name);
							        	o.set ("code", code);
							        	o.sync ();
							        	o.updateDefault ();
							        	if (createSpr) {
							        		me.createSpr (o);
							        	}
										$o.commitTransaction (tr);
									    grid.refresh ({
											callback: function (record, store, success) {
												if (success) {
													grid.selectRow ({filter: ["&id", "=", o.get ("id")]});
												};
											},
											scope: grid
								    	});
									});
								}});
					        },  
					        caption: "create",
					        icon: "new"
					    }, {
					        fn: function () {
								common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
									if (btn == "yes") {
										var id = this.getCurrentValue ("id");
										var tr = $o.startTransaction ({description: 'Remove class ' + id});
							        	var o = $o.getClass (id);
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
					        	me.showObjects ({classId: this.getCurrentValue ("id")});
					        },
					        active: {
					            fn: function () {
					            	var r = this.getCurrentValue ("id");// && !this.getCurrentValue ("schema_id");
					            	return r;
					            }
					        },
					        caption: $o.getString ("Objects"),
					        iconCls: "gi_file"
					    }],
					    listeners: {
					    	afterrender: function () {
					    		me.olapClasses = this;
					    	}
					    }
					}
				}, {
					tab: {
						pages: [{
							cardConf: {
								id: "commonCard",
								title: $o.getString ("Commons"),
								iconCls: "gi_edit",
								items: [{
									conf: "class", id: "olap", attr: "id.name", fieldLabel: $o.getString ("Name")
								}, {
									conf: "class", id: "olap", attr: "id.code", allowBlank: false, fieldLabel: $o.getString ("Code"), readOnly: true, maskRe: /[A-Za-z0-9\_]/
								}, {
									conf: "class", id: "olap", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 150
								}, {
									conf: "class", id: "olap", attr: "id.format", fieldLabel: $o.getString ("Format function (default: return this.get ('name');)"), xtype: "textarea", height: 200
								}],
								active: {
									fn: function () {
						            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
									}
								}
							}
						}, {
							split: {
								title: $o.getString ("Attributes"),
								iconCls: "gi_file",
								orientation: "vertical",
								height: 400,
								pages: [{
									olap: {
										id: "olapAttrs",
										view: "system.classAttrs",
										filter: ["class_id", "=", {id: "olap", attr: "id"}],
									    actions: [{
									        fn: function () {
												$zu.dialog.getNameAndCodeAndType ({title: $o.getString ("Class attribute", ":", "Adding"), success: function (name, code, type) {
													var cls = $o.getClass (this.relatives ["olap"].getCurrentValue ("id"));
													var cls2 = cls.hasAttrInHierarchy (code);
													if (cls2) {
														common.message ($o.getString ("Attribute already exists in class") + ": " + cls2.toString ());
														return;
													};
													var tr = $o.startTransaction ({description: 'Create class attr'});
										        	var o = $o.createClassAttr ();
										        	o.set ("class", this.relatives ["olap"].getCurrentValue ("id"));
										        	o.set ("name", name);
										        	o.set ("code", code);
										        	o.set ("type", type);
										        	o.set ("removeRule", "set null");
										        	o.sync ();
										        	$o.getClass (o.get ("class")).updateDefault ();
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
									        arguments: {
									        	debug: 1
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
														var tr = $o.startTransaction ({description: 'Remove class attr ' + id});
											        	var o = $o.getClassAttr (id);
											        	var clsId = o.get ("class");
											        	o.remove ();
											        	o.sync ();
											        	$o.getClass (clsId).updateDefault ();
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
									    }],
							    		cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
								        	if (metaData.column.dataIndex == "type") {
												if (record.get ("type_id")) {
													var cls = $o.getClass (record.get ("type_id"));
													if (cls) {
								        				value = cls.toString ();
								        			}
								        		}
								        	}
								        	return value;
								        }
									}
								}, {
									cardConf: {
										id: "attrCard",
										items: [{
											conf: "classAttr", id: "olapAttrs", attr: "id.name", fieldLabel: $o.getString ("Name")
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, readOnly: true, maskRe: /[A-Za-z0-9\_]/
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.type", fieldLabel: $o.getString ("Type"), confRef: "class", readOnly: true
										}, {
											"anchor": "100%",
											"xtype": "fieldcontainer",
											"layout": "hbox",
											"items": [{
												conf: "classAttr", id: "olapAttrs", attr: "id.secure", fieldLabel: $o.getString ("Password"), xtype: "checkbox"
											}, {
												conf: "classAttr", id: "olapAttrs", attr: "id.unique", fieldLabel: $o.getString ("Unique"), xtype: "checkbox", style: "margin-left: 10px"
											}, {
												conf: "classAttr", id: "olapAttrs", attr: "id.notNull", fieldLabel: $o.getString ("Not null"), xtype: "checkbox", style: "margin-left: 10px"
											}, {
												xtype: "compositefield", fieldLabel: $o.getString ("Remove rule"), style: "margin-left: 10px",
												items: [{
													xtype: "combo",
													conf: "classAttr", 
													id: "olapAttrs",
													attr: "id.removeRule", 
													width: 200,
													triggerAction: "all",
													lazyRender: true,
													mode: "local",
													queryMode: "local",
													editable: false,
													store: new Ext.data.ArrayStore ({
														fields: ["id", "text"],
														data: [
															["set null", "Set null)"],
															["cascade", "Cascade"]
														]
													}),
													valueField: "id",
													displayField: "text"
												}]
											}]
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.formatFunc", fieldLabel: $o.getString ("Options") + " (JSON)", xtype: "textarea", height: 50
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.validFunc", fieldLabel: $o.getString ("Validation function"), xtype: "textarea", height: 30
										}, {
											conf: "classAttr", id: "olapAttrs", attr: "id.description", fieldLabel: $o.getString ("Description"), xtype: "textarea", height: 30
										}],
										active: {
											fn: function () {
												if (this.relatives ["olapAttrs"].getValue ("id")) {
													var ca = $o.getClassAttr (this.relatives ["olapAttrs"].getValue ("id"));
													if (ca.get ("type") >= 1000) {
														this.down ("*[attr=id.removeRule]").enable ();
													} else {
														this.down ("*[attr=id.removeRule]").disable ();
													};
													if (ca.get ("type") == 1) {
														this.down ("*[attr=id.secure]").enable ();
													} else {
														this.down ("*[attr=id.secure]").disable ();
													};
												};
								            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}, {
							split: {
								title: $o.getString ("Actions"),
								iconCls: "gi_wrench",
								orientation: "vertical",
								width: 400,
								pages: [{
									olap: {
										id: "olapActions",
										view: "system.actions",
										filter: ["class_id", "=", {id: "olap", attr: "id"}],
									    actions: [{
									        fn: function () {
												$zu.dialog.getNameAndCode ({title: $o.getString ("Action", ":", "Adding"), success: function (name, code) {
													var tr = $o.startTransaction ({description: 'Create action'});
										        	var o = $o.createAction ();
										        	o.set ("class", this.relatives ["olap"].getCurrentValue ("id"));
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
														var tr = $o.startTransaction ({description: 'Remove action ' + id});
											        	var o = $o.getAction (id);
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
									    }, {
									    	fn: function () {
												var a = $o.getAction (this.getCurrentValue ("id"));
												var body = a.get ("body");
												var win = Ext.create ("Ext.Window", {
													width: 800, height: 600, layout: "fit",
													frame: false, border: false, bodyPadding: 1,
													modal: false,
													maximizable: true,
													title: $o.getString ("Action source code") + ": " + a.toString (),
													iconCls: "gi_notes",
													items: {
														name: "body",
														xtype: "codemirrortextarea",
														listeners: {
															afterrender: function () {
																this.setValue (body);
															}
														}
													},
													tbar: [{
														text: $o.getString ("Save"),
														iconCls: "gi_floppy_save",
										            	disabled: this.relatives ["olap"].getCurrentValue ("schema_id"),
														handler: function () {
															a.set ("body", win.down ("*[name=body]").getValue ());
															a.sync ();
															a.initAction ();
															win.close ();
														}
													}, {
														text: $o.getString ("Cancel"),
														iconCls: "gi_remove",
														handler: function () {
															win.close ();
														}
													}]
												});
												win.show ();
										    },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id");
									            }
									        },
									        text: $o.getString ("Source code"),
									        iconCls: "gi_notes"
									    }, {
									    	fn: function () {
									    		var classId = this.getCurrentValue ("class_id");
												var a = $o.getAction (this.getCurrentValue ("id"));
												var l = a.get ("layout");
												l = l || "{}";
												l = JSON.parse (l);
												var layout = l.layout;
												var win = Ext.create ("Ext.Window", {
													width: 800, height: 600, layout: "fit",
													frame: false, border: false, bodyPadding: 1,
													modal: false,
													maximizable: true,
													title: $o.getString ("Action layout") + ": " + a.toString (),
													iconCls: "gi_table",
													items: {
														xtype: "$layoutdesigner",
														name: "layout",
														listeners: {
															afterrender: function () {
																this.setValue (l.layout);
																this.classId = classId;
															}
														}
													},
													tbar: [{
														text: $o.getString ("Save"),
														iconCls: "gi_floppy_save",
										            	disabled: this.relatives ["olap"].getCurrentValue ("schema_id"),
														handler: function () {
															var layout = win.down ("*[name=layout]").getValue ();
															if (layout) {
																if (typeof (layout) == "string") {
																	try {
																		l.layout = JSON.parse (layout);
																	} catch (e) {
																		common.message ($o.getString ("Parsing layout ended with an error"));
																		win.close ();
																		return;
																	};
																};
																if (typeof (layout) == "object") {
																	l.layout = layout;
																};
															} else {
																delete l.layout;
															};
															a.set ("layout", JSON.stringify (l, null, "\t"));
															a.sync ();
															a.initAction ();
															me.actionCard.down ("*[attr=id.layout]").originalValue = JSON.stringify (l, null, "\t");
															win.close ();
														}
													}, {
														text: $o.getString ("Cancel"),
														iconCls: "gi_remove",
														handler: function () {
															win.close ();
														}
													}]
												});
												win.show ();
										    },
									        active: {
									            fn: function () {
									            	return this.getCurrentValue ("id");
									            }
									        },
									        text: $o.getString ("Layout"),
									        iconCls: "gi_table"
									        /*
									    }, {
									    	text: "Обновить действия по умолчанию",
									    	iconCls: "gi_refresh",
									    	handler: function () {
									    		var clsId = this.up ("grid").relatives ["olap"].getValue ("id");
									    		var cls = $o.getClass (clsId);
								    			cls.updateDefault ();
									    	}
									    	*/
									    }],
									    listeners: {
									    	afterrender: function () {
									    		me.olapActions = this;
									    	}
									    }
									}
								}, {
									cardConf: {
										id: "actionCard",
										listeners: {
											afterrender: function () {
												me.actionCard = this;
											},
											afterSave: function () {
												var actionId = this.relatives ["olapActions"].getValue ("id");
												var a = $o.getAction (actionId);
												var layoutField = me.actionCard.down ("*[attr=id.layout]");
												var v = layoutField.originalValue;
												v = JSON.parse (v);
												if (!v || typeof (v) != "object") {
													v = {};
												};
												v ["type"] = me.actionCard.down ("*[name=type]").getValue ();
												v ["serverAction"] = me.actionCard.down ("*[name=serverAction]").getValue ();
												v ["noAuth"] = me.actionCard.down ("*[name=noAuth]").getValue ();
												a.set ("layout", JSON.stringify (v, null, "\t"));
												a.sync ();
												a.initAction ();
											}
										},
										items: [{
											conf: "action", id: "olapActions", attr: "id.name", fieldLabel: $o.getString ("Name"), labelWidth: 150
										}, {
											conf: "action", id: "olapActions", attr: "id.code", fieldLabel: $o.getString ("Code"), allowBlank: false, labelWidth: 150, maskRe: /[A-Za-z0-9\_]/
										}, {
											xtype: "combo",
											name: "type",
											fieldLabel: $o.getString ("Type"),
											triggerAction: "all",
											lazyRender: true,
											mode: "local",
											labelWidth: 150,
											queryMode: "local",
											editable: false,
											store: new Ext.data.ArrayStore ({
												fields: ["id", "text"],
												data: [
													[null, "-"],
													["create", $o.getString ("Adding")],
													["remove", $o.getString ("Removing")],
													["card", $o.getString ("Card")]
												]
											}),
											valueField: "id",
											displayField: "text",
											listeners: {
												select: function () {
													me.actionCard.down ("*[attr=id.layout]").setValue (
														me.actionCard.down ("*[attr=id.layout]").counter ++
													);
													/*
													if (this.getValue () == "create") {
														var cls = $o.getClass (me.olapClasses.getValue ("id"));
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'common.tpl.create.call (this, {\n' +
												    		'\tasWindow: 1,\n' +
												    		'\tclassCode: "' + cls.getFullCode () + '",\n' +
															'\tfn: function (o, options) {\n' +
												    		'\t\toptions.layout = common.tpl.updateTags (\n' +
												    		'\t\t\t' + cls.getFullCode () + '.card.layout, {\n' +
												    		'\t\t\t\tid: o.get ("id")\n' +
												    		'\t\t\t}\n' +
												    		'\t\t)\n' +
												    		'\t}\n' +
												    		'});\n'
														);
													};
													if (this.getValue () == "card") {
														var action = $o.getAction (me.olapActions.getValue ("id"));
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'var me = this;\n' +
												    		'var id = me.getValue ("id") || me.getValue ("a_id");\n' +
												    		'common.tpl.show.call (this, {\n' +
												    		'\tid: id,\n' +
												    		'\tasWindow: 1,\n' +
												    		'\tlayout: common.tpl.updateTags (\n' +
												    		'\t\t' + action.getFullCode () + '.layout, {\n' +
												    		'\t\t\tid: id\n' +
												    		'\t\t}\n' +
												    		'\t)\n' +
												    		'});\n'
														);
													};
													if (this.getValue () == "remove") {
														this.up ("*[name=attrCard]").down ("*[name=body]").setValue (
												    		'common.tpl.remove.call (this);\n'
														);
													};
													*/
												}
											}
										}, {
											xtype: "compositefield",
											fieldLabel: $o.getString ("Server action"),
											labelWidth: 150,
											items: [{
												xtype: "checkbox", name: "serverAction", listeners: {
													change: function () {
														me.actionCard.down ("*[attr=id.layout]").setValue (
															me.actionCard.down ("*[attr=id.layout]").counter ++
														);
														if (this.getValue ()) {
															me.actionCard.down ("*[name=noAuth]").enable ();
															me.actionCard.down ("*[name=displayNoAuth]").enable ();
														} else {
															me.actionCard.down ("*[name=noAuth]").disable ();
															me.actionCard.down ("*[name=displayNoAuth]").disable ();
														};
													}
												}
											}, {
												xtype: "displayfield",
												name: "displayNoAuth",
												value: $o.getString ("Execute no authentication") + ":",
												style: "margin-left: 10px; margin-right: 5px"
											}, {
												xtype: "checkbox", name: "noAuth", labelWidth: 150, listeners: {
													change: function () {
														me.actionCard.down ("*[attr=id.layout]").setValue (
															me.actionCard.down ("*[attr=id.layout]").counter ++
														);
													}
												}
											}]
										}, {
											conf: "action", id: "olapActions", attr: "id.body", xtype: "textarea", hideLabel: true, style: "display: none"
										}, {
											conf: "action", id: "olapActions", attr: "id.layout", xtype: "textarea", hideLabel: true, style: "display: none"
										}],
										active: {
											fn: function () {
												if (this.relatives ["olapActions"].getValue ("id")) {
													var a = $o.getAction (this.relatives ["olapActions"].getValue ("id"));
													var l = a.get ("layout");
													l = l || "{}";
													l = JSON.parse (l);
													this.down ("*[name=type]").setValue (l ["type"]);
													this.down ("*[name=serverAction]").setValue (l ["serverAction"]);
													this.down ("*[name=noAuth]").setValue (l ["noAuth"]);
													if (l ["serverAction"]) {
														this.down ("*[name=noAuth]").enable ();
														this.down ("*[name=displayNoAuth]").enable ();
													} else {
														this.down ("*[name=noAuth]").disable ();
														this.down ("*[name=displayNoAuth]").disable ();
													};
													if (l.system) {
														this.down ("*[iconCls=save]").disable ();
													} else {
														this.down ("*[iconCls=save]").enable ();
													};
													//this.up ("*[name=attrCard]").down ("*[name=body]").setValue (a.get ("body") ? a.get ("body") : "");
													this.down ("*[attr=id.layout]").originalValue = a.get ("layout");
													this.down ("*[attr=id.layout]").counter = 1;
												};
								            	return !this.relatives ["olap"].getCurrentValue ("schema_id");
											}
										}
									}
								}]
							}
						}, {
							olap: {
								id: "olapDependency",
								title: $o.getString ("Dependencies"),
								iconCls: "gi_link",
								view: "system.typeClassAttrs",
								filter: ["type_id", "=", {id: "olap", attr: "id"}],
					    		cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
						        	if (metaData.column.dataIndex == "classCode") {
										var cls = $o.getClass (record.get ("class_id"));
										if (cls) {
					        				value = cls.getFullCode ();
					        			}
						        	}
						        	return value;
						        }
							}
						}]
					}
				}]
			}
		};
		me.callParent (arguments);
	},
	showObjects: function (options) {
		var cls = $o.getClass (options.classId);
		if (!cls.attrsArray.length) {
			common.message ($o.getString ("Class has no attributes"));
			return;
		};
		var win = Ext.create ("Ext.Window", {
			title: $o.getString ("Class objects") + ": " + cls.toString (),
			iconCls: "gi_file",
			width: 800,
			height: 600,
			layout: "fit",
			frame: false,
			border: false,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			bodyPadding: 1,
			modal: true,
			items: {
				xtype: "$o.layout",
				$layout: {
					olap: {
						id: "olap",
						classView: options.classId,
						recreateView: true,
						singleSelect: false,
						/*
					    selModel: Ext.create ("Ext.selection.CellModel", {
							mode: "MULTI",
					        listeners: {
								select: function (sm, record, row, column, eOpts) {
									console.log (column);
								}
					        }
					    }),
						*/
						actions: [{
							fn: function () {
								var me = this;
								common.confirm ({message: $o.getString ("Are you sure?"), fn: function (btn) {
									if (btn == "yes") {
										$o.startTransaction ({description: "Remove by admin"});
										_.each (me.getSelectionModel ().getSelection (), function (rec, i) {
											$o.removeObject (rec.get ("id"));
											me.getStore ().remove (rec);
										});
										$o.commitTransaction ();
									};
								}});
							},
							text: $o.getString ("Remove"),
							iconCls: "gi_circle_minus",
							active: "common.recordSelected"
						}, {
							fn: function () {
								var me = this;
								var sql = JSON.parse (me.$view.get ("query"));
								var filter = me.getFilter ();
								if (filter && filter.length) {
									_.each (filter, function (f, i) {
										var index = sql.select.indexOf (f);
										if (index > -1) {
											filter [i] = sql.select [index - 1];
										}
									});
									sql.where = sql.where || [];
									if (sql.where.length) {
										sql.where.push ("and");
									}
									sql.where.push (filter);
								}
								sql.asArray = true;
								var recs = $o.execute (sql);
								common.confirm ({message: $o.getString ("Entries will be deleted") + ": " + recs.length + ". " + $o.getString ("Are you sure?"), fn: function (btn) {
									if (btn == "yes") {
										Ext.MessageBox.show ({
										    title: $o.getString ("Please wait"),
										    msg: $o.getString ("Action in progress") + " ...",
										    progressText: "",
										    width: 300,
										    progress: 1,
										    closable: false
										});	
										setTimeout (function () {
											$o.startTransaction ();
											async.reduce (recs, 0, function (i, rec, cb) {
												Ext.MessageBox.updateProgress (i / recs.length, i + " / " + recs.length);
												$o.removeObject (rec.id);
										        setTimeout (function () {
										        	cb (null, i + 1);
										        }, 1);
										    }, function (err) {
												$o.commitTransaction ();
												Ext.MessageBox.hide ();
												me.refresh ();
											});
										}, 100);
									};
								}});
							},
							text: $o.getString ("Remove all"),
							iconCls: "gi_circle_minus"
						}, {
							fn: function () {
								var me = this;
								var sql = JSON.parse (me.$view.get ("query"));
								var filter = me.getFilter ();
								if (filter && filter.length) {
									_.each (filter, function (f, i) {
										var index = sql.select.indexOf (f);
										if (index > -1) {
											filter [i] = sql.select [index - 1];
										}
									});
									sql.where = sql.where || [];
									if (sql.where.length) {
										sql.where.push ("and");
									}
									sql.where.push (filter);
								}
								sql.asArray = true;
								var recs = $o.execute (sql);
								var win = Ext.create ("Ext.window.Window", {
									title: $o.getString ("Changing the value of"),
									iconCls: "edit",
									closable: true,
									width: 600,
									height: 400,
									layout: "vbox",
									modal: true,
									style: "background-color: #fff",
									bodyStyle: "background-color: #fff",
									bodyPadding: 5,
									items: [{
										xtype: "textfield",
										disabled: true,
										fieldLabel: $o.getString ("Entries will be changed"),
										value: recs.length
									}, {
										xtype: "combo",
										fieldLabel: $o.getString ("Attribute"),
										name: "attr",
										triggerAction: "all",
										lazyRender: true,
										mode: "local",
										queryMode: "local",
										store: {
											type: "json",
											fields: ["id", "name"],
											data: _.map (cls.attrsArray, function (ca) {
												return {id: ca.get ("code"), name: ca.toString ()};
											})
										},
										width: "100%",
										valueField: "id",
										displayField: "name",
										editable: false
									}, {
										xtype: "textfield",
										name: "value",
										fieldLabel: $o.getString ("Value"),
										width: "100%"
									}],
									buttons: [{
										text: $o.getString ("Change"),
										iconCls: "ok",
										handler: function () {
											var attr = win.down ("*[name=attr]").getValue ();
											var value = win.down ("*[name=value]").getValue () || null;
											if (!attr) {
												return common.message ($o.getString ("Choose attribute"));
											}
											Ext.MessageBox.show ({
											    title: $o.getString ("Please wait"),
											    msg: $o.getString ("Action in progress") + " ...",
											    progressText: "",
											    width: 300,
											    progress: 1,
											    closable: false
											});	
											setTimeout (function () {
												$o.startTransaction ();
												async.reduce (recs, 0, function (i, rec, cb) {
													Ext.MessageBox.updateProgress (i / recs.length, i + " / " + recs.length);
													var o = $o.getObject (rec.id);
													o.set (attr, value);
													o.sync ();
											        setTimeout (function () {
											        	cb (null, i + 1);
											        }, 1);
											    }, function (err) {
													$o.commitTransaction ();
													Ext.MessageBox.hide ();
													win.close ();
													me.refresh ();
												});
											}, 100);
										}
									}]
								});
								win.show ();
							},
							text: $o.getString ("Change all"),
							iconCls: "edit"
						}, {
							text: $o.getString ("Import") + " CSV",
							iconCls: "gi_disk_import",
							fn: function () {
								var olap = this;
								var win = Ext.create ("Ext.window.Window", {
									title: $o.getString ("import") + " CSV",
									iconCls: "gi_disk_import",
									closable: true,
									width: 800,
									height: 600,
									layout: "fit",
									modal: true,
									style: "background-color: #fff",
									bodyStyle: "background-color: #fff",
									items: {
										xtype: "importcsvobjects",
										classId: options.classId,
										listeners: {
											imported: function () {
												win.close ();
												olap.refresh ();
											}
										}
									}
								});
								win.show ();
							}
						}]
					}
				}
			}
		});
		win.show ();		
	},
	/*
		Создает справочник
	*/
	createSpr: function (cls) {
		var me = this;
		// card layout
		var l = {
			"type": "card",
			"layout": {
				"designer": 1,
				"card": {
					"id": "card",
					"items": [{
						"anchor": "100%",
						"fieldLabel": $o.getString ("Name"),
						"attr": "name",
						"objectId": "[#id]"
					}, {
						"fieldLabel": $o.getString ("N"),
						"attr": "npp",
						"objectId": "[#id]",
						"width": 200
					}, {
						"anchor": "100%",
						"fieldLabel": $o.getString ("Code"),
						"attr": "code",
						"objectId": "[#id]"
					}],
					"object": [
						{
							"cls": cls.getFullCode (),
							"tag": "[#id]"
						}
					]
				}
			}
		};
		var recs = $o.execute ({
			asArray: true,
		    select: [
		        {"a":"___fid"}, "id"
		    ],
		    from: [
		        {"a":"system.action"}
		    ],
		    where: [
		        {"a": "___fend_id"}, "=", 2147483647, "and", {"a": "___fclass_id"}, "=", cls.get ("id"), "and",
		        {"a":"___fcode"}, "=", "card"
		    ]
		});
		var action = $o.getAction (recs [0].id);
		action.set ("layout", JSON.stringify (l, null, "\t"));
		action.sync ();
		// view
		var codeParent = cls.getFullCode ().split (".");
		codeParent.splice (codeParent.length - 1, 1);
		codeParent = codeParent.join (".");
		var viewParent;
		try {
			viewParent = $o.getView (codeParent);
		} catch (e) {
			return common.message ($o.getString ("base view not exists") + " " + codeParent);
		}
		if (!viewParent) {
			return common.message ($o.getString ("base view not exists") + " " + codeParent);
		}
		var codeView = codeParent + "." + cls.get ("code");
		var view = $o.createView ();
		view.set ("parent", viewParent.get ("id"));
		view.set ("name", cls.get ("name"));
		view.set ("code", cls.get ("code"));
		view.set ("query", JSON.stringify ({
			designer: 1,
			select: [
				{"a": "id"}, "id",
				{"a": "name"}, "name",
				{"a": "code"}, "code",
				{"a": "npp"}, "npp"
			],
			from: [
				{"a": codeView}
			],
			order: [
				{"a": "npp"}, ",", {"a": "name"}
			]
		}, null, "\t"));
		view.set ("layout", JSON.stringify ({
			designer: 1,
			olap: {
				id: "olap",
				view: codeView,
				actions: [
					{
						"fn": codeView + ".card",
						"text": $o.getString ("Open"),
						"iconCls": "gi_edit",
						"active": "common.recordSelected"
					},
					{
						"fn": codeView + ".create",
						"text": $o.getString ("Add"),
						"iconCls": "gi_circle_plus"
					},
					{
						"fn": codeView + ".remove",
						"text": $o.getString ("Remove"),
						"iconCls": "gi_circle_minus",
						"active": "common.recordSelected"
					}
				]
			}
		}, null, "\t"));
		view.set ("iconCls", "gi_book");
		view.sync ();
		// view attrs
		_.each ([{
			code: "id", name: "id", width: 75, area: 0
		}, {
			code: "name", name: $o.getString ("Name"), width: 500, area: 1
		}, {
			code: "code", name: $o.getString ("Code"), width: 75, area: 0
		}, {
			code: "npp", name: $o.getString ("N"), width: 75, area: 0
		}], function (o, i) {
			var va = $o.createViewAttr ();
			va.set ("view", view.get ("id"));
			va.set ("code", o.code);
			va.set ("name", o.name);
			va.set ("width", o.width);
			va.set ("area", o.area);
			va.set ("order", i + 1);
			va.sync ();
		});
	}
});
		