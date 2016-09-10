var _ = require ("underscore");
var config = require ("./config").config;
// default values
if (!config.auth) {
	config.auth = {multi: true};
}
config.backlog = config.backlog || 10000;
if (!config.caching) {
	config.caching = {enabled: 0};
}
if (!config.admin) {
	config.admin = {ip: ["127.0.0.1"]};
}
if (!config.session) {
	config.session = {
		timeoutInterval: 120 * 1000,
		gcInterval: 300 * 1000
	};
}
if (!config.news) {
	config.news = {
		pollingInterval: 5000,
		gcInterval: 300000
	};
}
if (!config.rootDir) {
	config.rootDir = config.objectumDir + "/node";
}
if (!config.projectsDir) {
	config.projectsDir = config.objectumDir + "/projects";
}
if (!config.wwwRoot) {
	config.wwwRoot = config.objectumDir + "/node/www";
}
if (_.isArray (config.storages)) {
	var storages = {};
	_.each (config.storages, function (code) {
		storages [code] = require (config.projectsDir + "/" + code + "/config.json");
	});
	config.storages = storages;
}

var async = require ("async");
var pg = require ("pg");
pg.defaults.poolSize = 0;
pg.defaults.poolIdleTimeout = 120000;
pg.defaults.reapIntervalMillis = 60000;
var util = require ("util");
var fs = require ("fs");
var http = require ("http");
var url = require ("url");
var	redis;
if (config.redis && config.redis.enabled) {
	redis = require ("redis");
}
var pg = require ("pg");
var express = require ("express");
var formidable = require ("formidable");
var nodemailer = require ("nodemailer");
var simplesmtp = require ("simplesmtp");
var smtp = simplesmtp.createServer ();
var MailParser = require ("mailparser").MailParser;
var VError = require ("verror");
var Backbone = require ("backbone");
var log;
try {
	config.log = config.log || {};
	config.log.level = config.log.level || "info";
	var bunyan = require ("bunyan");
	log = bunyan.createLogger ({
		name: "objectum",
		level: config.log.level || "info",
		streams: [{
			stream: process.stdout
		}, {
			path: __dirname + "/objectum-bunyan.log"
		}]
	});
} catch (e) {
	var levelNum = {"fatal": 60, "error": 50, "warn": 40, "info": 30, "debug": 20, "trace": 10};
	config.log.levelNum = levelNum [config.log.level];
	function msgLog (level, opts, msg) {
		if (level < config.log.levelNum) {
			return;
		};
		opts = opts || {};
		if (typeof (opts) == "string") {
			opts = {msg: opts};
		};
		opts.msg = opts.msg || msg;
		opts.level = level;
		common.log ({file: config.rootDir + "/objectum-bunyan.log", text: util.inspect (opts, {depth: null})});
	};
	log = {
		fatal: function (opts, msg) {msgLog (60, opts, msg);},
		error: function (opts, msg) {msgLog (50, opts, msg);},
		warn: function (opts, msg) {msgLog (40, opts, msg);},
		info: function (opts, msg) {msgLog (30, opts, msg);},
		debug: function (opts, msg) {msgLog (20, opts, msg);},
		trace: function (opts, msg) {msgLog (10, opts, msg);}
	};
};
var sql;
if (process.platform == "win32") {
	if (!config.mssql || config.mssql.enabled) {
		var tokens = process.version.split (".");
		if (tokens [1] <= 8 && tokens [2] <= 26) { // <= v0.8.26
			try {
				sql = require ("msnodesql");
			} catch (e) {
			}
		};
	};
};
var redisEmulator = {
	m: {},
	del: function (key, cb) {
		delete this.m [key];
		if (cb) {
			cb (null, true);
		};
	},
	keys: function (mask, cb) {
		var r = [];
		if (mask && mask [mask.length - 1] == "*") {
			var m = mask.substr (0, mask.length - 1);
			for (var key in this.m) {
				if (key.substr (0, m.length) == m) {
					r.push (key);
				};
			};
		};
		if (cb) {
			cb (null, r);
		};
	},
	subscribers: [],
	on: function (event, cb) {
		this.subscribers.push (cb);
	},
	subscribe: function (channel) {
	},
	publish: function (channel, message) {
		for (var i = 0; i < this.subscribers.length; i ++) {
			(this.subscribers [i]) (channel, message);
		};
	},
	incrby: function (key, inc, cb) {
		this.m [key] = this.m [key] || 0;
		this.m [key] = Number (this.m [key]) + inc;
		if (cb) {
			cb (null, String (this.m [key]));
		};
	},
	get: function (key, cb) {
		if (cb) {
			cb (null, this.m [key] || null);
		};
	},
	set: function (key, value, cb) {
		this.m [key] = String (value);
		if (cb) {
			cb (null, true);
		};
	},
	hincrby: function (key, field, inc, cb) {
		this.m [key] = this.m [key] || {};
		this.m [key][field] = this.m [key][field] || 0;
		this.m [key][field] = Number (this.m [key][field]) + inc;
		if (cb) {
			cb (null, String (this.m [key][field]));
		};
	},
	hdel: function () {
		var key = arguments [0];
		for (var i = 1; i < arguments.length; i ++) {
			if (typeof (arguments [i]) != "function" && this.m [key] && this.m [key][arguments [i]]) {
				delete this.m [key][arguments [i]];
			};
		};
		if (typeof (arguments [arguments.length - 1]) == "function") {
			(arguments [arguments.length - 1]) (null, true);
		};
	},
	hset: function (key, field, value, cb) {
		this.m [key] = this.m [key] || {};
		this.m [key][field] = String (value);
		if (cb) {
			cb (null, true);
		};
	},
	hmset: function (key, hdata, cb) {
		this.m [key] = this.m [key] || {};
		for (var field in hdata) {
			this.m [key][field] = String (hdata [field]);
		};
		if (cb) {
			cb (null, true);
		};
	},
	hget: function (key, field, cb) {
		this.m [key] = this.m [key] || {};
		if (cb) {
			cb (null, this.m [key][field]);
		};
	},
	hmget: function (key, keys, cb) {
		this.m [key] = this.m [key] || {};
		var r = [];
		for (var i = 0; i < keys.length; i ++) {
			r.push (this.m [key][keys [i]]);
		};
		if (cb) {
			cb (null, r);
		};
	},
	hgetall: function (key, cb) {
		var r = {};
		for (var field in this.m [key]) {
			r [field] = this.m [key][field];
		};
		if (cb) {
			cb (null, r);
		};
	},
	hsetnx: function (key, field, value, cb) {
		this.m [key] = this.m [key] || {};
		var r = 0;
		if (!this.m [key] [field]) {
			this.m [key] [field] = value;
			r = 1;
		};
		if (cb) {
			cb (null, r);
		};
	},
	hkeys: function (key, cb) {
		var r = [];
		for (var field in this.m [key]) {
			r.push (field);
		};
		if (cb) {
			cb (null, r);
		};
	},
	sadd: function (key, value, cb) {
		this.m [key] = this.m [key] || [];
		if (this.m [key].indexOf (value) == -1) {
			this.m [key].push (String (value));
			if (cb) {
				cb (null, true);
			};
		} else {
			if (cb) {
				cb (true, false);
			};
		};
	},
	sismember: function (key, value, cb) {
		this.m [key] = this.m [key] || [];
		if (cb) {
			cb (null, this.m [key].indexOf (value) > -1);
		};
	},
	srem: function (key, value, cb) {
		this.m [key] = this.m [key] || [];
		var pos = this.m [key].indexOf (String (value));
		if (pos > -1) {
			this.m [key].splice (pos, 1);
		};
		if (cb) {
			cb (null, true);
		};
	},
	smembers: function (key, cb) {
		this.m [key] = this.m [key] || [];
		if (cb) {
			cb (null, this.m [key]);
		};
	},
	lpush: function (key, value) {
		this.m [key] = this.m [key] || [];
		this.m [key] = [value].concat (this.m [key]);
		if (key.indexOf ("service.log") > -1) {
			console.log (key + " lpush " + this.m [key]);
		};
	},
	ltrim: function (key, start, end) {
		this.m [key] = this.m [key] || [];
		this.m [key] = this.m [key].slice (start, end + 1);
		if (key.indexOf ("service.log") > -1) {
			console.log (key + " ltrim " + this.m [key]);
		};
	},
	lrange: function (key, start, end, cb) {
		this.m [key] = this.m [key] || [];
		end = end == -1 ? (this.m [key].length - 1) : end;
		if (cb) {
			cb (null, this.m [key].slice (start, end + 1));
		};
		if (key.indexOf ("service.log") > -1) {
			console.log (key + " lrange " + this.m [key]);
		};
	},
	select: function (db, cb) {
		cb ();
	},
	quit: function () {
	}
};
if (!config.redis.enabled) {
	redis = {
		createClient: function () {
			return redisEmulator;
		}
	};
};
var redisClient;
var redisPub;
var redisSub;
