var express = require('express');
var router = express.Router();

const ba = require('blockapps-rest');
const rest = ba.rest;
const common = ba.common;
const oauth = common.oauth;
const oauthConfig = common.config.oauth;

const co = require('co');

const rp = require('request-promise');

const APP_TOKEN_COOKIE_NAME = oauthConfig.appTokenCookieName;

router.get('/', validateCookie(), async function(req, res, next) {
  res.render('index');
});

router.get('/login', function(req, res, next) {
  co(function*() {
      if (!req.cookies[oauthConfig.APP_TOKEN_COOKIE_NAME]) {
        try {
          const authorizationUri = oauth.oauthGetSigninURL();
          res.redirect(authorizationUri);
        } catch (error) {
          console.error('Authorization Uri Error', error.message);
          res.status(500).send('something went wrong with authorization uri: ' + error);
        }
      } else {
        res.redirect('/');
      }
    }
  )}
);

router.get('/callback', function(req, res, next) {
  co(function*() {
    try {
      // Get the access token object (the authorization code is given from the previous step) and save the access token
      const accessTokenResponse = yield oauth.oauthGetAccessTokenByAuthCode(req.query['code']);

      // We can encrypt the access_token before setting it as a cookie for client for additional security
      res.cookie(APP_TOKEN_COOKIE_NAME, accessTokenResponse.token['access_token'], { maxAge: 900000, httpOnly: true });
      res.redirect('/');
    } catch (error) {
      console.error('Access Token Error', error.message);
      res.status(500).send('something went wrong with oauth: ' + error);
    }
  })
});

router.get('/create-key', validateCookie(), function(req, res, next) {
  co(function*() {
    let createKeyResponse;
    // Calling the OAUTH JWT secured API endpoint
    try {
      createKeyResponse = yield rest.createKey(req.access_token);
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
  co(function*() {
    // Calling the OAUTH JWT secured API endpoint
    try {
      const getKeyResponse = yield rest.getKey(req.access_token);
      res.json(JSON.stringify(getKeyResponse));
    } catch(error) {
      console.warn('get address error', error.message);
      res.status(500).send('something went wrong with GET /key request: ' + error);
    }
  })
});

router.post('/transfer', validateCookie(), function(req, res, next) {
  co(function*() {
    const addressFrom = req.body.addressFrom;
    const addressTo = req.body.addressTo;
    const transferWei = req.body.transferWei;

    try {
      const stratoResponse = yield rest.sendTransactions(req.access_token, addressFrom, 
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
  return function (req, res, next) {
    if (!req.cookies[APP_TOKEN_COOKIE_NAME]) {
      res.redirect('/login');
    } 
    else {
      try {
        // validate JWT
        oauth.validateRequest(req, res, next);
        // check if token is outdated and refresh from OAUTH Provider if needed
        // oauth.oauthRefreshToken(req.access_token);
      }
      catch(error) {
        console.warn('token validation error', error.message);
      }
    }
  }
}


router.get('/logout', function(req, res, next) {
  // NOT THE ACTUAL LOGOUT - only cleans app's cookie, not the oauth provider's cookie so client will be logged in again
  // TODO: call logout endpoint of oauth provider here
  res.clearCookie(APP_TOKEN_COOKIE_NAME);
  res.status(200);
  res.send('logged out');
});

module.exports = router;
