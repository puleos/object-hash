var assert = require('assert');
var hash = require('../index');
var obj1 = {foo: {bar: true, bax: 1}};
var obj2 = {foo: {bar: true, bax: 1}};
var obj3 = {foo: {bar: false, bax: 1}};

describe('HashTable', function() {
it('construct a new HashTable', function() {
  var hashTable = new hash.HashTable();
  assert.deepEqual(hashTable.table(), {}, 'empty hash table');
  assert.strictEqual(typeof hashTable.add, 'function', 'add method');
  assert.strictEqual(typeof hashTable.toArray, 'function', 'toArray method');
  assert.strictEqual(typeof hashTable.reset, 'function', 'reset method');
  assert.strictEqual(typeof hashTable.getValue, 'function', 'getValue method');
  assert.strictEqual(typeof hashTable.getCount, 'function', 'getCount method');
  assert.strictEqual(typeof hashTable.hasKey, 'function', 'hasKey method');
});

it('.add() should add entries to the table', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);

  hashTable.add(obj1);
  hashTable.add(obj2);
  hashTable.add(obj3);

  assert.deepEqual(obj1, hashTable.table()[hash1].value, 'obj1 value equal');
  assert.deepEqual(obj2, hashTable.table()[hash1].value, 'obj2 value equal');
  assert.deepEqual(obj3, hashTable.table()[hash3].value, 'obj3 value equal');

  assert.deepEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.deepEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

it('.add() should support an array of objects', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);

  hashTable.add([obj1, obj2, obj3]);
  assert.strictEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.strictEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

it('.add() should support a series of objects', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);

  hashTable.add(obj1, obj2, obj3);
  assert.strictEqual(hashTable._table[hash1].count, 2, 'hash1 count = 2');
  assert.strictEqual(hashTable._table[hash3].count, 1, 'hash3 count = 1');
});

it('.getValue() should return the proper object', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);

  hashTable.add(obj1, obj2, obj3);
  assert.deepEqual(hashTable.getValue(hash1), obj1, 'obj1 = value');
  assert.deepEqual(hashTable.getValue('XXXXXXXX'), undefined, 'undef ok');
});

it('.getCount() should return the proper count', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);

  hashTable.add(obj1, obj2, obj3);
  assert.strictEqual(hashTable.getCount(hash1), 2, 'should equal 2');
  // if a hash does not exist in the table it's count should be 0
  assert.strictEqual(hashTable.getCount('XXXXXX'), 0, 'should equal 0');
});

it('.hasKey() should return a boolean', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);

  hashTable.add(obj1, obj2, obj3);
  assert.ok(hashTable.hasKey(hash1), 'should be true');
  assert.strictEqual(hashTable.hasKey('XXXXXXXXXXXX'), false, 'should be false');
});

it('.toArray() should return an array of the hash table contents', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);
  var arr = [{hash: hash1, count: 2, value: {foo: {bar: true, bax: 1}}},
    {hash: hash3, count: 1, value: {foo: {bar: false, bax: 1}}}];

  hashTable.add(obj1, obj2, obj3);
  assert.deepEqual(hashTable.toArray(), arr, 'should be equal');
});

it('.reset() should clear the hashTable', function() {
  var hashTable = new hash.HashTable();

  hashTable.add(obj1, obj2, obj3);
  hashTable.reset();
  assert.deepEqual(hashTable.table(), {}, 'should be empty');
});


it('.remove() should decrement count', function() {
  var hashTable = new hash.HashTable();
  var hash1 = hash(obj1);
  var hash3 = hash(obj3);

  hashTable.add(obj1, obj3);
  hashTable.add(obj1);
  hashTable.remove(obj1, obj3);

  assert.strictEqual(hashTable.getCount(hash1), 1, 'hash1 count = 1');
  assert.strictEqual(hashTable.getCount(hash3), 0, 'hash3 count = 0');
  assert.strictEqual(hashTable.hasKey(hash3), false, 'hash3 key is gone');
  
});
});
