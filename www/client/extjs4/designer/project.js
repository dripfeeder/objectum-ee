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
				text: "Сообщение", dataIndex: "msg", flex: 3, renderer: me.cellRenderer
			}, {
				text: "Действие", dataIndex: "action", width: 250, renderer: me.cellRenderer
			}, {
				text: "Строка", dataIndex: "line", width: 80
			}, {
				text: "Исходный код", dataIndex: "src", flex: 2, renderer: me.cellRenderer
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
	        	text: "Исходный код действия",
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
							title: "Исходный код действия: " + a.toString (),
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
								text: "Сохранить",
								iconCls: "gi_floppy_save",
								handler: function () {
									a.set ("body", win.down ("*[name=body]").getValue ());
									a.sync ();
									a.initAction ();
									win.close ();
								}
							}, {
								text: "Отмена",
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
					me.down ("*[name=timeMachineShowDates]").setValue ($o.visualObjectum.timeMachine.showDates);
					me.down ("*[name=timeMachineBuildTime]").setValue ($o.visualObjectum.timeMachine.buildTime);
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
			title: "Общие",
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "textfield",
				fieldLabel: "Ревизия проекта",
				name: "revision",
				labelWidth: 200,
				width: 355,
				style: "margin-top: 5px",
				disabled: true
			}, {
				xtype: "textfield",
				fieldLabel: "Наименование проекта",
				labelWidth: 200,
				name: "name",
				width: "100%"
			}, {
				xtype: "compositefield",
				fieldLabel: "Пароль администратора",
				labelWidth: 200,
				items: [{
					xtype: "textfield",
					name: "password",
					inputType: "password",
					width: 150
				}, {
					xtype: "displayfield",
					value: "Введите пароль еще раз:",
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
						fieldLabel: "Хост"
					}, {
						xtype: "textfield",
						name: "smtpUsername",
						style: "margin-left: 10px",
						fieldLabel: "Пользователь"
					}, {
						xtype: "textfield",
						name: "smtpPassword",
						style: "margin-left: 10px",
						fieldLabel: "Пароль",
						inputType: "password"
					}, {
						xtype: "textfield",
						name: "smtpSender",
						style: "margin-left: 10px",
						fieldLabel: "Отправитель"
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
						fieldLabel: "Отобразить кнопку 'Изменения' в карточке",
						labelWidth: 250
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
					}]
				}
			}, {
				layout: "hbox",
				border: 0,
				style: "padding-top: 5px; padding-bottom: 5px",
				width: "100%",
				items: [{
					xtype: "button",
					text: "Сборка проекта",
					iconCls: "gi_settings",
					handler: function () {
						me.down ("*[name=time]").setValue ("Сборка ...");
						me.down ("*[name=errNum]").setValue ("Сборка ...");
						me.down ("*[name=showAction]").disable ();
						$o.app.name = $ptitle = me.down ("*[name=name]").getValue ();
						var args = {
							name: me.down ("*[name=name]").getValue (),
							build: me.down ("radiogroup").getValue ().rgBuild
	//						siteView: me.down ("*[name=siteView]").getValue ()
						};
						if (me.down ("*[name=password]").getValue ()) {
							if (me.down ("*[name=password]").getValue () != me.down ("*[name=password2]").getValue ()) {
								common.message ("Введенные пароли не совпадают.");
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
						var buildTime = me.down ("*[name=timeMachineBuildTime]").getValue ();
						args.timeMachine = {
							cardButton: me.down ("*[name=timeMachineCardButton]").getValue () ? 1 : 0,
							showDates: me.down ("*[name=timeMachineShowDates]").getValue () ? 1 : 0
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
			        	boxLabel: "Тестовая", name: "rgBuild", inputValue: "test", width: 90, checked: true
			        }, {
			        	boxLabel: "Продуктивная", name: "rgBuild", inputValue: "prod"
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
					fieldLabel: "Количество ошибок"
				}, {
					xtype: "textfield",
					disabled: 1,
					name: "time",
					style: "margin-left: 10px",
					width: 200,
					fieldLabel: "Время сборки"
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
			title: "Дополнительно",
			iconCls: "gi_file",
			layout: "vbox",
			items: [{
				xtype: "grid",
				title: "Клиентские скрипты",
		    	name: "clientScripts",
		        store: Ext.create ("Ext.data.Store", {
			        fields: ["name"],
			        data: []
			    }),
		        columns: [{
					text: "Путь к скрипту на сервере", dataIndex: "name"
		        }],
		        width: "100%",
				forceFit: true,
				height: 150,
		        tbar: [{
		        	text: "Добавить",
		        	iconCls: "gi_circle_plus",
		        	handler: function () {
		        		var grid = this.up ("grid");
		        		dialog.getString ({fieldLabel: "Введите путь к скрипту на сервере", success: function (text) {
		        			grid.getStore ().add ({name: text});
		        		}});
		        	}
		        }, {
		        	text: "Удалить",
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
				fieldLabel: "Действие инициализации клиента",
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
				title: "Логотип",
				width: "100%",
				items: {
					layout: "vbox",
					border: 0,
					bodyPadding: 5,
					items: [{
						xtype: "textfield",
						name: "logoLeft",
						fieldLabel: "Изображение слева",
						width: "100%"
				    }, {
						xtype: "textfield",
						name: "logoRight",
						fieldLabel: "Изображение справа",
						width: "100%"
				    }, {
						xtype: "numberfield",
						name: "logoHeight",
						fieldLabel: "Высота полосы"
					}]
				}
			}]
		}, {
			title: "Серверные действия",
			iconCls: "gi_notes",
			layout: "fit",
			tbar: [{
				text: "Обновить",
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
