import { FileSystem } from 'filer/src';
import * as _ from 'lodash';

// Used to define IndexedDB version.
// Filer does not pass the version option, so shim the indexedDB.open function.
if (!navigator.userAgent.includes('Trident/')) {
  const BrowserIndexedDB = window.indexedDB ||
  window['mozIndexedDB'] ||
  window['webkitIndexedDB'] ||
  window['msIndexedDB'];

  const indexedDBVersion = '2.0';
  const $open = BrowserIndexedDB.open;
  BrowserIndexedDB.open = (name) => {
    return $open.apply(BrowserIndexedDB, [name, indexedDBVersion]);
  };
}

/**
 * A simple in-memory key/value cache.
 */
class MemoryCache {

  // The cache
  private cache = {};

  /**
   * Creates memory cache.
   * @param name the cache name
   */
  constructor(public name: string) { }

  /**
   * Get value form memory cache.
   * @param key the key
   * @return value
   */
  get(key) {
    return this.cache[key];
  }

  /**
   * Put value into memory cache.
   * @param key the key
   * @param value the key
   */
  put(key, value) {
    this.cache[key] = value;
  }

  /**
   * Delete value form memory cache.
   * @param key the key
   */
  delete(key) {
    delete this.cache[key];
  }

  /**
   * Clear memory cache.
   */
  clear() {
    this.cache = {};
  }
}

// Pool of memory cache
export const MemoryPool: { [key: string]: MemoryCache } = {};

/**
 * Create memory cache.
 * @param name the cache name
 */
function createMemoryCache(name: string) {
  if (!MemoryPool[name]) {
    MemoryPool[name] = new MemoryCache(name);
  }
  return MemoryPool[name];
}

/**
 * For each call of fs operation (like readFile/writeFile/readdir/mkdir), a new context will be created.
 * This context adds a cache layer in front of IndexedDB to speed read operations.
 * For write operations, write-through strategy is used to ensure data updates are safely stored on.
 */
class CacheStorageContext {

  /**
   * Flag indicates whether this context is close.
   */
  private closed;

  /**
   * Creates the context.
   * @param indexedDB the IndexedDB storage
   * @param memoryCache the memory cache
   */
  constructor(private indexedDB, private memoryCache: MemoryCache) { }

  /**
   * Mark this context finished.
   */
  finish() {
    this.closed = true;
  }

  /**
   * Call IndexedDB.
   * @param method the method name to call
   * @param args the arguments of the method
   * @param callback the callback
   */
  private callIndexedDB(method, args, callback) {
    if (this.closed) {
      return setImmediate(callback(new Error('Context closed')));
    }

    this.indexedDB.getReadWriteContext()[method](...args, (_err, result) => {
      setImmediate(() => callback(_err, result));
    });
  }

  /**
   * Read cache, if not present call IndexedDB.
   * @param key the key of cache
   * @param method the IndexedDB method name to call
   * @param callback the callback
   */
  private readCache(key, method, callback) {
    const _memoryCache = this.memoryCache;

    const cache = _memoryCache.get(key);
    if (cache) {
      // Hit cache, return immediately
      setImmediate(() => {
        callback(null, _memoryCache.get(key));
      });
    } else {
      // Call IndexedDB
      this.callIndexedDB(method, [key], (err, result) => {
        if (!err && result) {
          _memoryCache.put(key, result);
        }
        callback(err, result);
      });
    }
  }

  /**
   * Get object.
   * @param key the key of object
   * @param callback the callback
   */
  getObject(key, callback) {
    this.readCache(key, 'getObject', callback);
  }

  /**
   * Get object.
   * @param key the key of buffer
   * @param callback the callback
   */
  getBuffer(key, callback) {
    this.readCache(key, 'getBuffer', callback);
  }

  /**
   * Put object.
   * @param key the key of object
   * @param value the value of object
   * @param callback the callback
   */
  putObject(key, value, callback) {
    const _memoryCache = this.memoryCache;
    this.callIndexedDB('putObject', [key, value], (err, result) => {
      if (!err) {
        _memoryCache.put(key, value);
      }
      callback(err, result);
    });
  }

  /**
   * Put buffer.
   * @param key the key of buffer
   * @param value the value of buffer
   * @param callback the callback
   */
  putBuffer(key, value, callback) {
    const _memoryCache = this.memoryCache;
    this.callIndexedDB('putBuffer', [key, value], (err, result) => {
      if (!err) {
        _memoryCache.put(key, value);
      }
      callback(err, result);
    });
  }

  /**
   * Delete object/buffer.
   * @param key the key to delete
   * @param callback the callback
   */
  delete(key, callback) {
    const _memoryCache = this.memoryCache;
    this.callIndexedDB('delete', [key], (err, result) => {
      if (!err) {
        _memoryCache.delete(key);
      }
      callback(err, result);
    });
  }
}

/**
 * The storage use IndexedDB as underlying storage and provides an in-memory cached layer for performance.
 */
export class CacheStorage {

  /**
   * The underlying IndexedDB storage.
   */
  private indexedDB: FileSystem.providers.IndexedDB;

  /**
   * The memory cache.
   */
  private memoryCache: MemoryCache;

  /**
   * Creates storage.
   * @param name the storage name.
   */
  constructor(private name: string) { }

  /**
   * Open the storage.
   * @param callback the callback function
   */
  open(callback) {
    // Create memory cache
    this.memoryCache = createMemoryCache(this.name);

    // Create IndexedDB
    this.indexedDB = new FileSystem.providers.IndexedDB(this.name);

    // Open IndexedDB
    this.indexedDB.open(callback);
  }

  /**
   * Get read/write context.
   * @return read/write context
   */
  getReadWriteContext() {
    return new CacheStorageContext(this.indexedDB, this.memoryCache);
  }
}
