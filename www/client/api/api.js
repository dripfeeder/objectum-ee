/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

/*	
	$o.events:
		showPage // открылся новый tab
		objectChanged // объект изменился
		viewInit // инициализация представления (нужно для настройки панели представления например)
*/

/*
	Global variables
*/
$sessionId = undefined;
$userId = undefined;

/*
window.onerror = function (msg, url, lineNumber) {
	console.log ("window.onerror", msg, url, lineNumber);
	alert ("Ошибка: " + msg + "\nurl: " + url + "\nline: " + lineNumber);
	return true;
};

Ext.Error.handle = function (err) {
	console.log ("Ext.error.handle", err);
	common.message ("Ошибка: " + JSON.stringify (err));
	return true;
};
*/

//Ext.error.raise ("bad request");
/*
	Objectum storage
*/
Ext.define ("$o", {
	singleton: true,
	mixins: {
		observable: 'Ext.util.Observable'
	},	
	code: null,
	// Текущий пользователь, который аутентифицировался
	currentUser: null,
	// Кэш объектов
	objectsMap: {},
	// Кэш действий
	actionsMap: {},
	/*
		Конструктор
	*/
	constructor: function (config) {
		this.mixins.observable.constructor.call (this, config);
		this.addEvents (
			"afterCreateObject",
			"beforeCommitObject",
			"beforeRemoveObject"
		);
	},
	load: function (options) {
		var me = this;
		var success = options.success;
		var scope = options.scope;
		me.initModels ();
		me.initStores ({success: function (options) {
			me.initClasses (options);
			me.initClassAttrs (options);
			me.initViews (options);
			me.initViewAttrs (options);
			me.initClassModels ();
			success.call (scope || me, options);
		}});
	},
	/*
		Инициализация: {
			login,
			password, // SHA-1
			success
		}
	*/
	init: function (options) {
		if (!options) {
			throw new Error ("$o.init must have options: {success}");
		};
		var me = this;
		me.code = options.code;
		var mainOptions = options;
		var failure = options.failure;
		var scope = options.scope;
		if (me.authorized) {
			me.load (options);
		} else {
			me.authorize (Ext.apply (options, {success: function (options) {
				me.load (options);
			}, failure: function (options) {
				if (failure) {
					failure.call (scope || me, options);
				};
			}}));
		};
	},
	/*
		Аутентификация: {
			login
			password // SHA-1
		}
	*/
	authorize: function (options) {
		var mainOptions = options;
		Ext.Ajax.request ({
			url: "?authorize=1",
			params: options.login + "\n" + options.password + "\n" + options.passwordPlain,
			success: function (response, options) {
				if (!response.responseText) {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "Authentication error");
					};
					return;
				};
				if (response.responseText.substr (0, 4) == "wait") {
					if (mainOptions.failure) {
						var secs = response.responseText.split (" ")[1];
						mainOptions.failure.call (mainOptions.scope || this, "Ждите " + (secs / 60 | 0) + " мин. до следующей попытки входа.");
					};
					return;
				};
				if (response.responseText == "no free slots") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "no free slots");
					};
					return;
				};
				if (response.responseText == "user in system") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "user in system");
					};
					return;
				};
				if (response.responseText == "firewall denied") {
					if (mainOptions.failure) {
						mainOptions.failure.call (mainOptions.scope || this, "Запрещен доступ по данной ссылке.");
					};
					return;
				};
				var tokens = response.responseText.split (" ");
				var sessionId = tokens [0];
				var userId = tokens [1];
				if (userId == "null") {
					userId = null;
				};
				this.sessionId = $sessionId = sessionId;
				this.userId = $userId = userId;
				this.authorized = true;
				this.currentUser = mainOptions.login;
				if (this.currentUser != "autologin") {
					$o.util.setCookie ("sessionId", sessionId);
				};
				if (tokens.length > 2 && tokens [2] == 3) {
					$o.serverVersion = 3;
				} else {
					$o.serverVersion = 2;
				};
				if (tokens.length > 4) {
					$o.roleId = tokens [3] == "null" ? null : tokens [3];
					$o.menuId = tokens [4] == "null" ? null : tokens [4];
				};
				$o.idleTimer = 0;
				var userAction = function () {
					$o.idleTimer = 0;
				};
				if (this.currentUser != "autologin") {
					var timerIntervalId = setInterval (function () {
						$o.idleTimer += 1;
						$o.maxIdleSec = $o.maxIdleSec || (60 * 30);
						if ($o.idleTimer > $o.maxIdleSec) {
							clearInterval (timerIntervalId);
							$o.logout ({success: function () {
								Ext.Msg.alert ($ptitle, $zr.getString ('Session disabled'), function () {
									location.reload ();
								});						
							}});
						};
					}, 1000);
				};
				document.addEventListener ("mousemove", userAction, false);
				document.addEventListener ("click", userAction, false);
				document.addEventListener ("scroll", userAction, false);				
				mainOptions.success.call (mainOptions.scope || this, Ext.apply (mainOptions, {
					sessionId: sessionId,
					userId: userId
				}));
			},
			failure: function () {
				if (mainOptions.failure) {
					mainOptions.failure.call (mainOptions.scope || this, "Authentication error");
				};
			},
			scope: this
			//timeout: 30000
		});
	},
	/*
		Выход из системы
	*/
	logout: function (options) {
		var me = this;
		options = options || {};
		var success = options.success;
		var failure = options.failure;
		function go () {
			Ext.Ajax.request ({
				url: "?logout=1&sessionId=" + me.sessionId,
				params: me.sessionId,
				success: function (response, options) {
					if (success) {
						success ();
					};
				},
				failure: function () {
					if (failure) {
						failure ();
					};
				},
				scope: me
				//timeout: 30000
			});
		}
		if ($o.util.getCookie ("esiaAuth")) {
			$o.util.setCookie ("esiaAuth", "", "/");
			var w = window.open ("https://esia-portal1.test.gosuslugi.ru/profile/user/saml/Logout");
			setTimeout (function () {
				w.close ();
				window.open ("https://esia-portal1.test.gosuslugi.ru/profile/user/saml/Logout");
				go ();
			}, 3000);
		} else {
			go ();
		}
	},
	/*
		Инициализация моделей данных
	*/
	initModels: function () {
		var storage = this;
		Ext.define ("$o.Base.Model", {
		    extend: "Ext.data.Model",
			constructor: function (config) {
				var me = this;
				me.callParent (arguments);
			    me.remove = function () {
			    	me.removed = true;
			    };
			},		    
		    sync: function () {
		    	var me = this;
		    	if (me.removed) {
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".remove(" + me.get ("id") + ")"
					});
					var store;
					if (me.tableName == "Class") {
						store = storage.store.classes;
					};
					if (me.tableName == "ClassAttr") {
						store = storage.store.classAttrs;
					};
					if (me.tableName == "View") {
						store = storage.store.views;
					};
					if (me.tableName == "ViewAttr") {
						store = storage.store.viewAttrs;
					};
					if (me.tableName == "Action") {
						delete storage.actionsMap [me.get ("id")];
						return;
					};
					var rec = store.findRecord ("id", me.get ("id"), 0, false, false, true);
					store.remove (rec);
					if (me.tableName == "Class" || me.tableName == "ClassAttr") {
						storage.initClasses ();
						storage.initClassAttrs ();
						storage.initClassModels ();
					};
					if (me.tableName == "View" || me.tableName == "ViewAttr") {
						storage.initViews ();
						storage.initViewAttrs ();
					};
					return;
		    	};
		    	var values = [];
				for (var i = 0; i < me.fieldsArray.length; i ++) {
					values.push (Ext.encode (me.get (me.fieldsArray [i]) || null));
				};
				if (me.get ("id")) {
					var valuesStr = values.join (",");
					if (me.tableName != "Action") {
						valuesStr = valuesStr.split ("false").join ("0").split ("true").join ("1");
					};
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".set(" + valuesStr + ")"
					});
				} else {
					values.splice (0, 1);
					var valuesStr = values.join (",");
					if (me.tableName != "Action") {
						valuesStr = valuesStr.split ("false").join ("0").split ("true").join ("1");
					};
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + $sessionId,
						params: storage.code + "." + me.tableName + ".create(" + valuesStr + ")"
					});
					storage.checkException (r);
					var o = eval ("(" + r.responseText + ")");
					me.set ("id", o.data [0][0]);
					if (me.tableName == "Class") {
						storage.store.classes.add (me);
					};
					if (me.tableName == "ClassAttr") {
						storage.store.classAttrs.add (me);
					};
					if (me.tableName == "View") {
						storage.store.views.add (me);
					};
					if (me.tableName == "ViewAttr") {
						storage.store.viewAttrs.add (me);
					};
				};
				if (me.tableName == "Class") {
					storage.initClass (me);
				};
				if (me.tableName == "ClassAttr") {
					storage.initClassAttr (me);
					if (me.get ("class")) {
						var cls = $o.getClass (me.get ("class"));
						if (cls) {
							storage.initClass (cls);
						}
					}
				};
				if (me.tableName == "View") {
					storage.initView (me);
				};
				if (me.tableName == "ViewAttr") {
					storage.initViewAttr (me);
				};
		    },
		    toString: function () {
		    	var me = this;
		    	var code = me.get ("code");
		    	if (me.getFullCode) {
		    		code = me.getFullCode ();
		    	};
		    	var r;
		    	if (me.tableName == "Action") {
		    		r = me.get ("name") + " (" + code + ":" + me.get ("id") + ")" + (
		    			me.get ("class") ? (", Класс: " + $o.getClass (me.get ("class")).toString ()) : ""
		    		);
		    	} else {
		    		r = me.get ("name") + " (" + code + ":" + me.get ("id") + ")";
		    	};
		    	return r;
		    }
		});
		Ext.define ("$o.Class.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {	
				name: "parent", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "format", type: "string", useNull: true
			}, {
				name: "view", type: "number", useNull: true
			}, {
				name: "type", type: "number", useNull: true
			}, {
				name: "system", type: "number", useNull: true
		    }],
		    tableName: "Class",
		    fieldsArray: [
				"id", "parent", "name", "code", "description", "format", "view", "type", "system"
		    ],
		    getFullCode: function () {
		    	var code = "";
		    	if (this.get ("parent")) {
		    		code = $o.classesMap [this.get ("parent")].getFullCode ();
		    	};
		    	if (code) {
		    		code += ".";
		    	};
		    	code += this.get ("code");
		    	return code;
		    },
		    getPath: function () {
		    	return this.getFullCode ();
		    },
		    updateDefault: function () {
		    	storage.updateDefaultView.call (this);
		    	storage.updateDefaultActions.call (this);
		    },
		    hasAttrInHierarchy: function (attr) {
		    	var me = this;
		    	function has (cls, attr) {
		    		if (cls.attrs [attr]) {
		    			return $o.getClass (cls.attrs [attr].get ("class"));
		    		} else {
		    			for (var i = 0; i < cls.childs.length; i ++) {
		    				var r = has ($o.getClass (cls.childs [i]), attr);
		    				if (r) {
		    					return r;
		    				};
		    			};
		    		};
		    		return 0;
		    	};
		    	var r = has (me, attr);
		    	return r;
		    }
		});
		Ext.define ("$o.ClassAttr.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "type", type: "number", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "notNull", type: "bool", useNull: true
			}, {
				name: "validFunc", type: "string", useNull: true
			}, {
				name: "formatFunc", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "secure", type: "bool", useNull: true
			}, {
				name: "maxString", type: "number", useNull: true
			}, {
				name: "minString", type: "number", useNull: true
			}, {
				name: "maxNumber", type: "number", useNull: true
			}, {
				name: "minNumber", type: "number", useNull: true
			}, {
				name: "maxDate", type: "date", useNull: true
			}, {
				name: "minDate", type: "date", useNull: true
			}, {
				name: "unique", type: "bool", useNull: true
			}, {
				name: "numberFormat", type: "string", useNull: true
			}, {
				name: "dateFormat", type: "string", useNull: true
			}, {
				name: "removeRule", type: "string", useNull: true
		    }],
		    tableName: "ClassAttr",
		    fieldsArray: [
				"id", "class", "name", "code", "type", "order", "notNull", "validFunc", "formatFunc", "description", "secure", "maxString", "minString", "maxNumber", "minNumber", "maxDate", "minDate", "unique", "numberFormat", "dateFormat", "removeRule"
		    ],
			getDataType: function () {
				var r;
				switch (this.get ("type")) {
				case 1: // string
				case 5: // file
					r = "string";
					break;
				case 2: // number
					r = "number";
					break;
				case 3: // timestamp
					r = "date";
					break;
				case 4: // bool
					r = "bool";
					break;
				case 6: // class
				case 7: // classAttr
				case 8: // view
				case 9: // viewAttr
					r = "number";
					break;
				default:
					r = "number";
				};
				return r;
			},
			getFieldType: function () {
				var dt = this.getDataType ();
				var r = "numberfield";
				if (dt == "string") {
					r = "textfield";
				};
				if (dt == "date") {
					r = "datefield";
				};
				if (dt == "bool") {
					r = "checkbox";
				};
				if (this.get ("type") >= 1000) {
					r = "objectfield";
				};
				if (this.get ("type") == 5) {
					r = "$filefield";
				};
				return r;
			},
			getFilterDataType: function () {
				var r = this.getDataType ();
				if (r == "number") {
					r = "numeric";
				};
				return r;
			},
			getVType: function () {
				var me = this;
				var code;
				if (me.get ("validFunc")) {
					var code = $o.getClass (me.get ("class")).getFullCode () + "." + me.get ("code");
					if (!Ext.form.VTypes [code]) {
						try {
							var vf = eval ("(" + me.get ("validFunc") + ")");
							var o = {};
							o [code] = vf.fn;
							o [code + "Text"] = typeof (vf.description) == "function" ? eval ("(" + vf.description + ")") : vf.description;
							Ext.apply (Ext.form.VTypes, o);
						} catch (e) {
						};
					};
				};
				return code;
			}
		});
		Ext.define ("$o.View.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "parent", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "layout", type: "string", useNull: true
			}, {
				name: "key", type: "string", useNull: true
			}, {
				name: "parentKey", type: "number", useNull: true
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "unrelated", type: "string", useNull: true
			}, {
				name: "query", type: "string", useNull: true
			}, {
				name: "type", type: "bool", useNull: true
			}, {
				name: "system", type: "bool", useNull: true
			}, {
				name: "materialized", type: "bool", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "iconCls", type: "string", useNull: true
		    }],
		    tableName: "View",
		    fieldsArray: [
		    	"id", "parent", "name", "code", "description", "layout", "key", "parentKey", "class", "unrelated", "query", "type", "system", "materialized", "order", "iconCls"
		    ],
		    getFullCode: function () {
		    	var code = "";
		    	if (this.get ("parent")) {
		    		code = $o.viewsMap [this.get ("parent")].getFullCode ();
		    	};
		    	if (code) {
		    		code += ".";
		    	};
		    	code += this.get ("code");
		    	return code;
		    },
		    getPath: function () {
		    	return this.getFullCode ();
		    }
		});
		Ext.define ("$o.ViewAttr.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "view", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "classAttr", type: "number", useNull: true
			}, {
				name: "subject", type: "number", useNull: true
			}, {
				name: "order", type: "number", useNull: true
			}, {
				name: "sort", type: "number", useNull: true
			}, {
				name: "sortOrder", type: "number", useNull: true
			}, {
				name: "operation", type: "number", useNull: true
			}, {
				name: "value", type: "string", useNull: true
			}, {
				name: "area", type: "bool", useNull: true
			}, {
				name: "width", type: "number", useNull: true
			}, {
				name: "totalType", type: "number", useNull: true
			}, {
				name: "readOnly", type: "bool", useNull: true
			}, {
				name: "group", type: "bool", useNull: true
			}, {
				name: "notNull", type: "bool", useNull: true
		    }],
		    tableName: "ViewAttr",
			fieldsArray: [
				"id", "view", "name", "code", "class", "classAttr", "subject", "order", "sort", "sortOrder", "operation", "value", "area", "width", "totalType", "readOnly", "group", "notNull"
			]
		});
		Ext.define ("$o.Action.Model", {
		    extend: "$o.Base.Model",
		    idProperty: "id",
		    fields: [{
				name: "id", type: "number"
			}, {
				name: "class", type: "number", useNull: true
			}, {
				name: "name", type: "string", useNull: true
			}, {
				name: "code", type: "string", useNull: true
			}, {
				name: "description", type: "string", useNull: true
			}, {
				name: "body", type: "string", useNull: true
			}, {
				name: "layout", type: "string", useNull: true
		    }],
		    tableName: "Action",
		    fieldsArray: [
				"id", "class", "name", "code", "description", "order", "body", "layout"
		    ],
			initAction: function () {
				var actionId = this.get ("id");
				var a = $o.getAction (actionId);
				var cls = $o.getClass (a.get ("class"));
				var fName = cls.getFullCode () + "." + a.get ("code");
				Ext.namespace (fName);
				var f = 
					fName + " = function (options) {\n" +
					a.get ("body") +
					"};\n"
				;
				var l;
				try {
					l = JSON.parse (a.get ("layout"));
				} catch (e) {
				};
				if (l && l.serverAction) {
					return;
				};
				try {
					eval (f);
				} catch (e) {
				};
				if (l && l.layout) {
					var fl = 
						fName + ".layout = " +
						JSON.stringify (l.layout, null, "\t") +
						";\n"
					;
					try {
						eval (fl);
					} catch (e) {
					};
				};
				if (!common.getConf ("projectNeedBuild").used) {
					common.setConf ("projectNeedBuild", {used: 1});
				};
			},
			getFullCode: function () {
				var cls = $o.getClass (this.get ("class"));
				var fn = (cls ? (cls.getFullCode () + ".") : "") + this.get ("code");
				return fn;
			},
		    getPath: function () {
		    	return this.getFullCode ();
		    },
			execute: function (options) {
				var fn_ = eval (this.getFullCode ());
				if (typeof (fn_) == "function") {
					fn_ (options);
				};
			}
		});
	},
	/*
		Инициализация хранилищ данных
	*/
	initStores: function (options) {
		var me = this;
		var mainOptions = options;
		Ext.define ("$o.Class.Store", {
			extend: "Ext.data.Store",
			model: "$o.Class.Model"
		});
		Ext.define ("$o.ClassAttr.Store", {
			extend: "Ext.data.Store",
			model: "$o.ClassAttr.Model"
		});
		Ext.define ("$o.View.Store", {
			extend: "Ext.data.Store",
			model: "$o.View.Model"
		});
		Ext.define ("$o.ViewAttr.Store", {
			extend: "Ext.data.Store",
			model: "$o.ViewAttr.Model"
		});
		me.store = {
			classes: Ext.create ("$o.Class.Store"),
			classAttrs: Ext.create ("$o.ClassAttr.Store"),
			views: Ext.create ("$o.View.Store"),
			viewAttrs: Ext.create ("$o.ViewAttr.Store")
		};
		if ($o.serverVersion == 3) {
			Ext.Ajax.request ({
				url: "?sessionId=" + me.sessionId,
				params: me.code + ".Storage.getAll(\"\")",
				success: function (response, options) {
					var d = eval ("(" + response.responseText + ")");
					me.store.classes.loadData (d.classes);
					me.store.classAttrs.loadData (d.classAttrs);
					me.store.views.loadData (d.views);
					me.store.viewAttrs.loadData (d.viewAttrs);
					me.visualObjectum = d.visualObjectum || {};
					me.visualObjectum.timeMachine = me.visualObjectum.timeMachine || {};
					me.visualObjectum.logo = me.visualObjectum.logo || {};
					me.data = d;
					mainOptions.data = d;
					mainOptions.success.call (mainOptions.scope || me, mainOptions);
				},
				scope: me
			});
		} else {
			me.data = {};
			mainOptions.data = {};
			async.parallel ([
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getClasses(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.classes.loadData (d.data);
							me.data.classes = d.data;
							mainOptions.data.classes = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getClassAttrs(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.classAttrs.loadData (d.data);
							me.classAttrs = {};
							me.data.classAttrs = d.data;
							mainOptions.data.classAttrs = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getViews(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.views.loadData (d.data);
							me.data.views = d.data;
							mainOptions.data.views = d.data;
							cb ();
						},
						scope: me
					});
				},
				function (cb) {
					Ext.Ajax.request ({
						url: "?sessionId=" + me.sessionId + "&username=" + $o.currentUser,
						params: me.code + ".Storage.getViewAttrs(\"\")",
						success: function (response, options) {
							var d = eval ("(" + response.responseText + ")");
							me.store.viewAttrs.loadData (d.data);
							me.data.viewAttrs = d.data;
							mainOptions.data.viewAttrs = d.data;
							cb ();
						},
						scope: me
					});
				}
			], function (err, results) {
				mainOptions.success.call (mainOptions.scope || me, mainOptions);
			});
		};
	},
	/*
		Кидает исключение если есть
	*/
	checkException: function (options) {
		if ($o.app) {
			return; // $o.app.requestcomplete
		};
		var r = eval ("(" + options.responseText + ")");
		if (r && r.header && r.header.error) {
			throw new Error (r.header.error);
		};
	},
	/*
		Инициализация моделей данных для классов
	*/
	initClassModels: function () {
		Ext.define ("$o.Class.Base.Model", {
		    extend: "Ext.data.Model",
		    storage: this,
			/*
				Сохраняет на сервер локальный объект и цепочку зависимых объектов, которые ссылаются на него
			*/
			commitLocal: function () {
				var me = this;
				if (me.local == "child") {
					return;
				};
				me.local = null;
				me.commit ();
				for (var id in me.localChilds) {
					var o = $o.getObject (id);
					if (me.localChilds [id].place == "their") {
						o.set (me.localChilds [id].attr, me.get ("id"));
					};
					o.local = "root";
					o.commitLocal ();
					if (me.localChilds [id].place == "mine") {
						me.set (me.localChilds [id].attr, o.get ("id"));
						me.commit ();
					};
				};
			},
		    commit: function (options) {
		    	if (this.local) {
		    		if (options == "local") {
			    		this.commitLocal ();
		    		};
			    	return;
		    	};
		    	if (this.removed) {
		    		this.storage.removeObject (this.get ("id"));
		    		return;
		    	};
				var changes = {};
				var changedNum = 0;
				for (var i = 0; i < this.fields.getCount (); i ++){
					var attr = this.fields.getAt (i).name;
					if (attr == "id") {
						continue;
					};
					if (!this.data.hasOwnProperty (attr) || 
						(this.data [attr] == this.originalData [attr]) || 
						(this.data [attr] === "" && (!this.originalData.hasOwnProperty (attr) || this.originalData [attr] == null))
					) {
						continue;
					};
					var ca = this.getClassAttr (attr);
					if (ca.getDataType () == "date" && (
							(!this.data [attr] && !this.originalData [attr]) ||
							(this.data [attr] && this.originalData [attr] && this.data [attr].getTime () == this.originalData [attr].getTime ())
						)
					) {
						continue;
					};
					this.originalData [attr] = this.data [attr];
					var v = this.get (attr);
					if (v && typeof (v) == "object" && v.getMonth () && v.getFullYear () == 2000 && v.getMonth () == 1 && v.getDate () == 2 && v.getHours () == 3 && v.getMinutes () == 4 && v.getSeconds () == 5) {
						v = "$CURRENT_TIMESTAMP$";
					};
					if (ca.getDataType () == "bool") {
						v = v ? 1 : 0;
					};
					if (ca.getDataType () == "date" && v && v != "$CURRENT_TIMESTAMP$") {
//						v = v.toUTCString ();
						if (v.getHours () == 0 && v.getMinutes () == 0 && v.getSeconds () == 0) {
							var dd = v.getDate ();
							var mm = v.getMonth () + 1;
							v = v.getFullYear () + "-";
							if (mm < 10) {
								v += "0";
							};
							v += mm + "-";
							if (dd < 10) {
								v += "0";
							};
							v += dd + "T00:00:00.000Z";
						} else {
							v = v.toISOString ();
						};
					};
					changes [attr] = {
						value: v === null ? null : String (v),
						classAttrId: ca.get ("id"),
						type: ca.get ("type"),
						classId: ca.get ("class"),
						classCode: $o.classesMap [ca.get ("class")].get ("code")
					};
					changedNum ++;
				};
				if (changedNum || !this.get ("id") || this.get ("id") < 0) {
					this.storage.fireEvent ("beforeCommitObject", {
						objectId: this.get ("id"), 
						changes: changes
					});
					if (this.get ("id") < 0) {
						this.set ("id", null)
					};
			    	var a = [
			    		this.get ("id"),
			    		changes,
			    		this.get ("classId")
			    	];
					var r = Ext.Ajax.request ({
						async: false,
						url: "?sessionId=" + this.storage.sessionId,
						params: this.storage.code + ".Object.setAttrs([!" + JSON.stringify (a) + "!])"
					});
					this.storage.checkException.call (this.storage, r);
					var o = eval ("(" + r.responseText + ")");
					if (!this.get ("id") || this.get ("id") < 0) {
						if (o.data.id) {
							this.set ("id", o.data.id || o.data);
						};
					};
					for (var a in o.data) {
						if (this.get (a) == '$CURRENT_TIMESTAMP$') {
							this.set (a, new Date (o.data [a]));
						};
					};
				};
		    },
		    sync: function (options) {
		    	this.commit (options);
		    },
		    remove: function () {
				if ($o.isReadOnly ()) {
					common.message ("Изменение данных недоступно.");
					throw new Error ("Изменение данных недоступно.");
				};
		    	this.removed = true;
		    },
		    getClassAttr: function (attr) {
		    	var cls = $o.classesMap [this.get ("classId")];
		    	return cls.attrs [attr];
		    },
			toString: function () {
		    	var cls = $o.classesMap [this.get ("classId")];
				var ff = cls.get ('format');
				var r = this.get ('name');
				if (ff) {
					try {
						var fn = eval ("(function () {" + ff + "})");
						r = fn.call (this);
					} catch (e) {
						console.log ("toString exception");
						console.log (this);
					};
				};
				return r;
			},
			set: function (field, value) {
				if (value == "$CURRENT_TIMESTAMP$") {
					value = new Date (2000, 1, 2, 3, 4, 5);
				};
				if (this.getClassAttr (field) && this.getClassAttr (field).get ("type") >= 1000) {
					if (value && value < 0) {
						var o = $o.getObject (value);
						if (this.local == "root") {
							this.localChilds [o.get ("id")] = {attr: field, place: "mine"};
						} else {
							if (!this.get ("id")) {
								this.set ("id", $o.nextLocalId --);
								$o.objectsMap [this.get ("id")] = this;
							};
							o.localChilds [this.get ("id")] = {attr: field, place: "their"};
							this.local = "child";
						};
					} else {
						/* возврат непонятно как делать т.к. несколько атрибутов могут ссылаться на локальные объекты
						if (this.get (field) && this.get (field) < 0) {
							var o = $o.getObject (this.get (field));
							if (o.localChilds.indexOf (this.get ("id")) > -1) {
								o.localChilds.splice (o.localChilds.indexOf (this.get ("id")), 1);
							};
						};
						*/
						//this.local = null; с этой строчкой не работает. Пример: добавление орагнизации, в его карточке добавление адреса. В карточке адреса сохранение типа адреса. В итоге запись с адресом привязывается к <0 id
					};
				};
				this.callParent (arguments);
			},
			getId: function () {
				return this.get ("id");
			}
		});
		for (var i = 0; i < this.store.classes.getCount (); i ++) {
			var o = this.store.classes.getAt (i);
			var fields = [{
				name: "id", type: "number", useNull: true
			}, {
				name: "classId", type: "number", useNull: true
			}];
			for (var attr in o.attrs) {
				var ca = o.attrs [attr];
				fields.push ({
					name: ca.get ("code"),
					type: ca.getDataType (), 
					useNull: true
				});
			};
			Ext.define ("$o.Class." + o.get ("id") + ".Model", {
			    extend: "$o.Class.Base.Model",
			    fields: fields
			});
		};
	},
	initClass: function (o) {
		var me = this;
		o.stub = o;
		o.attrs = o.attrs || {};
		o.attrsArray = o.attrsArray || [];
		o.childs = o.childs || [];
		me.classesMap [o.get ("id")] = o;
		if (o.get ("parent")) {
			me.classesMap [o.get ("parent")].childs.push (o.get ("id"));
		};
		this.classesCode [o.getFullCode ()] = o;
		var tokens = o.getFullCode ().split ('.');
		if (tokens.length == 3) {
			me.classesCode [tokens [0] + '.' + tokens [2]] = me.classesCode [tokens [0] + '.' + tokens [2]] || o;
		};
		if (tokens.length == 4) {
			me.classesCode [tokens [0] + '.' + tokens [3]] = me.classesCode [tokens [0] + '.' + tokens [3]] || o;
		};
		// classAttr
		if (o.get ("parent")) {
			var parent = $o.getClass (o.get ("parent"));
			for (var attr in parent.attrs) {
				o.attrs [attr] = parent.attrs [attr];
				o.attrsArray.push (parent.attrs [attr]);
			};
		};
		// model
		var fields = [{
			name: "id", type: "number", useNull: true
		}, {
			name: "classId", type: "number", useNull: true
		}];
		for (var attr in o.attrs) {
			var ca = o.attrs [attr];
			fields.push ({
				name: ca.get ("code"),
				type: ca.getDataType (), 
				useNull: true
			});
		};
		if (Ext.ClassManager.get ("$o.Class." + o.get ("id") + ".Model")) {
			var _fields = Ext.ClassManager.get ("$o.Class." + o.get ("id") + ".Model").prototype.fields;
			_.each (fields, function (field) {
				if (!_fields.contains ({name: field.name})) {
					_fields.add (field);
				}
			});
		} else {
			Ext.define ("$o.Class." + o.get ("id") + ".Model", {
			    extend: "$o.Class.Base.Model",
			    fields: fields
			});
		}
	},
	/*
		Инициализация классов
	*/
	initClasses: function (options) {
		this.classesMap = this.classesMap || {};
		for (var i = 0; i < this.store.classes.getCount (); i ++) {
			var o = this.store.classes.getAt (i);
			o.stub = o;
			o.childs = [];
			this.classesMap [o.get ("id")] = o;
		};
		this.classesTree = this.classesTree || {};
		this.classesCode = this.classesCode || {};
		var getTree = function (options) {
			for (var i = 0; i < this.store.classes.getCount (); i ++) {
				var o = this.store.classes.getAt (i);
				if (o.get ("parent") == options.parent) {
					if (options.parent) {
						this.classesMap [options.parent].childs.push (o.get ("id"));
					};
					options.node [o.get ("code")] = {id: o.get ("id"), stub: o};
					var code = options.code ? options.code + '.' + o.get ('code') : o.get ('code');
					o.attrs = {};
					o.attrsArray = [];
					this.classesCode [code] = o;
					var tokens = code.split ('.');
					if (tokens.length == 3) {
						this.classesCode [tokens [0] + '.' + tokens [2]] = this.classesCode [tokens [0] + '.' + tokens [2]] || o;
					};
					if (tokens.length == 4) {
						this.classesCode [tokens [0] + '.' + tokens [3]] = this.classesCode [tokens [0] + '.' + tokens [3]] || o;
					};
					getTree.call (this, {node: options.node [o.get ("code")], parent: o.get ("id"), code: code});
				}
			}
		}
		getTree.call (this, {node: this.classesTree, parent: null});
	},
	initClassAttr: function (o) {
		var me = this;
		me.classAttrs [o.get ("id")] = o;
		me.classAttrsMap [o.get ("id")] = o;
		if (me.classesMap [o.get ("class")]) {
			var addClassAttr = function (oClass) {
				oClass.attrs [o.get ('code')] = o;
				oClass.attrsArray.push (o);
				for (var i = 0; i < oClass.childs.length; i ++) {
					addClassAttr (me.classesMap [oClass.childs [i]]);
				}
			};
			addClassAttr (me.classesMap [o.get ("class")]);
		};
	},	
	/*
		Инициализация атрибутов классов
	*/
	initClassAttrs: function (options) {
		var me = this;
		me.classAttrs = me.classAttrs || {};
		for (var i = 0; i < me.store.classAttrs.getCount (); i ++) {
			var ca = me.store.classAttrs.getAt (i);
			me.classAttrs [ca.get ("id")] = ca;
		};
		me.classAttrsMap = me.classAttrsMap || {};
		for (var i = 0; i < me.store.classAttrs.getCount (); i ++) {
			var o = this.store.classAttrs.getAt (i);
			me.classAttrsMap [o.get ("id")] = o;
			if (me.classesMap [o.get ("class")]) {
				var addClassAttr = function (oClass) {
					oClass.attrs = oClass.attrs || {};
					oClass.attrs [o.get ('code')] = o;
					oClass.attrsArray = oClass.attrsArray || [];
					oClass.attrsArray.push (o);
					for (var i = 0; i < oClass.childs.length; i ++) {
						addClassAttr (me.classesMap [oClass.childs [i]]);
					}
				};
				addClassAttr (me.classesMap [o.get ("class")]);
			}
		}
	},	
	initView: function (o) {
		o.stub = o;
		o.attrs = o.attrs || {};
		o.childs = o.childs || [];
		this.viewsMap [o.get ("id")] = o;
		this.viewsCode [o.getFullCode ()] = o;
		var tokens = o.getFullCode ().split ('.');
		if (tokens.length == 3) {
			this.viewsCode [tokens [0] + '.' + tokens [2]] = this.viewsCode [tokens [0] + '.' + tokens [2]] || o;
		};
		if (tokens.length == 4) {
			this.viewsCode [tokens [0] + '.' + tokens [3]] = this.viewsCode [tokens [0] + '.' + tokens [3]] || o;
		};
		if (o.get ("parent")) {
			this.viewsMap [o.get ("parent")].childs.push (o.get ("id"));
		};
	},
	/*
		Инициализация представлений
	*/
	initViews: function (options) {
		this.viewsMap = this.viewsMap || {};
		for (var i = 0; i < this.store.views.getCount (); i ++) {
			var o = this.store.views.getAt (i);
			o.stub = o;
			o.childs = [];
			this.viewsMap [o.get ("id")] = o;
		};
		this.viewsTree = this.viewsTree || {};
		this.viewsCode = this.viewsCode || {};
		var getTree = function (options) {
			for (var i = 0; i < this.store.views.getCount (); i ++) {
				var o = this.store.views.getAt (i);
				if (o.get ("parent") == options.parent) {
					if (options.parent) {
						this.viewsMap [options.parent].childs.push (o.get ("id"));
					};
					options.node [o.get ("code")] = {id: o.get ("id"), stub: o};
					var code = options.code ? options.code + '.' + o.get ('code') : o.get ('code');
					o.attrs = {};
					this.viewsCode [code] = o;
					if (code) {
						var tokens = code.split ('.');
						if (tokens.length == 3) {
							this.viewsCode [tokens [0] + '.' + tokens [2]] = this.viewsCode [tokens [0] + '.' + tokens [2]] || o;
						};
						if (tokens.length == 4) {
							this.viewsCode [tokens [0] + '.' + tokens [3]] = this.viewsCode [tokens [0] + '.' + tokens [3]] || o;
						};
					};
					getTree.call (this, {node: options.node [o.get ("code")], parent: o.get ("id"), code: code});
				}
			}
		}
		getTree.call (this, {node: this.viewsTree, parent: null});
	},
	initViewAttr: function (o) {
		var me = this;
		me.viewAttrsMap [o.get ("id")] = o;
		me.viewsMap [o.get ("view")].attrs [o.get ("code")] = o;
	},
	/*
		Инициализация атрибутов представлений
	*/
	initViewAttrs: function (options) {
		var me = this;
		me.viewAttrsMap = me.viewAttrsMap || {};
		for (var i = 0; i < me.store.viewAttrs.getCount (); i ++) {
			var o = this.store.viewAttrs.getAt (i);
			me.viewAttrsMap [o.get ("id")] = o;
			if (me.viewsMap [o.get ("view")]) {
				me.viewsMap [o.get ("view")].attrs = me.viewsMap [o.get ("view")].attrs || {};
				me.viewsMap [o.get ("view")].attrs [o.get ("code")] = o;
			};
		};
	},
	/*
		Возвращает объект класса по коду или id
	*/
	getClass: function (options) {
		if (!options) {
			return options;
		};
		if (typeof (options) == "number") {
			if (this.classesMap [options]) {
				return this.classesMap [options];
			} else {
				throw new Error ('getClass - Unknown classId: ' + options);
			};
		};
		if (options && options.id) {
			if (this.classesMap [options.id]) {
				return this.classesMap [options.id];
			} else {
				throw new Error ('getClass - Unknown classId: ' + options.id);
			};
		};
		var code = options.classCode || options.code;
		if (typeof (options) == "string") {
			code = options;
		};
		if (this.classesCode [code]) {
			return this.classesCode [code];
		} else {
			throw new Error ('getClass - Unknown classCode: ' + code);
		};
	},
	/*
		Возвращает объект атрибута класса по id
	*/
	getClassAttr: function (id) {
		if (this.classAttrsMap [id]) {
			return this.classAttrsMap [id];
		} else {
			throw new Error ('getClassAttr - Unknown id: ' + id);
		};
	},
	/*
		Возвращает объект представления по коду или id
	*/
	getView: function (options) {
		if (!options) {
			return options;
		};
		if (typeof (options) == "number") {
			if (this.viewsMap [options]) {
				return this.viewsMap [options];
			} else {
				throw new Error ('getView - Unknown viewId: ' + options);
			};
		};
		if (options && options.id) {
			if (this.viewsMap [options.id]) {
				return this.viewsMap [options.id];
			} else {
				throw new Error ('getView - Unknown viewId: ' + options.id);
			};
		};
		var code = options.viewCode || options.code;
		if (typeof (options) == "string") {
			code = options;
		};
		if (this.viewsCode [code]) {
			return this.viewsCode [code];
		} else {
			throw new Error ('getView - Unknown viewCode: ' + code);
		};
	},
	/*
		Возвращает объект атрибута представления по id
	*/
	getViewAttr: function (id) {
		if (this.viewAttrsMap [id]) {
			return this.viewAttrsMap [id];
		} else {
			throw new Error ('getViewAttr - Unknown id: ' + id);
		};
	},
	getAction: function (id) {
		if (!id) {
			return null;
		};
		if (typeof (id) == "string" && id.indexOf (".") > -1) {
			for (var i in this.actionsMap) {
				if (this.actionsMap [i].getFullCode () == id) {
					return this.actionsMap [i];
				};
			};
		};
		if (this.actionsMap [id]) {
			return this.actionsMap [id];
		};
		var storage = this;
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + $sessionId,
			params: storage.code + ".Action.get(" + (typeof (id) == "string" ? ('"' + id + '"') : id) + ")"
		});
		r = eval ("(" + r.responseText + ")");
		if (!r.data.length) {
			return null;
		};
		var o = Ext.create ("$o.Action.Model");
		for (var i = 0; i < r.data.length; i ++) {
			o.set (o.fieldsArray [i], r.data [i]);
		};
		this.actionsMap [o.get ("id")] = o;
		return o;
	},
	/*
		Получение объекта
	*/
	getObject: function (id) {
		if (!id) {
			return null;
		};
		if (this.objectsMap [id]) {
			return this.objectsMap [id];
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.getObject(" + id + ")"
		});
		var d = eval ("(" + r.responseText + ")");
		if (d.data.id) {
			var o = Ext.create ("$o.Class." + d.data.classId + ".Model", Ext.apply (d.data.attrs, {
				id: id,
				classId: d.data.classId
			}));
			o.originalData = $o.util.clone (d.data.attrs);
			this.objectsMap [id] = o;
			return o;
		} else {
			return null;
		};
	},
	/*
		Начать транзакцию
	*/
	startTransaction: function (options) {
		var description = options ? options.description : "";
		var tr = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.startTransaction(\"" + description + "\")"
		});
		tr = eval ("(" + tr.responseText + ")").data;
		$o.inTransaction = true;
		return tr;
	},
	/*
		Подтвердить транзакцию
	*/
	commitTransaction: function (tr) {
		Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.commitTransaction(" + (tr || 1) + ")"
		});
		$o.inTransaction = false;
	},	
	/*
		Откатить транзакцию
	*/
	rollbackTransaction: function (tr) {
		Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + this.sessionId,
			params: this.code + ".Storage.rollbackTransaction(" + (tr || 1) + ")"
		});
		$o.inTransaction = false;
	},
	/*
		SQL запрос в хранилище (только select)
		или вызов плагина
	*/
	execute: function (options) {
		options = options || {};
		if (options.fn) {
			Ext.Ajax.request ({
				url: "plugins/?sessionId=" + this.sessionId,
				params: JSON.stringify (options),
				success: function (response, opts) {
					var o = eval ("(" + response.responseText + ")");
					if (options.success) {
						options.success (o);
					};
				},
				failure: function (response, opts) {
					this.checkException (response.responseText);
				}				
			});
		} else {
			var asArray = options.asArray;
			delete options.asArray;
			var sql = options.sql || options.query || options;
			var r = Ext.Ajax.request ({
				async: false,
				url: "?sessionId=" + this.sessionId,
				params: this.code + ".Storage.execute([!" + JSON.stringify (sql) + "!])",
				paramsEncode: false
			});
			if (!options.noException) {
				this.checkException (r);
			};
			var o = eval ("(" + r.responseText + ")");
			if (o.header && o.header.error) {
				return o.header;
			};
			if (asArray) {
				var r = [];
				_.each (o.data, function (arr, i) {
					var row = {};					
					for (var j = 0; j < sql.select.length / 2; j ++) {
						row [sql.select [j * 2 + 1]] = o.data [i][j];
					};
					r.push (row);
				});
				return r;
			} else {
				// Поля в результате запроса по номерам
				o.data.fields = {};
				for (var j = 0; j < sql.select.length / 2; j ++) {
					o.data.fields [sql.select [j * 2 + 1]] = j;
					o.data.fields [j] = j;
				};
				// Функция доступа к результатам запроса
				// row, col - result [row] [col]
				// col - может быть числом или названием атрибута
				o.data.get = function (row, col) {
					var colN = this.fields [col];
					if (colN == null) {
						throw new Error ("result.get: col unknown (row:" + row + ",col:" + col + ")");
					};
					var val = this [row] [colN];
					if (val == undefined) {
						val = null;
					};
					return val;
				};
				return o.data;
			};
		};
	},
	/*
		Сопоставляет атрибуты представления с атрибутами классов
	*/
	updateViewAttrsType: function (options) {
		var view = options.view;
		var query = view.get ("query");
		var va = view.attrs;
		if (!query) {
			return;
		};
		query = eval ("(" + query + ")");
		var attrs = {};
		for (var i = 0; i < query.select.length; i ++) {
			var qs = query.select [i];
			if (typeof (qs) == "object") {
				var alias;
				for (alias in qs) {
					break;
				};
				attrs [query.select [i + 1]] = {
					alias: alias,
					attr: qs [alias]
				};
			};
		};
		var aliasClass = {};
		for (var i = 0; i < query.from.length; i ++) {
			var qf = query.from [i];
			if (typeof (qf) == "object") {
				var alias;
				for (alias in qf) {
					break;
				};
				if (!i || query.from [i - 1] == "left-join" || query.from [i - 1] == "inner-join") {
					aliasClass [alias] = qf [alias];
				};
			};
		};
		for (var code in attrs) {
			var attr = attrs [code];
			var c = $o.getClass ({code: aliasClass [attr.alias]});
			if (va [code]) {
				va [code].set ("class", c.get ("id"));
				va [code].set ("classAttr", 
					(attr.attr == "id" || !c.attrs [attr.attr]) ? null : c.attrs [attr.attr].get ("id")
				);
			};
		};
	},
	createObject: function (classCode, options) {
		if (this.isReadOnly ()) {
			common.message ("Изменение данных недоступно.");
			throw new Error ("Изменение данных недоступно.");
		};
		var classId = this.getClass (classCode).get ("id");
		var local = options == "local" ? "root" : null;
		this.nextLocalId = this.nextLocalId || -1;
		var o = Ext.create ("$o.Class." + classId + ".Model", {
			id: local ? this.nextLocalId : null,
			classId: classId
		});
		o.local = local;
		o.localChilds = {};
		o.originalData = {
			classId: classId
		};
		if (local) {
			this.objectsMap [this.nextLocalId] = o;
			this.nextLocalId --;
		};
		this.fireEvent ("afterCreateObject", {
			classId: classId, 
			object: o
		});
		return o;
	},
	removeObject: function (id) {
		if (this.isReadOnly ()) {
			common.message ("Изменение данных недоступно.");
			throw new Error ("Изменение данных недоступно.");
		};
		if (id) {
			this.fireEvent ("beforeRemoveObject", {
				objectId: id
			});
			Ext.Ajax.request ({
				async: false,
				url: "?sessionId=" + this.sessionId,
				params: this.code + ".Object.remove(" + id + ")"
			});
			delete this.objectsMap [id];
		};
	},
	createClass: function (options) {
		var me = this;
		var o = Ext.create ("$o.Class.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createClassAttr: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["class", "name", "code", "type", "order", "notNull", "validFunc", "formatFunc", "description", "secure", "maxString", "minString", "maxNumber", "minNumber", "maxDate", "minDate", "unique", "numberFormat", "dateFormat", "removeRule"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".ClassAttr.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.ClassAttr.Model", r.data [0]);
			me.store.classAttrs.add (o);
			me.initClasses ();
			me.initClassAttrs ();
			me.initClassModels ();
		};
		*/
		var o = Ext.create ("$o.ClassAttr.Model");
		for (var attr in options) {
			var a = attr;
			if (a == "typeId") {
				a = "type";
			};
			if (a == "classId") {
				a = "class";
			};
			o.set (a, options [attr]);
		};
		return o;
	},
	createView: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["parent", "name", "code", "description", "layout", "key", "parentKey", "class", "unrelated", "query", "type", "system", "materialized", "order", "schema", "record", "iconCls"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".View.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.View.Model", r.data [0]);
			me.store.views.add (o);
			me.initViews ();
			me.initViewAttrs ();
		};
		*/
		var o = Ext.create ("$o.View.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createViewAttr: function (options) {
		var me = this;
		/*
		// send to server
		var fields = ["view", "name", "code", "class", "classAttr", "subject", "order", "sort", "sortOrder", "operation", "value", "area", "width", "totalType", "readOnly", "group", "notNull"];
		var values = [];
		for (var i = 0; i < fields.length; i ++) {
			values.push (Ext.encode (options [fields [i]] || null));
		};
		var r = Ext.Ajax.request ({
			async: false,
			url: "?sessionId=" + me.sessionId,
			params: me.code + ".ViewAttr.create(" + values.join (",") + ")"
		});
		// create client objects
		r = eval ("(" + r.responseText + ")");
		if (r.data) {
			var o = Ext.create ("$o.ViewAttr.Model", r.data [0]);
			me.store.viewAttrs.add (o);
			me.initViews ();
			me.initViewAttrs ();
		};
		*/
		var o = Ext.create ("$o.ViewAttr.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	createAction: function (options) {
		var me = this;
		var o = Ext.create ("$o.Action.Model");
		for (var attr in options) {
			o.set (attr, options [attr]);
		};
		return o;
	},
	/*
		Представление по умолчанию
	*/
	updateDefaultView: function () {
		var me = this;
		var v;
		if (me.get ("view")) {
			try {
				v = $o.getView (me.get ("view"));
			} catch (e) {
			};
		};
		if (!v) {
			v = $o.createView ();
			v.set ("class", me.get ("id"));
			v.set ("system", 1);
			v.set ("name", me.get ("name"));
			v.set ("code", "classView." + me.getFullCode ());
			v.sync ();
			me.set ("view", v.get ("id"));
			me.sync ();
		};
		// class attrs -> view attrs
		var npp = 1;
		for (var attr in v.attrs) {
			if (v.attrs [attr].order && v.attrs [attr].order >= npp) {
				npp = v.attrs [attr].order + 1;
			};
		};
		var attrs = ["id"], query = {
			select: [
				{"a": "id"}, "id"
			], 
			from: [
				{"a": me.getFullCode ()}
			],
			order: [
				{"a": "id"}
			]
		};
		if (!v.attrs ["id"]) {
			var va = $o.createViewAttr ({
	    		name: "id",
	    		code: "id",
	    		view: v.get ("id"),
	    		area: 1,
	    		width: 50,
	    		"class": me.get ("id"),
	    		order: npp ++,
	    		classAttr: null
			});
			va.sync ();
		};
		var aliasIdx = 0, aliasStr = "bcdefghijklmnopqrstuvwxyz";
		for (var attr in me.attrs) {
			var ca = me.attrs [attr];
			attrs.push (attr);
			if (!v.attrs [attr]) {
				var va = $o.createViewAttr ({
		    		name: ca.get ("name"),
		    		code: attr,
		    		view: v.get ("id"),
		    		area: 1,
		    		width: 75,
		    		"class": me.get ("id"),
		    		order: npp ++,
		    		classAttr: ca.get ("id")
				});
				va.sync ();
			};
			/*
			if (ca.get ("type") >= 1000) {
				var cls = $o.getClass (ca.get ("type"));
				var alias = aliasStr [aliasIdx];
				aliasIdx ++;
				var o = {};
				o [alias] = cls.attrs ["name"] ? "name" : "id";
				query.select.push (o);
				query.select.push (attr);
				var oc = {};
				oc [alias] = cls.getFullCode ();
				var oca = {};
				oca [alias] = "id";
				query.from = query.from.concat ("left-join", oc, "on");
				query.from.push ([{"a": attr}, "=", oca]);
			} else {
				*/
				query.select.push ({"a": attr});
				query.select.push (attr);
			//};
		};
		var layout = {
			olap: {
				id: "cmp-1",
				classView: me.getFullCode ()
			}
		};
		query = JSON.stringify (query, null, "\t");
		layout = JSON.stringify (layout, null, "\t");
		if (v.get ("query") != query || v.get ("layout") != layout) {
			v.set ("query", query);
			v.set ("layout", layout);
			v.sync ();
		};
		// remove view attrs
		for (var attr in v.attrs) {
			if (attrs.indexOf (attr) == -1) {
				var va = v.attrs [attr];
				va.remove ();
				va.sync ();
			};
		};
	},
	/*
		Обновляет действия: Создать, Удалить, Карточка
	*/
	updateDefaultActions: function () {
		var me = this;
		var r = common.execSQL ({
		    "select": [
		        {"a":"___fid"}, "id",
		        {"a":"___fcode"}, "code"
		    ],
		    "from": [
		        {"a":"system.action"}
		    ],
		    "where": [
		        {"a": "___fend_id"}, "=", 2147483647, "and", {"a": "___fclass_id"}, "=", me.get ("id")
		    ],
		    "order": [
		        {"a":"___fid"}
		    ]
		});
		var actions = {};
		for (var i = 0; i < r.length; i ++) {
			actions [r.get (i, "code")] = r.get (i, "id");
		};
	    // card
	    var aCard;
    	var cardBody =
    		'var me = this;\n' +
    		'var id = options.id || me.getValue ("id");\n' +
    		'common.tpl.show.call (this, {\n' +
    		'\tid: id,\n' +
    		'\tasWindow: 1,\n' +
			'\treadOnly: options.readOnly,\n' +
    		'\tlayout: common.tpl.updateTags (\n' +
    		'\t\t' + me.getFullCode () + '.card.layout, {\n' +
    		'\t\t\tid: id\n' +
    		'\t\t}\n' +
    		'\t)\n' +
    		'});\n'
    	;
    	if (!actions.card) {
	    	var aCard = $o.createAction ();
	    	aCard.set ("class", me.get ("id"));
	    	aCard.set ("name", "Открыть");
	    	aCard.set ("code", "card");
	    	aCard.set ("layout", JSON.stringify ({
	    		"type": "card",
	    		"layout": {
					"card": {
						"id": "card",
						"items": [],
						"object": [
							{
								"cls": me.getFullCode (),
								"tag": "[#id]"
							}
						]
					}
				}
			}, null, "\t"));
	    	aCard.set ("body", cardBody);
	    	aCard.sync ();
	    	aCard.initAction ();
	    };
		// create
    	var aCreate;
    	var createBody =
    		'common.tpl.create.call (this, {\n' +
    		'\tasWindow: 1,\n' +
    		'\tclassCode: "' + me.getFullCode () + '",\n' +
			'\tfn: function (o, options) {\n' +
    		'\t\toptions.layout = common.tpl.updateTags (\n' +
    		'\t\t\t' + me.getFullCode () + '.card.layout, {\n' +
    		'\t\t\t\tid: o.get ("id")\n' +
    		'\t\t\t}\n' +
    		'\t\t)\n' +
    		'\t}\n' +
    		'});\n'
		;
    	if (!actions.create) {
    	 	aCreate = $o.createAction ();
	    	aCreate.set ("class", me.get ("id"));
	    	aCreate.set ("name", "Добавить");
	    	aCreate.set ("code", "create");
		    aCreate.set ("layout", '{"type": "create"}');
	    	aCreate.set ("body", createBody);
	    	aCreate.sync ();
	    	aCreate.initAction ();
    	};
    	// remove
    	var aRemove;
    	var removeBody =
    		'common.tpl.remove.call (this);\n'
    	;
    	if (!actions.remove) {
	    	aRemove = $o.createAction ();
	    	aRemove.set ("class", me.get ("id"));
	    	aRemove.set ("name", "Удалить");
	    	aRemove.set ("code", "remove");
	    	aRemove.set ("layout", '{"type": "remove"}');
	    	aRemove.set ("body", removeBody);
	    	aRemove.sync ();
	    	aRemove.initAction ();
	    };
	},
	getConfObject: function (conf, id) {
		var o;
		switch (conf) {
		case "class":
			o = $o.getClass (id);
			break;
		case "classAttr":
			o = $o.getClassAttr (id);
			break;
		case "view":
			o = $o.getView (id);
			break;
		case "viewAttr":
			o = $o.getViewAttr (id);
			break;
		case "action":
			o = $o.getAction (id);
			break;
		};
		return o;
	},
	getRevisions: function () {
		var r = Ext.Ajax.request ({
			async: false,
			url: "get_revisions?sessionId=" + $sessionId,
			params: "getRevisions ()"
		});
		r = eval ("(" + r.responseText + ")");
		return r;
	},
	setRevision: function (revisionId) {
		revisionId = revisionId || "";
		var r = Ext.Ajax.request ({
			async: false,
			url: "set_revision?sessionId=" + $sessionId + "&id=" + revisionId,
			params: "setRevision (" + revisionId + ")"
		});
		r = eval ("(" + r.responseText + ")");
		this.objectsMap = {};
		this.revision = revisionId;
		this.app.tp.removeAll ();
		this.app.tp.doLayout ();
		return r;
	},
	copyFile: function (opts) {
		var r = Ext.Ajax.request ({
			async: false,
			url: 
				"copy_file?sessionId=" + $sessionId + 
				"&src_object_id=" + opts.src.objectId + "&src_class_attr_id=" + opts.src.classAttrId +
				"&dst_object_id=" + opts.dst.objectId + "&dst_class_attr_id=" + opts.dst.classAttrId +
				"&filename=" + opts.filename
		});
	},
	saveToFile: function (opts) {
		var r = Ext.Ajax.request ({
			async: false,
			params: opts.data,
			url: 
				"save_to_file?sessionId=" + $sessionId + 
				"&object_id=" + opts.objectId + "&class_attr_id=" + opts.classAttrId +
				"&filename=" + opts.filename
		});
	},
	isReadOnly: function () {
		if ($o.userId) {
			var o = $o.getObject ($o.userId);
			return o.get ("readOnly");
		} else {
			return false;
		};
	}
});
