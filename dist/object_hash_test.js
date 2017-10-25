(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
  (function (Buffer){
    'use strict';

    var crypto = require('crypto') || require('crypto-js');

    /**
     * Exported function
     *
     * Options:
     *
     *  - `algorithm` hash algo to be used by this instance: *'sha1', 'md5'
     *  - `excludeValues` {true|*false} hash object keys, values ignored
     *  - `encoding` hash encoding, supports 'buffer', '*hex', 'binary', 'base64'
     *  - `ignoreUnknown` {true|*false} ignore unknown object types
     *  - `replacer` optional function that replaces values before hashing
     *  - `respectFunctionProperties` {*true|false} consider function properties when hashing
     *  - `respectFunctionNames` {*true|false} consider 'name' property of functions for hashing
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
    var hashes = crypto.getHashes ? crypto.getHashes().slice() : ['sha1', 'md5'];
    hashes.push('passthrough');
    var encodings = ['buffer', 'hex', 'binary', 'base64'];

    function applyDefaults(object, options){
      options = options || {};
      options.algorithm = options.algorithm || 'sha1';
      options.encoding = options.encoding || 'hex';
      options.excludeValues = options.excludeValues ? true : false;
      options.algorithm = options.algorithm.toLowerCase();
      options.encoding = options.encoding.toLowerCase();
      options.ignoreUnknown = options.ignoreUnknown !== true ? false : true; // default to false
      options.respectType = options.respectType === false ? false : true; // default to true
      options.respectFunctionNames = options.respectFunctionNames === false ? false : true;
      options.respectFunctionProperties = options.respectFunctionProperties === false ? false : true;
      options.unorderedArrays = options.unorderedArrays !== true ? false : true; // default to false
      options.unorderedSets = options.unorderedSets === false ? false : true; // default to false
      options.replacer = options.replacer || undefined;
      options.excludeKeys = options.excludeKeys || undefined;

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

      if(encodings.indexOf(options.encoding) === -1 &&
        options.algorithm !== 'passthrough'){
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

    function hash(object, options) {
      var hashingStream;

      if (options.algorithm !== 'passthrough') {
        hashingStream = crypto.createHash(options.algorithm);
      } else {
        hashingStream = new PassThrough();
      }

      if (typeof hashingStream.write === 'undefined') {
        hashingStream.write = hashingStream.update;
        hashingStream.end   = hashingStream.update;
      }

      var hasher = typeHasher(options, hashingStream);
      hasher.dispatch(object);
      if (!hashingStream.update)
        hashingStream.end('')

      if (hashingStream.digest) {
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

    function typeHasher(options, writeTo, context){
      context = context || [];
      var write = function(str) {
        if (writeTo.update)
          return writeTo.update(str, 'utf8');
        else
          return writeTo.write(str, 'utf8');
      }

      return {
        dispatch: function(value){
          if (options.replacer) {
            value = options.replacer(value);
          }

          var type = typeof value;
          if (value === null) {
            type = 'null';
          }

          //console.log("[DEBUG] Dispatch: ", value, "->", type, " -> ", "_" + type);

          return this['_' + type](value);
        },
        _object: function(object) {
          var pattern = (/\[object (.*)\]/i);
          var objString = Object.prototype.toString.call(object);
          var objType = pattern.exec(objString);
          if (!objType) { // object type did not match [object ...]
            objType = 'unknown:[' + objString + ']';
          } else {
            objType = objType[1]; // take only the class name
          }

          objType = objType.toLowerCase();

          var objectNumber = null;

          if ((objectNumber = context.indexOf(object)) >= 0) {
            return this.dispatch('[CIRCULAR:' + objectNumber + ']');
          } else {
            context.push(object);
          }

          if (typeof Buffer !== 'undefined' && Buffer.isBuffer && Buffer.isBuffer(object)) {
            write('buffer:');
            return write(object);
          }

          if(objType !== 'object' && objType !== 'function') {
            if(this['_' + objType]) {
              this['_' + objType](object);
            } else if (options.ignoreUnknown) {
              return write('[' + objType + ']');
            } else {
              throw new Error('Unknown object type "' + objType + '"');
            }
          }else{
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

            if (options.excludeKeys) {
              keys = keys.filter(function(key) { return !options.excludeKeys(key); });
            }

            write('object:' + keys.length + ':');
            var self = this;
            return keys.forEach(function(key){
              self.dispatch(key);
              write(':');
              if(!options.excludeValues) {
                self.dispatch(object[key]);
              }
              write(',');
            });
          }
        },
        _array: function(arr, unordered){
          unordered = typeof unordered !== 'undefined' ? unordered :
            options.unorderedArrays !== false; // default to options.unorderedArrays

          var self = this;
          write('array:' + arr.length + ':');
          if (!unordered || arr.length <= 1) {
            return arr.forEach(function(entry) {
              return self.dispatch(entry);
            });
          }

          // the unordered case is a little more complicated:
          // since there is no canonical ordering on objects,
          // i.e. {a:1} < {a:2} and {a:1} > {a:2} are both false,
          // we first serialize each entry using a PassThrough stream
          // before sorting.
          // also: we can’t use the same context array for all entries
          // since the order of hashing should *not* matter. instead,
          // we keep track of the additions to a copy of the context array
          // and add all of them to the global context array when we’re done
          var contextAdditions = [];
          var entries = arr.map(function(entry) {
            var strm = new PassThrough();
            var localContext = context.slice(); // make copy
            var hasher = typeHasher(options, strm, localContext);
            hasher.dispatch(entry);
            // take only what was added to localContext and append it to contextAdditions
            contextAdditions = contextAdditions.concat(localContext.slice(context.length));
            return strm.read().toString();
          });
          context = context.concat(contextAdditions);
          entries.sort();
          return this._array(entries, false);
        },
        _date: function(date){
          return write('date:' + date.toJSON());
        },
        _symbol: function(sym){
          return write('symbol:' + sym.toString());
        },
        _error: function(err){
          return write('error:' + err.toString());
        },
        _boolean: function(bool){
          return write('bool:' + bool.toString());
        },
        _string: function(string){
          write('string:' + string.length + ':');
          write(string);
        },
        _function: function(fn){
          write('fn:');
          if (isNativeFunction(fn)) {
            this.dispatch('[native]');
          } else {
            this.dispatch(fn.toString());
          }

          if (options.respectFunctionNames !== false) {
            // Make sure we can still distinguish native functions
            // by their name, otherwise String and Function will
            // have the same hash
            this.dispatch("function-name:" + String(fn.name));
          }

          if (options.respectFunctionProperties) {
            this._object(fn);
          }
        },
        _number: function(number){
          return write('number:' + number.toString());
        },
        _xml: function(xml){
          return write('xml:' + xml.toString());
        },
        _null: function() {
          return write('Null');
        },
        _undefined: function() {
          return write('Undefined');
        },
        _regexp: function(regex){
          return write('regex:' + regex.toString());
        },
        _uint8array: function(arr){
          write('uint8array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _uint8clampedarray: function(arr){
          write('uint8clampedarray:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _int8array: function(arr){
          write('uint8array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _uint16array: function(arr){
          write('uint16array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _int16array: function(arr){
          write('uint16array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _uint32array: function(arr){
          write('uint32array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _int32array: function(arr){
          write('uint32array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _float32array: function(arr){
          write('float32array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _float64array: function(arr){
          write('float64array:');
          return this.dispatch(Array.prototype.slice.call(arr));
        },
        _arraybuffer: function(arr){
          write('arraybuffer:');
          return this.dispatch(new Uint8Array(arr));
        },
        _url: function(url) {
          return write('url:' + url.toString(), 'utf8');
        },
        _map: function(map) {
          write('map:');
          var arr = Array.from(map);
          return this._array(arr, options.unorderedSets !== false);
        },
        _set: function(set) {
          write('set:');
          var arr = Array.from(set);
          return this._array(arr, options.unorderedSets !== false);
        },
        _blob: function() {
          if (options.ignoreUnknown) {
            return write('[blob]');
          }

          throw Error('Hashing Blob objects is currently not supported\n' +
            '(see https://github.com/puleos/object-hash/issues/26)\n' +
            'Use "options.replacer" or "options.ignoreUnknown"\n');
        },
        _domwindow: function() { return write('domwindow'); },
        /* Node.js standard native objects */
        _process: function() { return write('process'); },
        _timer: function() { return write('timer'); },
        _pipe: function() { return write('pipe'); },
        _tcp: function() { return write('tcp'); },
        _udp: function() { return write('udp'); },
        _tty: function() { return write('tty'); },
        _statwatcher: function() { return write('statwatcher'); },
        _securecontext: function() { return write('securecontext'); },
        _connection: function() { return write('connection'); },
        _zlib: function() { return write('zlib'); },
        _context: function() { return write('context'); },
        _nodescript: function() { return write('nodescript'); },
        _httpparser: function() { return write('httpparser'); },
        _dataview: function() { return write('dataview'); },
        _signal: function() { return write('signal'); },
        _fsevent: function() { return write('fsevent'); },
        _tlswrap: function() { return write('tlswrap'); }
      };
    }

// Mini-implementation of stream.PassThrough
// We are far from having need for the full implementation, and we can
// make assumtions like "many writes, then only one final read"
// and we can ignore encoding specifics
    function PassThrough() {
      return {
        buf: '',

        write: function(b) {
          this.buf += b;
        },

        end: function(b) {
          this.buf += b;
        },

        read: function() {
          return this.buf;
        }
      };
    }

  }).call(this,require("buffer").Buffer)
},{"buffer":38,"crypto":40,"crypto-js":10}],2:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var BlockCipher = C_lib.BlockCipher;
      var C_algo = C.algo;

      // Lookup tables
      var SBOX = [];
      var INV_SBOX = [];
      var SUB_MIX_0 = [];
      var SUB_MIX_1 = [];
      var SUB_MIX_2 = [];
      var SUB_MIX_3 = [];
      var INV_SUB_MIX_0 = [];
      var INV_SUB_MIX_1 = [];
      var INV_SUB_MIX_2 = [];
      var INV_SUB_MIX_3 = [];

      // Compute lookup tables
      (function () {
        // Compute double table
        var d = [];
        for (var i = 0; i < 256; i++) {
          if (i < 128) {
            d[i] = i << 1;
          } else {
            d[i] = (i << 1) ^ 0x11b;
          }
        }

        // Walk GF(2^8)
        var x = 0;
        var xi = 0;
        for (var i = 0; i < 256; i++) {
          // Compute sbox
          var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
          sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
          SBOX[x] = sx;
          INV_SBOX[sx] = x;

          // Compute multiplication
          var x2 = d[x];
          var x4 = d[x2];
          var x8 = d[x4];

          // Compute sub bytes, mix columns tables
          var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
          SUB_MIX_0[x] = (t << 24) | (t >>> 8);
          SUB_MIX_1[x] = (t << 16) | (t >>> 16);
          SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
          SUB_MIX_3[x] = t;

          // Compute inv sub bytes, inv mix columns tables
          var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
          INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
          INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
          INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
          INV_SUB_MIX_3[sx] = t;

          // Compute next counter
          if (!x) {
            x = xi = 1;
          } else {
            x = x2 ^ d[d[d[x8 ^ x2]]];
            xi ^= d[d[xi]];
          }
        }
      }());

      // Precomputed Rcon lookup
      var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

      /**
       * AES block cipher algorithm.
       */
      var AES = C_algo.AES = BlockCipher.extend({
        _doReset: function () {
          // Skip reset of nRounds has been set before and key did not change
          if (this._nRounds && this._keyPriorReset === this._key) {
            return;
          }

          // Shortcuts
          var key = this._keyPriorReset = this._key;
          var keyWords = key.words;
          var keySize = key.sigBytes / 4;

          // Compute number of rounds
          var nRounds = this._nRounds = keySize + 6;

          // Compute number of key schedule rows
          var ksRows = (nRounds + 1) * 4;

          // Compute key schedule
          var keySchedule = this._keySchedule = [];
          for (var ksRow = 0; ksRow < ksRows; ksRow++) {
            if (ksRow < keySize) {
              keySchedule[ksRow] = keyWords[ksRow];
            } else {
              var t = keySchedule[ksRow - 1];

              if (!(ksRow % keySize)) {
                // Rot word
                t = (t << 8) | (t >>> 24);

                // Sub word
                t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

                // Mix Rcon
                t ^= RCON[(ksRow / keySize) | 0] << 24;
              } else if (keySize > 6 && ksRow % keySize == 4) {
                // Sub word
                t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
              }

              keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
            }
          }

          // Compute inv key schedule
          var invKeySchedule = this._invKeySchedule = [];
          for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
            var ksRow = ksRows - invKsRow;

            if (invKsRow % 4) {
              var t = keySchedule[ksRow];
            } else {
              var t = keySchedule[ksRow - 4];
            }

            if (invKsRow < 4 || ksRow <= 4) {
              invKeySchedule[invKsRow] = t;
            } else {
              invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
                INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
            }
          }
        },

        encryptBlock: function (M, offset) {
          this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
        },

        decryptBlock: function (M, offset) {
          // Swap 2nd and 4th rows
          var t = M[offset + 1];
          M[offset + 1] = M[offset + 3];
          M[offset + 3] = t;

          this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

          // Inv swap 2nd and 4th rows
          var t = M[offset + 1];
          M[offset + 1] = M[offset + 3];
          M[offset + 3] = t;
        },

        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
          // Shortcut
          var nRounds = this._nRounds;

          // Get input, add round key
          var s0 = M[offset]     ^ keySchedule[0];
          var s1 = M[offset + 1] ^ keySchedule[1];
          var s2 = M[offset + 2] ^ keySchedule[2];
          var s3 = M[offset + 3] ^ keySchedule[3];

          // Key schedule row counter
          var ksRow = 4;

          // Rounds
          for (var round = 1; round < nRounds; round++) {
            // Shift rows, sub bytes, mix columns, add round key
            var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
            var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
            var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
            var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

            // Update state
            s0 = t0;
            s1 = t1;
            s2 = t2;
            s3 = t3;
          }

          // Shift rows, sub bytes, add round key
          var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
          var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
          var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
          var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

          // Set output
          M[offset]     = t0;
          M[offset + 1] = t1;
          M[offset + 2] = t2;
          M[offset + 3] = t3;
        },

        keySize: 256/32
      });

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
       */
      C.AES = BlockCipher._createHelper(AES);
    }());


    return CryptoJS.AES;

  }));
},{"./cipher-core":3,"./core":4,"./enc-base64":5,"./evpkdf":7,"./md5":12}],3:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./evpkdf"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./evpkdf"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Cipher core components.
     */
    CryptoJS.lib.Cipher || (function (undefined) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var WordArray = C_lib.WordArray;
      var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
      var C_enc = C.enc;
      var Utf8 = C_enc.Utf8;
      var Base64 = C_enc.Base64;
      var C_algo = C.algo;
      var EvpKDF = C_algo.EvpKDF;

      /**
       * Abstract base cipher template.
       *
       * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
       * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
       * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
       * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
       */
      var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         *
         * @property {WordArray} iv The IV to use for this operation.
         */
        cfg: Base.extend(),

        /**
         * Creates this cipher in encryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
         */
        createEncryptor: function (key, cfg) {
          return this.create(this._ENC_XFORM_MODE, key, cfg);
        },

        /**
         * Creates this cipher in decryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
         */
        createDecryptor: function (key, cfg) {
          return this.create(this._DEC_XFORM_MODE, key, cfg);
        },

        /**
         * Initializes a newly created cipher.
         *
         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
         */
        init: function (xformMode, key, cfg) {
          // Apply config defaults
          this.cfg = this.cfg.extend(cfg);

          // Store transform mode and key
          this._xformMode = xformMode;
          this._key = key;

          // Set initial values
          this.reset();
        },

        /**
         * Resets this cipher to its initial state.
         *
         * @example
         *
         *     cipher.reset();
         */
        reset: function () {
          // Reset data buffer
          BufferedBlockAlgorithm.reset.call(this);

          // Perform concrete-cipher logic
          this._doReset();
        },

        /**
         * Adds data to be encrypted or decrypted.
         *
         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
         *
         * @return {WordArray} The data after processing.
         *
         * @example
         *
         *     var encrypted = cipher.process('data');
         *     var encrypted = cipher.process(wordArray);
         */
        process: function (dataUpdate) {
          // Append
          this._append(dataUpdate);

          // Process available blocks
          return this._process();
        },

        /**
         * Finalizes the encryption or decryption process.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
         *
         * @return {WordArray} The data after final processing.
         *
         * @example
         *
         *     var encrypted = cipher.finalize();
         *     var encrypted = cipher.finalize('data');
         *     var encrypted = cipher.finalize(wordArray);
         */
        finalize: function (dataUpdate) {
          // Final data update
          if (dataUpdate) {
            this._append(dataUpdate);
          }

          // Perform concrete-cipher logic
          var finalProcessedData = this._doFinalize();

          return finalProcessedData;
        },

        keySize: 128/32,

        ivSize: 128/32,

        _ENC_XFORM_MODE: 1,

        _DEC_XFORM_MODE: 2,

        /**
         * Creates shortcut functions to a cipher's object interface.
         *
         * @param {Cipher} cipher The cipher to create a helper for.
         *
         * @return {Object} An object with encrypt and decrypt shortcut functions.
         *
         * @static
         *
         * @example
         *
         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
         */
        _createHelper: (function () {
          function selectCipherStrategy(key) {
            if (typeof key == 'string') {
              return PasswordBasedCipher;
            } else {
              return SerializableCipher;
            }
          }

          return function (cipher) {
            return {
              encrypt: function (message, key, cfg) {
                return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
              },

              decrypt: function (ciphertext, key, cfg) {
                return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
              }
            };
          };
        }())
      });

      /**
       * Abstract base stream cipher template.
       *
       * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
       */
      var StreamCipher = C_lib.StreamCipher = Cipher.extend({
        _doFinalize: function () {
          // Process partial blocks
          var finalProcessedBlocks = this._process(!!'flush');

          return finalProcessedBlocks;
        },

        blockSize: 1
      });

      /**
       * Mode namespace.
       */
      var C_mode = C.mode = {};

      /**
       * Abstract base block cipher mode template.
       */
      var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
        /**
         * Creates this mode for encryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
         */
        createEncryptor: function (cipher, iv) {
          return this.Encryptor.create(cipher, iv);
        },

        /**
         * Creates this mode for decryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
         */
        createDecryptor: function (cipher, iv) {
          return this.Decryptor.create(cipher, iv);
        },

        /**
         * Initializes a newly created mode.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
         */
        init: function (cipher, iv) {
          this._cipher = cipher;
          this._iv = iv;
        }
      });

      /**
       * Cipher Block Chaining mode.
       */
      var CBC = C_mode.CBC = (function () {
        /**
         * Abstract base CBC mode.
         */
        var CBC = BlockCipherMode.extend();

        /**
         * CBC encryptor.
         */
        CBC.Encryptor = CBC.extend({
          /**
           * Processes the data block at offset.
           *
           * @param {Array} words The data words to operate on.
           * @param {number} offset The offset where the block starts.
           *
           * @example
           *
           *     mode.processBlock(data.words, offset);
           */
          processBlock: function (words, offset) {
            // Shortcuts
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;

            // XOR and encrypt
            xorBlock.call(this, words, offset, blockSize);
            cipher.encryptBlock(words, offset);

            // Remember this block to use with next block
            this._prevBlock = words.slice(offset, offset + blockSize);
          }
        });

        /**
         * CBC decryptor.
         */
        CBC.Decryptor = CBC.extend({
          /**
           * Processes the data block at offset.
           *
           * @param {Array} words The data words to operate on.
           * @param {number} offset The offset where the block starts.
           *
           * @example
           *
           *     mode.processBlock(data.words, offset);
           */
          processBlock: function (words, offset) {
            // Shortcuts
            var cipher = this._cipher;
            var blockSize = cipher.blockSize;

            // Remember this block to use with next block
            var thisBlock = words.slice(offset, offset + blockSize);

            // Decrypt and XOR
            cipher.decryptBlock(words, offset);
            xorBlock.call(this, words, offset, blockSize);

            // This block becomes the previous block
            this._prevBlock = thisBlock;
          }
        });

        function xorBlock(words, offset, blockSize) {
          // Shortcut
          var iv = this._iv;

          // Choose mixing block
          if (iv) {
            var block = iv;

            // Remove IV for subsequent blocks
            this._iv = undefined;
          } else {
            var block = this._prevBlock;
          }

          // XOR blocks
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= block[i];
          }
        }

        return CBC;
      }());

      /**
       * Padding namespace.
       */
      var C_pad = C.pad = {};

      /**
       * PKCS #5/7 padding strategy.
       */
      var Pkcs7 = C_pad.Pkcs7 = {
        /**
         * Pads data using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to pad.
         * @param {number} blockSize The multiple that the data should be padded to.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
         */
        pad: function (data, blockSize) {
          // Shortcut
          var blockSizeBytes = blockSize * 4;

          // Count padding bytes
          var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

          // Create padding word
          var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

          // Create padding
          var paddingWords = [];
          for (var i = 0; i < nPaddingBytes; i += 4) {
            paddingWords.push(paddingWord);
          }
          var padding = WordArray.create(paddingWords, nPaddingBytes);

          // Add padding
          data.concat(padding);
        },

        /**
         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to unpad.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
         */
        unpad: function (data) {
          // Get number of padding bytes from last byte
          var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

          // Remove padding
          data.sigBytes -= nPaddingBytes;
        }
      };

      /**
       * Abstract base block cipher template.
       *
       * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
       */
      var BlockCipher = C_lib.BlockCipher = Cipher.extend({
        /**
         * Configuration options.
         *
         * @property {Mode} mode The block mode to use. Default: CBC
         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
         */
        cfg: Cipher.cfg.extend({
          mode: CBC,
          padding: Pkcs7
        }),

        reset: function () {
          // Reset cipher
          Cipher.reset.call(this);

          // Shortcuts
          var cfg = this.cfg;
          var iv = cfg.iv;
          var mode = cfg.mode;

          // Reset block mode
          if (this._xformMode == this._ENC_XFORM_MODE) {
            var modeCreator = mode.createEncryptor;
          } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
            var modeCreator = mode.createDecryptor;
            // Keep at least one block in the buffer for unpadding
            this._minBufferSize = 1;
          }

          if (this._mode && this._mode.__creator == modeCreator) {
            this._mode.init(this, iv && iv.words);
          } else {
            this._mode = modeCreator.call(mode, this, iv && iv.words);
            this._mode.__creator = modeCreator;
          }
        },

        _doProcessBlock: function (words, offset) {
          this._mode.processBlock(words, offset);
        },

        _doFinalize: function () {
          // Shortcut
          var padding = this.cfg.padding;

          // Finalize
          if (this._xformMode == this._ENC_XFORM_MODE) {
            // Pad data
            padding.pad(this._data, this.blockSize);

            // Process final blocks
            var finalProcessedBlocks = this._process(!!'flush');
          } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
            // Process final blocks
            var finalProcessedBlocks = this._process(!!'flush');

            // Unpad data
            padding.unpad(finalProcessedBlocks);
          }

          return finalProcessedBlocks;
        },

        blockSize: 128/32
      });

      /**
       * A collection of cipher parameters.
       *
       * @property {WordArray} ciphertext The raw ciphertext.
       * @property {WordArray} key The key to this ciphertext.
       * @property {WordArray} iv The IV used in the ciphering operation.
       * @property {WordArray} salt The salt used with a key derivation function.
       * @property {Cipher} algorithm The cipher algorithm.
       * @property {Mode} mode The block mode used in the ciphering operation.
       * @property {Padding} padding The padding scheme used in the ciphering operation.
       * @property {number} blockSize The block size of the cipher.
       * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
       */
      var CipherParams = C_lib.CipherParams = Base.extend({
        /**
         * Initializes a newly created cipher params object.
         *
         * @param {Object} cipherParams An object with any of the possible cipher parameters.
         *
         * @example
         *
         *     var cipherParams = CryptoJS.lib.CipherParams.create({
	         *         ciphertext: ciphertextWordArray,
	         *         key: keyWordArray,
	         *         iv: ivWordArray,
	         *         salt: saltWordArray,
	         *         algorithm: CryptoJS.algo.AES,
	         *         mode: CryptoJS.mode.CBC,
	         *         padding: CryptoJS.pad.PKCS7,
	         *         blockSize: 4,
	         *         formatter: CryptoJS.format.OpenSSL
	         *     });
         */
        init: function (cipherParams) {
          this.mixIn(cipherParams);
        },

        /**
         * Converts this cipher params object to a string.
         *
         * @param {Format} formatter (Optional) The formatting strategy to use.
         *
         * @return {string} The stringified cipher params.
         *
         * @throws Error If neither the formatter nor the default formatter is set.
         *
         * @example
         *
         *     var string = cipherParams + '';
         *     var string = cipherParams.toString();
         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
         */
        toString: function (formatter) {
          return (formatter || this.formatter).stringify(this);
        }
      });

      /**
       * Format namespace.
       */
      var C_format = C.format = {};

      /**
       * OpenSSL formatting strategy.
       */
      var OpenSSLFormatter = C_format.OpenSSL = {
        /**
         * Converts a cipher params object to an OpenSSL-compatible string.
         *
         * @param {CipherParams} cipherParams The cipher params object.
         *
         * @return {string} The OpenSSL-compatible string.
         *
         * @static
         *
         * @example
         *
         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
         */
        stringify: function (cipherParams) {
          // Shortcuts
          var ciphertext = cipherParams.ciphertext;
          var salt = cipherParams.salt;

          // Format
          if (salt) {
            var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
          } else {
            var wordArray = ciphertext;
          }

          return wordArray.toString(Base64);
        },

        /**
         * Converts an OpenSSL-compatible string to a cipher params object.
         *
         * @param {string} openSSLStr The OpenSSL-compatible string.
         *
         * @return {CipherParams} The cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
         */
        parse: function (openSSLStr) {
          // Parse base64
          var ciphertext = Base64.parse(openSSLStr);

          // Shortcut
          var ciphertextWords = ciphertext.words;

          // Test for salt
          if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
            // Extract salt
            var salt = WordArray.create(ciphertextWords.slice(2, 4));

            // Remove salt from ciphertext
            ciphertextWords.splice(0, 4);
            ciphertext.sigBytes -= 16;
          }

          return CipherParams.create({ ciphertext: ciphertext, salt: salt });
        }
      };

      /**
       * A cipher wrapper that returns ciphertext as a serializable cipher params object.
       */
      var SerializableCipher = C_lib.SerializableCipher = Base.extend({
        /**
         * Configuration options.
         *
         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
         */
        cfg: Base.extend({
          format: OpenSSLFormatter
        }),

        /**
         * Encrypts a message.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {WordArray|string} message The message to encrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CipherParams} A cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        encrypt: function (cipher, message, key, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Encrypt
          var encryptor = cipher.createEncryptor(key, cfg);
          var ciphertext = encryptor.finalize(message);

          // Shortcut
          var cipherCfg = encryptor.cfg;

          // Create and return serializable cipher params
          return CipherParams.create({
            ciphertext: ciphertext,
            key: key,
            iv: cipherCfg.iv,
            algorithm: cipher,
            mode: cipherCfg.mode,
            padding: cipherCfg.padding,
            blockSize: cipher.blockSize,
            formatter: cfg.format
          });
        },

        /**
         * Decrypts serialized ciphertext.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {WordArray} The plaintext.
         *
         * @static
         *
         * @example
         *
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        decrypt: function (cipher, ciphertext, key, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Convert string to CipherParams
          ciphertext = this._parse(ciphertext, cfg.format);

          // Decrypt
          var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

          return plaintext;
        },

        /**
         * Converts serialized ciphertext to CipherParams,
         * else assumed CipherParams already and returns ciphertext unchanged.
         *
         * @param {CipherParams|string} ciphertext The ciphertext.
         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
         *
         * @return {CipherParams} The unserialized ciphertext.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
         */
        _parse: function (ciphertext, format) {
          if (typeof ciphertext == 'string') {
            return format.parse(ciphertext, this);
          } else {
            return ciphertext;
          }
        }
      });

      /**
       * Key derivation function namespace.
       */
      var C_kdf = C.kdf = {};

      /**
       * OpenSSL key derivation function.
       */
      var OpenSSLKdf = C_kdf.OpenSSL = {
        /**
         * Derives a key and IV from a password.
         *
         * @param {string} password The password to derive from.
         * @param {number} keySize The size in words of the key to generate.
         * @param {number} ivSize The size in words of the IV to generate.
         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
         *
         * @return {CipherParams} A cipher params object with the key, IV, and salt.
         *
         * @static
         *
         * @example
         *
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
         */
        execute: function (password, keySize, ivSize, salt) {
          // Generate random salt
          if (!salt) {
            salt = WordArray.random(64/8);
          }

          // Derive key and IV
          var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

          // Separate key and IV
          var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
          key.sigBytes = keySize * 4;

          // Return params
          return CipherParams.create({ key: key, iv: iv, salt: salt });
        }
      };

      /**
       * A serializable cipher wrapper that derives the key from a password,
       * and returns ciphertext as a serializable cipher params object.
       */
      var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
        /**
         * Configuration options.
         *
         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
         */
        cfg: SerializableCipher.cfg.extend({
          kdf: OpenSSLKdf
        }),

        /**
         * Encrypts a message using a password.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {WordArray|string} message The message to encrypt.
         * @param {string} password The password.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CipherParams} A cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
         */
        encrypt: function (cipher, message, password, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Derive key and other params
          var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

          // Add IV to config
          cfg.iv = derivedParams.iv;

          // Encrypt
          var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

          // Mix in derived params
          ciphertext.mixIn(derivedParams);

          return ciphertext;
        },

        /**
         * Decrypts serialized ciphertext using a password.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
         * @param {string} password The password.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {WordArray} The plaintext.
         *
         * @static
         *
         * @example
         *
         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
         */
        decrypt: function (cipher, ciphertext, password, cfg) {
          // Apply config defaults
          cfg = this.cfg.extend(cfg);

          // Convert string to CipherParams
          ciphertext = this._parse(ciphertext, cfg.format);

          // Derive key and other params
          var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

          // Add IV to config
          cfg.iv = derivedParams.iv;

          // Decrypt
          var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

          return plaintext;
        }
      });
    }());


  }));
},{"./core":4,"./evpkdf":7}],4:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory();
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define([], factory);
    }
    else {
      // Global (browser)
      root.CryptoJS = factory();
    }
  }(this, function () {

    /**
     * CryptoJS core components.
     */
    var CryptoJS = CryptoJS || (function (Math, undefined) {
      /*
	     * Local polyfil of Object.create
	     */
      var create = Object.create || (function () {
        function F() {};

        return function (obj) {
          var subtype;

          F.prototype = obj;

          subtype = new F();

          F.prototype = null;

          return subtype;
        };
      }())

      /**
       * CryptoJS namespace.
       */
      var C = {};

      /**
       * Library namespace.
       */
      var C_lib = C.lib = {};

      /**
       * Base object for prototypal inheritance.
       */
      var Base = C_lib.Base = (function () {


        return {
          /**
           * Creates a new object that inherits from this object.
           *
           * @param {Object} overrides Properties to copy into the new object.
           *
           * @return {Object} The new object.
           *
           * @static
           *
           * @example
           *
           *     var MyType = CryptoJS.lib.Base.extend({
	             *         field: 'value',
	             *
	             *         method: function () {
	             *         }
	             *     });
           */
          extend: function (overrides) {
            // Spawn
            var subtype = create(this);

            // Augment
            if (overrides) {
              subtype.mixIn(overrides);
            }

            // Create default initializer
            if (!subtype.hasOwnProperty('init') || this.init === subtype.init) {
              subtype.init = function () {
                subtype.$super.init.apply(this, arguments);
              };
            }

            // Initializer's prototype is the subtype object
            subtype.init.prototype = subtype;

            // Reference supertype
            subtype.$super = this;

            return subtype;
          },

          /**
           * Extends this object and runs the init method.
           * Arguments to create() will be passed to init().
           *
           * @return {Object} The new object.
           *
           * @static
           *
           * @example
           *
           *     var instance = MyType.create();
           */
          create: function () {
            var instance = this.extend();
            instance.init.apply(instance, arguments);

            return instance;
          },

          /**
           * Initializes a newly created object.
           * Override this method to add some logic when your objects are created.
           *
           * @example
           *
           *     var MyType = CryptoJS.lib.Base.extend({
	             *         init: function () {
	             *             // ...
	             *         }
	             *     });
           */
          init: function () {
          },

          /**
           * Copies properties into this object.
           *
           * @param {Object} properties The properties to mix in.
           *
           * @example
           *
           *     MyType.mixIn({
	             *         field: 'value'
	             *     });
           */
          mixIn: function (properties) {
            for (var propertyName in properties) {
              if (properties.hasOwnProperty(propertyName)) {
                this[propertyName] = properties[propertyName];
              }
            }

            // IE won't copy toString using the loop above
            if (properties.hasOwnProperty('toString')) {
              this.toString = properties.toString;
            }
          },

          /**
           * Creates a copy of this object.
           *
           * @return {Object} The clone.
           *
           * @example
           *
           *     var clone = instance.clone();
           */
          clone: function () {
            return this.init.prototype.extend(this);
          }
        };
      }());

      /**
       * An array of 32-bit words.
       *
       * @property {Array} words The array of 32-bit words.
       * @property {number} sigBytes The number of significant bytes in this word array.
       */
      var WordArray = C_lib.WordArray = Base.extend({
        /**
         * Initializes a newly created word array.
         *
         * @param {Array} words (Optional) An array of 32-bit words.
         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.create();
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
         */
        init: function (words, sigBytes) {
          words = this.words = words || [];

          if (sigBytes != undefined) {
            this.sigBytes = sigBytes;
          } else {
            this.sigBytes = words.length * 4;
          }
        },

        /**
         * Converts this word array to a string.
         *
         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
         *
         * @return {string} The stringified word array.
         *
         * @example
         *
         *     var string = wordArray + '';
         *     var string = wordArray.toString();
         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
         */
        toString: function (encoder) {
          return (encoder || Hex).stringify(this);
        },

        /**
         * Concatenates a word array to this word array.
         *
         * @param {WordArray} wordArray The word array to append.
         *
         * @return {WordArray} This word array.
         *
         * @example
         *
         *     wordArray1.concat(wordArray2);
         */
        concat: function (wordArray) {
          // Shortcuts
          var thisWords = this.words;
          var thatWords = wordArray.words;
          var thisSigBytes = this.sigBytes;
          var thatSigBytes = wordArray.sigBytes;

          // Clamp excess bits
          this.clamp();

          // Concat
          if (thisSigBytes % 4) {
            // Copy one byte at a time
            for (var i = 0; i < thatSigBytes; i++) {
              var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
              thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
            }
          } else {
            // Copy one word at a time
            for (var i = 0; i < thatSigBytes; i += 4) {
              thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
            }
          }
          this.sigBytes += thatSigBytes;

          // Chainable
          return this;
        },

        /**
         * Removes insignificant bits.
         *
         * @example
         *
         *     wordArray.clamp();
         */
        clamp: function () {
          // Shortcuts
          var words = this.words;
          var sigBytes = this.sigBytes;

          // Clamp
          words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
          words.length = Math.ceil(sigBytes / 4);
        },

        /**
         * Creates a copy of this word array.
         *
         * @return {WordArray} The clone.
         *
         * @example
         *
         *     var clone = wordArray.clone();
         */
        clone: function () {
          var clone = Base.clone.call(this);
          clone.words = this.words.slice(0);

          return clone;
        },

        /**
         * Creates a word array filled with random bytes.
         *
         * @param {number} nBytes The number of random bytes to generate.
         *
         * @return {WordArray} The random word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.random(16);
         */
        random: function (nBytes) {
          var words = [];

          var r = (function (m_w) {
            var m_w = m_w;
            var m_z = 0x3ade68b1;
            var mask = 0xffffffff;

            return function () {
              m_z = (0x9069 * (m_z & 0xFFFF) + (m_z >> 0x10)) & mask;
              m_w = (0x4650 * (m_w & 0xFFFF) + (m_w >> 0x10)) & mask;
              var result = ((m_z << 0x10) + m_w) & mask;
              result /= 0x100000000;
              result += 0.5;
              return result * (Math.random() > .5 ? 1 : -1);
            }
          });

          for (var i = 0, rcache; i < nBytes; i += 4) {
            var _r = r((rcache || Math.random()) * 0x100000000);

            rcache = _r() * 0x3ade67b7;
            words.push((_r() * 0x100000000) | 0);
          }

          return new WordArray.init(words, nBytes);
        }
      });

      /**
       * Encoder namespace.
       */
      var C_enc = C.enc = {};

      /**
       * Hex encoding strategy.
       */
      var Hex = C_enc.Hex = {
        /**
         * Converts a word array to a hex string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The hex string.
         *
         * @static
         *
         * @example
         *
         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var hexChars = [];
          for (var i = 0; i < sigBytes; i++) {
            var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            hexChars.push((bite >>> 4).toString(16));
            hexChars.push((bite & 0x0f).toString(16));
          }

          return hexChars.join('');
        },

        /**
         * Converts a hex string to a word array.
         *
         * @param {string} hexStr The hex string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
         */
        parse: function (hexStr) {
          // Shortcut
          var hexStrLength = hexStr.length;

          // Convert
          var words = [];
          for (var i = 0; i < hexStrLength; i += 2) {
            words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
          }

          return new WordArray.init(words, hexStrLength / 2);
        }
      };

      /**
       * Latin1 encoding strategy.
       */
      var Latin1 = C_enc.Latin1 = {
        /**
         * Converts a word array to a Latin1 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Latin1 string.
         *
         * @static
         *
         * @example
         *
         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var latin1Chars = [];
          for (var i = 0; i < sigBytes; i++) {
            var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
            latin1Chars.push(String.fromCharCode(bite));
          }

          return latin1Chars.join('');
        },

        /**
         * Converts a Latin1 string to a word array.
         *
         * @param {string} latin1Str The Latin1 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
         */
        parse: function (latin1Str) {
          // Shortcut
          var latin1StrLength = latin1Str.length;

          // Convert
          var words = [];
          for (var i = 0; i < latin1StrLength; i++) {
            words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
          }

          return new WordArray.init(words, latin1StrLength);
        }
      };

      /**
       * UTF-8 encoding strategy.
       */
      var Utf8 = C_enc.Utf8 = {
        /**
         * Converts a word array to a UTF-8 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The UTF-8 string.
         *
         * @static
         *
         * @example
         *
         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
         */
        stringify: function (wordArray) {
          try {
            return decodeURIComponent(escape(Latin1.stringify(wordArray)));
          } catch (e) {
            throw new Error('Malformed UTF-8 data');
          }
        },

        /**
         * Converts a UTF-8 string to a word array.
         *
         * @param {string} utf8Str The UTF-8 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
         */
        parse: function (utf8Str) {
          return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
        }
      };

      /**
       * Abstract buffered block algorithm template.
       *
       * The property blockSize must be implemented in a concrete subtype.
       *
       * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
       */
      var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
        /**
         * Resets this block algorithm's data buffer to its initial state.
         *
         * @example
         *
         *     bufferedBlockAlgorithm.reset();
         */
        reset: function () {
          // Initial values
          this._data = new WordArray.init();
          this._nDataBytes = 0;
        },

        /**
         * Adds new data to this block algorithm's buffer.
         *
         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
         *
         * @example
         *
         *     bufferedBlockAlgorithm._append('data');
         *     bufferedBlockAlgorithm._append(wordArray);
         */
        _append: function (data) {
          // Convert string to WordArray, else assume WordArray already
          if (typeof data == 'string') {
            data = Utf8.parse(data);
          }

          // Append
          this._data.concat(data);
          this._nDataBytes += data.sigBytes;
        },

        /**
         * Processes available data blocks.
         *
         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
         *
         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
         *
         * @return {WordArray} The processed data.
         *
         * @example
         *
         *     var processedData = bufferedBlockAlgorithm._process();
         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
         */
        _process: function (doFlush) {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;
          var dataSigBytes = data.sigBytes;
          var blockSize = this.blockSize;
          var blockSizeBytes = blockSize * 4;

          // Count blocks ready
          var nBlocksReady = dataSigBytes / blockSizeBytes;
          if (doFlush) {
            // Round up to include partial blocks
            nBlocksReady = Math.ceil(nBlocksReady);
          } else {
            // Round down to include only full blocks,
            // less the number of blocks that must remain in the buffer
            nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
          }

          // Count words ready
          var nWordsReady = nBlocksReady * blockSize;

          // Count bytes ready
          var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

          // Process blocks
          if (nWordsReady) {
            for (var offset = 0; offset < nWordsReady; offset += blockSize) {
              // Perform concrete-algorithm logic
              this._doProcessBlock(dataWords, offset);
            }

            // Remove processed words
            var processedWords = dataWords.splice(0, nWordsReady);
            data.sigBytes -= nBytesReady;
          }

          // Return processed words
          return new WordArray.init(processedWords, nBytesReady);
        },

        /**
         * Creates a copy of this object.
         *
         * @return {Object} The clone.
         *
         * @example
         *
         *     var clone = bufferedBlockAlgorithm.clone();
         */
        clone: function () {
          var clone = Base.clone.call(this);
          clone._data = this._data.clone();

          return clone;
        },

        _minBufferSize: 0
      });

      /**
       * Abstract hasher template.
       *
       * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
       */
      var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         */
        cfg: Base.extend(),

        /**
         * Initializes a newly created hasher.
         *
         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
         *
         * @example
         *
         *     var hasher = CryptoJS.algo.SHA256.create();
         */
        init: function (cfg) {
          // Apply config defaults
          this.cfg = this.cfg.extend(cfg);

          // Set initial values
          this.reset();
        },

        /**
         * Resets this hasher to its initial state.
         *
         * @example
         *
         *     hasher.reset();
         */
        reset: function () {
          // Reset data buffer
          BufferedBlockAlgorithm.reset.call(this);

          // Perform concrete-hasher logic
          this._doReset();
        },

        /**
         * Updates this hasher with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {Hasher} This hasher.
         *
         * @example
         *
         *     hasher.update('message');
         *     hasher.update(wordArray);
         */
        update: function (messageUpdate) {
          // Append
          this._append(messageUpdate);

          // Update the hash
          this._process();

          // Chainable
          return this;
        },

        /**
         * Finalizes the hash computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The hash.
         *
         * @example
         *
         *     var hash = hasher.finalize();
         *     var hash = hasher.finalize('message');
         *     var hash = hasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
          // Final message update
          if (messageUpdate) {
            this._append(messageUpdate);
          }

          // Perform concrete-hasher logic
          var hash = this._doFinalize();

          return hash;
        },

        blockSize: 512/32,

        /**
         * Creates a shortcut function to a hasher's object interface.
         *
         * @param {Hasher} hasher The hasher to create a helper for.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
         */
        _createHelper: function (hasher) {
          return function (message, cfg) {
            return new hasher.init(cfg).finalize(message);
          };
        },

        /**
         * Creates a shortcut function to the HMAC's object interface.
         *
         * @param {Hasher} hasher The hasher to use in this HMAC helper.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
         */
        _createHmacHelper: function (hasher) {
          return function (message, key) {
            return new C_algo.HMAC.init(hasher, key).finalize(message);
          };
        }
      });

      /**
       * Algorithm namespace.
       */
      var C_algo = C.algo = {};

      return C;
    }(Math));


    return CryptoJS;

  }));
},{}],5:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var C_enc = C.enc;

      /**
       * Base64 encoding strategy.
       */
      var Base64 = C_enc.Base64 = {
        /**
         * Converts a word array to a Base64 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Base64 string.
         *
         * @static
         *
         * @example
         *
         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;
          var map = this._map;

          // Clamp excess bits
          wordArray.clamp();

          // Convert
          var base64Chars = [];
          for (var i = 0; i < sigBytes; i += 3) {
            var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
            var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
            var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

            var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

            for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
              base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
            }
          }

          // Add padding
          var paddingChar = map.charAt(64);
          if (paddingChar) {
            while (base64Chars.length % 4) {
              base64Chars.push(paddingChar);
            }
          }

          return base64Chars.join('');
        },

        /**
         * Converts a Base64 string to a word array.
         *
         * @param {string} base64Str The Base64 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
         */
        parse: function (base64Str) {
          // Shortcuts
          var base64StrLength = base64Str.length;
          var map = this._map;
          var reverseMap = this._reverseMap;

          if (!reverseMap) {
            reverseMap = this._reverseMap = [];
            for (var j = 0; j < map.length; j++) {
              reverseMap[map.charCodeAt(j)] = j;
            }
          }

          // Ignore padding
          var paddingChar = map.charAt(64);
          if (paddingChar) {
            var paddingIndex = base64Str.indexOf(paddingChar);
            if (paddingIndex !== -1) {
              base64StrLength = paddingIndex;
            }
          }

          // Convert
          return parseLoop(base64Str, base64StrLength, reverseMap);

        },

        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
      };

      function parseLoop(base64Str, base64StrLength, reverseMap) {
        var words = [];
        var nBytes = 0;
        for (var i = 0; i < base64StrLength; i++) {
          if (i % 4) {
            var bits1 = reverseMap[base64Str.charCodeAt(i - 1)] << ((i % 4) * 2);
            var bits2 = reverseMap[base64Str.charCodeAt(i)] >>> (6 - (i % 4) * 2);
            words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
            nBytes++;
          }
        }
        return WordArray.create(words, nBytes);
      }
    }());


    return CryptoJS.enc.Base64;

  }));
},{"./core":4}],6:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var C_enc = C.enc;

      /**
       * UTF-16 BE encoding strategy.
       */
      var Utf16BE = C_enc.Utf16 = C_enc.Utf16BE = {
        /**
         * Converts a word array to a UTF-16 BE string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The UTF-16 BE string.
         *
         * @static
         *
         * @example
         *
         *     var utf16String = CryptoJS.enc.Utf16.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var utf16Chars = [];
          for (var i = 0; i < sigBytes; i += 2) {
            var codePoint = (words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff;
            utf16Chars.push(String.fromCharCode(codePoint));
          }

          return utf16Chars.join('');
        },

        /**
         * Converts a UTF-16 BE string to a word array.
         *
         * @param {string} utf16Str The UTF-16 BE string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Utf16.parse(utf16String);
         */
        parse: function (utf16Str) {
          // Shortcut
          var utf16StrLength = utf16Str.length;

          // Convert
          var words = [];
          for (var i = 0; i < utf16StrLength; i++) {
            words[i >>> 1] |= utf16Str.charCodeAt(i) << (16 - (i % 2) * 16);
          }

          return WordArray.create(words, utf16StrLength * 2);
        }
      };

      /**
       * UTF-16 LE encoding strategy.
       */
      C_enc.Utf16LE = {
        /**
         * Converts a word array to a UTF-16 LE string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The UTF-16 LE string.
         *
         * @static
         *
         * @example
         *
         *     var utf16Str = CryptoJS.enc.Utf16LE.stringify(wordArray);
         */
        stringify: function (wordArray) {
          // Shortcuts
          var words = wordArray.words;
          var sigBytes = wordArray.sigBytes;

          // Convert
          var utf16Chars = [];
          for (var i = 0; i < sigBytes; i += 2) {
            var codePoint = swapEndian((words[i >>> 2] >>> (16 - (i % 4) * 8)) & 0xffff);
            utf16Chars.push(String.fromCharCode(codePoint));
          }

          return utf16Chars.join('');
        },

        /**
         * Converts a UTF-16 LE string to a word array.
         *
         * @param {string} utf16Str The UTF-16 LE string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Utf16LE.parse(utf16Str);
         */
        parse: function (utf16Str) {
          // Shortcut
          var utf16StrLength = utf16Str.length;

          // Convert
          var words = [];
          for (var i = 0; i < utf16StrLength; i++) {
            words[i >>> 1] |= swapEndian(utf16Str.charCodeAt(i) << (16 - (i % 2) * 16));
          }

          return WordArray.create(words, utf16StrLength * 2);
        }
      };

      function swapEndian(word) {
        return ((word << 8) & 0xff00ff00) | ((word >>> 8) & 0x00ff00ff);
      }
    }());


    return CryptoJS.enc.Utf16;

  }));
},{"./core":4}],7:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./sha1"), require("./hmac"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./sha1", "./hmac"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var WordArray = C_lib.WordArray;
      var C_algo = C.algo;
      var MD5 = C_algo.MD5;

      /**
       * This key derivation function is meant to conform with EVP_BytesToKey.
       * www.openssl.org/docs/crypto/EVP_BytesToKey.html
       */
      var EvpKDF = C_algo.EvpKDF = Base.extend({
        /**
         * Configuration options.
         *
         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
         * @property {Hasher} hasher The hash algorithm to use. Default: MD5
         * @property {number} iterations The number of iterations to perform. Default: 1
         */
        cfg: Base.extend({
          keySize: 128/32,
          hasher: MD5,
          iterations: 1
        }),

        /**
         * Initializes a newly created key derivation function.
         *
         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
         *
         * @example
         *
         *     var kdf = CryptoJS.algo.EvpKDF.create();
         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
         */
        init: function (cfg) {
          this.cfg = this.cfg.extend(cfg);
        },

        /**
         * Derives a key from a password.
         *
         * @param {WordArray|string} password The password.
         * @param {WordArray|string} salt A salt.
         *
         * @return {WordArray} The derived key.
         *
         * @example
         *
         *     var key = kdf.compute(password, salt);
         */
        compute: function (password, salt) {
          // Shortcut
          var cfg = this.cfg;

          // Init hasher
          var hasher = cfg.hasher.create();

          // Initial values
          var derivedKey = WordArray.create();

          // Shortcuts
          var derivedKeyWords = derivedKey.words;
          var keySize = cfg.keySize;
          var iterations = cfg.iterations;

          // Generate key
          while (derivedKeyWords.length < keySize) {
            if (block) {
              hasher.update(block);
            }
            var block = hasher.update(password).finalize(salt);
            hasher.reset();

            // Iterations
            for (var i = 1; i < iterations; i++) {
              block = hasher.finalize(block);
              hasher.reset();
            }

            derivedKey.concat(block);
          }
          derivedKey.sigBytes = keySize * 4;

          return derivedKey;
        }
      });

      /**
       * Derives a key from a password.
       *
       * @param {WordArray|string} password The password.
       * @param {WordArray|string} salt A salt.
       * @param {Object} cfg (Optional) The configuration options to use for this computation.
       *
       * @return {WordArray} The derived key.
       *
       * @static
       *
       * @example
       *
       *     var key = CryptoJS.EvpKDF(password, salt);
       *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
       *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
       */
      C.EvpKDF = function (password, salt, cfg) {
        return EvpKDF.create(cfg).compute(password, salt);
      };
    }());


    return CryptoJS.EvpKDF;

  }));
},{"./core":4,"./hmac":9,"./sha1":28}],8:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function (undefined) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var CipherParams = C_lib.CipherParams;
      var C_enc = C.enc;
      var Hex = C_enc.Hex;
      var C_format = C.format;

      var HexFormatter = C_format.Hex = {
        /**
         * Converts the ciphertext of a cipher params object to a hexadecimally encoded string.
         *
         * @param {CipherParams} cipherParams The cipher params object.
         *
         * @return {string} The hexadecimally encoded string.
         *
         * @static
         *
         * @example
         *
         *     var hexString = CryptoJS.format.Hex.stringify(cipherParams);
         */
        stringify: function (cipherParams) {
          return cipherParams.ciphertext.toString(Hex);
        },

        /**
         * Converts a hexadecimally encoded ciphertext string to a cipher params object.
         *
         * @param {string} input The hexadecimally encoded string.
         *
         * @return {CipherParams} The cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var cipherParams = CryptoJS.format.Hex.parse(hexString);
         */
        parse: function (input) {
          var ciphertext = Hex.parse(input);
          return CipherParams.create({ ciphertext: ciphertext });
        }
      };
    }());


    return CryptoJS.format.Hex;

  }));
},{"./cipher-core":3,"./core":4}],9:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var C_enc = C.enc;
      var Utf8 = C_enc.Utf8;
      var C_algo = C.algo;

      /**
       * HMAC algorithm.
       */
      var HMAC = C_algo.HMAC = Base.extend({
        /**
         * Initializes a newly created HMAC.
         *
         * @param {Hasher} hasher The hash algorithm to use.
         * @param {WordArray|string} key The secret key.
         *
         * @example
         *
         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
         */
        init: function (hasher, key) {
          // Init hasher
          hasher = this._hasher = new hasher.init();

          // Convert string to WordArray, else assume WordArray already
          if (typeof key == 'string') {
            key = Utf8.parse(key);
          }

          // Shortcuts
          var hasherBlockSize = hasher.blockSize;
          var hasherBlockSizeBytes = hasherBlockSize * 4;

          // Allow arbitrary length keys
          if (key.sigBytes > hasherBlockSizeBytes) {
            key = hasher.finalize(key);
          }

          // Clamp excess bits
          key.clamp();

          // Clone key for inner and outer pads
          var oKey = this._oKey = key.clone();
          var iKey = this._iKey = key.clone();

          // Shortcuts
          var oKeyWords = oKey.words;
          var iKeyWords = iKey.words;

          // XOR keys with pad constants
          for (var i = 0; i < hasherBlockSize; i++) {
            oKeyWords[i] ^= 0x5c5c5c5c;
            iKeyWords[i] ^= 0x36363636;
          }
          oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

          // Set initial values
          this.reset();
        },

        /**
         * Resets this HMAC to its initial state.
         *
         * @example
         *
         *     hmacHasher.reset();
         */
        reset: function () {
          // Shortcut
          var hasher = this._hasher;

          // Reset
          hasher.reset();
          hasher.update(this._iKey);
        },

        /**
         * Updates this HMAC with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {HMAC} This HMAC instance.
         *
         * @example
         *
         *     hmacHasher.update('message');
         *     hmacHasher.update(wordArray);
         */
        update: function (messageUpdate) {
          this._hasher.update(messageUpdate);

          // Chainable
          return this;
        },

        /**
         * Finalizes the HMAC computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The HMAC.
         *
         * @example
         *
         *     var hmac = hmacHasher.finalize();
         *     var hmac = hmacHasher.finalize('message');
         *     var hmac = hmacHasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
          // Shortcut
          var hasher = this._hasher;

          // Compute HMAC
          var innerHash = hasher.finalize(messageUpdate);
          hasher.reset();
          var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

          return hmac;
        }
      });
    }());


  }));
},{"./core":4}],10:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./x64-core"), require("./lib-typedarrays"), require("./enc-utf16"), require("./enc-base64"), require("./md5"), require("./sha1"), require("./sha256"), require("./sha224"), require("./sha512"), require("./sha384"), require("./sha3"), require("./ripemd160"), require("./hmac"), require("./pbkdf2"), require("./evpkdf"), require("./cipher-core"), require("./mode-cfb"), require("./mode-ctr"), require("./mode-ctr-gladman"), require("./mode-ofb"), require("./mode-ecb"), require("./pad-ansix923"), require("./pad-iso10126"), require("./pad-iso97971"), require("./pad-zeropadding"), require("./pad-nopadding"), require("./format-hex"), require("./aes"), require("./tripledes"), require("./rc4"), require("./rabbit"), require("./rabbit-legacy"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./x64-core", "./lib-typedarrays", "./enc-utf16", "./enc-base64", "./md5", "./sha1", "./sha256", "./sha224", "./sha512", "./sha384", "./sha3", "./ripemd160", "./hmac", "./pbkdf2", "./evpkdf", "./cipher-core", "./mode-cfb", "./mode-ctr", "./mode-ctr-gladman", "./mode-ofb", "./mode-ecb", "./pad-ansix923", "./pad-iso10126", "./pad-iso97971", "./pad-zeropadding", "./pad-nopadding", "./format-hex", "./aes", "./tripledes", "./rc4", "./rabbit", "./rabbit-legacy"], factory);
    }
    else {
      // Global (browser)
      root.CryptoJS = factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    return CryptoJS;

  }));
},{"./aes":2,"./cipher-core":3,"./core":4,"./enc-base64":5,"./enc-utf16":6,"./evpkdf":7,"./format-hex":8,"./hmac":9,"./lib-typedarrays":11,"./md5":12,"./mode-cfb":13,"./mode-ctr":15,"./mode-ctr-gladman":14,"./mode-ecb":16,"./mode-ofb":17,"./pad-ansix923":18,"./pad-iso10126":19,"./pad-iso97971":20,"./pad-nopadding":21,"./pad-zeropadding":22,"./pbkdf2":23,"./rabbit":25,"./rabbit-legacy":24,"./rc4":26,"./ripemd160":27,"./sha1":28,"./sha224":29,"./sha256":30,"./sha3":31,"./sha384":32,"./sha512":33,"./tripledes":34,"./x64-core":35}],11:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Check if typed arrays are supported
      if (typeof ArrayBuffer != 'function') {
        return;
      }

      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;

      // Reference original init
      var superInit = WordArray.init;

      // Augment WordArray.init to handle typed arrays
      var subInit = WordArray.init = function (typedArray) {
        // Convert buffers to uint8
        if (typedArray instanceof ArrayBuffer) {
          typedArray = new Uint8Array(typedArray);
        }

        // Convert other array views to uint8
        if (
          typedArray instanceof Int8Array ||
          (typeof Uint8ClampedArray !== "undefined" && typedArray instanceof Uint8ClampedArray) ||
          typedArray instanceof Int16Array ||
          typedArray instanceof Uint16Array ||
          typedArray instanceof Int32Array ||
          typedArray instanceof Uint32Array ||
          typedArray instanceof Float32Array ||
          typedArray instanceof Float64Array
        ) {
          typedArray = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
        }

        // Handle Uint8Array
        if (typedArray instanceof Uint8Array) {
          // Shortcut
          var typedArrayByteLength = typedArray.byteLength;

          // Extract bytes
          var words = [];
          for (var i = 0; i < typedArrayByteLength; i++) {
            words[i >>> 2] |= typedArray[i] << (24 - (i % 4) * 8);
          }

          // Initialize this word array
          superInit.call(this, words, typedArrayByteLength);
        } else {
          // Else call normal init
          superInit.apply(this, arguments);
        }
      };

      subInit.prototype = WordArray;
    }());


    return CryptoJS.lib.WordArray;

  }));
},{"./core":4}],12:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function (Math) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var Hasher = C_lib.Hasher;
      var C_algo = C.algo;

      // Constants table
      var T = [];

      // Compute constants
      (function () {
        for (var i = 0; i < 64; i++) {
          T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
        }
      }());

      /**
       * MD5 hash algorithm.
       */
      var MD5 = C_algo.MD5 = Hasher.extend({
        _doReset: function () {
          this._hash = new WordArray.init([
            0x67452301, 0xefcdab89,
            0x98badcfe, 0x10325476
          ]);
        },

        _doProcessBlock: function (M, offset) {
          // Swap endian
          for (var i = 0; i < 16; i++) {
            // Shortcuts
            var offset_i = offset + i;
            var M_offset_i = M[offset_i];

            M[offset_i] = (
              (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
              (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
            );
          }

          // Shortcuts
          var H = this._hash.words;

          var M_offset_0  = M[offset + 0];
          var M_offset_1  = M[offset + 1];
          var M_offset_2  = M[offset + 2];
          var M_offset_3  = M[offset + 3];
          var M_offset_4  = M[offset + 4];
          var M_offset_5  = M[offset + 5];
          var M_offset_6  = M[offset + 6];
          var M_offset_7  = M[offset + 7];
          var M_offset_8  = M[offset + 8];
          var M_offset_9  = M[offset + 9];
          var M_offset_10 = M[offset + 10];
          var M_offset_11 = M[offset + 11];
          var M_offset_12 = M[offset + 12];
          var M_offset_13 = M[offset + 13];
          var M_offset_14 = M[offset + 14];
          var M_offset_15 = M[offset + 15];

          // Working varialbes
          var a = H[0];
          var b = H[1];
          var c = H[2];
          var d = H[3];

          // Computation
          a = FF(a, b, c, d, M_offset_0,  7,  T[0]);
          d = FF(d, a, b, c, M_offset_1,  12, T[1]);
          c = FF(c, d, a, b, M_offset_2,  17, T[2]);
          b = FF(b, c, d, a, M_offset_3,  22, T[3]);
          a = FF(a, b, c, d, M_offset_4,  7,  T[4]);
          d = FF(d, a, b, c, M_offset_5,  12, T[5]);
          c = FF(c, d, a, b, M_offset_6,  17, T[6]);
          b = FF(b, c, d, a, M_offset_7,  22, T[7]);
          a = FF(a, b, c, d, M_offset_8,  7,  T[8]);
          d = FF(d, a, b, c, M_offset_9,  12, T[9]);
          c = FF(c, d, a, b, M_offset_10, 17, T[10]);
          b = FF(b, c, d, a, M_offset_11, 22, T[11]);
          a = FF(a, b, c, d, M_offset_12, 7,  T[12]);
          d = FF(d, a, b, c, M_offset_13, 12, T[13]);
          c = FF(c, d, a, b, M_offset_14, 17, T[14]);
          b = FF(b, c, d, a, M_offset_15, 22, T[15]);

          a = GG(a, b, c, d, M_offset_1,  5,  T[16]);
          d = GG(d, a, b, c, M_offset_6,  9,  T[17]);
          c = GG(c, d, a, b, M_offset_11, 14, T[18]);
          b = GG(b, c, d, a, M_offset_0,  20, T[19]);
          a = GG(a, b, c, d, M_offset_5,  5,  T[20]);
          d = GG(d, a, b, c, M_offset_10, 9,  T[21]);
          c = GG(c, d, a, b, M_offset_15, 14, T[22]);
          b = GG(b, c, d, a, M_offset_4,  20, T[23]);
          a = GG(a, b, c, d, M_offset_9,  5,  T[24]);
          d = GG(d, a, b, c, M_offset_14, 9,  T[25]);
          c = GG(c, d, a, b, M_offset_3,  14, T[26]);
          b = GG(b, c, d, a, M_offset_8,  20, T[27]);
          a = GG(a, b, c, d, M_offset_13, 5,  T[28]);
          d = GG(d, a, b, c, M_offset_2,  9,  T[29]);
          c = GG(c, d, a, b, M_offset_7,  14, T[30]);
          b = GG(b, c, d, a, M_offset_12, 20, T[31]);

          a = HH(a, b, c, d, M_offset_5,  4,  T[32]);
          d = HH(d, a, b, c, M_offset_8,  11, T[33]);
          c = HH(c, d, a, b, M_offset_11, 16, T[34]);
          b = HH(b, c, d, a, M_offset_14, 23, T[35]);
          a = HH(a, b, c, d, M_offset_1,  4,  T[36]);
          d = HH(d, a, b, c, M_offset_4,  11, T[37]);
          c = HH(c, d, a, b, M_offset_7,  16, T[38]);
          b = HH(b, c, d, a, M_offset_10, 23, T[39]);
          a = HH(a, b, c, d, M_offset_13, 4,  T[40]);
          d = HH(d, a, b, c, M_offset_0,  11, T[41]);
          c = HH(c, d, a, b, M_offset_3,  16, T[42]);
          b = HH(b, c, d, a, M_offset_6,  23, T[43]);
          a = HH(a, b, c, d, M_offset_9,  4,  T[44]);
          d = HH(d, a, b, c, M_offset_12, 11, T[45]);
          c = HH(c, d, a, b, M_offset_15, 16, T[46]);
          b = HH(b, c, d, a, M_offset_2,  23, T[47]);

          a = II(a, b, c, d, M_offset_0,  6,  T[48]);
          d = II(d, a, b, c, M_offset_7,  10, T[49]);
          c = II(c, d, a, b, M_offset_14, 15, T[50]);
          b = II(b, c, d, a, M_offset_5,  21, T[51]);
          a = II(a, b, c, d, M_offset_12, 6,  T[52]);
          d = II(d, a, b, c, M_offset_3,  10, T[53]);
          c = II(c, d, a, b, M_offset_10, 15, T[54]);
          b = II(b, c, d, a, M_offset_1,  21, T[55]);
          a = II(a, b, c, d, M_offset_8,  6,  T[56]);
          d = II(d, a, b, c, M_offset_15, 10, T[57]);
          c = II(c, d, a, b, M_offset_6,  15, T[58]);
          b = II(b, c, d, a, M_offset_13, 21, T[59]);
          a = II(a, b, c, d, M_offset_4,  6,  T[60]);
          d = II(d, a, b, c, M_offset_11, 10, T[61]);
          c = II(c, d, a, b, M_offset_2,  15, T[62]);
          b = II(b, c, d, a, M_offset_9,  21, T[63]);

          // Intermediate hash value
          H[0] = (H[0] + a) | 0;
          H[1] = (H[1] + b) | 0;
          H[2] = (H[2] + c) | 0;
          H[3] = (H[3] + d) | 0;
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;

          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);

          var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
          var nBitsTotalL = nBitsTotal;
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = (
            (((nBitsTotalH << 8)  | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
            (((nBitsTotalH << 24) | (nBitsTotalH >>> 8))  & 0xff00ff00)
          );
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
            (((nBitsTotalL << 8)  | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
            (((nBitsTotalL << 24) | (nBitsTotalL >>> 8))  & 0xff00ff00)
          );

          data.sigBytes = (dataWords.length + 1) * 4;

          // Hash final blocks
          this._process();

          // Shortcuts
          var hash = this._hash;
          var H = hash.words;

          // Swap endian
          for (var i = 0; i < 4; i++) {
            // Shortcut
            var H_i = H[i];

            H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
              (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
          }

          // Return final computed hash
          return hash;
        },

        clone: function () {
          var clone = Hasher.clone.call(this);
          clone._hash = this._hash.clone();

          return clone;
        }
      });

      function FF(a, b, c, d, x, s, t) {
        var n = a + ((b & c) | (~b & d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      }

      function GG(a, b, c, d, x, s, t) {
        var n = a + ((b & d) | (c & ~d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      }

      function HH(a, b, c, d, x, s, t) {
        var n = a + (b ^ c ^ d) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      }

      function II(a, b, c, d, x, s, t) {
        var n = a + (c ^ (b | ~d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
      }

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.MD5('message');
       *     var hash = CryptoJS.MD5(wordArray);
       */
      C.MD5 = Hasher._createHelper(MD5);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacMD5(message, key);
       */
      C.HmacMD5 = Hasher._createHmacHelper(MD5);
    }(Math));


    return CryptoJS.MD5;

  }));
},{"./core":4}],13:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Cipher Feedback block mode.
     */
    CryptoJS.mode.CFB = (function () {
      var CFB = CryptoJS.lib.BlockCipherMode.extend();

      CFB.Encryptor = CFB.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

          // Remember this block to use with next block
          this._prevBlock = words.slice(offset, offset + blockSize);
        }
      });

      CFB.Decryptor = CFB.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher;
          var blockSize = cipher.blockSize;

          // Remember this block to use with next block
          var thisBlock = words.slice(offset, offset + blockSize);

          generateKeystreamAndEncrypt.call(this, words, offset, blockSize, cipher);

          // This block becomes the previous block
          this._prevBlock = thisBlock;
        }
      });

      function generateKeystreamAndEncrypt(words, offset, blockSize, cipher) {
        // Shortcut
        var iv = this._iv;

        // Generate keystream
        if (iv) {
          var keystream = iv.slice(0);

          // Remove IV for subsequent blocks
          this._iv = undefined;
        } else {
          var keystream = this._prevBlock;
        }
        cipher.encryptBlock(keystream, 0);

        // Encrypt
        for (var i = 0; i < blockSize; i++) {
          words[offset + i] ^= keystream[i];
        }
      }

      return CFB;
    }());


    return CryptoJS.mode.CFB;

  }));
},{"./cipher-core":3,"./core":4}],14:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /** @preserve
     * Counter block mode compatible with  Dr Brian Gladman fileenc.c
     * derived from CryptoJS.mode.CTR
     * Jan Hruby jhruby.web@gmail.com
     */
    CryptoJS.mode.CTRGladman = (function () {
      var CTRGladman = CryptoJS.lib.BlockCipherMode.extend();

      function incWord(word)
      {
        if (((word >> 24) & 0xff) === 0xff) { //overflow
          var b1 = (word >> 16)&0xff;
          var b2 = (word >> 8)&0xff;
          var b3 = word & 0xff;

          if (b1 === 0xff) // overflow b1
          {
            b1 = 0;
            if (b2 === 0xff)
            {
              b2 = 0;
              if (b3 === 0xff)
              {
                b3 = 0;
              }
              else
              {
                ++b3;
              }
            }
            else
            {
              ++b2;
            }
          }
          else
          {
            ++b1;
          }

          word = 0;
          word += (b1 << 16);
          word += (b2 << 8);
          word += b3;
        }
        else
        {
          word += (0x01 << 24);
        }
        return word;
      }

      function incCounter(counter)
      {
        if ((counter[0] = incWord(counter[0])) === 0)
        {
          // encr_data in fileenc.c from  Dr Brian Gladman's counts only with DWORD j < 8
          counter[1] = incWord(counter[1]);
        }
        return counter;
      }

      var Encryptor = CTRGladman.Encryptor = CTRGladman.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher
          var blockSize = cipher.blockSize;
          var iv = this._iv;
          var counter = this._counter;

          // Generate keystream
          if (iv) {
            counter = this._counter = iv.slice(0);

            // Remove IV for subsequent blocks
            this._iv = undefined;
          }

          incCounter(counter);

          var keystream = counter.slice(0);
          cipher.encryptBlock(keystream, 0);

          // Encrypt
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= keystream[i];
          }
        }
      });

      CTRGladman.Decryptor = Encryptor;

      return CTRGladman;
    }());




    return CryptoJS.mode.CTRGladman;

  }));
},{"./cipher-core":3,"./core":4}],15:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Counter block mode.
     */
    CryptoJS.mode.CTR = (function () {
      var CTR = CryptoJS.lib.BlockCipherMode.extend();

      var Encryptor = CTR.Encryptor = CTR.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher
          var blockSize = cipher.blockSize;
          var iv = this._iv;
          var counter = this._counter;

          // Generate keystream
          if (iv) {
            counter = this._counter = iv.slice(0);

            // Remove IV for subsequent blocks
            this._iv = undefined;
          }
          var keystream = counter.slice(0);
          cipher.encryptBlock(keystream, 0);

          // Increment counter
          counter[blockSize - 1] = (counter[blockSize - 1] + 1) | 0

          // Encrypt
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= keystream[i];
          }
        }
      });

      CTR.Decryptor = Encryptor;

      return CTR;
    }());


    return CryptoJS.mode.CTR;

  }));
},{"./cipher-core":3,"./core":4}],16:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Electronic Codebook block mode.
     */
    CryptoJS.mode.ECB = (function () {
      var ECB = CryptoJS.lib.BlockCipherMode.extend();

      ECB.Encryptor = ECB.extend({
        processBlock: function (words, offset) {
          this._cipher.encryptBlock(words, offset);
        }
      });

      ECB.Decryptor = ECB.extend({
        processBlock: function (words, offset) {
          this._cipher.decryptBlock(words, offset);
        }
      });

      return ECB;
    }());


    return CryptoJS.mode.ECB;

  }));
},{"./cipher-core":3,"./core":4}],17:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Output Feedback block mode.
     */
    CryptoJS.mode.OFB = (function () {
      var OFB = CryptoJS.lib.BlockCipherMode.extend();

      var Encryptor = OFB.Encryptor = OFB.extend({
        processBlock: function (words, offset) {
          // Shortcuts
          var cipher = this._cipher
          var blockSize = cipher.blockSize;
          var iv = this._iv;
          var keystream = this._keystream;

          // Generate keystream
          if (iv) {
            keystream = this._keystream = iv.slice(0);

            // Remove IV for subsequent blocks
            this._iv = undefined;
          }
          cipher.encryptBlock(keystream, 0);

          // Encrypt
          for (var i = 0; i < blockSize; i++) {
            words[offset + i] ^= keystream[i];
          }
        }
      });

      OFB.Decryptor = Encryptor;

      return OFB;
    }());


    return CryptoJS.mode.OFB;

  }));
},{"./cipher-core":3,"./core":4}],18:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * ANSI X.923 padding strategy.
     */
    CryptoJS.pad.AnsiX923 = {
      pad: function (data, blockSize) {
        // Shortcuts
        var dataSigBytes = data.sigBytes;
        var blockSizeBytes = blockSize * 4;

        // Count padding bytes
        var nPaddingBytes = blockSizeBytes - dataSigBytes % blockSizeBytes;

        // Compute last byte position
        var lastBytePos = dataSigBytes + nPaddingBytes - 1;

        // Pad
        data.clamp();
        data.words[lastBytePos >>> 2] |= nPaddingBytes << (24 - (lastBytePos % 4) * 8);
        data.sigBytes += nPaddingBytes;
      },

      unpad: function (data) {
        // Get number of padding bytes from last byte
        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

        // Remove padding
        data.sigBytes -= nPaddingBytes;
      }
    };


    return CryptoJS.pad.Ansix923;

  }));
},{"./cipher-core":3,"./core":4}],19:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * ISO 10126 padding strategy.
     */
    CryptoJS.pad.Iso10126 = {
      pad: function (data, blockSize) {
        // Shortcut
        var blockSizeBytes = blockSize * 4;

        // Count padding bytes
        var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

        // Pad
        data.concat(CryptoJS.lib.WordArray.random(nPaddingBytes - 1)).
        concat(CryptoJS.lib.WordArray.create([nPaddingBytes << 24], 1));
      },

      unpad: function (data) {
        // Get number of padding bytes from last byte
        var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

        // Remove padding
        data.sigBytes -= nPaddingBytes;
      }
    };


    return CryptoJS.pad.Iso10126;

  }));
},{"./cipher-core":3,"./core":4}],20:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * ISO/IEC 9797-1 Padding Method 2.
     */
    CryptoJS.pad.Iso97971 = {
      pad: function (data, blockSize) {
        // Add 0x80 byte
        data.concat(CryptoJS.lib.WordArray.create([0x80000000], 1));

        // Zero pad the rest
        CryptoJS.pad.ZeroPadding.pad(data, blockSize);
      },

      unpad: function (data) {
        // Remove zero padding
        CryptoJS.pad.ZeroPadding.unpad(data);

        // Remove one more byte -- the 0x80 byte
        data.sigBytes--;
      }
    };


    return CryptoJS.pad.Iso97971;

  }));
},{"./cipher-core":3,"./core":4}],21:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * A noop padding strategy.
     */
    CryptoJS.pad.NoPadding = {
      pad: function () {
      },

      unpad: function () {
      }
    };


    return CryptoJS.pad.NoPadding;

  }));
},{"./cipher-core":3,"./core":4}],22:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /**
     * Zero padding strategy.
     */
    CryptoJS.pad.ZeroPadding = {
      pad: function (data, blockSize) {
        // Shortcut
        var blockSizeBytes = blockSize * 4;

        // Pad
        data.clamp();
        data.sigBytes += blockSizeBytes - ((data.sigBytes % blockSizeBytes) || blockSizeBytes);
      },

      unpad: function (data) {
        // Shortcut
        var dataWords = data.words;

        // Unpad
        var i = data.sigBytes - 1;
        while (!((dataWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff)) {
          i--;
        }
        data.sigBytes = i + 1;
      }
    };


    return CryptoJS.pad.ZeroPadding;

  }));
},{"./cipher-core":3,"./core":4}],23:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./sha1"), require("./hmac"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./sha1", "./hmac"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var WordArray = C_lib.WordArray;
      var C_algo = C.algo;
      var SHA1 = C_algo.SHA1;
      var HMAC = C_algo.HMAC;

      /**
       * Password-Based Key Derivation Function 2 algorithm.
       */
      var PBKDF2 = C_algo.PBKDF2 = Base.extend({
        /**
         * Configuration options.
         *
         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
         * @property {Hasher} hasher The hasher to use. Default: SHA1
         * @property {number} iterations The number of iterations to perform. Default: 1
         */
        cfg: Base.extend({
          keySize: 128/32,
          hasher: SHA1,
          iterations: 1
        }),

        /**
         * Initializes a newly created key derivation function.
         *
         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
         *
         * @example
         *
         *     var kdf = CryptoJS.algo.PBKDF2.create();
         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8 });
         *     var kdf = CryptoJS.algo.PBKDF2.create({ keySize: 8, iterations: 1000 });
         */
        init: function (cfg) {
          this.cfg = this.cfg.extend(cfg);
        },

        /**
         * Computes the Password-Based Key Derivation Function 2.
         *
         * @param {WordArray|string} password The password.
         * @param {WordArray|string} salt A salt.
         *
         * @return {WordArray} The derived key.
         *
         * @example
         *
         *     var key = kdf.compute(password, salt);
         */
        compute: function (password, salt) {
          // Shortcut
          var cfg = this.cfg;

          // Init HMAC
          var hmac = HMAC.create(cfg.hasher, password);

          // Initial values
          var derivedKey = WordArray.create();
          var blockIndex = WordArray.create([0x00000001]);

          // Shortcuts
          var derivedKeyWords = derivedKey.words;
          var blockIndexWords = blockIndex.words;
          var keySize = cfg.keySize;
          var iterations = cfg.iterations;

          // Generate key
          while (derivedKeyWords.length < keySize) {
            var block = hmac.update(salt).finalize(blockIndex);
            hmac.reset();

            // Shortcuts
            var blockWords = block.words;
            var blockWordsLength = blockWords.length;

            // Iterations
            var intermediate = block;
            for (var i = 1; i < iterations; i++) {
              intermediate = hmac.finalize(intermediate);
              hmac.reset();

              // Shortcut
              var intermediateWords = intermediate.words;

              // XOR intermediate with block
              for (var j = 0; j < blockWordsLength; j++) {
                blockWords[j] ^= intermediateWords[j];
              }
            }

            derivedKey.concat(block);
            blockIndexWords[0]++;
          }
          derivedKey.sigBytes = keySize * 4;

          return derivedKey;
        }
      });

      /**
       * Computes the Password-Based Key Derivation Function 2.
       *
       * @param {WordArray|string} password The password.
       * @param {WordArray|string} salt A salt.
       * @param {Object} cfg (Optional) The configuration options to use for this computation.
       *
       * @return {WordArray} The derived key.
       *
       * @static
       *
       * @example
       *
       *     var key = CryptoJS.PBKDF2(password, salt);
       *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8 });
       *     var key = CryptoJS.PBKDF2(password, salt, { keySize: 8, iterations: 1000 });
       */
      C.PBKDF2 = function (password, salt, cfg) {
        return PBKDF2.create(cfg).compute(password, salt);
      };
    }());


    return CryptoJS.PBKDF2;

  }));
},{"./core":4,"./hmac":9,"./sha1":28}],24:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var StreamCipher = C_lib.StreamCipher;
      var C_algo = C.algo;

      // Reusable objects
      var S  = [];
      var C_ = [];
      var G  = [];

      /**
       * Rabbit stream cipher algorithm.
       *
       * This is a legacy version that neglected to convert the key to little-endian.
       * This error doesn't affect the cipher's security,
       * but it does affect its compatibility with other implementations.
       */
      var RabbitLegacy = C_algo.RabbitLegacy = StreamCipher.extend({
        _doReset: function () {
          // Shortcuts
          var K = this._key.words;
          var iv = this.cfg.iv;

          // Generate initial state values
          var X = this._X = [
            K[0], (K[3] << 16) | (K[2] >>> 16),
            K[1], (K[0] << 16) | (K[3] >>> 16),
            K[2], (K[1] << 16) | (K[0] >>> 16),
            K[3], (K[2] << 16) | (K[1] >>> 16)
          ];

          // Generate initial counter values
          var C = this._C = [
            (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
            (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
            (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
            (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
          ];

          // Carry bit
          this._b = 0;

          // Iterate the system four times
          for (var i = 0; i < 4; i++) {
            nextState.call(this);
          }

          // Modify the counters
          for (var i = 0; i < 8; i++) {
            C[i] ^= X[(i + 4) & 7];
          }

          // IV setup
          if (iv) {
            // Shortcuts
            var IV = iv.words;
            var IV_0 = IV[0];
            var IV_1 = IV[1];

            // Generate four subvectors
            var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
            var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
            var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
            var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

            // Modify counter values
            C[0] ^= i0;
            C[1] ^= i1;
            C[2] ^= i2;
            C[3] ^= i3;
            C[4] ^= i0;
            C[5] ^= i1;
            C[6] ^= i2;
            C[7] ^= i3;

            // Iterate the system four times
            for (var i = 0; i < 4; i++) {
              nextState.call(this);
            }
          }
        },

        _doProcessBlock: function (M, offset) {
          // Shortcut
          var X = this._X;

          // Iterate the system
          nextState.call(this);

          // Generate four keystream words
          S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
          S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
          S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
          S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

          for (var i = 0; i < 4; i++) {
            // Swap endian
            S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
              (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

            // Encrypt
            M[offset + i] ^= S[i];
          }
        },

        blockSize: 128/32,

        ivSize: 64/32
      });

      function nextState() {
        // Shortcuts
        var X = this._X;
        var C = this._C;

        // Save old counter values
        for (var i = 0; i < 8; i++) {
          C_[i] = C[i];
        }

        // Calculate new counter values
        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

        // Calculate the g-values
        for (var i = 0; i < 8; i++) {
          var gx = X[i] + C[i];

          // Construct high and low argument for squaring
          var ga = gx & 0xffff;
          var gb = gx >>> 16;

          // Calculate high and low result of squaring
          var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
          var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

          // High XOR low
          G[i] = gh ^ gl;
        }

        // Calculate new state values
        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
      }

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.RabbitLegacy.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.RabbitLegacy.decrypt(ciphertext, key, cfg);
       */
      C.RabbitLegacy = StreamCipher._createHelper(RabbitLegacy);
    }());


    return CryptoJS.RabbitLegacy;

  }));
},{"./cipher-core":3,"./core":4,"./enc-base64":5,"./evpkdf":7,"./md5":12}],25:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var StreamCipher = C_lib.StreamCipher;
      var C_algo = C.algo;

      // Reusable objects
      var S  = [];
      var C_ = [];
      var G  = [];

      /**
       * Rabbit stream cipher algorithm
       */
      var Rabbit = C_algo.Rabbit = StreamCipher.extend({
        _doReset: function () {
          // Shortcuts
          var K = this._key.words;
          var iv = this.cfg.iv;

          // Swap endian
          for (var i = 0; i < 4; i++) {
            K[i] = (((K[i] << 8)  | (K[i] >>> 24)) & 0x00ff00ff) |
              (((K[i] << 24) | (K[i] >>> 8))  & 0xff00ff00);
          }

          // Generate initial state values
          var X = this._X = [
            K[0], (K[3] << 16) | (K[2] >>> 16),
            K[1], (K[0] << 16) | (K[3] >>> 16),
            K[2], (K[1] << 16) | (K[0] >>> 16),
            K[3], (K[2] << 16) | (K[1] >>> 16)
          ];

          // Generate initial counter values
          var C = this._C = [
            (K[2] << 16) | (K[2] >>> 16), (K[0] & 0xffff0000) | (K[1] & 0x0000ffff),
            (K[3] << 16) | (K[3] >>> 16), (K[1] & 0xffff0000) | (K[2] & 0x0000ffff),
            (K[0] << 16) | (K[0] >>> 16), (K[2] & 0xffff0000) | (K[3] & 0x0000ffff),
            (K[1] << 16) | (K[1] >>> 16), (K[3] & 0xffff0000) | (K[0] & 0x0000ffff)
          ];

          // Carry bit
          this._b = 0;

          // Iterate the system four times
          for (var i = 0; i < 4; i++) {
            nextState.call(this);
          }

          // Modify the counters
          for (var i = 0; i < 8; i++) {
            C[i] ^= X[(i + 4) & 7];
          }

          // IV setup
          if (iv) {
            // Shortcuts
            var IV = iv.words;
            var IV_0 = IV[0];
            var IV_1 = IV[1];

            // Generate four subvectors
            var i0 = (((IV_0 << 8) | (IV_0 >>> 24)) & 0x00ff00ff) | (((IV_0 << 24) | (IV_0 >>> 8)) & 0xff00ff00);
            var i2 = (((IV_1 << 8) | (IV_1 >>> 24)) & 0x00ff00ff) | (((IV_1 << 24) | (IV_1 >>> 8)) & 0xff00ff00);
            var i1 = (i0 >>> 16) | (i2 & 0xffff0000);
            var i3 = (i2 << 16)  | (i0 & 0x0000ffff);

            // Modify counter values
            C[0] ^= i0;
            C[1] ^= i1;
            C[2] ^= i2;
            C[3] ^= i3;
            C[4] ^= i0;
            C[5] ^= i1;
            C[6] ^= i2;
            C[7] ^= i3;

            // Iterate the system four times
            for (var i = 0; i < 4; i++) {
              nextState.call(this);
            }
          }
        },

        _doProcessBlock: function (M, offset) {
          // Shortcut
          var X = this._X;

          // Iterate the system
          nextState.call(this);

          // Generate four keystream words
          S[0] = X[0] ^ (X[5] >>> 16) ^ (X[3] << 16);
          S[1] = X[2] ^ (X[7] >>> 16) ^ (X[5] << 16);
          S[2] = X[4] ^ (X[1] >>> 16) ^ (X[7] << 16);
          S[3] = X[6] ^ (X[3] >>> 16) ^ (X[1] << 16);

          for (var i = 0; i < 4; i++) {
            // Swap endian
            S[i] = (((S[i] << 8)  | (S[i] >>> 24)) & 0x00ff00ff) |
              (((S[i] << 24) | (S[i] >>> 8))  & 0xff00ff00);

            // Encrypt
            M[offset + i] ^= S[i];
          }
        },

        blockSize: 128/32,

        ivSize: 64/32
      });

      function nextState() {
        // Shortcuts
        var X = this._X;
        var C = this._C;

        // Save old counter values
        for (var i = 0; i < 8; i++) {
          C_[i] = C[i];
        }

        // Calculate new counter values
        C[0] = (C[0] + 0x4d34d34d + this._b) | 0;
        C[1] = (C[1] + 0xd34d34d3 + ((C[0] >>> 0) < (C_[0] >>> 0) ? 1 : 0)) | 0;
        C[2] = (C[2] + 0x34d34d34 + ((C[1] >>> 0) < (C_[1] >>> 0) ? 1 : 0)) | 0;
        C[3] = (C[3] + 0x4d34d34d + ((C[2] >>> 0) < (C_[2] >>> 0) ? 1 : 0)) | 0;
        C[4] = (C[4] + 0xd34d34d3 + ((C[3] >>> 0) < (C_[3] >>> 0) ? 1 : 0)) | 0;
        C[5] = (C[5] + 0x34d34d34 + ((C[4] >>> 0) < (C_[4] >>> 0) ? 1 : 0)) | 0;
        C[6] = (C[6] + 0x4d34d34d + ((C[5] >>> 0) < (C_[5] >>> 0) ? 1 : 0)) | 0;
        C[7] = (C[7] + 0xd34d34d3 + ((C[6] >>> 0) < (C_[6] >>> 0) ? 1 : 0)) | 0;
        this._b = (C[7] >>> 0) < (C_[7] >>> 0) ? 1 : 0;

        // Calculate the g-values
        for (var i = 0; i < 8; i++) {
          var gx = X[i] + C[i];

          // Construct high and low argument for squaring
          var ga = gx & 0xffff;
          var gb = gx >>> 16;

          // Calculate high and low result of squaring
          var gh = ((((ga * ga) >>> 17) + ga * gb) >>> 15) + gb * gb;
          var gl = (((gx & 0xffff0000) * gx) | 0) + (((gx & 0x0000ffff) * gx) | 0);

          // High XOR low
          G[i] = gh ^ gl;
        }

        // Calculate new state values
        X[0] = (G[0] + ((G[7] << 16) | (G[7] >>> 16)) + ((G[6] << 16) | (G[6] >>> 16))) | 0;
        X[1] = (G[1] + ((G[0] << 8)  | (G[0] >>> 24)) + G[7]) | 0;
        X[2] = (G[2] + ((G[1] << 16) | (G[1] >>> 16)) + ((G[0] << 16) | (G[0] >>> 16))) | 0;
        X[3] = (G[3] + ((G[2] << 8)  | (G[2] >>> 24)) + G[1]) | 0;
        X[4] = (G[4] + ((G[3] << 16) | (G[3] >>> 16)) + ((G[2] << 16) | (G[2] >>> 16))) | 0;
        X[5] = (G[5] + ((G[4] << 8)  | (G[4] >>> 24)) + G[3]) | 0;
        X[6] = (G[6] + ((G[5] << 16) | (G[5] >>> 16)) + ((G[4] << 16) | (G[4] >>> 16))) | 0;
        X[7] = (G[7] + ((G[6] << 8)  | (G[6] >>> 24)) + G[5]) | 0;
      }

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.Rabbit.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.Rabbit.decrypt(ciphertext, key, cfg);
       */
      C.Rabbit = StreamCipher._createHelper(Rabbit);
    }());


    return CryptoJS.Rabbit;

  }));
},{"./cipher-core":3,"./core":4,"./enc-base64":5,"./evpkdf":7,"./md5":12}],26:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var StreamCipher = C_lib.StreamCipher;
      var C_algo = C.algo;

      /**
       * RC4 stream cipher algorithm.
       */
      var RC4 = C_algo.RC4 = StreamCipher.extend({
        _doReset: function () {
          // Shortcuts
          var key = this._key;
          var keyWords = key.words;
          var keySigBytes = key.sigBytes;

          // Init sbox
          var S = this._S = [];
          for (var i = 0; i < 256; i++) {
            S[i] = i;
          }

          // Key setup
          for (var i = 0, j = 0; i < 256; i++) {
            var keyByteIndex = i % keySigBytes;
            var keyByte = (keyWords[keyByteIndex >>> 2] >>> (24 - (keyByteIndex % 4) * 8)) & 0xff;

            j = (j + S[i] + keyByte) % 256;

            // Swap
            var t = S[i];
            S[i] = S[j];
            S[j] = t;
          }

          // Counters
          this._i = this._j = 0;
        },

        _doProcessBlock: function (M, offset) {
          M[offset] ^= generateKeystreamWord.call(this);
        },

        keySize: 256/32,

        ivSize: 0
      });

      function generateKeystreamWord() {
        // Shortcuts
        var S = this._S;
        var i = this._i;
        var j = this._j;

        // Generate keystream word
        var keystreamWord = 0;
        for (var n = 0; n < 4; n++) {
          i = (i + 1) % 256;
          j = (j + S[i]) % 256;

          // Swap
          var t = S[i];
          S[i] = S[j];
          S[j] = t;

          keystreamWord |= S[(S[i] + S[j]) % 256] << (24 - n * 8);
        }

        // Update counters
        this._i = i;
        this._j = j;

        return keystreamWord;
      }

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.RC4.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.RC4.decrypt(ciphertext, key, cfg);
       */
      C.RC4 = StreamCipher._createHelper(RC4);

      /**
       * Modified RC4 stream cipher algorithm.
       */
      var RC4Drop = C_algo.RC4Drop = RC4.extend({
        /**
         * Configuration options.
         *
         * @property {number} drop The number of keystream words to drop. Default 192
         */
        cfg: RC4.cfg.extend({
          drop: 192
        }),

        _doReset: function () {
          RC4._doReset.call(this);

          // Drop
          for (var i = this.cfg.drop; i > 0; i--) {
            generateKeystreamWord.call(this);
          }
        }
      });

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.RC4Drop.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.RC4Drop.decrypt(ciphertext, key, cfg);
       */
      C.RC4Drop = StreamCipher._createHelper(RC4Drop);
    }());


    return CryptoJS.RC4;

  }));
},{"./cipher-core":3,"./core":4,"./enc-base64":5,"./evpkdf":7,"./md5":12}],27:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    /** @preserve
     (c) 2012 by Cédric Mesnil. All rights reserved.

     Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

     - Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
     - Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
     */

    (function (Math) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var Hasher = C_lib.Hasher;
      var C_algo = C.algo;

      // Constants table
      var _zl = WordArray.create([
        0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10, 11, 12, 13, 14, 15,
        7,  4, 13,  1, 10,  6, 15,  3, 12,  0,  9,  5,  2, 14, 11,  8,
        3, 10, 14,  4,  9, 15,  8,  1,  2,  7,  0,  6, 13, 11,  5, 12,
        1,  9, 11, 10,  0,  8, 12,  4, 13,  3,  7, 15, 14,  5,  6,  2,
        4,  0,  5,  9,  7, 12,  2, 10, 14,  1,  3,  8, 11,  6, 15, 13]);
      var _zr = WordArray.create([
        5, 14,  7,  0,  9,  2, 11,  4, 13,  6, 15,  8,  1, 10,  3, 12,
        6, 11,  3,  7,  0, 13,  5, 10, 14, 15,  8, 12,  4,  9,  1,  2,
        15,  5,  1,  3,  7, 14,  6,  9, 11,  8, 12,  2, 10,  0,  4, 13,
        8,  6,  4,  1,  3, 11, 15,  0,  5, 12,  2, 13,  9,  7, 10, 14,
        12, 15, 10,  4,  1,  5,  8,  7,  6,  2, 13, 14,  0,  3,  9, 11]);
      var _sl = WordArray.create([
        11, 14, 15, 12,  5,  8,  7,  9, 11, 13, 14, 15,  6,  7,  9,  8,
        7, 6,   8, 13, 11,  9,  7, 15,  7, 12, 15,  9, 11,  7, 13, 12,
        11, 13,  6,  7, 14,  9, 13, 15, 14,  8, 13,  6,  5, 12,  7,  5,
        11, 12, 14, 15, 14, 15,  9,  8,  9, 14,  5,  6,  8,  6,  5, 12,
        9, 15,  5, 11,  6,  8, 13, 12,  5, 12, 13, 14, 11,  8,  5,  6 ]);
      var _sr = WordArray.create([
        8,  9,  9, 11, 13, 15, 15,  5,  7,  7,  8, 11, 14, 14, 12,  6,
        9, 13, 15,  7, 12,  8,  9, 11,  7,  7, 12,  7,  6, 15, 13, 11,
        9,  7, 15, 11,  8,  6,  6, 14, 12, 13,  5, 14, 13, 13,  7,  5,
        15,  5,  8, 11, 14, 14,  6, 14,  6,  9, 12,  9, 12,  5, 15,  8,
        8,  5, 12,  9, 12,  5, 14,  6,  8, 13,  6,  5, 15, 13, 11, 11 ]);

      var _hl =  WordArray.create([ 0x00000000, 0x5A827999, 0x6ED9EBA1, 0x8F1BBCDC, 0xA953FD4E]);
      var _hr =  WordArray.create([ 0x50A28BE6, 0x5C4DD124, 0x6D703EF3, 0x7A6D76E9, 0x00000000]);

      /**
       * RIPEMD160 hash algorithm.
       */
      var RIPEMD160 = C_algo.RIPEMD160 = Hasher.extend({
        _doReset: function () {
          this._hash  = WordArray.create([0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0]);
        },

        _doProcessBlock: function (M, offset) {

          // Swap endian
          for (var i = 0; i < 16; i++) {
            // Shortcuts
            var offset_i = offset + i;
            var M_offset_i = M[offset_i];

            // Swap
            M[offset_i] = (
              (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
              (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
            );
          }
          // Shortcut
          var H  = this._hash.words;
          var hl = _hl.words;
          var hr = _hr.words;
          var zl = _zl.words;
          var zr = _zr.words;
          var sl = _sl.words;
          var sr = _sr.words;

          // Working variables
          var al, bl, cl, dl, el;
          var ar, br, cr, dr, er;

          ar = al = H[0];
          br = bl = H[1];
          cr = cl = H[2];
          dr = dl = H[3];
          er = el = H[4];
          // Computation
          var t;
          for (var i = 0; i < 80; i += 1) {
            t = (al +  M[offset+zl[i]])|0;
            if (i<16){
              t +=  f1(bl,cl,dl) + hl[0];
            } else if (i<32) {
              t +=  f2(bl,cl,dl) + hl[1];
            } else if (i<48) {
              t +=  f3(bl,cl,dl) + hl[2];
            } else if (i<64) {
              t +=  f4(bl,cl,dl) + hl[3];
            } else {// if (i<80) {
              t +=  f5(bl,cl,dl) + hl[4];
            }
            t = t|0;
            t =  rotl(t,sl[i]);
            t = (t+el)|0;
            al = el;
            el = dl;
            dl = rotl(cl, 10);
            cl = bl;
            bl = t;

            t = (ar + M[offset+zr[i]])|0;
            if (i<16){
              t +=  f5(br,cr,dr) + hr[0];
            } else if (i<32) {
              t +=  f4(br,cr,dr) + hr[1];
            } else if (i<48) {
              t +=  f3(br,cr,dr) + hr[2];
            } else if (i<64) {
              t +=  f2(br,cr,dr) + hr[3];
            } else {// if (i<80) {
              t +=  f1(br,cr,dr) + hr[4];
            }
            t = t|0;
            t =  rotl(t,sr[i]) ;
            t = (t+er)|0;
            ar = er;
            er = dr;
            dr = rotl(cr, 10);
            cr = br;
            br = t;
          }
          // Intermediate hash value
          t    = (H[1] + cl + dr)|0;
          H[1] = (H[2] + dl + er)|0;
          H[2] = (H[3] + el + ar)|0;
          H[3] = (H[4] + al + br)|0;
          H[4] = (H[0] + bl + cr)|0;
          H[0] =  t;
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;

          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
            (((nBitsTotal << 8)  | (nBitsTotal >>> 24)) & 0x00ff00ff) |
            (((nBitsTotal << 24) | (nBitsTotal >>> 8))  & 0xff00ff00)
          );
          data.sigBytes = (dataWords.length + 1) * 4;

          // Hash final blocks
          this._process();

          // Shortcuts
          var hash = this._hash;
          var H = hash.words;

          // Swap endian
          for (var i = 0; i < 5; i++) {
            // Shortcut
            var H_i = H[i];

            // Swap
            H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
              (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
          }

          // Return final computed hash
          return hash;
        },

        clone: function () {
          var clone = Hasher.clone.call(this);
          clone._hash = this._hash.clone();

          return clone;
        }
      });


      function f1(x, y, z) {
        return ((x) ^ (y) ^ (z));

      }

      function f2(x, y, z) {
        return (((x)&(y)) | ((~x)&(z)));
      }

      function f3(x, y, z) {
        return (((x) | (~(y))) ^ (z));
      }

      function f4(x, y, z) {
        return (((x) & (z)) | ((y)&(~(z))));
      }

      function f5(x, y, z) {
        return ((x) ^ ((y) |(~(z))));

      }

      function rotl(x,n) {
        return (x<<n) | (x>>>(32-n));
      }


      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.RIPEMD160('message');
       *     var hash = CryptoJS.RIPEMD160(wordArray);
       */
      C.RIPEMD160 = Hasher._createHelper(RIPEMD160);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacRIPEMD160(message, key);
       */
      C.HmacRIPEMD160 = Hasher._createHmacHelper(RIPEMD160);
    }(Math));


    return CryptoJS.RIPEMD160;

  }));
},{"./core":4}],28:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var Hasher = C_lib.Hasher;
      var C_algo = C.algo;

      // Reusable object
      var W = [];

      /**
       * SHA-1 hash algorithm.
       */
      var SHA1 = C_algo.SHA1 = Hasher.extend({
        _doReset: function () {
          this._hash = new WordArray.init([
            0x67452301, 0xefcdab89,
            0x98badcfe, 0x10325476,
            0xc3d2e1f0
          ]);
        },

        _doProcessBlock: function (M, offset) {
          // Shortcut
          var H = this._hash.words;

          // Working variables
          var a = H[0];
          var b = H[1];
          var c = H[2];
          var d = H[3];
          var e = H[4];

          // Computation
          for (var i = 0; i < 80; i++) {
            if (i < 16) {
              W[i] = M[offset + i] | 0;
            } else {
              var n = W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16];
              W[i] = (n << 1) | (n >>> 31);
            }

            var t = ((a << 5) | (a >>> 27)) + e + W[i];
            if (i < 20) {
              t += ((b & c) | (~b & d)) + 0x5a827999;
            } else if (i < 40) {
              t += (b ^ c ^ d) + 0x6ed9eba1;
            } else if (i < 60) {
              t += ((b & c) | (b & d) | (c & d)) - 0x70e44324;
            } else /* if (i < 80) */ {
              t += (b ^ c ^ d) - 0x359d3e2a;
            }

            e = d;
            d = c;
            c = (b << 30) | (b >>> 2);
            b = a;
            a = t;
          }

          // Intermediate hash value
          H[0] = (H[0] + a) | 0;
          H[1] = (H[1] + b) | 0;
          H[2] = (H[2] + c) | 0;
          H[3] = (H[3] + d) | 0;
          H[4] = (H[4] + e) | 0;
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;

          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
          data.sigBytes = dataWords.length * 4;

          // Hash final blocks
          this._process();

          // Return final computed hash
          return this._hash;
        },

        clone: function () {
          var clone = Hasher.clone.call(this);
          clone._hash = this._hash.clone();

          return clone;
        }
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA1('message');
       *     var hash = CryptoJS.SHA1(wordArray);
       */
      C.SHA1 = Hasher._createHelper(SHA1);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA1(message, key);
       */
      C.HmacSHA1 = Hasher._createHmacHelper(SHA1);
    }());


    return CryptoJS.SHA1;

  }));
},{"./core":4}],29:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./sha256"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./sha256"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var C_algo = C.algo;
      var SHA256 = C_algo.SHA256;

      /**
       * SHA-224 hash algorithm.
       */
      var SHA224 = C_algo.SHA224 = SHA256.extend({
        _doReset: function () {
          this._hash = new WordArray.init([
            0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
            0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
          ]);
        },

        _doFinalize: function () {
          var hash = SHA256._doFinalize.call(this);

          hash.sigBytes -= 4;

          return hash;
        }
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA224('message');
       *     var hash = CryptoJS.SHA224(wordArray);
       */
      C.SHA224 = SHA256._createHelper(SHA224);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA224(message, key);
       */
      C.HmacSHA224 = SHA256._createHmacHelper(SHA224);
    }());


    return CryptoJS.SHA224;

  }));
},{"./core":4,"./sha256":30}],30:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function (Math) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var Hasher = C_lib.Hasher;
      var C_algo = C.algo;

      // Initialization and round constants tables
      var H = [];
      var K = [];

      // Compute constants
      (function () {
        function isPrime(n) {
          var sqrtN = Math.sqrt(n);
          for (var factor = 2; factor <= sqrtN; factor++) {
            if (!(n % factor)) {
              return false;
            }
          }

          return true;
        }

        function getFractionalBits(n) {
          return ((n - (n | 0)) * 0x100000000) | 0;
        }

        var n = 2;
        var nPrime = 0;
        while (nPrime < 64) {
          if (isPrime(n)) {
            if (nPrime < 8) {
              H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
            }
            K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

            nPrime++;
          }

          n++;
        }
      }());

      // Reusable object
      var W = [];

      /**
       * SHA-256 hash algorithm.
       */
      var SHA256 = C_algo.SHA256 = Hasher.extend({
        _doReset: function () {
          this._hash = new WordArray.init(H.slice(0));
        },

        _doProcessBlock: function (M, offset) {
          // Shortcut
          var H = this._hash.words;

          // Working variables
          var a = H[0];
          var b = H[1];
          var c = H[2];
          var d = H[3];
          var e = H[4];
          var f = H[5];
          var g = H[6];
          var h = H[7];

          // Computation
          for (var i = 0; i < 64; i++) {
            if (i < 16) {
              W[i] = M[offset + i] | 0;
            } else {
              var gamma0x = W[i - 15];
              var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
                ((gamma0x << 14) | (gamma0x >>> 18)) ^
                (gamma0x >>> 3);

              var gamma1x = W[i - 2];
              var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
                ((gamma1x << 13) | (gamma1x >>> 19)) ^
                (gamma1x >>> 10);

              W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
            }

            var ch  = (e & f) ^ (~e & g);
            var maj = (a & b) ^ (a & c) ^ (b & c);

            var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
            var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

            var t1 = h + sigma1 + ch + K[i] + W[i];
            var t2 = sigma0 + maj;

            h = g;
            g = f;
            f = e;
            e = (d + t1) | 0;
            d = c;
            c = b;
            b = a;
            a = (t1 + t2) | 0;
          }

          // Intermediate hash value
          H[0] = (H[0] + a) | 0;
          H[1] = (H[1] + b) | 0;
          H[2] = (H[2] + c) | 0;
          H[3] = (H[3] + d) | 0;
          H[4] = (H[4] + e) | 0;
          H[5] = (H[5] + f) | 0;
          H[6] = (H[6] + g) | 0;
          H[7] = (H[7] + h) | 0;
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;

          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
          dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
          data.sigBytes = dataWords.length * 4;

          // Hash final blocks
          this._process();

          // Return final computed hash
          return this._hash;
        },

        clone: function () {
          var clone = Hasher.clone.call(this);
          clone._hash = this._hash.clone();

          return clone;
        }
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA256('message');
       *     var hash = CryptoJS.SHA256(wordArray);
       */
      C.SHA256 = Hasher._createHelper(SHA256);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA256(message, key);
       */
      C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
    }(Math));


    return CryptoJS.SHA256;

  }));
},{"./core":4}],31:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./x64-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./x64-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function (Math) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var Hasher = C_lib.Hasher;
      var C_x64 = C.x64;
      var X64Word = C_x64.Word;
      var C_algo = C.algo;

      // Constants tables
      var RHO_OFFSETS = [];
      var PI_INDEXES  = [];
      var ROUND_CONSTANTS = [];

      // Compute Constants
      (function () {
        // Compute rho offset constants
        var x = 1, y = 0;
        for (var t = 0; t < 24; t++) {
          RHO_OFFSETS[x + 5 * y] = ((t + 1) * (t + 2) / 2) % 64;

          var newX = y % 5;
          var newY = (2 * x + 3 * y) % 5;
          x = newX;
          y = newY;
        }

        // Compute pi index constants
        for (var x = 0; x < 5; x++) {
          for (var y = 0; y < 5; y++) {
            PI_INDEXES[x + 5 * y] = y + ((2 * x + 3 * y) % 5) * 5;
          }
        }

        // Compute round constants
        var LFSR = 0x01;
        for (var i = 0; i < 24; i++) {
          var roundConstantMsw = 0;
          var roundConstantLsw = 0;

          for (var j = 0; j < 7; j++) {
            if (LFSR & 0x01) {
              var bitPosition = (1 << j) - 1;
              if (bitPosition < 32) {
                roundConstantLsw ^= 1 << bitPosition;
              } else /* if (bitPosition >= 32) */ {
                roundConstantMsw ^= 1 << (bitPosition - 32);
              }
            }

            // Compute next LFSR
            if (LFSR & 0x80) {
              // Primitive polynomial over GF(2): x^8 + x^6 + x^5 + x^4 + 1
              LFSR = (LFSR << 1) ^ 0x71;
            } else {
              LFSR <<= 1;
            }
          }

          ROUND_CONSTANTS[i] = X64Word.create(roundConstantMsw, roundConstantLsw);
        }
      }());

      // Reusable objects for temporary values
      var T = [];
      (function () {
        for (var i = 0; i < 25; i++) {
          T[i] = X64Word.create();
        }
      }());

      /**
       * SHA-3 hash algorithm.
       */
      var SHA3 = C_algo.SHA3 = Hasher.extend({
        /**
         * Configuration options.
         *
         * @property {number} outputLength
         *   The desired number of bits in the output hash.
         *   Only values permitted are: 224, 256, 384, 512.
         *   Default: 512
         */
        cfg: Hasher.cfg.extend({
          outputLength: 512
        }),

        _doReset: function () {
          var state = this._state = []
          for (var i = 0; i < 25; i++) {
            state[i] = new X64Word.init();
          }

          this.blockSize = (1600 - 2 * this.cfg.outputLength) / 32;
        },

        _doProcessBlock: function (M, offset) {
          // Shortcuts
          var state = this._state;
          var nBlockSizeLanes = this.blockSize / 2;

          // Absorb
          for (var i = 0; i < nBlockSizeLanes; i++) {
            // Shortcuts
            var M2i  = M[offset + 2 * i];
            var M2i1 = M[offset + 2 * i + 1];

            // Swap endian
            M2i = (
              (((M2i << 8)  | (M2i >>> 24)) & 0x00ff00ff) |
              (((M2i << 24) | (M2i >>> 8))  & 0xff00ff00)
            );
            M2i1 = (
              (((M2i1 << 8)  | (M2i1 >>> 24)) & 0x00ff00ff) |
              (((M2i1 << 24) | (M2i1 >>> 8))  & 0xff00ff00)
            );

            // Absorb message into state
            var lane = state[i];
            lane.high ^= M2i1;
            lane.low  ^= M2i;
          }

          // Rounds
          for (var round = 0; round < 24; round++) {
            // Theta
            for (var x = 0; x < 5; x++) {
              // Mix column lanes
              var tMsw = 0, tLsw = 0;
              for (var y = 0; y < 5; y++) {
                var lane = state[x + 5 * y];
                tMsw ^= lane.high;
                tLsw ^= lane.low;
              }

              // Temporary values
              var Tx = T[x];
              Tx.high = tMsw;
              Tx.low  = tLsw;
            }
            for (var x = 0; x < 5; x++) {
              // Shortcuts
              var Tx4 = T[(x + 4) % 5];
              var Tx1 = T[(x + 1) % 5];
              var Tx1Msw = Tx1.high;
              var Tx1Lsw = Tx1.low;

              // Mix surrounding columns
              var tMsw = Tx4.high ^ ((Tx1Msw << 1) | (Tx1Lsw >>> 31));
              var tLsw = Tx4.low  ^ ((Tx1Lsw << 1) | (Tx1Msw >>> 31));
              for (var y = 0; y < 5; y++) {
                var lane = state[x + 5 * y];
                lane.high ^= tMsw;
                lane.low  ^= tLsw;
              }
            }

            // Rho Pi
            for (var laneIndex = 1; laneIndex < 25; laneIndex++) {
              // Shortcuts
              var lane = state[laneIndex];
              var laneMsw = lane.high;
              var laneLsw = lane.low;
              var rhoOffset = RHO_OFFSETS[laneIndex];

              // Rotate lanes
              if (rhoOffset < 32) {
                var tMsw = (laneMsw << rhoOffset) | (laneLsw >>> (32 - rhoOffset));
                var tLsw = (laneLsw << rhoOffset) | (laneMsw >>> (32 - rhoOffset));
              } else /* if (rhoOffset >= 32) */ {
                var tMsw = (laneLsw << (rhoOffset - 32)) | (laneMsw >>> (64 - rhoOffset));
                var tLsw = (laneMsw << (rhoOffset - 32)) | (laneLsw >>> (64 - rhoOffset));
              }

              // Transpose lanes
              var TPiLane = T[PI_INDEXES[laneIndex]];
              TPiLane.high = tMsw;
              TPiLane.low  = tLsw;
            }

            // Rho pi at x = y = 0
            var T0 = T[0];
            var state0 = state[0];
            T0.high = state0.high;
            T0.low  = state0.low;

            // Chi
            for (var x = 0; x < 5; x++) {
              for (var y = 0; y < 5; y++) {
                // Shortcuts
                var laneIndex = x + 5 * y;
                var lane = state[laneIndex];
                var TLane = T[laneIndex];
                var Tx1Lane = T[((x + 1) % 5) + 5 * y];
                var Tx2Lane = T[((x + 2) % 5) + 5 * y];

                // Mix rows
                lane.high = TLane.high ^ (~Tx1Lane.high & Tx2Lane.high);
                lane.low  = TLane.low  ^ (~Tx1Lane.low  & Tx2Lane.low);
              }
            }

            // Iota
            var lane = state[0];
            var roundConstant = ROUND_CONSTANTS[round];
            lane.high ^= roundConstant.high;
            lane.low  ^= roundConstant.low;;
          }
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;
          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;
          var blockSizeBits = this.blockSize * 32;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x1 << (24 - nBitsLeft % 32);
          dataWords[((Math.ceil((nBitsLeft + 1) / blockSizeBits) * blockSizeBits) >>> 5) - 1] |= 0x80;
          data.sigBytes = dataWords.length * 4;

          // Hash final blocks
          this._process();

          // Shortcuts
          var state = this._state;
          var outputLengthBytes = this.cfg.outputLength / 8;
          var outputLengthLanes = outputLengthBytes / 8;

          // Squeeze
          var hashWords = [];
          for (var i = 0; i < outputLengthLanes; i++) {
            // Shortcuts
            var lane = state[i];
            var laneMsw = lane.high;
            var laneLsw = lane.low;

            // Swap endian
            laneMsw = (
              (((laneMsw << 8)  | (laneMsw >>> 24)) & 0x00ff00ff) |
              (((laneMsw << 24) | (laneMsw >>> 8))  & 0xff00ff00)
            );
            laneLsw = (
              (((laneLsw << 8)  | (laneLsw >>> 24)) & 0x00ff00ff) |
              (((laneLsw << 24) | (laneLsw >>> 8))  & 0xff00ff00)
            );

            // Squeeze state to retrieve hash
            hashWords.push(laneLsw);
            hashWords.push(laneMsw);
          }

          // Return final computed hash
          return new WordArray.init(hashWords, outputLengthBytes);
        },

        clone: function () {
          var clone = Hasher.clone.call(this);

          var state = clone._state = this._state.slice(0);
          for (var i = 0; i < 25; i++) {
            state[i] = state[i].clone();
          }

          return clone;
        }
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA3('message');
       *     var hash = CryptoJS.SHA3(wordArray);
       */
      C.SHA3 = Hasher._createHelper(SHA3);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA3(message, key);
       */
      C.HmacSHA3 = Hasher._createHmacHelper(SHA3);
    }(Math));


    return CryptoJS.SHA3;

  }));
},{"./core":4,"./x64-core":35}],32:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./x64-core"), require("./sha512"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./x64-core", "./sha512"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_x64 = C.x64;
      var X64Word = C_x64.Word;
      var X64WordArray = C_x64.WordArray;
      var C_algo = C.algo;
      var SHA512 = C_algo.SHA512;

      /**
       * SHA-384 hash algorithm.
       */
      var SHA384 = C_algo.SHA384 = SHA512.extend({
        _doReset: function () {
          this._hash = new X64WordArray.init([
            new X64Word.init(0xcbbb9d5d, 0xc1059ed8), new X64Word.init(0x629a292a, 0x367cd507),
            new X64Word.init(0x9159015a, 0x3070dd17), new X64Word.init(0x152fecd8, 0xf70e5939),
            new X64Word.init(0x67332667, 0xffc00b31), new X64Word.init(0x8eb44a87, 0x68581511),
            new X64Word.init(0xdb0c2e0d, 0x64f98fa7), new X64Word.init(0x47b5481d, 0xbefa4fa4)
          ]);
        },

        _doFinalize: function () {
          var hash = SHA512._doFinalize.call(this);

          hash.sigBytes -= 16;

          return hash;
        }
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA384('message');
       *     var hash = CryptoJS.SHA384(wordArray);
       */
      C.SHA384 = SHA512._createHelper(SHA384);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA384(message, key);
       */
      C.HmacSHA384 = SHA512._createHmacHelper(SHA384);
    }());


    return CryptoJS.SHA384;

  }));
},{"./core":4,"./sha512":33,"./x64-core":35}],33:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./x64-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./x64-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Hasher = C_lib.Hasher;
      var C_x64 = C.x64;
      var X64Word = C_x64.Word;
      var X64WordArray = C_x64.WordArray;
      var C_algo = C.algo;

      function X64Word_create() {
        return X64Word.create.apply(X64Word, arguments);
      }

      // Constants
      var K = [
        X64Word_create(0x428a2f98, 0xd728ae22), X64Word_create(0x71374491, 0x23ef65cd),
        X64Word_create(0xb5c0fbcf, 0xec4d3b2f), X64Word_create(0xe9b5dba5, 0x8189dbbc),
        X64Word_create(0x3956c25b, 0xf348b538), X64Word_create(0x59f111f1, 0xb605d019),
        X64Word_create(0x923f82a4, 0xaf194f9b), X64Word_create(0xab1c5ed5, 0xda6d8118),
        X64Word_create(0xd807aa98, 0xa3030242), X64Word_create(0x12835b01, 0x45706fbe),
        X64Word_create(0x243185be, 0x4ee4b28c), X64Word_create(0x550c7dc3, 0xd5ffb4e2),
        X64Word_create(0x72be5d74, 0xf27b896f), X64Word_create(0x80deb1fe, 0x3b1696b1),
        X64Word_create(0x9bdc06a7, 0x25c71235), X64Word_create(0xc19bf174, 0xcf692694),
        X64Word_create(0xe49b69c1, 0x9ef14ad2), X64Word_create(0xefbe4786, 0x384f25e3),
        X64Word_create(0x0fc19dc6, 0x8b8cd5b5), X64Word_create(0x240ca1cc, 0x77ac9c65),
        X64Word_create(0x2de92c6f, 0x592b0275), X64Word_create(0x4a7484aa, 0x6ea6e483),
        X64Word_create(0x5cb0a9dc, 0xbd41fbd4), X64Word_create(0x76f988da, 0x831153b5),
        X64Word_create(0x983e5152, 0xee66dfab), X64Word_create(0xa831c66d, 0x2db43210),
        X64Word_create(0xb00327c8, 0x98fb213f), X64Word_create(0xbf597fc7, 0xbeef0ee4),
        X64Word_create(0xc6e00bf3, 0x3da88fc2), X64Word_create(0xd5a79147, 0x930aa725),
        X64Word_create(0x06ca6351, 0xe003826f), X64Word_create(0x14292967, 0x0a0e6e70),
        X64Word_create(0x27b70a85, 0x46d22ffc), X64Word_create(0x2e1b2138, 0x5c26c926),
        X64Word_create(0x4d2c6dfc, 0x5ac42aed), X64Word_create(0x53380d13, 0x9d95b3df),
        X64Word_create(0x650a7354, 0x8baf63de), X64Word_create(0x766a0abb, 0x3c77b2a8),
        X64Word_create(0x81c2c92e, 0x47edaee6), X64Word_create(0x92722c85, 0x1482353b),
        X64Word_create(0xa2bfe8a1, 0x4cf10364), X64Word_create(0xa81a664b, 0xbc423001),
        X64Word_create(0xc24b8b70, 0xd0f89791), X64Word_create(0xc76c51a3, 0x0654be30),
        X64Word_create(0xd192e819, 0xd6ef5218), X64Word_create(0xd6990624, 0x5565a910),
        X64Word_create(0xf40e3585, 0x5771202a), X64Word_create(0x106aa070, 0x32bbd1b8),
        X64Word_create(0x19a4c116, 0xb8d2d0c8), X64Word_create(0x1e376c08, 0x5141ab53),
        X64Word_create(0x2748774c, 0xdf8eeb99), X64Word_create(0x34b0bcb5, 0xe19b48a8),
        X64Word_create(0x391c0cb3, 0xc5c95a63), X64Word_create(0x4ed8aa4a, 0xe3418acb),
        X64Word_create(0x5b9cca4f, 0x7763e373), X64Word_create(0x682e6ff3, 0xd6b2b8a3),
        X64Word_create(0x748f82ee, 0x5defb2fc), X64Word_create(0x78a5636f, 0x43172f60),
        X64Word_create(0x84c87814, 0xa1f0ab72), X64Word_create(0x8cc70208, 0x1a6439ec),
        X64Word_create(0x90befffa, 0x23631e28), X64Word_create(0xa4506ceb, 0xde82bde9),
        X64Word_create(0xbef9a3f7, 0xb2c67915), X64Word_create(0xc67178f2, 0xe372532b),
        X64Word_create(0xca273ece, 0xea26619c), X64Word_create(0xd186b8c7, 0x21c0c207),
        X64Word_create(0xeada7dd6, 0xcde0eb1e), X64Word_create(0xf57d4f7f, 0xee6ed178),
        X64Word_create(0x06f067aa, 0x72176fba), X64Word_create(0x0a637dc5, 0xa2c898a6),
        X64Word_create(0x113f9804, 0xbef90dae), X64Word_create(0x1b710b35, 0x131c471b),
        X64Word_create(0x28db77f5, 0x23047d84), X64Word_create(0x32caab7b, 0x40c72493),
        X64Word_create(0x3c9ebe0a, 0x15c9bebc), X64Word_create(0x431d67c4, 0x9c100d4c),
        X64Word_create(0x4cc5d4be, 0xcb3e42b6), X64Word_create(0x597f299c, 0xfc657e2a),
        X64Word_create(0x5fcb6fab, 0x3ad6faec), X64Word_create(0x6c44198c, 0x4a475817)
      ];

      // Reusable objects
      var W = [];
      (function () {
        for (var i = 0; i < 80; i++) {
          W[i] = X64Word_create();
        }
      }());

      /**
       * SHA-512 hash algorithm.
       */
      var SHA512 = C_algo.SHA512 = Hasher.extend({
        _doReset: function () {
          this._hash = new X64WordArray.init([
            new X64Word.init(0x6a09e667, 0xf3bcc908), new X64Word.init(0xbb67ae85, 0x84caa73b),
            new X64Word.init(0x3c6ef372, 0xfe94f82b), new X64Word.init(0xa54ff53a, 0x5f1d36f1),
            new X64Word.init(0x510e527f, 0xade682d1), new X64Word.init(0x9b05688c, 0x2b3e6c1f),
            new X64Word.init(0x1f83d9ab, 0xfb41bd6b), new X64Word.init(0x5be0cd19, 0x137e2179)
          ]);
        },

        _doProcessBlock: function (M, offset) {
          // Shortcuts
          var H = this._hash.words;

          var H0 = H[0];
          var H1 = H[1];
          var H2 = H[2];
          var H3 = H[3];
          var H4 = H[4];
          var H5 = H[5];
          var H6 = H[6];
          var H7 = H[7];

          var H0h = H0.high;
          var H0l = H0.low;
          var H1h = H1.high;
          var H1l = H1.low;
          var H2h = H2.high;
          var H2l = H2.low;
          var H3h = H3.high;
          var H3l = H3.low;
          var H4h = H4.high;
          var H4l = H4.low;
          var H5h = H5.high;
          var H5l = H5.low;
          var H6h = H6.high;
          var H6l = H6.low;
          var H7h = H7.high;
          var H7l = H7.low;

          // Working variables
          var ah = H0h;
          var al = H0l;
          var bh = H1h;
          var bl = H1l;
          var ch = H2h;
          var cl = H2l;
          var dh = H3h;
          var dl = H3l;
          var eh = H4h;
          var el = H4l;
          var fh = H5h;
          var fl = H5l;
          var gh = H6h;
          var gl = H6l;
          var hh = H7h;
          var hl = H7l;

          // Rounds
          for (var i = 0; i < 80; i++) {
            // Shortcut
            var Wi = W[i];

            // Extend message
            if (i < 16) {
              var Wih = Wi.high = M[offset + i * 2]     | 0;
              var Wil = Wi.low  = M[offset + i * 2 + 1] | 0;
            } else {
              // Gamma0
              var gamma0x  = W[i - 15];
              var gamma0xh = gamma0x.high;
              var gamma0xl = gamma0x.low;
              var gamma0h  = ((gamma0xh >>> 1) | (gamma0xl << 31)) ^ ((gamma0xh >>> 8) | (gamma0xl << 24)) ^ (gamma0xh >>> 7);
              var gamma0l  = ((gamma0xl >>> 1) | (gamma0xh << 31)) ^ ((gamma0xl >>> 8) | (gamma0xh << 24)) ^ ((gamma0xl >>> 7) | (gamma0xh << 25));

              // Gamma1
              var gamma1x  = W[i - 2];
              var gamma1xh = gamma1x.high;
              var gamma1xl = gamma1x.low;
              var gamma1h  = ((gamma1xh >>> 19) | (gamma1xl << 13)) ^ ((gamma1xh << 3) | (gamma1xl >>> 29)) ^ (gamma1xh >>> 6);
              var gamma1l  = ((gamma1xl >>> 19) | (gamma1xh << 13)) ^ ((gamma1xl << 3) | (gamma1xh >>> 29)) ^ ((gamma1xl >>> 6) | (gamma1xh << 26));

              // W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16]
              var Wi7  = W[i - 7];
              var Wi7h = Wi7.high;
              var Wi7l = Wi7.low;

              var Wi16  = W[i - 16];
              var Wi16h = Wi16.high;
              var Wi16l = Wi16.low;

              var Wil = gamma0l + Wi7l;
              var Wih = gamma0h + Wi7h + ((Wil >>> 0) < (gamma0l >>> 0) ? 1 : 0);
              var Wil = Wil + gamma1l;
              var Wih = Wih + gamma1h + ((Wil >>> 0) < (gamma1l >>> 0) ? 1 : 0);
              var Wil = Wil + Wi16l;
              var Wih = Wih + Wi16h + ((Wil >>> 0) < (Wi16l >>> 0) ? 1 : 0);

              Wi.high = Wih;
              Wi.low  = Wil;
            }

            var chh  = (eh & fh) ^ (~eh & gh);
            var chl  = (el & fl) ^ (~el & gl);
            var majh = (ah & bh) ^ (ah & ch) ^ (bh & ch);
            var majl = (al & bl) ^ (al & cl) ^ (bl & cl);

            var sigma0h = ((ah >>> 28) | (al << 4))  ^ ((ah << 30)  | (al >>> 2)) ^ ((ah << 25) | (al >>> 7));
            var sigma0l = ((al >>> 28) | (ah << 4))  ^ ((al << 30)  | (ah >>> 2)) ^ ((al << 25) | (ah >>> 7));
            var sigma1h = ((eh >>> 14) | (el << 18)) ^ ((eh >>> 18) | (el << 14)) ^ ((eh << 23) | (el >>> 9));
            var sigma1l = ((el >>> 14) | (eh << 18)) ^ ((el >>> 18) | (eh << 14)) ^ ((el << 23) | (eh >>> 9));

            // t1 = h + sigma1 + ch + K[i] + W[i]
            var Ki  = K[i];
            var Kih = Ki.high;
            var Kil = Ki.low;

            var t1l = hl + sigma1l;
            var t1h = hh + sigma1h + ((t1l >>> 0) < (hl >>> 0) ? 1 : 0);
            var t1l = t1l + chl;
            var t1h = t1h + chh + ((t1l >>> 0) < (chl >>> 0) ? 1 : 0);
            var t1l = t1l + Kil;
            var t1h = t1h + Kih + ((t1l >>> 0) < (Kil >>> 0) ? 1 : 0);
            var t1l = t1l + Wil;
            var t1h = t1h + Wih + ((t1l >>> 0) < (Wil >>> 0) ? 1 : 0);

            // t2 = sigma0 + maj
            var t2l = sigma0l + majl;
            var t2h = sigma0h + majh + ((t2l >>> 0) < (sigma0l >>> 0) ? 1 : 0);

            // Update working variables
            hh = gh;
            hl = gl;
            gh = fh;
            gl = fl;
            fh = eh;
            fl = el;
            el = (dl + t1l) | 0;
            eh = (dh + t1h + ((el >>> 0) < (dl >>> 0) ? 1 : 0)) | 0;
            dh = ch;
            dl = cl;
            ch = bh;
            cl = bl;
            bh = ah;
            bl = al;
            al = (t1l + t2l) | 0;
            ah = (t1h + t2h + ((al >>> 0) < (t1l >>> 0) ? 1 : 0)) | 0;
          }

          // Intermediate hash value
          H0l = H0.low  = (H0l + al);
          H0.high = (H0h + ah + ((H0l >>> 0) < (al >>> 0) ? 1 : 0));
          H1l = H1.low  = (H1l + bl);
          H1.high = (H1h + bh + ((H1l >>> 0) < (bl >>> 0) ? 1 : 0));
          H2l = H2.low  = (H2l + cl);
          H2.high = (H2h + ch + ((H2l >>> 0) < (cl >>> 0) ? 1 : 0));
          H3l = H3.low  = (H3l + dl);
          H3.high = (H3h + dh + ((H3l >>> 0) < (dl >>> 0) ? 1 : 0));
          H4l = H4.low  = (H4l + el);
          H4.high = (H4h + eh + ((H4l >>> 0) < (el >>> 0) ? 1 : 0));
          H5l = H5.low  = (H5l + fl);
          H5.high = (H5h + fh + ((H5l >>> 0) < (fl >>> 0) ? 1 : 0));
          H6l = H6.low  = (H6l + gl);
          H6.high = (H6h + gh + ((H6l >>> 0) < (gl >>> 0) ? 1 : 0));
          H7l = H7.low  = (H7l + hl);
          H7.high = (H7h + hh + ((H7l >>> 0) < (hl >>> 0) ? 1 : 0));
        },

        _doFinalize: function () {
          // Shortcuts
          var data = this._data;
          var dataWords = data.words;

          var nBitsTotal = this._nDataBytes * 8;
          var nBitsLeft = data.sigBytes * 8;

          // Add padding
          dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
          dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 30] = Math.floor(nBitsTotal / 0x100000000);
          dataWords[(((nBitsLeft + 128) >>> 10) << 5) + 31] = nBitsTotal;
          data.sigBytes = dataWords.length * 4;

          // Hash final blocks
          this._process();

          // Convert hash to 32-bit word array before returning
          var hash = this._hash.toX32();

          // Return final computed hash
          return hash;
        },

        clone: function () {
          var clone = Hasher.clone.call(this);
          clone._hash = this._hash.clone();

          return clone;
        },

        blockSize: 1024/32
      });

      /**
       * Shortcut function to the hasher's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       *
       * @return {WordArray} The hash.
       *
       * @static
       *
       * @example
       *
       *     var hash = CryptoJS.SHA512('message');
       *     var hash = CryptoJS.SHA512(wordArray);
       */
      C.SHA512 = Hasher._createHelper(SHA512);

      /**
       * Shortcut function to the HMAC's object interface.
       *
       * @param {WordArray|string} message The message to hash.
       * @param {WordArray|string} key The secret key.
       *
       * @return {WordArray} The HMAC.
       *
       * @static
       *
       * @example
       *
       *     var hmac = CryptoJS.HmacSHA512(message, key);
       */
      C.HmacSHA512 = Hasher._createHmacHelper(SHA512);
    }());


    return CryptoJS.SHA512;

  }));
},{"./core":4,"./x64-core":35}],34:[function(require,module,exports){
  ;(function (root, factory, undef) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"), require("./enc-base64"), require("./md5"), require("./evpkdf"), require("./cipher-core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core", "./enc-base64", "./md5", "./evpkdf", "./cipher-core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function () {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var WordArray = C_lib.WordArray;
      var BlockCipher = C_lib.BlockCipher;
      var C_algo = C.algo;

      // Permuted Choice 1 constants
      var PC1 = [
        57, 49, 41, 33, 25, 17, 9,  1,
        58, 50, 42, 34, 26, 18, 10, 2,
        59, 51, 43, 35, 27, 19, 11, 3,
        60, 52, 44, 36, 63, 55, 47, 39,
        31, 23, 15, 7,  62, 54, 46, 38,
        30, 22, 14, 6,  61, 53, 45, 37,
        29, 21, 13, 5,  28, 20, 12, 4
      ];

      // Permuted Choice 2 constants
      var PC2 = [
        14, 17, 11, 24, 1,  5,
        3,  28, 15, 6,  21, 10,
        23, 19, 12, 4,  26, 8,
        16, 7,  27, 20, 13, 2,
        41, 52, 31, 37, 47, 55,
        30, 40, 51, 45, 33, 48,
        44, 49, 39, 56, 34, 53,
        46, 42, 50, 36, 29, 32
      ];

      // Cumulative bit shift constants
      var BIT_SHIFTS = [1,  2,  4,  6,  8,  10, 12, 14, 15, 17, 19, 21, 23, 25, 27, 28];

      // SBOXes and round permutation constants
      var SBOX_P = [
        {
          0x0: 0x808200,
          0x10000000: 0x8000,
          0x20000000: 0x808002,
          0x30000000: 0x2,
          0x40000000: 0x200,
          0x50000000: 0x808202,
          0x60000000: 0x800202,
          0x70000000: 0x800000,
          0x80000000: 0x202,
          0x90000000: 0x800200,
          0xa0000000: 0x8200,
          0xb0000000: 0x808000,
          0xc0000000: 0x8002,
          0xd0000000: 0x800002,
          0xe0000000: 0x0,
          0xf0000000: 0x8202,
          0x8000000: 0x0,
          0x18000000: 0x808202,
          0x28000000: 0x8202,
          0x38000000: 0x8000,
          0x48000000: 0x808200,
          0x58000000: 0x200,
          0x68000000: 0x808002,
          0x78000000: 0x2,
          0x88000000: 0x800200,
          0x98000000: 0x8200,
          0xa8000000: 0x808000,
          0xb8000000: 0x800202,
          0xc8000000: 0x800002,
          0xd8000000: 0x8002,
          0xe8000000: 0x202,
          0xf8000000: 0x800000,
          0x1: 0x8000,
          0x10000001: 0x2,
          0x20000001: 0x808200,
          0x30000001: 0x800000,
          0x40000001: 0x808002,
          0x50000001: 0x8200,
          0x60000001: 0x200,
          0x70000001: 0x800202,
          0x80000001: 0x808202,
          0x90000001: 0x808000,
          0xa0000001: 0x800002,
          0xb0000001: 0x8202,
          0xc0000001: 0x202,
          0xd0000001: 0x800200,
          0xe0000001: 0x8002,
          0xf0000001: 0x0,
          0x8000001: 0x808202,
          0x18000001: 0x808000,
          0x28000001: 0x800000,
          0x38000001: 0x200,
          0x48000001: 0x8000,
          0x58000001: 0x800002,
          0x68000001: 0x2,
          0x78000001: 0x8202,
          0x88000001: 0x8002,
          0x98000001: 0x800202,
          0xa8000001: 0x202,
          0xb8000001: 0x808200,
          0xc8000001: 0x800200,
          0xd8000001: 0x0,
          0xe8000001: 0x8200,
          0xf8000001: 0x808002
        },
        {
          0x0: 0x40084010,
          0x1000000: 0x4000,
          0x2000000: 0x80000,
          0x3000000: 0x40080010,
          0x4000000: 0x40000010,
          0x5000000: 0x40084000,
          0x6000000: 0x40004000,
          0x7000000: 0x10,
          0x8000000: 0x84000,
          0x9000000: 0x40004010,
          0xa000000: 0x40000000,
          0xb000000: 0x84010,
          0xc000000: 0x80010,
          0xd000000: 0x0,
          0xe000000: 0x4010,
          0xf000000: 0x40080000,
          0x800000: 0x40004000,
          0x1800000: 0x84010,
          0x2800000: 0x10,
          0x3800000: 0x40004010,
          0x4800000: 0x40084010,
          0x5800000: 0x40000000,
          0x6800000: 0x80000,
          0x7800000: 0x40080010,
          0x8800000: 0x80010,
          0x9800000: 0x0,
          0xa800000: 0x4000,
          0xb800000: 0x40080000,
          0xc800000: 0x40000010,
          0xd800000: 0x84000,
          0xe800000: 0x40084000,
          0xf800000: 0x4010,
          0x10000000: 0x0,
          0x11000000: 0x40080010,
          0x12000000: 0x40004010,
          0x13000000: 0x40084000,
          0x14000000: 0x40080000,
          0x15000000: 0x10,
          0x16000000: 0x84010,
          0x17000000: 0x4000,
          0x18000000: 0x4010,
          0x19000000: 0x80000,
          0x1a000000: 0x80010,
          0x1b000000: 0x40000010,
          0x1c000000: 0x84000,
          0x1d000000: 0x40004000,
          0x1e000000: 0x40000000,
          0x1f000000: 0x40084010,
          0x10800000: 0x84010,
          0x11800000: 0x80000,
          0x12800000: 0x40080000,
          0x13800000: 0x4000,
          0x14800000: 0x40004000,
          0x15800000: 0x40084010,
          0x16800000: 0x10,
          0x17800000: 0x40000000,
          0x18800000: 0x40084000,
          0x19800000: 0x40000010,
          0x1a800000: 0x40004010,
          0x1b800000: 0x80010,
          0x1c800000: 0x0,
          0x1d800000: 0x4010,
          0x1e800000: 0x40080010,
          0x1f800000: 0x84000
        },
        {
          0x0: 0x104,
          0x100000: 0x0,
          0x200000: 0x4000100,
          0x300000: 0x10104,
          0x400000: 0x10004,
          0x500000: 0x4000004,
          0x600000: 0x4010104,
          0x700000: 0x4010000,
          0x800000: 0x4000000,
          0x900000: 0x4010100,
          0xa00000: 0x10100,
          0xb00000: 0x4010004,
          0xc00000: 0x4000104,
          0xd00000: 0x10000,
          0xe00000: 0x4,
          0xf00000: 0x100,
          0x80000: 0x4010100,
          0x180000: 0x4010004,
          0x280000: 0x0,
          0x380000: 0x4000100,
          0x480000: 0x4000004,
          0x580000: 0x10000,
          0x680000: 0x10004,
          0x780000: 0x104,
          0x880000: 0x4,
          0x980000: 0x100,
          0xa80000: 0x4010000,
          0xb80000: 0x10104,
          0xc80000: 0x10100,
          0xd80000: 0x4000104,
          0xe80000: 0x4010104,
          0xf80000: 0x4000000,
          0x1000000: 0x4010100,
          0x1100000: 0x10004,
          0x1200000: 0x10000,
          0x1300000: 0x4000100,
          0x1400000: 0x100,
          0x1500000: 0x4010104,
          0x1600000: 0x4000004,
          0x1700000: 0x0,
          0x1800000: 0x4000104,
          0x1900000: 0x4000000,
          0x1a00000: 0x4,
          0x1b00000: 0x10100,
          0x1c00000: 0x4010000,
          0x1d00000: 0x104,
          0x1e00000: 0x10104,
          0x1f00000: 0x4010004,
          0x1080000: 0x4000000,
          0x1180000: 0x104,
          0x1280000: 0x4010100,
          0x1380000: 0x0,
          0x1480000: 0x10004,
          0x1580000: 0x4000100,
          0x1680000: 0x100,
          0x1780000: 0x4010004,
          0x1880000: 0x10000,
          0x1980000: 0x4010104,
          0x1a80000: 0x10104,
          0x1b80000: 0x4000004,
          0x1c80000: 0x4000104,
          0x1d80000: 0x4010000,
          0x1e80000: 0x4,
          0x1f80000: 0x10100
        },
        {
          0x0: 0x80401000,
          0x10000: 0x80001040,
          0x20000: 0x401040,
          0x30000: 0x80400000,
          0x40000: 0x0,
          0x50000: 0x401000,
          0x60000: 0x80000040,
          0x70000: 0x400040,
          0x80000: 0x80000000,
          0x90000: 0x400000,
          0xa0000: 0x40,
          0xb0000: 0x80001000,
          0xc0000: 0x80400040,
          0xd0000: 0x1040,
          0xe0000: 0x1000,
          0xf0000: 0x80401040,
          0x8000: 0x80001040,
          0x18000: 0x40,
          0x28000: 0x80400040,
          0x38000: 0x80001000,
          0x48000: 0x401000,
          0x58000: 0x80401040,
          0x68000: 0x0,
          0x78000: 0x80400000,
          0x88000: 0x1000,
          0x98000: 0x80401000,
          0xa8000: 0x400000,
          0xb8000: 0x1040,
          0xc8000: 0x80000000,
          0xd8000: 0x400040,
          0xe8000: 0x401040,
          0xf8000: 0x80000040,
          0x100000: 0x400040,
          0x110000: 0x401000,
          0x120000: 0x80000040,
          0x130000: 0x0,
          0x140000: 0x1040,
          0x150000: 0x80400040,
          0x160000: 0x80401000,
          0x170000: 0x80001040,
          0x180000: 0x80401040,
          0x190000: 0x80000000,
          0x1a0000: 0x80400000,
          0x1b0000: 0x401040,
          0x1c0000: 0x80001000,
          0x1d0000: 0x400000,
          0x1e0000: 0x40,
          0x1f0000: 0x1000,
          0x108000: 0x80400000,
          0x118000: 0x80401040,
          0x128000: 0x0,
          0x138000: 0x401000,
          0x148000: 0x400040,
          0x158000: 0x80000000,
          0x168000: 0x80001040,
          0x178000: 0x40,
          0x188000: 0x80000040,
          0x198000: 0x1000,
          0x1a8000: 0x80001000,
          0x1b8000: 0x80400040,
          0x1c8000: 0x1040,
          0x1d8000: 0x80401000,
          0x1e8000: 0x400000,
          0x1f8000: 0x401040
        },
        {
          0x0: 0x80,
          0x1000: 0x1040000,
          0x2000: 0x40000,
          0x3000: 0x20000000,
          0x4000: 0x20040080,
          0x5000: 0x1000080,
          0x6000: 0x21000080,
          0x7000: 0x40080,
          0x8000: 0x1000000,
          0x9000: 0x20040000,
          0xa000: 0x20000080,
          0xb000: 0x21040080,
          0xc000: 0x21040000,
          0xd000: 0x0,
          0xe000: 0x1040080,
          0xf000: 0x21000000,
          0x800: 0x1040080,
          0x1800: 0x21000080,
          0x2800: 0x80,
          0x3800: 0x1040000,
          0x4800: 0x40000,
          0x5800: 0x20040080,
          0x6800: 0x21040000,
          0x7800: 0x20000000,
          0x8800: 0x20040000,
          0x9800: 0x0,
          0xa800: 0x21040080,
          0xb800: 0x1000080,
          0xc800: 0x20000080,
          0xd800: 0x21000000,
          0xe800: 0x1000000,
          0xf800: 0x40080,
          0x10000: 0x40000,
          0x11000: 0x80,
          0x12000: 0x20000000,
          0x13000: 0x21000080,
          0x14000: 0x1000080,
          0x15000: 0x21040000,
          0x16000: 0x20040080,
          0x17000: 0x1000000,
          0x18000: 0x21040080,
          0x19000: 0x21000000,
          0x1a000: 0x1040000,
          0x1b000: 0x20040000,
          0x1c000: 0x40080,
          0x1d000: 0x20000080,
          0x1e000: 0x0,
          0x1f000: 0x1040080,
          0x10800: 0x21000080,
          0x11800: 0x1000000,
          0x12800: 0x1040000,
          0x13800: 0x20040080,
          0x14800: 0x20000000,
          0x15800: 0x1040080,
          0x16800: 0x80,
          0x17800: 0x21040000,
          0x18800: 0x40080,
          0x19800: 0x21040080,
          0x1a800: 0x0,
          0x1b800: 0x21000000,
          0x1c800: 0x1000080,
          0x1d800: 0x40000,
          0x1e800: 0x20040000,
          0x1f800: 0x20000080
        },
        {
          0x0: 0x10000008,
          0x100: 0x2000,
          0x200: 0x10200000,
          0x300: 0x10202008,
          0x400: 0x10002000,
          0x500: 0x200000,
          0x600: 0x200008,
          0x700: 0x10000000,
          0x800: 0x0,
          0x900: 0x10002008,
          0xa00: 0x202000,
          0xb00: 0x8,
          0xc00: 0x10200008,
          0xd00: 0x202008,
          0xe00: 0x2008,
          0xf00: 0x10202000,
          0x80: 0x10200000,
          0x180: 0x10202008,
          0x280: 0x8,
          0x380: 0x200000,
          0x480: 0x202008,
          0x580: 0x10000008,
          0x680: 0x10002000,
          0x780: 0x2008,
          0x880: 0x200008,
          0x980: 0x2000,
          0xa80: 0x10002008,
          0xb80: 0x10200008,
          0xc80: 0x0,
          0xd80: 0x10202000,
          0xe80: 0x202000,
          0xf80: 0x10000000,
          0x1000: 0x10002000,
          0x1100: 0x10200008,
          0x1200: 0x10202008,
          0x1300: 0x2008,
          0x1400: 0x200000,
          0x1500: 0x10000000,
          0x1600: 0x10000008,
          0x1700: 0x202000,
          0x1800: 0x202008,
          0x1900: 0x0,
          0x1a00: 0x8,
          0x1b00: 0x10200000,
          0x1c00: 0x2000,
          0x1d00: 0x10002008,
          0x1e00: 0x10202000,
          0x1f00: 0x200008,
          0x1080: 0x8,
          0x1180: 0x202000,
          0x1280: 0x200000,
          0x1380: 0x10000008,
          0x1480: 0x10002000,
          0x1580: 0x2008,
          0x1680: 0x10202008,
          0x1780: 0x10200000,
          0x1880: 0x10202000,
          0x1980: 0x10200008,
          0x1a80: 0x2000,
          0x1b80: 0x202008,
          0x1c80: 0x200008,
          0x1d80: 0x0,
          0x1e80: 0x10000000,
          0x1f80: 0x10002008
        },
        {
          0x0: 0x100000,
          0x10: 0x2000401,
          0x20: 0x400,
          0x30: 0x100401,
          0x40: 0x2100401,
          0x50: 0x0,
          0x60: 0x1,
          0x70: 0x2100001,
          0x80: 0x2000400,
          0x90: 0x100001,
          0xa0: 0x2000001,
          0xb0: 0x2100400,
          0xc0: 0x2100000,
          0xd0: 0x401,
          0xe0: 0x100400,
          0xf0: 0x2000000,
          0x8: 0x2100001,
          0x18: 0x0,
          0x28: 0x2000401,
          0x38: 0x2100400,
          0x48: 0x100000,
          0x58: 0x2000001,
          0x68: 0x2000000,
          0x78: 0x401,
          0x88: 0x100401,
          0x98: 0x2000400,
          0xa8: 0x2100000,
          0xb8: 0x100001,
          0xc8: 0x400,
          0xd8: 0x2100401,
          0xe8: 0x1,
          0xf8: 0x100400,
          0x100: 0x2000000,
          0x110: 0x100000,
          0x120: 0x2000401,
          0x130: 0x2100001,
          0x140: 0x100001,
          0x150: 0x2000400,
          0x160: 0x2100400,
          0x170: 0x100401,
          0x180: 0x401,
          0x190: 0x2100401,
          0x1a0: 0x100400,
          0x1b0: 0x1,
          0x1c0: 0x0,
          0x1d0: 0x2100000,
          0x1e0: 0x2000001,
          0x1f0: 0x400,
          0x108: 0x100400,
          0x118: 0x2000401,
          0x128: 0x2100001,
          0x138: 0x1,
          0x148: 0x2000000,
          0x158: 0x100000,
          0x168: 0x401,
          0x178: 0x2100400,
          0x188: 0x2000001,
          0x198: 0x2100000,
          0x1a8: 0x0,
          0x1b8: 0x2100401,
          0x1c8: 0x100401,
          0x1d8: 0x400,
          0x1e8: 0x2000400,
          0x1f8: 0x100001
        },
        {
          0x0: 0x8000820,
          0x1: 0x20000,
          0x2: 0x8000000,
          0x3: 0x20,
          0x4: 0x20020,
          0x5: 0x8020820,
          0x6: 0x8020800,
          0x7: 0x800,
          0x8: 0x8020000,
          0x9: 0x8000800,
          0xa: 0x20800,
          0xb: 0x8020020,
          0xc: 0x820,
          0xd: 0x0,
          0xe: 0x8000020,
          0xf: 0x20820,
          0x80000000: 0x800,
          0x80000001: 0x8020820,
          0x80000002: 0x8000820,
          0x80000003: 0x8000000,
          0x80000004: 0x8020000,
          0x80000005: 0x20800,
          0x80000006: 0x20820,
          0x80000007: 0x20,
          0x80000008: 0x8000020,
          0x80000009: 0x820,
          0x8000000a: 0x20020,
          0x8000000b: 0x8020800,
          0x8000000c: 0x0,
          0x8000000d: 0x8020020,
          0x8000000e: 0x8000800,
          0x8000000f: 0x20000,
          0x10: 0x20820,
          0x11: 0x8020800,
          0x12: 0x20,
          0x13: 0x800,
          0x14: 0x8000800,
          0x15: 0x8000020,
          0x16: 0x8020020,
          0x17: 0x20000,
          0x18: 0x0,
          0x19: 0x20020,
          0x1a: 0x8020000,
          0x1b: 0x8000820,
          0x1c: 0x8020820,
          0x1d: 0x20800,
          0x1e: 0x820,
          0x1f: 0x8000000,
          0x80000010: 0x20000,
          0x80000011: 0x800,
          0x80000012: 0x8020020,
          0x80000013: 0x20820,
          0x80000014: 0x20,
          0x80000015: 0x8020000,
          0x80000016: 0x8000000,
          0x80000017: 0x8000820,
          0x80000018: 0x8020820,
          0x80000019: 0x8000020,
          0x8000001a: 0x8000800,
          0x8000001b: 0x0,
          0x8000001c: 0x20800,
          0x8000001d: 0x820,
          0x8000001e: 0x20020,
          0x8000001f: 0x8020800
        }
      ];

      // Masks that select the SBOX input
      var SBOX_MASK = [
        0xf8000001, 0x1f800000, 0x01f80000, 0x001f8000,
        0x0001f800, 0x00001f80, 0x000001f8, 0x8000001f
      ];

      /**
       * DES block cipher algorithm.
       */
      var DES = C_algo.DES = BlockCipher.extend({
        _doReset: function () {
          // Shortcuts
          var key = this._key;
          var keyWords = key.words;

          // Select 56 bits according to PC1
          var keyBits = [];
          for (var i = 0; i < 56; i++) {
            var keyBitPos = PC1[i] - 1;
            keyBits[i] = (keyWords[keyBitPos >>> 5] >>> (31 - keyBitPos % 32)) & 1;
          }

          // Assemble 16 subkeys
          var subKeys = this._subKeys = [];
          for (var nSubKey = 0; nSubKey < 16; nSubKey++) {
            // Create subkey
            var subKey = subKeys[nSubKey] = [];

            // Shortcut
            var bitShift = BIT_SHIFTS[nSubKey];

            // Select 48 bits according to PC2
            for (var i = 0; i < 24; i++) {
              // Select from the left 28 key bits
              subKey[(i / 6) | 0] |= keyBits[((PC2[i] - 1) + bitShift) % 28] << (31 - i % 6);

              // Select from the right 28 key bits
              subKey[4 + ((i / 6) | 0)] |= keyBits[28 + (((PC2[i + 24] - 1) + bitShift) % 28)] << (31 - i % 6);
            }

            // Since each subkey is applied to an expanded 32-bit input,
            // the subkey can be broken into 8 values scaled to 32-bits,
            // which allows the key to be used without expansion
            subKey[0] = (subKey[0] << 1) | (subKey[0] >>> 31);
            for (var i = 1; i < 7; i++) {
              subKey[i] = subKey[i] >>> ((i - 1) * 4 + 3);
            }
            subKey[7] = (subKey[7] << 5) | (subKey[7] >>> 27);
          }

          // Compute inverse subkeys
          var invSubKeys = this._invSubKeys = [];
          for (var i = 0; i < 16; i++) {
            invSubKeys[i] = subKeys[15 - i];
          }
        },

        encryptBlock: function (M, offset) {
          this._doCryptBlock(M, offset, this._subKeys);
        },

        decryptBlock: function (M, offset) {
          this._doCryptBlock(M, offset, this._invSubKeys);
        },

        _doCryptBlock: function (M, offset, subKeys) {
          // Get input
          this._lBlock = M[offset];
          this._rBlock = M[offset + 1];

          // Initial permutation
          exchangeLR.call(this, 4,  0x0f0f0f0f);
          exchangeLR.call(this, 16, 0x0000ffff);
          exchangeRL.call(this, 2,  0x33333333);
          exchangeRL.call(this, 8,  0x00ff00ff);
          exchangeLR.call(this, 1,  0x55555555);

          // Rounds
          for (var round = 0; round < 16; round++) {
            // Shortcuts
            var subKey = subKeys[round];
            var lBlock = this._lBlock;
            var rBlock = this._rBlock;

            // Feistel function
            var f = 0;
            for (var i = 0; i < 8; i++) {
              f |= SBOX_P[i][((rBlock ^ subKey[i]) & SBOX_MASK[i]) >>> 0];
            }
            this._lBlock = rBlock;
            this._rBlock = lBlock ^ f;
          }

          // Undo swap from last round
          var t = this._lBlock;
          this._lBlock = this._rBlock;
          this._rBlock = t;

          // Final permutation
          exchangeLR.call(this, 1,  0x55555555);
          exchangeRL.call(this, 8,  0x00ff00ff);
          exchangeRL.call(this, 2,  0x33333333);
          exchangeLR.call(this, 16, 0x0000ffff);
          exchangeLR.call(this, 4,  0x0f0f0f0f);

          // Set output
          M[offset] = this._lBlock;
          M[offset + 1] = this._rBlock;
        },

        keySize: 64/32,

        ivSize: 64/32,

        blockSize: 64/32
      });

      // Swap bits across the left and right words
      function exchangeLR(offset, mask) {
        var t = ((this._lBlock >>> offset) ^ this._rBlock) & mask;
        this._rBlock ^= t;
        this._lBlock ^= t << offset;
      }

      function exchangeRL(offset, mask) {
        var t = ((this._rBlock >>> offset) ^ this._lBlock) & mask;
        this._lBlock ^= t;
        this._rBlock ^= t << offset;
      }

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.DES.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.DES.decrypt(ciphertext, key, cfg);
       */
      C.DES = BlockCipher._createHelper(DES);

      /**
       * Triple-DES block cipher algorithm.
       */
      var TripleDES = C_algo.TripleDES = BlockCipher.extend({
        _doReset: function () {
          // Shortcuts
          var key = this._key;
          var keyWords = key.words;

          // Create DES instances
          this._des1 = DES.createEncryptor(WordArray.create(keyWords.slice(0, 2)));
          this._des2 = DES.createEncryptor(WordArray.create(keyWords.slice(2, 4)));
          this._des3 = DES.createEncryptor(WordArray.create(keyWords.slice(4, 6)));
        },

        encryptBlock: function (M, offset) {
          this._des1.encryptBlock(M, offset);
          this._des2.decryptBlock(M, offset);
          this._des3.encryptBlock(M, offset);
        },

        decryptBlock: function (M, offset) {
          this._des3.decryptBlock(M, offset);
          this._des2.encryptBlock(M, offset);
          this._des1.decryptBlock(M, offset);
        },

        keySize: 192/32,

        ivSize: 64/32,

        blockSize: 64/32
      });

      /**
       * Shortcut functions to the cipher's object interface.
       *
       * @example
       *
       *     var ciphertext = CryptoJS.TripleDES.encrypt(message, key, cfg);
       *     var plaintext  = CryptoJS.TripleDES.decrypt(ciphertext, key, cfg);
       */
      C.TripleDES = BlockCipher._createHelper(TripleDES);
    }());


    return CryptoJS.TripleDES;

  }));
},{"./cipher-core":3,"./core":4,"./enc-base64":5,"./evpkdf":7,"./md5":12}],35:[function(require,module,exports){
  ;(function (root, factory) {
    if (typeof exports === "object") {
      // CommonJS
      module.exports = exports = factory(require("./core"));
    }
    else if (typeof define === "function" && define.amd) {
      // AMD
      define(["./core"], factory);
    }
    else {
      // Global (browser)
      factory(root.CryptoJS);
    }
  }(this, function (CryptoJS) {

    (function (undefined) {
      // Shortcuts
      var C = CryptoJS;
      var C_lib = C.lib;
      var Base = C_lib.Base;
      var X32WordArray = C_lib.WordArray;

      /**
       * x64 namespace.
       */
      var C_x64 = C.x64 = {};

      /**
       * A 64-bit word.
       */
      var X64Word = C_x64.Word = Base.extend({
        /**
         * Initializes a newly created 64-bit word.
         *
         * @param {number} high The high 32 bits.
         * @param {number} low The low 32 bits.
         *
         * @example
         *
         *     var x64Word = CryptoJS.x64.Word.create(0x00010203, 0x04050607);
         */
        init: function (high, low) {
          this.high = high;
          this.low = low;
        }

        /**
         * Bitwise NOTs this word.
         *
         * @return {X64Word} A new x64-Word object after negating.
         *
         * @example
         *
         *     var negated = x64Word.not();
         */
        // not: function () {
        // var high = ~this.high;
        // var low = ~this.low;

        // return X64Word.create(high, low);
        // },

        /**
         * Bitwise ANDs this word with the passed word.
         *
         * @param {X64Word} word The x64-Word to AND with this word.
         *
         * @return {X64Word} A new x64-Word object after ANDing.
         *
         * @example
         *
         *     var anded = x64Word.and(anotherX64Word);
         */
        // and: function (word) {
        // var high = this.high & word.high;
        // var low = this.low & word.low;

        // return X64Word.create(high, low);
        // },

        /**
         * Bitwise ORs this word with the passed word.
         *
         * @param {X64Word} word The x64-Word to OR with this word.
         *
         * @return {X64Word} A new x64-Word object after ORing.
         *
         * @example
         *
         *     var ored = x64Word.or(anotherX64Word);
         */
        // or: function (word) {
        // var high = this.high | word.high;
        // var low = this.low | word.low;

        // return X64Word.create(high, low);
        // },

        /**
         * Bitwise XORs this word with the passed word.
         *
         * @param {X64Word} word The x64-Word to XOR with this word.
         *
         * @return {X64Word} A new x64-Word object after XORing.
         *
         * @example
         *
         *     var xored = x64Word.xor(anotherX64Word);
         */
        // xor: function (word) {
        // var high = this.high ^ word.high;
        // var low = this.low ^ word.low;

        // return X64Word.create(high, low);
        // },

        /**
         * Shifts this word n bits to the left.
         *
         * @param {number} n The number of bits to shift.
         *
         * @return {X64Word} A new x64-Word object after shifting.
         *
         * @example
         *
         *     var shifted = x64Word.shiftL(25);
         */
        // shiftL: function (n) {
        // if (n < 32) {
        // var high = (this.high << n) | (this.low >>> (32 - n));
        // var low = this.low << n;
        // } else {
        // var high = this.low << (n - 32);
        // var low = 0;
        // }

        // return X64Word.create(high, low);
        // },

        /**
         * Shifts this word n bits to the right.
         *
         * @param {number} n The number of bits to shift.
         *
         * @return {X64Word} A new x64-Word object after shifting.
         *
         * @example
         *
         *     var shifted = x64Word.shiftR(7);
         */
        // shiftR: function (n) {
        // if (n < 32) {
        // var low = (this.low >>> n) | (this.high << (32 - n));
        // var high = this.high >>> n;
        // } else {
        // var low = this.high >>> (n - 32);
        // var high = 0;
        // }

        // return X64Word.create(high, low);
        // },

        /**
         * Rotates this word n bits to the left.
         *
         * @param {number} n The number of bits to rotate.
         *
         * @return {X64Word} A new x64-Word object after rotating.
         *
         * @example
         *
         *     var rotated = x64Word.rotL(25);
         */
        // rotL: function (n) {
        // return this.shiftL(n).or(this.shiftR(64 - n));
        // },

        /**
         * Rotates this word n bits to the right.
         *
         * @param {number} n The number of bits to rotate.
         *
         * @return {X64Word} A new x64-Word object after rotating.
         *
         * @example
         *
         *     var rotated = x64Word.rotR(7);
         */
        // rotR: function (n) {
        // return this.shiftR(n).or(this.shiftL(64 - n));
        // },

        /**
         * Adds this word with the passed word.
         *
         * @param {X64Word} word The x64-Word to add with this word.
         *
         * @return {X64Word} A new x64-Word object after adding.
         *
         * @example
         *
         *     var added = x64Word.add(anotherX64Word);
         */
        // add: function (word) {
        // var low = (this.low + word.low) | 0;
        // var carry = (low >>> 0) < (this.low >>> 0) ? 1 : 0;
        // var high = (this.high + word.high + carry) | 0;

        // return X64Word.create(high, low);
        // }
      });

      /**
       * An array of 64-bit words.
       *
       * @property {Array} words The array of CryptoJS.x64.Word objects.
       * @property {number} sigBytes The number of significant bytes in this word array.
       */
      var X64WordArray = C_x64.WordArray = Base.extend({
        /**
         * Initializes a newly created word array.
         *
         * @param {Array} words (Optional) An array of CryptoJS.x64.Word objects.
         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
         *
         * @example
         *
         *     var wordArray = CryptoJS.x64.WordArray.create();
         *
         *     var wordArray = CryptoJS.x64.WordArray.create([
         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
         *     ]);
         *
         *     var wordArray = CryptoJS.x64.WordArray.create([
         *         CryptoJS.x64.Word.create(0x00010203, 0x04050607),
         *         CryptoJS.x64.Word.create(0x18191a1b, 0x1c1d1e1f)
         *     ], 10);
         */
        init: function (words, sigBytes) {
          words = this.words = words || [];

          if (sigBytes != undefined) {
            this.sigBytes = sigBytes;
          } else {
            this.sigBytes = words.length * 8;
          }
        },

        /**
         * Converts this 64-bit word array to a 32-bit word array.
         *
         * @return {CryptoJS.lib.WordArray} This word array's data as a 32-bit word array.
         *
         * @example
         *
         *     var x32WordArray = x64WordArray.toX32();
         */
        toX32: function () {
          // Shortcuts
          var x64Words = this.words;
          var x64WordsLength = x64Words.length;

          // Convert
          var x32Words = [];
          for (var i = 0; i < x64WordsLength; i++) {
            var x64Word = x64Words[i];
            x32Words.push(x64Word.high);
            x32Words.push(x64Word.low);
          }

          return X32WordArray.create(x32Words, this.sigBytes);
        },

        /**
         * Creates a copy of this word array.
         *
         * @return {X64WordArray} The clone.
         *
         * @example
         *
         *     var clone = x64WordArray.clone();
         */
        clone: function () {
          var clone = Base.clone.call(this);

          // Clone "words" array
          var words = clone.words = this.words.slice(0);

          // Clone each X64Word object
          var wordsLength = words.length;
          for (var i = 0; i < wordsLength; i++) {
            words[i] = words[i].clone();
          }

          return clone;
        }
      });
    }());


    return CryptoJS;

  }));
},{"./core":4}],36:[function(require,module,exports){
// http://wiki.commonjs.org/wiki/Unit_Testing/1.0
//
// THIS IS NOT TESTED NOR LIKELY TO WORK OUTSIDE V8!
//
// Originally from narwhal.js (http://narwhaljs.org)
// Copyright (c) 2009 Thomas Robinson <280north.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the 'Software'), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
// ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

// when used in node, this will actually load the util module we depend on
// versus loading the builtin util module as happens otherwise
// this is a bug in node module loading as far as I am concerned
  var util = require('util/');

  var pSlice = Array.prototype.slice;
  var hasOwn = Object.prototype.hasOwnProperty;

// 1. The assert module provides functions that throw
// AssertionError's when particular conditions are not met. The
// assert module must conform to the following interface.

  var assert = module.exports = ok;

// 2. The AssertionError is defined in assert.
// new assert.AssertionError({ message: message,
//                             actual: actual,
//                             expected: expected })

  assert.AssertionError = function AssertionError(options) {
    this.name = 'AssertionError';
    this.actual = options.actual;
    this.expected = options.expected;
    this.operator = options.operator;
    if (options.message) {
      this.message = options.message;
      this.generatedMessage = false;
    } else {
      this.message = getMessage(this);
      this.generatedMessage = true;
    }
    var stackStartFunction = options.stackStartFunction || fail;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, stackStartFunction);
    }
    else {
      // non v8 browsers so we can have a stacktrace
      var err = new Error();
      if (err.stack) {
        var out = err.stack;

        // try to strip useless frames
        var fn_name = stackStartFunction.name;
        var idx = out.indexOf('\n' + fn_name);
        if (idx >= 0) {
          // once we have located the function frame
          // we need to strip out everything before it (and its line)
          var next_line = out.indexOf('\n', idx + 1);
          out = out.substring(next_line + 1);
        }

        this.stack = out;
      }
    }
  };

// assert.AssertionError instanceof Error
  util.inherits(assert.AssertionError, Error);

  function replacer(key, value) {
    if (util.isUndefined(value)) {
      return '' + value;
    }
    if (util.isNumber(value) && (isNaN(value) || !isFinite(value))) {
      return value.toString();
    }
    if (util.isFunction(value) || util.isRegExp(value)) {
      return value.toString();
    }
    return value;
  }

  function truncate(s, n) {
    if (util.isString(s)) {
      return s.length < n ? s : s.slice(0, n);
    } else {
      return s;
    }
  }

  function getMessage(self) {
    return truncate(JSON.stringify(self.actual, replacer), 128) + ' ' +
      self.operator + ' ' +
      truncate(JSON.stringify(self.expected, replacer), 128);
  }

// At present only the three keys mentioned above are used and
// understood by the spec. Implementations or sub modules can pass
// other keys to the AssertionError's constructor - they will be
// ignored.

// 3. All of the following functions must throw an AssertionError
// when a corresponding condition is not met, with a message that
// may be undefined if not provided.  All assertion methods provide
// both the actual and expected values to the assertion error for
// display purposes.

  function fail(actual, expected, message, operator, stackStartFunction) {
    throw new assert.AssertionError({
      message: message,
      actual: actual,
      expected: expected,
      operator: operator,
      stackStartFunction: stackStartFunction
    });
  }

// EXTENSION! allows for well behaved errors defined elsewhere.
  assert.fail = fail;

// 4. Pure assertion tests whether a value is truthy, as determined
// by !!guard.
// assert.ok(guard, message_opt);
// This statement is equivalent to assert.equal(true, !!guard,
// message_opt);. To test strictly for the value true, use
// assert.strictEqual(true, guard, message_opt);.

  function ok(value, message) {
    if (!value) fail(value, true, message, '==', assert.ok);
  }
  assert.ok = ok;

// 5. The equality assertion tests shallow, coercive equality with
// ==.
// assert.equal(actual, expected, message_opt);

  assert.equal = function equal(actual, expected, message) {
    if (actual != expected) fail(actual, expected, message, '==', assert.equal);
  };

// 6. The non-equality assertion tests for whether two objects are not equal
// with != assert.notEqual(actual, expected, message_opt);

  assert.notEqual = function notEqual(actual, expected, message) {
    if (actual == expected) {
      fail(actual, expected, message, '!=', assert.notEqual);
    }
  };

// 7. The equivalence assertion tests a deep equality relation.
// assert.deepEqual(actual, expected, message_opt);

  assert.deepEqual = function deepEqual(actual, expected, message) {
    if (!_deepEqual(actual, expected)) {
      fail(actual, expected, message, 'deepEqual', assert.deepEqual);
    }
  };

  function _deepEqual(actual, expected) {
    // 7.1. All identical values are equivalent, as determined by ===.
    if (actual === expected) {
      return true;

    } else if (util.isBuffer(actual) && util.isBuffer(expected)) {
      if (actual.length != expected.length) return false;

      for (var i = 0; i < actual.length; i++) {
        if (actual[i] !== expected[i]) return false;
      }

      return true;

      // 7.2. If the expected value is a Date object, the actual value is
      // equivalent if it is also a Date object that refers to the same time.
    } else if (util.isDate(actual) && util.isDate(expected)) {
      return actual.getTime() === expected.getTime();

      // 7.3 If the expected value is a RegExp object, the actual value is
      // equivalent if it is also a RegExp object with the same source and
      // properties (`global`, `multiline`, `lastIndex`, `ignoreCase`).
    } else if (util.isRegExp(actual) && util.isRegExp(expected)) {
      return actual.source === expected.source &&
        actual.global === expected.global &&
        actual.multiline === expected.multiline &&
        actual.lastIndex === expected.lastIndex &&
        actual.ignoreCase === expected.ignoreCase;

      // 7.4. Other pairs that do not both pass typeof value == 'object',
      // equivalence is determined by ==.
    } else if (!util.isObject(actual) && !util.isObject(expected)) {
      return actual == expected;

      // 7.5 For all other Object pairs, including Array objects, equivalence is
      // determined by having the same number of owned properties (as verified
      // with Object.prototype.hasOwnProperty.call), the same set of keys
      // (although not necessarily the same order), equivalent values for every
      // corresponding key, and an identical 'prototype' property. Note: this
      // accounts for both named and indexed properties on Arrays.
    } else {
      return objEquiv(actual, expected);
    }
  }

  function isArguments(object) {
    return Object.prototype.toString.call(object) == '[object Arguments]';
  }

  function objEquiv(a, b) {
    if (util.isNullOrUndefined(a) || util.isNullOrUndefined(b))
      return false;
    // an identical 'prototype' property.
    if (a.prototype !== b.prototype) return false;
    //~~~I've managed to break Object.keys through screwy arguments passing.
    //   Converting to array solves the problem.
    if (isArguments(a)) {
      if (!isArguments(b)) {
        return false;
      }
      a = pSlice.call(a);
      b = pSlice.call(b);
      return _deepEqual(a, b);
    }
    try {
      var ka = objectKeys(a),
        kb = objectKeys(b),
        key, i;
    } catch (e) {//happens when one is a string literal and the other isn't
      return false;
    }
    // having the same number of owned properties (keys incorporates
    // hasOwnProperty)
    if (ka.length != kb.length)
      return false;
    //the same set of keys (although not necessarily the same order),
    ka.sort();
    kb.sort();
    //~~~cheap key test
    for (i = ka.length - 1; i >= 0; i--) {
      if (ka[i] != kb[i])
        return false;
    }
    //equivalent values for every corresponding key, and
    //~~~possibly expensive deep test
    for (i = ka.length - 1; i >= 0; i--) {
      key = ka[i];
      if (!_deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

// 8. The non-equivalence assertion tests for any deep inequality.
// assert.notDeepEqual(actual, expected, message_opt);

  assert.notDeepEqual = function notDeepEqual(actual, expected, message) {
    if (_deepEqual(actual, expected)) {
      fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
    }
  };

// 9. The strict equality assertion tests strict equality, as determined by ===.
// assert.strictEqual(actual, expected, message_opt);

  assert.strictEqual = function strictEqual(actual, expected, message) {
    if (actual !== expected) {
      fail(actual, expected, message, '===', assert.strictEqual);
    }
  };

// 10. The strict non-equality assertion tests for strict inequality, as
// determined by !==.  assert.notStrictEqual(actual, expected, message_opt);

  assert.notStrictEqual = function notStrictEqual(actual, expected, message) {
    if (actual === expected) {
      fail(actual, expected, message, '!==', assert.notStrictEqual);
    }
  };

  function expectedException(actual, expected) {
    if (!actual || !expected) {
      return false;
    }

    if (Object.prototype.toString.call(expected) == '[object RegExp]') {
      return expected.test(actual);
    } else if (actual instanceof expected) {
      return true;
    } else if (expected.call({}, actual) === true) {
      return true;
    }

    return false;
  }

  function _throws(shouldThrow, block, expected, message) {
    var actual;

    if (util.isString(expected)) {
      message = expected;
      expected = null;
    }

    try {
      block();
    } catch (e) {
      actual = e;
    }

    message = (expected && expected.name ? ' (' + expected.name + ').' : '.') +
      (message ? ' ' + message : '.');

    if (shouldThrow && !actual) {
      fail(actual, expected, 'Missing expected exception' + message);
    }

    if (!shouldThrow && expectedException(actual, expected)) {
      fail(actual, expected, 'Got unwanted exception' + message);
    }

    if ((shouldThrow && actual && expected &&
        !expectedException(actual, expected)) || (!shouldThrow && actual)) {
      throw actual;
    }
  }

// 11. Expected to throw an error:
// assert.throws(block, Error_opt, message_opt);

  assert.throws = function(block, /*optional*/error, /*optional*/message) {
    _throws.apply(this, [true].concat(pSlice.call(arguments)));
  };

// EXTENSION! This is annoying to write outside this module.
  assert.doesNotThrow = function(block, /*optional*/message) {
    _throws.apply(this, [false].concat(pSlice.call(arguments)));
  };

  assert.ifError = function(err) { if (err) {throw err;}};

  var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) {
      if (hasOwn.call(obj, key)) keys.push(key);
    }
    return keys;
  };

},{"util/":59}],37:[function(require,module,exports){
  var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  ;(function (exports) {
    'use strict';

    var Arr = (typeof Uint8Array !== 'undefined')
      ? Uint8Array
      : Array

    var PLUS   = '+'.charCodeAt(0)
    var SLASH  = '/'.charCodeAt(0)
    var NUMBER = '0'.charCodeAt(0)
    var LOWER  = 'a'.charCodeAt(0)
    var UPPER  = 'A'.charCodeAt(0)
    var PLUS_URL_SAFE = '-'.charCodeAt(0)
    var SLASH_URL_SAFE = '_'.charCodeAt(0)

    function decode (elt) {
      var code = elt.charCodeAt(0)
      if (code === PLUS ||
        code === PLUS_URL_SAFE)
        return 62 // '+'
      if (code === SLASH ||
        code === SLASH_URL_SAFE)
        return 63 // '/'
      if (code < NUMBER)
        return -1 //no match
      if (code < NUMBER + 10)
        return code - NUMBER + 26 + 26
      if (code < UPPER + 26)
        return code - UPPER
      if (code < LOWER + 26)
        return code - LOWER + 26
    }

    function b64ToByteArray (b64) {
      var i, j, l, tmp, placeHolders, arr

      if (b64.length % 4 > 0) {
        throw new Error('Invalid string. Length must be a multiple of 4')
      }

      // the number of equal signs (place holders)
      // if there are two placeholders, than the two characters before it
      // represent one byte
      // if there is only one, then the three characters before it represent 2 bytes
      // this is just a cheap hack to not do indexOf twice
      var len = b64.length
      placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

      // base64 is 4/3 + up to two characters of the original data
      arr = new Arr(b64.length * 3 / 4 - placeHolders)

      // if there are placeholders, only get up to the last complete 4 chars
      l = placeHolders > 0 ? b64.length - 4 : b64.length

      var L = 0

      function push (v) {
        arr[L++] = v
      }

      for (i = 0, j = 0; i < l; i += 4, j += 3) {
        tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
        push((tmp & 0xFF0000) >> 16)
        push((tmp & 0xFF00) >> 8)
        push(tmp & 0xFF)
      }

      if (placeHolders === 2) {
        tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
        push(tmp & 0xFF)
      } else if (placeHolders === 1) {
        tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
        push((tmp >> 8) & 0xFF)
        push(tmp & 0xFF)
      }

      return arr
    }

    function uint8ToBase64 (uint8) {
      var i,
        extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
        output = "",
        temp, length

      function encode (num) {
        return lookup.charAt(num)
      }

      function tripletToBase64 (num) {
        return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
      }

      // go through the array every three bytes, we'll deal with trailing stuff later
      for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
        temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
        output += tripletToBase64(temp)
      }

      // pad the end with zeros, but make sure to not forget the extra bytes
      switch (extraBytes) {
        case 1:
          temp = uint8[uint8.length - 1]
          output += encode(temp >> 2)
          output += encode((temp << 4) & 0x3F)
          output += '=='
          break
        case 2:
          temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
          output += encode(temp >> 10)
          output += encode((temp >> 4) & 0x3F)
          output += encode((temp << 2) & 0x3F)
          output += '='
          break
      }

      return output
    }

    exports.toByteArray = b64ToByteArray
    exports.fromByteArray = uint8ToBase64
  }(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],38:[function(require,module,exports){
  /*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

  var base64 = require('base64-js')
  var ieee754 = require('ieee754')

  exports.Buffer = Buffer
  exports.SlowBuffer = Buffer
  exports.INSPECT_MAX_BYTES = 50
  Buffer.poolSize = 8192

  /**
   * If `Buffer._useTypedArrays`:
   *   === true    Use Uint8Array implementation (fastest)
   *   === false   Use Object implementation (compatible down to IE6)
   */
  Buffer._useTypedArrays = (function () {
    // Detect if browser supports Typed Arrays. Supported browsers are IE 10+, Firefox 4+,
    // Chrome 7+, Safari 5.1+, Opera 11.6+, iOS 4.2+. If the browser does not support adding
    // properties to `Uint8Array` instances, then that's the same as no `Uint8Array` support
    // because we need to be able to add all the node Buffer API methods. This is an issue
    // in Firefox 4-29. Now fixed: https://bugzilla.mozilla.org/show_bug.cgi?id=695438
    try {
      var buf = new ArrayBuffer(0)
      var arr = new Uint8Array(buf)
      arr.foo = function () { return 42 }
      return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
    } catch (e) {
      return false
    }
  })()

  /**
   * Class: Buffer
   * =============
   *
   * The Buffer constructor returns instances of `Uint8Array` that are augmented
   * with function properties for all the node `Buffer` API functions. We use
   * `Uint8Array` so that square bracket notation works as expected -- it returns
   * a single octet.
   *
   * By augmenting the instances, we can avoid modifying the `Uint8Array`
   * prototype.
   */
  function Buffer (subject, encoding, noZero) {
    if (!(this instanceof Buffer))
      return new Buffer(subject, encoding, noZero)

    var type = typeof subject

    // Workaround: node's base64 implementation allows for non-padded strings
    // while base64-js does not.
    if (encoding === 'base64' && type === 'string') {
      subject = stringtrim(subject)
      while (subject.length % 4 !== 0) {
        subject = subject + '='
      }
    }

    // Find the length
    var length
    if (type === 'number')
      length = coerce(subject)
    else if (type === 'string')
      length = Buffer.byteLength(subject, encoding)
    else if (type === 'object')
      length = coerce(subject.length) // assume that object is array-like
    else
      throw new Error('First argument needs to be a number, array or string.')

    var buf
    if (Buffer._useTypedArrays) {
      // Preferred: Return an augmented `Uint8Array` instance for best performance
      buf = Buffer._augment(new Uint8Array(length))
    } else {
      // Fallback: Return THIS instance of Buffer (created by `new`)
      buf = this
      buf.length = length
      buf._isBuffer = true
    }

    var i
    if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
      // Speed optimization -- use set if we're copying from a typed array
      buf._set(subject)
    } else if (isArrayish(subject)) {
      // Treat array-ish objects as a byte array
      for (i = 0; i < length; i++) {
        if (Buffer.isBuffer(subject))
          buf[i] = subject.readUInt8(i)
        else
          buf[i] = subject[i]
      }
    } else if (type === 'string') {
      buf.write(subject, 0, encoding)
    } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
      for (i = 0; i < length; i++) {
        buf[i] = 0
      }
    }

    return buf
  }

// STATIC METHODS
// ==============

  Buffer.isEncoding = function (encoding) {
    switch (String(encoding).toLowerCase()) {
      case 'hex':
      case 'utf8':
      case 'utf-8':
      case 'ascii':
      case 'binary':
      case 'base64':
      case 'raw':
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return true
      default:
        return false
    }
  }

  Buffer.isBuffer = function (b) {
    return !!(b !== null && b !== undefined && b._isBuffer)
  }

  Buffer.byteLength = function (str, encoding) {
    var ret
    str = str + ''
    switch (encoding || 'utf8') {
      case 'hex':
        ret = str.length / 2
        break
      case 'utf8':
      case 'utf-8':
        ret = utf8ToBytes(str).length
        break
      case 'ascii':
      case 'binary':
      case 'raw':
        ret = str.length
        break
      case 'base64':
        ret = base64ToBytes(str).length
        break
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        ret = str.length * 2
        break
      default:
        throw new Error('Unknown encoding')
    }
    return ret
  }

  Buffer.concat = function (list, totalLength) {
    assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

    if (list.length === 0) {
      return new Buffer(0)
    } else if (list.length === 1) {
      return list[0]
    }

    var i
    if (typeof totalLength !== 'number') {
      totalLength = 0
      for (i = 0; i < list.length; i++) {
        totalLength += list[i].length
      }
    }

    var buf = new Buffer(totalLength)
    var pos = 0
    for (i = 0; i < list.length; i++) {
      var item = list[i]
      item.copy(buf, pos)
      pos += item.length
    }
    return buf
  }

// BUFFER INSTANCE METHODS
// =======================

  function _hexWrite (buf, string, offset, length) {
    offset = Number(offset) || 0
    var remaining = buf.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }

    // must be an even number of digits
    var strLen = string.length
    assert(strLen % 2 === 0, 'Invalid hex string')

    if (length > strLen / 2) {
      length = strLen / 2
    }
    for (var i = 0; i < length; i++) {
      var byte = parseInt(string.substr(i * 2, 2), 16)
      assert(!isNaN(byte), 'Invalid hex string')
      buf[offset + i] = byte
    }
    Buffer._charsWritten = i * 2
    return i
  }

  function _utf8Write (buf, string, offset, length) {
    var charsWritten = Buffer._charsWritten =
      blitBuffer(utf8ToBytes(string), buf, offset, length)
    return charsWritten
  }

  function _asciiWrite (buf, string, offset, length) {
    var charsWritten = Buffer._charsWritten =
      blitBuffer(asciiToBytes(string), buf, offset, length)
    return charsWritten
  }

  function _binaryWrite (buf, string, offset, length) {
    return _asciiWrite(buf, string, offset, length)
  }

  function _base64Write (buf, string, offset, length) {
    var charsWritten = Buffer._charsWritten =
      blitBuffer(base64ToBytes(string), buf, offset, length)
    return charsWritten
  }

  function _utf16leWrite (buf, string, offset, length) {
    var charsWritten = Buffer._charsWritten =
      blitBuffer(utf16leToBytes(string), buf, offset, length)
    return charsWritten
  }

  Buffer.prototype.write = function (string, offset, length, encoding) {
    // Support both (string, offset, length, encoding)
    // and the legacy (string, encoding, offset, length)
    if (isFinite(offset)) {
      if (!isFinite(length)) {
        encoding = length
        length = undefined
      }
    } else {  // legacy
      var swap = encoding
      encoding = offset
      offset = length
      length = swap
    }

    offset = Number(offset) || 0
    var remaining = this.length - offset
    if (!length) {
      length = remaining
    } else {
      length = Number(length)
      if (length > remaining) {
        length = remaining
      }
    }
    encoding = String(encoding || 'utf8').toLowerCase()

    var ret
    switch (encoding) {
      case 'hex':
        ret = _hexWrite(this, string, offset, length)
        break
      case 'utf8':
      case 'utf-8':
        ret = _utf8Write(this, string, offset, length)
        break
      case 'ascii':
        ret = _asciiWrite(this, string, offset, length)
        break
      case 'binary':
        ret = _binaryWrite(this, string, offset, length)
        break
      case 'base64':
        ret = _base64Write(this, string, offset, length)
        break
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        ret = _utf16leWrite(this, string, offset, length)
        break
      default:
        throw new Error('Unknown encoding')
    }
    return ret
  }

  Buffer.prototype.toString = function (encoding, start, end) {
    var self = this

    encoding = String(encoding || 'utf8').toLowerCase()
    start = Number(start) || 0
    end = (end !== undefined)
      ? Number(end)
      : end = self.length

    // Fastpath empty strings
    if (end === start)
      return ''

    var ret
    switch (encoding) {
      case 'hex':
        ret = _hexSlice(self, start, end)
        break
      case 'utf8':
      case 'utf-8':
        ret = _utf8Slice(self, start, end)
        break
      case 'ascii':
        ret = _asciiSlice(self, start, end)
        break
      case 'binary':
        ret = _binarySlice(self, start, end)
        break
      case 'base64':
        ret = _base64Slice(self, start, end)
        break
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        ret = _utf16leSlice(self, start, end)
        break
      default:
        throw new Error('Unknown encoding')
    }
    return ret
  }

  Buffer.prototype.toJSON = function () {
    return {
      type: 'Buffer',
      data: Array.prototype.slice.call(this._arr || this, 0)
    }
  }

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
  Buffer.prototype.copy = function (target, target_start, start, end) {
    var source = this

    if (!start) start = 0
    if (!end && end !== 0) end = this.length
    if (!target_start) target_start = 0

    // Copy 0 bytes; we're done
    if (end === start) return
    if (target.length === 0 || source.length === 0) return

    // Fatal error conditions
    assert(end >= start, 'sourceEnd < sourceStart')
    assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
    assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
    assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

    // Are we oob?
    if (end > this.length)
      end = this.length
    if (target.length - target_start < end - start)
      end = target.length - target_start + start

    var len = end - start

    if (len < 100 || !Buffer._useTypedArrays) {
      for (var i = 0; i < len; i++)
        target[i + target_start] = this[i + start]
    } else {
      target._set(this.subarray(start, start + len), target_start)
    }
  }

  function _base64Slice (buf, start, end) {
    if (start === 0 && end === buf.length) {
      return base64.fromByteArray(buf)
    } else {
      return base64.fromByteArray(buf.slice(start, end))
    }
  }

  function _utf8Slice (buf, start, end) {
    var res = ''
    var tmp = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; i++) {
      if (buf[i] <= 0x7F) {
        res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
        tmp = ''
      } else {
        tmp += '%' + buf[i].toString(16)
      }
    }

    return res + decodeUtf8Char(tmp)
  }

  function _asciiSlice (buf, start, end) {
    var ret = ''
    end = Math.min(buf.length, end)

    for (var i = start; i < end; i++)
      ret += String.fromCharCode(buf[i])
    return ret
  }

  function _binarySlice (buf, start, end) {
    return _asciiSlice(buf, start, end)
  }

  function _hexSlice (buf, start, end) {
    var len = buf.length

    if (!start || start < 0) start = 0
    if (!end || end < 0 || end > len) end = len

    var out = ''
    for (var i = start; i < end; i++) {
      out += toHex(buf[i])
    }
    return out
  }

  function _utf16leSlice (buf, start, end) {
    var bytes = buf.slice(start, end)
    var res = ''
    for (var i = 0; i < bytes.length; i += 2) {
      res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
    }
    return res
  }

  Buffer.prototype.slice = function (start, end) {
    var len = this.length
    start = clamp(start, len, 0)
    end = clamp(end, len, len)

    if (Buffer._useTypedArrays) {
      return Buffer._augment(this.subarray(start, end))
    } else {
      var sliceLen = end - start
      var newBuf = new Buffer(sliceLen, undefined, true)
      for (var i = 0; i < sliceLen; i++) {
        newBuf[i] = this[i + start]
      }
      return newBuf
    }
  }

// `get` will be removed in Node 0.13+
  Buffer.prototype.get = function (offset) {
    console.log('.get() is deprecated. Access using array indexes instead.')
    return this.readUInt8(offset)
  }

// `set` will be removed in Node 0.13+
  Buffer.prototype.set = function (v, offset) {
    console.log('.set() is deprecated. Access using array indexes instead.')
    return this.writeUInt8(v, offset)
  }

  Buffer.prototype.readUInt8 = function (offset, noAssert) {
    if (!noAssert) {
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset < this.length, 'Trying to read beyond buffer length')
    }

    if (offset >= this.length)
      return

    return this[offset]
  }

  function _readUInt16 (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
    }

    var len = buf.length
    if (offset >= len)
      return

    var val
    if (littleEndian) {
      val = buf[offset]
      if (offset + 1 < len)
        val |= buf[offset + 1] << 8
    } else {
      val = buf[offset] << 8
      if (offset + 1 < len)
        val |= buf[offset + 1]
    }
    return val
  }

  Buffer.prototype.readUInt16LE = function (offset, noAssert) {
    return _readUInt16(this, offset, true, noAssert)
  }

  Buffer.prototype.readUInt16BE = function (offset, noAssert) {
    return _readUInt16(this, offset, false, noAssert)
  }

  function _readUInt32 (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
    }

    var len = buf.length
    if (offset >= len)
      return

    var val
    if (littleEndian) {
      if (offset + 2 < len)
        val = buf[offset + 2] << 16
      if (offset + 1 < len)
        val |= buf[offset + 1] << 8
      val |= buf[offset]
      if (offset + 3 < len)
        val = val + (buf[offset + 3] << 24 >>> 0)
    } else {
      if (offset + 1 < len)
        val = buf[offset + 1] << 16
      if (offset + 2 < len)
        val |= buf[offset + 2] << 8
      if (offset + 3 < len)
        val |= buf[offset + 3]
      val = val + (buf[offset] << 24 >>> 0)
    }
    return val
  }

  Buffer.prototype.readUInt32LE = function (offset, noAssert) {
    return _readUInt32(this, offset, true, noAssert)
  }

  Buffer.prototype.readUInt32BE = function (offset, noAssert) {
    return _readUInt32(this, offset, false, noAssert)
  }

  Buffer.prototype.readInt8 = function (offset, noAssert) {
    if (!noAssert) {
      assert(offset !== undefined && offset !== null,
        'missing offset')
      assert(offset < this.length, 'Trying to read beyond buffer length')
    }

    if (offset >= this.length)
      return

    var neg = this[offset] & 0x80
    if (neg)
      return (0xff - this[offset] + 1) * -1
    else
      return this[offset]
  }

  function _readInt16 (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
    }

    var len = buf.length
    if (offset >= len)
      return

    var val = _readUInt16(buf, offset, littleEndian, true)
    var neg = val & 0x8000
    if (neg)
      return (0xffff - val + 1) * -1
    else
      return val
  }

  Buffer.prototype.readInt16LE = function (offset, noAssert) {
    return _readInt16(this, offset, true, noAssert)
  }

  Buffer.prototype.readInt16BE = function (offset, noAssert) {
    return _readInt16(this, offset, false, noAssert)
  }

  function _readInt32 (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
    }

    var len = buf.length
    if (offset >= len)
      return

    var val = _readUInt32(buf, offset, littleEndian, true)
    var neg = val & 0x80000000
    if (neg)
      return (0xffffffff - val + 1) * -1
    else
      return val
  }

  Buffer.prototype.readInt32LE = function (offset, noAssert) {
    return _readInt32(this, offset, true, noAssert)
  }

  Buffer.prototype.readInt32BE = function (offset, noAssert) {
    return _readInt32(this, offset, false, noAssert)
  }

  function _readFloat (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
    }

    return ieee754.read(buf, offset, littleEndian, 23, 4)
  }

  Buffer.prototype.readFloatLE = function (offset, noAssert) {
    return _readFloat(this, offset, true, noAssert)
  }

  Buffer.prototype.readFloatBE = function (offset, noAssert) {
    return _readFloat(this, offset, false, noAssert)
  }

  function _readDouble (buf, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
    }

    return ieee754.read(buf, offset, littleEndian, 52, 8)
  }

  Buffer.prototype.readDoubleLE = function (offset, noAssert) {
    return _readDouble(this, offset, true, noAssert)
  }

  Buffer.prototype.readDoubleBE = function (offset, noAssert) {
    return _readDouble(this, offset, false, noAssert)
  }

  Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset < this.length, 'trying to write beyond buffer length')
      verifuint(value, 0xff)
    }

    if (offset >= this.length) return

    this[offset] = value
  }

  function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
      verifuint(value, 0xffff)
    }

    var len = buf.length
    if (offset >= len)
      return

    for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
      buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
        (littleEndian ? i : 1 - i) * 8
    }
  }

  Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
    _writeUInt16(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
    _writeUInt16(this, value, offset, false, noAssert)
  }

  function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
      verifuint(value, 0xffffffff)
    }

    var len = buf.length
    if (offset >= len)
      return

    for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
      buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
    }
  }

  Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
    _writeUInt32(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
    _writeUInt32(this, value, offset, false, noAssert)
  }

  Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset < this.length, 'Trying to write beyond buffer length')
      verifsint(value, 0x7f, -0x80)
    }

    if (offset >= this.length)
      return

    if (value >= 0)
      this.writeUInt8(value, offset, noAssert)
    else
      this.writeUInt8(0xff + value + 1, offset, noAssert)
  }

  function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
      verifsint(value, 0x7fff, -0x8000)
    }

    var len = buf.length
    if (offset >= len)
      return

    if (value >= 0)
      _writeUInt16(buf, value, offset, littleEndian, noAssert)
    else
      _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
  }

  Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
    _writeInt16(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
    _writeInt16(this, value, offset, false, noAssert)
  }

  function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
      verifsint(value, 0x7fffffff, -0x80000000)
    }

    var len = buf.length
    if (offset >= len)
      return

    if (value >= 0)
      _writeUInt32(buf, value, offset, littleEndian, noAssert)
    else
      _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
  }

  Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
    _writeInt32(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
    _writeInt32(this, value, offset, false, noAssert)
  }

  function _writeFloat (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
      verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
    }

    var len = buf.length
    if (offset >= len)
      return

    ieee754.write(buf, value, offset, littleEndian, 23, 4)
  }

  Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
    _writeFloat(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
    _writeFloat(this, value, offset, false, noAssert)
  }

  function _writeDouble (buf, value, offset, littleEndian, noAssert) {
    if (!noAssert) {
      assert(value !== undefined && value !== null, 'missing value')
      assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
      assert(offset !== undefined && offset !== null, 'missing offset')
      assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
      verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
    }

    var len = buf.length
    if (offset >= len)
      return

    ieee754.write(buf, value, offset, littleEndian, 52, 8)
  }

  Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
    _writeDouble(this, value, offset, true, noAssert)
  }

  Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
    _writeDouble(this, value, offset, false, noAssert)
  }

// fill(value, start=0, end=buffer.length)
  Buffer.prototype.fill = function (value, start, end) {
    if (!value) value = 0
    if (!start) start = 0
    if (!end) end = this.length

    if (typeof value === 'string') {
      value = value.charCodeAt(0)
    }

    assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
    assert(end >= start, 'end < start')

    // Fill 0 bytes; we're done
    if (end === start) return
    if (this.length === 0) return

    assert(start >= 0 && start < this.length, 'start out of bounds')
    assert(end >= 0 && end <= this.length, 'end out of bounds')

    for (var i = start; i < end; i++) {
      this[i] = value
    }
  }

  Buffer.prototype.inspect = function () {
    var out = []
    var len = this.length
    for (var i = 0; i < len; i++) {
      out[i] = toHex(this[i])
      if (i === exports.INSPECT_MAX_BYTES) {
        out[i + 1] = '...'
        break
      }
    }
    return '<Buffer ' + out.join(' ') + '>'
  }

  /**
   * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
   * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
   */
  Buffer.prototype.toArrayBuffer = function () {
    if (typeof Uint8Array !== 'undefined') {
      if (Buffer._useTypedArrays) {
        return (new Buffer(this)).buffer
      } else {
        var buf = new Uint8Array(this.length)
        for (var i = 0, len = buf.length; i < len; i += 1)
          buf[i] = this[i]
        return buf.buffer
      }
    } else {
      throw new Error('Buffer.toArrayBuffer not supported in this browser')
    }
  }

// HELPER FUNCTIONS
// ================

  function stringtrim (str) {
    if (str.trim) return str.trim()
    return str.replace(/^\s+|\s+$/g, '')
  }

  var BP = Buffer.prototype

  /**
   * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
   */
  Buffer._augment = function (arr) {
    arr._isBuffer = true

    // save reference to original Uint8Array get/set methods before overwriting
    arr._get = arr.get
    arr._set = arr.set

    // deprecated, will be removed in node 0.13+
    arr.get = BP.get
    arr.set = BP.set

    arr.write = BP.write
    arr.toString = BP.toString
    arr.toLocaleString = BP.toString
    arr.toJSON = BP.toJSON
    arr.copy = BP.copy
    arr.slice = BP.slice
    arr.readUInt8 = BP.readUInt8
    arr.readUInt16LE = BP.readUInt16LE
    arr.readUInt16BE = BP.readUInt16BE
    arr.readUInt32LE = BP.readUInt32LE
    arr.readUInt32BE = BP.readUInt32BE
    arr.readInt8 = BP.readInt8
    arr.readInt16LE = BP.readInt16LE
    arr.readInt16BE = BP.readInt16BE
    arr.readInt32LE = BP.readInt32LE
    arr.readInt32BE = BP.readInt32BE
    arr.readFloatLE = BP.readFloatLE
    arr.readFloatBE = BP.readFloatBE
    arr.readDoubleLE = BP.readDoubleLE
    arr.readDoubleBE = BP.readDoubleBE
    arr.writeUInt8 = BP.writeUInt8
    arr.writeUInt16LE = BP.writeUInt16LE
    arr.writeUInt16BE = BP.writeUInt16BE
    arr.writeUInt32LE = BP.writeUInt32LE
    arr.writeUInt32BE = BP.writeUInt32BE
    arr.writeInt8 = BP.writeInt8
    arr.writeInt16LE = BP.writeInt16LE
    arr.writeInt16BE = BP.writeInt16BE
    arr.writeInt32LE = BP.writeInt32LE
    arr.writeInt32BE = BP.writeInt32BE
    arr.writeFloatLE = BP.writeFloatLE
    arr.writeFloatBE = BP.writeFloatBE
    arr.writeDoubleLE = BP.writeDoubleLE
    arr.writeDoubleBE = BP.writeDoubleBE
    arr.fill = BP.fill
    arr.inspect = BP.inspect
    arr.toArrayBuffer = BP.toArrayBuffer

    return arr
  }

// slice(start, end)
  function clamp (index, len, defaultValue) {
    if (typeof index !== 'number') return defaultValue
    index = ~~index;  // Coerce to integer.
    if (index >= len) return len
    if (index >= 0) return index
    index += len
    if (index >= 0) return index
    return 0
  }

  function coerce (length) {
    // Coerce length to a number (possibly NaN), round up
    // in case it's fractional (e.g. 123.456) then do a
    // double negate to coerce a NaN to 0. Easy, right?
    length = ~~Math.ceil(+length)
    return length < 0 ? 0 : length
  }

  function isArray (subject) {
    return (Array.isArray || function (subject) {
      return Object.prototype.toString.call(subject) === '[object Array]'
    })(subject)
  }

  function isArrayish (subject) {
    return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
  }

  function toHex (n) {
    if (n < 16) return '0' + n.toString(16)
    return n.toString(16)
  }

  function utf8ToBytes (str) {
    var byteArray = []
    for (var i = 0; i < str.length; i++) {
      var b = str.charCodeAt(i)
      if (b <= 0x7F)
        byteArray.push(str.charCodeAt(i))
      else {
        var start = i
        if (b >= 0xD800 && b <= 0xDFFF) i++
        var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
        for (var j = 0; j < h.length; j++)
          byteArray.push(parseInt(h[j], 16))
      }
    }
    return byteArray
  }

  function asciiToBytes (str) {
    var byteArray = []
    for (var i = 0; i < str.length; i++) {
      // Node's code seems to be doing this and not & 0x7F..
      byteArray.push(str.charCodeAt(i) & 0xFF)
    }
    return byteArray
  }

  function utf16leToBytes (str) {
    var c, hi, lo
    var byteArray = []
    for (var i = 0; i < str.length; i++) {
      c = str.charCodeAt(i)
      hi = c >> 8
      lo = c % 256
      byteArray.push(lo)
      byteArray.push(hi)
    }

    return byteArray
  }

  function base64ToBytes (str) {
    return base64.toByteArray(str)
  }

  function blitBuffer (src, dst, offset, length) {
    var pos
    for (var i = 0; i < length; i++) {
      if ((i + offset >= dst.length) || (i >= src.length))
        break
      dst[i + offset] = src[i]
    }
    return i
  }

  function decodeUtf8Char (str) {
    try {
      return decodeURIComponent(str)
    } catch (err) {
      return String.fromCharCode(0xFFFD) // UTF 8 invalid char
    }
  }

  /*
 * We have to make sure that the value is a valid integer. This means that it
 * is non-negative. It has no fractional component and that it does not
 * exceed the maximum allowed value.
 */
  function verifuint (value, max) {
    assert(typeof value === 'number', 'cannot write a non-number as a number')
    assert(value >= 0, 'specified a negative value for writing an unsigned value')
    assert(value <= max, 'value is larger than maximum value for type')
    assert(Math.floor(value) === value, 'value has a fractional component')
  }

  function verifsint (value, max, min) {
    assert(typeof value === 'number', 'cannot write a non-number as a number')
    assert(value <= max, 'value larger than maximum allowed value')
    assert(value >= min, 'value smaller than minimum allowed value')
    assert(Math.floor(value) === value, 'value has a fractional component')
  }

  function verifIEEE754 (value, max, min) {
    assert(typeof value === 'number', 'cannot write a non-number as a number')
    assert(value <= max, 'value larger than maximum allowed value')
    assert(value >= min, 'value smaller than minimum allowed value')
  }

  function assert (test, message) {
    if (!test) throw new Error(message || 'Failed assertion')
  }

},{"base64-js":37,"ieee754":55}],39:[function(require,module,exports){
  var Buffer = require('buffer').Buffer;
  var intSize = 4;
  var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
  var chrsz = 8;

  function toArray(buf, bigEndian) {
    if ((buf.length % intSize) !== 0) {
      var len = buf.length + (intSize - (buf.length % intSize));
      buf = Buffer.concat([buf, zeroBuffer], len);
    }

    var arr = [];
    var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
    for (var i = 0; i < buf.length; i += intSize) {
      arr.push(fn.call(buf, i));
    }
    return arr;
  }

  function toBuffer(arr, size, bigEndian) {
    var buf = new Buffer(size);
    var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
    for (var i = 0; i < arr.length; i++) {
      fn.call(buf, arr[i], i * 4, true);
    }
    return buf;
  }

  function hash(buf, fn, hashSize, bigEndian) {
    if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
    var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
    return toBuffer(arr, hashSize, bigEndian);
  }

  module.exports = { hash: hash };

},{"buffer":38}],40:[function(require,module,exports){
  var Buffer = require('buffer').Buffer
  var sha = require('./sha')
  var sha256 = require('./sha256')
  var rng = require('./rng')
  var md5 = require('./md5')

  var algorithms = {
    sha1: sha,
    sha256: sha256,
    md5: md5
  }

  var blocksize = 64
  var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)
  function hmac(fn, key, data) {
    if(!Buffer.isBuffer(key)) key = new Buffer(key)
    if(!Buffer.isBuffer(data)) data = new Buffer(data)

    if(key.length > blocksize) {
      key = fn(key)
    } else if(key.length < blocksize) {
      key = Buffer.concat([key, zeroBuffer], blocksize)
    }

    var ipad = new Buffer(blocksize), opad = new Buffer(blocksize)
    for(var i = 0; i < blocksize; i++) {
      ipad[i] = key[i] ^ 0x36
      opad[i] = key[i] ^ 0x5C
    }

    var hash = fn(Buffer.concat([ipad, data]))
    return fn(Buffer.concat([opad, hash]))
  }

  function hash(alg, key) {
    alg = alg || 'sha1'
    var fn = algorithms[alg]
    var bufs = []
    var length = 0
    if(!fn) error('algorithm:', alg, 'is not yet supported')
    return {
      update: function (data) {
        if(!Buffer.isBuffer(data)) data = new Buffer(data)

        bufs.push(data)
        length += data.length
        return this
      },
      digest: function (enc) {
        var buf = Buffer.concat(bufs)
        var r = key ? hmac(fn, key, buf) : fn(buf)
        bufs = null
        return enc ? r.toString(enc) : r
      }
    }
  }

  function error () {
    var m = [].slice.call(arguments).join(' ')
    throw new Error([
      m,
      'we accept pull requests',
      'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
  }

  exports.createHash = function (alg) { return hash(alg) }
  exports.createHmac = function (alg, key) { return hash(alg, key) }
  exports.randomBytes = function(size, callback) {
    if (callback && callback.call) {
      try {
        callback.call(this, undefined, new Buffer(rng(size)))
      } catch (err) { callback(err) }
    } else {
      return new Buffer(rng(size))
    }
  }

  function each(a, f) {
    for(var i in a)
      f(a[i], i)
  }

// the least I can do is make error messages for the rest of the node.js/crypto api.
  each(['createCredentials'
    , 'createCipher'
    , 'createCipheriv'
    , 'createDecipher'
    , 'createDecipheriv'
    , 'createSign'
    , 'createVerify'
    , 'createDiffieHellman'
    , 'pbkdf2'], function (name) {
    exports[name] = function () {
      error('sorry,', name, 'is not implemented yet')
    }
  })

},{"./md5":41,"./rng":42,"./sha":43,"./sha256":44,"buffer":38}],41:[function(require,module,exports){
  /*
 * A JavaScript implementation of the RSA Data Security, Inc. MD5 Message
 * Digest Algorithm, as defined in RFC 1321.
 * Version 2.1 Copyright (C) Paul Johnston 1999 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for more info.
 */

  var helpers = require('./helpers');

  /*
 * Perform a simple self-test to see if the VM is working
 */
  function md5_vm_test()
  {
    return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
  }

  /*
 * Calculate the MD5 of an array of little-endian words, and a bit length
 */
  function core_md5(x, len)
  {
    /* append padding */
    x[len >> 5] |= 0x80 << ((len) % 32);
    x[(((len + 64) >>> 9) << 4) + 14] = len;

    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;

    for(var i = 0; i < x.length; i += 16)
    {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;

      a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
      d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
      c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
      b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
      a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
      d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
      c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
      b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
      a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
      d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
      c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
      b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
      a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
      d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
      c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
      b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

      a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
      d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
      c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
      b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
      a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
      d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
      c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
      b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
      a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
      d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
      c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
      b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
      a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
      d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
      c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
      b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

      a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
      d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
      c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
      b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
      a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
      d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
      c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
      b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
      a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
      d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
      c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
      b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
      a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
      d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
      c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
      b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

      a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
      d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
      c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
      b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
      a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
      d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
      c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
      b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
      a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
      d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
      c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
      b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
      a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
      d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
      c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
      b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
    }
    return Array(a, b, c, d);

  }

  /*
 * These functions implement the four basic operations the algorithm uses.
 */
  function md5_cmn(q, a, b, x, s, t)
  {
    return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
  }
  function md5_ff(a, b, c, d, x, s, t)
  {
    return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }
  function md5_gg(a, b, c, d, x, s, t)
  {
    return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }
  function md5_hh(a, b, c, d, x, s, t)
  {
    return md5_cmn(b ^ c ^ d, a, b, x, s, t);
  }
  function md5_ii(a, b, c, d, x, s, t)
  {
    return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  /*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
  function safe_add(x, y)
  {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
 * Bitwise rotate a 32-bit number to the left.
 */
  function bit_rol(num, cnt)
  {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  module.exports = function md5(buf) {
    return helpers.hash(buf, core_md5, 16);
  };

},{"./helpers":39}],42:[function(require,module,exports){
// Original code adapted from Robert Kieffer.
// details at https://github.com/broofa/node-uuid
  (function() {
    var _global = this;

    var mathRNG, whatwgRNG;

    // NOTE: Math.random() does not guarantee "cryptographic quality"
    mathRNG = function(size) {
      var bytes = new Array(size);
      var r;

      for (var i = 0, r; i < size; i++) {
        if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
        bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
      }

      return bytes;
    }

    if (_global.crypto && crypto.getRandomValues) {
      whatwgRNG = function(size) {
        var bytes = new Uint8Array(size);
        crypto.getRandomValues(bytes);
        return bytes;
      }
    }

    module.exports = whatwgRNG || mathRNG;

  }())

},{}],43:[function(require,module,exports){
  /*
 * A JavaScript implementation of the Secure Hash Algorithm, SHA-1, as defined
 * in FIPS PUB 180-1
 * Version 2.1a Copyright Paul Johnston 2000 - 2002.
 * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
 * Distributed under the BSD License
 * See http://pajhome.org.uk/crypt/md5 for details.
 */

  var helpers = require('./helpers');

  /*
 * Calculate the SHA-1 of an array of big-endian words, and a bit length
 */
  function core_sha1(x, len)
  {
    /* append padding */
    x[len >> 5] |= 0x80 << (24 - len % 32);
    x[((len + 64 >> 9) << 4) + 15] = len;

    var w = Array(80);
    var a =  1732584193;
    var b = -271733879;
    var c = -1732584194;
    var d =  271733878;
    var e = -1009589776;

    for(var i = 0; i < x.length; i += 16)
    {
      var olda = a;
      var oldb = b;
      var oldc = c;
      var oldd = d;
      var olde = e;

      for(var j = 0; j < 80; j++)
      {
        if(j < 16) w[j] = x[i + j];
        else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
        var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
          safe_add(safe_add(e, w[j]), sha1_kt(j)));
        e = d;
        d = c;
        c = rol(b, 30);
        b = a;
        a = t;
      }

      a = safe_add(a, olda);
      b = safe_add(b, oldb);
      c = safe_add(c, oldc);
      d = safe_add(d, oldd);
      e = safe_add(e, olde);
    }
    return Array(a, b, c, d, e);

  }

  /*
 * Perform the appropriate triplet combination function for the current
 * iteration
 */
  function sha1_ft(t, b, c, d)
  {
    if(t < 20) return (b & c) | ((~b) & d);
    if(t < 40) return b ^ c ^ d;
    if(t < 60) return (b & c) | (b & d) | (c & d);
    return b ^ c ^ d;
  }

  /*
 * Determine the appropriate additive constant for the current iteration
 */
  function sha1_kt(t)
  {
    return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
      (t < 60) ? -1894007588 : -899497514;
  }

  /*
 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
 * to work around bugs in some JS interpreters.
 */
  function safe_add(x, y)
  {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  }

  /*
 * Bitwise rotate a 32-bit number to the left.
 */
  function rol(num, cnt)
  {
    return (num << cnt) | (num >>> (32 - cnt));
  }

  module.exports = function sha1(buf) {
    return helpers.hash(buf, core_sha1, 20, true);
  };

},{"./helpers":39}],44:[function(require,module,exports){

  /**
   * A JavaScript implementation of the Secure Hash Algorithm, SHA-256, as defined
   * in FIPS 180-2
   * Version 2.2-beta Copyright Angel Marin, Paul Johnston 2000 - 2009.
   * Other contributors: Greg Holt, Andrew Kepert, Ydnar, Lostinet
   *
   */

  var helpers = require('./helpers');

  var safe_add = function(x, y) {
    var lsw = (x & 0xFFFF) + (y & 0xFFFF);
    var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
    return (msw << 16) | (lsw & 0xFFFF);
  };

  var S = function(X, n) {
    return (X >>> n) | (X << (32 - n));
  };

  var R = function(X, n) {
    return (X >>> n);
  };

  var Ch = function(x, y, z) {
    return ((x & y) ^ ((~x) & z));
  };

  var Maj = function(x, y, z) {
    return ((x & y) ^ (x & z) ^ (y & z));
  };

  var Sigma0256 = function(x) {
    return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
  };

  var Sigma1256 = function(x) {
    return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
  };

  var Gamma0256 = function(x) {
    return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
  };

  var Gamma1256 = function(x) {
    return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
  };

  var core_sha256 = function(m, l) {
    var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
    var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;
    /* append padding */
    m[l >> 5] |= 0x80 << (24 - l % 32);
    m[((l + 64 >> 9) << 4) + 15] = l;
    for (var i = 0; i < m.length; i += 16) {
      a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
      for (var j = 0; j < 64; j++) {
        if (j < 16) {
          W[j] = m[j + i];
        } else {
          W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
        }
        T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
        T2 = safe_add(Sigma0256(a), Maj(a, b, c));
        h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
      }
      HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
      HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
    }
    return HASH;
  };

  module.exports = function sha256(buf) {
    return helpers.hash(buf, core_sha256, 32, true);
  };

},{"./helpers":39}],45:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

  function EventEmitter() {
    this._events = this._events || {};
    this._maxListeners = this._maxListeners || undefined;
  }
  module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
  EventEmitter.EventEmitter = EventEmitter;

  EventEmitter.prototype._events = undefined;
  EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
  EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
  EventEmitter.prototype.setMaxListeners = function(n) {
    if (!isNumber(n) || n < 0 || isNaN(n))
      throw TypeError('n must be a positive number');
    this._maxListeners = n;
    return this;
  };

  EventEmitter.prototype.emit = function(type) {
    var er, handler, len, args, i, listeners;

    if (!this._events)
      this._events = {};

    // If there is no 'error' event listener then throw.
    if (type === 'error') {
      if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
        er = arguments[1];
        if (er instanceof Error) {
          throw er; // Unhandled 'error' event
        }
        throw TypeError('Uncaught, unspecified "error" event.');
      }
    }

    handler = this._events[type];

    if (isUndefined(handler))
      return false;

    if (isFunction(handler)) {
      switch (arguments.length) {
        // fast cases
        case 1:
          handler.call(this);
          break;
        case 2:
          handler.call(this, arguments[1]);
          break;
        case 3:
          handler.call(this, arguments[1], arguments[2]);
          break;
        // slower
        default:
          len = arguments.length;
          args = new Array(len - 1);
          for (i = 1; i < len; i++)
            args[i - 1] = arguments[i];
          handler.apply(this, args);
      }
    } else if (isObject(handler)) {
      len = arguments.length;
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];

      listeners = handler.slice();
      len = listeners.length;
      for (i = 0; i < len; i++)
        listeners[i].apply(this, args);
    }

    return true;
  };

  EventEmitter.prototype.addListener = function(type, listener) {
    var m;

    if (!isFunction(listener))
      throw TypeError('listener must be a function');

    if (!this._events)
      this._events = {};

    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (this._events.newListener)
      this.emit('newListener', type,
        isFunction(listener.listener) ?
          listener.listener : listener);

    if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
      this._events[type] = listener;
    else if (isObject(this._events[type]))
    // If we've already got an array, just append.
      this._events[type].push(listener);
    else
    // Adding the second element, need to change to array.
      this._events[type] = [this._events[type], listener];

    // Check for listener leak
    if (isObject(this._events[type]) && !this._events[type].warned) {
      var m;
      if (!isUndefined(this._maxListeners)) {
        m = this._maxListeners;
      } else {
        m = EventEmitter.defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
          'leak detected. %d listeners added. ' +
          'Use emitter.setMaxListeners() to increase limit.',
          this._events[type].length);
        if (typeof console.trace === 'function') {
          // not supported in IE 10
          console.trace();
        }
      }
    }

    return this;
  };

  EventEmitter.prototype.on = EventEmitter.prototype.addListener;

  EventEmitter.prototype.once = function(type, listener) {
    if (!isFunction(listener))
      throw TypeError('listener must be a function');

    var fired = false;

    function g() {
      this.removeListener(type, g);

      if (!fired) {
        fired = true;
        listener.apply(this, arguments);
      }
    }

    g.listener = listener;
    this.on(type, g);

    return this;
  };

// emits a 'removeListener' event iff the listener was removed
  EventEmitter.prototype.removeListener = function(type, listener) {
    var list, position, length, i;

    if (!isFunction(listener))
      throw TypeError('listener must be a function');

    if (!this._events || !this._events[type])
      return this;

    list = this._events[type];
    length = list.length;
    position = -1;

    if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
      delete this._events[type];
      if (this._events.removeListener)
        this.emit('removeListener', type, listener);

    } else if (isObject(list)) {
      for (i = length; i-- > 0;) {
        if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
          position = i;
          break;
        }
      }

      if (position < 0)
        return this;

      if (list.length === 1) {
        list.length = 0;
        delete this._events[type];
      } else {
        list.splice(position, 1);
      }

      if (this._events.removeListener)
        this.emit('removeListener', type, listener);
    }

    return this;
  };

  EventEmitter.prototype.removeAllListeners = function(type) {
    var key, listeners;

    if (!this._events)
      return this;

    // not listening for removeListener, no need to emit
    if (!this._events.removeListener) {
      if (arguments.length === 0)
        this._events = {};
      else if (this._events[type])
        delete this._events[type];
      return this;
    }

    // emit removeListener for all listeners on all events
    if (arguments.length === 0) {
      for (key in this._events) {
        if (key === 'removeListener') continue;
        this.removeAllListeners(key);
      }
      this.removeAllListeners('removeListener');
      this._events = {};
      return this;
    }

    listeners = this._events[type];

    if (isFunction(listeners)) {
      this.removeListener(type, listeners);
    } else {
      // LIFO order
      while (listeners.length)
        this.removeListener(type, listeners[listeners.length - 1]);
    }
    delete this._events[type];

    return this;
  };

  EventEmitter.prototype.listeners = function(type) {
    var ret;
    if (!this._events || !this._events[type])
      ret = [];
    else if (isFunction(this._events[type]))
      ret = [this._events[type]];
    else
      ret = this._events[type].slice();
    return ret;
  };

  EventEmitter.listenerCount = function(emitter, type) {
    var ret;
    if (!emitter._events || !emitter._events[type])
      ret = 0;
    else if (isFunction(emitter._events[type]))
      ret = 1;
    else
      ret = emitter._events[type].length;
    return ret;
  };

  function isFunction(arg) {
    return typeof arg === 'function';
  }

  function isNumber(arg) {
    return typeof arg === 'number';
  }

  function isObject(arg) {
    return typeof arg === 'object' && arg !== null;
  }

  function isUndefined(arg) {
    return arg === void 0;
  }

},{}],46:[function(require,module,exports){
// shim for using process in browser

  var process = module.exports = {};

  process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
      && window.setImmediate;
    var canPost = typeof window !== 'undefined'
      && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
      return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
      var queue = [];
      window.addEventListener('message', function (ev) {
        var source = ev.source;
        if ((source === window || source === null) && ev.data === 'process-tick') {
          ev.stopPropagation();
          if (queue.length > 0) {
            var fn = queue.shift();
            fn();
          }
        }
      }, true);

      return function nextTick(fn) {
        queue.push(fn);
        window.postMessage('process-tick', '*');
      };
    }

    return function nextTick(fn) {
      setTimeout(fn, 0);
    };
  })();

  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];

  function noop() {}

  process.on = noop;
  process.addListener = noop;
  process.once = noop;
  process.off = noop;
  process.removeListener = noop;
  process.removeAllListeners = noop;
  process.emit = noop;

  process.binding = function (name) {
    throw new Error('process.binding is not supported');
  }

// TODO(shtylman)
  process.cwd = function () { return '/' };
  process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
  };

},{}],47:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

  module.exports = Duplex;
  var inherits = require('inherits');
  var setImmediate = require('process/browser.js').nextTick;
  var Readable = require('./readable.js');
  var Writable = require('./writable.js');

  inherits(Duplex, Readable);

  Duplex.prototype.write = Writable.prototype.write;
  Duplex.prototype.end = Writable.prototype.end;
  Duplex.prototype._write = Writable.prototype._write;

  function Duplex(options) {
    if (!(this instanceof Duplex))
      return new Duplex(options);

    Readable.call(this, options);
    Writable.call(this, options);

    if (options && options.readable === false)
      this.readable = false;

    if (options && options.writable === false)
      this.writable = false;

    this.allowHalfOpen = true;
    if (options && options.allowHalfOpen === false)
      this.allowHalfOpen = false;

    this.once('end', onend);
  }

// the no-half-open enforcer
  function onend() {
    // if we allow half-open state, or if the writable side ended,
    // then we're ok.
    if (this.allowHalfOpen || this._writableState.ended)
      return;

    // no more data can be written.
    // But allow more writes to happen in this tick.
    var self = this;
    setImmediate(function () {
      self.end();
    });
  }

},{"./readable.js":51,"./writable.js":53,"inherits":56,"process/browser.js":49}],48:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

  module.exports = Stream;

  var EE = require('events').EventEmitter;
  var inherits = require('inherits');

  inherits(Stream, EE);
  Stream.Readable = require('./readable.js');
  Stream.Writable = require('./writable.js');
  Stream.Duplex = require('./duplex.js');
  Stream.Transform = require('./transform.js');
  Stream.PassThrough = require('./passthrough.js');

// Backwards-compat with node 0.4.x
  Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

  function Stream() {
    EE.call(this);
  }

  Stream.prototype.pipe = function(dest, options) {
    var source = this;

    function ondata(chunk) {
      if (dest.writable) {
        if (false === dest.write(chunk) && source.pause) {
          source.pause();
        }
      }
    }

    source.on('data', ondata);

    function ondrain() {
      if (source.readable && source.resume) {
        source.resume();
      }
    }

    dest.on('drain', ondrain);

    // If the 'end' option is not supplied, dest.end() will be called when
    // source gets the 'end' or 'close' events.  Only dest.end() once.
    if (!dest._isStdio && (!options || options.end !== false)) {
      source.on('end', onend);
      source.on('close', onclose);
    }

    var didOnEnd = false;
    function onend() {
      if (didOnEnd) return;
      didOnEnd = true;

      dest.end();
    }


    function onclose() {
      if (didOnEnd) return;
      didOnEnd = true;

      if (typeof dest.destroy === 'function') dest.destroy();
    }

    // don't leave dangling pipes when there are errors.
    function onerror(er) {
      cleanup();
      if (EE.listenerCount(this, 'error') === 0) {
        throw er; // Unhandled stream error in pipe.
      }
    }

    source.on('error', onerror);
    dest.on('error', onerror);

    // remove all the event listeners that were added.
    function cleanup() {
      source.removeListener('data', ondata);
      dest.removeListener('drain', ondrain);

      source.removeListener('end', onend);
      source.removeListener('close', onclose);

      source.removeListener('error', onerror);
      dest.removeListener('error', onerror);

      source.removeListener('end', cleanup);
      source.removeListener('close', cleanup);

      dest.removeListener('close', cleanup);
    }

    source.on('end', cleanup);
    source.on('close', cleanup);

    dest.on('close', cleanup);

    dest.emit('pipe', source);

    // Allow for unix-like usage: A.pipe(B).pipe(C)
    return dest;
  };

},{"./duplex.js":47,"./passthrough.js":50,"./readable.js":51,"./transform.js":52,"./writable.js":53,"events":45,"inherits":56}],49:[function(require,module,exports){
// shim for using process in browser

  var process = module.exports = {};

  process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
      && window.setImmediate;
    var canPost = typeof window !== 'undefined'
      && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
      return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
      var queue = [];
      window.addEventListener('message', function (ev) {
        var source = ev.source;
        if ((source === window || source === null) && ev.data === 'process-tick') {
          ev.stopPropagation();
          if (queue.length > 0) {
            var fn = queue.shift();
            fn();
          }
        }
      }, true);

      return function nextTick(fn) {
        queue.push(fn);
        window.postMessage('process-tick', '*');
      };
    }

    return function nextTick(fn) {
      setTimeout(fn, 0);
    };
  })();

  process.title = 'browser';
  process.browser = true;
  process.env = {};
  process.argv = [];

  process.binding = function (name) {
    throw new Error('process.binding is not supported');
  }

// TODO(shtylman)
  process.cwd = function () { return '/' };
  process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
  };

},{}],50:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

  module.exports = PassThrough;

  var Transform = require('./transform.js');
  var inherits = require('inherits');
  inherits(PassThrough, Transform);

  function PassThrough(options) {
    if (!(this instanceof PassThrough))
      return new PassThrough(options);

    Transform.call(this, options);
  }

  PassThrough.prototype._transform = function(chunk, encoding, cb) {
    cb(null, chunk);
  };

},{"./transform.js":52,"inherits":56}],51:[function(require,module,exports){
  (function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

    module.exports = Readable;
    Readable.ReadableState = ReadableState;

    var EE = require('events').EventEmitter;
    var Stream = require('./index.js');
    var Buffer = require('buffer').Buffer;
    var setImmediate = require('process/browser.js').nextTick;
    var StringDecoder;

    var inherits = require('inherits');
    inherits(Readable, Stream);

    function ReadableState(options, stream) {
      options = options || {};

      // the point at which it stops calling _read() to fill the buffer
      // Note: 0 is a valid value, means "don't call _read preemptively ever"
      var hwm = options.highWaterMark;
      this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

      // cast to ints.
      this.highWaterMark = ~~this.highWaterMark;

      this.buffer = [];
      this.length = 0;
      this.pipes = null;
      this.pipesCount = 0;
      this.flowing = false;
      this.ended = false;
      this.endEmitted = false;
      this.reading = false;

      // In streams that never have any data, and do push(null) right away,
      // the consumer can miss the 'end' event if they do some I/O before
      // consuming the stream.  So, we don't emit('end') until some reading
      // happens.
      this.calledRead = false;

      // a flag to be able to tell if the onwrite cb is called immediately,
      // or on a later tick.  We set this to true at first, becuase any
      // actions that shouldn't happen until "later" should generally also
      // not happen before the first write call.
      this.sync = true;

      // whenever we return null, then we set a flag to say
      // that we're awaiting a 'readable' event emission.
      this.needReadable = false;
      this.emittedReadable = false;
      this.readableListening = false;


      // object stream flag. Used to make read(n) ignore n and to
      // make all the buffer merging and length checks go away
      this.objectMode = !!options.objectMode;

      // Crypto is kind of old and crusty.  Historically, its default string
      // encoding is 'binary' so we have to make this configurable.
      // Everything else in the universe uses 'utf8', though.
      this.defaultEncoding = options.defaultEncoding || 'utf8';

      // when piping, we only care about 'readable' events that happen
      // after read()ing all the bytes and not getting any pushback.
      this.ranOut = false;

      // the number of writers that are awaiting a drain event in .pipe()s
      this.awaitDrain = 0;

      // if true, a maybeReadMore has been scheduled
      this.readingMore = false;

      this.decoder = null;
      this.encoding = null;
      if (options.encoding) {
        if (!StringDecoder)
          StringDecoder = require('string_decoder').StringDecoder;
        this.decoder = new StringDecoder(options.encoding);
        this.encoding = options.encoding;
      }
    }

    function Readable(options) {
      if (!(this instanceof Readable))
        return new Readable(options);

      this._readableState = new ReadableState(options, this);

      // legacy
      this.readable = true;

      Stream.call(this);
    }

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
    Readable.prototype.push = function(chunk, encoding) {
      var state = this._readableState;

      if (typeof chunk === 'string' && !state.objectMode) {
        encoding = encoding || state.defaultEncoding;
        if (encoding !== state.encoding) {
          chunk = new Buffer(chunk, encoding);
          encoding = '';
        }
      }

      return readableAddChunk(this, state, chunk, encoding, false);
    };

// Unshift should *always* be something directly out of read()
    Readable.prototype.unshift = function(chunk) {
      var state = this._readableState;
      return readableAddChunk(this, state, chunk, '', true);
    };

    function readableAddChunk(stream, state, chunk, encoding, addToFront) {
      var er = chunkInvalid(state, chunk);
      if (er) {
        stream.emit('error', er);
      } else if (chunk === null || chunk === undefined) {
        state.reading = false;
        if (!state.ended)
          onEofChunk(stream, state);
      } else if (state.objectMode || chunk && chunk.length > 0) {
        if (state.ended && !addToFront) {
          var e = new Error('stream.push() after EOF');
          stream.emit('error', e);
        } else if (state.endEmitted && addToFront) {
          var e = new Error('stream.unshift() after end event');
          stream.emit('error', e);
        } else {
          if (state.decoder && !addToFront && !encoding)
            chunk = state.decoder.write(chunk);

          // update the buffer info.
          state.length += state.objectMode ? 1 : chunk.length;
          if (addToFront) {
            state.buffer.unshift(chunk);
          } else {
            state.reading = false;
            state.buffer.push(chunk);
          }

          if (state.needReadable)
            emitReadable(stream);

          maybeReadMore(stream, state);
        }
      } else if (!addToFront) {
        state.reading = false;
      }

      return needMoreData(state);
    }



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
    function needMoreData(state) {
      return !state.ended &&
        (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
    }

// backwards compatibility.
    Readable.prototype.setEncoding = function(enc) {
      if (!StringDecoder)
        StringDecoder = require('string_decoder').StringDecoder;
      this._readableState.decoder = new StringDecoder(enc);
      this._readableState.encoding = enc;
    };

// Don't raise the hwm > 128MB
    var MAX_HWM = 0x800000;
    function roundUpToNextPowerOf2(n) {
      if (n >= MAX_HWM) {
        n = MAX_HWM;
      } else {
        // Get the next highest power of 2
        n--;
        for (var p = 1; p < 32; p <<= 1) n |= n >> p;
        n++;
      }
      return n;
    }

    function howMuchToRead(n, state) {
      if (state.length === 0 && state.ended)
        return 0;

      if (state.objectMode)
        return n === 0 ? 0 : 1;

      if (isNaN(n) || n === null) {
        // only flow one buffer at a time
        if (state.flowing && state.buffer.length)
          return state.buffer[0].length;
        else
          return state.length;
      }

      if (n <= 0)
        return 0;

      // If we're asking for more than the target buffer level,
      // then raise the water mark.  Bump up to the next highest
      // power of 2, to prevent increasing it excessively in tiny
      // amounts.
      if (n > state.highWaterMark)
        state.highWaterMark = roundUpToNextPowerOf2(n);

      // don't have that much.  return null, unless we've ended.
      if (n > state.length) {
        if (!state.ended) {
          state.needReadable = true;
          return 0;
        } else
          return state.length;
      }

      return n;
    }

// you can override either this method, or the async _read(n) below.
    Readable.prototype.read = function(n) {
      var state = this._readableState;
      state.calledRead = true;
      var nOrig = n;

      if (typeof n !== 'number' || n > 0)
        state.emittedReadable = false;

      // if we're doing read(0) to trigger a readable event, but we
      // already have a bunch of data in the buffer, then just trigger
      // the 'readable' event and move on.
      if (n === 0 &&
        state.needReadable &&
        (state.length >= state.highWaterMark || state.ended)) {
        emitReadable(this);
        return null;
      }

      n = howMuchToRead(n, state);

      // if we've ended, and we're now clear, then finish it up.
      if (n === 0 && state.ended) {
        if (state.length === 0)
          endReadable(this);
        return null;
      }

      // All the actual chunk generation logic needs to be
      // *below* the call to _read.  The reason is that in certain
      // synthetic stream cases, such as passthrough streams, _read
      // may be a completely synchronous operation which may change
      // the state of the read buffer, providing enough data when
      // before there was *not* enough.
      //
      // So, the steps are:
      // 1. Figure out what the state of things will be after we do
      // a read from the buffer.
      //
      // 2. If that resulting state will trigger a _read, then call _read.
      // Note that this may be asynchronous, or synchronous.  Yes, it is
      // deeply ugly to write APIs this way, but that still doesn't mean
      // that the Readable class should behave improperly, as streams are
      // designed to be sync/async agnostic.
      // Take note if the _read call is sync or async (ie, if the read call
      // has returned yet), so that we know whether or not it's safe to emit
      // 'readable' etc.
      //
      // 3. Actually pull the requested chunks out of the buffer and return.

      // if we need a readable event, then we need to do some reading.
      var doRead = state.needReadable;

      // if we currently have less than the highWaterMark, then also read some
      if (state.length - n <= state.highWaterMark)
        doRead = true;

      // however, if we've ended, then there's no point, and if we're already
      // reading, then it's unnecessary.
      if (state.ended || state.reading)
        doRead = false;

      if (doRead) {
        state.reading = true;
        state.sync = true;
        // if the length is currently zero, then we *need* a readable event.
        if (state.length === 0)
          state.needReadable = true;
        // call internal read method
        this._read(state.highWaterMark);
        state.sync = false;
      }

      // If _read called its callback synchronously, then `reading`
      // will be false, and we need to re-evaluate how much data we
      // can return to the user.
      if (doRead && !state.reading)
        n = howMuchToRead(nOrig, state);

      var ret;
      if (n > 0)
        ret = fromList(n, state);
      else
        ret = null;

      if (ret === null) {
        state.needReadable = true;
        n = 0;
      }

      state.length -= n;

      // If we have nothing in the buffer, then we want to know
      // as soon as we *do* get something into the buffer.
      if (state.length === 0 && !state.ended)
        state.needReadable = true;

      // If we happened to read() exactly the remaining amount in the
      // buffer, and the EOF has been seen at this point, then make sure
      // that we emit 'end' on the very next tick.
      if (state.ended && !state.endEmitted && state.length === 0)
        endReadable(this);

      return ret;
    };

    function chunkInvalid(state, chunk) {
      var er = null;
      if (!Buffer.isBuffer(chunk) &&
        'string' !== typeof chunk &&
        chunk !== null &&
        chunk !== undefined &&
        !state.objectMode &&
        !er) {
        er = new TypeError('Invalid non-string/buffer chunk');
      }
      return er;
    }


    function onEofChunk(stream, state) {
      if (state.decoder && !state.ended) {
        var chunk = state.decoder.end();
        if (chunk && chunk.length) {
          state.buffer.push(chunk);
          state.length += state.objectMode ? 1 : chunk.length;
        }
      }
      state.ended = true;

      // if we've ended and we have some data left, then emit
      // 'readable' now to make sure it gets picked up.
      if (state.length > 0)
        emitReadable(stream);
      else
        endReadable(stream);
    }

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
    function emitReadable(stream) {
      var state = stream._readableState;
      state.needReadable = false;
      if (state.emittedReadable)
        return;

      state.emittedReadable = true;
      if (state.sync)
        setImmediate(function() {
          emitReadable_(stream);
        });
      else
        emitReadable_(stream);
    }

    function emitReadable_(stream) {
      stream.emit('readable');
    }


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
    function maybeReadMore(stream, state) {
      if (!state.readingMore) {
        state.readingMore = true;
        setImmediate(function() {
          maybeReadMore_(stream, state);
        });
      }
    }

    function maybeReadMore_(stream, state) {
      var len = state.length;
      while (!state.reading && !state.flowing && !state.ended &&
      state.length < state.highWaterMark) {
        stream.read(0);
        if (len === state.length)
        // didn't get any data, stop spinning.
          break;
        else
          len = state.length;
      }
      state.readingMore = false;
    }

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
    Readable.prototype._read = function(n) {
      this.emit('error', new Error('not implemented'));
    };

    Readable.prototype.pipe = function(dest, pipeOpts) {
      var src = this;
      var state = this._readableState;

      switch (state.pipesCount) {
        case 0:
          state.pipes = dest;
          break;
        case 1:
          state.pipes = [state.pipes, dest];
          break;
        default:
          state.pipes.push(dest);
          break;
      }
      state.pipesCount += 1;

      var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
        dest !== process.stdout &&
        dest !== process.stderr;

      var endFn = doEnd ? onend : cleanup;
      if (state.endEmitted)
        setImmediate(endFn);
      else
        src.once('end', endFn);

      dest.on('unpipe', onunpipe);
      function onunpipe(readable) {
        if (readable !== src) return;
        cleanup();
      }

      function onend() {
        dest.end();
      }

      // when the dest drains, it reduces the awaitDrain counter
      // on the source.  This would be more elegant with a .once()
      // handler in flow(), but adding and removing repeatedly is
      // too slow.
      var ondrain = pipeOnDrain(src);
      dest.on('drain', ondrain);

      function cleanup() {
        // cleanup event handlers once the pipe is broken
        dest.removeListener('close', onclose);
        dest.removeListener('finish', onfinish);
        dest.removeListener('drain', ondrain);
        dest.removeListener('error', onerror);
        dest.removeListener('unpipe', onunpipe);
        src.removeListener('end', onend);
        src.removeListener('end', cleanup);

        // if the reader is waiting for a drain event from this
        // specific writer, then it would cause it to never start
        // flowing again.
        // So, if this is awaiting a drain, then we just call it now.
        // If we don't know, then assume that we are waiting for one.
        if (!dest._writableState || dest._writableState.needDrain)
          ondrain();
      }

      // if the dest has an error, then stop piping into it.
      // however, don't suppress the throwing behavior for this.
      // check for listeners before emit removes one-time listeners.
      var errListeners = EE.listenerCount(dest, 'error');
      function onerror(er) {
        unpipe();
        if (errListeners === 0 && EE.listenerCount(dest, 'error') === 0)
          dest.emit('error', er);
      }
      dest.once('error', onerror);

      // Both close and finish should trigger unpipe, but only once.
      function onclose() {
        dest.removeListener('finish', onfinish);
        unpipe();
      }
      dest.once('close', onclose);
      function onfinish() {
        dest.removeListener('close', onclose);
        unpipe();
      }
      dest.once('finish', onfinish);

      function unpipe() {
        src.unpipe(dest);
      }

      // tell the dest that it's being piped to
      dest.emit('pipe', src);

      // start the flow if it hasn't been started already.
      if (!state.flowing) {
        // the handler that waits for readable events after all
        // the data gets sucked out in flow.
        // This would be easier to follow with a .once() handler
        // in flow(), but that is too slow.
        this.on('readable', pipeOnReadable);

        state.flowing = true;
        setImmediate(function() {
          flow(src);
        });
      }

      return dest;
    };

    function pipeOnDrain(src) {
      return function() {
        var dest = this;
        var state = src._readableState;
        state.awaitDrain--;
        if (state.awaitDrain === 0)
          flow(src);
      };
    }

    function flow(src) {
      var state = src._readableState;
      var chunk;
      state.awaitDrain = 0;

      function write(dest, i, list) {
        var written = dest.write(chunk);
        if (false === written) {
          state.awaitDrain++;
        }
      }

      while (state.pipesCount && null !== (chunk = src.read())) {

        if (state.pipesCount === 1)
          write(state.pipes, 0, null);
        else
          forEach(state.pipes, write);

        src.emit('data', chunk);

        // if anyone needs a drain, then we have to wait for that.
        if (state.awaitDrain > 0)
          return;
      }

      // if every destination was unpiped, either before entering this
      // function, or in the while loop, then stop flowing.
      //
      // NB: This is a pretty rare edge case.
      if (state.pipesCount === 0) {
        state.flowing = false;

        // if there were data event listeners added, then switch to old mode.
        if (EE.listenerCount(src, 'data') > 0)
          emitDataEvents(src);
        return;
      }

      // at this point, no one needed a drain, so we just ran out of data
      // on the next readable event, start it over again.
      state.ranOut = true;
    }

    function pipeOnReadable() {
      if (this._readableState.ranOut) {
        this._readableState.ranOut = false;
        flow(this);
      }
    }


    Readable.prototype.unpipe = function(dest) {
      var state = this._readableState;

      // if we're not piping anywhere, then do nothing.
      if (state.pipesCount === 0)
        return this;

      // just one destination.  most common case.
      if (state.pipesCount === 1) {
        // passed in one, but it's not the right one.
        if (dest && dest !== state.pipes)
          return this;

        if (!dest)
          dest = state.pipes;

        // got a match.
        state.pipes = null;
        state.pipesCount = 0;
        this.removeListener('readable', pipeOnReadable);
        state.flowing = false;
        if (dest)
          dest.emit('unpipe', this);
        return this;
      }

      // slow case. multiple pipe destinations.

      if (!dest) {
        // remove all.
        var dests = state.pipes;
        var len = state.pipesCount;
        state.pipes = null;
        state.pipesCount = 0;
        this.removeListener('readable', pipeOnReadable);
        state.flowing = false;

        for (var i = 0; i < len; i++)
          dests[i].emit('unpipe', this);
        return this;
      }

      // try to find the right one.
      var i = indexOf(state.pipes, dest);
      if (i === -1)
        return this;

      state.pipes.splice(i, 1);
      state.pipesCount -= 1;
      if (state.pipesCount === 1)
        state.pipes = state.pipes[0];

      dest.emit('unpipe', this);

      return this;
    };

// set up data events if they are asked for
// Ensure readable listeners eventually get something
    Readable.prototype.on = function(ev, fn) {
      var res = Stream.prototype.on.call(this, ev, fn);

      if (ev === 'data' && !this._readableState.flowing)
        emitDataEvents(this);

      if (ev === 'readable' && this.readable) {
        var state = this._readableState;
        if (!state.readableListening) {
          state.readableListening = true;
          state.emittedReadable = false;
          state.needReadable = true;
          if (!state.reading) {
            this.read(0);
          } else if (state.length) {
            emitReadable(this, state);
          }
        }
      }

      return res;
    };
    Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
    Readable.prototype.resume = function() {
      emitDataEvents(this);
      this.read(0);
      this.emit('resume');
    };

    Readable.prototype.pause = function() {
      emitDataEvents(this, true);
      this.emit('pause');
    };

    function emitDataEvents(stream, startPaused) {
      var state = stream._readableState;

      if (state.flowing) {
        // https://github.com/isaacs/readable-stream/issues/16
        throw new Error('Cannot switch to old mode now.');
      }

      var paused = startPaused || false;
      var readable = false;

      // convert to an old-style stream.
      stream.readable = true;
      stream.pipe = Stream.prototype.pipe;
      stream.on = stream.addListener = Stream.prototype.on;

      stream.on('readable', function() {
        readable = true;

        var c;
        while (!paused && (null !== (c = stream.read())))
          stream.emit('data', c);

        if (c === null) {
          readable = false;
          stream._readableState.needReadable = true;
        }
      });

      stream.pause = function() {
        paused = true;
        this.emit('pause');
      };

      stream.resume = function() {
        paused = false;
        if (readable)
          setImmediate(function() {
            stream.emit('readable');
          });
        else
          this.read(0);
        this.emit('resume');
      };

      // now make it start, just in case it hadn't already.
      stream.emit('readable');
    }

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
    Readable.prototype.wrap = function(stream) {
      var state = this._readableState;
      var paused = false;

      var self = this;
      stream.on('end', function() {
        if (state.decoder && !state.ended) {
          var chunk = state.decoder.end();
          if (chunk && chunk.length)
            self.push(chunk);
        }

        self.push(null);
      });

      stream.on('data', function(chunk) {
        if (state.decoder)
          chunk = state.decoder.write(chunk);
        if (!chunk || !state.objectMode && !chunk.length)
          return;

        var ret = self.push(chunk);
        if (!ret) {
          paused = true;
          stream.pause();
        }
      });

      // proxy all the other methods.
      // important when wrapping filters and duplexes.
      for (var i in stream) {
        if (typeof stream[i] === 'function' &&
          typeof this[i] === 'undefined') {
          this[i] = function(method) { return function() {
            return stream[method].apply(stream, arguments);
          }}(i);
        }
      }

      // proxy certain important events.
      var events = ['error', 'close', 'destroy', 'pause', 'resume'];
      forEach(events, function(ev) {
        stream.on(ev, function (x) {
          return self.emit.apply(self, ev, x);
        });
      });

      // when we try to consume some more bytes, simply unpause the
      // underlying stream.
      self._read = function(n) {
        if (paused) {
          paused = false;
          stream.resume();
        }
      };

      return self;
    };



// exposed for testing purposes only.
    Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
    function fromList(n, state) {
      var list = state.buffer;
      var length = state.length;
      var stringMode = !!state.decoder;
      var objectMode = !!state.objectMode;
      var ret;

      // nothing in the list, definitely empty.
      if (list.length === 0)
        return null;

      if (length === 0)
        ret = null;
      else if (objectMode)
        ret = list.shift();
      else if (!n || n >= length) {
        // read it all, truncate the array.
        if (stringMode)
          ret = list.join('');
        else
          ret = Buffer.concat(list, length);
        list.length = 0;
      } else {
        // read just some of it.
        if (n < list[0].length) {
          // just take a part of the first list item.
          // slice is the same for buffers and strings.
          var buf = list[0];
          ret = buf.slice(0, n);
          list[0] = buf.slice(n);
        } else if (n === list[0].length) {
          // first list is a perfect match
          ret = list.shift();
        } else {
          // complex case.
          // we have enough to cover it, but it spans past the first buffer.
          if (stringMode)
            ret = '';
          else
            ret = new Buffer(n);

          var c = 0;
          for (var i = 0, l = list.length; i < l && c < n; i++) {
            var buf = list[0];
            var cpy = Math.min(n - c, buf.length);

            if (stringMode)
              ret += buf.slice(0, cpy);
            else
              buf.copy(ret, c, 0, cpy);

            if (cpy < buf.length)
              list[0] = buf.slice(cpy);
            else
              list.shift();

            c += cpy;
          }
        }
      }

      return ret;
    }

    function endReadable(stream) {
      var state = stream._readableState;

      // If we get here before consuming all the bytes, then that is a
      // bug in node.  Should never happen.
      if (state.length > 0)
        throw new Error('endReadable called on non-empty stream');

      if (!state.endEmitted && state.calledRead) {
        state.ended = true;
        setImmediate(function() {
          // Check that we didn't get one last unshift.
          if (!state.endEmitted && state.length === 0) {
            state.endEmitted = true;
            stream.readable = false;
            stream.emit('end');
          }
        });
      }
    }

    function forEach (xs, f) {
      for (var i = 0, l = xs.length; i < l; i++) {
        f(xs[i], i);
      }
    }

    function indexOf (xs, x) {
      for (var i = 0, l = xs.length; i < l; i++) {
        if (xs[i] === x) return i;
      }
      return -1;
    }

  }).call(this,require("7YKIPe"))
},{"./index.js":48,"7YKIPe":46,"buffer":38,"events":45,"inherits":56,"process/browser.js":49,"string_decoder":54}],52:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

  module.exports = Transform;

  var Duplex = require('./duplex.js');
  var inherits = require('inherits');
  inherits(Transform, Duplex);


  function TransformState(options, stream) {
    this.afterTransform = function(er, data) {
      return afterTransform(stream, er, data);
    };

    this.needTransform = false;
    this.transforming = false;
    this.writecb = null;
    this.writechunk = null;
  }

  function afterTransform(stream, er, data) {
    var ts = stream._transformState;
    ts.transforming = false;

    var cb = ts.writecb;

    if (!cb)
      return stream.emit('error', new Error('no writecb in Transform class'));

    ts.writechunk = null;
    ts.writecb = null;

    if (data !== null && data !== undefined)
      stream.push(data);

    if (cb)
      cb(er);

    var rs = stream._readableState;
    rs.reading = false;
    if (rs.needReadable || rs.length < rs.highWaterMark) {
      stream._read(rs.highWaterMark);
    }
  }


  function Transform(options) {
    if (!(this instanceof Transform))
      return new Transform(options);

    Duplex.call(this, options);

    var ts = this._transformState = new TransformState(options, this);

    // when the writable side finishes, then flush out anything remaining.
    var stream = this;

    // start out asking for a readable event once data is transformed.
    this._readableState.needReadable = true;

    // we have implemented the _read method, and done the other things
    // that Readable wants before the first _read call, so unset the
    // sync guard flag.
    this._readableState.sync = false;

    this.once('finish', function() {
      if ('function' === typeof this._flush)
        this._flush(function(er) {
          done(stream, er);
        });
      else
        done(stream);
    });
  }

  Transform.prototype.push = function(chunk, encoding) {
    this._transformState.needTransform = false;
    return Duplex.prototype.push.call(this, chunk, encoding);
  };

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
  Transform.prototype._transform = function(chunk, encoding, cb) {
    throw new Error('not implemented');
  };

  Transform.prototype._write = function(chunk, encoding, cb) {
    var ts = this._transformState;
    ts.writecb = cb;
    ts.writechunk = chunk;
    ts.writeencoding = encoding;
    if (!ts.transforming) {
      var rs = this._readableState;
      if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
        this._read(rs.highWaterMark);
    }
  };

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
  Transform.prototype._read = function(n) {
    var ts = this._transformState;

    if (ts.writechunk && ts.writecb && !ts.transforming) {
      ts.transforming = true;
      this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
    } else {
      // mark that we need a transform, so that any data that comes in
      // will get processed, now that we've asked for it.
      ts.needTransform = true;
    }
  };


  function done(stream, er) {
    if (er)
      return stream.emit('error', er);

    // if there's nothing in the write buffer, then that means
    // that nothing more will ever be provided
    var ws = stream._writableState;
    var rs = stream._readableState;
    var ts = stream._transformState;

    if (ws.length)
      throw new Error('calling transform done when ws.length != 0');

    if (ts.transforming)
      throw new Error('calling transform done when still transforming');

    return stream.push(null);
  }

},{"./duplex.js":47,"inherits":56}],53:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

  module.exports = Writable;
  Writable.WritableState = WritableState;

  var isUint8Array = typeof Uint8Array !== 'undefined'
    ? function (x) { return x instanceof Uint8Array }
    : function (x) {
      return x && x.constructor && x.constructor.name === 'Uint8Array'
    }
  ;
  var isArrayBuffer = typeof ArrayBuffer !== 'undefined'
    ? function (x) { return x instanceof ArrayBuffer }
    : function (x) {
      return x && x.constructor && x.constructor.name === 'ArrayBuffer'
    }
  ;

  var inherits = require('inherits');
  var Stream = require('./index.js');
  var setImmediate = require('process/browser.js').nextTick;
  var Buffer = require('buffer').Buffer;

  inherits(Writable, Stream);

  function WriteReq(chunk, encoding, cb) {
    this.chunk = chunk;
    this.encoding = encoding;
    this.callback = cb;
  }

  function WritableState(options, stream) {
    options = options || {};

    // the point at which write() starts returning false
    // Note: 0 is a valid value, means that we always return false if
    // the entire buffer is not flushed immediately on write()
    var hwm = options.highWaterMark;
    this.highWaterMark = (hwm || hwm === 0) ? hwm : 16 * 1024;

    // object stream flag to indicate whether or not this stream
    // contains buffers or objects.
    this.objectMode = !!options.objectMode;

    // cast to ints.
    this.highWaterMark = ~~this.highWaterMark;

    this.needDrain = false;
    // at the start of calling end()
    this.ending = false;
    // when end() has been called, and returned
    this.ended = false;
    // when 'finish' is emitted
    this.finished = false;

    // should we decode strings into buffers before passing to _write?
    // this is here so that some node-core streams can optimize string
    // handling at a lower level.
    var noDecode = options.decodeStrings === false;
    this.decodeStrings = !noDecode;

    // Crypto is kind of old and crusty.  Historically, its default string
    // encoding is 'binary' so we have to make this configurable.
    // Everything else in the universe uses 'utf8', though.
    this.defaultEncoding = options.defaultEncoding || 'utf8';

    // not an actual buffer we keep track of, but a measurement
    // of how much we're waiting to get pushed to some underlying
    // socket or file.
    this.length = 0;

    // a flag to see when we're in the middle of a write.
    this.writing = false;

    // a flag to be able to tell if the onwrite cb is called immediately,
    // or on a later tick.  We set this to true at first, becuase any
    // actions that shouldn't happen until "later" should generally also
    // not happen before the first write call.
    this.sync = true;

    // a flag to know if we're processing previously buffered items, which
    // may call the _write() callback in the same tick, so that we don't
    // end up in an overlapped onwrite situation.
    this.bufferProcessing = false;

    // the callback that's passed to _write(chunk,cb)
    this.onwrite = function(er) {
      onwrite(stream, er);
    };

    // the callback that the user supplies to write(chunk,encoding,cb)
    this.writecb = null;

    // the amount that is being written when _write is called.
    this.writelen = 0;

    this.buffer = [];
  }

  function Writable(options) {
    // Writable ctor is applied to Duplexes, though they're not
    // instanceof Writable, they're instanceof Readable.
    if (!(this instanceof Writable) && !(this instanceof Stream.Duplex))
      return new Writable(options);

    this._writableState = new WritableState(options, this);

    // legacy.
    this.writable = true;

    Stream.call(this);
  }

// Otherwise people can pipe Writable streams, which is just wrong.
  Writable.prototype.pipe = function() {
    this.emit('error', new Error('Cannot pipe. Not readable.'));
  };


  function writeAfterEnd(stream, state, cb) {
    var er = new Error('write after end');
    // TODO: defer error events consistently everywhere, not just the cb
    stream.emit('error', er);
    setImmediate(function() {
      cb(er);
    });
  }

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
  function validChunk(stream, state, chunk, cb) {
    var valid = true;
    if (!Buffer.isBuffer(chunk) &&
      'string' !== typeof chunk &&
      chunk !== null &&
      chunk !== undefined &&
      !state.objectMode) {
      var er = new TypeError('Invalid non-string/buffer chunk');
      stream.emit('error', er);
      setImmediate(function() {
        cb(er);
      });
      valid = false;
    }
    return valid;
  }

  Writable.prototype.write = function(chunk, encoding, cb) {
    var state = this._writableState;
    var ret = false;

    if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (!Buffer.isBuffer(chunk) && isUint8Array(chunk))
      chunk = new Buffer(chunk);
    if (isArrayBuffer(chunk) && typeof Uint8Array !== 'undefined')
      chunk = new Buffer(new Uint8Array(chunk));

    if (Buffer.isBuffer(chunk))
      encoding = 'buffer';
    else if (!encoding)
      encoding = state.defaultEncoding;

    if (typeof cb !== 'function')
      cb = function() {};

    if (state.ended)
      writeAfterEnd(this, state, cb);
    else if (validChunk(this, state, chunk, cb))
      ret = writeOrBuffer(this, state, chunk, encoding, cb);

    return ret;
  };

  function decodeChunk(state, chunk, encoding) {
    if (!state.objectMode &&
      state.decodeStrings !== false &&
      typeof chunk === 'string') {
      chunk = new Buffer(chunk, encoding);
    }
    return chunk;
  }

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
  function writeOrBuffer(stream, state, chunk, encoding, cb) {
    chunk = decodeChunk(state, chunk, encoding);
    var len = state.objectMode ? 1 : chunk.length;

    state.length += len;

    var ret = state.length < state.highWaterMark;
    state.needDrain = !ret;

    if (state.writing)
      state.buffer.push(new WriteReq(chunk, encoding, cb));
    else
      doWrite(stream, state, len, chunk, encoding, cb);

    return ret;
  }

  function doWrite(stream, state, len, chunk, encoding, cb) {
    state.writelen = len;
    state.writecb = cb;
    state.writing = true;
    state.sync = true;
    stream._write(chunk, encoding, state.onwrite);
    state.sync = false;
  }

  function onwriteError(stream, state, sync, er, cb) {
    if (sync)
      setImmediate(function() {
        cb(er);
      });
    else
      cb(er);

    stream.emit('error', er);
  }

  function onwriteStateUpdate(state) {
    state.writing = false;
    state.writecb = null;
    state.length -= state.writelen;
    state.writelen = 0;
  }

  function onwrite(stream, er) {
    var state = stream._writableState;
    var sync = state.sync;
    var cb = state.writecb;

    onwriteStateUpdate(state);

    if (er)
      onwriteError(stream, state, sync, er, cb);
    else {
      // Check if we're actually ready to finish, but don't emit yet
      var finished = needFinish(stream, state);

      if (!finished && !state.bufferProcessing && state.buffer.length)
        clearBuffer(stream, state);

      if (sync) {
        setImmediate(function() {
          afterWrite(stream, state, finished, cb);
        });
      } else {
        afterWrite(stream, state, finished, cb);
      }
    }
  }

  function afterWrite(stream, state, finished, cb) {
    if (!finished)
      onwriteDrain(stream, state);
    cb();
    if (finished)
      finishMaybe(stream, state);
  }

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
  function onwriteDrain(stream, state) {
    if (state.length === 0 && state.needDrain) {
      state.needDrain = false;
      stream.emit('drain');
    }
  }


// if there's something in the buffer waiting, then process it
  function clearBuffer(stream, state) {
    state.bufferProcessing = true;

    for (var c = 0; c < state.buffer.length; c++) {
      var entry = state.buffer[c];
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, len, chunk, encoding, cb);

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    state.bufferProcessing = false;
    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }

  Writable.prototype._write = function(chunk, encoding, cb) {
    cb(new Error('not implemented'));
  };

  Writable.prototype.end = function(chunk, encoding, cb) {
    var state = this._writableState;

    if (typeof chunk === 'function') {
      cb = chunk;
      chunk = null;
      encoding = null;
    } else if (typeof encoding === 'function') {
      cb = encoding;
      encoding = null;
    }

    if (typeof chunk !== 'undefined' && chunk !== null)
      this.write(chunk, encoding);

    // ignore unnecessary end() calls.
    if (!state.ending && !state.finished)
      endWritable(this, state, cb);
  };


  function needFinish(stream, state) {
    return (state.ending &&
      state.length === 0 &&
      !state.finished &&
      !state.writing);
  }

  function finishMaybe(stream, state) {
    var need = needFinish(stream, state);
    if (need) {
      state.finished = true;
      stream.emit('finish');
    }
    return need;
  }

  function endWritable(stream, state, cb) {
    state.ending = true;
    finishMaybe(stream, state);
    if (cb) {
      if (state.finished)
        setImmediate(cb);
      else
        stream.once('finish', cb);
    }
    state.ended = true;
  }

},{"./index.js":48,"buffer":38,"inherits":56,"process/browser.js":49}],54:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

  var Buffer = require('buffer').Buffer;

  function assertEncoding(encoding) {
    if (encoding && !Buffer.isEncoding(encoding)) {
      throw new Error('Unknown encoding: ' + encoding);
    }
  }

  var StringDecoder = exports.StringDecoder = function(encoding) {
    this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
    assertEncoding(encoding);
    switch (this.encoding) {
      case 'utf8':
        // CESU-8 represents each of Surrogate Pair by 3-bytes
        this.surrogateSize = 3;
        break;
      case 'ucs2':
      case 'utf16le':
        // UTF-16 represents each of Surrogate Pair by 2-bytes
        this.surrogateSize = 2;
        this.detectIncompleteChar = utf16DetectIncompleteChar;
        break;
      case 'base64':
        // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
        this.surrogateSize = 3;
        this.detectIncompleteChar = base64DetectIncompleteChar;
        break;
      default:
        this.write = passThroughWrite;
        return;
    }

    this.charBuffer = new Buffer(6);
    this.charReceived = 0;
    this.charLength = 0;
  };


  StringDecoder.prototype.write = function(buffer) {
    var charStr = '';
    var offset = 0;

    // if our last write ended with an incomplete multibyte character
    while (this.charLength) {
      // determine how many remaining bytes this buffer has to offer for this char
      var i = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

      // add the new bytes to the char buffer
      buffer.copy(this.charBuffer, this.charReceived, offset, i);
      this.charReceived += (i - offset);
      offset = i;

      if (this.charReceived < this.charLength) {
        // still not enough chars in this buffer? wait for more ...
        return '';
      }

      // get the character that was split
      charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

      // lead surrogate (D800-DBFF) is also the incomplete character
      var charCode = charStr.charCodeAt(charStr.length - 1);
      if (charCode >= 0xD800 && charCode <= 0xDBFF) {
        this.charLength += this.surrogateSize;
        charStr = '';
        continue;
      }
      this.charReceived = this.charLength = 0;

      // if there are no more bytes in this buffer, just emit our char
      if (i == buffer.length) return charStr;

      // otherwise cut off the characters end from the beginning of this buffer
      buffer = buffer.slice(i, buffer.length);
      break;
    }

    var lenIncomplete = this.detectIncompleteChar(buffer);

    var end = buffer.length;
    if (this.charLength) {
      // buffer the incomplete character bytes we got
      buffer.copy(this.charBuffer, 0, buffer.length - lenIncomplete, end);
      this.charReceived = lenIncomplete;
      end -= lenIncomplete;
    }

    charStr += buffer.toString(this.encoding, 0, end);

    var end = charStr.length - 1;
    var charCode = charStr.charCodeAt(end);
    // lead surrogate (D800-DBFF) is also the incomplete character
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      var size = this.surrogateSize;
      this.charLength += size;
      this.charReceived += size;
      this.charBuffer.copy(this.charBuffer, size, 0, size);
      this.charBuffer.write(charStr.charAt(charStr.length - 1), this.encoding);
      return charStr.substring(0, end);
    }

    // or just emit the charStr
    return charStr;
  };

  StringDecoder.prototype.detectIncompleteChar = function(buffer) {
    // determine how many bytes we have to check at the end of this buffer
    var i = (buffer.length >= 3) ? 3 : buffer.length;

    // Figure out if one of the last i bytes of our buffer announces an
    // incomplete char.
    for (; i > 0; i--) {
      var c = buffer[buffer.length - i];

      // See http://en.wikipedia.org/wiki/UTF-8#Description

      // 110XXXXX
      if (i == 1 && c >> 5 == 0x06) {
        this.charLength = 2;
        break;
      }

      // 1110XXXX
      if (i <= 2 && c >> 4 == 0x0E) {
        this.charLength = 3;
        break;
      }

      // 11110XXX
      if (i <= 3 && c >> 3 == 0x1E) {
        this.charLength = 4;
        break;
      }
    }

    return i;
  };

  StringDecoder.prototype.end = function(buffer) {
    var res = '';
    if (buffer && buffer.length)
      res = this.write(buffer);

    if (this.charReceived) {
      var cr = this.charReceived;
      var buf = this.charBuffer;
      var enc = this.encoding;
      res += buf.slice(0, cr).toString(enc);
    }

    return res;
  };

  function passThroughWrite(buffer) {
    return buffer.toString(this.encoding);
  }

  function utf16DetectIncompleteChar(buffer) {
    var incomplete = this.charReceived = buffer.length % 2;
    this.charLength = incomplete ? 2 : 0;
    return incomplete;
  }

  function base64DetectIncompleteChar(buffer) {
    var incomplete = this.charReceived = buffer.length % 3;
    this.charLength = incomplete ? 3 : 0;
    return incomplete;
  }

},{"buffer":38}],55:[function(require,module,exports){
  exports.read = function (buffer, offset, isLE, mLen, nBytes) {
    var e, m
    var eLen = nBytes * 8 - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var nBits = -7
    var i = isLE ? (nBytes - 1) : 0
    var d = isLE ? -1 : 1
    var s = buffer[offset + i]

    i += d

    e = s & ((1 << (-nBits)) - 1)
    s >>= (-nBits)
    nBits += eLen
    for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    m = e & ((1 << (-nBits)) - 1)
    e >>= (-nBits)
    nBits += mLen
    for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

    if (e === 0) {
      e = 1 - eBias
    } else if (e === eMax) {
      return m ? NaN : ((s ? -1 : 1) * Infinity)
    } else {
      m = m + Math.pow(2, mLen)
      e = e - eBias
    }
    return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
  }

  exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
    var e, m, c
    var eLen = nBytes * 8 - mLen - 1
    var eMax = (1 << eLen) - 1
    var eBias = eMax >> 1
    var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
    var i = isLE ? 0 : (nBytes - 1)
    var d = isLE ? 1 : -1
    var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

    value = Math.abs(value)

    if (isNaN(value) || value === Infinity) {
      m = isNaN(value) ? 1 : 0
      e = eMax
    } else {
      e = Math.floor(Math.log(value) / Math.LN2)
      if (value * (c = Math.pow(2, -e)) < 1) {
        e--
        c *= 2
      }
      if (e + eBias >= 1) {
        value += rt / c
      } else {
        value += rt * Math.pow(2, 1 - eBias)
      }
      if (value * c >= 2) {
        e++
        c /= 2
      }

      if (e + eBias >= eMax) {
        m = 0
        e = eMax
      } else if (e + eBias >= 1) {
        m = (value * c - 1) * Math.pow(2, mLen)
        e = e + eBias
      } else {
        m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
        e = 0
      }
    }

    for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

    e = (e << mLen) | m
    eLen += mLen
    for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

    buffer[offset + i - d] |= s * 128
  }

},{}],56:[function(require,module,exports){
  if (typeof Object.create === 'function') {
    // implementation from standard node.js 'util' module
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      });
    };
  } else {
    // old school shim for old browsers
    module.exports = function inherits(ctor, superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }

},{}],57:[function(require,module,exports){
  module.exports=require(56)
},{}],58:[function(require,module,exports){
  module.exports = function isBuffer(arg) {
    return arg && typeof arg === 'object'
      && typeof arg.copy === 'function'
      && typeof arg.fill === 'function'
      && typeof arg.readUInt8 === 'function';
  }
},{}],59:[function(require,module,exports){
  (function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

    var formatRegExp = /%[sdj%]/g;
    exports.format = function(f) {
      if (!isString(f)) {
        var objects = [];
        for (var i = 0; i < arguments.length; i++) {
          objects.push(inspect(arguments[i]));
        }
        return objects.join(' ');
      }

      var i = 1;
      var args = arguments;
      var len = args.length;
      var str = String(f).replace(formatRegExp, function(x) {
        if (x === '%%') return '%';
        if (i >= len) return x;
        switch (x) {
          case '%s': return String(args[i++]);
          case '%d': return Number(args[i++]);
          case '%j':
            try {
              return JSON.stringify(args[i++]);
            } catch (_) {
              return '[Circular]';
            }
          default:
            return x;
        }
      });
      for (var x = args[i]; i < len; x = args[++i]) {
        if (isNull(x) || !isObject(x)) {
          str += ' ' + x;
        } else {
          str += ' ' + inspect(x);
        }
      }
      return str;
    };


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
    exports.deprecate = function(fn, msg) {
      // Allow for deprecating things in the process of starting up.
      if (isUndefined(global.process)) {
        return function() {
          return exports.deprecate(fn, msg).apply(this, arguments);
        };
      }

      if (process.noDeprecation === true) {
        return fn;
      }

      var warned = false;
      function deprecated() {
        if (!warned) {
          if (process.throwDeprecation) {
            throw new Error(msg);
          } else if (process.traceDeprecation) {
            console.trace(msg);
          } else {
            console.error(msg);
          }
          warned = true;
        }
        return fn.apply(this, arguments);
      }

      return deprecated;
    };


    var debugs = {};
    var debugEnviron;
    exports.debuglog = function(set) {
      if (isUndefined(debugEnviron))
        debugEnviron = process.env.NODE_DEBUG || '';
      set = set.toUpperCase();
      if (!debugs[set]) {
        if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
          var pid = process.pid;
          debugs[set] = function() {
            var msg = exports.format.apply(exports, arguments);
            console.error('%s %d: %s', set, pid, msg);
          };
        } else {
          debugs[set] = function() {};
        }
      }
      return debugs[set];
    };


    /**
     * Echos the value of a value. Trys to print the value out
     * in the best way possible given the different types.
     *
     * @param {Object} obj The object to print out.
     * @param {Object} opts Optional options object that alters the output.
     */
    /* legacy: obj, showHidden, depth, colors*/
    function inspect(obj, opts) {
      // default options
      var ctx = {
        seen: [],
        stylize: stylizeNoColor
      };
      // legacy...
      if (arguments.length >= 3) ctx.depth = arguments[2];
      if (arguments.length >= 4) ctx.colors = arguments[3];
      if (isBoolean(opts)) {
        // legacy...
        ctx.showHidden = opts;
      } else if (opts) {
        // got an "options" object
        exports._extend(ctx, opts);
      }
      // set default options
      if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
      if (isUndefined(ctx.depth)) ctx.depth = 2;
      if (isUndefined(ctx.colors)) ctx.colors = false;
      if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
      if (ctx.colors) ctx.stylize = stylizeWithColor;
      return formatValue(ctx, obj, ctx.depth);
    }
    exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    inspect.colors = {
      'bold' : [1, 22],
      'italic' : [3, 23],
      'underline' : [4, 24],
      'inverse' : [7, 27],
      'white' : [37, 39],
      'grey' : [90, 39],
      'black' : [30, 39],
      'blue' : [34, 39],
      'cyan' : [36, 39],
      'green' : [32, 39],
      'magenta' : [35, 39],
      'red' : [31, 39],
      'yellow' : [33, 39]
    };

// Don't use 'blue' not visible on cmd.exe
    inspect.styles = {
      'special': 'cyan',
      'number': 'yellow',
      'boolean': 'yellow',
      'undefined': 'grey',
      'null': 'bold',
      'string': 'green',
      'date': 'magenta',
      // "name": intentionally not styling
      'regexp': 'red'
    };


    function stylizeWithColor(str, styleType) {
      var style = inspect.styles[styleType];

      if (style) {
        return '\u001b[' + inspect.colors[style][0] + 'm' + str +
          '\u001b[' + inspect.colors[style][1] + 'm';
      } else {
        return str;
      }
    }


    function stylizeNoColor(str, styleType) {
      return str;
    }


    function arrayToHash(array) {
      var hash = {};

      array.forEach(function(val, idx) {
        hash[val] = true;
      });

      return hash;
    }


    function formatValue(ctx, value, recurseTimes) {
      // Provide a hook for user-specified inspect functions.
      // Check that value is an object with an inspect function on it
      if (ctx.customInspect &&
        value &&
        isFunction(value.inspect) &&
        // Filter out the util module, it's inspect function is special
        value.inspect !== exports.inspect &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
        var ret = value.inspect(recurseTimes, ctx);
        if (!isString(ret)) {
          ret = formatValue(ctx, ret, recurseTimes);
        }
        return ret;
      }

      // Primitive types cannot have properties
      var primitive = formatPrimitive(ctx, value);
      if (primitive) {
        return primitive;
      }

      // Look up the keys of the object.
      var keys = Object.keys(value);
      var visibleKeys = arrayToHash(keys);

      if (ctx.showHidden) {
        keys = Object.getOwnPropertyNames(value);
      }

      // IE doesn't make error fields non-enumerable
      // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
      if (isError(value)
        && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
        return formatError(value);
      }

      // Some type of object without properties can be shortcutted.
      if (keys.length === 0) {
        if (isFunction(value)) {
          var name = value.name ? ': ' + value.name : '';
          return ctx.stylize('[Function' + name + ']', 'special');
        }
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        }
        if (isDate(value)) {
          return ctx.stylize(Date.prototype.toString.call(value), 'date');
        }
        if (isError(value)) {
          return formatError(value);
        }
      }

      var base = '', array = false, braces = ['{', '}'];

      // Make Array say that they are Array
      if (isArray(value)) {
        array = true;
        braces = ['[', ']'];
      }

      // Make functions say that they are functions
      if (isFunction(value)) {
        var n = value.name ? ': ' + value.name : '';
        base = ' [Function' + n + ']';
      }

      // Make RegExps say that they are RegExps
      if (isRegExp(value)) {
        base = ' ' + RegExp.prototype.toString.call(value);
      }

      // Make dates with properties first say the date
      if (isDate(value)) {
        base = ' ' + Date.prototype.toUTCString.call(value);
      }

      // Make error with message first say the error
      if (isError(value)) {
        base = ' ' + formatError(value);
      }

      if (keys.length === 0 && (!array || value.length == 0)) {
        return braces[0] + base + braces[1];
      }

      if (recurseTimes < 0) {
        if (isRegExp(value)) {
          return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
        } else {
          return ctx.stylize('[Object]', 'special');
        }
      }

      ctx.seen.push(value);

      var output;
      if (array) {
        output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
      } else {
        output = keys.map(function(key) {
          return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
        });
      }

      ctx.seen.pop();

      return reduceToSingleString(output, base, braces);
    }


    function formatPrimitive(ctx, value) {
      if (isUndefined(value))
        return ctx.stylize('undefined', 'undefined');
      if (isString(value)) {
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
          .replace(/'/g, "\\'")
          .replace(/\\"/g, '"') + '\'';
        return ctx.stylize(simple, 'string');
      }
      if (isNumber(value))
        return ctx.stylize('' + value, 'number');
      if (isBoolean(value))
        return ctx.stylize('' + value, 'boolean');
      // For some reason typeof null is "object", so special case here.
      if (isNull(value))
        return ctx.stylize('null', 'null');
    }


    function formatError(value) {
      return '[' + Error.prototype.toString.call(value) + ']';
    }


    function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
      var output = [];
      for (var i = 0, l = value.length; i < l; ++i) {
        if (hasOwnProperty(value, String(i))) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            String(i), true));
        } else {
          output.push('');
        }
      }
      keys.forEach(function(key) {
        if (!key.match(/^\d+$/)) {
          output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
            key, true));
        }
      });
      return output;
    }


    function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
      var name, str, desc;
      desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
      if (desc.get) {
        if (desc.set) {
          str = ctx.stylize('[Getter/Setter]', 'special');
        } else {
          str = ctx.stylize('[Getter]', 'special');
        }
      } else {
        if (desc.set) {
          str = ctx.stylize('[Setter]', 'special');
        }
      }
      if (!hasOwnProperty(visibleKeys, key)) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (ctx.seen.indexOf(desc.value) < 0) {
          if (isNull(recurseTimes)) {
            str = formatValue(ctx, desc.value, null);
          } else {
            str = formatValue(ctx, desc.value, recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (array) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = ctx.stylize('[Circular]', 'special');
        }
      }
      if (isUndefined(name)) {
        if (array && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = ctx.stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
            .replace(/\\"/g, '"')
            .replace(/(^"|"$)/g, "'");
          name = ctx.stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    }


    function reduceToSingleString(output, base, braces) {
      var numLinesEst = 0;
      var length = output.reduce(function(prev, cur) {
        numLinesEst++;
        if (cur.indexOf('\n') >= 0) numLinesEst++;
        return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
      }, 0);

      if (length > 60) {
        return braces[0] +
          (base === '' ? '' : base + '\n ') +
          ' ' +
          output.join(',\n  ') +
          ' ' +
          braces[1];
      }

      return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
    function isArray(ar) {
      return Array.isArray(ar);
    }
    exports.isArray = isArray;

    function isBoolean(arg) {
      return typeof arg === 'boolean';
    }
    exports.isBoolean = isBoolean;

    function isNull(arg) {
      return arg === null;
    }
    exports.isNull = isNull;

    function isNullOrUndefined(arg) {
      return arg == null;
    }
    exports.isNullOrUndefined = isNullOrUndefined;

    function isNumber(arg) {
      return typeof arg === 'number';
    }
    exports.isNumber = isNumber;

    function isString(arg) {
      return typeof arg === 'string';
    }
    exports.isString = isString;

    function isSymbol(arg) {
      return typeof arg === 'symbol';
    }
    exports.isSymbol = isSymbol;

    function isUndefined(arg) {
      return arg === void 0;
    }
    exports.isUndefined = isUndefined;

    function isRegExp(re) {
      return isObject(re) && objectToString(re) === '[object RegExp]';
    }
    exports.isRegExp = isRegExp;

    function isObject(arg) {
      return typeof arg === 'object' && arg !== null;
    }
    exports.isObject = isObject;

    function isDate(d) {
      return isObject(d) && objectToString(d) === '[object Date]';
    }
    exports.isDate = isDate;

    function isError(e) {
      return isObject(e) &&
        (objectToString(e) === '[object Error]' || e instanceof Error);
    }
    exports.isError = isError;

    function isFunction(arg) {
      return typeof arg === 'function';
    }
    exports.isFunction = isFunction;

    function isPrimitive(arg) {
      return arg === null ||
        typeof arg === 'boolean' ||
        typeof arg === 'number' ||
        typeof arg === 'string' ||
        typeof arg === 'symbol' ||  // ES6 symbol
        typeof arg === 'undefined';
    }
    exports.isPrimitive = isPrimitive;

    exports.isBuffer = require('./support/isBuffer');

    function objectToString(o) {
      return Object.prototype.toString.call(o);
    }


    function pad(n) {
      return n < 10 ? '0' + n.toString(10) : n.toString(10);
    }


    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
      'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
    function timestamp() {
      var d = new Date();
      var time = [pad(d.getHours()),
        pad(d.getMinutes()),
        pad(d.getSeconds())].join(':');
      return [d.getDate(), months[d.getMonth()], time].join(' ');
    }


// log is just a thin wrapper to console.log that prepends a timestamp
    exports.log = function() {
      console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
    };


    /**
     * Inherit the prototype methods from one constructor into another.
     *
     * The Function.prototype.inherits from lang.js rewritten as a standalone
     * function (not on Function.prototype). NOTE: If this file is to be loaded
     * during bootstrapping this function needs to be rewritten using some native
     * functions as prototype setup using normal JavaScript does not work as
     * expected during bootstrapping (see mirror.js in r114903).
     *
     * @param {function} ctor Constructor function which needs to inherit the
     *     prototype.
     * @param {function} superCtor Constructor function to inherit prototype from.
     */
    exports.inherits = require('inherits');

    exports._extend = function(origin, add) {
      // Don't do anything if add isn't an object
      if (!add || !isObject(add)) return origin;

      var keys = Object.keys(add);
      var i = keys.length;
      while (i--) {
        origin[keys[i]] = add[keys[i]];
      }
      return origin;
    };

    function hasOwnProperty(obj, prop) {
      return Object.prototype.hasOwnProperty.call(obj, prop);
    }

  }).call(this,require("7YKIPe"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":58,"7YKIPe":46,"inherits":57}],60:[function(require,module,exports){
  'use strict';

  var assert = require('assert');
  var stream = require('stream');
  var hash = require('../index');

  describe('writeToStream', function() {
    it('should emit information about an object to a stream', function() {
      var strm = new stream.PassThrough();

      hash.writeToStream({foo: 'bar'}, strm);
      var result = strm.read().toString();
      assert.strictEqual(typeof result, 'string');
      assert.notStrictEqual(result.indexOf('foo'), -1);
      assert.notStrictEqual(result.indexOf('bar'), -1);
    });

    it('should leave out keys when excludeValues = true', function() {
      var strm = new stream.PassThrough();

      hash.writeToStream({foo: 'bar'}, {excludeValues: true}, strm);
      var result = strm.read().toString();
      assert.strictEqual(typeof result, 'string');
      assert.notStrictEqual(result.indexOf('foo'), -1);
      assert.   strictEqual(result.indexOf('bar'), -1);
    });
  });

},{"../index":1,"assert":36,"stream":48}]},{},[60])
