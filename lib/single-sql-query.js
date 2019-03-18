'use strict';

const _ = require('lodash');
const debug = require('debug')('single-sql-query');
const ParseToModel = require('./parse-to-model');
const QueryBuilder = require('./query-builder');
const {resolveAsyncFunction} = require('./utils');

module.exports = class SingleSQLQuery {

  /**
   * @param {Object} Model
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  static find(Model, filter = {}, callback) {
    return resolveAsyncFunction((async () => {
      if (_.isFunction(filter)) {
        callback = filter;
        filter = {};
      }
      const nqb = new QueryBuilder(Model.app);
      const sql = nqb.createQueryByFilter(Model, filter);
      let data = await SingleSQLQuery._query(Model, sql, []);
      data = _.map(data, item => JSON.parse(item.data));
      const parse = new ParseToModel();
      return parse.createInstanceOfModel(Model, filter, data);
    }), [...arguments], callback);
  }

  /**
   * @param {Object} Model
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  static findOne(Model, filter = {}, callback) {
    return resolveAsyncFunction((async () => {
      if (_.isFunction(filter)) {
        callback = filter;
        filter = {};
      }
      filter.limit = 1;
      const data = await SingleSQLQuery.find(Model, filter);
      return _.first(data);
    }), [...arguments], callback);
  }

  /**
   * @param {Object} Model
   * @param {*} id
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  static findById(Model, id, filter = {}, callback) {
    return resolveAsyncFunction((async () => {
      if (_.isFunction(filter)) {
        callback = filter;
        filter = {};
      }
      filter.where = {id};
      const data = await SingleSQLQuery.find(Model, filter);
      return _.first(data);
    }), [...arguments], callback);
  }

  /**
   * @param {Object} Model
   * @param {String} sql
   * @param {Array=} params
   * @returns {Promise}
   */
  static async _query(Model, sql, params = []) {
    debug('SQL: %s, params: %j', sql, params);
    return new Promise((resolve, reject) => {
      const datasource = Model.getDataSource();
      if (!(datasource.isRelational && datasource.isRelational()))
        throw new Error('The database must be relational');
      datasource.connector.query(sql, params, (err, data) => {
        if (err) {
          debug('Error: %j', err);
          return reject(err);
        }
        debug('Data: ', data);
        resolve(data);
      });
    });
  }
}