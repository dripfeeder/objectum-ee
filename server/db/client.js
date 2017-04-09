//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
global.db = {};
global.dbTablesSQL = JSON.stringify (fs.readFileSync ("./server/db/tables.sql", "utf8"));
global.dbIndexesSQL = JSON.stringify (fs.readFileSync ("./server/db/indexes.sql", "utf8"));
global.dbDataSQL = JSON.stringify (fs.readFileSync ("./server/db/data.sql", "utf8"));
global.dbEngineSQL = JSON.stringify (fs.readFileSync ("./server/db/engine.sql", "utf8"));
//	Factory of databases clients
db.create = function (options) {
	if (options.connection.database == "postgres") {
		let client = new db.Postgres (options);
		return client;
	} else
	if (options.connection.database == "mssql") {
		let client = new db.MSSQL (options);
		return client;
	} else {
		throw "Client ({database: '" + options.connection.database + "'}) unsupported database.";
	};
};
// Execute fn
db.execute = function (options) {
	let cfg = options;
	let storage;
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
			let connection = config.storages [cfg.code];
			if (cfg.fn == "init") {
				console.log ("Initializing folder ...");
				connection.code = cfg.code;
				connection.locale = cfg.locale;
				connection.name = cfg.name;
				db.init (connection, function (err) {
					if (err) {
						console.error ("Error:", err);
					} else {
						console.log ("Folder initialized");
					};
				});
			    return;
			};
			if (cfg.fn == "rebuild") {
				storage = new Storage ({code: cfg.code, connection: connection, success: function () {
					console.log ("Rebuilding storage ...");
					let i = new Import ();
				    i.removeTOC ({storage: storage, success: function () {
						i.createTOC ({storage: storage, success: function () {
							console.log ("Storage rebuilded.");
							cb ();
						}});
				    }});
				}});
			    return;
			};
			if (cfg.fn == "import") {
				console.log ("Importing storage ...");
				let i = new Import ();
			    i.importFromFile ({
			    	code: cfg.code,
			    	file: cfg.file,
			    	success: function () {
						console.log ("Storage imported.");
						cb ();
					}
			    });
			    return;
			};
			if (cfg.fn == "export") {
				console.log ("Exporting storage ...");
				let e = new Export ();
			    e.exportToFile ({
			    	schema: _.has (cfg, "schema") ? cfg.schema : true,
			    	code: cfg.code,
			    	file: cfg.file,
			    	classes: cfg.classes || "all",
			    	views: cfg.views || "all",
			    	except: {
			    		tobject: [{
			    			fclass_id: cfg.filterClasses || []
			    		}]
			    	},
			    	space: _.has (cfg, "space") ? cfg.space : "\t",
			    	success: function () {
						console.log ("Storage exported.");
						cb ();
					}
			    });
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
			if (storage) {
				storage.freeResources ();
			};
			if (cfg.success) {
				cfg.success ();
			};
		};
	});
};
db.clear = function (options) {
	let me = this;
	let storage = options.storage;
	let success = options.success;
	let tables = [];
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
				let rows = options.result.rows;
				for (let i = 0; i < rows.length; i ++) {
					let tocName = rows [i].fcode + "_" + rows [i].fid;
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
db.init = function (cfg, cb) {
	let rootDir = cfg.rootDir, appDir;
	async.series ([
		function (cb) {
			fs.mkdir (rootDir, function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/files", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/plugins", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/css", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/images", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/resources/scripts", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.mkdir (rootDir + "/schema", function (err) {
				cb ();
			});
		},
		function (cb) {
			fs.stat (config.rootDir + "/server/project-app/schema/schema-app.js", function (err, stats) {
				if (err) {
					appDir = config.rootDir + "/node_modules/objectum-ee/server/project-app"
				} else {
					appDir = config.rootDir + "/server/project-app"
				};
				cb ();
			});
		},
		function (cb) {
			fs.readFile (appDir + "/schema/schema-app.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/schema/schema-app.js", data, cb);
			});
		},
		function (cb) {
			fs.readFile (appDir + "/plugins/vo.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/plugins/vo.js", data, cb);
			});
		},
		function (cb) {
			fs.readFile (appDir + "/plugins/plugins.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/plugins/plugins.js", data, cb);
			});
		},
		function (cb) {
			fs.readFile (appDir + "/plugins/compiler.jar", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/plugins/compiler.jar", data, function (err) {
					cb ();
				});
			});
		},
		function (cb) {
			fs.writeFile (rootDir + "/resources/scripts/vo-debug.js", "", cb);
		},
		function (cb) {
			fs.writeFile (rootDir + "/plugins/actions.js", "", cb);
		},
		function (cb) {
			let html =
				'<html>\n' +
				'<head>\n' +
				'\t<title>' + cfg.name + '</title>\n' +
				'\t<!-- ExtJS -->\n' +
				'\t<link rel="stylesheet" type="text/css" href="/third-party/extjs4/resources/css/ext-all-objectum.css">\n' +
				'\t<script type="text/javascript" src="/third-party/extjs4/ext-all-debug.js"></script>\n' +
				'\t<script type="text/javascript" src="/third-party/extjs4/locale/ext-lang-' + cfg.locale + '.js" charset="UTF-8"></script>\n' +
				'\t<!-- Objectum Client -->\n' +
				'\t<link rel="stylesheet" type="text/css" href="/client/extjs4/css/images.css">\n' +
				'\t<script type="text/javascript" src="/client/extjs4/all-debug.js" charset="UTF-8"></script>\n' +
				'\t<!-- App -->\n' +
				'\t<script type="text/javascript" src="resources/scripts/vo-debug.js" charset="UTF-8"></script>\n' +
				'</head>\n' +
				'<body>\n' +
				'\t<div id="loading"></div>\n' +
				'\t<script type="text/javascript" charset="UTF-8">\n' +
				'\t\t$o.app.start ({"code": "' + cfg.code + '", "name": "' + cfg.name + '", "version": "1.0", "locale": "' + cfg.locale + '", "useHash":true});\n' +
				'\t</script>\n' +
				'</body>\n' +
				'</html>\n'
			;
			fs.writeFile (rootDir + "/index.html", html, cb);
		}
	], function (err) {
		cb (err);
	});
};
