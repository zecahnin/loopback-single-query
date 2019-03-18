'use strict';

const _ = require('lodash');
const {convertToArray} = require('./utils');
const debug = require('debug')('single-sql-query:builder');
const {getLike} = require('./connectors/mysql')

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
    const fields =this._getFields(Model, filter.fields)
    const tableName = this._getTableName(Model);

    const rootAlias = options.alias;
    const where = _.compact([options.subWhere, this._getWhere(Model, filter.where, rootAlias)]).join(' AND ');
    const rootConfig = {
      tableName, fields,
      tableAlias: `_${rootAlias}`,
      join: options.join,
      // @TODO Ajustar para mais clásulas where
      where,
      order: this._getOrder(filter),
      limit: this._getLimit(filter),
    };
    // @TODO Ajustar para mais clásulas fields
    const rootFields = _.union(
      this._buildFields(rootConfig),
      this._includeSubQuery(Model, filter, options, rootAlias)
    );

    const config = {
      ...rootConfig,
      fields: rootFields.join(', '),
    };

    if (options.multiple) {
      debug('QueryArray: ', JSON.parse(JSON.stringify(config)));
      return this._queryArray(config);
    }

    debug('QueryObject: ', JSON.parse(JSON.stringify(config)));
    return this._queryObject(config);
  }

  /**
   * @param {Object} Model
   * @param {Array=} propertyNames
   * @returns {Array}
   */
  _getModelFields(Model, propertyNames) {
    propertyNames = propertyNames || Object.keys(Model.definition.properties);
    const dataSourceName = Model.getDataSource().name;
    return _.map(propertyNames, property => {
      if (Model.definition.properties[property][dataSourceName]) {
        return Model.definition.properties[property][dataSourceName].columnName;
      }
      return property;
    });
  }

  /**
   * @param {Object} Model
   * @param {String} property
   * @returns {Array}
   */
  _getModelField(Model, property) {
    const dataSourceName = Model.getDataSource().name;
    if (Model.definition.properties[property][dataSourceName]) {
      return Model.definition.properties[property][dataSourceName].columnName;
    }
    return property;
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _getTableName(Model) {
    const dataSourceName = Model.getDataSource().name;
    return (Model.settings[dataSourceName] && Model.settings[dataSourceName].table) ?
      Model.settings[dataSourceName].table : Model.modelName;
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
   * @returns {String}
   */
  _getLimit(filter) {
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
      if (_.isNull(where[fieldName])) {
        return `_${rootAlias}.${dbFieldName} IS NULL`;
      } else if (_.isString(where[fieldName]) || _.isNumber(where[fieldName])) {
        return `_${rootAlias}.${dbFieldName} = ${where[fieldName]}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].gt) && !_.isUndefined(where[fieldName].gt)) {
        return `_${rootAlias}.${dbFieldName} > ${where[dbFieldName].gt}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].gte) && !_.isUndefined(where[fieldName].gte)) {
        return `_${rootAlias}.${dbFieldName} >= ${where[dbFieldName].gte}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].lt) && !_.isUndefined(where[fieldName].lt)) {
        return `_${rootAlias}.${dbFieldName} < ${where[dbFieldName].lt}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].lte) && !_.isUndefined(where[fieldName].lte)) {
        return `_${rootAlias}.${dbFieldName} <= ${where[dbFieldName].lte}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].between) && !_.isUndefined(where[fieldName].between)) {
        return `_${rootAlias}.${dbFieldName} BETWEEN ${where[dbFieldName].between[0]} AND ${where[dbFieldName].between[1]}`;
      } else if (where[fieldName] && where[fieldName].inq) {
        return `_${rootAlias}.${dbFieldName} IN(${where[dbFieldName].inq.join(',')})`;
      } else if (where[fieldName] && where[fieldName].nin) {
        return `_${rootAlias}.${dbFieldName} IN(${where[dbFieldName].nin.join(',')})`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].neq) && !_.isUndefined(where[fieldName].neq)) {
        return `_${rootAlias}.${dbFieldName} != ${where[dbFieldName].neq}`;
      } else if (where[fieldName] && !_.isNull(where[fieldName].like) && !_.isUndefined(where[fieldName].like)) {
        return getLike(Model, where, fieldName, dbFieldName, rootAlias);
      } else if (where[fieldName] && !_.isNull(where[fieldName].nlike) && !_.isUndefined(where[fieldName].nlike)) {
        return `_${rootAlias}.${dbFieldName} LIKE '${where[dbFieldName].nlike}'`;
      } else {
        throw new Error(`Unsupported Loopback Filter: ${JSON.stringify(where)}`);
      }
    }
  }

  /**
   * @param {Object} Model
   * @param {Object} fields
   * @returns {String}
   */
  _getFields(Model, fields) {
    let fields = [];
    const trueFields = _.filter(Object.keys(fields), field => fields[field] === true);
    if (!_.isEmpty(trueFields)) {
      fields = Object.keys(trueFields);
    } else {
      const falseFields = _.filter(Object.keys(fields), field => fields[field] === false);
      if (!_.isEmpty(falseFields)) fields = Object.keys(falseFields);
    }
    return this._getModelFields(Model, fields);
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
      const relationDefinition = Model.relations[include.relation];
      const subFilter = include.scope || {};
      let alias = options.alias + 1;
      let query;
      if (relationDefinition.modelThrough) {
        const through = Model.app.models[Model.settings.relations[include.relation].through];
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
      if (query) return `'${include.relation}', (${query})`;
    }));
  }

  /**
   * @param {Object} Model
   * @returns {Array}
   */
  _buildFields(config) {
    return _.map(
      config.fields,
      field => `'${field}', ${config.tableAlias}.${field}`
    );
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _queryObject(config) {
    return this._subQueryBuild({
      ...config,
      buildFields: () => _.template(`JSON_OBJECT(${config.fields}) AS data`)(config),
    });
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _queryArray(config) {
    return this._subQueryBuild({
      ...config,
      buildFields: () => _.template(`JSON_ARRAYAGG(JSON_OBJECT(${config.fields})) AS data`)(config),
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
