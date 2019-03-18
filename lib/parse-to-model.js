'use strict';

const List = require('loopback-datasource-juggler/lib/list');
const Relation = require('loopback-datasource-juggler/lib/relation-definition').Relation;
const _ = require('lodash');
const {convertToArray} = require('./utils');
const debug = require('debug')('single-sql-query:parse-to-model');

module.exports = class ParseToModel {

  /**
   * Cria uma instância do modelo baseada no filtro do Loopback e nos dados enviados.
   *
   * @param {ModelConstructor} ModelConstructor
   * @param {Object} filter
   * @param {Object|Array} data
   * @returns {Object|Array}
   */
  createInstanceOfModel(ModelConstructor, filter, data) {
    if (_.isArray(data)) {
      return _.map(data, item => {
        return this._executeCreateInstanceOfModel(ModelConstructor, filter, item);
      });
    }
    return this._executeCreateInstanceOfModel(ModelConstructor, filter, data);
  }

  /**
   * @param {ModelConstructor} ModelConstructor
   * @param {Object} filter
   * @param {Object} data
   * @returns {Object}
   */
  _executeCreateInstanceOfModel(ModelConstructor, filter, data) {
    debug('Filter: ', filter);
    debug('Raw Data: ', data);
    data = this._fromModelData(ModelConstructor, data);
    const Model = ModelConstructor.lookupModel(data);
    const obj = new Model(data, {fields: filter.fields, applySetters: false, persisted: true});
    filter.include = convertToArray(filter.include);
    _.forEach(filter.include, include => {
      let included = obj.__cachedRelations[include.relation];
      if (_.isArray(included)) {
        included = _.map(included, item => {
          return this._createInstanceOfRelation(ModelConstructor, include, item);
        });
        included = new List(included, null, obj);
      } else if (included) {
        included = this._createInstanceOfRelation(ModelConstructor, include, included);
      }
      if (included) {
        obj.__data[include.relation] = included;
        obj.__cachedRelations[include.relation] = included;
      }
    });
    delete obj.__data.__cachedRelations;
    debug('Model: ', obj);
    return obj;
  }

  /**
   * @param {ModelConstructor} ModelConstructor
   * @param {Object} include
   * @param {Object} data
   * @returns {Object}
   */
  _createInstanceOfRelation(ModelConstructor, include, data) {
    const definition = ModelConstructor.relations[include.relation];
    const modelInstance = this._executeCreateInstanceOfModel(definition.modelTo, include.scope || {}, data);
    const relation = new Relation(definition, modelInstance);
    return relation.modelInstance;
  }

  /**
   * @param {Object} ModelConstructor
   * @param {Object} data
   * @returns {Object}
   */
  _fromModelData(ModelConstructor, data) {
    const properties = Object.keys(ModelConstructor.getConnector()
      .getModelDefinition(ModelConstructor.modelName).properties);
    const relations = Object.keys(ModelConstructor.getConnector()
      .getModelDefinition(ModelConstructor.modelName).settings.relations);
    const dataModel = ModelConstructor.getConnector()
      .fromRow(ModelConstructor.modelName, data);
    return _.pick(_.assign(data, dataModel), _.union(properties, relations));
  }
};
