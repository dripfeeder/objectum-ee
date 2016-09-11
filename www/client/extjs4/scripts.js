// Common util for all projects
Ext.namespace (
	'common',
	'common.chart',
	'common.window',
	'common.card',
	'common.tpl',
	'common.report',
	'obj',
	'dialog',
	'$report',
	'$dbf',
	'$csv'
);
// Message
common.message = function (s, fn) {
	Ext.Msg.alert ($ptitle, s, fn);
};
// Confirm
common.confirm = function (options) {
	var scope = options.scope ? options.scope : this;
	Ext.Msg.show ({
		title: $ptitle,
		msg: options.message,
		buttons: Ext.Msg.YESNO,
		fn: options.fn,
		animEl: 'elId',
		icon: Ext.MessageBox.QUESTION,
		scope: scope
	});
};
// Признак выбранной записи
common.recordSelected = function (options) {
	options = options || {};
	var olap, attr = options.attr || "id";
	if (!options.olap) {
		olap = this;
	} else {
		olap = this.relatives [options.olap];
	};
	var result = false;
	var v;
	if (olap.getSelectionModel) {
		v = olap.getSelectionModel ().hasSelection ();
	} else {
		v = olap.getCurrentValue (attr);
	};
	if (v) {
		result = true;
	};
	/*
	var result = false;
	if (options.olap && options.attr) {
		var id = this.zview.getCurrentValue (options.olap, options.attr);
		if (id) {
			result = true;
		};
	};
	*/
	return result;
};
// options {classCode, attrs, refresh}
obj.create = function (options) {
    var object = $zs.createObject (options.classCode);
    object.commit ();
    var id = object.getId ();
    if (options.attrs) {
    	for (var key in options.attrs) {
    		if (options.attrs.hasOwnProperty (key)) {
	    		object.set (key, options.attrs [key]);
	    	};
    	};
    	object.commit ();
    };
    if (options.refresh) {
	    this.refresh ({
			callback: function (record, store, success) {
				if (success) {
					this.selectRow ({filter: ["&id", "=", id]});
				};
			},
			scope: this
    	});
    };
    return id;
};
// options {id, objects, refresh}
obj.remove = function (options) {
    if (options.id == null ) {
    	common.message ($zr.getString ("object must be selected"));
    	return false;
    };
    var result = false;
    var o = $zs.getObject (options.id);
    if (o) {
    	if (options.objects) {
    		var oo = options.objects;
    		for (var i = 0; i < oo.length; i ++) {
    			if (oo [i].classCode) {
					var r = common.execSQL ({
						select: [
							{"a":"id"}, "id"
						],
						from: [
							{"a":oo [i].classCode}
						],
						where: [
							{"a":oo [i].attr}, "=", options.id
						]
					});
					for (var j = 0; j < r.length; j ++) {
					    var o2 = $zs.getObject (r.get (j, "id"));
				    	if (o2) {
							o2.remove ();
							o2.commit ();
						};
					};
    			} else {
	    			if (o.get (oo [i])) {
					    var o2 = $zs.getObject (o.get (oo [i]));
				    	if (o2) {
						    o2.remove ();
						    o2.commit ();
						};
			    	};
			    };
    		};
    	} else {
			if (!options.force) {
				options.object = o;
				var dependentObjects = obj.getDependentObjects (options);
				if (dependentObjects.length) {
					var r = '<table id="objDetails" style="font-family:Tahoma !important; font-size:8pt !important;"><tr><td><b>Тип</b></td><td style="padding-left: 5px;"><b>Наименование</b></td></tr>';
					var numAliveObjects = 0;
					for (var i = 0; i < dependentObjects.length; i ++) {
						var o = $zs.getObject (dependentObjects [i]);
						if (!o) {
							continue;
						};
						numAliveObjects ++;
						var name;
						try {
							name = o.get ('name') || ('id: ' + o.get ('id'));
						} catch (e) {
							name = 'id: ' + o.get ('id');
						};
						var clsName = $zs.classesMap [o.get ('classId')].stub.get ('name');
						if (clsName.substr (0, 8) == 'section_') {
							clsName = 'Данные';
							name = '';
							if (o.get ('subject')) {
								var oo = $zs.getObject (o.get ('subject'));
								name += oo.get ('name');
							};
							if (o.get ('repDate')) {
								if (name) {
									name += ', ';
								};
								var oo = $zs.getObject (o.get ('repDate'));
								name += oo.get ('name');
							};
						};
						r += '<tr><td>' + clsName  + '</td>';
						r += '<td style="padding-left: 5px;">' + name + '</td></tr>';
					};
					r += '</table>';
					if (numAliveObjects) {
						common.message ("Количество зависимых объектов: " + dependentObjects.length + ' (id: ' + JSON.stringify (dependentObjects) + ')<br><a href="#" id="detailsLink">Подробности</a>');
						Ext.get ("detailsLink").on ("click", function () {
							var w = window.open ("", "window1", "width=600, height=400, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
							w.document.open ();
							w.document.write (r);
						}, this);
						return false;
					};
				}
			}
    	}
    	o = $zs.getObject (options.id);
		o.remove ();
		o.commit ();
		result = true;
		if (options.refresh) {
			this.getSelectionModel ().deselectAll ();
			this.refresh ();
		};
	};
	return result;
};
// obj.getValue (o, "attr1.attr2.name");
// obj.getValue (args, "$attr1.attr2.name");
obj.getValue = function (o, path) {
	var r = null;
	if (path && path [0] == "$") {
		var tokens = path.split (".");
		var arg = tokens [0].substr (1, tokens [0].length - 1);
		if (o [arg]) {
			o = $o.getObject (o [arg]);
			tokens.splice (0, 1);
			path = tokens.join (".");
		};
	};
	if (o) {
		var tokens = path.split (".");
		for (var i = 0; i < tokens.length; i ++) {
			if (tokens [i] == "$date") {
				return r ? r.toString ("d.m.Y") : r;
			};
			if (i) {
				if (!r) {
					break;
				};
				o = $o.getObject (r);
			};
			if (!o) {
				break;
			};
			r = o.get ? o.get (tokens [i]) : o [tokens [i]];
		};
	};
	return r;
};
common.getValue = obj.getValue;
// DD.MM.YYYY
common.currentDate = function () {
	var d = new Date ();
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// DD.MM.YYYY
common.getDate = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
common.getDateFromDDMMYYYY = function (d) {
	var r = null;
	if (d && d.length == 10 && d [2] == "." && d [5] == ".") {
		r = new Date (d.substr (6, 4), d.substr (3, 2) - 1, d.substr (0, 2));
	}
	return r;
}
// HH:MM:SS
common.currentTime = function () {
	var d = new Date ();
	var hh = d.getHours ();
	var mm = d.getMinutes ();
	var ss = d.getSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.currentTimestamp = function () {
	return common.currentDate () + " " + common.currentTime ();
};
// DD.MM.YYYY
common.getDate = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// YYYY-MM-DD
common.getDateISO = function (d) {
	if (!d) {
		return d;
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = String (yyyy) + "-";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + "-";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd);
	return s;
};
// HH:MM:SS
common.getTime = function (d) {
	var hh = d.getHours ();
	var mm = d.getMinutes ();
	var ss = d.getSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.getTimestamp = function (d) {
	return common.getDate (d) + " " + common.getTime (d);
};
// DD.MM.YYYY
common.getUTCDate = function (d) {
	var dd = d.getUTCDate ();
	var mm = d.getUTCMonth () + 1;
	var yyyy = d.getUTCFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// HH:MM:SS
common.getUTCTime = function (d) {
	var hh = d.getUTCHours ();
	var mm = d.getUTCMinutes ();
	var ss = d.getUTCSeconds ();
	var s = "";

	if (hh < 10)
		s += "0";

	s += String (hh) + ":";

	if (mm < 10)
		s += "0";

	s += String (mm) + ":";

	if (ss < 10)
		s += "0";

	s += String (ss);

	return s;
};
// DD.MM.YYYY HH:MM:SS
common.getUTCTimestamp = function (d) {
	return common.getUTCDate (d) + " " + common.getUTCTime (d);
};
// Date -> Юлианский день
common.getJulianDay = function (d) {
    if (d == '') {
        return 0;
    };
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yy = d.getFullYear ();
/*    if (mm < 3) {
        mm += 12;
        yy --;
    };
    var jd = parseInt (yy * 365.25) + parseInt (mm * 30.6 + 0.7) + dd;
    return jd;*/
    jd = Math.floor ( 1461 * ( yy + 4800 + ( mm - 14 ) / 12)) / 4 + Math.floor (Math.floor ( 367 * ( mm - 2 - 12 * (( mm - 14 ) / 12))) / 12) - 3 * Math.floor (Math.floor ( yy + 4900 + ( mm - 14 ) / 12) / 100) / 4 + dd - 32075;
    return Math.floor (jd);
};
// Юлианский день -> Date
common.getDateByJulianDay = function (jd) {
	var l, n, i, j, d, m, y;
	l = jd + 68569;
	n = Math.floor (( 4 * l ) / 146097);
	l = Math.floor (l - ( 146097 * n + 3 ) / 4);
	i = Math.floor (( 4000 * ( l + 1 ) ) / 1461001);
	l = l - Math.floor (( 1461 * i ) / 4) + 31;
	j = Math.floor (( 80 * l ) / 2447);
	d = l - Math.floor (( 2447 * j ) / 80);
	l = Math.floor (j / 11);
	m = j + 2 - ( 12 * l );
	y = 100 * ( n - 49 ) + i + l;
	return new Date (y, m - 1, d);
}
common.execSQL = function (sql) {
	var j, result;

	if ($zs) {
		result = $zs.execute ({
			query: sql,
			async: false
		});
	} else {
		result = zerp.Storage.STORAGES [0].execute ("Storage.execute([!" + BiJson.serialize (sql) + "!])");
	};

	try {
		var temp = result.length;
	}
	catch (err) {
		result = {};
		result.length = 0;
	}
	// Поля в результате запроса по номерам
	result.fields = {};

	for (j = 0; j < sql.select.length / 2; j ++) {
		result.fields [sql.select [j * 2 + 1] ] = j;
		result.fields [j] = j;
	}
	// Функция доступа к результатам запроса
	// row, col - result [row] [col]
	// col - может быть числом или названием атрибута
	result.get = function (row, col) {
		var colN = this.fields [col];

		if (colN == null)
			throw "result.get: col unknown (row:" + row + ",col:" + col + ")";

		var val = this [row] [colN];

		if (val == undefined)
			val = null;

		return val;
	}
    return result;
};
// Объекты имеющие ссылки на объект options.id
obj.getDependentObjects = function (options) {
	var r = common.execSQL ({
		select: [
			{"a":"___fid"}, "id"
		],
		from: [
			{"a":"system.object"},
			"left-join", {"b":"system.object_attr"}, "on", [{"a":"___fid"}, "=", {"b":"___fobject_id"}],
			"left-join", {"c":"system.class_attr"}, "on", [{"b":"___fclass_attr_id"}, "=", {"c":"___fid"}]
		],
		where: [
			{"a":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"b":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"c":"___fend_id"}, "=", system.revision.maxRevision, "and",
			{"c":"___ftype_id"}, ">=", 1000, "and",
			{"b":"___fnumber"}, "=", options.id
		]
	});
	var result = [];
	for (var i = 0; i < r.length; i ++) {
		if (result.indexOf (r.get (i, "id")) == -1) {
			result.push (r.get (i, "id"));
		}
	}
	return result;
};
// Открытые окна карточек (uses in common.window.closeAll)
common.window.list = [];
// Показывает карточку
// options {
//	id или olap, attr - ID объекта для карточки
//	title, - заголовок
//	cardFn, - функция генератор макета карточки cardFn ({id: id})
//	iconCls, - иконка
//	width, - ширина
//	height, - высота
//	refresh, - рефреш зависимого олапа после закрытия окна (options.olap)
//	maximizable, - возможносьт развернуть на весь экран
//	maximized, - показать в развернутом виде
//	modal, - модальное окно
//	listeners - обработчики
//}
common.window.titleMaxLength = 12;
common.window.cardFn = null;
common.window.callCardFn = function (options) {
	return common.window.cardFn (options);
};
// common.window.show (options)
common.window.options = null;
// Заглушка
common.card = function () {return {};};
common.window.onViewLayout = function (options) {
	var record = options.record;
	var layout = options.layout;
	if ($zs.views.ser.card.stub.get ('id') == record.stub.get ('id') && common.window.options) {
		var cardFn = common.window.options.cardFn;
		var r = cardFn (common.window.options);
		Ext.apply (layout, r);
		common.window.options = null; // objectfield.choose.layout тут мешается
	};
};
common.window.show = function (options) {
	options = options || {};
	var id = options.id;
	if (options.olap && options.attr) {
		id = this.relatives [options.olap].getCurrentValue (options.attr);
	};
	options.id = id;
	var windowId = "Window-" + (++ Ext.Component.AUTO_ID);
	var view;
	var record = $zs.views.ser.card;
	if (common.extMajorVersion () == 4) {
		view = Ext.create ("$o.Layout.Widget", {
			record: record,
			$layout: options.cardFn (options)
		});
	} else {
		record.stub.set ("layout", "common.card ()");
		common.window.options = options;
		view = new objectum.ui.layout.ViewLayout (Ext.apply ({
			border: false,
			record: record,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		}, options.viewOptions));
	};
	view.on ('destroy', function () {
		var i = common.window.list.indexOf (this);
		if (i > -1) {
			common.window.list.splice (i, 1);
		}
		if (options.refreshOlap) {
			try {
			    options.refreshOlap.refresh ({
					callback: function (record, store, success) {
						if (success) {
							options.refreshOlap.selectRow ({filter: ["&id", "=", id]});
						};
					}
		    	});
			} catch (e) {
			}
		}
	}, this);
	if (options.refresh) {
		options.refreshOlap	= this.relatives [options.olap];
	}
	if (options.asWindow) {
		options.width = options.width || 800;
		options.height = options.height || 600;
		if (options.listeners && !options.listeners.scope) {
			options.listeners.scope = this;
		}
		var win = new Ext.Window ({
			id: windowId,
			title: options.title,
			resizable: true,
			closable: true,
			maximizable: options.maximizable,
			maximized: options.maximized,
			modal: options.modal,
			width: options.width,
			height: options.height,
			iconCls: options.iconCls,
		    bodyPadding: 2,
			style: "background-color: #ffffff",
			bodyStyle: "background-color: #ffffff",
			layout: 'fit',
			stateful: false,
			items: [
				view
			],
			listeners: options.listeners
		});
		view.win = win;
/*		win.on ("close", function () {
			var i = common.window.list.indexOf (this);
			if (i > -1) {
				common.window.list.splice (i, 1);
			}
			if (options.refreshOlap) {
				try {
					options.refreshOlap.refresh ();
				} catch (e) {
				}
			}
		}, this);*/
		win.on ('show', function () {
			var pos = win.getPosition ();
			if (pos [1] < 0) {
				win.setPosition (pos [0], 0);
			}
		}, this);
		win.show ();
		common.window.list.push (win);
	} else {                                   
		var pageId = "o" + id;
		var app = $zp.application;
		var closeTask = function () {
			if (options.listeners && options.listeners.close) {
				var scope = options.listeners.close.scope || options.listeners.scope || this;
				var fn = options.listeners.close.fn || options.listeners.close;
				fn.call (scope);
			}
		};
//		app.openPages = app.openPages || {};
//		if (!(pageId in app.openPages)) {
		if (!$o.app.tp.down ("#" + pageId)) {
//			app.openPages [pageId] = app.mainPanel.add ({
			$o.app.tp.add ({
				id: pageId,
				xtype: "panel",
				layout: 'fit',
				node: 1,
				iconCls: options.iconCls,
				tooltip: options.title,
				title: options.title.length > common.window.titleMaxLength ? options.title.substr (0, common.window.titleMaxLength) + "..." : options.title,
				closable: true,
				bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';',
				items: [
					view
				],
				close: function () {
					app.mainPanel.remove (app.openPages [pageId]);
					closeTask ();
				},
				listeners: {
					destroy: function () {
						/*
						if (options.refreshOlap) {
							try {
								options.refreshOlap.refresh ();
							} catch (e) {
							}
						}*/
						closeTask ();
					},
					scope: this
				}
			});
//			view.win = app.openPages [pageId];
//			app.mainPanel.doLayout ();
			$o.app.tp.doLayout ();
		};
		$o.app.tp.setActiveTab (pageId);
//		app.mainPanel.activate (app.openPages [pageId]);
		document.location.href = '#' + pageId;
	}
	$zp.application.fireEvent ('showPage', {record: record, showOptions: options});
};
// Закрывает открытые окна карточек
common.window.closeAll = function () {
	for (var i = 0; i < common.window.list.length; i ++) {
		common.window.list [i].close ();
	}
}
common.data = {};
// Получить ид через код
// options: {classCode, code}
common.getId = function (options) {
	if (common.data [options.classCode] == null) {
		common.data [options.classCode] = {};
		var r = common.execSQL ({
			select: [
				{"a":"id"}, "id",
				{"a":"code"}, "code"
			],
			from: [
				{"a":options.classCode}
			]
		});
		for (var i = 0; i < r.length; i ++) {
			common.data [options.classCode][r.get (i, "code")] = r.get (i, "id");
		}
	};
	var result = common.data [options.classCode][options.code];
	if (result == null) {
		throw {
			name: "common.getId exception",
			message: "classCode:" + options.classCode + ", code:" + options.code + " not exist"
		}
	}
	return result;
};
// Типовой макет для редактирования справочника
// options: {viewCode, classCode, olapId, cardId}
common.sprLayout = function (options) {
	var l = { 
		split:  {
			orientation: "vertical",
			width: 250,
			pages: [
				{olap: {
					id: options.olapId,
					view: options.viewCode,
					actions: [
						{
							id: options.classCode + ".create",  
							caption: "create",
							icon: "new",
							group: true
						}, {
							id: options.classCode + ".remove",
							active: {
								fn: common.recordSelected,
								arguments: {
									olap: "olap",
									attr: "id"
								}
							},
							caption: "delete",
							icon: "delete"
						}
					]
				}},
				{card: {
					id: options.cardId,
					fields: [
						{id: "olap", attr: "id.npp"},
						{id: "olap", attr: "id.name"},
						{id: "olap", attr: "id.code"},
						{id: "olap", attr: "id.used"},
						{id: "olap", attr: "id.description"}
					]
				}}
			]
		}
	}
	return l;
}
/*
	Показывает окно с диаграммой
	
	options: {
		title: "title", 
		width: 800, 
		height: 600, 
		xtype: "linechart", 
		fields: fields, 
		data: data,
		xAxisTitle: "Month",
		yAxisTitle: "USD",
		xField: "month", 
		yFields: [
			{yField: "sales", displayName: "Sales"},
			{yField: "rev", displayName: "Revenue"}
		],
		majorUnit: 500
	}

	storeExample = new Ext.data.JsonStore ({
		fields: ['month', 'sales', 'rev'],
		data: [
			{month:'Jan', sales: 2000, rev: 2000},{month:'Feb', sales: 1800, rev: 2000},
			{month:'Mar', sales: 1500, rev: 2000},{month:'Apr', sales: 2150, rev: 2000},
			{month:'May', sales: 2210, rev: 2000},{month:'Jun', sales: 2250, rev: 2000},
			{month:'Jul', sales: 2370, rev: 2000},{month:'Aug', sales: 2500, rev: 2000},
			{month:'Sep', sales: 3000, rev: 2000},{month:'Oct', sales: 2580, rev: 2000},
			{month:'Nov', sales: 2100, rev: 2000},{month:'Dec', sales: 2650, rev: 2000}
		]
	});
*/
common.chart.show = function (options) {
	var store = new Ext.data.JsonStore ({
		fields: options.fields,
		data: options.data
	});
	var width = options.width || 800;
	var height = options.height || 600;
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		maximizable: true,
		width: width,
		height: height,
		layout: 'fit',
		items: [{
			xtype: options.xtype,
			store: store,
			xField: options.xField,
			xAxis: new Ext.chart.CategoryAxis({
				title: options.xAxisTitle
			}),
			yAxis: new Ext.chart.NumericAxis({
				title: options.yAxisTitle,
				majorUnit: options.majorUnit
			}),
			series: options.yFields,
			extraStyle: {
				legend: {
					display: 'right'
				}
			}
		}]
	});	
	win.show ();
}
Ext.apply(Ext.form.VTypes, {
    daterange : function(val, field) {
        var date = field.parseDate(val);
        if(!date){
            return false;
        }
        if (field.startDateField) {
            var start = Ext.getCmp(field.startDateField);
            if (!start.maxValue || (date.getTime() != start.maxValue.getTime())) {
                start.setMaxValue(date);
                start.validate();
            }
        }
        else if (field.endDateField) {
            var end = Ext.getCmp(field.endDateField);
            if (!end.minValue || (date.getTime() != end.minValue.getTime())) {
                end.setMinValue(date);
                end.validate();
            }
        }
        /*
         * Always return true since we're only using this vtype to set the
         * min/max allowed values (these are tested for after the vtype test)
         */
        return true;
    }
});
// options: {title, success}
dialog.getPeriod = function (options) {
	var dr = new Ext.FormPanel({
		labelWidth: 75,
		frame: true,
		style: "background-color: #fff",
		bodyStyle: "background-color: #fff",
		bodyPadding: 5,
		width: 300,
		defaults: {width: 225},
		defaultType: 'datefield',
		items: [{
			fieldLabel: $zr.getString ("From"),
			allowBlank: false,
			msgTarget: 'side',
			value: common.currentDate (),
			format: "d.m.Y",
			name: 'startdt',
			id: 'startdt',
			vtype: 'daterange',
			endDateField: 'enddt' // id of the end date field
		},{
			fieldLabel: $zr.getString ("To"),
			allowBlank: false,
			msgTarget: 'side',
			value: common.currentDate (),
			format: "d.m.Y",
			name: 'enddt',
			id: 'enddt',
			vtype: 'daterange',
			startDateField: 'startdt' // id of the start date field
		}]
	});
	var scope = options.scope || this;
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		maximizable: false,
		modal: true,
		width: 300,
		height: 150,
		layout: 'fit',
		items: [
			dr
		],
		buttons: [
			{
				code: 'ok',
				formBind: true,
				handler: function () {
					var d1 = dr.items.items [0].getValue ();
					var d2 = dr.items.items [1].getValue ();
					win.close ();
					options.success.call (scope, {startDate: d1, dateStart: d1, endDate: d2, dateEnd: d2});
				}
			}, {
				code: 'cancel',
				formBind: false,
				handler: function () {
					win.close ();
				}
			}
		]
	});	
	win.show ();    
}
// Выбор объекта в любом представлении
// options: {width, height, title, view || layout, attr, success, scope}
dialog.getObject = function (options) {
	var panel;
	var winWidth = options.width || 600;
	var winHeight = options.height || 400;		
	if (!options.title) {
		options.title = $zr.getString ("object.choosing");
	}
	var scope = options.scope || this;
	var view;
	if (options.view) {
		view = new objectum.ui.layout.ViewLayout ({
			xtype: 'zviewlayout',
			border: false,
			record: $zs.views.get (options.view, {async: false}),
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		});
	} else {
		var record = $zs.views.get ("ser.card", {async: false});
		record.stub.set ("layout", typeof (options.layout) == "string" ? options.layout : JSON.stringify (options.layout));
		view = new objectum.ui.layout.ViewLayout ({
			xtype: 'zviewlayout',
			border: false,
			record: record,
			bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
		});
	};
	var choose = function () {
		var values, t = options.attr || "id";
		t = t.split (".");
		if (t.length == 1) {
			values = view.relatives ["olap"].getCurrentValues (t [0]);
		} else {
			values = view.relatives [t [0]].getCurrentValues (t [1]);
		};
		var value = values [0];
		win.close ();
		options.success.call (scope, {value: value, values: values});
	};
	var win = new Ext.Window ({
		title: options.title,
		resizable: true,
		closable: true,
		height: winHeight,
		width: winWidth,
		layout: 'fit',
		modal: true,
		tbar: [{
			code: 'choose',
			handler: choose,
			scope: scope
		}, {
			code: 'cancel',
			handler: function () {
				win.close ();
			}
		}],
		items: [view]
	});	
	win.show ();
}
/*
	Диалог выбора объекта
	options: {
		view (query)
		success ({value}) - callback
		scope
	}
*/
dialog.selectObject = function (options) {
	var success = options.success;
	var scope = options.scope;
	var layout = {
		olap: {
			id: "olap",
			view: options.view,
			listeners: {
				dblclick: function () {
					choose ();
				}
			}
		}
	};
	var record = $zs.views.get ("ser.card", {async: false});
	record.stub.set ("layout", JSON.stringify (layout));
	var view = new objectum.ui.layout.ViewLayout ({
		xtype: 'zviewlayout',
		border: false,
		record: record,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + ';'
	});
	var choose = function () {
		var id = view.relatives ["olap"].getCurrentValue ("id");
		win.close ();
		success.call (scope || this, {value: id});
	};
	var btnChoose = new Ext.Button ({
		code: 'choose',
		disabled: true,
		handler: choose,
		scope: this
	});
	var btnCancel = new Ext.Button ({
		code: 'cancel',
		handler: function () {
			win.close ();
		}
	});
	view.on ('load', function () {
		var olap = view.relatives ['olap'];
		if (!olap) {
			return;
		};
		var onSelectionChange = function () {
			if (olap.getCurrentValue ('id')) {
				btnChoose.setDisabled (false);
			} else {
				btnChoose.setDisabled (true);
			}
		};		
		olap.selModel.on ('selectionchange', onSelectionChange, this);
	}, this);
	var win = new Ext.Window ({
		code: "Выберите объект",
		resizable: true,
		closable: true,
		width: options.width || 600,
		height: options.height || 400,
		layout: 'fit',
		modal: true,
		tbar: new Ext.Toolbar ({
			items: [btnChoose, btnCancel]
		}),
		items: [view]
	});
	win.show ();
};
// options: {title, success}
dialog.getDate = function (options) {
	var dp = new Ext.FormPanel({
		labelWidth: 75,
		//frame: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px 5px 0;',
		width: 300,
		border: false,
		defaults: {width: 225},
		defaultType: 'datefield',
		items: [{
			fieldLabel: $zr.getString ("Date"),
			allowBlank: false,
			msgTarget: 'side',
			value: options.value || common.currentDate (),
			minValue: options.minValue,
			maxValue: options.maxValue,
			format: "d.m.Y",
			name: 'dt',
			id: 'dt'
		}]
	});
	var scope = options.scope || this;
	var win = new Ext.Window ({
		title: options.title,
		closable: true,
		modal: true,
		width: 300,
		height: 120,
		layout: 'fit',
		items: [
			dp
		],
		buttons: [
			{
				text: 'Ok',
				iconCls: "ok",
				formBind: true,
				handler: function () {
					var d = dp.items.items [0].getValue ();
					win.close ();
					options.success.call (scope, {date: d});
				}
			}, {
				code: 'cancel',
				formBind: false,
				handler: function () {
					win.close ();
				}
			}
		]
	});	
	win.show ();    
}
//
//  Диалог получения строки
//
// options: {title, success, scope, fieldLabel, value}
dialog.getString = function (options) {
	var title = options.title || $ptitle;
	var success = options.success;
	var failure = options.failure;
	var scope = options.scope || this;
	var value = options.value;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			if (failure) {
				failure.call (scope);
			}
			win.close ();
		}
	});
	var fieldName = new Ext.form.TextField ({
		selectOnFocus: true,
		fieldLabel: options.fieldLabel || 'Введите строку',
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		value: value,
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px;',
		layout: 'form',
		items: [
			fieldName
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 450,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus ();
	});
};
//
//  Диалог получения числа
//
// options: {title, success, scope, fieldLabel}
dialog.getNumber = function (options) {
	var title = options.title || $ptitle;
	var success = options.success;
	var failure = options.failure;
	var scope = options.scope || this;
	var okBtn = new Ext.Button ({
		code: 'Ok',
		formBind: true,
		scope: this,
		handler: function () {
			success.call (scope, fieldName.getValue ());
			win.close ();
		}
	});
	var cancelBtn = new Ext.Button ({
		code: 'Cancel',
		scope: this,
		handler: function () {
			if (failure) {
				failure.call (scope);
			}
			win.close ();
		}
	});
	var fieldName = new Ext.form.NumberField ({
		selectOnFocus: true,
		fieldLabel: options.fieldLabel || 'Введите число',
		allowBlank: false,
		msgTarget: 'side',
		anchor: '95%',
		listeners: {
			render: function () {
				fieldName.focus (false, 200);
			},
			specialkey: function (object, event) {
				if (event.getKey () == event.ENTER && !okBtn.disabled) {
					success.call (scope, fieldName.getValue ());
					win.close ();
				}
			},
			scope: this
		}
	});
	var form = new Ext.FormPanel({
		frame: false,
		border: false,
		defaultType: 'textfield',
		monitorValid: true,
		buttonAlign: 'right',
		autoScroll: true,
		bodyStyle: 'background-color: ' + $zu.getThemeBGColor () + '; padding: 5px;',
		layout: 'form',
		items: [
			fieldName
		],
		buttons: [
			okBtn,
			cancelBtn
		]
	});
    var win = new Ext.Window ({
		width: 450,
		height: 150,
        layout: 'fit',
        modal: true,
        title: title,
		items: [
			form
		]
	});
	win.show (null, function () {
		fieldName.focus ();
	});
};
// Лист
$report.sheet = function (options) {
	options = options || {};
	this.name = options.name || 'Sheet';
	this.orientation = options.orientation || 'portrait';
	this.scale = options.scale || '100';
	this.margins = options.margins || {left: 15, top: 15, right: 15, bottom: 15};
	this.rows = options.rows || [];
	this.validation = options.validation || [];
	this.namedRange = options.namedRange || [];
	this.columns = options.columns || {};
	this.ell = options.ell || {};
	this.autoFitHeight = options.autoFitHeight;
};
// Строка
$report.row = function (options) {
	options = options || {};
	this.height = options.height || 12.75;
	this.cells = options.cells || [];
	this.startIndex = options.startIndex || 0;
};
// Отчет в формате XMLSS
$report.xmlss = function (options) {
	// Параметры
	/*  
	{
		autoFitHeight: true,
		orientation: "landscape",
		margins: {
			left: 31,
			top: 32,
			right: 33,
			bottom: 34
		}
	}
	*/
	this.params = {};
	// Стили
	/*
	{
		"sMy": "hAlign:Center,vAlign:Center,borders:All,bgColor:LightCoral"
	}
	hAlign, vAlign: Left Right Top Bottom Center
	rotate: 90
	wrap: true
	bold: true
	numberFormat: #,##0.000
	borders: All,Left,Top,Right,Bottom,AllDash
	*/
	this.styles = {
		'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
		'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
		'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
		'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
		'border': 'hAlign:Left,vAlign:Top,wrap:true,fontSize:9,borders:All',
		'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
		'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
		'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
		'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
		'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
		'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
		'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
	};
	// Колонки
	/*
	{
		"0": {width: 20},
		"2": {width: 20}		
	}
	*/
	this.columns = {};
	// Строки
	/*
	report.rows.push (new $report.row ({height: 30, cells: [{
		text: "cell1_1", style: "sBold", colspan: 1, rowspan: 1, index: 10
	}, {
		text: "cell1_2", style: "sBorder"
	}]}));	
	*/
	this.rows = [];
	/*
		Многостраничный отчет
		В этом режиме rows находится в sheet
	*/
	this.sheets = [];
	// Нормализация объектов
	this.normalize = function (options) {
		if (Ext.isArray (this.columns)) {
			var o = {};
			for (var i = 0; i < this.columns.length; i ++) {
				o [i + 1] = {width: this.columns [i]};
			};
			this.columns = o;
		};
		if (!this.rows || !this.rows.length) {
			this.rows = [{cells: [{text: ""}]}];
		};
		for (var i = 0; i < this.rows.length; i ++) {
			var row = this.rows [i];
			row.height = row.height || 12.75;
			row.cells = row.cells || [];
			for (var j = 0; j < row.cells.length; j ++) {
				if (typeof (row.cells [j].text) == "number") {
					row.cells [j].text = String (row.cells [j].text);
				};
			};
			row.startIndex = row.startIndex || 0;
		};
		for (var k = 0; k < this.sheets.length; k ++) {
			var sheet = this.sheets [k];
			if (Ext.isArray (sheet.columns)) {
				var o = {};
				for (var i = 0; i < sheet.columns.length; i ++) {
					o [i + 1] = {width: sheet.columns [i]};
				};
				sheet.columns = o;
			};
			sheet.rows = sheet.rows || [];
			for (var i = 0; i < sheet.rows.length; i ++) {
				var row = sheet.rows [i];
				row.height = row.height || 12.75;
				row.cells = row.cells || [];
				for (var j = 0; j < row.cells.length; j ++) {
					var t = row.cells [j].text;
					if (typeof (t) == "number") {
						row.cells [j].text = String (row.cells [j].text);
					};
					if (typeof (t) == "string") {
						if (t == "null") {
							row.cells [j].text = "";
						} else {
							row.cells [j].text = t.split ("<").join ("&lt;").split (">").join ("&gt;");
						};
					};
					if (options && options.showNull && (t == null || t == "" || t == "null")) {
						row.cells [j].text = "null";
					};
					row.cells [j].style = row.cells [j].style || "default";
				};
				row.startIndex = row.startIndex || 0;
			};
			if (!sheet.rows.length) {
				sheet.rows = [{startIndex: 0, height: 12.75, cells: [{text: "", style: "default"}]}];
			};
		};
	};
	this.preview = function (options) {
		var me = this;
		options = options || {};
		me.title = options.title;
		var win = new Ext.Window ({
			title: "Предварительный просмотр",
			resizable: true,
			closable: true,
			maximizable: true,
			modal: true,
			width: 1000,
			height: 600,
			border: false,
			iconCls: "gi_print",
			layout: "fit",
			items: {
				html: me.createHTML ({generate: 1}),
				autoScroll: true
			},
			buttons: [{
				text: "Печать",
				iconCls: "gi_print",
				handler: function () {
					me.create ();
				}
			}]
		});
		win.show ();
	};
	// Создание отчета
	this.create = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xmlss&custom=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	this.createXLSX = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xlsx";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	this.createCSV = function (options) {
		this.normalize (options);
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=xlsx&convert_csv=1&win1251=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	// Создание PDF отчета
	this.createPDF = function (options) {
		this.normalize ();
		var uri = 'pdf?sessionId=' + $sessionId;
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' target='_blank' action='" + uri + "'>" +
			"<textarea style='display: none' name='params'>" + JSON.stringify (this.params) + "</textarea>" +
			"<textarea style='display: none' name='styles'>" + JSON.stringify (this.styles) + "</textarea>" +
			"<textarea style='display: none' name='columns'>" + JSON.stringify (this.columns) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"<textarea style='display: none' name='sheets'>" + JSON.stringify (this.sheets) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};
	// Создание HTML отчета в новом окне
	this.createHTML = function (options) {
		this.normalize ();
		options = options || {};
		var rows = options.rows || this.rows;
		if (this.sheets.length) {
			rows = this.sheets [0].rows;
		};
		var w;
		if (options.generate) {
			w = {
				document: {
					open: function () {
					},
					close: function () {
					},
					html: "",
					write: function (s) {
						this.html += s;
					}
				}
			};
		} else {
			w = window.open ("", "window1", "width=800, height=600, resizable=yes, scrollbars=yes, status=yes, top=10, left=10");
		};
		w.document.open ();
		if (options.title) {
			w.document.write ("<p><b>" + options.title + "</b></p>");
		};
		w.document.write (
			"<style type='text/css'>\n" +
			"* {\n" +
			"   font-family: Tahoma;\n" +
			"   font-size: 8pt;\n" +
			"}\n" +
			"table {\n" +
			"	border-left: 0px;\n" +
			"	border-top: 0px;\n" +
			"	border-right: 1px solid #BBBBBB;\n" +
			"	border-bottom: 1px solid #BBBBBB;\n" +
			"}\n" +
			"tr {\n" +
			"	border: 0px;\n" +
			"}\n" +
			"td {\n" +
			"	border-left: 1px solid #BBBBBB;\n" +
			"	border-top: 1px solid #BBBBBB;\n" +
			"	border-right: 0px;\n" +
			"	border-bottom: 0px;\n" +
			"}\n" +
			".tb-text {\n" +
			"	text-align: left;\n" +
			"	padding: 5px;\n" +
			"}\n" +
			".tb-header {\n" +
			"	padding: 5px;\n" +
			"	font-weight: bold;\n" +
			"	background: #DDDDDD;\n" +
			"}\n" +
			".tb-title {\n" +
			"	padding: 5px;\n" +
			"	padding-left: 20px !important;\n" +
			"	background: #DDEEFF;\n" +
			"}\n" +
			"</style>\n"
		);
		w.document.write ('<table cellpadding=0 cellspacing=0>');
		for (var i = 0; i < rows.length; i ++) {
			var row = rows [i];
			var cells = row.cells;
			var r = "<tr>";
			for (var j = 0; j < cells.length; j ++) {
				var cell = cells [j];
				var v = cell.text;
				if (v === undefined || v === null || v === "") {
					v = "<img width=1 height=1>";
				};
				cell.style = cell.style || "";
				if (cell.style.indexOf ("bold") > -1) {
					v = "<b>" + v + "</b>";
				};
				if (cell.style == "border_gray") {
					v = "<font color='gray'>" + v + "</font>";
				};
				var bgcolor = "";
				if (cell.style == "border_bg_gray") {
					bgcolor = "bgcolor='#DDDDDD'";
				};
				if (cell.style == "border_bg_red") {
					bgcolor = "bgcolor='#ff9999'";
				};
				if (cell.style == "border_bg_green") {
					bgcolor = "bgcolor='#99ff99'";
				};
				if (cell.style == "border_bg_blue") {
					bgcolor = "bgcolor='#9999ff'";
				};
				r += "<td class='tb-text' colspan=" + cell.colspan + " rowspan=" + cell.rowspan + " " + bgcolor + ">" + v + "</td>";
			};
			r += "</tr>";
			w.document.write (r);
		};
		w.document.write ('</table>');
		w.document.close ();    
		if (options.generate) {
			return w.document.html;
		};
	};
};
/*
	DBF.field
	{
		name // <= 11
		type // 'C','N','L','D','M'
		size; // длина строки или числа в строковом виде
		dec; // число знаков после запятой
	}
*/
$dbf.field = function (options) {
	this.name = options.name;
	this.type = options.type;
    if (options.type == 'D') {
        this.size = 8;
    } else {
		this.size = options.size || 0;
	};
	this.dec = options.dec || 0;
};
/*
	DBF
*/
$dbf.file = function (options) {
	options = options || {};
	this.options = {
		filename: "data.dbf",
		coding: options.coding || "WIN" // ["WIN", "DOS"]
	};
	/*
		Поля
	*/
	this.fields = options.fields || [];
	/*
		Данные
		[{
			name: value, ...
		}]
	*/
	this.rows = options.rows || [];
	// Создание отчета
	this.create = function (options) {
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $zp.currentUser + "&format=dbf&custom=1&filename=" + this.options.filename;
		for (var i = 0; i < this.rows.length; i ++) {
			var row = this.rows [i];
			for (var field in row) {
				row [field] = String (row [field]);
			};
		};
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + uri + "'>" +
			"<textarea style='display: none' name='options'>" + JSON.stringify (this.options) + "</textarea>" +
			"<textarea style='display: none' name='fields'>" + JSON.stringify (this.fields) + "</textarea>" +
			"<textarea style='display: none' name='rows'>" + JSON.stringify (this.rows) + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};	
};
/*
	CSV
*/
$csv.file = function (options) {
	options = options || {};
	this.body = options.body || "";
	// Создание отчета
	this.create = function (options) {
		var uri = 'report?sessionId=' + $sessionId + "&username=" + $o.currentUser + "&format=xmlss&custom=1&csv=1";
		document.getElementById ('loading').innerHTML = 
			"<form name='form_report' method='post' action='" + uri + "'>" +
			"<textarea style='display: none' name='body'>" + this.body + "</textarea>" +
			"</form>"
		;
		document.forms ['form_report'].submit ();
	};	
};
String.prototype.fulltrim = function () {
	return this.replace (/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace (/\s+/g,' ');
};
common.isEmail = function (email) {
	var emailReg = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return emailReg.test (email);
};
Ext.example = function () {
    function createBox (t, s) {
        return [
			'<div class="msg">',
			'<div class="x-box-tl"><div class="x-box-tr"><div class="x-box-tc"></div></div></div>',
			'<div class="x-box-ml"><div class="x-box-mr"><div class="x-box-mc"><h3>', t, '</h3>', s, '</div></div></div>',
			'<div class="x-box-bl"><div class="x-box-br"><div class="x-box-bc"></div></div></div>',
			'</div>'
		].join ("");
    };
    return {
        msg: function (title, msg, el) {
			var msgCt = Ext.DomHelper.insertFirst (el || document.body, {id:'msg-div'}, true);
            //msgCt.alignTo (el || document, 't');
            var m = Ext.DomHelper.append (msgCt, {html: createBox (title, msg)}, true);
            m.slideIn ('t').pause (500).ghost ("t", {remove: true});
        },
        init: function () {
            var lb = Ext.get ('lib-bar');
            if (lb) {
                lb.show();
            };
        }
    };
}();
common.balloon = function (t, m) {
	Ext.example.msg (t, m);
};
common.rowLinks = function (value, metaData, record, rowIndex, colIndex, store, args) {
	if (metaData.id == (args.fieldName || "name") || (metaData.column && metaData.column.dataIndex == (args.fieldName || "name"))) {
		value = value || args.nullText || 'Без названия';
		args.id = record.data [args.fieldId || "id"];
		value = "<a href='#' onclick='" + args.fn + '.call (Ext.getCmp ("' + this.id + '"), ' + JSON.stringify (args) + ")'>" + value + "</a>";
	};
	return value;
};
/*
	Округляет до n знаков после запятой
*/
common.round = function (d, n) {
	if (!d) {
		return d;
	};
	var nn;
	switch (n) {
	case null:
	case undefined:
	case 0:
		nn = 1;
		break;
	case 1:
		nn = 10;
		break;
	case 2:
		nn = 100;
		break;
	case 3:
		nn = 1000;
		break;
	case 4:
		nn = 10000;
		break;
	default:
		throw "common.round - invalid n: " + n;
	};
	var r = Math.round (d * nn) / nn;
	return r;
};
common.isNumber = function (n) {
  return !isNaN (parseFloat (n)) && isFinite (n);
};
common.sqlArray = function (a) {
	var r = [];
	for (var i = 0; i < a.length; i ++) {
		if (i) {
			r.push (",");
		};
		r.push (a [i]);
	};
	return r;
};
common.extMajorVersion = function () {
	var v = Ext.version || Ext.getVersion ().version;
	return v.split (".")[0];
};
common.isEmail = function (email) {
	var emailReg = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
	return emailReg.test (email);
};
common.unicode = {
	escape: function (s) {
		if (!s) {
			return s;
		};
		return s.replace (/^[-~]|\\/g, function (m) {
			var code = m.charCodeAt (0);
			return '\\u' + ((code < 0x10) ? '000' : ((code < 0x100) ? '00' : ((code < 0x1000) ? '0' : ''))) + code.toString (16);
		});
	},
	unescape: function (s) {
		if (!s) {
			return s;
		};
		return s.replace (/\\u([a-fA-F0-9]{4})/g, function (matched, g1) {
			return String.fromCharCode (parseInt (g1, 16))
		})
	}
};
common.addRecord = function (options) {
	var store = options.store;
	var data = options.data;
	var map = options.map;
	if (!store || !data || !map) {
		return data;
	};
	function getValue (data, path) {
		var tokens = path.split (".");
		var val = data [tokens [0]];
		for (var i = 1; i < tokens.length; i ++) {
			var o = $o.getObject (val);
			if (!o) {
				val = null;
				break;
			};
			val = o.get (tokens [i]);
		};
		return val;
	};
	for (var attr in map) {
		data [attr] = getValue (data, map [attr]);
	};
	var cmp = options.cmp;
	if (cmp.getXType ().indexOf ("tree") > -1) {
		var sm = cmp.getSelectionModel ();
		var node;
		if (sm.hasSelection ()) {
            node = sm.getSelection ()[0];
            node.set ("leaf", false);
        } else {
            node = cmp.getStore ().getRootNode ();
        };
        //node.expand ();
        data.leaf = true;
        node.appendChild (data);
	} else {
		store.add (data);
	};
	return data;
};
common.updateRecord = function (options) {
	var record = options.record;
	var map = options.map;
	if (!record || !map) {
		return record;
	};
	function getValue (record, path) {
		var tokens = path.split (".");
		var val = record.get (tokens [0]);
		for (var i = 1; i < tokens.length; i ++) {
			var o = $o.getObject (val);
			if (!o) {
				val = undefined;
				break;
			};
			val = o.get (tokens [i]);
		};
		return val;
	};
	for (var attr in map) {
		var v = getValue (record, map [attr]);
		if (v !== undefined) {
			record.set (attr, v);
		}
	};
	record.commit ();
	return record;
};
common.tpl.remove = function (options) {
	options = options || {};
	var me = this;
	common.confirm ({message: "Вы уверены?", fn: function (btn) {
		if (btn == "yes") {
			var id = options.id || me.getValue ("a_id") || me.getValue ("id");
			if (id) {
				$o.startTransaction ({description: "Remove " + id});
				var o = $o.getObject (id);
				o.remove ();
				o.commit ();
				$o.commitTransaction ();
				if (me.getSelectionModel) {
					var record = me.getSelectionModel ().getSelection ()[0];
					if (me.getXType ().indexOf ("tree") > -1) {
	                    var parentNode = record.parentNode;
						record.remove ();
						if (parentNode != me.getStore ().getRootNode () && !parentNode.childNodes.length) {
							parentNode.set ("leaf", true);
						};
					} else {
						me.getStore ().remove (record);
					};
				};
			};
		};
	}});
};
common.tpl.show = function (options) {
	var me = this;
	options = options || {};
	options.id = options.id || this.getValue ("a_id") || this.getValue ("id");
	var refresh = options.refresh;
	var fn = options.card;
	if (fn) {
		fn = typeof (fn) == "string" ? eval (fn) : fn;
	};
	var layout = options.layout;
	options.title = options.title || "";
	if (options.id) {
		var o = $s.getObject (options.id);
		options.title = o.get ("name") || "ID: " + (options.id < 0 ? "Добавление" : options.id);
	};
	var map = options.map || me.map || {};
	var sql = eval ("(" + me.$view.get ("query") + ")");
	// tree: {a: "id", b: "id.type", c: "id.type.vid"} <- select a.name, b.name from subject.org a left join spr.org.type b on (b.id = a.type) left join spr.org.vid c on (c.id = b.vid)
	var getTree = function (from) {
		var tree = {};
		var a; for (a in from [0]) {break;};
		tree [a] = me.$view.attrs ["a_id"] ? "a_id" : "id";
		function process (b) {
			for (var i = 2; i < from.length; i += 4) {
				var e; for (e in from [i]) {break;};
				if (tree [e]) {
					continue;
				};
				var c = from [i + 2];
				for (var j = 0; j < c.length; j ++) {
					if (typeof (c [j]) == "object") {
						var d; for (d in c [j]) {break;};
						if (d == b && 
							c [j][d] != "id" // обратные ссылки не получится
						) {
							tree [e] = tree [b] + "." + c [j][d];
							process (e);
						};
					};
				};
			};
		};
		process (a);
		return tree;
	};
	var tree = getTree (sql.from);
	for (var i = 1; i < sql.select.length; i ++) {
		if (typeof (sql.select [i]) == "string") {
			for (var j = 0; j < me.columns.length; j ++) {
				if (me.columns [j].dataIndex == sql.select [i]) {
					var a; for (a in sql.select [i - 1]) {break;};
					map [sql.select [i]] = map [sql.select [i]] || (tree [a] + "." + sql.select [i - 1][a]);
				};
			};
		};
	};
	layout = layout || fn.call (this, options);
	if (options.readOnly) {
		common.makeReadOnlyLayout (layout);
	};
	var items = {
		id: "o" + options.id,
		objectId: options.id,
		name: "viewContainer",
		xtype: "$o.layout",
		opener: me,
		title: options.title,
		$layout: layout,
		listeners: {
			destroy: function () {
				var o = $s.getObject (options.id);
				if (o.get ("id") != options.id) {
					var record = common.addRecord ({
						cmp: me,
						store: me.getStore (), 
						data: me.$view.attrs ["a_id"] ? {
							"a_id": o.get ("id")
						} : {
							"id": o.get ("id")
						},
						map: map
					});
					if (me.getXType ().indexOf ("tree") == -1) {
						me.getSelectionModel ().deselectAll ();
						me.getSelectionModel ().select (me.getStore ().getCount () - 1);
					};
				} else {
					var record = me.getSelectionModel ().getSelection ()[0];
					if (!record) {
	                    var store = me.getStore ();
	                    var sm = me.getSelectionModel ();
	                    record = store.getById (options.id);
	                    if (record) {
	                    	sm.select (record);
	                    }
					}
					common.updateRecord ({
						cmp: me,
						record: record,
						map: map
					});
				};
				if (refresh && typeof (me.refresh) == "function") {
					me.refresh ();
				};
			}
		}
	};
	if (options.asWindow) {
		items.title = undefined;
		var win = Ext.create ("Ext.window.Window", {
			title: options.title,
			resizable: true,
			closable: true,
			width: options.width || 800,
			height: options.height || 600,
			layout: "fit",
			modal: true,
			items: items
		});
		win.show ();
	} else {
		$o.app.show ({items: items});
	};
};
common.tpl.getViewObjectId = function () {
	var id = 0;
	var vc = this.up ("*[name=viewContainer]");
	if (vc) {
	    id = vc.objectId;
	};
	return id;
};
common.tpl.getOpener = function () {
	var vc = this.up ("*[name=viewContainer]");
	if (vc) {
	    return vc.opener;
	};
};
common.tpl.create = function (options) {
	var me = this;
	var o = $s.createObject (options.classCode, "local");
	if (options.attrs) {
		for (var attr in options.attrs) {
			var v = options.attrs [attr];
            if (Object.prototype.toString.apply (v) === "[object Array]") {
            	v = me.relatives [v [0]].getValue (v [1]);
            };
            o.set (attr, v);
		};
	};
	if (me.getXType ().indexOf ("tree") > -1) {
		o.set (me.fields.parent, me.getValue (me.fields.id));
	};
	options.id = o.get ("id");
	if (options.fn) {
		var fn = typeof (options.fn) == "string" ? eval (options.fn) : options.fn;
		fn.call (me, o, options);
	};
	if (!options.layout) {
		options.card = options.card || (options.classCode + ".card");
	};
    common.tpl.show.call (this, options);
};
// Заполняет шаблон аргументами или значениями объектов
common.tpl.updateTags = function (r, args) {
	if (!r) {
		return r;
	};
	var tags = [];
	var isObject = 0;
	if (typeof (r) == "object") {
		r = JSON.stringify (r);
		isObject = 1;
	};
	for (var i = 1; i < r.length; i ++) {
		if ((r [i] == "$" || r [i] == "#") && r [i - 1] == "[") {
			var tag = "";
			for (; i < r.length; i ++) {
				if (r [i] == "]") {
					break;
				} else {
					tag += r [i];
				};
			};
			if (tags.indexOf (tag) == -1) {
				tags.push (tag);
			};
		};
	};
	for (var i = 0; i < tags.length; i ++) {
		var result;
		if (tags [i][0] == "$") {
			result = common.getValue (args, tags [i]);
		} else {
			result = args [tags [i].substr (1)];
		};
		r = r.split ("[" + tags [i] + "]").join (result);
	};
	if (isObject) {
		r = JSON.parse (r);
	};
	return r;
};
dialog.getClass = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: "Выберите класс",
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.classes",
			name: "classes"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olap]");
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: "Выбрать",
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
// {hasQuery, success}
dialog.getView = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: "Выберите " + (options.hasQuery ? "запрос" : "представление"),
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.views",
			name: "views"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olap]");
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: "Выбрать",
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id && (!options.hasQuery || (options.hasQuery && $o.getView (id).get ("query")))) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
dialog.getAction = function (options) {
	var success = options.success;
	var win = Ext.create ("Ext.Window", {
		title: "Выберите действие",
		width: 900,
		height: 700,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		items: {
			xtype: "$o.classes",
			name: "classes"
		},
		listeners: {
			afterrender: function () {
				var olap = win.down ("*[zid=olapActions]");
				olap.up ("tabpanel").setActiveTab (2);
				var id;
				var btnChoose = Ext.create ("Ext.Button", {
					text: "Выбрать",
					iconCls: "ok",
					disabled: true,
					handler: function () {
						success ({id: id});
						win.close ();
					}
				});
				olap.selModel.on ('selectionchange', function () {
					id = olap.getCurrentValue ("id");
					if (id) {
						btnChoose.setDisabled (false);
					} else {
						btnChoose.setDisabled (true);
					};
				}, this);
				if (olap.lconfig && olap.lconfig.listeners && olap.lconfig.listeners.dblclick) {
					delete olap.lconfig.listeners.dblclick;
				};
				olap.on ("itemdblclick", function () {
					btnChoose.handler ();
				});
				var tbar = olap.down ("toolbar[dock=top]");
				tbar.insert (0, [btnChoose]);
				tbar.doLayout ();
			}
		}
	});
	win.show ();
};
common.report.show = function (options) {
	var o = $o.getObject (options.id);
	var success = options.success;
	var value = o.get ("options") ? JSON.parse (o.get ("options")) : null;
	var win = Ext.create ("Ext.Window", {
		title: "Отчет",
		iconCls: "gi_print",
		width: 800,
		height: 600,
		layout: "fit",
		frame: false,
		border: false,
		bodyPadding: 1,
		modal: true,
		maximizable: true,
		tbar: [{
			text: "Сохранить",
			iconCls: "save",
			handler: function () {
				var rd = win.down ("*[name=reportdesigner]");
				var v = rd.getValue ();
				if (!v.code) {
					common.message ("Введите код отчета.");
					return;
				};
				$o.startTransaction ();
				o.set ("name", v.name);
				o.set ("code", v.code);
				o.set ("options", JSON.stringify (v));
				o.sync ("local");
				$o.commitTransaction ();
				if (success) {
					success ({id: o.get ("id")});
				};
			}
		}, {
			text: "Предварительный просмотр",
			iconCls: "gi_search",
			handler: function () {
				var value = JSON.parse (o.get ("options"));
				var rd = Ext.create ("$o.ReportDesigner.Widget", {
					value: value
				});
				rd.build ({html: 1});
			}
		}],
		items: {
			xtype: "$o.reportdesigner",
			name: "reportdesigner",
			value: value
		}
	});
	win.show ();
};
common.report.build = function (options) {
	var code = options.code;
	var r = $o.execute ({
		select: [
			{"a": "id"}, "id"
		],
		from: [
			{"a": "system.vo.report"}
		],
		where: [
			{"a": "code"}, "=", code
		]
	});
	if (!r.length) {
		common.message ("Отчет '" + code + "' отсутствует.");
		return;
	};
	var o = $o.getObject (r.get (0, "id"));
	var value = JSON.parse (o.get ("options"));
	var rd = Ext.create ("$o.ReportDesigner.Widget", {
		value: value
	});
	rd.build (options);
};
common.merge = function (json1, json2) {
    var out = {};
    for (var k1 in json1) {
        if (json1.hasOwnProperty (k1)) out[k1] = json1 [k1];
    };
    for (var k2 in json2) {
        if (json2.hasOwnProperty (k2)) {
            if (!out.hasOwnProperty (k2)) out [k2] = json2 [k2];
            else if (
                (typeof out [k2] === 'object') && (out [k2].constructor === Object) && 
                (typeof json2 [k2] === 'object') && (json2 [k2].constructor === Object)
            ) out [k2] = common.merge (out [k2], json2 [k2]);
        }
    }
    return out;
};
common.makeReadOnlyLayout = function (layout) {
	function go (l) {
	    for (var key in l) {
	        if (typeof (l [key]) == "object") {
		        if (key == "actions" && Ext.isArray (l [key])) {
		            for (var i = l [key].length - 1; i >= 0; i --) {
		                if (["Открыть"].indexOf (l [key][i].text) > -1 || ["open"].indexOf (l [key][i].caption) > -1) {
		                    l [key][i].arguments = l [key][i].arguments || {};
		                    l [key][i].arguments.readOnly = true;
		                } else
		                if (["Добавить", "Удалить"].indexOf (l [key][i].text) > -1 || ["create", "delete"].indexOf (l [key][i].caption) > -1) {
		                    l [key][i].active = function () {return false;};
		                } else {
		                    l [key][i].arguments = l [key][i].arguments || {};
		                    l [key][i].arguments.readOnly = true;
		                }
		            };
		        } else
		        if (key == "listeners" && l.listeners.dblclick) {
		        	delete l.listeners.dblclick;
		        } else
	        	if (key == "card") {
	        		l [key].readOnly = true;
	        	} else {
	            	go (l [key]);
	            };
	        };
	    };
	};
	if (typeof (layout) == "string") {
		layout = eval ("(" + layout + ")");
	};
	go (layout);
	return layout;
};
/*
	1000000 -> 1 000 000
*/
common.setThousandSeparator = function (v) {
	var me = this;
	var s = String (v), r = [];
	for (var i = 0; i < s.length % 3; i ++) {
		s = " " + s;
	}
	for (var i = 0; i < s.length; i += 3) {
		r.push (s.substr (i, 3));
	}
	return r.join (" ");
}
common.findObject = function (obj, keyObj) {
    var p, key, val, tRet;
    for (p in keyObj) {
        if (keyObj.hasOwnProperty (p)) {
            key = p;
            val = keyObj [p];
        }
    }
    for (p in obj) {
        if (p == key) {
            if (obj [p] == val) {
                return obj;
            }
        } else if (obj[p] instanceof Object) {
            if (obj.hasOwnProperty (p)) {
                tRet = common.findObject (obj [p], keyObj);
                if (tRet) {
                	return tRet;
                }
            }
        }
    }
    return false;
}
common.findMenuItem = function (m, opts) {
	var items = m.items;
	for (var i = 0; i < items.getCount (); i ++) {
		var item = items.getAt (i);
		var equal = true;
		_.each (opts, function (v, a) {
			if (v != item [a]) {
				equal = false;
			}
		});
		if (equal) {
			return item;
		}
		if (item.menu) {
			item = common.findMenuItem (item.menu, opts);
			if (item) {
				return item;
			}
		}
	}
}
common.updateMenuItemText = function (m, opts, text) {
	var item = common.findMenuItem (m, opts);
	if (item && item.setText) {
		item.setText (text);
	}
}
/*
	Строит отчет по шаблону
		format: "xmlss",
		template: "school-enter.xml"
			или
		template: fileField.objectId + "-" + fileField.ca.get ("id") + "-" + fileField.getValue ()
		files: true;
*/
common.reportTpl = function (opts) {
	if (opts.method == "post") {
		var reportUri =
			"report?storage=" + $o.code + "&" +
			"sessionId=" + $sessionId + "&" +
			"username=" + $o.currentUser + "&" +
			"time_offset_min=" + (new Date ()).getTimezoneOffset () + "&" +
			"format=" + opts.format + "&" +
			"template=" + opts.template
		;
		if (opts.files) {
			reportUri += "&files=" + opts.files;
		}
		var mapForm = document.createElement ("form");
	    mapForm.target = "Map";
	    mapForm.method = "POST";
	    mapForm.action = reportUri;

	    var mapInput = document.createElement ("input");
	    mapInput.type = "text";
	    mapInput.name = "opts";
	    mapInput.value = JSON.stringify (opts);
	    mapForm.appendChild (mapInput);

	    document.body.appendChild (mapForm);

	    map = window.open ("", "Map");
	    mapForm.submit ();
	} else {
		var reportUri = "report?";			
		var key;
		_.each (opts, function (v, a) {
			reportUri += a + "=" + v + "&";
		});
		reportUri +=
			"storage=" + $o.code + "&" +
			"sessionId=" + $sessionId + "&" +
			"username=" + $o.currentUser + "&" +
			"time_offset_min=" + (new Date ()).getTimezoneOffset ()
		;
		var w = window.open (reportUri);
		w.focus ();
	}
}
common.serverJob = function (opts) {
	opts = typeof (opts) == "string" ? {fn: opts} : opts;
	$o.execute ({fn: "service.job", args: opts, success: function (opts) {
		window.open ("/projects/" + $o.id + "/resources/html/" + opts.logFile, opts.logFile);
	}});
}