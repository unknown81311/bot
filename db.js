const Redis = require("ioredis");
const redis = new Redis({
        port: 6379, // Redis port
        host: "localhost", // Redis host
        user: "default",
        password: process.env['password'],
        timeout: 200
});

module.exports = {
  get: async (key) =>{
        const data = await redis.get(key);
        console.log(data,typeof data);
        return data ? JSON.parse(data) : undefined;
  },
  set: async (key, value) => {
          const data = JSON.stringify(value)
          console.log(data,typeof data)
          await redis.set(key, data)
  }
}
