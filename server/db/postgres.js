//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
//
var pgTypes = pg.types;
// types: select typname, oid, typarray from pg_type where typtype = 'b' order by oid
if (pgTypes) {
	// numeric
	pgTypes.setTypeParser (1700, function (val) {
		return val === null ? null : parseFloat (val);
	});
	// float4
	pgTypes.setTypeParser (700, function (val) {
		return val === null ? null : parseFloat (val);
	});
	// float8
	pgTypes.setTypeParser (701, function (val) {
		return val === null ? null : parseFloat (val);
	});
	// int8
	pgTypes.setTypeParser (20, function (val) {
		return val === null ? null : parseInt (val);
	});
	// int2
	pgTypes.setTypeParser (21, function (val) {
		return val === null ? null : parseInt (val);
	});
	// int4
	pgTypes.setTypeParser (23, function (val) {
		return val === null ? null : parseInt (val);
	});
}
//	Class for PostgreSQL database

db.Postgres = function (options) {
	var me = this;
	me.storage = options;
	me.database = "postgres";
	me.dbEngine = options.connection.dbEngine;
	me.host = options.connection.host;
	me.port = options.connection.port;
	me.db = options.connection.db;
	me.dbUser = options.connection.dbUser;
	me.dbPassword = options.connection.dbPassword;
	me.dbaUser = options.connection.dbaUser;
	me.dbaPassword = options.connection.dbaPassword;
	me.connection = "tcp://" + me.dbUser + ":" + me.dbPassword + "@" + me.host + ":" + me.port + "/" + me.db;
	me.adminConnection = "tcp://" + me.dbaUser + ":" + me.dbaPassword + "@" + me.host + ":" + me.port + "/postgres";
	// Tags for query
	me.tags = {
		schema: me.dbUser,
		schema_prefix: me.dbUser + ".",
		tablespace: "tablespace " + me.dbUser,
		tid: "bigserial",
		tid_object_attr: "bigserial",
		tnumber: "bigint",
		tnumber_value: "numeric",
		ttext: "text",
		ttimestamp: "timestamp (6)",
		tstring: "varchar (1024)",
		tstring_value: "text",
		tocObjectId: "fobject_id bigint not null, primary key (fobject_id)",
		tobject_attr_fstring: "substr (fstring, 1, 1024)"
	};
};
db.Postgres.prototype.connect = function (options) {
	options = options || {};
	var me = this;
	var success = options.success;
	var client = new pg.Client (options.systemDB ? me.adminConnection : me.connection);
	client.connect (function (err) {
		if (!err) {
			me.client = client;
			me.connected = true;
			me.lastActivity = new Date ().getTime ();
			if (client.pauseDrain) {
				client.pauseDrain ();
			};
			me.query ({sql: "select version ()", success: function (options) {
				var v = options.result.rows [0].version;
				v = v.split (" ")[1];
				v = v.split (".");
				v = Number (v [0] * 10) + Number (v [1]);
				me.version = v; // 84, 90, 91, ...
				me.query ({sql: "select pg_backend_pid() as pid", success: function (options) {
					me.pid = options.result.rows [0].pid;
					db.Postgres.prototype.clients = db.Postgres.prototype.clients || {};
					db.Postgres.prototype.clients [me.pid] = me;
					if (success) {
						success ();
					}
				}});
			}});
		} else {
			log.error ({cls: "Postgres", fn: "connect", err: err});
			if (options.failure) {
				options.failure (new VError (err, "Postgres.connect"));
			}
		}
	});
	client.on ("error", function (err) {
		log.error ({cls: "Postgres", fn: "connect", err: err, client_error: true});
	});
};
db.Postgres.prototype.disconnect = function (options) {
	var me = this;
	if (me.client && me.client.end) {
		me.client.end ();
		me.connected = 0;
	};
};
db.Postgres.prototype.query = function (options) {
	var me = this;
	function go () {	
		me.lastActivity = new Date ().getTime ();
		log.debug ({cls: "Postgres", fn: "query", sql: options.sql, params: options.params});
		me.client.query (options.sql, options.params, function (err, result) {
			if (err) {
				log.error ({cls: "Postgres", fn: "query", err: err, sql: options.sql, params: options.params});
				if (options.failure) {
					options.failure (new VError (err, "Postgres.query"));
				}
			} else {
				if (options.success) {
					options.success ({result: result});
				};
			};
		});
	};
	if (me.connected) {
		go ();
	} else {
		me.connect ({success: function () {
			go ();
		}, failure: function (err) {
			if (options.failure) {
				options.failure (new VError (err, "Postgres.query"));
			};
		}});
	};
};
db.Postgres.prototype.startTransaction = function (options) {
	var me = this;
	this.query ({sql: "begin", success: function () {
		options.success ();
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.startTransaction"));
		};
	}});
};
db.Postgres.prototype.commitTransaction = function (options) {
	var me = this;
	this.query ({sql: "commit", success: function () {
		options.success ();
	}, failure: function (err) {
		log.error ({cls: "Postgres", fn: "commitTransaction", err: err});
		if (options.failure) {
			options.failure (new VError (err, "Postgres.commitTransaction"));
		};
	}});
};
db.Postgres.prototype.rollbackTransaction = function (options) {
	var me = this;
	this.query ({sql: "rollback", success: function () {
		options.success ();
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.rollbackTransaction"));
		};
	}});
};
db.Postgres.prototype.getNextId = function (options) {
	var me = this;
	var success = options.success;
	me.query ({sql: "select nextval ('" + options.table + "_fid_seq') as id", success: function (options) {
		var id = options.result.rows [0].id;
		success ({id: id});
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.getNextId"));
		};
	}});
};
db.Postgres.prototype.currentTimestamp = function () {
	return "current_timestamp at time zone 'UTC'";
};
// DB struct update
db.Postgres.prototype.update = function (options) {
	var me = this;
	var storage = me.storage;
	async.series ([
		function (cb) {
			storage.query ({sql: 'select fremove_rule from tclass_attr', success: function (options) {
				cb ();
			}, failure: function () {
				storage.query ({sql: 'alter table tclass_attr add column fremove_rule varchar (128)', success: function (options) {
					cb ();
				}, failure: cb});
			}});
		},
		function (cb) {
			storage.query ({sql: 'select ftoc from trevision', success: function (options) {
				cb ();
			}, failure: function () {
				storage.query ({sql: 'alter table trevision add column ftoc bigint', success: function (options) {
					storage.query ({sql: 'create index trevision_ftoc on trevision (ftoc) tablespace ' + me.storage.code, success: function (options) {
						cb ();
					}, failure: cb});
				}});
			}});
		},
		function (cb) {
			storage.query ({sql:
				"select count (*) as num from pg_catalog.pg_class as c\n" +
				"left join pg_catalog.pg_namespace as n on (n.oid = c.relnamespace)\n" +
				"where c.relkind = 'i' and c.relname = 'tobject_attr_ufid' and n.nspname = '" + storage.code + "'"
			, success: function (options) {
				if (options.result.rows [0].num) {
					storage.query ({sql: "drop index tobject_attr_ufid", success: function (options) {
						cb ();
					}, failure: function () {
						cb ();
					}});
				} else {
					cb ();
				};
			}, failure: function () {
				cb ();
			}});
		},
		function (cb) {
			me.isIndexExists ({index: "tobject_fstring", success: function (exists) {
				if (exists) {
					storage.query ({sql: "drop index tobject_fstring", success: function () {
						storage.query ({sql: "create index tobject_attr_fstring on tobject_attr (substr (fstring, 1, 1024))", success: function () {
							cb ();
						}, failure: function () {
							cb ();
						}});
					}, failure: function () {
						cb ();
					}});
				} else {
					cb ();
				};
			}});
		},
		function (cb) {
			storage.query ({sql: "select data_type from information_schema.columns where table_catalog='" + storage.code + "' and table_name='tview_attr' and column_name='forder'", success: function (options) {
				var rows = options.result.rows;
				if (rows.length && rows [0].data_type != "numeric") {
					storage.query ({sql: "alter table tview_attr alter column forder type numeric", success: function () {
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
			me.updateSequences ({success: function () {
				cb ();
			}, failure: cb});
		}
	], function (err, results) {
		if (err) {
			if (options.failure) {
				options.failure (new VError (err, "Postgres.update"));
			};
		} else {
			if (options.success) {
				options.success ();
			};
		};
	});
};
db.Postgres.prototype.updateSequences = function (options) {
	var me = this;
	var storage = me.storage;
	var tables = ["tclass", "tclass_attr", "tobject", "tobject_attr", "tview", "tview_attr", "taction", "trevision"];
	async.map (tables, function (table, cb) {
		storage.query ({sql: "select max (fid) as max_id from " + table, success: function (options) {
			var qr = options.result.rows;
			var n;
			if (qr.length) {
				n = qr [0].max_id + 1;
			};
			if (!n || n < 1000) {
				n = 1000;
			};
			storage.query ({sql: "alter sequence " + table + "_fid_seq restart with " + n, success: function (options) {
				cb ();
			}, failure: cb});
		}, failure: cb});
	}, function (err, results) {
		if (err) {
			if (options.failure) {
				options.failure (new VError (err, "Postgres.updateSequences"));
			};
		} else {
			if (options.success) {
				options.success ();
			};
		};
	});
};
db.Postgres.prototype.create = function (options) {
	var me = this;
	var storage = me.storage;
	var connection = options.connection;
	var cfg = options.cfg;
	var success = options.success;
	async.series ([
		function (cb) {
			storage.query ({client: me, sql: "create role " + connection.dbUser + " noinherit login password '" + connection.dbPassword + "'", success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "create tablespace " + connection.dbUser + " owner " + connection.dbUser + " location '" + cfg.path + "'", success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "create database " + connection.db + " owner " + connection.dbUser + " encoding 'utf8' tablespace " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			me.disconnect ();
			me.connect ({client: me, success: function () {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "create schema " + connection.dbUser + " authorization " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			var sql = dbTablesSQL;
			storage.query ({client: me, sql: sql, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			var sql = dbIndexesSQL;
			storage.query ({client: me, sql: sql, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			if (me.dbEngine && me.dbEngine.enabled) {
				var sql = dbEngineSQL;
				storage.query ({client: me, sql: sql, success: function (options) {
					cb ();
				}, failure: function (err) {
					cb ();
				}});
			} else {
				cb ();
			};
		},
		function (cb) {
			var sql = dbDataSQL;
			storage.query ({client: me, sql: sql, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			me.update ({success: function () {
				cb ();
			}});
		}
	], function (err, results) {
		success ();
	});
};
db.Postgres.prototype.remove = function (options) {
	var me = this;
	var storage = me.storage;
	var connection = options.connection;
	var cfg = options.cfg;
	var success = options.success;
	async.series ([
		function (cb) {
			me.disconnect ();
			me.connect ({success: function () {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "drop schema " + connection.dbUser + " cascade", success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			me.disconnect ();
			me.connect ({systemDB: true, success: function () {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "drop database " + connection.db, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "drop tablespace " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({client: me, sql: "drop role " + connection.dbUser, success: function (options) {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		}
	], function (err, results) {
		success ();
	});
};
db.Postgres.prototype.createField = function (options) {
	var storage = this.storage;
	var toc = options.toc;
	var tocField = options.tocField;
	var type = options.type;
	var caId = options.caId;
	var success = options.success;
	async.series ([
		function (cb) {
			storage.query ({session: options.session, sql: "alter table " + toc + " add column " + tocField + " " + type, success: function () {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql: "create index " + toc + "_" + caId + " on " + toc + " (" + tocField + ")", success: function () {
				cb ();
			}, failure: function (err) {
				cb ();
			}});
		}
	], function (err) {
		success ();
	});
/*
	storage.query ({session: options.session, sql: "alter table " + toc + " add column " + tocField + " " + type, success: function () {
		storage.query ({sql: "create index " + toc + "_" + caId + " on " + toc + " (" + tocField + ")", success: function () {
			success ();
		}, failure: function (err) {
			if (options.failure) {
				options.failure (new VError (err, "Postgres.createField"));
			};
		}});
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.createField"));
		};
	}});
*/
};
db.Postgres.prototype.createIndex = function (options) {
	var storage = this.storage;
	var success = options.success;
	storage.query ({session: options.session, sql: "create index " + options.table + "_" + options.field + " on " + options.table + " (" + options.field + ")", success: function () {
		success ();
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.createIndex"));
		};
	}});
};
db.Postgres.prototype.isTableExists = function (options) {
	var success = options.success;
	this.storage.query ({session: options.session, sql: "select count (*) as num from pg_tables where upper (schemaname) = upper ('$schema$') and upper (tablename) = upper ('" + options.table + "')", success: function (options) {
		var r = options.result.rows;
		success (r [0].num);
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.isTableExists"));
		};
	}});
};
db.Postgres.prototype.isFieldExists = function (options) {
	var success = options.success;
	this.storage.query ({session: options.session, sql: "select count (*) as num from information_schema.columns where lower (table_name) = lower ('" + options.table + "') and lower (column_name) = lower ('" + options.field + "')", success: function (options) {
		var r = options.result.rows;
		success (r [0].num);
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.isFieldExists"));
		};
	}});
};
db.Postgres.prototype.isIndexExists = function (options) {
	var success = options.success;
	this.storage.query ({session: options.session, sql:
		"select count (*) as num from pg_catalog.pg_class as c\n" +
		"left join pg_catalog.pg_namespace as n on (n.oid = c.relnamespace)\n" +
		"where c.relkind = 'i' and lower (c.relname) = lower ('" + options.index + "') and n.nspname = '" + this.storage.code + "'"
	, success: function (options) {
		var r = options.result.rows;
		success (r [0].num);
	}, failure: function (err) {
		if (options.failure) {
			options.failure (new VError (err, "Postgres.isIndexExists"));
		};
	}});
};

