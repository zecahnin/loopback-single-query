'use strict';

const utils = require('loopback-datasource-juggler/lib/utils');


function isPlainObject() {
  return utils.isPlainObject(...arguments);
}

/**
 * @param {String|Object|Array} include
 */
function convertToArray(include) {
  if (typeof include === 'string') {
    let obj = {};
    obj[include] = true;
    return [obj];
  } else if (utils.isPlainObject(include)) {
    if (include.rel || include.relation) return [include];
    let newInclude = [];
    for (let key in include) {
      if (typeof includeEntry !== 'function') {
        let obj = {};
        obj[key] = include[key];
        newInclude.push(obj);
      }
    }
    return newInclude;
  } else if (Array.isArray(include)) {
    let normalized = [];
    for (let i in include) {
      let includeEntry = include[i];
      if (typeof includeEntry !== 'function') {
        if (typeof includeEntry === 'string') {
          let obj = {};
          obj[includeEntry] = true;
          normalized.push(obj);
        } else {
          normalized.push(includeEntry);
        }
      }
    }
    return normalized;
  }
  return [];
}

/**
 * @param {AsyncFunction} asyncFunction
 * @param {Array} args
 * @param {Function=} callback
 * @returns {null|Promise}
 */
function resolveAsyncFunction(asyncFunction, args, callback) {
  if (!callback) return asyncFunction(...args);
  const result = asyncFunction(...args);
  result.then(data => callback(null, data));
  result.catch(callback);
}

module.exports = {
  isPlainObject,
  convertToArray,
  resolveAsyncFunction
};
