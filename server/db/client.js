//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var db = {};
//	Factory of databases clients
db.create = function (options) {
	if (options.connection.database == "postgres") {
		var client = new db.Postgres (options);
		return client;
	} else
	if (options.connection.database == "mssql") {
		var client = new db.MSSQL (options);
		return client;
	} else {
		throw "Client ({database: '" + options.connection.database + "'}) unsupported database.";
	};
};
// Execute fn
db.execute = function (options) {
	var cfg = options;
	var storage;
	async.series ([
		function (cb) {
			projects.loadConfig ({
				code: cfg.code, success: function () {
					cb ();
				}, failure: function (err) {
					cb (err);
				}
			});
		},
		function (cb) {
			var connection = config.storages [cfg.code];
			if (cfg.fn == "rebuild") {
				storage = new Storage ({code: cfg.code, connection: connection, success: function () {
					console.log ("Rebuilding storage ...");
					var i = new Import ();
				    i.removeTOC ({storage: storage, success: function () {
						i.createTOC ({storage: storage, success: function () {
							console.log ("Storage rebuilded.");
							cb ();
						}});
				    }});
				}});
			    return;
			};
			storage = new Storage ({systemDB: true, code: cfg.code, connection: connection, success: function () {
				if (cfg.fn == "create") {
					console.log ("Creating storage ...");
					storage.client.create ({cfg: cfg, connection: connection, success: function () {
						console.log ("Storage created.");
						cb ();
					}});
				};
				if (cfg.fn == "remove") {
					console.log ("Removing storage ...");
					storage.client.remove ({cfg: cfg, connection: connection, success: function () {
						console.log ("Storage removed.");
						cb ();
					}});
				};
				if (cfg.fn == "clear") {
					console.log ("Clearing storage ...");
					db.clear ({storage: storage, success: function () {
						console.log ("Storage cleared.");
						cb ();
					}});
				};
			}, failure: function (options) {
				cb (options.error);
			}});
		}
	], function (err) {
		if (err) {
			common.log ({file: config.rootDir + "/error.log", text: err});
		} else {
			storage.freeResources ();
			if (cfg.success) {
				cfg.success ();
			};
		};
	});
};
db.clear = function (options) {
	var me = this;
	var storage = options.storage;
	var success = options.success;
	var tables = [];
	async.series ([
		function (cb) {
			storage.client.disconnect ();
			storage.client.connect ({success: function () {
				cb ();
			}, failure: function () {
				cb ();
			}});
		},
		function (cb) {
			storage.query ({sql:
				"select fid, fcode from tclass\n" +
				"where " + storage.getCurrentFilter () + "\n" +
				"order by fid\n"
			, success: function (options) {
				var rows = options.result.rows;
				for (var i = 0; i < rows.length; i ++) {
					var tocName = rows [i].fcode + "_" + rows [i].fid;
					tables.push (tocName);
				};
				tables.push ("taction");
				tables.push ("taction_attr");
				tables.push ("tclass");
				tables.push ("tclass_attr");
				tables.push ("tobject");
				tables.push ("tobject_attr");
				tables.push ("tview");
				tables.push ("tview_attr");
				tables.push ("trevision");
				tables.push ("tright");
				tables.push ("tsession");
				tables.push ("tschema");
				tables.push ("tmail");
				cb ();
			}, failure: function (options) {
				cb (options.error);
			}});
		},
		function (cb) {
			async.map (tables, function (table, cb) {
				storage.client.isTableExists ({table: table, success: function (exists) {
					if (exists) {
						storage.query ({sql: "drop table " + table + " cascade", success: function (options) {
							cb ();
						}});
					} else {
						cb ();
					};
				}});
			}, function (err, results) {
				cb ();
			});
		}
	], function (err, results) {
		if (err) {
			common.log ({file: config.rootDir + "/error.log", text: "error: " + err});
		};
		success ();
	});
};
/*
	Init project folder
*/
db.init = function (options) {
	var cfg = config.storages [options.code]
	var rootDir = cfg.rootDir;
	var dir = [
	];
	var files = [
	];
	async.series ([
		function (cb) {
			fs.mkdir (rootDir, cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/files", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/plugins", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/css", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/images", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/scripts", cb);
		},
		function (cb) {
			fs.mkdir (rootDir + "/schema", cb);
		},
		function (cb) {
			fs.readFile (config.rootDir + "/server/project-app/schema/schema-app.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/schema/schema-app.js", data, cb);
			});
		},
		function (cb) {
			var html =
				'<html>\n' +
				'<head>\n' +
				'\t<title>' + cfg.code + '</title>\n' +
				'\t<!-- ExtJS -->\n' +
				'\t<link rel="stylesheet" type="text/css" href="/third-party/extjs4/resources/css/ext-all-objectum.css">\n' +
				'\t<script type="text/javascript" src="/third-party/extjs4/ext-all-debug.js"></script>\n' +
				'\t<script type="text/javascript" src="/third-party/extjs4/locale/ext-lang-ru.js" charset="UTF-8"></script>\n' +
				'\t<!-- Objectum Client -->\n' +
				'\t<link rel="stylesheet" type="text/css" href="/client/extjs4/css/images.css">\n' +
				'\t<script type="text/javascript" src="/client/extjs4/all-debug.js" charset="UTF-8"></script>\n' +
				'\t<!-- Current configuration -->\n' +
				'\t<script type="text/javascript" src="resources/scripts/all-debug.js" charset="UTF-8"></script>\n' +
				'</head>\n' +
				'<body>\n' +
				'\t<div id="loading"></div>\n' +
				'\t<script type="text/javascript" charset="UTF-8">\n' +
				'\t\t$o.app.start ({"code": "' + cfg.code + '", "name": "' + cfg.code + '", "version": "1.0", "locale": "en", "useHash":true});\n' +
				'\t</script>\n' +
				'</body>\n' +
				'</html>\n'
			;
			fs.writeFile (rootDir + "/index.html", html, cb);
		},
		function (cb) {
		},
		function (cb) {
		},
		function (cb) {
		},
	], function (err) {
	});
};

