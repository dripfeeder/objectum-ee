/*
	Copyright (C) 2011-2016 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Chart.Widget", {
	extend: "Ext.chart.Chart",
	alias: ["widget.$o.chart"],
    style: 'background:#fff',
    animate: true,
    shadow: true,
    overflowY: "auto",
	initComponent: function () {		
		let me = this;
		let view = me.$view = me.queryId ? $o.viewsMap [me.queryId] : $o.getView ({code: me.$query});
		let viewId = me.viewId = view.get ("id");
		let query = view.get ("query");
		delete me.query;

		let nameFields = [me.attrMark];
		let dataFields = [me.attrValue];
		let data = me.getData ();
		me.store = Ext.create ("Ext.data.Store", {
			fields: ["___name", me.attrMark, me.attrValue],
			data: data
		});
        me.axes = [{
            type: 'Numeric',
            position: 'bottom',
            fields: dataFields,
            minimum: 0,
            label: {
                renderer: Ext.util.Format.numberRenderer ('0,0')
            },
            grid: true,
            title: me.titleValue
        }, {
            type: 'Category',
            position: 'left',
            fields: ["___name"],//me.attrMark],
            title: me.titleMark
        }];
        me.series = [{
            type: 'bar',
            axis: 'bottom',
            xField: me.attrMark,
            yField: dataFields,
            title: nameFields,
            tips: {
                trackMouse: true,
                width: 300,
                height: 50,
                renderer: function (storeItem, item) {
                    this.setTitle (item.value [0] + " (" + storeItem.get ("n" + item.yField.substr (1)) + '): ' + (item.value [1] == null ? "" : item.value [1]));
                }
            },                
            label: {
                display: "insideEnd",
                field: nameFields
            }
        }];
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.callParent (arguments);
    },
    getData: function () {
        let me = this;
        let query = me.$view.get ("query");
        query = JSON.parse (query);
        if (me.filter) {
            query.where = query.where || [];
            if (query.where.length) {
                query.where.push ("and");
            };
            let f = $o.util.clone (me.filter);
            for (let i = 0; i < f.length; i ++) {
                for (let j = 1; j < query.select.length; j += 2) {
                    if (f [i] == query.select [j]) {
                        f [i] = query.select [j - 1];
                    };
                };
                if (f [i] && typeof (f [i]) == "object" && f [i].id && f [i].attr) {
                    me.relatives [f [i].id].targets [me.zid] = me;
                    f [i] = me.relatives [f [i].id].getValue (f [i].attr);
                    if (f [i] == undefined) {
                        me.disable ();
                        return [];
                    } else {
                        me.enable ();
                    };
                };
            };
            query.where.push (f);
        };
        let r = $o.execute ({sql: query});
        let data = [];
        for (let i = 0; i < r.length; i ++) {
            let o = {};
            o [me.attrMark] = r.get (i, me.attrMark);
            o [me.attrValue] = r.get (i, me.attrValue);
            o.___name = "";
            data.push (o);
        };
        return data;
    },
	refresh: function (options) {
        let me = this;
        if (me.refreshing) {
            return;
        };
        me.refreshing = 1;
		options = options || {};
        me.store.loadData (me.getData ());
        me.redraw ();
        me.refreshing = 0;
	}
});
