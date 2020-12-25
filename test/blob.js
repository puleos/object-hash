'use strict';

var assert = require('assert');
var hash = require('../index');

if (typeof Blob !== 'undefined') {
describe('hash()ing Blob objects', function() {
  var blob;
  before('create blob', function() {
    try {
      blob = new Blob(['ABC']);
    } catch(e) {
      // https://github.com/ariya/phantomjs/issues/11013
      if (!e.message.match(/'\[object BlobConstructor\]' is not a constructor/)) {
        throw e;
      }

      var builder = new WebKitBlobBuilder();
      builder.append('ABC');
      blob = builder.getBlob();
    }
  });

  it('should throw when trying to hash a blob', function() {
    assert.throws(function() {
      hash(blob);
    }, /not supported/);

    assert.throws(function() {
      hash({abcdef: blob});
    }, /not supported/);
  });

  it('should not throw when trying to hash a blob with ignoreUnknown', function() {
    var opt = {ignoreUnknown: true};

    assert.ok(validSha1.test(hash(blob, opt)), 'ignore Blob');
    assert.ok(validSha1.test(hash({abcdef: blob}, opt)), 'ignore Blob');
  });
});

if (typeof File !== 'undefined') {
describe('hashing Blob() objects', function() {
  var file;
  it('should hash the same file the same way', function() {
    var hash1 = hash(new File(new Uint8Array([1,2,3]), 'foo', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    var hash2 = hash(new File(new Uint8Array([1,2,3]), 'foo', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    assert.strictEqual(hash1, hash2);
    assert.ok(validSha1.test(hash1));
  });
  it('should hash different files differently', function() {
    var hash1 = hash(new File(new Uint8Array([1,2,3]), 'foo', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    var hash2 = hash(new File(new Uint8Array([1,2,3]), 'bar', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    assert.notStrictEqual(hash1, hash2);
    assert.ok(validSha1.test(hash1));
  });
  it('should ignore file content', function() {
    var hash1 = hash(new File(new Uint8Array([1,2,4]), 'foo', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    var hash2 = hash(new File(new Uint8Array([1,2,3]), 'bar', {
      type: 'application/octet-stream',
      lastModified: 100000
    }));
    assert.strictEqual(hash1, hash2);
    assert.ok(validSha1.test(hash1));
  });
});
}
}
