//
//	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var config = JSON.parse (process.env.config);
var $o = new (require (__dirname + "/server/index").Objectum)(config);
if (process.env.port == config.cluster.www.port) {
	// www worker
	var mimetypes = $o.mimetypes;
	var http = require ("http");
	var express = require ("express");
	var url = require ("url");
	var async = require ("async");
	var fs = require ("fs");
	var util = require ("util");
	var redis = require ("redis");
	var redisClient = redis.createClient (config.redis.port, config.redis.host);
	var server = {};
	server.www = function (options) {
		var req = options.req;
		var res = options.res;
		var filePath = options.filePath;
		if (!filePath) {
			var pathname = url.parse (req.url).pathname;
			filePath = config.wwwRoot + pathname;
		};
		var mtime, mtimeRedis, status = 200, data;
		async.series ([
			function (cb) {
				redisClient.hget ("files-mtime", filePath, function (err, result) {
					mtimeRedis = result;
					cb ();
				});
			},
			function (cb) {
				fs.stat (filePath, function (err, stats) {
					if (err) {
						cb ("File not found " + filePath);
					} else {
						mtime = new Date (stats.mtime).getTime ();
						if (mtimeRedis) {
							if (mtimeRedis != mtime) {
								mtimeRedis = null;
							} else {
								if (req.headers ["if-none-match"]) {
									var mtimeUser = req.headers ["if-none-match"];
									if (mtimeUser == mtimeRedis) {
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
				if (mtimeRedis) {
					cb ();
				} else {
					fs.readFile (filePath, function (err, data) {
						if (err) {
							cb ("File not found " + filePath);
						} else {
							redisClient.hset ("files", filePath, data.toString ("base64"), function (err) {
								redisClient.hset ("files-mtime", filePath, mtime, function (err) {
									cb ();
								});
							});
						};
					});
				};
			},
			function (cb) {
				if (status == 304) {
					cb ();
				} else {
					redisClient.hget ("files", filePath, function (err, result) {
						data = new Buffer (result, "base64");
						cb ();
					});
				};
			}
		], function (err, results) {
			if (err) {
				try {
					res.writeHead (404, {"Content-Type": "text/html; charset=utf-8"});
					res.end (err);
				} catch (e) {
				};
			} else {
				try {
					var ext = filePath.split (".");
					ext = ext [ext.length - 1];
			  		res.set ("ETag", mtime);
			  		res.set ("Content-Type", $o.mimetypes.lookup (ext));
			  		if (status == 304) {
			  			res.sendStatus (status);
			  		} else {
			  			res.status (status).send (data);
			  		};
				} catch (e) {
				};
			};
		});
	};
	server.projects = function (req, res, next) {
		var tokens = req.url.split ("/");
		if (req.method == "GET" && tokens.length == 3) {
			tokens.push ("");
			res.redirect (tokens.join ("/"));
			return;
		};
		var storageCode = tokens [2];
		var pathname = "/" + tokens.slice (3).join ("/");
		if (pathname == "/") {
			pathname = "/index.html";
		}
		pathname = pathname.split ("?")[0];
		if (!config.storages [storageCode]) {
			res.end ("unknown url: " + req.url + ", storageCode: " + storageCode);
		} else {
			var filePath = config.storages [storageCode].rootDir + pathname;
			if (pathname.substr (0, 6) == "/files") {
				fs.readFile (decodeURI (filePath), function (err, data) {
					if (err) {
						res.send (err);
					} else {
						var ext = filePath.split (".");
						ext = ext [ext.length - 1];
						res.writeHead (200, {
							"Content-Type": mimetypes.lookup (ext)
						});
						res.end (data);
					}
				});
			} else
			if (pathname.substr (0, 10) == "/resources" || pathname.substr (0, 7) == "/locale" || pathname.substr (0, 11) == "/index.html") {
				server.www ({req: req, res: res, filePath: filePath});
			} else {
				next ();
			};
		};
	};
	server.sessions = {};
	server.startedPort = {};
	server.getNextPort = function () {
		var has = false;
		for (var port in server.startedPort) {
			if (server.startedPort [port]) {
				has = true;
			};
		};
		if (!has) {
			return 0;
		};
		server.portNext = server.portNext || config.startPort + 2;
		server.portNext ++;
		if (server.portNext > (config.startPort + config.cluster.app.workers)) {
			server.portNext = config.startPort + 2;
		};
		var portApp = server.portNext;
		if (server.startedPort [portApp]) {
			console.log ("port assigned", portApp);
			return portApp;
		} else {
			return server.getNextPort ();
		};
	};
	server.proxy = function (request, response, next) {
		var sessionId = request.query.sessionId, portApp;
		if (request.url.indexOf ("/wsdl/") > -1) {
			portApp = config.startPort;
		} else
	   	if (!sessionId) {
			portApp = server.getNextPort ();
			if (!portApp) {
				response.status (404);
				response.end ('{"error": "Server starting"}');
				return;
			};
	   	} else {
	   		if (!server.sessions [sessionId]) {
				response.status (500).send ('{"header": {"error": "unknown sessionId: ' + sessionId + '"}}');
	   			return;
	   		};
	   		portApp = server.sessions [sessionId].port;
	   	};
	   	request.headers ["x-real-ip"] = $o.common.getRemoteAddress (request);
		var req = http.request ({
			agent: server.agent,
			host: config.host ? config.host : "127.0.0.1",
			port: portApp,
			path: request.url,
			method: request.method,
			headers: request.headers
		}, function (res) {
			var data;
			res.on ("data", function (d) {
				if (data) {
					data += d;
				} else {
					data = d;
				};
			});
			res.on ("end", function () {
			   	if (request.query.authorize == 1 && data) {
					var sessionId, opts;
					try {
						opts = JSON.parse (data);
						sessionId = opts.sessionId;
					} catch (e) {
						try {
							if (data instanceof Buffer) {
								data = data.toString ("utf8");
							};
					   		var tokens = data.split (" ");
					   		sessionId = tokens [0];
						} catch (e) {
						};
					};
					if (sessionId) {
						server.sessions [sessionId] = {
							port: portApp
						};
						process.send (JSON.stringify ({sessionId: sessionId, port: portApp}));
					};
			   	};
				response.set (res.headers);
				response.status (res.statusCode);
				response.end (data);
			});
		});
		req.on ("error", function (err) {
			console.error ("www worker request error:", err);
		});
		request.on ("data", function (d) {
			req.write (d);
		});
		request.on ("end", function () {
			req.end ();
		});
	};
	server.updateMemoryUsage = function () {
		server.memoryUsage = server.memoryUsage || {rss: 0, heapTotal: 0, heapUsed: 0};
		var pmu = process.memoryUsage ();
		if (server.memoryUsage.rss < pmu.rss) {
			server.memoryUsage.rss = pmu.rss;
		};
		if (server.memoryUsage.heapTotal < pmu.heapTotal) {
			server.memoryUsage.heapTotal = pmu.heapTotal;
		};
		if (server.memoryUsage.heapUsed < pmu.heapUsed) {
			server.memoryUsage.heapUsed = pmu.heapUsed;
		};
		pmu.rss = (pmu.rss / (1024 * 1024)).toFixed (3);
		pmu.heapTotal = (pmu.heapTotal / (1024 * 1024)).toFixed (3);
		pmu.heapUsed = (pmu.heapUsed / (1024 * 1024)).toFixed (3);
		server.memoryUsage.rss = (server.memoryUsage.rss / (1024 * 1024)).toFixed (3);
		server.memoryUsage.heapTotal = (server.memoryUsage.heapTotal / (1024 * 1024)).toFixed (3);
		server.memoryUsage.heapUsed = (server.memoryUsage.heapUsed / (1024 * 1024)).toFixed (3);
		redisClient.hset ("server-memoryusage", process.pid, JSON.stringify ({
			port: config.cluster.www.port,
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
	server.start = function () {
		server.app = express ();
		server.app.use (function (request, response, next) {
			request.connection.setNoDelay (true);
			next ();
		});
		if (config.cluster.compress) {
			server.app.use (express.compress ());
		};
		server.app.get ("/third-party/*", function (req, res) {
			server.www ({req: req, res: res});
		});
		server.app.get ("/client/*", function (req, res, next) {
			server.www ({req: req, res: res});
		});
		server.app.get ("/favicon.ico", function (req, res, next) {
			server.www ({req: req, res: res});
		});
		server.app.get ("/projects/*", 
			server.projects
		);
		server.app.all ("*", 
			server.proxy
		);
		server.app.use (function (err, req, res, next) {
			var msg = err.message ? err.message : err;
			$o.common.log ({file: config.rootDir + "/ocluster.log", text: "express exception: " + msg + ", stack: " + JSON.stringify (err.stack)});
			res.status (500).send ('{"header": {"error": "' + msg + '", "stack": "' + JSON.stringify (err.stack) + '"}}');
		});
		server.agent = new http.Agent ();
		server.agent.maxSockets = config.maxSockets || 5000;
		server.http = http.createServer (server.app);
		server.http.listen (config.cluster.www.port, config.host, config.backlog);
		process.on ("message", function (m) {
			var o = eval ("(" + m + ")");
			if (o.port) {
				server.sessions [o.sessionId] = {
					port: o.port
				};
			};
			if (o.restartPort) {
				server.startedPort [o.restartPort] = false;
				for (var sessionId in server.sessions) {
					var o = server.sessions [sessionId];
					if (o.port == o.restartPort) {
						delete server.sessions [sessionId];
					};
				};
			};
			if (o.startedPort) {
				server.startedPort [o.startedPort] = true;
			};
		});
		function startGC () {
			if (global.gc) {
				global.gc ();
				setTimeout (startGC, config.gcInterval || 5000);
			}
		};
		setTimeout (startGC, 5000);
		setInterval (function () {
			server.updateMemoryUsage ();
		}, 1000);
		redisClient.hset ("server-started", process.pid, $o.common.currentUTCTimestamp ());
	};
	server.start ();
} else {
	// app worker
	$o.server.init ({objectum: $o, success: function () {
		$o.server.start ({port: process.env.port}, function (err) {
			process.send (JSON.stringify ({startedPort: process.env.port}));
		});
	}});
};
