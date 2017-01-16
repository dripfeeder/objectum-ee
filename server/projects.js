/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var projects = {};
projects.init = function (options) {
	redisClient = redis.createClient (config.redis.port, config.redis.host);
	redisPub = redis.createClient (config.redis.port, config.redis.host);
	redisSub = redis.createClient (config.redis.port, config.redis.host);
	async.series ([
		function (cb) {
			if (config.redis.db) {
				redisClient.select (config.redis.db, function (err, res) {
					redisPub.select (config.redis.db, function (err, res) {
						redisSub.select (config.redis.db, function (err, res) {
							cb ();
						});
					});
				});
			} else {
				cb ();
			};
		}
	], function (err) {
		redisSub.on ("message", function (channel, message) {
			if (channel == config.redis.db + "-storages") {
				var r = JSON.parse (message);
				if (r.free && projects.storagePool) {
					projects.storagePool [r.free].freeResources ();
					delete projects.storagePool [r.free];
				};
			};
			if (channel == config.redis.db + "-cluster") {
				if (message == "restart") {
					process.exit (1);
				};
			};
			if (channel == config.redis.db + "-sessions") {
				var r = JSON.parse (message);
				var session = projects.sessions [r.removed];
				if (session && session.storage) {
					session.storage.rollbackTransaction ({session: session});
				};
				if (r.removed && projects.sessions [r.removed]) {
					delete projects.sessions [r.removed];
				};
			};
			if (channel == config.redis.db + "-connections") {
				var r = JSON.parse (message);
				if (r.terminate) {
					for (var storageCode in projects.storagePool) {
						var storage = projects.storagePool [storageCode];
						var has = 0;
						for (var sid in storage.clientPool) {
							var client = storage.clientPool [sid];
							if (client.pid == r.terminate) {
								has = 1;
								log.info ({cls: "connections"}, "connections disconnect " + r.terminate);
								storage.rollbackTransaction ({session: projects.sessions [sid], success: function () {
									//client.disconnect ();
								}});
							};
						};
						if (!has && db.Postgres.clients && db.Postgres.clients [r.terminate]) {
							log.info ({cls: "connections"}, "connections disconnect db.Postgres " + r.terminate);
							db.Postgres.clients [r.terminate].disconnect ();
						};
					};
				};
			};
		});
		redisSub.subscribe (config.redis.db + "-storages");
		redisSub.subscribe (config.redis.db + "-sessions");
		redisSub.subscribe (config.redis.db + "-connections");
		redisSub.subscribe (config.redis.db + "-cluster");
		options.success ();
	});
};
projects.loadConfig = function (options) {
	var storageCode = options.code;
	var success = options.success;
	var failure = options.failure;
	if (!config.storages.hasOwnProperty (storageCode) && config.projectsDir) {
		fs.readFile (config.projectsDir + "/" + storageCode + "/config.json", function (err, data) {
			if (err) {
				failure ("Unknown storage: " + storageCode);
			} else {
				try {
					config.storages [storageCode] = JSON.parse (data);
				} catch (e) {
					console.error (e);
					failure ("Unknown storage: " + storageCode);
					return;
				};
				success ();
			};
		});
	} else {
		success ();
	};
};
projects.getHandler = function (request, response, next) {
	var tokens = request.url.split ("/");
	if (tokens.length == 3) {
		tokens.push ("");
		response.redirect (tokens.join ("/"));
		return;
	};
	var storageCode = tokens [2];
	var pathname = "/" + tokens.slice (3).join ("/");
	if (pathname == "/") {
		pathname = "/index.html";
	}
	pathname = pathname.split ("?")[0];
	projects.loadConfig ({
		code: storageCode, success: function () {
			var filePath = config.storages [storageCode].rootDir + pathname;
			server.www ({request: request, response: response, next: next, filePath: filePath, nocache: pathname.substr (0, 6) == "/files"});
		}, failure: function (err) {
			response.end ("unknown url: " + request.url);
		}
	});
};
projects.startProjectPlugins = function (options) {
	options = options || {};
	var success = options.success;
	var storage = options.storage;
	async.series ([
		function (cb) {
			if (config.storages [storage.code].pluginStarted || config.storages [storage.code].disablePlugins) {
				cb ();
				return;
			};
			config.storages [storage.code].pluginStarted = 1;
			var pluginsFile = config.storages [storage.code].rootDir + "/plugins/plugins.js"
			fs.exists (pluginsFile, function (exists) {
				if (exists) {
					var m = require (pluginsFile);
					async.series ([
						function (cb) {
							if (m.init && server.objectum) {
								m.init ({objectum: server.objectum, storage: storage, success: function () {
									log.info ({cls: "plugins"}, "plugin " + pluginsFile + " initialized.");
									cb ();
								}, failure: function (err) {
									log.error ({cls: "plugins", error: pluginsFile + " error: " + err});
									cb ();
								}});
							} else {
								cb ();
							};
						}
					], function (err, result) {
						if (m.handler) {
							server.projectPlugins [storage.code] = m.handler;
							log.info ({cls: "plugins"}, "plugin " + pluginsFile + " handler activated.");
						};
						cb ();
					});
				} else {
					cb ();
				};
			});
		}
	], function (err, results) {
		if (success) {
			success ();
		};
	});
};
projects.storagePool = {};
projects.getStorage = function (options) {
	log.info ({cls: "projects", fn: "getStorage", code: options.storageCode});
	var request = options.request;
	var response = options.response;
	var success = options.success;
	var failure = options.failure;
	var storageCode = options.storageCode;
   	if (!projects.storagePool [storageCode]) {
   		async.series ([
   			function (cb) {
				if ((config.port == config.startPort || process.env.mainWorker) && config.redis.resetCache) {
					redisClient.del (storageCode + "-requests");
					redisClient.del (storageCode + "-objects");
					redisClient.del (storageCode + "-sequences");
					redisClient.del (storageCode + "-vars");
					redisClient.keys (storageCode + "-objects*", function (err, result) {
						for (var i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						};
						cb ();
					});
				} else {
					cb ();
				};
			},
   			function (cb) {
   				projects.loadConfig ({
   					code: storageCode, success: function () {
   						cb ();
   					}, failure: function (err) {
   						cb (err);
   					}
   				});
   			},
   			function (cb) {
				projects.storagePool [storageCode] = new Storage ({code: storageCode, connection: config.storages [storageCode], authInfoUpdater: true, success: function () {
					projects.storagePool [storageCode].config = config.storages [storageCode];
					projects.storagePool [storageCode].rootDir = config.storages [storageCode].rootDir;
					projects.storagePool [storageCode].visualObjectum = config.storages [storageCode].visualObjectum || {};
					if (config.port == config.startPort || process.env.mainWorker) {
						projects.reloadUniqueValues ({storage: projects.storagePool [storageCode], success: function () {
							cb ();
						}});
					} else {
						cb ();
					};
				}, failure: function (options) {
					if (request && response) {
						projects.sendError ({request: request, response: response, error: options.error});
					};
					cb (options.error);
				}});
   			},
   			function (cb) {
				if (projects.storagePool [storageCode].visualObjectum.timeMachine && projects.storagePool [storageCode].visualObjectum.timeMachine.showDates) {
					projects.storagePool [storageCode].query ({sql: "select fid, fdate from trevision where ftoc=1 order by fdate desc", success: function (options) {
						var r = [];
						for (var i = 0; i < options.result.rows.length; i ++) {
							var row = options.result.rows [i];
							r.push ({id: row.fid, date: row.fdate});
						};
						projects.storagePool [storageCode].visualObjectum.timeMachine.dates = r;
						cb ();
					}});
				} else {
					cb ();
				};
   			},
   			function (cb) {
   				tm.build (projects.storagePool [storageCode]);
   				cb ();
   			},
   			function (cb) {
				projects.startProjectPlugins ({storage: projects.storagePool [storageCode], success: function () {
					cb ();
				}});
   			}
   		], function (err, results) {
   			if (err) {
				if (failure) {
		   			log.error ({cls: "projects", fn: "getStorage", error: err});
					failure ({error: err});
				};
   			} else {
				success ({storage: projects.storagePool [storageCode]});
   			};
   		});
   	} else {
   		success ({storage: projects.storagePool [storageCode]});
   	}
};
projects.sessions = {};
projects.saveSession = function (session) {
	var hdata = {};
	hdata [session.id + "-id"] = session.id;
	hdata [session.id + "-username"] = session.username;
	hdata [session.id + "-clock"] = String (session.activity.clock);
	hdata [session.id + "-storageCode"] = session.storage.code;
	hdata [session.id + "-newsRevision"] = String (session.news.revision);
	hdata [session.id + "-port"] = String (config.port);
	if (session.userId) {
		hdata [session.id + "-userId"] = String (session.userId);
	}
	if (session.logined) {
		hdata [session.id + "-logined"] = String (session.logined);
	}
	if (session.ip) {
		hdata [session.id + "-ip"] = String (session.ip);
	}
	redisClient.hmset ("sessions", hdata);
};
projects.tryLogin = function (options) {
	var success = options.success;
	var storage = options.storage;
	var session = options.session;
	var authOld = options.authOld;
	var sessionId = session.id;
	var cookies = options.cookies;
	projects.sessions [sessionId] = session;
	projects.saveSession (session);
	var roleId = "null";
	var menuId = "null";
	if (storage.subjectRoles [session.userId]) {
		roleId = storage.subjectRoles [session.userId].role;
		menuId = storage.subjectRoles [session.userId].menu;
	};
	if (authOld) {
		success ({result: sessionId + " " + session.userId + " 3 " + roleId + " " + menuId, access: "granted"});
	} else {
		success ({result: JSON.stringify ({
			sessionId: sessionId,
			userId: session.userId,
			roleId: roleId,
			menuId: menuId,
			access: "granted"
		})});
	};
};
projects.authActiveDirectory = function (opts, cb) {
	var storage = opts.storage;
	var login = opts.login;
	var password = opts.password;
	var config = storage.config.activeDirectory;
	if (storage.authRecords [login] && config) {
		try {
			var ActiveDirectory = require ("activedirectory");
			var ad = new ActiveDirectory (config);
			ad.authenticate (login, password, function (err, auth) {
				if (!err && auth) {
					cb ("complete");
				} else {
					cb ();
				};
			});
		} catch (e) {
			cb ();
		};
	} else {
		cb ();
	};
};
projects.checkAuth = function (request, response, next) {
	// Аутентификация администратора
	var authorizeAdmin = function (options) {
		var storage = options.storage;
		var login = options.login;
		var password = options.password;
		var authOld = options.authOld;
		if (login == "admin" && password == config.storages [storage.code].adminPassword) {
			var sessionId = sha.hex_sha1 (common.getRemoteAddress (request) + new Date ().getTime () + Math.random ());
			projects.sessions [sessionId] = {
				id: sessionId,
				username: "admin",
				userId: null,
				activity: {
					clock: config.clock
				},
				storage: storage,
				news: {
					revision: 0
				},
				transaction: {
					active: false
				},
				logined: common.currentUTCTimestamp (),
				ip: common.getRemoteAddress (request)
			};
			projects.saveSession (projects.sessions [sessionId]);
			if (authOld) {
				projects.send ({request: request, response: response, msg: sessionId + " null 3 admin admin"});
			} else {
				projects.send ({request: request, response: response, msg: JSON.stringify ({
					sessionId: sessionId,
					userId: null,
					roleId: "admin",
					menuId: "admin"
				})});
			};
			return true;
		} else {
			return false;
		};
	};
	var authorizeAutologin = function (options) {
		var storage = options.storage;
		var login = options.login;
		var password = options.password;
		var authOld = options.authOld;
		if (login == "autologin" && config.storages [storage.code].autologin) {
			var sessionId = sha.hex_sha1 (common.getRemoteAddress (request) + new Date ().getTime () + Math.random ());
			projects.sessions [sessionId] = {
				id: sessionId,
				username: "autologin",
				userId: null,
				activity: {
					clock: config.clock
				},
				storage: storage,
				news: {
					revision: 0
				},
				transaction: {
					active: false
				},
				logined: common.currentUTCTimestamp (),
				ip: common.getRemoteAddress (request)
			};
			projects.saveSession (projects.sessions [sessionId]);
			if (authOld) {
				projects.send ({request: request, response: response, msg: sessionId + " null 3 autologin autologin"});
			} else {
				projects.send ({request: request, response: response, msg: JSON.stringify ({
					sessionId: sessionId,
					userId: null,
					roleId: "autologin",
					menuId: "autologin"
				})});
			};
			return true;
		} else {
			return false;
		};
	};
	// Аутентификация пользователя
	var authorizeUser = function (options) {
		var storage = options.storage;
		var login = options.login;
		var password = options.password;
		var passwordPlain = options.passwordPlain;
		var authOld = options.authOld;
		var rows, userId, sessionId, session;
		if (storage.authRecords [login] && storage.authRecords [login].tryNum >= 3 && config.clock - storage.authRecords [login].lastTry < 600) {
			if (authOld) {
				return projects.send ({request: request, response: response, msg: "wait " + (600 - (config.clock - storage.authRecords [login].lastTry))});
			} else {
				return projects.send ({request: request, response: response, msg: JSON.stringify ({
					wait: (600 - (config.clock - storage.authRecords [login].lastTry))
				})});
			};
		}
		async.series ([
			function (cb) {
				if (storage.authRecords [login] && storage.authRecords [login].password == password) {
					sessionId = sha.hex_sha1 (common.getRemoteAddress (request) + new Date ().getTime () + Math.random ());
					userId = storage.authRecords [login].objectId;
					session = {
						id: sessionId,
						username: login,
						userId: userId,
						roles: storage.ose.subject.getRoles (userId),
						activity: {
							clock: config.clock
						},
						storage: storage,
						news: {
							revision: 0
						},
						transaction: {
							active: false
						},
						logined: common.currentUTCTimestamp (),
						ip: common.getRemoteAddress (request)
					};
					cb ("complete");
				} else {
					projects.authActiveDirectory ({
						storage: storage,
						login: login,
						password: passwordPlain
					}, cb);
				};
			}
		], function (err, results) {
			if (err == "complete") {
				projects.tryLogin ({storage: storage, session: session, cookies: common.getCookies (request.headers.cookie), authOld: authOld, success: function (options) {
					projects.logLastTry (storage, login, true);
					projects.send ({request: request, response: response, msg: options.result});
				}});
			} else {
				projects.logLastTry (storage, login, false);
				if (authOld) {
					projects.send ({request: request, response: response, msg: ""});
				} else {
					response.writeHead (401, {"Content-Type": "text/html; charset=utf-8"});
					response.end ('{"error": "401 Unauthenticated"}');
				};
			};
		});
	};
	// Пользователь аутентифицирован на данной ноде
	var authorized = function (options) {
		request.session = projects.sessions [request.session.id];
		request.session.activity.clock = config.clock;
		redisClient.hset ("sessions", request.session.id + "-clock", config.clock);
		next ();
	};
   	if (request.query.authorize == 1) {
   		/*
   		var tokens = request.body.split ("\n");
   		var login = tokens [0];
   		var password = tokens [1];
   		var passwordPlain = tokens.length > 2 ? tokens [2] : null;
   		*/
   		var login, password, passwordPlain, opts, authOld = false;
   		try {
   			opts = JSON.parse (request.body);
   			login = opts.username;
   			password = opts.password;
   			passwordPlain = opts.passwordPlain;
   		} catch (e) {
   			authOld = true;
	   		var tokens = request.body.split ("\n");
	   		login = tokens [0];
	   		password = tokens [1];
	   		passwordPlain = tokens.length > 2 ? tokens [2] : null;
   		};
		var tokens = request.url.split ("/");
		var storageCode = tokens [2];
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;
			if (!authorizeAdmin ({storage: storage, login: login, password: password, authOld: authOld})) {
				if (!authorizeAutologin ({storage: storage, login: login, password: password, authOld: authOld})) {
					authorizeUser ({storage: storage, login: login, password: password, passwordPlain: passwordPlain, authOld: authOld});
				}
			}
		}});
	} else {
		if (!projects.sessions [request.session.id]) {
			response.writeHead (401, {"Content-Type": "text/html; charset=utf-8"});
			/*
			response.end (
				"<html>" +
				"<head><title>Unauthenticated</title></head>" +
				"<body><h1>401 Unauthenticated</h1></body>" +
				"</html>"
			);
			*/
			response.end ('{"error": "401 Unauthenticated"}');
		} else {
			authorized ();
		}
	}
};
// Сообщить пользователю ошибку
// Обработчик на клиенте в storage.parseResponse
projects.sendError = function (options) {
	var request = options.request;
	var response = options.response;
	if (options.error && typeof (options.error) == "object") {
		if (options.error.message) {
			options.error = options.error.message;
		} else {
			options.error = util.inspect (options.error);
		};
	}
	response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
	response.end ("{header: {error: " + JSON.stringify (options.error) + "}, data: []}");
	log.error ({cls: "projects", error: "sessionId: " + request.session.id + ", error: " + util.inspect (options.error)});
}
// Сообщить пользователю
projects.send = function (options) {
	var request = options.request;
	var response = options.response;
	response.writeHead (200, {
		"Content-Type": "text/html; charset=utf-8"//,
		//"Content-Length": Buffer.byteLength (options.msg, "utf8")
	});
	response.end (options.msg);
	log.debug ({cls: "projects", fn: "send", params: options.msg});
}
// request: pm.Storage.startTransaction("kkk"):
// response: {header: {error: ''},data: 1295718}
projects.startTransaction = function (request, response, next) {
   	if (request.storageFn == "startTransaction") {
   		log.debug ({cls: "projects", fn: "startTransaction", params: request.storageParam});
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
   		var params = eval ("(" + request.storageParam + ")");
   		var storage;
   		async.series ([
   			function (cb) {
				projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
					storage = options.storage;
					cb ();
				}});
   			},
   			function (cb) {
				if (projects.sessions [request.session.id].transaction.active) {
					storage.commitTransaction ({session: request.session, success: function (options) {
						projects.sessions [request.session.id].transaction.active = false;
						cb ();
					}, failure: function (err) {
						cb ();
					}});
				} else {
					cb ();
				};
   			}
   		], function (err, results) {
			storage.startTransaction ({
				session: request.session, 
				remoteAddr: common.getRemoteAddress (request), 
				description: params, 
				success: function (options) {
					var revision = options.revision;
					if (!projects.sessions [request.session.id]) {
						storage.rollbackTransaction ({session: request.session, success: function (options) {
							projects.sendError ({request: request, response: response, error: "invalid session in start transaction"});
						}});
					} else {
						projects.sessions [request.session.id].transaction.active = true;
						projects.send ({request: request, response: response, msg: "{header: {error: ''},data: " + revision + "}"});
					};
				},
				failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.startTransaction")});
				}
			});
   		});
   	} else {
   		next ();
   	}
};
// request: pm.Storage.commitTransaction(112457):
// response: {header: {error: ''},data: 112457}
projects.commitTransaction = function (request, response, next) {
   	if (request.storageFn == "commitTransaction") {
   		log.debug ({cls: "projects", fn: "commitTransaction", params: request.storageParam});
		if (projects.sessions [request.session.id].transaction.active) {
			projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
				var storage = options.storage;
				storage.commitTransaction ({session: request.session, success: function (options) {
					projects.sessions [request.session.id].transaction.active = false;
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: " + options.revision + "}"});
				}, failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.commitTransaction")});
				}});
			}});
		} else {
			projects.send ({request: request, response: response, msg: "{header: {error: ''},data: 'Transaction not active'}"});
		}
   	} else {
   		next ();
   	}
};
projects.rollbackTransaction = function (request, response, next) {
   	if (request.storageFn == "rollbackTransaction") {
   		log.debug ({cls: "projects", fn: "rollbackTransaction"});
		if (projects.sessions [request.session.id].transaction.active) {
			projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
				var storage = options.storage;
				storage.rollbackTransaction ({session: request.session, success: function (options) {
					projects.sessions [request.session.id].transaction.active = false;
					projects.send ({request: request, response: response, msg: "{header: {error: ''},data: " + options.revision + "}"});
				}, failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.rollbackTransaction")});
				}});
			}});
		} else {
			projects.send ({request: request, response: response, msg: "{header: {error: ''},data: 'Transaction not active'}"});
		}
   	} else {
   		next ();
   	}
};
projects.getObject = function (request, response, next) {
   	if (request.storageFn == "getObject") {
   		log.debug ({cls: "projects", fn: "getObject", params: request.storageParam});
		var storageCode = request.storageCode;
		var objectId;
		try {
			objectId = JSON.parse (request.storageParam);
		} catch (e) {
			var r = "{header: {error: ''},data: {id: null, classId: null, attrs: {}}}";
			projects.send ({request: request, response: response, msg: r});
			return;
		};
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;
			projects.sessions [request.session.id].storage = storage;
			storage.getObject ({session: request.session, id: objectId, success: function (options) {
				var o = options.object;
				var r = "{header: {error: ''},data: {";
				if (!o) {
					r += "id: null, classId: null, attrs: {";
				} else {
					r += "id:" + objectId + ", classId: " + o.data.fclass_id + ", attrs: {";
					var i = 0;
					for (var attr in o.data) {
						if (["id", "fclass_id"].indexOf (attr) > -1) {
							continue;
						}
						if (i) {
							r += ",";
						}
						r += '"' + attr + '":' + common.ToJSONString (o.data [attr]);
						i ++;
					}
				}
				r += "}}}";
				projects.send ({request: request, response: response, msg: r});
			}, failure: function (err) {
				projects.sendError ({request: request, response: response, error: new VError (err, "projects.getObject")});
			}});
		}});
   	} else {
   		next ();
   	}
};
// request: pm.Object.remove(2182):
// response: {header: {error: ''},data: []}
projects.removeObject = function (request, response, next) {
   	if (request.storageArea =="Object" && request.storageFn == "remove") {
   		log.debug ({cls: "projects", fn: "removeObject", params: request.storageParam});
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
   		if (request.session.revision) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'read only mode (time machine)'}}"});
			return;
   		};
		if (projects.sessions [request.session.id].transaction.active) {
			var storageCode = request.storageCode;
			var objectId = request.storageParam;
			projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
				var storage = options.storage;
				storage.getObject ({session: request.session, id: objectId, success: function (options) {
					var o = options.object;
					var cascadeNum, setnullNum;
					if (o) {
						o.remove ();
						async.series ([
							function (cb) {
								if (projects.removeObject.beforeCommit) {
									projects.removeObject.beforeCommit ({session: request.session, object: o, success: function () {
										cb ();
									}});
								} else {
									cb ();
								}
							},
							function (cb) {
								o.commit ({session: request.session, success: function (options) {
									cascadeNum = options ? options.cascadeNum : null;
									setnullNum = options ? options.setnullNum : null;
									cb ();
								}, failure: cb});
							}
						], function (err, results) {
							if (err) {
								projects.sendError ({request: request, response: response, error: new VError (err, "projects.removeObject")});
							} else {
								projects.send ({request: request, response: response, msg: "{header: {error: ''}, data: [], cascadeNum: " + cascadeNum + ", setnullNum: " + setnullNum + "}"});
							}
						});
					} else {
						projects.send ({request: request, response: response, msg: "{header: {error: ''}, data: []}"});
					}
				}, failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.removeObject")});
				}});
			}});
		} else {
			projects.sendError ({request: request, response: response, error: "Transaction not active"});
		}
   	} else {
		next ();
	}
};
// createObject:
//     request: pm.Object.setAttrs([![null,{},1007]!]):
//     response: {header: {error: ''},data: 2182}
// setAttrs:
//     request: pm.Object.setAttrs([![2182,{"name":{"value":"kolobok","classAttrId":1005,"type":1,"classId":1000,"classCode":"task"}},1007]!]):
//     response: {header: {error: ''},data: 2182}
projects.setAttrs = function (request, response, next) {
   	if (request.storageFn == "setAttrs") {
   		log.debug ({cls: "projects", fn: "setAttrs", params: request.storageParam});
   		if (request.session.username == "autologin" && request.session.userId == null) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'forbidden'}}"});
			return;
   		};
   		if (request.session.revision) {
			projects.send ({request: request, response: response, msg: "{header: {error: 'read only mode (time machine)'}}"});
			return;
   		};
		if (projects.sessions [request.session.id].transaction.active) {
			var s = request.storageParam;
			s = s.substr (2, s.length - 4);
			var tokens = eval (s);
			var objectId = tokens [0];
			var attrs = tokens [1];
			var classId = tokens [2];
			var storageCode = request.storageCode;
			projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
				var storage = options.storage;
				var setAttrs = function (o) {
					var currentTimestampAttrs = [];
					var currentTimestamp = new Date ();
					var currentTimestampStr = common.getUTCTimestamp (currentTimestamp);
					for (var attr in attrs) {
						var val = attrs [attr].value;
						if (val == "$CURRENT_TIMESTAMP$") {
							val = currentTimestampStr;
							currentTimestampAttrs.push (attr);
						}
						o.set (attr, val);
					}
					async.series ([
						function (cb) {
							if (projects.setAttrs.beforeCommit) {
								projects.setAttrs.beforeCommit ({session: request.session, object: o, success: function () {
									cb (null, null);
								}});
							} else {
								cb (null, null);
							}
						},
						function (cb) {
							o.commit ({session: request.session, success: function () {
								cb (null, null);
							}, failure: cb});
						}
					], function (err, results) {
						if (err) {
							projects.sendError ({request: request, response: response, error: new VError (err, "projects.setAttrs")});
						} else {
							for (var i = 0; i < currentTimestampAttrs.length; i ++) {
								o.data [currentTimestampAttrs [i]] = currentTimestamp;
							}
							projects.send ({request: request, response: response, msg: "{header: {error: ''}, data: " + common.ToJSONString (o.data) + "}"});
						}
					});
				};
				if (!objectId) {
					storage.createObject ({session: request.session, classId: classId, success: function (options) {
						if (!options.object) {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: {id: null, classId: null, attrs: {}}}"});
						} else {
							setAttrs (options.object);
						};
					}, failure: function (err) {
						projects.sendError ({request: request, response: response, error: new VError (err, "projects.setAttrs")});
					}});
				} else {
					storage.getObject ({session: request.session, id: objectId, success: function (options) {
						if (options.object) {
							setAttrs (options.object);
						} else {
							projects.send ({request: request, response: response, msg: "{header: {error: ''},data: {id: null, classId: null, attrs: {}}}"});
						}
					}, failure: function (err) {
						projects.sendError ({request: request, response: response, error: new VError (err, "projects.setAttrs")});
					}});
				}
			}});
		} else {
			projects.sendError ({request: request, response: response, error: "Transaction not active"});
		}
   	} else {
		next ();
	}
};
projects.execute = function (request, response, next) {
   	if (request.storageFn == "execute") {
		var storageCode = request.storageCode;
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;		
			log.debug ({cls: "projects", fn: "execute", params: request.storageParam});
			var sql = JSON.parse (request.storageParam.substr (2, request.storageParam.length - 4));
			storage.execute ({session: request.session, sql: sql, resultText: true, success: function (options) {
				projects.send ({request: request, response: response, msg: "{header: {error: ''},data: " + options.result + "}"});
			}, failure: function (err) {
				projects.sendError ({request: request, response: response, error: new VError (err, "projects.execute")});
			}});
		}});
   	} else {
		next ();
	}
};
projects.news = {};
projects.news.message = {};
projects.news.getObj = function (request, response) {
	var tokens = request.body.split (" ");	
	if (tokens.length == 2) {
		var storageCode = tokens [0];
		var clientRevision = tokens [1];
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;
			setTimeout (function () {
				if (!projects.sessions [request.session.id]) {
					response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
					response.end ("{header: {error: 'session removed'}, data: []}");
					return;
				};
				var message = projects.news.message [request.session.id];
				if (message) {
					message = "'" + message + "'";
					delete projects.news.message [request.session.id];
				}
				// send news
				if (clientRevision == 0 || clientRevision == storage.lastRevision) {
					// first call
					response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
					response.end ("{header: {error: ''}, revision: " + storage.lastRevision + ", objects: [], message: " + message + "}");
				} else {
					// send changed objects id from clientRevision to lastRevision
					var r = [];
					for (var revision in storage.revisions) {
						if (revision > clientRevision) {
							r = r.concat (storage.revisions [revision].objects.changed);
						}
					}
					response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
					response.end ("{header: {error: ''}, revision: " + storage.lastRevision + ", objects: " + JSON.stringify (r) + ", message: " + message + "}");
				}
				projects.sessions [request.session.id].storage = storage;
				projects.sessions [request.session.id].news.revision = storage.lastRevision;
			}, config.news.pollingInterval);
		}});
	} else {
		response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
		response.end ("{header: {error: 'Incorrect format. Must be storageCode and revision.'}, data: []}");
	}
};
// todo: dirty revisions
projects.news.gc = function () {
	for (var storageCode in projects.storagePool) {
		var storage = projects.storagePool [storageCode];
		var minRevision;
		for (var sessionId in projects.sessions) {
			var news = projects.sessions [sessionId].news;
			if (projects.sessions [sessionId].storage == storage && (!minRevision || news.revision < minRevision)) {
				minRevision = news.revision;
			}
		}
		for (var revision in storage.revisions) {
			if (revision < minRevision) {
				delete storage.revisions [revision];
				log.debug ({cls: "projects", fn: "news.gc"}, "revision " + revision + " removed");
			}
		}
	}
	setTimeout (projects.news.gc, config.news.gcInterval);	
};
projects.removeSession = function (options) {
	var success = options.success;
	var sessionId = options.sessionId;
	redisClient.hmget ("sessions", [sessionId + "-storageCode", sessionId + "-username"], function (err, r) {
		redisClient.hdel ("sessions", 
			sessionId + "-id", sessionId + "-username", sessionId + "-clock", sessionId + "-storageCode", 
			sessionId + "-newsRevision", sessionId + "-port", sessionId + "-userId", sessionId + "-logined", sessionId + "-ip"
		);
		redisPub.publish (config.redis.db + "-sessions", '{"removed":"' + sessionId + '"}');
		log.debug ({cls: "projects", fn: "removeSession"}, "session " + sessionId + " removed");
		success ();
	});
};
projects.removeTimeoutSessions = function () {
	if (config.port != config.startPort && !process.env.mainWorker) {
		return;
	};
	log.info ({cls: "projects", fn: "projects.removeTimeoutSessions"});
	var timeoutInterval = config.session.timeoutInterval / 1000;
	redisClient.hgetall ("sessions", function (err, r) {
		var timeout = [];
		for (var k in r) {
			if (k.indexOf ("-clock") > -1 && config.clock > Number (r [k]) && (config.clock - Number (r [k]) > timeoutInterval * 2)) {
				var sessionId = k.substr (0, k.length - 6);
				timeout.push (sessionId);
				log.info ({cls: "projects"}, "session removing: " + sessionId + " " + config.clock + " " + r [k] + " " + (timeoutInterval * 2));
			}
		}
		async.map (timeout, function (sessionId, cb) {
			async.series ([
				function (cb) {
					var session = projects.sessions [sessionId];
					if (session && session.storage) {
						session.storage.rollbackTransaction ({session: session, success: function (options) {
							cb ();
						}});
					} else {
						cb ();
					};
				},
				function (cb) {
					projects.removeSession ({sessionId: sessionId, success: function () {
						log.info ({cls: "projects"}, "session removed: " + sessionId + " " + config.clock + " " + r [sessionId + "-clock"] + " " + timeoutInterval);
						cb ();
					}});
				}
			], function (err, results) {
				cb ();
			});
		}, function (err, results) {
		});
	});
};
// {success}
projects.createStorages = function (options) {
	var storageCodes = [];
	for (var storageCode in config.storages) {
		if (config.storages [storageCode].hasOwnProperty ("db")) {
			storageCodes.push (storageCode);
		}
	};
	async.map (storageCodes, function (storageCode, cb) {
		projects.getStorage ({storageCode: storageCode, success: function (options) {
			cb ();
		}, failure: function (options) {
   			log.error ({cls: "projects", error: "Storage error: " + options.error});
			cb ();
		}});
	}, function (err, storages) {
		options.success ();
	});
};
projects.getTableRecords = function (options) {
	var request = options.request;
	var response = options.response;
	var table = options.table;
	var fields = options.fields;
	var success = options.success;
	var mainOptions = options;
	projects.getStorage ({request: request, response: response, storageCode: options.storageCode, success: function (options) {
		var storage = options.storage;		
		storage.redisClient.hget (storage.code + "-requests", table, function (err, result) {
			if (result) {
				mainOptions.result = result;
				success.call (mainOptions.scope || this, mainOptions);
			} else {
				var filter = "";
				if (table == "tview") {
					filter = " and (fsystem is null or (fsystem is not null and fclass_id is not null))";
				}
				storage.query ({sql: 
					"select\n" +
					"\t" + fields.join (",") + "\n" +
					"from\n" +
					"\t" + table + "\n" +
					"where\n" +
					"\t" + storage.getCurrentFilter () + filter + "\n" +
					"order by fid"
				, success: function (options) {
					var r = "[";
					var rows = options.result.rows;
					for (var i = 0; i < rows.length; i ++) {
						if (i) {
							r += ",";
						}
						r += "[";
						for (var j = 0; j < fields.length; j ++) {
							if (j) {
								r += ",";
							}
							var val = rows [i][fields [j]];
							r += common.ToJSONString (val);
						}
						if (table == "tview") {
							r += ", 0";
						}
						r += "]";
					}
					r += "]";
					storage.redisClient.hset (storage.code + "-requests", table, r);
					mainOptions.result = r;
					success.call (mainOptions.scope || this, mainOptions);
				}});
			}
		});
	}});
};
projects.sendTableRecords = function (options) {
	options.scope = this;
	options.success = function (options) {
		options.msg = options.result;
		projects.send (options);
	};
	projects.getTableRecords (options);
};
projects.getAll = function (request, response, next) {
   	if (request.storageFn == "getAll") {
		log.debug ({cls: "projects", fn: "getAll"});
		var sendAll = function (options) {
			var storage = options.storage;
	   		var r = "{";
	   		async.parallel ([
	   			function (cb) {
			   		projects.getTableRecords ({
			   			request: request,
			   			response: response,
			   			storageCode: request.storageCode, 
			   			table: "tclass", 
						fields: meta.fields.tclass,
			   			success: function (options) {
			   				r += "\"classes\": " + options.result + ",";
			   				cb ();
			   			}
			   		});
	   			},
	   			function (cb) {
			   		projects.getTableRecords ({
			   			request: request,
			   			response: response,
			   			storageCode: request.storageCode, 
			   			table: "tclass_attr", 
						fields: meta.fields.tclass_attr,
			   			success: function (options) {
			   				r += "\"classAttrs\": " + options.result + ",";
			   				cb ();
			   			}
			   		});
	   			},
	   			function (cb) {
			   		projects.getTableRecords ({
			   			request: request,
			   			response: response,
			   			storageCode: request.storageCode, 
			   			table: "tview",    			
						fields: meta.fields.tview,
			   			success: function (options) {
			   				r += "\"views\": " + options.result + ",";
			   				cb ();
			   			}
			   		});
	   			},
	   			function (cb) {
			   		projects.getTableRecords ({
			   			request: request,
			   			response: response,
			   			storageCode: request.storageCode, 
			   			table: "tview_attr",    			
						fields: meta.fields.tview_attr,
			   			success: function (options) {
			   				r += "\"viewAttrs\": " + options.result + ",";
			   				cb ();
			   			}
			   		});
	   			}
	   		], function (err, results) {
	   			if (storage.visualObjectum.timeMachine && storage.visualObjectum.timeMachine.dates) {
	   				var arr = storage.visualObjectum.timeMachine.dates;
		   			for (var i = 0; i < arr.length; i ++) {
		   				if (typeof (arr [i].date) == "string") {
		   					arr [i].date = new Date (arr [i].date);
		   				};
		   			};
		   		};
   				r += "\"visualObjectum\": " + common.ToJSONString (storage.visualObjectum) + ",";
	   			r += "\"all\": 1}";
				storage.redisClient.hset (storage.code + "-requests", "all", r);
				projects.send ({
					request: request,
					response: response,
					msg: r
				});
	   		});
   		};
		projects.getStorage ({request: request, response: response, storageCode: request.storageCode, success: function (options) {
			var storage = options.storage;		
			storage.redisClient.hget (storage.code + "-requests", "all", function (err, result) {
				if (result) {
					projects.send ({
						request: request,
						response: response,
						msg: result
					});
				} else {
					sendAll (options);
				};
			});
		}});
   	} else {
		next ();
	}
};
projects.getContent = function (request, response, next) {
   	if (request.storageFn == "getContent") {
   		log.debug ({cls: "projects", fn: "getContent", params: request.storageParam});
		var storageCode = request.storageCode;
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;		
			var tokens = request.storageParam.split (",");
			var params = tokens.slice (6).join (",");
			if (params [2] == "!") {
				params = params.substr (3, params.length - 5);
			} else {
				params = params.substr (2, params.length - 4);
			}
			params = JSON.parse (params);
			storage.getContent ({
				request: request,
				response: response,
				session: request.session,
				viewId: tokens [0], 
				column: tokens [1], 
				row: tokens [2], 
				columnCount: tokens [3], 
				rowCount: tokens [4], 
				parentId: tokens [5], 
				filter: params.filter, 
				order: params.order, 
				total: params.total,
				dateAttrs: params.dateAttrs,
				timeOffsetMin: params.timeOffsetMin,
				success: function (options) {
					projects.send ({request: request, response: response, msg: options.result});
				},
				failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.getContent")});
				}
			});
		}});
	} else {
		next ();
	}
};
projects.selectRows = function (request, response, next) {
   	if (request.storageFn == "selectRows") {
   		log.debug ({cls: "projects", fn: "selectRows", params: request.storageParam});
		var storageCode = request.storageCode;
		projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
			var storage = options.storage;		
			var tokens = request.storageParam.split (",");
			var viewId = tokens [0];
			var params = tokens.slice (2).join (",");
			params = params.substr (params.indexOf ("[!") + 2, params.indexOf ("!]") - (params.indexOf ("[!") + 2));
			params = JSON.parse (params);
			storage.selectRow ({
				request: request,
				response: response,
				session: request.session,
				viewId: viewId, 
				viewFilter: params.viewFilter, 
				selectFilter: params.selectFilter, 
				success: function (options) {
					projects.send ({request: request, response: response, msg: "{header: {error: ''}, data: [" + options.result + "]}"});
				},
				failure: function (err) {
					projects.sendError ({request: request, response: response, error: new VError (err, "projects.selectRows")});
				}
			});
		}});
	} else {
		next ();
	}
};
projects.reloadUniqueValues = function (options) {
	var storage = options.storage;
	var success = options.success;
	async.map (storage.classAttrs, function (attr, cb) {
		if (attr.get ("funique")) {
			var key = storage.code + "-unique-" + attr.get ("fid");
			log.debug ({cls: "projects"}, "Unique values reloading: " + key);
			async.series ([
				function (cb) {
					redisClient.del (key, function (err, result) {
						cb ();
					});
				},
				function (cb) {
					if (attr.get ("fcode") == "login") {
						redisClient.sadd (key, "admin", function (err, result) {
							cb ();
						});
					} else {
						cb ();
					}
				},
				function (cb) {
					if (config.storages [storage.code].autologin && attr.get ("fcode") == "login") {
						redisClient.sadd (key, "autologin", function (err, result) {
							cb ();
						});
					} else {
						cb ();
					}
				},
				function (cb) {
					storage.query ({session: {userId: null}, sql: 
						"select " + attr.toc + " from " + storage.classesMap [attr.get ("fclass_id")].toc + " where " + attr.toc + " is not null"
					, success: function (options) {
						var rows = options.result.rows;
						async.map (rows, function (row, cb) {
							redisClient.sadd (key, row [attr.toc], function (err, result) {
								cb ();
							});
						}, function (err, result) {
							cb ();
						});
					}});
				}
			], function (err, results) {
				cb ();
			});
		} else {
			cb ();
		}
	}, function (err, results) {
		success ();
	});
};
projects.exist = function (options) {
	var request = options.request;
	var response = options.response;
	var storageCode = options.storageCode;
	var classCode = options.classCode;
	var attrCode = options.attrCode;
	var value = options.value;
	projects.getStorage ({request: request, response: response, storageCode: storageCode, success: function (options) {
		var storage = options.storage;
		var ca = storage.getClassAttr ({classCode: classCode, attrCode: attrCode});
		if (ca) {
			redisClient.sismember (storageCode + "-unique-" + ca.get ("fid"), value, function (err, result) {
				response.writeHead (200, {"Content-Type": "text/html"});
				if (result) {
					response.end ("1");
				} else {
					response.end ("0");
				}
			});
		}
	}});
};
projects.upload = function (request, response, next) {
	var session = request.session;
	if (request.url.indexOf ("/upload") > -1 && projects.sessions [session.id]) {
		var storage = session.storage;
		if (config.storages [storage.code].hasOwnProperty ("upload") && !config.storages [storage.code].upload) {
			projects.send ({request: request, response: response, msg: "{success: false, error: 'upload disabled'}"});
			return;
		};
		var form = new formidable.IncomingForm ();
		form.uploadDir = storage.rootDir + "/files";
		form.parse (request, function (error, fields, files) {
			if (files ["file-path"] && files ["file-path"].name) {
				var filename = storage.rootDir + "/files/" + fields.objectId + "-" + fields.classAttrId + "-" + files ["file-path"].name;
				fs.rename (files ["file-path"].path, filename, function (err) {
					if (err) {
						log.error ({cls: "projects", fn: "upload", error: "rename error: " + err + ", " + files ["file-path"].path + " -> " + filename});
						projects.send ({request: request, response: response, msg: "{success: false, error: '" + err + "'}"});
					} else {
						projects.send ({request: request, response: response, msg: "{success: true, file: '" + files ["file-path"].name + "'}"});
					};
				});
			} else {
				projects.send ({request: request, response: response, msg: "{success: false}"});
			};
		});
	} else {
		next ();
	};
};
projects.sendmail = function (request, response, next) {
	var session = request.session;
	if (request.url.indexOf ("/sendmail") > -1 && projects.sessions [session.id]) {
		var form = new formidable.IncomingForm ();
		form.parse (request, function (error, fields, files) {
			if (error) {
				log.error ({cls: "projects", fn: "sendmail", error: "sendmail error: " + JSON.stringify (error) + " fields: " + JSON.stringify (fields)});
				projects.send ({request: request, response: response, msg: "{success: false, error: '" + error + "'}"});
				return;
			};
			var attachments = [];
			if (fields.attachments) {
				var storage = projects.sessions [session.id].storage;
				_.each (JSON.parse (fields.attachments), function (o) {
					if (o.filePath) {
						o.filePath = storage.rootDir + "/files/" + o.filePath;
					};
					attachments.push (o);	
				});
			};
			mailSender.send ({
				to: fields.to,
				from: fields.from,
				subject: fields.subject,
				html: fields.message,
				session: request.session,
				attachments: attachments,
				success: function () {
					log.info ({cls: "projects", fn: "sendmail"}, "mail sended: " + JSON.stringify (fields));
					projects.send ({request: request, response: response, msg: "{success: true}"});
				},
				failure: function (error) {
					log.error ({cls: "projects", fn: "sendmail", error: "sendmail error: " + JSON.stringify (error) + " fields: " + JSON.stringify (fields)});
					projects.send ({request: request, response: response, msg: "{success: false, error: '" + error + "'}"});
				}
			});
		});
	} else {
		next ();
	};
};
projects.services = {};
projects.services.captcha = function (req, res, next) {
	if (req.url.indexOf ("/services") > -1 && req.query.captcha == 1) {
		projects.services.images = projects.services.images || [];
		var images = projects.services.images;
		if (!images.length) {
			images.push ("30E936A16BDF7A13E3854E793FAC7B09D4673EEB.png");
			images.push ("4802DE61A70652CD389E566D0794EC61D34EE385.png");
			images.push ("497CD952DFE895358336AE56AED144ED2179B458.png");
			images.push ("6480E7583A6D3FCBAD553C9FA7E6AAF5104B93C7.png");
			images.push ("67403548F8644A7F6320245A898BD49729660708.png");
			images.push ("6CA1E9A46879877B8C4309EE9C4BC773FBB6E468.png");
			images.push ("6E48C6506E6E63852526E0CF1808B548AEC5ABAE.png");
			images.push ("8E6E28B5D96B18D5C0EA8EB9A497AD66252196EE.png");
			images.push ("CE665C570F0DD9E93DE3DAA7EAEBC446CEC2E88B.png");
			images.push ("D93A9798AFC25B7261E8BB790BF1394C1557B61D.png");
		};
		var r = "<img src='/client/extjs4/images/captcha/" + images [common.randomInt (0, images.length - 1)] + "' width=170 height=30> ";
		res.send (r);
	} else {
		next ();
	};
};
projects.logout = function (request, response, next) {
	if (request.query.logout == 1 && request.session) {
		var sid = request.query.sessionId;
		redisClient.hdel ("sessions", 
			sid + "-id", sid + "-username", sid + "-clock", sid + "-storageCode", 
			sid + "-newsRevision", sid + "-port", sid + "-userId", sid + "-logined", sid + "-ip"
		);
		redisPub.publish (config.redis.db + "-sessions", '{"removed":"' + sid + '"}');
		response.send ("ok");
		var session = projects.sessions [sid];
		if (session && session.storage) {
			session.storage.rollbackTransaction ({session: session});
		};
	} else {
		next ();
	};
};
/*
	Копирование файла
*/
projects.copyFile = function (req, res, next) {
	if (req.url.indexOf ("/copy_file?") == -1) {
		next ();
		return;
	};
	var session = req.session;
	if (session && session.storage) {
		var storage = session.storage;
		var rootDir = storage.config.rootDir;
		var srcObjectId = req.query.src_object_id;
		var srcClassAttrId = req.query.src_class_attr_id;
		var dstObjectId = req.query.dst_object_id;
		var dstClassAttrId = req.query.dst_class_attr_id;
		var filename = req.query.filename;
		var src = rootDir + "/files/" + srcObjectId + "-" + srcClassAttrId + "-" + filename;
		var dst = rootDir + "/files/" + dstObjectId + "-" + dstClassAttrId + "-" + filename;
		fs.readFile (src, function (err, data) {
			if (err) {
				res.send ({err: 1});
			} else {
				fs.writeFile (dst, data, function (err) {
					if (err) {
						res.send ({err: 1});
					} else {
						res.send ({ok: 1});
					};
				});
			};
		});
	} else {
		res.status (403).send ("Invalid session");
	};
};
/*
	Запись в файл
*/
projects.saveToFile = function (req, res, next) {
	if (req.url.indexOf ("/save_to_file?") == -1) {
		next ();
		return;
	};
	var session = req.session;
	if (session && session.storage) {
		var storage = session.storage;
		var rootDir = storage.config.rootDir;
		var objectId = req.query.object_id;
		var classAttrId = req.query.class_attr_id;
		var filename = req.query.filename;
		var path = rootDir + "/files/" + objectId + "-" + classAttrId + "-" + filename;
		fs.writeFile (path, req.body, function (err) {
			if (err) {
				res.send ({err: 1});
			} else {
				res.send ({ok: 1});
			};
		});
	} else {
		res.status (403).send ("Invalid session");
	};
};
/*
	Пользователю в поля lastTry, tryNum записывает
*/
projects.logLastTry = function (storage, login, accessGranted) {
	if (!storage.authRecords [login] || !storage.authRecords [login].hasTryAttrs) {
		return;
	}
	var userId = storage.authRecords [login].objectId;
	var session = {
		id: "logLastTry-" + login,
		username: userId,
		userId: userId
	};
	var o;
	async.series ([
		function (cb) {
			storage.getObject ({session: session, id: userId, success: function (opts) {
				o = opts.object;
				cb ();
			}});
		},
		function (cb) {
			storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "logLastTry-" + login, success: function () {
				cb ();
			}, failure: function (err) {
				cb (err);
			}});
		},
		function (cb) {
			if (accessGranted) {
				o.set ("lastLogin", common.currentUTCTimestamp ());
				storage.authRecords [login].tryNum = null;
				storage.authRecords [login].lastTry = null;
			} else {
				o.set ("lastTry", common.currentUTCTimestamp ());
				storage.authRecords [login].tryNum = (storage.authRecords [login].tryNum || 0) + 1;
				storage.authRecords [login].lastTry = config.clock;
			}
			o.commit ({session: session, success: function () {
				cb ();
			}});
		},
		function (cb) {
			storage.commitTransaction ({session: session, success: function () {
				cb ();
			}, failure: function (err) {
				cb (err);
			}});
		}
	], function (err) {
	});
}
