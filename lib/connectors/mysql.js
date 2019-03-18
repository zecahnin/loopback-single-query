'use strict';

function getLike(Model, where, fieldName, dbFieldName, rootAlias) {
  const dataSourceName = Model.getDataSource().name;
  if (where[fieldName].like instanceof RegExp) {
    switch (dataSourceName) {
      case 'mysql':
        return `REGEXP_LIKE(_${rootAlias}.${dbFieldName}, '${where[dbFieldName].like})'`;
      default:
        throw new Error(`Unsupported Loopback Filter from ${dataSourceName} connector`);      
    }
  } else {
    switch (dataSourceName) {
      case 'mysql':
        if (where[fieldName].options === 'i') {
          return `_${rootAlias}.${dbFieldName} LIKE BINARY '${where[dbFieldName].like}'`;
        } else {
          return `_${rootAlias}.${dbFieldName} LIKE '${where[dbFieldName].like}'`;
        }
      default:
        throw new Error(`Unsupported Loopback Filter from ${dataSourceName} connector`);      
    }
  }
}

module.exports = {
  getLike
};