﻿/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
"use strict"
global.Import = function () {
	let storage, session;
	// Здесь импортируемые данные
	this.data = {};
	// Добавляет get, чтобы можно было получать значения через названия атрибутов
	this.addGet = function (options) {
		let result = {};
		result.values = options.values;
		result.fields = this.data.fields [options.table];
		result.get = function (field) {			
			for (let i = 0; i < this.fields.length; i ++) {
				if (this.fields [i] == field) {
					break;
				};
			};
			if (i == this.fields.length) {
				throw "get: field '" + field + "'not exists in '" + this.fields.join () + "'";
			};
			return this.values [i];
		};
		return result;
	}
	// Удаляет неактуальные объекты, атрибуты объектов и т.д.
	this.removeTrash = function (options) {
		log.info ({cls: "Import", fn: "removeTrash"});
		let success = options.success;
		async.series ([
			function (cb) {
				// Удалить неактуальные представления
				async.forever (function (cb) {
					// delete
					storage.query ({session: session, sql: 
						"delete from tview a\n" +
						"where\n" +
						storage.getCurrentFilter ({alias: "a"}) + "\n" +
						"and a.fparent_id not in (select b.fid from tview b where " +
						storage.getCurrentFilter ({alias: "b"}) + ")\n"
					, success: function (options) {
						// check
						storage.query ({session: session, sql: 
							"select count (*) as num from tview a\n" +
							"where\n" +
							storage.getCurrentFilter ({alias: "a"}) + "\n" +
							"and a.fparent_id not in (select b.fid from tview b where " +
							storage.getCurrentFilter ({alias: "b"}) + ")\n"
						, success: function (options) {
							let r = options.result.rows;
							if (r [0].num == 0) {
								cb ("end");
							} else {
								cb ();
							};
						}});
					}});
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				// Удалить неактуальные атрибуты представлений
				storage.query ({session: session, sql: 
					"delete from tview_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fview_id not in (select b.fid from tview b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные классы
				async.forever (function (cb) {
					// delete
					storage.query ({session: session, sql: 
						"delete from tclass a\n" +
						"where\n" +
						storage.getCurrentFilter ({alias: "a"}) + "\n" +
						"and a.fparent_id not in (select b.fid from tclass b where " +
						storage.getCurrentFilter ({alias: "b"}) + ")\n"
					, success: function (options) {
						// check
						storage.query ({session: session, sql: 
							"select count (*) as num from tclass a\n" +
							"where\n" +
							storage.getCurrentFilter ({alias: "a"}) + "\n" +
							"and a.fparent_id not in (select b.fid from tclass b where " +
							storage.getCurrentFilter ({alias: "b"}) + ")\n"
						, success: function (options) {
							let r = options.result.rows;
							if (r [0].num == 0) {
								cb ("end");
							} else {
								cb ();
							};
						}});
					}});
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				// Удалить неактуальные атрибуты классов
				storage.query ({session: session, sql: 
					"delete from tclass_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные действия
				storage.query ({session: session, sql: 
					"delete from taction a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные объекты
				storage.query ({session: session, sql: 
					"delete from tobject a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные атрибуты объектов
				storage.query ({session: session, sql: 
					"delete from tobject_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and not exists (select b.fid from tobject b where b.fid=a.fobject_id and " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			}
		], function (err, results) {
			success ();
		});
	};
	// Подготавливает базу для импорта. Удаляет корневые узлы классов, представлений, которые есть в файле импорта
	// Не используется. Нужен в случае если импортируется не схема
	this.prepareStorageForImport = function (options) {
		throw new Error ("prepareStorageForImport not exists");
/*
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "prepareStorageForImport"});
		async.series ([
			function (cb) {
				async.eachSeries (me.data.views, function (view, cb) {
					let view = me.addGet ({values: view.values, table: "tview"});
					let code = view.get ("fcode");
					let parentId = view.get ("fparent_id");
					if (parentId == "") {
						storage.query ({session: session, sql: 
							"delete from tview where fparent_id is null and fcode='" + code + "'"
						, success: function (options) {
							cb ();
						}});
					};
				}, function (err) {
					cb ();
				});
			},			
			function (cb) {
				async.eachSeries (me.data.classes, function (cls, cb) {
					let cls = me.addGet ({values: cls.values, table: "tclass"});
					let code = cls.get ("fcode");
					let parentId = cls.get ("fparent_id");
					if (parentId == "") {
						storage.query ({session: session, sql: 
							"delete from tclass where fparent_id is null and fcode='" + code + "'"
						, success: function (options) {
							cb ();
						}});
					};
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				me.removeTrash ({success: function () {
					cb ();
				}});
			}
		], function (err, results) {
			success ();
		});
*/
	};
	// Счетчики идентификаторов по таблицам
	this.tableId = {};
	// Соответствие schemaId и локальным id
	this.newId = {
		tclass: {}, tclass_attr: {}, tview: {}, tview_attr: {}, taction: {}, taction_attr: {}, tobject: {}, tobject_attr: {}, trevision: {}, tschema: {}
	}
	// Счетчик добавленных записей в таблицах
	this.count = {
		tclass: 0, tclass_attr: 0, tview: 0, tview_attr: 0, taction: 0, taction_attr: 0, tobject: 0, tobject_attr: 0, trevision: 0
	}
	// Тип данных атрибута класса
	this.classAttrType = {};
	// Стартовая ревизия при импорте схемы (обновление схемы)
	this.startRevision = null;
	this.startRevisionMin = null;
	// Получает счетчики по таблицам
	this.getSequences = function (options) {
		let me = this;
		let success = options.success;
		let session = options.session;
		let tables = ["tclass",	"tclass_attr", "tview", "tview_attr", "taction", "taction_attr", "tobject", "tobject_attr", "trevision"];
		async.eachSeries (tables, function (table, cb) {
			storage.client.getNextId ({session: session, table: table, success: function (options) {
				me.tableId [table] = options.id;
				cb ();
			}});
		}, function (err) {
			success ();
		});
	}
	this.updateEngineTables = function (opts, cb) {
		let me = this;
		log.info ({cls: "Import", fn: "updateEngineTables"});
		let session = opts.session;
		let fields = {
			"_class": [
				"fid",
				"fparent_id",
				"fname",
				"fcode",
				"fdescription",
				"fformat",
				"fview_id",
				"fstart_id"
			],
			"_class_attr": [
				"fid",
				"fclass_id",
				//"fclass_code",
				"fname",
				"fcode",
				"fdescription",
				"ftype_id",
				"fnot_null",
				"fsecure",
				"funique",
				"fremove_rule",
				"fstart_id"
			],
			"_view": [
				"fid",
				"fparent_id",
				"fname",
				"fcode",
				"fdescription",
				"flayout",
				"fquery",
				"fstart_id"
			],
			"_object": [
				"fid",
				"fstart_id"
			]
		};
		async.eachSeries (["class", "class_attr", "view", "object"], function (code, cb) {
			async.series ([
				function (cb) {
					storage.query ({session: session, sql: 
						"delete from _" + code
					, success: function (options) {
						cb ();
					}});
				},
				function (cb) {
					let sql =
						"insert into _" + code + " (" + fields ["_" + code].join (",") + ") (\n" +
						"\tselect " + fields ["_" + code].join (",") + " from t" + code + " where fend_id = " + storage.maxRevision + "\n" +
						")\n"
					;
					if (code == "class_attr") {
						sql =
							"insert into _class_attr (" + fields ["_class_attr"].join (",") + ", fclass_code) (\n" +
							"\tselect a." + fields ["_class_attr"].join (",a.") + ",b.fcode from tclass_attr a\n" +
							"\tinner join tclass b on (a.fclass_id = b.fid and b.fend_id = " + storage.maxRevision + ")\n" +
							"\twhere a.fend_id = " + storage.maxRevision + "\n" +
							")\n"
						;
					};
					if (code == "view") {
						let sql =
							"insert into _view (" + fields ["_view"].join (",") + ") (\n" +
							"\tselect " + fields ["_view"].join (",") + " from tview where fsystem is null and fend_id = " + storage.maxRevision + "\n" +
							")\n"
						;
					};
					storage.query ({session: session, sql: sql, success: function (options) {
						cb ();
					}});
				},
				function (cb) {
					if (code == "object") {
						return cb ();
					};
					let objectsMap = {};
					let _fields = me.data.fields ["t" + code];
					_.each (me.data ["t" + code], function (rec) {
						let o = {};
						for (let i = 0; i < _fields.length; i ++) {
							let field = _fields [i];
							let value = rec.values [i];
							o [field] = value;
						};
						if (o.fend_id != storage.maxRevision) {
							return;
						};
						if (code == "view" && o.fsystem == 1) {
							return;
						};
						objectsMap [o.fid] = objectsMap [o.fid] || o;
						if (o.fstart_id > objectsMap [o.fid].fstart_id) {
							objectsMap [o.fid] = o;
						};
					});
					let objects = [];
					_.each (objectsMap, function (o) {
						objects.push (o);
					});
					async.eachSeries (objects, function (o, cb) {
						let oo = {};
						async.series ([
							function (cb) {
								storage.query ({session: session, sql:
									"delete from _" + code + " where fid = " + o.fid
								, success: function () {
									cb ();
								}});
							},
							function (cb) {
								_.each (fields ["_" + code], function (f) {
									oo [f] = o [f];
								});
								if (code == "class_attr") {
									oo.fclass_code = "tmp";
								};
								oo.fid = me.newId ["t" + code][oo.fid];
								if (oo.fparent_id) {
									oo.fparent_id = me.newId ["t" + code][oo.fparent_id];
								};
								if (oo.fclass_id) {
									oo.fclass_id = me.newId ["tclass"][oo.fclass_id];
								};
								if (oo.fview_id) {
									oo.fview_id = me.newId ["tview"][oo.fview_id];
								};
								if (oo.ftype_id && oo.ftype_id >= 1000) {
									oo.ftype_id = me.newId ["tclass"][oo.ftype_id];
								};
								oo.fstart_id = me.newId ["trevision"][oo.fstart_id];
								cb ();
							},
							function (cb) {
								if (code != "class") {
									return cb ();
								};
								let table = oo.fcode + "_" + oo.fid;
								storage.client.isTableExists ({session: session, table: table, success: function (result) {
									if (result) {
										return cb ();
									};
									storage.query ({session: session, sql: "create table " + table + " (fobject_id bigint)", success: function (options) {
										cb ();
									}});
								}});
							},
							function (cb) {
								if (code != "class_attr") {
									return cb ();
								};
								storage.query ({session: session, sql: "select fcode from _class where fid = " + oo.fclass_id, success: function (opts) {
									if (!opts.result.rows.length) {
										return cb ();
									};
									let table = opts.result.rows [0].fcode + "_" + oo.fclass_id;
									let field = oo.fcode + "_" + oo.fid;
									storage.client.isFieldExists ({session: session, table: table, field: field, success: function (result) {
										if (result) {
											return cb ();
										};
										let columnType = "bigint";
										if (oo.ftype_id == 3) {
											columnType = "timestamp (6)";
										};
										if (oo.ftype_id == 2) {
											columnType = "numeric";
										};
										if (oo.ftype_id == 1 || oo.ftype_id == 5) {
											columnType = "text";
										};
										async.series ([
											function (cb) {
												storage.query ({session: session, sql: "alter table " + table + " add column " + field + " " + columnType, success: function (options) {
													cb ();
												}});
											},
											function (cb) {
												if (o.funique && !storage.connection.dbEngine.uniqueValueIndex) {
													storage.query ({session: session, sql: "create unique index " + table + "_" + field + "_unique on " + table + " (" + field + ")", success: function (options) {
														cb ();
													}});
												} else {
													if (oo.ftype_id == 12 || oo.ftype_id >= 1000 || (o.fformat_func && o.fformat_func.indexOf ('"index"') > 0)) {
														storage.query ({session: session, sql: "create index " + table + "_" + field + " on " + table + " (" + field + ")", success: function (options) {
															cb ();
														}});
													} else {
														cb ();
													};
												};
											}
										], cb);
									}});
								}});
							},
							function (cb) {
								let sql = me.generateInsert ({table: "_" + code, fields: oo});
								storage.query ({session: session, sql: sql, success: function (options) {
									cb ();
								}});
							}
						], cb);
					}, cb);
				}/*,
				function (cb) {
					storage.query ({session: session, sql:
						"select " + fields._class.join (",") + " from _class order by fcode"
					, success: function (opts) {
						fs.writeFileSync ("c-schema.txt", JSON.stringify (me.data ["tclass"], null, "\t"));
						fs.writeFile ("c-db.txt", JSON.stringify (opts.result.rows, null, "\t"), cb);
					}});
				}*/
			], cb);
		}, function (err) {
			cb (err);
		});
	};
	// Генерация insert запроса
	this.generateInsert = function (options) {
	    let fields = [];
	    let values = "";
	    for (let key in options.fields) {
			fields.push (key);
			if (values) {
				values += ",";
			};
			if (options.fields [key] != null) {
				let value = options.fields [key];
				if (typeof (value) == "string") {
					if (value.length == 24 && value [10] == "T" && value [23] == "Z") { // 2012-08-20T13:17:48.456Z
						value = "'" + common.getUTCTimestamp (new Date (value)) + "'";
					} else {
						value = common.ToSQLString (value, storage.client.database);
						if (storage.client.database == "postgres") {
							value = "E" + value;
						};
					};
				} else
				if (typeof (value) == "object" && value.getMonth) {
					value = "'" + common.getUTCTimestamp (value) + "'";
				}
				values += value;
			} else {
				values += "null";
			};
	    };
	    let s;
	    s = "insert into " + options.table + "(\n";
	    s += fields.join ();
	    s += "\n) values (\n";		    
	    s += values;
	    s += "\n)\n";
	    return s;
	}
	this.incCount = function (table, id) {
		this.count [table] ++;
		// todo: update storage.revision for clear cache
	};
	// Импорт представлений
	this.importViews = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importViews"});
		let viewFields = me.data.fields.tview;
		async.eachSeries (me.data.tview, function (view, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			for (let i = 0; i < viewFields.length; i ++) {
				let field = viewFields [i];
				let value = view.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fparent_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tview set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tview", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				let s = me.generateInsert ({table: "tview", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tview", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов представлений
	this.importViewAttrs = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importViewAttrs"});
		let s;
		let viewAttrFields = me.data.fields.tview_attr;
		async.eachSeries (me.data.tview_attr, function (viewAttr, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			for (let i = 0; i < viewAttrFields.length; i ++) {
				let field = viewAttrFields [i];
				let value = viewAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tview_attr"][value];
					} else
					if (field == "fview_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fclass_attr_id") {
						value = me.newId ["tclass_attr"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tview_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tview_attr", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				s = me.generateInsert ({table: "tview_attr", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tview_attr", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт классов
	this.importClasses = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importClasses"});
		let classFields = me.data.fields.tclass;
		async.eachSeries (me.data.tclass, function (cls, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			for (let i = 0; i < classFields.length; i ++) {
				let field = classFields [i];
				let value = cls.values [i]; 
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fparent_id") {
						// TODO: Надо учесть случай когда парент класс еще не импортировался
						value = me.newId ["tclass"][value];
					} else
					if (field == "fview_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					};
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tclass set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tclass", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				let s = me.generateInsert ({table: "tclass", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tclass", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов классов
	this.importClassAttrs = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importClassAttrs"});
		let classAttrFields = me.data.fields.tclass_attr;
		async.eachSeries (me.data.tclass_attr, function (classAttr, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			for (let i = 0; i < classAttrFields.length; i ++) {
				let field = classAttrFields [i];
				let value = classAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tclass_attr"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "ftype_id") {
						let typeId = value;
						if (typeId >= 1000) {
							let id = me.newId ["tclass"][typeId];
							value = id;
							me.classAttrType [fields ["fid"]] = id;
						} else {
							me.classAttrType [fields ["fid"]] = typeId;
						};
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tclass_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tclass_attr", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				let s = me.generateInsert ({table: "tclass_attr", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tclass_attr", fields ["fid"]);
					cb ();
				}});
			}
		})}, function (err) {
			success ();
		});
	};
	// Импорт действий
	this.importActions = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importActions"});
		let actionFields = me.data.fields.taction;
		async.eachSeries (me.data.taction, function (action, cb) {process.nextTick (function () {
			let fields = [];
			let schemaId;
			for (let i = 0; i < actionFields.length; i ++) {
				let field = actionFields [i];
				let value = action.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["taction"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update taction set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("taction", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				let s = me.generateInsert ({table: "taction", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("taction", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт объектов
	this.importObjects = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importObjects"});
		let objectFields = me.data.fields.tobject;
		let count = 0;
		async.eachSeries (me.data.tobject, function (object, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			for (let i = 0; i < objectFields.length; i ++) {
				let field = objectFields [i];
				let value = object.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tobject"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					};
				};
				fields [field] = value;
			};
			if (fields ["fclass_id"] != "0") {
				if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
					// Запись удалена
					if (me.startRevision [schemaId] != null && 
						fields ["fend_id"] != storage.maxRevision && 
						fields ["fend_id"] >= me.startRevision [schemaId] &&
						fields ["fid"] !== undefined // Например когда запись одна и она удалена
					) {
						fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
						storage.query ({session: session, sql: 
							"update tobject set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
						, success: function (options) {
							me.incCount ("tobject", fields ["fid"]);
							cb ();
						}});
					} else {
						cb ();
					};
				} else {
					fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					let s = me.generateInsert ({table: "tobject", fields: fields});
					storage.query ({session: session, sql: s, success: function (options) {
						me.incCount ("tobject", fields ["fid"]);
						// count
						count ++;
						if (count % 10000 == 0) {
							log.info ({cls: "Import"}, "\t" + count + " records");
						};
						cb ();
					}});
				};
			};	
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов объектов
	this.importObjectAttrs = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importObjectAttrs"});
		let objectAttrFields = me.data.fields.tobject_attr;
		let count = 0;
		async.eachSeries (me.data.tobject_attr, function (objectAttr, cb) {process.nextTick (function () {
			let fields = {};
			let schemaId;
			let typeId = 0;
			for (let i = 0; i < objectAttrFields.length; i ++) {
				let field = objectAttrFields [i];
				let value = objectAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tobject_attr"][value];
					} else
					if (field == "fclass_attr_id") {
						let classAttrId = me.newId ["tclass_attr"][value];
						value = classAttrId;
						typeId = me.classAttrType [classAttrId];
					} else
					if (field == "fobject_id") {
						value = me.newId ["tobject"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					} else
					if (field == "fnumber") {
						if (typeId >= 1000 || typeId == 12) {
							value = me.newId ["tobject"][value];
						};
						if (typeId == 6) {
							value = me.newId ["tclass"][value];
						};
						if (typeId == 7) {
							value = me.newId ["tclass_attr"][value];
						};
						if (typeId == 8) {
							value = me.newId ["tview"][value];
						};
						if (typeId == 9) {
							value = me.newId ["tview_attr"][value];
						};
						if (typeId == 10) {
							value = me.newId ["taction"][value];
						};
						if (typeId == 11) {
							value = me.newId ["taction_attr"][value];
						};
						if (typeId == 13) {
							value = me.newId ["tobject_attr"][value];
						};
					} else
					if (field != "fstart_id" && field != "fend_id") {
						if (value == undefined) {
							// Ссылка на неактуальный объект
							value = null;
						}
					}
				}
				fields [field] = value;
			};
			if (typeId) {
				if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
					// Запись удалена
					if (me.startRevision [schemaId] != null && 
						fields ["fend_id"] != storage.maxRevision && 
						fields ["fend_id"] >= me.startRevision [schemaId] &&
						fields ["fid"] !== undefined // Например когда запись одна и она удалена
					) {
						fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
						storage.query ({session: session, sql: 
							"update tobject_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
						, success: function (options) {
							me.incCount ("tobject_attr", fields ["fid"]);
							cb ();
						}});
					} else {
						cb ();
					};
				} else {
					fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					if (storage.client.database == "mssql" && fields.ftime) {
						fields.ftime = new Date (fields.ftime);
					};
					let s = me.generateInsert ({table: "tobject_attr", fields: fields});
					storage.query ({session: session, sql: s, success: function (options) {
						me.incCount ("tobject_attr", fields ["fid"]);
						// count
						count ++;
						if (count % 10000 == 0) {
							log.info ({cls: "Import"}, "\t" + count + " records");
						};
						cb ();
					}});
				};
			} else {
				cb ();
			};
		})}, function (err) {
			success ();
		});
	};
	// Создание схемы
	this.createSchema = function (options) {
		let result = null;
		let success = options.success;
		let schemaCode = options.code;
		storage.query ({session: session, sql: "select fid from tschema where fcode='" + schemaCode + "'", success: function (options) {
			let qr = options.result.rows;
			if (qr.length == 0) {
				// Добавление записи в tschema
				let nextId = null;
				storage.query ({session: session, sql: "select max (fid) as fid from tschema", success: function (options) {
					let qr = options.result.rows;
					if (qr.length) {
						nextId = qr [0].fid + 1;
					};
					if (nextId == null) {
						nextId = 1;
					};
					storage.query ({session: session, sql: "insert into tschema (fid, fcode) values (" + nextId + ",'" + schemaCode + "')", success: function (options) {
						result = nextId;
						success (result);
					}});
				}});
			} else {
				result = qr [0].fid;
				success (result);
			}
		}});
	}
	// Получение идентификатора схемы
	this.getSchemaId = function (options) {
		let me = this;
		let success = options.success;
		if (!options || !options.code) {
			throw "schema.getId (): options.code must be defined";
		}
		let result = null;
		storage.query ({session: session, sql: "select fid from tschema where fcode='" + options.code + "'", success: function (options) {
			let r = options.result.rows;
			if (r.length > 0) {
				result = r [0].fid;
				success (result);
			} else {
				success (null);
			};
		}});
	}
	// TODO: Получение карты соответствия schemaId, recordId и localId
	this.getNewId = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "getNewId"});
		async.eachSeries (me.data.tschema, function (schema, cb) {
			me.getSchemaId ({code: schema.values [3], success: function (schemaId) {
				if (schemaId == null) {
					cb ();
				} else {
					let tables = [];
					for (let table in ifields) {
						tables.push (table);
					};
					async.eachSeries (tables, function (table, cb) {
						let schemaColId = ifields [table].indexOf ("fschema_id");
						let recordColId = ifields [table].indexOf ("frecord_id");
						if (schemaColId == -1) {
							cb ();
						} else {
							storage.query ({session: session, sql: "select distinct (frecord_id) as frecord_id, fid from " + table + " where frecord_id is not null and fschema_id=" + schemaId, success: function (options) {
								let qr = options.result.rows;
								let data = me.data [table];
								for (let j = 0; j < qr.length; j ++) {
									let recordId = qr [j].frecord_id;
									for (let k = 0; k < data.length; k ++) {
										if (schema.values [0] != data [k].values [schemaColId]) {
											continue;
										}
										if (recordId != data [k].values [recordColId]) {
											continue;
										}
										me.newId [table] [data [k].values [0]] = qr [j].fid;
									}
								}
								cb ();
							}});
						};
					}, function (err) {
						cb ();
					});
				};
			}});
		}, function (err) {
			success ();
		});
	}
	// Импорт ревизий
	this.importRevisions = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importRevisions"});
		let revisionFields = me.data.fields.trevision;
		let schemaColId = revisionFields.indexOf ("fschema_id");
		async.eachSeries (me.data.trevision, function (revision, cb) {
			process.nextTick (function () {
				let schemaId = revision.values [schemaColId];
				// Эта ревизия уже есть
				if (me.newId ["trevision"][revision.values [0]]) {
					cb ();
					return;
				}
				if (!me.startRevision [schemaId]) {
					me.startRevision [schemaId] = revision.values [0];
					if (!me.startRevisionMin || me.startRevisionMin > me.startRevision [schemaId]) {
						me.startRevisionMin = me.startRevision [schemaId];
					}
					log.info ({cls: "Import"}, "startRevision [" + schemaId + "] = " + revision.values [0] + " ");
				}
				let fields = {};
				let id;
				for (let i = 0; i < revisionFields.length; i ++) {
					let field = revisionFields [i];
					let value = revision.values [i]; 
					if (value != null) {
						if (field == "fid") {
							id = value;
							value = me.tableId ["trevision"];
						} else
						if (field == "fschema_id") {
							value = me.newId ["tschema"][value];
						}
					}
					fields [field] = value;
				};
				if (storage.client.database == "mssql" && fields.fdate) {
					fields.fdate = new Date (fields.fdate);
				};
				let s = me.generateInsert ({table: "trevision", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("trevision", fields ["fid"]);
					me.newId ["trevision"][id] = me.tableId ["trevision"];
					me.tableId ["trevision"] ++;
					cb ();
				}});
			});
		}, function (err) {
			me.newId ["trevision"][storage.maxRevision] = storage.maxRevision;
			success ();
		});
	};
	// Импорт схем
	this.importSchemas = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "importSchemas"});
		let schemaFields = me.data.fields.tschema;
		this.startRevision = {};
		async.eachSeries (me.data.tschema, function (schema, cb) {
			me.startRevision [schema.values [0]] = null;
			for (let i = 0; i < schemaFields.length; i ++) {
				let field = schemaFields [i];
				let value = schema.values [i]; 
				if (value != null && field == "fcode") {
					me.createSchema ({code: value, success: function (schemaId) {
						me.newId ["tschema"][schema.values [0]] = schemaId;
						cb ();
					}});
					break;
				}
			};
		}, function (err) {
			success ();
		});
	}
	// Генерация идентификаторов для создаваемых объектов
	this.generateNewId = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "generateNewId"});
		let tables = ["tclass", "tclass_attr", "tview", "tview_attr", "taction", "taction_attr", "tobject", "tobject_attr"];
		for (let j = 0; j < tables.length; j ++) {
			let t = tables [j];
			if (!me.data [t]) {
				continue;
			}
			for (let i = 0; i < me.data [t].length; i ++) {
				let fields = {};
				for (let k = 0; k < me.data.fields [t].length; k ++) {
					let field = me.data.fields [t][k];
					let value = me.data [t][i].values [k]; 
					fields [field] = value;
				};
				if (me.schema && (me.startRevision [fields ["fschema_id"]] == null || fields ["fstart_id"] < me.startRevision [fields ["fschema_id"]])) {
					continue;
				}
				if (!me.newId [t][fields ["fid"]]) {
					me.newId [t][fields ["fid"]] = me.tableId [t];
					me.tableId [t] ++;
				}
			}
		}
		success ();
	};
	// Удалить таблицу
	this.removeTOC = function (options) {
		let me = this;
		let success = options.success;
		let session = options.session;
		if (options.storage) {
			storage = options.storage;
		};
		log.info ({cls: "Import", fn: "removeTOC"});
		let s = "select c.fid from tclass c\n";
		s += "where c.fid >= 1000 and " + storage.getCurrentFilter ({alias: "c"}) + "\n";
		if (options && options.classId) {
			s += "and c.fid=" + options.classId + "\n";
		};
		s += "order by c.fid\n";
		storage.query ({session: session, sql: s, success: function (options) {
			let classes = options.result.rows;
			async.eachSeries (classes, function (cls, cb) {
				let name = storage.getClass (cls.fid).toc;
				storage.client.isTableExists ({session: session, table: name, success: function (result) {
					if (result) {
						let s;
						if (storage.client.database == "mssql") {
							s = "drop table " + name + "\n";
						} else {
							s = "drop table " + name + " cascade\n";
						};
						storage.query ({session: session, sql: s, success: function (options) {
							cb ();
						}});
					} else {
						cb ();
					};
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Убирает лишние экземпляры объектов
	this.removeObjectDuplicates = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "removeObjectDuplicates"});
		storage.query ({session: session, sql:
			"select count (*), o.fid from tobject o\n" +
			"where " + storage.getCurrentFilter ({alias: "o"}) + "\n" +
			"group by o.fid\n" +
			"having count (*) > 1\n"
		, success: function (options) {
			let objects = options.result.rows;
			async.eachSeries (objects, function (object, cb) {
				let objectId = object.fid;
				storage.query ({session: session, sql:
					"select o.fstart_id from tobject o\n" +
					"where o.fid=" + objectId + " and " + storage.getCurrentFilter ({alias: "o"}) + "\n" +
					"order by o.fstart_id desc\n"
				, success: function (options) {
					let dubs = options.result.rows;
					dubs.splice (0, 1);
					async.eachSeries (dubs, function (dub, cb) {
						storage.query ({session: session, sql:
							"update tobject set fend_id=fstart_id\n" +
							"where fid=" + objectId + " and fstart_id=" + dub.fstart_id
						, success: function (options) {
							cb ();
						}});
					}, function (err) {
						cb ();
					});
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Убирает лишние экземпляры атрибутов
	this.removeObjectAttrDuplicates = function (options) {
		let me = this;
		let success = options.success;
		log.info ({cls: "Import", fn: "removeObjectAttrDuplicates"});
		storage.query ({session: session, sql:
			"select oa.fclass_attr_id, oa.fobject_id from tobject_attr oa\n" +
			"where " + storage.getCurrentFilter ({alias: "oa"}) + "\n" +
			"group by oa.fclass_attr_id, oa.fobject_id\n" +
			"having count (*) > 1\n"
		, success: function (options) {
			let objects = options.result.rows;
			async.eachSeries (objects, function (object, cb) {
				let classAttrId = object.fclass_attr_id;
				let objectId = object.fobject_id;
				// classAttrId, objectId
				storage.query ({session: session, sql:
					"select oa.fid from tobject_attr oa\n" +
					"where oa.fclass_attr_id=" + classAttrId + " and oa.fobject_id=" + objectId + " and " + storage.getCurrentFilter ({alias: "oa"}) + "\n" +
					"order by oa.FSTART_ID desc\n"
				, success: function (options) {
					let attrs = options.result.rows;
					attrs.splice (0, 1); // 2015-12-15
					async.eachSeries (attrs, function (attr, cb) {
						storage.query ({session: session, sql:
							"update tobject_attr set fend_id=fstart_id\n" +
							"where fid=" + attr.fid
						, success: function (options) {
							cb ();
						}});
					}, function (err) {
						cb ();
					});
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Получение списка дочерних записей
	this.getChilds = function (options) {
		let me = this;
		let success = options.success;
		let meOptions = options;
		storage.query ({session: session, sql:
			"select fid from " + options.table + " where fparent_id " +
			(options.parentId ? ("= " + options.parentId) : "is null") + " and " +
			storage.getCurrentFilter ()
		, success: function (options) {
			let qr = options.result.rows;
			if (!meOptions.childs) {
				meOptions.childs = [];
			};
			async.eachSeries (qr, function (row, cb) {
				meOptions.childs.push (row.fid);
				me.getChilds ({table: meOptions.table, parentId: row.fid, childs: meOptions.childs, success: function (result) {
					cb ();
				}});
			}, function (err) {
				success (meOptions.childs);
			});
		}});
	}
	// Создать таблицу
	this.createTOC = function (options) {
		let me = this;
		let success = options.success;
		if (options.storage) {
			storage = options.storage;
		};
		log.info ({cls: "Import", fn: "createTOC"});
		let classes;
		async.series ([
			function (cb) {
				me.removeObjectAttrDuplicates ({success: function () {
					me.removeObjectDuplicates ({success: function () {
						cb ();						
					}});
				}});
			},
			function (cb) {
				let s;
				s = "select\n";
				s += "	" + ifields.tclass + "\n";
				s += "from\n";
				s += "	tclass\n";
				s += "where\n";
				s += "	" + storage.getCurrentFilter () + "\n";
				if (options && options.classId) {
					s += "and fid=" + options.classId + "\n";
				};
				s += "and fid >= 1000\n";
				s += "order by fid\n";
				storage.query ({session: session, sql: s, success: function (options) {
					classes = options.result.rows;
					cb ();
				}});
			},
			function (cb) {
				async.eachSeries (classes, function (cls, cb) {
					let classId = cls.fid;
					let tocName = storage.getClass (classId).toc;
					if (tocName.toLowerCase ().substring (0, 5) == "view_") {
						cb ();
						return;
					};
					storage.client.isTableExists ({session: session, table: tocName, success: function (result) {
						if (result) {
							cb ();
							return;
						};
						let sqlInsert = "insert into " + tocName + " (fobject_id";
						let sqlSelect = "select o.fid";
						let sqlJoin = "";
						let classAttrs;
						let classChilds = [];
						async.series ([
							function (cb) {
								log.info ({cls: "Import"}, "Creating toc for class '" + cls.fcode + "' [" + classId + "] ...");
								if (storage.client.database == "mssql") {
									storage.query ({session: session, sql: "create table " + tocName + " (fobject_id bigint primary key clustered)", success: function (options) {
										cb ();
									}});
								} else {
									let s = "create table " + tocName + " (fobject_id bigint not null, primary key (fobject_id))";
									if (storage.client.version >= 91 && config.storages [storage.code] && config.storages [storage.code].unlogged) {
										s = "create unlogged table " + tocName + " (fobject_id bigint not null, primary key (fobject_id))";
									};
									storage.query ({session: session, sql: s, success: function () {
										cb ();
									}});
								};
							},
							function (cb) {
								classChilds.push (classId);
								me.getChilds ({table: "tclass", parentId: classId, childs: classChilds, success: function (result) {
									classChilds = result;	
									storage.query ({session: session, sql:
										"select\n" +
										"	" + ifields.tclass_attr + "\n" +
										"from\n" +
										"	tclass_attr ca\n" +
										"where\n" +
										"	ca.fclass_id = " + classId + " and\n" +
										"	" + storage.getCurrentFilter ({alias: "ca"}) + "\n" +
										"order by ca.fid\n"
									, success: function (options) {
										classAttrs = options.result.rows;
										cb ();
									}});
								}});
							},
							function (cb) {
								async.eachSeries (classAttrs, function (classAttr, cb) {
									let classAttrId = classAttr.fid;
									let opts = {};
									try {
										opts = JSON.parse (classAttr.fformat_func) || {};
									} catch (e) {
									}
									let hasRownumColumn;
									let type = "$tnumber$";
									let ftype = "fnumber";	    
									switch (classAttr.ftype_id) {
										case 2:
											type = "$tnumber_value$";
										break;
										case 1:
										case 5:
											type = "$ttext$";
											ftype = "fstring";
										break;
										case 3:
											type = "$ttimestamp$";
											ftype = "ftime";
										break;
									};
									let tocFieldName = storage.getClassAttr (classAttrId).toc;
									let s = "alter table " + tocName + " add column " + tocFieldName + " " + type;
									if (storage.client.database == "mssql") {
										s = "alter table " + tocName + " add " + tocFieldName + " " + type;
									};
									storage.query ({session: session, sql: s, success: function () {
										sqlInsert += ", " + tocFieldName;
										sqlSelect += ", oa" + classAttrId + "." + ftype;
										sqlJoin += "left join tobject_attr oa" + classAttrId + " on (oa" + classAttrId + ".fobject_id = o.fid and oa" + classAttrId + ".fclass_attr_id = " + classAttrId + " and " + storage.getCurrentFilter ({alias: "oa" + classAttrId}) + ")\n";
										if (classAttr.ftype_id == 12 || classAttr.ftype_id >= 1000 || classAttr.funique || opts.index) {
											log.info ({cls: "Import"}, "created index for class_attr: " + classAttr.fcode);
											let s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (" + tocFieldName + ")";
											if (classAttr.funique && storage.client.database == "mssql" && ftype == "fstring") {
												s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (fobject_id) include (" + tocFieldName + ")";
											};
											storage.query ({session: session, sql: s, success: function () {
												cb ();
											}});
										} else {
											if (config.index && config.index.text_pattern_ops && classAttr.ftype_id == 1 && storage.client.database == "postgres") {
												log.info ({cls: "Import"}, "created text index for class_attr: " + classAttr.fcode);
												let s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (" + tocFieldName + " text_pattern_ops)";
												storage.query ({session: session, sql: s, success: function () {
													cb ();
												}});
											} else
											if (config.index && config.index.substr && classAttr.ftype_id == 1 && storage.client.database == "postgres") {
												log.info ({cls: "Import"}, "created text index for class_attr: " + classAttr.fcode);
												let s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (substr (" + tocFieldName + ", 1, 1024))";
												storage.query ({session: session, sql: s, success: function () {
													cb ();
												}});
											} else {
												cb ();
											};
										};
									}});
								}, function (err) {
									cb ();
								});
							},
							function (cb) {
								log.info ({cls: "Import"}, "Inserting toc data for class '" + cls.fcode + "' [" + classId + "] ...");
								sqlInsert = sqlInsert + ")\n" + sqlSelect + " from $schema_prefix$tobject o\n" + sqlJoin;
								sqlInsert += "where	o.fclass_id in (" + classChilds.join () + ") and " + storage.getCurrentFilter ({alias: "o"}) + "\n";
								sqlInsert += "order by o.fid\n";
								storage.query ({session: session, sql: sqlInsert, success: function () {
									cb ();
								}});
							}
						], function (err, results) {
							cb ();
						});
					}});
				}, function (err) {
					cb ();
				});
			}
		], function (err, results) {
			success ();
		});
	};
	// Импорт из файла
	// example: importFromFile ({file: "pm.js"})
	this.importFromFile = function (options) {
		let me = this;
		let success = options.success;
		session = {
			id: "import_" + options.code,
			username: "admin",
			userId: null
		};
		log.info ({cls: "Import", fn: "importFromFile"});
		async.series ([
			function (cb) {
				fs.exists (options.file, function (exists) {
					if (exists) {
						fs.readFile (options.file, function (err, fileText) {
							me.data = JSON.parse (fileText);
							cb ();
						});
					} else {
						cb ("file not exists.");
					};
				});
			},
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
				storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "import_" + options.code, success: function () {
					cb ();
				}, failure: function (options) {
					cb (options.error);
				}});
			},
			function (cb) {
				me.getSequences ({session: session, success: function () {
					cb ();
				}});
			},
			function (cb) {
				storage.query ({session: session, sql: "select fcode from tschema", success: function (options) {
					let r = options.result.rows;
					for (let i = 0; i < r.length; i ++) {
						if (!r [i].fcode || r [i].fcode == "undefined") {
							cb ("Schema undefined.");
							return;
						};
					};
					cb ();
				}});
			},
			function (cb) {
				me.count.tclass = 0;
				me.count.tclass_attr = 0;
				me.count.tview = 0;
				me.count.tview_attr = 0;
				me.count.taction = 0;
				me.count.taction_attr = 0;
				me.count.tobject = 0;
				me.count.tobject_attr = 0;
				me.count.trevision = 0;
				async.series ([
					function (cb) {
						me.getNewId ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importSchemas ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importRevisions ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.generateNewId ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
							me.updateEngineTables ({session: session}, function () {
								cb ();
							});
						} else {
							cb ();
						};
					},
					function (cb) {
						me.importViews ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importViewAttrs ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importClasses ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importClassAttrs ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importActions ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importObjects ({success: function () {
							cb ();
						}});
					}
				], cb);
				/*
				me.getNewId ({success: function () {
				me.importSchemas ({success: function () {
				me.importRevisions ({success: function () {
				me.generateNewId ({success: function () {
				me.importViews ({success: function () {
				me.importViewAttrs ({success: function () {
				me.importClasses ({success: function () {
				me.importClassAttrs ({success: function () {
				me.importActions ({success: function () {
				me.importObjects ({success: function () {
					cb ();
				}}); }}); }}); }}); }}); }}); }}); }}); }}); }});
				*/
			},
			function (cb) {
				if (storage.client.database == "mssql") {
					storage.query ({session: session, sql: "set identity_insert tobject_attr on", success: function (options) {
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
					storage.query ({session: session, sql:
						"create trigger tobject_attr_after_insert\n" +
						"after insert on tobject_attr for each row \n" +
						"execute procedure trigger_tobject_attr_after_insert ();\n"
					, success: function (options) {
						cb ();
					}});

				} else {
					cb ();
				};
			},
			function (cb) {
				me.importObjectAttrs ({success: function () {
					cb ();
				}});
			},
			function (cb) {
				if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
					storage.query ({session: session, sql:
						"drop trigger tobject_attr_after_insert on tobject_attr"
					, success: function (options) {
						cb ();
					}});

				} else {
					cb ();
				};
			},
			function (cb) {
				if (storage.client.database == "mssql") {
					storage.query ({session: session, sql: "set identity_insert tobject_attr off", success: function (options) {
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				storage.commitTransaction ({session: session, success: function () {
					cb ();
				}});
			},
			function (cb) {
				storage.client.updateSequences ({success: function () {
					cb ();
				}});
			},
			function (cb) {
				log.info ({cls: "Import"}, "records count:\n" + JSON.stringify (me.count, 0, "\t"));
				// Перестроить токи
				if (!options.keepToc && (me.count.tclass || me.count.tclass_attr || me.count.tobject || me.count.tobject_attr)) {
					async.series ([
						function (cb) {
							storage.initClasses ({success: function () {
								cb ();
							}});
						},
						function (cb) {
							storage.initClassAttrs ({success: function () {
								cb ();
							}});
						},
						/*
						function (cb) {
							storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "import_" + options.code, success: function () {
								cb ();
							}});
						},
						*/
						function (cb) {
							if (!storage.connection.dbEngine || (storage.connection.dbEngine && !storage.connection.dbEngine.enabled)) {
								me.removeTOC ({success: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						},
						function (cb) {
							if (!storage.connection.dbEngine || (storage.connection.dbEngine && !storage.connection.dbEngine.enabled)) {
								me.createTOC ({success: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						}/*,
						function (cb) {
							storage.commitTransaction ({session: session, success: function () {
								cb ();
							}});
						}*/
					], function (err) {
						cb ();
					});
				} else {
					cb ();
				};
			},
			function (cb) {
				let redisClient = redis.createClient (config.redis.port, config.redis.host);
				redisClient.del (options.code + "-requests");
				redisClient.del (options.code + "-objects");
				redisClient.keys ("*-content", function (err, result) {
					for (let i = 0; i < result.length; i ++) {
						redisClient.del (result [i]);
					}
				});
				redisClient.keys ("*-clschange", function (err, result) {
					for (let i = 0; i < result.length; i ++) {
						redisClient.del (result [i]);
					}
				});
				cb ();
			}
		], function (err, results) {
			if (err) {
				log.info ({cls: "Import", error: err});
				if (storage) {
					storage.rollbackTransaction ({session: session, success: function () {
						success ();
					}});
				} else {
					success ();
				};
			} else {
				success ();
			};
			if (me.storageCreated) {
				storage.freeResources ();
			};
			if (!options.noExit) {
				process.exit (1);
			};
		});
	}
};
