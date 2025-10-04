const crypto = require('crypto');

function randomToken(bytes = 32){
  // Base64url bez znaków +/=
  return crypto.randomBytes(bytes).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}

module.exports = { randomToken };
