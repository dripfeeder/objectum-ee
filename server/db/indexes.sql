create unique index tschema_fid on $schema_prefix$tschema (fid) $tablespace$;

create index trevision_fdate on $schema_prefix$trevision (fdate) $tablespace$;
create unique index trevision_fid on $schema_prefix$trevision (fid) $tablespace$;
create index trevision_fschema_id on $schema_prefix$trevision (fschema_id) $tablespace$;
create index trevision_frecord_id on $schema_prefix$trevision (frecord_id) $tablespace$;
create index trevision_ftoc on $schema_prefix$trevision (ftoc) $tablespace$;

create index tview_ftype on $schema_prefix$tview (ftype) $tablespace$;
create index tview_fid on $schema_prefix$tview (fid) $tablespace$;
create index tview_fcode on $schema_prefix$tview (fcode);
create index tview_fend_id on $schema_prefix$tview (fend_id) $tablespace$;
create unique index tview_ufid on $schema_prefix$tview (fid,fstart_id,fend_id) $tablespace$;
create index tview_fname on $schema_prefix$tview (fname);
create index tview_fparent_id on $schema_prefix$tview (fparent_id) $tablespace$;
create index tview_fsystem on $schema_prefix$tview (fsystem) $tablespace$;
create index tview_fstart_id on $schema_prefix$tview (fstart_id) $tablespace$;
create index tview_fclass_id on $schema_prefix$tview (fclass_id) $tablespace$;
create index tview_fschema_id on $schema_prefix$tview (fschema_id) $tablespace$;
create index tview_frecord_id on $schema_prefix$tview (frecord_id) $tablespace$;

create index tview_attr_fid on $schema_prefix$tview_attr (fid) $tablespace$;
create index tview_attr_fclass_id on $schema_prefix$tview_attr (fclass_id) $tablespace$;
create index tview_attr_fclass_attr_id on $schema_prefix$tview_attr (fclass_attr_id) $tablespace$;
create index tview_attr_fcode on $schema_prefix$tview_attr (fcode) $tablespace$;
create unique index tview_attr_ufid on $schema_prefix$tview_attr (fid,fstart_id,fend_id) $tablespace$;
create index tview_attr_fname on $schema_prefix$tview_attr (fname) $tablespace$;
create index tview_attr_fview_id on $schema_prefix$tview_attr (fview_id) $tablespace$;
create index tview_attr_fsubject_id on $schema_prefix$tview_attr (fsubject_id) $tablespace$;
create index tview_attr_fstart_id on $schema_prefix$tview_attr (fstart_id) $tablespace$;
create index tview_attr_fend_id on $schema_prefix$tview_attr (fend_id) $tablespace$;
create index tview_attr_farea on $schema_prefix$tview_attr (farea) $tablespace$;
create index tview_attr_fschema_id on $schema_prefix$tview_attr (fschema_id) $tablespace$;
create index tview_attr_frecord_id on $schema_prefix$tview_attr (frecord_id) $tablespace$;

create index taction_fid on $schema_prefix$taction (fid) $tablespace$;
create index taction_fclass_id on $schema_prefix$taction (fclass_id) $tablespace$;
create index taction_fcode on $schema_prefix$taction (fcode);
create index taction_fend_id on $schema_prefix$taction (fend_id) $tablespace$;
create unique index taction_ufid on $schema_prefix$taction (fid,fstart_id,fend_id) $tablespace$;
create index taction_fname on $schema_prefix$taction (fname);
create index taction_fstart_id on $schema_prefix$taction (fstart_id) $tablespace$;
create index taction_fschema_id on $schema_prefix$taction (fschema_id) $tablespace$;
create index taction_frecord_id on $schema_prefix$taction (frecord_id) $tablespace$;

create index taction_attr_fid on $schema_prefix$taction_attr (fid) $tablespace$;
create index taction_attr_faction_id on $schema_prefix$taction_attr (faction_id) $tablespace$;
create index taction_attr_fcode on $schema_prefix$taction_attr (fcode);
create index taction_attr_fend_id on $schema_prefix$taction_attr (fend_id) $tablespace$;
create unique index taction_attr_ufid on $schema_prefix$taction_attr (fid,fstart_id,fend_id) $tablespace$;
create index taction_attr_fname on $schema_prefix$taction_attr (fname);
create index taction_attr_fstart_id on $schema_prefix$taction_attr (fstart_id) $tablespace$;
create index taction_attr_fschema_id on $schema_prefix$taction_attr (fschema_id) $tablespace$;
create index taction_attr_frecord_id on $schema_prefix$taction_attr (frecord_id) $tablespace$;

create index tclass_fid on $schema_prefix$tclass (fid) $tablespace$;
create index tclass_fcode on $schema_prefix$tclass (fcode);
create index tclass_fend_id on $schema_prefix$tclass (fend_id) $tablespace$;
create index tclass_fname on $schema_prefix$tclass (fname);
create index tclass_fparent_id on $schema_prefix$tclass (fparent_id) $tablespace$;
create index tclass_fsystem on $schema_prefix$tclass (fsystem) $tablespace$;
create index tclass_ftype on $schema_prefix$tclass (ftype) $tablespace$;
create index tclass_fkind on $schema_prefix$tclass (fkind) $tablespace$;
create index tclass_fstart_id on $schema_prefix$tclass (fstart_id) $tablespace$;
create index tclass_fview_id on $schema_prefix$tclass (fview_id) $tablespace$;
create index tclass_fschema_id on $schema_prefix$tclass (fschema_id) $tablespace$;
create index tclass_frecord_id on $schema_prefix$tclass (frecord_id) $tablespace$;

create index tclass_attr_fid on $schema_prefix$tclass_attr (fid) $tablespace$;
create index tclass_attr_fclass_id on $schema_prefix$tclass_attr (fclass_id) $tablespace$;
create index tclass_attr_fcode on $schema_prefix$tclass_attr (fcode);
create index tclass_attr_fend_id on $schema_prefix$tclass_attr (fend_id) $tablespace$;
create index tclass_attr_fname on $schema_prefix$tclass_attr (fname);
create index tclass_attr_fstart_id on $schema_prefix$tclass_attr (fstart_id) $tablespace$;
create index tclass_attr_ftype_id on $schema_prefix$tclass_attr (ftype_id) $tablespace$;
create index tclass_attr_fschema_id on $schema_prefix$tclass_attr (fschema_id) $tablespace$;
create index tclass_attr_frecord_id on $schema_prefix$tclass_attr (frecord_id) $tablespace$;

create index tobject_fid on $schema_prefix$tobject (fid) $tablespace$;
create index tobject_fclass_id on $schema_prefix$tobject (fclass_id) $tablespace$;
create index tobject_fend_id on $schema_prefix$tobject (fend_id) $tablespace$;
create unique index tobject_ufid on $schema_prefix$tobject (fid,fstart_id,fend_id) $tablespace$;
create index tobject_fstart_id on $schema_prefix$tobject (fstart_id) $tablespace$;
create index tobject_fschema_id on $schema_prefix$tobject (fschema_id) $tablespace$;
create index tobject_frecord_id on $schema_prefix$tobject (frecord_id) $tablespace$;

create index tobject_attr_fid on $schema_prefix$tobject_attr (fid) $tablespace$;
create index tobject_attr_fclass_attr_id on $schema_prefix$tobject_attr (fclass_attr_id) $tablespace$;
create index tobject_attr_fend_id on $schema_prefix$tobject_attr (fend_id) $tablespace$;
create index tobject_attr_fnumber on $schema_prefix$tobject_attr (fnumber) $tablespace$;
create index tobject_attr_fobject_id on $schema_prefix$tobject_attr (fobject_id) $tablespace$;
create index tobject_attr_ftime on $schema_prefix$tobject_attr (ftime) $tablespace$;
create index tobject_attr_fstart_id on $schema_prefix$tobject_attr (fstart_id) $tablespace$;
create index tobject_attr_fstring on $schema_prefix$tobject_attr ($tobject_attr_fstring$);
create index tobject_attr_fschema_id on $schema_prefix$tobject_attr (fschema_id) $tablespace$;
create index tobject_attr_frecord_id on $schema_prefix$tobject_attr (frecord_id) $tablespace$;

create unique index tmail_fid on $schema_prefix$tmail (fid) $tablespace$;
