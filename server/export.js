/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
"use strict"
global.ifields = {
	tclass: ["fid", "fparent_id", "fname", "fcode", "fdescription", "fformat", "fview_id", "ftype", "fsystem", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tclass_attr: ["fid", "fclass_id", "fname", "fcode", "ftype_id", "forder", "fnot_null", "fvalid_func", "fformat_func", "fdescription", "fsecure", "fmax_str", "fmin_str", "fmax_number", "fmin_number", "fmax_ts", "fmin_ts", "funique", "fformat_number", "fformat_ts", "fremove_rule", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tview: ["fid", "fparent_id", "fname", "fcode", "fdescription", "flayout", "fkey", "fparent_key", "fclass_id", "funrelated", "fquery", "ftype", "fsystem", "fmaterialized", "forder", "fschema_id", "frecord_id", "ficon_cls", "fstart_id", "fend_id"],
	tview_attr: ["fid", "fview_id", "fname", "fcode", "fclass_id", "fclass_attr_id", "fsubject_id", "forder", "fsort_kind", "fsort_order", "foperation", "fvalue", "farea", "fcolumn_width", "ftotal_type", "fread_only", "fgroup", "fnot_null", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	taction: ["fid", "fclass_id", "fname", "fcode", "fdescription", "forder", "fbody", "fconfirm", "flayout", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tobject: ["fid", "fclass_id", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tobject_attr: ["fid", "fobject_id", "fclass_attr_id", "fstring", "fnumber", "ftime", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	trevision: ["fid", "fdate", "fdescription", "fschema_id", "frecord_id"],
	tschema: ["fid", "fparent_id", "fname", "fcode"]
};

global.Export = function () {
	let storage;
	// Здесь собираются данные для экспорта
	this.data = {};
	// id классов для экспорта
	this.classesId = [];
	// id представлений для экспорта
	this.viewsId = [];
	// Исключения (записи которые не надо экспортировать)
	this.except = {};
	// Идентификатор текущей схемы
	this.currentSchemaId = null;
	// Получить коды всех классов верхнего уровня
	this.getTopClassesCodes = function (options) {
		log.info ({cls: "Export", fn: "getTopClassesCodes"});
		let success = options.success;
		storage.query ({sql: 
			"select\n" +
			"	distinct (a.fid) as fid\n" +
			"from\n" +
			"	tclass a\n" +
			"where\n" +
			"	a.fparent_id is null and a.fid >= 1000\n"
		, success: function (options) {
			let r = options.result.rows;
			let result = [];
			for (let i = 0; i < r.length; i ++) {
				result.push (r [i].fid);
			};
			success (result);
		}});
	}
	// Получить коды всех представлений верхнего уровня
	this.getTopViewsCodes = function (options) {
		log.info ({cls: "Export", fn: "getTopViewsCodes"});
		let success = options.success;
		storage.query ({sql: 
			"select\n" +
			"	distinct (a.fid) as fid\n" +
			"from\n" +
			"	tview a\n" +
			"where\n" +
			"	a.fparent_id is null\n"
		, success: function (options) {
			let r = options.result.rows;
			let result = [];
			for (let i = 0; i < r.length; i ++) {
				result.push (r [i].fid);
			};
			success (result);
		}});
	}
	this.getNodesId = function (options) {
		let me = this;
		let result = [];
		let success = options.success;
		let table = options.table;
		async.mapSeries (options.codes, function (code, cb) {
			let id;
			let whereCondition;
			async.series ([
				function (cb) {
					if (String (typeof (code)).toLowerCase () == "number") {
						id = code;
						cb ();
					} else {
						let s = 
							"select\n" +
							"	distinct (a.fid) as fid\n" +
							"from\n" +
							"	" + table + " a\n" +
							"where\n" +
							"	a.fcode='" + code + "' and a.fparent_id is null\n"
						;
						storage.query ({sql: s, success: function (options) {
							id = options.result.rows [0].fid;
							cb ();
						}});
					};
				},
				function (cb) {
					result.push (id);
					// childsId
					storage.query ({sql:
						"select\n" +
						"	distinct (a.fid) as fid\n" +
						"from\n" +
						"	" + table + " a\n" +
						"where\n" +
						"	a.fparent_id=" + id + "\n" +
						"order by a.fid\n"
					, success: function (options) {
						let r = options.result.rows;
						let childsId = [];
						for (let j = 0; j < r.length; j ++) {
							let childId = r [j].fid;
							childsId.push (childId);
						};
						if (childsId.length) {		
							me.getNodesId ({table: table, codes: childsId, success: function (childs) {
								for (let j = 0; j < childs.length; j ++) {
									result.push (childs [j]);				
								};
								cb ();
							}});
						} else {
							cb ();
						};
					}});
				}
			], function (err, results) {
				cb ();
			});
		}, function (err, results) {
			success (result);
		});
	};
	// Экспорт классов
	this.exportClasses = function (options) {
		log.info ({cls: "Export", fn: "exportClasses"});
		let me = this;
		let success = options.success;
		let codes = me.data.options.classes;
		async.series ([
			function (cb) {
				me.getNodesId ({table: "tclass", codes: codes, success: function (result) {
					me.classesId = result;
					cb ();
				}});
			},
			function (cb) {
				if (me.classesId.length) {
					me.data.tclass = [];
					// data
					storage.query ({sql:
						"select\n" +
						"	" + ifields.tclass.join () + "\n" +
						"from\n" +
						"	tclass a\n" +
						"where\n" +
						"	a.fid in (" + me.classesId.join () + ")\n" +
						"order by\n" +
						"	a.fid, a.fstart_id\n"
					, success: function (options) {
						let data = options.result.rows;
						for (let k = 0; k < data.length; k ++) {
							let values = [];
							for (let j = 0; j < ifields.tclass.length; j ++) {
								let field = ifields.tclass [j];
								let value = data [k][field];
								if (field == "fcode" && !value) {
									throw "exportClasses (): fcode must be not null. FID=" + data [k].fid;
								};
								if (field == "fschema_id" && value == null) {
									value = me.currentSchemaId;
								}
								if (field == "frecord_id" && value == null) {
									value = data [k].fid;
								}
								values.push (value);
							};
							let classObject = {};
							classObject.values = values;
							me.data.tclass.push (classObject);
						}
						cb ();
					}});
				}
			}
		], function (err, results) {
			success ();
		});
	};
	// Экспорт атрибутов класса
	this.exportClassAttrs = function (options) {
		let me = this;
		let success = options.success;
		me.data.tclass_attr = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tclass_attr.join () + "\n" +
			"from\n" +
			"	tclass_attr a\n" +
			"where\n" +
			"	a.fclass_id in (" + me.classesId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			let data = options.result.rows;
			for (let i = 0; i < data.length; i ++) {
				let attr = {};
				attr.values = [];
				for (let j = 0; j < ifields.tclass_attr.length; j ++) {
					let field = ifields.tclass_attr [j];
					let value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					attr.values.push (value);
				};
				me.data.tclass_attr.push (attr);
			};
			success ();
		}});
	}
	// Экспорт действий
	this.exportActions = function (options) {
		let me = this;
		let success = options.success;
		me.data.taction = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.taction.join () + "\n" +
			"from\n" +
			"	taction a\n" +
			"where\n" +
			"	a.fclass_id in (" + me.classesId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			let data = options.result.rows;
			for (let i = 0; i < data.length; i ++) {
				let action = {};
				action.values = [];
				for (let j = 0; j < ifields.taction.length; j ++) {
					let field = ifields.taction [j];
					let value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					action.values.push (value);
				};
				let actionId = data [i].fid;
				me.data.taction.push (action);
			};
			success ();
		}});
	}
	// Экспорт объектов
	this.exportObjects = function (options) {
		let me = this;
		let success = options.success;
		me.data.tobject = [];
		let classes = [];
		if (me.except.tobject && me.except.tobject.fclass_id.length) {
			let except = me.except.tobject.fclass_id;
			for (let i = 0; i < me.classesId.length; i ++) {
				if (except.indexOf (me.classesId [i]) == -1) {
					classes.push (me.classesId [i]);
				}
			}
		} else {
			classes = me.classesId;
		}
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tobject.join () + "\n" +
			"from\n" +
			"	tobject a\n" +
			"where\n" +
			"	a.fclass_id in (" + classes.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			let objects = options.result.rows;
			for (let i = 0; i < objects.length; i ++) {
				let object = {};
				object.values = [];
				let classId;
				for (let j = 0; j < ifields.tobject.length; j ++) {
					let field = ifields.tobject [j];
					let value = objects [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = objects [i].fid;
					}
					object.values.push (value);
				};
				me.data.tobject.push (object);
			};
			success ();
		}});
	}
	// Экспорт атрибутов объектов
	this.exportObjectAttrs = function (options) {
		let me = this;
		let success = options.success;
		me.data.tobject_attr = [];
		let classes = [];
		if (me.except.tobject && me.except.tobject.fclass_id.length) {
			let except = me.except.tobject.fclass_id;
			for (let i = 0; i < me.classesId.length; i ++) {
				if (except.indexOf (me.classesId [i]) == -1) {
					classes.push (me.classesId [i]);
				}
			}
		} else {
			classes = me.classesId;
		}
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tobject_attr.join () + "\n" +
			"from\n" +
			"	tobject_attr a\n" +
			"where\n" +
			"	a.fobject_id in (select b.fid from tobject b where b.fclass_id in (" + classes.join () + "))\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			let objectAttrs = options.result.rows;
			for (let i = 0; i < objectAttrs.length; i ++) {
				let objectAttr = {};
				objectAttr.values = [];
				for (let j = 0; j < ifields.tobject_attr.length; j ++) {
					let field = ifields.tobject_attr [j];
					let value = objectAttrs [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = objectAttrs [i].fid;
					}
					objectAttr.values.push (value);
				};
				me.data.tobject_attr.push (objectAttr);
			}
			success ();
		}});
	}
	// Экспорт представлений
	this.exportViews = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Export", fn: "exportViews"});
		let codes = me.data.options.views;
		me.getNodesId ({table: "tview", codes: codes, success: function (result) {
			me.viewsId = result;
			if (me.viewsId.length) {
				me.data.tview = [];
				// data
				storage.query ({sql:
					"select\n" +
					"	" + ifields.tview.join () + "\n" +
					"from\n" +
					"	tview a\n" +
					"where\n" +
					"	a.fid in (" + me.viewsId.join () + ")\n" +
					"order by\n" +
					"	a.fid, a.fstart_id\n"
				, success: function (options) {
					let data = options.result.rows;
					for (let k = 0; k < data.length; k ++) {
						let values = [];
						for (let i = 0; i < ifields.tview.length; i ++) {
							let field = ifields.tview [i];
							let value = data [k][field];
							if (field == "fcode" && !value) {
								throw "exportViews (): fcode must be not null. fid=" + data [k].fid;
							};
							if (field == "fschema_id" && value == null) {
								value = me.currentSchemaId;
							}
							if (field == "frecord_id" && value == null) {
								value = data [k].fid;
							}
							values.push (value);
						};
						let viewObject = {};
						viewObject.values = values;
						me.data.tview.push (viewObject);
					}
					success ();
				}});
			}
		}});
	}
	// Экспорт атрибутов представлений
	this.exportViewAttrs = function (options) {
		let me = this;
		let success = options.success;
		me.data.tview_attr = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tview_attr.join () + "\n" +
			"from\n" +
			"	tview_attr a\n" +
			"where\n" +
			"	a.fview_id in (" + me.viewsId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			let data = options.result.rows;
			for (let i = 0; i < data.length; i ++) {
				let values = [];
				for (let j = 0; j < ifields.tview_attr.length; j ++) {
					let field = ifields.tview_attr [j];
					let value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					values.push (value);
				};
				me.data.tview_attr.push ({values: values});
			}
			success ();
		}});
	}
	// Экспорт ревизий
	this.exportRevisions = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Export", fn: "exportRevisions"});
		storage.query ({sql:
			"select\n" + ifields.trevision.join () + "\n" +
			"from trevision a\n" +
			"order by a.fid\n"
		, success: function (options) {
			let qr = options.result.rows;
			me.data.trevision = [];
			for (let i = 0; i < qr.length; i ++) {
				let values = [];
				for (let j = 0; j < ifields.trevision.length; j ++) {
					let field = ifields.trevision [j];
					let value = qr [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = qr [i].fid;
					}
					values.push (value);
				};
				let revision = {};
				revision.values = values;
				me.data.trevision.push (revision);
			};
			success ();
		}});
	}
	// Экспорт схем
	this.exportSchemas = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Export", fn: "exportSchemas"});
		storage.query ({sql:
			"select\n" + ifields.tschema.join () + "\n" +
			"from tschema a\n" +
			"order by a.fid\n"
		, success: function (options) {
			let qr = options.result.rows;
			me.data.tschema = [];
			for (let i = 0; i < qr.length; i ++) {
				let values = [];
				for (let j = 0; j < ifields.tschema.length; j ++) {
					let field = ifields.tschema [j];
					let value = qr [i][field];
					values.push (value);
				};
				let schema = {};
				schema.values = values;
				me.data.tschema.push (schema);
			}
			success ();
		}});
	}
	// Подготовить переменные для записей, которые не надо экспортировать
	this.prepareExcept = function (options) {
		let me = this;
		let success = options.success;
		let except = me.data.options.except;
		if (!except) {
			success ();
			return;
		};
		let tables = [];
		for (let table in except) {
			tables.push (table);
		};
		async.mapSeries (tables, function (table, cb) {
			let conditions = except [table];
			let classes = [];
			async.mapSeries (conditions, function (condition, cb) {
				if (condition.fclass_id) {
					function addClass (classId, cb) {
						if (classes.indexOf (classId) == -1) {
							classes.push (classId);
						};
						storage.query ({sql:
							"select\n" +
							"	fid\n" +
							"from\n" +
							"	tclass a\n" +
							"where\n" +
							"	a.fparent_id = " + classId + "\n" +
							"order by\n" +
							"	a.fid, a.fstart_id\n"
						, success: function (options) {
							let data = options.result.rows;
							async.mapSeries (data, function (row, cb) {
								addClass (row.fid, function () {
									cb ();
								});
							}, function (err, results) {
								cb ();
							});
						}});
					};
					if (String (typeof (condition.fclass_id)).toLowerCase () == "object" && condition.fclass_id instanceof Array) {
						// fclass_id: [value1, value2, ...]
						async.mapSeries (condition.fclass_id, function (classId, cb) {
							addClass (storage.getClass (classId).get ("fid"), function () {
								cb ();
							});
						}, function (err, results) {
							cb ();
						});
					} else {
						// fclass_id: value
						addClass (storage.getClass (condition.fclass_id).get ("fid"), function () {
							cb ();	
						});
					}
				}
			}, function (err, results) {
				me.except [table] = {};
				me.except [table].fclass_id = classes;
				cb ();
			});
		}, function (err, results) {
			success ();
		});
	}
	// Установить в null поля TOBJECT_ATTR.FTIME < '01.01.1400'
	this.clearBadTimeFields = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Export", fn: "clearBadTimeFields"});
		let s;
		s = "update tobject_attr set ftime=null\n";
		s += "where ftime<'01.01.1400'\n";
		storage.query ({sql: s, success: function (options) {
			success ();
		}});
	}
	// Правка неправильных ссылок на ревизии
	this.fixReferences = function (options) {
		let me = this;
		let success = options.success;
		storage.query ({sql: "select min (fid) as fid from trevision", success: function (options) {
			let rows = options.result.rows;
			if (rows.length > 0) {
				let minRevision = rows [0].fid;
				let sql = [];
				for (let table in ifields) {
					let fields = ifields [table].join ();
					if (fields.indexOf ("fstart_id") == -1) {
						continue;
					}
					sql.push (
						"update " + table + " set fstart_id=" + minRevision + "\n" +
						"where fstart_id not in (select fid from trevision)\n"
					);
					sql.push (
						"update " + table + " set fend_id=" + minRevision + "\n" +
						"where fend_id <> " + storage.maxRevision + " and fend_id not in (select fid from trevision)\n"
					);
				}
				async.mapSeries (sql, function (s, cb) {
					storage.query ({sql: s, success: function (options) {
						cb ();
					}});
				}, function (err, results) {
					success ();
				});
			}
		}});
	}
	// Создание схемы
	this.createSchema = function (options) {
		let result = null;
		let success = options.success;
		let code = options.code;
		storage.query ({sql: "select fid from tschema where fcode='" + code + "'", success: function (options) {
			let qr = options.result.rows;
			if (qr.length == 0) {
				// Добавление записи в tschema
				let nextId = null;
				storage.query ({sql: "select max (fid) as fid from tschema", success: function (options) {
					let qr = options.result.rows;
					if (qr.length) {
						nextId = qr [0].fid + 1;
					};
					if (nextId == null) {
						nextId = 1;
					};
					storage.query ({sql: "insert into tschema (fid, fcode) values (" + nextId + ",'" + code + "')", success: function (options) {
						result = nextId;
						success (result);
					}});
				}});
			} else {
				result = qr [0].fid;
				success (result);
			}
		}});
	};
	// Экспорт в файл
	this.exportToFile = function (options) {
		/* 
			example: exportToFile ({
				code: "storageCode",
				except: {
					tobject: [{
						fclass_id: ["task.common", "spr.task_history"]
					}]
				}, 
				file: "pm.js"
			});
		*/
		let me = this;
		let success = options.success;
		let timeStart = new Date ().getTime ();
		log.info ({cls: "Export", fn: "exportToFile"});
		me.data.options = options;
		async.series ([
			function (cb) {
				if (options.storage) {
					storage = me.storage = options.storage;
					cb ();
				} else {
					projects.loadConfig ({
						code: options.code, success: function () {
							storage = new Storage ({code: options.code, connection: config.storages [options.code], success: function () {
								me.storageCreated = true;
								cb ();
							}});
						}, failure: function (err) {
							cb (err);
						}
					});
				}
			},
			function (cb) {
				if (options.classes == "all") {
					me.getTopClassesCodes ({success: function (result) {
						options.classes = result;
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				if (options.views == "all") {
					me.getTopViewsCodes ({success: function (result) {
						options.views = result;
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				me.data.fields = ifields;
				me.clearBadTimeFields ({success: function () {
					me.fixReferences ({success: function () {
						me.createSchema ({code: options.code, success: function (result) {
							me.currentSchemaId = result;
							cb ();
						}});
					}});
				}});
			},
			function (cb) {
				me.exportClasses ({success: function () {
				me.exportClassAttrs ({success: function () {
				me.exportActions ({success: function () {
				me.prepareExcept ({success: function () {
				me.exportObjects ({success: function () {
				me.exportObjectAttrs ({success: function () {
				me.exportViews ({success: function () {
				me.exportViewAttrs ({success: function () {
				me.exportSchemas ({success: function () {
				me.exportRevisions ({success: function () {
					cb ();
				}}); }}); }}); }}); }}); }}); }}); }}); }}); }});
			},
			function (cb) {
				me.data = common.unescape (me.data);
				if (options.space) {
					fs.writeFile (options.file, JSON.stringify (me.data, 0, options.space), function (err) {
						cb ();
					});
				} else {
					fs.writeFile (options.file, JSON.stringify (me.data), function (err) {
						cb ();
					});
				};
			}
		], function (err, results) {
			let stat = "";
			for (let table in ifields) {
				if (me.data [table]) {
					stat += table + ": " + me.data [table].length + "\n";
				};
			};
			stat += "queryCount: " + storage.queryCount + "\n";
			stat += "duration: " + (new Date ().getTime () - timeStart) / 1000 + " sec.\n";
			log.info ({cls: "Export", stat: stat});
			if (me.storageCreated) {
				storage.freeResources ();
			};
			success ();
		});
	}
}
