
var dbTablesSQL = "create table $schema_prefix$tschema (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $ttext$,\r\n\tfcode $ttext$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$trevision (\r\n\tfid $tid$ not null,\r\n\tfsubject_id $tnumber$,\r\n\tfdate $ttimestamp$,\r\n\tfdescription $ttext$,\r\n\tfremote_addr $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tftoc $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tflayout $ttext$,\r\n\tfkey $tstring$,\r\n\tfparent_key $tstring$,\r\n\tfclass_id $tnumber$,\r\n\tfunrelated $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfquery $ttext$,\r\n\tftype $tnumber$,\r\n\tfmaterialized $tnumber$ default 0,\r\n\tfsystem $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tficon_cls $tstring$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tview_attr (\r\n\tfid $tid$ not null,\r\n\tfview_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfclass_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfsubject_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfsort_kind $tnumber$,\r\n\tfsort_order $tnumber$,\r\n\tfoperation $tnumber$,\r\n\tfvalue $ttext$,\r\n\tfarea $tnumber$,\r\n\tfcolumn_width $tnumber$,\r\n\tftotal_type $tnumber$,\r\n\tfread_only $tnumber$,\r\n\tfgroup $tnumber$,\r\n\tfnot_null $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfbody $ttext$,\r\n\tfconfirm $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tflayout $ttext$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$taction_attr (\r\n\tfid $tid$ not null,\r\n\tfaction_id $tnumber$,\r\n\tftype_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfkind $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass (\r\n\tfid $tid$ not null,\r\n\tfparent_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfformat $ttext$,\r\n\tfview_id $tnumber$,\r\n\tfsystem $tnumber$,\r\n\tftype $tnumber$,\r\n\tfkind $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tclass_attr (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfname $tstring$,\r\n\tfcode $tstring$,\r\n\tfdescription $ttext$,\r\n\tftype_id $tnumber$,\r\n\tforder $tnumber_value$,\r\n\tfnot_null $tnumber$,\r\n\tfsecure $tnumber$,\r\n\tfmax_str $tnumber$,\r\n\tfmin_str $tnumber$,\r\n\tfmax_number $tnumber$,\r\n\tfmin_number $tnumber$,\r\n\tfmax_ts $tnumber$,\r\n\tfmin_ts $tnumber$,\r\n\tfunique $tnumber$,\r\n\tfvalid_func $ttext$,\r\n\tfformat_func $ttext$,\r\n\tfformat_number $tstring$,\r\n\tfformat_ts $tstring$,\r\n\tfremove_rule $tstring$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject (\r\n\tfid $tid$ not null,\r\n\tfclass_id $tnumber$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tobject_attr (\r\n\tfid $tid_object_attr$ not null,\r\n\tfobject_id $tnumber$,\r\n\tfclass_attr_id $tnumber$,\r\n\tfstring $tstring_value$,\r\n\tfnumber $tnumber_value$,\r\n\tftime $ttimestamp$,\r\n\tfstart_id $tnumber$,\r\n\tfend_id $tnumber$,\r\n\tfschema_id $tnumber$,\r\n\tfrecord_id $tnumber$\r\n) $tablespace$;\r\n\r\ncreate table $schema_prefix$tmail (\r\n\tfid $tid$ not null,\r\n\tfrecipients $ttext$,\r\n\tfmessage $ttext$,\r\n\tfcreation_date $ttimestamp$,\r\n\tfsending_date $ttimestamp$\r\n) $tablespace$;\r\n";

var dbIndexesSQL = "create unique index tschema_fid on $schema_prefix$tschema (fid) $tablespace$;\r\n\r\ncreate index trevision_fdate on $schema_prefix$trevision (fdate) $tablespace$;\r\ncreate unique index trevision_fid on $schema_prefix$trevision (fid) $tablespace$;\r\ncreate index trevision_fschema_id on $schema_prefix$trevision (fschema_id) $tablespace$;\r\ncreate index trevision_frecord_id on $schema_prefix$trevision (frecord_id) $tablespace$;\r\ncreate index trevision_ftoc on $schema_prefix$trevision (ftoc) $tablespace$;\r\n\r\ncreate index tview_ftype on $schema_prefix$tview (ftype) $tablespace$;\r\ncreate index tview_fid on $schema_prefix$tview (fid) $tablespace$;\r\ncreate index tview_fcode on $schema_prefix$tview (fcode);\r\ncreate index tview_fend_id on $schema_prefix$tview (fend_id) $tablespace$;\r\ncreate unique index tview_ufid on $schema_prefix$tview (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_fname on $schema_prefix$tview (fname);\r\ncreate index tview_fparent_id on $schema_prefix$tview (fparent_id) $tablespace$;\r\ncreate index tview_fsystem on $schema_prefix$tview (fsystem) $tablespace$;\r\ncreate index tview_fstart_id on $schema_prefix$tview (fstart_id) $tablespace$;\r\ncreate index tview_fclass_id on $schema_prefix$tview (fclass_id) $tablespace$;\r\ncreate index tview_fschema_id on $schema_prefix$tview (fschema_id) $tablespace$;\r\ncreate index tview_frecord_id on $schema_prefix$tview (frecord_id) $tablespace$;\r\n\r\ncreate index tview_attr_fid on $schema_prefix$tview_attr (fid) $tablespace$;\r\ncreate index tview_attr_fclass_id on $schema_prefix$tview_attr (fclass_id) $tablespace$;\r\ncreate index tview_attr_fclass_attr_id on $schema_prefix$tview_attr (fclass_attr_id) $tablespace$;\r\ncreate index tview_attr_fcode on $schema_prefix$tview_attr (fcode) $tablespace$;\r\ncreate unique index tview_attr_ufid on $schema_prefix$tview_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tview_attr_fname on $schema_prefix$tview_attr (fname) $tablespace$;\r\ncreate index tview_attr_fview_id on $schema_prefix$tview_attr (fview_id) $tablespace$;\r\ncreate index tview_attr_fsubject_id on $schema_prefix$tview_attr (fsubject_id) $tablespace$;\r\ncreate index tview_attr_fstart_id on $schema_prefix$tview_attr (fstart_id) $tablespace$;\r\ncreate index tview_attr_fend_id on $schema_prefix$tview_attr (fend_id) $tablespace$;\r\ncreate index tview_attr_farea on $schema_prefix$tview_attr (farea) $tablespace$;\r\ncreate index tview_attr_fschema_id on $schema_prefix$tview_attr (fschema_id) $tablespace$;\r\ncreate index tview_attr_frecord_id on $schema_prefix$tview_attr (frecord_id) $tablespace$;\r\n\r\ncreate index taction_fid on $schema_prefix$taction (fid) $tablespace$;\r\ncreate index taction_fclass_id on $schema_prefix$taction (fclass_id) $tablespace$;\r\ncreate index taction_fcode on $schema_prefix$taction (fcode);\r\ncreate index taction_fend_id on $schema_prefix$taction (fend_id) $tablespace$;\r\ncreate unique index taction_ufid on $schema_prefix$taction (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_fname on $schema_prefix$taction (fname);\r\ncreate index taction_fstart_id on $schema_prefix$taction (fstart_id) $tablespace$;\r\ncreate index taction_fschema_id on $schema_prefix$taction (fschema_id) $tablespace$;\r\ncreate index taction_frecord_id on $schema_prefix$taction (frecord_id) $tablespace$;\r\n\r\ncreate index taction_attr_fid on $schema_prefix$taction_attr (fid) $tablespace$;\r\ncreate index taction_attr_faction_id on $schema_prefix$taction_attr (faction_id) $tablespace$;\r\ncreate index taction_attr_fcode on $schema_prefix$taction_attr (fcode);\r\ncreate index taction_attr_fend_id on $schema_prefix$taction_attr (fend_id) $tablespace$;\r\ncreate unique index taction_attr_ufid on $schema_prefix$taction_attr (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index taction_attr_fname on $schema_prefix$taction_attr (fname);\r\ncreate index taction_attr_fstart_id on $schema_prefix$taction_attr (fstart_id) $tablespace$;\r\ncreate index taction_attr_fschema_id on $schema_prefix$taction_attr (fschema_id) $tablespace$;\r\ncreate index taction_attr_frecord_id on $schema_prefix$taction_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_fid on $schema_prefix$tclass (fid) $tablespace$;\r\ncreate index tclass_fcode on $schema_prefix$tclass (fcode);\r\ncreate index tclass_fend_id on $schema_prefix$tclass (fend_id) $tablespace$;\r\ncreate index tclass_fname on $schema_prefix$tclass (fname);\r\ncreate index tclass_fparent_id on $schema_prefix$tclass (fparent_id) $tablespace$;\r\ncreate index tclass_fsystem on $schema_prefix$tclass (fsystem) $tablespace$;\r\ncreate index tclass_ftype on $schema_prefix$tclass (ftype) $tablespace$;\r\ncreate index tclass_fkind on $schema_prefix$tclass (fkind) $tablespace$;\r\ncreate index tclass_fstart_id on $schema_prefix$tclass (fstart_id) $tablespace$;\r\ncreate index tclass_fview_id on $schema_prefix$tclass (fview_id) $tablespace$;\r\ncreate index tclass_fschema_id on $schema_prefix$tclass (fschema_id) $tablespace$;\r\ncreate index tclass_frecord_id on $schema_prefix$tclass (frecord_id) $tablespace$;\r\n\r\ncreate index tclass_attr_fid on $schema_prefix$tclass_attr (fid) $tablespace$;\r\ncreate index tclass_attr_fclass_id on $schema_prefix$tclass_attr (fclass_id) $tablespace$;\r\ncreate index tclass_attr_fcode on $schema_prefix$tclass_attr (fcode);\r\ncreate index tclass_attr_fend_id on $schema_prefix$tclass_attr (fend_id) $tablespace$;\r\ncreate index tclass_attr_fname on $schema_prefix$tclass_attr (fname);\r\ncreate index tclass_attr_fstart_id on $schema_prefix$tclass_attr (fstart_id) $tablespace$;\r\ncreate index tclass_attr_ftype_id on $schema_prefix$tclass_attr (ftype_id) $tablespace$;\r\ncreate index tclass_attr_fschema_id on $schema_prefix$tclass_attr (fschema_id) $tablespace$;\r\ncreate index tclass_attr_frecord_id on $schema_prefix$tclass_attr (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_fid on $schema_prefix$tobject (fid) $tablespace$;\r\ncreate index tobject_fclass_id on $schema_prefix$tobject (fclass_id) $tablespace$;\r\ncreate index tobject_fend_id on $schema_prefix$tobject (fend_id) $tablespace$;\r\ncreate unique index tobject_ufid on $schema_prefix$tobject (fid,fstart_id,fend_id) $tablespace$;\r\ncreate index tobject_fstart_id on $schema_prefix$tobject (fstart_id) $tablespace$;\r\ncreate index tobject_fschema_id on $schema_prefix$tobject (fschema_id) $tablespace$;\r\ncreate index tobject_frecord_id on $schema_prefix$tobject (frecord_id) $tablespace$;\r\n\r\ncreate index tobject_attr_fid on $schema_prefix$tobject_attr (fid) $tablespace$;\r\ncreate index tobject_attr_fclass_attr_id on $schema_prefix$tobject_attr (fclass_attr_id) $tablespace$;\r\ncreate index tobject_attr_fend_id on $schema_prefix$tobject_attr (fend_id) $tablespace$;\r\ncreate index tobject_attr_fnumber on $schema_prefix$tobject_attr (fnumber) $tablespace$;\r\ncreate index tobject_attr_fobject_id on $schema_prefix$tobject_attr (fobject_id) $tablespace$;\r\ncreate index tobject_attr_ftime on $schema_prefix$tobject_attr (ftime) $tablespace$;\r\ncreate index tobject_attr_fstart_id on $schema_prefix$tobject_attr (fstart_id) $tablespace$;\r\ncreate index tobject_attr_fstring on $schema_prefix$tobject_attr ($tobject_attr_fstring$);\r\ncreate index tobject_attr_fschema_id on $schema_prefix$tobject_attr (fschema_id) $tablespace$;\r\ncreate index tobject_attr_frecord_id on $schema_prefix$tobject_attr (frecord_id) $tablespace$;\r\n\r\ncreate unique index tmail_fid on $schema_prefix$tmail (fid) $tablespace$;\r\n";

var dbDataSQL = "insert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (1, null, 'Строка', 'String', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (2, null, 'Число', 'Number', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (3, null, 'Дата', 'Date', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (4, null, 'Логический', 'Boolean', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (5, null, 'Файл', 'File', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (6, null, 'Класс', 'Class', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (7, null, 'Атрибут класса', 'ClassAttr', '', 1, 2147483647, '', 1867, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (8, null, 'Представление', 'View', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (9, null, 'Атрибут представления', 'ViewAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (10, null, 'Действие', 'Action', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (11, null, 'Атрибут действия', 'ActionAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (12, null, 'Объект', 'Object', '', 1, 2147483647, '', null, 1, 0, null);\r\ninsert into $schema_prefix$tclass (fid, fparent_id, fname, fcode, fdescription, fstart_id, fend_id, fformat, fview_id, fsystem, ftype, fkind)\r\nvalues (13, null, 'Атрибут объекта', 'ObjectAttr', '', 1, 2147483647, '', null, 1, 0, null);\r\n";

var dbEngineSQL = "create table $schema_prefix$_class (\n\tfid $tid$ not null,\n\tfparent_id $tnumber$,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tfformat $ttext$,\n\tfview_id $tnumber$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_class_attr (\n\tfid $tid$ not null,\n\tfclass_id $tnumber$ not null,\n\tfclass_code $tstring$ not null,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tftype_id $tnumber$ not null,\n\tfnot_null $tnumber$,\n\tfsecure $tnumber$,\n\tfunique $tnumber$,\n\tfremove_rule $tstring$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_view (\n\tfid $tid$ not null,\n\tfparent_id $tnumber$,\n\tfname $tstring$,\n\tfcode $tstring$ not null,\n\tfdescription $ttext$,\n\tflayout $ttext$,\n\tfquery $ttext$,\n\tfstart_id $tnumber$\n) $tablespace$;\n\ncreate table $schema_prefix$_object (\n\tfid $tid$ not null,\n\tfstart_id $tnumber$\n) $tablespace$;\n\nalter table $schema_prefix$_class add primary key (fid);\nalter table $schema_prefix$_class_attr add primary key (fid);\nalter table $schema_prefix$_view add primary key (fid);\nalter table $schema_prefix$_object add primary key (fid);\n\ncreate unique index _class_fcode on $schema_prefix$_class (fparent_id, fcode) $tablespace$;\ncreate unique index _class_fcode_null on $schema_prefix$_class (fcode) $tablespace$ where fparent_id is null;\ncreate unique index _class_attr_fcode on $schema_prefix$_class_attr (fclass_id, fcode) $tablespace$;\ncreate unique index _view_fcode on $schema_prefix$_view (fparent_id, fcode) $tablespace$;\ncreate unique index _view_fcode_null on $schema_prefix$_view (fcode) $tablespace$ where fparent_id is null;\n\n-- tclass after insert\ncreate function trigger_tclass_after_insert () returns trigger as\n$$\ndeclare\n\ttableName varchar (256);\n\tclassCode varchar (256);\n\tparentId int;\nbegin\n\tif (NEW.fend_id = 2147483647) then\n\t\ttableName = NEW.fcode || '_' || NEW.fid;\n\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = NEW.fid;\n\t\tif (classCode is null) then\n\t\t\tif (NEW.fid >= 1000) then\n\t\t\t\tbegin\n\t\t\t\t\texecute 'create table ' || tableName || '(fobject_id bigint)';\n\t\t\t\t\texecute 'alter table ' || tableName || ' add primary key (fobject_id)';\n\t\t\t\texception when others then\n\t\t\t\tend;\n\t\t\tend if;\n\t\t\tinsert into _class (\n\t\t\t\tfid, fparent_id, fname, fcode, fdescription, fformat, fview_id, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.fformat, NEW.fview_id, NEW.fstart_id\n\t\t\t);\n\t\telse\n\t\t\tif (classCode <> NEW.fcode) then\n\t\t\t\traise exception 'You can''t change: code';\n\t\t\tend if;\n\t\t\tif (parentId <> NEW.fparent_id) then\n\t\t\t\traise exception 'You can''t change: parent_id';\n\t\t\tend if;\n\t\t\tupdate _class set\n\t\t\t\tfparent_id = NEW.fparent_id,\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tfformat = NEW.fformat,\n\t\t\t\tfview_id = NEW.fview_id,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_after_insert\nafter insert on tclass for each row \nexecute procedure trigger_tclass_after_insert ();\n\n-- tclass after update\ncreate function trigger_tclass_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\nbegin\n\tselect fstart_id into startId from _class where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\texecute 'delete from _class where fid = ' || NEW.fid;\n\t\tif (NEW.fid >= 1000) then\n\t\t\texecute 'drop table ' || NEW.fcode || '_' || NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_after_update\nafter update on tclass for each row \nexecute procedure trigger_tclass_after_update ();\n\n-- tclass_attr after insert\ncreate function trigger_tclass_attr_after_insert () returns trigger as\n$$\ndeclare\n\tclassCode varchar (256);\n\ttableName varchar (256);\n\tcolumnName varchar (256);\n\tcolumnType varchar (64);\n\tcaCode varchar (256);\n\tcaClassId int;\n\tcaTypeId int;\n\tcaUnique int;\nbegin\n\tselect fcode into classCode from _class where fid = NEW.fclass_id;\n\tif (classCode is not null and NEW.fend_id = 2147483647) then\n\t\tselect fcode, fclass_id, ftype_id, funique into caCode, caClassId, caTypeId, caUnique from _class_attr where fid = NEW.fid;\n\t\tcolumnName = NEW.fcode || '_' || NEW.fid;\n\t\ttableName = classCode || '_' || NEW.fclass_id;\n\t\tif (caCode is null) then\n\t\t\t-- Column type\n\t\t\tcolumnType = 'bigint';\n\t\t\tif (NEW.ftype_id = 3) then\n\t\t\t\tcolumnType = 'timestamp (6)';\n\t\t\tend if;\n\t\t\tif (NEW.ftype_id = 2) then\n\t\t\t\tcolumnType = 'numeric';\n\t\t\tend if;\n\t\t\tif (NEW.ftype_id = 1 or NEW.ftype_id = 5) then\n\t\t\t\tcolumnType = 'text';\n\t\t\tend if;\n\t\t\texecute 'alter table ' || tableName || ' add column ' || columnName || ' ' || columnType;\n\t\t\tinsert into _class_attr (\n\t\t\t\tfid, fclass_id, fclass_code, fname, fcode, fdescription, ftype_id, fnot_null, fsecure, funique, fremove_rule, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fclass_id, classCode, NEW.fname, NEW.fcode, NEW.fdescription, NEW.ftype_id, NEW.fnot_null, NEW.fsecure, NEW.funique, NEW.fremove_rule, NEW.fstart_id\n\t\t\t);\n\t\t\t-- Unique\n\t\t\t--if (NEW.funique is not null and NEW.funique = 1) then\n\t\t\t--\texecute 'create unique index ' || tableName || '_' || columnName || '_unique on ' || tableName || ' (' || columnName || ')';\n\t\t\t--end if;\n\t\t\t-- Index\n\t\t\tif (NEW.ftype_id = 12 or NEW.ftype_id >= 1000 or position ('\"index\"' in NEW.fformat_func) > 0) then\n\t\t\t\t-- if (NEW.ftype_id = 1) then\n\t\t\t\t-- \texecute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ') (substr (' || columnName || ', 1, 1024))';\n\t\t\t\t-- else\n\t\t\t\t\texecute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ')';\n\t\t\t\t-- end if;\n\t\t\tend if;\n\t\telse\n\t\t\tif (caCode <> NEW.fcode) then\n\t\t\t\traise exception 'You can''t change: code' using message = 'You can''t change: code - ' || caCode || ',' || NEW.fcode;\n\t\t\tend if;\n\t\t\tif (caClassId <> NEW.fclass_id) then\n\t\t\t\traise exception 'You can''t change: class_id' using message = 'You can''t change: class_id - ' || caClassId || ',' || NEW.fclass_id;\n\t\t\tend if;\n\t\t\tif (caTypeId <> NEW.ftype_id) then\n\t\t\t\traise exception 'You can''t change: type_id' using message = 'You can''t change: type_id - ' || caTypeId || ',' || NEW.ftype_id;\n\t\t\tend if;\n\t\t\tif (caUnique <> NEW.funique) then\n\t\t\t\traise exception 'You can''t change: unique' using message = 'You can''t change: unique';\n\t\t\tend if;\n\t\t\tupdate _class_attr set\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfclass_id = NEW.fclass_id,\n\t\t\t\tfclass_code = classCode,\n\t\t\t\tftype_id = NEW.ftype_id,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tfnot_null = NEW.fnot_null,\n\t\t\t\tfsecure = NEW.fsecure,\n\t\t\t\tfremove_rule = NEW.fremove_rule,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_attr_after_insert\nafter insert on tclass_attr for each row \nexecute procedure trigger_tclass_attr_after_insert ();\n\n-- tclass_attr after update\ncreate function trigger_tclass_attr_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\n\tclassCode varchar (256);\nbegin\n\tselect fstart_id, fclass_code into startId, classCode from _class_attr where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\texecute 'delete from _class_attr where fid = ' || NEW.fid;\n\t\texecute 'alter table ' || classCode || '_' || NEW.fclass_id || ' drop column ' || NEW.fcode || '_' || NEW.fid || ' cascade';\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tclass_attr_after_update\nafter update on tclass_attr for each row \nexecute procedure trigger_tclass_attr_after_update ();\n\n-- tview after insert\ncreate function trigger_tview_after_insert () returns trigger as\n$$\ndeclare\n\tviewCode varchar (256);\nbegin\n\tselect fcode into viewCode from _view where fid = NEW.fid;\n\tif (NEW.fsystem is null and NEW.fend_id = 2147483647) then\n\t\tif (viewCode is null) then\n\t\t\tinsert into _view (\n\t\t\t\tfid, fparent_id, fname, fcode, fdescription, flayout, fquery, fstart_id\n\t\t\t) values (\n\t\t\t\tNEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.flayout, NEW.fquery, NEW.fstart_id\n\t\t\t);\n\t\telse\n\t\t\tupdate _view set\n\t\t\t\tfparent_id = NEW.fparent_id,\n\t\t\t\tfname = NEW.fname,\n\t\t\t\tfcode = NEW.fcode,\n\t\t\t\tfdescription = NEW.fdescription,\n\t\t\t\tflayout = NEW.flayout,\n\t\t\t\tfquery = NEW.fquery,\n\t\t\t\tfstart_id = NEW.fstart_id\n\t\t\twhere\n\t\t\t\tfid = NEW.fid;\n\t\tend if;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tview_after_insert\nafter insert on tview for each row \nexecute procedure trigger_tview_after_insert ();\n\n-- tview after update\ncreate function trigger_tview_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\nbegin\n\tselect fstart_id into startId from _view where fid = NEW.fid;\n\tif (NEW.fsystem is null and startId is not null and NEW.fstart_id = startId) then\n\t\texecute 'delete from _view where fid = ' || NEW.fid;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tview_after_update\nafter update on tview for each row \nexecute procedure trigger_tview_after_update ();\n\n-- tobject after insert\ncreate function trigger_tobject_after_insert () returns trigger as\n$$\ndeclare\n\tclassCode varchar (256);\n\tid int;\n\tstartId int;\n\tclassId int;\n\tparentId int;\nbegin\n\tif (NEW.fend_id = 2147483647) then\n\t\tid = NEW.fid;\n\t\tclassId = NEW.fclass_id;\n\t\tstartId = NEW.fstart_id;\n\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = classId;\n\t\tif (classCode is not null) then\n\t\t\tinsert into _object (\n\t\t\t\tfid, fstart_id\n\t\t\t) values (\n\t\t\t\tid, startId\n\t\t\t);\n\t\tend if;\n\t\tloop\n\t\t\tif (classCode is not null) then\n\t\t\t\texecute 'insert into ' || classCode || '_' || classId || ' (fobject_id) values (' || id || ')';\n\t\t\tend if;\n\t\t    if (parentId is null) then\n\t\t        exit;\n\t\t    else\n\t\t    \tclassId = parentId;\n\t\t\t\tselect fcode, fparent_id into classCode, parentId from _class where fid = classId;\n\t\t    end if;\n\t\tend loop;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tobject_after_insert\nafter insert on tobject for each row \nexecute procedure trigger_tobject_after_insert ();\n\n-- tobject after update\ncreate function trigger_tobject_after_update () returns trigger as\n$$\ndeclare\n\tstartId int;\n\tclassCode varchar (256);\nbegin\n\tselect fstart_id into startId from _object where fid = NEW.fid;\n\tif (NEW.fstart_id = startId) then\n\t\t-- todo delete from parent classes\n\t\texecute 'delete from _object where fid = ' || NEW.fid;\n\t\tselect fcode into classCode from _class where fid = NEW.fclass_id;\n\t\texecute 'delete from ' || classCode || '_' || NEW.fclass_id || ' where fobject_id = ' || NEW.fid;\n\tend if;\n\treturn NEW;\nend; \n$$ language plpgsql;\n\ncreate trigger tobject_after_update\nafter update on tobject for each row \nexecute procedure trigger_tobject_after_update ();\n\n-- tobject_attr after insert\n--create function trigger_tobject_attr_after_insert () returns trigger as\n--$$\n--declare\n--\tclassCode varchar (256);\n--\tclassId int;\n--\tcaCode varchar (256);\n--\tvalue text;\n--begin\n--\tselect fclass_code, fclass_id, fcode into classCode, classId, caCode from _class_attr where fid = NEW.fclass_attr_id;\n--\tif (classCode is not null) then\n--\t\tvalue = 'null';\n--\t\tif (NEW.fstring is not null) then\n--\t\t\tvalue = '''' || replace (NEW.fstring, '''', '''''') || '''';\n--\t\tend if;\n--\t\tif (NEW.ftime is not null) then\n--\t\t\tvalue = '''' || to_char (NEW.ftime, 'DD.MM.YYYY HH24:MI:SS.MS') || '''';\n--\t\tend if;\n--\t\tif (NEW.fnumber is not null) then\n--\t\t\tvalue = '''' || NEW.fnumber::text || '''';\n--\t\tend if;\n--\t\tbegin\n--\t\t\texecute 'update ' || classCode || '_' || classId || ' set ' || caCode || '_' || NEW.fclass_attr_id || ' = ' || value || ' where fobject_id = ' || NEW.fobject_id;\n--\t\texception when others then\n--\t\tend;\n--\tend if;\n--\treturn NEW;\n--end; \n--$$ language plpgsql;\n--\n--create trigger tobject_attr_after_insert\n--after insert on tobject_attr for each row \n--execute procedure trigger_tobject_attr_after_insert ();\n\n";
