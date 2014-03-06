'use strict';

var crypto = require('crypto');

module.exports = function(object,  hashAlgorithm){
  hashAlgorithm = hashAlgorithm || 'sha1';
  hashAlgorithm.toLowerCase();

  validate(object, hashAlgorithm);

  return hash(object, hashAlgorithm);
}

var validate = function(object, algo){
	var supported = crypto.getHashes();
	
	if(typeof object === 'undefined') { 
    throw new Error('object argument required.');
  }

	if(supported.indexOf(algo) === -1){
		throw new Error('Hash Algorithm "' + algo + '"  not supported. ' + 
			'Supported values: ' + supported.join(', '));
	}
};

var hash = function(object, algo){
	var hashFn = crypto.createHash(algo);
	var type = typeof value;

	typeHasher(hashFn).dispatch(object);

  return hashFn.digest('hex');
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

