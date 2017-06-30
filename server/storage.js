/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
"use strict"
global.Storage = function (options) {
	let storage = this;
	// postgresql main client object
	storage.client = null;
	// Connections to postgresql. One connection - one transaction.
	storage.clientPool = {};
	storage.getClient = function (options) {
		options = options || {};
		options.session = options.session || {};
		if (storage.clientPool [options.session.id]) {
			return storage.clientPool [options.session.id];
		} else {
			let client = db.create (storage);
			return client;
		};
	};
	storage.freeClient = function (options) {
		let client = storage.clientPool [options.session.id];
		if (client) {
			client.disconnect ();
			delete storage.clientPool [options.session.id];
		}
	};
	// Current revision of transaction
	storage.revision = {};
	// exec sql
	storage.queryCount = 0;
	storage.query = function (options) {
		let meOptions = options;
		options.options = options.options || {};
		let session = options.session;
		storage.queryCount ++;
		let client = options.client || storage.getClient (options);
		(function hideParams () {
			if (options.params) {
				for (let i = 0; i < options.params.length; i ++) {
					options.sql = options.sql.replace ("$" + (i + 1), "#" + (i + 1));
				};
			};
		}) ();
		(function prepare () {
			let s = "", c, sql = "";
			for (let i = 0; i < options.sql.length; i ++) {
				c = options.sql [i];
				if (c == "$") {
					if (s) {
						s = s.substr (1);
						if (client.tags.hasOwnProperty (s)) {
							sql += client.tags [s];
						} else {
							sql += "$" + s + "$";
						};
						s = "";
					} else {
						s = c;
					};
				} else {
					if (s) {
						s += c;
					} else {
						sql += c;
					};
				};
			};
			if (s) {
				sql += s;
			};
			options.sql = sql;
		}) ();
		(function returnParams () {
			if (options.params) {
				for (let i = 0; i < options.params.length; i ++) {
					options.sql = options.sql.replace ("#" + (i + 1), "$" + (i + 1));
				};
			};
		}) ();
		client.query ({sql: options.sql, params: options.params, success: function (options) {
			if (!session || !storage.clientPool [session.id]) {
				if (!client.inStorage) {
					client.disconnect ();
				};
			};
			if (meOptions.success) {
				meOptions.success (options);
			}
		}, failure: function (err) {
			if (!session || !storage.clientPool [session.id]) {
				if (!client.inStorage) {
					client.disconnect ();
				};
			};
			if (meOptions.failure) {
				meOptions.failure (new VError (err, "Storage.query"));
			}
		}});
	};
	storage.maxRevision = 2147483647;
	storage.getCurrentFilter = function (options) {
		let filter;
		let alias = "";
		if (options && options.alias) {
			alias = options.alias + ".";
		};
		filter = "(" + alias + "fend_id = " + this.maxRevision + ")";		
		return filter;
	};
	storage.createRevision = function (options) {
		let success = options.success;
		let description = options.description;
		let session = options.session;
		let remoteAddr = options.remoteAddr || session.ip;
		let client = storage.clientPool [session.id];
		client.getNextId ({session: session, table: "trevision", success: function (options) {
			let id = options.id;
			storage.lastRevision = id;
			remoteAddr = remoteAddr ? "'" + remoteAddr + "'" : "null";
			session.userId = session.userId || "null";
			let s = 
				"insert into trevision (fid, fdate, fdescription, fsubject_id, fremote_addr)\n" + 
				"values (" + id + ", " + client.currentTimestamp () + ", '" + description + "', " + session.userId + ", " + remoteAddr + ")";
			storage.query ({session: session, sql: s, success: function (options) {
				if (success) {
					success ({id: id});
				};
			}, failure: function (err) {
				if (options.failure) {
					options.failure (new VError (err, "Storage.createRevision"));
				};
			}});
		}, failure: function (err) {
			if (options.failure) {
				options.failure (new VError (err, "Storage.createRevision"));
			};
		}});
	};
	storage.inTransaction = function (session) {
		return storage.clientPool [session.id];
	};
	storage.startTransaction = function (options, cb) {
		options = options || {};
		options.session = options.session || {};
		let success = options.success;
		let failure = options.failure;
		let session = options.session;
		log.debug ({cls: "Storage", fn: "startTransaction", params: options.description});
		async.series ([
			function (cb) {
				if (storage.clientPool [session.id]) {
					storage.rollbackTransaction ({session: session, success: function () {
						cb ();
					}, failure: cb});
				} else {
					cb ();
				};
			}
		], function (err, results) {
			let client = db.create (storage);
			client.connect ({success: function () {
				client.startTransaction ({success: function () {
					storage.clientPool [session.id] = client;
					options.success = function (options) {
						storage.revision [session.id] = options.id;
						storage.revisions [options.id] = {
							id: options.id, 
							dirty: true, // after commitTransaction = true
							objects: {
								changed: [], // changed, removed
								created: [], // createObject
								removed: [], // commit.removed
								classId: {} // objectId: classId
							},
							classes: {
								changed: [],
								created: [],
								removed: []
							},
							classAttrs: {
								changed: [],
								created: [],
								removed: []
							},
							views: {
								changed: [],
								created: [],
								removed: []
							},
							viewAttrs: {
								changed: [],
								created: [],
								removed: []
							}
						};
						if (cb) {
							cb (null, options.id);
						} else
						if (success) {
							success ({revision: options.id});
						}
					};
					options.failure = function (err) {
						if (cb) {
							cb (new VError (err, "Storage.startTransaction"));
						} else
						if (failure) {
							failure (new VError (err, "Storage.startTransaction"));
						};
					};
					storage.createRevision (options);
				}, failure: function (err) {
					if (cb) {
						cb (new VError (err, "Storage.startTransaction"));
					} else
					if (failure) {
						failure (new VError (err, "Storage.startTransaction"));
					};
				}});
			}, failure: function (err) {
				if (cb) {
					cb (new VError (err, "Storage.startTransaction"));
				} else
				if (failure) {
					failure (new VError (err, "Storage.startTransaction"));
				};
			}});
		});
	};
	// Commit transaction
	storage.commitTransaction = function (options, cb) {
		log.debug ({cls: "Storage", fn: "commitTransaction"});
		options = options || {};
		options.session = options.session || {};
		let session = options.session;
		let failure = options.failure;
		if (storage.revision [session.id]) {
			let client = storage.clientPool [session.id];
			if (client) {
				client.commitTransaction ({success: function () {
					delete storage.clientPool [session.id];
					client.disconnect ();
					let revision = storage.revision [session.id];
					if (storage.revisions [revision]) {
						storage.revisions [revision].dirty = false;
						storage.redisPub.publish (config.redis.db + "-" + storage.code + "-revisions", JSON.stringify (storage.revisions [revision]));
					};
					delete storage.revision [session.id];
					if (cb) {
						cb (null, revision);
					} else
					if (options.success) {
						options.success ({revision: revision});
					}			
				}, failure: function (err) {
					if (cb) {
						cb (new VError (err, "Storage.commitTransaction"));
					} else
					if (failure) {
						failure (new VError (err, "Storage.commitTransaction"));
					};
				}});
			} else {
				delete storage.clientPool [session.id];
				if (cb) {
					cb ();
				} else
				if (options.success) {
					options.success ({});
				}			
			};
		} else {
			if (cb) {
				cb ();
			} else
			if (options.success) {
				options.success ({});
			}			
		};
	};
	// Rollback transaction
	storage.rollbackTransaction = function (options, cb) {
		log.debug ({cls: "Storage", fn: "rollbackTransaction"});
		options = options || {};
		options.session = options.session || {};
		let session = options.session;
		if (storage.revision [session.id]) {
			let client = storage.clientPool [session.id];
			if (!client) {
				// removeTimeoutSessions exception
				let revision = storage.revision [session.id];
				delete storage.revisions [revision];
				delete storage.revision [session.id];
				if (cb) {
					cb (null, revision);
				} else
				if (options.success) {
					options.success ({revision: revision});
				};
				return;
			};
			client.rollbackTransaction ({success: function () {
				delete storage.clientPool [session.id];
				client.disconnect ();
				let revision = storage.revision [session.id];
				delete storage.revisions [revision];
				delete storage.revision [session.id];
				if (cb) {
					cb (null, revision);
				} else
				if (options.success) {
					options.success ({revision: revision});
				}			
			}, failure: function (err) {
				if (cb) {
					cb (new VError (err, "Storage.rollbackTransaction"));
				} else
				if (options.failure) {
					options.failure (new VError (err, "Storage.rollbackTransaction"));
				};
			}});
		} else {
			if (cb) {
				cb ();
			} else
			if (options.success) {
				options.success ({});
			}			
		};
	};
	// Список классов
	storage.classes = null;
	// Карта классов по id
	storage.classesMap = null;
	// Карта классов по code {'spr.task': classObject}
	storage.classesCode = null;
	// Дерево классов по кодам: {classCode: {classChildCode: ...}}
	storage.classesTree = null;
	// Init classes
	storage.initClasses = function (options) {
		log.debug ({cls: "Storage", fn: "initClasses"});
		options = options || {};
		let success = options.success;
		options.session = options.session || {};
		let session = options.session;
		storage.query ({session: session, sql: "select * from tclass where " + storage.getCurrentFilter (), success: function (options) {
			let rows = options.result.rows;
			// get fields
			let fields = [];
			for (let field in rows [0]) {
				fields.push (field);
			}
			// get storage.classes
			storage.classes = [];
			storage.classesMap = {};
			for (let i = 0; i < rows.length; i ++) {
				let o = new storage.tobject ({code: "tclass"});
				for (let j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				o.childs = [];
				o.attrs = {};
				storage.classes.push (o);
				storage.classesMap [o.get ("fid")] = o;
			}
			// get storage.classesTree
			storage.classesTree = {};
			storage.classesCode = {};
			let getTree = function (options) {
				for (let i = 0; i < storage.classes.length; i ++) {
					let o = storage.classes [i];
					if (o.get ("fparent_id") == options.parent) {
						if (options.parent) {
							storage.classesMap [options.parent].childs.push (o.get ("fid"));
						}
						options.node [o.get ("fcode")] = {id: o.get ("fid")};
						let code = options.code ? options.code + "." + o.get ("fcode") : o.get ("fcode");
						storage.classesCode [code] = o;
						let tokens = code.split (".");
						if (tokens.length == 3) {
							storage.classesCode [tokens [0] + "." + tokens [2]] = storage.classesCode [tokens [0] + "." + tokens [2]] || o;
						}
						if (tokens.length == 4) {
							storage.classesCode [tokens [0] + "." + tokens [3]] = storage.classesCode [tokens [0] + "." + tokens [3]] || o;
						}
						getTree ({node: options.node [o.get ("fcode")], parent: o.get ("fid"), code: code});
					}
				}
			}
			getTree ({node: storage.classesTree, parent: null});
			if (success) {
				success ();
			}
		}});	
	};
	storage.getClassFullCode = function (o) {
		if (!o) {
			return o;
		};
		let n = o.get ("fcode");
		if (o.get ("fparent_id")) {
			n = storage.getClassFullCode (storage.classesMap [o.get ("fparent_id")]) + "." + n;
		};
		return n;
	};
	storage.updateClassCache = function (options) {
		let fields = options.fields;
		let values = options.values;
		let o = storage.classesMap [values [0]] || (new storage.tobject ({code: "tclass"}));
		if (values [1]) {
			storage.classesMap [values [1]].childs.splice (
				storage.classesMap [values [1]].childs.indexOf (values [0], 1)
			);
		};
		for (let i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		};
		o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
		if (!storage.classesMap [o.get ("fid")]) {
			o.childs = [];
			o.attrs = {};
			storage.classes.push (o);
			storage.classesMap [o.get ("fid")] = o;
		};
		if (o.get ("fparent_id")) {
			if (storage.classesMap [o.get ("fparent_id")].childs.indexOf (o.get ("fid")) == -1) {
				storage.classesMap [o.get ("fparent_id")].childs.push (o.get ("fid"));
			};
			let code = storage.getClassFullCode (o);
			storage.classesCode [code] = o;
			let tokens = code.split (".");
			if (tokens.length == 3) {
				storage.classesCode [tokens [0] + "." + tokens [2]] = storage.classesCode [tokens [0] + "." + tokens [2]] || o;
			};
			if (tokens.length == 4) {
				storage.classesCode [tokens [0] + "." + tokens [3]] = storage.classesCode [tokens [0] + "." + tokens [3]] || o;
			};
		} else {
			storage.classesCode [o.get ("fcode")] = o;
		};
	};
	storage.updateClassAttrCache = function (options) {
		let fields = options.fields;
		let values = options.values;
		let o = storage.classAttrsMap [values [0]] || (new storage.tobject ({code: "tclass_attr"}));
		if (storage.classesMap [values [1]]) {
			let removeClassAttr = function (oClass) {
				oClass.attrs = oClass.attrs || {};
				delete oClass.attrs [values [3]];
				for (let i = 0; i < oClass.childs.length; i ++) {
					removeClassAttr (storage.classesMap [oClass.childs [i]]);
				}
			};
			removeClassAttr (storage.classesMap [values [1]]);
		};
		for (let i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		}
		o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
		if (!storage.classAttrsMap [o.get ("fid")]) {
			storage.classAttrs.push (o);
			storage.classAttrsMap [o.get ("fid")] = o;
		};
		if (storage.classesMap [o.get ("fclass_id")]) {
			let addClassAttr = function (oClass) {
				oClass.attrs = oClass.attrs || {};
				oClass.attrs [o.get ("fcode")] = o;
				for (let i = 0; i < oClass.childs.length; i ++) {
					addClassAttr (storage.classesMap [oClass.childs [i]]);
				}
			};
			addClassAttr (storage.classesMap [o.get ("fclass_id")]);
		};
	};
	storage.getViewFullCode = function (o) {
		if (!o) {
			return o;
		};
		let n = o.get ("fcode");
		if (o.get ("fparent_id")) {
			n = storage.getViewFullCode (storage.viewsMap [o.get ("fparent_id")]) + "." + n;
		};
		return n;
	};
	storage.updateViewCache = function (options) {
		let fields = options.fields;
		let values = options.values;
		let o = storage.viewsMap [values [0]] || (new storage.tobject ({code: "tview"}));
		for (let i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		}
		if (!storage.viewsMap [o.get ("fid")]) {
			o.attrs = {};
			storage.views.push (o);
			storage.viewsMap [o.get ("fid")] = o;
		};
		if (o.get ("fparent_id")) {
			let code = storage.getViewFullCode (o);
			storage.viewsCode [code] = o;
			let tokens = code.split (".");
			if (tokens.length == 3) {
				storage.viewsCode [tokens [0] + "." + tokens [2]] = storage.viewsCode [tokens [0] + "." + tokens [2]] || o;
			};
			if (tokens.length == 4) {
				storage.viewsCode [tokens [0] + "." + tokens [3]] = storage.viewsCode [tokens [0] + "." + tokens [3]] || o;
			};
		} else {
			storage.viewsCode [o.get ("fcode")] = o;
		};
	};
	storage.updateViewAttrCache = function (options) {
		let fields = options.fields;
		let values = options.values;
		let o = storage.viewAttrsMap [values [0]] || (new storage.tobject ({code: "tview_attr"}));
		for (let i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		};
		if (!storage.viewAttrsMap [o.get ("fid")]) {
			storage.viewAttrs.push (o);
			storage.viewAttrsMap [o.get ("fid")] = o;
		};
		let oView = storage.viewsMap [o.get ("fview_id")];
		if (oView) {
			oView.attrs = oView.attrs || {};
			oView.attrs [o.get ("fcode")] = o;
		};
	};
	// Список атрибутов классов
	storage.classAttrs = null;
	// Карта атрибутов классов
	storage.classAttrsMap = null;
	// Init classAttrs
	storage.initClassAttrs = function (options) {
		log.debug ({cls: "storage", fn: "initClassAttrs"});
		options = options || {};
		let success = options.success;
		options.session = options.session || {};
		let session = options.session;
		storage.query ({session: session, sql: "select * from tclass_attr where " + storage.getCurrentFilter (), success: function (options) {
			let rows = options.result.rows;
			// get fields
			let fields = [];
			for (let field in rows [0]) {
				fields.push (field);
			}
			// get storage.classAttrs
			storage.classAttrs = [];
			storage.classAttrsMap = {};
			for (let i = 0; i < rows.length; i ++) {
				let o = new storage.tobject ({code: "tclass_attr"});
				for (let j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				storage.classAttrs.push (o);
				storage.classAttrsMap [o.get ("fid")] = o;
				if (storage.classesMap [o.get ("fclass_id")]) {
					let addClassAttr = function (oClass) {
						oClass.attrs = oClass.attrs || {};
						oClass.attrs [o.get ("fcode")] = o;
						for (let i = 0; i < oClass.childs.length; i ++) {
							addClassAttr (storage.classesMap [oClass.childs [i]]);
						}
					};
					addClassAttr (storage.classesMap [o.get ("fclass_id")]);
				}
			}
			if (success) {
				success ();
			}
		}});	
	};
	// Список представлений
	storage.views = null;
	// Карта представлений по id
	storage.viewsMap = null;
	// Карта представлений по code {'spr.task': viewObject}
	storage.viewsCode = null;
	// Дерево представлений по кодам: {viewCode: {viewChildCode: ...}}
	storage.viewsTree = null;
	storage.initViews = function (options) {
		log.debug ({cls: "storage", fn: "initViews"});
		options = options || {};
		let success = options.success;
		options.session = options.session || {};
		let session = options.session;
		storage.query ({session: session, sql: "select * from tview where " + storage.getCurrentFilter (), success: function (options) {
			let rows = options.result.rows;
			let fields = [];
			for (let field in rows [0]) {
				fields.push (field);
			}
			storage.views = [];
			storage.viewsMap = {};
			for (let i = 0; i < rows.length; i ++) {
				let o = new storage.tobject ({code: "tview"});
				for (let j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				storage.views.push (o);
				storage.viewsMap [o.get ("fid")] = o;
			}
			storage.viewsTree = {};
			storage.viewsCode = {};
			let getTree = function (options) {
				for (let i = 0; i < storage.views.length; i ++) {
					let o = storage.views [i];
					if (o.get ("fparent_id") == options.parent) {
						options.node [o.get ("fcode")] = {id: o.get ("fid")};
						let code = options.code ? options.code + "." + o.get ("fcode") : o.get ("fcode");
						storage.viewsCode [code] = o;
						if (code) {
							let tokens = code.split (".");
							if (tokens.length == 3) {
								storage.viewsCode [tokens [0] + "." + tokens [2]] = storage.viewsCode [tokens [0] + "." + tokens [2]] || o;
							}
							if (tokens.length == 4) {
								storage.viewsCode [tokens [0] + "." + tokens [3]] = storage.viewsCode [tokens [0] + "." + tokens [3]] || o;
							}
						};
						getTree ({node: options.node [o.get ("fcode")], parent: o.get ("fid"), code: code});
					}
				}
			}
			getTree ({node: storage.viewsTree, parent: null});
			if (success) {
				success ();
			}
		}});	
	};
	// Список атрибутов представлений
	storage.viewAttrs = null;
	// Карта атрибутов представлений
	storage.viewAttrsMap = null;
	storage.initViewAttrs = function (options) {
		log.debug ({cls: "storage", fn: "initViewAttrs"});
		options = options || {};
		let success = options.success;
		options.session = options.session || {};
		let session = options.session;
		storage.query ({session: session, sql: "select * from tview_attr where " + storage.getCurrentFilter (), success: function (options) {
			let rows = options.result.rows;
			let fields = [];
			for (let field in rows [0]) {
				fields.push (field);
			}
			storage.viewAttrs = [];
			storage.viewAttrsMap = {};
			for (let i = 0; i < rows.length; i ++) {
				let o = new storage.tobject ({code: "tview_attr"});
				for (let j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				if (o.get ("fcode") == null) {
					continue;
				};
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				storage.viewAttrs.push (o);
				storage.viewAttrsMap [o.get ("fid")] = o;
				if (storage.viewsMap [o.get ("fview_id")]) {
					storage.viewsMap [o.get ("fview_id")].attrs = storage.viewsMap [o.get ("fview_id")].attrs || {};
					storage.viewsMap [o.get ("fview_id")].attrs [o.get ("fcode")] = o;
				}
			}
			if (success) {
				success ();
			}
		}});	
	};
	// options: {node, path}
	// todo: не понимает коротких путей
	storage.findNode = function (options) {
		log.debug ({cls: "storage", fn: "findNode"});
		let node = options.node;
		let path = options.path;
		let foundNode;
		if (typeof (path) == "string") {
			path = path.split (".");
		};		
		let key = path [0];
		if (node.hasOwnProperty (key)) {
			if (path.length > 1) {
				path.splice (0, 1);
				foundNode = storage.findNode ({node: node [key], path: path});
			} else {
				foundNode = node [key];
			};
		}
		if (typeof (foundNode) == "object") {
			foundNode = foundNode.id;
		}
		return foundNode;
	};
	// Получение класса
	// options: {classCode or code}
	storage.getClass = function (options) {
		log.debug ({cls: "storage", fn: "getClass"});
		if (typeof (options) == "number") {
			if (storage.classesMap [options]) {
				return storage.classesMap [options];
			} else {
				throw new VError ("storage.getClass - Unknown classId: " + options);
			}
		} else {
			if (typeof (options) == "string") {
				options = {code: options};
			};
			let code = options.classCode || options.code;
			if (storage.classesCode [code]) {
				return storage.classesCode [code];
			} else {
				if (storage.classesMap [code]) {
					return storage.classesMap [code];
				} else {
					throw new VError ("storage.getClass - Unknown classCode: " + code);
				}
			}
		};
	};
	// Получение атрибута класса
	// options: {classCode (classId), attrCode}
	storage.getClassAttr = function (options) {
		log.debug ({cls: "storage", fn: "getClassAttr (" + JSON.stringify (options) + ")"});
		if (typeof (options) == "number") {
			if (storage.classAttrsMap [options]) {
				return storage.classAttrsMap [options];
			} else {
				throw new Error ("storage.getClassAttr - Unknown classAttrId: " + options);
			}
		} else {
			let oClass;
			if (options.classCode) {
				oClass = storage.classesCode [options.classCode];
			} else {
				oClass = storage.classesMap [options.classId];
			}
			if (oClass) {
				function getAttr (o) {
					if (o.attrs && o.attrs [options.attrCode]) {
						return o.attrs [options.attrCode];
					} else {
						if (o.get ("fparent_id")) {
							return getAttr (storage.classesMap [o.get ("fparent_id")]);
						} else {
							throw new Error ("storage.getClassAttr - Unknown attrCode: " + options.attrCode + " (classId: " + (options.classId || options.classCode) + ")");
						}
					}
				};
				let o = getAttr (oClass)
				return o;
			} else {
				throw new Error ("storage.getClassAttr - Unknown classCode: " + options.classCode + " (classId: " + options.classId || options.classCode + ")");
			}
		};
	};
	// {session, id, success}
	storage.getObject = function (options, cb) {
		log.debug ({cls: "Storage", fn: "getObject", id: options.id});
		options = options || {};
		let success = options.success;
		let failure = options.failure;
		let objectId = options.id;
		options.session = options.session || {};
		let session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		let revision = session.revision;
		if (!objectId || Number (objectId) == NaN) {
			if (cb) {
				cb (null, null);
			} else
			if (success) {
				success ({object: null});
			};
			return;
		};
		let object;
		async.series ([
			function (cb) {
				storage.redisClient.hmget (storage.code + "-objects" + (revision || ""), [objectId + "-data"], function (err, result) {
					let o = new storage.tobject ({code: "tobject"});
					if (result && result [0]) {
						o.data = eval ("(" + result [0] + ")");
						o.originalData = {};
						for (let attr in o.data) {
							o.originalData [attr] = o.data [attr];
						}
						object = o;
						cb ();
					} else {
						if (revision) {
							// time machine
							let cls, row;
							async.series ([
								function (cb) {
									storage.query ({session: session, sql: 
										"select fclass_id from tobject where fid=" + objectId
									, success: function (options) {
										cls = storage.getClass (options.result.rows [0].fclass_id);
										cb ();
									}});
								},
								function (cb) {
									let fields = [];
									function addFields (attrs) {
										for (let attr in attrs) {
											fields.push (attrs [attr].toc);
										};
									};
									addFields (cls.attrs);
									let joins = "";
									function addJoins (parent) {
										if (parent) {
											let clsParent = storage.getClass (parent);
											joins += "left join tm_" + clsParent.toc + " on (tm_" + clsParent.toc + ".fobject_id=tm_" + cls.toc + ".fobject_id and tm_" + clsParent.toc + ".frevision_id=tm_" + cls.toc + ".frevision_id)\n";
											addFields (clsParent.attrs);
											addJoins (clsParent.get ("fparent_id"));
										};
									};
									addJoins (cls.get ("fparent_id"));
									let s = 
										"select " + fields.join (", ") + " from tm_" + cls.toc + "\n" +
										joins +
										"where tm_" + cls.toc + ".fobject_id=" + objectId + " and tm_" + cls.toc + ".frevision_id=" + revision
									;
									storage.query ({session: session, sql: s, success: function (options) {
										row = options.result.rows [0];
										cb ();
									}});
								},
								function (cb) {
									o.data.id = objectId;
									o.data.fclass_id = cls.get ("fid");
									for (let attr in cls.attrs) {
										let ca = cls.attrs [attr];
										o.data [attr] = row [ca.toc];
										o.originalData [attr] = row [ca.toc];
									};
									let hdata = {};
									hdata [objectId + "-data"] = o.dataToJSONString (true);
									storage.redisClient.hmset (storage.code + "-objects" + revision, hdata);
									object = o;
									cb ();
								}
							], function (err) {
								cb ();
							});
						} else {
							let select = "select a.fclass_attr_id, a.fstring, a.ftime, fnumber, b.fclass_id";
							storage.query ({session: session, sql: 
								select + "\n" +
								"from tobject b\n" +
								"left join tobject_attr a on (a.fobject_id=b.fid and " + storage.getCurrentFilter ({alias: "a"}) + ")\n" +
								"where b.fid=" + objectId + " and " + storage.getCurrentFilter ({alias: "b"})
							, success: function (options) {
								if (!options || !options.result || !options.result.rows || options.result.rows.length == 0) {
									object = null;
									cb ();
								} else {
									let rows = options.result.rows;
									o.data.id = objectId;
									o.data.fclass_id = rows [0].fclass_id;
									for (let i = 0; i < rows.length; i ++) {
										if (!rows [i].fclass_attr_id) {
											continue;
										};
										let classAttr = storage.classAttrsMap [rows [i].fclass_attr_id];
										if (!classAttr) {
											// Deleted class attr
											continue;
										}
										let value;
										if (classAttr.get ("ftype_id") == 1 || classAttr.get ("ftype_id") == 5) {
											value = rows [i].fstring;
										} else
										if (classAttr.get ("ftype_id") == 3) {
											value = rows [i].ftime;
										} else {
											value = rows [i].fnumber;
										}
										o.data [classAttr.get ("fcode")] = value;
										o.originalData [classAttr.get ("fcode")] = value;
									}
									if (!storage.revision [session.id]) {
										let hdata = {};
										hdata [objectId + "-data"] = o.dataToJSONString (true);
										storage.redisClient.hmset (storage.code + "-objects", hdata);
									};
									object = o;
									cb ();
								}
							}, failure: cb});
						};
					}
				});
			}
		], function (err, results) {
			if (err) {
				if (cb) {
					cb (new VError (err, "storage.getObject"));
				} else {
					success ({object: null});
				};
			} else {
				if (cb) {
					cb (null, object);
				} else {
					success ({object: object});
				};
			};
		});
	},
	storage.createObject = function (options, cb) {
		if (typeof (options) == "string") {
			options = {code: options};
		};
		log.debug ({cls: "Storage", fn: "createObject", params: options.classId || options.code});
		options = options || {};
		let mainOptions = options;
		let success = options.success;
		let failure = options.failure;
		let classId = options.classId || storage.getClass (options.code).get ("fid");
		let userOptions = options.options || {};
		options.session = options.session || {};
		let session = options.session;
		async.series ([
			function (cb) {
				cb ();
			}
		], function (err, results) {
			if (err == "cancel" || !storage.revision [session.id]) {
				console.log ("cancel or no transaction, session " + JSON.stringify (session));
				if (cb) {
					cb (null, null);
				} else {
					success ({object: null});
				};
				return;
			};
			storage.clsChange ({classId: classId});
			storage.client.getNextId ({session: session, table: "tobject", success: function (options) {
				let sql = [];
				let objectId = mainOptions.objectId || options.id;
				sql.push (
					"insert into tobject (fid, fclass_id, fstart_id, fend_id)\n" +
					"values (" + objectId + "," + classId + "," + storage.revision [session.id] + "," + storage.maxRevision + ")"
				);
				let insertTOC = function (options) {
					let classObject = storage.classesMap [options.classId];
					let tocName = classObject.get ("fcode") + "_" + options.classId;
					sql.push ("insert into " + tocName + " (fobject_id) values (" + objectId + ")");
					if (classObject.get ("fparent_id")) {
						insertTOC ({classId: classObject.get ("fparent_id")});
					}
				};
				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
					insertTOC ({classId: classId});
				};
				async.eachSeries (sql, function (sql, cb) {
					storage.query ({session: session, sql: sql, success: function (result) {
						cb ();
					}, failure: cb});
				}, function (err) {
					if (err) {
						if (cb) {
							cb (new VError (err, "Storage.createObject"));
						} else
						if (failure) {
							failure (new VError (err, "Storage.createObject"));
						};
					} else {
						if (cb || success) {
							let o = new storage.tobject ({code: "tobject"});
							o.data.id = objectId;
							o.data.fclass_id = classId;
							userOptions.object = o;
							let hdata = {};
							hdata [objectId + "-data"] = o.dataToJSONString ();
							storage.redisClient.hmset (storage.code + "-objects", hdata);
							if (storage.revisions [storage.revision [session.id]]) {
								storage.revisions [storage.revision [session.id]].objects.created.push (objectId);
								storage.revisions [storage.revision [session.id]].objects.classId [objectId] = classId;
							};
							if (cb) {
								cb (null, userOptions.object);
							} else {
								success (userOptions);
							};
						}
					};
				});
			}, failure: function (err) {
				if (cb) {
					cb (new VError (err, "Storage.createObject"));
				} else
				if (failure) {
					failure (new VError (err, "Storage.createObject"));
				};
			}});	
		})
	},
	// Object class
	storage.tobject = function (options) {
		let me = this;
		me.code = options.code;
		me.data = {};
		me.originalData = {};
		me.removed = false;
	};
	// get attr
	storage.tobject.prototype.get = function (attrCode) {
		return this.data [attrCode];
	};
	// set attr
	storage.tobject.prototype.set = function (attrCode, value) {
		this.data [attrCode] = value;
	};
	storage.getClassAttrs = function (options) {
		log.debug ({cls: "storage", fn: "getClassAttrs"});
		options.result = options.result || {};
		for (let i = 0; i < storage.classAttrs.length; i ++) {
			if (storage.classAttrs [i].get ("fclass_id") == options.classId) {
				options.result [storage.classAttrs [i].get ("fcode")] = storage.classAttrs [i];
			}
		}
		if (storage.classesMap [options.classId].get ("fparent_id")) {
			options.classId = storage.classesMap [options.classId].get ("fparent_id");
			storage.getClassAttrs (options);
		}
		return options.result;
	};
	storage.getDependentObjects = function (options) {
		let session = options.session;
		let object = options.object;
		let success = options.success;
		let failure = options.failure;
		// classes
		let getParentClasses = function (classId) {
			let r = [classId];
			let o = storage.classesMap [classId];
			if (o.get ("fparent_id")) {
				r = r.concat (getParentClasses (o.get ("fparent_id")));
			}
			return r;
		};
		let getChildClasses = function (classId) {
			let r = [classId];
			let o = storage.classesMap [classId];
			for (let i = 0; i < o.childs.length; i ++) {
				r = r.concat (getChildClasses (storage.classesMap [o.childs [i]].get ("fid")));
			}
			return r;
		};
		let classes = getParentClasses (object.data.fclass_id).concat (getChildClasses (object.data.fclass_id));
		classes.push (12); // Object
		// classAttrs
		let classAttrs = [];
		for (let i = 0; i < storage.classAttrs.length; i ++) {
			let ca = storage.classAttrs [i];
			if (classes.indexOf (ca.get ("ftype_id")) > -1) {
				classAttrs.push (ca.get ("fid"));
			}
		}
		if (classAttrs.length) {
			let cascade = []; // objects for cascade removing
			let setnull = []; // objects for set null
			storage.query ({session: session, sql: 
				"select fobject_id, fclass_attr_id from tobject_attr\n" +
				"where fclass_attr_id in (" + classAttrs.join (",") + ") and fnumber=" + object.data.id + " and " + storage.getCurrentFilter () + "\n"
			, success: function (options) {
				let rows = options.result.rows;
				for (let i = 0; i < rows.length; i ++) {
					let ca = storage.classAttrsMap [rows [i].fclass_attr_id];
					let removeRule = ca.get ("fremove_rule");
					if (removeRule == "cascade") {
						cascade.push (rows [i].fobject_id);
					} else {
						setnull.push ({id: rows [i].fobject_id, attrCode: ca.get ("fcode")});
					}
				}
				success ({cascade: cascade, setnull: setnull});
			}, failure: function (err) {
				if (failure) {
					failure (new VError (err, "Storage.getDependentObjects"));
				};
			}});
		} else {
			success ({cascade: cascade, setnull: setnull});
		}
	};
	// {session, object, success}
	storage.removeObject = function (options) {
		let session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		let removeSingleObject = function (options) {
			let object = options.object;
			let objectId = object.data.id;
			let success = options.success;
			let failure = options.failure;
			let sql = [];
			sql.push ("update tobject set fend_id=" + storage.revision [session.id] + " where fend_id=" + storage.maxRevision + " and fid=" + objectId);
			let deleteTOC = function (options) {
				let classObject = storage.classesMap [options.classId];
				let tocName = classObject.get ("fcode") + "_" + options.classId;
				sql.push ("delete from " + tocName + " where fobject_id=" + objectId);
				if (classObject.get ("fparent_id")) {
					deleteTOC ({classId: classObject.get ("fparent_id")});
				}
			};
			if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
				deleteTOC ({classId: object.data.fclass_id});
			};
			async.map (sql, function (s, cb) {
				storage.query ({session: session, sql: s, success: function () {
					cb ();
				}, failure: cb});
			}, function (err, results) {
				if (err) {
					if (failure) {
						return failure (new VError (err, "Storage.removeSingleObject"));
					};
				};
				let oClass = storage.classesMap [object.data.fclass_id];
				let attrs = [];
				for (let a in object.originalData) {
					if (object.originalData [a]) {
						attrs.push (a);
					}
				}
				async.map (attrs, function (attr, cb) {
					let ca = oClass.attrs [attr];
					if (ca && ca.get ("funique")) {
						let key = storage.code + "-unique-" + ca.get ("fid");
						storage.redisClient.srem (key, object.originalData [attr], function (err, result) {
							cb ();
						});
					} else {
						cb ();
					}
				}, function (err, results) {
					storage.redisClient.hdel (storage.code + "-objects", objectId + "-data", function (err, result) {
						if (success) {
							success ();
						}
					});
				});
			});
		};
		let success = options.success;
		let failure = options.failure;
		let mainOptions = options;
		if (!options.object) {
			if (success) {
				success ({cascadeNum: 0, setnullNum: 0});
			}
			return;
		}
		let cascade;
		let cascadeNum;
		let setnull;
		let setnullNum;
		async.series ([
			function (cb) {
				cb ();
			},
			function (cb) {
				storage.suspendEvent ("beforeremoveobject");
				storage.getDependentObjects ({session: session, object: options.object, success: function (options) {
					cascade = options.cascade;
					cascadeNum = cascade ? cascade.length : 0;
					setnull = options.setnull;
					setnullNum = setnull.length;
					async.parallel ([
						function setNullAttrs (cb) {
							async.map (setnull, function (snObject, cb) {
								storage.getObject ({session: session, id: snObject.id, success: function (options) {
									let o = options.object;
									if (o) {
										o.set (snObject.attrCode, null);
										o.commit ({session: session, success: function () {
											cb ();
										}, failure: function (err) {
											cb ();
										}});
									} else {
										cb ();
									}
								}, failure: function (err) {
									cb ();
								}});
							}, function (err, results) {
								cb ();
							});
						},
						function removeCascadeObjects (cb) {
							async.map (cascade, function (objectId, cb) {
								storage.getObject ({session: session, id: objectId, success: function (options) {
									storage.removeObject ({session: session, object: options.object, success: function (options) {
										cascadeNum += options ? options.cascadeNum : 0;
										setnullNum += options ? options.setnullNum : 0;
										cb ();
									}, failure: function (err) {
										cb ();
									}});
								}, failure: function (err) {
									cb ();
								}});
							}, function (err, results) {
								cb ();
							});
						},
						function removeCurrentObject (cb) {
							mainOptions.success = function () {
								cb ();
							};
							mainOptions.failure = function () {
								cb ();
							};
							removeSingleObject (mainOptions);
						}
					], function (err, results) {
						cb ();
					});
				}, failure: cb});
			}
		], function (err, results) {
			storage.resumeEvent ("beforeremoveobject");
			if (err == "cancel") {
				if (success) {
					success ({cascadeNum: 0, setnullNum: 0});
				};
			} else {
				if (success) {
					success ({cascadeNum: cascadeNum, setnullNum: setnullNum});
				}
			};
		});
	};
	// save changes to database
	storage.tobject.prototype.commit = function (options, cb) {
		log.debug ({cls: "Object", fn: "commit"});
		options = options || {};
		options.session = options.session || {};
		let session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		let success = options.success;
		let failure = options.failure;
		let objectId = this.data.id;
		let object = this;
		async.series ([
			function (cb) {
				if (object.removed) {
					cb ();
				} else {
					cb ();
				};
			}
		], function (err, results) {
			if (err == "cancel" || !storage.revision [session.id]) {
				if (cb) {
					cb ();
				} else
				if (success) {
					success ();
				};
				return;
			};
			if (storage.revisions [storage.revision [session.id]]) {
				storage.revisions [storage.revision [session.id]].objects.changed.push (objectId);
				storage.revisions [storage.revision [session.id]].objects.classId [objectId] = object.get ("fclass_id");
			};
			if (object.removed) {
				if (storage.revisions [storage.revision [session.id]]) {
					storage.revisions [storage.revision [session.id]].objects.removed.push (objectId);
				};
				storage.clsChange ({session: session, classId: object.get ("fclass_id")});
				storage.removeObject ({session: session, object: object, success: function () {
					if (cb) {
						cb ();
					} else {
						success ();
					};
				}, failure: function (err) {
					if (cb) {
						cb (new VError (err, "Object.commit"));
					} else {
						failure (new VError (err, "Object.commit"));
					};
				}});
			} else {
				let attrs = [];
				for (let attr in object.data) {
					if (["id", "fclass_id"].indexOf (attr) > -1) {
						continue;
					}
					if (_.isDate (object.originalData [attr])) {
						object.originalData [attr] = common.getLocalISOString (object.originalData [attr]);
					}
					if (_.isDate (object.data [attr])) {
						object.data [attr] = common.getLocalISOString (object.data [attr]);
					}
					if (!object.originalData.hasOwnProperty (attr) || object.originalData [attr] != object.data [attr]) {
						attrs.push (attr);
					}
				}
				if (!attrs.length) {
					if (cb) {
						cb ();
					} else
					if (success) {
						success ();
					}
				} else {
					async.series ([
						function (cb) {
							let oClass = storage.classesMap [object.data.fclass_id];
							async.map (attrs, function (attr, cb) {
								let ca = oClass.attrs [attr];
								if (ca && ca.get ("funique")) {
									let key = storage.code + "-unique-" + ca.get ("fid");
									async.series ([
										function addNew (cb) {
											if (object.data [attr]) {
												storage.redisClient.sadd (key, object.data [attr], function (err, result) {
													if (result) {
														cb ();
													} else {
														cb ("value exists: " + object.data [attr]);
													}
												});
											} else {
												cb ();
											}
										},
										function removeOld (cb) {
											if (object.originalData [attr]) {
												storage.redisClient.srem (key, object.originalData [attr], function (err, result) {
													cb ();
												});
											} else {
												cb ();
											};
										}
									], function (err, results) {
										cb (err);
									});
								} else {
									cb ();
								}
							}, function (err, results) {
								cb (err);
							});
						},
						function (cb) {
							storage.clsChange ({session: session, classId: object.get ("fclass_id")});
							let classAttrs = storage.getClassAttrs ({classId: object.get ("fclass_id")});
							let toc = {};
							let sql = [], sqlU = [], sqlI = [];
							for (let i = 0; i < attrs.length; i ++) {
								let value = object.data [attrs [i]];
								if (value === true || value === false) {
									value = Number (value);
								}
								let ca = classAttrs [attrs [i]];
								if (!ca) {
									continue;
								}
								sqlU.push ({
									sql: "update tobject_attr set fend_id=" + storage.revision [session.id] + "\n" +
										"where fobject_id=" + objectId + " and fclass_attr_id=" + ca.get ("fid") + " and fend_id=" + storage.maxRevision
								});
								let valueField = "fnumber";
								if (ca.get ("ftype_id") == 1 || ca.get ("ftype_id") == 5) {
									valueField = "fstring";
								} else
								if (ca.get ("ftype_id") == 3) {
									valueField = "ftime";
									if (typeof (value) == "string" && (value || "").trim () == "") {
										value = null;
									}
								}
								if (valueField == "fnumber" && (isNaN (value) || value === "")) {
									value = null;
								};
								sqlI.push ({
									sql: "insert into tobject_attr (fobject_id, fclass_attr_id, " + valueField + ", fstart_id, fend_id)\n" +
										"values (" + objectId + "," + ca.get ("fid") + ", $1, " + storage.revision [session.id] + "," + storage.maxRevision + ")",
									params: [value]
								});
								let classId = ca.get ("fclass_id");
								toc [classId] = toc [classId] || {name: storage.classesMap [classId].get ("fcode") + "_" + ca.get ("fclass_id")};
								toc [classId].attrs = toc [classId].attrs || {};
								toc [classId].attrs [ca.get ("fcode") + "_" + ca.get ("fid")] = value;
							};
							sql = sqlU.concat (sqlI);
							let processObjectAttr = function (cb) {
								async.mapSeries (sql, function (s, cb) {
									storage.query ({session: session, sql: s.sql, params: s.params, success: function () {
										cb ();
									}, failure: cb});
								}, cb);
							};
							let tocArray = [];
							for (let classId in toc) {
								tocArray.push (toc [classId]);
							};
							let processTOC = function (cb) {
								async.mapSeries (tocArray, function (t, cb) {
									storage.query ({
										session: session,
										sql: "select fobject_id from " + t.name + " where fobject_id=" + objectId, 
										success: function (options) {
											if (options.result.rows.length == 0) {
												let fields = ["fobject_id"];
												let params = [objectId];
												let $params = "$1";
												for (let attr in t.attrs) {
													fields.push (attr);
													params.push (t.attrs [attr]);
													$params += ", $" + params.length;
												}
												storage.query ({
													session: session, 
													sql: "insert into " + t.name + " (" + fields.join (",") + ") values (" + $params + ")",
													params: params,
													success: function () {
														cb ();
													},
													failure: function () {
														cb ();
													}
												});
											} else {
												let fields = [];
												let params = [];
												for (let attr in t.attrs) {
													let value = t.attrs [attr];
													if (value === "") {
														value = null;
													}
													params.push (value);
													fields.push (attr + "=$" + params.length);
												}
												storage.query ({
													session: session, 
													sql: "update " + t.name + " set " + fields.join (",") + "\n" +
														"where fobject_id=" + objectId,
													params: params,
													success: function () {
														cb ();
													},
													failure: function () {
														cb ();
													}
												});
											}
										},
										failure: cb
									});
								}, function (err, results) {
									cb (err);
								});
							};
							let functions = [processObjectAttr, processTOC];
				   			//if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
							//	functions = [processObjectAttr];
				   			//};
							async.series (functions, function (err, results) {
								cb (err);
							});
						}
					], function (err, results) {
						if (err) {
							if (cb) {
								cb (new VError (err, "Object.commit"));
							} else
							if (failure) {
								failure (new VError (err, "Object.commit"));
							} else {
								log.error ({cls: "Object", fn: "commit", err: err});
								if (success) {
									success ();
								};
							}
						} else {
							storage.redisClient.hdel (storage.code + "-objects", objectId + "-data");
							if (cb) {
								cb ();
							} else
							if (success) {
								success ();
							}
						}
					});
				};
			};
		});
	};
	storage.tobject.prototype.sync = function (options, cb) {
		this.commit.call (this, options, cb);
	};
	// remove object
	storage.tobject.prototype.remove = function () {
		this.removed = true;
	};
	storage.tobject.prototype.dataToJSONString = function (utc) {
		let r;
		for (let attr in this.data) {
			if (!r) {
				r = "{";
			} else {
				r += ",";
			}
			r += '"' + attr + '":' + common.ToJSONString (this.data [attr], utc);
		}
		r += "}";
		return r;
	};
	storage.dataId = {};
	// Получить ид через код
	// options: {classCode, code}
	storage.getId = function (options) {
		log.debug ({cls: "storage", fn: "getId"});
		options = options || {};
		options.session = options.session || {};
		let session = options.session;
		let success = options.success;
		let failure = options.failure;
		let classCode = options.classCode;
		let valueCode = options.valueCode || options.code;
		if (!valueCode) {
			success ({id: null});
			return;
		};
		function returnResult () {
			if (storage.dataId.hasOwnProperty (classCode) && storage.dataId [classCode].hasOwnProperty (valueCode)) {
				log.trace ({cls: "storage", fn: "getId", classCode: classCode, valueCode: valueCode}, storage.dataId [classCode][valueCode]);
				success ({id: storage.dataId [classCode][valueCode]});
			} else {
				log.trace ({cls: "storage", fn: "getId", classCode: classCode, valueCode: valueCode}, "unknown");
				let e = {error: "unknown value. classCode: " + classCode + ", valueCode: " + valueCode, module: "storage", fn: "getId"};
				if (failure) {
					failure (e);
				} else {
					success ({id: null});
				}
			}
		};
		if (storage.dataId [classCode] == null) {
			storage.execute ({sql: {
				"select": [
					{"a":"id"}, "id",
					{"a":"code"}, "code"
				],
				"from": [
					{"a": classCode}
				]
			}, success: function (r) {
				storage.dataId [classCode] = {};
				for (let i = 0; i < r.length; i ++) {
					storage.dataId [classCode][r.get (i, "code")] = r.get (i, "id");
				};
				returnResult ();
			}});
		} else {
			returnResult ();
		};
	};	
	// {sql: {select, from (inner-join, left-join), where, order}, success}
	storage.execute = function (options, cb) {
		let mainOptions = options;
		let success = options.success;
		let failure = options.failure;
		let session = options.session;
		options.storage = storage;
		storage.addOrderId (options.sql);
		let query = new Query (options);
		query.generate ();
		let fields = query.fields;
		let sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
		// todo: limit for mssql
		if (storage.client.database != "mssql") {
			sql += "\nlimit " + (options.sql.limit || config.query.maxRowNum) + " offset " + (options.sql.offset || "0") + "\n";
		};
		storage.query ({session: session, sql: sql, success: function (options) {
			if (mainOptions.resultText) {
				let r = "[";
				if (options.result) {
					let rows = options.result.rows;
					for (let i = 0; i < rows.length; i ++) {
						if (i) {
							r += ",";
						}
						r += "[";
						for (let j = 0; j < fields.length; j ++) {
							if (j) {
								r += ",";
							}
							r += common.ToJSONString (rows [i][fields [j]]);
						}
						r += "]";
					}
				}
				r += "]";
				if (cb) {
					cb (null, r);
				} else {
					success ({result: r});
				}
			} else
			if (mainOptions.asArray || mainOptions.sql.asArray) {
				let attrs = [];
				_.each (mainOptions.sql.select, function (s) {
					if (typeof (s) == "string") {
						attrs.push (s);
					}
				});
				let recs = [];
				_.each (options.result.rows, function (row) {
					let rec = {};
					_.each (fields, function (f, i) {
						rec [attrs [i]] = row [f];
					});
					recs.push (rec);
				});
				if (cb) {
					cb (null, recs);
				} else {
					success (recs);
				}
			} else {
				if (options && options.result && options.result.rows) {
					options.rows = options.result.rows;
					options.length = options.rows.length;
					options.get = function (i, f) {
						if (i >= options.length) {
							return null;
						};
						return options.rows [i][f + "_"];
					};
				};
				if (cb) {
					cb (null, options);
				} else {
					success (options);
				}
			}
		}, failure: function (err) {
			if (cb) {
				cb (new VError (err, "Storage.execute"));
			} else
			if (failure) {
				failure (new VError (err, "Storage.execute"));
			} else {
				throw new Error ("storage.execute: " + err);
			};
		}});
	};
	storage.prepareSQLForCount = function (sql, total) {
		function getAlias (o) {
			let a;
			for (a in o) {
				if (a != "distinct") {
					break;
				}
			}
			return a;
		};
		function isAliasInArray (arr, a) {
			if (!_.isArray (arr)) {
				return false;
			}
			for (let i = 0; i < arr.length; i ++) {
				let o = arr [i];
				if (_.isArray (o)) {
					let r = isAliasInArray (o, a);
					if (r) {
						return r;
					}
				}
				if (_.isObject (o) && getAlias (o) == a) {
					return true;
				}
			}
			return false;
		};
		function isAliasInLeftJoins (joins, alias) {
			let has = false;
			_.each (joins, function (v, a) {
				if (v && v [0] != "inner-join" && a != alias && isAliasInArray (v, alias)) {
					has = true;
				}
			});
			return has;
		};
		function getJoins (sql, total) {
			let alias, joins = {};
			_.each (sql.from, function (o, i) {
				if (o == "left-join" || o == "inner-join") {
					alias = getAlias (sql.from [i + 1]);
				}
				if (alias) {
					joins [alias] = joins [alias] || [];
					joins [alias].push (o);
				}
			});
			_.each (joins, function (arr, alias) {
				let remove = false;
				if (arr [0] != "inner-join") {
					if (!isAliasInArray (sql.where, alias) &&
						!isAliasInArray (sql.order, alias) &&
						!isAliasInArray (sql.orderAfter, alias) &&
						!isAliasInLeftJoins (joins, alias)
					) {
						remove = true;
					}
					if (total) {
						let has = false;
						for (let i = 0; i < sql.select.length; i += 2) {
							if (getAlias (sql.select [i]) == alias && total [sql.select [i + 1]]) {
								has = true;
								break;
							}
						};
						if (has) {
							remove = false;
						}
					}
				}
				if (remove) {
					joins [alias] = null;
				}
			});
			return joins;
		}
		let joins = getJoins (sql, total);
		let r = {};
		_.each (sql, function (v, k) {
			if (k == "select") {
				r.select = [];
				for (let i = 0; i < v.length; i += 2) {
					let a = getAlias (v [i]);
					if (joins [a] || a == getAlias (sql.from [0])) {
						r.select.push (v [i]);
						r.select.push (v [i + 1]);
					}
				}
			} else
			if (k == "from") {
				r.from = [v [0]];
				_.each (joins, function (v, a) {
					if (v) {
						_.each (v, function (v, a) {
							r.from.push (v);
						});
					}
				});
			} else {
				r [k] = v;
			}
		});
		return r;
	};
	storage.addOrderId = function (sql) {
		let alias; for (alias in sql.from [0]) {break;};
		let order = sql.orderAfter || sql.order;
		order = order || [];
		let has = 0;
		for (let i = 0; i < order.length; i ++) {
			if (typeof (order [i]) == "object") {
				for (let a in order [i]) {
					if (order [i][a] == "id") {
						has = 1;
					};
				};
			};
		};
		if (!has) {
			if (["system.class", "system.class_attr", "system.view", "system.view_attr", "system.action", "system.action_attrs", "system.object", "system.object_attr", "system.revision"].indexOf (sql.from [0][alias]) == -1) {
				if (order.length) {
					order.push (",");
				};
				let f = {}; f [alias] = "id";
				order.push (f);
			};
		};
		if (sql.orderAfter) {
			sql.orderAfter = order;
		} else {
			sql.order = order;
		}
	},
	storage.getContent = function (options) {
		let viewId = options.viewId;
		let column = options.column;
		let row = options.row;
		let columnCount = options.columnCount;
		let rowCount = options.rowCount;
		let parentId = options.parentId;
		let filter = options.filter;
		let order = options.order;
		let total = options.total;
		let dateAttrs = options.dateAttrs || [];
		let timeOffsetMin = options.timeOffsetMin;
		let success = options.success;
		let failure = options.failure;
		let request = options.request;
		options.session = options.session || request.session || {};
		let session = options.session;
		let view = storage.viewsMap [viewId];
		let viewQuery = JSON.parse (view.get ("fquery"));
		if (!viewQuery || filter == "unselected") {
			let r = 
				"{\n" +
				"\tview: " + viewId + ",\n" +
				"\tcolumnCount: 0,\n" +
				"\theaderDepth: 0,\n" +
				"\tcolumn: {\n" +
				"\t},\n" +
				"\ttree: {\n" +
				"\t\tlength: 0\n" +
				"\t}\n" +
				"}"
			;
			if (success) {
				success ({result: r});
			}
			return;
		}
		if (filter && filter.length) {
			viewQuery.where = viewQuery.where || [];
			if (viewQuery.where.length) {
				viewQuery.where = [viewQuery.where];
				viewQuery.where.push ("and");
			}
			viewQuery.where.push (filter);
		}
		if (order && order.length) {
			if (viewQuery.orderAfter) {
				viewQuery.orderAfter = order;
			} else {
				viewQuery.order = order;
			}
		};
		storage.addOrderId (viewQuery);
		let query, rows, totalRow, sql, classes = [];
		async.series ([
			function (cb) {
				if (config.caching && config.caching.getContent) {
					storage.redisClient.hget (storage.code + "-content", request.storageParam, function (err, result) {
						if (result) {
							cb (result);
						} else {
							cb ();
						}
					});
				} else {
					cb ();
				};
			},
			function (cb) {
				query = new Query ({storage: storage, session: session, sql: viewQuery});
				query.generate ();
				sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
				for (let a in query.attrs) {
					let getClasses = function (classId) {
						classes.push (classId);
						let childs = storage.classesMap [classId].childs;
						for (let i = 0; i < childs.length; i ++) {
							getClasses (childs [i]);
						}
					};
					let classCode = query.attrs [a].cls;
					if (["system.class", "system.class_attr", "system.view", "system.view_attr"].indexOf (classCode) > -1) {
						continue;
					};
					getClasses (storage.classesCode [classCode].get ("fid"));
				}
				cb ();
			},
			function (cb) {
				let sqlLimit = sql + "\nlimit " + rowCount + " offset " + row + "\n";
				if (storage.client.database == "mssql") {
					sqlLimit =
						"select mssql2.* from (\n" +
						"\tselect mssql1.*, ROW_NUMBER () over (order by (select 0)) as 'rn' from (\n" +
							sql + "\n" +
						"\t) mssql1\n" +
						") mssql2\n" +
						"where rn > " + row + " and rn <= " + (Number (row) + Number (rowCount))
					;
				};
				storage.query ({client: db.create (storage), sql: sqlLimit, success: function (options) {	
					rows = options.result.rows;
					cb ();
				}, failure: cb});
			},
			function (cb) {
				let sqlCount = sql;
				if (config.query.optimizeCountQuery) {
					let viewQueryCount = storage.prepareSQLForCount (viewQuery, total);
					let queryCount = new Query ({storage: storage, session: session, sql: viewQueryCount});
					queryCount.generate ();
					sqlCount = queryCount.selectSQL + queryCount.fromSQL + queryCount.whereSQL + queryCount.orderSQL;
				}
				let s = "select\n\tcount (*) as rows_num";
				for (let t in total) {
					let has = 0;
					for (let i = 1; i < viewQuery.select.length; i += 2) {
						if (viewQuery.select [i] == t) {
							has = 1;
							break;
						};
					};
					if (!has) {
						continue;
					};
					let field = t.toLowerCase () + "_";
					if (total [t] == "cnt") {
						total [t] = "count";
					}
					s += ", " + total [t] + "(" + field + ") as " + field;
				}
				s += "\nfrom (" + sqlCount;
				if (storage.client.database == "postgres") {
					s += "\nlimit " + (config.query.maxCount || 1000) + " offset 0\n";
				};
				s += ") v\n";
				storage.query ({client: db.create (storage), sql: s, success: function (options) {	
					totalRow = options.result.rows [0];
					cb ();
				}, failure: cb});
			}
		], function (err, results) {
			if (err) {
				return failure (new VError (err, "Storage.getContent"));
			};
			let attrs = view.attrs, attrsNum = 0;
			let orderAttrs = [];
			for (let attrCode in attrs) {
				attrs [attrCode].set ("field", attrs [attrCode].get ("fcode").toLowerCase () + "_");
				orderAttrs.push (attrs [attrCode]);
				attrsNum ++;
			}
			orderAttrs.sort (function (a, b) {
				let c = a.get ("forder"), d = b.get ("forder");
				if (d == null || c < d) {
					return -1;
				}
				if (c == null || c > d) {
					return 1;
				}
				if (c == d) {
					return 0;
				}
			});
			let r = "{header: {error: ''}, data: {view: " + viewId + ", columnCount: " + attrsNum + ", headerDepth: 1, column: {\n";
			for (let i = 0; i < orderAttrs.length; i ++) {
				let attr = orderAttrs [i];
				if (i) {
					r += "\t,\n";
				}
				let field = attr.get ("fcode").toLowerCase () + "_";
				r += 
					"\t" + i + ": {\n" +
					"\t\twidth: " + attr.get ("fcolumn_width") + ",\n" +
					"\t\tarea: " + attr.get ("farea") + ",\n" +
					"\t\t0: {\n" +
					"\t\t\tattrId: " + attr.get ("fid") + ",\n" +
					'\t\t\tattr: "' + attr.get ("fcode") + '",\n' +
					'\t\t\ttext: "' + attr.get ("fname").split ('"').join ('\\"') + '",\n' +
					'\t\t\tidAttr: "id",\n' +
					"\t\t\ttypeId: " + query.fieldTypeId [field] + ",\n" +
					"\t\t\ttotal: " + (totalRow [field] ? totalRow [field] : "null") + ",\n" +
					"\t\t\tspan: 1\n" +
					"\t\t}\n" +
					"\t}\n"
				;
			};
			r += "}, tree: {overflow: " + (totalRow.rows_num == (config.query.maxCount || 1000) ? 1 : 0) + ", length: " + totalRow.rows_num + ", currentLength: " + rows.length;
			if (rows.length) {
				r += ",\n";
			} else {
				r += "\n";
			};
			for (let i = 0; i < rows.length; i ++) {
				if (i) {
					r += ",\n";
				}
				r += 
					(i + Number (row)) + ": {\n" +
					"\tid: " + i + ",\n" +
					"\tlength: 0,\n" +
					"\tdata: {\n"
				;
				for (let j = 0; j < orderAttrs.length; j ++) {
					if (j) {
						r += "\t\t,\n";
					};
					let value = rows [i][orderAttrs [j].get ("field")];
					if (dateAttrs.indexOf (orderAttrs [j].get ("fcode")) > -1 && value && typeof (value) == "object" && value.getMonth) {
						if (timeOffsetMin && (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ())) {
							let timeOffset = timeOffsetMin * 60 * 1000
							value = new Date (value.getTime () - timeOffset);
							value = "new Date (" + value.getUTCFullYear () + "," + value.getUTCMonth () + "," + value.getUTCDate () + ")";
						} else {
							value = "new Date (" + value.getFullYear () + "," + value.getMonth () + "," + value.getDate () + ")";
						};
					} else {
						value = common.ToJSONString (value);
					};
					r += "\t\t" + j + ": {text: " + value + "}\n";
				}
				r += "\t}\n}\n";
			}
			r += "}}}";
			if (config.caching && config.caching.getContent) {
				if (classes.length && !storage.revision [session.id]) {
					storage.redisClient.hsetnx (storage.code + "-content", request.storageParam, r);
					for (let i = 0; i < classes.length; i ++) {
						storage.redisClient.hsetnx (storage.code + "-" + classes [i] + "-clschange", request.storageParam, "1");
					}
				};
			};
			success ({result: r});
		});
	};
	storage.selectRow = function (options) {
		let viewId = options.viewId;
		let viewFilter = options.viewFilter;
		let selectFilter = options.selectFilter;
		let success = options.success;
		let failure = options.failure;
		let request = options.request;
		let session = options.session || {userId: null};
		let view = storage.viewsMap [viewId];
		let viewQuery = JSON.parse (view.get ("fquery"));
		if (viewFilter && viewFilter.length) {
			viewQuery.where = viewQuery.where || [];
			if (viewQuery.where.length) {
				viewQuery.where.push ("and");				
			}
			viewQuery.where.push (viewFilter);
		}
		if (storage.client.database != "mssql") {
			let rn = ["row_number ()", "over"];
			if (viewQuery.order) {
				rn.push (["order by"].concat (viewQuery.order));
			} else {
				rn.push ([]);
			}
			viewQuery.select.push (rn);
			viewQuery.select.push ("rn");
		};
		let query, rows, sql, classes = [];
		async.series ([
			function (cb) {
				query = new Query ({storage: storage, session: session, sql: viewQuery});
				query.generate ();
				sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
				for (let a in query.attrs) {
					classes.push (storage.classesCode [query.attrs [a].cls].get ("fid"));
				}
				cb ();
			},
			function (cb) {
				selectFilter [0] = selectFilter [0].substr (1) + "_";
				if (storage.client.database == "mssql") {
					sql = 
						"select\n"  +
						"\t(mssql2.rn - 1) as rn_ from (\n" +
						"\t\tselect ROW_NUMBER () over (order by (select 0)) as 'rn', vr_.* from (\n" +
						"\t\t\t" + sql + ") vr_ " +
						"\t) mssql2\n" +
						"where\n" +
						selectFilter.join (" ")
					;
				} else {
					sql = "select rn_ from (" + sql + ") v where " + selectFilter.join (" ");
				};
				storage.query ({sql: sql, success: function (options) {	
					rows = options.result ? options.result.rows : [];
					cb ();
				}, failure: cb});
			}
		], function (err, results) {
			if (err) {
				return failure (new VError (err, "Storage.selectRow"));
			};
			let r = "0";
			if (rows.length) {
				r = rows [0].rn_ - 1;
			}
			success ({result: r});
		});
	};
	// {classId}
	storage.clsChange = function (options) {
		let classId = options.classId;
		log.debug ({cls: "storage", fn: "clsChange", params: classId});
		let session = options.session;
		storage.redisClient.hkeys (storage.code + "-" + classId + "-clschange", function (err, result) {
			for (let i = 0; i < result.length; i ++) {
				storage.redisClient.hdel (storage.code + "-content", result [i]);
			}
			storage.redisClient.del (storage.code + "-" + classId + "-clschange");
		});
	};
	storage.setVar = function (options) {
		let success = options.success;
		storage.redisClient.hset (storage.code + "-vars", options.field, options.value, function (err, result) {
			if (success) {
				success ();
			};
		});
	};
	storage.getVar = function (options) {
		let success = options.success;
		storage.redisClient.hget (storage.code + "-vars", options.field, function (err, result) {
			if (success) {
				success ({value: result});
			};
		});
	};
	storage.removeVar = function (options) {
		let success = options.success;
		storage.redisClient.hdel (storage.code + "-vars", options.field, function (err, result) {
			if (success) {
				success ();
			};
		});
	};
	storage.authRecords = {}; // login, pass
	storage.subjectRoles = {}; // subjectId = {role: roleId, menu: menuId}
	storage.authInfoUpdater = function (options) {
		let rows;
		async.series ([
			function getAuthMethods (cb) {
				storage.execute ({sql: {
					"select": [
						{"a":"id"}, "id",
						{"a":"login"}, "login",
						{"a":"password"}, "password",
						{"a":"use"}, "use"
					],
					"from": [
						{"a":"system.admin.Authentication.LoginPassword"}
					]
				}, success: function (options) {
					rows = options.result.rows;
					cb ();
				}, failure: function (err) {
					cb (err);
				}});
			},
			function getRoles (cb) {
				let cls = storage.getClass ("ose.role");
				if (cls.attrs ["menu"]) {
					storage.execute ({sql: {
						"select": [
							{"a":"subject"}, "subject",
							{"a":"role"}, "role",
							{"b":"menu"}, "menu"
						],
						"from": [
							{"a":"ose.srole"},
							"left-join", {"b": "ose.role"}, "on", [{"a": "role"}, "=", {"b": "id"}]
						]
					}, success: function (options) {
						let r = options.result.rows;
						for (let i = 0; i < r.length; i ++) {
							storage.subjectRoles [r [i].subject_] = {
								role: r [i].role_,
								menu: r [i].menu_
							};
						};
						cb ();
					}, failure: function (err) {
						cb (err);
					}});
				} else {
					cb ();
				};
			},
			function auth (cb) {
				let processedLoginPasswordPairs = {};
				async.map (rows, function (row, cb) {
					if (!row.use_) {
						cb ();
						return;
					};
					let loginAttrId = row.login_;
					let passwordAttrId = row.password_;
					if (!processedLoginPasswordPairs [loginAttrId] == passwordAttrId) {
						cb ();
						return;
					};
					processedLoginPasswordPairs [loginAttrId] = passwordAttrId;
					let loginAttr = storage.classAttrsMap [loginAttrId];
					let passwordAttr = storage.classAttrsMap [passwordAttrId];
					let clsAuth = storage.classesMap [loginAttr.get ("fclass_id")];
					let toc = clsAuth.toc;
					storage.query ({sql: 
						"select fobject_id, " + loginAttr.toc + ", " + passwordAttr.toc + "\n" +
						"from " + toc + "\n" +
						"where " + loginAttr.toc + " is not null and " + passwordAttr.toc + " is not null\n"
					, success: function (options) {
						let r = options.result.rows;
						for (let i = 0; i < r.length; i ++) {
							storage.authRecords [r [i][loginAttr.toc]] = {
								password: r [i][passwordAttr.toc],
								objectId: r [i].fobject_id,
								hasTryAttrs: clsAuth.attrs.lastTry ? true : false
							};
						};
						cb ();
					}, failure: function (err) {
						cb (err);
					}});
				}, function (err, results) {
					cb (err);
				});
			}
		], function (err, results) {
			if (options && options.success) {
				options.success ();
			};
		});		
	};
	storage.subscribers = {
		beforecreateobject: [],
		aftercreateobject: [],
		beforegetobject: [],
		aftergetobject: [],
		beforecommitobject: [],
		beforeremoveobject: [],
		generatequeryblock: []
	};
	storage.suspendedEvents = {};
	storage.on = function (event, fn) {
		storage.subscribers [event] = storage.subscribers [event] || [];
		storage.subscribers [event].push (fn);
	};
	storage.un = function (event, fn) {
		if (storage.subscribers [event] && storage.subscribers [event].indexOf (fn) > -1) {
			storage.subscribers [event].splice (storage.subscribers [event].indexOf (fn), 1);
		};
	};
	storage.suspendEvent = function (event) {
		if (event) {
			storage.suspendedEvents [event] = 1;
		} else {
			for (event in storage.subscribers) {
				storage.suspendedEvents [event] = 1;
			};
		};
	};
	storage.resumeEvent = function (event) {
		if (event) {
			storage.suspendedEvents [event] = 0;
		} else {
			for (event in storage.subscribers) {
				storage.suspendedEvents [event] = 0;
			};
		};
	};
	storage.fireEvent = function (event, options) {
		options = options || {};
		let success = options.success;
		if (storage.suspendedEvents [event]) {
			if (success) {
				success ();
			};
			return;
		};
		let subscribers = storage.subscribers [event] || [];
		delete options.success;
		let cancel = 0;
		if (success) {
			async.eachSeries (subscribers, function (subscriber, cb) {
				options.success = function (options) {
					if (options && options.cancel) {
						cancel = 1;
					};
					cb ();
				};
				subscriber (options);
			}, function (err) {
				if (success) {
					success ({cancel: cancel});
				};
			});
		} else {
			for (let i = 0; i < subscribers.length; i ++) {
				subscribers [i] (options);
			};
			return options;
		};
	};
	storage.freeResources = function () {
		clearInterval (storage.keepConnectionAliveIntervalId);
		clearInterval (storage.authInfoUpdaterIntervalId);
		storage.client.disconnect ();
		storage.redisClient.quit ();
		storage.redisSub.quit ();
		storage.redisPub.quit ();
		if (storage.ose) {
			storage.ose.freeResources ();
		};
	};
	// init
	storage.code = options.code;
	storage.redisClient = redis.createClient (config.redis.port, config.redis.host);
	storage.redisPub = redis.createClient (config.redis.port, config.redis.host);
	storage.redisSub = redis.createClient (config.redis.port, config.redis.host);
	storage.connection = options.connection;
	storage.revisions = {};
	async.series ([
		function (cb) {
			if (config.redis.db) {
				storage.redisSub.select (config.redis.db, function (err, res) {
					storage.redisPub.select (config.redis.db, function (err, res) {
						storage.redisClient.select (config.redis.db, function (err, res) {
							cb ();
						});
					});
				});
			} else {
				cb ();
			};			
		}
	], function (err) {
		storage.redisSub.on ("message", function (channel, message) {
			log.debug ({cls: "storage"}, "redisSub.message on channel: " + channel);
			if (channel == config.redis.db + "-" + storage.code + "-revisions") {
				let r = JSON.parse (message);
				if (!storage.revisions [r.id]) {
					storage.revisions [r.id] = r;
					log.debug ({cls: "storage"}, "new revision: " + r.id);
					// todo: clear redis cache
				};
				for (let i = 0; i < r.classes.created.length; i ++) {
					storage.updateClassCache (r.classes.created [i]);
				};
				for (let i = 0; i < r.classes.changed.length; i ++) {
					storage.updateClassCache (r.classes.changed [i]);
				};
				// r.classes.removed ?
				for (let i = 0; i < r.classAttrs.created.length; i ++) {
					storage.updateClassAttrCache (r.classAttrs.created [i]);
				};
				for (let i = 0; i < r.classAttrs.changed.length; i ++) {
					storage.updateClassAttrCache (r.classAttrs.changed [i]);
				};
				// r.classAttrs.removed ?
				for (let i = 0; i < r.views.created.length; i ++) {
					storage.updateViewCache (r.views.created [i]);
				};
				for (let i = 0; i < r.views.changed.length; i ++) {
					storage.updateViewCache (r.views.changed [i]);
				};
				// r.views.removed ?
				for (let i = 0; i < r.viewAttrs.created.length; i ++) {
					storage.updateViewAttrCache (r.viewAttrs.created [i]);
				};
				for (let i = 0; i < r.viewAttrs.changed.length; i ++) {
					storage.updateViewAttrCache (r.viewAttrs.changed [i]);
				};
				// r.viewAttrs.removed ?
			};
		});
		storage.redisSub.subscribe (config.redis.db + "-" + storage.code + "-revisions");
		let meOptions = options;
		let client = db.create (storage);
		client.connect ({systemDB: options.systemDB, success: function () {
			client.inStorage = 1;
			storage.client = client;
			if (options.systemDB) {
				let success = options.success;
				if (success) {
					success ();
				}
				return;
			};
			async.series ([
				function (cb) {
					if (config.port == config.startPort || process.env.mainWorker) {
						client.update ({success: function () {
							cb ();
						}});
					} else {
						cb ();
					}
				},
				function (cb) {storage.initClasses ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initClassAttrs ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initViews ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initViewAttrs ({success: function () {
					cb ();
				}})},
				function (cb) {
					if (options.authInfoUpdater && !storage.authInfoUpdaterIntervalId) {
						storage.authInfoUpdater ({success: function () {
							storage.authInfoUpdaterIntervalId = setInterval (storage.authInfoUpdater, 60 * 1000);
							cb ();
						}});
					} else {
						cb ();
					};
				},
				function (cb) {
					storage.ose = new Ose ({storage: storage, success: function () {
						cb ();
					}});
				}
			], function (err, results) {
				let success = options.success;
				storage.query ({sql: "select max (fid) as maxId from trevision", success: function (options) {
					storage.lastRevision = options.result.rows [0].maxid;
					if (success) {
						success ();
					}
				}});
			});
		}, failure: function (err) {
			log.error ({cls: "storage", fn: "init", error: util.inspect (err)});
			if (meOptions.failure) {
				meOptions.failure (err);
			}
		}});
	});
}
