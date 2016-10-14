create table $schema_prefix$_class (
	fid $tid$ not null,
	fparent_id $tnumber$,
	fname $tstring$,
	fcode $tstring$ not null,
	fdescription $ttext$,
	fformat $ttext$,
	fview_id $tnumber$,
	fstart_id $tnumber$
) $tablespace$;

create table $schema_prefix$_class_attr (
	fid $tid$ not null,
	fclass_id $tnumber$ not null,
	fclass_code $tstring$ not null,
	fname $tstring$,
	fcode $tstring$ not null,
	fdescription $ttext$,
	ftype_id $tnumber$ not null,
	fnot_null $tnumber$,
	fsecure $tnumber$,
	funique $tnumber$,
	fremove_rule $tstring$,
	fstart_id $tnumber$
) $tablespace$;

create table $schema_prefix$_view (
	fid $tid$ not null,
	fparent_id $tnumber$,
	fname $tstring$,
	fcode $tstring$ not null,
	fdescription $ttext$,
	flayout $ttext$,
	fquery $ttext$,
	fstart_id $tnumber$
) $tablespace$;

create table $schema_prefix$_object (
	fid $tid$ not null,
	fstart_id $tnumber$
) $tablespace$;

alter table $schema_prefix$_class add primary key (fid);
alter table $schema_prefix$_class_attr add primary key (fid);
alter table $schema_prefix$_view add primary key (fid);
alter table $schema_prefix$_object add primary key (fid);

create unique index _class_fcode on $schema_prefix$_class (fparent_id, fcode) $tablespace$;
create unique index _class_fcode_null on $schema_prefix$_class (fcode) $tablespace$ where fparent_id is null;
create unique index _class_attr_fcode on $schema_prefix$_class_attr (fclass_id, fcode) $tablespace$;
create unique index _view_fcode on $schema_prefix$_view (fparent_id, fcode) $tablespace$;
create unique index _view_fcode_null on $schema_prefix$_view (fcode) $tablespace$ where fparent_id is null;

-- tclass after insert
create function trigger_tclass_after_insert () returns trigger as
$$
declare
	tableName varchar (256);
	classCode varchar (256);
	parentId int;
begin
	if (NEW.fend_id = 2147483647) then
		tableName = NEW.fcode || '_' || NEW.fid;
		select fcode, fparent_id into classCode, parentId from _class where fid = NEW.fid;
		if (classCode is null) then
			if (NEW.fid >= 1000) then
				begin
					execute 'create table ' || tableName || '(fobject_id bigint)';
					execute 'alter table ' || tableName || ' add primary key (fobject_id)';
				exception when others then
				end;
			end if;
			insert into _class (
				fid, fparent_id, fname, fcode, fdescription, fformat, fview_id, fstart_id
			) values (
				NEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.fformat, NEW.fview_id, NEW.fstart_id
			);
		else
			if (classCode <> NEW.fcode) then
				raise exception 'You can''t change: code';
			end if;
			if (parentId <> NEW.fparent_id) then
				raise exception 'You can''t change: parent_id';
			end if;
			update _class set
				fparent_id = NEW.fparent_id,
				fname = NEW.fname,
				fcode = NEW.fcode,
				fdescription = NEW.fdescription,
				fformat = NEW.fformat,
				fview_id = NEW.fview_id,
				fstart_id = NEW.fstart_id
			where
				fid = NEW.fid;
		end if;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tclass_after_insert
after insert on tclass for each row 
execute procedure trigger_tclass_after_insert ();

-- tclass after update
create function trigger_tclass_after_update () returns trigger as
$$
declare
	startId int;
begin
	select fstart_id into startId from _class where fid = NEW.fid;
	if (NEW.fstart_id = startId) then
		execute 'delete from _class where fid = ' || NEW.fid;
		if (NEW.fid >= 1000) then
			execute 'drop table ' || NEW.fcode || '_' || NEW.fid;
		end if;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tclass_after_update
after update on tclass for each row 
execute procedure trigger_tclass_after_update ();

-- tclass_attr after insert
create function trigger_tclass_attr_after_insert () returns trigger as
$$
declare
	classCode varchar (256);
	tableName varchar (256);
	columnName varchar (256);
	columnType varchar (64);
	caCode varchar (256);
	caClassId int;
	caTypeId int;
	caUnique int;
begin
	select fcode into classCode from _class where fid = NEW.fclass_id;
	if (classCode is not null and NEW.fend_id = 2147483647) then
		select fcode, fclass_id, ftype_id, funique into caCode, caClassId, caTypeId, caUnique from _class_attr where fid = NEW.fid;
		columnName = NEW.fcode || '_' || NEW.fid;
		tableName = classCode || '_' || NEW.fclass_id;
		if (caCode is null) then
			-- Column type
			columnType = 'bigint';
			if (NEW.ftype_id = 3) then
				columnType = 'timestamp (6)';
			end if;
			if (NEW.ftype_id = 2) then
				columnType = 'numeric';
			end if;
			if (NEW.ftype_id = 1 or NEW.ftype_id = 5) then
				columnType = 'text';
			end if;
			execute 'alter table ' || tableName || ' add column ' || columnName || ' ' || columnType;
			insert into _class_attr (
				fid, fclass_id, fclass_code, fname, fcode, fdescription, ftype_id, fnot_null, fsecure, funique, fremove_rule, fstart_id
			) values (
				NEW.fid, NEW.fclass_id, classCode, NEW.fname, NEW.fcode, NEW.fdescription, NEW.ftype_id, NEW.fnot_null, NEW.fsecure, NEW.funique, NEW.fremove_rule, NEW.fstart_id
			);
			-- Unique
			--if (NEW.funique is not null and NEW.funique = 1) then
			--	execute 'create unique index ' || tableName || '_' || columnName || '_unique on ' || tableName || ' (' || columnName || ')';
			--end if;
			-- Index
			if (NEW.ftype_id = 12 or NEW.ftype_id >= 1000 or position ('"index"' in NEW.fformat_func) > 0) then
				-- if (NEW.ftype_id = 1) then
				-- 	execute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ') (substr (' || columnName || ', 1, 1024))';
				-- else
					execute 'create index ' || tableName || '_' || columnName || ' on ' || tableName || ' (' || columnName || ')';
				-- end if;
			end if;
		else
			if (caCode <> NEW.fcode) then
				raise exception 'You can''t change: code' using message = 'You can''t change: code - ' || caCode || ',' || NEW.fcode;
			end if;
			if (caClassId <> NEW.fclass_id) then
				raise exception 'You can''t change: class_id' using message = 'You can''t change: class_id - ' || caClassId || ',' || NEW.fclass_id;
			end if;
			if (caTypeId <> NEW.ftype_id) then
				raise exception 'You can''t change: type_id' using message = 'You can''t change: type_id - ' || caTypeId || ',' || NEW.ftype_id;
			end if;
			if (caUnique <> NEW.funique) then
				raise exception 'You can''t change: unique' using message = 'You can''t change: unique';
			end if;
			update _class_attr set
				fname = NEW.fname,
				fcode = NEW.fcode,
				fclass_id = NEW.fclass_id,
				fclass_code = classCode,
				ftype_id = NEW.ftype_id,
				fdescription = NEW.fdescription,
				fnot_null = NEW.fnot_null,
				fsecure = NEW.fsecure,
				fremove_rule = NEW.fremove_rule,
				fstart_id = NEW.fstart_id
			where
				fid = NEW.fid;
		end if;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tclass_attr_after_insert
after insert on tclass_attr for each row 
execute procedure trigger_tclass_attr_after_insert ();

-- tclass_attr after update
create function trigger_tclass_attr_after_update () returns trigger as
$$
declare
	startId int;
	classCode varchar (256);
begin
	select fstart_id, fclass_code into startId, classCode from _class_attr where fid = NEW.fid;
	if (NEW.fstart_id = startId) then
		execute 'delete from _class_attr where fid = ' || NEW.fid;
		execute 'alter table ' || classCode || '_' || NEW.fclass_id || ' drop column ' || NEW.fcode || '_' || NEW.fid || ' cascade';
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tclass_attr_after_update
after update on tclass_attr for each row 
execute procedure trigger_tclass_attr_after_update ();

-- tview after insert
create function trigger_tview_after_insert () returns trigger as
$$
declare
	viewCode varchar (256);
begin
	select fcode into viewCode from _view where fid = NEW.fid;
	if (NEW.fsystem is null and NEW.fend_id = 2147483647) then
		if (viewCode is null) then
			insert into _view (
				fid, fparent_id, fname, fcode, fdescription, flayout, fquery, fstart_id
			) values (
				NEW.fid, NEW.fparent_id, NEW.fname, NEW.fcode, NEW.fdescription, NEW.flayout, NEW.fquery, NEW.fstart_id
			);
		else
			update _view set
				fparent_id = NEW.fparent_id,
				fname = NEW.fname,
				fcode = NEW.fcode,
				fdescription = NEW.fdescription,
				flayout = NEW.flayout,
				fquery = NEW.fquery,
				fstart_id = NEW.fstart_id
			where
				fid = NEW.fid;
		end if;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tview_after_insert
after insert on tview for each row 
execute procedure trigger_tview_after_insert ();

-- tview after update
create function trigger_tview_after_update () returns trigger as
$$
declare
	startId int;
begin
	select fstart_id into startId from _view where fid = NEW.fid;
	if (NEW.fsystem is null and startId is not null and NEW.fstart_id = startId) then
		execute 'delete from _view where fid = ' || NEW.fid;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tview_after_update
after update on tview for each row 
execute procedure trigger_tview_after_update ();

-- tobject after insert
create function trigger_tobject_after_insert () returns trigger as
$$
declare
	classCode varchar (256);
	id int;
	startId int;
	classId int;
	parentId int;
begin
	if (NEW.fend_id = 2147483647) then
		id = NEW.fid;
		classId = NEW.fclass_id;
		startId = NEW.fstart_id;
		select fcode, fparent_id into classCode, parentId from _class where fid = classId;
		if (classCode is not null) then
			insert into _object (
				fid, fstart_id
			) values (
				id, startId
			);
		end if;
		loop
			if (classCode is not null) then
				execute 'insert into ' || classCode || '_' || classId || ' (fobject_id) values (' || id || ')';
			end if;
		    if (parentId is null) then
		        exit;
		    else
		    	classId = parentId;
				select fcode, fparent_id into classCode, parentId from _class where fid = classId;
		    end if;
		end loop;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tobject_after_insert
after insert on tobject for each row 
execute procedure trigger_tobject_after_insert ();

-- tobject after update
create function trigger_tobject_after_update () returns trigger as
$$
declare
	startId int;
	classCode varchar (256);
begin
	select fstart_id into startId from _object where fid = NEW.fid;
	if (NEW.fstart_id = startId) then
		-- todo delete from parent classes
		execute 'delete from _object where fid = ' || NEW.fid;
		select fcode into classCode from _class where fid = NEW.fclass_id;
		execute 'delete from ' || classCode || '_' || NEW.fclass_id || ' where fobject_id = ' || NEW.fid;
	end if;
	return NEW;
end; 
$$ language plpgsql;

create trigger tobject_after_update
after update on tobject for each row 
execute procedure trigger_tobject_after_update ();

-- tobject_attr after insert
--create function trigger_tobject_attr_after_insert () returns trigger as
--$$
--declare
--	classCode varchar (256);
--	classId int;
--	caCode varchar (256);
--	value text;
--begin
--	select fclass_code, fclass_id, fcode into classCode, classId, caCode from _class_attr where fid = NEW.fclass_attr_id;
--	if (classCode is not null) then
--		value = 'null';
--		if (NEW.fstring is not null) then
--			value = '''' || replace (NEW.fstring, '''', '''''') || '''';
--		end if;
--		if (NEW.ftime is not null) then
--			value = '''' || to_char (NEW.ftime, 'DD.MM.YYYY HH24:MI:SS.MS') || '''';
--		end if;
--		if (NEW.fnumber is not null) then
--			value = '''' || NEW.fnumber::text || '''';
--		end if;
--		begin
--			execute 'update ' || classCode || '_' || classId || ' set ' || caCode || '_' || NEW.fclass_attr_id || ' = ' || value || ' where fobject_id = ' || NEW.fobject_id;
--		exception when others then
--		end;
--	end if;
--	return NEW;
--end; 
--$$ language plpgsql;
--
--create trigger tobject_attr_after_insert
--after insert on tobject_attr for each row 
--execute procedure trigger_tobject_attr_after_insert ();

