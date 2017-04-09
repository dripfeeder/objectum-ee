let smtpTransport = nodemailer.createTransport ("SMTP", config.mail.smtp);
global.mailSender = {
	smtpTransport: {}
};
mailSender.send = function (options) {
	let success = options.success;
	let failure = options.failure;
	let storage = options.session ? options.session.storage : null;
	if (_.has (config.mail, "enabled") && !config.mail.enabled) {
		if (success) {
			success ();
		}
		return;
	}
	let st = smtpTransport;
	let dstHost = options.to.split ("@")[1];
	if (storage && storage.config.smtp && storage.config.smtp.host) {
		options.from = storage.config.smtp.sender || options.from;
		if (!mailSender.smtpTransport [storage.code]) {
			let smtpCfg = {
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
	let mailOptions = {
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
	let storage = options.storage;
	if (options.sendFailed || !storage) {
		return;
	};
	let l = {
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
	let storages = [];
	for (let storageCode in projects.storagePool) {
		storages.push (projects.storagePool [storageCode]);
	};
	async.eachSeries (storages, function (storage, cb) {
		storage.query ({sql: 
			"select fid, fmessage from tmail\n" +
			"where fsending_date is null\n" +
			"order by fid\n"
		, success: function (options) {
			let r = options.result.rows;
			async.eachSeries (options.result.rows, function (row, cb) {
				async.series ([
					function (cb) {
						try {
							let l = JSON.parse (row.fmessage);
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

