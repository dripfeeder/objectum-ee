
var dbTablesSQL = "create table $schema_prefix$tschema (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $ttext$,\r\n\tfcode $ttext$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$trevision (\r\n\tfid $tid$ not null,\r\n\tfsubject_id $tnumber$,\r\n\tfdate $ttimestamp$,\r\n\tfdescription $ttext$,\r\n\tfremote_addr $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tftoc $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tflayout $ttext$,\r\n\tfkey $tstring$,\r\n\tfparent_key $tstring$,\r\n\tfclass_id $tnumber$,\r\n\tfunrelated $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfquery $ttext$,\r\n\tftype $tnumber$,\r\n\tfmaterialized $tnumber$ default 0,\r\n\tfsystem $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tficon_cls $tstring$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview_attr (\r\n\tfid $tid$ not null,\r\n\tfview_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfclass_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfsubject_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfsort_kind $tnumber$,\r\n\tfsort_order $tnumber$,\r\n\tfoperation $tnumber$,\r\n\tfvalue $ttext$,\r\n\tfarea $tnumber$,\r\n\tfcolumn_width $tnumber$,\r\n\tftotal_type $tnumber$,\r\n\tfread_only $tnumber$,\r\n\tfgroup $tnumber$,\r\n\tfnot_null $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfbody $ttext$,\r\n\tfconfirm $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tflayout $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction_attr (\r\n\tfid $tid$ not null,\r\n\tfaction_id $tnumber$,\r\n\tftype_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfkind $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfformat $ttext$,\r\n\tfview_id $tnumber$,\r\n\tfsystem $tnumber$,\r\n\tftype $tnumber$,\r\n\tfkind $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass_attr (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tftype_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfsecure $tnumber$,\r\n\tfmax_str $tnumber$,\r\n\tfmin_str $tnumber$,\r\n\tfmax_number $tnumber$,\r\n\tfmin_number $tnumber$,\r\n\tfmax_ts $tnumber$,\r\n\tfmin_ts $tnumber$,\r\n\tfunique $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfformat_func $ttext$,\r\n\tfformat_number $tstring$,\r\n\tfformat_ts $tstring$,\r\n\tfremove_rule $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject_attr (\r\n\tfid $tid_object_attr$ not null,\r\n\tfobject_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfstring $tstring_value$,\r\n\tfnumber $tnumber_value$,\r\n\tftime $ttimestamp$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tmail (\r\n\tfid $tid$ not null,\r\n\tfrecipients $ttext$,\r\n\tfmessage $ttext$,\r\n\tfcreation_date $ttimestamp$,\r\n\tfsending_date $ttimestamp$\r\n) $tablespace$;\r\n";

var dbIndexesSQL = "create unique index tschema_fid on $schema_prefix$tschema (fid) $tablespace$;\r\n\r\ncreate index trevision_fdate on $schema_prefix$trevision (fdate) $tablespace$;\r\ncreate unique index trevision_fid on $schema_prefix$trevision (fid) $tablespace$;\r\ncreate index trevision_fschema_id on $schema_prefix$trevision (fschema_id) $tablespace$;\r\ncreate index trevision_frecord_id on $schema_prefix$trevision (frecord_id) $tablespace$;\r\ncreate index trevision_ftoc on $schema_prefix$trevision (ftoc) $tablespace$;\r\n\r\ncreate index tview_ftype on $schema_prefix$tview (ftype) $tablespace$;\r\ncreate index tview_fid on $schema_prefix$tview (fid) $tablespace$;\r\ncreate index tview_fcode on $schema_prefix$tview (fcode);\r\ncreate index tview_fend_id on $schema_prefix$tview (fend_id) $tablespace$;\r\ncreate unique index tview_ufid on $schema_prefix$tview (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_fname on $schema_prefix$tview (fname);\r\ncreate index tview_fparent_id on $schema_prefix$tview (fparent_id) $tablespace$;\r\ncreate index tview_fsystem on $schema_prefix$tview (fsystem) $tablespace$;\r\ncreate index tview_fstart_id on $schema_prefix$tview (fstart_id) $tablespace$;\r\ncreate index tview_fclass_id on $schema_prefix$tview (fclass_id) $tablespace$;\r\ncreate index tview_fschema_id on $schema_prefix$tview (fschema_id) $tablespace$;\r\ncreate index tview_frecord_id on $schema_prefix$tview (frecord_id) $tablespace$;\r\n\r\ncreate index tview_attr_fid on $schema_prefix$tview_attr (fid) $tablespace$;\r\ncreate index tview_attr_fclass_id on $schema_prefix$tview_attr (fclass_id) $tablespace$;\r\ncreate index tview_attr_fclass_attr_id on $schema_prefix$tview_attr (fclass_attr_id) $tablespace$;\r\ncreate index tview_attr_fcode on $schema_prefix$tview_attr (fcode) $tablespace$;\r\ncreate unique index tview_attr_ufid on $schema_prefix$tview_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_attr_fname on $schema_prefix$tview_attr (fname) $tablespace$;\r\ncreate index tview_attr_fview_id on $schema_prefix$tview_attr (fview_id) $tablespace$;\r\ncreate index tview_attr_fsubject_id on $schema_prefix$tview_attr (fsubject_id) $tablespace$;\r\ncreate index tview_attr_fstart_id on $schema_prefix$tview_attr (fstart_id) $tablespace$;\r\ncreate index tview_attr_fend_id on $schema_prefix$tview_attr (fend_id) $tablespace$;\r\ncreate index tview_attr_farea on $schema_prefix$tview_attr (farea) $tablespace$;\r\ncreate index tview_attr_fschema_id on $schema_prefix$tview_attr (fschema_id) $tablespace$;\r\ncreate index tview_attr_frecord_id on $schema_prefix$tview_attr (frecord_id) $tablespace$;\r\n\r\ncreate index taction_fid on $schema_prefix$taction (fid) $tablespace$;\r\ncreate index taction_fclass_id on $schema_prefix$taction (fclass_id) $tablespace$;\r\ncreate index taction_fcode on $schema_prefix$taction (fcode);\r\ncreate index taction_fend_id on $schema_prefix$taction (fend_id) $tablespace$;\r\ncreate unique index taction_ufid on $schema_prefix$taction (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_fname on $schema_prefix$taction (fname);\r\ncreate index taction_fstart_id on $schema_prefix$taction (fstart_id) $tablespace$;\r\ncreate index taction_fschema_id on $schema_prefix$taction (fschema_id) $tablespace$;\r\ncreate index taction_frecord_id on $schema_prefix$taction (frecord_id) $tablespace$;\r\n\r\ncreate index taction_attr_fid on $schema_prefix$taction_attr (fid) $tablespace$;\r\ncreate index taction_attr_faction_id on $schema_prefix$taction_attr (faction_id) $tablespace$;\r\ncreate index taction_attr_fcode on $schema_prefix$taction_attr (fcode);\r\ncreate index taction_attr_fend_id on $schema_prefix$taction_attr (fend_id) $tablespace$;\r\ncreate unique index taction_attr_ufid on $schema_prefix$taction_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_attr_fname on $schema_prefix$taction_attr (fname);\r\ncreate index taction_attr_fstart_id on $schema_prefix$taction_attr (fstart_id) $tablespace$;\r\ncreate index taction_attr_fschema_id on $schema_prefix$taction_attr (fschema_id) $tablespace$;\r\ncreate index taction_attr_frecord_id on $schema_prefix$taction_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_fid on $schema_prefix$tclass (fid) $tablespace$;\r\ncreate index tclass_fcode on $schema_prefix$tclass (fcode);\r\ncreate index tclass_fend_id on $schema_prefix$tclass (fend_id) $tablespace$;\r\ncreate index tclass_fname on $schema_prefix$tclass (fname);\r\ncreate index tclass_fparent_id on $schema_prefix$tclass (fparent_id) $tablespace$;\r\ncreate index tclass_fsystem on $schema_prefix$tclass (fsystem) $tablespace$;\r\ncreate index tclass_ftype on $schema_prefix$tclass (ftype) $tablespace$;\r\ncreate index tclass_fkind on $schema_prefix$tclass (fkind) $tablespace$;\r\ncreate index tclass_fstart_id on $schema_prefix$tclass (fstart_id) $tablespace$;\r\ncreate index tclass_fview_id on $schema_prefix$tclass (fview_id) $tablespace$;\r\ncreate index tclass_fschema_id on $schema_prefix$tclass (fschema_id) $tablespace$;\r\ncreate index tclass_frecord_id on $schema_prefix$tclass (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_attr_fid on $schema_prefix$tclass_attr (fid) $tablespace$;\r\ncreate index tclass_attr_fclass_id on $schema_prefix$tclass_attr (fclass_id) $tablespace$;\r\ncreate index tclass_attr_fcode on $schema_prefix$tclass_attr (fcode);\r\ncreate index tclass_attr_fend_id on $schema_prefix$tclass_attr (fend_id) $tablespace$;\r\ncreate index tclass_attr_fname on $schema_prefix$tclass_attr (fname);\r\ncreate index tclass_attr_fstart_id on $schema_prefix$tclass_attr (fstart_id) $tablespace$;\r\ncreate index tclass_attr_ftype_id on $schema_prefix$tclass_attr (ftype_id) $tablespace$;\r\ncreate index tclass_attr_fschema_id on $schema_prefix$tclass_attr (fschema_id) $tablespace$;\r\ncreate index tclass_attr_frecord_id on $schema_prefix$tclass_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_fid on $schema_prefix$tobject (fid) $tablespace$;\r\ncreate index tobject_fclass_id on $schema_prefix$tobject (fclass_id) $tablespace$;\r\ncreate index tobject_fend_id on $schema_prefix$tobject (fend_id) $tablespace$;\r\ncreate unique index tobject_ufid on $schema_prefix$tobject (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tobject_fstart_id on $schema_prefix$tobject (fstart_id) $tablespace$;\r\ncreate index tobject_fschema_id on $schema_prefix$tobject (fschema_id) $tablespace$;\r\ncreate index tobject_frecord_id on $schema_prefix$tobject (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_attr_fid on $schema_prefix$tobject_attr (fid) $tablespace$;\r\ncreate index tobject_attr_fclass_attr_id on $schema_prefix$tobject_attr (fclass_attr_id) $tablespace$;\r\ncreate index tobject_attr_fend_id on $schema_prefix$tobject_attr (fend_id) $tablespace$;\r\ncreate index tobject_attr_fnumber on $schema_prefix$tobject_attr (fnumber) $tablespace$;\r\ncreate index tobject_attr_fobject_id on $schema_prefix$tobject_attr (fobject_id) $tablespace$;\r\ncreate index tobject_attr_ftime on $schema_prefix$tobject_attr (ftime) $tablespace$;\r\ncreate index tobject_attr_fstart_id on $schema_prefix$tobject_attr (fstart_id) $tablespace$;\r\ncreate index tobject_attr_fstring on $schema_prefix$tobject_attr ($tobject_attr_fstring$);\r\ncreate index tobject_attr_fschema_id on $schema_prefix$tobject_attr (fschema_id) $tablespace$;\r\ncreate index tobject_attr_frecord_id on $schema_prefix$tobject_attr (frecord_id) $tablespace$;\r\n\r\ncreate unique index tmail_fid on $schema_prefix$tmail (fid) $tablespace$;\r\n";

var dbDataSQL = "insert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (1, null, 'Строка', 'String', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (2, null, 'Число', 'Number', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (3, null, 'Дата', 'Date', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (4, null, 'Логический', 'Boolean', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (5, null, 'Файл', 'File', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (6, null, 'Класс', 'Class', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (7, null, 'Атрибут класса', 'ClassAttr', '', 1, 2147483647, '', 1867, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (8, null, 'Представление', 'View', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (9, null, 'Атрибут представления', 'ViewAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (10, null, 'Действие', 'Action', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (11, null, 'Атрибут действия', 'ActionAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (12, null, 'Объект', 'Object', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (13, null, 'Атрибут объекта', 'ObjectAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\n";