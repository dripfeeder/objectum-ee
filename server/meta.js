/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var meta = {};
meta.fields = {
	tclass: ["fid", "fparent_id", "fname", "fcode", "fdescription", "fformat", "fview_id", "ftype", "fsystem"],
	tclass_attr: ["fid", "fclass_id", "fname", "fcode", "ftype_id", "forder", "fnot_null", "fvalid_func", "fformat_func", "fdescription", "fsecure", "fmax_str", "fmin_str", "fmax_number", "fmin_number", "fmax_ts", "fmin_ts", "funique", "fformat_number", "fformat_ts", "fremove_rule"],
	tview: ["fid", "fparent_id", "fname", "fcode", "fdescription", "flayout", "fkey", "fparent_key", "fclass_id", "funrelated", "fquery", "ftype", "fsystem", "fmaterialized", "forder", "ficon_cls"],
	tview_attr: ["fid", "fview_id", "fname", "fcode", "fclass_id", "fclass_attr_id", "fsubject_id", "forder", "fsort_kind", "fsort_order", "foperation", "fvalue", "farea", "fcolumn_width", "ftotal_type", "fread_only", "fgroup", "fnot_null"],
	taction: ["fid", "fclass_id", "fname", "fcode", "fdescription", "forder", "fbody", "flayout"]
};
meta.tableCreate = function (options) {
	var request = options.request;
	var response = options.response;
	var session = request.session;
	var table = options.table;
	var fields = meta.fields [table];
	var values = options.values;
	var storage = options.storage;
	var revision = storage.revision [session.id];
	var inTransaction = revision ? true : false;
	var success = options.success;
	var newId;
	async.series ([
		function (cb) {
			if (!inTransaction) {
				storage.startTransaction ({
					session: session, 
					remoteAddr: common.getRemoteAddress (request),
					description: "Create " + table,
					success: function (options) {
						revision = options.revision;
						projects.sessions [session.id].transaction.active = true;
						cb ();
					}, failure: function (options) {
						cb (options.error);
					}
				});
			} else {
				cb ();
			}
		},
		function (cb) {
			var client = storage.getClient ({session: session});
			client.getNextId ({table: table, success: function (options) {
				newId = options.id;
				cb ();
			}});
		},
		function (cb) {
			fields = fields.concat (["fstart_id", "fend_id"]);
			values = values.concat ([revision, storage.maxRevision]);
			values = [newId].concat (values);
			var valuesN = [];
			for (var i = 0; i < values.length; i ++) {
				valuesN.push ("$" + (i + 1));
			};
			storage.query ({session: session, sql:
				"insert into " + table + " (" + fields.join (",") + ") values (" + valuesN.join (",") + ")"
			, params: [].concat (values), success: function (options) {
				cb ();
			}});
		}
	], function (err, results) {
		if (err) {
			projects.send ({request: request, response: response, msg: "{header: {error: '" + err + "'},data: []}"});
		} else {
			if (table == "tclass") {
				storage.revisions [storage.revision [session.id]].classes.created.push ({
					fields: fields,
					values: values
				});
				storage.updateClassCache ({fields: fields, values: values});
			};
			if (table == "tclass_attr") {
				storage.revisions [storage.revision [session.id]].classAttrs.created.push ({
					fields: fields,
					values: values
				});
				storage.updateClassAttrCache ({fields: fields, values: values});
			};
			if (table == "tview") {
				storage.revisions [storage.revision [session.id]].views.created.push ({
					fields: fields,
					values: values
				});
				storage.updateViewCache ({fields: fields, values: values});
			};
			if (table == "tview_attr") {
				storage.revisions [storage.revision [session.id]].viewAttrs.created.push ({
					fields: fields,
					values: values
				});
				storage.updateViewAttrCache ({fields: fields, values: values});
			};
			if (!inTransaction) {
				storage.commitTransaction ({session: session, success: function (options) {
					projects.sessions [session.id].transaction.active = false;
					success ({values: values});
				}});
			} else {
				success ({values: values});
			};
		}
	});
};
meta.tableRemove = function (options) {
	var request = options.request;
	var response = options.response;
	var session = request.session;
	var table = options.table;
	var values = options.values;
	var storage = options.storage;
	var revision = storage.revision [session.id];
	var inTransaction = revision ? true : false;
	var success = options.success;
	var newId;
	async.series ([
		function (cb) {
			if (!inTransaction) {
				storage.startTransaction ({
					session: session, 
					remoteAddr: common.getRemoteAddress (request),
					description: "Create " + table,
					success: function (options) {
						revision = options.revision;
						projects.sessions [session.id].transaction.active = true;
						cb ();
					}, failure: function (options) {
						cb (options.error);
					}
				});
			} else {
				cb ();
			}
		},
		function (cb) {
			storage.query ({session: session, sql: 
				"update " + table + " set fend_id=" + revision + " where fid=" + values [0] + " and fend_id=" + storage.maxRevision
			, success: function (options) {
				cb ();
			}});
		}
	], function (err, results) {
		if (err) {
			projects.send ({request: request, response: response, msg: "{header: {error: '" + err + "'},data: []}"});
		} else {
			if (table == "tclass") {
				storage.revisions [storage.revision [session.id]].classes.removed.push (values [0]);
			};
			if (table == "tclass_attr") {
				storage.revisions [storage.revision [session.id]].classAttrs.removed.push (values [0]);
			};
			if (table == "tview") {
				storage.revisions [storage.revision [session.id]].views.removed.push (values [0]);
			};
			if (table == "tview_attr") {
				storage.revisions [storage.revision [session.id]].viewAttrs.removed.push (values [0]);
			};
			if (!inTransaction) {
				storage.commitTransaction ({session: session, success: function (options) {
					projects.sessions [session.id].transaction.active = false;
					success ();
				}});
			} else {
				success ();
			};
		}
	});
};
meta.tableUpdate = function (options) {
	var request = options.request;
	var response = options.response;
	var session = request.session;
	var table = options.table;
	var fields = meta.fields [table];
	var values = options.values;
	var storage = options.storage;
	var revision = storage.revision [session.id];
	var success = options.success;
	var inTransaction = revision ? true : false;
	async.series ([
		function (cb) {
			if (!inTransaction) {
				storage.startTransaction ({
					session: session, 
					remoteAddr: common.getRemoteAddress (request),
					description: "Update " + table,
					success: function (options) {
						revision = options.revision;
						projects.sessions [session.id].transaction.active = true;
						cb ();
					}, failure: function (options) {
						cb (options.error);
					}
				});
			} else {
				cb ();
			}
		},
		function (cb) {
			storage.query ({session: session, sql: 
				"update " + table + " set fend_id=" + revision + " where fid=" + values [0] + " and fend_id=" + storage.maxRevision
			, success: function (options) {
				cb ();
			}});
		},
		function (cb) {
			fields = fields.concat (["fstart_id", "fend_id"]);
			values = values.concat ([revision, storage.maxRevision]);
			var valuesN = [];
			for (var i = 0; i < values.length; i ++) {
				valuesN.push ("$" + (i + 1));
			};
			storage.query ({session: session, sql:
				"insert into " + table + " (" + fields.join (",") + ") values (" + valuesN.join (",") + ")"
			, params: values, success: function (options) {
				cb ();
			}});
		}
	], function (err, results) {
		if (err) {
			projects.send ({request: request, response: response, msg: "{header: {error: '" + err + "'},data: []}"});
		} else {
			if (table == "tclass") {
				storage.revisions [storage.revision [session.id]].classes.changed.push ({
					fields: fields,
					values: values
				});
				storage.updateClassCache ({fields: fields, values: values});
			};
			if (table == "tclass_attr") {
				storage.revisions [storage.revision [session.id]].classAttrs.changed.push ({
					fields: fields,
					values: values
				});
				storage.updateClassAttrCache ({fields: fields, values: values});
			};
			if (table == "tview") {
				storage.revisions [storage.revision [session.id]].views.changed.push ({
					fields: fields,
					values: values
				});
				storage.updateViewCache ({fields: fields, values: values});
			};
			if (table == "tview_attr") {
				storage.revisions [storage.revision [session.id]].viewAttrs.changed.push ({
					fields: fields,
					values: values
				});
				storage.updateViewAttrCache ({fields: fields, values: values});
			};
			if (!inTransaction) {
				storage.commitTransaction ({session: session, success: function (options) {
					projects.sessions [session.id].transaction.active = false;
					success ();
				}});
			} else {
				success ();
			};
		}
	});
};
meta.tableGet = function (options) {
	var request = options.request;
	var response = options.response;
	var session = request.session;
	var table = options.table;
	var fields = meta.fields [table];
	var values = options.values;
	var storage = options.storage;
	var success = options.success;
	var sql = "select " + fields.join (",") + " from " + table + " where fid=" + values [0] + " and fend_id=" + storage.maxRevision;
	if (table == "taction" && typeof (values [0]) == "string" && values [0].indexOf (".") > -1) {
		var tokens = values [0].split (".");
		var actionCode = tokens [tokens.length - 1];
		var clsCode = tokens.slice (0, tokens.length - 1).join (".");
		var clsId = storage.getClass (clsCode).get ("fid");
		sql = 
			"select " + fields.join (",") + " from taction\n" +
			"where fclass_id=" + clsId + " and fcode='" + actionCode + "'" + " and fend_id=" + storage.maxRevision
		;
	};
	storage.query ({session: session, sql: sql, success: function (options) {
		var rows = options.result.rows, row;
		if (rows.length) {
			row = rows [0]
		} else {
			row = {};
		};
		var data = [];
		for (var i = 0; i < fields.length; i ++) {
			data.push (row [fields [i]]);
		};
		projects.send ({request: request, response: response, msg: "{header: {error: ''},data: " + JSON.stringify (data) + "}"});
	}});
};
meta.fnView = function (request, response, next) {
   	if (request.storageArea == "View") {
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
		var tableOptions = {
   			request: request,
   			response: response,
   			storageCode: request.storageCode,
   			table: "tview",
			values: JSON.parse ("[" + request.storageParam + "]")
		};
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = tableOptions.storage = options.storage;
	   		if (request.storageFn == "create") {
	   			tableOptions.success = function (options) {
	   				var values = options.values;
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
	   			};
		   		meta.tableCreate (tableOptions);
			};
	   		if (request.storageFn == "set") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableUpdate (tableOptions);
			};
	   		if (request.storageFn == "remove") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableRemove (tableOptions);
			};
			storage.redisClient.hdel (storage.code + "-requests", "tview");
			storage.redisClient.hdel (storage.code + "-requests", "all");
		}});
   	} else {
		next ();
	}
};
meta.fnViewAttr = function (request, response, next) {
   	if (request.storageArea == "ViewAttr") {
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
		var tableOptions = {
   			request: request,
   			response: response,
   			storageCode: request.storageCode,
   			table: "tview_attr",
			values: JSON.parse ("[" + request.storageParam + "]")
		};
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = tableOptions.storage = options.storage;
	   		if (request.storageFn == "create") {
	   			tableOptions.success = function (options) {
	   				var values = options.values;
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
	   			};
		   		meta.tableCreate (tableOptions);
			};
	   		if (request.storageFn == "set") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableUpdate (tableOptions);
			};
	   		if (request.storageFn == "remove") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableRemove (tableOptions);
			};
			storage.redisClient.hdel (storage.code + "-requests", "tview_attr");
			storage.redisClient.hdel (storage.code + "-requests", "all");
		}});
   	} else {
		next ();
	}
};
meta.fnClass = function (request, response, next) {
   	if (request.storageArea == "Class") {
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
		var tableOptions = {
   			request: request,
   			response: response,
   			storageCode: request.storageCode,
   			table: "tclass",
			values: JSON.parse ("[" + request.storageParam + "]")
		};
		var code = tableOptions.values [2];
		var id = tableOptions.values [0];
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = tableOptions.storage = options.storage;
			var session = request.session;
			var revision = storage.revision [session.id];
			var inTransaction = revision ? true : false;
	   		if (request.storageFn == "create") {
	   			tableOptions.success = function (options) {
	   				var values = options.values;
	   				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
		   				var toc = code + "_" + values [0];
						storage.query ({sql: "create table " + toc + " ($tocObjectId$)", success: function () {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
					};
	   			};
		   		meta.tableCreate (tableOptions);
			};
	   		if (request.storageFn == "set") {
   				var toc = storage.getClass (id).toc;
   				var tocNew = tableOptions.values [3] + "_" + id;
				async.series ([
					function (cb) {
						if (!inTransaction) {
							storage.startTransaction ({
								session: session, 
								remoteAddr: common.getRemoteAddress (request),
								description: "Remove ca ",
								success: function (options) {
									revision = options.revision;
									projects.sessions [session.id].transaction.active = true;
									cb ();
								}, failure: function (options) {
									cb (options.error);
								}
							});
						} else {
							cb ();
						}
					},
					function (cb) {
						tableOptions.success = function (options) {
							cb ();
						};
				   		meta.tableUpdate (tableOptions);
				   	},
					function (cb) {
		   				if (toc.toLowerCase () != tocNew.toLowerCase ()) {
							storage.client.isTableExists ({table: toc, success: function (exists) {
								if (exists) {
					   				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
										storage.query ({session: session, sql: "alter table " + toc + " rename to " + tocNew, success: function () {
											cb ();
										}});
									} else {
										cb ();
									};
								} else {
									cb ();
								};
							}});
		   				} else {
		   					cb ();
		   				};
		   			},
					function (cb) {
						if (!inTransaction) {
							storage.commitTransaction ({session: session, success: function (options) {
								projects.sessions [session.id].transaction.active = false;
								cb ();
							}});
						} else {
							cb ();
						};
					}
				], function (err, results) {
					if (err && !inTransaction) {
						storage.rollbackTransaction ({session: session, success: function (options) {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
					};
				});
			};
	   		if (request.storageFn == "remove") {
				async.series ([
					function (cb) {
						if (!inTransaction) {
							storage.startTransaction ({
								session: session, 
								remoteAddr: common.getRemoteAddress (request),
								description: "Remove c",
								success: function (options) {
									revision = options.revision;
									projects.sessions [session.id].transaction.active = true;
									cb ();
								}, failure: function (options) {
									cb (options.error);
								}
							});
						} else {
							cb ();
						}
					},
					function (cb) {
			   			tableOptions.success = function (options) {
			   				cb ();
						};
				   		meta.tableRemove (tableOptions);
					},
					function (cb) {
		   				var toc = storage.getClass (id).toc;
						storage.client.isTableExists ({table: toc, success: function (exists) {
							if (exists) {
								storage.query ({session: session, sql: "drop table " + toc, success: function () {
									cb ();
								}, failure: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						}});
					},
					function (cb) {
						if (!inTransaction) {
							storage.commitTransaction ({session: session, success: function (options) {
								projects.sessions [session.id].transaction.active = false;
								cb ();
							}});
						} else {
							cb ();
						};
					}
				], function (err, results) {
					if (err && !inTransaction) {
						storage.rollbackTransaction ({session: session, success: function (options) {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
					};
				});
			};
			storage.redisClient.hdel (storage.code + "-requests", "tclass");
			storage.redisClient.hdel (storage.code + "-requests", "all");
		}});
   	} else {
		next ();
	}
};
meta.fnClassAttr = function (request, response, next) {
   	if (request.storageArea == "ClassAttr") {
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
		var tableOptions = {
   			request: request,
   			response: response,
   			storageCode: request.storageCode,
   			table: "tclass_attr",
			values: JSON.parse ("[" + request.storageParam + "]")
		};
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = tableOptions.storage = options.storage;
			var session = request.session;
			var revision = storage.revision [session.id];
			var inTransaction = revision ? true : false;
	   		if (request.storageFn == "create") {
	   			tableOptions.success = function (options) {
	   				var values = options.values;
	   				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
						var type = "$tnumber$";
						switch (values [4]) {
						case 2:
							type = "$tnumber_value$";
							break;
						case 1:
						case 5:
							type = "$ttext$";
							break;
						case 3:
							type = "$ttimestamp$";
							break;
						};
						var tocField = tableOptions.values [2] + "_" + values [0];
						var toc = storage.getClass (values [1]).toc;
						storage.client.createField ({toc: toc, tocField: tocField, caId: values [0], type: type, success: function () {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
					};
	   			};
		   		meta.tableCreate (tableOptions);
			};
	   		if (request.storageFn == "set") {
   				var caId = tableOptions.values [0];
				var ca = storage.getClassAttr (caId);
				var c = storage.getClass (ca.get ("fclass_id"));
   				var toc = ca.toc;
   				var tocNew = tableOptions.values [3] + "_" + caId;
				async.series ([
					function (cb) {
						if (!inTransaction) {
							storage.startTransaction ({
								session: session, 
								remoteAddr: common.getRemoteAddress (request),
								description: "Remove ca ",
								success: function (options) {
									revision = options.revision;
									projects.sessions [session.id].transaction.active = true;
									cb ();
								}, failure: function (options) {
									cb (options.error);
								}
							});
						} else {
							cb ();
						}
					},
					function (cb) {
						tableOptions.success = function (options) {
							cb ();
						};
				   		meta.tableUpdate (tableOptions);
				   	},
					function (cb) {
		   				if (toc.toLowerCase () != tocNew.toLowerCase ()) {
							storage.client.isFieldExists ({table: c.toc, field: toc, success: function (exists) {
								if (exists) {
					   				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
										storage.query ({session: session, sql: "alter table " + c.toc + " rename column " + toc + " to " + tocNew, success: function () {
											cb ();
										}});
									} else {
										cb ();
									};
								} else {
									cb ();
								};
							}});
		   				} else {
		   					cb ();
		   				};
					},
					function (cb) {
						if (!inTransaction) {
							storage.commitTransaction ({session: session, success: function (options) {
								projects.sessions [session.id].transaction.active = false;
								cb ();
							}});
						} else {
							cb ();
						};
					}
				], function (err, results) {
					if (err && !inTransaction) {
						storage.rollbackTransaction ({session: session, success: function (options) {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
					};
				});
			};
	   		if (request.storageFn == "remove") {
   				var caId = tableOptions.values [0];
				var ca = storage.getClassAttr (caId);
				var c = storage.getClass (ca.get ("fclass_id"));
				async.series ([
					function (cb) {
						if (!inTransaction) {
							storage.startTransaction ({
								session: session, 
								remoteAddr: common.getRemoteAddress (request),
								description: "Remove ca ",
								success: function (options) {
									revision = options.revision;
									projects.sessions [session.id].transaction.active = true;
									cb ();
								}, failure: function (options) {
									cb (options.error);
								}
							});
						} else {
							cb ();
						}
					},
					function (cb) {
						tableOptions.success = function (options) {
							cb ();
						};
				   		meta.tableRemove (tableOptions);
					},
					function (cb) {
						storage.client.isIndexExists ({index: c.toc + "_" + caId, success: function (exists) {
							if (exists) {
								storage.query ({session: session, sql: "drop index " + c.toc + "_" + caId, success: function () {
									cb ();
								}, failure: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						}});
					},
					function (cb) {
						storage.client.isFieldExists ({table: c.toc, field: ca.toc, success: function (exists) {
							if (exists) {
				   				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
									storage.query ({session: session, sql: "alter table " + c.toc + " drop column " + ca.toc, success: function () {
										cb ();
									}, failure: function () {
										cb ();
									}});
								} else {
									cb ();
								};
							} else {
								cb ();
							};
						}});
					},
					function (cb) {
						if (!inTransaction) {
							storage.commitTransaction ({session: session, success: function (options) {
								projects.sessions [session.id].transaction.active = false;
								cb ();
							}});
						} else {
							cb ();
						};
					}
				], function (err, results) {
					if (err && !inTransaction) {
						storage.rollbackTransaction ({session: session, success: function (options) {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
						}});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
					};
				});
			};
			storage.redisClient.hdel (storage.code + "-requests", "tclass_attr");
			storage.redisClient.hdel (storage.code + "-requests", "all");
		}});
   	} else {
		next ();
	}
};
meta.fnAction = function (request, response, next) {
   	if (request.storageArea == "Action") {
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
   		var values;
   		try {
   			values = JSON.parse ("[" + request.storageParam + "]");
   		} catch (e) {
			projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
			return;
   		};
		var tableOptions = {
   			request: request,
   			response: response,
   			storageCode: request.storageCode,
   			table: "taction",
			values: values
		};
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = tableOptions.storage = options.storage;
	   		if (request.storageFn == "create") {
	   			tableOptions.success = function (options) {
	   				var values = options.values;
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: [" + JSON.stringify (values) + "]}"});
	   			};
		   		meta.tableCreate (tableOptions);
			};
	   		if (request.storageFn == "set") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableUpdate (tableOptions);
			};
	   		if (request.storageFn == "remove") {
	   			tableOptions.success = function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: []}"});
				};
		   		meta.tableRemove (tableOptions);
			};
	   		if (request.storageFn == "get") {
		   		meta.tableGet (tableOptions);
			};
		}});
   	} else {
		next ();
	}
};
