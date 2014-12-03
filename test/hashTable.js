var test = require('tape');
var hash = require('../index');
var obj1 = {foo: {bar: true, bax: 1}};
var obj2 = {foo: {bar: true, bax: 1}};
var obj3 = {foo: {bar: false, bax: 1}};

test('construct a new HashTable', function(assert) {
  var hashTable = new hash.HashTable();
  assert.plan(7);
  assert.looseEqual(hashTable.table(), {}, 'empty hash table');
  assert.equal(typeof hashTable.add, 'function', 'add method');
  assert.equal(typeof hashTable.toArray, 'function', 'toArray method');
  assert.equal(typeof hashTable.reset, 'function', 'reset method');
  assert.equal(typeof hashTable.getValue, 'function', 'getValue method');
  assert.equal(typeof hashTable.getCount, 'function', 'getCount method');
  assert.equal(typeof hashTable.hasKey, 'function', 'hasKey method');
});

test('.add() should add entries to the table', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  assert.plan(5);

  hashTable.add(obj1);
  hashTable.add(obj2);
  hashTable.add(obj3);

  assert.looseEqual(obj1, hashTable.table()[hash1].value, 'obj1 value equal');
  assert.looseEqual(obj2, hashTable.table()[hash1].value, 'obj2 value equal');
  assert.looseEqual(obj3, hashTable.table()[hash3].value, 'obj3 value equal');

  assert.looseEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.looseEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

test('.add() should support an array of objects', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  assert.plan(2);

  hashTable.add([obj1, obj2, obj3]);
  assert.looseEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.looseEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

test('.add() should support a series of objects', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  assert.plan(2);

  hashTable.add(obj1, obj2, obj3);
  assert.looseEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.looseEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

test('.getValue() should return the proper object', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  assert.plan(2);

  hashTable.add(obj1, obj2, obj3);
  assert.looseEqual(hashTable.getValue(hash1), obj1, 'obj1 = value');
  assert.equal(hashTable.getValue('XXXXXXXX'), undefined, 'undef ok');
});

test('.getCount() should return the proper count', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  assert.plan(2);

  hashTable.add(obj1, obj2, obj3);
  assert.equal(hashTable.getCount(hash1), 2, 'should equal 2');
  // if a hash does not exist in the table it's count should be 0
  assert.equal(hashTable.getCount('XXXXXX'), 0, 'should equal 0');
});

test('.hasKey() should return a boolean', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  assert.plan(2);

  hashTable.add(obj1, obj2, obj3);
  assert.ok(hashTable.hasKey(hash1), 'should be true');
  assert.equal(hashTable.hasKey('XXXXXXXXXXXX'), false, 'should be false');
});

test('.toArray() should return an array of the hash table contents', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  var arr = [{hash: hash1, count: 2, value: {foo: {bar: true, bax: 1}}},
    {hash: hash3, count: 1, value: {foo: {bar: false, bax: 1}}}];
  
  assert.plan(1);

  hashTable.add(obj1, obj2, obj3);
  assert.looseEqual(hashTable.toArray(), arr, 'should be equal');
});

test('.reset() should clear the hashTable', function(assert){
  var hashTable = new hash.HashTable();
  assert.plan(1);

  hashTable.add(obj1, obj2, obj3);
  hashTable.reset();
  assert.looseEqual(hashTable.table(), {}, 'should be empty');
});


test('.remove() should decrement count', function(assert){
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  assert.plan(3);

  hashTable.add(obj1, obj3);
  hashTable.add(obj1);
  hashTable.remove(obj1, obj3);

  assert.equal(hashTable.getCount(hash1), 1, 'hash1 count = 1');
  assert.equal(hashTable.getCount(hash3), 0, 'hash3 count = 0');
  assert.equal(hashTable.hasKey(hash3), false, 'hash3 key is gone');
  
});
