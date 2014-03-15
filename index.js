'use strict';

require('./lib/polyfills');
var crypto = require('crypto');

/**
 * Export hashing function
 *
 * @param {object} value to hash
 * @param {options} hashing options
 * @return {hash value}
 * @api public
 */
module.exports = function(object, options){
  options = options || {};
  options.algorithm = options.algorithm || 'sha1';
  options.encoding = options.encoding || 'hex';
  options.excludeValues = options.excludeValues ? true : false;
  options.algorithm = options.algorithm.toLowerCase();
  options.encoding = options.encoding.toLowerCase();

  validate(object, options);

  return hash(object, options);
};

function validate(object, options){
  var hashes = crypto.getHashes ? crypto.getHashes() : ['sha', 'sha1', 'md5'];
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
    _domwindow: function(){
      return hashFn.update('domwindow');
    }
  };
}
