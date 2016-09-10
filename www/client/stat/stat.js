Ext.define ("$o.ObjectumStat.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.objectumstat", "widget.$objectumstat"],
	layout: "fit",
	border: 0,
	initComponent: function () {
		var me = this;
		me.cluster = {};
		me.cluster.store = Ext.create ("Ext.data.Store", {
			data: [],
			fields: [{
				name: "pid", type: "string"
			}, {
				name: "port", type: "number"
			}, {
				name: "started", type: "string"
			}, {
				name: "rssCurrent", type: "number"
			}, {
				name: "heapTotalCurrent", type: "number"
			}, {
				name: "heapUsedCurrent", type: "number"
			}, {
				name: "rssMax", type: "number"
			}, {
				name: "heapTotalMax", type: "number"
			}, {
				name: "heapUsedMax", type: "number"
			}]
		});
		me.cluster.grid = Ext.create ("Ext.grid.Panel", {
			title: "Кластер",
			iconCls: "gi_server",
			store: me.cluster.store,
			tbar: [{
				text: "Перезапустить",
				iconCls: "gi_restart",
				handler: me.restartCluster,
				scope: me
			}],
			columns: [{
				text: "pid", width: 80, dataIndex: "pid"
			}, {
				text: "Порт", width: 80, dataIndex: "port"
			}, {
				text: "Старт (UTC)", width: 100, dataIndex: "started"
			}, {
				text: "Сейчас", columns: [{
					text: "rss", width: 70, dataIndex: "rssCurrent", summaryType: "sum"
				}, {
					text: "heapTotal", width: 70, dataIndex: "heapTotalCurrent", summaryType: "sum"
				}, {
					text: "heapUsed", width: 70, dataIndex: "heapUsedCurrent", summaryType: "sum"
				}]
			}, {
				text: "Макс.", columns: [{
					text: "rss", width: 70, dataIndex: "rssMax", summaryType: "sum"
				}, {
					text: "heapTotal", width: 70, dataIndex: "heapTotalMax", summaryType: "sum"
				}, {
					text: "heapUsed", width: 70, dataIndex: "heapUsedMax", summaryType: "sum"
				}]
			}],
			features: [{
				ftype: "summary",
				dock: "bottom"
			}],
    		forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.sessions = {};
		me.sessions.store = Ext.create ("Ext.data.Store", {
			data: [],
			fields: [{
				name: "login", type: "string"
			}, {
				name: "port", type: "string"
			}, {
				name: "storage", type: "string"
			}, {
				name: "logined", type: "string"
			}, {
				name: "ip", type: "string"
			}]
		});
		me.sessions.grid = Ext.create ("Ext.grid.Panel", {
			title: "Сессии",
			iconCls: "gi_group",
			store: me.sessions.store,
			bbar: [{
				xtype: "label",
				text: "Количество:"
			}, {
				xtype: "label",
				name: "total"
			}],
			columns: [{
				text: "Логин", width: 80, dataIndex: "login"
			}, {
				text: "Порт", width: 50, dataIndex: "port"
			}, {
				text: "Проект", width: 90, dataIndex: "storage"
			}, {
				text: "Вход (UTC)", width: 110, dataIndex: "logined"
			}, {
				text: "IP", width: 90, dataIndex: "ip"
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.pgStat = {};
		me.pgStat.store = Ext.create ("Ext.data.Store", {
			data: [],
			fields: [{
				name: "duration", type: "string"
			}, {
				name: "pid", type: "string"
			}, {
				name: "query", type: "string"
			}]
		});
		me.pgStat.grid = Ext.create ("Ext.grid.Panel", {
			title: "Активность PostgreSQL",
			iconCls: "gi_database_lock",
			store: me.pgStat.store,
			columns: [{
				text: "Длительность", width: 120, dataIndex: "duration"
			}, {
				text: "pid", width: 120, dataIndex: "pid"
			}, {
				text: "Запрос", flex: 1, dataIndex: "query"
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.unprocessed = {};
		me.unprocessed.store = Ext.create ("Ext.data.Store", {
			data: [],
			fields: [{
				name: "url", type: "string"
			}, {
				name: "body", type: "string"
			}, {
				name: "fields", type: "string"
			}, {
				name: "ts", type: "string"
			}]
		});
		me.unprocessed.grid = Ext.create ("Ext.grid.Panel", {
			title: "Необработанные запросы",
			iconCls: "gi_circle_exclamation_mark",
			store: me.unprocessed.store,
			columns: [{
				text: "URL", width: 200, dataIndex: "url"
			}, {
				text: "Запрос", flex: 1, dataIndex: "body"
			}, {
				text: "Поля", width: 120, dataIndex: "fields"
			}, {
				text: "Старт (UTC)", width: 140, dataIndex: "ts"
			}],
			forceFit: true,
			frame: false,
			deferRowRender: false
		});
		me.items = [{
			xtype: "tabpanel",
			items: [{
				title: "Обшие",
				iconCls: "gi_file",
				layout: "border",
				border: false,
				defaults: {
					border: false
				},
				tbar: [{
					text: "Обновить",
					iconCls: "gi_refresh",
					handler: me.updateData,
					scope: me
				}],
				items: [{
					split: true,
					region: "west",
					width: 550,
					layout: "fit",
					items: me.sessions.grid
				}, {
					region: "center",
					layout: "vbox",
					items: [{
						layout: "fit",
						width: "100%",
						flex: 1,
						border: 0,
						items: me.cluster.grid
					}, {
						layout: "fit",
						width: "100%",
						flex: 1,
						border: 0,
						items: me.unprocessed.grid
					}, {
						layout: "fit",
						width: "100%",
						flex: 1,
						border: 0,
						items: me.pgStat.grid
					}]
				}]
			}, {
				title: "Журналы",
				iconCls: "gi_book",
				xtype: "tabpanel",
				name: "logs",
				tbar: [{
					text: "Обновить",
					iconCls: "gi_refresh",
					handler: function () {
						me.updateLogs ();
					},
					scope: me
				}],
				listeners: {
					afterrender: me.updateLogs,
					tabchange: me.tabChange,
					scope: me
				}
			}]
		}];
		me.on ("afterrender", me.updateData, me);
		this.callParent (arguments);
	},
	updateData: function () {
		var me = this;
		Ext.Ajax.request ({
			url: "/objectum/stat/?data=1",
			success: function (response, options) {
				var data = {};
				try {
					data = JSON.parse (response.responseText);
					me.sessions.store.loadData (data.sessions);
					me.down ("*[name=total]").setText (data.sessions.length);
					me.cluster.store.loadData (data.cluster);
					me.pgStat.store.loadData (data.pgStat);
					me.unprocessed.store.loadData (data.unprocessed);
				} catch (e) {
				};
			}
		});
	},
	restartCluster: function () {
		var me = this;
		Ext.Ajax.request ({
			url: "/objectum/stat/?restart=1",
			success: function (response, options) {
				Ext.Msg.show ({
					title: "Objectum",
					msg: "Кластер перезапущен",
					buttons: Ext.Msg.OK
				});
			}
		});
	},
	updateLogs: function () {
		var me = this;
		Ext.Ajax.request ({
			url: "/objectum/stat/?logs=1",
			success: function (response, options) {
				var data = JSON.parse (response.responseText);
				var items = [];
				for (var i = 0; i < data.length; i ++) {
					var store = Ext.create ("Ext.data.Store", {
						data: [],
						fields: [{
							name: "ts", type: "string"
						}, {
							name: "text", type: "string"
						}]
					});
					var grid = Ext.create ("Ext.grid.Panel", {
						name: data [i],
						store: store,
						columns: [{
							text: "Дата", width: 150, dataIndex: "ts"
						}, {
							text: "Текст", flex: 1, dataIndex: "text", renderer: me.cellRenderer
						}],
						forceFit: true,
						frame: false,
						border: 0,
						deferRowRender: false
					});
					items.push ({
						title: data [i],
						layout: "fit",
						border: 0,
						items: grid
					});
				};
				var tp = me.down ("*[name=logs]");
				var activeLog = tp.getActiveTab () ? tp.getActiveTab ().down ("grid").name : null;
				tp.un ("tabchange", me.tabChange, me);
				tp.removeAll ();
				tp.add (items);
				tp.doLayout ();
				tp.on ("tabchange", me.tabChange, me);
				if (activeLog) {
					tp.setActiveTab (tp.down ("*[name=" + activeLog + "]").up ("*"));
				} else {
					tp.setActiveTab (tp.down ("*[name=" + data [0] + "]").up ("*"));
				};
			}
		});
	},
	cellRenderer: function (value, metaData, record, rowIndex, colIndex, store) {
		metaData.tdAttr = 'data-qtip="' + value + '"';
		metaData.style = "white-space: normal;";
		return value;
	},
	tabChange: function (tp, newTab, oldTab) {
		var me = this;
		var grid = newTab.down ("grid");
		Ext.Ajax.request ({
			url: "/objectum/stat/?log=" + grid.name,
			success: function (response, options) {
				var r = {};
				try {
					r = JSON.parse (response.responseText);
					var data = [];
					for (var i = 0; i < r.length; i ++) {
						var tokens = r [i].split ("]");
						data.push ({
							ts: tokens [0].substr (1),
							text: tokens.slice (1)
						});
					};
					grid.getStore ().loadData (data);
				} catch (e) {
				};
			}
		});
	}
});
Ext.onReady (function () {
	Ext.create ("Ext.container.Viewport", {
		layout: "fit",
		items: {
			title: "Панель администратора Objectum",
			xtype: "$o.objectumstat"
		}
	});
});
	