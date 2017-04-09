/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Frame.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.frame"],
    border: 0,
	initComponent: function () {		
		let me = this;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.html = '<iframe src="' + me.url + '" frameborder="0" width="100%" height="100%">';
        me.on ("afterrender", me.refresh, me);
        me.callParent (arguments);
    },
	refresh: function (options) {
        let me = this;
        if (me.attr) {
            let cmp = me.relatives [me.attr.split (".")[0]];
            let attr = me.attr.split (".")[1];
            if (cmp) {
                cmp.targets [me.zid] = me;
                let url = cmp.getValue (attr);
                me.update ('<iframe src="' + url + '" frameborder="0" width="100%" height="100%">');
            };        
        };
	}
});
