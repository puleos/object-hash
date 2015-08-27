# Object-Hash

[![status](https://secure.travis-ci.org/puleos/object-hash.png?branch=master)](https://secure.travis-ci.org/puleos/object-hash?branch=master)
[![testling](https://ci.testling.com/puleos/object-hash.png?v=0.2.0)](https://ci.testling.com/puleos/object-hash?v=0.2.0)

Generate hashes from objects and values in node and the browser.  Uses node.js
crypto module for hashing.  Supports sha1, md5 and many others (depending on the platform).

* Hash values of any type.
* Provides a hash table implementation.
* Supports a keys only option for grouping like objects with different values.

```
var hash = require('object-hash');
```
## hash(value, options);
Generate a hash from any object or type.  Defaults to sha1 with hex encoding.
*  `algorithm` hash algo to be used: 'sha1', 'md5'. default: sha1
*  `excludeValues` {true|false} hash object keys, values ignored. default: false
*  `encoding` hash encoding, supports 'buffer', 'hex', 'binary', 'base64'. default: hex
*  `respectFunctionProperties` {true|false} Whether properties on functions are considered when hashing. default: true
*  `respectTypes` {true|false} Whether special type attributes (`.prototype`, `.__proto__`, `.constructor`)
   are hashed. default: true

## hash.sha1(value);
Hash using the sha1 algorithm.

*Sugar method, equivalent to hash(value, {algorithm: 'sha1'})*

## hash.keys(value);
Hash object keys using the sha1 algorithm, values ignored.

*Sugar method, equivalent to hash(value, {excludeValues: true})*

## hash.MD5(value);
Hash using the md5 algorithm.

*Sugar method, equivalent to hash(value, {algorithm: 'md5'})*

## hash.keysMD5(value);
Hash object keys using the md5 algorithm, values ignored.

*Sugar method, equivalent to hash(value, {algorithm: 'md5', excludeValues: true})*

## var hashTable = new hash.HashTable(options);
Create a new HashTable instance.  Hashing options are supported and applied to all values
added to the table.

## hashTable.add(value1, value2, ...);
Add an object to the hash table. Supports n parameters or an array of values to be
added to the table.  

*Note: if you wish to evaluate an array as a single table entry
you must wrap it first `{[1,2,3,4]}` otherwise each element will be added to the
table separately.*

## hashTable.getValue(hashKey);
Retrive the objects value from the table by hash key.  If there is no matching entry
returns undefined.

## hashTable.getCount(hashKey);
Retrieve a counter representing the number of times an object was added to
the table.  Returns 0 if a matching key is not found.

## hashTable.hasKey(hashKey);
Returns true if the specified hash is in the hash table otherwise false.

## hashTable.toArray();
Returns an array of the hash table contents in the following format:
```
[ {hash:'14fa461bf4b98155e82adc86532938553b4d33a9',
    count: 2, value: {foo: 'bar', baz: true }},
  {hash:'14fa461bf4b98155e82adc86532938553b4d33a9',
    count: 1, value: {foo: 'bar', baz: true }} ]
```
*Note: when the excludeValues option is set, the `value` of the hash table is an array of objects with matching keys.*

## hashTable.reset();
Clears the contents of the hash table.

## Installation

node:
```
npm install object-hash
```

browser: */dist/object_hash.js*
```
<script src="object_hash.js" type="text/javascript"></script>

<script>
  var hash = objectHash.sha({foo:'bar'}); 
  
  console.log(hash); // e003c89cdf35cdf46d8239b4692436364b7259f9
</script>
```

## Example usage
```js
var hash = require('object-hash');

var peter = {name: 'Peter', stapler: false, friends: ['Joanna', 'Michael', 'Samir'] };
var michael = {name: 'Michael', stapler: false, friends: ['Peter', 'Samir'] };
var bob = {name: 'Bob', stapler: true, friends: [] };

/***
 * sha1 hex encoding (default)
 */
hash(peter);
// 14fa461bf4b98155e82adc86532938553b4d33a9
hash(michael);
// 4b2b30e27699979ce46714253bc2213010db039c
hash(bob);
// 38d96106bc8ef3d8bd369b99bb6972702c9826d5

/***
 * hash object keys, values ignored
 */
hash(peter, { excludeValues: true });
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c
hash(michael, { excludeValues: true });
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c
hash.keys(bob);
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c

/***
 * md5 base64 encoding
 */
hash(peter, { algorithm: 'md5', encoding: 'base64' });
// 6rkWaaDiG3NynWw4svGH7g==
hash(michael, { algorithm: 'md5', encoding: 'base64' });
// djXaWpuWVJeOF8Sb6SFFNg==
hash(bob, { algorithm: 'md5', encoding: 'base64' });
// lFzkw/IJ8/12jZI0rQeS3w==

/***
 * HashTable example
 */
var hashTable = new hash.HashTable();
var peterHash = hash(peter);

hashTable.add(peter, michael, bob);
hashTable.getValue(peterHash);
// {name: 'Peter', stapler: false, friends: ['Joanna', 'Michael', 'Samir'] };
hashTable.getCount(peterHash);
// 1
hashTable.add({name: 'Peter', stapler: false, friends: ['Joanna', 'Michael', 'Samir'] });
hashTable.getCount(peterHash);
// 2
hashTable.hasKey(peterHash);
// true
hashTable.toArray();
// [ {hash:'14fa461bf4b98155e82adc86532938553b4d33a9',
//    count: 2, value: {name: 'Peter', stapler: false, friends: ['Joanna', 'Michael', 'Samir'] }},
//  {hash:'4b2b30e27699979ce46714253bc2213010db039c',
//    count: 1, value: {name: 'Michael', stapler: false, friends: ['Peter', 'Samir'] }},
//  {hash:'38d96106bc8ef3d8bd369b99bb6972702c9826d5',
//    count: 1, value: {name: 'Bob', stapler: true, friends: [] }} ]
```

## Legacy Browser Support
IE <= 8 and Opera <= 11 support dropped in version 0.3.0.  If you require 
legacy browser support you must either use an ES5 shim or use version 0.2.5
of this module.

## Development

```
git clone https://github.com/puleos/object-hash
```

### gulp tasks
* `gulp watch` (default) watch files, test and lint on change/add
* `gulp test` unit tests
* `gulp lint` jshint
* `gulp dist` create browser version in /dist

## License
MIT
