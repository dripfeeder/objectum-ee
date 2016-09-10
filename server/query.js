/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
// storage, session, sql
var Query = function (options) {
	var query = this;
	var mainOptions = options;
	var success = options.success;
	var storage = options.storage;
	var session = options.session || {userId: null};
	var revision = session.revision;
	var select = options.sql.select;
	var from = options.sql.from;
	var where = options.sql.where;
	var order = options.sql.order;
	var orderAfter = options.sql.orderAfter;
	var attrs = {};
	var fields = [];
	var fieldNames = [];
	var fieldTypeId = {};
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
	var getAttrs = function () {
		for (var i = 0; i < from.length; i ++) {
			var o = from [i];
			if (typeof (o) == "object" && Object.prototype.toString.call (o) !== "[object Array]") {
				for (var key in o) {
					attrs [key] = attrs [key] || {};
					attrs [key].cls = o [key];
					attrs [key].toc = {};
					break;
				}
			}
		}
	};
	var processJoin = function (arr) {
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i];
			if (typeof (o) =="object") {
				for (var a in o) {
					if (o [a] == "id") {
						var toc = storage.classesCode [attrs [a].cls].toc;
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
						var toc, ca, pos = query.sysCls.indexOf (attrs [a].cls);
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
	var processJoins = function (arr) {
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i];
			if (o == "left-join" || o == "inner-join") {
				processJoin (arr [i + 3]);
				i += 3;
			}
		}
	};
	var lastTypeId = 1;
	var fieldToSQL = function (o) {
		var r = "";
		var distinct = o.distinct;
		for (var a in o) {
			if (a == "distinct") {
				continue;
			};
			if (o [a] == "id") {
				if (distinct) {
					r = "distinct on (" + a + ".fobject_id) " + a + ".fobject_id";
				} else {
					r = a + ".fobject_id";
				};
				var c = storage.getClass ({classCode: attrs [a].cls});
				if (!c) {
					throw "query.fieldToSQL - unknown class: " + attrs [a].cls;
				};
				var toc = c.toc;
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
				var toc, pos = query.sysCls.indexOf (attrs [a].cls);
				var ca = storage.getClassAttr ({classCode: attrs [a].cls, attrCode: o [a]});
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
	var getExpressionStr = function (arr) {
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			if (r) {
				r += " ";
			}
			var o = arr [i];
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
				var pos = fields.indexOf (o.toLowerCase () + "_");
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
	var processSelect = function (arr) {
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i], name;
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
				var s = o.toLowerCase () + "_";
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
	var processFrom = function (arr) {
		if (!arr) {
			return "";
		}
		var getBlock = function (o) {
			var alias, classCode, fields = [], tables = [], where = [];
			for (alias in o) {
				classCode = o [alias];
				break;
			}
			var objectField;
			for (var t in attrs [alias].toc) {
				var f = attrs [alias].toc [t];
				for (var i = 0; i < f.length; i ++) {
					fields.push (t + "." + f [i]);
				}
				if (query.tables.indexOf (t) == -1) {
					objectField = t + ".fobject_id";
				}
			};
			var cls = storage.getClass (classCode);
			while (1) {
				var pos = query.sysCls.indexOf (classCode);
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
			for (var i = 1; i < tables.length; i ++) {
				where.push (tables [i - 1] + ".fobject_id=" + tables [i] + ".fobject_id");
			}
			if (revision) {
				for (var i = 0; i < tables.length; i ++) {
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
			var eventResult = storage.fireEvent ("generatequeryblock", {
				cls: cls,
				objectField: objectField,
				session: session,
				tables: tables,
				where: where,
				alias: alias
			});
			if (eventResult && eventResult.where) {
				where = eventResult.where;
			};
			return storage.client.database == "mssql" ? 
				"(select top 9223372036854775807 " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias : 
				"(select " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias
			;
		};
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			if (!i) {
				r += "\t" + getBlock (arr [0]);
			} else {
				var o = arr [i];
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
	var processWhere = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "where\n\t" + getExpressionStr (arr) + "\n";
	};
	var processOrder = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "order by\n\t" + getExpressionStr (arr) + "\n";
	};
	var processOrderAfter = function (arr) {
		if (!arr || !arr.length) {
			return "";
		};
		var s = "";
		for (var j = 0; j < arr.length; j ++) {
			if (_.isObject (arr [j])) {
				var has = false;
				for (var i = 0; i < select.length; i ++) {
					var o = select [i];
					if (_.isObject (o) && _.keys (o)[0] == _.keys (arr [j])[0] && _.values (o)[0] == _.values (arr [j])[0]) {
						s += "orderAfter." + select [i + 1] + "_ ";
						has = true;
					}
				}
				if (!has) {
					s += "orderAfter." + _.values (arr [j])[0] + "_ ";
				}
			} else {
				var pos = fields.indexOf (arr [j].toLowerCase () + "_");
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
