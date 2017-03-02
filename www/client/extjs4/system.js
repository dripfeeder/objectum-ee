Ext.namespace (
	'system.object',
	'system.object_attr',
	'system.class_',
	'system.class_attr',
	'system.view',
	'system.view_attr',
	'system.revision',
	'system.LoginPassword',
	'spr.conf',
	'system.access',
	'$layout.card',
	'ose.role',
	'ose.srole',
	'ose.ext',
	'ose.object',
	'system.vo.menu',
	'system.vo.menuItems',
	'subject.human'
);
// Инициализация
system.init = function () {
	$zp.onLogin = function () {
		if ($VERSION_MAJOR == '3') {
			system.getObjNews ();
		}
	}
	$zp.onLogout = function () {
		common.window.closeAll ();
	}
	$zp.application.on ('ready', function () {
		// hash navigation
		function getHash () {
			var dlh = document.location.href;
			var h = dlh.split ('#');
			if (h.length == 2) {
				h = h [1];
				return h;
			} else {
				return '';
			};
		};
		$zp.hash = getHash ();
		if ($zp.hash) {
			if (!activatePage ($zp.hash)) {
				addPage ($zp.hash);
			};
		};
		function activatePage (h) {
			var items = $zp.application.mainPanel.items;
			for (var i = 0; i < items.getCount (); i ++) {
				var item = items.getAt (i);
				if (item.id == h) {
					$zp.application.mainPanel.setActiveTab (item.id);
					return true;
				};
			};
			return false;
		};
		function addPage (h) {
			if (h [0] == 'v') {
				var record = $zs.viewsMap [h.substr (1)];
				if (record) {
					try {
				    	$zp.application.onClickMenuItem.call ($zp.application, {
				    		record: record,
				    		text: record.stub.get ('name')
				    	});
				    } catch (e) {
						$o.app.show.call ($o.app, {record: record});
				    };
			    };
			} else
			if (h [0] == 'o') {
				var id = h.substr (1);
				var o = $zs.getObject (id);
				if (o) {
					system.object.show ({id: id});
				};
			};
		};
		function onHashChange () {
			var h = getHash ();
			if (h != $zp.hash) {
				if (!activatePage (h)) {
					addPage (h);
				};
				$zp.hash = h;
			};
			setTimeout (onHashChange, 200);
		};
		if ('onhashchange' in window) {
			window.onhashchange = onHashChange;
		} else {
			setTimeout (onHashChange, 200);
		};
		if (common.getConf ("maxIdleSec").used) {
			$o.maxIdleSec = common.getConf ("maxIdleSec").value;
		};
	});
	$zp.application.on ('viewlayout', common.window.onViewLayout);
};
// Отображение истории изменения атрибута
// options: {(id), (olap, attr), (objectId, classAttrId)}
system.object_attr.history = function (options) {
	options = options || {};
	var id;
	if (options.id) {
		id = options.id;
	} else 
	if (options.objectId) {
		var r = common.execSQL ({
			select: [
				{"a":"___fid"}, "id"
			],
			from: [
				{"a":"system.object_attr"}
			],
			where: [
				{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
				{"a":"___fobject_id"}, "=", options.objectId, "and",
				{"a":"___fclass_attr_id"}, "=", options.classAttrId
			]
		});
		if (r.length == 0) {
			return;
		}
		id = r.get (0, "id");
	} else {
		options.olap = options.olap || "olap";
		options.attr = options.attr || "id";
		id = this.relatives [options.olap].getCurrentValue (options.attr);
	}
	common.window.show.call (this, {
		id: id,
		asWindow: true,
		modal: true,
		title: $zr.getString ("History of changes"),
		iconCls: "event-log",
		cardFn: function (options) {
			var result = {
				olap: {
					id: "olap",
					view: "ser.system.objectAttrHistory",
					filter: ["fid", "=", options.id]
				}
			};
			return result;
		}
	});
}
system.revision.maxRevision = 2147483647;
// Зарегистрировать класс (для system.object.show)
// options: {classId, showFunc}
system.object.classes = {};
system.object.registerClass = function (options) {
	system.object.classes [options.classId] = {};
	system.object.classes [options.classId].showFunc = options.showFunc;
}
// Показать карточку объекта
// options: {id}
system.object.show = function (options) {
	var id = options.id;
	if (!id && options.olap && options.attr) {
		id = this.zview.getCurrentValue (options.olap, options.attr);
	}
	var o = $zs.getObject (id);
	var classObj = $o.getClass (o.get ("classId"));
	var classId = classObj.get ("id");
	if (system.object.classes [classId]) {
		system.object.classes [classId].showFunc.call (this, {id: id});
	} else {
		// Сформировать и показать карточку объекта
		common.window.show ({
			id: id,
			asWindow: true,
			modal: true,
			title: $zr.getString ("Object") + " ID: " + o.getId (),
			width: 800,
			height: 600,
			cardFn: function (options) {
				var o = $zs.getObject (options.id);
				var card = {
					card: {
						id: "objectCard",
						readOnly: true,
						fields: []
					}
				};
				for (var key in o.data) {
					if (key == "classId" || key == "id") {
						continue;
					}
					card.card.fields.push ({objectId: options.id, attr: key});
				}
				return card;
			}
		});
	}
}
system.view.chooseAll = function (options) {
	this.relatives [options.olap].selModel.selectAll ();
}
/*
	Выбор запроса
*/
system.view.selectQuery = function (options) {
	var me = this;
	var success = options.success;
	function getTreeRecord (view) {
		var rec = {
			text: view.toString ()
		};
		if (view.childs) {
			rec.expanded = 0;
			rec.children = [];
			for (var i = 0; i < view.childs.length; i ++) {
				rec.children.push (getTreeRecord ($o.viewsMap [view.childs [i]]));
			};
		} else {
			rec.leaf = 1;
		}
		return rec;
	};
	var root = [];
	for (var id in $o.viewsMap) {
		var v = $o.viewsMap [id];
		if (!v.get ("parent") && !v.get ("system")) {
			root.push (getTreeRecord ($o.viewsMap [id]));
		};
	};
	var treeStore = Ext.create ('Ext.data.TreeStore', {
	    root: {
	        expanded: true,
	        children: root
	    },
		sorters: [{
			property: "text",
			direction: "ASC"
		}]	        
	});
	var viewId;
	var win = Ext.create ("Ext.Window", {
		width: 800,
		height: 600,
		layout: "border",
		frame: false,
		border: false,
		style: "background-color: #ffffff",
		bodyStyle: "background-color: #ffffff",
		title: $o.getString ("Select", "query"),
		iconCls: "gi_cogwheel",
		bodyPadding: 5,
		modal: 1,
		tbar: [{
			text: $o.getString ("Choose"),
			iconCls: "gi_ok",
			name: "ok",
			disabled: 1,
			handler: function () {
				success ({value: viewId});
				win.close ();
			}
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				win.close ();
			}
		}],
		items: [{
		    split: true,
		    region: "west",
			width: 400,
			layout: "fit",
			items: {
	    		xtype: "treepanel",
	    		title: $o.getString ("Views"),
	    		iconCls: "gi_eye_open",
			    store: treeStore,
			    rootVisible: false,
		    	border: 0,
		    	listeners: {
		    		select: function (srm, record, index, eOpts) {
		    			var hasQuery = 0;
		    			if (record) {
							var id = record.get ("text").split (":")[1].split (")")[0];
							var v = $o.getView (Number (id));
	    					win.down ("*[name=query]").setValue (v.get ("query") ? v.get ("query") : "");
	    					if (v.get ("query")) {
	    						hasQuery = 1;
	    					};
	    					viewId = v.get ("id");
		    			}
		    			if (hasQuery) {
		    				win.down ("*[name=ok]").enable ();
		    			} else {
		    				win.down ("*[name=ok]").disable ();
		    			};
		    		}
		    	}
		    }
		},{
		    region: "center",
			layout: "fit",
		    items: {
		    	title: $o.getString ("Query"),
		    	name: "query",
				iconCls: "gi_cogwheel",
				xtype: "codemirrortextarea",
				mode: "application/ld+json",
		    	border: 0
		    }
		}]
	});
	win.show ();
};
// Открывает представление в закладке
// {id}
system.view.showPanel = function (options) {
	var app = $zp.application;
	var record = $zs.views.get (options.id, {async: false});
	var pageId = 'View-' + record.stub.get ("id");
	var view = new objectum.ui.layout.ViewLayout ({
		border: false,
		record: record,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
	});
	var layoutName = 'zviewlayout'; 
	if (!(pageId in app.openPages)) {
		var iconCls = record.iconCls;
		if (!iconCls && record.stub && record.stub.get ("iconCls")) {
			iconCls = record.stub.get ("iconCls");
		}
		app.openPages [pageId] = app.mainPanel.add ({
			id: pageId,
			xtype: "panel",
			layout: 'fit',
			node: 1,
			iconCls: iconCls,
			tabTip: null,
			title: record.stub.get ("name"),
			closable: true,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';',
			items: [
				view
			]
		});
		app.mainPanel.doLayout ();
	};
	app.mainPanel.activate (app.openPages [pageId]);
}
system.class_.create = function (options) {
	var name = options.name;
	var code = options.code;
	var parent = options.parent;
	if (common.extMajorVersion () == 3) {
		var nodes = $zs.classesMap;
		for (var key in nodes) {
			if (parent == nodes [key].stub.get ("parent") && code == nodes [key].stub.get ("code")) {
				throw 'class with code "' + code + '" already exists';
			};
		};
		var stub = new objectum.server.Class ({
			code: code,
			name: name
		});
		if (parent) {
			stub.set ('parent', parent);
		};
		stub.commit ();
		var fields = [];
		var node = objectum.server.Object.create (fields);
		node.stub = stub;
		node.storage = $zs;
		node.storage.registerClass (node);
	} else {
		var c = $o.createClass ({
			name: name,
			code: code,
			parent: parent ? parent : null
		});
		c.sync ();
	};
};
// Создание атрибута класса
// options: {attr1: {classCode, name, typeCode}}
system.class_attr.create = function (options) {
	function createAttr (options) {
		if (common.extMajorVersion () == 3) {
			var a = new objectum.server.ClassAttr ({
				name: options.name,
				code: options.code,
				"class": options.classId,
				type: options.typeId
			});		
			a.commit ();
			a.storage = $zs;
			$zs.classAttrs [a.get ('id')] = a;
			var cls = $zs.classAttrsMap [a.get ('class')] || [];
			cls.push (a);
			$zs.classAttrsMap [a.get ('class')] = cls;
		} else {
			var ca = $o.createClassAttr ({
				name: options.name,
				code: options.code,
				"class": options.classId,
				type: options.typeId
			});
			ca.sync ();
		};
	};
	if (options.hasOwnProperty ("name")) {
		// single attr
		createAttr ({
			name: options.name,
			code: options.code,
			classId: options.classId,
			typeId: options.typeId
		});
	} else {
		// many attrs
		for (var attr in options) {
			createAttr ({
				name: options [attr].name,
				code: attr,
				classId: $zs.getClass (options [attr].classCode).stub.get ("id"),
				typeId: $zs.getClass (options [attr].typeCode).stub.get ("id")
			});
		};
	};
};
// Получение атрибутов класса
// options: {classCode or classId}}
system.class_attr.get = function (options) {
	var classId = options.classId || $zs.getClass (options.classCode).stub.get ("id");
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id",
			{"a":"___fcode"}, "code",
			{"a":"___fname"}, "name",
			{"a":"___ftype_id"}, "type_id"
		],
		from: [
			{"a":"system.class_attr"}
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"a":"___fclass_id"}, "=", classId
		]
	});
	return r;
};
system.view.create = function (options) {
	var name = options.name;
	var code = options.code;
	var parent = options.parent;
	if (common.extMajorVersion () == 3) {
		var nodes = $zs.viewsMap;
		for (var key in nodes) {
			if (parent == nodes [key].stub.get ("parent") && code == nodes [key].stub.get ("code")) {
				throw 'view with code "' + code + '" already exists';
			};
		};
		var stub = new objectum.server.View ({
			code: code,
			name: name
		});
		stub.set ('materialized', 0);
		if (parent) {
			stub.set ('parent', parent);
		};
		stub.commit ();
		var fields = [];
		var node = objectum.server.View.create (fields);
		node.stub = stub;
		node.storage = $zs;
		node.storage.registerView (node);
	} else {
		var v = $o.createView ({
			name: name,
			code: code,
			materialized: 0,
			parent: parent ? parent : null
		});
		v.sync ();
	};
};
// Создание атрибута представления
// options: {attr1: {viewCode, name, area, width}}
system.view_attr.create = function (options) {
	function createAttr (options) {
		if (common.extMajorVersion () == 3) {
	    	var a = new objectum.server.ViewAttr ({
	    		name: options.name,
	    		code: options.code,
	    		view: options.viewId,
	    		order: options.order,
	    		area: options.area ? options.area : 0,
	    		width: options.width ? options.width : 75
	    	});    	
	    	a.commit ();
			a.storage = $zs;
			$zs.viewAttrs [a.get ('id')] = a;
			var view = $zs.viewAttrsMap [options.viewId] || [];
			view.push (a);
			$zs.viewAttrsMap [options.viewId] = view;
		} else {
			var va = $o.createViewAttr ({
	    		name: options.name,
	    		code: options.code,
	    		view: options.viewId,
	    		order: options.order,
	    		area: options.area ? options.area : 0,
	    		width: options.width ? options.width : 75
			});
			va.sync ();
		};
    };
    if (options.hasOwnProperty ("name")) {
		// single attr
		createAttr ({
			name: options.name,
			code: options.code,
			viewId: options.viewId,
			area: options.area,
			width: options.width
		});
    } else {
    	// many attrs
		for (var attr in options) {
			createAttr ({
	    		name: options [attr].name,
	    		code: attr,
	    		viewId: $zs.getView (options [attr].viewCode).stub.get ("id"),
	    		area: options [attr].area ? options [attr].area : 0,
	    		width: options [attr].width ? options [attr].width : 75
			});
		};
	};
};
// Получение атрибутов представления
// options: {viewCode or viewId}}
system.view_attr.get = function (options) {
	var viewId = options.viewId || $zs.getView (options.viewCode).stub.get ("id");
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id",
			{"a":"___fcode"}, "code",
			{"a":"___fname"}, "name",
			{"a":"___farea"}, "area"
		],
		from: [
			{"a":"system.view_attr"}
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"a":"___fview_id"}, "=", viewId
		]
	});
	return r;
}
// Создает
spr.conf.create = function (options) {
	var parent = this.getCurrentValue ('id') || null;
    var id = obj.create.call (this, {
    	classCode: "spr.conf",
    	attrs: {
    		parent: parent
    	},
    	refresh: !options.silence
    });
    if (options.silence) {
		return id;
	} else {
		options.id = id;
	    spr.conf.show.call (this, options);
	}
}
// Удаляет
spr.conf.remove = function () {
	obj.remove.call (this, {id: this.getCurrentValue ("id"), refresh: true});
}
// Карточка
spr.conf.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "confCard",
			listeners: {
				afterSave: function () {
					if (common.data.hasOwnProperty ("spr.conf")) {
						var o = $zs.getObject (id);
						common.data ["spr.conf"][o.get ("code")] = {
							id: o.get ("id"),
							used: o.get ("used"),
							name: o.get ("name"),
							value: o.get ("value")
						}
					};
				}
			},
			fields: [
				{objectId: id, attr: "npp"},
				{objectId: id, attr: "name"},
				{objectId: id, attr: "code"},
				{objectId: id, attr: "used"},
				{objectId: id, attr: "value"},
				{objectId: id, attr: "description"},
				{objectId: id, attr: "parent", choose: {type: "view", id: "system.conf", attr: "olap.id", width: 600, height: 400}}
			]
		}
	};
	return card;
}
// Отображение карточки
spr.conf.show = function (options) {
	common.window.show.call (this, Ext.apply (options, {
		title: $zr.getString ("Option"),
		cardFn: spr.conf.card,
		iconCls: "gi_settings"
	}));
}
spr.conf.get = function (options) {
	var r = common.execSQL ({
		select: [
			{"a":"value"}, "value"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"code"}, "=", options.code
		]
	});
	if (r.length) {
		return r.get (0, 'value');
	} else {
		return null;
	};
};
common.data = common.data || {};
common.data ["spr.conf"] = {};
common.loadConf = function (subject) {
	common.data ["spr.conf"][subject] = {};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"code"}, "code",
			{"a":"used"}, "used",
			{"a":"name"}, "name",
			{"a":"value"}, "value",
			{"a":"subject"}, "subject"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: subject ? [
			{"a":"subject"}, "=", subject
		] : [
			{"a":"subject"}, "is null"
		]
	});
	for (var i = 0; i < r.length; i ++) {
		common.data ["spr.conf"][subject][r.get (i, "code")] = {
			id: r.get (i, "id"),
			used: r.get (i, "used"),
			name: r.get (i, "name"),
			value: r.get (i, "value")
		}
	}
};
// Получить объект параметра через код
// options: {code}
common.getConf = function (options) {
	var subject = options.subject || null;
	if (!common.data ["spr.conf"][subject]) {
		common.loadConf (subject);
	};
	var code = typeof (options) == "string" ? options : options.code;
	var result = common.data ["spr.conf"][subject][code];
	if (result == null) {
		//console.log ("spr.conf.code:" + code + " not exist");
		result = {};
	};
	return result;
};
common.setConf = function (code, options) {
	if (!code) {
		return;
	};
	var subject = options.subject || null;
	var inTransaction = $o.inTransaction;
	var tr;
	if (!inTransaction) {
		tr = $o.startTransaction ({description: "setConf"});
	};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: (subject ? [
			{"a":"subject"}, "=", subject
		] : [
			{"a":"subject"}, "is null"
		]).concat ("and", {"a":"code"}, "=", code)
	});
	var o;
	if (r.length) {
		o = $o.getObject (r.get (0, "id"));
	} else {
		o = $o.createObject ("spr.conf");
	};
	o.set ("code", code);
	for (var attr in options) {
		o.set (attr, options [attr]);
	};
	o.commit ();
	if (!inTransaction) {
		$o.commitTransaction (tr);
	};
	if (common.data ["spr.conf"][subject]) {
		common.data ["spr.conf"][subject][code] = {
			id: o.get ("id"),
			used: o.get ("used"),
			name: o.get ("name"),
			value: o.get ("value")
		};
	} else {
		common.loadConf (subject);
	};
};
// user var
common.setVar = function (name, value) {
	if (!name) {
		return;
	};
	var inTransaction = $o.inTransaction;
	var tr;
	if (!inTransaction) {
		tr = $o.startTransaction ({description: "setVar"});
	};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"subject"}, "=", $userId ? $userId : 0, "and", {"a":"name"}, "=", name
		]
	});
	var o;
	if (r.length) {
		o = $zs.getObject (r.get (0, "id"));
	} else {
		o = $zs.createObject ("spr.conf");
	};
	o.set ("subject", $userId ? $userId : 0);
	o.set ("name", name);
	o.set ("value", value);
	o.commit ();
	if (!inTransaction) {
		$o.commitTransaction (tr);
	};
};
// user var
common.getVar = function (name) {
	if (!name) {
		return null;
	};
	var r = common.execSQL ({
		select: [
			{"a":"value"}, "value"
		],
		from: [
			{"a":"spr.conf"}
		],
		where: [
			{"a":"subject"}, "=", $userId ? $userId : 0, "and", {"a":"name"}, "=", name
		]
	});
	if (r.length) {
		return r.get (0, "value");
	} else {
		return null;
	};
};
// Список объектов к которым есть доступ
// {subjectId, classId, comma, read, write}
system.access.getObjects = function (options) {
	options = options || {};
	var result = [];
	var where;
	if (options.subjects) {
		where = [{"a":"subjectId"}, "in", options.subjects];
	} else {
		where = [{"a":"subjectId"}, "=", options.subjectId];
	}
	var sql = {
		select: [
			{"a":"objectId"}, "objectId",
			{"a":"read"}, "read",
			{"a":"write"}, "write"
		],
		from: [
			{"a":"system.access"},
			"inner-join", {"d":"system.object"}, "on", [
				{"a":"objectId"}, "=", {"d":"___fid"}, "and", 
				{"d":"___fend_id"}, "=", "2147483647", "and",
				{"d":"___fclass_id"}, "=", options.classId
			]
		],
		where: where
	};
	var r = common.execSQL (sql);
	for (var i = 0; i < r.length; i ++) {
		if ((options.read == true && !r.get (i, "read")) ||
			(options.read == false && r.get (i, "read")) ||
			(options.write == true && !r.get (i, "write")) ||
			(options.write == false && r.get (i, "write"))
		) {
			continue;
		}
		if (options.comma && result.length) {
			result.push (",");
		}
		if (options.detail) {
			result.push ({id: r.get (i, "objectId"), read: r.get (i, "read"), write: r.get (i, "write")});
		} else {
			result.push (r.get (i, "objectId"));
		}
	}
	return result;
}
system.xmlObj = null;
system.getObjNews = function (revision) {
	revision = revision || 0;
	if (!system.xmlObj) {
		if (window.XMLHttpRequest) {
			system.xmlObj = new XMLHttpRequest ();
		} else
		if (window.ActiveXObject) {
			system.xmlObj = new ActiveXObject ("Microsoft.XMLHTTP");
		}
	}        
	if (system.xmlObj) {
		system.xmlObj.open ('POST', '/objectum/obj_news?sessionId=' + $sessionId + '&mustget=' + Math.random (), true);
		system.xmlObj.onreadystatechange = function () {
			if (system.xmlObj.readyState == 4) {
				if (system.xmlObj.status == 401) {
					common.message ($o.getString ("Session not authorized. Please, reload browser page"));
				} else
				if (system.xmlObj.responseText) {
					var r = eval ("(" + system.xmlObj.responseText + ")");
					if (r.header.error == 'session removed') {
						Ext.Msg.alert ($ptitle, $zr.getString ('Session disabled'), function () {
							location.reload ();
						});
					};
					if (r.revision) {
						revision = r.revision;
						var objects = r.objects;
						for (var i = 0; i < objects.length; i ++) {
							delete $zs.objectsMap [objects [i]];
							$zp.application.fireEvent ('objectChanged', {id: objects [i]});
						}
					}
					if (r.message) {
						common.balloon (
							$zr.getString ("Server message"), 
							$zr.getString (r.message)
						);
					}
					system.getObjNews (revision);
					system.objNewsFails = 0;
				} else {
					system.objNewsFails = system.objNewsFails || 0;
					system.objNewsFails ++;
					//if (system.objNewsFails > 2) {
					//	common.message ("Отсутствует связь с сервером.");
					//} else {
						setTimeout ('system.getObjNews (' + revision + ')', 5000);	
					//};
				}
			};
		};
		system.xmlObj.send ($zs.id + ' ' + revision);
	}
}
Ext.ns ('Ext.ux.state')
Ext.ux.state.LocalStorage = function (config){
    Ext.ux.state.LocalStorage.superclass.constructor.call (this);
    Ext.apply (this, config);
    this.state = localStorage;
};
Ext.extend (Ext.ux.state.LocalStorage, Ext.state.Provider, {
    get : function (name, defaultValue){
        if (typeof this.state[name] == "undefined") {
            return defaultValue
        } else {
            return this.decodeValue (this.state [name])
        }
    },
    set : function (name, value){
        if (typeof value == "undefined" || value === null) {
        	try {
            	this.clear (name);
            } catch (e) {
            };
            return;
        }
        this.state [name] = this.encodeValue (value)
        this.fireEvent ("statechange", this, name, value);
    }
});
if (window.localStorage) {
    Ext.state.Manager.setProvider (new Ext.ux.state.LocalStorage ())
} else {
    var thirtyDays = new Date (new Date ().getTime () + (1000*60*60*24*30))
    Ext.state.Manager.setProvider (new Ext.state.CookieProvider ({expires: thirtyDays}))
}
system.LoginPassword.create = function () {
	var o = $o.createObject ("system.LoginPassword");
	o.commit ();
	this.refresh ();
};
system.LoginPassword.remove = function () {
	var id = this.getCurrentValue ("id");
	common.confirm ({message: $zr.getString ("Are you sure?"), scope: this, fn: function (btn) {
		if (btn == "yes") {
			$o.startTransaction ({description: 'Remove ' + id});
			obj.remove.call (this, {id: id, refresh: true});
			$o.commitTransaction ();
		}
	}});
};
ose.role.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.role.card",
			items: [{
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "name"
			}, {
				objectId: id, attr: "code"
			}, {
				objectId: id, attr: "menu", choose: {type: "layout", attr: "olap.a_id",
					layout: {
						olap: {
							id: "olap",
							view: "system.vo.menu"
						}
					}
				}
			}]
		}
	};
	return card;
};
ose.srole.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.srole.card",
			items: [{
				objectId: id, attr: "role", choose: {type: "layout", attr: "olap.id",
					layout: {
						olap: {
							id: "olap",
							view: "system.ose.role"
						}
					}
				}
			}, {
				objectId: id, attr: "subject", xtype: "numberfield"
			}]
		}
	};
	return card;
};
ose.ext.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.ext.card",
			items: [{
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "classAttr"
			}, {
				objectId: id, attr: "take"
			}, {
				objectId: id, attr: "give"
			}]
		}
	};
	return card;
};
ose.object.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "ose.object.card",
			items: [{
				objectId: id, attr: "class"
			}, {
				objectId: id, attr: "object"
			}, {
				objectId: id, attr: "subject", xtype: "numberfield"
			}, {
				objectId: id, attr: "read"
			}, {
				objectId: id, attr: "update"
			}, {
				objectId: id, attr: "delete"
			}]
		}
	};
	return card;
};
system.vo.menu.card = function (options) {
	var id = options.id;
    var card = {
		card: {
			id: "system.vo.menu.card",
			items: [{
				objectId: id, attr: "name"
			}, {
				objectId: id, attr: "position",
				xtype: "combo",
				name: "position",
				width: 300,
				triggerAction: "all",
				lazyRender: true,
				mode: "local",
				queryMode: "local",
				editable: false,
				store: new Ext.data.ArrayStore ({
					fields: ["id", "text"],
					data: [
						["top", $o.getString ("Top")],
						["left", $o.getString ("Left")],
						["bottom", $o.getString ("Bottom")],
						["right", $o.getString ("Right")]
					]
				}),
				valueField: "id",
				displayField: "text",
				style: "margin-top: 5px;"
			}, {
				objectId: id, attr: "large"
			}, {
				objectId: id, attr: "npp"
			}, {
				objectId: id, attr: "hidden"
			}]
		}
	};
	return card;
};
system.vo.menuItems.card = function (options) {
	var id = options.id;
	var o = $o.getObject (id);
    var card = {
    	tab: {
    		items: [{
				card: {
					id: "system.vo.menu.card",
					title: $o.getString ("Menu item"),
					items: [{
						objectId: id, attr: "view", xtype: "numberfield", hideLabel: true, style: "display: none"
					}, {
						xtype: "$conffield", 
						fieldLabel: $o.getString ("View"),
						name: "view", 
						value: o.get ("view"), 
						anchor: "-20",
						confRef: "view",
						choose: {
							type: "custom", fn: function () {
								var me = this;
								dialog.getView ({success: function (options) {
									me.setValue (options.id);
								}});
							}
						},
						listeners: {
							change: function () {
								this.up ("*[objectumCmp=card]").down ("*[attr=view]").setValue (this.getValue ());
								if (this.getValue ()) {
									this.up ("*[objectumCmp=card]").down ("*[name=action]").setValue (null);
									var view = $o.getView (this.getValue ());
									this.up ("*[objectumCmp=card]").down ("*[attr=name]").setValue (view.get ("name"));
									this.up ("*[objectumCmp=card]").down ("*[attr=iconCls]").setValue (view.get ("iconCls"));
								};
							}
						}
					}, {
						objectId: id, attr: "action", xtype: "numberfield", hideLabel: true, style: "display: none"
					}, {
						xtype: "$conffield", 
						fieldLabel: $o.getString ("Action"),
						name: "action", 
						value: o.get ("action"), 
						anchor: "-20",
						confRef: "action",
						choose: {
							type: "custom", fn: function () {
								var me = this;
								dialog.getAction ({success: function (options) {
									me.setValue (options.id);
								}});
							}
						},
						listeners: {
							change: function () {
								this.up ("*[objectumCmp=card]").down ("*[attr=action]").setValue (this.getValue ());
								if (this.getValue ()) {
									this.up ("*[objectumCmp=card]").down ("*[name=view]").setValue (null);
									var action = $o.getAction (this.getValue ());
									this.up ("*[objectumCmp=card]").down ("*[attr=name]").setValue (action.get ("name"));
								};
							}
						}
					}, {
						objectId: id, attr: "name"
					}, {
						objectId: id, attr: "description"
					}, {
						objectId: id, attr: "iconCls", xtype: "$iconselector"
					}, {
						objectId: id, attr: "npp"
					}, {
						objectId: id, attr: "hidden"
					}]
				}
			}, {
				"olap": {
					"id": "olapMenuItems",
					"title": $o.getString ("Child menu items"),
					"view": "system.vo.menuItems",
					"actions": [
						{
							"fn": "common.tpl.show",
							"text": $o.getString ("Open"),
							"arguments": {
								"asWindow": 1,
								"card": "system.vo.menuItems.card"
							},
							"iconCls": "gi_edit",
							"active": "common.recordSelected"
						},
						{
							"fn": "common.tpl.create",
							"text": $o.getString ("Add"),
							"arguments": {
								"asWindow": 1,
								"classCode": "system.vo.menuItems",
								"attrs": {
									"parent": id
								}
							},
							"iconCls": "gi_circle_plus"
						},
						{
							"fn": "common.tpl.remove",
							"text": $o.getString ("Remove"),
							"iconCls": "gi_circle_minus",
							"active": "common.recordSelected"
						}
					],
					"listeners": {
						"cellRenderer": "system.vo.menuItems.cellRenderer",
						"dblclick": {
							"fn": "common.tpl.show",
							"arguments": {
								"asWindow": 1,
								"card": "system.vo.menuItems.card"
							}
						}
					},
					"filter": [
						"a_parent", "=", id
					]
				}
			}]
		}
	};
	return card;
};
system.vo.menu.cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
	if (record.get ("a_position") && metaData.column.dataIndex == "a_position") {
		switch (record.get ("a_position")) {
		case "top":
			value = $o.getString ("Top");
			break;
		case "left":
			value = $o.getString ("Left");
			break;
		case "bottom":
			value = $o.getString ("Bottom");
			break;
		case "right":
			value = $o.getString ("Right");
			break;
		};
	};
	return value;
};
system.vo.menuItems.cellRenderer = function (value, metaData, record, rowIndex, colIndex, store) {
	if (record.get ("a_view") && metaData.column.dataIndex == "a_view") {
		value = $o.getView (record.get ("a_view")).toString ();
	};
	if (record.get ("action") && metaData.column.dataIndex == "action") {
		value = $o.getAction (record.get ("action")).toString ();
	};
	return value;
};
subject.human.create = function (options) {
	common.tpl.create.call (this, Ext.apply (options, {
		asWindow: 1,
		classCode: "subject.human"
	}));
};
subject.human.card = function (options) {
	var me = this;
	var id = options.id;
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"role"}, "role"
		],
		from: [
			{"a":"ose.srole"}
		],
		where: [
			{"a":"subject"}, "=", id
		]
	});
	var roleId = null;
	if (r.length) {
		roleId = r.get (0, "role");
	};
    var card = {
		card: {
			id: "subject.human.card",
			listeners: {
				afterSave: function () {
					roleId = this.down ("*[name=role]").getValue ();
					var os;
					if (r.length) {
						os = $o.getObject (r.get (0, "id"));
					} else {
						os = $o.createObject ("ose.srole");
						os.set ("subject", id);
					};
					os.set ("role", roleId);
					os.sync ();
				}
			},
			items: [{
				objectId: id, attr: "surname"
			}, {
				objectId: id, attr: "forename"
			}, {
				objectId: id, attr: "patronymic"
			}, {
				objectId: id, attr: "birthday", timefield: 0
			}, {
				objectId: id, attr: "login"
			}, {
				objectId: id, attr: "password"
			}, {
				xtype: "$objectfield", name: "role", fieldLabel: "Роль", value: roleId, anchor: "-20", choose: {
					type: "layout", attr: "olap.id",
					layout: {
						olap: {
							id: "olap",
							view: "system.ose.role"
						}
					}
				}
			}]
		}
	};
	return card;
};
system.vo.chooseAdminMenu = function () {
	var me = this;
	var win = Ext.create ("Ext.Window", {
		width: 400,
		height: 100,
		layout: "form",
		frame: false,
		border: false,
		style: "background-color: #ffffff",
		bodyStyle: "background-color: #ffffff",
		title: $o.getString ("Admin menu"),
		iconCls: "gi_list",
		bodyPadding: 5,
		modal: 1,
		tbar: [{
			text: "Ок",
			iconCls: "gi_ok",
			handler: function () {
				common.setConf ("adminMenu", {
					name: $o.getString ("Admin menu"),
					value: win.down ("*[name=menu]").getValue ()
				});
				win.close ();
			}
		}, {
			text: $o.getString ("Cancel"),
			iconCls: "gi_remove",
			handler: function () {
				win.close ();
			}
		}],
		items: {
			xtype: "$objectfield",
			name: "menu",
			fieldLabel: $o.getString ("Menu"),
			value: common.getConf ("adminMenu").value,
			choose: {type: "layout", attr: "olap.a_id", layout: {
		        olap: {
		            id: "olap",
		            view: "system.vo.menu"
		        }
			}}
		}
	});
	win.show ();
};
system.vo.buildMenu = function () {
	var menuId;
	if ($o.currentUser == "admin") {
		menuId = common.getConf ("adminMenu").value;
	} else
	if ($o.currentUser == "autologin") {
		menuId = common.getConf ("autologinMenu").value;
		if (!menuId) {
			return;
		};
	} else {
		var oUser = $o.getObject ($o.userId);
		if ($o.getClass (oUser.get ("classId")).getFullCode () == "subject.human.vo_adm") {
			menuId = common.getConf ("adminMenu").value;
		} else {
			menuId = $o.menuId;
		};
	};
	if (!menuId) {
		if (oUser.get ("voRole")) {
			var oRole = $o.getObject (oUser.get ("voRole"));
			if (oRole && oRole.get ("menu")) {
				menuId = oRole.get ("menu");
			} else {
				return common.message ($o.getString ("User has no role"));
			}
		} else {
			return common.message ($o.getString ("User has no role"));
		}
	};
	var m = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"position"}, "position",
			{"a":"large"}, "large"
		],
		from: [
			{"a":"system.vo.menu"}
		],
		where: [
			[{"a": "hidden"}, "is null", "or", {"a": "hidden"}, "=", 0], "and", {"a": "id"}, "=", menuId
		],
		order: [
			{"a": "npp"}, ",", {"a": "name"}
		]
	});
	if (!m.length) {
		return;
	};
	var r = common.execSQL ({
		select: [
			{"a":"id"}, "id",
			{"a":"menu"}, "menu",
			{"a":"name"}, "name",
			{"a":"iconCls"}, "iconCls",
			{"a":"parent"}, "parent",
			{"a":"view"}, "view",
			{"a":"action"}, "action",
			{"a":"readOnly"}, "readOnly"
		],
		from: [
			{"a":"system.vo.menuItems"}
		],
		where: [
			{"a": "hidden"}, "is null", "or", {"a": "hidden"}, "=", 0
		],
		order: [
			{"a": "npp"}, ",", {"a": "name"}
		]
	});
	// preload actions
	var actions = [];
	for (var i = 0; i < r.length; i ++) {
		if (r.get (i, "action")) {
			actions.push (r.get (i, "action"));
		};
	};
	var actionRecs = [];
	if (actions.length) {
		actionRecs = $o.execute ({
			asArray: true,
			select: [
				{"a": "___fid"}, "id",
				{"a": "___fclass_id"}, "classId",
				{"a": "___fcode"}, "code"
			],
			from: [
				{"a": "system.action"}
			],
			where: [
				{"a": "___fend_id"}, "=", 2147483647, "and", {"a": "___fid"}, "in", actions.join (".,.").split (".")
			]
		});
	};
	var menu = [];
	for (var i = 0; i < r.length; i ++) {
		if (r.get (i, "menu") == menuId && !r.get (i, "parent")) {
			var iconCls = r.get (i, "iconCls");
			if (iconCls && m.get (0, "large")) {
				iconCls = "gib" + iconCls.substr (2);
			};
			var o = {
				id: r.get (i, "id"),
				text: r.get (i, "name"),
				iconCls: iconCls,
				viewRecord: $o.getView (r.get (i, "view")),
				viewReadOnly: r.get (i, "readOnly"),
//				actionRecord: $o.getAction (r.get (i, "action")),
				actionId: r.get (i, "action"),
				handler: function () {
					if (this.viewRecord) {
						$o.app.show.call ($o.app, {
							record: this.viewRecord,
							readOnly: this.viewReadOnly
						});
					} else
					if (this.actionId) {
						var actionRec = _.findWhere (actionRecs, {id: this.actionId});
						if (actionRec) {
							var cls = $o.getClass (actionRec.classId);
							var _fn = (cls ? (cls.getFullCode () + ".") : "") + actionRec.code;
							_fn = eval (_fn);
							if (typeof (_fn) == "function") {
								_fn ({readOnly: this.viewReadOnly});
							};
						};
					};
				}
			};
			if (m.get (0, "large")) {
				o.iconAlign = "top";
				o.scale = "large";
				if (m.get (0, "position") == "left" || m.get (0, "position") == "right") {
					o.arrowAlign = "bottom";
					o.menuAlign = "tr";
					o.arrowCls = "arrow-right-white";
				};
			};
			menu.push (o);
		};
	};
	function getMenuElements (menu, parentId) {
		var items = [];
		for (var i = 0; i < r.length; i ++) {
			if (parentId == r.get (i, "parent")) {
				try {
					$o.getView (r.get (i, "view"));
				} catch (e) {
					console.log (r.get (i, "id"));
				};
				var o = {
					text: r.get (i, "name"),
					iconCls: r.get (i, "iconCls"),
					viewRecord: $o.getView (r.get (i, "view")),
					viewReadOnly: r.get (i, "readOnly"),
//					actionRecord: $o.getAction (r.get (i, "action")),
					actionId: r.get (i, "action"),
					handler: function () {
						if (this.viewRecord) {
							$o.app.show.call ($o.app, {
								record: this.viewRecord,
								readOnly: this.viewReadOnly
							});
						} else
						/*
						if (this.actionRecord) {
							this.actionRecord.execute ({readOnly: this.viewReadOnly});
						};
						*/
						if (this.actionId) {
							var actionRec = _.findWhere (actionRecs, {id: this.actionId});
							if (actionRec) {
								var cls = $o.getClass (actionRec.classId);
								var _fn = (cls ? (cls.getFullCode () + ".") : "") + actionRec.code;
								_fn = eval (_fn);
								if (typeof (_fn) == "function") {
									_fn ({readOnly: this.viewReadOnly});
								};
							};
						};
					}
				};
				getMenuElements (o, r.get (i, "id"));
				items.push (o);
			};
		};
		if (items.length) {
			menu.menu = {items: items};
		};
	};
	for (var j = 0; j < menu.length; j ++) {
		getMenuElements (menu [j], menu [j].id);
	};
	var o = {
		text: $o.getString ("Exit"),
		iconCls: "gi_exit",
		handler: function () {
			if ($o.userId) {
				$o.startTransaction ();
				var o = $o.getObject ($o.userId);
				o.set ("lastLogout", new Date ());
				o.sync ();
				$o.commitTransaction ();
			}
			$o.logout ({success: function () {
				location.reload ();
			}});
		}
	};
	if (m.get (0, "large")) {
		o.iconCls = "gib_exit";
		o.iconAlign = "top";
		o.scale = "large";
	};
	menu.push (o);
	if ($o.visualObjectum.timeMachine && $o.visualObjectum.timeMachine.showDates) {
		var date1 = new Date ();
		$o.visualObjectum.timeMachine.dates = $o.visualObjectum.timeMachine.dates || [];
		for (var i = 0; i < $o.visualObjectum.timeMachine.dates.length; i ++) {
			var d = $o.visualObjectum.timeMachine.dates [i].date;
			if (d.getTime () < date1.getTime ()) {
				date1 = d;
			};
		};
		menu.push ({
			xtype: "displayfield",
			value: $o.getString ("System date") + ":"
		}, {
			xtype: "datefield",
			minValue: date1,
			maxValue: new Date (),
			value: new Date (),
			width: 100,
			listeners: {
				render: function () {
					Ext.tip.QuickTipManager.register ({
						target: this.id,
						text: $o.getString ("View data in last dates"),
						width: 200,
						dismissDelay: 3000
					});			
				},
				change: function (f, nv) {
					var revisionId;
					var nJul = common.getJulianDay (nv);
					var cJul = common.getJulianDay (new Date ());
					if (nJul == cJul) {
						$o.setRevision ();
					} else {
						for (var i = $o.visualObjectum.timeMachine.dates.length - 1; i >= 0; i --) {
							var dJul = common.getJulianDay ($o.visualObjectum.timeMachine.dates [i].date);
							if (dJul <= nJul) {
								revisionId = $o.visualObjectum.timeMachine.dates [i].id;
							};
						};
						$o.setRevision (revisionId);
					};
				}
			}
		});
	};
	switch (m.get (0, "position")) {
	case "top":
		$o.app.tb.add (menu);
		$o.app.tb.doLayout ();
		$o.app.tb.show ();
		break;
	case "left":
		$o.app.lb.add (menu);
		$o.app.lb.doLayout ();
		$o.app.lb.show ();
		break;
	case "right":
		$o.app.rb.add (menu);
		$o.app.rb.doLayout ();
		$o.app.rb.show ();
		break;
	case "bottom":
		$o.app.bb.add (menu);
		$o.app.bb.doLayout ();
		$o.app.bb.show ();
		break;
	};
};
Ext.override (Ext.menu.Menu, {
    onMouseLeave: function (e) {
	    var me = this;
	    // BEGIN FIX
	    var visibleSubmenu = false;
	    me.items.each (function (item) { 
	        if (item.menu && item.menu.isVisible ()) { 
	            visibleSubmenu = true;
	        };
	    });
	    if (visibleSubmenu) {
	        //console.log('apply fix hide submenu');
	        return;
	    };
	    // END FIX
	    me.deactivateActiveItem ();
	    if (me.disabled) {
	        return;
	    };
	    me.fireEvent ("mouseleave", me, e);
    }
});
Ext.namespace ("subject.human.vo_adm");
subject.human.vo_adm.create = function (options) {
	common.tpl.create.call (this, {
		asWindow: 1,
		classCode: "subject.human.vo_adm",
		fn: function (o, options) {
			options.layout = subject.human.vo_adm.card.layout (o.get ("id"))
		}
	});
};
subject.human.vo_adm.card = function (options) {
	var me = this;
	var id = me.getValue ("id") || me.getValue ("a_id");
	common.tpl.show.call (this, {
		id: id,
		asWindow: 1,
		layout: subject.human.vo_adm.card.layout (id)
	});
};
subject.human.vo_adm.card.layout = function (id) {
	var l = {
		"card": {
			"id": "card",
			"items": [
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Login"),
					"attr": "login",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Password"),
					"attr": "password",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Surname"),
					"attr": "surname",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Forename"),
					"attr": "forename",
					"objectId": id
				},
				{
					"anchor": "100%",
					"fieldLabel": $o.getString ("Patronymic"),
					"attr": "patronymic",
					"objectId": id
				}
			]
		}
	};
	return l;
};

