create table $schema_prefix$tschema (
	fid $tid$ not null,
	fparent_id $tnumber$,
	fname $ttext$,
	fcode $ttext$
) $tablespace$;

create table $schema_prefix$trevision (
	fid $tid$ not null,
	fsubject_id $tnumber$,
	fdate $ttimestamp$,
	fdescription $ttext$,
	fremote_addr $ttext$,
	fschema_id $tnumber$,
	frecord_id $tnumber$,
	ftoc $tnumber$
) $tablespace$;

create table $schema_prefix$tview (
	fid $tid$ not null,
	fparent_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	flayout $ttext$,
	fkey $tstring$,
	fparent_key $tstring$,
	fclass_id $tnumber$,
	funrelated $tstring$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fquery $ttext$,
	ftype $tnumber$,
	fmaterialized $tnumber$ default 0,
	fsystem $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$,
	forder $tnumber_value$,
	ficon_cls $tstring$
) $tablespace$;

create table $schema_prefix$tview_attr (
	fid $tid$ not null,
	fview_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	fclass_id $tnumber$,
	fclass_attr_id $tnumber$,
	fsubject_id $tnumber$,
	forder $tnumber_value$,
	fsort_kind $tnumber$,
	fsort_order $tnumber$,
	foperation $tnumber$,
	fvalue $ttext$,
	farea $tnumber$,
	fcolumn_width $tnumber$,
	ftotal_type $tnumber$,
	fread_only $tnumber$,
	fgroup $tnumber$,
	fnot_null $tnumber$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$taction (
	fid $tid$ not null,
	fclass_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	forder $tnumber_value$,
	fbody $ttext$,
	fconfirm $tnumber$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	flayout $ttext$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$taction_attr (
	fid $tid$ not null,
	faction_id $tnumber$,
	ftype_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	forder $tnumber_value$,
	fnot_null $tnumber$,
	fvalid_func $ttext$,
	fkind $tnumber$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$tclass (
	fid $tid$ not null,
	fparent_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fformat $ttext$,
	fview_id $tnumber$,
	fsystem $tnumber$,
	ftype $tnumber$,
	fkind $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$tclass_attr (
	fid $tid$ not null,
	fclass_id $tnumber$,
	fname $tstring$,
	fcode $tstring$,
	fdescription $ttext$,
	ftype_id $tnumber$,
	forder $tnumber_value$,
	fnot_null $tnumber$,
	fsecure $tnumber$,
	fmax_str $tnumber$,
	fmin_str $tnumber$,
	fmax_number $tnumber$,
	fmin_number $tnumber$,
	fmax_ts $tnumber$,
	fmin_ts $tnumber$,
	funique $tnumber$,
	fvalid_func $ttext$,
	fformat_func $ttext$,
	fformat_number $tstring$,
	fformat_ts $tstring$,
	fremove_rule $tstring$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$tobject (
	fid $tid$ not null,
	fclass_id $tnumber$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$tobject_attr (
	fid $tid_object_attr$ not null,
	fobject_id $tnumber$,
	fclass_attr_id $tnumber$,
	fstring $tstring_value$,
	fnumber $tnumber_value$,
	ftime $ttimestamp$,
	fstart_id $tnumber$,
	fend_id $tnumber$,
	fschema_id $tnumber$,
	frecord_id $tnumber$
) $tablespace$;

create table $schema_prefix$tmail (
	fid $tid$ not null,
	frecipients $ttext$,
	fmessage $ttext$,
	fcreation_date $ttimestamp$,
	fsending_date $ttimestamp$
) $tablespace$;
