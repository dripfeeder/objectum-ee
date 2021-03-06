/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/
Ext.define ("$o.app", {
	singleton: true,
	mixins: {
		observable: "Ext.util.Observable"
	},
	// ExtJS готов к использованию
	extReady: false,
	// Конструктор
	constructor: function (config) {
		this.mixins.observable.constructor.call (this, config);
		this.addEvents (
			"extReady",
			"ready",
			"viewLayout"
		);
	},
	message: function (s, fn) {
		Ext.Msg.alert ($o.app.name || $o.app.code, s, fn);
	},
	// Логин
	login: function (options) {
		let me = this;
		let meOptions = options;
		let success = options.success;
		if ($o.authorized) {
			success.call (meOptions.scope || this, meOptions);
			return;
		};
		// esia
		if ($o.util.getCookie ("esiaUser")) {
			options.login = $o.util.getCookie ("esiaUser");
			$o.util.setCookie ("esiaUser", "", "/");
			options.hash = $o.util.getCookie ("esiaHash");
			$o.util.setCookie ("esiaHash", "", "/");
			$o.util.setCookie ("esiaAuth", "1", "/");
		}
		if (options.login && options.hash) {

			Ext.getBody ().mask ($o.getString ("Loading") + " ...");
			$o.authorize ({login: options.login, password: options.hash, success: function (options) {
				$o.init (Ext.apply (meOptions, {success: function () {
					Ext.getBody ().unmask (true);
					success.call (meOptions.scope || this, meOptions);
				}}));
			}});
			return;
		};
		let tryLogin = function () {
			let login = Ext.getCmp ("$o.app.login.field").getValue ();
			let password = Ext.getCmp ("$o.app.password.field").getValue ();
			if (!login || !password) {
				return;
			};
			loginDialog.getEl ().mask ($o.getString ("Loading"));
			let passwordHash = $o.util.sha1 (password);
			if (password == "password in cookie") {
				passwordHash = $o.util.getCookie ('password');
				password = $o.util.getCookie ('passwordPlain');
			};
			$o.authorize ({login: login, password: passwordHash, passwordPlain: password, success: function (options) {
				if (Ext.getCmp ("$o.app.remember").getValue ()) {
					$zu.setCookie ('login', login);
					$zu.setCookie ('password', passwordHash);
					$zu.setCookie ('passwordPlain', password);
				} else {
					$zu.removeCookie ('login');
					$zu.removeCookie ('password');
					$zu.removeCookie ('passwordPlain');
				};
				let success = meOptions.success;
				$o.init (Ext.apply (meOptions, {success: function () {
					loginDialog.getEl ().unmask (true);
					loginDialog.close ();
					success.call (meOptions.scope || this, meOptions);
				}}));
			}, failure: function (msg) {
				loginDialog.getEl ().unmask (true);
				$o.app.message ($o.locale.getString (msg) || $o.getString ("Authentication error"), function () {
					Ext.getCmp ("$o.app.password.field").setValue ("");
					Ext.getCmp ("$o.app.login.field").focus ();
				});
			}});
		};
		let buttons = {
			xtype: "button",
			text: $o.getString ("Enter"),
			iconCls: "gi_ok",
			width: 100,
			style: {
				marginTop: 10
			},
			handler: tryLogin
		};
		if (options.esia) {
			buttons = {
				border: false,
				layout: "hbox",
				items: [{
					xtype: "button",
					text: "Войти через ЕСИА",
					iconCls: "gi_keys",
					width: 150,
					style: {
						marginTop: 10,
						marginRight: 5
					},
					handler: function () {
						let url = window.location.protocol + "//" + window.location.hostname;
						if (window.location.port) {
							url += ":" + window.location.port;
						}
						url += "/projects/" + options.code + "/plugins/?fn=service.esia";
						let form = Ext.create ("Ext.form.Panel", {
							standardSubmit: true,
							url: options.esia
						});
						form.submit ({
							params: {
								ReturnUrl: url
							}
						});
					}
				},
					buttons
				]
			}
		}
		let loginDialog = Ext.create ("Ext.Window", {
			title: me.name || $o.getString ("Authorization"),
			iconCls: "gi_keys",
			width: 300,
			height: 200,
			layout: "vbox",
		    bodyPadding: 5,
		    closable: false,
			monitorValid: true,
//			tbar: [{
//				xtype: "tbtext",
//				text: "<b>" + ($o.app.name || $o.app.code) + " " + ($o.app.version || "")
//			}],
			defaults: {
				listeners: {
					specialkey: function (object, event) {
						if (event.getKey () == event.ENTER) {
							tryLogin ();
						};
					}
				}
			},
			items: [{
				xtype: "textfield",
//				fieldLabel: "Логин",
				emptyText: $o.getString ("Login"),
				id: "$o.app.login.field",
				allowBlank: false,
				msgTarget: "side",
				width: 270,
				style: {
					marginTop: 10
				}
			}, {
				xtype: "textfield",
//				fieldLabel: "Пароль",
				emptyText: $o.getString ("Password"),
				id: "$o.app.password.field",
				inputType: "password",
				allowBlank: false,
				msgTarget: "side",
				width: 270,
				style: {
					marginTop: 10
				}
			}, {
				xtype: "checkbox",
				boxLabel: $o.getString ("Remember"),
				id: "$o.app.remember",
				width: 270,
				style: {
					marginTop: 10
				}
			},
				buttons
			]
			/*,
			buttons: [{
				text: "Вход",
				iconCls: "gi_ok",
				formBind: true,
				handler: tryLogin
			}]*/
		});
		loginDialog.show (null, function () {
			Ext.getCmp ("$o.app.login.field").focus ();
			if ($o.util.getCookie ("login")) {
				Ext.getCmp ("$o.app.remember").setValue (1);
				Ext.getCmp ("$o.app.login.field").setValue ($o.util.getCookie ('login'));
				Ext.getCmp ("$o.app.password.field").setValue ("password in cookie");
			}
		});
	},
	/*
		TreeStore
	*/
	initTreeStore: function (options) {
		let model = Ext.ModelManager.getModel (options.model);
		let fields = model.getFields ();
		let map = options.map;
		let getNode = function (options) {
			for (let i = 0; i < fields.length; i ++) {
				let f = fields [i];
				options.r [f.name] = options.c.get (f.name);
			};
			if (options.c.childs.length) {
				options.r.children = [];
				for (let i = 0; i < options.c.childs.length; i ++) {
					let r = {};
					getNode ({c: map [options.c.childs [i]], r: r});
					options.r.children.push (r);
				};
			} else {
				options.r.leaf = true;
			};
		};
		let data = [];
		for (let i = 0; i < $o.store [options.data].getCount (); i ++) {
			let c = $o.store [options.data].getAt (i);
			if (c.get ("parent")) {
				continue;
			};
			let r = {};
			getNode ({c: c, r: r});
			data.push (r);
		};
		this.treeStore [options.data] = Ext.create ("Ext.data.TreeStore", {
			model: options.model,
			autoLoad: true,
			root: {
				text: ".",
				children: data
			},
			proxy: {
				type: "memory",
				reader: {
					type: "json"
				}
			}			
		});
	},
	tabChangeListener: function (tp) {
		let tab = tp.getActiveTab ();
		if (!tab) {
			return;
		};
		// hash
		if (tab.id) {
			document.location.href = '#' + tab.id;
		};
		// title
		let n = tab.title;
		if (tab.id) {
			if (tab.id [0] == 'o') {
				let o = $zs.getObject (tab.id.substr (1));
				n = o.get ('name');
			} else
			if (tab.id [0] == 'v') {
				let v = $zs.viewsMap [tab.id.substr (1)];
				try {
					n = v.stub.get ('name');
				} catch (e) {
					n = v.get ('name');
				};
			};
		};
		document.title = n + ' - ' + $ptitle;
	},
	/*
		Создает рабочий стол
	*/
	createDesktop: function (options) {
		let me = this;
		let cleanViewport = options.cleanViewport;
		$o.app.tp = Ext.create ("Ext.tab.Panel", {
		    region: "center",
		    layout: "fit",
			listeners: {
				tabchange: {
					fn: me.tabChangeListener,
					scope: me
				}
			}
		});
		$o.app.lb = Ext.create ("Ext.Toolbar", {
			region: "west",
			dock: "left",
			autoScroll: true,
			items: []
		});
		$o.app.rb = Ext.create ("Ext.Toolbar", {
			region: "east",
			dock: "right",
			items: []
		});
		$o.app.tb = Ext.create ("Ext.Toolbar", {
			region: "north",
			items: []
		});
		$o.app.bb = Ext.create ("Ext.Toolbar", {
			region: "south",
			items: []
		});
		let items = [];
		if ($o.currentUser == "admin") {
			let itemsVisual = [{
				xtype: "label",
				text: "Visual Objectum",
				style: "font-weight: bold; color: #073255; margin-left: 5px; margin-right: 15px; text-shadow: -1px -1px 1px white, 1px -1px 1px white, -1px 1px 1px white, 1px 1px 1px white;"
				/*
			}, {
				xtype: "label",
				text: "beta",
				style: "color: #CC0000; font-weight: bold; margin-left: 2px; margin-right: 10px;"
				*/
			}, {
				text: $o.getString ("Classes"),
				iconCls: "gi_cogwheels",
				handler: function () {
					$o.app.show ({items: {
						id: "conf_classes",
						xtype: "$o.classes",
						title: $o.getString ("Classes"),
					   	iconCls: "gi_cogwheels",
						name: "classes"
					}});
				}
			}, {
		    	text: $o.getString ("Views"),
		    	iconCls: "gi_eye_open",
				handler: function () {
					$o.app.show ({items: {
						id: "conf_views",
						xtype: "$o.views",
						title: $o.getString ("Views"),
						iconCls: "gi_eye_open",
				    	name: "views"
					}});
				}
			}];
			if ($o.visualObjectum && $o.visualObjectum.menuConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Menu"),
			    	iconCls: "gi_list",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.menu")
						});
					}
				});
			};
			if ($o.visualObjectum && $o.visualObjectum.accessConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Access"),
			    	iconCls: "gi_keys",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.access")
						});
					}
				});
			};
			/*
			if ($o.visualObjectum && $o.visualObjectum.reportConstructor) {
				itemsVisual.push ({
			    	text: "Отчеты",
			    	iconCls: "gi_print",
					handler: function () {
						$o.app.show.call ($o.app, {
							record: $o.getView ("system.vo.reports")
						});
					}
				});
			};
			*/
			if ($o.visualObjectum && $o.visualObjectum.projectConstructor) {
				itemsVisual.push ({
			    	text: $o.getString ("Project"),
			    	iconCls: "gi_briefcase",
			    	name: "project",
					handler: function () {
						$o.app.show ({items: {
							id: "conf_project",
							xtype: "$projectdesigner",
					    	title: $o.getString ("Project"),
					    	name: "project",
					    	iconCls: "gi_briefcase"
						}});
					}
				});
			};
			itemsVisual.push ("->");
			itemsVisual.push ({
		    	text: $o.getString ("Exit"),
		    	iconCls: "gi_exit",
				handler: function () {
					$o.logout ({success: function () {
						location.reload ();
					}});
				}
			});
			$o.app.cb = Ext.create ("Ext.Toolbar", {
				region: "north",
				border: false,
				style: "background-color: #b8d7f1; padding: 5px; margin-bottom: 3px;",
				items: itemsVisual
			});
			items.push ($o.app.cb);
		};
		// title or logo
		if ($o.visualObjectum && $o.visualObjectum.menuConstructor) {
			if ($o.visualObjectum.logo.left && $o.visualObjectum.logo.height) {
				let w = window,
				    d = document,
				    e = d.documentElement,
				    g = d.getElementsByTagName('body')[0],
				    x = w.innerWidth || e.clientWidth || g.clientWidth,
				    y = w.innerHeight|| e.clientHeight|| g.clientHeight
				;
				items = [new Ext.Panel ({
					region: "north",
					border: false,
					width: x,
					height: $o.visualObjectum.logo.height,
					xtype: "panel",
					bodyStyle: "background-color: #ffffff; padding: 0px !important; border-bottom: 1px solid #428bca !important;",
					html: 
						"<div style='width: 100%; height: " + $o.visualObjectum.logo.height + ";'>" +
						"<img src='" + $o.visualObjectum.logo.left + "'>" +
						($o.visualObjectum.logo.right ? ("<img src='" + $o.visualObjectum.logo.right + "' align=right>") : "") +
						"</div>"
				})].concat (items);
			} else {
				items.push (Ext.create ("Ext.Toolbar", {
					region: "north",
					border: false,
					style: "background-color: #fff; padding: 5px; margin-bottom: 3px;",
					items: [{
						xtype: "label",
						text: $ptitle,
						style: "font-weight: bold; font-size: 15pt; font-style: italic; color: #b8d7f1; margin-left: 5px; margin-right: 15px; text-shadow: -1px -1px 1px #073255, 1px -1px 1px #073255, -1px 1px 1px #073255, 1px 1px 1px #073255;"
					}]
				}));
			};
		};
		items = items.concat (
			$o.app.lb, $o.app.rb, $o.app.tb, $o.app.bb
		);
		if (!cleanViewport) {
			items.push ($o.app.tp);
		} else {
			$o.app.tb.hide ();
			$o.app.lb.hide ();
			$o.app.rb.hide ();
		};
		if ($o.app.vp) {
			$o.app.vp.destroy ();
		};
		$o.app.vp = Ext.create ("Ext.container.Viewport", {
			layout: "border",
			border: false,
			defaults: {
				border: false
			},
			items: items
		});
		Ext.window.Window.prototype.maxHeight = Ext.getBody ().getViewSize ().height;
	},
	/*
		Показывает представление (view, editView, class, items)
	*/
	show: function (options) {
		let me = this;
		let items = options.items;
		let record = options.record;
		let readOnly = options.readOnly;
		let tabId;
		if (record) {
			let className = Ext.getClassName (record);
			if (className == "$o.View.Model") {
				if (!record.get ("query") && !record.get ("layout")) {
					return;
				};
				tabId = "v" + record.get ("id");
				if (record.get ("layout")) {
					items = {
						xtype: "$o.layout",
						record: record,
						$layout: readOnly ? common.makeReadOnlyLayout (record.get ("layout")) : record.get ("layout")
					};
				};
				if (!record.get ("layout") && record.get ("query")) {
					items = {
						xtype: "$o.layout",
						$layout: {
							olap: {
								id: "olap",
								view: record.getFullCode ()
							}
						}
					};
				};
			};
		} else {
			if (!items.hasOwnProperty ("closable")) {
				items.closable = true;
			};
			tabId = items.id;
		};
		if (!items) {
			return;
		};
		let center = $o.app.vp.down ("*[region='center']");
		if (Ext.getClassName (center) == "Ext.tab.Panel") {
			let tab = me.tp.down ("#" + tabId);
			if (!tab) {
				if (record) {
					tab = me.tp.add ({
						id: tabId,
						title: $o.getString (record.get ("name")),
						iconCls: record.get ("iconCls"),
						closable: true,
						layout: "fit",
						border: false,
						isTab: 1,
						items: items
					});
				} else {
					items.isTab = 1;
					tab = me.tp.add (items);
				};
			};
			me.tp.doLayout ();
			me.tp.setActiveTab (tabId);
		} else {
			$o.app.vp.remove (center);
			items.region = "center";
			$o.app.vp.add (items);
		};
	},
	/*
		Перехватчик Ajax запросов
	*/
	beforerequest: function (conn, options, eOpts) {
		let me = this;
		let url = options.url;
		let olapRequest = function () {
			let start = options.params.page > 1 ? (options.params.page - 1) * options.params.limit : 0;
			let limit = options.params.limit;
			let tokens = url.substr (12, url.length - 12).split ("&");
			let id = tokens [0].split ("=")[1];
			let cmpId = tokens [1].split ("=")[1];
			options.url = "?sessionId=" + $sessionId;
			options.method = "POST";
			let order = null;
			if (options.params.sort) {
				let sort = eval ("(" + options.params.sort + ")");
				order = [sort [0].property, sort [0].direction];
			};
			let filter = [];
			let grid = Ext.getCmp (cmpId);
			if (grid) {
				let gridFilter = grid.getFilter ();
				if (gridFilter && gridFilter.length) {
					filter = [gridFilter];
				};
			} else {
				grid = {};
			};
			if (options.params.filter) {
				let fs = eval ("(" + options.params.filter + ")");
				let va = $o.viewsMap [id].attrs;
				for (let i = 0; i < fs.length; i ++) {
					let f = fs [i];
					if (typeof (f.value) == "object" && f.value.isNotNull) {
						if (filter.length) {
							filter.push ("and");
						};
						filter.push (f.field);
						filter.push ("is not null");
						continue;
					} else
					if (typeof (f.value) == "object" && f.value.isNull) {
						if (filter.length) {
							filter.push ("and");
						};
						filter.push (f.field);
						filter.push ("is null");
						continue;
					};
					let dataType;
					if (!va [f.field].get ("classAttr")) {
						dataType = "number";
					} else {
						dataType = $o.classAttrsMap [va [f.field].get ("classAttr")].getDataType ();
					}
					if (dataType == "string") {
						let has = 0;
						for (let j = 1; j < filter.length; j ++) {
							if (filter [j] == "like" && filter [j - 1] == f.field && filter [j + 1] == (f.value + "%")) {
								has = 1;
								break;
							};
						};
						if (has) {
							continue;
						};
					};
					if (dataType == "bool") {
						f.value = f.value ? 1 : 0;
						let has = 0;
						for (let j = 1; j < filter.length; j ++) {
							if (filter [j] == "=" && filter [j - 1] == f.field && filter [j + 1] == f.value) {
								has = 1;
								break;
							};
						};
						if (has) {
							continue;
						};
					};
					if (filter.length) {
						filter.push ("and");
					};
					if (dataType == "bool") {
						if (f.value) {
							filter.push ([f.field, "=", 1]);
						} else {
							filter.push ([f.field, "=", 0, "or", f.field, "is null"]);
						}
					} else
					if (dataType == "date" && f.comparison == "eq") {
						if (_.isArray (filter [0])) {
							let n = filter [0].indexOf (f.field);
							if (n > -1) {
								if (filter [0].length == 4) {
									filter.splice (0, 2);
								} else 
								if (n == 0) {
									filter [0].splice (0, 4);
								} else {
									filter [0].splice (n - 1, 4);
								}
							}
						}
						filter = filter.concat (f.field, ">=", f.value + " 00:00:00", "and", f.field, "<=", f.value + " 23:59:59");
					} else {
						filter.push (f.field);
						if (f.comparison) {
							if (f.comparison == "lt") {
								filter.push ("<");
							};
							if (f.comparison == "gt") {
								filter.push (">");
							};
							if (f.comparison == "eq") {
								filter.push ("=");
							};
							if (f.comparison == "lte") {
								filter.push ("<=");
							};
							if (f.comparison == "gte") {
								filter.push (">=");
							};
							if (f.comparison == "neq") {
								filter.push ("<>");
							};
						} else {
							if (dataType == "string") {
								let v = f.value;
								if (typeof (v) == "object") {
									if (v.value.indexOf (",") > -1) {
										if (v.notLike) {
											filter.push ("not in");
										} else {
											filter.push ("in");
										}
										f.value = v.value.split (",").join (".,.").split (".");
									} else {
										if (v.notLike) {
											filter.push ("not like");
										} else {
											filter.push ("like");
										}
										f.value = v.value + "%";
									}
								} else {
									filter.push ("like");
									f.value = f.value + "%";
								}
							} else {
								filter.push ("=");
							};
						};
						//if (dataType == "date") {
							//f.value = f.value.substr (3, 2) + "." + f.value.substr (0, 2) + "." + f.value.substr (6, 4);
							// гдето прописано: Ext.ux.grid.filter.DateFilter.prototype.dateFormat = "d.m.Y";
						//};
						filter.push (f.value);
					};
				};
			};
			if (filter && filter.length == 1) {
				filter = filter [0];
			};
			options.params = $o.code + ".View.getContent(" + id + ", 0," + start + ", 50, " + limit + ", null, [!{" +
				"\"filter\":" + JSON.stringify (filter) + "," +
				"\"order\":" + JSON.stringify (order) + "," +
				"\"total\":" + JSON.stringify (grid.total || null) + "," +
				"\"dateAttrs\":" + JSON.stringify (grid.dateAttrs || null) + "," +
				"\"timeOffsetMin\":" + (new Date ()).getTimezoneOffset () +
			"}!])";
			options.intercepted = "getContent";
			options.viewId = id;
			options.cmpId = cmpId;
			options.start = start;
		};
		let treegridRequest = function () {
			let node = options.params.node == "root" ? null : options.params.node;
			let tokens = url.substr (16, url.length - 16).split ("&");
			let id = tokens [0].split ("=")[1];
			let view = $o.viewsMap [id];
			let cmpId = tokens [1].split ("=")[1];
			let treegrid = Ext.getCmp (cmpId);
			let fieldParent = tokens [2].split ("=")[1];
			let fieldId = tokens [3].split ("=")[1];
			options.url = "?sessionId=" + $sessionId;
			options.method = "POST";
			let query = eval ("(" + view.get ("query") + ")");
			let alias, table; for (alias in query.from [0]) {table = query.from [0][alias]; break;};
			let fieldParentPair = {}, attrParent;
			for (let i = 1; i < query.select.length; i += 2) {
				if (query.select [i] == fieldParent) {
					fieldParentPair = $o.util.clone (query.select [i - 1]);
					for (let key in fieldParentPair) {attrParent = fieldParentPair [key];}
				};
			};
			let fieldIdPair = {}, attrId;
			for (let i = 1; i < query.select.length; i += 2) {
				if (query.select [i] == fieldId) {
					fieldIdPair = $o.util.clone (query.select [i - 1]);
					for (let key in fieldIdPair) {attrId = fieldIdPair [key];}
				};
			};
			let filter = [fieldParentPair, "is null"];
			if (node) {
				filter = [fieldParentPair, "=", node];
			};
			let where = query.where || [];
			if (where.length) {
				where.push ("and");
			};
			where = where.concat (filter);
			query.select = query.select.concat ([
				{"___childs": attrId}, "___childId",
				fieldParentPair, "___parentId"
			]);
			let field2 = {}; field2 [alias] = attrId;
			query.from = query.from.concat (["left-join", {"___childs": table}, "on", [{"___childs": attrParent}, "=", field2]]);
			if (treegrid.filter && treegrid.filter.childsFn) {
				let cf = treegrid.filter.childsFn ();
				if (cf && cf.length) {
					query.from [query.from.length - 1] = query.from [query.from.length - 1].concat ("and", cf);
				};
			};
			let convertFilter = function (query, filter) {
				let fields = {};
				for (let i = 0; i < query.select.length; i += 2) {
					fields [query.select [i + 1]] = query.select [i];
				};
				let r = [];
				for (let i = 0; i < filter.length; i ++) {
					if (Ext.isArray (filter [i])) {
						r.push (convertFilter (query, filter [i]));
					} else {
						if (fields [filter [i]]) {
							r.push ($o.util.clone (fields [filter [i]]));
						} else {
							r.push (filter [i]);
						};
					};
				};
				return r;
			};
			if (treegrid.filter) {
				if (!node || (node && treegrid.filter.all)) {
					let treeFilter = treegrid.getFilter ();
					let filter = convertFilter (query, treeFilter);
					if (filter && filter.length) {
						where = where.concat ("and", filter);
					};
				};
			};
			if (!node && treegrid.$opened.length) {
				let openedFilter = [fieldParentPair, "in", treegrid.$opened.join (".,.").split (".")];
				if (treegrid.filter && treegrid.filter.all) {
					let treeFilter = treegrid.getFilter ();
					let filter = convertFilter (query, treeFilter);
					if (filter && filter.length) {
						openedFilter = openedFilter.concat ("and", filter);
					};
				};
				where.push ("or");
				where.push (openedFilter);
			};
			query.where = where;
			options.params = $o.code + ".Storage.execute([!" + JSON.stringify (query) + "!])",
			options.intercepted = "treegrid";
			options.viewId = id;
			options.query = query;
			options.fieldId = fieldId;
			options.node = node;
			options.cmpId = cmpId;
		};
		if (url.substr (0, 11) == "view?read=1") {
			olapRequest ();
		};
		if (url.substr (0, 15) == "treegrid?read=1") {
			treegridRequest ();
		};
	},
	/*
		Перехватчик Ajax запросов (ответ)
	*/
	requestcomplete: function (conn, response, options, eOpts) {
		let r;
		try {
			r = eval ("(" + response.responseText + ")");
		} catch (e) {
		};
		if (r && r.header && r.header.error) {
			let msg = r.header.error;
			//common.message ("<font color=red>" + $o.locale.translate (msg) + "</font><br>" + JSON.stringify (options));
			let win = Ext.create ("Ext.window.Window", {
				title: $ptitle,
				resizable: false,
				closable: true,
				width: 600,
				height: 400,
				layout: "fit",
				modal: true,
				items: [{
					xtype: "panel",
					border: false,
					style: "padding: 5",
					html: "<font color=red>" + $o.locale.translate (msg) + "</font>"
				}],
				buttons: [{
					text: $o.getString ("More"),
					iconCls: "gi_circle_question_mark",
					handler: function () {
						win.removeAll ();
						win.add ({
							xtype: "panel",
							border: false,
							style: "padding: 5",
							html: "<font color=red>" + $o.locale.translate (msg) + "</font><br>" + JSON.stringify (options)
						});
					}
				}, {
					text: "Ok",
					name: "ok",
					iconCls: "gi_ok",
					handler: function () {
						win.close ();
					}
				}]
			});
			win.show (null, function () {
				win.down ("*[name='ok']").focus ();
			});
			throw r.header.error + " options: " + JSON.stringify (options);
		};
		let olapResponse = function () {
			let model = Ext.ModelManager.getModel ("$o.View." + options.viewId + ".Model");
			// fields
			let mFields = model.getFields ();
			let rt = eval ("(" + response.responseText + ")");
			let vFields = [];
			let fieldsMap = {};
			let grid = Ext.getCmp (options.cmpId);
			for (let i in rt.data.column) {
				let attr = rt.data.column [i][0].attr;
				vFields.push (attr);
				for (let j = 0; j < mFields.length; j ++) {
					if (mFields [j].name == attr) {
						fieldsMap [i] = mFields [j].name;
						break;
					};
				};
				delete grid.totalValues [attr];
				if (rt.data.column [i][0].total) {
					grid.totalValues [attr] = rt.data.column [i][0].total;
				};
			};
			// data
			let data = [];
			for (let i = 0; i < rt.data.tree.currentLength; i ++) {
				let row = rt.data.tree [options.start + i].data;
				let rec = {};
				for (let j = 0; j < vFields.length; j ++) {
					rec [fieldsMap [j]] = row [j].text;
				};
				data.push (rec);
			};
			grid.countOverflow = rt.data.tree.overflow;
			let r = {
				success: true,
				total: rt.data.tree.length,
				data: data
			};
			response.responseText = JSON.stringify (r);
		};
		let treegridResponse = function () {
			let node = options.node || null;
			let model = Ext.ModelManager.getModel ("$o.View." + options.viewId + ".Model");
			let view = $o.viewsMap [options.viewId];
			let treegrid = Ext.getCmp (options.cmpId);
			let mFields = view.orderedFields;
			let rt = eval ("(" + response.responseText + ")");
			let fieldsMap = {};
			let query = options.query;
			for (let i = 0; i < query.select.length; i += 2) {
				let attr; for (let alias in query.select [i]) {attr = query.select [i + 1]; break;};
				for (let j = 0; j < mFields.length; j ++) {
					if (mFields [j].name == attr) {
						fieldsMap [i / 2] = mFields [j].name;
						break;
					};
				};
			};
			let /*prevId, */levels = {}, hasId = [];
			for (let i = 0; i < rt.data.length; i ++) {
				let row = rt.data [i];
				let rec = {};
				let j;
				for (j = 0; j < mFields.length; j ++) {
					rec [fieldsMap [j]] = row [j];
				};
				let childId = row [j];
				let parentId = row [j + 1];
//				if (prevId != rec [options.fieldId]) {
				if (hasId.indexOf (rec [options.fieldId]) == -1) {
					if (!childId) {
						rec.leaf = true;
					};
					if (treegrid && treegrid.showChecks) {
						rec.checked = false;
					};
					levels [parentId] = levels [parentId] || [];
					levels [parentId].push (rec);
					//prevId = rec [options.fieldId];
					hasId.push (rec [options.fieldId]);
				};
			};
			if (!node && levels [null] && levels [null].length) {
				let addChildren = function (rec) {
					let nodes = levels [rec [options.fieldId]];
					if (nodes) {
						let childs = [];
						for (let i = 0; i < nodes.length; i ++) {
							childs.push (nodes [i]);
							addChildren (nodes [i]);
						};
						rec.children = childs;
						rec.expanded = true;
					};
				};
				for (let i = 0; i < levels [null].length; i ++) {
					addChildren (levels [null][i]);
				};
			};
			let data = levels [node];
			let r = {
			    text: ".",
			    children: data
			};
			response.responseText = JSON.stringify (r);
		};
		if (options.intercepted == "getContent") {
			olapResponse ();
		};
		if (options.intercepted == "treegrid") {
			treegridResponse ();
		};
	},
	/*
		Перехватчик Ajax запросов (exception)
	*/
	requestexception: function (conn, response, options, eOpts) {
		if ($o.idleTimer > $o.maxIdleSec) {
			return;
		};
		let err = response.responseText == "<html><head><title>Unauthenticated</title></head><body><h1>401 Unauthenticated</h1></body></html>" ? $o.getString ("Session not authorized. Please, reload browser page") : response.responseText;
		if (!err) {
			err = $o.getString ("Could not connect to server") + "<br>status: " + response.status + " " + response.statusText;
		};
		common.message ("<font color=red>" + err + "</font><br>url: " + options.url + "<br>params: " + options.params);
	},
	/*
		Старт приложения
	*/
	start: function (options) {
		let me = this;
		let meOptions = options;
		me.code = options.code;
		me.name = options.name;
		me.version = options.version;
		me.locale = options.locale;
		let success = options.success;
		let scope = options.scope;
		$ptitle = options.name;
		$pversion = options.version;
		let useHash = options.useHash;
		let go = function () {
			if (meOptions.locale != "en") {
	    		$o.locale.load ("/client/extjs4/locale/" + meOptions.locale + ".json");
	    	};
	    	$o.executeQueueFunctions ();
			Ext.Ajax.on ("beforerequest", $o.app.beforerequest, $o.app);
			Ext.Ajax.on ("requestcomplete", $o.app.requestcomplete, $o.app);
			Ext.Ajax.on ("requestexception", $o.app.requestexception, $o.app);
	    	me.login (Ext.apply (meOptions, {scope: me, success: function (options) {
				me.treeStore = {};
		    	me.initTreeStore ({
		    		model: "$o.Class.Model",
		    		data: "classes",
		    		map: $o.classesMap
		    	});
		    	me.initTreeStore ({
		    		model: "$o.View.Model",
		    		data: "views",
		    		map: $o.viewsMap
		    	});
	    		me.createDesktop (options);
	    		$o.initAdapter ();
	    		if ($o.visualObjectum) {
		    		if ($o.currentUser == "admin") {
						let projectNeedBuild = common.getConf ("projectNeedBuild");
						if (projectNeedBuild.used && $o.app.vp.down ("*[name=project]")) {
							me.projectNeedBuildTooltip = Ext.create ("Ext.tip.ToolTip", {
							    title: $o.getString ("Need assembly"),
							    target: $o.app.vp.down ("*[name=project]").id,
							    anchor: 'top',
							    html: $o.getString ("To update actions"),
							    width: 200,
							    autoHide: true,
							    autoShow: true,
							    closable: true
							});
						};
					};
					let href = document.location.href;
					if (href.indexOf ("#") > -1 && !useHash) {
						let tokens = href.split ("#");
						document.location.href = tokens [0] + "#";
					};
		    		if ($o.visualObjectum.menuConstructor) {
						system.init ();
						system.vo.buildMenu ();
			    		if ($o.visualObjectum.initAction) {
			    			let fn_ = eval ("(" + $o.visualObjectum.initAction + ")");
			    			fn_ ();
			    		};
					};
				};
				$o.app.fireEvent ("ready");
				if (success) {
	    			success.call (scope || me, options);
	    		};
	    	}}));
		};
		if ($o.app.extReady) {
			go.call (me);
		} else {
			$o.app.on ("extReady", go, me);
		};
	},
	loginDialog: function (options) {
		$o.app.vp.destroy ();
		for (let id in $o.viewsMap) {
			let c = Ext.getCmp ("v" + id);
			if (c) {
				c.destroy ();
			};
		};
		let me = this;
		options = options || {};
		$o.app.start ({
			code: me.code || options.code, 
			name: me.name || options.name, 
			version: me.version || options.version, 
			locale: me.locale || options.locale,
			success: options.success
		});
	},
	sendMail: function (options) {
		options = options || {};
		if (!options.to || !options.subject || !options.message) {
			return;
		};
		Ext.Ajax.request ({
			url: "sendmail?sessionId=" + $sessionId,
			method: "post",
			params: {
				to: options.to,
				from: options.from,
				subject: options.subject,
				message: options.message,
				attachments: JSON.stringify (options.attachments)
			}
		});
	},
	loadScript: function (src, cb) {
	    let script = document.createElement ("script");
		let appendTo = document.getElementsByTagName ("head")[0];
	    if (script.readyState && !script.onload) {
	        // IE, Opera
	        script.onreadystatechange = function () {
	            if (script.readyState == "loaded" || script.readyState == "complete") {
	                script.onreadystatechange = null;
	                cb ();
	            }
	        }
	    } else {
	        // Rest
	        script.onload = cb;
	    };
	    script.src = src;
	    appendTo.appendChild (script);
	}
});
/*
	launch
*/
Ext.onReady (function () {
//	if (document.location.href [document.location.href.length - 1] != "/" && document.location.href.indexOf ("#") == -1) {
//		document.location.href = document.location.href + "/";
//	};
	Ext.QuickTips.init ();
	$o.app.extReady = true;
	Ext.Ajax.disableCaching = false;
	Ext.Ajax.timeout = 120000;
	$o.app.fireEvent ("extReady");
});
