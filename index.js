'use strict';

var crypto = require('crypto');

/**
 * Exported function
 *
 * Options:
 *
 *  - `algorithm` hash algo to be used by this instance: *'sha1', 'md5' 
 *  - `excludeValues` {true|*false} hash object keys, values ignored 
 *  - `encoding` hash encoding, supports 'buffer', '*hex', 'binary', 'base64' 
 *  * = default
 *
 * @param {object} value to hash
 * @param {options} hashing options
 * @return {hash value}
 * @api public
 */
exports = module.exports = objectHash;

function objectHash(object, options){
  options = options || {};
  options.algorithm = options.algorithm || 'sha1';
  options.encoding = options.encoding || 'hex';
  options.excludeValues = options.excludeValues ? true : false;
  options.algorithm = options.algorithm.toLowerCase();
  options.encoding = options.encoding.toLowerCase();

  validate(object, options);

  return hash(object, options);
}

/**
 * Exported sugar methods
 *
 * @param {object} value to hash
 * @return {hash value}
 * @api public
 */
exports.sha1 = function(object){
  return objectHash(object);
};
exports.keys = function(object){
  return objectHash(object, {excludeValues: true, algorithm: 'sha1', encoding: 'hex'});
};
exports.MD5 = function(object){
  return objectHash(object, {algorithm: 'md5', encoding: 'hex'});
};
exports.keysMD5 = function(object){
  return objectHash(object, {algorithm: 'md5', encoding: 'hex', excludeValues: true});
};

/**
 * Expose HashTable constructor
 *
 */
exports.HashTable = require('./lib/hashTable');


// Internals
function validate(object, options){
  var hashes = crypto.getHashes ? crypto.getHashes() : ['sha1', 'md5'];
  var encodings = ['buffer', 'hex', 'binary', 'base64'];

  if(typeof object === 'undefined') {
    throw new Error('Object argument required.');
  }

  if(hashes.indexOf(options.algorithm) === -1){
    throw new Error('Algorithm "' + options.algorithm + '"  not supported. ' +
      'supported values: ' + hashes.join(', '));
  }

  if(encodings.indexOf(options.encoding) === -1){
    throw new Error('Encoding "' + options.encoding + '"  not supported. ' +
      'supported values: ' + encodings.join(', '));
  }
}

function hash(object, options){
  var hashFn = crypto.createHash(options.algorithm);

  typeHasher(hashFn, options).dispatch(object);

  return (options.encoding === 'buffer') ? hashFn.digest() :
    hashFn.digest(options.encoding);
}

function typeHasher(hashFn, options){
  return {
    dispatch: function(value){
      var type = typeof value;
      var func = this['_' + type];
      return (value === null) ? this._null() : func(value);
    },
    _object: function(object) {
      var pattern = (/\[object (.*)\]/i);
      var objString = Object.prototype.toString.call(object);
      var objType = pattern.exec(objString)[1] || 'null';
      objType = objType.toLowerCase();

      if(objType !== 'object') {
        if(typeHasher(hashFn, options)['_' + objType]) {
          typeHasher(hashFn, options)['_' + objType](object);
        }else{
          throw new Error('Unknown object type "' + objType + '"');
        }
      }else{
        // TODO, add option for enumerating, for key in obj includePrototypeChain
        var keys = Object.keys(object).sort();
        return keys.forEach(function(key){
          hashFn.update(key);
          if(!options.excludeValues) {
            typeHasher(hashFn, options).dispatch(object[key]);
          }
        });
      }
    },
    _array: function(arr){
      return arr.forEach(function(el){
        typeHasher(hashFn, options).dispatch(el);
      });
    },
    _date: function(date){
      return hashFn.update(date.toString());
    },
    _boolean: function(bool){
      return hashFn.update(bool.toString());
    },
    _string: function(string){
      return hashFn.update(string);
    },
    _function: function(fn){
      return hashFn.update(fn.toString());
    },
    _number: function(number){
      return hashFn.update(number.toString());
    },
    _xml: function(xml){
      return hashFn.update(xml.toString());
    },
    _null: function(){
      return hashFn.update('Null');
    },
    _undefined: function(){
      return hashFn.update('Undefined');
    },
    _regexp: function(regex){
      return hashFn.update(regex.toString());
    },
    _domwindow: function(){
      return hashFn.update('domwindow');
    }
  };
}
