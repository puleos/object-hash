var test = require('tape');
var hash = require('../index');

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