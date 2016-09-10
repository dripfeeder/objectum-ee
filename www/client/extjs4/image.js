/*
	Copyright (C) 2011-2014 Samortsev Dmitry. All Rights Reserved.	
*/

Ext.define ("$o.Image.Widget", {
	extend: "Ext.panel.Panel",
	alias: ["widget.$o.image"],
    border: 0,
	initComponent: function () {		
		var me = this;
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
        var me = this;
        if (me.attr) {
            var cmp = me.relatives [me.attr.split (".")[0]];
            var attr = me.attr.split (".")[1];
            if (cmp) {
                cmp.targets [me.zid] = me;
                if (cmp.xtype == "$o.card") {
                    var items = cmp.getItems ();
                    var objectId;
                    for (var i = 0; i < items.length; i ++) {
                        if (items [i].objectId) {
                            objectId = items [i].objectId;
                            break;
                        };
                    };
                    if (objectId) {
                        var o = $o.getObject (objectId);
                        if (o.get (attr)) {
                            var ca = $o.getClass (o.get ("classId")).attrs [attr];
                            var src = "files/" + objectId + "-" + ca.get ("id") + "-" + o.get (attr);
                            me.down ("image").setSrc (src);
                        } else {
                            me.down ("image").setSrc (null);
                        };
                    };
                } else {
                    var src = cmp.getValue (attr);
                    me.down ("image").setSrc (src);
                };
            };        
        };
	}
});
