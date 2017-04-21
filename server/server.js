/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
"use strict"
process.env.TZ = "UTC"
process.maxTickDepth = Infinity;
if (config.uncaughtException) {
	process.on ("uncaughtException", function (err) {
		console.log (err);
		console.log (err.stack);
		let text = "[" + common.currentDate () + " " + common.currentTime ({msec: true}) + "] ";
		let fd = fs.openSync (config.rootDir + "/error.log", "a", 666);
		fs.writeSync (fd, text + "Caught exception: " + err + "\n" + err.stack + "\n", null, "utf8");
		fs.closeSync (fd);
		process.exit (1);
	});
};
// Количество секунд прошедших с 1 января 1970 года (UnixTime)
config.clock = parseInt (new Date ().getTime () / 1000);
global.server = {};
server.cache = {};
server.www = function (options) {
	let request = options.request;
	let response = options.response;
	let next = options.next;
	let filePath = options.filePath;
	let pathname = url.parse (request.url).pathname;
	if (!filePath) {
		if (pathname == "/") {
			pathname = "/index.html";
		}
		let tokens = pathname.split (".");
		filePath = config.wwwRoot + pathname;
	};
	let urlTokens = pathname.split ("/");
	if (urlTokens [3] == "wsdl") {
		console.log (pathname, decodeURI (filePath));
		fs.readFile (decodeURI (filePath), function (err, data) {
			let ext = filePath.split (".");
			ext = ext [ext.length - 1];
			response.writeHead (200, {
				"Content-Type": mimetypes.lookup (ext)
			});
			response.end (data);
		});
		return;
	}
	if (["client", "third-party", "favicon.ico"].indexOf (urlTokens [1]) == -1) {
		if (["resources", "locale", "files", ""].indexOf (urlTokens [3]) == -1) {
			return next ();
		};
	};
	let ext = filePath.split (".");
	ext = ext [ext.length - 1];
	if (config.caching && config.caching.enabled && !options.nocache) {
		let mtime, status = 200;
		async.series ([
			function (cb) {
				fs.stat (filePath, function (err, stats) {
					if (err) {
						cb ("File not found " + filePath);
					} else {
						mtime = new Date (stats.mtime).getTime ();
						if (server.cache [filePath]) {
							if (server.cache [filePath].mtime != mtime) {
								server.cache [filePath] = null;
							} else {
								if (request.headers ["if-none-match"]) {
									let mtimeUser = request.headers ["if-none-match"];
									if (mtimeUser == server.cache [filePath].mtime) {
										status = 304;
									};
								};
							};
						};
						cb ();
					};
				});
			},
			function (cb) {
				if (server.cache [filePath]) {
					cb ();
				} else {
					fs.readFile (filePath, function (err, data) {
						if (err) {
							cb ("File not found " + filePath);
						} else {
							server.cache [filePath] = {
								mtime: mtime,
								data: data
							};
							cb ();
						};
					});
				};
			}
		], function (err, results) {
			if (err) {
				if (next) {
					next (err);
				} else {
					try {
						response.writeHead (404, {"Content-Type": "text/html; charset=utf-8"});
						response.end (err);
					} catch (e) {
					};
				};
			} else {
				try {
					if (status == 304) {
						response.sendStatus (304);
					} else {
						let headers = {
				  			"ETag": mtime,
				  			"Content-Type": mimetypes.lookup (ext)
				  		};
						response.writeHead (status, headers);
						response.end (server.cache [filePath].data);
					};
				} catch (e) {
				};
			};
		});
	} else {
		fs.readFile (decodeURI (filePath), function (err, data) {
			let ext = filePath.split (".");
			ext = ext [ext.length - 1];
			response.writeHead (200, {
				"Content-Type": mimetypes.lookup (ext)
			});
			response.end (data);
		});
	};
};
server.setVars = function (request, response, next) {
	request.session = projects.sessions [request.query.sessionId] || {id: request.query.sessionId};
	redisClient.hset ("sessions", request.query.sessionId + "-clock", config.clock);
	next ();
};
server.loadData = function (request, response, next) {
	let urlTokens = request.url.split ("/");
	request.setEncoding ("utf8");
	request.on ("data", function (data) {
		if (urlTokens [3] == "plugins") {
			console.log ("loadData data", data ? data.length : null);
		}
		if (!request.body) {
			request.body = data;
		} else {
			request.body += data;
		}
	});
	request.on ("end", function () {
		if (urlTokens [3] == "plugins") {
			console.log ("loadData end");
		}
		next ();
	});
};
server.middleBodyLoader = function (request, response, next) {
	if (request.body) {
		let tokens = request.body.split (".");
		if (tokens.length > 2 && ["Storage", "Object", "Class", "ClassAttr", "View", "ViewAttr", "Action"].indexOf (tokens [1]) > -1) {
			request.storageCode = tokens [0];
			request.storageArea = tokens [1];
			request.storageFn = tokens [2].substr (0, tokens [2].indexOf ("("));
			request.storageParam = request.body.substr (request.body.indexOf ("(") + 1, request.body.length - request.body.indexOf ("(") - 2);
			if (config.debug) {
				console.log ("http.request.body: " + request.body);
			}
		};
	};
	next ();
};
server.middleBodyParser = function (request, response, next) {
	let form = new formidable.IncomingForm ();
	try {
		form.parse (request, function (error, fields, files) {
			if (error) {
				log.error ({cls: "server", fn: "middleBodyParser", error: "middleBodyParser error: " + JSON.stringify (error) + " fields: " + JSON.stringify (fields)});
				response.end ("middleBodyParser error " + common.currentUTCTimestamp ());
				return;
			}
			request.fields = fields;
			next ();
		});
	} catch (e) {
		request.fields = {};
		log.error ({cls: "server", fn: "middleBodyParser", error: "middleBodyParser error: " + e});
		next ();
	};
};
server.requestStart = function (request, response, next) {
	request.storageCode = request.storageCode || request.params.storage;
	if (request.method != "GET") {
		let body = "", fields = "";
		if (request.body && request.url.indexOf ("/upload") == -1) {
			body = ", body: " + JSON.stringify (request.body);
		};
		if (request.fields) {
			fields = ', fields: "' + JSON.stringify (request.fields) + '"';
		};
		request.objectum = {
			start: new Date ().getTime (),
			end: response.end
		};
		redisClient.hincrby ("current-requests", "sequence", 1, function (err, n) {
			response.end = function (data, encoding) {
				let this_ = this;
				redisClient.hdel ("current-requests", n, function (err, result) {
					let duration = (new Date ().getTime () - request.objectum.start) / 1000;
					log.info ({cls: "server", fn: "requestStart"}, "duration: " + duration + ' sec., url: "' + request.url + '", ip: "' + common.getRemoteAddress (request) + '"' + body + fields);
					if (duration > 60) {
						log.warn ({cls: "server", fn: "requestStart"}, 'duration: ' + duration + ' sec., url: "' + request.url + '", ip: "' + common.getRemoteAddress (request) + '"' + body + fields);
					};
					try {
						request.objectum.end.call (this_, data, encoding);
					} catch (e) {
						console.log (data + ", error: " + e);
						throw e;
					};
				});
			};
			redisClient.hset ("current-requests", n, '{url: "' + request.url + '"' + body + fields + ', ts: "' + common.currentUTCTimestamp () + '"}', function (err, result) {
				next ();
			});
		});
	} else {
		next ();
	};
};
server.stat = function (options) {
	let request = options.request;
	let response = options.response;
	if (config.admin.ip.indexOf (common.getRemoteAddress (request)) == -1 && config.admin.ip != "all") {
		response.end ("forbidden");
	};
	log.info ({cls: "server", fn: "stat"}, "ip: " + common.getRemoteAddress (request) + ", query: " + JSON.stringify (request.query));
	if (request.query.logs) {
		redisClient.keys (config.redis.db + "-log-*", function (err, result) {
			for (let i = 0; i < result.length; i ++) {
				result [i] = result [i].substr ((config.redis.db + "-log-").length);
			};
			response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
			response.end (JSON.stringify (result));
		});
		return;
	};
	if (request.query.log) {
		redisClient.lrange (config.redis.db + "-log-" + request.query.log, 0, -1, function (err, result) {
			response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
			response.end (JSON.stringify (result));
		});
		return;
	};
	if (request.query.restart) {
		redisPub.publish (config.redis.db + "-cluster", "restart");
		response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
		response.end ("ok");
		return;
	};
	if (!request.query.data) {
		fs.readFile (__dirname + "/www/client/stat/stat.html", function (err, data) {
			response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
			response.end (data);
		});
		return;
	};
	let allData = {}, num = 0, online, lost, onlineNum, onlineNumMax, onlineNumMaxTS, started, memoryUsage, idle = "";
	async.series ([
		function (cb) {
			redisClient.hgetall ("sessions", function (err, r) {
				let data = [];
				for (let k in r) {
					if (k.indexOf ("-username") > -1) {
						let sid = k.substr (0, k.length - 9);
						data.push ({
							login: r [k],
							port: r [sid + "-port"],
							storage: r [sid + "-storageCode"],
							logined: r [sid + "-logined"],
							ip: r [sid + "-ip"]
						});
						num ++;
					}
				};
				allData.sessions = data;
				cb ();
			});
		},
		function (cb) {
			redisClient.hgetall ("current-requests", function (err, result) {
				let data = [];
				for (let k in result) {
					let r;
					try {
						r = eval ("(" + result [k] + ")");
					} catch (e) {
						r = {body: result [k]};
					};
					data.push ({
						url: r.url,
						body: r.body,
						fields: r.fields,
						ts: r.ts
					});
				};
				allData.unprocessed = data;
				cb ();
			});
		},
		function (cb) {
			redisClient.hgetall ("server-started", function (err, result) {
				started = result;
				cb ();
			});
		},
		function (cb) {
			redisClient.hgetall ("server-memoryusage", function (err, result) {
				let data = [];
				let total = {
					current: {
						rss: 0, heapTotal: 0, heapUsed: 0
					},
					max: {
						rss: 0, heapTotal: 0, heapUsed: 0
					}
				};
				for (let k in result) {
					let r = JSON.parse (result [k]);
					data.push ({
						pid: k,
						port: r.port,
						started: started [k],
						rssCurrent: r.current.rss,
						heapTotalCurrent: r.current.heapTotal,
						heapUsedCurrent: r.current.heapUsed,
						rssMax: r.max.rss,
						heapTotalMax: r.max.heapTotal,
						heapUsedMax: r.max.heapUsed
					});
				};
				allData.cluster = data;
				cb ();
			});
		},
		function (cb) {
			redisClient.get ("online-num", function (err, result) {
				onlineNum = result;
				redisClient.get ("online-num-max", function (err, result) {
					onlineNumMax = result;
					redisClient.get ("online-num-max-ts", function (err, result) {
						onlineNumMaxTS = result;
						cb ();
					});
				});
			});
		},
		function (cb) {
			let s;
			for (s in config.storages) {
				if (config.storages [s].database == "postgres") {
					let client = new db.Postgres ({connection: config.storages [s]});
					client.connect ({systemDB: true, success: function () {
						client.query ({sql: 
							"select (date_part ('epoch', now () - query_start)) as duration, procpid, current_query\n" +
							"from pg_stat_activity\n" +
							"where current_query <> '<IDLE>' and date_part ('epoch', now () - query_start) > 0\n" +
							"order by 1"
						, success: function (options) {
							let rows = options.result.rows;
							let data = [];
							for (let i = 0; i < rows.length; i ++) {
								data.push ({
									duration: rows [i].duration,
									pid: rows [i].procpid,
									query: rows [i].current_query
								});
							};
							allData.pgStat = data;
							client.disconnect ();
							cb ();
						}, failure: function () {
							allData.pgStat = [];
							cb ();
						}});
					}});
					return;
				};
			};
			cb ();
		}
	], function (err, results) {
		response.send (JSON.stringify (allData));
	});
};
server.updateMemoryUsage = function () {
	server.memoryUsage = server.memoryUsage || {rss: 0, heapTotal: 0, heapUsed: 0};
	let pmu = process.memoryUsage ();
	pmu.rss = (pmu.rss / (1024 * 1024)).toFixed (3);
	pmu.heapTotal = (pmu.heapTotal / (1024 * 1024)).toFixed (3);
	pmu.heapUsed = (pmu.heapUsed / (1024 * 1024)).toFixed (3);
	if (server.memoryUsage.rss < pmu.rss) {
		server.memoryUsage.rss = pmu.rss;
	};
	if (server.memoryUsage.heapTotal < pmu.heapTotal) {
		server.memoryUsage.heapTotal = pmu.heapTotal;
	};
	if (server.memoryUsage.heapUsed < pmu.heapUsed) {
		server.memoryUsage.heapUsed = pmu.heapUsed;
	};
	redisClient.hset ("server-memoryusage", process.pid, JSON.stringify ({
		port: config.port,
		current: {
			rss: pmu.rss,
			heapTotal: pmu.heapTotal,
			heapUsed: pmu.heapUsed
		},
		max: {
			rss: server.memoryUsage.rss,
			heapTotal: server.memoryUsage.heapTotal,
			heapUsed: server.memoryUsage.heapUsed
		}
	}));
};
server.init = function (options) {
	options = options || {};
	server.objectum = options.objectum;
	let success = options.success;
	server.app = express ();
	server.app.use (function (request, response, next) {
		request.connection.setNoDelay (true);
		next ();
	});
	server.app.get ("/projects/*", server.setVars, server.processProjectPlugins, server.requestStart, 
		xmlss.report,
		projects.services.captcha,
		projects.services.accountActivate,
		projects.services.restorePassword,
		projects.services.resetPassword,
		projects.copyFile,
		projects.getHandler
	);
	server.app.post ("/projects/*", server.setVars, projects.upload, projects.sendmail, server.loadData, projects.saveToFile, server.middleBodyLoader, server.requestStart, server.processProjectPlugins,
		projects.checkAuth,
		projects.logout,
		projects.startTransaction,
		projects.commitTransaction,
		projects.rollbackTransaction,
		projects.removeObject,
		projects.getObject,
		projects.setAttrs,
		projects.execute,
		projects.getAll,
		projects.getViews,
		projects.getViewAttrs,
		projects.getClasses,
		projects.getClassAttrs,
		projects.getActions,
		projects.getActionAttrs,
		projects.getContent,
		projects.selectRows,
		meta.fnClass,
		meta.fnClassAttr,
		meta.fnView,
		meta.fnViewAttr,
		meta.fnAction,
		projects.gate1c,
		xlsx.report,
		pdf.report,
		dbf.report,
		xmlss.report,
		tm.getRevisions,
		tm.setRevision,
		function (request, response) {
			log.error ({cls: "server", fn: "init", error: "Unknown request: " + request.url + " body: " + request.body});
			response.writeHead (200, {"Content-Type": "text/html; charset=utf-8"});
			response.end ("{header: {error: 'unknown request'}, data: []}");
		}
	);
	server.app.post ("/objectum/obj_news", server.loadData, server.setVars, server.middleBodyLoader, projects.checkAuth,
		function (req, res) {
			projects.news.getObj (req, res);
		}
	);
	server.app.all ("/objectum/exist", server.requestStart, function (req, res) {
		projects.exist ({
			request: req,
			response: res,
			storageCode: req.query.storageCode, 
			classCode: req.query.classCode,
			attrCode: req.query.attrCode,
			value: req.query.value
		});
	});
	server.app.all ("/objectum/stat", server.requestStart, function (req, res) {
		server.stat ({request: req, response: res});
	});
	server.app.all ("/exception", function (req, res) {
		setTimeout (function () {
			throw Error ("boo");
		}, 1000);
	});
	server.startPlugins ({success: function () {
		server.app.get ("*", server.requestStart, function (req, res, next) {
			server.www ({request: req, response: res, next: next});
		});
		server.app.use (function (err, req, res, next) {
			let msg = err.message ? err.message : err;
			log.error ({cls: "server", fn: "init", error: "express exception: " + msg + ", stack: " + JSON.stringify (err.stack)});
			res.status (500).send ("{header: {error: '" + msg + "', stack:'" + JSON.stringify (err.stack) + "'}}");
		});
		function startGC () {
			if (global.gc) {
				global.gc ();
				setTimeout (startGC, config.gcInterval || 5000);
			}
		};
		setTimeout (startGC, 5000);
		setInterval (function () {
//			config.clock ++;
			config.clock = parseInt (new Date ().getTime () / 1000);
			server.updateMemoryUsage ();
		}, 1000);
		projects.init ({success: function () {
			if (success) {
				success ();
			};
		}});
	}});
};
server.startPlugins = function (options) {
	options = options || {};
	let success = options.success;
	if (!config.plugins) {
		if (success) {
			success ();
		};
		return;
	};
	let plugins = [];
	for (let pluginCode in config.plugins) {
		plugins.push (pluginCode);
	};
	async.map (plugins, function (pluginCode, cb) {
		let plugin = config.plugins [pluginCode];
		fs.exists (plugin.require, function (exists) {
			if (exists) {
				let m = require (plugin.require);
				plugin.module = m;
				async.series ([
					function (cb) {
						if (m.init) {
							m.init ({objectum: server.objectum, success: function () {
								log.info ({cls: "server", fn: "startPlugins"}, "plugin " + plugin.require + " initialized.");
								cb ();
							}, failure: function (err) {
								log.error ({cls: "server", fn: "startPlugins", error: plugin.require + " error: " + err});
								cb ();
							}});
						} else {
							cb ();
						};
					}
				], function (err, result) {
					if (m.handler) {
						server.app.all (plugin.path, m.handler);
						log.info ({cls: "server", fn: "startPlugins"}, "plugin " + plugin.require + " handler activated.");
					};
					cb ();
				});
			} else {
				cb ();
			};
		});
	}, function (err, results) {
		if (success) {
			success ();
		};
	});
};
server.projectPlugins = {};
server.processProjectPlugins = function (req, res, next) {
	let urlTokens = req.url.split ("/");
	if (urlTokens [3] == "plugins") {
		let storageCode = urlTokens [2];
		if (server.projectPlugins [storageCode]) {
			server.projectPlugins [storageCode] (req, res);
		} else {
			projects.getStorage ({request: req, res: res, storageCode: storageCode, success: function (options) {
				if (server.projectPlugins [storageCode]) {
					server.projectPlugins [storageCode] (req, res);
				} else {
					next ();
				};
			}});
		};
	} else {
		next ();
	};
};
server.startWSDL = function (options) {
	options = options || {};
	let success = options.success;
	let storages = [];
	for (let storageCode in config.storages) {
		storages.push (storageCode);
	};
	async.map (storages, function (storageCode, cb) {
		let wsdlFile = config.storages [storageCode].rootDir + "/wsdl/wsdl.js"
		if (config.storages [storageCode].wsdl && !config.storages [storageCode].wsdl.enabled) {
			cb ();
			return;
		};
		fs.exists (wsdlFile, function (exists) {
			if (exists) {
				projects.getStorage ({storageCode: storageCode, success: function (options) {
					// todo: одинаковые wsdl.js накрывают друг друга
					let wsdl = require (wsdlFile);
					options.storage.rootDir = config.storages [storageCode].rootDir;
					wsdl.start ({objectum: server.objectum, storage: options.storage});
					cb ();
				}});
			} else {
				cb ();
			};
		});
	}, function (err, results) {
		if (success) {
			success ();
		};
	});
};
server.start = function (options, cb) {
	server.http = http.createServer (server.app);
	let port = options.port || config.startPort;
	config.port = port;
	async.series ([
		function (cb) {
			if (!config.createStoragesOnDemand) {
				projects.createStorages ({success: function () {
					console.log ("Storages created.");
					projects.news.gc ();
					cb ();
				}});
			} else {
				cb ();
			};
		},
		function (cb) {
			if (port == config.startPort || process.env.mainWorker) {
				setInterval (function () {
					projects.removeTimeoutSessions ();
				},
					config.session.gcInterval
				);
				setInterval (function () {
					mailSender.sendFailed ();
				},
					config.mail.sendFailedInterval ? config.mail.sendFailedInterval : 1000 * 60 * 20
				);
				if (config.redis.resetCache) {
					redisClient.del ("sessions");
					redisClient.del ("current-requests");
					redisClient.del ("server-memoryusage");
					redisClient.del ("files");
					redisClient.del ("files-mtime");
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
					redisClient.keys ("log-*", function (err, result) {
						for (let i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("*-objects", function (err, result) {
						for (let i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("*-data", function (err, result) {
						for (let i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
				};
				if (!(config.wsdl && config.wsdl.enabled == false)) {
					server.startWSDL ({success: cb});
				} else {
					cb ();
				};
			} else {
				cb ();
			};
		}
	], function (err, results) {
		if (err) {
			console.log ("Objectum server start error: " + err + ", port: " + port);
		} else {
			console.log ("Objectum server has started at port: " + port);
		};
		redisClient.hset ("server-started", process.pid, common.currentUTCTimestamp ());
		server.http.listen (port, config.host, config.backlog);
		server.http.on ("error", function (err) {
			log.error ({cls: "server", fn: "start", error: "http error: " + err});
		});
		if (cb) {
			cb (err);
		};
	});
};
