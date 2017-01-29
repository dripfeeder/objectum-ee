# Objectum Enterprise Edition - javascript app platform

<a href="README_RU.md">Русская версия</a>  

Objectum platform makes it easy to create realtime single page applications that run in both Node.js and browsers.  
Objectum includes a powerful user interface constructor called Visual Objectum that creates grids, tree grids, forms, etc. Automatically generates source code for CRUD (create, read, update, delete) functions.

## Learn by Example project "To-Do list"

* [Initialization](#init)  
* [Build user interface by Visual Objectum](#visual-objectum)  
	* [Class](#class)  
	* [Card](#card)  
	* [Query](#query)  
	* [Layout](#layout)  
	* [Menu](#menu)  
	* [Building](#building)  
* [Advanced learning](#advanced)  
	* [Dictionary](#dictionary)  
	* [Table](#table)  
	* [Deployment](#deployment)  
	* [Objectum API](#api)  
		* [Client](#api-client)  
		* [Server](#api-server)  
		* [Sync (only client side)](#api-sync)  
	* [Reports (only client side)](#reports)  
	* [Locale](#locale)  
	* [Cluster](#cluster)  
	* [Objectum Firewall](#firewall)  

Complete project <a href="https://github.com/objectum/todo">https://github.com/objectum/todo</a>  

<a name="init"/>
## Initialization

Create directories:
```bash
mkdir /opt/objectum/node
mkdir /opt/objectum/projects
mkdir /opt/objectum/projects/todo
mkdir /opt/objectum/projects/todo/bin
```

Install:
```bash
cd /opt/objectum/node
npm install objectum-ee
```

You must have installed [PostgreSQL 9.x](https://www.postgresql.org/download/) (datestyle = dmy)

Add project configuration (postgres password: 12345):
```bash
cat > /opt/objectum/projects/todo/config.json
{
	"rootDir": "/opt/objectum/projects/todo",
	"adminPassword": "D033E22AE348AEB5660FC2140AEC35850C4DA997",
	"database": "postgres",
	"host": "localhost",
	"port": 5432,
	"db": "todo",
	"dbUser": "todo",
	"dbPassword": "1",
	"dbaUser": "postgres",
	"dbaPassword": "12345",
	"dbEngine": {
		"enabled": 1
	},
	"visualObjectum": {
		"menuConstructor": 1,
		"accessConstructor": 1,
		"projectConstructor": 1
	}
}
```

Add platform configuration:
```bash
cat > /opt/objectum/node/config.js
module.exports = {
	"rootDir": "/opt/objectum/node",
	"projectsDir": "/opt/objectum/projects",
	"port": 8100,
	"storages": {
		"todo": require ("/opt/objectum/projects/todo/config.json")
	}
}
```

Add script:
```bash
cat > /opt/objectum/node/objectum.js
var objectum = require ("objectum-ee");
var config = require ("./config");
module.exports = new objectum.Objectum (config);
```

Add script:
```bash
cat > /opt/objectum/node/index.js
var objectum = require ("objectum-ee");
objectum.start (require ("./config"));
```

Add script:
```bash
cat > /opt/objectum/projects/todo/bin/init.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "init",
	name: "To-Do list",
	locale: "en" // en, ru
});
```

Init project folder:
```bash
cd /opt/objectum/projects/todo/bin
node init.js
```

Prepare tablespace folder:
```bash
mkdir /opt/objectum/projects/todo/db
chown postgres:postgres /opt/objectum/projects/todo/db
```

Add script:
```bash
cat > /opt/objectum/projects/todo/bin/create.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "create",
	path: "/opt/objectum/projects/todo/db"
});
```

Create storage:
```bash
cd /opt/objectum/projects/todo/bin
node create.js
```

Add script:
```bash
cat > /opt/objectum/projects/todo/bin/import.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "import",
	file: "/opt/objectum/projects/todo/schema/schema-app.js" // parent storage
});
```

Import storage structure:
```bash
cd /opt/objectum/projects/todo/bin
node import.js
```

Start platform:
```bash
cd /opt/objectum/node
node index.js:
```

Start platform with forever:
```bash
forever start -a -l /opt/objectum/node/objectum.log -o /dev/null -e /opt/objectum/node/objectum-error.log --sourceDir /opt/objectum/node index.js
```

Stop platform with forever:
```bash
forever stop index.js
```

Open URL: http://localhost:8100/projects/todo/
Login: admin  
Password: admin  

Add script:
```bash
cat > /opt/objectum/projects/todo/bin/remove.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "remove"
});
```

You can remove storage (drop tablespace, role, user from PostgreSQL):
```bash
cd /opt/objectum/projects/todo/bin
node remove.js
```

<a name="visual-objectum"/>
## Build user interface by Visual Objectum

<a name="class"/>
1. Create class  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/class-create.png)  
2. Create class attribute  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/classAttr-create.png)  
<a name="card"/>
3. Create card  
3.1. Open action layout  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/action-layout.png)  
3.2. Open card  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card-open.png)  
3.3. Add field to card  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card.png)  
4. Create view  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-create.png)  
<a name="query"/>
5. Create query  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-query.png)  
<a name="layout"/>
6. Create layout  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-layout.png)  
7. Add table to layout  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/olap.png)  
<a name="menu"/>
8. Create menu  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menu.png)  
9. Create menu item  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menuItem.png)  
10. Create admin account (login: adm) and select administrator menu  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/access.png)  
<a name="building"/>
11. Build project  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/project.png)  
12. Reload browser page. Login as "adm". You can add, remove and open tasks.  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/todo.png)  

<a name="advanced"/>
## Advanced learning

<a name="dictionary"/>
### Dictionary  
1. Create dict "status"  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict-create.png)  
2. On message "Create standard dictionary (card, view)?" press "Yes".  
3. Create menu item for dictionary  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menuItem-dict.png)  
4. Create items  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict.png)  
5. Create class attribute "status" in "task"  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/task-dict.png)  
6. Open action layout and add field  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict-field.png)  
7. Add column to view query  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/query-dict.png)  
8. Build project and reload browser page  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/todo-dict.png)  

<a name="table"/>
### Table  
1. Create class "comment" with attributes: text, task  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-class.png)  
2. Open action "comment.card" layout and add field  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-card.png)  
3. Change action "task.create"  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-action.png)  
4. Create view "comments" and query for comments  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-query.png)  
5. Open action "task.card" layout and convert card to splitter  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-convert.png)  
6. Add table for comments  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-olap.png)  
7. Add option  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment-option.png)  
8. Build project and reload browser page  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/comment.png)  

<a name="deployment"/>
### Deployment  
Add script:  
```bash
cat > /opt/objectum/projects/todo/bin/export.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "export",
	file: "../schema/schema-todo.js",
	filterClasses: ["task", "comment"]
});
```

Export storage:  
```bash
cd /opt/objectum/projects/todo/bin
node export.js
```

Add script:
```bash
cat > /opt/objectum/projects/todo_my/bin/import.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo_my",
	fn: "import",
	file: "/opt/objectum/projects/todo/schema/schema-todo.js" // parent storage
});
```

Import your storage "todo" to new created storage "todo_my":
```bash
cd /opt/objectum/projects/todo_my/bin
node import.js
```

Just export "todo" and import "todo" to "todo_my" for update to new version of storage "todo". Stop platform before import storage.

<a name="api"/>
### Objectum API

startTransaction  - start transaction. Only one transaction for one session allowed.  
commitTransaction - commit transaction.  
rollbackTransaction - rollback transaction.  
createObject - create object  
getObject - get object  
set - set attribute value  
sync - save object changes to storage  
remove - remove object  
execute - execute SQL query (only SELECT)

<a name="api-client"/>
### Client  
```bash
storage.startTransaction ("description", function (err) {
});
```

```bash
storage.commitTransaction (function (err) {
});
```

```bash
storage.rollbackTransaction (function (err) {
});
```

```bash
storage.createObject ("class", function (err, object) {
	var id = object.get ("id");
});
```

```bash
storage.getObject (id, function (err, object) {
	object.set ("text", "Changed text");
	object.sync (function (err) {
	});
});
```

```bash
object.remove ();
object.sync (function (err) {
});
```

```bash
storage.execute ({
	asArray: true,
	select: [
		{"a": "id"}, "id",
		{"a": "name"}, "name",
		{"b": "name"}, "status"
	],
	from: [
		{"a": "task"},
		"left-join", {"b": "spr.status"}, "on", [{"a": "status"}, "=", {"b": "id"}]
	],
	where: [
		{"a": "name"}, "like", "Buy%", "and", {"a": "id"}, "in", [1000, 1002, 1003, 1004, 1005].join (".,.").split (".")
	],
	order: [
		{"a": "name"}
	]
}, function (err, recs) {
	_.each (recs, function (rec) {
		console.log (rec.id, rec.name, rec.status);
	});
});
```

<a name="api-server"/>
### Server  
```bash
storage.startTransaction ({session: session, description: "description"}, function (err) {
});
```
```bash
storage.commitTransaction ({session: session}, function (err) {
});
```
```bash
storage.rollbackTransaction ({session: session}, function (err) {
});
```
```bash
storage.createObject ({session: session, code: "class"}, function (err, object) {
	var id = object.get ("id");
});
```
```bash
storage.getObject ({session: session, id: id}, function (err, object) {
	object.set ("text", "Changed text");
	object.sync ({session: session}, function (err) {
	});
});
```
```bash
object.remove ();
object.sync ({session: session}, function (err) {
});
```
```bash
storage.execute ({session: session, sql: {
	asArray: true,
	select: [
		{"a": "id"}, "id",
		{"a": "name"}, "name",
		{"b": "name"}, "status"
	],
	from: [
		{"a": "task"},
		"left-join", {"b": "spr.status"}, "on", [{"a": "status"}, "=", {"b": "id"}]
	],
	where: [
		{"a": "name"}, "like", "Buy%", "and", {"a": "id"}, "in", [1000, 1002, 1003, 1004, 1005].join (".,.").split (".")
	],
	order: [
		{"a": "name"}
	]
}}, function (err, recs) {
	_.each (recs, function (rec) {
		console.log (rec.id, rec.name, rec.status);
	});
});
```

<a name="api-sync"/>
### Sync (only client side)  
```bash
$o.startTransaction ("description");
```
```bash
$o.commitTransaction ();
```
```bash
$o.rollbackTransaction ();
```
```bash
$o.createObject ("class");
var id = object.get ("id");
```
```bash
var object = $o.getObject (id);
object.set ("text", "Changed text");
object.sync ();
```
```bash
object.remove ();
object.sync ();
```
```bash
var recs = $o.execute ({
	asArray: true,
	select: [
		{"a": "id"}, "id",
		{"a": "name"}, "name",
		{"b": "name"}, "status"
	],
	from: [
		{"a": "task"},
		"left-join", {"b": "spr.status"}, "on", [{"a": "status"}, "=", {"b": "id"}]
	],
	where: [
		{"a": "name"}, "like", "Buy%", "and", {"a": "id"}, "in", [1000, 1002, 1003, 1004, 1005].join (".,.").split (".")
	],
	order: [
		{"a": "name"}
	]
});
```

<a name="reports"/>
### Reports (only client side) 
```bash
var rows = [{
	cells: [{
		text: "Cell 1 1", style: "border", rowspan: 2
	}, {
		text: "Cell 1 2", style: "border", colspan: 2
	}]
}, {
	startIndex: 2, cells: [{
		text: "Cell 2 2", style: "border"
	}, {
		text: "Cell 2 3", style: "border"
	}]
}];
var report = new $report.xmlss ();
report.sheets = [
	new $report.sheet ({
		name: "Sheet1", 
		orientation: "landscape",
		autoFitHeight: true,
		margins: {
			left: 15,
			top: 15,
			right: 15,
			bottom: 15
		},
		columns: [15, 15, 15],
		rows: rows
	})
];
report.preview ();  
```

<a name="locale"/>
### Locale  
under construction  

<a name="cluster"/>
### Cluster  
under construction  

<a name="firewall"/>
### Objectum Firewall  
under construction  

## Author

**Dmitriy Samortsev**

+ http://github.com/objectum


## Copyright and license

GPLv3
