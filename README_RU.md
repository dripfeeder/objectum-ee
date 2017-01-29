# Objectum Enterprise Edition - javascript платформа для создания бизнес-приложений  
Платформа Objectum позволяет легко создавать одностраничные веб-приложения, которые работают в NodeJS и браузерах.  
Objectum содержит в себе конструктор пользовательского интерфейса Visual Objectum, позволяющий создавать таблицы, древовидные списки и т.д. А также автоматически генерирует исходный код для действий: добавление, редактирование, удаление, чтение.  

## Инструкция на примере проекта - "To-Do list"  

* [Инициализация](#init)  
* [Создание пользовательского интерфейса с помощью Visual Objectum](#visual-objectum)  
	* [Класс](#class)  
	* [Карточка](#card)  
	* [Запрос](#query)  
	* [Макет](#layout)  
	* [Меню](#menu)  
	* [Сборка](#building)  
* [Другие функции](#advanced)  
	* [Справочник](#dictionary)  
	* [Табличная часть](#table)  
	* [Развертывание](#deployment)  
	* [Objectum API](#api)  
		* [Клиент](#api-client)  
		* [Сервер](#api-server)  
		* [Синхронные функции (только на клиенте)](#api-sync)  
	* [Отчеты](#reports)  
	* [Локализация](#locale)  
	* [Кластер](#cluster)  
	* [Objectum Firewall](#firewall)  

Готовый проект <a href="https://github.com/objectum/todo">https://github.com/objectum/todo</a>  

<a name="init"/>
## Инициализация  

Создайте папки:  
```bash
mkdir /opt/objectum/node
mkdir /opt/objectum/projects
mkdir /opt/objectum/projects/todo
mkdir /opt/objectum/projects/todo/bin
```

Установка:  
```bash
cd /opt/objectum/node
npm install objectum-ee
```

У вас должна быть установлена СУБД [PostgreSQL 9.x](https://www.postgresql.org/download/) (datestyle = dmy)  

Добавьте конфигурацию проекта (пароль postgres: 12345):  
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

Добавьте конфигурацию платформы:  
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

Добавьте скрипт:  
```bash
cat > /opt/objectum/node/objectum.js
var objectum = require ("objectum-ee");
var config = require ("./config");
module.exports = new objectum.Objectum (config);
```

Добавьте скрипт:  
```bash
cat > /opt/objectum/node/index.js
var objectum = require ("objectum-ee");
objectum.start (require ("./config"));
```

Добавьте скрипт:  
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

Инициализация папки проекта:  
```bash
cd /opt/objectum/projects/todo/bin
node init.js
```

Подготовка папки для базы данных:  
```bash
mkdir /opt/objectum/projects/todo/db
chown postgres:postgres /opt/objectum/projects/todo/db
```

Добавьте скрипт:  
```bash
cat > /opt/objectum/projects/todo/bin/create.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "create",
	path: "/opt/objectum/projects/todo/db"
});
```

Создание хранилища:  
```bash
cd /opt/objectum/projects/todo/bin
node create.js
```

Добавьте скрипт:  
```bash
cat > /opt/objectum/projects/todo/bin/import.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "import",
	file: "/opt/objectum/projects/todo/schema/schema-app.js" // parent storage
});
```

Импорт структуры хранилища:  
```bash
cd /opt/objectum/projects/todo/bin
node import.js
```

Запуск платформы:  
```bash
cd /opt/objectum/node
node index.js:
```

Запуск платформы, используя forever:  
```bash
forever start -a -l /opt/objectum/node/objectum.log -o /dev/null -e /opt/objectum/node/objectum-error.log --sourceDir /opt/objectum/node index.js
```

Остановка платформы, используя forever:  
```bash
forever stop index.js
```

Откройте ссылку: http://localhost:8100/projects/todo/  
Логин: admin  
Пароль: admin  

Добавьте скрипт:  
```bash
cat > /opt/objectum/projects/todo/bin/remove.js
var $o = require ("/opt/objectum/node/objectum");
$o.db.execute ({
	code: "todo",
	fn: "remove"
});
```

Вы можете удалить хранилище (удаление tablespace, role, user из PostgreSQL):  
```bash
cd /opt/objectum/projects/todo/bin
node remove.js
```

<a name="visual-objectum"/>
## Создание пользовательского интерфейса с помощью Visual Objectum  

<a name="class"/>
1. Создайте класс  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/class-create.png)  
2. Создайте атрибут класса  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/classAttr-create.png)  
<a name="card"/>
3. Создание карточки  
3.1. Откройте макет действия  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/action-layout.png)  
3.2. Откройте карточку  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card-open.png)  
3.3. Добавьте поле в карточку  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/card.png)  
4. Создайте представление  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-create.png)  
<a name="query"/>
5. Создайте запрос  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-query.png)  
<a name="layout"/>
6. Создайте макет  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/view-layout.png)  
7. Добавьте таблицу в макет  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/olap.png)  
<a name="menu"/>
8. Создайте меню  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menu.png)  
9. Создайте элемент меню  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menuItem.png)  
10. Создайте учетную запись администратора (логин: adm) и выбор меню администратора  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/access.png)  
<a name="building"/>
11. Сборка проекта  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/project.png)  
12. Перезагрузите страницу браузера. Войдите как "adm". Вы можете добавлять, изменять, удалять задачи.  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/todo.png)  

<a name="advanced"/>
## Другие функции

<a name="dictionary"/>
### Справочник  
1. Создайте справочник "status"  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict-create.png)  
2. Нажмите "Да" на запрос создания справочника "Создать типовой справочник (карточка, представление)?".  
3. Создайте пункт меню для справочника  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/menuItem-dict.png)  
4. Добавьте параметры в справочник  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict.png)  
5. Создайте атрибут класса "status" в классе "task"  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/task-dict.png)  
6. Откройте макет действия и добавьте поле  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/dict-field.png)  
7. Добавьте столбец в запрос  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/query-dict.png)  
8. Соберите проект и обновите страницу браузера  
![alt tag](https://raw.github.com/objectum/todo/master/resources/images/todo-dict.png)  

<a name="table"/>
### Табличная часть  
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
