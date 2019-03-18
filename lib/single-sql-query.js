'use strict';

const _ = require('lodash');
const debug = require('debug')('single-sql-query');

class SingleSQLQuery {

  /**
   * @param {Object} Model
   */
  constructor(Model) {
    this._datasource = Model.getDataSource();
    if (!this._datasource.isRelational) throw new Error('The database must be relational');
    this._model = Model;
  }

  /**
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  async find(filter, callback) {
    console.log('find');
  }

  /**
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  async findOne(filter, callback) {
    console.log('findOne');
  }

  /**
   * @param {*} id
   * @param {Object=} filter
   * @param {Function=} callback
   * @returns {null|Promise}
   */
  async findById(id, filter, callback) {
    console.log('findById');
  }

  /**
   * @param {String} sql
   * @param {Array=} params
   * @returns {Promise}
   */
  async _query(sql, params = []) {
    debug('SQL: %s, params: %j', sql, params);
    return new Promise((resolve, reject) => {
      this._datasource.connector.query(sql, params, (err, data) => {
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