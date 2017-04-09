/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

$zs = $o;
$s = $o;
$zp = {
	application: $o.app
};
Ext.Component.AUTO_ID = 1000000;
objectum = {
	ui: {}
};
$o.initAdapter = function () {
	$zp.application.toolbar = $o.app.tb;
	$zp.application.mainPanel = $o.app.tp;
	$zs.views = $o.viewsTree;
	$zs.views.get = function (code) {
		let r = $o.getView ({code: code});
		return r;
	};
	objectum.ui.layout = {};
	objectum.ui.layout.ViewLayout = $o.Layout.Widget;
	$zs.classes = $o.classesTree;
	$zs.viewAttrs = $o.viewAttrsMap;
	$zp.currentUser = $o.currentUser;
	$zp.application.onClickMenuItem = function (item) {
		let record = $o.viewsMap [item.record.stub.get ("id")];
		$o.app.show ({record: record});
	};
	$VERSION_MAJOR = $o.serverVersion;
	$o.app.on ("ready", function () {
		if ($zp.onLogin) {
			$zp.onLogin ();
		};
	});
	$zs.id = $o.code;
	objectum.ui.ObjectField = $o.ObjectField.Widget;
	$zr = $o.locale;
};
Ext.override (Ext.Component, {
	initComponent: function () {
		let me = this;
		if (me.code) {
			me.iconCls = me.iconCls ? me.iconCls : me.code;
			me.text = me.text ? $o.locale.getString (me.text) : $o.locale.getString (me.code);
		};
		if (typeof (me.handler) == "string") {
			me.handler = eval (me.handler);
		};
		if (me.listeners) {
			for (let event in me.listeners) {
				let ef = me.listeners [event];
				if (typeof (ef) == "string") {
					try {
						me.listeners [event] = eval (ef);
					} catch (e) {
						me.listeners [event] = function () {
							console.log ("unknown function: " + ef);
						};
					};
				} else
				if (ef && ef.fn && typeof (ef.fn) == "string") {
					try {
						me.listeners [event].fn = eval (ef.fn);
					} catch (e) {
						me.listeners [event].fn = function () {
							console.log ("unknown function: " + ef.fn);
						};
					};
				};
			};
		};
		me.callOverridden ();
	}
});
Ext.override (Ext.Panel, {
	initComponent: function () {
		if (this.code) {
			this.iconCls = this.iconCls ? this.iconCls : this.code;
			this.title = this.title ? $o.locale.getString (this.title) : $o.locale.getString (this.code);
		};
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Date, {
	initComponent: function () {
		this.format = "d.m.Y";
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Time, {
	initComponent: function () {
		this.format = "H:i:s";
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Checkbox, {
	initComponent: function () {
		this.addEvents ("check");
		this.on ("change", function (cb, nv, ov) {
			this.fireEvent ("check", cb, nv, ov);
		}, this);
		this.callOverridden ();
	}
});
Ext.override (Ext.toolbar.Toolbar, {
	initComponent: function () {
		if (!this.hasOwnProperty ("border")) {
			this.border = false;
		};
		this.callOverridden ();
	}
});
Ext.override (Ext.form.field.Base, {
	initComponent: function () {
		if (this.readOnly && !this.objectField && Ext.getClassName (this) != "Ext.form.field.File" && this.xtype != "displayfield") {
			this.addCls ("readonly-field");
		};
		if (this.hasOwnProperty ("allowBlank") && !this.allowBlank && this.fieldLabel) {
			this.fieldLabel = this.fieldLabel + "<span style='color: red !important'>*</span>";
		};
		this.callOverridden ();
	},
	setReadOnly: function (ro) {
		if (!this.objectField && Ext.getClassName (this) != "Ext.form.field.File" && this.xtype != "displayfield") {
			if (this.readOnly) {
				this.addCls ("readonly-field");
			} else {
				this.removeCls ("readonly-field");
			};
		};
		this.callOverridden ();
	}
});
Ext.define ("Ext.fix.util.AbstractMixedCollection", {
    override: "Ext.util.AbstractMixedCollection",
    itemAt: function (n) {
    	return this.getAt (n);
    }
});
Date.prototype.toStringOriginal = Date.prototype.toString;
Date.prototype.toString = function (format) {
	let dd = this.getDate ();
	let mm = this.getMonth () + 1;
	let yyyy = this.getFullYear ();
	let h = this.getHours ();
	let m = this.getMinutes ();
	let s = this.getSeconds ();
	if (dd < 10) {
		dd = "0" + dd;
	};
	if (mm < 10) {
		mm = "0" + mm;
	};
	let v = dd + "." + mm + "." + yyyy;
	if (h || m || s) {
		if (h < 10) {
			h = "0" + h;
		};
		if (m < 10) {
			m = "0" + m;
		};
		if (s < 10) {
			s = "0" + s;
		};
		v += " " + h + ":" + m + ":" + s;
	};
	return v;
};
Date.prototype.toUTCString = function () {
	let o = this;
    let pad = function (n) {
        return n < 10 ? "0" + n : n;
    };
    if (o.getHours () == 0 && o.getMinutes () == 0 && o.getSeconds () == 0) {
		return '"' + pad (o.getDate ()) + "." +
			pad (o.getMonth () + 1) + "." +
			pad (o.getFullYear ()) + '"';
    }
    return '"' + pad (o.getUTCDate ()) + "." +
        pad (o.getUTCMonth () + 1) + "." +
        pad (o.getUTCFullYear ()) + " " +
        pad (o.getUTCHours ()) + ":" +
        pad (o.getUTCMinutes ()) + ":" +
        pad (o.getUTCSeconds ()) + '"';
};
$zu.getThemeBGColor = function () {
	return window.$themeBGColor || "#ffffff";
};
/*
	Локализация
*/
Ext.define ("$o.locale", {
	singleton: true,
	strings: {},
	load: function (url) {
		let r = Ext.Ajax.request ({
			url: url,
			async: false
		});
		try {
			_.each (JSON.parse (r.responseText), function (v, id) {
				$o.locale.strings [id.toLowerCase ()] = v;
			});
		} catch (e) {
			let r = Ext.Ajax.request ({
				url: url,
				async: false
			}).responseXML;
			let nodes = Ext.DomQuery.select ("string", r.documentElement);
			for (let i = 0; i < nodes.length; i ++) {
				let id = nodes [i].attributes [0].value;
				let text = nodes [i].textContent || nodes [i].text;
				$o.locale.strings [id] = text;
			};
		};
	},
	getString: function () {
		let r = _.map (_.toArray (arguments), function (s) {
			if (!s) {
				return s;
			};
			let n = _.has ($o.locale.strings, s.toLowerCase ()) ? $o.locale.strings [s.toLowerCase ()] : s;
			if (s && n) {
				if (s [0].toUpperCase () == s [0] || ["create", "remove", "delete", "open", "choose", "cancel"].indexOf (s) > -1) {
					n = n [0].toUpperCase () + n.substr (1);
				} else {
					n = n [0].toLowerCase () + n.substr (1);
				};
			};
			return n;
		});
		return r.join (" ");
	},
	// deprecated
	translate: function (s) {
		if (s.indexOf ("connection limit exceeded") > -1) {
			s = "Извините. Сервер в данный момент перегружен. Пожалуйста, повторите запрос позднее.";
		};
		if (s.indexOf ("value exists") > -1) {
			let tokens = s.split (":");
			s = "Значение '" + tokens [1].trim () + "' используется. Пожалуйста введите другое.";
		};
		return s;
	}
});
//
//  Диалог получения мнемокода
//
$zu.dialog = {};
$zu.dialog.getNameAndCode = function (options) {
	let title = options.title;
	let success = options.success;
	let scope = options.scope || this;
	let okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue (), fieldCode.getValue ());
			win.close ();
		}
	});
	let cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			win.close ();
		}
	});
	let fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Name"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	let fieldCode = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Code"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		maskRe: /[A-Za-z0-9\_]/,
		listeners: {
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	let form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyPadding: 5,
		layout: 'form',
		items: [
			fieldName,
			fieldCode
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    let win = new Ext.Window ({
		width: 400,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus (false, 200);		
	});
}
//
//  Диалог получения мнемокода и типа
//
$zu.dialog.getNameAndCodeAndType = function (options) {
	let title = options.title;
	let success = options.success;
	let scope = options.scope || this;
	let okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
			win.close ();
		}
	});
	let cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			win.close ();
		}
	});
	let fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Name"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	let fieldCode = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: $zr.getString ("Code"),
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		maskRe: /[A-Za-z0-9\_]/,
		listeners: {
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue (), fieldCode.getValue (), fieldType.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	let fieldType = new Ext.create ("$o.ConfField.Widget", {
		conf: "classAttr", 
		confRef: "class", 
		choose: {
			type: "view", id: "system.classes", attr: "olap.id", width: 500, height: 400
		},
		fieldLabel: $o.getString ("Type"),
		value: 1,
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			change: function (value) {
				if (value >= 1000) {
					let cls = $o.getClass (value);
					fieldName.setValue (cls.get ("name"));
					fieldCode.setValue (cls.get ("code"));
				};
			}
		}
	});
	let form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyPadding: 5,
		layout: 'form',
		items: [
			fieldType,
			fieldName,
			fieldCode
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    let win = new Ext.Window ({
		width: 400,
		height: 200,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus (false, 200);		
	});
}
/*
	Underscore -> Lodash
 */
_.findWhere = _.findLast;
_.where = _.filter;
