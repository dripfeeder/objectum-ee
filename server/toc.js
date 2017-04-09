/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.	
*/
/*
	Ограничения:
	* Создает только для последней ревизии
	* Машина времени работает только для данных (tobject, tobject_attr, toc)
*/
global.tm = {};
tm.remove = function (options) {
	let me = this;
	let success = options.success;
	let session = options.session;
	let storage = options.storage;
	let revision = options.revision;
	let s = 
		"select fid, fcode from tclass\n" +
		"where\n" +
		"\t" + storage.getCurrentFilter () + "\n" +
		"\tand fid >= 1000\n" +
		"order by fid\n"
	;
	storage.query ({session: session, sql: s, success: function (options) {
		let classes = options.result.rows;
		async.eachSeries (classes, function (cls, cb) {
			let name = "tm_" + cls.fcode + "_" + cls.fid;
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
	let storageCode = options.storageCode;
	let success = options.success;
	let revision;
	let storage;
	let session;
	let classes;
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
			let s = 
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
				let classId = cls.fid;
				let classCode = cls.fcode;
				let tmName = "tm_" + classCode + "_" + classId;
				let classAttrs;
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
							let classAttrId = classAttr.fid;
							let tmFieldName = classAttr.fcode + "_" + classAttrId;
							storage.client.isFieldExists ({session: session, table: tmName, field: tmFieldName, success: function (result) {
								if (result) {
									cb ();
								} else {
									let type = "$tnumber$";
									let ftype = "fnumber";	    
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
								let caFields = [];
								for (let i = 0; i < classAttrs.length; i ++) {
									let field = classAttrs [i].fcode + "_" + classAttrs [i].fid;
									if (caFields.indexOf (field) == -1) {
										caFields.push (field);
									};
								};
								let s = 
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
		let session = req.session;
		let storage = session.storage;
		storage.query ({session: session, sql: "select fid, fdate from trevision where ftoc=1 order by fdate desc", success: function (options) {
			let r = [];
			for (let i = 0; i < options.result.rows.length; i ++) {
				let row = options.result.rows [i];
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
		let session = req.session;
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
	let buildTime = storage.config.visualObjectum.timeMachine ? storage.config.visualObjectum.timeMachine.buildTime : null;
	if (!buildTime) {
		return;
	};
	function build () {
		log.info ({cls: "tm"}, "start build");
		tm.create ({storageCode: storage.code, success: function (revision) {
			storage.query ({sql: "select fid, fdate from trevision where fid=" + revision, success: function (options) {
				let row = options.result.rows [0];
				storage.visualObjectum.timeMachine.dates.push ({id: row.fid, date: row.fdate});
			}});
		}});
		setTimeout (build, 24 * 60 * 60 * 1000);
	};
	let bt = buildTime.split (":");
	let cd = new Date ();
	let bd = new Date ();
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
