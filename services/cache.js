const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisUrl);
// Promisifying the client.hget and client.hset functions
client.hget = util.promisify(client.hget);
// client.hset = util.promisify(client.hset);

// Storing reference to the original exec function
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  // Setting this property on every query
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || '');
  // This statement makes sure that this function is chainable
  return this;
};

// Overriding exec (implementing caching logic here because exec is the end method that is called after a query is formed by mongoose, so just before executing the query in db we'll implement caching logic)
mongoose.Query.prototype.exec = async function () {
  // Checking whether we want to cache this query or not
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  // Customizations
  // Doing this so that the object returned from getQuery() is not changed
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // See if we have a value for the key in Redis, if yes return that
  const cacheValue = await client.hget(this.hashKey, key);

  if (cacheValue) {
    // Convert to mongoose document (model instance) before returning
    const doc = JSON.parse(cacheValue);
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  // If no, call the query and store in Redis cache and return
  // Calling the original exec
  const result = await exec.apply(this, arguments);
  // Note that this result is not JSON, it's a mongoose document (model instances), so convert to JSON and store in Redis (exec function returns a mongoose model)
  client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
