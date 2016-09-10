//
//	Copyright (C) 2011-2013 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
//
var $o = new (require ("./objectum-debug").Objectum)();
if (process.argv.length > 2) {
	// execute fn
	var fs = require ("fs");
	var cfg = fs.readFileSync (process.argv [2]);
	cfg = eval ("(" + cfg + ")");
	$o.db.execute (cfg);
} else {
	// start server
	$o.server.init ({objectum: $o, success: function () {
		$o.server.start ({port: $o.config.startPort});
	}});
};
