# loopback-single-query
The **[loopback-connector-juggler](https://github.com/strongloop/loopback-datasource-juggler)** is a fantastic ORM/ODM that perfectly meets all database query needs. However, when we work with relational databases and include many relationships in the root filter object or its scope, we notice a very large loss of performance.

The **loopback-single-query** creates a single SQL query from the [Loopback Filters](https://loopback.io/doc/en/lb2/Querying-data.html) to solve these cases. By optimizing tables and relationships in your database, performance gains can achieve impressive results.

## Supported

This library was tested with Loopback version 2.39.0 and MySQL 5.7.25. Contributions are welcome.

## Usage

Install:

```
npm install loopback-single-query
```

On need:

```
const filter = {
  "include": [
    {"relation": "relation1"},
    {"relation": "relation2"},
    {"relation": "relation3"},
    {"relation": "relation4"},
    {
      "relation": "relation5",
      "scope": {
        "include": [
          {
            "relation": "subrelation1",
            "scope": {
              ...
            }
          },
          ...
        ]
      }
  "fields": {
    "id": true,
    "title": true
  }
  "where": {
    "and": [
      {"title": {"like": "%Term%"}},
      {"type": {"inq": [1, 3]}},
      {"description": null},
      {"id": {
        "and": [
          {"neq": 100},
          {"gte": 1000}
        ]
      }
    ]
  },
  "order": ["title ASC", "created DESC"],
  "limit": 1,
  "skip": 10,
  
};

const app = require('server/server');
const SingleQuery = require('loopback-single-query');

// Promise
const ps = SingleQuery.find(app.models.Model, filter);
ps.then(console.log);
ps.catch(console.error);

// OR

// Callback
SingleQuery.find(app.models.Model, filter, (err, data) => {
  if (err) return console.error(err);
  console.log(data);
});
```

## Debug

You can analyze everything the **loopback-single-query** is doing in the background as with [debug](https://github.com/visionmedia/debug) as follows:

```
DEBUG=single-query* node .
```

Debug strings reference

| Module / Source file | String |
| ------- | --------------- |
| lib/single-query.js | single-query |
| lib/query-builder.js | single-query:query-builder |
| lib/parse-to-model.js | single-query:parse-to-model |