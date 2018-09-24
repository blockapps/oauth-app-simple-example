var express = require('express');
var router = express.Router();

const ba = require('blockapps-rest');
const rest = ba.rest;

const co = require('co');

const rp = require('request-promise');

const config = require('../config');

const APP_TOKEN_COOKIE_NAME = config['APP_TOKEN_COOKIE_NAME'];
const STRATO_URL = config['STRATO_URL'];
const CLIENT_ID = config['CLIENT_ID'];
const CLIENT_SECRET = config['CLIENT_SECRET'];
const OAUTH_PATHS = config['OAUTH_PATHS'];


// Set the configuration settings, see https://www.npmjs.com/package/simple-oauth2 for details
const credentials = {
  client: {
    id: CLIENT_ID,
    secret: CLIENT_SECRET
  },
  auth: {
    // TODO: call /v2.0/.well-known/openid-configuration discovery endpoint to get all oauth paths automatically to fill this object;
    tokenHost: OAUTH_PATHS['TOKEN_HOST'],
    tokenPath: OAUTH_PATHS['TOKEN_PATH'],
    // revokePath: '',
    authorizePath: OAUTH_PATHS['AUTHORIZE_PATH'],
  }
};
const oauth2 = require('simple-oauth2').create(credentials);

router.get('/', validateCookie(), async function(req, res, next) {
  res.render('index');
});

router.get('/login', function(req, res, next) {
  co(function*() {
      if (!req.cookies[APP_TOKEN_COOKIE_NAME]) {
        try {
          const authorizationUri = rest.oauthGetSigninURL();
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
      const accessTokenResponse = yield rest.oauthGetAccessTokenByAuthCode(req.query['code']);

      // We can encrypt the access_token before setting it as a cookie for client for additional security
      res.cookie(APP_TOKEN_COOKIE_NAME, accessTokenResponse.token['access_token'], { maxAge: 900000, httpOnly: true });
      res.redirect('/');
    } catch (error) {
      console.error('Access Token Error', error.message);
      res.status(500).send('something went wrong with oauth: ' + error);
    }
  })
});

router.get('/create-key', validateCookie(), async function(req, res, next) {
  let createKeyResponse;
  // Calling the OAUTH JWT secured API endpoint
  try {
    createKeyResponse = await rp({
      uri: `${STRATO_URL}/strato/v2.3/key`,
      method: 'POST',
      headers: {'Authorization': `Bearer ${req.access_token}`},
      json: true
    });
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
    await rp({
      uri: `${STRATO_URL}/bloc/v2.2/users/whatever/${createKeyResponse.address}/fill?resolve=`,
      method: 'POST',
    });
    res.send(`Key and address (${createKeyResponse.address}) were created. Address was "fauceted"`);
  } catch(error) {
    console.warn('faucet error', error.message);
    res.status(500).send('something went wrong with faucet request: ' + error);
  }
});

router.get('/get-key', validateCookie(), function(req, res, next) {
  co(function*() {
    // Calling the OAUTH JWT secured API endpoint
    try {
      const getKeyResponse = yield rest.getKey(req.access_token);
      // const getKeyResponse = await rp({
      //   uri: `${STRATO_URL}/strato/v2.3/key`,
      //   method: 'GET',
      //   headers: {'Authorization': `Bearer ${req.access_token}`}
      // });
      res.send(getKeyResponse)
    } catch(error) {
      console.warn('get address error', error.message);
      res.status(500).send('something went wrong with GET /key request: ' + error);
    }
  })
});

router.post('/transfer', validateCookie(), async function(req, res, next) {
  const addressFrom = req.body.addressFrom;
  const addressTo = req.body.addressTo;
  const transferWei = req.body.transferWei;

  try {
    const stratoResponse = await rp({
      uri: `${STRATO_URL}/strato/v2.3/transaction?resolve=true`,
      method: 'POST',
      headers: {'Authorization': `Bearer ${req.access_token}`},
      json: true,
      body: {
        address: `${addressFrom}`,
        txs: [
          {
            payload: {
              toAddress: `${addressTo}`,
              value: transferWei+""
            },
            type: "TRANSFER"
          }
        ]
      }
    });
    res.json(JSON.stringify({result: stratoResponse}));
  } catch(error) {
    console.warn('transaction error', error.message);
    res.status(500).send('something went wrong with POST /transaction: ' + error);
  }
});


function validateCookie(req, res, next) {
  return function (req, res, next) {
    if (!req.cookies[APP_TOKEN_COOKIE_NAME]) {
      res.redirect('/login');
    } else {
      // TODO: validate JWT with signature
      // TODO: check if token is outdated and refresh from OAUTH Provider if needed
      req.access_token = req.cookies[APP_TOKEN_COOKIE_NAME];
      return next();
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
