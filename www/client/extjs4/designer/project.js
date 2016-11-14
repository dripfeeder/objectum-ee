Ext.define ("$o.ProjectDesigner.Widget", {
	extend: "Ext.tab.Panel",
	alias: ["widget.$o.projectdesigner", "widget.$projectdesigner"],
	layout: "fit",
	border: false,
	defaults: {
		border: false
	},
	bodyPadding: 5,
	deferredRender: false,
	initComponent: function () {
		var me = this;
	    var store = Ext.create ('Ext.data.Store', {
	        fields: ["action", "line", "msg", "src"],
	        data: []
	    });
	    var grid = Ext.create('Ext.grid.Panel', {
	    	name: "errors",
	        store: store,
	        columns: [{
				text: $o.getString ("Message"), dataIndex: "msg", flex: 3, renderer: me.cellRenderer
			}, {
				text: $o.getString ("Action"), dataIndex: "action", width: 250, renderer: me.cellRenderer
			}, {
				text: $o.getString ("String"), dataIndex: "line", width: 80
			}, {
				text: $o.getString ("Source code"), dataIndex: "src", flex: 2, renderer: me.cellRenderer
	        }],
	        width: "100%",
			forceFit: true,
	        flex: 1,
			selModel: Ext.create ("Ext.selection.RowModel", {
				mode: "SINGLE",
				listeners: {
					selectionchange: function () {
						me.down ("*[name=showAction]").enable ();
					}
				}
			}),
	        tbar: [{
	        	text: $o.getString ("Action", ":", "Source code"),
	        	iconCls: "gi_notes",
	        	name: "showAction",
	        	disabled: 1,
	        	handler: function () {
	        		var grid = me.down ("*[name=errors]");
					if (grid.getSelectionModel ().hasSelection ()) {
						var record = grid.getSelectionModel ().getSelection ()[0];
						var actionCode = record.get ("action");
						var a = $o.getAction (actionCode);
						var body = a.get ("body");
						var win = Ext.create ("Ext.Window", {
							width: 800, height: 600, layout: "fit",
							frame: false, border: false, bodyPadding: 1,
							modal: false,
							maximizable: true,
							title: $o.getString ("Action", ":", "Source code") + ": " + a.toString (),
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
					};
	        	}
	        }]
	    });
		me.listeners = {
			afterrender: function () {
				$o.execute ({fn: "vo.getProjectInfo", success: function (o) {
					me.down ("*[name=revision]").setValue (o.revision);
					me.down ("*[name=name]").setValue (o.name);
					o.smtp = o.smtp || {};
					me.down ("*[name=smtpHost]").setValue (o.smtp.host);
					me.down ("*[name=smtpUsername]").setValue (o.smtp.username);
					me.down ("*[name=smtpPassword]").setValue (o.smtp.password);
					me.down ("*[name=smtpSender]").setValue (o.smtp.sender);
					me.down ("*[name=timeMachineCardButton]").setValue ($o.visualObjectum.timeMachine.cardButton);
//					me.down ("*[name=timeMachineShowDates]").setValue ($o.visualObjectum.timeMachine.showDates);
//					me.down ("*[name=timeMachineBuildTime]").setValue ($o.visualObjectum.timeMachine.buildTime);
					me.down ("*[name=logoLeft]").setValue ($o.visualObjectum.logo.left);
					me.down ("*[name=logoRight]").setValue ($o.visualObjectum.logo.right);
					me.down ("*[name=logoHeight]").setValue ($o.visualObjectum.logo.height);
					if ($o.visualObjectum.initAction) {
						me.down ("*[name=initAction]").setValue ($o.getAction ($o.visualObjectum.initAction).get ("id"));
					};
					if (o.scripts && o.scripts.client) {
						var data = [];
						for (var i = 0; i < o.scripts.client.length; i ++) {
							data.push ({name: o.scripts.client [i]});
						};
						me.down ("*[name=clientScripts]").getStore ().loadData (data);
					};
					//me.down ("*[name=siteView]").setValue (o.siteView);
				}});
			}
		};
		me.items = [{
			title: $o.getString ("Commons"),
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "textfield",
				fieldLabel: $o.getString ("Project revision"),
				name: "revision",
				labelWidth: 200,
				width: 355,
				style: "margin-top: 5px",
				disabled: true
			}, {
				xtype: "textfield",
				fieldLabel: $o.getString ("Project name"),
				labelWidth: 200,
				name: "name",
				width: "100%"
			}, {
				xtype: "compositefield",
				fieldLabel: $o.getString ("Admin password"),
				labelWidth: 200,
				items: [{
					xtype: "textfield",
					name: "password",
					inputType: "password",
					width: 150
				}, {
					xtype: "displayfield",
					value: $o.getString ("enter password again") + ":",
					style: "margin-left: 5px; margin-right: 2px"
				}, {
					xtype: "textfield",
					name: "password2",
					inputType: "password",
					width: 150
				}]
			}, {
				xtype: "fieldset",
				title: "SMTP",
				width: "100%",
				items: {
					layout: "hbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "textfield",
						name: "smtpHost",
						fieldLabel: $o.getString ("Host")
					}, {
						xtype: "textfield",
						name: "smtpUsername",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("User")
					}, {
						xtype: "textfield",
						name: "smtpPassword",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("Password"),
						inputType: "password"
					}, {
						xtype: "textfield",
						name: "smtpSender",
						style: "margin-left: 10px",
						fieldLabel: $o.getString ("Sender")
					}]
				}
			}, {
				xtype: "fieldset",
				title: "Time machine",
				width: "100%",
				items: {
					layout: "hbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "checkbox",
						name: "timeMachineCardButton",
						fieldLabel: $o.getString ("Show button 'Changes' in card"),
						labelWidth: 250
						/*
					}, {
						xtype: "checkbox",
						name: "timeMachineShowDates",
						style: "margin-left: 50px",
						fieldLabel: "Включить выбор даты",
						labelWidth: 150
					}, {
						xtype: "timefield",
						name: "timeMachineBuildTime",
						style: "margin-left: 50px",
						fieldLabel: "Время создания даты (UTC)",
						labelWidth: 150,
						width: 230,
						editable: false
						*/
					}]
				}
			}, {
				layout: "hbox",
				border: 0,
				style: "padding-top: 5px; padding-bottom: 5px",
				width: "100%",
				items: [{
					xtype: "button",
					text: $o.getString ("Build project"),
					iconCls: "gi_settings",
					handler: function () {
						me.down ("*[name=time]").setValue ($o.getString ("building") + " ...");
						me.down ("*[name=errNum]").setValue ($o.getString ("building") + " ...");
						me.down ("*[name=showAction]").disable ();
						$o.app.name = $ptitle = me.down ("*[name=name]").getValue ();
						var args = {
							name: me.down ("*[name=name]").getValue (),
							build: me.down ("radiogroup").getValue ().rgBuild
	//						siteView: me.down ("*[name=siteView]").getValue ()
						};
						if (me.down ("*[name=password]").getValue ()) {
							if (me.down ("*[name=password]").getValue () != me.down ("*[name=password2]").getValue ()) {
								common.message ($o.getString ("Passwords not equal"));
								return;
							};
							args.password = $o.util.sha1 (me.down ("*[name=password]").getValue ());
						};
						args.smtp = {
							host: me.down ("*[name=smtpHost]").getValue (),
							username: me.down ("*[name=smtpUsername]").getValue (),
							password: me.down ("*[name=smtpPassword]").getValue (),
							sender: me.down ("*[name=smtpSender]").getValue ()
						};
						var buildTime = null;//me.down ("*[name=timeMachineBuildTime]").getValue ();
						args.timeMachine = {
							cardButton: me.down ("*[name=timeMachineCardButton]").getValue () ? 1 : 0,
							showDates: 0//me.down ("*[name=timeMachineShowDates]").getValue () ? 1 : 0
						};
						args.logo = {
							left: me.down ("*[name=logoLeft]").getValue (),
							right: me.down ("*[name=logoRight]").getValue (),
							height: me.down ("*[name=logoHeight]").getValue ()
						};
						if (me.down ("*[name=initAction]").getValue ()) {
							args.initAction = $o.getAction (me.down ("*[name=initAction]").getValue ()).getFullCode ();
						};
						if (buildTime) {
							args.timeMachine.buildTime = 
								(buildTime.getHours () < 10 ? ("0" + buildTime.getHours ()) : buildTime.getHours ()) + ":" + 
								(buildTime.getMinutes () < 10 ? ("0" + buildTime.getMinutes ()) : buildTime.getMinutes ())
							;
						};
						$o.visualObjectum.timeMachine.cardButton = args.timeMachine.cardButton;
						$o.visualObjectum.timeMachine.showDates = args.timeMachine.showDates;
						$o.visualObjectum.timeMachine.buildTime = args.timeMachine.buildTime;
						var clientScripts = [];
						var store = me.down ("*[name=clientScripts]").getStore ();
						for (var i = 0; i < store.getCount (); i ++ ) {
							clientScripts.push (store.getAt (i).get ("name"));
						};
						args.scripts = {client: clientScripts};
						$o.execute ({fn: "vo.build", args: args, success: function (o) {
							me.showBuildResults (o);
							if (o.err && o.err.length) {
								return;
							};
							common.setConf ("projectNeedBuild", {used: 0});
							if ($o.app.projectNeedBuildTooltip) {
								$o.app.projectNeedBuildTooltip.destroy ();
							};
							me.down ("*[name=revision]").setValue (o.revision);
							$o.execute ({fn: "vo.getActions", success: function (o) {
								me.down ("*[name=actions]").setValue (o.actions);
							}});
						}});
					}
				}, {
					xtype: "radiogroup",
			        columns: 2,
			        style: "margin-left: 25px",
			        items: [{
			        	boxLabel: $o.getString ("Test"), name: "rgBuild", inputValue: "test", width: 90, checked: true
			        }, {
			        	boxLabel: $o.getString ("Production"), name: "rgBuild", inputValue: "prod"
			        }]
			    }]
			}, {
				layout: "hbox",
				border: 0,
				style: "padding-top: 5px; padding-bottom: 5px",
				width: "100%",
				items: [{
					xtype: "textfield",
					labelWidth: 200,
					disabled: 1,
					name: "errNum",
					width: 300,
					fieldLabel: $o.getString ("Errors num")
				}, {
					xtype: "textfield",
					disabled: 1,
					name: "time",
					style: "margin-left: 10px",
					width: 200,
					fieldLabel: $o.getString ("building duration")
				}]
				/*
			}, {
				xtype: "$conffield", 
				fieldLabel: "Представление посетителям",
				name: "siteView", 
				confRef: "view",
				choose: {
					type: "view", id: "system.views", attr: "olap.id", width: 500, height: 400
				},
				listeners: {
					change: function () {
					}
				},
				labelWidth: 200,
				width: "100%"
				*/
			}, 
				grid
			]
		}, {
			title: $o.getString ("Additional"),
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "grid",
				title: $o.getString ("Client scripts"),
		    	name: "clientScripts",
		        store: Ext.create ("Ext.data.Store", {
			        fields: ["name"],
			        data: []
			    }),
		        columns: [{
					text: $o.getString ("Script location on server"), dataIndex: "name"
		        }],
		        width: "100%",
				forceFit: true,
				height: 150,
		        tbar: [{
		        	text: $o.getString ("Add"),
		        	iconCls: "gi_circle_plus",
		        	handler: function () {
		        		var grid = this.up ("grid");
		        		dialog.getString ({fieldLabel: $o.getString ("Enter script location on server"), success: function (text) {
		        			grid.getStore ().add ({name: text});
		        		}});
		        	}
		        }, {
		        	text: $o.getString ("Remove"),
		        	iconCls: "gi_circle_minus",
		        	handler: function () {
		        		var grid = this.up ("grid");
		        		var sm = grid.getSelectionModel ();
		        		if (sm.hasSelection ()) {
		        			var rec = sm.getSelection ()[0];
		        			grid.getStore ().remove (rec);
		        		};
		        	}
		        }]
		    }, {
				fieldLabel: $o.getString ("Action of client initialization"),
				labelWidth: 200,
				width: 600,
				xtype: "$conffield", 
				name: "initAction", 
				anchor: "100%",
				confRef: "action",
				style: "margin-top: 5px",
				choose: {
					type: "custom", fn: function () {
						var f = this;
						dialog.getAction ({success: function (options) {
							f.setValue (options.id);
						}});
					}

				}
		    }, {
				xtype: "fieldset",
				title: $o.getString ("Logo"),
				width: "100%",
				items: {
					layout: "vbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "textfield",
						name: "logoLeft",
						fieldLabel: $o.getString ("Left image"),
						width: "100%"
				    }, {
						xtype: "textfield",
						name: "logoRight",
						fieldLabel: $o.getString ("Right image"),
						width: "100%"
				    }, {
						xtype: "numberfield",
						name: "logoHeight",
						fieldLabel: $o.getString ("Strip height")
					}]
				}
			}]
		}, {
			title: $o.getString ("Server actions"),
			iconCls: "gi_notes",
			layout: "fit",
			tbar: [{
				text: $o.getString ("Refresh"),
				iconCls: "gi_refresh",
				handler: function () {
					$o.execute ({fn: "vo.getActions", success: function (o) {
						me.down ("*[name=actions]").setValue (o.actions);
					}});
				}
			}],
			items: {
				xtype: "codemirrortextarea",
				name: "actions",
				listeners: {
					afterrender: function () {
						var ta = this;
						$o.execute ({fn: "vo.getActions", success: function (o) {
							ta.setValue (o.actions);
						}});
					}
				}
			}
		}];
		this.callParent (arguments);
	},
	showBuildResults: function (o) {
		var me = this;
		me.down ("*[name=time]").setValue ((o.time / 1000).toFixed (3) + " сек.");
		o.err = o.err || [];
		me.down ("*[name=errNum]").setValue (o.err.length);
		me.down ("*[name=errors]").getStore ().loadData (o.err);
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		metaData.style = "white-space: normal;";
		return value;
	}
});
