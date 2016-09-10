Ext.define ("ImportCSVObjects.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.importcsvobjects"],
	border: false,
	layout: "fit",
	defaults: {
		border: false
	},
    bodyPadding: 2,
    classId: null,
	initComponent: function () {
		var me = this;
		me.oCls = $o.getClass (me.classId);
		me.attrs = _.map (me.oCls.attrs, function (ca) {
			ca.set ("fullName", ca.get ("name") + " (" + ca.get ("code") + ")");
			return ca;
		});
		var filePanel = new Ext.Panel ({
			bodyStyle: 'background-color: white; padding: 5px;',
			border: false,
			html: '<input type="file" id="selectedFile">'
		});
		me.tbar = [{
			xtype: "combo",
			fieldLabel: "Кодировка",
			labelWidth: 65,
			width: 150,
			name: "coding",
			triggerAction: "all",
			lazyRender: true,
			mode: "local",
			queryMode: "local",
			store: {
				type: "json",
				fields: ["id", "name"],
				data: [{id: "utf8", name: "utf-8"}, {id: "win1251", name: "win-1251"}]
			},
			valueField: "id",
			displayField: "name",
			value: "utf8",
			editable: false
		}, filePanel, {
			text: "Загрузить",
			iconCls: "gi_table",
			name: "load",
			disabled: true,
			handler: function () {
				var inp = Ext.getDom ("selectedFile");
				var file = inp.files [0];
				var reader = new FileReader ();
				reader.onload = function () {
					var rows = reader.result.split ("\n");
					me.data = [];
					me.fields = [];
					_.each (rows, function (row, i) {
						var cells = row.split (";");
						var o = {};
						_.each (cells, function (s, j) {
							var s = s == null ? "" : s.trim ();
							if (!i) {
								me.fields.push ({
									name: s,
									code: "attr-" + j
								});
							} else {
								o ["attr-" + j] = s;
							}
						});
						if (i && cells.length && cells [0] != "") {
							me.data.push (o);
						}
					});
					if (me.fields.length && !me.fields [me.fields.length - 1].name) {
						me.fields.splice (me.fields.length - 1, 1);
					}
					var grid = me.down ("*[name=grid]");
		            grid.reconfigure ({
						xtype: "store",
						fields: _.map (me.fields, function (a) {
							return a.code;
						}),
						data: me.data
					}, _.map (me.fields, function (a) {
						return {
							text: a.name,
							dataIndex: a.code,
							width: 90
						};
					}));
		            grid.getStore ().loadData (me.data);
		            me.down ("*[name=recNum]").setValue (me.data.length);
					var items = _.map (me.fields, function (field) {
						var value;
						_.each (me.attrs, function (ca) {
							if (ca.get ("name") == field.name) {
								value = ca.get ("code");
							}
						});
						var o = {
							xtype: "combo",
							fieldLabel: field.name,
							name: field.code,
							triggerAction: "all",
							lazyRender: true,
							mode: "local",
							queryMode: "local",
							store: {
								type: "json",
								fields: ["id", "name"],
								data: _.map (me.attrs, function (ca) {
									return {id: ca.get ("code"), name: ca.get ("fullName")};
								})
							},
							valueField: "id",
							displayField: "name",
							editable: false,
							value: value,
							width: "100%"
						};
						return o;
					});
					me.down ("*[name=map]").removeAll ();
					me.down ("*[name=map]").add (items);
					me.down ("*[name=import]").setDisabled (false);
				};
				reader.readAsText (file, me.down ("*[name=coding]").getValue () == "utf8" ? "utf-8" : "windows-1251");
			}
		}, {
			text: "Импорт",
			iconCls: "gi_file_import",
			name: "import",
			disabled: true,
			handler: function () {
				if (me.importer) {
					me.importer (me.data);
				} else {
					Ext.MessageBox.show ({
					    title: "Пожалуйста подождите",
					    msg: "Действие выполняется ...",
					    progressText: "",
					    width: 300,
					    progress: 1,
					    closable: 0
					});	
					setTimeout (function () {
						$o.startTransaction ();
						var map = {};
						_.each (me.fields, function (field) {
							var c = me.down ("*[name=" + field.code + "]");
							map [field.code] = c.getValue ();
						});
						var recs = [];
						var idAttr = me.down ("*[name=idAttr]").getValue ();
						if (idAttr) {
							recs = $o.execute ({
								asArray: true,
								select: [
									{"a": "id"}, "id",
									{"a": idAttr}, idAttr
								],
								from: [
									{"a": me.oCls.getFullCode ()}
								]
							});
						}
						var idMap = {};
						_.each (recs, function (rec) {
							idMap [rec [idAttr]] = rec.id;
						});
						async.reduce (me.data, 0, function (i, rec, cb) {
							var attrs = {};
							_.each (rec, function (v, a) {
								attrs [map [a]] = v;
							});
							var o;
							if (!idAttr || (idAttr && attrs [idAttr])) {
								if (idAttr) {
									if (idMap [attrs [idAttr]]) {
										o = $o.getObject (idMap [attrs [idAttr]]);
									} else {
										o = $o.createObject (me.classId);
									}
								} else {
									o = $o.createObject (me.classId);
								}
								_.each (attrs, function (v, a) {
									o.set (a, v);
								});
								o.sync ();
							}
							Ext.MessageBox.updateProgress (i / me.data.length, i + " / " + me.data.length);
					        setTimeout (function () {
					        	cb (null, i + 1);
					        }, 1);
					    }, function (err) {
							$o.commitTransaction ();
							Ext.MessageBox.hide ();
							me.fireEvent ("imported");
						});
					}, 100);
				}
			}
		}];
		me.items = {
			xtype: "tabpanel",
			items: [{
				title: "Сопоставление полей",
				layout: "vbox",
				name: "map",
				bodyPadding: 5,
				tbar: [{
					xtype: "textfield",
					fieldLabel: "Класс",
					labelWidth: 50,
					width: 400,
					disabled: true,
					value: me.oCls.toString ()
				}, {
					xtype: "combo",
					fieldLabel: "Идентификатор",
					name: "idAttr",
					triggerAction: "all",
					lazyRender: true,
					mode: "local",
					queryMode: "local",
					store: {
						type: "json",
						fields: ["id", "name"],
						data: _.map (me.attrs, function (ca) {
							return {id: ca.get ("code"), name: ca.get ("fullName")};
						})
					},
					width: 300,
					style: "margin-left: 5px",
					valueField: "id",
					displayField: "name",
					editable: false
				}],
				items: []
			}, {
				title: "CSV",
				xtype: "grid",
				name: "grid",
				tbar: [{
					xtype: "textfield",
					disabled: true,
					name: "recNum",
					fieldLabel: "Количество"
				}],
				store: {
					xtype: "store",
					fields: ["name"],
					data: []
				},
				columns: [{
					text: "Наименование",
					dataIndex: "name",
					width: 90
				}],
				width: "100%",
				columnLines: true,
				rowLines: true
			}]
		};
		me.on ("afterrender", function () {
			Ext.get ("selectedFile").on ("change", function (e) {
				me.down ("*[name=load]").setDisabled (false);
			}, this);
		});
		me.addEvents ("imported");
		me.callParent (arguments);
	}
});
