'use strict';

var crypto = require('crypto');

module.exports = function(object, options){
	options = options || {};
  var algo = options.algorithm || 'sha1';
  var encoding = options.encoding || 'hex';
  algo.toLowerCase();
  encoding = encoding.toLowerCase();

  validate(object, algo, encoding);

  return hash(object, algo, encoding);
}

var validate = function(object, algo, encoding){
	var supported = crypto.getHashes();
	var encodings = ['buffer', 'hex', 'binary', 'base64'];

	if(typeof object === 'undefined') { 
    throw new Error('Object argument required.');
  }

	if(supported.indexOf(algo) === -1){
		throw new Error('Algorithm "' + algo + '"  not supported. ' + 
			'supported values: ' + supported.join(', '));
	}

	if(encodings.indexOf(encoding) === -1){
		throw new Error('Encoding "' + encoding + '"  not supported. ' + 
			'supported values: ' + encodings.join(', '));
	}
};

var hash = function(object, algo, encoding){
	var hashFn = crypto.createHash(algo);
	var type = typeof value;

	typeHasher(hashFn).dispatch(object);

  return (encoding === 'buffer') ? hashFn.digest() : hashFn.digest(encoding);
};

function typeHasher(hashFn){
	return {
		dispatch: function(value){	
			var type = typeof value;
			var func = this['_' + type];
			return func(value);
		},
		_object: function(object) {
			var objType = Object.prototype.toString.call(object);
			//if(objType === '[object Array]') { 
			return typeHasher._array.call(this, object);
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
		_array: function(){

		}
	}
};

