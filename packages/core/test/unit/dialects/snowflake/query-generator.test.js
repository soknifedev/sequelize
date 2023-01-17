'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../../support');

const dialect = Support.getTestDialect();
const _ = require('lodash');
const { Op, IndexHints } = require('@sequelize/core');
const { SnowflakeQueryGenerator: QueryGenerator } = require('@sequelize/core/_non-semver-use-at-your-own-risk_/dialects/snowflake/query-generator.js');
const { createSequelizeInstance } = require('../../../support');

if (dialect === 'snowflake') {
  describe('[SNOWFLAKE Specific] QueryGenerator', () => {
    const suites = {
      attributesToSQL: [
        {
          arguments: [{ id: 'INTEGER' }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: 'INTEGER', foo: 'VARCHAR(255)' }],
          expectation: { id: 'INTEGER', foo: 'VARCHAR(255)' },
        },
        {
          arguments: [{ id: { type: 'INTEGER' } }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false } }],
          expectation: { id: 'INTEGER NOT NULL' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: true } }],
          expectation: { id: 'INTEGER' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', primaryKey: true, autoIncrement: true } }],
          expectation: { id: 'INTEGER AUTOINCREMENT PRIMARY KEY' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', defaultValue: 0 } }],
          expectation: { id: 'INTEGER DEFAULT 0' },
        },
        {
          title: 'Add column level comment',
          arguments: [{ id: { type: 'INTEGER', comment: 'Test' } }],
          expectation: { id: 'INTEGER COMMENT \'Test\'' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', unique: true } }],
          expectation: { id: 'INTEGER UNIQUE' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', after: 'Bar' } }],
          expectation: { id: 'INTEGER AFTER "Bar"' },
        },
        // No Default Values allowed for certain types
        {
          title: 'No Default value for SNOWFLAKE BLOB allowed',
          arguments: [{ id: { type: 'BLOB', defaultValue: [] } }],
          expectation: { id: 'BLOB' },
        },
        {
          title: 'No Default value for SNOWFLAKE TEXT allowed',
          arguments: [{ id: { type: 'TEXT', defaultValue: [] } }],
          expectation: { id: 'TEXT' },
        },
        {
          title: 'No Default value for SNOWFLAKE GEOMETRY allowed',
          arguments: [{ id: { type: 'GEOMETRY', defaultValue: [] } }],
          expectation: { id: 'GEOMETRY' },
        },
        {
          title: 'No Default value for SNOWFLAKE JSON allowed',
          arguments: [{ id: { type: 'JSON', defaultValue: [] } }],
          expectation: { id: 'JSON' },
        },
        // New references style
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id")' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("pk")' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON DELETE CASCADE' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES "Bar" ("id") ON UPDATE RESTRICT' },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, autoIncrement: true, defaultValue: 1, references: { table: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES "Bar" ("id") ON DELETE CASCADE ON UPDATE RESTRICT' },
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id)' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar', key: 'pk' } } }],
          expectation: { id: 'INTEGER REFERENCES Bar (pk)' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onDelete: 'CASCADE' } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON DELETE CASCADE' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ id: { type: 'INTEGER', references: { table: 'Bar' }, onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER REFERENCES Bar (id) ON UPDATE RESTRICT' },
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: [{ id: { type: 'INTEGER', allowNull: false, autoIncrement: true, defaultValue: 1, references: { table: 'Bar' }, onDelete: 'CASCADE', onUpdate: 'RESTRICT' } }],
          expectation: { id: 'INTEGER NOT NULL AUTOINCREMENT DEFAULT 1 REFERENCES Bar (id) ON DELETE CASCADE ON UPDATE RESTRICT' },
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      createTableQuery: [
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
        },
        {
          arguments: ['myTable', { data: 'BLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" BLOB);',
        },
        {
          arguments: ['myTable', { data: 'LONGBLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("data" LONGBLOB);',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255));',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
        },
        {
          arguments: ['myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" ENUM("A", "B", "C"), "name" VARCHAR(255)) DEFAULT CHARSET=latin1;',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255)) ROW_FORMAT=default;',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "id" INTEGER , PRIMARY KEY ("id"));',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION' }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), "otherId" INTEGER, FOREIGN KEY ("otherId") REFERENCES "otherTable" ("id") ON DELETE CASCADE ON UPDATE NO ACTION);',
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'] }] }],
          expectation: 'CREATE TABLE IF NOT EXISTS "myTable" ("title" VARCHAR(255), "name" VARCHAR(255), UNIQUE "uniq_myTable_title_name" ("title", "name"));',
        },
        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { data: 'BLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (data BLOB);',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { data: 'LONGBLOB' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (data LONGBLOB);',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255));',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'utf8', collate: 'utf8_unicode_ci' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255)) DEFAULT CHARSET=utf8 COLLATE utf8_unicode_ci;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255)) DEFAULT CHARSET=latin1;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'ENUM("A", "B", "C")', name: 'VARCHAR(255)' }, { charset: 'latin1' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title ENUM("A", "B", "C"), name VARCHAR(255)) DEFAULT CHARSET=latin1;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { rowFormat: 'default' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255)) ROW_FORMAT=default;',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', id: 'INTEGER PRIMARY KEY' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), id INTEGER , PRIMARY KEY (id));',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)', otherId: 'INTEGER REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION' }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), otherId INTEGER, FOREIGN KEY (otherId) REFERENCES otherTable (id) ON DELETE CASCADE ON UPDATE NO ACTION);',
          context: { options: { quoteIdentifiers: false } },
        },
        {
          arguments: ['myTable', { title: 'VARCHAR(255)', name: 'VARCHAR(255)' }, { uniqueKeys: [{ fields: ['title', 'name'] }] }],
          expectation: 'CREATE TABLE IF NOT EXISTS myTable (title VARCHAR(255), name VARCHAR(255), UNIQUE uniq_myTable_title_name (title, name));',
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      tableExistsQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA = CURRENT_SCHEMA() AND TABLE_NAME = \'myTable\';',
        },
        {
          arguments: [{ tableName: 'myTable', schema: 'mySchema' }],
          expectation: 'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = \'BASE TABLE\' AND TABLE_SCHEMA = \'mySchema\' AND TABLE_NAME = \'myTable\';',
        },
      ],

      selectQuery: [
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT "id", "name" FROM "myTable";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."id" = 2;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."name" = \'foo\';',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: { name: 'foo\';DROP TABLE myTable;' } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."name" = \'foo\'\';DROP TABLE myTable;\';',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { where: 2 }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."id" = 2;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "id", "DESC";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { order: [['id', 'DESC']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC;',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          arguments: ['myTable', { order: [['id', 'DESC'], ['name']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM "myTable" AS "myTable" ORDER BY "myTable"."id" DESC, "myTable"."name";',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function (sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']],
            };
          }],
          expectation: 'SELECT * FROM "myTable" ORDER BY f1(f2("id")) DESC;',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'functions can take all types as arguments',
          arguments: ['myTable', function (sequelize) {
            return {
              order: [
                [sequelize.fn('f1', sequelize.col('myTable.id')), 'DESC'],
                [sequelize.fn('f2', 12, 'lalala', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))), 'ASC'],
              ],
            };
          }],
          expectation: `SELECT * FROM "myTable" ORDER BY f1("myTable"."id") DESC, f2(12, 'lalala', '2011-03-27 10:01:55.000') ASC;`,
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'sequelize.where with .fn as attribute and default comparator',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'jan'),
                { type: 1 },
              ),
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") = \'jan\' AND "myTable"."type" = 1);',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'sequelize.where with .fn as attribute and LIKE comparator',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'LIKE', '%t%'),
                { type: 1 },
              ),
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE (LOWER("user"."name") LIKE \'%t%\' AND "myTable"."type" = 1);',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name";',
          context: QueryGenerator,
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
            };
          }],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt");',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
            };
          }],
          expectation: 'SELECT * FROM "myTable" GROUP BY YEAR("createdAt"), "title";',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM "myTable" GROUP BY "name" ORDER BY "id" DESC;',
          context: QueryGenerator,
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { in: ... }',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                { archived: null },
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { [Op.in]: ['Lost', 'Found'] }),
              ),
            };
          }],
          expectation: 'SELECT * FROM "myTable" WHERE ("myTable"."archived" IS NULL AND COALESCE("place_type_codename", "announcement_type_codename") IN (\'Lost\', \'Found\'));',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          arguments: ['myTable', { limit: 10 }],
          expectation: 'SELECT * FROM "myTable" LIMIT 10;',
          context: QueryGenerator,
        }, {
          arguments: ['myTable', { limit: 10, offset: 2 }],
          expectation: 'SELECT * FROM "myTable" LIMIT 10 OFFSET 2;',
          context: QueryGenerator,
        }, {
          title: 'uses default limit if only offset is specified',
          arguments: ['myTable', { offset: 2 }],
          expectation: 'SELECT * FROM "myTable" LIMIT NULL OFFSET 2;',
          context: QueryGenerator,
        }, {
          title: 'uses limit 0',
          arguments: ['myTable', { limit: 0 }],
          expectation: 'SELECT * FROM "myTable" LIMIT 0;',
          context: QueryGenerator,
        }, {
          title: 'uses offset 0',
          arguments: ['myTable', { offset: 0 }],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
        }, {
          title: 'multiple where arguments',
          arguments: ['myTable', { where: { boat: 'canoe', weather: 'cold' } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."boat" = \'canoe\' AND "myTable"."weather" = \'cold\';',
          context: QueryGenerator,
        }, {
          title: 'no where arguments (object)',
          arguments: ['myTable', { where: {} }],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
        }, {
          title: 'no where arguments (string)',
          arguments: ['myTable', { where: [''] }],
          expectation: 'SELECT * FROM "myTable" WHERE 1=1;',
          context: QueryGenerator,
        }, {
          title: 'no where arguments (null)',
          arguments: ['myTable', { where: null }],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', { where: { field: Buffer.from('Sequelize') } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" = X\'53657175656c697a65\';',
          context: QueryGenerator,
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', { where: { field: { [Op.ne]: 0 } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" != 0;',
          context: QueryGenerator,
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', { where: { field: { [Op.ne]: null } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" IS NOT NULL;',
          context: QueryGenerator,
        }, {
          title: 'use IS NOT if not === BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: true } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" IS NOT true;',
          context: QueryGenerator,
        }, {
          title: 'use != if not !== BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: 3 } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" != 3;',
          context: QueryGenerator,
        }, {
          title: 'Regular Expression in where clause',
          arguments: ['myTable', { where: { field: { [Op.regexp]: '^[h|a|t]' } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" REGEXP \'^[h|a|t]\';',
          context: QueryGenerator,
        }, {
          title: 'Regular Expression negation in where clause',
          arguments: ['myTable', { where: { field: { [Op.notRegexp]: '^[h|a|t]' } } }],
          expectation: 'SELECT * FROM "myTable" WHERE "myTable"."field" NOT REGEXP \'^[h|a|t]\';',
          context: QueryGenerator,
        }, {
          title: 'Empty having',
          arguments: ['myTable', function () {
            return {
              having: {},
            };
          }],
          expectation: 'SELECT * FROM "myTable";',
          context: QueryGenerator,
          needsSequelize: true,
        }, {
          title: 'Having in subquery',
          arguments: ['myTable', function () {
            return {
              subQuery: true,
              tableAs: 'test',
              having: { creationYear: { [Op.gt]: 2002 } },
            };
          }],
          expectation: 'SELECT "test".* FROM (SELECT * FROM "myTable" AS "test" HAVING "creationYear" > 2002) AS "test";',
          context: QueryGenerator,
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable'],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { attributes: ['id', 'name'] }],
          expectation: 'SELECT id, name FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { where: { id: 2 } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.id = 2;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { where: { name: 'foo' } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.name = \'foo\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { where: { name: 'foo\';DROP TABLE myTable;' } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.name = \'foo\'\';DROP TABLE myTable;\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { where: 2 }],
          expectation: 'SELECT * FROM myTable WHERE myTable.id = 2;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { order: ['id'] }],
          expectation: 'SELECT * FROM myTable ORDER BY id;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { order: ['id', 'DESC'] }],
          expectation: 'SELECT * FROM myTable ORDER BY id, DESC;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { order: ['myTable.id'] }],
          expectation: 'SELECT * FROM myTable ORDER BY myTable.id;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { order: [['myTable.id', 'DESC']] }],
          expectation: 'SELECT * FROM myTable ORDER BY myTable.id DESC;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { order: [['id', 'DESC']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM myTable AS myTable ORDER BY myTable.id DESC;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          arguments: ['myTable', { order: [['id', 'DESC'], ['name']] }, function (sequelize) {
            return sequelize.define('myTable', {});
          }],
          expectation: 'SELECT * FROM myTable AS myTable ORDER BY myTable.id DESC, myTable.name;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'functions can take functions as arguments',
          arguments: ['myTable', function (sequelize) {
            return {
              order: [[sequelize.fn('f1', sequelize.fn('f2', sequelize.col('id'))), 'DESC']],
            };
          }],
          expectation: 'SELECT * FROM myTable ORDER BY f1(f2(id)) DESC;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'functions can take all types as arguments',
          arguments: ['myTable', function (sequelize) {
            return {
              order: [
                [sequelize.fn('f1', sequelize.col('myTable.id')), 'DESC'],
                [sequelize.fn('f2', 12, 'lalala', new Date(Date.UTC(2011, 2, 27, 10, 1, 55))), 'ASC'],
              ],
            };
          }],
          expectation: `SELECT * FROM myTable ORDER BY f1(myTable.id) DESC, f2(12, 'lalala', '2011-03-27 10:01:55.000') ASC;`,
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'sequelize.where with .fn as attribute and default comparator',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'jan'),
                { type: 1 },
              ),
            };
          }],
          expectation: 'SELECT * FROM myTable WHERE (LOWER(user.name) = \'jan\' AND myTable.type = 1);',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'sequelize.where with .fn as attribute and LIKE comparator',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                sequelize.where(sequelize.fn('LOWER', sequelize.col('user.name')), 'LIKE', '%t%'),
                { type: 1 },
              ),
            };
          }],
          expectation: 'SELECT * FROM myTable WHERE (LOWER(user.name) LIKE \'%t%\' AND myTable.type = 1);',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'single string argument should be quoted',
          arguments: ['myTable', { group: 'name' }],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { group: ['name'] }],
          expectation: 'SELECT * FROM myTable GROUP BY name;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'functions work for group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt'))],
            };
          }],
          expectation: 'SELECT * FROM myTable GROUP BY YEAR(createdAt);',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'It is possible to mix sequelize.fn and string arguments to group by',
          arguments: ['myTable', function (sequelize) {
            return {
              group: [sequelize.fn('YEAR', sequelize.col('createdAt')), 'title'],
            };
          }],
          expectation: 'SELECT * FROM myTable GROUP BY YEAR(createdAt), title;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          arguments: ['myTable', { group: 'name', order: [['id', 'DESC']] }],
          expectation: 'SELECT * FROM myTable GROUP BY name ORDER BY id DESC;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'Combination of sequelize.fn, sequelize.col and { in: ... }',
          arguments: ['myTable', function (sequelize) {
            return {
              where: sequelize.and(
                { archived: null },
                sequelize.where(sequelize.fn('COALESCE', sequelize.col('place_type_codename'), sequelize.col('announcement_type_codename')), { [Op.in]: ['Lost', 'Found'] }),
              ),
            };
          }],
          expectation: 'SELECT * FROM myTable WHERE (myTable.archived IS NULL AND COALESCE(place_type_codename, announcement_type_codename) IN (\'Lost\', \'Found\'));',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          arguments: ['myTable', { limit: 10 }],
          expectation: 'SELECT * FROM myTable LIMIT 10;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { limit: 10, offset: 2 }],
          expectation: 'SELECT * FROM myTable LIMIT 10 OFFSET 2;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'uses default limit if only offset is specified',
          arguments: ['myTable', { offset: 2 }],
          expectation: 'SELECT * FROM myTable LIMIT NULL OFFSET 2;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'uses limit 0',
          arguments: ['myTable', { limit: 0 }],
          expectation: 'SELECT * FROM myTable LIMIT 0;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'uses offset 0',
          arguments: ['myTable', { offset: 0 }],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'multiple where arguments',
          arguments: ['myTable', { where: { boat: 'canoe', weather: 'cold' } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.boat = \'canoe\' AND myTable.weather = \'cold\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'no where arguments (object)',
          arguments: ['myTable', { where: {} }],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'no where arguments (string)',
          arguments: ['myTable', { where: [''] }],
          expectation: 'SELECT * FROM myTable WHERE 1=1;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'no where arguments (null)',
          arguments: ['myTable', { where: null }],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'buffer as where argument',
          arguments: ['myTable', { where: { field: Buffer.from('Sequelize') } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field = X\'53657175656c697a65\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'use != if ne !== null',
          arguments: ['myTable', { where: { field: { [Op.ne]: 0 } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field != 0;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'use IS NOT if ne === null',
          arguments: ['myTable', { where: { field: { [Op.ne]: null } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field IS NOT NULL;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'use IS NOT if not === BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: true } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field IS NOT true;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'use != if not !== BOOLEAN',
          arguments: ['myTable', { where: { field: { [Op.not]: 3 } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field != 3;',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'Regular Expression in where clause',
          arguments: ['myTable', { where: { field: { [Op.regexp]: '^[h|a|t]' } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field REGEXP \'^[h|a|t]\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'Regular Expression negation in where clause',
          arguments: ['myTable', { where: { field: { [Op.notRegexp]: '^[h|a|t]' } } }],
          expectation: 'SELECT * FROM myTable WHERE myTable.field NOT REGEXP \'^[h|a|t]\';',
          context: { options: { quoteIdentifiers: false } },
        }, {
          title: 'Empty having',
          arguments: ['myTable', function () {
            return {
              having: {},
            };
          }],
          expectation: 'SELECT * FROM myTable;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        }, {
          title: 'Having in subquery',
          arguments: ['myTable', function () {
            return {
              subQuery: true,
              tableAs: 'test',
              having: { creationYear: { [Op.gt]: 2002 } },
            };
          }],
          expectation: 'SELECT test.* FROM (SELECT * FROM myTable AS test HAVING creationYear > 2002) AS test;',
          context: { options: { quoteIdentifiers: false } },
          needsSequelize: true,
        },
      ],

      insertQuery: [
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
        }, {
          arguments: ['myTable', { name: 'foo\';DROP TABLE myTable;' }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name") VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo\';DROP TABLE myTable;' },
          },
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","birthday") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) },
          },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
        }, {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO "myTable" ("data") VALUES ($sequelize_1);',
            bind: { sequelize_1: Buffer.from('Sequelize') },
          },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo","nullValue") VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { omitNull: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO "myTable" ("name","foo") VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true } },
        }, {
          arguments: ['myTable', { foo: false }],
          expectation: {
            query: 'INSERT INTO "myTable" ("foo") VALUES ($sequelize_1);',
            bind: { sequelize_1: false },
          },
        }, {
          arguments: ['myTable', { foo: true }],
          expectation: {
            query: 'INSERT INTO "myTable" ("foo") VALUES ($sequelize_1);',
            bind: { sequelize_1: true },
          },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              foo: sequelize.fn('NOW'),
            };
          }],
          expectation: {
            query: 'INSERT INTO "myTable" ("foo") VALUES (NOW());',
            bind: {},
          },
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { name: 'foo' }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo\';DROP TABLE myTable;' }],
          expectation: {
            query: 'INSERT INTO myTable (name) VALUES ($sequelize_1);',
            bind: { sequelize_1: 'foo\';DROP TABLE myTable;' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }],
          expectation: {
            query: 'INSERT INTO myTable (name,birthday) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1 }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { data: Buffer.from('Sequelize') }],
          expectation: {
            query: 'INSERT INTO myTable (data) VALUES ($sequelize_1);',
            bind: { sequelize_1: Buffer.from('Sequelize') },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo,nullValue) VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo,nullValue) VALUES ($sequelize_1,$sequelize_2,$sequelize_3);',
            bind: { sequelize_1: 'foo', sequelize_2: 1, sequelize_3: null },
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: null }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo', foo: 1, nullValue: undefined }],
          expectation: {
            query: 'INSERT INTO myTable (name,foo) VALUES ($sequelize_1,$sequelize_2);',
            bind: { sequelize_1: 'foo', sequelize_2: 1 },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { foo: false }],
          expectation: {
            query: 'INSERT INTO myTable (foo) VALUES ($sequelize_1);',
            bind: { sequelize_1: false },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { foo: true }],
          expectation: {
            query: 'INSERT INTO myTable (foo) VALUES ($sequelize_1);',
            bind: { sequelize_1: true },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              foo: sequelize.fn('NOW'),
            };
          }],
          expectation: {
            query: 'INSERT INTO myTable (foo) VALUES (NOW());',
            bind: {},
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      bulkInsertQuery: [
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: 'INSERT INTO "myTable" ("name") VALUES (\'foo\'),(\'bar\');',
        }, {
          arguments: ['myTable', [{ name: 'foo\';DROP TABLE myTable;' }, { name: 'bar' }]],
          expectation: 'INSERT INTO "myTable" ("name") VALUES (\'foo\'\';DROP TABLE myTable;\'),(\'bar\');',
        }, {
          arguments: ['myTable', [{ name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) }]],
          expectation: `INSERT INTO "myTable" ("name","birthday") VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');`,
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1 }, { name: 'bar', foo: 2 }]],
          expectation: 'INSERT INTO "myTable" ("name","foo") VALUES (\'foo\',1),(\'bar\',2);',
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: 'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',NULL,NULL);',
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: 'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: 'INSERT INTO "myTable" ("name","foo","nullValue") VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: true } }, // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: undefined }, { name: 'bar', foo: 2, undefinedValue: undefined }]],
          expectation: 'INSERT INTO "myTable" ("name","foo","nullValue","undefinedValue") VALUES (\'foo\',1,NULL,NULL),(\'bar\',2,NULL,NULL);',
          context: { options: { omitNull: true } }, // Note: As above
        }, {
          arguments: ['myTable', [{ name: 'foo', value: true }, { name: 'bar', value: false }]],
          expectation: 'INSERT INTO "myTable" ("name","value") VALUES (\'foo\',true),(\'bar\',false);',
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: 'INSERT IGNORE INTO "myTable" ("name") VALUES (\'foo\'),(\'bar\');',
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }]],
          expectation: 'INSERT INTO myTable (name) VALUES (\'foo\'),(\'bar\');',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo\';DROP TABLE myTable;' }, { name: 'bar' }]],
          expectation: 'INSERT INTO myTable (name) VALUES (\'foo\'\';DROP TABLE myTable;\'),(\'bar\');',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { name: 'bar', birthday: new Date(Date.UTC(2012, 2, 27, 10, 1, 55)) }]],
          expectation: `INSERT INTO myTable (name,birthday) VALUES ('foo','2011-03-27 10:01:55.000'),('bar','2012-03-27 10:01:55.000');`,
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1 }, { name: 'bar', foo: 2 }]],
          expectation: 'INSERT INTO myTable (name,foo) VALUES (\'foo\',1),(\'bar\',2);',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', nullValue: null }]],
          expectation: 'INSERT INTO myTable (name,foo,nullValue) VALUES (\'foo\',1,NULL),(\'bar\',NULL,NULL);',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: 'INSERT INTO myTable (name,foo,nullValue) VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: null }, { name: 'bar', foo: 2, nullValue: null }]],
          expectation: 'INSERT INTO myTable (name,foo,nullValue) VALUES (\'foo\',1,NULL),(\'bar\',2,NULL);',
          context: { options: { omitNull: true, quoteIdentifiers: false } }, // Note: We don't honour this because it makes little sense when some rows may have nulls and others not
        }, {
          arguments: ['myTable', [{ name: 'foo', foo: 1, nullValue: undefined }, { name: 'bar', foo: 2, undefinedValue: undefined }]],
          expectation: 'INSERT INTO myTable (name,foo,nullValue,undefinedValue) VALUES (\'foo\',1,NULL,NULL),(\'bar\',2,NULL,NULL);',
          context: { options: { omitNull: true, quoteIdentifiers: false } }, // Note: As above
        }, {
          arguments: ['myTable', [{ name: 'foo', value: true }, { name: 'bar', value: false }]],
          expectation: 'INSERT INTO myTable (name,value) VALUES (\'foo\',true),(\'bar\',false);',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', [{ name: 'foo' }, { name: 'bar' }], { ignoreDuplicates: true }],
          expectation: 'INSERT IGNORE INTO myTable (name) VALUES (\'foo\'),(\'bar\');',
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      updateQuery: [
        {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$sequelize_1,"birthday"=$sequelize_2 WHERE "id" = $sequelize_3',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), sequelize_3: 2 },
          },

        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$sequelize_1,"birthday"=$sequelize_2 WHERE "id" = $sequelize_3',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), sequelize_3: 2 },
          },
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
        }, {
          arguments: ['myTable', { name: 'foo\';DROP TABLE myTable;' }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "name"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 'foo\';DROP TABLE myTable;', sequelize_2: 'foo' },
          },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1,"nullValue"=$sequelize_2 WHERE "name" = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1,"nullValue"=$sequelize_2 WHERE "name" = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { omitNull: false } },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true } },
        }, {
          arguments: ['myTable', { bar: false }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: false, sequelize_2: 'foo' },
          },
        }, {
          arguments: ['myTable', { bar: true }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=$sequelize_1 WHERE "name" = $sequelize_2',
            bind: { sequelize_1: true, sequelize_2: 'foo' },
          },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.fn('NOW'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"=NOW() WHERE "name" = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.col('foo'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE "myTable" SET "bar"="foo" WHERE "name" = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE myTable SET name=$sequelize_1,birthday=$sequelize_2 WHERE id = $sequelize_3',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), sequelize_3: 2 },
          },
          context: { options: { quoteIdentifiers: false } },

        }, {
          arguments: ['myTable', { name: 'foo', birthday: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)) }, { id: 2 }],
          expectation: {
            query: 'UPDATE myTable SET name=$sequelize_1,birthday=$sequelize_2 WHERE id = $sequelize_3',
            bind: { sequelize_1: 'foo', sequelize_2: new Date(Date.UTC(2011, 2, 27, 10, 1, 55)), sequelize_3: 2 },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: 2 }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 2, sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { name: 'foo\';DROP TABLE myTable;' }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET name=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 'foo\';DROP TABLE myTable;', sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1,nullValue=$sequelize_2 WHERE name = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1,nullValue=$sequelize_2 WHERE name = $sequelize_3',
            bind: { sequelize_1: 2, sequelize_2: null, sequelize_3: 'foo' },
          },
          context: { options: { omitNull: false, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: 2, nullValue: null }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: 2,  sequelize_2: 'foo' },
          },
          context: { options: { omitNull: true, quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: false }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: false, sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', { bar: true }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=$sequelize_1 WHERE name = $sequelize_2',
            bind: { sequelize_1: true, sequelize_2: 'foo' },
          },
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.fn('NOW'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=NOW() WHERE name = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: ['myTable', function (sequelize) {
            return {
              bar: sequelize.col('foo'),
            };
          }, { name: 'foo' }],
          expectation: {
            query: 'UPDATE myTable SET bar=foo WHERE name = $sequelize_1',
            bind: { sequelize_1: 'foo' },
          },
          needsSequelize: true,
          context: { options: { quoteIdentifiers: false } },
        },
      ],

      getForeignKeyQuery: [
        {
          arguments: ['User', 'email'],
          expectation: 'SELECT CONSTRAINT_NAME as constraint_name,CONSTRAINT_NAME as constraintName,CONSTRAINT_SCHEMA as constraintSchema,CONSTRAINT_SCHEMA as constraintCatalog,TABLE_NAME as tableName,TABLE_SCHEMA as tableSchema,TABLE_SCHEMA as tableCatalog,COLUMN_NAME as columnName,REFERENCED_TABLE_SCHEMA as referencedTableSchema,REFERENCED_TABLE_SCHEMA as referencedTableCatalog,REFERENCED_TABLE_NAME as referencedTableName,REFERENCED_COLUMN_NAME as referencedColumnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE (REFERENCED_TABLE_NAME = \'User\' AND REFERENCED_COLUMN_NAME = \'email\') OR (TABLE_NAME = \'User\' AND COLUMN_NAME = \'email\' AND REFERENCED_TABLE_NAME IS NOT NULL)',
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: ['User', 'email'],
          expectation: 'SELECT CONSTRAINT_NAME as constraint_name,CONSTRAINT_NAME as constraintName,CONSTRAINT_SCHEMA as constraintSchema,CONSTRAINT_SCHEMA as constraintCatalog,TABLE_NAME as tableName,TABLE_SCHEMA as tableSchema,TABLE_SCHEMA as tableCatalog,COLUMN_NAME as columnName,REFERENCED_TABLE_SCHEMA as referencedTableSchema,REFERENCED_TABLE_SCHEMA as referencedTableCatalog,REFERENCED_TABLE_NAME as referencedTableName,REFERENCED_COLUMN_NAME as referencedColumnName FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE (REFERENCED_TABLE_NAME = \'User\' AND REFERENCED_COLUMN_NAME = \'email\') OR (TABLE_NAME = \'User\' AND COLUMN_NAME = \'email\' AND REFERENCED_TABLE_NAME IS NOT NULL)',
          context: { options: { quoteIdentifiers: false } },

        },
      ],

      selectFromTableFragment: [
        {
          arguments: [{}, null, ['*'], '"Project"'],
          expectation: 'SELECT * FROM "Project"',
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '"Project"',
          ],
          expectation: 'SELECT * FROM "Project" USE INDEX ("index_project_on_name")',
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.FORCE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '"Project"',
          ],
          expectation: 'SELECT * FROM "Project" FORCE INDEX ("index_project_on_name")',
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.IGNORE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '"Project"',
          ],
          expectation: 'SELECT * FROM "Project" IGNORE INDEX ("index_project_on_name")',
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name', 'index_project_on_name_and_foo'] }] },
            null,
            ['*'],
            '"Project"',
          ],
          expectation: 'SELECT * FROM "Project" USE INDEX ("index_project_on_name","index_project_on_name_and_foo")',
        }, {
          arguments: [
            { indexHints: [{ type: 'FOO', values: ['index_project_on_name'] }] },
            null,
            ['*'],
            '"Project"',
          ],
          expectation: 'SELECT * FROM "Project"',
        },

        // Variants when quoteIdentifiers is false
        {
          arguments: [{}, null, ['*'], 'Project'],
          expectation: 'SELECT * FROM Project',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            'Project',
          ],
          expectation: 'SELECT * FROM Project USE INDEX (index_project_on_name)',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.FORCE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            'Project',
          ],
          expectation: 'SELECT * FROM Project FORCE INDEX (index_project_on_name)',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.IGNORE, values: ['index_project_on_name'] }] },
            null,
            ['*'],
            'Project',
          ],
          expectation: 'SELECT * FROM Project IGNORE INDEX (index_project_on_name)',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: [
            { indexHints: [{ type: IndexHints.USE, values: ['index_project_on_name', 'index_project_on_name_and_foo'] }] },
            null,
            ['*'],
            'Project',
          ],
          expectation: 'SELECT * FROM Project USE INDEX (index_project_on_name,index_project_on_name_and_foo)',
          context: { options: { quoteIdentifiers: false } },
        }, {
          arguments: [
            { indexHints: [{ type: 'FOO', values: ['index_project_on_name'] }] },
            null,
            ['*'],
            'Project',
          ],
          expectation: 'SELECT * FROM Project',
          context: { options: { quoteIdentifiers: false } },
        },
      ],
    };

    _.each(suites, (tests, suiteTitle) => {
      describe(suiteTitle, () => {
        for (const test of tests) {
          const query = test.expectation.query || test.expectation;
          const title = test.title || `SNOWFLAKE correctly returns ${query} for ${JSON.stringify(test.arguments)}`;
          it(title, () => {
            const sequelize = createSequelizeInstance({
              ...test.context && test.context.options,
            });

            if (test.needsSequelize) {
              if (typeof test.arguments[1] === 'function') {
                test.arguments[1] = test.arguments[1](sequelize);
              }

              if (typeof test.arguments[2] === 'function') {
                test.arguments[2] = test.arguments[2](sequelize);
              }
            }

            const queryGenerator = sequelize.dialect.queryGenerator;

            const conditions = queryGenerator[suiteTitle](...test.arguments);
            expect(conditions).to.deep.equal(test.expectation);
          });
        }
      });
    });
  });
}