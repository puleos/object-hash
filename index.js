'use strict';

var crypto = require('crypto');

module.exports = function(object,  hashAlgorithm){
  hashAlgorithm = hashAlgorithm || 'sha1';
  hashAlgorithm.toLowerCase();

  validate(object, hashAlgorithm);
}

function validate(object, algo){
	var supported = crypto.getHashes();
	
	if(typeof object === 'undefined') { 
    throw new Error('object argument required.');
  }

	if(supported.indexOf(algo) === -1){
		throw new Error('Hash Algorithm "' + algo + '"  not supported. ' + 
			'Supported values: ' + supported.join(', '));
	}
}

