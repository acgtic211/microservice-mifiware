const express = require('express');
const router = express.Router();
const monitor = require('../lib/monitoring');
const Store = require('../controllers/store');
const Security = require('../controllers/security');
const _ = require('lodash');

const GIT_COMMIT = process.env.GIT_COMMIT || 'unknown';
const SECURE_ENDPOINTS = process.env.SECURE_ENDPOINTS || false;
const AUTHZFORCE_ENABLED = process.env.AUTHZFORCE_ENABLED || false;

// Error handler for async functions
function catchErrors(fn) {
  return (req, res, next) => {
    return fn(req, res, next).catch(next);
  };
}

// If an subscription is recieved emit socket io events
// using the attribute values from the data received to define
// who to send the event too.
function broadcastEvents(req, item, types) {
  const message = req.params.type + ' received';
  console.log(message);
  _.forEach(types, type => {
    console.log(item[type]);
    if (item[type]) {
      monitor(item[type], message);
    }
  });
}

// Handles requests to the main page
router.get('/', function(req, res) {
  const securityEnabled = SECURE_ENDPOINTS;
  res.render('index', {
    title: 'FIWARE Tutorial',
    success: req.flash('success'),
    errors: req.flash('error'),
    info: req.flash('info'),
    securityEnabled
  });
});

// Logs users in and out using Keyrock.
router.get('/login', Security.logInCallback);
router.get('/clientCredentials', Security.clientCredentialGrant);
router.get('/implicitGrant', Security.implicitGrant);
router.post('/userCredentials', Security.userCredentialGrant);
router.post('/refreshToken', Security.refreshTokenGrant);
router.get('/authCodeGrant', Security.authCodeGrant);
router.get('/logout', Security.logOut);

router.get('/version', function(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.send({ gitHash: GIT_COMMIT });
});

// Display the app monitor page
router.get('/app/monitor', function(req, res) {
  res.render('monitor', { title: 'Event Monitor' });
});

// Viewing Store information is secured by Keyrock PDP.
// LEVEL 1: AUTHENTICATION ONLY - Users must be logged in to view the store page.
router.get('/app/store/:storeId', Security.authenticate, Store.displayStore);
// Display products for sale
router.get('/app/store/:storeId/till', Store.displayTillInfo);
// Buy something.
router.post('/app/inventory/:inventoryId', catchErrors(Store.buyItem));

// Changing Prices is secured by a Policy Decision Point (PDP).
// LEVEL 2: BASIC AUTHORIZATION - Only managers may change prices - use Keyrock as a PDP
// LEVEL 3: XACML AUTHORIZATION - Only managers may change prices are restricted via XACML
//                                - use Authzforce as a PDP
router.get(
  '/app/price-change',
  function(req, res, next) {
    // Use Advanced Autorization if Authzforce is present.
    return AUTHZFORCE_ENABLED
      ? Security.authorizeAdvancedXACML(req, res, next)
      : Security.authorizeBasicPDP(req, res, next);
  },
  Store.priceChange
);
// Ordering Stock is secured by a Policy Decision Point (PDP).
// LEVEL 2: BASIC AUTHORIZATION - Only managers may order stock - use Keyrock as a PDP
// LEVEL 3: XACML AUTHORIZATION - Only managers may order stock are restricted via XACML
//                                - use Authzforce as a PDP
router.get(
  '/app/order-stock',
  function(req, res, next) {
    // Use Advanced Authorization if Authzforce is present.
    return AUTHZFORCE_ENABLED
      ? Security.authorizeAdvancedXACML(req, res, next)
      : Security.authorizeBasicPDP(req, res, next);
  },
  Store.orderStock
);

// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription', (req, res) => {
  //console.log(req.body);
  monitor('notify', req.params.type + ' received', req.body);
  _.forEach(req.body.data, item => {
    broadcastEvents(req, item, ['refStore', 'refProduct', 'refShelf', 'type']);
  });
  res.status(204).send();
});

module.exports = router;
