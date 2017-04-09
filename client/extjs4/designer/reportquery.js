Ext.define ("$o.ReportQuery.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.reportquery", "widget.$reportquery"],
	layout: "fit",
	border: false,
	initComponent: function () {
		let me = this;
	    me.store = Ext.create ("Ext.data.Store", {
	        data: me.getData (),
	        fields: [{
	        	name: "alias", type: "string"
			}, {
	        	name: "view", type: "string"
	        }]
	    });
		me.grid = Ext.create ("Ext.grid.Panel", {
			store: me.store,
			columns: [{
				header: "Псевдоним", width: 100, dataIndex: "alias"
			}, {
				header: "Запрос", dataIndex: "view", flex: 1
			}],
    		forceFit: true,
			frame: false,
			deferRowRender: false,
			listeners: {
				afterrender: function () {
					let sm = this.getSelectionModel ();
					sm.on ("selectionchange", function () {
						if (sm.hasSelection ()) {
							let record = sm.getSelection ()[0];
							me.down ("*[name=filter]").enable ();
							me.down ("*[name=filter]").setViewId (me.data [record.get ("alias")].view);
							me.down ("*[name=filter]").setValue (me.data [record.get ("alias")].filter);
						}
					});
				}
			}
		});
		me.items = {
			layout: "border",
			border: false,
			items: [{
			    split: true,
			    region: "west",
				width: "50%",
				layout: "fit",
				tbar: [{
					text: "Добавить",
					name: "create",
					iconCls: "gi_circle_plus",
					handler: me.create,
					scope: me
				}, {
					text: "Удалить",
					name: "delete",
					iconCls: "gi_circle_minus",
					handler: me.remove,
					scope: me
				}],
				title: "Запросы",
				iconCls: "gi_cogwheel",
				border: false,
				items: me.grid
			},{
			    region: "center",
				layout: "fit",
				title: "Фильтр",
				iconCls: "gi_filter",
				border: false,
			    items: {
					xtype: "$layoutfilter",
					name: "filter",
					disabled: true,
					reportMode: 1,
					listeners: {
						change: me.updateFilter,
						scope: me
					}
			    }
			}]
		};
		me.addEvents ("change");
		me.callParent (arguments);
	},
	getData: function () {
		let me = this;
		let data = [];
		me.data = {};
		for (let i = 0; i < me.value.length; i ++) {
			data.push ({
				alias: me.value [i].alias,
				view: $o.getView (me.value [i].view).toString ()
			});
			me.data [me.value [i].alias] = {
				alias: me.value [i].alias,
				filter: me.value [i].filter,
				view: me.value [i].view
			};
		};
		return data;
	},
	create: function () {
		let me = this;
		dialog.getView ({hasQuery: 1, success: function (options) {
			let maxN = 0;
			for (let i = 0; i < me.store.getCount (); i ++) {
				let alias = me.store.getAt (i).get ("alias");
				if (Number (alias.substr (1)) > maxN) {
					maxN = Number (alias.substr (1));
				};
			};
			let alias = "q" + (maxN + 1);
			let rec = {
				alias: alias,
				view: $o.getView (options.id).toString ()
			};
			me.store.add (rec);
			me.data [alias] = {
				alias: alias,
				view: $o.getView (options.id).getFullCode ()
			};
			me.fireEvent ("change", me.getValue ());
		}});
	},
	remove: function () {
		let me = this;
		let sm = me.grid.getSelectionModel ();
		if (sm.hasSelection ()) {
			let record = sm.getSelection ()[0];
			me.store.remove (record);
			me.down ("*[name=filter]").disable ();
			me.fireEvent ("change", me.getValue ());
		};
	},
	getValue: function () {
		let me = this;
		let value = [];
		for (let i = 0; i < me.store.getCount (); i ++) {
			let alias = me.store.getAt (i).get ("alias");
			value.push (me.data [alias]);
		};
		return value;
	},
	updateFilter: function (value) {
		let me = this;
		let sm = me.grid.getSelectionModel ();
		let record = sm.getSelection ()[0];
		me.data [record.get ("alias")].filter = value;
		me.fireEvent ("change", me.getValue ());
	}
});
