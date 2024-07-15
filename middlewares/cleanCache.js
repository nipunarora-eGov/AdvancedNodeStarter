const { clearHash } = require('../services/cache');

module.exports = async (req, res, next) => {
  //let the route handler do everything it wants then bring execution here
  //doing this because we want to clear cache only when blogpost or any resource is created/updated successfully
  await next();

  clearHash(req.user.id);
};
