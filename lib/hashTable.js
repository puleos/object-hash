'use strict';
var hasher = require('../index');

/**
 * Setup a HashTable instance with options
 * Options:
 *
 *  - `algorithm` hash algo to be used by this instance: *'sha1', 'md5' 
 *  - `excludeValues` {true|*false} hash object keys, values ignored 
 *  - `encoding` hash encoding, supports 'buffer', '*hex', 'binary', 'base64' 
 *  * = default
 *
 * @param options
 * @api public
 */
exports = module.exports = HashTable;

function HashTable(options){
  options = options || {};
  this.options = options;
  this._table = {};
}

HashTable.prototype.add = function(/* values to be added */){
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  args.forEach(function(obj){
    if(Object.prototype.toString.call(obj) === '[object Array]'){
      obj.forEach(function(val){
        self._addObject(val);
      });
    }else{
      self._addObject(obj);
    }
  });
  
  return this;
};

HashTable.prototype.remove = function(/* values to be removed */){
  var self = this;
  var args = Array.prototype.slice.call(arguments, 0);
  args.forEach(function(obj){
    if(Object.prototype.toString.call(obj) === '[object Array]'){
      obj.forEach(function(val){
        self._removeObject(val);
      });
    }else{
      self._removeObject(obj);
    }
  });
  
  return this;
};

HashTable.prototype._removeObject = function(object){
  var hash = hasher(object, this.options),
      count = this.getCount(hash);
  if(count<=1) {
    delete this._table[hash];
  } else {
    this._table[hash].count = count-1;
  }
};

HashTable.prototype._addObject = function(object){
  var hash = hasher(object, this.options);

  if(this._table[hash]){
    this._table[hash].count++;
    if(this.options.excludeValues){
      this._table[hash].value.push(object);
    }
  }else{
    this._table[hash] = {
      value: this.options.excludeValues ? [object] : object,
      count: 1
    }; 
  }
};

HashTable.prototype.hasKey = function(key){
  return !!(this._table[key]);
};

HashTable.prototype.getValue = function(key){
  return this._table[key] ? this._table[key].value : undefined;
};

HashTable.prototype.getCount = function(key){
  return this._table[key] ? this._table[key].count : 0;
};

HashTable.prototype.table = function(){
  return this._table;
};

HashTable.prototype.toArray = function(){
  var keys = Object.keys(this._table);
  var arr = [];
  for(var i = 0;i < keys.length;i++){
    arr.push({
      value: this._table[keys[i]].value,
      count: this._table[keys[i]].count,
      hash: keys[i] 
    });
  }
  return arr;
};

HashTable.prototype.reset = function(){
  this._table = {};
  return this;
};
