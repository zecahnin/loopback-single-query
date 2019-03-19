'use strict';

const _ = require('lodash');

module.exports = class MysqlConnector {

  /**
   * @param {Object} config
   * @returns {String}
   */
  static jsonObject(config) {
    const fields = _.map(config.fields, field => `'${field.alias}', ${field.field}`);
    return _.template(`JSON_OBJECT(${fields.join(', ')}) AS data`)(fields);
  }

  /**
   * @param {Object} config
   * @returns {String}
   */
  static jsonArray(config) {
    const fields = _.map(config.fields, field => `'${field.alias}', ${field.field}`);
    return _.template(`JSON_ARRAYAGG(JSON_OBJECT(${fields.join(', ')})) AS data`)(fields);
  }

  /**
   * @param {Object} config
   * @returns {String}
   */
  static getLike({where, fieldName, dbFieldName, rootAlias}) {
    if (where[fieldName].like instanceof RegExp) {
      return `_${rootAlias}.${dbFieldName} RLIKE '${where[dbFieldName].like}'`;
    } else {
      if (where[fieldName].options === 'i') {
        return `_${rootAlias}.${dbFieldName} LIKE '${where[dbFieldName].like}'`;
      } else {
        return `_${rootAlias}.${dbFieldName} LIKE BINARY '${where[dbFieldName].like}'`;
      }
    }
  }

  /**
   * @param {Object} config
   * @returns {String}
   */
  static getNotLike({where, fieldName, dbFieldName, rootAlias}) {
    if (where[fieldName].nlike instanceof RegExp) {
      return `_${rootAlias}.${dbFieldName} NOT RLIKE '${where[dbFieldName].nlike}'`;
    } else {
      if (where[fieldName].options === 'i') {
        return `_${rootAlias}.${dbFieldName} NOT LIKE '${where[dbFieldName].nlike}'`;
      } else {
        return `_${rootAlias}.${dbFieldName} NOT LIKE BINARY '${where[dbFieldName].nlike}'`;
      }
    }
  }
};
