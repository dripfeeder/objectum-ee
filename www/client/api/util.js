/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

$o.util = {};

// Клонирование объекта
$o.util.clone = function (o) {
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
				c [p] = $o.util.clone (v);
			} else {
				c [p] = v;
			}
		}
	}
	return c;
}
$o.util.setCookie = function (name, value, path, expires, domain, secure) {
	var cookie_string = name + "=" + escape (value);
	var expiresDefault = new Date ();
	expiresDefault.setDate (expiresDefault.getDate () + 30);
	expires = expires || expiresDefault;
	if (expires) {
		cookie_string += "; expires=" + expires.toStringOriginal ();
	};
	if (path) {
		cookie_string += "; path=" + escape (path);
	};
	if (domain) {
		cookie_string += "; domain=" + escape (domain);
	};
	if (secure) {
		cookie_string += "; secure";
	};
	document.cookie = cookie_string;
};
$o.util.removeCookie = function (cookie_name) {
	var cookie_date = new Date ();
	cookie_date.setTime (cookie_date.getTime() - 1);
	document.cookie = cookie_name += "=; expires=-1";// + cookie_date.toGMTString ();
};
$o.util.getCookie = function (cookie_name) {
	var results = document.cookie.match ( '(^|;) ?' + cookie_name + '=([^;]*)(;|$)' );
	if (results) {
		return (unescape (results [2]));
	} else {
		return null;
	}
};
$o.util.getStyle = function (className) {
    var classes = document.styleSheets [0].rules || document.styleSheets [0].cssRules;
    var r;
    for (var x = 0; x < classes.length; x ++) {
        if (classes [x].selectorText == className) {
            if (classes [x].cssText) {
            	r = classes [x].cssText;
            } else {
            	r = classes [x].style.cssText;
            };
            break;
        }
    }
    return r;
};
$o.util.isEmptyObject = function (obj) {
	if (!obj) {
		return true;
	};
	for (var prop in obj) {
		if (Object.prototype.hasOwnProperty.call (obj, prop)) {
			return false;
		};
	};
	return true;
};
$o.util.loadCSS = function (file, cb) {
	var link = document.createElement ("link");
	link.setAttribute ("rel", "stylesheet");
	link.setAttribute ("type", "text/css");
	link.setAttribute ("href", file);
	if (cb) {
		if (link.onreadystatechange === undefined) {
			link.onload = cb;    
		} else {
			link.onreadystatechange = function() {
				if (this.readyState == 'complete' || this.readyState == 'loaded') {  
					cb ();   
				}  
			}
		}  
	}	
	document.getElementsByTagName ("head")[0].appendChild (link)
};
$o.util.loadJS = function (file, cb) {
	var script = document.createElement ('script');
	script.src = file;
	script.type = "text/javascript";
	script.language = "javascript";
	var head = document.getElementsByTagName ('head')[0];
	if (cb) {
		if (script.onreadystatechange === undefined) {
			script.onload = cb;    
		} else {
			script.onreadystatechange = function() {
				if (this.readyState == 'complete' || this.readyState == 'loaded') {  
					cb ();   
				}  
			}
		}  
	}	
	head.appendChild (script);
};

$o.util.sha1 = hex_sha1;

$zu = $o.util;
