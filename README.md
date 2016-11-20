# Objectum Enterprise Edition
Objectum framework makes it easy to write realtime single page applications that run in both Node.js and browsers.

## Learn by Example project "To-do list"

Create directories:
```bash
mkdir /opt/objectum/node
mkdir /opt/objectum/projects
mkdir /opt/objectum/projects/tm
mkdir /opt/objectum/projects/tm/bin
```

Install:
```bash
cd /opt/objectum/node
npm install objectum-ee
```

You must have installed [PostgreSQL 9.x](https://www.postgresql.org/download/) (datestyle = dmy)

Add project configuration (postgres password: 12345):
```bash
cat > /opt/objectum/projects/tm/config.json
{
	"rootDir": "/opt/objectum/projects/tm",
	"adminPassword": "D033E22AE348AEB5660FC2140AEC35850C4DA997",
	"database": "postgres",
	"host": "localhost",
	"port": 5432,
	"db": "tm",
	"dbUser": "tm",
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
		"tm": require ("/opt/objectum/projects/tm/config.json")
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
cat > /opt/objectum/projects/tm/bin/tm-init.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "tm",
	fn: "init"
});
```

Init project folder:
```bash
cd /opt/objectum/projects/tm/bin
node tm-init.js
```

Prepare tablespace folder:
```bash
mkdir /opt/objectum/projects/tm/db
chown postgres:postgres /opt/objectum/projects/tm/db
```

Add script:
```bash
cat > /opt/objectum/projects/tm/bin/tm-create.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "tm",
	fn: "create",
	path: "/opt/objectum/projects/tm/db"
});
```

Create storage:
```bash
cd /opt/objectum/projects/tm/bin
node tm-create.js
```

Add script:
```bash
cat > /opt/objectum/projects/tm/bin/tm-import.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "tm",
	fn: "import",
	file: "/opt/objectum/projects/tm/schema/schema-app.js" // parent storage
});
```

Import storage structure:
```bash
cd /opt/objectum/projects/tm/bin
node tm-import.js
```

Start platform:
```bash
cd /opt/objectum/node
node index.js:
```

Open URL: http://localhost:8100/projects/tm/  
Login: admin  
Password: admin  

## Author

**Dmitriy Samortsev**

+ http://github.com/objectum


## Copyright and license

GPLv3
