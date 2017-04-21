/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
// storage, session, sql
"use strict"
global.Query = function (options) {
	let query = this;
	let mainOptions = options;
	let success = options.success;
	let storage = options.storage;
	let session = options.session || {userId: null};
	let revision = session.revision;
	let select = options.sql.select;
	let from = options.sql.from;
	let where = options.sql.where;
	let order = options.sql.order;
	let orderAfter = options.sql.orderAfter;
	let attrs = {};
	let fields = [];
	let fieldNames = [];
	let fieldTypeId = {};
	query.generate = function () {
		getAttrs ();
		processJoins (from);
		query.selectSQL = processSelect (select);
		query.whereSQL = processWhere (where);
		query.orderSQL = processOrder (order);
		query.fromSQL = processFrom (from);
		query.attrs = attrs;
		query.fields = fields;
		query.fieldNames = fieldNames;
		query.fieldTypeId = fieldTypeId;
		if (orderAfter) {
			query.selectSQL = "select * from (\n" + query.selectSQL;
			query.orderSQL += "\n) orderAfter " + processOrderAfter (orderAfter);
		};
	};
	let getAttrs = function () {
		for (let i = 0; i < from.length; i ++) {
			let o = from [i];
			if (typeof (o) == "object" && Object.prototype.toString.call (o) !== "[object Array]") {
				for (let key in o) {
					attrs [key] = attrs [key] || {};
					attrs [key].cls = o [key];
					attrs [key].toc = {};
					break;
				}
			}
		}
	};
	let processJoin = function (arr) {
		for (let i = 0; i < arr.length; i ++) {
			let o = arr [i];
			if (typeof (o) =="object") {
				for (let a in o) {
					if (o [a] == "id") {
						let toc = storage.classesCode [attrs [a].cls].toc;
						if (revision) {
							toc = "tm_" + toc;
						};
						attrs [a].toc [toc] = attrs [a].toc [toc] || [];
						if (attrs [a].toc [toc].indexOf ("fobject_id") == -1) {
							attrs [a].toc [toc].push ("fobject_id");
						}
					} else {
						if (!attrs [a]) {
							console.error ("unknown attr: " + a);
						};
						let toc, ca, pos = query.sysCls.indexOf (attrs [a].cls);
						if (pos > -1) {
							toc = query.tables [pos];
							ca = {toc: o [a].substr (3)};
						} else {
							ca = storage.getClassAttr ({classCode: attrs [a].cls, attrCode: o [a]});
							toc = storage.classesMap [ca.get ("fclass_id")].toc;
							if (revision) {
								toc = "tm_" + toc;
							};
						}
						attrs [a].toc [toc] = attrs [a].toc [toc] || [];
						if (attrs [a].toc [toc].indexOf (ca.toc) == -1) {
							attrs [a].toc [toc].push (ca.toc);
						}
					}
					break;
				}
			}
		}				
	};
	let processJoins = function (arr) {
		for (let i = 0; i < arr.length; i ++) {
			let o = arr [i];
			if (o == "left-join" || o == "inner-join") {
				processJoin (arr [i + 3]);
				i += 3;
			}
		}
	};
	let lastTypeId = 1;
	let fieldToSQL = function (o) {
		let r = "";
		let distinct = o.distinct;
		for (let a in o) {
			if (a == "distinct") {
				continue;
			};
			if (o [a] == "id") {
				if (distinct) {
					r = "distinct on (" + a + ".fobject_id) " + a + ".fobject_id";
				} else {
					r = a + ".fobject_id";
				};
				let c = storage.getClass ({classCode: attrs [a].cls});
				if (!c) {
					throw "query.fieldToSQL - unknown class: " + attrs [a].cls;
				};
				let toc = c.toc;
				if (revision) {
					toc = "tm_" + toc;
				};
				attrs [a].toc [toc] = attrs [a].toc [toc] || [];
				if (attrs [a].toc [toc].indexOf ("fobject_id") == -1) {
					attrs [a].toc [toc].push ("fobject_id");
				}
				lastTypeId = 2;
			} else {
				if (!attrs [a]) {
					throw new VError ("Unknown attr: " + a);
				}
				let toc, pos = query.sysCls.indexOf (attrs [a].cls);
				let ca = storage.getClassAttr ({classCode: attrs [a].cls, attrCode: o [a]});
				if (pos > -1) {
					toc = query.tables [pos];
					ca.toc = o [a].substr (3);
				} else {
					toc = storage.classesMap [ca.get ("fclass_id")].toc;
					if (revision) {
						toc = "tm_" + toc;
					};
				};
				if (distinct) {
					r = "distinct on (" + a + "." + ca.toc + ") " + a + "." + ca.toc;
				} else {
					r = a + "." + ca.toc;
				};
				attrs [a].toc [toc] = attrs [a].toc [toc] || [];
				if (attrs [a].toc [toc].indexOf (ca.toc) == -1) {
					attrs [a].toc [toc].push (ca.toc);
				}
				lastTypeId = ca.get ("ftype_id");
			}
			break;
		};
		return r;
	};
	let getExpressionStr = function (arr) {
		let r = "";
		for (let i = 0; i < arr.length; i ++) {
			if (r) {
				r += " ";
			}
			let o = arr [i];
			if (typeof (o) == "object") {
				if (common.isArray (o)) {
					r += "(" + getExpressionStr (o) + ")";
				} else {
					r += fieldToSQL (o);
				}
			} else
			if (typeof (o) == "number") {
				r += o;
			} else
			if (typeof (o) == "string") {
				let pos = fields.indexOf (o.toLowerCase () + "_");
				if (query.keywords.indexOf (o) > -1) {
					r += o;
				} else
				if (pos > -1) {
					// поиск в олапе без учета регистра
					if (!config.query.strictFilter && i < arr.length - 2 && (arr [i + 1] == "like" || arr [i + 1] == "not like") && arr [i + 2] && typeof (arr [i + 2]) == "string") {
						r += "lower (" + fieldNames [pos] + ")";
						arr [i + 2] = arr [i + 2].toLowerCase ();
					} else {
						r += fieldNames [pos];
					};
				} else {
					r += "'" + o.split ("'").join ("''") + "'";
				}
			} else {
				r += o;
			}
		}
		return r;
	};
	let processSelect = function (arr) {
		let r = "", name;
		for (let i = 0; i < arr.length; i ++) {
			let o = arr [i];
			if (common.isArray (o)) {
				if (r) {
					r += ",\n\t";
				} else {
					r += "\t";
				}
				r += getExpressionStr (o);
			} else
			if (typeof (o) =="object") {
				if (r) {
					r += ",\n\t";
				} else {
					r += "\t";
				}
				name = fieldToSQL (o);
				r += name;
			} else {
				let s = o.toLowerCase () + "_";
				r += " as " + s;
				if (i && !common.isArray (arr [i - 1])) {
					fields.push (s);
					if (name.substr (0, 8) == "distinct") {
						name = name.split (" ")[3];
					}
					fieldNames.push (name);
					fieldTypeId [s] = lastTypeId;
				}
			}
		}
		return storage.client.database == "mssql" ? "select top 9223372036854775807\n" + r + "\n" : "select\n" + r + "\n";
	};
	let processFrom = function (arr) {
		if (!arr) {
			return "";
		}
		let getBlock = function (o) {
			let alias, classCode, fields = [], tables = [], where = [];
			for (alias in o) {
				classCode = o [alias];
				break;
			}
			let objectField;
			for (let t in attrs [alias].toc) {
				let f = attrs [alias].toc [t];
				for (let i = 0; i < f.length; i ++) {
					fields.push (t + "." + f [i]);
				}
				if (query.tables.indexOf (t) == -1) {
					objectField = t + ".fobject_id";
				}
			};
			let cls = storage.getClass (classCode);
			while (1) {
				let pos = query.sysCls.indexOf (classCode);
				if (pos > -1) {
					tables.push (query.tables [pos]);
					break;
				};
				if (revision) {
					tables.push ("tm_" + cls.toc);
				} else {
					tables.push (cls.toc);
				};
				if (!cls.get ("fparent_id")) {
					break;
				};
				cls = storage.classesMap [cls.get ("fparent_id")];
			};
			for (let i = 1; i < tables.length; i ++) {
				where.push (tables [i - 1] + ".fobject_id=" + tables [i] + ".fobject_id");
			}
			if (revision) {
				for (let i = 0; i < tables.length; i ++) {
					if (query.tables.indexOf (tables [i]) == -1) {
						where.push (tables [i] + ".frevision_id=" + revision);
					};
				};
			};
			if (where.length) {
				where = " where " + where.join (" and ");
			} else {
				where = "";
			}
			if (!objectField) {
				if (tables.indexOf ("tobject") > -1) {
					objectField = "tobject.fid";
				} else
				if (tables.indexOf ("tobject_attr") > -1) {
					objectField = "tobject_attr.fid";
				}
			}
			return storage.client.database == "mssql" ?
				"(select top 9223372036854775807 " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias : 
				"(select " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias
			;
		};
		let r = "";
		for (let i = 0; i < arr.length; i ++) {
			if (!i) {
				r += "\t" + getBlock (arr [0]);
			} else {
				let o = arr [i];
				if (o == "left-join" || o == "inner-join") {
					r += "\n\t" + o.split ("-").join (" ");
					r += " " + getBlock (arr [i + 1]);
					r += " on (" + getExpressionStr (arr [i + 3]) + ")";
					i += 3;
				}
			}
		}
		return "from\n" + r + "\n";
	};
	let processWhere = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "where\n\t" + getExpressionStr (arr) + "\n";
	};
	let processOrder = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "order by\n\t" + getExpressionStr (arr) + "\n";
	};
	let processOrderAfter = function (arr) {
		if (!arr || !arr.length) {
			return "";
		};
		let s = "";
		for (let j = 0; j < arr.length; j ++) {
			if (_.isObject (arr [j])) {
				let has = false;
				for (let i = 0; i < select.length; i ++) {
					let o = select [i];
					if (_.isObject (o) && _.keys (o)[0] == _.keys (arr [j])[0] && _.values (o)[0] == _.values (arr [j])[0]) {
						s += "orderAfter." + select [i + 1] + "_ ";
						has = true;
					}
				}
				if (!has) {
					s += "orderAfter." + _.values (arr [j])[0] + "_ ";
				}
			} else {
				let pos = fields.indexOf (arr [j].toLowerCase () + "_");
				if (pos > -1) {
					s += "orderAfter." + arr [j] + "_ ";
				} else {
					s += arr [j];
				}
			};
		};
		return "order by\n\t" + s + "\n";
	};
};
Query.prototype.sysCls = ["system.class", "system.class_attr", "system.view", "system.view_attr", "system.action", "system.action_attrs", "system.object", "system.object_attr", "system.revision"];
Query.prototype.tables = ["tclass", "tclass_attr", "tview", "tview_attr", "taction", "taction_attrs", "tobject", "tobject_attr", "trevision"];
Query.prototype.keywords = [
	"is null", "is not null", "on", "in", "not in", "exist", "not exist", "like", "not like", 
	"desc", "DESC", "asc", "ASC", "and", "or", "row_number ()", "over", "order by",
	"<>", ">", ">=", "<", "<=", "=", "+", "-", "||", "/", ",", "*", "current_timestamp",
	"lower", "trim", "ltrim", "rtrim"
];
