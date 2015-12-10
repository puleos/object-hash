var assert = require('assert');
var crypto = require('crypto');
var hash = require('../index');
var validSha1 = /^[0-9a-f]{40}$/i;

describe('hash', function() {
it('throws when nothing to hash', function () {
  assert.throws(hash, 'no arguments');
  assert.throws(function() {
    hash(undefined, {algorithm: 'md5'});
  }, 'undefined');
});

it('throws when passed an invalid options', function() {
  assert.throws(function() {
    hash({foo: 'bar'}, {algorithm: 'shalala'});
  }, 'bad algorithm');
  assert.throws(function() {
    hash({foo: 'bar'}, {encoding: 'base16'});
  }, 'bad encoding');
});

it('hashes non-object types', function() {
  var func = function(a){ return a + 1; };
  assert.ok(validSha1.test(hash('Shazbot!')), 'hash string');
  assert.ok(validSha1.test(hash(42)), 'hash number');
  assert.ok(validSha1.test(hash(true)), 'hash bool');
  assert.ok(validSha1.test(hash(func)), 'hash function');
});

it('hashes special object types', function() {
  var dt = new Date();
  dt.setDate(dt.getDate() + 1);

  assert.ok(validSha1.test(hash([1,2,3,4])), 'hash array');
  assert.notEqual(hash([1,2,3,4]), hash([4,3,2,1]), 'different arrays not equal');
  assert.ok(validSha1.test(hash(new Date())), 'hash date');
  assert.notEqual(hash(new Date()), hash(dt), 'different dates not equal');
  assert.ok(validSha1.test(hash(null)), 'hash Null');
  assert.ok(validSha1.test(hash(Number.NaN)), 'hash NaN');
  assert.ok(validSha1.test(hash({ foo: undefined })), 'hash Undefined value');
  assert.ok(validSha1.test(hash(new RegExp())), 'hash regex');
  assert.ok(validSha1.test(hash(new Error())), 'hash error');
});

if (typeof Symbol !== 'undefined')
it('hashes Symbols', function() {
  assert.ok(validSha1.test(hash(Symbol('Banana'))), 'hash error');
});

it('hashes a simple object', function() {
  assert.ok(validSha1.test(hash({foo: 'bar', bar: 'baz'})), 'hash object');
});

it('hashes identical objects with different key ordering', function() {
  var hash1 = hash({foo: 'bar', bar: 'baz'});
  var hash2 = hash({bar: 'baz', foo: 'bar'});
  var hash3 = hash({bar: 'foo', foo: 'baz'});
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});

it('hashes only object keys when excludeValues option is set', function() {
  var hash1 = hash({foo: false, bar: 'OK'}, { excludeValues: true });
  var hash2 = hash({foo: true, bar: 'NO'}, { excludeValues: true });
  var hash3 = hash({foo: true, bar: 'OK', baz: false}, { excludeValues: true });
  assert.equal(hash1, hash2, 'values not in hash digest');
  assert.notEqual(hash1, hash3, 'different keys not equal');
});

it('array values are hashed', function() {
  var hash1 = hash({foo: ['bar', 'baz'], bax: true });
  var hash2 = hash({foo: ['baz', 'bar'], bax: true });
  assert.notEqual(hash1, hash2, 'different array orders are unique');
});

it('nested object values are hashed', function() {
  var hash1 = hash({foo: {bar: true, bax: 1}});
  var hash2 = hash({foo: {bar: true, bax: 1}});
  var hash3 = hash({foo: {bar: false, bax: 1}});
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});

it('sugar methods should be equivalent', function() {
  var obj = {foo: 'bar', baz: true};
  assert.equal(hash.keys(obj), hash(obj, {excludeValues: true}), 'keys');
  assert.equal(hash.MD5(obj), hash(obj, {algorithm: 'md5'}), 'md5');
  assert.equal(hash.keysMD5(obj),
    hash(obj, {algorithm: 'md5', excludeValues: true}), 'keys md5');
});


it('array of nested object values are hashed', function() {
  var hash1 = hash({foo: [ {bar: true, bax: 1}, {bar: false, bax: 2} ] });
  var hash2 = hash({foo: [ {bar: true, bax: 1}, {bar: false, bax: 2} ] });
  var hash3 = hash({foo: [ {bar: false, bax: 2} ] });
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});

it("recursive objects don't blow up stack", function() {
  var hash1 = {foo: 'bar'};
  hash1.recursive = hash1;
  assert.doesNotThrow(function() {hash(hash1);}, /Maximum call stack size exceeded/, 'Should not throw an stack size exceeded exception');
});

it("recursive arrays don't blow up stack", function() {
  var hash1 = ['foo', 'bar'];
  hash1.push(hash1);
  assert.doesNotThrow(function() {hash(hash1);}, /Maximum call stack size exceeded/, 'Should not throw an stack size exceeded exception');
});

it("recursive handling tracks identity", function() {
  var hash1 = {k1: {k: 'v'}, k2: {k: 'k2'}};
  hash1.k1.r1 = hash1.k1;
  hash1.k2.r2 = hash1.k2;
  var hash2 = {k1: {k: 'v'}, k2: {k: 'k2'}};
  hash2.k1.r1 = hash2.k2;
  hash2.k2.r2 = hash2.k1;
  assert.notEqual(hash(hash1), hash(hash2), "order of recursive objects should matter");
});

it("null and 'Null' string produce different hashes", function() {
  var hash1 = hash({foo: null});
  var hash2 = hash({foo: 'Null'});
  assert.notEqual(hash1, hash2, "null and 'Null' should not produce identical hashes");
});

it("object types are hashed", function() {
  var hash1 = hash({foo: 'bar'});
  var hash2 = hash(['foo', 'bar']);
  assert.notEqual(hash1, hash2, "arrays and objects should not produce identical hashes");
});

it("utf8 strings are hashed correctly", function() {
  var hash1 = hash('\u03c3'); // cf 83 in utf8
  var hash2 = hash('\u01c3'); // c7 83 in utf8
  assert.notEqual(hash1, hash2, "different strings with similar utf8 encodings should produce different hashes");
});

it("various hashes in crypto.getHashes() should be supported", function() {
  var hashes = ['sha1', 'md5'];
  
  if (crypto.getHashes) {
    // take all hashes from crypto.getHashes() starting with MD or SHA
    hashes = crypto.getHashes().filter(RegExp.prototype.test.bind(/^(md|sha)/i));
  }
  
  var obj = {randomText: 'bananas'};
  
  for (var i = 0; i < hashes.length; i++) {
    assert.ok(hash(obj, {algorithm: hashes[i]}), 'Algorithm ' + hashes[i] + ' should be supported');
  }
});

if (typeof Buffer !== 'undefined') {
it("Buffers can be hashed", function() {
  assert.ok(validSha1.test(hash(new Buffer('Banana'))), 'hashes Buffers');
});
}

if (typeof Uint8Array !== 'undefined') {
it("Typed arrays can be hashed", function() {
  
  assert.ok(validSha1.test(hash(new Uint8Array([1,2,3,4]))), 'hashes Uint8Array');
  assert.ok(validSha1.test(hash(new  Int8Array([1,2,3,4]))), 'hashes  Int8Array');
  assert.ok(validSha1.test(hash(new Uint16Array([1,2,3,4]))), 'hashes Uint16Array');
  assert.ok(validSha1.test(hash(new  Int16Array([1,2,3,4]))), 'hashes  Int16Array');
  assert.ok(validSha1.test(hash(new Uint32Array([1,2,3,4]))), 'hashes Uint32Array');
  assert.ok(validSha1.test(hash(new  Int32Array([1,2,3,4]))), 'hashes  Int32Array');
  assert.ok(validSha1.test(hash(new Float32Array([1,2,3,4]))), 'hashes Float32Array');
  if (typeof Float64Array !== 'undefined')
  assert.ok(validSha1.test(hash(new Float64Array([1,2,3,4]))), 'hashes Float64Array');
  if (typeof Uint8ClampedArray !== 'undefined')
  assert.ok(validSha1.test(hash(new Uint8ClampedArray([1,2,3,4]))), 'hashes Uint8ClampedArray');
  assert.ok(validSha1.test(hash(new Uint8Array([1,2,3,4]).buffer)), 'hashes ArrayBuffer');
});
}

if (typeof Map !== 'undefined') {
it("Maps can be hashed", function() {
  var map = new Map([['a',1],['b',2]]);
  assert.ok(validSha1.test(hash(map)), 'hashes Maps');
});
}

if (typeof WeakMap !== 'undefined') {
it("WeakMaps can’t be hashed", function() {
  var map = new WeakMap([[{foo: 'bar'},1]]);
  assert.throws(function() {
    validSha1.test(hash(map))
  }, 'does not hash WeakMaps');
});
}

if (typeof Set !== 'undefined') {
it("Sets can be hashed", function() {
  var set = new Set(['you', 'du', 'tu', 'あなた', '您']);
  assert.ok(validSha1.test(hash(set)), 'hashes Sets');
});
}

if (typeof WeakSet !== 'undefined') {
it("WeakSets can’t be hashed", function() {
  var obj = {foo: 'bar'};
  var set = new WeakSet([obj]);
  assert.throws(function() {
    validSha1.test(hash(set))
  }, 'does not hash WeakSets');
});
}

it('Distinguish functions based on their properties', function() {

  var a, b, c, d;
  function Foo() {}
  a = hash(Foo);

  Foo.foo = 22;
  b = hash(Foo);

  Foo.bar = "42";
  c = hash(Foo);

  Foo.foo = "22";
  d = hash(Foo);

  assert.notEqual(a,b, 'adding a property changes the hash');
  assert.notEqual(b,c, 'adding another property changes the hash');
  assert.notEqual(c,d, 'changing a property changes the hash');
});

it('respectFunctionProperties = false', function() {

  var a, b;
  function Foo() {}
  a = hash(Foo, {respectFunctionProperties: false});

  Foo.foo = 22;
  b = hash(Foo, {respectFunctionProperties: false});

  assert.equal(a,b, 'function properties are ignored');
});

it('Distinguish functions based on prototype properties', function() {

  var a, b, c, d;
  function Foo() {}
  a = hash(Foo);

  Foo.prototype.foo = 22;
  b = hash(Foo);

  Foo.prototype.bar = "42";
  c = hash(Foo);

  Foo.prototype.foo = "22";
  d = hash(Foo);

  assert.notEqual(a,b, 'adding a property to the prototype changes the hash');
  assert.notEqual(b,c, 'adding another property to the prototype changes the hash');
  assert.notEqual(c,d, 'changing a property in the prototype changes the hash');
});

it('Distinguish objects based on their type', function() {

  function Foo() {}
  function Bar() {}

  var f = new Foo(), b = new Bar();

  assert.notEqual(hash(Foo), hash(Bar), 'Functions with different names should produce a different Hash.');
  assert.notEqual(hash(f), hash(b), 'Objects with different constructor should have a different Hash.');
});

it('respectType = false', function() {
  var opt = { respectType: false };


  function Foo() {}
  function Bar() {}

  var f = new Foo(), b = new Bar();
  assert.equal(hash(f, opt), hash(b, opt), 'Hashing should disregard the different constructor');


  var ha, hb;
  function F() {}
  ha = hash(F, opt);

  F.prototype.meaningOfLife = 42;
  hb = hash(F, opt);

  assert.equal(ha, hb, 'Hashing should disregard changes in the function\'s prototype');
});

});
