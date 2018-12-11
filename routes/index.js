var express = require('express');
var router = express.Router();
const co = require('co');
const jwtDecode = require('jwt-decode');
const rp = require('request-promise');

const ba = require('blockapps-rest');
const rest = ba.rest6;
const common = ba.common;
const oauthConfig = common.config.oauth;

const APP_TOKEN_COOKIE_NAME = oauthConfig.appTokenCookieName;

router.get('/', validateCookie(), async function(req, res, next) {
  res.render('index');
});

router.get('/login', function (req, res, next) {
  if (!req.cookies[APP_TOKEN_COOKIE_NAME]) {
    try {
      const authorizationUri = req.app.oauth.oauthGetSigninURL();
      res.redirect(authorizationUri);
    } catch (error) {
      console.error('Authorization Uri Error', error.message);
      res.status(500).send('something went wrong with authorization uri: ' + error);
    }
  } else {
    res.redirect('/');
  }
});

router.get('/callback', async function(req, res, next) {
  try {
    const code = req.query['code'];
    const tokensResponse = await req.app.oauth.oauthGetAccessTokenByAuthCode(code);
    const accessToken = tokensResponse.token['access_token'];
    const refreshToken = tokensResponse.token['refresh_token'];

    const decodedToken = jwtDecode(accessToken);
    const accessTokenExpiration = decodedToken['exp'];

    res.cookie(req.app.oauth.getCookieNameAccessToken(), accessToken, {maxAge: oauthConfig['appTokenCookieMaxAge'], httpOnly: true});
    res.cookie(req.app.oauth.getCookieNameAccessTokenExpiry(), accessTokenExpiration, {maxAge: oauthConfig['appTokenCookieMaxAge'], httpOnly: true});
    res.cookie(req.app.oauth.getCookieNameRefreshToken(), refreshToken, {maxAge: oauthConfig['appTokenCookieMaxAge'], httpOnly: true});
    res.redirect('/');
  } catch (error) {
    console.error('Access Token Error', error.message);
    res.status(500).send('something went wrong with oauth: ' + error);
  }
});

router.get('/create-key', validateCookie(), function(req, res, next) {
  // TODO: switch to async/await in rest.createKey()
  co(function*() {
    let createKeyResponse;
    // Calling the OAUTH JWT secured API endpoint
    try {
      createKeyResponse = yield rest.createKey(req.accessToken);
    } catch(error) {
      if (error.statusCode === 400) {
        res.status(400).send(error.message)
      } else {
        console.warn('key create error', error.message);
        res.status(500).send('something went wrong with POST /key request: ' + error);
      }
      return // do not execute faucet step
    }

    try {
      yield rp({
        uri: `${oauthConfig.stratoUrl}/bloc/v2.2/users/whatever/${createKeyResponse.address}/fill?resolve=`,
        method: 'POST',
      });
      res.send(`Key and address (${createKeyResponse.address}) were created. Address was "fauceted"`);
    } catch(error) {
      console.warn('faucet error', error.message);
      res.status(500).send('something went wrong with faucet request: ' + error);
    }
  })
});

router.get('/get-key', validateCookie(), function(req, res, next) {
  // TODO: switch to async/await in rest.getKey()
  co(function*() {
    // Calling the OAUTH JWT secured API endpoint
    try {
      const getKeyResponse = yield rest.getKey(req.accessToken);
      res.json(JSON.stringify(getKeyResponse));
    } catch(error) {
      console.warn('get address error', error.message);
      res.status(error.status).send(error.message)
    }
  })
});

router.post('/transfer', validateCookie(), function(req, res, next) {
  // TODO: switch to async/await in rest.sendTransactions()
  co(function*() {
    const addressTo = req.body.addressTo;
    const transferWei = req.body.transferWei;

    try {
      const stratoResponse = yield rest.sendTransactions(req.accessToken,
        [{
          payload: {
            toAddress: `${addressTo}`,
            value: transferWei+""
          },
          type: "TRANSFER"
        }], false);
      res.json(JSON.stringify({result: stratoResponse}));
    } catch(error) {
      console.warn('transaction error', error.message);
      res.status(500).send('something went wrong with POST /transaction: ' + error);
    }
  })
});

function validateCookie(req, res, next) {
  return async function (req, res, next) {
    if (!req.cookies[APP_TOKEN_COOKIE_NAME]) {
      res.redirect('/login');
    }
    else {
      const accessToken = req.cookies[req.app.oauth.getCookieNameAccessToken()];

      if (!accessToken) {
        util.response.status('401', res, {loginUrl: req.app.oauth.oauthGetSigninURL()});
      } else {
        try {
          // Not verifying JWT signature here since it is verified on STRATO side with each API call
          await req.app.oauth.validateAndGetNewToken(req, res);
        } catch (err) {
          return res.status(401).send('access token is invalid')
        }
        req.accessToken = accessToken;
        return next();
      }
    }
  }
}


router.get('/logout', function(req, res, next) {
  // log out and clean cookies
  const logOutUrl = req.app.oauth.getLogOutUrl();
  res.clearCookie(req.app.oauth.getCookieNameAccessToken());
  res.clearCookie(req.app.oauth.getCookieNameAccessTokenExpiry());
  res.clearCookie(req.app.oauth.getCookieNameRefreshToken());
  res.redirect(logOutUrl);
});

module.exports = router;
