const Redis = require("ioredis");
const redis = new Redis({
        port: 6379, // Redis port
        host: "localhost", // Redis host
        user: "default",
        password: process.env['password'],
        timeout: 200
});

module.exports = {
  get: async (key) =>
    JSON.parse(await redis.get(key)),
  set: (key, value) => redis.set(key, JSON.stringify(value))
}
