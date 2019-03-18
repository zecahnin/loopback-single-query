'use strict';

const _ = require('lodash');
const {convertToArray} = require('./utils');
const debug = require('debug')('single-sql-query:builder');

module.exports = class ObjetoAprendizagemNativeQueryBuilder {

  constructor(app) {
    this._app = app;
  }

  /**
   * Construtor de query baseada nos filtros do Loopback.
   *
   * @param {Object} Model
   * @param {Object} filter
   * @param {Object=} options
   */
  createQueryByFilter(Model, filter, options = {}) {
    options.alias = options.alias || 0;
    const fields = this._getModelFields(Model);
    const tableName = this._getTableName(Model);

    const rootAlias = options.alias;
    const rootConfig = {
      tableName, fields,
      tableAlias: `_${rootAlias}`,
      join: options.join,
      // @TODO Ajustar para mais clásulas where
      where: options.subWhere,
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
   * @returns {Array}
   */
  _getModelFields(Model) {
    return _.map(Object.keys(Model.definition.properties), property => {
      if (Model.definition.properties[property].mysql) {
        return Model.definition.properties[property].mysql.columnName;
      }
      return property;
    });
  }

  /**
   * @param {Object} Model
   * @returns {String}
   */
  _getTableName(Model) {
    return (Model.settings.mysql && Model.settings.mysql.table) ? Model.settings.mysql.table : Model.modelName;
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
        const through = this._app.models[Model.settings.relations[include.relation].through];
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
