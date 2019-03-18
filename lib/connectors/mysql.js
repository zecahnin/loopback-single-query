'use strict';

function getLike(where, fieldName, dbFieldName, rootAlias) {
  if (where[fieldName].like instanceof RegExp) {
    return `REGEXP_LIKE(_${rootAlias}.${dbFieldName}, '${where[dbFieldName].like})'`;
  } else {
    if (where[fieldName].options === 'i') {
      return `_${rootAlias}.${dbFieldName} LIKE BINARY '${where[dbFieldName].like}'`;
    } else {
      return `_${rootAlias}.${dbFieldName} LIKE '${where[dbFieldName].like}'`;
    }
  }
}

module.exports = {
  getLike
};