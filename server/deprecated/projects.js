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
