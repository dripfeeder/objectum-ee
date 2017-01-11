# Objectum Enterprise Edition - javascript app platform
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
	* [Reports](#reports)  
	* [Locale](#locale)  
	* [Cluster](#cluster)  
	* [Objectum Firewall](#firewall)  
	* [Storages mixing](#mixing)

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
under construction  

<a name="deployment"/>
### Deployment  
under construction  

<a name="api"/>
### Objectum API
startTransaction  
commitTransaction  
rollbackTransaction  

createObject  
getObject  
sync  
removeObject  

<a name="api-client"/>
### Client  
under construction  

<a name="api-server"/>
### Server  
under construction  

<a name="api-sync"/>
### Sync (only client side)  
under construction  

<a name="reports"/>
### Reports  
under construction  

<a name="locale"/>
### Locale  
under construction  

<a name="cluster"/>
### Cluster  
under construction  

<a name="firewall"/>
### Objectum Firewall  
under construction  

<a name="mixing"/>
### Storages mixing  
under construction  

## Author

**Dmitriy Samortsev**

+ http://github.com/objectum


## Copyright and license

GPLv3
