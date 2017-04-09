/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Image.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.image"],
    border: 0,
	initComponent: function () {		
		let me = this;
		me.relatives = me.relatives || {};
		me.relatives [me.zid] = me;
		me.targets = {};
        me.items = {
            xtype: "image",
            src: me.url,
            width: me.width,
            height: me.height,
            shrinkWrap: true
        };
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
                if (cmp.xtype == "$o.card") {
                    let items = cmp.getItems ();
                    let objectId;
                    for (let i = 0; i < items.length; i ++) {
                        if (items [i].objectId) {
                            objectId = items [i].objectId;
                            break;
                        };
                    };
                    if (objectId) {
                        let o = $o.getObject (objectId);
                        if (o.get (attr)) {
                            let ca = $o.getClass (o.get ("classId")).attrs [attr];
                            let src = "files/" + objectId + "-" + ca.get ("id") + "-" + o.get (attr);
                            me.down ("image").setSrc (src);
                        } else {
                            me.down ("image").setSrc (null);
                        };
                    };
                } else {
                    let src = cmp.getValue (attr);
                    me.down ("image").setSrc (src);
                };
            };        
        };
	}
});
