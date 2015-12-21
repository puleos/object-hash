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
 *  - `unorderedArrays` {true|*false} Sort all arrays before hashing
 *  - `unorderedSets` {*true|false} Sort `Set` and `Map` instances before hashing
 *  * = default
 *
 * @param {object} object value to hash
 * @param {object} options hashing options
 * @return {string} hash value
 * @api public
 */
exports = module.exports = objectHash;

function objectHash(object, options){
  options = applyDefaults(object, options);

  return hash(object, options);
}

/**
 * Exported sugar methods
 *
 * @param {object} object value to hash
 * @return {string} hash value
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

// Internals
function applyDefaults(object, options){
  var hashes = crypto.getHashes ? crypto.getHashes() : ['sha1', 'md5'];
  var encodings = ['buffer', 'hex', 'binary', 'base64'];
  
  options = options || {};
  options.algorithm = options.algorithm || 'sha1';
  options.encoding = options.encoding || 'hex';
  options.excludeValues = options.excludeValues ? true : false;
  options.algorithm = options.algorithm.toLowerCase();
  options.encoding = options.encoding.toLowerCase();
  options.respectType = options.respectType === false ? false : true; // default to true
  options.respectFunctionProperties = options.respectFunctionProperties === false ? false : true;
  options.unorderedArrays = options.unorderedArrays !== true ? false : true; // default to false
  options.unorderedSets = options.unorderedSets === false ? false : true; // default to false

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
  
  return options;
}

/** Check if the given function is a native function */
function isNativeFunction(f) {
  if ((typeof f) !== 'function') {
    return false;
  }
  var exp = /^function\s+\w*\s*\(\s*\)\s*{\s+\[native code\]\s+}$/i;
  return exp.exec(Function.prototype.toString.call(f)) != null;
}

function hash(object, options, hashingStream) {
  var hashingStream = crypto.createHash(options.algorithm);
  
  if (typeof hashingStream.write === 'undefined') {
    hashingStream.write = hashingStream.update;
    hashingStream.end = hashingStream.update;
  }
  
  var hasher = typeHasher(options, hashingStream);
  hasher.dispatch(object);
  hashingStream.end(''); // write empty string since .update() requires a string arg
  
  if (typeof hashingStream.read === 'undefined' &&
      typeof hashingStream.digest === 'function') {
    return hashingStream.digest(options.encoding === 'buffer' ? undefined : options.encoding);
  }

  var buf = hashingStream.read();
  if (options.encoding === 'buffer') {
    return buf;
  }
  
  return buf.toString(options.encoding);
}

/**
 * Expose streaming API
 *
 * @param {object} object  Value to serialize
 * @param {object} options  Options, as for hash()
 * @param {object} stream  A stream to write the serializiation to
 * @api public
 */
exports.writeToStream = function(object, options, stream) {
  if (typeof stream === 'undefined') {
    stream = options;
    options = {};
  }
  
  options = applyDefaults(object, options);
  
  return typeHasher(options, stream).dispatch(object);
};

function typeHasher(options, writeTo){
  var context = [];
  
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
        return this.dispatch("[CIRCULAR]: " + objectNumber);
      } else {
        context.push(object);
      }
      
      if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(object)) {
        writeTo.write('buffer:');
        return writeTo.write(object);
      }

      if(objType !== 'object' && objType !== 'function') {
        if(this['_' + objType]) {
          this['_' + objType](object);
        }else{
          throw new Error('Unknown object type "' + objType + '"');
        }
      }else{
        writeTo.write('object:');
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
        
        var self = this;
        return keys.forEach(function(key){
          writeTo.write(key, 'utf8');
          writeTo.write(':');
          if(!options.excludeValues) {
            self.dispatch(object[key]);
          }
        });
      }
    },
    _array: function(arr){
      writeTo.write('array:' + arr.length + ':');
      if (options.unorderedArrays !== false) {
        arr = arr.sort();
      }
      var self = this;
      return arr.forEach(function(entry) {
        return self.dispatch(entry);
      });
    },
    _date: function(date){
      return writeTo.write('date:' + date.toJSON());
    },
    _symbol: function(sym){
      return writeTo.write('symbol:' + sym.toString(), 'utf8');
    },
    _error: function(err){
      return writeTo.write('error:' + err.toString(), 'utf8');
    },
    _boolean: function(bool){
      return writeTo.write('bool:' + bool.toString());
    },
    _string: function(string){
      return writeTo.write('string:' + string, 'utf8');
    },
    _function: function(fn){
      writeTo.write('fn:' + fn.toString(), 'utf8');
      if (options.respectFunctionProperties) {
        this._object(fn);
      }
    },
    _number: function(number){
      return writeTo.write('number:' + number.toString());
    },
    _xml: function(xml){
      return writeTo.write('xml:' + xml.toString(), 'utf8');
    },
    _null: function() {
      return writeTo.write('Null');
    },
    _undefined: function() {
      return writeTo.write('Undefined');
    },
    _regexp: function(regex){
      return writeTo.write('regex:' + regex.toString(), 'utf8');
    },
    _uint8array: function(arr){
      writeTo.write('uint8array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint8clampedarray: function(arr){
      writeTo.write('uint8clampedarray:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _int8array: function(arr){
      writeTo.write('uint8array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint16array: function(arr){
      writeTo.write('uint16array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _int16array: function(arr){
      writeTo.write('uint16array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _uint32array: function(arr){
      writeTo.write('uint32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _int32array: function(arr){
      writeTo.write('uint32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _float32array: function(arr){
      writeTo.write('float32array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _float64array: function(arr){
      writeTo.write('float64array:');
      return this.dispatch(Array.prototype.slice.call(arr));
    },
    _arraybuffer: function(arr){
      writeTo.write('arraybuffer:');
      return this.dispatch(new Uint8Array(arr));
    },
    _url: function(url) {
      return writeTo.write('url:' + url.toString(), 'utf8');
    },
    _map: function(map) {
      writeTo.write('map:');
      var arr = Array.from(map);
      if (options.unorderedSets !== false && options.unorderedArrays === false) {
        arr = arr.sort();
      }
      return this.dispatch(arr);
    },
    _set: function(set) {
      writeTo.write('set:');
      var arr = Array.from(set);
      if (options.unorderedSets !== false && options.unorderedArrays === false) {
        arr = arr.sort();
      }
      return this.dispatch(arr);
    },
    _domwindow: function() { return writeTo.write('domwindow'); },
    /* Node.js standard native objects */
    _process: function() { return writeTo.write('process'); },
    _timer: function() { return writeTo.write('timer'); },
    _pipe: function() { return writeTo.write('pipe'); },
    _tcp: function() { return writeTo.write('tcp'); },
    _udp: function() { return writeTo.write('udp'); },
    _tty: function() { return writeTo.write('tty'); },
    _statwatcher: function() { return writeTo.write('statwatcher'); },
    _securecontext: function() { return writeTo.write('securecontext'); },
    _connection: function() { return writeTo.write('connection'); },
    _zlib: function() { return writeTo.write('zlib'); },
    _context: function() { return writeTo.write('context'); },
    _nodescript: function() { return writeTo.write('nodescript'); },
    _httpparser: function() { return writeTo.write('httpparser'); },
    _dataview: function() { return writeTo.write('dataview'); },
    _signal: function() { return writeTo.write('signal'); },
    _fsevent: function() { return writeTo.write('fsevent'); },
    _tlswrap: function() { return writeTo.write('tlswrap'); }
  };
}
