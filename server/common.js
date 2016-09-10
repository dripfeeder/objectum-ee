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
