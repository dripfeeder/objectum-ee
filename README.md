# Objectum Enterprise Edition - javascript app platform
Objectum platform makes it easy to create realtime single page applications that run in both Node.js and browsers.  
Objectum includes a powerful user interface constructor called Visual Objectum that creates grids, tree grids, forms, etc. Automatically generates source code for CRUD (create, read, update, delete) functions.

## Learn by Example project "To-Do list" (url)

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

## Build user interface by Visual Objectum

### 1. Create class
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/class-create.png)

### 2. Create class attribute
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/classAttr-create.png)

### 3. Create card

#### 3.1. Open action layout
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/action-layout.png)

#### 3.2. Open card
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card-open.png)

#### 3.3. Add field to card
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card.png)

### 4. Create view
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-create.png)

### 5. Create query
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-query.png)

### 6. Create layout
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-layout.png)

### 7. Add table to layout
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/olap.png)

### 8. Create menu
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menu.png)

### 9. Create menu item
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menuItem.png)

### 10. Create admin account (login: adm) and select administrator menu
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/access.png)

### 11. Build project
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/project.png)

### 12. Reload browser page. Login as "adm". You can add, remove and open tasks.
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/todo.png)

## Advanced learning

Dictionary
...

Table
...

Deployment
...

Storages mixing
...

Objectum API (async)
...

Objectum API (sync, only client side)
...

Objectum Firewall
...

## Author

**Dmitriy Samortsev**

+ http://github.com/objectum


## Copyright and license

GPLv3
