//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
//
"use strict"
db.MSSQL = function (options) {
	let me = this;
	me.storage = options;
	me.database = "mssql";
	me.host = options.connection.host;
	me.port = options.connection.port;
	me.db = options.connection.db;
	me.dbUser = options.connection.dbUser;
	me.dbPassword = options.connection.dbPassword;
	me.dbaUser = options.connection.dbaUser;
	me.dbaPassword = options.connection.dbaPassword;
	me.connection = "Driver={SQL Server};Server=" + me.host + ";Uid=" + me.dbUser + ";Pwd=" + me.dbPassword + ";Database=" + me.db + ";"
	me.adminConnection = "Driver={SQL Server};Server=" + me.host + ";Uid=" + me.dbaUser + ";Pwd=" + me.dbaPassword + ";Database=master;"
	// Tags for query
	me.tags = {
		schema: "",
		schema_prefix: "",
		tablespace: "",
		tid: "bigint",
		tid_object_attr: "bigint identity (1000, 1)",
		tnumber: "bigint",
		tnumber_value: "numeric",
		ttext: "nvarchar (max)",
		ttimestamp: "datetime",
		tstring: "nvarchar (450)",
		tstring_value: "nvarchar (max)",
		tocObjectId: "fobject_id bigint primary key clustered",
		tobject_attr_fstring: "fstring"
	};
};
db.MSSQL.prototype.connect = function (options) {
	let me = this;
	sql.open (options.systemDB ? me.adminConnection : me.connection, function (err, client) {
		if (!err) {
			me.client = client;
			me.connected = true;
			client.query ("set language english", function (err, results) {
				client.query ("set dateformat dmy", function (err, results) {
					if (options.success) {
						options.success ();
					}
				});
			});
		} else {
			common.log ({file: config.rootDir + "/error.log", text: util.inspect (err)});
			if (options.failure) {
				options.failure ({error: err});
			}
		}
	});
};
db.MSSQL.prototype.disconnect = function (options) {
	this.client.close ();
};
db.MSSQL.prototype.query = function (options) {
	let me = this;
	options.options = options.options || {};
	let meOptions = options;
	function go (options) {	
		let query, values = [];
		if (options.params) {
			for (let i = 0; i < options.params.length; i ++) {
//				options.sql = options.sql.replace ("$" + (i + 1), common.ToSQLString (options.params [i]));
				let value = options.params [i];
				if (value === "") {
					value = null;
				};
				if (value == null) {
					options.sql = options.sql.replace ("$" + (i + 1), "null");
				} else {
					options.sql = options.sql.replace ("$" + (i + 1), "?");
					values.push (value);
				};
			};
		};
		me.n = me.n || 1;
		let n = me.n;
		me.queue = me.queue || {};
		me.queue [n] = options.sql;
		let cb = function (err, results) {
			delete me.queue [n];
			if (err) {
				if (options.failure) {
					options.failure ({error: err + " " + results});
				};
			} else {
				if (options.success) {
					/*
					if (results && results.length) {
						for (let i = 0; i < results.length; i ++) {
							let row = results [i];
							for (let field in row) {
								let lower = field.toLowerCase ();
								if (lower != field) {
									row [field.toLowerCase ()] = row [field];
									delete row [field];
								};
							};
						};
					};
					*/
					options.options.result = {
						rows: results
					};
					options.success (options.options);
				}
			};
		};
		if (values.length) {
			query = me.client.query (options.sql, values, cb);
		} else {
			query = me.client.query (options.sql, cb);
		};
	};
	if (me.connected) {
		go (meOptions);
	} else {
		me.connect ({success: function () {
			go (meOptions);
		}, failure: function (options) {
			meOptions.failure (options);
		}});
	};
};
db.MSSQL.prototype.startTransaction = function (options) {
	let me = this;
	let meOptions = options;
	this.query ({sql: "begin transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
db.MSSQL.prototype.commitTransaction = function (options) {
	let me = this;
	let meOptions = options;
	this.query ({sql: "commit transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
db.MSSQL.prototype.rollbackTransaction = function (options) {
	let me = this;
	let meOptions = options;
	this.query ({sql: "rollback transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
// Next id in table
db.MSSQL.prototype.getNextId = function (options) {
	let me = this;
	let success = options.success;
	let session = options.session;
	let storage = me.storage;
	let table = options.table;
	storage.redisClient.hincrby ("mssql_sequences", storage.code + "_" + table, 1, function (err, result) {
		success ({id: result});
	});
};
db.MSSQL.prototype.currentTimestamp = function () {
	return "getutcdate ()";
};
// DB struct update
db.MSSQL.prototype.update = function (options) {
	let me = this;
	let storage = me.storage;
	async.series ([
		function (cb) {
			storage.query ({sql: "drop index tobject_attr_ufid", success: function (options) {
				cb ();
			}, failure: function () {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: 'select fremove_rule from tclass_attr', success: function (options) {
				cb ();
			}, failure: function () {
				storage.query ({sql: 'alter table tclass_attr add column fremove_rule varchar (128)', success: function (options) {
					cb ();
				}});
			}});
		},
		function (cb) {
			storage.query ({sql: 'select ftoc from trevision', success: function (options) {
				cb ();
			}, failure: function () {
				storage.query ({sql: 'alter table trevision add column ftoc bigint', success: function (options) {
					storage.query ({sql: 'create index trevision_ftoc on trevision (ftoc)', success: function (options) {
						cb ();
					}});
				}});
			}});
		},
		function (cb) {
			/*
			let tables = ["trevision", "tclass", "tclass_attr", "tview", "tview_attr", "tobject", "tobject_attr", "taction", "taction_attr"];
			// create sequences
			async.map (tables, function (table, cb) {
				storage.query ({sql: "select * from sequence_" + table, success: function (options) {
					cb ();
				}, failure: function () {
					storage.query ({sql: "select max (fid) as maxid from " + table, success: function (options) {
						let initVal = 1000;
						if (options.result.rows [0].maxid) {
							initVal = options.result.rows [0].maxid;
						};
						async.series ([
							function (cb) {
								storage.query ({sql: "create table sequence_" + table + " (fid bigint identity (" + initVal + ", 1))", success: function (options) {
									cb ();
								}, failure: function () {
									cb ();
								}});
							},
							function (cb) {
								storage.query ({sql: "insert into sequence_" + table + " default values", success: function (options) {
									cb ();
								}, failure: function () {
									cb ();
								}});
							}
						], function (err, results) {
							cb ();
						});
					}, failure: function () {
						cb ();
					}});
				}});
			}, function (err, results) {
			*/
				me.updateSequences ({success: function () {
					cb ();
				}});
			//});
		}
	], function (err, results) {
		if (options.success) {
			options.success ();
		}
	});
};
db.MSSQL.prototype.updateSequences = function (options) {
	let me = this;
	let storage = me.storage;
	let tables = ["trevision", "tclass", "tclass_attr", "tview", "tview_attr", "tobject", "tobject_attr", "taction", "taction_attr"];
	async.map (tables, function (table, cb) {
		storage.query ({sql: "select max (fid) as maxid from " + table, success: function (options) {
			let tableValue = 1000;
			if (options.result.rows [0].maxid) {
				tableValue = options.result.rows [0].maxid;
			};
			if (tableValue < 1000) {
				tableValue = 1000;
			};
			storage.redisClient.hset ("mssql_sequences", storage.code + "_" + table, tableValue);
			common.log ({file: config.rootDir + "/query.log", text: "sequence: " + storage.code + "_" + table + " = " + tableValue});
			cb ();
		}, failure: function () {
			cb ();
		}});
	}, function (err, results) {
		options.success ();
	});
};
db.MSSQL.prototype.create = function (options) {
	let me = this;
	let storage = me.storage;
	let connection = options.connection;
	let cfg = options.cfg;
	let success = options.success;
	async.series ([
		function (cb) {
			storage.query ({sql: 
				"create database " + connection.dbUser + " on (\n" +
				"    name=" + connection.dbUser + "_dat,\n" +
				"    filename='" + cfg.path + "\\" + connection.dbUser + ".mdf',\n" +
				"    size=10MB,\n" +
				"    filegrowth=5MB\n" +
				") log on (\n" +
				"    name=" + connection.dbUser + "_log,\n" +
				"    filename='" + cfg.path + "\\" + connection.dbUser + ".ldf',\n" +
				"    size=5MB,\n" +
				"    filegrowth=5MB\n" +
				");\n"
			, success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: "create login " + connection.dbUser + " with password = '" + connection.dbPassword + "'", success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: "use " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: "create user " + connection.dbUser + " for login " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: "exec sp_addrolemember 'db_owner', '" + connection.dbUser + "'", success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
//			storage.query ({sql: fs.readFileSync (config.rootDir + "/db/tables.sql").toString (), success: function (options) {
			storage.query ({sql: dbTablesSQL, success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
//			let sql = fs.readFileSync (config.rootDir + "/db/indexes.sql").toString ();
			let sql = dbIndexesSQL;
			sql = sql.replace (
				"create index tobject_fstring on $schema_prefix$tobject_attr (fstring)", 
				"create index tobject_fstring on $schema_prefix$tobject_attr (fid) include (fstring)"
			);
			storage.query ({sql: sql, success: function (options) {
				cb ();
			}, failure: function (options) {
				cb ();
			}});
		},
		function (cb) {
			me.disconnect ();
			me.connect ({success: function () {
				cb ();
			}, failure: function () {
				cb ();
			}});
		},
		function (cb) {
			me.update ({success: function () {
				cb ();
			}, failure: function () {
				cb ();
			}});
		},
		function (cb) {
//			let sql = fs.readFileSync (config.rootDir + "/db/data.sql").toString ().split (";");
			let sql = dbDataSQL;
			async.map (sql, function (s, cb) {
				storage.query ({sql: s, success: function (options) {
					cb ();
				}, failure: function (options) {
					cb ();
				}});
			}, function (err, results) {
				cb ();
			});
		}
	], function (err, results) {
		success ();
	});
};
db.MSSQL.prototype.remove = function (options) {
	let me = this;
	let storage = me.storage;
	let connection = options.connection;
	let cfg = options.cfg;
	let success = options.success;
	storage.query ({sql: "drop database " + connection.dbUser, success: function (options) {
		storage.query ({sql: "drop login " + connection.dbUser, success: function (options) {
			success ();
		}, failure: function (options) {
			success ();
		}});
	}, failure: function (options) {
		success ();
	}});
};
db.MSSQL.prototype.createField = function (options) {
	let storage = this.storage;
	let toc = options.toc;
	let tocField = options.tocField;
	let type = options.type;
	let caId = options.caId;
	let success = options.success;
	storage.query ({sql: "alter table " + toc + " add " + tocField + " " + type, success: function () {
		if (type != "$ttext$") {
			storage.query ({session: options.session, sql: "create index " + toc + "_" + caId + " on " + toc + " (" + tocField + ")", success: function () {
				success ();
			}});
		} else {
			storage.query ({session: options.session, sql: "create index " + toc + "_" + caId + " on " + toc + " (fobject_id) include (" + tocField + ")", success: function () {
				success ();
			}});
		};
	}});
};
db.MSSQL.prototype.createIndex = function (options) {
	let storage = this.storage;
	let success = options.success;
	storage.query ({session: options.session, sql: "create index " + options.table + "_" + options.field + " on " + options.table + " (" + options.field + ")", success: function () {
		success ();
	}});
};
db.MSSQL.prototype.isTableExists = function (options) {
	let storage = this.storage;
	let success = options.success;
	storage.query ({session: options.session, sql: "select count (*) as num from INFORMATION_SCHEMA.TABLES where upper (TABLE_NAME) = upper ('" + options.table + "')", success: function (options) {
		let r = options.result.rows;
		success (r [0].num);
	}});
};

