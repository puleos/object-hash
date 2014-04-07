var test = require('tape');
var hash = require('../index');
var validSha1 = /^[0-9a-f]{40}$/i;

test('throws when nothing to hash', function (assert) {
  assert.plan(2);
  assert.throws(hash, 'no arguments');
  assert.throws(function(){
    hash(undefined, {algorithm: 'md5'});
  }, 'undefined');
});

test('throws when passed an invalid options', function(assert){
  assert.plan(2);
  assert.throws(function(){
    hash({foo: 'bar'}, {algorithm: 'shalala'});
  }, 'bad algorithm');
  assert.throws(function(){
    hash({foo: 'bar'}, {encoding: 'base16'});
  }, 'bad encoding');
});

test('hashes non-object types', function(assert){
  assert.plan(4);
  var func = function(a){ return a + 1; };
  assert.ok(validSha1.test(hash('Shazbot!')), 'hash string');
  assert.ok(validSha1.test(hash(42)), 'hash number');
  assert.ok(validSha1.test(hash(true)), 'hash bool');
  assert.ok(validSha1.test(hash(func)), 'hash function');
});

test('hashes special object types', function(assert){
  assert.plan(8);
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
});

test('hashes a simple object', function(assert){
  assert.plan(1);
  assert.ok(validSha1.test(hash({foo: 'bar', bar: 'baz'})), 'hash object');
});

test('hashes identical objects with different key ordering', function(assert){
  assert.plan(2);
  var hash1 = hash({foo: 'bar', bar: 'baz'});
  var hash2 = hash({bar: 'baz', foo: 'bar'});
  var hash3 = hash({bar: 'foo', foo: 'baz'});
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});

test('only hashes object keys when excludeValues option is set', function(assert){
  assert.plan(2);
  var hash1 = hash({foo: false, bar: 'OK'}, { excludeValues: true });
  var hash2 = hash({foo: true, bar: 'NO'}, { excludeValues: true });
  var hash3 = hash({foo: true, bar: 'OK', baz: false}, { excludeValues: true });
  assert.equal(hash1, hash2, 'values not in hash digest');
  assert.notEqual(hash1, hash3, 'different keys not equal');
});

test('array values are hashed', function(assert){
  assert.plan(1);
  var hash1 = hash({foo: ['bar', 'baz'], bax: true });
  var hash2 = hash({foo: ['baz', 'bar'], bax: true });
  assert.notEqual(hash1, hash2, 'different array orders are unique');
});

test('nested object values are hashed', function(assert){
  assert.plan(2);
  var hash1 = hash({foo: {bar: true, bax: 1}});
  var hash2 = hash({foo: {bar: true, bax: 1}});
  var hash3 = hash({foo: {bar: false, bax: 1}});
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});

test('sugar methods should be equivalent', function(assert){
  assert.plan(3);
  var obj = {foo: 'bar', baz: true};
  assert.equal(hash.keys(obj), hash(obj, {excludeValues: true}), 'keys');
  assert.equal(hash.MD5(obj), hash(obj, {algorithm: 'md5'}), 'md5');
  assert.equal(hash.keysMD5(obj),
    hash(obj, {algorithm: 'md5', excludeValues: true}), 'keys md5');
});


test('array of nested object values are hashed', function(assert){
  assert.plan(2);
  var hash1 = hash({foo: [ {bar: true, bax: 1}, {bar: false, bax: 2} ] });
  var hash2 = hash({foo: [ {bar: true, bax: 1}, {bar: false, bax: 2} ] });
  var hash3 = hash({foo: [ {bar: false, bax: 2} ] });
  assert.equal(hash1, hash2, 'hashes are equal');
  assert.notEqual(hash1, hash3, 'different objects not equal');
});
