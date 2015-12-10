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
 *  - `respectFunctionProperties` {*true|false} consider function properties when hashing
 *  - `respectType` {*true|false} Respect special properties (prototype, constructor)
 *    when hashing to distinguish between types
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
  options.respectType = options.respectType === false ? false : true; // default to false
  options.respectFunctionProperties = options.respectFunctionProperties === false ? false : true;

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

  // if there is a case-insensitive match in the hashes list, accept it
  // (i.e. SHA256 for sha256)
  for (var i = 0; i < hashes.length; ++i) {
    if (hashes[i].toLowerCase() === options.algorithm.toLowerCase()) {
      options.algorithm = hashes[i];
    }
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

  var context = [];

  typeHasher(hashFn, options, context).dispatch(object);

  return (options.encoding === 'buffer') ? hashFn.digest() :
    hashFn.digest(options.encoding);
}

/** Check if the given function is a native function */
function isNativeFunction(f) {
  if ((typeof f) !== 'function') {
    return false;
  }
  var exp = /^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;
  return exp.exec(Function.prototype.toString.call(f)) != null;
}

function typeHasher(hashFn, options, context){
  return {
    dispatch: function(value){
      var type = typeof value;
      return (value === null) ? this._null() : this['_' + type](value);
    },
    _object: function(object) {
      var pattern = (/\[object (.*)\]/i);
      var objString = Object.prototype.toString.call(object);
      var objType = pattern.exec(objString)[1] || 'null';
      var objectNumber = null;
      objType = objType.toLowerCase();

      if ((objectNumber = context.indexOf(object)) >= 0) {
        typeHasher(hashFn, options, context).dispatch("[CIRCULAR]: " + objectNumber);
        return;
      } else {
        context.push(object);
      }
      
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(object)) {
        hashFn.update('buffer:');
        return hashFn.update(object);
      }

      if(objType !== 'object' && objType !== 'function') {
        if(typeHasher(hashFn, options, context)['_' + objType]) {
          typeHasher(hashFn, options, context)['_' + objType](object);
        }else{
          throw new Error('Unknown object type "' + objType + '"');
        }
      }else{
        hashFn.update('object:');
        var keys = Object.keys(object).sort();
        // Make sure to incorporate special properties, so
        // Types with different prototypes will produce
        // a different hash and objects derived from
        // different functions (`new Foo`, `new Bar`) will
        // produce different hashes.
        // We never do this for native functions since some
        // seem to break because of that.
        if (options.respectType !== false && !isNativeFunction(object)) {
          keys.splice(0, 0, 'prototype', '__proto__', 'constructor');
        }
        return keys.forEach(function(key){
          hashFn.update(key, 'utf8');
          if(!options.excludeValues) {
            typeHasher(hashFn, options, context).dispatch(object[key]);
          }
        });
      }
    },
    _array: function(arr){
      hashFn.update('array:' + arr.length + ':');
      return arr.forEach(function(el){
        typeHasher(hashFn, options, context).dispatch(el);
      });
    },
    _date: function(date){
      return hashFn.update('date:' + date.toJSON());
    },
    _symbol: function(sym){
      return hashFn.update('symbol:' + sym.toString(), 'utf8');
    },
    _error: function(err){
      return hashFn.update('error:' + err.toString(), 'utf8');
    },
    _boolean: function(bool){
      return hashFn.update('bool:' + bool.toString());
    },
    _string: function(string){
      return hashFn.update('string:' + string, 'utf8');
    },
    _function: function(fn){
      hashFn.update('fn:' + fn.toString(), 'utf8');
      if (options.respectFunctionProperties) {
        this._object(fn);
      }
      return hashFn;
    },
    _number: function(number){
      return hashFn.update('number:' + number.toString());
    },
    _xml: function(xml){
      return hashFn.update('xml:' + xml.toString(), 'utf8');
    },
    _null: function() {
      return hashFn.update('Null');
    },
    _undefined: function() {
      return hashFn.update('Undefined');
    },
    _regexp: function(regex){
      return hashFn.update('regex:' + regex.toString(), 'utf8');
    },
    _uint8array: function(arr){
      hashFn.update('uint8array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _uint8clampedarray: function(arr){
      hashFn.update('uint8clampedarray:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _int8array: function(arr){
      hashFn.update('uint8array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _uint16array: function(arr){
      hashFn.update('uint16array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _int16array: function(arr){
      hashFn.update('uint16array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _uint32array: function(arr){
      hashFn.update('uint32array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _int32array: function(arr){
      hashFn.update('uint32array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _float32array: function(arr){
      hashFn.update('float32array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _float64array: function(arr){
      hashFn.update('float64array:');
      return typeHasher(hashFn, options, context).dispatch(Array.prototype.slice.call(arr));
    },
    _arraybuffer: function(arr){
      hashFn.update('arraybuffer:');
      return typeHasher(hashFn, options, context).dispatch(new Uint8Array(arr));
    },
    _url: function(url) {
      return hashFn.update('url:' + url.toString(), 'utf8');
    },
    _map: function(map) {
      hashFn.update('map:');
      return typeHasher(hashFn, options, context).dispatch(Array.from(map));
    },
    _set: function(set) {
      hashFn.update('set:');
      return typeHasher(hashFn, options, context).dispatch(Array.from(set));
    },
    _domwindow: function() { return hashFn.update('domwindow'); },
    /* Node.js standard native objects */
    _process: function() { return hashFn.update('process'); },
    _timer: function() { return hashFn.update('timer'); },
    _pipe: function() { return hashFn.update('pipe'); },
    _tcp: function() { return hashFn.update('tcp'); },
    _udp: function() { return hashFn.update('udp'); },
    _tty: function() { return hashFn.update('tty'); },
    _statwatcher: function() { return hashFn.update('statwatcher'); },
    _securecontext: function() { return hashFn.update('securecontext'); },
    _connection: function() { return hashFn.update('connection'); },
    _zlib: function() { return hashFn.update('zlib'); },
    _context: function() { return hashFn.update('context'); },
    _nodescript: function() { return hashFn.update('nodescript'); },
    _httpparser: function() { return hashFn.update('httpparser'); },
    _dataview: function() { return hashFn.update('dataview'); },
    _signal: function() { return hashFn.update('signal'); },
    _fsevent: function() { return hashFn.update('fsevent'); },
    _tlswrap: function() { return hashFn.update('tlswrap'); }
  };
}
