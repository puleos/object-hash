# Object-Hash

![status](https://secure.travis-ci.org/puleos/object-hash.png?branch=master)

![testling](https://ci.testling.com/puleos/object-hash.png?v=0.2.0)

Generate hashes from objects and values in node and the browser.  Uses node.js
crypo module for hashing.  Supports sha1, md5 and many others (depending on the host os). 

* Provides a Hashtable implementation.
* Supports a keys only option for grouping like objects with different values.

```
var hash = require('object-hash');
```
## hash(value, options);
Generate a hash from any object or type.  Defaults to sha1 with hex encoding.
*  `algorithm` hash algo to be used by this instance: 'sha1', 'md5'
*  `excludeValues` {true|false} hash object keys, values ignored
*  `encoding` hash encoding, supports 'buffer', 'hex', 'binary', 'base64'

## hash.keys(value);
Sugar method, equivalent to hash(value, {excludeValues: true})

## hash.MD5(value);
Sugar method, equivalent to hash(value, {algorithm: 'md5'})

## hash.keysMD5(value);
Sugar method, equivalent to hash(value, {algorithm: 'md5', excludeValues: true})

## var hashTable = new hash.HashTable(options);
Create a new HashTable instance.  Standard hashing options are supported.

## hashTable.add(value1, value2, ...);
Add an object to the hash table. Supports parameters or a single array.

## hashTable.getValue(hashKey);
Retrive the objects value from the table by hash key.

## hashTable.getCount(hashKey);
Retrieve a counter representing the number of times an object was added to
the table.  

## hashTable.hasKey(hashKey);
Returns true if the specified hash is in the hash table.

## hashTable.toArray();
Returns an array of the hash table contents in the following format:
```
[ {hash:'14fa461bf4b98155e82adc86532938553b4d33a9',
    count: 2, value: {foo: 'bar', baz: true }},
  {hash:'14fa461bf4b98155e82adc86532938553b4d33a9',
    count: 1, value: {foo: 'bar', baz: true }} ]
```
!Note: when the excludeValues option is set, the `value` of the hash table is an array of objects with matching keys.

## hashTable.reset();
Clears contents of the hashTable.

## Installation

node:
```
npm install object-hash
```

browser: */dist/object_hash.js*
```
<script src="object_hash.min.js" type="text/javascript"></script>
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
console.log(hash(peter));
// 14fa461bf4b98155e82adc86532938553b4d33a9
console.log(hash(michael));
// 4b2b30e27699979ce46714253bc2213010db039c
console.log(hash(bob));
// 38d96106bc8ef3d8bd369b99bb6972702c9826d5

/***
 * hash object keys, values ignored
 */
console.log(hash(peter, { excludeValues: true }));
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c
console.log(hash(michael, { excludeValues: true }));
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c
console.log(hash.keys(bob));
// 48f370a772c7496f6c9d2e6d92e920c87dd00a5c

/***
 * md5 base64 encoding
 */
console.log(hash(peter, { algorithm: 'md5', encoding: 'base64' }));
// 6rkWaaDiG3NynWw4svGH7g==
console.log(hash(michael, { algorithm: 'md5', encoding: 'base64' }));
// djXaWpuWVJeOF8Sb6SFFNg==
console.log(hash(bob, { algorithm: 'md5', encoding: 'base64' }));
// lFzkw/IJ8/12jZI0rQeS3w==

```

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
