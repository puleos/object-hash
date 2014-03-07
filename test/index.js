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
  var func = function(a){ return a+1; };
  assert.ok(validSha1.test(hash('Shazbot!')), 'hash string');
  assert.ok(validSha1.test(hash(42)), 'hash number');
  assert.ok(validSha1.test(hash(true)), 'hash bool');
  assert.ok(validSha1.test(hash(func)), 'hash function');
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

// TODO, test arrays, nesting, and edge cases.