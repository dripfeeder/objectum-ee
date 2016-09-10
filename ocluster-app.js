//
//	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var config = require ("./config").config;
var $o = new (require ("./objectum-debug").Objectum)();
$o.server.init ({objectum: $o, success: function () {
	$o.server.start ({port: process.env.port}, function (err) {
	});
}});
