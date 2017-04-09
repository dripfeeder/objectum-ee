/*
	Copyright (C) 2011-2016 Samortsev Dmitry (samortsev@gmail.com). All Rights Reserved.
	deprecated. Events disabled
*/
global.Ose = function (options) {
	let storage = options.storage;
	let success = options.success;
	let ose = this;
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
			let access = options.access;
			let success = options.success;
			let session = options.session;
			let object = options.object;
			let class_ = cache.class_ [object.get ("fclass_id")];
			if (class_ && (
				(class_ [null] && class_ [null][access]) || (class_ [session.userId] && class_ [session.userId][access])
			)) {
				success ();
				return;
			};
			for (let i = 0; i < session.roles.length; i ++) {
				if (class_ [session.roles [i]] && class_ [session.roles [i]][access]) {
					success ();
					return;
				};
			};
			let subjects = session.roles.concat (session.userId);
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
	let cache = {
		admins: [],
		ext: {},
		srole: {},
		ext: {},
		class_: {}
	};
	ose.load = function (options) {
		options = options || {};
		let success = options.success;
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
					for (let i = 0; i < r.length; i ++) {
						let role = r.get (i, "role");
						let subject = r.get (i, "subject");
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
					for (let i = 0; i < r.length; i ++) {
						let classAttr = r.get (i, "classattr");
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
					for (let i = 0; i < r.length; i ++) {
						let subject = r.get (i, "subject");
						let class_ = r.get (i, "class");
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
						for (let i = 0; i < r.length; i ++) {
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
	let roleClassId = storage.getClass ("ose.role").get ("fid");
	let sroleClassId = storage.getClass ("ose.srole").get ("fid");
	let extClassId = storage.getClass ("ose.ext").get ("fid");
	let objectClassId = storage.getClass ("ose.object").get ("fid");
	let adminClassId = storage.getClass (ose.config.admins).get ("fid");
	let oseClasses = [roleClassId, sroleClassId, extClassId, objectClassId, adminClassId];
	let beforecreateobject = function (options) {
		let success = options.success;
		if (options.session && options.session.username && !ose.subject.isAdmin (options.session.username) && options.classId != objectClassId && oseClasses.indexOf (options.classId) > -1) {
			options.cancel = 1;
		};
		success (options);
	};
	storage.on ("beforecreateobject", beforecreateobject);
	let aftercreateobject = function (options) {
		let success = options.success;
		let classId = options.classId;
		if (!cache.class_ [classId] || !options.session || ose.subject.isAdmin (options.session.username)) {
			success ();
			return;
		};
		let object = options.object;
		let session = options.session;
		storage.un ("aftercreateobject", aftercreateobject);
		storage.un ("beforecreateobject", beforecreateobject);
		storage.createObject ({session: session, classId: objectClassId, success: function (options) {
			storage.on ("aftercreateobject", aftercreateobject);
			storage.on ("beforecreateobject", beforecreateobject);
			let o = options.object;
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
	let aftergetobject = function (options) {
		let success = options.success;
		let session = options.session;
		let object = options.object;
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
		let success = options.success;
		let session = options.session;
		let object = options.object;
		let attrs = [];
		let cls = storage.getClass (object.get ("fclass_id"));
		for (let attr in object.data) {
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
			let objectId = object.data [attr.get ("fcode")];
			let ext = cache.ext [attr.get ("fid")];
			if (ext && objectId) {
				let r1 = [], r2 = [];
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
							for (let i = 0; i < r.length; i ++) {
								let o = {
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
								let has = 0;
								for (let i = 0; i < r2.length; i ++) {
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
										let o = options.object;
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
								let has = 0;
								for (let i = 0; i < r1.length; i ++) {
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
										let o = options.object;
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
	let beforecommitobject = function (options) {
		let success = options.success;
		let session = options.session;
		let object = options.object;
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
							let o = options.object;
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
	let beforeremoveobject = function (options) {
		let success = options.success;
		let session = options.session;
		let object = options.object;
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
		let cls = options.cls;
		let objectField = options.objectField;
		let session = options.session;
		let tables = options.tables;
		let where = options.where;
		let alias = options.alia;
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
		let subjects = session.roles.concat (session.userId);
		let oseObject = storage.getClass ("ose.object");
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


 