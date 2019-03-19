'use strict';

const MysqlConnector = require('./mysql');

module.exports = class Connector {

  static jsonObject(config) {
    switch(config.dataSourceName) {
      case 'mysql':
        return MysqlConnector.jsonObject(config);
      default:
        throw new Error(`Unsupported Loopback Filter from ${config.dataSourceName} connector`);
    }
  }

  static jsonArray(config) {
    switch(config.dataSourceName) {
      case 'mysql':
        return MysqlConnector.jsonArray(config);
      default:
        throw new Error(`Unsupported Loopback Filter from ${config.dataSourceName} connector`);
    }
  }

  static getLike(config) {
    switch(config.dataSourceName) {
      case 'mysql':
        return MysqlConnector.getLike(config);
      default:
        throw new Error(`Unsupported Loopback Filter from ${config.dataSourceName} connector`);
    }
  }

  static getNotLike(config) {
    switch(config.dataSourceName) {
      case 'mysql':
        return MysqlConnector.getNotLike(config);
      default:
        throw new Error(`Unsupported Loopback Filter from ${config.dataSourceName} connector`);
    }
  }
}