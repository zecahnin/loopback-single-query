'use strict';

const _ = require('lodash');
const {convertToArray} = require('./utils');
const debug = require('debug')('single-query:query-builder');
const Connector = require('./connectors');
const moment = require('moment');

module.exports = class ObjetoAprendizagemNativeQueryBuilder {

  /**
   * SQL Query Builder based on Loopback Filter.
   *
   * @param {Object} Model
   * @param {Object} filter
   * @param {Object=} options
   */
  createQueryByFilter(Model, filter, options = {}) {
    options.alias = options.alias || 0;
    const rootAlias = options.alias;
    
    const tableName = this._getTableName(Model);
    
    const where = _.compact([
      options.subWhere, 
      this._getWhere(Model, filter.where, rootAlias)
    ]).join(' AND ');

    const config = {
      tableName, where,
      tableAlias: `_${rootAlias}`,
      join: options.join,
      limit: this._getLimitAndSkip(filter),
      order: this._getOrder(filter),
    };

    config.fields = this._getFields(Model, filter.fields);
    config.fields = _.union(
      this._fieldsForQuery(config),
      this._includeSubQuery(Model, filter, options, rootAlias)
    );

    if (options.multiple) {
      debug('QueryArray: ', JSON.parse(JSON.stringify(config)));
      return this._queryArray(Model, config);
    }

    debug('QueryObject: ', JSON.parse(JSON.stringify(config)));
    return this._queryObject(Model, config);
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _getTableName(Model) {
    const dataSourceName = Model.getDataSource().name;
    if (_.includes(Object.keys(Model.settings), dataSourceName)) {
      return Model.settings[dataSourceName].table || Model.modelName;
    }
    return Model.modelName;
  }

  /**
   * @param {Object} Model
   * @param {Array=} propertyNames
   * @returns {Array}
   */
  _getModelFields(Model, propertyNames = []) {
    propertyNames = _.isEmpty(propertyNames) ? Object.keys(Model.definition.properties) : propertyNames;
    return _.map(propertyNames, property => this._getModelField(Model, property));
  }

  /**
   * @param {Object} Model
   * @param {String} property
   * @returns {Array}
   */
  _getModelField(Model, property) {
    const dataSourceName = Model.getDataSource().name;
    if (_.includes(Object.keys(Model.definition.properties[property]), dataSourceName)) {
      return Model.definition.properties[property][dataSourceName].columnName || property;
    }
    return property;
  }

  /**
   * @param {Object} Model
   * @param {Object} fields
   * @returns {String}
   */
  _getFields(Model, fields = {}) {
    let result = _.filter(Object.keys(fields), field => fields[field] === true);
    if (!_.isEmpty(result)) return this._getModelFields(Model, result);
    result = _.filter(Object.keys(fields), field => fields[field] === false);
    return this._getModelFields(Model, result);
  }

  /**
   * @param {Object} Model
   * @param {String} property
   * @param {*} value
   * @returns {String}
   */
  _parseValue(Model, property, value) {
    if (Model.definition.properties[property].type === Date) {
      return `'${moment(value).format('YYYY-MM-DD HH:mm:ss')}'`;
    }
    return `'${value}'`;
  }

  /**
   * @param {Object} Model
   * @param {Object} filter
   * @param {Object} options
   * @param {Number} rootAlias
   * @returns {Array}
   */
  _includeSubQuery(Model, filter, options, rootAlias) {
    filter.include = convertToArray(filter.include);
    return _.compact(_.map(filter.include, include => {
      const relation = ((include) => include.relation || _.first(Object.keys(include)))(include);
      const relationDefinition = Model.relations[relation];
      const subFilter = include.scope || {};
      let alias = options.alias + 1;
      let query;
      if (relationDefinition.modelThrough) {
        const through = Model.app.models[Model.settings.relations[relation].through];
        const subAlias = alias + 1;
        query = this.createQueryByFilter(relationDefinition.modelTo, subFilter, {
          alias,
          multiple: relationDefinition.multiple,
          subWhere: `_${subAlias}.${relationDefinition.keyTo} = _${rootAlias}.${relationDefinition.keyFrom}`,
          join: `INNER JOIN ${this._getTableName(through)} _${subAlias} 
            ON _${subAlias}.${relationDefinition.keyThrough} = _${alias}.${relationDefinition.keyFrom}`,
        });
        options.alias = subAlias;
      } else if (relationDefinition.multiple) {
        query = this.createQueryByFilter(relationDefinition.modelTo, subFilter, {
          alias,
          multiple: relationDefinition.multiple,
          subWhere: `_${alias}.${relationDefinition.keyTo} = _${rootAlias}.${relationDefinition.keyFrom}`,
        });
        options.alias = alias;
      } else {
        query = this.createQueryByFilter(relationDefinition.modelTo, subFilter, {
          alias,
          multiple: relationDefinition.multiple,
          subWhere: `_${alias}.${relationDefinition.keyTo} = _${rootAlias}.${relationDefinition.keyFrom}`,
        });
        options.alias = alias;
      }
      if (query) return {field: `(${query})`, alias: relation};
    }));
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _getLimitAndSkip(filter) {
    if (filter.limit > -1) {
      if (filter.skip > -1) {
        return `${filter.limit} OFFSET ${filter.skip}`;
      } else {
        return `${filter.limit}`;
      }
    }
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _getOrder(filter) {
    if (!filter.order) return;
    if (_.isString(filter.order)) filter.order = [filter.order];
    return filter.order.join(', ');
  }

  /**
   * @param {Object} Model
   * @param {Object} where
   * @returns {String}
   */
  _getWhere(Model, where, rootAlias) {
    if (!where) return where;
    if (where.and) {
      return _.map(where.and, condition => {
        return this._getWhere(Model, condition, rootAlias);
      }).join(' AND ');
    } else if (where.or) {
      return _.map(where.or, condition => {
        return this._getWhere(Model, condition, rootAlias);
      }).join(' OR ');
    } else {
      const fieldName = _.first(Object.keys(where));
      const dbFieldName = this._getModelField(Model, fieldName);
      const dataSourceName = Model.getDataSource().name;
      const isValid = (value) => _.isString(value) || _.isNumber(value) || _.isDate(value);
      if (_.isNull(where[fieldName])) {
        return `_${rootAlias}.${dbFieldName} IS NULL`;
      } else if (where[fieldName] && isValid(where[fieldName])) {
        return `_${rootAlias}.${dbFieldName} = ${this._parseValue(Model, fieldName, where[fieldName])}`;
      } else if (where[fieldName] && isValid(where[fieldName].gt)) {
        return `_${rootAlias}.${dbFieldName} > ${this._parseValue(Model, fieldName, where[dbFieldName].gt)}`;
      } else if (where[fieldName] && isValid(where[fieldName].gte)) {
        return `_${rootAlias}.${dbFieldName} >= ${this._parseValue(Model, fieldName, where[dbFieldName].gte)}`;
      } else if (where[fieldName] && isValid(where[fieldName].lt)) {
        return `_${rootAlias}.${dbFieldName} < ${this._parseValue(Model, fieldName, where[dbFieldName].lt)}`;
      } else if (where[fieldName] && isValid(where[fieldName].lte)) {
        return `_${rootAlias}.${dbFieldName} <= ${this._parseValue(Model, fieldName, where[dbFieldName].lte)}`;
      } else if (where[fieldName] && where[fieldName].between) {
        const leftValue = this._parseValue(Model, fieldName, where[fieldName].between[0]);
        const rigthValue = this._parseValue(Model, fieldName, where[fieldName].between[1]);
        return `_${rootAlias}.${dbFieldName} BETWEEN ${leftValue} AND ${rigthValue}`;
      } else if (where[fieldName] && where[fieldName].inq) {
        return `_${rootAlias}.${dbFieldName} IN(${_.map(where[dbFieldName].inq, v => this._parseValue(Model, fieldName, v)).join(',')})`;
      } else if (where[fieldName] && where[fieldName].nin) {
        return `_${rootAlias}.${dbFieldName} NOT IN(${_.map(where[dbFieldName].nin, v => this._parseValue(Model, fieldName, v)).join(',')})`;
      } else if (where[fieldName] && isValid(where[fieldName].neq)) {
        return `_${rootAlias}.${dbFieldName} != ${this._parseValue(Model, fieldName, where[dbFieldName].neq)}`;
      } else if (where[fieldName] && where[fieldName].like) {
        return Connector.getLike({dataSourceName, where, fieldName, dbFieldName, rootAlias});
      } else if (where[fieldName] && where[fieldName].nlike) {
        return Connector.getNotLike({dataSourceName, where, fieldName, dbFieldName, rootAlias});
      } else {
        throw new Error(`Unsupported Loopback Filter: ${JSON.stringify(where)}`);
      }
    }
  }

  /**
   * @param {Object} Model
   * @returns {Array}
   */
  _fieldsForQuery(config) {
    return _.map(
      config.fields,
      field => ({field: `${config.tableAlias}.${field}`, alias: field})
    );
  }

  /**
   * @param {Object} Model
   * @param {Object} config
   * @returns {String}
   */
  _queryObject(Model, config) {
    const dataSourceName = Model.getDataSource().name;
    return this._subQueryBuild({
      ...config,
      buildFields: () => Connector.jsonObject({...config, dataSourceName}),
    });
  }

  /**
   * @param {Object} Model
   * @param {Object} config
   * @returns {String}
   */
  _queryArray(Model, config) {
    const dataSourceName = Model.getDataSource().name;
    return this._subQueryBuild({
      ...config,
      buildFields: () => Connector.jsonArray({...config, dataSourceName}),
    });
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _subQueryBuild(config) {
    config.join = config.join || '';
    config.where = config.where || '';
    config.order = config.order || '';
    config.limit = config.limit || '';
    if (!_.isEmpty(config.where)) config.where = `WHERE ${config.where}`;
    if (!_.isEmpty(config.order)) config.order = `ORDER BY ${config.order}`;
    if (!_.isEmpty(config.limit)) config.limit = `LIMIT ${config.limit}`;

    const compiled = _.template(`
      SELECT <%= buildFields() %>
      FROM <%= tableName %> AS <%= tableAlias %>
      <%= join %> <%= where %> <%= order %> <%= limit %>
    `);
    return compiled(config);
  }
};
