var test = require('tape');
var hash = require('../index');
var validSha1 = /^[0-9a-f]{40}$/i;

test('throws when no arguments are passed', function (assert) {
  assert.plan(1);
  assert.throws(hash);
});

test('validates algo if provided', function(assert){
  assert.plan(1);
  assert.throws(function(){
    hash({foo: 'bar'}, 'baz');
  });
});

test('handles non-object types', function(assert){
  assert.plan(4);
  var func = function(a){ return a+1; };
  assert.ok(validSha1.test(hash('Shazbot!')), 'hash string');
  assert.ok(validSha1.test(hash(42)), 'hash number');
  assert.ok(validSha1.test(hash(true)), 'hash bool');
  assert.ok(validSha1.test(hash(func)), 'hash function');
});