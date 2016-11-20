/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
*/
exports.Objectum = function (config) {
if (config) {
	config = config.config || config;
};

var _ = require ("underscore");
if (!config) {
	config = require ("./config");
};
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
/*
if (!config.rootDir) {
	config.rootDir = config.objectumDir + "/node";
}
if (!config.projectsDir) {
	config.projectsDir = config.objectumDir + "/projects";
}
if (!config.wwwRoot) {
	config.wwwRoot = config.objectumDir + "/node/www";
}
*/
config.wwwRoot = __dirname + "/www";
if (_.isArray (config.storages) && config.projectsDir) {
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

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var common = {};
// DD.MM.YYYY
common.getDate = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";
	if (dd < 10) {
		s += "0";
	};
	s += String (dd) + ".";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + ".";
	s += String (yyyy);
	return s;
}
// YYYY-MM-DD
common.getDateISO = function (d) {
	if (!d) {
		return "";
	};
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = String (yyyy) + "-";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + "-";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd);
	return s;
};
common.getDateFromDDMMYYYY = function (d) {
	var r = null;
	if (d && d.length == 10 && d [2] == "." && d [5] == ".") {
		r = new Date (d.substr (6, 4), d.substr (3, 2) - 1, d.substr (0, 2));
	}
	return r;
}
// YYYY-MM-DDTHH:MM:SS.MMMZ
common.getLocalISOString = function (d) {
	function getDigit (n) {
		var s = "";
		if (n < 10) {
			s += "0";
		}
		s += n;
		return s;
	}
	var v = d.getFullYear () + "-";
	v += getDigit (d.getMonth () + 1) + "-";
	v += getDigit (d.getDate ()) + "T";
	v += getDigit (d.getHours ()) + ":";
	v += getDigit (d.getMinutes ()) + ":";
	v += getDigit (d.getSeconds ()) + ".000Z";
	return v;
}
// DD.MM.YYYY
common.getUTCDate = function (d) {
	var dd = d.getUTCDate ();
	var mm = d.getUTCMonth () + 1;
	var yyyy = d.getUTCFullYear ();
	var s = "";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd) + ".";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + ".";
	s += String (yyyy);
	return s;
};
// HH:MM:SS
common.getTime = function (d) {
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
	return s;
};
// HH:MM:SS
common.getUTCTime = function (d) {
	var hh = d.getUTCHours ();
	var mm = d.getUTCMinutes ();
	var ss = d.getUTCSeconds ();
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
	return s;
};
// DD.MM.YYYY
common.currentDate = function () {
	var d = new Date ();
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yyyy = d.getFullYear ();
	var s = "";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd) + ".";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + ".";
	s += String (yyyy);
	return s;
};
// DD.MM.YYYY
common.currentUTCDate = function () {
	var d = new Date ();
	var dd = d.getUTCDate ();
	var mm = d.getUTCMonth () + 1;
	var yyyy = d.getUTCFullYear ();
	var s = "";
	if (dd < 10) {
		s += "0";
	}
	s += String (dd) + ".";
	if (mm < 10) {
		s += "0";
	}
	s += String (mm) + ".";
	s += String (yyyy);
	return s;
};
// HH:MM:SS
common.currentTime = function (options) {
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
// HH:MM:SS
common.currentUTCTime = function (options) {
	var d = new Date ();
	var hh = d.getUTCHours ();
	var mm = d.getUTCMinutes ();
	var ss = d.getUTCSeconds ();
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
		var ms = d.getUTCMilliseconds ();
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
common.currentTimestamp = function () {
	return common.currentDate () + " " + common.currentTime ();
};
// DD.MM.YYYY HH:MM:SS
common.currentUTCTimestamp = function () {
	return common.currentUTCDate () + " " + common.currentUTCTime ();
};
// DD.MM.YYYY HH:MM:SS
common.getTimestamp = function (d) {
	return common.getDate (d) + " " + common.getTime (d);
};
// DD.MM.YYYY HH:MM:SS
common.getUTCTimestamp = function (d) {
	return common.getUTCDate (d) + " " + common.getUTCTime (d);
};
// Date -> Юлианский день
common.getJulianDay = function (d) {
    if (d == "") {
        return 0;
    };
	var dd = d.getDate ();
	var mm = d.getMonth () + 1;
	var yy = d.getFullYear ();
    jd = Math.floor ( 1461 * ( yy + 4800 + ( mm - 14 ) / 12)) / 4 + Math.floor (Math.floor ( 367 * ( mm - 2 - 12 * (( mm - 14 ) / 12))) / 12) - 3 * Math.floor (Math.floor ( yy + 4900 + ( mm - 14 ) / 12) / 100) / 4 + dd - 32075;
    return jd;
};
// Юлианский день -> Date
common.getDateByJulianDay = function (jd) {
	var l, n, i, j, d, m, y;
	l = jd + 68569;
	n = Math.floor (( 4 * l ) / 146097);
	l = Math.floor (l - ( 146097 * n + 3 ) / 4);
	i = Math.floor (( 4000 * ( l + 1 ) ) / 1461001);
	l = l - Math.floor (( 1461 * i ) / 4) + 31;
	j = Math.floor (( 80 * l ) / 2447);
	d = l - Math.floor (( 2447 * j ) / 80);
	l = Math.floor (j / 11);
	m = j + 2 - ( 12 * l );
	y = 100 * ( n - 49 ) + i + l;
	return new Date (y, m - 1, d);
};
common.getRemoteAddress = function (request) {
	var result = request.headers ["x-real-ip"] || request.connection.remoteAddress;
	return result;
};
common.ToJSONString = function (v, utc) {
	var r;
	if (typeof (v) == "string") {
		r = JSON.stringify (v).split ("\\\\u").join ("\\u");
	} else
	if (v && typeof (v) == 'object') {
		if (v.getMonth) {
			if ((v.getUTCHours () == 0 && v.getUTCMinutes () == 0 && v.getUTCSeconds () == 0 && v.getUTCMilliseconds () == 0) || 
				(v.getHours () == 0 && v.getMinutes () == 0 && v.getSeconds () == 0 && v.getMilliseconds () == 0)
			) {
				r = 
					'new Date (' +
					v.getFullYear () + ',' +
					v.getMonth () + ',' +
					v.getDate () + ')'
				;
			} else {
				r = 
					'new Date (Date.UTC (' +
					v.getFullYear () + ',' +
					v.getMonth () + ',' +
					v.getDate () + ',' +
					v.getHours () + ',' +
					v.getMinutes () + ',' +
					v.getSeconds () + '))'
				;
			}
		} else
		if (common.isArray (v)) {
			r = '[';
			for (var i = 0; i < v.length; i ++) {
				if (i) {
					r += ', ';
				}
				r += common.ToJSONString (v [i]);
			}
			r += ']';
		} else {
			r = '{';
			for (var a in v) {
				if (r != '{') {
					r += ', ';
				}
				r += '"' + a + '": ' + common.ToJSONString (v [a]);
			}
			r += '}';
		}
	} else {
		r = v;
	}
	return r;
};
common.ToSQLString = function (v, db) {
	var r;
	if (db == "mssql") {
		if (typeof (v) == 'string') {
			r = "'" + v.split ("'").join ("''") + "'";
		} else
		if (v && typeof (v) == 'object' && v.getMonth) {
			v = "'" + common.getUTCTimestamp (v) + "'";
		} else {
			r = v;
			if (r === null) {
				r = 'null';
			}
		};
	} else {
		if (typeof (v) == 'string') {
			r = "'" + common.unescape (v.split ('\\').join ('\\\\').split ('\n').join ('\\n').split ('\r').join ('\\r').split ("'").join ("\\'")) + "'";
		} else
		if (v && typeof (v) == 'object' && v.getMonth) {
			v = "'" + common.getUTCTimestamp (v) + "'";
		} else {
			r = v;
			if (r === null) {
				r = 'null';
			}
		};
	};
	return r;
};
common.isEqualDates = function (d1, d2) {
	if ((d1 && !d2) || (!d1 && d2)) {
		return false;
	}
	if ((d1.getUTCFullYear () != d2.getUTCFullYear ()) || 
		(d1.getUTCMonth () != d2.getUTCMonth ()) || 
		(d1.getUTCDate () != d2.getUTCDate ()) || 
		(d1.getUTCHours () != d2.getUTCHours ()) || 
		(d1.getUTCMinutes () != d2.getUTCMinutes ()) || 
		(d1.getUTCSeconds () != d2.getUTCSeconds ())
	) {
		return false;
	}
	return true;
};
common.isArray = function (o) {
	if (Object.prototype.toString.call (o) === '[object Array]') {
		return true;
	} else {
		return false;
	}
};
var DMap = {0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23, 24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30, 31: 31, 32: 32, 33: 33, 34: 34, 35: 35, 36: 36, 37: 37, 38: 38, 39: 39, 40: 40, 41: 41, 42: 42, 43: 43, 44: 44, 45: 45, 46: 46, 47: 47, 48: 48, 49: 49, 50: 50, 51: 51, 52: 52, 53: 53, 54: 54, 55: 55, 56: 56, 57: 57, 58: 58, 59: 59, 60: 60, 61: 61, 62: 62, 63: 63, 64: 64, 65: 65, 66: 66, 67: 67, 68: 68, 69: 69, 70: 70, 71: 71, 72: 72, 73: 73, 74: 74, 75: 75, 76: 76, 77: 77, 78: 78, 79: 79, 80: 80, 81: 81, 82: 82, 83: 83, 84: 84, 85: 85, 86: 86, 87: 87, 88: 88, 89: 89, 90: 90, 91: 91, 92: 92, 93: 93, 94: 94, 95: 95, 96: 96, 97: 97, 98: 98, 99: 99, 100: 100, 101: 101, 102: 102, 103: 103, 104: 104, 105: 105, 106: 106, 107: 107, 108: 108, 109: 109, 110: 110, 111: 111, 112: 112, 113: 113, 114: 114, 115: 115, 116: 116, 117: 117, 118: 118, 119: 119, 120: 120, 121: 121, 122: 122, 123: 123, 124: 124, 125: 125, 126: 126, 127: 127, 1027: 129, 8225: 135, 1046: 198, 8222: 132, 1047: 199, 1168: 165, 1048: 200, 1113: 154, 1049: 201, 1045: 197, 1050: 202, 1028: 170, 160: 160, 1040: 192, 1051: 203, 164: 164, 166: 166, 167: 167, 169: 169, 171: 171, 172: 172, 173: 173, 174: 174, 1053: 205, 176: 176, 177: 177, 1114: 156, 181: 181, 182: 182, 183: 183, 8221: 148, 187: 187, 1029: 189, 1056: 208, 1057: 209, 1058: 210, 8364: 136, 1112: 188, 1115: 158, 1059: 211, 1060: 212, 1030: 178, 1061: 213, 1062: 214, 1063: 215, 1116: 157, 1064: 216, 1065: 217, 1031: 175, 1066: 218, 1067: 219, 1068: 220, 1069: 221, 1070: 222, 1032: 163, 8226: 149, 1071: 223, 1072: 224, 8482: 153, 1073: 225, 8240: 137, 1118: 162, 1074: 226, 1110: 179, 8230: 133, 1075: 227, 1033: 138, 1076: 228, 1077: 229, 8211: 150, 1078: 230, 1119: 159, 1079: 231, 1042: 194, 1080: 232, 1034: 140, 1025: 168, 1081: 233, 1082: 234, 8212: 151, 1083: 235, 1169: 180, 1084: 236, 1052: 204, 1085: 237, 1035: 142, 1086: 238, 1087: 239, 1088: 240, 1089: 241, 1090: 242, 1036: 141, 1041: 193, 1091: 243, 1092: 244, 8224: 134, 1093: 245, 8470: 185, 1094: 246, 1054: 206, 1095: 247, 1096: 248, 8249: 139, 1097: 249, 1098: 250, 1044: 196, 1099: 251, 1111: 191, 1055: 207, 1100: 252, 1038: 161, 8220: 147, 1101: 253, 8250: 155, 1102: 254, 8216: 145, 1103: 255, 1043: 195, 1105: 184, 1039: 143, 1026: 128, 1106: 144, 8218: 130, 1107: 131, 8217: 146, 1108: 186, 1109: 190}
common.UnicodeToWin1251 = function (s) {
    var L = []
    if (!s || !s.length) {
    	return s;
    };
    for (var i = 0; i < s.length; i ++) {
        var ord = s.charCodeAt (i)
        if (!(ord in DMap))
            throw "Character " + s.charAt (i) + " isn't supported by win1251!"
        L.push (String.fromCharCode (DMap [ord]))
    }
    return L.join('')
};
common.unescape = function (s) {
	if (!s) {
		return s;
	};
	if (typeof (s) == "object") {
		if (s.getMonth) {
			return s;
		} else
		if (common.isArray (s)) {
			for (var i = 0; i < s.length; i ++) {
				s [i] = common.unescape (s [i]);
			};
		} else {
			for (var a in s) {
				s [a] = common.unescape (s [a]);
			};
		};
		return s;
	} else
	if (typeof (s) == "string") {
		var r = /\\u([\d\w]{4})/gi;
		var x = s.replace (r, function (match, grp) {
		    return String.fromCharCode (parseInt (grp, 16)); 
		});
		x = unescape (x);
		return x;
	};
	return s;
};
// использование Math.round() даст неравномерное распределение!
common.randomInt = function (min, max) {
	return Math.floor (Math.random () * (max - min + 1)) + min;
};
common.getCookies = function (s) {
	if (!s) {
		return {};
	};
	var cookies = s.split (";");
	var cookie = {};
	for (var i = 0; i < cookies.length; i ++) {
		var tokens = cookies [i].split ("=");
		cookie [tokens [0].fulltrim ()] = tokens [1];
	};
	return cookie;
};
String.prototype.trim = function () {return this.replace(/^\s+|\s+$/g, '');};
String.prototype.ltrim = function () {return this.replace(/^\s+/,'');};
String.prototype.rtrim = function () {return this.replace(/\s+$/,'');};
String.prototype.fulltrim = function () {return this.replace(/(?:(?:^|\n)\s+|\s+(?:$|\n))/g,'').replace(/\s+/g,' ');};
common.clone = function (o) {
	if (!o || 'object' !== typeof o)  {
		return o;
	}
	if (typeof (o) == "object" && o && o.getMonth) {
		return new Date (o.getTime ());
	};
	var c = 'function' === typeof o.pop ? [] : {};
	var p, v;
	for (p in o) {
		if (o.hasOwnProperty (p)) {
			v = o [p];
			if (v && 'object' === typeof v) {
				c [p] = common.clone (v);
			} else {
				c [p] = v;
			}
		}
	}
	return c;
};
var logFile = "server.log";
common.log = function (options) {
	if (typeof (options) == "string" || typeof (options) == "number") {
		options = {text: options};
	}
	if (options.file) {
		logFile = options.file;
	}
	if (options.text) {
		var msg = "[" + common.currentDate () + " " + common.currentTime ({msec: true}) + "] " + options.text;
		if (!options.silent) {
			console.log (options.text);
		}
		fs.appendFile (logFile, msg + '\n', function (err) {
			if (err) {
				console.error (err);
			}
		});
	}
};
common.getText = function (opts, cb) {
	process.stdin.setEncoding ("utf8");
	console.log (opts.title);
	process.stdin.on ("data", function (text) {
		text = text.split ("\n").join ("");
		cb (text);
	});
};

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var ifields = {
	tclass: ["fid", "fparent_id", "fname", "fcode", "fdescription", "fformat", "fview_id", "ftype", "fsystem", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tclass_attr: ["fid", "fclass_id", "fname", "fcode", "ftype_id", "forder", "fnot_null", "fvalid_func", "fformat_func", "fdescription", "fsecure", "fmax_str", "fmin_str", "fmax_number", "fmin_number", "fmax_ts", "fmin_ts", "funique", "fformat_number", "fformat_ts", "fremove_rule", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tview: ["fid", "fparent_id", "fname", "fcode", "fdescription", "flayout", "fkey", "fparent_key", "fclass_id", "funrelated", "fquery", "ftype", "fsystem", "fmaterialized", "forder", "fschema_id", "frecord_id", "ficon_cls", "fstart_id", "fend_id"],
	tview_attr: ["fid", "fview_id", "fname", "fcode", "fclass_id", "fclass_attr_id", "fsubject_id", "forder", "fsort_kind", "fsort_order", "foperation", "fvalue", "farea", "fcolumn_width", "ftotal_type", "fread_only", "fgroup", "fnot_null", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	taction: ["fid", "fclass_id", "fname", "fcode", "fdescription", "forder", "fbody", "fconfirm", "flayout", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tobject: ["fid", "fclass_id", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	tobject_attr: ["fid", "fobject_id", "fclass_attr_id", "fstring", "fnumber", "ftime", "fschema_id", "frecord_id", "fstart_id", "fend_id"],
	trevision: ["fid", "fdate", "fdescription", "fschema_id", "frecord_id"],
	tschema: ["fid", "fparent_id", "fname", "fcode"]
};

var Export = function () {
	var storage;
	// Здесь собираются данные для экспорта
	this.data = {};
	// id классов для экспорта
	this.classesId = [];
	// id представлений для экспорта
	this.viewsId = [];
	// Исключения (записи которые не надо экспортировать)
	this.except = {};
	// Идентификатор текущей схемы
	this.currentSchemaId = null;
	// Получить коды всех классов верхнего уровня
	this.getTopClassesCodes = function (options) {
		log.info ({cls: "Export", fn: "getTopClassesCodes"});
		var success = options.success;
		storage.query ({sql: 
			"select\n" +
			"	distinct (a.fid) as fid\n" +
			"from\n" +
			"	tclass a\n" +
			"where\n" +
			"	a.fparent_id is null and a.fid >= 1000\n"
		, success: function (options) {
			var r = options.result.rows;
			var result = [];
			for (var i = 0; i < r.length; i ++) {
				result.push (r [i].fid);
			};
			success (result);
		}});
	}
	// Получить коды всех представлений верхнего уровня
	this.getTopViewsCodes = function (options) {
		log.info ({cls: "Export", fn: "getTopViewsCodes"});
		var success = options.success;
		storage.query ({sql: 
			"select\n" +
			"	distinct (a.fid) as fid\n" +
			"from\n" +
			"	tview a\n" +
			"where\n" +
			"	a.fparent_id is null\n"
		, success: function (options) {
			var r = options.result.rows;
			var result = [];
			for (var i = 0; i < r.length; i ++) {
				result.push (r [i].fid);
			};
			success (result);
		}});
	}
	this.getNodesId = function (options) {
		var me = this;
		var result = [];
		var success = options.success;
		var table = options.table;
		async.mapSeries (options.codes, function (code, cb) {
			var id;
			var whereCondition;
			async.series ([
				function (cb) {
					if (String (typeof (code)).toLowerCase () == "number") {
						id = code;
						cb ();
					} else {
						var s = 
							"select\n" +
							"	distinct (a.fid) as fid\n" +
							"from\n" +
							"	" + table + " a\n" +
							"where\n" +
							"	a.fcode='" + code + "' and a.fparent_id is null\n"
						;
						storage.query ({sql: s, success: function (options) {
							id = options.result.rows [0].fid;
							cb ();
						}});
					};
				},
				function (cb) {
					result.push (id);
					// childsId
					storage.query ({sql:
						"select\n" +
						"	distinct (a.fid) as fid\n" +
						"from\n" +
						"	" + table + " a\n" +
						"where\n" +
						"	a.fparent_id=" + id + "\n" +
						"order by a.fid\n"
					, success: function (options) {
						var r = options.result.rows;
						var childsId = [];
						for (var j = 0; j < r.length; j ++) {
							var childId = r [j].fid;
							childsId.push (childId);
						};
						if (childsId.length) {		
							me.getNodesId ({table: table, codes: childsId, success: function (childs) {
								for (var j = 0; j < childs.length; j ++) {
									result.push (childs [j]);				
								};
								cb ();
							}});
						} else {
							cb ();
						};
					}});
				}
			], function (err, results) {
				cb ();
			});
		}, function (err, results) {
			success (result);
		});
	};
	// Экспорт классов
	this.exportClasses = function (options) {
		log.info ({cls: "Export", fn: "exportClasses"});
		var me = this;
		var success = options.success;
		var codes = me.data.options.classes;
		async.series ([
			function (cb) {
				me.getNodesId ({table: "tclass", codes: codes, success: function (result) {
					me.classesId = result;
					cb ();
				}});
			},
			function (cb) {
				if (me.classesId.length) {
					me.data.tclass = [];
					// data
					storage.query ({sql:
						"select\n" +
						"	" + ifields.tclass.join () + "\n" +
						"from\n" +
						"	tclass a\n" +
						"where\n" +
						"	a.fid in (" + me.classesId.join () + ")\n" +
						"order by\n" +
						"	a.fid, a.fstart_id\n"
					, success: function (options) {
						var data = options.result.rows;
						for (var k = 0; k < data.length; k ++) {
							var values = [];
							for (var j = 0; j < ifields.tclass.length; j ++) {
								var field = ifields.tclass [j];
								var value = data [k][field];
								if (field == "fcode" && !value) {
									throw "exportClasses (): fcode must be not null. FID=" + data [k].fid;
								};
								if (field == "fschema_id" && value == null) {
									value = me.currentSchemaId;
								}
								if (field == "frecord_id" && value == null) {
									value = data [k].fid;
								}
								values.push (value);
							};
							var classObject = {};
							classObject.values = values;
							me.data.tclass.push (classObject);
						}
						cb ();
					}});
				}
			}
		], function (err, results) {
			success ();
		});
	};
	// Экспорт атрибутов класса
	this.exportClassAttrs = function (options) {
		var me = this;
		var success = options.success;
		me.data.tclass_attr = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tclass_attr.join () + "\n" +
			"from\n" +
			"	tclass_attr a\n" +
			"where\n" +
			"	a.fclass_id in (" + me.classesId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			var data = options.result.rows;
			for (var i = 0; i < data.length; i ++) {
				var attr = {};
				attr.values = [];
				for (var j = 0; j < ifields.tclass_attr.length; j ++) {
					var field = ifields.tclass_attr [j];
					var value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					attr.values.push (value);
				};
				me.data.tclass_attr.push (attr);
			};
			success ();
		}});
	}
	// Экспорт действий
	this.exportActions = function (options) {
		var me = this;
		var success = options.success;
		me.data.taction = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.taction.join () + "\n" +
			"from\n" +
			"	taction a\n" +
			"where\n" +
			"	a.fclass_id in (" + me.classesId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			var data = options.result.rows;
			for (var i = 0; i < data.length; i ++) {
				var action = {};
				action.values = [];
				for (var j = 0; j < ifields.taction.length; j ++) {
					var field = ifields.taction [j];
					var value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					action.values.push (value);
				};
				var actionId = data [i].fid;
				me.data.taction.push (action);
			};
			success ();
		}});
	}
	// Экспорт объектов
	this.exportObjects = function (options) {
		var me = this;
		var success = options.success;
		me.data.tobject = [];
		var classes = [];
		if (me.except.tobject && me.except.tobject.fclass_id.length) {
			var except = me.except.tobject.fclass_id;
			for (var i = 0; i < me.classesId.length; i ++) {
				if (except.indexOf (me.classesId [i]) == -1) {
					classes.push (me.classesId [i]);
				}
			}
		} else {
			classes = me.classesId;
		}
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tobject.join () + "\n" +
			"from\n" +
			"	tobject a\n" +
			"where\n" +
			"	a.fclass_id in (" + classes.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			var objects = options.result.rows;
			for (var i = 0; i < objects.length; i ++) {
				var object = {};
				object.values = [];
				var classId;
				for (var j = 0; j < ifields.tobject.length; j ++) {
					var field = ifields.tobject [j];
					var value = objects [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = objects [i].fid;
					}
					object.values.push (value);
				};
				me.data.tobject.push (object);
			};
			success ();
		}});
	}
	// Экспорт атрибутов объектов
	this.exportObjectAttrs = function (options) {
		var me = this;
		var success = options.success;
		me.data.tobject_attr = [];
		var classes = [];
		if (me.except.tobject && me.except.tobject.fclass_id.length) {
			var except = me.except.tobject.fclass_id;
			for (var i = 0; i < me.classesId.length; i ++) {
				if (except.indexOf (me.classesId [i]) == -1) {
					classes.push (me.classesId [i]);
				}
			}
		} else {
			classes = me.classesId;
		}
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tobject_attr.join () + "\n" +
			"from\n" +
			"	tobject_attr a\n" +
			"where\n" +
			"	a.fobject_id in (select b.fid from tobject b where b.fclass_id in (" + classes.join () + "))\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			var objectAttrs = options.result.rows;
			for (var i = 0; i < objectAttrs.length; i ++) {
				var objectAttr = {};
				objectAttr.values = [];
				for (var j = 0; j < ifields.tobject_attr.length; j ++) {
					var field = ifields.tobject_attr [j];
					var value = objectAttrs [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = objectAttrs [i].fid;
					}
					objectAttr.values.push (value);
				};
				me.data.tobject_attr.push (objectAttr);
			}
			success ();
		}});
	}
	// Экспорт представлений
	this.exportViews = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Export", fn: "exportViews"});
		var codes = me.data.options.views;
		me.getNodesId ({table: "tview", codes: codes, success: function (result) {
			me.viewsId = result;
			if (me.viewsId.length) {
				me.data.tview = [];
				// data
				storage.query ({sql:
					"select\n" +
					"	" + ifields.tview.join () + "\n" +
					"from\n" +
					"	tview a\n" +
					"where\n" +
					"	a.fid in (" + me.viewsId.join () + ")\n" +
					"order by\n" +
					"	a.fid, a.fstart_id\n"
				, success: function (options) {
					var data = options.result.rows;
					for (k = 0; k < data.length; k ++) {
						var values = [];
						for (var i = 0; i < ifields.tview.length; i ++) {
							var field = ifields.tview [i];
							var value = data [k][field];
							if (field == "fcode" && !value) {
								throw "exportViews (): fcode must be not null. fid=" + data [k].fid;
							};
							if (field == "fschema_id" && value == null) {
								value = me.currentSchemaId;
							}
							if (field == "frecord_id" && value == null) {
								value = data [k].fid;
							}
							values.push (value);
						};
						var viewObject = {};
						viewObject.values = values;
						me.data.tview.push (viewObject);
					}
					success ();
				}});
			}
		}});
	}
	// Экспорт атрибутов представлений
	this.exportViewAttrs = function (options) {
		var me = this;
		var success = options.success;
		me.data.tview_attr = [];
		storage.query ({sql:
			"select\n" +
			"	" + ifields.tview_attr.join () + "\n" +
			"from\n" +
			"	tview_attr a\n" +
			"where\n" +
			"	a.fview_id in (" + me.viewsId.join () + ")\n" +
			"order by\n" +
			"	a.fid, a.fstart_id\n"
		, success: function (options) {
			var data = options.result.rows;
			for (var i = 0; i < data.length; i ++) {
				var values = [];
				for (var j = 0; j < ifields.tview_attr.length; j ++) {
					var field = ifields.tview_attr [j];
					var value = data [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = data [i].fid;
					}
					values.push (value);
				};
				me.data.tview_attr.push ({values: values});
			}
			success ();
		}});
	}
	// Экспорт ревизий
	this.exportRevisions = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Export", fn: "exportRevisions"});
		storage.query ({sql:
			"select\n" + ifields.trevision.join () + "\n" +
			"from trevision a\n" +
			"order by a.fid\n"
		, success: function (options) {
			var qr = options.result.rows;
			me.data.trevision = [];
			for (var i = 0; i < qr.length; i ++) {
				var values = [];
				for (var j = 0; j < ifields.trevision.length; j ++) {
					var field = ifields.trevision [j];
					var value = qr [i][field];
					if (field == "fschema_id" && value == null) {
						value = me.currentSchemaId;
					}
					if (field == "frecord_id" && value == null) {
						value = qr [i].fid;
					}
					values.push (value);
				};
				var revision = {};
				revision.values = values;
				me.data.trevision.push (revision);
			};
			success ();
		}});
	}
	// Экспорт схем
	this.exportSchemas = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Export", fn: "exportSchemas"});
		storage.query ({sql:
			"select\n" + ifields.tschema.join () + "\n" +
			"from tschema a\n" +
			"order by a.fid\n"
		, success: function (options) {
			var qr = options.result.rows;
			me.data.tschema = [];
			for (var i = 0; i < qr.length; i ++) {
				var values = [];
				for (var j = 0; j < ifields.tschema.length; j ++) {
					var field = ifields.tschema [j];
					var value = qr [i][field];
					values.push (value);
				};
				var schema = {};
				schema.values = values;
				me.data.tschema.push (schema);
			}
			success ();
		}});
	}
	// Подготовить переменные для записей, которые не надо экспортировать
	this.prepareExcept = function (options) {
		var me = this;
		var success = options.success;
		var except = me.data.options.except;
		if (!except) {
			success ();
			return;
		};
		var tables = [];
		for (var table in except) {
			tables.push (table);
		};
		async.mapSeries (tables, function (table, cb) {
			var conditions = except [table];
			var classes = [];
			async.mapSeries (conditions, function (condition, cb) {
				if (condition.fclass_id) {
					function addClass (classId, cb) {
						if (classes.indexOf (classId) == -1) {
							classes.push (classId);
						};
						storage.query ({sql:
							"select\n" +
							"	fid\n" +
							"from\n" +
							"	tclass a\n" +
							"where\n" +
							"	a.fparent_id = " + classId + "\n" +
							"order by\n" +
							"	a.fid, a.fstart_id\n"
						, success: function (options) {
							var data = options.result.rows;
							async.mapSeries (data, function (row, cb) {
								addClass (row.fid, function () {
									cb ();
								});
							}, function (err, results) {
								cb ();
							});
						}});
					};
					if (String (typeof (condition.fclass_id)).toLowerCase () == "object" && condition.fclass_id instanceof Array) {
						// fclass_id: [value1, value2, ...]
						async.mapSeries (condition.fclass_id, function (classId, cb) {
							addClass (storage.getClass (classId).get ("fid"), function () {
								cb ();
							});
						}, function (err, results) {
							cb ();
						});
					} else {
						// fclass_id: value
						addClass (storage.getClass (condition.fclass_id).get ("fid"), function () {
							cb ();	
						});
					}
				}
			}, function (err, results) {
				me.except [table] = {};
				me.except [table].fclass_id = classes;
				cb ();
			});
		}, function (err, results) {
			success ();
		});
	}
	// Установить в null поля TOBJECT_ATTR.FTIME < '01.01.1400'
	this.clearBadTimeFields = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Export", fn: "clearBadTimeFields"});
		var s;
		s = "update tobject_attr set ftime=null\n";
		s += "where ftime<'01.01.1400'\n";
		storage.query ({sql: s, success: function (options) {
			success ();
		}});
	}
	// Правка неправильных ссылок на ревизии
	this.fixReferences = function (options) {
		var me = this;
		var success = options.success;
		storage.query ({sql: "select min (fid) as fid from trevision", success: function (options) {
			var rows = options.result.rows;
			if (rows.length > 0) {
				var minRevision = rows [0].fid;
				var sql = [];
				for (var table in ifields) {
					var fields = ifields [table].join ();
					if (fields.indexOf ("fstart_id") == -1) {
						continue;
					}
					sql.push (
						"update " + table + " set fstart_id=" + minRevision + "\n" +
						"where fstart_id not in (select fid from trevision)\n"
					);
					sql.push (
						"update " + table + " set fend_id=" + minRevision + "\n" +
						"where fend_id <> " + storage.maxRevision + " and fend_id not in (select fid from trevision)\n"
					);
				}
				async.mapSeries (sql, function (s, cb) {
					storage.query ({sql: s, success: function (options) {
						cb ();
					}});
				}, function (err, results) {
					success ();
				});
			}
		}});
	}
	// Создание схемы
	this.createSchema = function (options) {
		var result = null;
		var success = options.success;
		var code = options.code;
		storage.query ({sql: "select fid from tschema where fcode='" + code + "'", success: function (options) {
			var qr = options.result.rows;
			if (qr.length == 0) {
				// Добавление записи в tschema
				var nextId = null;
				storage.query ({sql: "select max (fid) as fid from tschema", success: function (options) {
					var qr = options.result.rows;
					if (qr.length) {
						nextId = qr [0].fid + 1;
					};
					if (nextId == null) {
						nextId = 1;
					};
					storage.query ({sql: "insert into tschema (fid, fcode) values (" + nextId + ",'" + code + "')", success: function (options) {
						result = nextId;
						success (result);
					}});
				}});
			} else {
				result = qr [0].fid;
				success (result);
			}
		}});
	};
	// Экспорт в файл
	this.exportToFile = function (options) {
		/* 
			example: exportToFile ({
				code: "storageCode",
				except: {
					tobject: [{
						fclass_id: ["task.common", "spr.task_history"]
					}]
				}, 
				file: "pm.js"
			});
		*/
		var me = this;
		var success = options.success;
		var timeStart = new Date ().getTime ();
		log.info ({cls: "Export", fn: "exportToFile"});
		me.data.options = options;
		async.series ([
			function (cb) {
				if (options.storage) {
					storage = me.storage = options.storage;
					cb ();
				} else {
					projects.loadConfig ({
						code: options.code, success: function () {
							storage = new Storage ({code: options.code, connection: config.storages [options.code], success: function () {
								me.storageCreated = true;
								cb ();
							}});
						}, failure: function (err) {
							cb (err);
						}
					});
				}
			},
			function (cb) {
				if (options.classes == "all") {
					me.getTopClassesCodes ({success: function (result) {
						options.classes = result;
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				if (options.views == "all") {
					me.getTopViewsCodes ({success: function (result) {
						options.views = result;
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				me.data.fields = ifields;
				me.clearBadTimeFields ({success: function () {
					me.fixReferences ({success: function () {
						me.createSchema ({code: options.code, success: function (result) {
							me.currentSchemaId = result;
							cb ();
						}});
					}});
				}});
			},
			function (cb) {
				me.exportClasses ({success: function () {
				me.exportClassAttrs ({success: function () {
				me.exportActions ({success: function () {
				me.prepareExcept ({success: function () {
				me.exportObjects ({success: function () {
				me.exportObjectAttrs ({success: function () {
				me.exportViews ({success: function () {
				me.exportViewAttrs ({success: function () {
				me.exportSchemas ({success: function () {
				me.exportRevisions ({success: function () {
					cb ();
				}}); }}); }}); }}); }}); }}); }}); }}); }}); }});
			},
			function (cb) {
				me.data = common.unescape (me.data);
				if (options.space) {
					fs.writeFile (options.file, JSON.stringify (me.data, 0, options.space), function (err) {
						cb ();
					});
				} else {
					fs.writeFile (options.file, JSON.stringify (me.data), function (err) {
						cb ();
					});
				};
			}
		], function (err, results) {
			var stat = "";
			for (var table in ifields) {
				if (me.data [table]) {
					stat += table + ": " + me.data [table].length + "\n";
				};
			};
			stat += "queryCount: " + storage.queryCount + "\n";
			stat += "duration: " + (new Date ().getTime () - timeStart) / 1000 + " sec.\n";
			log.info ({cls: "Export", stat: stat});
			if (me.storageCreated) {
				storage.freeResources ();
			};
			success ();
		});
	}
}

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var Import = function () {
	var storage, session;
	// Здесь импортируемые данные
	this.data = {};
	// Добавляет get, чтобы можно было получать значения через названия атрибутов
	this.addGet = function (options) {
		var result = {};
		result.values = options.values;
		result.fields = this.data.fields [options.table];
		result.get = function (field) {			
			for (var i = 0; i < this.fields.length; i ++) {
				if (this.fields [i] == field) {
					break;
				};
			};
			if (i == this.fields.length) {
				throw "get: field '" + field + "'not exists in '" + this.fields.join () + "'";
			};
			return this.values [i];
		};
		return result;
	}
	// Удаляет неактуальные объекты, атрибуты объектов и т.д.
	this.removeTrash = function (options) {
		log.info ({cls: "Import", fn: "removeTrash"});
		var success = options.success;
		async.series ([
			function (cb) {
				// Удалить неактуальные представления
				async.forever (function (cb) {
					// delete
					storage.query ({session: session, sql: 
						"delete from tview a\n" +
						"where\n" +
						storage.getCurrentFilter ({alias: "a"}) + "\n" +
						"and a.fparent_id not in (select b.fid from tview b where " +
						storage.getCurrentFilter ({alias: "b"}) + ")\n"
					, success: function (options) {
						// check
						storage.query ({session: session, sql: 
							"select count (*) as num from tview a\n" +
							"where\n" +
							storage.getCurrentFilter ({alias: "a"}) + "\n" +
							"and a.fparent_id not in (select b.fid from tview b where " +
							storage.getCurrentFilter ({alias: "b"}) + ")\n"
						, success: function (options) {
							var r = options.result.rows;
							if (r [0].num == 0) {
								cb ("end");
							} else {
								cb ();
							};
						}});
					}});
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				// Удалить неактуальные атрибуты представлений
				storage.query ({session: session, sql: 
					"delete from tview_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fview_id not in (select b.fid from tview b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные классы
				async.forever (function (cb) {
					// delete
					storage.query ({session: session, sql: 
						"delete from tclass a\n" +
						"where\n" +
						storage.getCurrentFilter ({alias: "a"}) + "\n" +
						"and a.fparent_id not in (select b.fid from tclass b where " +
						storage.getCurrentFilter ({alias: "b"}) + ")\n"
					, success: function (options) {
						// check
						storage.query ({session: session, sql: 
							"select count (*) as num from tclass a\n" +
							"where\n" +
							storage.getCurrentFilter ({alias: "a"}) + "\n" +
							"and a.fparent_id not in (select b.fid from tclass b where " +
							storage.getCurrentFilter ({alias: "b"}) + ")\n"
						, success: function (options) {
							var r = options.result.rows;
							if (r [0].num == 0) {
								cb ("end");
							} else {
								cb ();
							};
						}});
					}});
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				// Удалить неактуальные атрибуты классов
				storage.query ({session: session, sql: 
					"delete from tclass_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные действия
				storage.query ({session: session, sql: 
					"delete from taction a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные объекты
				storage.query ({session: session, sql: 
					"delete from tobject a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and a.fclass_id not in (select b.fid from tclass b where " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			},
			function (cb) {
				// Удалить неактуальные атрибуты объектов
				storage.query ({session: session, sql: 
					"delete from tobject_attr a\n" +
					"where\n" +
					storage.getCurrentFilter ({alias: "a"}) + "\n" +
					"and not exists (select b.fid from tobject b where b.fid=a.fobject_id and " +
					storage.getCurrentFilter ({alias: "b"}) + ")\n"
				, success: function (options) {
					cb ();
				}});
			}
		], function (err, results) {
			success ();
		});
	};
	// Подготавливает базу для импорта. Удаляет корневые узлы классов, представлений, которые есть в файле импорта
	// Не используется. Нужен в случае если импортируется не схема
	this.prepareStorageForImport = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "prepareStorageForImport"});
		async.series ([
			function (cb) {
				async.eachSeries (me.data.views, function (view, cb) {
					var view = me.addGet ({values: view.values, table: "tview"});
					var code = view.get ("fcode");
					var parentId = view.get ("fparent_id");
					if (parentId == "") {
						storage.query ({session: session, sql: 
							"delete from tview where fparent_id is null and fcode='" + code + "'"
						, success: function (options) {
							cb ();
						}});
					};
				}, function (err) {
					cb ();
				});
			},			
			function (cb) {
				async.eachSeries (me.data.classes, function (cls, cb) {
					var cls = me.addGet ({values: cls.values, table: "tclass"});
					var code = cls.get ("fcode");
					var parentId = cls.get ("fparent_id");
					if (parentId == "") {
						storage.query ({session: session, sql: 
							"delete from tclass where fparent_id is null and fcode='" + code + "'"
						, success: function (options) {
							cb ();
						}});
					};
				}, function (err) {
					cb ();
				});
			},
			function (cb) {
				me.removeTrash ({success: function () {
					cb ();
				}});
			}
		], function (err, results) {
			success ();
		});
	};
	// Счетчики идентификаторов по таблицам
	this.tableId = {};
	// Соответствие schemaId и локальным id
	this.newId = {
		tclass: {}, tclass_attr: {}, tview: {}, tview_attr: {}, taction: {}, taction_attr: {}, tobject: {}, tobject_attr: {}, trevision: {}, tschema: {}
	}
	// Счетчик добавленных записей в таблицах
	this.count = {
		tclass: 0, tclass_attr: 0, tview: 0, tview_attr: 0, taction: 0, taction_attr: 0, tobject: 0, tobject_attr: 0, trevision: 0
	}
	// Тип данных атрибута класса
	this.classAttrType = {};
	// Стартовая ревизия при импорте схемы (обновление схемы)
	this.startRevision = null;
	this.startRevisionMin = null;
	// Получает счетчики по таблицам
	this.getSequences = function (options) {
		var me = this;
		var success = options.success;
		var session = options.session;
		var tables = ["tclass",	"tclass_attr", "tview", "tview_attr", "taction", "taction_attr", "tobject", "tobject_attr", "trevision"];
		async.eachSeries (tables, function (table, cb) {
			storage.client.getNextId ({session: session, table: table, success: function (options) {
				me.tableId [table] = options.id;
				cb ();
			}});
		}, function (err) {
			success ();
		});
	}
	this.updateEngineTables = function (opts, cb) {
		var me = this;
		log.info ({cls: "Import", fn: "updateEngineTables"});
		var session = opts.session;
		var fields = {
			"_class": [
				"fid",
				"fparent_id",
				"fname",
				"fcode",
				"fdescription",
				"fformat",
				"fview_id",
				"fstart_id"
			],
			"_class_attr": [
				"fid",
				"fclass_id",
				//"fclass_code",
				"fname",
				"fcode",
				"fdescription",
				"ftype_id",
				"fnot_null",
				"fsecure",
				"funique",
				"fremove_rule",
				"fstart_id"
			],
			"_view": [
				"fid",
				"fparent_id",
				"fname",
				"fcode",
				"fdescription",
				"flayout",
				"fquery",
				"fstart_id"
			],
			"_object": [
				"fid",
				"fstart_id"
			]
		};
		async.eachSeries (["class", "class_attr", "view", "object"], function (code, cb) {
			async.series ([
				function (cb) {
					storage.query ({session: session, sql: 
						"delete from _" + code
					, success: function (options) {
						cb ();
					}});
				},
				function (cb) {
					var sql =
						"insert into _" + code + " (" + fields ["_" + code].join (",") + ") (\n" +
						"\tselect " + fields ["_" + code].join (",") + " from t" + code + " where fend_id = " + storage.maxRevision + "\n" +
						")\n"
					;
					if (code == "class_attr") {
						sql =
							"insert into _class_attr (" + fields ["_class_attr"].join (",") + ", fclass_code) (\n" +
							"\tselect a." + fields ["_class_attr"].join (",a.") + ",b.fcode from tclass_attr a\n" +
							"\tinner join tclass b on (a.fclass_id = b.fid)\n" +
							"\twhere a.fend_id = " + storage.maxRevision + "\n" +
							")\n"
						;
					};
					if (code == "view") {
						var sql =
							"insert into _view (" + fields ["_view"].join (",") + ") (\n" +
							"\tselect " + fields ["_view"].join (",") + " from tview where fsystem is null and fend_id = " + storage.maxRevision + "\n" +
							")\n"
						;
					};
					storage.query ({session: session, sql: sql, success: function (options) {
						cb ();
					}});
				},
				function (cb) {
					if (code == "object") {
						return cb ();
					};
					var objectsMap = {};
					var _fields = me.data.fields ["t" + code];
					_.each (me.data ["t" + code], function (rec) {
						var o = {};
						for (var i = 0; i < _fields.length; i ++) {
							var field = _fields [i];
							var value = rec.values [i];
							o [field] = value;
						};
						if (o.fend_id != storage.maxRevision) {
							return;
						};
						if (code == "view" && o.fsystem == 1) {
							return;
						};
						objectsMap [o.fid] = objectsMap [o.fid] || o;
						if (o.fstart_id > objectsMap [o.fid].fstart_id) {
							objectsMap [o.fid] = o;
						};
					});
					var objects = [];
					_.each (objectsMap, function (o) {
						objects.push (o);
					});
					async.eachSeries (objects, function (o, cb) {
						var oo = {};
						async.series ([
							function (cb) {
								storage.query ({session: session, sql:
									"delete from _" + code + " where fid = " + o.fid
								, success: function () {
									cb ();
								}});
							},
							function (cb) {
								_.each (fields ["_" + code], function (f) {
									oo [f] = o [f];
								});
								if (code == "class_attr") {
									oo.fclass_code = "tmp";
								};
								oo.fid = me.newId ["t" + code][oo.fid];
								if (oo.fparent_id) {
									oo.fparent_id = me.newId ["t" + code][oo.fparent_id];
								};
								if (oo.fclass_id) {
									oo.fclass_id = me.newId ["tclass"][oo.fclass_id];
								};
								if (oo.fview_id) {
									oo.fview_id = me.newId ["tview"][oo.fview_id];
								};
								if (oo.ftype_id && oo.ftype_id >= 1000) {
									oo.ftype_id = me.newId ["tclass"][oo.ftype_id];
								};
								oo.fstart_id = me.newId ["trevision"][oo.fstart_id];
								cb ();
							},
							function (cb) {
								if (code != "class") {
									return cb ();
								};
								var table = oo.fcode + "_" + oo.fid;
								storage.client.isTableExists ({session: session, table: table, success: function (result) {
									if (result) {
										return cb ();
									};
									storage.query ({session: session, sql: "create table " + table + " (fobject_id bigint)", success: function (options) {
										cb ();
									}});
								}});
							},
							function (cb) {
								if (code != "class_attr") {
									return cb ();
								};
								storage.query ({session: session, sql: "select fcode from _class where fid = " + oo.fclass_id, success: function (opts) {
									if (!opts.result.rows.length) {
										return cb ();
									};
									var table = opts.result.rows [0].fcode + "_" + oo.fclass_id;
									var field = oo.fcode + "_" + oo.fid;
									storage.client.isFieldExists ({session: session, table: table, field: field, success: function (result) {
										if (result) {
											return cb ();
										};
										var columnType = "bigint";
										if (oo.ftype_id == 3) {
											columnType = "timestamp (6)";
										};
										if (oo.ftype_id == 2) {
											columnType = "numeric";
										};
										if (oo.ftype_id == 1 || oo.ftype_id == 5) {
											columnType = "text";
										};
										async.series ([
											function (cb) {
												storage.query ({session: session, sql: "alter table " + table + " add column " + field + " " + columnType, success: function (options) {
													cb ();
												}});
											},
											function (cb) {
												if (o.funique && !storage.connection.dbEngine.uniqueValueIndex) {
													storage.query ({session: session, sql: "create unique index " + table + "_" + field + "_unique on " + table + " (" + field + ")", success: function (options) {
														cb ();
													}});
												} else {
													if (oo.ftype_id == 12 || oo.ftype_id >= 1000 || (o.fformat_func && o.fformat_func.indexOf ('"index"') > 0)) {
														storage.query ({session: session, sql: "create index " + table + "_" + field + " on " + table + " (" + field + ")", success: function (options) {
															cb ();
														}});
													} else {
														cb ();
													};
												};
											}
										], cb);
									}});
								}});
							},
							function (cb) {
								var sql = me.generateInsert ({table: "_" + code, fields: oo});
								storage.query ({session: session, sql: sql, success: function (options) {
									cb ();
								}});
							}
						], cb);
					}, cb);
				},
				function (cb) {
					storage.query ({session: session, sql:
						"select " + fields._class.join (",") + " from _class order by fcode"
					, success: function (opts) {
						fs.writeFileSync ("c-schema.txt", JSON.stringify (me.data ["tclass"], null, "\t"));
						fs.writeFile ("c-db.txt", JSON.stringify (opts.result.rows, null, "\t"), cb);
					}});
				}
			], cb);
		}, function (err) {
			cb (err);
		});
	};
	// Генерация insert запроса
	this.generateInsert = function (options) {
	    var fields = [];
	    var values = "";
	    for (var key in options.fields) {
			fields.push (key);
			if (values) {
				values += ",";
			};
			if (options.fields [key] != null) {
				var value = options.fields [key];
				if (typeof (value) == "string") {
					if (value.length == 24 && value [10] == "T" && value [23] == "Z") { // 2012-08-20T13:17:48.456Z
						value = "'" + common.getUTCTimestamp (new Date (value)) + "'";
					} else {
						value = common.ToSQLString (value, storage.client.database);
						if (storage.client.database == "postgres") {
							value = "E" + value;
						};
					};
				} else
				if (typeof (value) == "object" && value.getMonth) {
					value = "'" + common.getUTCTimestamp (value) + "'";
				}
				values += value;
			} else {
				values += "null";
			};
	    };
	    var s;
	    s = "insert into " + options.table + "(\n";
	    s += fields.join ();
	    s += "\n) values (\n";		    
	    s += values;
	    s += "\n)\n";
	    return s;
	}
	this.incCount = function (table, id) {
		this.count [table] ++;
		// todo: update storage.revision for clear cache
	};
	// Импорт представлений
	this.importViews = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importViews"});
		var viewFields = me.data.fields.tview;
		async.eachSeries (me.data.tview, function (view, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			for (var i = 0; i < viewFields.length; i ++) {
				var field = viewFields [i];
				var value = view.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fparent_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tview set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tview", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				var s = me.generateInsert ({table: "tview", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tview", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов представлений
	this.importViewAttrs = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importViewAttrs"});
		var s;
		var viewAttrFields = me.data.fields.tview_attr;
		async.eachSeries (me.data.tview_attr, function (viewAttr, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			for (var i = 0; i < viewAttrFields.length; i ++) {
				var field = viewAttrFields [i];
				var value = viewAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tview_attr"][value];
					} else
					if (field == "fview_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fclass_attr_id") {
						value = me.newId ["tclass_attr"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tview_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tview_attr", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				s = me.generateInsert ({table: "tview_attr", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tview_attr", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт классов
	this.importClasses = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importClasses"});
		var classFields = me.data.fields.tclass;
		async.eachSeries (me.data.tclass, function (cls, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			for (var i = 0; i < classFields.length; i ++) {
				var field = classFields [i];
				var value = cls.values [i]; 
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fparent_id") {
						// TODO: Надо учесть случай когда парент класс еще не импортировался
						value = me.newId ["tclass"][value];
					} else
					if (field == "fview_id") {
						value = me.newId ["tview"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					};
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tclass set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tclass", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				s = me.generateInsert ({table: "tclass", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tclass", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов классов
	this.importClassAttrs = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importClassAttrs"});
		var classAttrFields = me.data.fields.tclass_attr;
		async.eachSeries (me.data.tclass_attr, function (classAttr, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			for (var i = 0; i < classAttrFields.length; i ++) {
				var field = classAttrFields [i];
				var value = classAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tclass_attr"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "ftype_id") {
						var typeId = value;
						if (typeId >= 1000) {
							var id = me.newId ["tclass"][typeId];
							value = id;
							me.classAttrType [fields ["fid"]] = id;
						} else {
							me.classAttrType [fields ["fid"]] = typeId;
						};
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update tclass_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("tclass_attr", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				s = me.generateInsert ({table: "tclass_attr", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("tclass_attr", fields ["fid"]);
					cb ();
				}});
			}
		})}, function (err) {
			success ();
		});
	};
	// Импорт действий
	this.importActions = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importActions"});
		var actionFields = me.data.fields.taction;
		async.eachSeries (me.data.taction, function (action, cb) {process.nextTick (function () {
			var fields = [];
			var schemaId;
			for (var i = 0; i < actionFields.length; i ++) {
				var field = actionFields [i];
				var value = action.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["taction"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					}
				};
				fields [field] = value;
			};
			if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
				// Запись удалена
				if (me.startRevision [schemaId] != null && 
					fields ["fend_id"] != storage.maxRevision && 
					fields ["fend_id"] >= me.startRevision [schemaId] &&
					fields ["fid"] !== undefined // Например когда запись одна и она удалена
				) {
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					storage.query ({session: session, sql: 
						"update taction set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
					, success: function (options) {
						me.incCount ("taction", fields ["fid"]);
						cb ();
					}});
				} else {
					cb ();
				};
			} else {
				fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
				fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
				s = me.generateInsert ({table: "taction", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("taction", fields ["fid"]);
					cb ();
				}});
			};
		})}, function (err) {
			success ();
		});
	};
	// Импорт объектов
	this.importObjects = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importObjects"});
		var objectFields = me.data.fields.tobject;
		var count = 0;
		async.eachSeries (me.data.tobject, function (object, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			for (var i = 0; i < objectFields.length; i ++) {
				var field = objectFields [i];
				var value = object.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tobject"][value];
					} else
					if (field == "fclass_id") {
						value = me.newId ["tclass"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					};
				};
				fields [field] = value;
			};
			if (fields ["fclass_id"] != "0") {
				if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
					// Запись удалена
					if (me.startRevision [schemaId] != null && 
						fields ["fend_id"] != storage.maxRevision && 
						fields ["fend_id"] >= me.startRevision [schemaId] &&
						fields ["fid"] !== undefined // Например когда запись одна и она удалена
					) {
						fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
						storage.query ({session: session, sql: 
							"update tobject set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
						, success: function (options) {
							me.incCount ("tobject", fields ["fid"]);
							cb ();
						}});
					} else {
						cb ();
					};
				} else {
					fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					s = me.generateInsert ({table: "tobject", fields: fields});
					storage.query ({session: session, sql: s, success: function (options) {
						me.incCount ("tobject", fields ["fid"]);
						// count
						count ++;
						if (count % 10000 == 0) {
							log.info ({cls: "Import"}, "\t" + count + " records");
						};
						cb ();
					}});
				};
			};	
		})}, function (err) {
			success ();
		});
	};
	// Импорт атрибутов объектов
	this.importObjectAttrs = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importObjectAttrs"});
		var objectAttrFields = me.data.fields.tobject_attr;
		var count = 0;
		async.eachSeries (me.data.tobject_attr, function (objectAttr, cb) {process.nextTick (function () {
			var fields = {};
			var schemaId;
			var typeId = 0;
			for (var i = 0; i < objectAttrFields.length; i ++) {
				var field = objectAttrFields [i];
				var value = objectAttr.values [i];
				if (value != null) {
					if (field == "fid") {
						value = me.newId ["tobject_attr"][value];
					} else
					if (field == "fclass_attr_id") {
						var classAttrId = me.newId ["tclass_attr"][value];
						value = classAttrId;
						typeId = me.classAttrType [classAttrId];
					} else
					if (field == "fobject_id") {
						value = me.newId ["tobject"][value];
					} else
					if (field == "fschema_id") {
						schemaId = value;
						value = me.newId ["tschema"][value];
					} else
					if (field == "fnumber") {
						if (typeId >= 1000 || typeId == 12) {
							value = me.newId ["tobject"][value];
						};
						if (typeId == 6) {
							value = me.newId ["tclass"][value];
						};
						if (typeId == 7) {
							value = me.newId ["tclass_attr"][value];
						};
						if (typeId == 8) {
							value = me.newId ["tview"][value];
						};
						if (typeId == 9) {
							value = me.newId ["tview_attr"][value];
						};
						if (typeId == 10) {
							value = me.newId ["taction"][value];
						};
						if (typeId == 11) {
							value = me.newId ["taction_attr"][value];
						};
						if (typeId == 13) {
							value = me.newId ["tobject_attr"][value];
						};
					} else
					if (field != "fstart_id" && field != "fend_id") {
						if (value == undefined) {
							// Ссылка на неактуальный объект
							value = null;
						}
					}
				}
				fields [field] = value;
			};
			if (typeId) {
				if (me.startRevision [schemaId] == null || fields ["fstart_id"] < me.startRevision [schemaId]) {
					// Запись удалена
					if (me.startRevision [schemaId] != null && 
						fields ["fend_id"] != storage.maxRevision && 
						fields ["fend_id"] >= me.startRevision [schemaId] &&
						fields ["fid"] !== undefined // Например когда запись одна и она удалена
					) {
						fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
						storage.query ({session: session, sql: 
							"update tobject_attr set fend_id = " + fields ["fend_id"] + " where fid = " + fields ["fid"] + " and fend_id=" + storage.maxRevision
						, success: function (options) {
							me.incCount ("tobject_attr", fields ["fid"]);
							cb ();
						}});
					} else {
						cb ();
					};
				} else {
					fields ["fstart_id"] = me.newId ["trevision"][fields ["fstart_id"]];
					fields ["fend_id"] = me.newId ["trevision"][fields ["fend_id"]];
					if (storage.client.database == "mssql" && fields.ftime) {
						fields.ftime = new Date (fields.ftime);
					};
					s = me.generateInsert ({table: "tobject_attr", fields: fields});
					storage.query ({session: session, sql: s, success: function (options) {
						me.incCount ("tobject_attr", fields ["fid"]);
						// count
						count ++;
						if (count % 10000 == 0) {
							log.info ({cls: "Import"}, "\t" + count + " records");
						};
						cb ();
					}});
				};
			} else {
				cb ();
			};
		})}, function (err) {
			success ();
		});
	};
	// Создание схемы
	this.createSchema = function (options) {
		var result = null;
		var success = options.success;
		var schemaCode = options.code;
		storage.query ({session: session, sql: "select fid from tschema where fcode='" + schemaCode + "'", success: function (options) {
			var qr = options.result.rows;
			if (qr.length == 0) {
				// Добавление записи в tschema
				var nextId = null;
				storage.query ({session: session, sql: "select max (fid) as fid from tschema", success: function (options) {
					var qr = options.result.rows;
					if (qr.length) {
						nextId = qr [0].fid + 1;
					};
					if (nextId == null) {
						nextId = 1;
					};
					storage.query ({session: session, sql: "insert into tschema (fid, fcode) values (" + nextId + ",'" + schemaCode + "')", success: function (options) {
						result = nextId;
						success (result);
					}});
				}});
			} else {
				result = qr [0].fid;
				success (result);
			}
		}});
	}
	// Получение идентификатора схемы
	this.getSchemaId = function (options) {
		var me = this;
		var success = options.success;
		if (!options || !options.code) {
			throw "schema.getId (): options.code must be defined";
		}
		var result = null;
		storage.query ({session: session, sql: "select fid from tschema where fcode='" + options.code + "'", success: function (options) {
			var r = options.result.rows;
			if (r.length > 0) {
				result = r [0].fid;
				success (result);
			} else {
				success (null);
			};
		}});
	}
	// TODO: Получение карты соответствия schemaId, recordId и localId
	this.getNewId = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "getNewId"});
		async.eachSeries (me.data.tschema, function (schema, cb) {
			me.getSchemaId ({code: schema.values [3], success: function (schemaId) {
				if (schemaId == null) {
					cb ();
				} else {
					var tables = [];
					for (var table in ifields) {
						tables.push (table);
					};
					async.eachSeries (tables, function (table, cb) {
						var schemaColId = ifields [table].indexOf ("fschema_id");
						var recordColId = ifields [table].indexOf ("frecord_id");
						if (schemaColId == -1) {
							cb ();
						} else {
							storage.query ({session: session, sql: "select distinct (frecord_id) as frecord_id, fid from " + table + " where frecord_id is not null and fschema_id=" + schemaId, success: function (options) {
								var qr = options.result.rows;
								var data = me.data [table];
								for (var j = 0; j < qr.length; j ++) {
									var recordId = qr [j].frecord_id;
									for (var k = 0; k < data.length; k ++) {
										if (schema.values [0] != data [k].values [schemaColId]) {
											continue;
										}
										if (recordId != data [k].values [recordColId]) {
											continue;
										}
										me.newId [table] [data [k].values [0]] = qr [j].fid;
									}
								}
								cb ();
							}});
						};
					}, function (err) {
						cb ();
					});
				};
			}});
		}, function (err) {
			success ();
		});
	}
	// Импорт ревизий
	this.importRevisions = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importRevisions"});
		var revisionFields = me.data.fields.trevision;
		var schemaColId = revisionFields.indexOf ("fschema_id");
		async.eachSeries (me.data.trevision, function (revision, cb) {
			process.nextTick (function () {
				var schemaId = revision.values [schemaColId];
				// Эта ревизия уже есть
				if (me.newId ["trevision"][revision.values [0]]) {
					cb ();
					return;
				}
				if (!me.startRevision [schemaId]) {
					me.startRevision [schemaId] = revision.values [0];
					if (!me.startRevisionMin || me.startRevisionMin > me.startRevision [schemaId]) {
						me.startRevisionMin = me.startRevision [schemaId];
					}
					log.info ({cls: "Import"}, "startRevision [" + schemaId + "] = " + revision.values [0] + " ");
				}
				var fields = {};
				var id;
				for (var i = 0; i < revisionFields.length; i ++) {
					var field = revisionFields [i];
					var value = revision.values [i]; 
					if (value != null) {
						if (field == "fid") {
							id = value;
							value = me.tableId ["trevision"];
						} else
						if (field == "fschema_id") {
							value = me.newId ["tschema"][value];
						}
					}
					fields [field] = value;
				};
				if (storage.client.database == "mssql" && fields.fdate) {
					fields.fdate = new Date (fields.fdate);
				};
				s = me.generateInsert ({table: "trevision", fields: fields});
				storage.query ({session: session, sql: s, success: function (options) {
					me.incCount ("trevision", fields ["fid"]);
					me.newId ["trevision"][id] = me.tableId ["trevision"];
					me.tableId ["trevision"] ++;
					cb ();
				}});
			});
		}, function (err) {
			me.newId ["trevision"][storage.maxRevision] = storage.maxRevision;
			success ();
		});
	};
	// Импорт схем
	this.importSchemas = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "importSchemas"});
		var schemaFields = me.data.fields.tschema;
		this.startRevision = {};
		async.eachSeries (me.data.tschema, function (schema, cb) {
			me.startRevision [schema.values [0]] = null;
			for (var i = 0; i < schemaFields.length; i ++) {
				var field = schemaFields [i];
				var value = schema.values [i]; 
				if (value != null && field == "fcode") {
					me.createSchema ({code: value, success: function (schemaId) {
						me.newId ["tschema"][schema.values [0]] = schemaId;
						cb ();
					}});
					break;
				}
			};
		}, function (err) {
			success ();
		});
	}
	// Генерация идентификаторов для создаваемых объектов
	this.generateNewId = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "generateNewId"});
		var tables = ["tclass", "tclass_attr", "tview", "tview_attr", "taction", "taction_attr", "tobject", "tobject_attr"];
		for (var j = 0; j < tables.length; j ++) {
			var t = tables [j];
			if (!me.data [t]) {
				continue;
			}
			for (var i = 0; i < me.data [t].length; i ++) {
				var fields = {};
				for (var k = 0; k < me.data.fields [t].length; k ++) {
					var field = me.data.fields [t][k];
					var value = me.data [t][i].values [k]; 
					fields [field] = value;
				};
				if (me.schema && (me.startRevision [fields ["fschema_id"]] == null || fields ["fstart_id"] < me.startRevision [fields ["fschema_id"]])) {
					continue;
				}
				if (!me.newId [t][fields ["fid"]]) {
					me.newId [t][fields ["fid"]] = me.tableId [t];
					me.tableId [t] ++;
				}
			}
		}
		success ();
	};
	// Удалить таблицу
	this.removeTOC = function (options) {
		var me = this;
		var success = options.success;
		var session = options.session;
		if (options.storage) {
			storage = options.storage;
		};
		log.info ({cls: "Import", fn: "removeTOC"});
		var s = "select c.fid from tclass c\n";
		s += "where c.fid >= 1000 and " + storage.getCurrentFilter ({alias: "c"}) + "\n";
		if (options && options.classId) {
			s += "and c.fid=" + options.classId + "\n";
		};
		s += "order by c.fid\n";
		storage.query ({session: session, sql: s, success: function (options) {
			var classes = options.result.rows;
			async.eachSeries (classes, function (cls, cb) {
				var name = storage.getClass (cls.fid).toc;
				storage.client.isTableExists ({session: session, table: name, success: function (result) {
					if (result) {
						var s;
						if (storage.client.database == "mssql") {
							s = "drop table " + name + "\n";
						} else {
							s = "drop table " + name + " cascade\n";
						};
						storage.query ({session: session, sql: s, success: function (options) {
							cb ();
						}});
					} else {
						cb ();
					};
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Убирает лишние экземпляры объектов
	this.removeObjectDuplicates = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "removeObjectDuplicates"});
		storage.query ({session: session, sql:
			"select count (*), o.fid from tobject o\n" +
			"where " + storage.getCurrentFilter ({alias: "o"}) + "\n" +
			"group by o.fid\n" +
			"having count (*) > 1\n"
		, success: function (options) {
			var objects = options.result.rows;
			async.eachSeries (objects, function (object, cb) {
				var objectId = object.fid;
				storage.query ({session: session, sql:
					"select o.fstart_id from tobject o\n" +
					"where o.fid=" + objectId + " and " + storage.getCurrentFilter ({alias: "o"}) + "\n" +
					"order by o.fstart_id desc\n"
				, success: function (options) {
					var dubs = options.result.rows;
					dubs.splice (0, 1);
					async.eachSeries (dubs, function (dub, cb) {
						storage.query ({session: session, sql:
							"update tobject set fend_id=fstart_id\n" +
							"where fid=" + objectId + " and fstart_id=" + dub.fstart_id
						, success: function (options) {
							cb ();
						}});
					}, function (err) {
						cb ();
					});
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Убирает лишние экземпляры атрибутов
	this.removeObjectAttrDuplicates = function (options) {
		var me = this;
		var success = options.success;
		log.info ({cls: "Import", fn: "removeObjectAttrDuplicates"});
		storage.query ({session: session, sql:
			"select oa.fclass_attr_id, oa.fobject_id from tobject_attr oa\n" +
			"where " + storage.getCurrentFilter ({alias: "oa"}) + "\n" +
			"group by oa.fclass_attr_id, oa.fobject_id\n" +
			"having count (*) > 1\n"
		, success: function (options) {
			var objects = options.result.rows;
			async.eachSeries (objects, function (object, cb) {
				var classAttrId = object.fclass_attr_id;
				var objectId = object.fobject_id;
				// classAttrId, objectId
				storage.query ({session: session, sql:
					"select oa.fid from tobject_attr oa\n" +
					"where oa.fclass_attr_id=" + classAttrId + " and oa.fobject_id=" + objectId + " and " + storage.getCurrentFilter ({alias: "oa"}) + "\n" +
					"order by oa.FSTART_ID desc\n"
				, success: function (options) {
					var attrs = options.result.rows;
					attrs.splice (0, 1); // 2015-12-15
					async.eachSeries (attrs, function (attr, cb) {
						storage.query ({session: session, sql:
							"update tobject_attr set fend_id=fstart_id\n" +
							"where fid=" + attr.fid
						, success: function (options) {
							cb ();
						}});
					}, function (err) {
						cb ();
					});
				}});
			}, function (err) {
				success ();
			});
		}});
	};
	// Получение списка дочерних записей
	this.getChilds = function (options) {
		var me = this;
		var success = options.success;
		var meOptions = options;
		storage.query ({session: session, sql:
			"select fid from " + options.table + " where fparent_id " +
			(options.parentId ? ("= " + options.parentId) : "is null") + " and " +
			storage.getCurrentFilter ()
		, success: function (options) {
			var qr = options.result.rows;
			if (!meOptions.childs) {
				meOptions.childs = [];
			};
			async.eachSeries (qr, function (row, cb) {
				meOptions.childs.push (row.fid);
				me.getChilds ({table: meOptions.table, parentId: row.fid, childs: meOptions.childs, success: function (result) {
					cb ();
				}});
			}, function (err) {
				success (meOptions.childs);
			});
		}});
	}
	// Создать таблицу
	this.createTOC = function (options) {
		var me = this;
		var success = options.success;
		if (options.storage) {
			storage = options.storage;
		};
		log.info ({cls: "Import", fn: "createTOC"});
		var classes;
		async.series ([
			function (cb) {
				me.removeObjectAttrDuplicates ({success: function () {
					me.removeObjectDuplicates ({success: function () {
						cb ();						
					}});
				}});
			},
			function (cb) {
				var s;
				s = "select\n";
				s += "	" + ifields.tclass + "\n";
				s += "from\n";
				s += "	tclass\n";
				s += "where\n";
				s += "	" + storage.getCurrentFilter () + "\n";
				if (options && options.classId) {
					s += "and fid=" + options.classId + "\n";
				};
				s += "and fid >= 1000\n";
				s += "order by fid\n";
				storage.query ({session: session, sql: s, success: function (options) {
					classes = options.result.rows;
					cb ();
				}});
			},
			function (cb) {
				async.eachSeries (classes, function (cls, cb) {
					var classId = cls.fid;
					var tocName = storage.getClass (classId).toc;
					if (tocName.toLowerCase ().substring (0, 5) == "view_") {
						cb ();
						return;
					};
					storage.client.isTableExists ({session: session, table: tocName, success: function (result) {
						if (result) {
							cb ();
							return;
						};
						var sqlInsert = "insert into " + tocName + " (fobject_id";
						var sqlSelect = "select o.fid";
						var sqlJoin = "";
						var classAttrs;
						var classChilds = [];
						async.series ([
							function (cb) {
								log.info ({cls: "Import"}, "Creating toc for class '" + cls.fcode + "' [" + classId + "] ...");
								if (storage.client.database == "mssql") {
									storage.query ({session: session, sql: "create table " + tocName + " (fobject_id bigint primary key clustered)", success: function (options) {
										cb ();
									}});
								} else {
									var s = "create table " + tocName + " (fobject_id bigint not null, primary key (fobject_id))";
									if (storage.client.version >= 91 && config.storages [storage.code] && config.storages [storage.code].unlogged) {
										s = "create unlogged table " + tocName + " (fobject_id bigint not null, primary key (fobject_id))";
									};
									storage.query ({session: session, sql: s, success: function () {
										cb ();
									}});
								};
							},
							function (cb) {
								classChilds.push (classId);
								me.getChilds ({table: "tclass", parentId: classId, childs: classChilds, success: function (result) {
									classChilds = result;	
									storage.query ({session: session, sql:
										"select\n" +
										"	" + ifields.tclass_attr + "\n" +
										"from\n" +
										"	tclass_attr ca\n" +
										"where\n" +
										"	ca.fclass_id = " + classId + " and\n" +
										"	" + storage.getCurrentFilter ({alias: "ca"}) + "\n" +
										"order by ca.fid\n"
									, success: function (options) {
										classAttrs = options.result.rows;
										cb ();
									}});
								}});
							},
							function (cb) {
								async.eachSeries (classAttrs, function (classAttr, cb) {
									var classAttrId = classAttr.fid;
									var opts = {};
									try {
										opts = JSON.parse (classAttr.fformat_func) || {};
									} catch (e) {
									}
									var hasRownumColumn;
									var type = "$tnumber$";
									var ftype = "fnumber";	    
									switch (classAttr.ftype_id) {
										case 2:
											type = "$tnumber_value$";
										break;
										case 1:
										case 5:
											type = "$ttext$";
											ftype = "fstring";
										break;
										case 3:
											type = "$ttimestamp$";
											ftype = "ftime";
										break;
									};
									var tocFieldName = storage.getClassAttr (classAttrId).toc;
									var s = "alter table " + tocName + " add column " + tocFieldName + " " + type;
									if (storage.client.database == "mssql") {
										s = "alter table " + tocName + " add " + tocFieldName + " " + type;
									};
									storage.query ({session: session, sql: s, success: function () {
										sqlInsert += ", " + tocFieldName;
										sqlSelect += ", oa" + classAttrId + "." + ftype;
										sqlJoin += "left join tobject_attr oa" + classAttrId + " on (oa" + classAttrId + ".fobject_id = o.fid and oa" + classAttrId + ".fclass_attr_id = " + classAttrId + " and " + storage.getCurrentFilter ({alias: "oa" + classAttrId}) + ")\n";
										if (classAttr.ftype_id == 12 || classAttr.ftype_id >= 1000 || classAttr.funique || opts.index) {
											log.info ({cls: "Import"}, "created index for class_attr: " + classAttr.fcode);
											var s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (" + tocFieldName + ")";
											if (classAttr.funique && storage.client.database == "mssql" && ftype == "fstring") {
												s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (fobject_id) include (" + tocFieldName + ")";
											};
											storage.query ({session: session, sql: s, success: function () {
												cb ();
											}});
										} else {
											if (config.index && config.index.text_pattern_ops && classAttr.ftype_id == 1 && storage.client.database == "postgres") {
												log.info ({cls: "Import"}, "created text index for class_attr: " + classAttr.fcode);
												var s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (" + tocFieldName + " text_pattern_ops)";
												storage.query ({session: session, sql: s, success: function () {
													cb ();
												}});
											} else
											if (config.index && config.index.substr && classAttr.ftype_id == 1 && storage.client.database == "postgres") {
												log.info ({cls: "Import"}, "created text index for class_attr: " + classAttr.fcode);
												var s = "create index " + tocName + "_" + tocFieldName + " on $schema_prefix$" + tocName + " (substr (" + tocFieldName + ", 1, 1024))";
												storage.query ({session: session, sql: s, success: function () {
													cb ();
												}});
											} else {
												cb ();
											};
										};
									}});
								}, function (err) {
									cb ();
								});
							},
							function (cb) {
								log.info ({cls: "Import"}, "Inserting toc data for class '" + cls.fcode + "' [" + classId + "] ...");
								sqlInsert = sqlInsert + ")\n" + sqlSelect + " from $schema_prefix$tobject o\n" + sqlJoin;
								sqlInsert += "where	o.fclass_id in (" + classChilds.join () + ") and " + storage.getCurrentFilter ({alias: "o"}) + "\n";
								sqlInsert += "order by o.fid\n";
								storage.query ({session: session, sql: sqlInsert, success: function () {
									cb ();
								}});
							}
						], function (err, results) {
							cb ();
						});
					}});
				}, function (err) {
					cb ();
				});
			}
		], function (err, results) {
			success ();
		});
	};
	// Импорт из файла
	// example: importFromFile ({file: "pm.js"})
	this.importFromFile = function (options) {
		var me = this;
		var success = options.success;
		session = {
			id: "import_" + options.code,
			username: "admin",
			userId: null
		};
		log.info ({cls: "Import", fn: "importFromFile"});
		async.series ([
			function (cb) {
				fs.exists (options.file, function (exists) {
					if (exists) {
						fs.readFile (options.file, function (err, fileText) {
							me.data = JSON.parse (fileText);
							cb ();
						});
					} else {
						cb ("file not exists.");
					};
				});
			},
			function (cb) {
				if (options.storage) {
					storage = me.storage = options.storage;
					cb ();
				} else {
					projects.loadConfig ({
						code: options.code, success: function () {
							storage = new Storage ({code: options.code, connection: config.storages [options.code], success: function () {
								me.storageCreated = true;
								cb ();
							}});
						}, failure: function (err) {
							cb (err);
						}
					});
				}
			},
			function (cb) {
				storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "import_" + options.code, success: function () {
					cb ();
				}, failure: function (options) {
					cb (options.error);
				}});
			},
			function (cb) {
				me.getSequences ({session: session, success: function () {
					cb ();
				}});
			},
			function (cb) {
				storage.query ({session: session, sql: "select fcode from tschema", success: function (options) {
					var r = options.result.rows;
					for (var i = 0; i < r.length; i ++) {
						if (!r [i].fcode || r [i].fcode == "undefined") {
							cb ("Schema undefined.");
							return;
						};
					};
					cb ();
				}});
			},
			function (cb) {
				me.count.tclass = 0;
				me.count.tclass_attr = 0;
				me.count.tview = 0;
				me.count.tview_attr = 0;
				me.count.taction = 0;
				me.count.taction_attr = 0;
				me.count.tobject = 0;
				me.count.tobject_attr = 0;
				me.count.trevision = 0;
				async.series ([
					function (cb) {
						me.getNewId ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importSchemas ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importRevisions ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.generateNewId ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
							me.updateEngineTables ({session: session}, function () {
								cb ();
							});
						} else {
							cb ();
						};
					},
					function (cb) {
						me.importViews ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importViewAttrs ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importClasses ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importClassAttrs ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importActions ({success: function () {
							cb ();
						}});
					},
					function (cb) {
						me.importObjects ({success: function () {
							cb ();
						}});
					}
				], cb);
				/*
				me.getNewId ({success: function () {
				me.importSchemas ({success: function () {
				me.importRevisions ({success: function () {
				me.generateNewId ({success: function () {
				me.importViews ({success: function () {
				me.importViewAttrs ({success: function () {
				me.importClasses ({success: function () {
				me.importClassAttrs ({success: function () {
				me.importActions ({success: function () {
				me.importObjects ({success: function () {
					cb ();
				}}); }}); }}); }}); }}); }}); }}); }}); }}); }});
				*/
			},
			function (cb) {
				if (storage.client.database == "mssql") {
					storage.query ({session: session, sql: "set identity_insert tobject_attr on", success: function (options) {
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
					storage.query ({session: session, sql:
						"create trigger tobject_attr_after_insert\n" +
						"after insert on tobject_attr for each row \n" +
						"execute procedure trigger_tobject_attr_after_insert ();\n"
					, success: function (options) {
						cb ();
					}});

				} else {
					cb ();
				};
			},
			function (cb) {
				me.importObjectAttrs ({success: function () {
					cb ();
				}});
			},
			function (cb) {
				if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
					storage.query ({session: session, sql:
						"drop trigger tobject_attr_after_insert on tobject_attr"
					, success: function (options) {
						cb ();
					}});

				} else {
					cb ();
				};
			},
			function (cb) {
				if (storage.client.database == "mssql") {
					storage.query ({session: session, sql: "set identity_insert tobject_attr off", success: function (options) {
						cb ();
					}});
				} else {
					cb ();
				};
			},
			function (cb) {
				storage.commitTransaction ({session: session, success: function () {
					cb ();
				}});
			},
			function (cb) {
				storage.client.updateSequences ({success: function () {
					cb ();
				}});
			},
			function (cb) {
				log.info ({cls: "Import"}, "records count:\n" + JSON.stringify (me.count, 0, "\t"));
				// Перестроить токи
				if (!options.keepToc && (me.count.tclass || me.count.tclass_attr || me.count.tobject || me.count.tobject_attr)) {
					async.series ([
						function (cb) {
							storage.initClasses ({success: function () {
								cb ();
							}});
						},
						function (cb) {
							storage.initClassAttrs ({success: function () {
								cb ();
							}});
						},
						function (cb) {
							storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "import_" + options.code, success: function () {
								cb ();
							}});
						},
						function (cb) {
							if (!storage.connection.dbEngine || (storage.connection.dbEngine && !storage.connection.dbEngine.enabled)) {
								me.removeTOC ({success: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						},
						function (cb) {
							if (!storage.connection.dbEngine || (storage.connection.dbEngine && !storage.connection.dbEngine.enabled)) {
								me.createTOC ({success: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						},
						function (cb) {
							storage.commitTransaction ({session: session, success: function () {
								cb ();
							}});
						}
					], function (err) {
						cb ();
					});
				} else {
					cb ();
				};
			},
			function (cb) {
				var redisClient = redis.createClient (config.redis.port, config.redis.host);
				redisClient.del (options.code + "-requests");
				redisClient.del (options.code + "-objects");
				redisClient.keys ("*-content", function (err, result) {
					for (var i = 0; i < result.length; i ++) {
						redisClient.del (result [i]);
					}
				});
				redisClient.keys ("*-clschange", function (err, result) {
					for (var i = 0; i < result.length; i ++) {
						redisClient.del (result [i]);
					}
				});
				cb ();
			}
		], function (err, results) {
			if (err) {
				log.info ({cls: "Import", error: err});
				if (storage) {
					storage.rollbackTransaction ({session: session, success: function () {
						success ();
					}});
				} else {
					success ();
				};
			} else {
				success ();
			};
			if (me.storageCreated) {
				storage.freeResources ();
			};
			if (!options.noExit) {
				process.exit (1);
			};
		});
	}
};

var smtpTransport = nodemailer.createTransport ("SMTP", config.mail.smtp);
var mailSender = {
	smtpTransport: {}
};
mailSender.send = function (options) {
	var success = options.success;
	var failure = options.failure;
	var storage = options.session ? options.session.storage : null;
	if (_.has (config.mail, "enabled") && !config.mail.enabled) {
		if (success) {
			success ();
		}
		return;
	}
	var st = smtpTransport;
	var dstHost = options.to.split ("@")[1];
	if (storage && storage.config.smtp && storage.config.smtp.host) {
		options.from = storage.config.smtp.sender || options.from;
		if (!mailSender.smtpTransport [storage.code]) {
			var smtpCfg = {
				host: storage.config.smtp.host,
				maxConnections: 50,
				port: 25,
				forceSender: storage.config.smtp.sender,
				auth: storage.config.smtp.username ? {
					user: storage.config.smtp.username,
					pass: storage.config.smtp.password
				} : undefined
			};
			mailSender.smtpTransport [storage.code] = nodemailer.createTransport ("SMTP", smtpCfg);
		};
		st = mailSender.smtpTransport [storage.code];
	} else {
		options.from = config.mail.smtp.forceSender || options.from;
		if (config.mail.smtp [dstHost]) {
			if (!mailSender.smtpTransport [dstHost]) {
				mailSender.smtpTransport [dstHost] = nodemailer.createTransport ("SMTP", config.mail.smtp [dstHost]);
			};
			st = mailSender.smtpTransport [dstHost];
			options.from = config.mail.smtp [dstHost].forceSender || options.from;
		};
	};
	var mailOptions = {
		from: options.from,
		to: options.to,
		envelope: {
			from: options.from,
			to: options.to
		},
		subject: options.subject || options.topic,
		text: options.message || options.text,
		html: options.message || options.html,
		attachments: options.attachments
	};
	st.sendMail (mailOptions, function (error, response) {
		if (error) {
			log.info ({cls: "mailSender"}, "mail (" + options.to + "): " + error);
			mailOptions.storage = storage;
			mailSender.saveFailed (mailOptions);
			if (failure) {
				failure (error);
			};
		} else {
			log.info ({cls: "mailSender"}, "Message sent (" + options.to + "): " + response.message);
			if (success) {
				success ();
			};
		};
	});
};
mailSender.saveFailed = function (options) {
	var storage = options.storage;
	if (options.sendFailed || !storage) {
		return;
	};
	var l = {
		from: options.from,
		to: options.to,
		subject: options.subject,
		text: options.text,
		html: options.html
	};
	l = JSON.stringify (l);
	l = l.split ("'").join ("''");
	storage.query ({sql: 
		"insert into tmail (fcreation_date, fmessage)\n" +
		"values (" + storage.client.currentTimestamp () + ", '" + l + "')\n"
	});
};
/*
	Отправляет неотправленные письма. Завершение после 1-й неудачной попытки.
*/
mailSender.sendFailed = function () {
	var storages = [];
	for (var storageCode in projects.storagePool) {
		storages.push (projects.storagePool [storageCode]);
	};
	async.eachSeries (storages, function (storage, cb) {
		storage.query ({sql: 
			"select fid, fmessage from tmail\n" +
			"where fsending_date is null\n" +
			"order by fid\n"
		, success: function (options) {
			var r = options.result.rows;
			async.eachSeries (options.result.rows, function (row, cb) {
				async.series ([
					function (cb) {
						try {
							var l = JSON.parse (row.fmessage);
							l.success = function() {
								cb ();
							};
							l.failure = function() {
								cb ("fail");
							};
							mailSender.send (l);
						} catch (e) {
							cb ();
						};
					},
					function (cb) {
						storage.query ({sql: 
							"delete from tmail where fid=" + row.fid
						, success: function () {
							cb ();
						}});
					}
				], function (err) {
					cb (err);
				});
			}, function (err) {
				cb (err);
			});
		}});
	}, function (err) {
	});
};


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

var mimetypes = {};
mimetypes.types = {
	"3gp":"video/3gpp",
	"aiff":"audio/x-aiff",
	"arj":"application/x-arj-compressed",
	"asf":"video/x-ms-asf",
	"asx":"video/x-ms-asx",
	"au":"audio/ulaw",
	"avi":"video/x-msvideo",
	"bcpio":"application/x-bcpio",
	"ccad":"application/clariscad",
	"cod":"application/vnd.rim.cod",
	"com":"application/x-msdos-program",
	"cpio":"application/x-cpio",
	"cpt":"application/mac-compactpro",
	"csh":"application/x-csh",
	"css":"text/css",
	"deb":"application/x-debian-package",
	"dl":"video/dl",
	"doc":"application/msword",
	"docx":"application/msword",
	"drw":"application/drafting",
	"dvi":"application/x-dvi",
	"dwg":"application/acad",
	"dxf":"application/dxf",
	"dxr":"application/x-director",
	"etx":"text/x-setext",
	"ez":"application/andrew-inset",
	"fli":"video/x-fli",
	"flv":"video/x-flv",
	"gif":"image/gif",
	"gl":"video/gl",
	"gtar":"application/x-gtar",
	"gz":"application/x-gzip",
	"hdf":"application/x-hdf",
	"hqx":"application/mac-binhex40",
	"html":"text/html; charset=utf-8",
	"ice":"x-conference/x-cooltalk",
	"ico":"image/x-icon",
	"ief":"image/ief",
	"igs":"model/iges",
	"ips":"application/x-ipscript",
	"ipx":"application/x-ipix",
	"jad":"text/vnd.sun.j2me.app-descriptor",
	"jar":"application/java-archive",
	"jpeg":"image/jpeg",
	"jpg":"image/jpeg",
	"js":"text/javascript",
	"json":"application/json; charset=utf-8",
	"latex":"application/x-latex",
	"lsp":"application/x-lisp",
	"lzh":"application/octet-stream",
	"m":"text/plain",
	"m3u":"audio/x-mpegurl",
	"m4v":"video/mp4",
	"man":"application/x-troff-man",
	"me":"application/x-troff-me",
	"midi":"audio/midi",
	"mif":"application/x-mif",
	"mime":"www/mime",
	"mkv":"video/x-matrosk",
	"movie":"video/x-sgi-movie",
	"mp4":"video/mp4",
	"mp41":"video/mp4",
	"mp42":"video/mp4",
	"mpg":"video/mpeg",
	"mpga":"audio/mpeg",
	"ms":"application/x-troff-ms",
	"mustache":"text/plain",
	"nc":"application/x-netcdf",
	"oda":"application/oda",
	"ogm":"application/ogg",
	"pbm":"image/x-portable-bitmap",
	"pdf":"application/pdf",
	"pgm":"image/x-portable-graymap",
	"pgn":"application/x-chess-pgn",
	"pgp":"application/pgp",
	"pm":"application/x-perl",
	"png":"image/png",
	"pnm":"image/x-portable-anymap",
	"ppm":"image/x-portable-pixmap",
	"ppz":"application/vnd.ms-powerpoint",
	"pre":"application/x-freelance",
	"prt":"application/pro_eng",
	"ps":"application/postscript",
	"qt":"video/quicktime",
	"ra":"audio/x-realaudio",
	"rar":"application/x-rar-compressed",
	"ras":"image/x-cmu-raster",
	"rgb":"image/x-rgb",
	"rm":"audio/x-pn-realaudio",
	"rpm":"audio/x-pn-realaudio-plugin",
	"rtf":"text/rtf",
	"rtx":"text/richtext",
	"scm":"application/x-lotusscreencam",
	"set":"application/set",
	"sgml":"text/sgml",
	"sh":"application/x-sh",
	"shar":"application/x-shar",
	"silo":"model/mesh",
	"sit":"application/x-stuffit",
	"skt":"application/x-koan",
	"smil":"application/smil",
	"snd":"audio/basic",
	"sol":"application/solids",
	"spl":"application/x-futuresplash",
	"src":"application/x-wais-source",
	"stl":"application/SLA",
	"stp":"application/STEP",
	"sv4cpio":"application/x-sv4cpio",
	"sv4crc":"application/x-sv4crc",
	"svg":"image/svg+xml",
	"swf":"application/x-shockwave-flash",
	"tar":"application/x-tar",
	"tcl":"application/x-tcl",
	"tex":"application/x-tex",
	"texinfo":"application/x-texinfo",
	"tgz":"application/x-tar-gz",
	"tiff":"image/tiff",
	"tr":"application/x-troff",
	"tsi":"audio/TSP-audio",
	"tsp":"application/dsptype",
	"tsv":"text/tab-separated-values",
	"unv":"application/i-deas",
	"ustar":"application/x-ustar",
	"vcd":"application/x-cdlink",
	"vda":"application/vda",
	"vivo":"video/vnd.vivo",
	"vrm":"x-world/x-vrml",
	"wav":"audio/x-wav",
	"wax":"audio/x-ms-wax",
	"webm":"video/webm",
	"wma":"audio/x-ms-wma",
	"wmv":"video/x-ms-wmv",
	"wmx":"video/x-ms-wmx",
	"wrl":"model/vrml",
	"wvx":"video/x-ms-wvx",
	"xbm":"image/x-xbitmap",
	"xls":"application/vnd.ms-excel",
	"xlsx":"application/vnd.ms-excel",
	"xlw":"application/vnd.ms-excel",
	"xml":"text/xml",
	"xpm":"image/x-xpixmap",
	"xwd":"image/x-xwindowdump",
	"xyz":"chemical/x-pdb",
	"zip":"application/zip"
};
mimetypes.lookup = function (ext, defaultType) {
	defaultType = defaultType || "application/octet-stream";
	return (ext in mimetypes.types) ? mimetypes.types [ext] : defaultType;
};

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
									cascadeNum = options.cascadeNum;
									setnullNum = options.setnullNum;
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

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
// storage, session, sql
var Query = function (options) {
	var query = this;
	var mainOptions = options;
	var success = options.success;
	var storage = options.storage;
	var session = options.session || {userId: null};
	var revision = session.revision;
	var select = options.sql.select;
	var from = options.sql.from;
	var where = options.sql.where;
	var order = options.sql.order;
	var orderAfter = options.sql.orderAfter;
	var attrs = {};
	var fields = [];
	var fieldNames = [];
	var fieldTypeId = {};
	query.generate = function () {
		getAttrs ();
		processJoins (from);
		query.selectSQL = processSelect (select);
		query.whereSQL = processWhere (where);
		query.orderSQL = processOrder (order);
		query.fromSQL = processFrom (from);
		query.attrs = attrs;
		query.fields = fields;
		query.fieldNames = fieldNames;
		query.fieldTypeId = fieldTypeId;
		if (orderAfter) {
			query.selectSQL = "select * from (\n" + query.selectSQL;
			query.orderSQL += "\n) orderAfter " + processOrderAfter (orderAfter);
		};
	};
	var getAttrs = function () {
		for (var i = 0; i < from.length; i ++) {
			var o = from [i];
			if (typeof (o) == "object" && Object.prototype.toString.call (o) !== "[object Array]") {
				for (var key in o) {
					attrs [key] = attrs [key] || {};
					attrs [key].cls = o [key];
					attrs [key].toc = {};
					break;
				}
			}
		}
	};
	var processJoin = function (arr) {
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i];
			if (typeof (o) =="object") {
				for (var a in o) {
					if (o [a] == "id") {
						var toc = storage.classesCode [attrs [a].cls].toc;
						if (revision) {
							toc = "tm_" + toc;
						};
						attrs [a].toc [toc] = attrs [a].toc [toc] || [];
						if (attrs [a].toc [toc].indexOf ("fobject_id") == -1) {
							attrs [a].toc [toc].push ("fobject_id");
						}
					} else {
						if (!attrs [a]) {
							console.error ("unknown attr: " + a);
						};
						var toc, ca, pos = query.sysCls.indexOf (attrs [a].cls);
						if (pos > -1) {
							toc = query.tables [pos];
							ca = {toc: o [a].substr (3)};
						} else {
							ca = storage.getClassAttr ({classCode: attrs [a].cls, attrCode: o [a]});
							toc = storage.classesMap [ca.get ("fclass_id")].toc;
							if (revision) {
								toc = "tm_" + toc;
							};
						}
						attrs [a].toc [toc] = attrs [a].toc [toc] || [];
						if (attrs [a].toc [toc].indexOf (ca.toc) == -1) {
							attrs [a].toc [toc].push (ca.toc);
						}
					}
					break;
				}
			}
		}				
	};
	var processJoins = function (arr) {
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i];
			if (o == "left-join" || o == "inner-join") {
				processJoin (arr [i + 3]);
				i += 3;
			}
		}
	};
	var lastTypeId = 1;
	var fieldToSQL = function (o) {
		var r = "";
		var distinct = o.distinct;
		for (var a in o) {
			if (a == "distinct") {
				continue;
			};
			if (o [a] == "id") {
				if (distinct) {
					r = "distinct on (" + a + ".fobject_id) " + a + ".fobject_id";
				} else {
					r = a + ".fobject_id";
				};
				var c = storage.getClass ({classCode: attrs [a].cls});
				if (!c) {
					throw "query.fieldToSQL - unknown class: " + attrs [a].cls;
				};
				var toc = c.toc;
				if (revision) {
					toc = "tm_" + toc;
				};
				attrs [a].toc [toc] = attrs [a].toc [toc] || [];
				if (attrs [a].toc [toc].indexOf ("fobject_id") == -1) {
					attrs [a].toc [toc].push ("fobject_id");
				}
				lastTypeId = 2;
			} else {
				if (!attrs [a]) {
					throw new VError ("Unknown attr: " + a);
				}
				var toc, pos = query.sysCls.indexOf (attrs [a].cls);
				var ca = storage.getClassAttr ({classCode: attrs [a].cls, attrCode: o [a]});
				if (pos > -1) {
					toc = query.tables [pos];
					ca.toc = o [a].substr (3);
				} else {
					toc = storage.classesMap [ca.get ("fclass_id")].toc;
					if (revision) {
						toc = "tm_" + toc;
					};
				};
				if (distinct) {
					r = "distinct on (" + a + "." + ca.toc + ") " + a + "." + ca.toc;
				} else {
					r = a + "." + ca.toc;
				};
				attrs [a].toc [toc] = attrs [a].toc [toc] || [];
				if (attrs [a].toc [toc].indexOf (ca.toc) == -1) {
					attrs [a].toc [toc].push (ca.toc);
				}
				lastTypeId = ca.get ("ftype_id");
			}
			break;
		};
		return r;
	};
	var getExpressionStr = function (arr) {
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			if (r) {
				r += " ";
			}
			var o = arr [i];
			if (typeof (o) == "object") {
				if (common.isArray (o)) {
					r += "(" + getExpressionStr (o) + ")";
				} else {
					r += fieldToSQL (o);
				}
			} else
			if (typeof (o) == "number") {
				r += o;
			} else
			if (typeof (o) == "string") {
				var pos = fields.indexOf (o.toLowerCase () + "_");
				if (query.keywords.indexOf (o) > -1) {
					r += o;
				} else
				if (pos > -1) {
					// поиск в олапе без учета регистра
					if (!config.query.strictFilter && i < arr.length - 2 && (arr [i + 1] == "like" || arr [i + 1] == "not like") && arr [i + 2] && typeof (arr [i + 2]) == "string") {
						r += "lower (" + fieldNames [pos] + ")";
						arr [i + 2] = arr [i + 2].toLowerCase ();
					} else {
						r += fieldNames [pos];
					};
				} else {
					r += "'" + o.split ("'").join ("''") + "'";
				}
			} else {
				r += o;
			}
		}
		return r;
	};
	var processSelect = function (arr) {
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			var o = arr [i], name;
			if (common.isArray (o)) {
				if (r) {
					r += ",\n\t";
				} else {
					r += "\t";
				}
				r += getExpressionStr (o);
			} else
			if (typeof (o) =="object") {
				if (r) {
					r += ",\n\t";
				} else {
					r += "\t";
				}
				name = fieldToSQL (o);
				r += name;
			} else {
				var s = o.toLowerCase () + "_";
				r += " as " + s;
				if (i && !common.isArray (arr [i - 1])) {
					fields.push (s);
					if (name.substr (0, 8) == "distinct") {
						name = name.split (" ")[3];
					}
					fieldNames.push (name);
					fieldTypeId [s] = lastTypeId;
				}
			}
		}
		return storage.client.database == "mssql" ? "select top 9223372036854775807\n" + r + "\n" : "select\n" + r + "\n";
	};
	var processFrom = function (arr) {
		if (!arr) {
			return "";
		}
		var getBlock = function (o) {
			var alias, classCode, fields = [], tables = [], where = [];
			for (alias in o) {
				classCode = o [alias];
				break;
			}
			var objectField;
			for (var t in attrs [alias].toc) {
				var f = attrs [alias].toc [t];
				for (var i = 0; i < f.length; i ++) {
					fields.push (t + "." + f [i]);
				}
				if (query.tables.indexOf (t) == -1) {
					objectField = t + ".fobject_id";
				}
			};
			var cls = storage.getClass (classCode);
			while (1) {
				var pos = query.sysCls.indexOf (classCode);
				if (pos > -1) {
					tables.push (query.tables [pos]);
					break;
				};
				if (revision) {
					tables.push ("tm_" + cls.toc);
				} else {
					tables.push (cls.toc);
				};
				if (!cls.get ("fparent_id")) {
					break;
				};
				cls = storage.classesMap [cls.get ("fparent_id")];
			};
			for (var i = 1; i < tables.length; i ++) {
				where.push (tables [i - 1] + ".fobject_id=" + tables [i] + ".fobject_id");
			}
			if (revision) {
				for (var i = 0; i < tables.length; i ++) {
					if (query.tables.indexOf (tables [i]) == -1) {
						where.push (tables [i] + ".frevision_id=" + revision);
					};
				};
			};
			if (where.length) {
				where = " where " + where.join (" and ");
			} else {
				where = "";
			}
			if (!objectField) {
				if (tables.indexOf ("tobject") > -1) {
					objectField = "tobject.fid";
				} else
				if (tables.indexOf ("tobject_attr") > -1) {
					objectField = "tobject_attr.fid";
				}
			}
			var eventResult = storage.fireEvent ("generatequeryblock", {
				cls: cls,
				objectField: objectField,
				session: session,
				tables: tables,
				where: where,
				alias: alias
			});
			if (eventResult && eventResult.where) {
				where = eventResult.where;
			};
			return storage.client.database == "mssql" ? 
				"(select top 9223372036854775807 " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias : 
				"(select " + fields.join (",") + " from " + tables.join (",") + where + ") " + alias
			;
		};
		var r = "";
		for (var i = 0; i < arr.length; i ++) {
			if (!i) {
				r += "\t" + getBlock (arr [0]);
			} else {
				var o = arr [i];
				if (o == "left-join" || o == "inner-join") {
					r += "\n\t" + o.split ("-").join (" ");
					r += " " + getBlock (arr [i + 1]);
					r += " on (" + getExpressionStr (arr [i + 3]) + ")";
					i += 3;
				}
			}
		}
		return "from\n" + r + "\n";
	};
	var processWhere = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "where\n\t" + getExpressionStr (arr) + "\n";
	};
	var processOrder = function (arr) {
		if (!arr || !arr.length) {
			return "";
		}
		return "order by\n\t" + getExpressionStr (arr) + "\n";
	};
	var processOrderAfter = function (arr) {
		if (!arr || !arr.length) {
			return "";
		};
		var s = "";
		for (var j = 0; j < arr.length; j ++) {
			if (_.isObject (arr [j])) {
				var has = false;
				for (var i = 0; i < select.length; i ++) {
					var o = select [i];
					if (_.isObject (o) && _.keys (o)[0] == _.keys (arr [j])[0] && _.values (o)[0] == _.values (arr [j])[0]) {
						s += "orderAfter." + select [i + 1] + "_ ";
						has = true;
					}
				}
				if (!has) {
					s += "orderAfter." + _.values (arr [j])[0] + "_ ";
				}
			} else {
				var pos = fields.indexOf (arr [j].toLowerCase () + "_");
				if (pos > -1) {
					s += "orderAfter." + arr [j] + "_ ";
				} else {
					s += arr [j];
				}
			};
		};
		return "order by\n\t" + s + "\n";
	};
};
Query.prototype.sysCls = ["system.class", "system.class_attr", "system.view", "system.view_attr", "system.action", "system.action_attrs", "system.object", "system.object_attr", "system.revision"];
Query.prototype.tables = ["tclass", "tclass_attr", "tview", "tview_attr", "taction", "taction_attrs", "tobject", "tobject_attr", "trevision"];
Query.prototype.keywords = [
	"is null", "is not null", "on", "in", "not in", "exist", "not exist", "like", "not like", 
	"desc", "DESC", "asc", "ASC", "and", "or", "row_number ()", "over", "order by",
	"<>", ">", ">=", "<", "<=", "=", "+", "-", "||", "/", ",", "*", "current_timestamp",
	"lower", "trim", "ltrim", "rtrim"
];

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
process.env.TZ = "UTC"
process.maxTickDepth = Infinity;
if (config.uncaughtException) {
	process.on ("uncaughtException", function (err) {
		console.log (err);
		console.log (err.stack);
		var text = "[" + common.currentDate () + " " + common.currentTime ({msec: true}) + "] ";
		var fd = fs.openSync (config.rootDir + "/error.log", "a", 666);
		fs.writeSync (fd, text + "Caught exception: " + err + "\n" + err.stack + "\n", null, "utf8");
		fs.closeSync (fd);
		process.exit (1);
	});
};
// Количество секунд прошедших с 1 января 1970 года (UnixTime)
config.clock = parseInt (new Date ().getTime () / 1000);
var server = {};
server.cache = {};
server.www = function (options) {
	var request = options.request;
	var response = options.response;
	var next = options.next;
	var filePath = options.filePath;
	var pathname = url.parse (request.url).pathname;
	if (!filePath) {
		if (pathname == "/") {
			pathname = "/index.html";
		}
		var tokens = pathname.split (".");
		filePath = config.wwwRoot + pathname;
	};
	var urlTokens = pathname.split ("/");
	if (urlTokens [3] == "wsdl") {
		console.log (pathname, decodeURI (filePath));
		fs.readFile (decodeURI (filePath), function (err, data) {
			var ext = filePath.split (".");
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
	var ext = filePath.split (".");
	ext = ext [ext.length - 1];
	if (config.caching && config.caching.enabled && !options.nocache) {
		var mtime, status = 200;
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
									var mtimeUser = request.headers ["if-none-match"];
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
						var headers = {
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
			var ext = filePath.split (".");
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
	var urlTokens = request.url.split ("/");
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
		var tokens = request.body.split (".");
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
	var form = new formidable.IncomingForm ();
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
		var body = "", fields = "";
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
				var this_ = this;
				redisClient.hdel ("current-requests", n, function (err, result) {
					var duration = (new Date ().getTime () - request.objectum.start) / 1000;
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
	var request = options.request;
	var response = options.response;
	if (config.admin.ip.indexOf (common.getRemoteAddress (request)) == -1 && config.admin.ip != "all") {
		response.end ("forbidden");
	};
	log.info ({cls: "server", fn: "stat"}, "ip: " + common.getRemoteAddress (request) + ", query: " + JSON.stringify (request.query));
	if (request.query.logs) {
		redisClient.keys (config.redis.db + "-log-*", function (err, result) {
			for (var i = 0; i < result.length; i ++) {
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
	var allData = {}, num = 0, online, lost, onlineNum, onlineNumMax, onlineNumMaxTS, started, memoryUsage, idle = "";
	async.series ([
		function (cb) {
			redisClient.hgetall ("sessions", function (err, r) {
				var data = [];
				for (var k in r) {
					if (k.indexOf ("-username") > -1) {
						var sid = k.substr (0, k.length - 9);
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
				var data = [];
				for (var k in result) {
					var r;
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
				var data = [];
				var total = {
					current: {
						rss: 0, heapTotal: 0, heapUsed: 0
					},
					max: {
						rss: 0, heapTotal: 0, heapUsed: 0
					}
				};
				for (var k in result) {
					var r = JSON.parse (result [k]);
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
			var s;
			for (s in config.storages) {
				if (config.storages [s].database == "postgres") {
					var client = new db.Postgres ({connection: config.storages [s]});
					client.connect ({systemDB: true, success: function () {
						client.query ({sql: 
							"select (date_part ('epoch', now () - query_start)) as duration, procpid, current_query\n" +
							"from pg_stat_activity\n" +
							"where current_query <> '<IDLE>' and date_part ('epoch', now () - query_start) > 0\n" +
							"order by 1"
						, success: function (options) {
							var rows = options.result.rows;
							var data = [];
							for (var i = 0; i < rows.length; i ++) {
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
	var pmu = process.memoryUsage ();
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
	var success = options.success;
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
			var msg = err.message ? err.message : err;
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
	var success = options.success;
	if (!config.plugins) {
		if (success) {
			success ();
		};
		return;
	};
	var plugins = [];
	for (var pluginCode in config.plugins) {
		plugins.push (pluginCode);
	};
	async.map (plugins, function (pluginCode, cb) {
		var plugin = config.plugins [pluginCode];
		fs.exists (plugin.require, function (exists) {
			if (exists) {
				var m = require (plugin.require);
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
	var urlTokens = req.url.split ("/");
	if (urlTokens [3] == "plugins") {
		var storageCode = urlTokens [2];
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
	var success = options.success;
	var storages = [];
	for (var storageCode in config.storages) {
		storages.push (storageCode);
	};
	async.map (storages, function (storageCode, cb) {
		var wsdlFile = config.storages [storageCode].rootDir + "/wsdl/wsdl.js"
		if (config.storages [storageCode].wsdl && !config.storages [storageCode].wsdl.enabled) {
			cb ();
			return;
		};
		fs.exists (wsdlFile, function (exists) {
			if (exists) {
				projects.getStorage ({storageCode: storageCode, success: function (options) {
					// todo: одинаковые wsdl.js накрывают друг друга
					var wsdl = require (wsdlFile);
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
	var port = options.port || config.startPort;
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
						for (var i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("*-clschange", function (err, result) {
						for (var i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("log-*", function (err, result) {
						for (var i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("*-objects", function (err, result) {
						for (var i = 0; i < result.length; i ++) {
							redisClient.del (result [i]);
						}
					});
					redisClient.keys ("*-data", function (err, result) {
						for (var i = 0; i < result.length; i ++) {
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

/*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1 Version 2.1a Copyright Paul Johnston 2000 - 2002. Other
 * contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet Distributed under the
 * BSD License See http://pajhome.org.uk/crypt/md5 for details.
 */

/*
 * Configurable variables. You may need to tweak these to be compatible with the
 * server-side, but the defaults work in most cases.
 */
var hexcase = 1;	// hex output format. 0 - lowercase; 1 - uppercase
var b64pad = "";	// base-64 pad character. "=" for strict RFC compliance
var chrsz = 8;		// bits per input character. 8 - ASCII; 16 - Unicode

/*
 * These are the functions you'll usually want to call They take string
 * arguments and return either hex or base-64 encoded strings
 */
var sha = {};
sha.hex_sha1 = function (s) {
	return binb2hex (core_sha1 (str2binb (s), s.length * chrsz));
}

function b64_sha1 (s) {
	return binb2b64 (core_sha1 (str2binb (s), s.length * chrsz));
}

function str_sha1 (s) {
	return binb2str (core_sha1 (str2binb (s), s.length * chrsz));
}

function hex_hmac_sha1 (key, data) {
	return binb2hex (core_hmac_sha1 (key, data));
}

function b64_hmac_sha1 (key, data) {
	return binb2b64 (core_hmac_sha1 (key, data));
}

function str_hmac_sha1 (key, data) {
	return binb2str (core_hmac_sha1 (key, data));
}

/*
 * Perform a simple self-test to see if the VM is working
 */
function sha1_vm_test () {
	return hex_sha1 ("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
}

/*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
function core_sha1 (x, len) {
	/* append padding */
	x [len >> 5] |= 0x80 << (24 - len % 32);
	x [((len + 64 >> 9) << 4) + 15] = len;

	var w = Array (80);
	var a = 1732584193;
	var b = -271733879;
	var c = -1732584194;
	var d = 271733878;
	var e = -1009589776;

	for (var i = 0; i < x.length; i += 16) {
		var olda = a;
		var oldb = b;
		var oldc = c;
		var oldd = d;
		var olde = e;

		for (var j = 0; j < 80; j++) {
			if (j < 16)
				w [j] = x [i + j];
			else
				w [j] = rol (w [j - 3] ^ w [j - 8] ^ w [j - 14] ^ w [j - 16], 1);
			var t = safe_add (safe_add (rol (a, 5), sha1_ft (j, b, c, d)), safe_add (safe_add (e, w [j]), sha1_kt (j)));
			e = d;
			d = c;
			c = rol (b, 30);
			b = a;
			a = t;
		}

		a = safe_add (a, olda);
		b = safe_add (b, oldb);
		c = safe_add (c, oldc);
		d = safe_add (d, oldd);
		e = safe_add (e, olde);
	}
	return Array (a, b, c, d, e);

}

/*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
function sha1_ft (t, b, c, d) {
	if (t < 20)
		return (b & c) | ((~b) & d);
	if (t < 40)
		return b ^ c ^ d;
	if (t < 60)
		return (b & c) | (b & d) | (c & d);
	return b ^ c ^ d;
}

/*
 * Determine the appropriate additive constant for the current iteration
 */
function sha1_kt (t) {
	return (t < 20) ? 1518500249 : (t < 40) ? 1859775393 : (t < 60) ? -1894007588 : -899497514;
}

/*
 * Calculate the HMAC-SHA1 of a key and some data
 */
function core_hmac_sha1 (key, data) {
	var bkey = str2binb (key);
	if (bkey.length > 16)
		bkey = core_sha1 (bkey, key.length * chrsz);

	var ipad = Array (16), opad = Array (16);
	for (var i = 0; i < 16; i++) {
		ipad [i] = bkey [i] ^ 0x36363636;
		opad [i] = bkey [i] ^ 0x5C5C5C5C;
	}

	var hash = core_sha1 (ipad.concat (str2binb (data)), 512 + data.length * chrsz);
	return core_sha1 (opad.concat (hash), 512 + 160);
}

/*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally to
 * work around bugs in some JS interpreters.
 */
function safe_add (x, y) {
	var lsw = (x & 0xFFFF) + (y & 0xFFFF);
	var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
	return (msw << 16) | (lsw & 0xFFFF);
}

/*
 * Bitwise rotate a 32-bit number to the left.
 */
function rol (num, cnt) {
	return (num << cnt) | (num >>> (32 - cnt));
}

/*
 * Convert an 8-bit or 16-bit string to an array of big-endian words In 8-bit
 * function, characters >255 have their hi-byte silently ignored.
 */
function str2binb (str) {
	var bin = Array ();
	var mask = (1 << chrsz) - 1;
	for (var i = 0; i < str.length * chrsz; i += chrsz)
		bin [i >> 5] |= (str.charCodeAt (i / chrsz) & mask) << (32 - chrsz - i % 32);
	return bin;
}

/*
 * Convert an array of big-endian words to a string
 */
function binb2str (bin) {
	var str = "";
	var mask = (1 << chrsz) - 1;
	for (var i = 0; i < bin.length * 32; i += chrsz)
		str += String.fromCharCode ((bin [i >> 5] >>> (32 - chrsz - i % 32)) & mask);
	return str;
}

/*
 * Convert an array of big-endian words to a hex string.
 */
function binb2hex (binarray) {
	var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
	var str = "";
	for (var i = 0; i < binarray.length * 4; i++) {
		str += hex_tab.charAt ((binarray [i >> 2] >> ((3 - i % 4) * 8 + 4)) & 0xF)
				+ hex_tab.charAt ((binarray [i >> 2] >> ((3 - i % 4) * 8)) & 0xF);
	}
	return str;
}

/*
 * Convert an array of big-endian words to a base-64 string
 */
function binb2b64 (binarray) {
	var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	var str = "";
	for (var i = 0; i < binarray.length * 4; i += 3) {
		var triplet = (((binarray [i >> 2] >> 8 * (3 - i % 4)) & 0xFF) << 16)
				| (((binarray [i + 1 >> 2] >> 8 * (3 - (i + 1) % 4)) & 0xFF) << 8)
				| ((binarray [i + 2 >> 2] >> 8 * (3 - (i + 2) % 4)) & 0xFF);
		for (var j = 0; j < 4; j++) {
			if (i * 8 + j * 6 > binarray.length * 32)
				str += b64pad;
			else
				str += tab.charAt ((triplet >> 6 * (3 - j)) & 0x3F);
		}
	}
	return str;
}

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var Storage = function (options) {
	var storage = this;
	// postgresql main client object
	storage.client = null;
	// Connections to postgresql. One connection - one transaction.
	storage.clientPool = {};
	storage.getClient = function (options) {
		options = options || {};
		options.session = options.session || {};
		if (storage.clientPool [options.session.id]) {
			return storage.clientPool [options.session.id];
		} else {
			var client = db.create (storage);
			return client;
		};
	};
	storage.freeClient = function (options) {
		var client = storage.clientPool [options.session.id];
		if (client) {
			client.disconnect ();
			delete storage.clientPool [options.session.id];
		}
	};
	// Current revision of transaction
	storage.revision = {};
	// exec sql
	storage.queryCount = 0;
	storage.query = function (options) {
		var meOptions = options;
		options.options = options.options || {};
		var session = options.session;
		storage.queryCount ++;
		var client = options.client || storage.getClient (options);
		(function hideParams () {
			if (options.params) {
				for (var i = 0; i < options.params.length; i ++) {
					options.sql = options.sql.replace ("$" + (i + 1), "#" + (i + 1));
				};
			};
		}) ();
		(function prepare () {
			var s = "", c, sql = "";
			for (var i = 0; i < options.sql.length; i ++) {
				c = options.sql [i];
				if (c == "$") {
					if (s) {
						s = s.substr (1);
						if (client.tags.hasOwnProperty (s)) {
							sql += client.tags [s];
						} else {
							sql += "$" + s + "$";
						};
						s = "";
					} else {
						s = c;
					};
				} else {
					if (s) {
						s += c;
					} else {
						sql += c;
					};
				};
			};
			if (s) {
				sql += s;
			};
			options.sql = sql;
		}) ();
		(function returnParams () {
			if (options.params) {
				for (var i = 0; i < options.params.length; i ++) {
					options.sql = options.sql.replace ("#" + (i + 1), "$" + (i + 1));
				};
			};
		}) ();
		client.query ({sql: options.sql, params: options.params, success: function (options) {
			if (!session || !storage.clientPool [session.id]) {
				if (!client.inStorage) {
					client.disconnect ();
				};
			};
			if (meOptions.success) {
				meOptions.success (options);
			}
		}, failure: function (err) {
			if (!session || !storage.clientPool [session.id]) {
				if (!client.inStorage) {
					client.disconnect ();
				};
			};
			if (meOptions.failure) {
				meOptions.failure (new VError (err, "Storage.query"));
			}
		}});
	};
	storage.maxRevision = 2147483647;
	storage.getCurrentFilter = function (options) {
		var filter;
		var alias = "";
		if (options && options.alias) {
			alias = options.alias + ".";
		};
		filter = "(" + alias + "fend_id = " + this.maxRevision + ")";		
		return filter;
	};
	storage.createRevision = function (options) {
		var success = options.success;
		var description = options.description;
		var session = options.session;
		var remoteAddr = options.remoteAddr || session.ip;
		var client = storage.clientPool [session.id];
		client.getNextId ({session: session, table: "trevision", success: function (options) {
			var id = options.id;
			storage.lastRevision = id;
			remoteAddr = remoteAddr ? "'" + remoteAddr + "'" : "null";
			session.userId = session.userId || "null";
			var s = 
				"insert into trevision (fid, fdate, fdescription, fsubject_id, fremote_addr)\n" + 
				"values (" + id + ", " + client.currentTimestamp () + ", '" + description + "', " + session.userId + ", " + remoteAddr + ")";
			storage.query ({session: session, sql: s, success: function (options) {
				if (success) {
					success ({id: id});
				};
			}, failure: function (err) {
				if (options.failure) {
					options.failure (new VError (err, "Storage.createRevision"));
				};
			}});
		}, failure: function (err) {
			if (options.failure) {
				options.failure (new VError (err, "Storage.createRevision"));
			};
		}});
	};
	storage.inTransaction = function (session) {
		return storage.clientPool [session.id];
	};
	storage.startTransaction = function (options) {
		options = options || {};
		options.session = options.session || {};
		var success = options.success;
		var failure = options.failure;
		var session = options.session;
		log.debug ({cls: "Storage", fn: "startTransaction", params: options.description});
		async.series ([
			function (cb) {
				if (storage.clientPool [session.id]) {
					storage.rollbackTransaction ({session: session, success: function () {
						cb ();
					}, failure: cb});
				} else {
					cb ();
				};
			}
		], function (err, results) {
			var client = db.create (storage);
			client.connect ({success: function () {
				client.startTransaction ({success: function () {
					storage.clientPool [session.id] = client;
					options.success = function (options) {
						storage.revision [session.id] = options.id;
						storage.revisions [options.id] = {
							id: options.id, 
							dirty: true, // after commitTransaction = true
							objects: {
								changed: [], // changed, removed
								created: [], // createObject
								removed: [], // commit.removed
								classId: {} // objectId: classId
							},
							classes: {
								changed: [],
								created: [],
								removed: []
							},
							classAttrs: {
								changed: [],
								created: [],
								removed: []
							},
							views: {
								changed: [],
								created: [],
								removed: []
							},
							viewAttrs: {
								changed: [],
								created: [],
								removed: []
							}
						};
						if (success) {
							success ({revision: options.id});
						}			
					};
					options.failure = function (err) {
						if (failure) {
							failure (new VError (err, "Storage.startTransaction"));
						};
					};
					storage.createRevision (options);
				}, failure: function (err) {
					if (failure) {
						failure (new VError (err, "Storage.startTransaction"));
					};
				}});
			}, failure: function (err) {
				if (failure) {
					failure (new VError (err, "Storage.startTransaction"));
				};
			}});
		});
	};
	// Commit transaction
	storage.commitTransaction = function (options) {
		log.debug ({cls: "Storage", fn: "commitTransaction"});
		options = options || {};
		options.session = options.session || {};
		var session = options.session;
		var failure = options.failure;
		if (storage.revision [session.id]) {
			var client = storage.clientPool [session.id];
			if (client) {
				client.commitTransaction ({success: function () {
					delete storage.clientPool [session.id];
					client.disconnect ();
					var revision = storage.revision [session.id];
					if (storage.revisions [revision]) {
						storage.revisions [revision].dirty = false;
						storage.redisPub.publish (config.redis.db + "-" + storage.code + "-revisions", JSON.stringify (storage.revisions [revision]));
					};
					delete storage.revision [session.id];
					if (options.success) {
						options.success ({revision: revision});
					}			
				}, failure: function (err) {
					if (failure) {
						failure (new VError (err, "Storage.commitTransaction"));
					};
				}});
			} else {
				delete storage.clientPool [session.id];
				if (options.success) {
					options.success ({});
				}			
			};
		} else {
			if (options.success) {
				options.success ({});
			}			
		};
	};
	// Rollback transaction
	storage.rollbackTransaction = function (options) {
		log.debug ({cls: "Storage", fn: "rollbackTransaction"});
		options = options || {};
		options.session = options.session || {};
		var session = options.session;
		if (storage.revision [session.id]) {
			var client = storage.clientPool [session.id];
			if (!client) {
				// removeTimeoutSessions exception
				var revision = storage.revision [session.id];
				delete storage.revisions [revision];
				delete storage.revision [session.id];
				if (options.success) {
					options.success ({revision: revision});
				};
				return;
			};
			client.rollbackTransaction ({success: function () {
				delete storage.clientPool [session.id];
				client.disconnect ();
				var revision = storage.revision [session.id];
				delete storage.revisions [revision];
				delete storage.revision [session.id];
				if (options.success) {
					options.success ({revision: revision});
				}			
			}, failure: function (err) {
				if (options.failure) {
					options.failure (new VError (err, "Storage.rollbackTransaction"));
				};
			}});
		} else {
			if (options.success) {
				options.success ({});
			}			
		};
	};
	// Список классов
	storage.classes = null;
	// Карта классов по id
	storage.classesMap = null;
	// Карта классов по code {'spr.task': classObject}
	storage.classesCode = null;
	// Дерево классов по кодам: {classCode: {classChildCode: ...}}
	storage.classesTree = null;
	// Init classes
	storage.initClasses = function (options) {
		log.debug ({cls: "Storage", fn: "initClasses"});
		options = options || {};
		var success = options.success;
		options.session = options.session || {};
		var session = options.session;
		storage.query ({session: session, sql: "select * from tclass where " + storage.getCurrentFilter (), success: function (options) {
			var rows = options.result.rows;
			// get fields
			var fields = [];
			for (var field in rows [0]) {
				fields.push (field);
			}
			// get storage.classes
			storage.classes = [];
			storage.classesMap = {};
			for (var i = 0; i < rows.length; i ++) {
				var o = new storage.tobject ({code: "tclass"});
				for (var j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				o.childs = [];
				o.attrs = {};
				storage.classes.push (o);
				storage.classesMap [o.get ("fid")] = o;
			}
			// get storage.classesTree
			storage.classesTree = {};
			storage.classesCode = {};
			var getTree = function (options) {
				for (var i = 0; i < storage.classes.length; i ++) {
					var o = storage.classes [i];
					if (o.get ("fparent_id") == options.parent) {
						if (options.parent) {
							storage.classesMap [options.parent].childs.push (o.get ("fid"));
						}
						options.node [o.get ("fcode")] = {id: o.get ("fid")};
						var code = options.code ? options.code + "." + o.get ("fcode") : o.get ("fcode");
						storage.classesCode [code] = o;
						var tokens = code.split (".");
						if (tokens.length == 3) {
							storage.classesCode [tokens [0] + "." + tokens [2]] = storage.classesCode [tokens [0] + "." + tokens [2]] || o;
						}
						if (tokens.length == 4) {
							storage.classesCode [tokens [0] + "." + tokens [3]] = storage.classesCode [tokens [0] + "." + tokens [3]] || o;
						}
						getTree ({node: options.node [o.get ("fcode")], parent: o.get ("fid"), code: code});
					}
				}
			}
			getTree ({node: storage.classesTree, parent: null});
			if (success) {
				success ();
			}
		}});	
	};
	storage.getClassFullCode = function (o) {
		if (!o) {
			return o;
		};
		var n = o.get ("fcode");
		if (o.get ("fparent_id")) {
			n = storage.getClassFullCode (storage.classesMap [o.get ("fparent_id")]) + "." + n;
		};
		return n;
	};
	storage.updateClassCache = function (options) {
		var fields = options.fields;
		var values = options.values;
		var o = storage.classesMap [values [0]] || (new storage.tobject ({code: "tclass"}));
		if (values [1]) {
			storage.classesMap [values [1]].childs.splice (
				storage.classesMap [values [1]].childs.indexOf (values [0], 1)
			);
		};
		for (var i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		};
		o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
		if (!storage.classesMap [o.get ("fid")]) {
			o.childs = [];
			o.attrs = {};
			storage.classes.push (o);
			storage.classesMap [o.get ("fid")] = o;
		};
		if (o.get ("fparent_id")) {
			if (storage.classesMap [o.get ("fparent_id")].childs.indexOf (o.get ("fid")) == -1) {
				storage.classesMap [o.get ("fparent_id")].childs.push (o.get ("fid"));
			};
			var code = storage.getClassFullCode (o);
			storage.classesCode [code] = o;
			var tokens = code.split (".");
			if (tokens.length == 3) {
				storage.classesCode [tokens [0] + "." + tokens [2]] = storage.classesCode [tokens [0] + "." + tokens [2]] || o;
			};
			if (tokens.length == 4) {
				storage.classesCode [tokens [0] + "." + tokens [3]] = storage.classesCode [tokens [0] + "." + tokens [3]] || o;
			};
		} else {
			storage.classesCode [o.get ("fcode")] = o;
		};
	};
	storage.updateClassAttrCache = function (options) {
		var fields = options.fields;
		var values = options.values;
		var o = storage.classAttrsMap [values [0]] || (new storage.tobject ({code: "tclass_attr"}));
		if (storage.classesMap [values [1]]) {
			var removeClassAttr = function (oClass) {
				oClass.attrs = oClass.attrs || {};
				delete oClass.attrs [values [3]];
				for (var i = 0; i < oClass.childs.length; i ++) {
					removeClassAttr (storage.classesMap [oClass.childs [i]]);
				}
			};
			removeClassAttr (storage.classesMap [values [1]]);
		};
		for (var i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		}
		o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
		if (!storage.classAttrsMap [o.get ("fid")]) {
			storage.classAttrs.push (o);
			storage.classAttrsMap [o.get ("fid")] = o;
		};
		if (storage.classesMap [o.get ("fclass_id")]) {
			var addClassAttr = function (oClass) {
				oClass.attrs = oClass.attrs || {};
				oClass.attrs [o.get ("fcode")] = o;
				for (var i = 0; i < oClass.childs.length; i ++) {
					addClassAttr (storage.classesMap [oClass.childs [i]]);
				}
			};
			addClassAttr (storage.classesMap [o.get ("fclass_id")]);
		};
	};
	storage.getViewFullCode = function (o) {
		if (!o) {
			return o;
		};
		var n = o.get ("fcode");
		if (o.get ("fparent_id")) {
			n = storage.getViewFullCode (storage.viewsMap [o.get ("fparent_id")]) + "." + n;
		};
		return n;
	};
	storage.updateViewCache = function (options) {
		var fields = options.fields;
		var values = options.values;
		var o = storage.viewsMap [values [0]] || (new storage.tobject ({code: "tview"}));
		for (var i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		}
		if (!storage.viewsMap [o.get ("fid")]) {
			o.attrs = {};
			storage.views.push (o);
			storage.viewsMap [o.get ("fid")] = o;
		};
		if (o.get ("fparent_id")) {
			var code = storage.getViewFullCode (o);
			storage.viewsCode [code] = o;
			var tokens = code.split (".");
			if (tokens.length == 3) {
				storage.viewsCode [tokens [0] + "." + tokens [2]] = storage.viewsCode [tokens [0] + "." + tokens [2]] || o;
			};
			if (tokens.length == 4) {
				storage.viewsCode [tokens [0] + "." + tokens [3]] = storage.viewsCode [tokens [0] + "." + tokens [3]] || o;
			};
		} else {
			storage.viewsCode [o.get ("fcode")] = o;
		};
	};
	storage.updateViewAttrCache = function (options) {
		var fields = options.fields;
		var values = options.values;
		var o = storage.viewAttrsMap [values [0]] || (new storage.tobject ({code: "tview_attr"}));
		for (var i = 0; i < fields.length; i ++) {
			o.data [fields [i]] = values [i];
		};
		if (!storage.viewAttrsMap [o.get ("fid")]) {
			storage.viewAttrs.push (o);
			storage.viewAttrsMap [o.get ("fid")] = o;
		};
		var oView = storage.viewsMap [o.get ("fview_id")];
		if (oView) {
			oView.attrs = oView.attrs || {};
			oView.attrs [o.get ("fcode")] = o;
		};
	};
	// Список атрибутов классов
	storage.classAttrs = null;
	// Карта атрибутов классов
	storage.classAttrsMap = null;
	// Init classAttrs
	storage.initClassAttrs = function (options) {
		log.debug ({cls: "storage", fn: "initClassAttrs"});
		options = options || {};
		var success = options.success;
		options.session = options.session || {};
		var session = options.session;
		storage.query ({session: session, sql: "select * from tclass_attr where " + storage.getCurrentFilter (), success: function (options) {
			var rows = options.result.rows;
			// get fields
			var fields = [];
			for (var field in rows [0]) {
				fields.push (field);
			}
			// get storage.classAttrs
			storage.classAttrs = [];
			storage.classAttrsMap = {};
			for (var i = 0; i < rows.length; i ++) {
				var o = new storage.tobject ({code: "tclass_attr"});
				for (var j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				storage.classAttrs.push (o);
				storage.classAttrsMap [o.get ("fid")] = o;
				if (storage.classesMap [o.get ("fclass_id")]) {
					var addClassAttr = function (oClass) {
						oClass.attrs = oClass.attrs || {};
						oClass.attrs [o.get ("fcode")] = o;
						for (var i = 0; i < oClass.childs.length; i ++) {
							addClassAttr (storage.classesMap [oClass.childs [i]]);
						}
					};
					addClassAttr (storage.classesMap [o.get ("fclass_id")]);
				}
			}
			if (success) {
				success ();
			}
		}});	
	};
	// Список представлений
	storage.views = null;
	// Карта представлений по id
	storage.viewsMap = null;
	// Карта представлений по code {'spr.task': viewObject}
	storage.viewsCode = null;
	// Дерево представлений по кодам: {viewCode: {viewChildCode: ...}}
	storage.viewsTree = null;
	storage.initViews = function (options) {
		log.debug ({cls: "storage", fn: "initViews"});
		options = options || {};
		var success = options.success;
		options.session = options.session || {};
		var session = options.session;
		storage.query ({session: session, sql: "select * from tview where " + storage.getCurrentFilter (), success: function (options) {
			var rows = options.result.rows;
			var fields = [];
			for (var field in rows [0]) {
				fields.push (field);
			}
			storage.views = [];
			storage.viewsMap = {};
			for (var i = 0; i < rows.length; i ++) {
				var o = new storage.tobject ({code: "tview"});
				for (var j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				storage.views.push (o);
				storage.viewsMap [o.get ("fid")] = o;
			}
			storage.viewsTree = {};
			storage.viewsCode = {};
			var getTree = function (options) {
				for (var i = 0; i < storage.views.length; i ++) {
					var o = storage.views [i];
					if (o.get ("fparent_id") == options.parent) {
						options.node [o.get ("fcode")] = {id: o.get ("fid")};
						var code = options.code ? options.code + "." + o.get ("fcode") : o.get ("fcode");
						storage.viewsCode [code] = o;
						if (code) {
							var tokens = code.split (".");
							if (tokens.length == 3) {
								storage.viewsCode [tokens [0] + "." + tokens [2]] = storage.viewsCode [tokens [0] + "." + tokens [2]] || o;
							}
							if (tokens.length == 4) {
								storage.viewsCode [tokens [0] + "." + tokens [3]] = storage.viewsCode [tokens [0] + "." + tokens [3]] || o;
							}
						};
						getTree ({node: options.node [o.get ("fcode")], parent: o.get ("fid"), code: code});
					}
				}
			}
			getTree ({node: storage.viewsTree, parent: null});
			if (success) {
				success ();
			}
		}});	
	};
	// Список атрибутов представлений
	storage.viewAttrs = null;
	// Карта атрибутов представлений
	storage.viewAttrsMap = null;
	storage.initViewAttrs = function (options) {
		log.debug ({cls: "storage", fn: "initViewAttrs"});
		options = options || {};
		var success = options.success;
		options.session = options.session || {};
		var session = options.session;
		storage.query ({session: session, sql: "select * from tview_attr where " + storage.getCurrentFilter (), success: function (options) {
			var rows = options.result.rows;
			var fields = [];
			for (var field in rows [0]) {
				fields.push (field);
			}
			storage.viewAttrs = [];
			storage.viewAttrsMap = {};
			for (var i = 0; i < rows.length; i ++) {
				var o = new storage.tobject ({code: "tview_attr"});
				for (var j = 0; j < fields.length; j ++) {
					o.data [fields [j]] = rows [i][fields [j]];
				}
				if (o.get ("fcode") == null) {
					continue;
				};
				o.toc = o.get ("fcode").toLowerCase () + "_" + o.get ("fid");
				storage.viewAttrs.push (o);
				storage.viewAttrsMap [o.get ("fid")] = o;
				if (storage.viewsMap [o.get ("fview_id")]) {
					storage.viewsMap [o.get ("fview_id")].attrs = storage.viewsMap [o.get ("fview_id")].attrs || {};
					storage.viewsMap [o.get ("fview_id")].attrs [o.get ("fcode")] = o;
				}
			}
			if (success) {
				success ();
			}
		}});	
	};
	// options: {node, path}
	// todo: не понимает коротких путей
	storage.findNode = function (options) {
		log.debug ({cls: "storage", fn: "findNode"});
		var node = options.node;
		var path = options.path;
		var foundNode;
		if (typeof (path) == "string") {
			path = path.split (".");
		};		
		var key = path [0];
		if (node.hasOwnProperty (key)) {
			if (path.length > 1) {
				path.splice (0, 1);
				foundNode = storage.findNode ({node: node [key], path: path});
			} else {
				foundNode = node [key];
			};
		}
		if (typeof (foundNode) == "object") {
			foundNode = foundNode.id;
		}
		return foundNode;
	};
	// Получение класса
	// options: {classCode or code}
	storage.getClass = function (options) {
		log.debug ({cls: "storage", fn: "getClass"});
		if (typeof (options) == "number") {
			if (storage.classesMap [options]) {
				return storage.classesMap [options];
			} else {
				throw new VError ("storage.getClass - Unknown classId: " + options);
			}
		} else {
			if (typeof (options) == "string") {
				options = {code: options};
			};
			var code = options.classCode || options.code;
			if (storage.classesCode [code]) {
				return storage.classesCode [code];
			} else {
				if (storage.classesMap [code]) {
					return storage.classesMap [code];
				} else {
					throw new VError ("storage.getClass - Unknown classCode: " + code);
				}
			}
		};
	};
	// Получение атрибута класса
	// options: {classCode (classId), attrCode}
	storage.getClassAttr = function (options) {
		log.debug ({cls: "storage", fn: "getClassAttr (" + JSON.stringify (options) + ")"});
		if (typeof (options) == "number") {
			if (storage.classAttrsMap [options]) {
				return storage.classAttrsMap [options];
			} else {
				throw new Error ("storage.getClassAttr - Unknown classAttrId: " + options);
			}
		} else {
			var oClass;
			if (options.classCode) {
				oClass = storage.classesCode [options.classCode];
			} else {
				oClass = storage.classesMap [options.classId];
			}
			if (oClass) {
				function getAttr (o) {
					if (o.attrs && o.attrs [options.attrCode]) {
						return o.attrs [options.attrCode];
					} else {
						if (o.get ("fparent_id")) {
							return getAttr (storage.classesMap [o.get ("fparent_id")]);
						} else {
							throw new Error ("storage.getClassAttr - Unknown attrCode: " + options.attrCode + " (classId: " + (options.classId || options.classCode) + ")");
						}
					}
				};
				var o = getAttr (oClass)
				return o;
			} else {
				throw new Error ("storage.getClassAttr - Unknown classCode: " + options.classCode + " (classId: " + options.classId || options.classCode + ")");
			}
		};
	};
	// {session, id, success}
	storage.getObject = function (options) {
		log.debug ({cls: "Storage", fn: "getObject", id: options.id});
		options = options || {};
		var success = options.success;
		var failure = options.failure;
		var objectId = options.id;
		options.session = options.session || {};
		var session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		var revision = session.revision;
		if (!objectId || Number (objectId) == NaN) {
			if (success) {
				success ({object: null});
			};
			return;
		};
		var object;
		async.series ([
			function (cb) {
				storage.fireEvent ("beforegetobject", {
					objectId: objectId,
					session: session,
					storage: storage,
					success: function (options) {
						if (options && options.cancel) {
							cb ("cancel");
						} else {
							cb ();
						};
					}
				});
			},
			function (cb) {
				storage.redisClient.hmget (storage.code + "-objects" + (revision || ""), [objectId + "-data"], function (err, result) {
					var o = new storage.tobject ({code: "tobject"});
					if (result && result [0]) {
						o.data = eval ("(" + result [0] + ")");
						o.originalData = {};
						for (var attr in o.data) {
							o.originalData [attr] = o.data [attr];
						}
						object = o;
						cb ();
					} else {
						if (revision) {
							// time machine
							var cls, row;
							async.series ([
								function (cb) {
									storage.query ({session: session, sql: 
										"select fclass_id from tobject where fid=" + objectId
									, success: function (options) {
										cls = storage.getClass (options.result.rows [0].fclass_id);
										cb ();
									}});
								},
								function (cb) {
									var fields = [];
									function addFields (attrs) {
										for (var attr in attrs) {
											fields.push (attrs [attr].toc);
										};
									};
									addFields (cls.attrs);
									var joins = "";
									function addJoins (parent) {
										if (parent) {
											var clsParent = storage.getClass (parent);
											joins += "left join tm_" + clsParent.toc + " on (tm_" + clsParent.toc + ".fobject_id=tm_" + cls.toc + ".fobject_id and tm_" + clsParent.toc + ".frevision_id=tm_" + cls.toc + ".frevision_id)\n";
											addFields (clsParent.attrs);
											addJoins (clsParent.get ("fparent_id"));
										};
									};
									addJoins (cls.get ("fparent_id"));
									var s = 
										"select " + fields.join (", ") + " from tm_" + cls.toc + "\n" +
										joins +
										"where tm_" + cls.toc + ".fobject_id=" + objectId + " and tm_" + cls.toc + ".frevision_id=" + revision
									;
									storage.query ({session: session, sql: s, success: function (options) {
										row = options.result.rows [0];
										cb ();
									}});
								},
								function (cb) {
									o.data.id = objectId;
									o.data.fclass_id = cls.get ("fid");
									for (var attr in cls.attrs) {
										var ca = cls.attrs [attr];
										o.data [attr] = row [ca.toc];
										o.originalData [attr] = row [ca.toc];
									};
									var hdata = {};
									hdata [objectId + "-data"] = o.dataToJSONString (true);
									storage.redisClient.hmset (storage.code + "-objects" + revision, hdata);
									object = o;
									cb ();
								}
							], function (err) {
								cb ();
							});
						} else {
							var select = "select a.fclass_attr_id, a.fstring, a.ftime, fnumber, b.fclass_id";
							storage.query ({session: session, sql: 
								select + "\n" +
								"from tobject b\n" +
								"left join tobject_attr a on (a.fobject_id=b.fid and " + storage.getCurrentFilter ({alias: "a"}) + ")\n" +
								"where b.fid=" + objectId + " and " + storage.getCurrentFilter ({alias: "b"})
							, success: function (options) {
								if (!options || !options.result || !options.result.rows || options.result.rows.length == 0) {
									object = null;
									cb ();
								} else {
									var rows = options.result.rows;
									o.data.id = objectId;
									o.data.fclass_id = rows [0].fclass_id;
									for (var i = 0; i < rows.length; i ++) {
										if (!rows [i].fclass_attr_id) {
											continue;
										};
										var classAttr = storage.classAttrsMap [rows [i].fclass_attr_id];
										if (!classAttr) {
											// Deleted class attr
											continue;
										}
										var value;
										if (classAttr.get ("ftype_id") == 1 || classAttr.get ("ftype_id") == 5) {
											value = rows [i].fstring;
										} else
										if (classAttr.get ("ftype_id") == 3) {
											value = rows [i].ftime;
										} else {
											value = rows [i].fnumber;
										}
										o.data [classAttr.get ("fcode")] = value;
										o.originalData [classAttr.get ("fcode")] = value;
									}
									if (!storage.revision [session.id]) {
										var hdata = {};
										hdata [objectId + "-data"] = o.dataToJSONString (true);
										storage.redisClient.hmset (storage.code + "-objects", hdata);
									};
									object = o;
									cb ();
								}
							}, failure: cb});
						};
					}
				});
			},
			function (cb) {
				storage.fireEvent ("aftergetobject", {
					object: object,
					session: session,
					storage: storage,
					success: function (options) {
						if (options && options.cancel) {
							cb ("cancel");
						} else {
							cb ();
						};
					}
				});
			}
		], function (err, results) {
			if (err) {
				success ({object: null});
			} else {
				success ({object: object});
			};
		});
	},
	storage.createObject = function (options) {
		if (typeof (options) == "string") {
			options = {code: options};
		};
		log.debug ({cls: "Storage", fn: "createObject", params: options.classId || options.code});
		options = options || {};
		var mainOptions = options;
		var success = options.success;
		var failure = options.failure;
		var classId = options.classId || storage.getClass (options.code).get ("fid");
		var userOptions = options.options || {};
		options.session = options.session || {};
		var session = options.session;
		async.series ([
			function (cb) {
				storage.fireEvent ("beforecreateobject", {
					classId: classId,
					session: session,
					storage: storage,
					success: function (options) {
						if (options && options.cancel) {
							cb ("cancel");
						} else {
							cb ();
						};
					}
				});
			}
		], function (err, results) {
			if (err == "cancel" || !storage.revision [session.id]) {
				console.log ("cancel or no transaction, session " + JSON.stringify (session));
				success ({object: null});
				return;
			};
			storage.clsChange ({classId: classId});
			storage.client.getNextId ({session: session, table: "tobject", success: function (options) {
				var sql = [];
				var objectId = mainOptions.objectId || options.id;
				sql.push (
					"insert into tobject (fid, fclass_id, fstart_id, fend_id)\n" +
					"values (" + objectId + "," + classId + "," + storage.revision [session.id] + "," + storage.maxRevision + ")"
				);
				var insertTOC = function (options) {
					var classObject = storage.classesMap [options.classId];
					var tocName = classObject.get ("fcode") + "_" + options.classId;
					sql.push ("insert into " + tocName + " (fobject_id) values (" + objectId + ")");
					if (classObject.get ("fparent_id")) {
						insertTOC ({classId: classObject.get ("fparent_id")});
					}
				};
				if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
					insertTOC ({classId: classId});
				};
				async.eachSeries (sql, function (sql, cb) {
					storage.query ({session: session, sql: sql, success: function (result) {
						cb ();
					}, failure: cb});
				}, function (err) {
					if (err) {
						if (failure) {
							failure (new VError (err, "Storage.createObject"));
						};
					} else {
						if (success) {
							var o = new storage.tobject ({code: "tobject"});
							o.data.id = objectId;
							o.data.fclass_id = classId;
							userOptions.object = o;
							var hdata = {};
							hdata [objectId + "-data"] = o.dataToJSONString ();
							storage.redisClient.hmset (storage.code + "-objects", hdata);
							if (storage.revisions [storage.revision [session.id]]) {
								storage.revisions [storage.revision [session.id]].objects.created.push (objectId);
								storage.revisions [storage.revision [session.id]].objects.classId [objectId] = classId;
							};
							storage.fireEvent ("aftercreateobject", {
								classId: classId,
								session: session,
								object: o,
								storage: storage,
								success: function (options) {
									success (userOptions);
								}
							});
						}
					};
				});
			}, failure: function (err) {
				if (failure) {
					failure (new VError (err, "Storage.createObject"));
				};
			}});	
		})
	},
	// Object class
	storage.tobject = function (options) {
		var me = this;
		me.code = options.code;
		me.data = {};
		me.originalData = {};
		me.removed = false;
	};
	// get attr
	storage.tobject.prototype.get = function (attrCode) {
		return this.data [attrCode];
	};
	// set attr
	storage.tobject.prototype.set = function (attrCode, value) {
		this.data [attrCode] = value;
	};
	storage.getClassAttrs = function (options) {
		log.debug ({cls: "storage", fn: "getClassAttrs"});
		options.result = options.result || {};
		for (var i = 0; i < storage.classAttrs.length; i ++) {
			if (storage.classAttrs [i].get ("fclass_id") == options.classId) {
				options.result [storage.classAttrs [i].get ("fcode")] = storage.classAttrs [i];
			}
		}
		if (storage.classesMap [options.classId].get ("fparent_id")) {
			options.classId = storage.classesMap [options.classId].get ("fparent_id");
			storage.getClassAttrs (options);
		}
		return options.result;
	};
	storage.getDependentObjects = function (options) {
		var session = options.session;
		var object = options.object;
		var success = options.success;
		var failure = options.failure;
		// classes
		var getParentClasses = function (classId) {
			var r = [classId];
			var o = storage.classesMap [classId];
			if (o.get ("fparent_id")) {
				r = r.concat (getParentClasses (o.get ("fparent_id")));
			}
			return r;
		};
		var getChildClasses = function (classId) {
			var r = [classId];
			var o = storage.classesMap [classId];
			for (var i = 0; i < o.childs.length; i ++) {
				r = r.concat (getChildClasses (storage.classesMap [o.childs [i]].get ("fid")));
			}
			return r;
		};
		var classes = getParentClasses (object.data.fclass_id).concat (getChildClasses (object.data.fclass_id));
		classes.push (12); // Object
		// classAttrs
		var classAttrs = [];
		for (var i = 0; i < storage.classAttrs.length; i ++) {
			var ca = storage.classAttrs [i];
			if (classes.indexOf (ca.get ("ftype_id")) > -1) {
				classAttrs.push (ca.get ("fid"));
			}
		}
		if (classAttrs.length) {
			var cascade = []; // objects for cascade removing
			var setnull = []; // objects for set null
			storage.query ({session: session, sql: 
				"select fobject_id, fclass_attr_id from tobject_attr\n" +
				"where fclass_attr_id in (" + classAttrs.join (",") + ") and fnumber=" + object.data.id + " and " + storage.getCurrentFilter () + "\n"
			, success: function (options) {
				var rows = options.result.rows;
				for (var i = 0; i < rows.length; i ++) {
					var removeRule = storage.classAttrsMap [rows [i].fclass_attr_id].get ("fremove_rule");
					if (removeRule == "cascade") {
						cascade.push (rows [i].fobject_id);
					} else {
						setnull.push ({id: rows [i].fobject_id, attrCode: ca.get ("fcode")});
					}
				}
				success ({cascade: cascade, setnull: setnull});
			}, failure: function (err) {
				if (failure) {
					failure (new VError (err, "Storage.getDependentObjects"));
				};
			}});
		} else {
			success ({cascade: cascade, setnull: setnull});
		}
	};
	// {session, object, success}
	storage.removeObject = function (options) {
		var session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		var removeSingleObject = function (options) {
			var object = options.object;
			var objectId = object.data.id;
			var success = options.success;
			var failure = options.failure;
			var sql = [];
			sql.push ("update tobject set fend_id=" + storage.revision [session.id] + " where fend_id=" + storage.maxRevision + " and fid=" + objectId);
			var deleteTOC = function (options) {
				var classObject = storage.classesMap [options.classId];
				var tocName = classObject.get ("fcode") + "_" + options.classId;
				sql.push ("delete from " + tocName + " where fobject_id=" + objectId);
				if (classObject.get ("fparent_id")) {
					deleteTOC ({classId: classObject.get ("fparent_id")});
				}
			};
			if (!storage.connection.dbEngine || !storage.connection.dbEngine.enabled) {
				deleteTOC ({classId: object.data.fclass_id});
			};
			async.map (sql, function (s, cb) {
				storage.query ({session: session, sql: s, success: function () {
					cb ();
				}, failure: cb});
			}, function (err, results) {
				if (err) {
					if (failure) {
						return failure (new VError (err, "Storage.removeSingleObject"));
					};
				};
				var oClass = storage.classesMap [object.data.fclass_id];
				var attrs = [];
				for (var a in object.originalData) {
					if (object.originalData [a]) {
						attrs.push (a);
					}
				}
				async.map (attrs, function (attr, cb) {
					var ca = oClass.attrs [attr];
					if (ca && ca.get ("funique")) {
						var key = storage.code + "-unique-" + ca.get ("fid");
						storage.redisClient.srem (key, object.originalData [attr], function (err, result) {
							cb ();
						});
					} else {
						cb ();
					}
				}, function (err, results) {
					storage.redisClient.hdel (storage.code + "-objects", objectId + "-data", function (err, result) {
						if (success) {
							success ();
						}
					});
				});
			});
		};
		var success = options.success;
		var failure = options.failure;
		var mainOptions = options;
		if (!options.object) {
			if (success) {
				success ({cascadeNum: 0, setnullNum: 0});
			}
			return;
		}
		var cascade;
		var cascadeNum;
		var setnull;
		var setnullNum;
		async.series ([
			function (cb) {
				storage.fireEvent ("beforeremoveobject", {
					object: options.object,
					session: session,
					storage: storage,
					success: function (options) {
						if (options && options.cancel) {
							cb ("cancel");
						} else {
							cb ();
						};
					}
				});
			},
			function (cb) {
				storage.suspendEvent ("beforeremoveobject");
				storage.getDependentObjects ({session: session, object: options.object, success: function (options) {
					cascade = options.cascade;
					cascadeNum = cascade.length;
					setnull = options.setnull;
					setnullNum = setnull.length;
					async.parallel ([
						function setNullAttrs (cb) {
							async.map (setnull, function (snObject, cb) {
								storage.getObject ({session: session, id: snObject.id, success: function (options) {
									var o = options.object;
									if (o) {
										o.set (snObject.attrCode, null);
										o.commit ({session: session, success: function () {
											cb ();
										}, failure: function (err) {
											cb ();
										}});
									} else {
										cb ();
									}
								}, failure: function (err) {
									cb ();
								}});
							}, function (err, results) {
								cb ();
							});
						},
						function removeCascadeObjects (cb) {
							async.map (cascade, function (objectId, cb) {
								storage.getObject ({session: session, id: objectId, success: function (options) {
									storage.removeObject ({session: session, object: options.object, success: function (options) {
										cascadeNum += options.cascadeNum;
										setnullNum += options.setnullNum;
										cb ();
									}, failure: function (err) {
										cb ();
									}});
								}, failure: function (err) {
									cb ();
								}});
							}, function (err, results) {
								cb ();
							});
						},
						function removeCurrentObject (cb) {
							mainOptions.success = function () {
								cb ();
							};
							mainOptions.failure = function () {
								cb ();
							};
							removeSingleObject (mainOptions);
						}
					], function (err, results) {
						cb ();
					});
				}, failure: cb});
			}
		], function (err, results) {
			storage.resumeEvent ("beforeremoveobject");
			if (err == "cancel") {
				if (success) {
					success ({cascadeNum: 0, setnullNum: 0});
				};
			} else {
				if (success) {
					success ({cascadeNum: cascadeNum, setnullNum: setnullNum});
				}
			};
		});
	};
	// save changes to database
	storage.tobject.prototype.commit = function (options) {
		log.debug ({cls: "Object", fn: "commit"});
		options = options || {};
		options.session = options.session || {};
		var session = options.session;
		storage.redisClient.hset ("sessions", session.id + "-clock", config.clock);
		var success = options.success;
		var failure = options.failure;
		var objectId = this.data.id;
		var object = this;
		async.series ([
			function (cb) {
				if (object.removed) {
					cb ();
				} else {
					storage.fireEvent ("beforecommitobject", {
						object: object,
						session: session,
						storage: storage,
						success: function (options) {
							if (options && options.cancel) {
								cb ("cancel");
							} else {
								cb ();
							};
						}
					});
				};
			}
		], function (err, results) {
			if (err == "cancel" || !storage.revision [session.id]) {
				if (success) {
					success ();
				};
				return;
			};
			if (storage.revisions [storage.revision [session.id]]) {
				storage.revisions [storage.revision [session.id]].objects.changed.push (objectId);
				storage.revisions [storage.revision [session.id]].objects.classId [objectId] = object.get ("fclass_id");
			};
			if (object.removed) {
				if (storage.revisions [storage.revision [session.id]]) {
					storage.revisions [storage.revision [session.id]].objects.removed.push (objectId);
				};
				storage.clsChange ({session: session, classId: object.get ("fclass_id")});
				storage.removeObject ({session: session, object: object, success: success, failure: function (err) {
					failure (new VError (err, "Object.commit"));
				}});
			} else {
				var attrs = [];
				for (var attr in object.data) {
					if (["id", "fclass_id"].indexOf (attr) > -1) {
						continue;
					}
					if (_.isDate (object.originalData [attr])) {
						object.originalData [attr] = common.getLocalISOString (object.originalData [attr]);
					}
					if (_.isDate (object.data [attr])) {
						object.data [attr] = common.getLocalISOString (object.data [attr]);
					}
					if (!object.originalData.hasOwnProperty (attr) || object.originalData [attr] != object.data [attr]) {
						attrs.push (attr);
					}
				}
				if (!attrs.length) {
					if (success) {
						success ();
					}
				} else {
					async.series ([
						function (cb) {
							var oClass = storage.classesMap [object.data.fclass_id];
							async.map (attrs, function (attr, cb) {
								var ca = oClass.attrs [attr];
								if (ca && ca.get ("funique")) {
									var key = storage.code + "-unique-" + ca.get ("fid");
									async.series ([
										function addNew (cb) {
											if (object.data [attr]) {
												storage.redisClient.sadd (key, object.data [attr], function (err, result) {
													if (result) {
														cb ();
													} else {
														cb ("value exists: " + object.data [attr]);
													}
												});
											} else {
												cb ();
											}
										},
										function removeOld (cb) {
											if (object.originalData [attr]) {
												storage.redisClient.srem (key, object.originalData [attr], function (err, result) {
													cb ();
												});
											} else {
												cb ();
											};
										}
									], function (err, results) {
										cb (err);
									});
								} else {
									cb ();
								}
							}, function (err, results) {
								cb (err);
							});
						},
						function (cb) {
							storage.clsChange ({session: session, classId: object.get ("fclass_id")});
							var classAttrs = storage.getClassAttrs ({classId: object.get ("fclass_id")});
							var toc = {};
							var sql = [], sqlU = [], sqlI = [];
							for (var i = 0; i < attrs.length; i ++) {
								var value = object.data [attrs [i]];
								if (value === true || value === false) {
									value = Number (value);
								}
								var ca = classAttrs [attrs [i]];
								if (!ca) {
									continue;
								}
								sqlU.push ({
									sql: "update tobject_attr set fend_id=" + storage.revision [session.id] + "\n" +
										"where fobject_id=" + objectId + " and fclass_attr_id=" + ca.get ("fid") + " and fend_id=" + storage.maxRevision
								});
								var valueField = "fnumber";
								if (ca.get ("ftype_id") == 1 || ca.get ("ftype_id") == 5) {
									valueField = "fstring";
								} else
								if (ca.get ("ftype_id") == 3) {
									valueField = "ftime";
									if (typeof (value) == "string" && (value || "").trim () == "") {
										value = null;
									}
								}
								if (valueField == "fnumber" && (isNaN (value) || value === "")) {
									value = null;
								};
								sqlI.push ({
									sql: "insert into tobject_attr (fobject_id, fclass_attr_id, " + valueField + ", fstart_id, fend_id)\n" +
										"values (" + objectId + "," + ca.get ("fid") + ", $1, " + storage.revision [session.id] + "," + storage.maxRevision + ")",
									params: [value]
								});
								var classId = ca.get ("fclass_id");
								toc [classId] = toc [classId] || {name: storage.classesMap [classId].get ("fcode") + "_" + ca.get ("fclass_id")};
								toc [classId].attrs = toc [classId].attrs || {};
								toc [classId].attrs [ca.get ("fcode") + "_" + ca.get ("fid")] = value;
							};
							sql = sqlU.concat (sqlI);
							var processObjectAttr = function (cb) {
								async.mapSeries (sql, function (s, cb) {
									storage.query ({session: session, sql: s.sql, params: s.params, success: function () {
										cb ();
									}, failure: cb});
								}, cb);
							};
							var tocArray = [];
							for (var classId in toc) {
								tocArray.push (toc [classId]);
							};
							var processTOC = function (cb) {
								async.mapSeries (tocArray, function (t, cb) {
									storage.query ({
										session: session,
										sql: "select fobject_id from " + t.name + " where fobject_id=" + objectId, 
										success: function (options) {
											if (options.result.rows.length == 0) {
												var fields = ["fobject_id"];
												var params = [objectId];
												var $params = "$1";
												for (var attr in t.attrs) {
													fields.push (attr);
													params.push (t.attrs [attr]);
													$params += ", $" + params.length;
												}
												storage.query ({
													session: session, 
													sql: "insert into " + t.name + " (" + fields.join (",") + ") values (" + $params + ")",
													params: params,
													success: function () {
														cb ();
													},
													failure: function () {
														cb ();
													}
												});
											} else {
												var fields = [];
												var params = [];
												for (var attr in t.attrs) {
													var value = t.attrs [attr];
													if (value === "") {
														value = null;
													}
													params.push (value);
													fields.push (attr + "=$" + params.length);
												}
												storage.query ({
													session: session, 
													sql: "update " + t.name + " set " + fields.join (",") + "\n" +
														"where fobject_id=" + objectId,
													params: params,
													success: function () {
														cb ();
													},
													failure: function () {
														cb ();
													}
												});
											}
										},
										failure: cb
									});
								}, function (err, results) {
									cb (err);
								});
							};
							var functions = [processObjectAttr, processTOC];
				   			//if (storage.connection.dbEngine && storage.connection.dbEngine.enabled) {
							//	functions = [processObjectAttr];
				   			//};
							async.series (functions, function (err, results) {
								cb (err);
							});
						}
					], function (err, results) {
						if (err) {
							if (failure) {
								failure (new VError (err, "Object.commit"));
							} else {
								log.error ({cls: "Object", fn: "commit", err: err});
								if (success) {
									success ();
								};
							}
						} else {
							storage.redisClient.hdel (storage.code + "-objects", objectId + "-data");
							if (success) {
								success ();
							}
						}
					});
				};
			};
		});
	};
	storage.tobject.prototype.sync = function (options) {
		this.commit.call (this, options);
	};
	// remove object
	storage.tobject.prototype.remove = function () {
		this.removed = true;
	};
	storage.tobject.prototype.dataToJSONString = function (utc) {
		var r;
		for (var attr in this.data) {
			if (!r) {
				r = "{";
			} else {
				r += ",";
			}
			r += '"' + attr + '":' + common.ToJSONString (this.data [attr], utc);
		}
		r += "}";
		return r;
	};
	storage.dataId = {};
	// Получить ид через код
	// options: {classCode, code}
	storage.getId = function (options) {
		log.debug ({cls: "storage", fn: "getId"});
		options = options || {};
		options.session = options.session || {};
		var session = options.session;
		var success = options.success;
		var failure = options.failure;
		var classCode = options.classCode;
		var valueCode = options.valueCode || options.code;
		if (!valueCode) {
			success ({id: null});
			return;
		};
		function returnResult () {
			if (storage.dataId.hasOwnProperty (classCode) && storage.dataId [classCode].hasOwnProperty (valueCode)) {
				log.trace ({cls: "storage", fn: "getId", classCode: classCode, valueCode: valueCode}, storage.dataId [classCode][valueCode]);
				success ({id: storage.dataId [classCode][valueCode]});
			} else {
				log.trace ({cls: "storage", fn: "getId", classCode: classCode, valueCode: valueCode}, "unknown");
				var e = {error: "unknown value. classCode: " + classCode + ", valueCode: " + valueCode, module: "storage", fn: "getId"};
				if (failure) {
					failure (e);
				} else {
					success ({id: null});
				}
			}
		};
		if (storage.dataId [classCode] == null) {
			storage.execute ({sql: {
				"select": [
					{"a":"id"}, "id",
					{"a":"code"}, "code"
				],
				"from": [
					{"a": classCode}
				]
			}, success: function (r) {
				storage.dataId [classCode] = {};
				for (var i = 0; i < r.length; i ++) {
					storage.dataId [classCode][r.get (i, "code")] = r.get (i, "id");
				};
				returnResult ();
			}});
		} else {
			returnResult ();
		};
	};	
	// {sql: {select, from (inner-join, left-join), where, order}, success}
	storage.execute = function (options, cb) {
		var mainOptions = options;
		var success = options.success;
		var failure = options.failure;
		var session = options.session;
		options.storage = storage;
		var query = new Query (options);
		query.generate ();
		var fields = query.fields;
		var sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
		// todo: limit for mssql
		if (storage.client.database != "mssql") {
			sql += "\nlimit " + (options.sql.limit || config.query.maxRowNum) + " offset " + (options.sql.offset || "0") + "\n";
		};
		storage.query ({session: session, sql: sql, success: function (options) {
			if (mainOptions.resultText) {
				var r = "[";
				if (options.result) {
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
							r += common.ToJSONString (rows [i][fields [j]]);
						}
						r += "]";
					}
				}
				r += "]";
				if (cb) {
					cb (null, r);
				} else {
					success ({result: r});
				}
			} else
			if (mainOptions.asArray || mainOptions.sql.asArray) {
				var attrs = [];
				_.each (mainOptions.sql.select, function (s) {
					if (typeof (s) == "string") {
						attrs.push (s);
					}
				});
				var recs = [];
				_.each (options.result.rows, function (row) {
					var rec = {};
					_.each (fields, function (f, i) {
						rec [attrs [i]] = row [f];
					});
					recs.push (rec);
				});
				if (cb) {
					cb (null, recs);
				} else {
					success (recs);
				}
			} else {
				if (options && options.result && options.result.rows) {
					options.rows = options.result.rows;
					options.length = options.rows.length;
					options.get = function (i, f) {
						if (i >= options.length) {
							return null;
						};
						return options.rows [i][f + "_"];
					};
				};
				if (cb) {
					cb (null, options);
				} else {
					success (options);
				}
			}
		}, failure: function (err) {
			if (cb) {
				cb (new VError (err, "Storage.execute"));
			} else
			if (failure) {
				failure (new VError (err, "Storage.execute"));
			} else {
				throw new Error ("storage.execute: " + err);
			};
		}});
	};
	storage.prepareSQLForCount = function (sql, total) {
		function getAlias (o) {
			var a;
			for (a in o) {
				if (a != "distinct") {
					break;
				}
			}
			return a;
		};
		function isAliasInArray (arr, a) {
			if (!_.isArray (arr)) {
				return false;
			}
			for (var i = 0; i < arr.length; i ++) {
				var o = arr [i];
				if (_.isArray (o)) {
					var r = isAliasInArray (o, a);
					if (r) {
						return r;
					}
				}
				if (_.isObject (o) && getAlias (o) == a) {
					return true;
				}
			}
			return false;
		};
		function isAliasInLeftJoins (joins, alias) {
			var has = false;
			_.each (joins, function (v, a) {
				if (v && v [0] != "inner-join" && a != alias && isAliasInArray (v, alias)) {
					has = true;
				}
			});
			return has;
		};
		function getJoins (sql, total) {
			var alias, joins = {};
			_.each (sql.from, function (o, i) {
				if (o == "left-join" || o == "inner-join") {
					alias = getAlias (sql.from [i + 1]);
				}
				if (alias) {
					joins [alias] = joins [alias] || [];
					joins [alias].push (o);
				}
			});
			_.each (joins, function (arr, alias) {
				var remove = false;
				if (arr [0] != "inner-join") {
					if (!isAliasInArray (sql.where, alias) &&
						!isAliasInArray (sql.order, alias) &&
						!isAliasInArray (sql.orderAfter, alias) &&
						!isAliasInLeftJoins (joins, alias)
					) {
						remove = true;
					}
					if (total) {
						var has = false;
						for (var i = 0; i < sql.select.length; i += 2) {
							if (getAlias (sql.select [i]) == alias && total [sql.select [i + 1]]) {
								has = true;
								break;
							}
						};
						if (has) {
							remove = false;
						}
					}
				}
				if (remove) {
					joins [alias] = null;
				}
			});
			return joins;
		}
		var joins = getJoins (sql, total);
		var r = {};
		_.each (sql, function (v, k) {
			if (k == "select") {
				r.select = [];
				for (var i = 0; i < v.length; i += 2) {
					var a = getAlias (v [i]);
					if (joins [a] || a == getAlias (sql.from [0])) {
						r.select.push (v [i]);
						r.select.push (v [i + 1]);
					}
				}
			} else
			if (k == "from") {
				r.from = [v [0]];
				_.each (joins, function (v, a) {
					if (v) {
						_.each (v, function (v, a) {
							r.from.push (v);
						});
					}
				});
			} else {
				r [k] = v;
			}
		});
		return r;
	};
	storage.getContent = function (options) {
		var viewId = options.viewId;
		var column = options.column;
		var row = options.row;
		var columnCount = options.columnCount;
		var rowCount = options.rowCount;
		var parentId = options.parentId;
		var filter = options.filter;
		var order = options.order;
		var total = options.total;
		var dateAttrs = options.dateAttrs || [];
		var timeOffsetMin = options.timeOffsetMin;
		var success = options.success;
		var failure = options.failure;
		var request = options.request;
		options.session = options.session || request.session || {};
		var session = options.session;
		var view = storage.viewsMap [viewId];
		var viewQuery = JSON.parse (view.get ("fquery"));
		if (!viewQuery || filter == "unselected") {
			var r = 
				"{\n" +
				"\tview: " + viewId + ",\n" +
				"\tcolumnCount: 0,\n" +
				"\theaderDepth: 0,\n" +
				"\tcolumn: {\n" +
				"\t},\n" +
				"\ttree: {\n" +
				"\t\tlength: 0\n" +
				"\t}\n" +
				"}"
			;
			if (success) {
				success ({result: r});
			}
			return;
		}
		if (filter && filter.length) {
			viewQuery.where = viewQuery.where || [];
			if (viewQuery.where.length) {
				viewQuery.where = [viewQuery.where];
				viewQuery.where.push ("and");
			}
			viewQuery.where.push (filter);
		}
		if (order && order.length) {
			if (viewQuery.orderAfter) {
				viewQuery.orderAfter = order;
			} else {
				viewQuery.order = order;
			}
		};
		function addOrderId (sql) {
			var alias; for (alias in sql.from [0]) {break;};
			var order = sql.orderAfter || sql.order;
			order = order || [];
			var has = 0;
			for (var i = 0; i < order.length; i ++) {
				if (typeof (order [i]) == "object") {
					for (var a in order [i]) {
						if (order [i][a] == "id") {
							has = 1;
						};
					};
				};
			};
			if (!has) {
				if (["system.class", "system.class_attr", "system.view", "system.view_attr", "system.action", "system.action_attrs", "system.object", "system.object_attr", "system.revision"].indexOf (sql.from [0][alias]) == -1) {
					if (order.length) {
						order.push (",");
					};
					var f = {}; f [alias] = "id";
					order.push (f);
				};
			};
			if (sql.orderAfter) {
				sql.orderAfter = order;
			} else {
				sql.order = order;
			}
		};
		addOrderId (viewQuery);
		var query, rows, totalRow, sql, classes = [];
		async.series ([
			function (cb) {
				if (config.caching && config.caching.getContent) {
					storage.redisClient.hget (storage.code + "-content", request.storageParam, function (err, result) {
						if (result) {
							cb (result);
						} else {
							cb ();
						}
					});
				} else {
					cb ();
				};
			},
			function (cb) {
				query = new Query ({storage: storage, session: session, sql: viewQuery});
				query.generate ();
				sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
				for (var a in query.attrs) {
					var getClasses = function (classId) {
						classes.push (classId);
						var childs = storage.classesMap [classId].childs;
						for (var i = 0; i < childs.length; i ++) {
							getClasses (childs [i]);
						}
					};
					var classCode = query.attrs [a].cls;
					if (["system.class", "system.class_attr", "system.view", "system.view_attr"].indexOf (classCode) > -1) {
						continue;
					};
					getClasses (storage.classesCode [classCode].get ("fid"));
				}
				cb ();
			},
			function (cb) {
				var sqlLimit = sql + "\nlimit " + rowCount + " offset " + row + "\n";
				if (storage.client.database == "mssql") {
					sqlLimit =
						"select mssql2.* from (\n" +
						"\tselect mssql1.*, ROW_NUMBER () over (order by (select 0)) as 'rn' from (\n" +
							sql + "\n" +
						"\t) mssql1\n" +
						") mssql2\n" +
						"where rn > " + row + " and rn <= " + (Number (row) + Number (rowCount))
					;
				};
				storage.query ({client: db.create (storage), sql: sqlLimit, success: function (options) {	
					rows = options.result.rows;
					cb ();
				}, failure: cb});
			},
			function (cb) {
				var sqlCount = sql;
				if (config.query.optimizeCountQuery) {
					var viewQueryCount = storage.prepareSQLForCount (viewQuery, total);
					var queryCount = new Query ({storage: storage, session: session, sql: viewQueryCount});
					queryCount.generate ();
					sqlCount = queryCount.selectSQL + queryCount.fromSQL + queryCount.whereSQL + queryCount.orderSQL;
				}
				var s = "select\n\tcount (*) as rows_num";
				for (var t in total) {
					var has = 0;
					for (var i = 1; i < viewQuery.select.length; i += 2) {
						if (viewQuery.select [i] == t) {
							has = 1;
							break;
						};
					};
					if (!has) {
						continue;
					};
					var field = t.toLowerCase () + "_";
					if (total [t] == "cnt") {
						total [t] = "count";
					}
					s += ", " + total [t] + "(" + field + ") as " + field;
				}
				s += "\nfrom (" + sqlCount;
				if (storage.client.database == "postgres") {
					s += "\nlimit " + (config.query.maxCount || 1000) + " offset 0\n";
				};
				s += ") v\n";
				storage.query ({client: db.create (storage), sql: s, success: function (options) {	
					totalRow = options.result.rows [0];
					cb ();
				}, failure: cb});
			}
		], function (err, results) {
			if (err) {
				return failure (new VError (err, "Storage.getContent"));
			};
			var attrs = view.attrs, attrsNum = 0;
			var orderAttrs = [];
			for (var attrCode in attrs) {
				attrs [attrCode].set ("field", attrs [attrCode].get ("fcode").toLowerCase () + "_");
				orderAttrs.push (attrs [attrCode]);
				attrsNum ++;
			}
			orderAttrs.sort (function (a, b) {
				var c = a.get ("forder"), d = b.get ("forder");
				if (d == null || c < d) {
					return -1;
				}
				if (c == null || c > d) {
					return 1;
				}
				if (c == d) {
					return 0;
				}
			});
			var r = "{header: {error: ''}, data: {view: " + viewId + ", columnCount: " + attrsNum + ", headerDepth: 1, column: {\n";
			for (var i = 0; i < orderAttrs.length; i ++) {
				var attr = orderAttrs [i];
				if (i) {
					r += "\t,\n";
				}
				var field = attr.get ("fcode").toLowerCase () + "_";
				r += 
					"\t" + i + ": {\n" +
					"\t\twidth: " + attr.get ("fcolumn_width") + ",\n" +
					"\t\tarea: " + attr.get ("farea") + ",\n" +
					"\t\t0: {\n" +
					"\t\t\tattrId: " + attr.get ("fid") + ",\n" +
					'\t\t\tattr: "' + attr.get ("fcode") + '",\n' +
					'\t\t\ttext: "' + attr.get ("fname").split ('"').join ('\\"') + '",\n' +
					'\t\t\tidAttr: "id",\n' +
					"\t\t\ttypeId: " + query.fieldTypeId [field] + ",\n" +
					"\t\t\ttotal: " + (totalRow [field] ? totalRow [field] : "null") + ",\n" +
					"\t\t\tspan: 1\n" +
					"\t\t}\n" +
					"\t}\n"
				;
			};
			r += "}, tree: {overflow: " + (totalRow.rows_num == (config.query.maxCount || 1000) ? 1 : 0) + ", length: " + totalRow.rows_num + ", currentLength: " + rows.length;
			if (rows.length) {
				r += ",\n";
			} else {
				r += "\n";
			};
			for (var i = 0; i < rows.length; i ++) {
				if (i) {
					r += ",\n";
				}
				r += 
					(i + Number (row)) + ": {\n" +
					"\tid: " + i + ",\n" +
					"\tlength: 0,\n" +
					"\tdata: {\n"
				;
				for (var j = 0; j < orderAttrs.length; j ++) {
					if (j) {
						r += "\t\t,\n";
					};
					var value = rows [i][orderAttrs [j].get ("field")];
					if (dateAttrs.indexOf (orderAttrs [j].get ("fcode")) > -1 && value && typeof (value) == "object" && value.getMonth) {
						if (timeOffsetMin && (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ())) {
							var timeOffset = timeOffsetMin * 60 * 1000
							value = new Date (value.getTime () - timeOffset);
							value = "new Date (" + value.getUTCFullYear () + "," + value.getUTCMonth () + "," + value.getUTCDate () + ")";
						} else {
							value = "new Date (" + value.getFullYear () + "," + value.getMonth () + "," + value.getDate () + ")";
						};
					} else {
						value = common.ToJSONString (value);
					};
					r += "\t\t" + j + ": {text: " + value + "}\n";
				}
				r += "\t}\n}\n";
			}
			r += "}}}";
			if (config.caching && config.caching.getContent) {
				if (classes.length && !storage.revision [session.id]) {
					storage.redisClient.hsetnx (storage.code + "-content", request.storageParam, r);
					for (var i = 0; i < classes.length; i ++) {
						storage.redisClient.hsetnx (storage.code + "-" + classes [i] + "-clschange", request.storageParam, "1");
					}
				};
			};
			success ({result: r});
		});
	};
	storage.selectRow = function (options) {
		var viewId = options.viewId;
		var viewFilter = options.viewFilter;
		var selectFilter = options.selectFilter;
		var success = options.success;
		var failure = options.failure;
		var request = options.request;
		var session = options.session || {userId: null};
		var view = storage.viewsMap [viewId];
		var viewQuery = JSON.parse (view.get ("fquery"));
		if (viewFilter && viewFilter.length) {
			viewQuery.where = viewQuery.where || [];
			if (viewQuery.where.length) {
				viewQuery.where.push ("and");				
			}
			viewQuery.where.push (viewFilter);
		}
		if (storage.client.database != "mssql") {
			var rn = ["row_number ()", "over"];
			if (viewQuery.order) {
				rn.push (["order by"].concat (viewQuery.order));
			} else {
				rn.push ([]);
			}
			viewQuery.select.push (rn);
			viewQuery.select.push ("rn");
		};
		var query, rows, sql, classes = [];
		async.series ([
			function (cb) {
				query = new Query ({storage: storage, session: session, sql: viewQuery});
				query.generate ();
				sql = query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL;
				for (var a in query.attrs) {
					classes.push (storage.classesCode [query.attrs [a].cls].get ("fid"));
				}
				cb ();
			},
			function (cb) {
				selectFilter [0] = selectFilter [0].substr (1) + "_";
				if (storage.client.database == "mssql") {
					sql = 
						"select\n"  +
						"\t(mssql2.rn - 1) as rn_ from (\n" +
						"\t\tselect ROW_NUMBER () over (order by (select 0)) as 'rn', vr_.* from (\n" +
						"\t\t\t" + sql + ") vr_ " +
						"\t) mssql2\n" +
						"where\n" +
						selectFilter.join (" ")
					;
				} else {
					sql = "select rn_ from (" + sql + ") v where " + selectFilter.join (" ");
				};
				storage.query ({sql: sql, success: function (options) {	
					rows = options.result ? options.result.rows : [];
					cb ();
				}, failure: cb});
			}
		], function (err, results) {
			if (err) {
				return failure (new VError (err, "Storage.selectRow"));
			};
			var r = "0";
			if (rows.length) {
				r = rows [0].rn_ - 1;
			}
			success ({result: r});
		});
	};
	// {classId}
	storage.clsChange = function (options) {
		var classId = options.classId;
		log.debug ({cls: "storage", fn: "clsChange", params: classId});
		var session = options.session;
		storage.redisClient.hkeys (storage.code + "-" + classId + "-clschange", function (err, result) {
			for (var i = 0; i < result.length; i ++) {
				storage.redisClient.hdel (storage.code + "-content", result [i]);
			}
			storage.redisClient.del (storage.code + "-" + classId + "-clschange");
		});
	};
	storage.setVar = function (options) {
		var success = options.success;
		storage.redisClient.hset (storage.code + "-vars", options.field, options.value, function (err, result) {
			if (success) {
				success ();
			};
		});
	};
	storage.getVar = function (options) {
		var success = options.success;
		storage.redisClient.hget (storage.code + "-vars", options.field, function (err, result) {
			if (success) {
				success ({value: result});
			};
		});
	};
	storage.removeVar = function (options) {
		var success = options.success;
		storage.redisClient.hdel (storage.code + "-vars", options.field, function (err, result) {
			if (success) {
				success ();
			};
		});
	};
	storage.authRecords = {}; // login, pass
	storage.subjectRoles = {}; // subjectId = {role: roleId, menu: menuId}
	storage.authInfoUpdater = function (options) {
		var rows;
		async.series ([
			function getAuthMethods (cb) {
				storage.execute ({sql: {
					"select": [
						{"a":"id"}, "id",
						{"a":"login"}, "login",
						{"a":"password"}, "password",
						{"a":"use"}, "use"
					],
					"from": [
						{"a":"system.admin.Authentication.LoginPassword"}
					]
				}, success: function (options) {
					rows = options.result.rows;
					cb ();
				}, failure: function (err) {
					cb (err);
				}});
			},
			function getRoles (cb) {
				var cls = storage.getClass ("ose.role");
				if (cls.attrs ["menu"]) {
					storage.execute ({sql: {
						"select": [
							{"a":"subject"}, "subject",
							{"a":"role"}, "role",
							{"b":"menu"}, "menu"
						],
						"from": [
							{"a":"ose.srole"},
							"left-join", {"b": "ose.role"}, "on", [{"a": "role"}, "=", {"b": "id"}]
						]
					}, success: function (options) {
						var r = options.result.rows;
						for (var i = 0; i < r.length; i ++) {
							storage.subjectRoles [r [i].subject_] = {
								role: r [i].role_,
								menu: r [i].menu_
							};
						};
						cb ();
					}, failure: function (err) {
						cb (err);
					}});
				} else {
					cb ();
				};
			},
			function auth (cb) {
				var processedLoginPasswordPairs = {};
				async.map (rows, function (row, cb) {
					if (!row.use_) {
						cb ();
						return;
					};
					var loginAttrId = row.login_;
					var passwordAttrId = row.password_;
					if (!processedLoginPasswordPairs [loginAttrId] == passwordAttrId) {
						cb ();
						return;
					};
					processedLoginPasswordPairs [loginAttrId] = passwordAttrId;
					var loginAttr = storage.classAttrsMap [loginAttrId];
					var passwordAttr = storage.classAttrsMap [passwordAttrId];
					var clsAuth = storage.classesMap [loginAttr.get ("fclass_id")];
					var toc = clsAuth.toc;
					storage.query ({sql: 
						"select fobject_id, " + loginAttr.toc + ", " + passwordAttr.toc + "\n" +
						"from " + toc + "\n" +
						"where " + loginAttr.toc + " is not null and " + passwordAttr.toc + " is not null\n"
					, success: function (options) {
						var r = options.result.rows;
						for (var i = 0; i < r.length; i ++) {
							storage.authRecords [r [i][loginAttr.toc]] = {
								password: r [i][passwordAttr.toc],
								objectId: r [i].fobject_id,
								hasTryAttrs: clsAuth.attrs.lastTry ? true : false
							};
						};
						cb ();
					}, failure: function (err) {
						cb (err);
					}});
				}, function (err, results) {
					cb (err);
				});
			}
		], function (err, results) {
			if (options && options.success) {
				options.success ();
			};
		});		
	};
	storage.subscribers = {
		beforecreateobject: [],
		aftercreateobject: [],
		beforegetobject: [],
		aftergetobject: [],
		beforecommitobject: [],
		beforeremoveobject: [],
		generatequeryblock: []
	};
	storage.suspendedEvents = {};
	storage.on = function (event, fn) {
		storage.subscribers [event] = storage.subscribers [event] || [];
		storage.subscribers [event].push (fn);
	};
	storage.un = function (event, fn) {
		if (storage.subscribers [event] && storage.subscribers [event].indexOf (fn) > -1) {
			storage.subscribers [event].splice (storage.subscribers [event].indexOf (fn), 1);
		};
	};
	storage.suspendEvent = function (event) {
		if (event) {
			storage.suspendedEvents [event] = 1;
		} else {
			for (event in storage.subscribers) {
				storage.suspendedEvents [event] = 1;
			};
		};
	};
	storage.resumeEvent = function (event) {
		if (event) {
			storage.suspendedEvents [event] = 0;
		} else {
			for (event in storage.subscribers) {
				storage.suspendedEvents [event] = 0;
			};
		};
	};
	storage.fireEvent = function (event, options) {
		options = options || {};
		var success = options.success;
		if (storage.suspendedEvents [event]) {
			if (success) {
				success ();
			};
			return;
		};
		var subscribers = storage.subscribers [event] || [];
		delete options.success;
		var cancel = 0;
		if (success) {
			async.eachSeries (subscribers, function (subscriber, cb) {
				options.success = function (options) {
					if (options && options.cancel) {
						cancel = 1;
					};
					cb ();
				};
				subscriber (options);
			}, function (err) {
				if (success) {
					success ({cancel: cancel});
				};
			});
		} else {
			for (var i = 0; i < subscribers.length; i ++) {
				subscribers [i] (options);
			};
			return options;
		};
	};
	storage.freeResources = function () {
		clearInterval (storage.keepConnectionAliveIntervalId);
		clearInterval (storage.authInfoUpdaterIntervalId);
		storage.client.disconnect ();
		storage.redisClient.quit ();
		storage.redisSub.quit ();
		storage.redisPub.quit ();
		if (storage.ose) {
			storage.ose.freeResources ();
		};
	};
	// init
	storage.code = options.code;
	storage.redisClient = redis.createClient (config.redis.port, config.redis.host);
	storage.redisPub = redis.createClient (config.redis.port, config.redis.host);
	storage.redisSub = redis.createClient (config.redis.port, config.redis.host);
	storage.connection = options.connection;
	storage.revisions = {};
	async.series ([
		function (cb) {
			if (config.redis.db) {
				storage.redisSub.select (config.redis.db, function (err, res) {
					storage.redisPub.select (config.redis.db, function (err, res) {
						storage.redisClient.select (config.redis.db, function (err, res) {
							cb ();
						});
					});
				});
			} else {
				cb ();
			};			
		}
	], function (err) {
		storage.redisSub.on ("message", function (channel, message) {
			log.debug ({cls: "storage"}, "redisSub.message on channel: " + channel);
			if (channel == config.redis.db + "-" + storage.code + "-revisions") {
				var r = JSON.parse (message);
				if (!storage.revisions [r.id]) {
					storage.revisions [r.id] = r;
					log.debug ({cls: "storage"}, "new revision: " + r.id);
					// todo: clear redis cache
				};
				for (var i = 0; i < r.classes.created.length; i ++) {
					storage.updateClassCache (r.classes.created [i]);
				};
				for (var i = 0; i < r.classes.changed.length; i ++) {
					storage.updateClassCache (r.classes.changed [i]);
				};
				// r.classes.removed ?
				for (var i = 0; i < r.classAttrs.created.length; i ++) {
					storage.updateClassAttrCache (r.classAttrs.created [i]);
				};
				for (var i = 0; i < r.classAttrs.changed.length; i ++) {
					storage.updateClassAttrCache (r.classAttrs.changed [i]);
				};
				// r.classAttrs.removed ?
				for (var i = 0; i < r.views.created.length; i ++) {
					storage.updateViewCache (r.views.created [i]);
				};
				for (var i = 0; i < r.views.changed.length; i ++) {
					storage.updateViewCache (r.views.changed [i]);
				};
				// r.views.removed ?
				for (var i = 0; i < r.viewAttrs.created.length; i ++) {
					storage.updateViewAttrCache (r.viewAttrs.created [i]);
				};
				for (var i = 0; i < r.viewAttrs.changed.length; i ++) {
					storage.updateViewAttrCache (r.viewAttrs.changed [i]);
				};
				// r.viewAttrs.removed ?
			};
		});
		storage.redisSub.subscribe (config.redis.db + "-" + storage.code + "-revisions");
		var meOptions = options;
		var client = db.create (storage);
		client.connect ({systemDB: options.systemDB, success: function () {
			client.inStorage = 1;
			storage.client = client;
			if (options.systemDB) {
				var success = options.success;
				if (success) {
					success ();
				}
				return;
			};
			async.series ([
				function (cb) {
					if (config.port == config.startPort || process.env.mainWorker) {
						client.update ({success: function () {
							cb ();
						}});
					} else {
						cb ();
					}
				},
				function (cb) {storage.initClasses ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initClassAttrs ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initViews ({success: function () {
					cb ();
				}})},
				function (cb) {storage.initViewAttrs ({success: function () {
					cb ();
				}})},
				function (cb) {
					if (options.authInfoUpdater && !storage.authInfoUpdaterIntervalId) {
						storage.authInfoUpdater ({success: function () {
							storage.authInfoUpdaterIntervalId = setInterval (storage.authInfoUpdater, 60 * 1000);
							cb ();
						}});
					} else {
						cb ();
					};
				},
				function (cb) {
					storage.ose = new Ose ({storage: storage, success: function () {
						cb ();
					}});
				}
			], function (err, results) {
				var success = options.success;
				storage.query ({sql: "select max (fid) as maxId from trevision", success: function (options) {
					storage.lastRevision = options.result.rows [0].maxid;
					if (success) {
						success ();
					}
				}});
			});
		}, failure: function (options) {
			log.error ({cls: "storage", fn: "init", error: util.inspect (options.error)});
			if (meOptions.failure) {
				meOptions.failure (options);
			}
		}});
	});
}

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
			if (cfg.fn == "init") {
				console.log ("Initializing folder ...");
				connection.code = cfg.code;
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
			if (cfg.fn == "import") {
				console.log ("Importing storage ...");
				var i = new Import ();
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
				var e = new Export ();
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
db.init = function (cfg, cb) {
	var rootDir = cfg.rootDir;
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
			fs.readFile (config.rootDir + "/server/project-app/schema/schema-app.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/schema/schema-app.js", data, cb);
			});
		},
		function (cb) {
			fs.readFile (config.rootDir + "/server/project-app/plugins/vo.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/plugins/vo.js", data, cb);
			});
		},
		function (cb) {
			fs.readFile (config.rootDir + "/server/project-app/plugins/plugins.js", function (err, data) {
				if (err) {
					return cb (err);
				};
				fs.writeFile (rootDir + "/plugins/plugins.js", data, cb);
			});
		},
		function (cb) {
			fs.writeFile (rootDir + "/resources/scripts/vo-debug.js", "", cb);
		},
		function (cb) {
			fs.writeFile (rootDir + "/plugins/actions.js", "", cb);
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
				'\t<!-- App -->\n' +
				'\t<script type="text/javascript" src="resources/scripts/vo-debug.js" charset="UTF-8"></script>\n' +
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
		}
	], function (err) {
		cb (err);
	});
};


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


//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
//
//	Class for PostgreSQL database
db.MSSQL = function (options) {
	var me = this;
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
	var me = this;
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
	var me = this;
	options.options = options.options || {};
	var meOptions = options;
	function go (options) {	
		var query, values = [];
		if (options.params) {
			for (var i = 0; i < options.params.length; i ++) {
//				options.sql = options.sql.replace ("$" + (i + 1), common.ToSQLString (options.params [i]));
				var value = options.params [i];
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
		var n = me.n;
		me.queue = me.queue || {};
		me.queue [n] = options.sql;
		var cb = function (err, results) {
			delete me.queue [n];
			if (err) {
				if (options.failure) {
					options.failure ({error: err + " " + results});
				};
			} else {
				if (options.success) {
					/*
					if (results && results.length) {
						for (var i = 0; i < results.length; i ++) {
							var row = results [i];
							for (var field in row) {
								var lower = field.toLowerCase ();
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
	var me = this;
	var meOptions = options;
	this.query ({sql: "begin transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
db.MSSQL.prototype.commitTransaction = function (options) {
	var me = this;
	var meOptions = options;
	this.query ({sql: "commit transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
db.MSSQL.prototype.rollbackTransaction = function (options) {
	var me = this;
	var meOptions = options;
	this.query ({sql: "rollback transaction", success: function () {
		meOptions.success ();
	}, failure: function (options) {
		meOptions.failure (options);
	}});
};
// Next id in table
db.MSSQL.prototype.getNextId = function (options) {
	var me = this;
	var success = options.success;
	var session = options.session;
	var storage = me.storage;
	var table = options.table;
	storage.redisClient.hincrby ("mssql_sequences", storage.code + "_" + table, 1, function (err, result) {
		success ({id: result});
	});
};
db.MSSQL.prototype.currentTimestamp = function () {
	return "getutcdate ()";
};
// DB struct update
db.MSSQL.prototype.update = function (options) {
	var me = this;
	var storage = me.storage;
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
			var tables = ["trevision", "tclass", "tclass_attr", "tview", "tview_attr", "tobject", "tobject_attr", "taction", "taction_attr"];
			// create sequences
			async.map (tables, function (table, cb) {
				storage.query ({sql: "select * from sequence_" + table, success: function (options) {
					cb ();
				}, failure: function () {
					storage.query ({sql: "select max (fid) as maxid from " + table, success: function (options) {
						var initVal = 1000;
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
	var me = this;
	var storage = me.storage;
	var tables = ["trevision", "tclass", "tclass_attr", "tview", "tview_attr", "tobject", "tobject_attr", "taction", "taction_attr"];
	async.map (tables, function (table, cb) {
		storage.query ({sql: "select max (fid) as maxid from " + table, success: function (options) {
			var tableValue = 1000;
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
	var me = this;
	var storage = me.storage;
	var connection = options.connection;
	var cfg = options.cfg;
	var success = options.success;
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
//			var sql = fs.readFileSync (config.rootDir + "/db/indexes.sql").toString ();
			var sql = dbIndexesSQL;
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
//			var sql = fs.readFileSync (config.rootDir + "/db/data.sql").toString ().split (";");
			var sql = dbDataSQL;
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
	var me = this;
	var storage = me.storage;
	var connection = options.connection;
	var cfg = options.cfg;
	var success = options.success;
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
	var storage = this.storage;
	var toc = options.toc;
	var tocField = options.tocField;
	var type = options.type;
	var caId = options.caId;
	var success = options.success;
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
	var storage = this.storage;
	var success = options.success;
	storage.query ({session: options.session, sql: "create index " + options.table + "_" + options.field + " on " + options.table + " (" + options.field + ")", success: function () {
		success ();
	}});
};
db.MSSQL.prototype.isTableExists = function (options) {
	var storage = this.storage;
	var success = options.success;
	storage.query ({session: options.session, sql: "select count (*) as num from INFORMATION_SCHEMA.TABLES where upper (TABLE_NAME) = upper ('" + options.table + "')", success: function (options) {
		var r = options.result.rows;
		success (r [0].num);
	}});
};



var dbTablesSQL = "create table $schema_prefix$tschema (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $ttext$,\r\n\tfcode $ttext$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$trevision (\r\n\tfid $tid$ not null,\r\n\tfsubject_id $tnumber$,\r\n\tfdate $ttimestamp$,\r\n\tfdescription $ttext$,\r\n\tfremote_addr $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tftoc $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tflayout $ttext$,\r\n\tfkey $tstring$,\r\n\tfparent_key $tstring$,\r\n\tfclass_id $tnumber$,\r\n\tfunrelated $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfquery $ttext$,\r\n\tftype $tnumber$,\r\n\tfmaterialized $tnumber$ default 0,\r\n\tfsystem $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tficon_cls $tstring$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview_attr (\r\n\tfid $tid$ not null,\r\n\tfview_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfclass_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfsubject_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfsort_kind $tnumber$,\r\n\tfsort_order $tnumber$,\r\n\tfoperation $tnumber$,\r\n\tfvalue $ttext$,\r\n\tfarea $tnumber$,\r\n\tfcolumn_width $tnumber$,\r\n\tftotal_type $tnumber$,\r\n\tfread_only $tnumber$,\r\n\tfgroup $tnumber$,\r\n\tfnot_null $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfbody $ttext$,\r\n\tfconfirm $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tflayout $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction_attr (\r\n\tfid $tid$ not null,\r\n\tfaction_id $tnumber$,\r\n\tftype_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfkind $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfformat $ttext$,\r\n\tfview_id $tnumber$,\r\n\tfsystem $tnumber$,\r\n\tftype $tnumber$,\r\n\tfkind $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass_attr (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tftype_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfsecure $tnumber$,\r\n\tfmax_str $tnumber$,\r\n\tfmin_str $tnumber$,\r\n\tfmax_number $tnumber$,\r\n\tfmin_number $tnumber$,\r\n\tfmax_ts $tnumber$,\r\n\tfmin_ts $tnumber$,\r\n\tfunique $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfformat_func $ttext$,\r\n\tfformat_number $tstring$,\r\n\tfformat_ts $tstring$,\r\n\tfremove_rule $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject_attr (\r\n\tfid $tid_object_attr$ not null,\r\n\tfobject_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfstring $tstring_value$,\r\n\tfnumber $tnumber_value$,\r\n\tftime $ttimestamp$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tmail (\r\n\tfid $tid$ not null,\r\n\tfrecipients $ttext$,\r\n\tfmessage $ttext$,\r\n\tfcreation_date $ttimestamp$,\r\n\tfsending_date $ttimestamp$\r\n) $tablespace$;\r\n";

var dbIndexesSQL = "create unique index tschema_fid on $schema_prefix$tschema (fid) $tablespace$;\r\n\r\ncreate index trevision_fdate on $schema_prefix$trevision (fdate) $tablespace$;\r\ncreate unique index trevision_fid on $schema_prefix$trevision (fid) $tablespace$;\r\ncreate index trevision_fschema_id on $schema_prefix$trevision (fschema_id) $tablespace$;\r\ncreate index trevision_frecord_id on $schema_prefix$trevision (frecord_id) $tablespace$;\r\ncreate index trevision_ftoc on $schema_prefix$trevision (ftoc) $tablespace$;\r\n\r\ncreate index tview_ftype on $schema_prefix$tview (ftype) $tablespace$;\r\ncreate index tview_fid on $schema_prefix$tview (fid) $tablespace$;\r\ncreate index tview_fcode on $schema_prefix$tview (fcode);\r\ncreate index tview_fend_id on $schema_prefix$tview (fend_id) $tablespace$;\r\ncreate unique index tview_ufid on $schema_prefix$tview (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_fname on $schema_prefix$tview (fname);\r\ncreate index tview_fparent_id on $schema_prefix$tview (fparent_id) $tablespace$;\r\ncreate index tview_fsystem on $schema_prefix$tview (fsystem) $tablespace$;\r\ncreate index tview_fstart_id on $schema_prefix$tview (fstart_id) $tablespace$;\r\ncreate index tview_fclass_id on $schema_prefix$tview (fclass_id) $tablespace$;\r\ncreate index tview_fschema_id on $schema_prefix$tview (fschema_id) $tablespace$;\r\ncreate index tview_frecord_id on $schema_prefix$tview (frecord_id) $tablespace$;\r\n\r\ncreate index tview_attr_fid on $schema_prefix$tview_attr (fid) $tablespace$;\r\ncreate index tview_attr_fclass_id on $schema_prefix$tview_attr (fclass_id) $tablespace$;\r\ncreate index tview_attr_fclass_attr_id on $schema_prefix$tview_attr (fclass_attr_id) $tablespace$;\r\ncreate index tview_attr_fcode on $schema_prefix$tview_attr (fcode) $tablespace$;\r\ncreate unique index tview_attr_ufid on $schema_prefix$tview_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_attr_fname on $schema_prefix$tview_attr (fname) $tablespace$;\r\ncreate index tview_attr_fview_id on $schema_prefix$tview_attr (fview_id) $tablespace$;\r\ncreate index tview_attr_fsubject_id on $schema_prefix$tview_attr (fsubject_id) $tablespace$;\r\ncreate index tview_attr_fstart_id on $schema_prefix$tview_attr (fstart_id) $tablespace$;\r\ncreate index tview_attr_fend_id on $schema_prefix$tview_attr (fend_id) $tablespace$;\r\ncreate index tview_attr_farea on $schema_prefix$tview_attr (farea) $tablespace$;\r\ncreate index tview_attr_fschema_id on $schema_prefix$tview_attr (fschema_id) $tablespace$;\r\ncreate index tview_attr_frecord_id on $schema_prefix$tview_attr (frecord_id) $tablespace$;\r\n\r\ncreate index taction_fid on $schema_prefix$taction (fid) $tablespace$;\r\ncreate index taction_fclass_id on $schema_prefix$taction (fclass_id) $tablespace$;\r\ncreate index taction_fcode on $schema_prefix$taction (fcode);\r\ncreate index taction_fend_id on $schema_prefix$taction (fend_id) $tablespace$;\r\ncreate unique index taction_ufid on $schema_prefix$taction (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_fname on $schema_prefix$taction (fname);\r\ncreate index taction_fstart_id on $schema_prefix$taction (fstart_id) $tablespace$;\r\ncreate index taction_fschema_id on $schema_prefix$taction (fschema_id) $tablespace$;\r\ncreate index taction_frecord_id on $schema_prefix$taction (frecord_id) $tablespace$;\r\n\r\ncreate index taction_attr_fid on $schema_prefix$taction_attr (fid) $tablespace$;\r\ncreate index taction_attr_faction_id on $schema_prefix$taction_attr (faction_id) $tablespace$;\r\ncreate index taction_attr_fcode on $schema_prefix$taction_attr (fcode);\r\ncreate index taction_attr_fend_id on $schema_prefix$taction_attr (fend_id) $tablespace$;\r\ncreate unique index taction_attr_ufid on $schema_prefix$taction_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_attr_fname on $schema_prefix$taction_attr (fname);\r\ncreate index taction_attr_fstart_id on $schema_prefix$taction_attr (fstart_id) $tablespace$;\r\ncreate index taction_attr_fschema_id on $schema_prefix$taction_attr (fschema_id) $tablespace$;\r\ncreate index taction_attr_frecord_id on $schema_prefix$taction_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_fid on $schema_prefix$tclass (fid) $tablespace$;\r\ncreate index tclass_fcode on $schema_prefix$tclass (fcode);\r\ncreate index tclass_fend_id on $schema_prefix$tclass (fend_id) $tablespace$;\r\ncreate index tclass_fname on $schema_prefix$tclass (fname);\r\ncreate index tclass_fparent_id on $schema_prefix$tclass (fparent_id) $tablespace$;\r\ncreate index tclass_fsystem on $schema_prefix$tclass (fsystem) $tablespace$;\r\ncreate index tclass_ftype on $schema_prefix$tclass (ftype) $tablespace$;\r\ncreate index tclass_fkind on $schema_prefix$tclass (fkind) $tablespace$;\r\ncreate index tclass_fstart_id on $schema_prefix$tclass (fstart_id) $tablespace$;\r\ncreate index tclass_fview_id on $schema_prefix$tclass (fview_id) $tablespace$;\r\ncreate index tclass_fschema_id on $schema_prefix$tclass (fschema_id) $tablespace$;\r\ncreate index tclass_frecord_id on $schema_prefix$tclass (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_attr_fid on $schema_prefix$tclass_attr (fid) $tablespace$;\r\ncreate index tclass_attr_fclass_id on $schema_prefix$tclass_attr (fclass_id) $tablespace$;\r\ncreate index tclass_attr_fcode on $schema_prefix$tclass_attr (fcode);\r\ncreate index tclass_attr_fend_id on $schema_prefix$tclass_attr (fend_id) $tablespace$;\r\ncreate index tclass_attr_fname on $schema_prefix$tclass_attr (fname);\r\ncreate index tclass_attr_fstart_id on $schema_prefix$tclass_attr (fstart_id) $tablespace$;\r\ncreate index tclass_attr_ftype_id on $schema_prefix$tclass_attr (ftype_id) $tablespace$;\r\ncreate index tclass_attr_fschema_id on $schema_prefix$tclass_attr (fschema_id) $tablespace$;\r\ncreate index tclass_attr_frecord_id on $schema_prefix$tclass_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_fid on $schema_prefix$tobject (fid) $tablespace$;\r\ncreate index tobject_fclass_id on $schema_prefix$tobject (fclass_id) $tablespace$;\r\ncreate index tobject_fend_id on $schema_prefix$tobject (fend_id) $tablespace$;\r\ncreate unique index tobject_ufid on $schema_prefix$tobject (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tobject_fstart_id on $schema_prefix$tobject (fstart_id) $tablespace$;\r\ncreate index tobject_fschema_id on $schema_prefix$tobject (fschema_id) $tablespace$;\r\ncreate index tobject_frecord_id on $schema_prefix$tobject (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_attr_fid on $schema_prefix$tobject_attr (fid) $tablespace$;\r\ncreate index tobject_attr_fclass_attr_id on $schema_prefix$tobject_attr (fclass_attr_id) $tablespace$;\r\ncreate index tobject_attr_fend_id on $schema_prefix$tobject_attr (fend_id) $tablespace$;\r\ncreate index tobject_attr_fnumber on $schema_prefix$tobject_attr (fnumber) $tablespace$;\r\ncreate index tobject_attr_fobject_id on $schema_prefix$tobject_attr (fobject_id) $tablespace$;\r\ncreate index tobject_attr_ftime on $schema_prefix$tobject_attr (ftime) $tablespace$;\r\ncreate index tobject_attr_fstart_id on $schema_prefix$tobject_attr (fstart_id) $tablespace$;\r\ncreate index tobject_attr_fstring on $schema_prefix$tobject_attr ($tobject_attr_fstring$);\r\ncreate index tobject_attr_fschema_id on $schema_prefix$tobject_attr (fschema_id) $tablespace$;\r\ncreate index tobject_attr_frecord_id on $schema_prefix$tobject_attr (frecord_id) $tablespace$;\r\n\r\ncreate unique index tmail_fid on $schema_prefix$tmail (fid) $tablespace$;\r\n";

var dbDataSQL = "insert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (1, null, 'String', 'String', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (2, null, 'Number', 'Number', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (3, null, 'Date', 'Date', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (4, null, 'Boolean', 'Boolean', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (5, null, 'File', 'File', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (6, null, 'Class', 'Class', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (7, null, 'Class attribute', 'ClassAttr', '', 1, 2147483647, '', 1867, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (8, null, 'View', 'View', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (9, null, 'View attribute', 'ViewAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (10, null, 'Action', 'Action', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (11, null, 'Action attribute', 'ActionAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (12, null, 'Object', 'Object', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (13, null, 'Object attribute', 'ObjectAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\n";

var dbEngineSQL = "create table $schema_prefix$_class (\n\tfid $tid$ not null,\n\tfparent_id $tnumber$,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tfformat $ttext$,\n\tfview_id $tnumber$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_class_attr (\n\tfid $tid$ not null,\n\tfclass_id $tnumber$ not null,\n\tfclass_code $tstring$ not null,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tftype_id $tnumber$ not null,\n\tfnot_null $tnumber$,\n\tfsecure $tnumber$,\n\tfunique $tnumber$,\n\tfremove_rule $tstring$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_view (\n\tfid $tid$ not null,\n\tfparent_id $tnumber$,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tflayout $ttext$,\n\tfquery $ttext$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_object (\n\tfid $tid$ not null,\n\tfstart_id $tnumber$\n) $tablespace$;\n\nalter table $schema_prefix$_class add primary key (fid);\nalter table $schema_prefix$_class_attr add primary key (fid);\nalter table $schema_prefix$_view add primary key (fid);\nalter table $schema_prefix$_object add primary key (fid);\n\ncreate unique index _class_fcode on $schema_prefix$_class (fparent_id, fcode) $tablespace$;\ncreate unique index _class_fcode_null on $schema_prefix$_class (fcode) $tablespace$ where fparent_id is null;\ncreate unique index _class_attr_fcode on $schema_prefix$_class_attr (fclass_id, fcode) $tablespace$;\ncreate unique index _view_fcode on $schema_prefix$_view (fparent_id, fcode) $tablespace$;\ncreate unique index _view_fcode_null on $schema_prefix$_view (fcode) $tablespace$ where fparent_id is null;\n\n-- tclass after insert\ncreate function trigger_tclass_after_insert () returns trigger as\n$$\ndeclare\n\ttableName varchar (256);\n\tclassCode varchar (256);\n\tparentId int;\nbegin\n\tif (NEW.fend_id = 2147483647) then\n\t\ttableName = NEW.fcode || '_' || NEW.fid;\n\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = NEW.fid;\n\t\tif (classCode is null) then\n\t\t\tif (NEW.fid >= 1000) then\n\t\t\t\tbegin\n\t\t\t\t\texecute 'create table ' || tableName || '(fobject_id bigint)';\n\t\t\t\t\texecute 'alter table ' || tableName || ' add primary key (fobject_id)';\n\t\t\t\texception when others then\n\t\t\t\tend;\n\t\t\tend if;\n\t\t\tinsert into _class (\n\t\t\t\tfid, fparent_id, fname, fcode, fdescription, fformat, fview_id, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.fformat, NEW.fview_id, NEW.fstart_id\n\t\t\t);\n\t\telse\n\t\t\tif (classCode <> NEW.fcode) then\n\t\t\t\traise exception 'You can''t change: code';\n\t\t\tend if;\n\t\t\tif (parentId <> NEW.fparent_id) then\n\t\t\t\traise exception 'You can''t change: parent_id';\n\t\t\tend if;\n\t\t\tupdate _class set\n\t\t\t\tfparent_id = NEW.fparent_id,\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tfformat = NEW.fformat,\n\t\t\t\tfview_id = NEW.fview_id,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_after_insert\nafter insert on tclass for each row \nexecute procedure trigger_tclass_after_insert ();\n\n-- tclass after update\ncreate function trigger_tclass_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\nbegin\n\tselect fstart_id into startId from _class where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\texecute 'delete from _class where fid = ' || NEW.fid;\n\t\tif (NEW.fid >= 1000) then\n\t\t\texecute 'drop table ' || NEW.fcode || '_' || NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_after_update\nafter update on tclass for each row \nexecute procedure trigger_tclass_after_update ();\n\n-- tclass_attr after insert\ncreate function trigger_tclass_attr_after_insert () returns trigger as\n$$\ndeclare\n\tclassCode varchar (256);\n\ttableName varchar (256);\n\tcolumnName varchar (256);\n\tcolumnType varchar (64);\n\tcaCode varchar (256);\n\tcaClassId int;\n\tcaTypeId int;\n\tcaUnique int;\nbegin\n\tselect fcode into classCode from _class where fid = NEW.fclass_id;\n\tif (classCode is not null and NEW.fend_id = 2147483647) then\n\t\tselect fcode, fclass_id, ftype_id, funique into caCode, caClassId, caTypeId, caUnique from _class_attr where fid = NEW.fid;\n\t\tcolumnName = NEW.fcode || '_' || NEW.fid;\n\t\ttableName = classCode || '_' || NEW.fclass_id;\n\t\tif (caCode is null) then\n\t\t\t-- Column type\n\t\t\tcolumnType = 'bigint';\n\t\t\tif (NEW.ftype_id = 3) then\n\t\t\t\tcolumnType = 'timestamp (6)';\n\t\t\tend if;\n\t\t\tif (NEW.ftype_id = 2) then\n\t\t\t\tcolumnType = 'numeric';\n\t\t\tend if;\n\t\t\tif (NEW.ftype_id = 1 or NEW.ftype_id = 5) then\n\t\t\t\tcolumnType = 'text';\n\t\t\tend if;\n\t\t\texecute 'alter table ' || tableName || ' add column ' || columnName || ' ' || columnType;\n\t\t\tinsert into _class_attr (\n\t\t\t\tfid, fclass_id, fclass_code, fname, fcode, fdescription, ftype_id, fnot_null, fsecure, funique, fremove_rule, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fclass_id, classCode, NEW.fname, NEW.fcode, NEW.fdescription, NEW.ftype_id, NEW.fnot_null, NEW.fsecure, NEW.funique, NEW.fremove_rule, NEW.fstart_id\n\t\t\t);\n\t\t\t-- Unique\n\t\t\t--if (NEW.funique is not null and NEW.funique = 1) then\n\t\t\t--\texecute 'create unique index ' || tableName || '_' || columnName || '_unique on ' || tableName || ' (' || columnName || ')';\n\t\t\t--end if;\n\t\t\t-- Index\n\t\t\tif (NEW.ftype_id = 12 or NEW.ftype_id >= 1000 or position ('\"index\"' in NEW.fformat_func) > 0) then\n\t\t\t\t-- if (NEW.ftype_id = 1) then\n\t\t\t\t-- \texecute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ') (substr (' || columnName || ', 1, 1024))';\n\t\t\t\t-- else\n\t\t\t\t\texecute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ')';\n\t\t\t\t-- end if;\n\t\t\tend if;\n\t\telse\n\t\t\tif (caCode <> NEW.fcode) then\n\t\t\t\traise exception 'You can''t change: code' using message = 'You can''t change: code - ' || caCode || ',' || NEW.fcode;\n\t\t\tend if;\n\t\t\tif (caClassId <> NEW.fclass_id) then\n\t\t\t\traise exception 'You can''t change: class_id' using message = 'You can''t change: class_id - ' || caClassId || ',' || NEW.fclass_id;\n\t\t\tend if;\n\t\t\tif (caTypeId <> NEW.ftype_id) then\n\t\t\t\traise exception 'You can''t change: type_id' using message = 'You can''t change: type_id - ' || caTypeId || ',' || NEW.ftype_id;\n\t\t\tend if;\n\t\t\tif (caUnique <> NEW.funique) then\n\t\t\t\traise exception 'You can''t change: unique' using message = 'You can''t change: unique';\n\t\t\tend if;\n\t\t\tupdate _class_attr set\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfclass_id = NEW.fclass_id,\n\t\t\t\tfclass_code = classCode,\n\t\t\t\tftype_id = NEW.ftype_id,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tfnot_null = NEW.fnot_null,\n\t\t\t\tfsecure = NEW.fsecure,\n\t\t\t\tfremove_rule = NEW.fremove_rule,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_attr_after_insert\nafter insert on tclass_attr for each row \nexecute procedure trigger_tclass_attr_after_insert ();\n\n-- tclass_attr after update\ncreate function trigger_tclass_attr_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\n\tclassCode varchar (256);\nbegin\n\tselect fstart_id, fclass_code into startId, classCode from _class_attr where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\texecute 'delete from _class_attr where fid = ' || NEW.fid;\n\t\texecute 'alter table ' || classCode || '_' || NEW.fclass_id || ' drop column ' || NEW.fcode || '_' || NEW.fid || ' cascade';\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_attr_after_update\nafter update on tclass_attr for each row \nexecute procedure trigger_tclass_attr_after_update ();\n\n-- tview after insert\ncreate function trigger_tview_after_insert () returns trigger as\n$$\ndeclare\n\tviewCode varchar (256);\nbegin\n\tselect fcode into viewCode from _view where fid = NEW.fid;\n\tif (NEW.fsystem is null and NEW.fend_id = 2147483647) then\n\t\tif (viewCode is null) then\n\t\t\tinsert into _view (\n\t\t\t\tfid, fparent_id, fname, fcode, fdescription, flayout, fquery, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.flayout, NEW.fquery, NEW.fstart_id\n\t\t\t);\n\t\telse\n\t\t\tupdate _view set\n\t\t\t\tfparent_id = NEW.fparent_id,\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tflayout = NEW.flayout,\n\t\t\t\tfquery = NEW.fquery,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tview_after_insert\nafter insert on tview for each row \nexecute procedure trigger_tview_after_insert ();\n\n-- tview after update\ncreate function trigger_tview_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\nbegin\n\tselect fstart_id into startId from _view where fid = NEW.fid;\n\tif (NEW.fsystem is null and startId is not null and NEW.fstart_id = startId) then\n\t\texecute 'delete from _view where fid = ' || NEW.fid;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tview_after_update\nafter update on tview for each row \nexecute procedure trigger_tview_after_update ();\n\n-- tobject after insert\ncreate function trigger_tobject_after_insert () returns trigger as\n$$\ndeclare\n\tclassCode varchar (256);\n\tid int;\n\tstartId int;\n\tclassId int;\n\tparentId int;\nbegin\n\tif (NEW.fend_id = 2147483647) then\n\t\tid = NEW.fid;\n\t\tclassId = NEW.fclass_id;\n\t\tstartId = NEW.fstart_id;\n\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = classId;\n\t\tif (classCode is not null) then\n\t\t\tinsert into _object (\n\t\t\t\tfid, fstart_id\n\t\t\t) values (\n\t\t\t\tid, startId\n\t\t\t);\n\t\tend if;\n\t\tloop\n\t\t\tif (classCode is not null) then\n\t\t\t\texecute 'insert into ' || classCode || '_' || classId || ' (fobject_id) values (' || id || ')';\n\t\t\tend if;\n\t\t    if (parentId is null) then\n\t\t        exit;\n\t\t    else\n\t\t    \tclassId = parentId;\n\t\t\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = classId;\n\t\t    end if;\n\t\tend loop;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tobject_after_insert\nafter insert on tobject for each row \nexecute procedure trigger_tobject_after_insert ();\n\n-- tobject after update\ncreate function trigger_tobject_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\n\tclassCode varchar (256);\nbegin\n\tselect fstart_id into startId from _object where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\t-- todo delete from parent classes\n\t\texecute 'delete from _object where fid = ' || NEW.fid;\n\t\tselect fcode into classCode from _class where fid = NEW.fclass_id;\n\t\texecute 'delete from ' || classCode || '_' || NEW.fclass_id || ' where fobject_id = ' || NEW.fid;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tobject_after_update\nafter update on tobject for each row \nexecute procedure trigger_tobject_after_update ();\n\n-- tobject_attr after insert\ncreate function trigger_tobject_attr_after_insert () returns trigger as\n$$\ndeclare\n\tclassCode varchar (256);\n\tclassId int;\n\tcaCode varchar (256);\n\tvalue text;\nbegin\n\tselect fclass_code, fclass_id, fcode into classCode, classId, caCode from _class_attr where fid = NEW.fclass_attr_id;\n\tif (classCode is not null) then\n\t\tvalue = 'null';\n\t\tif (NEW.fstring is not null) then\n\t\t\tvalue = '''' || replace (NEW.fstring, '''', '''''') || '''';\n\t\tend if;\n\t\tif (NEW.ftime is not null) then\n\t\t\tvalue = '''' || to_char (NEW.ftime, 'DD.MM.YYYY HH24:MI:SS.MS') || '''';\n\t\tend if;\n\t\tif (NEW.fnumber is not null) then\n\t\t\tvalue = '''' || NEW.fnumber::text || '''';\n\t\tend if;\n\t\tbegin\n\t\t\texecute 'update ' || classCode || '_' || classId || ' set ' || caCode || '_' || NEW.fclass_attr_id || ' = ' || value || ' where fobject_id = ' || NEW.fobject_id;\n\t\texception when others then\n\t\tend;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\n-- enable/disable while storage-import\n--create trigger tobject_attr_after_insert\n--after insert on tobject_attr for each row \n--execute procedure trigger_tobject_attr_after_insert ();\n\n";

//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var Dbf = function (options) {
	var me = this;
	me.options = {};
	me.fields = options ["fields"];
	me.rows =  options ["rows"];
	me.options = options ["options"];
};
Dbf.prototype.convertDate = function (d) {
	var s, r;
	if (!d)
		r = "      ";
	else {
    	r = String (d.getFullYear ());
    	s = d.getMonth () + 1;
    	if (s < 10) {
    		s = "0" + s;
    	};
    	r += String (s);
    	s = d.getDate ();
    	if (s < 10) {
    		s = "0" + s;
    	};
    	r += String (s);
	};
	return r;
};
Dbf.prototype.winToDos = function (buf) {
	var me = this;
	if (!Dbf.prototype.dos) {
		var dos2 = {};
		dos2 ["А"] = 0x80;
		dos2 ["Б"] = 0x81;
		dos2 ["В"] = 0x82;
		dos2 ["Г"] = 0x83;
		dos2 ["Д"] = 0x84;
		dos2 ["Е"] = 0x85;
		dos2 ["Ё"] = 0xf0;
		dos2 ["Ж"] = 0x86;
		dos2 ["З"] = 0x87;
		dos2 ["И"] = 0x88;
		dos2 ["Й"] = 0x89;
		dos2 ["К"] = 0x8a;
		dos2 ["Л"] = 0x8b;
		dos2 ["М"] = 0x8c;
		dos2 ["Н"] = 0x8d;
		dos2 ["О"] = 0x8e;
		dos2 ["П"] = 0x8f;
		dos2 ["Р"] = 0x90;
		dos2 ["С"] = 0x91;
		dos2 ["Т"] = 0x92;
		dos2 ["У"] = 0x93;
		dos2 ["Ф"] = 0x94;
		dos2 ["Х"] = 0x95;
		dos2 ["Ц"] = 0x96;
		dos2 ["Ч"] = 0x97;
		dos2 ["Ш"] = 0x98;
		dos2 ["Щ"] = 0x99;
		dos2 ["Ы"] = 0x9b;
		dos2 ["Ь"] = 0x9c;
		dos2 ["Ъ"] = 0x9a;
		dos2 ["Э"] = 0x9d;
		dos2 ["Ю"] = 0x9e;
		dos2 ["Я"] = 0x9f;
		dos2 ["а"] = 0xa0;
		dos2 ["б"] = 0xa1;
		dos2 ["в"] = 0xa2;
		dos2 ["г"] = 0xa3;
		dos2 ["д"] = 0xa4;
		dos2 ["е"] = 0xa5;
		dos2 ["ё"] = 0xf1;
		dos2 ["ж"] = 0xa6;
		dos2 ["з"] = 0xa7;
		dos2 ["и"] = 0xa8;
		dos2 ["й"] = 0xa9;
		dos2 ["к"] = 0xaa;
		dos2 ["л"] = 0xab;
		dos2 ["м"] = 0xac;
		dos2 ["н"] = 0xad;
		dos2 ["о"] = 0xae;
		dos2 ["п"] = 0xaf;
		dos2 ["р"] = 0xe0;
		dos2 ["с"] = 0xe1;
		dos2 ["т"] = 0xe2;
		dos2 ["у"] = 0xe3;
		dos2 ["ф"] = 0xe4;
		dos2 ["х"] = 0xe5;
		dos2 ["ц"] = 0xe6;
		dos2 ["ч"] = 0xe7;
		dos2 ["ш"] = 0xe8;
		dos2 ["щ"] = 0xe9;
		dos2 ["ы"] = 0xeb;
		dos2 ["ь"] = 0xec;
		dos2 ["ъ"] = 0xea;
		dos2 ["э"] = 0xed;
		dos2 ["ю"] = 0xee;
		dos2 ["я"] = 0xef;
		Dbf.prototype.dos = {};
		for (var key in dos2) {
			Dbf.prototype.dos [key] = dos2 [key];
			Dbf.prototype.dos [common.UnicodeToWin1251 (key)] = dos2 [key];
		};
	};
	for (var i = 0; i < buf.length; i ++) {
		var c = String.fromCharCode (buf [i]);
		if (me.dos [c]) {
			buf [i] = me.dos [c];
		};
	};
};
Dbf.prototype.getBuffer = function (coding) {
	var me = this;
	var i, recordSize;
	var headerSize = 32 + 32 * me.fields.length + 1;
	var header = new Buffer (headerSize);
	header [0] = 0x03; // нет примечаний
	dateLastUpdate = new Date ();
	header [1] = dateLastUpdate.getFullYear () - 1900;
	header [2] = dateLastUpdate.getMonth () + 1;
	header [3] = dateLastUpdate.getDate ();
	// Число записей в файле
	header.writeUInt32LE (me.rows.length, 4);
	// Число байт в заголовке
	header.writeUInt16LE (headerSize, 8);
	// Число байт в записи
	recordSize = 1;
	for (i = 0; i < me.fields.length; i ++) {
		recordSize += me.fields [i].size;
	};
	header.writeUInt16LE (recordSize, 10);
	for (i = 12; i <= 31; i ++) {
		header [i] = 0x00;
	};
	// Вектора описания полей
	for (i = 0; i < me.fields.length; i ++) {
		header.fill (0, 32 + 32 * i, 32 + 32 * i + 32);
		header.write (me.fields [i].name, 32 + 32 * i, me.fields [i].name.length);
		header.write (me.fields [i].type, 32 + 32 * i + 11, 1);
		header [32 + 32 * i + 16] = me.fields [i].size;
		header [32 + 32 * i + 17] = me.fields [i].dec;
	};
	// Конец векторов описания полей
	header [32 + 32 * i] = 0x0D;
	// Записи с данными
	var s, format, j, records = [header];
	for (i = 0; i < me.rows.length; i ++) {
		var record = new Buffer (recordSize);
		record.fill (0x20);
		j = 1;
		for (var k = 0; k < me.fields.length; k ++) {
			var field = me.fields [k];
			if (field.type == 'C') {
				s = me.rows [i][field.name] || "";
                if (s.length > field.size) {
                	s = s.substr (0, field.size);
                };
            };
			if (field.type == 'N') {
				s = me.rows [i][field.name];
				//format = "%" + ToStr (it->size) + "s";
			}
			if (field.type == 'D') {
				s = me.convertDate (me.rows [i][field.name]);
			};
			var r;
			if (coding == "DOS") {
				r = new Buffer (common.UnicodeToWin1251 (s), "binary");
				me.winToDos (r);
			} else {
				r = new Buffer (common.UnicodeToWin1251 (s), "binary");
			};
			r.copy (record, j);
			j += field.size;
		};
		records.push (record);
	};
	var bufAll = Buffer.concat (records);
	if (records.length > 1) {
		for (var i = 0; i < records.length; i ++) {
			delete records [i];
		};
	};
	return bufAll;
};
dbf = {};
dbf.report = function (request, response, next) {
	if (request.url.indexOf ('/report?') > -1 && request.query.format == "dbf") {
		var options = {};
		var fields = request.body.split ("&");
		for (var i = 0; i < fields.length; i ++) {
			var tokens = fields [i].split ("=");
			tokens [1] = tokens [1].split ("+").join ("%20");
			tokens [1] = unescape (tokens [1]);
			tokens [1] = new Buffer (tokens [1], "ascii").toString ("utf8");
			options [tokens [0]] = JSON.parse (tokens [1]);
		};
		var d = new Dbf (options);
		var b = d.getBuffer (options.options.coding);
		response.header ("Content-Type", "application/x-download;");
		response.header ("Content-Disposition", "attachment; filename=" + (options.options.filename || "data.dbf"));
		response.header ("Expires", "-1");
		response.header ("Content-Length", b.length);
		response.statusCode = 200;
		response.end (b);
	} else {
		next ();
	};
};


//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var xmlss = {};

xmlss.customReport = function (options) {
	var styles = options ["styles"];
	var sheets = options ["sheets"];
	var xml = new XMLSS ();
	for (var name in styles) {
		xml.addStyle (name, styles [name]);
	};
	// todo: has rows but no sheets
	var xWidth = {
		1: 9, 2: 14.25, 3: 19.5, 4: 24.75, 5: 30,
		6: 35.25, 7: 40.5, 8: 45.75, 9: 51, 10: 56.25,
		11: 61.5, 12: 66.75, 13: 72, 14: 77.25, 15: 82.5,
		16: 87.75, 17: 93, 18: 98.25, 19: 103.5, 20: 108.75
	};
	for (var i = 0; i < sheets.length; i ++) {
		var sheet = sheets [i];
		var sheetName = sheet ["name"];
		xml.sheet.create (sheetName);
		var orientation = "Portrait";
		if (sheet ["orientation"]) {
			if (sheet ["orientation"] == "landscape") {
				orientation = "Landscape";
			} else {
				orientation = "Portrait";
			};
		};
		xml.sheet.orientation.push (orientation);
		xml.sheet.validation.push (sheet ["validation"]);
		xml.sheet.namedRange.push (sheet ["namedRange"]);
		var scale = sheet ["scale"] || "100";
		xml.sheet.scale.push (scale);
		var autoFitHeight = false;
		if (sheet ["autoFitHeight"]) {		
			autoFitHeight = true;
		};
		xml.sheet.autoFitHeight.push (autoFitHeight);
		var marginBottom = 2.5;
		var marginLeft = 2;
		var marginRight = 2;
		var marginTop = 2.5;
		if (sheet ["margins"]) {
			var margins = sheet ["margins"];
			if (margins ["left"]) {
				marginLeft = margins ["left"] / 10;			
			};
			if (margins ["top"]) {
				marginTop = margins ["top"] / 10;
			};
			if (margins ["right"]) {
				marginRight = margins ["right"] / 10;
			};
			if (margins ["bottom"]) {
				marginBottom = margins ["bottom"] / 10;
			};
		};
		xml.sheet.marginBottom.push (marginBottom);
		xml.sheet.marginLeft.push (marginLeft);
		xml.sheet.marginRight.push (marginRight);
		xml.sheet.marginTop.push (marginTop);
		var rows = sheet ["rows"];
		for (var j = 0; j < rows.length; j ++) {
			var row = rows [j];
			var cells = row ["cells"];
			var height = row ["height"];
			var startIndex = 0;
			if (row ["startIndex"]) {
				startIndex = row ["startIndex"];
			};
			xml.pushRow (height, startIndex);
			for (var k = 0; k < cells.length; k ++) {		
				var cell = cells [k];
				var style = "Default";
				if (cell ["style"]) {
					style = cell ["style"];
				}
				var colspan = 1;
				if (cell ["colspan"]) {
					colspan = cell ["colspan"];
				}
				var rowspan = 1;
				if (cell ["rowspan"]) {
					rowspan = cell ["rowspan"];
				}
				var index = 0;
				if (cell ["startIndex"]) {
					index = cell ["startIndex"];
				}
				var text = "";
				if (cell ["text"]) {
					text = String (cell ["text"]);
				}
				var text2 = "";
				for (var l = 0; l < text.length; l ++) {
					if (text [l] == '\n') {
						text2 += "&#10;";
					} else {
						text2 += text [l];
					};
				};
				xml.pushCell (text2, style, colspan, rowspan, index);
			};
		};
		if (rows.length == 0) {
			xml.pushRow ();
			xml.pushCell ("");
		};
		var columns = sheet ["columns"];
		for (var colId in columns) {
			var column = columns [colId];
			if (column ["width"]) {
				var width = column ["width"];
				width = xWidth [width] || (width * 5);
				xml.setColWidth (width, colId, colId, true);
			};
		};
	};
    var result = xml.content ();
    return result;
};
xmlss.XMLSS = XMLSS;
function Cell (text, style, colspan, rowspan, index) {
	var me = this;
	me.text = text || "";
	me.style = style || "none";
    me.colspan = colspan || 1;
    me.rowspan = rowspan || 1;
    me.index = index || 0;
};
function Sheet (xml) {
	this.xml = xml;
	this.colWidth = {};
	this.sheetName = [];
	this.rowSheetId = {};
	this.orientation = [];
	this.validation = [];
	this.namedRange = [];
	this.scale = [];
	this.marginTop = [];
	this.marginBottom = [];
	this.marginLeft = [];
	this.marginRight = [];
	this.autoFitHeight = [];
};
Sheet.prototype.create = function (name) {
	var sheetId = this.sheetName.length;
	this.sheetName.push (name);
	this.rowSheetId [this.xml.data.length] = sheetId;
};
Sheet.prototype.getSheetNum = function () {
	return this.sheetName.length;
};
Sheet.prototype.setColWidth = function (width, colId, colId2, directWidth) {
	var mul = 6;
	if (directWidth) {
		mul = 1;
	};
	var sheetId = this.sheetName.length - 1;
	this.colWidth [sheetId] = this.colWidth [sheetId] || {};
	if (colId2 == 0) {
		this.colWidth [sheetId][colId] = width * mul;
	} else 
	if (colId2 >= colId) {
		for (var i = colId; i <= colId2; i ++) {
			this.colWidth [sheetId][i] = width * mul;
		};
	};
};
Sheet.prototype.getColWidth = function (sheetId, colId) {
	if (this.colWidth [sheetId] && this.colWidth [sheetId][colId]) {
		return this.colWidth [sheetId][colId];
	} else {
		return 9; //50; // default column width
	};
};
Sheet.prototype.getHeader = function (sheetId) {
	var header = "";
	header += "<Worksheet ss:Name='" + this.sheetName [sheetId] + "'>\n";
	if (this.xml.printTitlesRow1 > 0) {
		header += "<Names>\n";
		header += "<NamedRange ss:Name='Print_Titles' ss:RefersTo='=Sheet1!R" + this.xml.printTitlesRow1 + ":R" + this.xml.printTitlesRow2 + "'/>\n";
		header += "</Names>\n";
	};
	header += "<Table ss:ExpandedColumnCount='255' ss:ExpandedRowCount='65535' x:FullColumns='1' x:FullRows='1'>\n";
	for (var i = 1; i <= 255; i ++) {
		header += "<Column ss:AutoFitWidth='0' ss:Width='";
		header += this.getColWidth (sheetId, i);
		header += "'/>\n";
	};
	return header;
};
Sheet.prototype.getFooter = function (sheetId) {
	var footer = "";
	var xml = this.xml;
	footer += "</Table>\n";
	footer += "<WorksheetOptions xmlns='urn:schemas-microsoft-com:office:excel'>\n";
	footer += "<PageSetup>\n";
	if (xml.sheet.orientation [sheetId] == "Landscape") {
		footer += "<Layout x:Orientation='Landscape'/>\n";
	};
	footer += "<PageMargins x:Bottom='" + (xml.sheet.marginBottom [sheetId] / 2.54);
	footer += "' x:Left='" + (xml.sheet.marginLeft [sheetId] / 2.54);
	footer += "' x:Right='" + (xml.sheet.marginRight [sheetId] / 2.54);
	footer += "' x:Top='" + (xml.sheet.marginTop [sheetId] / 2.54);
	footer += "'/>\n";
	footer += "</PageSetup>\n";
	if (xml.fitWidth || xml.fitHeight) {
		footer += "<FitToPage/>\n";
	};
	footer += "<Print>\n";
	if (xml.fitWidth) {
		footer += "<FitWidth>" + xml.fitWidth + "</FitWidth>\n";
	};
	if (xml.fitHeight) {
		footer += "<FitHeight>" + xml.fitHeight + "</FitHeight>\n";
	};
	footer += "<ValidPrinterInfo/>\n";
	footer += "<PaperSizeIndex>" + xml.paperSizeIndex + "</PaperSizeIndex>\n";
	footer += "<Scale>" + xml.sheet.scale [sheetId] + "</Scale>\n";
	footer += "<HorizontalResolution>600</HorizontalResolution>\n";
	footer += "<VerticalResolution>600</VerticalResolution>\n";
	footer += "</Print>\n";
	if (xml.showPageBreakZoom) {
		footer += "<ShowPageBreakZoom/>";
	};
	footer += "<Zoom>" + xml.zoom + "</Zoom>\n";
	footer += "<Selected/>\n";
	footer += "<Panes>\n";
	footer += "<Pane>\n";
	footer += "<Number>3</Number>\n";
	footer += "<ActiveRow>13</ActiveRow>\n";
	footer += "<ActiveCol>3</ActiveCol>\n";
	footer += "</Pane>\n";
	footer += "</Panes>\n";
	footer += "<ProtectObjects>False</ProtectObjects>\n";
	footer += "<ProtectScenarios>False</ProtectScenarios>\n";
	footer += "</WorksheetOptions>\n";
	if (xml.sheet.validation [sheetId] && xml.sheet.validation [sheetId].length) {
		var validation = xml.sheet.validation [sheetId];
		for (var i = 0; i < validation.length; i ++) {
			footer += "<DataValidation  xmlns=\"urn:schemas-microsoft-com:office:excel\">\n";
			var v = validation [i];
			var range = "";
			if (v.r1) {
				range += "R" + v.r1;
			};
			if (v.c1) {
				range += "C" + v.c1;
			};
			if (v.r2 || v.c2) {
				range += ":";
				if (v.r2) {
					range += "R" + v.r2;
				};
				if (v.c2) {
					range += "C" + v.c2;
				};
			};
			footer += "<Range>" + range + "</Range>\n";
			footer += "<Type>" + v.type + "</Type>\n";
			if (v.value) {
				if (typeof (v.value) == "object" && v.value.length) {
					footer += "<CellRangeList/>\n";
					footer += "<Value>&quot;" + v.value.join (",") + "&quot;</Value>\n";
				} else {
					footer += "<Value>" + v.value + "</Value>\n";
				};
			};
			if (v.min) {
				footer += "<Min>" + v.min + "</Min>\n";
			};
			if (v.max) {
				footer += "<Max>" + v.max + "</Max>\n";
			};
			footer += "</DataValidation>\n";
		};
	};
	footer += "</Worksheet>\n";
	return footer;
};
Sheet.prototype.hasStartRow = function (rowId) {
	return this.rowSheetId.hasOwnProperty (rowId);
};
Sheet.prototype.getSheetIdByRowId = function (rowId) {
	return this.rowSheetId [rowId];
};
function XMLSS (options) {
	options = options || {};
	var me = this;
	me.paperSizeIndex = 9; // A4
	me.fitWidth = 0;
	me.fitHeight = 0;
	me.zoom = 90;
	me.marginBottom = 2.5;
	me.marginLeft = 2;
	me.marginRight = 2;
	me.marginTop = 2.5;
	me.autoFitHeight = 0;
	me.workSheetName = "Sheet1";
	me.clearColWidth ();
    me.orientation = "Portrait";
    me.showPageBreakZoom = false;
    me.printTitlesRow1 = 0;
    me.printTitlesRow2 = 0;
    me.fontSize = 10;
    me.defRowHeight = options.defRowHeight || 12.75;
	me.setDefaultStyles ();
	me.sheet = new Sheet (this);
	me.data = [];
	me.rowStartIndex = [];
	me.rowHeight = [];
	me.colWidth = {};
};
XMLSS.prototype.setDefaultStyles = function () {
	this.xmlStyles = "";
	/*
	this.xmlStyles =
		"<Style ss:ID='Default' ss:Name='Normal'>\n" +
		"<Alignment ss:Horizontal='Left' ss:Vertical='Center'/>\n" +
		"<Borders/>\n" +
		"<Font ss:FontName='Arial Cyr' x:CharSet='204' ss:Size='" + this.fontSize + "' />\n" +
		"<Interior/>\n" +
		"<NumberFormat/>\n" +
		"<Protection/>\n" +
		"</Style>\n"
	;
	*/
};
XMLSS.prototype.clearColWidth = function () {
	this.colWidth = [];
	for (var i = 0; i < 257; i ++) {
		this.colWidth.push (50.58);
	};
};
XMLSS.prototype.setColWidth = function (width, colId, colId2, directWidth) {
	var mul = 6;
	if (directWidth) {
		mul = 1;
	};
	if (this.sheet.getSheetNum () == 0) {
		if (colId2 == 0) {
			this.colWidth [colId] = width * mul;
		} else 
		if (colId2 >= colId) {
			for (var i = colId; i <= colId2; i ++) {
				this.colWidth [i] = width * mul;
			};
		};
	} else {
		this.sheet.setColWidth (width, colId, colId2, directWidth);
	};
}
XMLSS.prototype.clearRowHeight = function () {
	this.rowHeight = [];
	for (var i = 0; i < this.data.length; i ++) {
		this.rowHeight.push (this.defRowHeight);
	};
};
XMLSS.prototype.clearRowStartIndex = function () {
	this.rowStartIndex = [];
	for (var i = 0; i < this.data.length; i ++) {
		this.rowStartIndex.push (0);
	};
}
//---------------------------------------------------------------------------
// Создание стиля. Всякие нестандартные стили надо создавать непосредственно в месте их использования (отчете)
// Example: AddStyle ("sTitleBorderGray", "hAlign:center,vAlign:center,bold:true,borders:all,fontSize:12")
// options:
//   hAlign, vAlign: Left Right Top Bottom Center
//   rotate: 90
//   wrap: true
//   numberFormat: #,##0.000
//   borders: All,Left,Top,Right,Bottom,AllDash
XMLSS.prototype.addStyle = function (styleName, options_) {
	var s = "";
	var i;
	// Парсинг
	var options = {}; // option, value
	var option;
	for (i = 0; i < options_.length; i ++) {
		var c = options_ [i];
		if (c == ',' || i == options_.length - 1) {
			if (i == options_.length - 1) {
				s += c;
			};
			options [option] = s;
			s = "";
		} else 
		if (c == ':') {
			option = s;
			s = "";
		} else {
			s += c;
		};
	};
	// Установка значений по умолчанию
	if (!options ["hAlign"]) {
		options ["hAlign"] = "Left";
	};
	if (!options ["vAlign"]) {
		options ["vAlign"] = "Center";
	};
	if (!options ["fontSize"]) {
		options ["fontSize"] = "10";
	};
	if (!options ["fontName"]) {
		options ["fontName"] = "Arial Cyr";
	};
	// Стиль
	var r = "";
	r += "<Style ss:ID='" + styleName + "'>\n";
	r += "<Alignment ss:Horizontal='" + options ["hAlign"] + "' ss:Vertical='" + options ["vAlign"] + "'";
	if (options ["rotate"]) {
		r += " ss:Rotate='" + options ["rotate"] + "'";
	};
	if (options ["wrap"] == "true") {
		r += " ss:WrapText='1'";
	};
	r += "/>\n";
	if (options ["numberFormat"]) {
		r += "<NumberFormat ss:Format='" + options ["numberFormat"] + "'/>";
	};
	r += "<Borders>\n";
	if (options ["borders"]) {
		var borders = options ["borders"];
		if (borders == "AllDash") {
    		borders = "LeftDash RightDash TopDash BottomDash";
		} else
		if (borders == "All") {
    		borders = "Left Right Top Bottom";
		};
		if (borders.indexOf ("LCont") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Continuous' ss:Weight='2'/>\n";
		};
		if (borders.indexOf ("BottomDash") != -1) {
			r += "<Border ss:Position='Bottom' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else	
		if (borders.indexOf ("Bottom") != -1) {
			r += "<Border ss:Position='Bottom' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("LeftDash") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Left") != -1) {
			r += "<Border ss:Position='Left' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("RightDash") != -1) {
			r += "<Border ss:Position='Right' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Right") != -1) {
			r += "<Border ss:Position='Right' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
		if (borders.indexOf ("TopDash") != -1) {
			r += "<Border ss:Position='Top' ss:LineStyle='Dash' ss:Weight='1'/>\n";
		} else
		if (borders.indexOf ("Top") != -1) {
			r += "<Border ss:Position='Top' ss:LineStyle='Continuous' ss:Weight='1'/>\n";
		};
	};
	r += "</Borders>\n";
	r += "<Font ss:FontName='" + options ["fontName"] + "' x:CharSet='204'";
   	r += " ss:Size='" + options ["fontSize"] + "'";
	if (options ["bold"] == "true") {
		r += " ss:Bold='1'";
	};
	if (options ["italic"] == "true") {
		r += " ss:Italic='1'";
	};
	if (options ["underline"] == "true") {
		r += " ss:Underline='Single'";
	};
	if (options ["fontColor"]) {
		r += " ss:Color='" + options ["fontColor"] + "'";
	}
	r += "/>";   
	if (options ["bgColor"]) {
		r += "<Interior ss:Color='" + options ["bgColor"] + "' ss:Pattern='Solid'/>";
	};
	r += "</Style>\n";
    this.xmlStyles += r;
};
XMLSS.prototype.pushRow = function (height, rowStartIndex_) {
    if (height == 12.75) {
        height = this.defRowHeight;
    };
    this.rowStartIndex.push (rowStartIndex_);
    this.rowHeight.push (height);
    var row = [];
	this.data.push (row);
    this.row = row;
    return this.data.length - 1;
};
XMLSS.prototype.pushCell = function (s, style, colspan, rowspan, index) {
    if (!this.row.length && !index && this.rowStartIndex [this.rowStartIndex.length - 1] > 0) {
    	index = this.rowStartIndex [this.rowStartIndex.length - 1];
    };
	this.row.push (new Cell (s, style, colspan, rowspan, index));
    return this.row.length - 1;
};
XMLSS.prototype.content = function () {
	var s = this.getMultiSheetContent ();
    return s;
};
XMLSS.prototype.getMultiSheetContent = function () {
	var s, r = "";
    var fill = {};
    var x, y = 1, i, j, rowId = 0, sheetId;
    var digitNum, dotNum, textLen;
    for (var i = 0; i < this.data.length; i ++) {
    	var row = this.data [i];
		// Sheet header
		if (this.sheet.hasStartRow (rowId)) {
			sheetId = this.sheet.getSheetIdByRowId (rowId);
			if (rowId > 0) {
				r += this.sheet.getFooter (sheetId - 1);
			};
			r += this.sheet.getHeader (sheetId);
		};
		// Sheet rows
		if (this.sheet.autoFitHeight [sheetId] && this.rowHeight [y - 1] == this.defRowHeight) {
			r += "<Row ss:AutoFitHeight='1'>\n";
		} else {
			r += "<Row ss:AutoFitHeight='0' ss:Height='" + (this.rowHeight [y - 1]) + "'>\n";
		};
		x = 1;
		for (var j = 0; j < row.length; j ++) {
			var cell = row [j];
			if (cell.style != "" || cell.text != "") {
				r += "<Cell";
				if (cell.index > 0) {
            		r += " ss:Index='" + cell.index + "'";
				};
				if (cell.style != "") {
					r += " ss:StyleID='" + cell.style + "'";
				};
				if (cell.colspan > 1) {
					r += " ss:MergeAcross='" + (cell.colspan - 1) + "'";
				};
				if (cell.rowspan > 1) {
					r += " ss:MergeDown='" + (cell.rowspan - 1) + "'";
				};
				/*
				var nr = this.getNamedRange (this.sheet.namedRange [sheetId], y, x);
				if (nr) {
					r += " ss:Name='" + nr + "'";
				};
				*/
				digitNum = 0;
				dotNum = 0;
				textLen = cell.text.length;
				for (var k = 0; k < textLen; k ++) {
					if ("0123456789".indexOf (cell.text [k]) > -1) {
            			digitNum ++;
					};
					if (cell.text [k] == '.') {
            			dotNum ++;
					};
				};
				if (textLen > 0 && (digitNum + dotNum == textLen) && digitNum > 0 && dotNum <= 1) {
					r += "><Data ss:Type='String'>" + cell.text + "</Data></Cell>\n";
				} else {
					var v = cell.text.split ("<").join ("&lt;");
					v = v.split (">").join ("&gt;");
					r += "><Data ss:Type='String'>" + v + "</Data></Cell>\n";
				};
			};
			if (cell.index > 0) {
				x = cell.index + cell.colspan;
			} else {
				x += cell.colspan;
			};
		};
		r += "</Row>\n";
        y ++;
		rowId ++;
    };
	r += this.sheet.getFooter (sheetId);
	s = "<?xml version='1.0'?>\n";
	s += "<?mso-application progid='Excel.Sheet'?>\n";
	s += "<Workbook xmlns='urn:schemas-microsoft-com:office:spreadsheet'\n";
	s += "xmlns:o='urn:schemas-microsoft-com:office:office'\n";
	s += "xmlns:x='urn:schemas-microsoft-com:office:excel'\n";
	s += "xmlns:ss='urn:schemas-microsoft-com:office:spreadsheet'\n";
	s += "xmlns:html='http://www.w3.org/TR/REC-html40'>\n";
	s += "<DocumentProperties xmlns='urn:schemas-microsoft-com:office:office'>\n";
	s += "<Author>Dimas</Author>\n";
	s += "<LastAuthor>Dimas</LastAuthor>\n";
	s += "<Created>2008-04-10T14:18:34Z</Created>\n";
	s += "<Company>-</Company>\n";
	s += "<Version>11.5606</Version>\n";
	s += "</DocumentProperties>\n";
	s += "<ExcelWorkbook xmlns='urn:schemas-microsoft-com:office:excel'>\n";
	s += "<WindowHeight>10230</WindowHeight>\n";
	s += "<WindowWidth>14235</WindowWidth>\n";
	s += "<WindowTopX>480</WindowTopX>\n";
	s += "<WindowTopY>15</WindowTopY>\n";
	s += "<ProtectStructure>False</ProtectStructure>\n";
	s += "<ProtectWindows>False</ProtectWindows>\n";
	s += "</ExcelWorkbook>\n";
    s += "<Styles>\n" + this.xmlStyles + "</Styles>\n";
    s += "<Names>\n" + this.getNamedRangeList () + "</Names>\n";
    s += r;
	s += "</Workbook>\n";
	return s;
};
XMLSS.prototype.getNamedRange = function (namedRange, r, c) {
    for (var j = 0; j < namedRange.length; j ++) {
    	var o = namedRange [j];
    	if ((r >= o.r1 && c >= o.c1 && r <= o.r2 && c <= o.c2) ||
    		(r == o.r1 && (c == o.c1 || (c >= o.c1 && c <= o.c2) || !o.c1)) ||
    		(c == o.c1 && (r == o.r1 || (r >= o.r1 && r <= o.r2) || !o.r1))
    	) {
    		return o.name;
    	};
    };
};
XMLSS.prototype.getNamedRangeList = function () {
	var r = "";
    for (var i = 0; i < this.sheet.namedRange.length; i ++) {
    	var nr = this.sheet.namedRange [i];
    	if (nr && nr.length) {
		    for (var j = 0; j < nr.length; j ++) {
				var range = "";
				if (nr [j].r1) {
					range += "R" + nr [j].r1;
				};
				if (nr [j].c1) {
					range += "C" + nr [j].c1;
				};
				if (nr [j].r2 || nr [j].c2) {
					range += ":";
					if (nr [j].r2) {
						range += "R" + nr [j].r2;
					};
					if (nr [j].c2) {
						range += "C" + nr [j].c2;
					};
				};
		    	r += "<NamedRange ss:Name=\"" + nr [j].name + "\" ss:RefersTo=\"=" + this.sheet.sheetName [i] + "!" + range + "\"/>";
		    };
		};
    };
    return r;
};
// application.student.surname -> Иванов
xmlss.getAttr = function (options) {
	var storage = options.storage;
	var tags = options.tags;
	var success = options.success;
	var tokens = options.text.split (".");
	var onlyDate = false;
	if (tokens.length && tokens [tokens.length - 1] == "$date") {
		tokens.splice (tokens.length - 1, 1);
		onlyDate = true;
	};
	var o, attr;
	options.timeOffset = options.timeOffset || (-240 * 60 * 1000); // MSK +4
	var UTCDateToClientDate = function (value) {
		if (!value) {
			return value;
		};
		if (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ()) {
			value = new Date (value.getTime () - options.timeOffset);
			value = common.getUTCTimestamp (value);
			if (value.substr (11, 8) == "00:00:00") {
				value = value.substr (0, 10);
			};
		} else {
			value = common.getUTCDate (value);
		};
		return value;
	};
	async.reduce (tokens, 0, function (i, token, cb) {
		if (!i) {
			if (tokens.length > 1) {
				storage.getObject ({id: tags [token], success: function (options) {
					o = options.object;
					if (!o) {
						cb ("empty");
					} else {
						cb (null, i + 1);
					};
				}, failure: function (options) {
					cb ("empty");
				}});
			} else {
				attr = tags [token];
				cb (null, i + 1);
			};
		} else {
			attr = o.get (token);
			if (i < tokens.length - 1) {
				storage.getObject ({id: attr, success: function (options) {
					o = options.object;
					if (!o) {
						cb ("empty");
					} else {
						cb (null, i + 1);
					};
				}, failure: function (options) {
					cb ("empty");
				}});
			} else {
				cb (null, i + 1);
			};
		};
	}, function (err, result) {
		if (err == "empty" || attr == undefined || attr == null) {
			success ("");
		} else {
			if (onlyDate && attr) {
				attr = UTCDateToClientDate (attr);
				if (attr) {
					attr = attr.substr (0, 10);
				};
			} else
			if (attr && typeof (attr) == "object" && attr.getMonth) {
				attr = UTCDateToClientDate (attr);
			};
			success (attr);
		};
	});
};
xmlss.updateTags = function (options) {
	var success = options.success;
	options.timeOffset = options.request.query.time_offset_min * 60 * 1000;
	var tags = [];
	var r = options.data;
	for (var i = 1; i < r.length; i ++) {
		if (r [i] == "$" && r [i - 1] == "[") {
			var tag = "";
			for (i ++; i < r.length; i ++) {
				if (r [i] == "]") {
					break;
				} else {
					tag += r [i];
				};
			};
			if (tags.indexOf (tag) == -1) {
				tags.push (tag);
			};
		};
	};
	async.mapSeries (tags, function (tag, cb) {
		options.text = tag;
		options.success = function (result) {
			r = r.split ("[$" + tag + "]").join (result);
			cb ();
		};
		xmlss.getAttr (options);
	}, function (err, results) {
		success (r);
	});
};
xmlss.report = function (request, response, next) {
	if (request.url.indexOf ('/report?') > -1) {
		var url = request.url;
		if (request.query.custom != 1) {
			url = url.split ('&view').join ('&noview');
			url += '&custom=1';
		}
		var options = {};
		var body = request.body;
		if (body) {
			var fields = body.split ("&");
			for (var i = 0; i < fields.length; i ++) {
				var tokens = fields [i].split ("=");
				tokens [1] = tokens [1].split ("+").join ("%20");
				tokens [1] = unescape (tokens [1]);
				tokens [1] = new Buffer (tokens [1], "ascii").toString ("utf8");
				options [tokens [0]] = request.query.csv == 1 ? tokens [1] : JSON.parse (tokens [1]);
			};
			if (options.opts) {
				_.extend (options, options.opts);
			}
		};
		if (request.query.csv == 1) {
			var r = new Buffer (common.UnicodeToWin1251 (options ["body"]), "binary");
			response.header ("Content-Type", "application/x-download; charset=windows-1251");
			response.header ("Content-Disposition", "attachment; filename=report.csv");
			response.header ("Expires", "-1");
			response.header ("Content-Length", r.length);
			response.statusCode = 200;
			response.end (r);
		} else
		if (request.query.custom == 1) {
			var r = xmlss.customReport (options);
			response.header ("Content-Type", "application/x-download");
			response.header ("Content-Disposition", "attachment; filename=report.xml");
			response.header ("Expires", "-1");
			response.header ("Content-Length", Buffer.byteLength (r, "utf8"));
			response.statusCode = 200;
			response.end (r);
		} else
		if (request.query.view) {
			// olapReport
			var session = request.session;
			var storage = session.storage;
			var total = null;
			var viewId = request.query.view;
			var view = storage.viewsMap [viewId];
			var viewQuery = JSON.parse (view.get ('fquery'));
			var filter = options.filter || [];
			if (filter && filter.length) {
				viewQuery.where = viewQuery.where || [];
				if (viewQuery.where.length) {
					viewQuery.where.push ('and');				
				};
				var attrs = {};
				for (var i = 1; i < viewQuery.select.length; i += 2) {
					attrs [viewQuery.select [i]] = viewQuery.select [i - 1];
				};
				for (var i = 0; i < filter.length; i ++) {
					if (attrs [filter [i]]) {
						filter [i] = attrs [filter [i]];
					};
				};
				viewQuery.where.push (filter);
			}
			var order = null;
			if (request.query.order) {
				order = JSON.parse (request.query.order);
			}
			var dateAttrs = [];
			if (options.options) {
				dateAttrs = options.options.dateAttrs || [];
			};
			if (order && order.length) {
				viewQuery.order = order;
			};
			var colsArray = options.cols || [];
			var cols = {};
			for (var i = 0; i < colsArray.length; i ++) {
				cols [colsArray [i].attrId] = colsArray [i];
			};
			var query = new Query ({session: session, storage: storage, sql: viewQuery});
			query.generate ();
			storage.query ({sql: query.selectSQL + query.fromSQL + query.whereSQL + query.orderSQL + (storage.client.database != "mssql" ? ('\nlimit ' + config.query.maxRowNum + ' offset 0\n') : ""), success: function (options) {
				var rows = options.result.rows;
				var attrs = view.attrs, attrsNum = 0;
				var orderAttrs = [];
				for (var attrCode in attrs) {
					if (cols [attrs [attrCode].get ('fid')] && cols [attrs [attrCode].get ('fid')].hidden) {
						continue;
					};
					attrs [attrCode].set ('field', attrs [attrCode].get ('fcode').toLowerCase () + '_');
					orderAttrs.push (attrs [attrCode]);
					attrsNum ++;
				}
				orderAttrs.sort (function (a, b) {
					if (a.get ("forder") !== null && b.get ("forder") !== null && a.get ("forder") < b.get ("forder")) {
						return -1;
					};
					if (a.get ("forder") != null && b.get ("forder") == null) {
						return -1;
					};
					if (a.get ("forder") == b.get ("forder") && a.get ("fid") < b.get ("fid")) {
						return -1;
					};
					if (a.get ("forder") !== null && b.get ("forder") !== null && a.get ("forder") > b.get ("forder")) {
						return 1;
					};
					if (a.get ("forder") == null && b.get ("forder") != null) {
						return 1;
					};
					if (a.get ("forder") == b.get ("forder") && a.get ("fid") > b.get ("fid")) {
						return 1;
					};
					return 0;					
				});
				var reportColumns = {};
				for (var i = 0; i < orderAttrs.length; i ++) {
					reportColumns [i + 1] = {width: parseInt (orderAttrs [i].get ('fcolumn_width') / 6.5)};
					if (cols [orderAttrs [i].get ('fid')] && cols [orderAttrs [i].get ('fid')].width) {
						reportColumns [i + 1].width = cols [orderAttrs [i].get ('fid')].width / 6.5;
					};
				}
				var reportRows = [];
				var row = {height: 12.75, cells: []};
				for (var j = 0; j < orderAttrs.length; j ++) {
//					if (orderAttrs [j].get ('farea') != 1) {
//						continue;
//					}
					if (cols [orderAttrs [j].get ('fid')] && cols [orderAttrs [j].get ('fid')].hidden) {
						continue;
					};
					var name = orderAttrs [j].get ('fname');
					row.cells.push ({
						text: common.unescape (name), style: 'border_bold'
					});
				};
				reportRows.push (row);
				var timeOffset = request.query.time_offset_min * 60 * 1000;
				for (var i = 0; i < rows.length; i ++) {
					var row = {height: 12.75, cells: []};
					for (var j = 0; j < orderAttrs.length; j ++) {
//						if (orderAttrs [j].get ('farea') != 1) {
//							continue;
//						}
						if (cols [orderAttrs [j].get ('fid')] && cols [orderAttrs [j].get ('fid')].hidden) {
							continue;
						};
						var field = orderAttrs [j].get ('fcode').toLowerCase () + '_';
						var value = rows [i][field];
						if (typeof (value) == 'string') {
							value = value;
						} else
						if (value && typeof (value) == 'object' && value.getMonth) {
							if (dateAttrs.indexOf (orderAttrs [j].get ('fcode')) == -1 && (value.getUTCHours () || value.getUTCMinutes () || value.getUTCSeconds ())) {
								value = new Date (value.getTime () - timeOffset);
								value = common.getUTCTimestamp (value);
							} else {
								value = common.getUTCDate (value);
							};
						} else
						if (query.fieldTypeId [field] == 4) {
							if (value) {
								value = "Да";//locale.getString ('Yes');
							} else {
								value = "Нет";//locale.getString ('No');
							}
						}
						row.cells.push ({
							text: value, style: 'border'
						});
					}
					reportRows.push (row);
				}
				if (request.query.format == "xmlss") {
					var r = xmlss.customReport ({
						styles: {
							'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
							'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
							'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
							'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
							'border': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All',
							'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
							'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
							'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
							'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
							'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
							'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
							'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
						},
						sheets: [{
							name: "Sheet",
							autoFitHeight: true,
							orientation: "landscape",
							scale: 100,
							margins: {
								left: 31,
								top: 32,
								right: 33,
								bottom: 34
							},
							columns: reportColumns,
							rows: reportRows
						}]
					});
					response.header ("Content-Type", "application/x-download");
					response.header ("Content-Disposition", "attachment; filename=report.xml");
					response.header ("Expires", "-1");
					response.header ("Content-Length", Buffer.byteLength (r, "utf8"));
					response.statusCode = 200;
					response.end (r);
				} else
				if (request.query.format == "pdf") {
					pdf.buildReportFromXMLSS ({
						session: session, sheet: {
							name: "Sheet",
							autoFitHeight: true,
							orientation: "landscape",
							scale: 100,
							margins: {
								left: 31,
								top: 32,
								right: 33,
								bottom: 34
							},
							columns: reportColumns,
							rows: reportRows
						}
					}, function (err, data) {
						if (err) {
							response.end ("{success: false, error: '" + err + "'}");
						} else {
							response.header ("Content-Type", "application/x-download;");
							response.header ("Content-Disposition", "attachment; filename=report.pdf");
							response.header ("Expires", "-1");
							response.header ("Content-Length", data.length);
							response.statusCode = 200;
							response.end (data);
						}
					});
				} else
				if (request.query.format == "ods") {
//					var AdmZip = require (config.rootDir + "/node_modules/adm-zip");
					var AdmZip = require ("adm-zip");
					var zip = new AdmZip ();
					var fs = require ("fs");
					zip.addLocalFolder (__dirname + "/report/template.ods");
					var fs = require ("fs");
					fs.readFile (__dirname + "/report/template.ods/content.xml", "utf8", function (err, data) {
//						var xml2js = require (config.rootDir + "/node_modules/xml2js");
						var xml2js = require ("xml2js");
						var parser = new xml2js.Parser ({explicitArray: false});
						parser.parseString (data, function (err, doc) {
							doc ["office:document-content"]["office:body"]["office:spreadsheet"]["table:table"]["table:table-row"] = [];
							_.each (reportRows, function (row) {
								var cells = [];
								_.each (row.cells ,function (cell) {
									cell.text = cell.text || "";
									cell.style = cell.style || "";
									cell.colspan = cell.colspan || 1;
									cell.rowspan = cell.rowspan || 1;
									var v = cell.text;
									cells.push ({
										"$": {
											"office:value-type": "string",
											"calcext:value-type": "string"
										},
										"text:p": v
									});
								});
								doc ["office:document-content"]["office:body"]["office:spreadsheet"]["table:table"]["table:table-row"].push ({
									"$": {
										"table:style-name": "ro1"
									},
									"table:table-cell": cells
								});
							});
							var builder = new xml2js.Builder ();
							var xml = builder.buildObject (doc);
							zip.updateFile ("content.xml", new Buffer (xml));
							var buf = zip.toBuffer ();
							response.header ("Content-Type", "application/x-download;");
							response.header ("Content-Disposition", "attachment; filename=report.ods");
							response.header ("Expires", "-1");
							response.header ("Content-Length", buf.length);
							response.statusCode = 200;
							response.end (buf);
						});
					});
				} else
				if (request.query.format == "csv") {
					var csv = "";
					_.each (reportRows, function (row) {
						_.each (row.cells, function (cell) {
							csv += (cell.text === null ? "" : cell.text) + ";";
						});
						csv += "\n";
					});
					if (request.query.coding == "win1251") {
						csv = common.UnicodeToWin1251 (csv);
						var r = new Buffer (csv, "binary");
						response.header ("Content-Type", "application/x-download; charset=windows-1251");
						response.header ("Content-Disposition", "attachment; filename=report.csv");
						response.header ("Expires", "-1");
						response.header ("Content-Length", csv.length);
						response.statusCode = 200;
						response.end (r);
					} else {
						response.header ("Content-Type", "application/x-download; charset=utf-8");
						response.header ("Content-Disposition", "attachment; filename=report.csv");
						response.header ("Expires", "-1");
						response.header ("Content-Length", Buffer.byteLength (csv, "utf8"));
						response.statusCode = 200;
						response.end (csv);
					}
				} else
				if (request.query.format == "xlsx") {
					var rep = new ReportXSLX ();
					options.styles = {
						'default': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9',
						'center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9',
						'center_bold': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,bold:true',
						'bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,bold:true',
						'border': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All',
						'border_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All',
						'border_bold': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
						'border_bold_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true,underline:true',
						'border_underline': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:All,underline:true',
						'border_bold_center': 'hAlign:Center,vAlign:Center,wrap:true,fontSize:9,borders:All,bold:true',
						'border_bottom': 'hAlign:Left,vAlign:Center,wrap:true,fontSize:9,borders:Bottom',
						'right': 'hAlign:Right,vAlign:Center,wrap:true,fontSize:9'
					};
					options.sheets = [{
						name: "Sheet",
						autoFitHeight: true,
						orientation: "landscape",
						scale: 100,
						margins: {
							left: 31,
							top: 32,
							right: 33,
							bottom: 34
						},
						columns: reportColumns,
						rows: reportRows
					}];
					rep.build (options);
					var buf = XLSX.write (rep.workbook, {
					    type: "base64"
					});
					var r = new Buffer (buf, "base64");
					response.header ("Content-Type", "application/x-download;");
					response.header ("Content-Disposition", "attachment; filename=report.xlsx");
					response.header ("Expires", "-1");
					response.header ("Content-Length", r.length);
					response.statusCode = 200;
					response.end (r);
					delete rep;
				}
			}});
		} else {
			// template
			var session = request.session;
			var storage = session.storage;
			var filename = config.storages [storage.code].rootDir + (request.query.files ? "/files/" : "/reports/") + request.query.template;
			var data;
			_.extend (options, request.query);
			if (options.format == "xmlss") {
				async.series ([
					function (cb) {
						fs.readFile (filename, function (err, _data) {
							data = _data;
							cb (err);
						});
					},
					function (cb) {
						if (options.showTags) {
							data = data.toString ();
							cb ();
						} else {
							xmlss.updateTags ({request: request, tags: options, storage: storage, data: data.toString (), success: function (r) {
								data = r;
								cb ();
							}});
						};
					}
				], function (err, results) {
					response.header ("Content-Type", "application/x-download");
					var tokens = options.template.split (".");
					var filename = "report." + tokens [tokens.length - 1];
					response.header ("Content-Disposition", "attachment; filename=" + filename);
					response.header ("Expires", "-1");
					response.header ("Content-Length", Buffer.byteLength (data, "utf8"));
					response.statusCode = 200;
					response.end (data);
				});
			}
			if (options.format == "docx") {
				async.series ([
					function (cb) {
						fs.readFile (filename, "binary", function (err, _data) {
							data = _data;
							cb (err);
						});
					}
				], function (err, results) {
//					var Docxtemplater = require (config.rootDir + "/node_modules/docxtemplater");
					var Docxtemplater = require ("docxtemplater");
					var doc = new Docxtemplater (data);
					doc.setOptions ({parser: function (tag) {
						return {
							get: function (scope) {
								if (tag === ".") {
									return scope;
								} else {
									return scope [tag];
								}
							}
						};
					}});
					doc.setData (options);
					if (!options.showTags) {
						doc.render ();
					}
					var buf = doc.getZip ().generate ({type: "nodebuffer"});
					response.header ("Content-Type", "application/x-download");
					response.header ("Content-Disposition", "attachment; filename=report.docx");
					response.header ("Expires", "-1");
					response.header ("Content-Length", buf.length);
					response.statusCode = 200;
					response.end (buf);
				});
			}
		};
	} else {
		next ();
	}
}


//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var pdf = {};
/*
	session
	sheet
*/
pdf.buildReportFromXMLSS = function (options, cb) {
	var session = options.session;
	var sheet = options.sheet;
	var columns = sheet.columns;
	var orientation = sheet.orientation;
	var rows = sheet.rows;
	var html =
		'<html>\n<head>\n<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">\n' +
		"<style type='text/css'>\n" +
		"* {\n" +
		"   font-family: Arial;\n" +
		"   font-size: 10pt;\n" +
		"}\n" +
		"</style>\n" +
		"</head>\n<body>\n"
	;
	if (sheet.ell == "%") {
		html += "<table cellspacing=0 width=100% border=1>\n";
	} else {
		html += "<table cellspacing=0 border=1>\n";
	};
	for (var i = 0; i < rows.length; i ++) {
		var row = rows [i];
		var cells = row.cells;
		var r = "<tr height=20>\n";
		var curCol = 1;
		for (var j = 0; j < cells.length; j ++) {
			var cell = cells [j];
			cell.text = cell.text || "";
			cell.style = cell.style || "";
			cell.colspan = cell.colspan || 1;
			cell.rowspan = cell.rowspan || 1;
			var v = cell.text;
			if (v === undefined || v === null || v === "") {
				v = "<img width=1 height=1>";
			};
			if (cell.style.indexOf ("bold") > -1) {
				v = "<b>" + v + "</b>";
			};
			var style = "";
			var width = 0;
			for (var k = curCol; k < (curCol + cell.colspan); k ++) {
				width += columns [k] ? (columns [k].width || 0) : 0;
			};
			if (width) {
				style += "width: " + width + sheet.ell + ";";
			};
			if (cell.style.indexOf ("underline") > -1) {
				style += "border-bottom: 1px solid #000000;";
			};
			var align = "";
			if (cell.style.indexOf ("center") > -1) {
				align = " align=center ";
			};
			r += "\t<td colspan=" + cell.colspan + " rowspan=" + cell.rowspan + align + " style='" + style + "'>" + v + "</td>\n";
			curCol += cell.colspan;
		};
		r += "</tr>\n";
		html += r;
	};
	html += "</table>\n</body>\n</html>\n";
	fs.writeFile (__dirname + "/report/pdf/" + session.id + ".html", html, function (err) {
		if (err) {
			return cb (err);
		};
		var spawn = require ('child_process').spawn;
		var args = [
			"--orientation", orientation == "landscape" ? "Landscape" : "Portrait", "--dpi", 300, "--page-size", "A4",
			__dirname + "/report/pdf/" + session.id + ".html",
			__dirname + "/report/pdf/" + session.id + ".pdf"
		];
//		if (sheet.margins) {
//			args = args.concat ("--margin-left", sheet.margins.left, "--margin-top", sheet.margins.top, "--margin-right", sheet.margins.right, "--margin-bottom", sheet.margins.bottom);
//		};
		var filePath = __dirname + "/report/pdf/wkhtmltopdf";
		if (config.report && config.report.pdf) {
			filePath = config.report.pdf;
		}
		var cp = spawn (filePath, args);
		cp.stdout.on ("data", function (data) {
			console.log ("stdout: " + data);
		});
		cp.stderr.on ("data", function (data) {
			console.log ("stderr: " + data);
		});
		cp.on ("close", function (code) {
			fs.unlink (__dirname + "/report/pdf/" + session.id + ".html", function (err) {
				if (err) {
					return cb (err);
				}
				fs.readFile (__dirname + "/report/pdf/" + session.id + ".pdf", function (err, data) {
					if (err) {
						return cb (err);
					}
					fs.unlink (__dirname + "/report/pdf/" + session.id + ".pdf", function (err) {
						if (err) {
							return cb (err);
						}
						cb (null, data);
					});
				});
			});
		});
	});
};
pdf.report = function (request, response, next) {
	var session = request.session;
	var storage = session.storage;
	if (request.url.indexOf ('/pdf?') > -1 && projects.sessions [session.id]) {
		var options = {};
		var body = request.body;
		if (body) {
			body = body.split ("+").join ("%20");
			body = unescape (body);
			body = new Buffer (body, "ascii").toString ("utf8");
			var fields = body.split ("&");
			for (var i = 0; i < fields.length; i ++) {
				var tokens = fields [i].split ("=");
				options [tokens [0]] = JSON.parse (tokens [1]);
			};
		};
		var sheet = options ["sheets"][0];
		pdf.buildReportFromXMLSS ({
			sheet: sheet, session: session
		}, function (err, data) {
			if (err) {
				response.end ("{success: false, error: '" + err + "'}");
			} else {
				response.header ("Content-Type", "application/x-download;");
				response.header ("Content-Disposition", "attachment; filename=report.pdf");
				response.header ("Expires", "-1");
				response.header ("Content-Length", data.length);
				response.statusCode = 200;
				response.end (data);
			}
		});
	} else {
		next ();
	};
};


/*
	Генератор XLSX
	Только текст, объединение ячеек, рамки, выравнивание (вертикаль, горизонталь)
*/
var XLSX = require ("xlsx");
var ReportXSLX = Backbone.Model.extend ({
	addStyle: function (name, style) {
		var me = this;
		me.styles = me.styles || {};
		var o = {
			alignment: {
				horizontal: "left",
				vertical: "top"
			},
			font: {
				name: "Arial",
				sz: "9"
			}
		};
		_.each (style.split (","), function (pair) {
			var attr = pair.split (":")[0];
			var value = pair.split (":")[1];
			if (attr == "hAlign") {
				o.alignment.horizontal = {"Left": "left", "Center": "center", "Right": "right"}[value];
			};
			if (attr == "vAlign") {
				o.alignment.vertical = {"Left": "top", "Center": "center", "Right": "bottom"}[value];
			};
			if (attr == "wrap") {
				o.alignment.wrapText = true;
			};
			if (attr == "rotate") {
				o.alignment.textRotation = 90;
			};
			if (attr == "fontSize") {
				o.font.sz = value;
			};
			if (attr == "fontName") {
				o.font.name = value;
			};
			if (attr == "bold") {
				o.font.bold = true;
			};
			if (attr == "italic") {
				o.font.italic = true;
			};
			if (attr == "underline") {
				o.font.underline = true;
			};
			if (attr == "borders") {
				o.border = {
					left: {style: "thin", color: {auto: 1}},
					right: {style: "thin", color: {auto: 1}},
					top: {style: "thin", color: {auto: 1}},
					bottom: {style: "thin", color: {auto: 1}}
				};
			};
		});
		me.styles [name] = o;
	},
	addCell: function (ws, x, y, cell) {
		var me = this;
		var w = cell.colspan > 1 ? cell.colspan - 1 : 0;
		var h = cell.rowspan > 1 ? cell.rowspan - 1 : 0;
		if (w || h) {
			ws ["!merges"]  = ws ["!merges"] || [];
			ws ["!merges"].push ({s: {c: x, r: y}, e: {c: x + w, r: y + h}});
		};
		for (var i = x; i <= x + w; i ++) {
			for (var j = y; j <= y + h; j ++) {
		        ws [XLSX.utils.encode_cell ({c: i, r: j})] = {
					v: cell.text === null ? "" : cell.text,
					t: "s",
					s: me.styles [cell.style]
				};
			};
		};
	},
	addCols: function (ws, columns) {
		var me = this;
		ws ["!cols"] = _.map (columns, function (o) {
			var w;
			if (_.isObject (o)) {
				w = o.width;
			} else {
				w = o;
			};
			return {wch: w};
		});
	},
	addSheet: function (sheet) {
		var me = this;
		var ws = {}, y = 0, xMax = 0;
		_.each (sheet.rows, function (row) {
			var x = row.startIndex ? (row.startIndex - 1) : 0;
			_.each (row.cells, function (cell) {
				if (cell.startIndex) {
					x = cell.startIndex - 1;
				};
				me.addCell (ws, x, y, cell);
				x += cell.colspan || 1;
			});
			xMax = x > xMax ? x : xMax;
			y ++;
		});
		me.addCols (ws, sheet.columns);
		ws ["!ref"] = XLSX.utils.encode_range ({s: {c: 0, r: 0}, e: {c: xMax, r: y}});
		me.workbook.SheetNames.push (sheet.name);
		me.workbook.Sheets [sheet.name] = ws;
	},
	build: function (opts) {
		var me = this;
		me.workbook = {
			SheetNames: [],
			Sheets: {}
		};
		_.each (opts ["styles"], function (style, name) {
			me.addStyle (name, style);
		});
		_.each (opts ["sheets"], function (sheet) {
			me.addSheet (sheet);
		});
	}
});
var xlsx = {};
xlsx.report = function (req, res, next) {
	if (req.url.indexOf ("/report?") > -1 && req.query.format == "xlsx" && !req.query.view) {
		var opts = {};
		var body = req.body;
		if (body) {
			var fields = body.split ("&");
			for (var i = 0; i < fields.length; i ++) {
				var tokens = fields [i].split ("=");
				tokens [1] = tokens [1].split ("+").join ("%20");
				tokens [1] = unescape (tokens [1]);
				tokens [1] = new Buffer (tokens [1], "ascii").toString ("utf8");
				opts [tokens [0]] = JSON.parse (tokens [1]);
			};
		};
		var rep = new ReportXSLX ();
		rep.build (opts);
		log.debug ({workbook: rep.workbook});
		if (req.query.convert_csv) {
			var csv = XLSX.utils.sheet_to_csv (rep.workbook.Sheets [rep.workbook.SheetNames [0]], {FS: ";"});
			if (req.query.win1251) {
				var r = new Buffer (common.UnicodeToWin1251 (csv), "binary");
				res.header ("Content-Type", "application/x-download; charset=windows-1251");
				res.header ("Content-Disposition", "attachment; filename=report.csv");
				res.header ("Expires", "-1");
				res.header ("Content-Length", r.length);
				res.statusCode = 200;
				res.end (r);
			} else {
				res.header ("Content-Type", "application/x-download;");
				res.header ("Content-Disposition", "attachment; filename=report.csv");
				res.header ("Expires", "-1");
				res.header ("Content-Length", csv.length);
				res.statusCode = 200;
				res.end (csv);
			};
		} else {
			var buf = XLSX.write (rep.workbook, {
			    type: "base64"
			});
			var r = new Buffer (buf, "base64");
			res.header ("Content-Type", "application/x-download;");
			res.header ("Content-Disposition", "attachment; filename=report.xlsx");
			res.header ("Expires", "-1");
			res.header ("Content-Length", r.length);
			res.statusCode = 200;
			res.end (r);
		};
		delete rep;
	} else {
		next ();
	};
};

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
/*
	Ограничения:
	* Создает только для последней ревизии
	* Машина времени работает только для данных (tobject, tobject_attr, toc)
*/
var tm = {};
tm.remove = function (options) {
	var me = this;
	var success = options.success;
	var session = options.session;
	var storage = options.storage;
	var revision = options.revision;
	var s = 
		"select fid, fcode from tclass\n" +
		"where\n" +
		"\t" + storage.getCurrentFilter () + "\n" +
		"\tand fid >= 1000\n" +
		"order by fid\n"
	;
	storage.query ({session: session, sql: s, success: function (options) {
		var classes = options.result.rows;
		async.eachSeries (classes, function (cls, cb) {
			var name = "tm_" + cls.fcode + "_" + cls.fid;
			storage.client.isTableExists ({session: session, table: name, success: function (result) {
				if (result) {
					storage.query ({session: session, sql: "delete from " + name + " where frevision_id=" + revision, success: function () {
						cb ();
					}});
				} else {
					cb ();
				};
			}});
		}, success);
	}});
};
tm.create = function (options) {
	var storageCode = options.storageCode;
	var success = options.success;
	var revision;
	var storage;
	var session;
	var classes;
	log.info ({cls: "tm", fn: "create (" + storageCode + ")"});
	async.series ([
		function (cb) {
			log.info ({cls: "tm"}, "getStorage");
			projects.getStorage ({storageCode: storageCode, success: function (options) {
				storage = options.storage;
				session = {
					id: "tm_create_" + storageCode,
					username: "admin",
					userId: null
				};
				cb ();
			}});
		},
		function (cb) {
			log.info ({cls: "tm"}, "startTransaction");
			storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "toc_create_" + storageCode, success: function () {
				revision = storage.lastRevision;
				cb ();
			}, failure: function (options) {
				cb (options.error);
			}});
		},
		function (cb) {
			log.info ({cls: "tm"}, "remove");
			tm.remove ({storage: storage, revision: revision, session: session, success: function () {
				cb ();
			}});
		},
		function (cb) {
			log.info ({cls: "tm"}, "classes");
			var s = 
				"select\n" +
				"\tfid, fcode\n" +
				"from\n" +
				"\ttclass\n" +
				"where\n" +
				"\t" + storage.getCurrentFilter () + "\n" +
				"\tand fid >= 1000\n" +
				"order by fid\n"
			;
			storage.query ({session: session, sql: s, success: function (options) {
				classes = options.result.rows;
				cb ();
			}});
		},
		function (cb) {
			log.info ({cls: "tm"}, "process");
			async.eachSeries (classes, function (cls, cb) {
				var classId = cls.fid;
				var classCode = cls.fcode;
				var tmName = "tm_" + classCode + "_" + classId;
				var classAttrs;
				async.series ([
					function (cb) {
						storage.client.isTableExists ({session: session, table: tmName, success: function (result) {
							if (result) {
								cb ();
							} else {
								storage.query ({session: session, sql: "create table " + tmName + " (fobject_id bigint not null, frevision_id bigint not null)", success: function () {
									storage.client.createIndex ({session: session, table: tmName, field: "fobject_id", success: function () {
										storage.client.createIndex ({session: session, table: tmName, field: "frevision_id", success: function () {
											cb ();
										}});
									}});
								}});
							};
						}});
					},
					function (cb) {
						storage.query ({session: session, sql:
							"select\n" +
							"\tfid, fcode, ftype_id\n" +
							"from\n" +
							"\ttclass_attr\n" +
							"where\n" +
							"\t" + storage.getCurrentFilter () + "\n" +
							"\tand fclass_id = " + classId + "\n" +
							"order by fid\n"
						, success: function (options) {
							classAttrs = options.result.rows;
							cb ();
						}});
					},
					function (cb) {
						async.eachSeries (classAttrs, function (classAttr, cb) {
							var classAttrId = classAttr.fid;
							var tmFieldName = classAttr.fcode + "_" + classAttrId;
							storage.client.isFieldExists ({session: session, table: tmName, field: tmFieldName, success: function (result) {
								if (result) {
									cb ();
								} else {
									var type = "$tnumber$";
									var ftype = "fnumber";	    
									switch (classAttr.ftype_id) {
										case 2:
											type = "$tnumber_value$";
										break;
										case 1:
										case 5:
											type = "$ttext$";
											ftype = "fstring";
										break;
										case 3:
											type = "$ttimestamp$";
											ftype = "ftime";
										break;
									};
									s = "alter table " + tmName + " add " + tmFieldName + " " + type;
									storage.query ({session: session, sql: s, success: function () {
										cb ();
									}});
								};
							}});
						}, function (err) {
							cb ();
						});
					},
					function (cb) {
						storage.client.isTableExists ({session: session, table: classCode + "_" + classId, success: function (result) {
							if (result) {
								var caFields = [];
								for (var i = 0; i < classAttrs.length; i ++) {
									var field = classAttrs [i].fcode + "_" + classAttrs [i].fid;
									if (caFields.indexOf (field) == -1) {
										caFields.push (field);
									};
								};
								var s = 
									"insert into " + tmName + " (fobject_id, frevision_id" + (caFields.length ? ", " : "") + caFields.join (", ") + ")\n" +
									"select fobject_id, " + revision + (caFields.length ? ", " : "") + caFields.join (", ") + " from " + classCode + "_" + classId
								;
								storage.query ({session: session, sql: s, success: function () {
									cb ();
								}});
							} else {
								cb ();
							};
						}});
					}
				], function (err, results) {
					cb ();
				});
			}, function (err) {
				cb ();
			});
		},
		function (cb) {
			log.info ({cls: "tm"}, "update");
			storage.query ({session: session, sql: "update trevision set ftoc=1 where fid=" + revision, success: function () {
				cb ();
			}});
		},
		function (cb) {
			log.info ({cls: "tm"}, "commitTransaction");
			storage.commitTransaction ({session: session, success: function () {
				cb ();
			}});
		}
	], function (err) {
		log.info ({cls: "tm"}, "end");
		if (success) {
			success (revision);
		};
	});
};
tm.getRevisions = function (req, res, next) {
	if (req.url.indexOf ("/get_revisions?") > -1) {
		var session = req.session;
		var storage = session.storage;
		storage.query ({session: session, sql: "select fid, fdate from trevision where ftoc=1 order by fdate desc", success: function (options) {
			var r = [];
			for (var i = 0; i < options.result.rows.length; i ++) {
				var row = options.result.rows [i];
				r.push ({id: row.fid, date: row.fdate});
			};
			res.send (common.ToJSONString (r));
		}});
	} else {
		next ();
	};
};
tm.setRevision = function (req, res, next) {
	if (req.url.indexOf ("/set_revision?") > -1) {
		var session = req.session;
		session.revision = req.query.id;
		res.send ({ok: 1});
	} else {
		next ();
	};
};
tm.build = function (storage) {
	log.info ({cls: "tm"}, "build");
	if (!storage.config.visualObjectum) {
		return;
	};
	var buildTime = storage.config.visualObjectum.timeMachine ? storage.config.visualObjectum.timeMachine.buildTime : null;
	if (!buildTime) {
		return;
	};
	function build () {
		log.info ({cls: "tm"}, "start build");
		tm.create ({storageCode: storage.code, success: function (revision) {
			storage.query ({sql: "select fid, fdate from trevision where fid=" + revision, success: function (options) {
				var row = options.result.rows [0];
				storage.visualObjectum.timeMachine.dates.push ({id: row.fid, date: row.fdate});
			}});
		}});
		setTimeout (build, 24 * 60 * 60 * 1000);
	};
	var bt = buildTime.split (":");
	var cd = new Date ();
	var bd = new Date ();
	if (Number (bt [0]) < cd.getHours ()) {
		bd.setDate (cd.getDate () + 1);
	};
	if (Number (bt [0]) == cd.getHours () && Number (bt [1]) < cd.getMinutes ()) {
		bd.setDate (cd.getDate () + 1);
	};
	bd.setHours (bt [0]);
	bd.setMinutes (bt [1]);
	bd.setSeconds (0);
	bd.setMilliseconds (0);
	log.info ({cls: "tm"}, "setTimeout " + buildTime + " " + (bd.getTime () - cd.getTime ()));
	setTimeout (build, bd.getTime () - cd.getTime ());
};

/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
var Ose = function (options) {
	var storage = options.storage;
	var success = options.success;
	var ose = this;
	if (config.storages [storage.code]) {
		ose.config = config.storages [storage.code].ose || {enabled: 0};
	} else {
		ose.config = {enabled: 0};
	};
	ose.subject = {
		getRoles: function (id) {
			if (!ose.config.enabled) {
				return [];
			};
			return cache.srole [id] || [];
		},
		isAdmin: function (username) {
			if (!username || cache.admins.indexOf (username) > -1) {
				return 1;
			} else {
				return 0;
			};
		},
		can: function (options) {
			var access = options.access;
			var success = options.success;
			var session = options.session;
			var object = options.object;
			var class_ = cache.class_ [object.get ("fclass_id")];
			if (class_ && (
				(class_ [null] && class_ [null][access]) || (class_ [session.userId] && class_ [session.userId][access])
			)) {
				success ();
				return;
			};
			for (var i = 0; i < session.roles.length; i ++) {
				if (class_ [session.roles [i]] && class_ [session.roles [i]][access]) {
					success ();
					return;
				};
			};
			var subjects = session.roles.concat (session.userId);
			storage.execute ({session: session, sql: {
				select: [
					{"a": "id"}, "id"
				],
				from: [
					{"a": "ose.object"}
				],
				where: [
					{"a": access}, "=", 1, "and", {"a": "object"}, "=", object.get ("id"), "and", 
					{"a": "subject"}, "in", subjects.join (".,.").split (".")
				]
			}, success: function (r) {
				if (r.length) {
					success ();
				} else {
					success ({cancel: 1});
				};
			}});
		}
	};
	ose.object = {};
	var cache = {
		admins: [],
		ext: {},
		srole: {},
		ext: {},
		class_: {}
	};
	ose.load = function (options) {
		options = options || {};
		var success = options.success;
		async.series ([
			function (cb) {
				storage.execute ({sql: {
					select: [
						{"a": "role"}, "role",
						{"a": "subject"}, "subject"
					],
					from: [
						{"a": "ose.srole"}
					]
				}, success: function (r) {
					cache.srole = {};
					for (var i = 0; i < r.length; i ++) {
						var role = r.get (i, "role");
						var subject = r.get (i, "subject");
						cache.srole [subject] = cache.srole [subject] || [];
						cache.srole [subject].push (role);
					};
					cb ();
				}});
			},
			function (cb) {
				storage.execute ({sql: {
					select: [
						{"a": "classAttr"}, "classAttr",
						{"a": "give"}, "give",
						{"a": "take"}, "take"
					],
					from: [
						{"a": "ose.ext"}
					]
				}, success: function (r) {
					cache.ext = {};
					for (var i = 0; i < r.length; i ++) {
						var classAttr = r.get (i, "classattr");
						cache.ext [classAttr] = cache.ext [classAttr] || {};
						cache.ext [classAttr] = {
							classAttr: classAttr,
							take: r.get (i, "take"),
							give: r.get (i, "give")							
						};
					};
					cb ();
				}});
			},
			function (cb) {
				storage.execute ({sql: {
					select: [
						{"a": "subject"}, "subject",
						{"a": "class"}, "class",
						{"a": "read"}, "read",
						{"a": "update"}, "update",
						{"a": "delete"}, "delete"
					],
					from: [
						{"a": "ose.object"}
					],
					where: [
						{"a": "class"}, "is not null"
					],
					order: [
						{"a": "npp"}
					]
				}, success: function (r) {
					cache.class_ = {};
					for (var i = 0; i < r.length; i ++) {
						var subject = r.get (i, "subject");
						var class_ = r.get (i, "class");
						cache.class_ [class_] = cache.class_ [class_] || {};
						cache.class_ [class_][subject] = {
							read: r.get (i, "read"),
							update: r.get (i, "update"),
							delete_: r.get (i, "delete")
						};
					};
					cb ();
				}});
			},
			function (cb) {
				cache.admins = ["admin"];
				if (ose.config.admins) {
					storage.execute ({sql: {
						select: [
							{"a": "login"}, "login"
						],
						from: [
							{"a": ose.config.admins}
						]
					}, success: function (r) {
						for (var i = 0; i < r.length; i ++) {
							cache.admins.push (r.get (i, "login"));
						};
						cb ();
					}});
				} else {
					cb ();
				};
			}
		], function (err, results) {
			if (success) {
				success ();
			};
		});
	};
	ose.freeResources = function () {
		if (!ose.config.enabled) {
			return;
		};
		clearInterval (ose.loadIntervalId);
	};
	// init
	if (!ose.config.enabled) {
		success ();
		return;
	};
	var roleClassId = storage.getClass ("ose.role").get ("fid");
	var sroleClassId = storage.getClass ("ose.srole").get ("fid");
	var extClassId = storage.getClass ("ose.ext").get ("fid");
	var objectClassId = storage.getClass ("ose.object").get ("fid");
	var adminClassId = storage.getClass (ose.config.admins).get ("fid");
	var oseClasses = [roleClassId, sroleClassId, extClassId, objectClassId, adminClassId];
	var beforecreateobject = function (options) {
		var success = options.success;
		if (options.session && options.session.username && !ose.subject.isAdmin (options.session.username) && options.classId != objectClassId && oseClasses.indexOf (options.classId) > -1) {
			options.cancel = 1;
		};
		success (options);
	};
	storage.on ("beforecreateobject", beforecreateobject);
	var aftercreateobject = function (options) {
		var success = options.success;
		var classId = options.classId;
		if (!cache.class_ [classId] || !options.session || ose.subject.isAdmin (options.session.username)) {
			success ();
			return;
		};
		var object = options.object;
		var session = options.session;
		storage.un ("aftercreateobject", aftercreateobject);
		storage.un ("beforecreateobject", beforecreateobject);
		storage.createObject ({session: session, classId: objectClassId, success: function (options) {
			storage.on ("aftercreateobject", aftercreateobject);
			storage.on ("beforecreateobject", beforecreateobject);
			var o = options.object;
			o.set ("object", object.get ("id"));
			o.set ("subject", session.userId);
			o.set ("read",  1);
			o.set ("update", 1);
			o.set ("delete", 1);
			storage.un ("beforecommitobject", beforecommitobject);
			o.commit ({session: session, success: function () {
				storage.on ("beforecommitobject", beforecommitobject);
				success ();
			}});
		}});
	};
	storage.on ("aftercreateobject", aftercreateobject);
	var aftergetobject = function (options) {
		var success = options.success;
		var session = options.session;
		var object = options.object;
		if (!object || !session || ose.subject.isAdmin (session.username)) {
			success ();
			return;
		};
		if (oseClasses.indexOf (object.get ("fclass_id")) > -1) {
			success ({cancel: 1});
			return;
		};
		if (!cache.class_ [object.get ("fclass_id")]) {
			success ();
			return;
		};
		ose.subject.can ({
			session: session,
			object: object,
			access: "read",
			success: success
		});
	};
	storage.on ("aftergetobject", aftergetobject);
	ose.ext = function (options) {
		var success = options.success;
		var session = options.session;
		var object = options.object;
		var attrs = [];
		var cls = storage.getClass (object.get ("fclass_id"));
		for (var attr in object.data) {
			if (['id', 'fclass_id', 'fspace_id'].indexOf (attr) > -1) {
				continue;
			}
			if (!object.originalData.hasOwnProperty (attr) || object.originalData [attr] != object.data [attr]) {
				if (cls.attrs [attr]) {
					attrs.push (cls.attrs [attr]);
				};
			};
		};
		async.eachSeries (attrs, function (attr, cb) {
			var objectId = object.data [attr.get ("fcode")];
			var ext = cache.ext [attr.get ("fid")];
			if (ext && objectId) {
				var r1 = [], r2 = [];
				async.series ([
					function (cb) {
						storage.execute ({session: session, sql: {
							select: [
								{"a": "npp"}, "npp",
								{"a": "subject"}, "subject",
								{"a": "object"}, "object",
								{"a": "read"}, "read",
								{"a": "update"}, "update",
								{"a": "delete"}, "delete"
							],
							from: [
								{"a": "ose.object"}
							],
							where: [
								{"a": "object"}, "in", [object.get ("id"), ",", objectId]
							]
						}, success: function (r) {
							for (var i = 0; i < r.length; i ++) {
								var o = {
									npp: r.get (i, "npp"),
									subject: r.get (i, "subject"),
									read: r.get (i, "read"),
									update: r.get (i, "update"),
									delete_: r.get (i, "delete")
								};
								if (r.get (i, "object") == objectId) {
									r1.push (o);
								} else {
									r2.push (o);
								};
							};
							cb ();
						}});
					},
					function (cb) {
						if (ext.take) {
							async.eachSeries (r1, function (r, cb) {
								var has = 0;
								for (var i = 0; i < r2.length; i ++) {
									if (r2 [i].subject == r.subject && r2 [i].read == r.read && r2 [i].update == r.update && r2 [i].delete_ == r.delete_) {
										has = 1;
										break;
									};
								};
								if (has) {
									cb ();
								} else {
									storage.un ("aftercreateobject", aftercreateobject);
									storage.un ("beforecreateobject", beforecreateobject);
									storage.createObject ({session: session, classId: objectClassId, success: function (options) {
										storage.on ("aftercreateobject", aftercreateobject);
										storage.on ("beforecreateobject", beforecreateobject);
										var o = options.object;
										o.set ("object", object.get ("id"));
										o.set ("subject", r.subject);
										o.set ("read",  r.read);
										o.set ("update", r.update);
										o.set ("delete", r.delete_);
										storage.un ("beforecommitobject", beforecommitobject);
										o.commit ({session: session, success: function () {
											storage.on ("beforecommitobject", beforecommitobject);
											cb ();
										}});
									}});
								};
							}, function (err) {
								cb ();
							});
						} else {
							cb ();
						};
					},
					function (cb) {
						if (ext.give) {
							async.eachSeries (r2, function (r, cb) {
								var has = 0;
								for (var i = 0; i < r1.length; i ++) {
									if (r1 [i].subject == r.subject && r1 [i].read == r.read && r1 [i].update == r.update && r1 [i].delete_ == r.delete_) {
										has = 1;
										break;
									};
								};
								if (has) {
									cb ();
								} else {
									storage.un ("aftercreateobject", aftercreateobject);
									storage.un ("beforecreateobject", beforecreateobject);
									storage.createObject ({session: session, classId: objectClassId, success: function (options) {
										storage.on ("aftercreateobject", aftercreateobject);
										storage.on ("beforecreateobject", beforecreateobject);
										var o = options.object;
										o.set ("object", objectId);
										o.set ("subject", r.subject);
										o.set ("read",  r.read);
										o.set ("update", r.update);
										o.set ("delete", r.delete_);
										storage.un ("beforecommitobject", beforecommitobject);
										o.commit ({session: session, success: function () {
											storage.on ("beforecommitobject", beforecommitobject);
											cb ();
										}});
									}});
								};
							}, function (err) {
								cb ();
							});
						} else {
							cb ();
						};
					}
				], function (err, results) {
					cb ();
				});
			} else {
				cb ();
			};
		}, function (err) {
			success ();
		});
	};
	var beforecommitobject = function (options) {
		var success = options.success;
		var session = options.session;
		var object = options.object;
		async.series ([
			function (cb) {
				if (!session || ose.subject.isAdmin (session.username)) {
					cb ("ok");
				} else {
					cb ();
				};
			},
			function (cb) {
				if (object.get ("fclass_id") == objectClassId) {
					if (object.get ("object")) {
						storage.un ("aftergetobject", aftergetobject);
						storage.getObject ({session: session, id: object.get ("object"), success: function (options) {
							storage.on ("aftergetobject", aftergetobject);
							var o = options.object;
							if (o) {
								ose.subject.can ({
									session: session,
									object: o,
									access: "update", // todo: grant
									success: function (options) {
										if (options	&& options.cancel) {
											cb ("cancel");
										} else {
											cb ("ok");
										};
									}
								});
							} else {
								cb ("cancel");
							};
						}});
					} else {
						cb ("cancel");
					};
				} else {
					cb ();
				};
			},
			function (cb) {
				if (oseClasses.indexOf (object.get ("fclass_id")) > -1) {
					cb ("cancel");
				} else
				if (!cache.class_ [object.get ("fclass_id")]) {
					cb ("ok");
				} else {
					ose.subject.can ({
						session: session,
						object: object,
						access: "update",
						success: function (options) {
							if (options	&& options.cancel) {
								cb ("cancel");
							} else {
								cb ("ok");
							};
						}
					});
				};
			}
		], function (err, results) {
			if (err == "cancel") {
				success ({cancel: 1});
			} else {
				ose.ext ({
					object: object, 
					session: session, 
					success: success
				});
			};
		});
	};
	storage.on ("beforecommitobject", beforecommitobject);
	var beforeremoveobject = function (options) {
		var success = options.success;
		var session = options.session;
		var object = options.object;
		if (!object || !session || ose.subject.isAdmin (session.username)) {
			success ();
			return;
		};
		if (oseClasses.indexOf (object.get ("fclass_id")) > -1) {
			success ({cancel: 1});
			return;
		};
		if (!cache.class_ [object.get ("fclass_id")]) {
			success ();
			return;
		};
		ose.subject.can ({
			session: session,
			object: object,
			access: "delete",
			success: success
		});
	};
	storage.on ("beforeremoveobject", beforeremoveobject);
	storage.on ("generatequeryblock", function (options) {
		var cls = options.cls;
		var objectField = options.objectField;
		var session = options.session;
		var tables = options.tables;
		var where = options.where;
		var alias = options.alia;
		if (!session || ose.subject.isAdmin (session.username)) {
			return;
		};
		// todo: oseClasses
		if (!cache.class_ [cls.get ("fid")]) {
			return;
		};
		if (where) {
			where += ' and ';
		} else {
			where = ' where ';
		};
		var subjects = session.roles.concat (session.userId);
		var oseObject = storage.getClass ("ose.object");
		where += "exists (\n" + 
			"select fobject_id from " + oseObject.toc + "\n" + 
			"where " + oseObject.attrs.read.toc + " = 1 and " + oseObject.attrs.subject.toc + " in (" + subjects.join (",") + ") and\n" +
			"(" + oseObject.attrs ["class"].toc + "=" + cls.get ("fid") + " or " + objectField + "=" + oseObject.attrs.object.toc + ")\n" + 
		")";
		options.where = where;
	});
	ose.load ({success: function () {
		ose.loadIntervalId = setInterval (ose.load, 60 * 1000);
		success ();
	}});
};


 
projects.getClasses = function (request, response, next) {
   	if (request.storageFn == "getClasses") {
   		log.debug ({cls: "projects", fn: "getClasses"});
   		projects.sendTableRecords ({
   			request: request,
   			response: response,
   			storageCode: request.storageCode, 
   			table: "tclass", 
   			fields: ["fid", "fparent_id", "fname", "fcode", "fdescription", "fformat", "fview_id", "ftype", "fsystem", "fschema_id", "frecord_id"]
   		});
   	} else {
		next ();
	}
};
projects.getClassAttrs = function (request, response, next) {
   	if (request.storageFn == "getClassAttrs") {
   		log.debug ({cls: "projects", fn: "getClassAttrs"});
   		projects.sendTableRecords ({
   			request: request,
   			response: response,
   			storageCode: request.storageCode, 
   			table: "tclass_attr", 
   			fields: ["fid", "fclass_id", "fname", "fcode", "ftype_id", "forder", "fnot_null", "fvalid_func", "fformat_func", "fdescription", "fsecure", "fmax_str", "fmin_str", "fmax_number", "fmin_number", "fmax_ts", "fmin_ts", "funique", "fformat_number", "fformat_ts"]
   		});
   	} else {
		next ();
	}
};
projects.getActions = function (request, response, next) {
   	if (request.storageFn == "getActions") {
   		log.debug ({cls: "projects", fn: "getActions"});
   		projects.sendTableRecords ({
   			request: request,
   			response: response,
   			storageCode: request.storageCode, 
   			table: "taction",    			
   			fields: ["fid", "fclass_id", "fname", "fcode", "fdescription", "forder", "fbody", "fconfirm", "flayout"]
   		});
   	} else {
		next ();
	}
};
projects.getActionAttrs = function (request, response, next) {
   	if (request.storageFn == "getActionAttrs") {
		projects.send ({request: request, response: response, msg: "{header: {error: ''}, data: []}"});
	} else {
		next ();
	}
};
projects.getViews = function (request, response, next) {
   	if (request.storageFn == "getViews") {
   		log.debug ({cls: "projects", fn: "getViews"});
   		projects.sendTableRecords ({
   			request: request,
   			response: response,
   			storageCode: request.storageCode, 
   			table: "tview",    			
   			fields: ["fid", "fparent_id", "fname", "fcode", "fdescription", "flayout", "fkey", "fparent_key", "fclass_id", "funrelated", "fquery", "ftype", "fsystem", "fmaterialized", "forder", "fschema_id", "frecord_id", "ficon_cls"]
   		});
   	} else {
		next ();
	}
};
projects.getViewAttrs = function (request, response, next) {
   	if (request.storageFn == "getViewAttrs") {
   		log.debug ({cls: "projects", fn: "getViewAttrs"});
   		projects.sendTableRecords ({
   			request: request,
   			response: response,
   			storageCode: request.storageCode, 
   			table: "tview_attr",    			
   			fields: ["fid", "fview_id", "fname", "fcode", "fclass_id", "fclass_attr_id", "fsubject_id", "forder", "fsort_kind", "fsort_order", "foperation", "fvalue", "farea", "fcolumn_width", "ftotal_type", "fread_only", "fgroup", "fnot_null"]
   		});
   	} else {
		next ();
	}
};
/*
   Активация аккаунта
*/
projects.services.accountActivate = function (req, res, next) {
   if (req.url.indexOf ("/services") == -1 || !req.query.account_activate) {
      next ();
      return;
   };
   var accountId = req.query.account_activate;
   var hash = req.query.hash;
   var session = {
      id: "account_activate_" + accountId,
      username: "admin",
      userId: null
   };
   var code = req.url.split ("/");
   code = code [code.indexOf ("projects") + 1];
   var storage = projects.storagePool [code];
   var sql = {
      select: [
         {"a":"id"}, "id",
         {"a":"email"}, "email",
         {"a":"password"}, "password"
      ],
      from: [
         {"a":"subject.human"}
      ],
      where: [
         {"a":"id"}, "=", accountId
      ]
   };
   storage.execute ({session: session, sql: sql, success: function (options) {
      var rows = options.result.rows;
      if (rows.length) {
         var email = rows [0].email_;
         var passwordHash = rows [0].password_;
         if (passwordHash == hash) {
            async.series ([
               function (cb) {
                  storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "account_activate_" + accountId, success: function () {
                     cb ();
                  }, failure: function (options) {
                     cb (options.error);
                  }});
               },
               function (cb) {
                  storage.getObject ({session: session, id: accountId, success: function (options) {
                     var o = options.object;
                     if (o) {
                        o.set ("login", email);
                        o.commit ({session: session, success: function () {
                           cb ();
                        }});
                     } else {
                        cb ("no object");
                     };
                  }});
               },
               function (cb) {
                  storage.commitTransaction ({session: session, success: function () {
                     cb ();
                  }, failure: function (options) {
                     cb (options.error);
                  }});
               }
            ], function (err, results) {
               if (!err) {
                  res.send ("<html><body>Ваша учетная запись активирована.</body></html>");
               } else {
                  storage.rollbackTransaction ({session: session, success: function () {
                     res.send ("<html><body>Извините. Не удалось активировать учетную запись.</body></html>");
                  }});
               };
            });
         };
      } else {
         res.send ("<html><body>Извините. Не удалось активировать учетную запись.</body></html>");
      };
   }});
};
/*
   Запрос на восстановление пароля
*/
projects.services.restorePassword = function (req, res, next) {
   if (req.url.indexOf ("/services") == -1 || !req.query.restore_password) {
      next ();
      return;
   };
   var code = req.url.split ("/");
   code = code [code.indexOf ("projects") + 1];
   var storage = projects.storagePool [code];
   var email = req.query.restore_password;
   var sql = {
      select: [
         {"a":"id"}, "id",
         {"a":"email"}, "email",
         {"a":"password"}, "password"
      ],
      "from": [
         {"a":"subject.human"}
      ],
      "where": [
         {"a":"email"}, "=", email
      ]
   };
   storage.execute ({sql: sql, success: function (options) {
      var rows = options.result.rows;
      if (rows.length) {
         var accountId = rows [0].id_;
         var hash = rows [0].password_;
         var host = req.query.host;
         var sender = req.query.sender;
         var port = req.query.port;
         var storage = req.query.storage;
         var link = "http://" + host + ":" + port + "/projects/" + storage + "/services?reset_password=" + accountId + "&hash=" + hash + "&host=" + host;
         mailSender.send ({
            to: email,
            from: sender,
            subject: "Восстановление пароля " + host,
            message: "Для получения нового пароля перейдите по ссылке <a target='_blank' href='" + link + "'>" + link + "</a>",
            success: function () {
               res.send ("success");
            },
            failure: function (error) {
               res.send ("error");
            }
         });
      } else {
         res.send ("error");
      };
   }});
};
/*
   Сброс пароля
*/
projects.services.resetPassword = function (req, res, next) {
   if (req.url.indexOf ("/services") == -1 || !req.query.reset_password) {
      next ();
      return;
   };
   var code = req.url.split ("/");
   code = code [code.indexOf ("projects") + 1];
   var storage = projects.storagePool [code];
   var r = "<html><body>Извините. Не удалось получить новый пароль.</body></html>";
   var accountId = req.query.reset_password;
   var host = req.query.host;
   var hash = req.query.hash;
   var session = {
      id: "reset_password_" + accountId,
      username: "admin",
      userId: null
   };
   var sql = {
      select: [
         {"a":"id"}, "id",
         {"a":"email"}, "email",
         {"a":"password"}, "password"
      ],
      from: [
         {"a":"subject.human"}
      ],
      where: [
         {"a":"id"}, "=", accountId
      ]
   };
   storage.execute ({session: session, sql: sql, success: function (options) {
      var rows = options.result.rows;
      if (rows.length) {
         var passwordHash = rows [0].password_;
         if (hash == passwordHash) {
            var email = rows [0].email_;
            var password = String (common.randomInt (1000000, 9000000));
            async.series ([
               function (cb) {
                  storage.startTransaction ({session: session, remoteAddr: "127.0.0.1", description: "reset_password_" + accountId, success: function () {
                     cb ();
                  }, failure: function (options) {
                     cb (options.error);
                  }});
               },
               function (cb) {
                  storage.getObject ({session: session, id: accountId, success: function (options) {
                     var o = options.object;
                     o.set ("password", sha.hex_sha1 (password));
                     o.commit ({session: session, success: function () {
                        cb ();
                     }});
                  }});
               },
               function (cb) {
                  storage.commitTransaction ({session: session, success: function () {
                     cb ();
                  }, failure: function (options) {
                     cb (options.error);
                  }});
               }
            ], function (err, results) {
               if (!err) {
                  r = "<html><body>Ваш новый пароль: " + password + "</body></html>";
                  res.send (r);
                  mailSender.send ({
                     to: email,
                     from: "noreply@" + host,
                     subject: "Изменение пароля " + host,
                     message: "Ваш новый пароль: " + password
                  });
               } else {
                  storage.rollbackTransaction ({session: session, success: function () {
                     res.send (r);
                  }});
               };
            });
         };
      } else {
         res.send (r);
      };
   }});
};
projects.gate1c = function (request, response, next) {
   if (request.url.indexOf ("/1c?") > -1) {
      var options = JSON.parse (request.body);
      var req = http.request ({
         hostname: options.host,
         port: options.port,
         path: options.path,
         method: "POST",
         headers: {
            "Content-Type": "text/xml; charset=utf-8",
            "Content-Length": Buffer.byteLength (request.body, "utf8")
         }
      }, function (res) {
         res.setEncoding ("utf8");
         var responseBody;
         res.on ("error", function (err) {
            response.send ("{error: '" + err + "'}");
         });
         res.on ("data", function (d) {
            if (responseBody) {
               responseBody += d;
            } else {
               responseBody = d;
            };
         });
         res.on ("end", function (d) {
            response.send (responseBody);
         });
      });
      req.on ("error", function (e) {
         response.send ("{error: '" + e + "'}");
      });
      req.end (request.body);
   } else {
      next ();
   };
};

	this.common = common;
	this.config = config;
	this.Export = Export;
	this.Import = Import;
	this.mailSender = mailSender;
	this.meta = meta;
	this.mimetypes = mimetypes;
	this.projects = projects;
	this.Query = Query;
	this.server = server;
	this.sha = sha;
	this.Storage = Storage;
	this.db = db;
	this.xmlss = xmlss;
	this.Dbf = Dbf;
	this.async = async;
	this.sha = sha;
	this.tm = tm;
	this.log = log;
	this.modules = {
		async: async,
		pg: pg,
		util: util,
		fs: fs,
		http: http,
		url: url,
		redis: redis,
		pg: pg,
		express: express,
		nodemailer: nodemailer,
		simplesmtp: simplesmtp,
		_: _
	};		
};
