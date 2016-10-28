//
//	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
//
var fs = require ("fs");
var cluster = require ("cluster");
// DD.MM.YYYY
var currentDate = function () {
	var d = new Date ();
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";

	if (dd < 10)
		s += "0";

	s += String (dd) + ".";

	if (mm < 10)
		s += "0";

	s += String (mm) + ".";
	s += String (yyyy);

	return s;
};
// HH:MM:SS
var currentTime = function (options) {
	var d = new Date ();
	var hh = d.getHours ();
	var mm = d.getMinutes ();
	var ss = d.getSeconds ();
	var s = "";
	if (hh < 10) {
		s += "0";
	}
	s += String (hh) + ":";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + ":";
	if (ss < 10) {
		s += "0";		
	}
	s += String (ss);
	if (options && options.msec) {
		s += ".";
		var ms = d.getMilliseconds ();
		if (ms < 100) {
			s += "0"
		}
		if (ms < 10) {
			s += "0"
		}
		s += String (ms);
	}
	return s;
};
// DD.MM.YYYY HH:MM:SS
var currentTimestamp = function () {
	return currentDate () + " " + currentTime ();
};
var start = function (config) {
	var $o = new (require (__dirname + "/objectum-debug").Objectum)(config);
	$o.server.init ({objectum: $o, success: function () {
		$o.server.start ({port: $o.config.startPort});
	}});
};
var startMaster = function (config) {
	var env = {config: JSON.stringify (config)};
	cluster.setupMaster ({
	    exec: __dirname + "/index.js"
	});
	var log = function (text) {
		console.log (text);
		fs.appendFile (config.rootDir + "/master.log", "[" + currentTimestamp () + "] " + text + '\n');
	};
	var startWorker = function () {
		log ("Worker started");
	    cluster.fork (env);
	};
	startWorker ();
	cluster.on ("exit", function (worker, code, signal) {
		log ("Worker " + worker.process.pid + " died");
		startWorker ();
	});
};
var startCluster = function (config) {
	var $o = new (require (__dirname + "/objectum-debug").Objectum)(config);
	cluster.setupMaster ({
	    exec: __dirname + "/ocluster.js"
	});
	var log = function (text) {
		console.log (text);
		fs.appendFile (config.rootDir + "/ocluster.log", "[" + currentTimestamp () + "] " + text + '\n');
	};
	var startWorker = function (port, mainWorker) {
		var env = {config: JSON.stringify (config), port: port};
		if (mainWorker) {
			env.mainWorker = "1";
		};
	    var p = cluster.fork (env);
	    p.port = port;
		p.on ("message", function (m) {
			for (var id in cluster.workers) {
				if (p != cluster.workers [id]) {
					cluster.workers [id].send (m);
				};
			};
		});
		log ("worker pid: " + p.process.pid + " (port: " + port + ") started.");
	};
	var start = function () {
		for (var i = 0; i < config.cluster.app.workers; i ++) {
			startWorker (config.startPort + i + 1, i == 0);
		};
		for (var i = 0; i < config.cluster.www.workers; i ++) {
			startWorker (config.cluster.www.port);
		};
		function startGC () {
			if (global.gc) {
				global.gc ();
				setTimeout (startGC, config.gcInterval || 5000);
			}
		};
		setTimeout (startGC, 5000);
	};
	cluster.on ("exit", function (worker, code, signal) {
		log ("worker pid: " + worker.process.pid + " (port: " + worker.port + ") died.");
		startWorker (worker.port);
	});
	if (!config.redis.enabled) {
		log ("Redis not enabled.");
		process.exit (1);
	};
	if (config.cluster.app.workers < 2) {
		log ("cluster.app.workers must be > 1.");
		process.exit (1);
	};
	var redis = require ("redis");
	var redisClient = redis.createClient (config.redis.port, config.redis.host);
	redisClient.get ("*", function (err, result) {
		if (err) {
			log ("Redis error: " + err);
			process.exit (1);
		} else {
			start ();
		};
	});
};
module.exports = {
	start: start,
	startMaster: startMaster,
	startCluster: startCluster,
	Objectum: require (__dirname + "/objectum-debug").Objectum
};
try {
	if (process.argv [1].indexOf (__dirname) > -1) {
		start (require (__dirname + "/config"));
	};
} catch (e) {
	if (!cluster.isMaster) {
		start (JSON.parse (process.env.config));
	};
};
