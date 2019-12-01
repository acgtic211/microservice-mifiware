const express = require('express');
const router = express.Router();
const monitor = require('../lib/monitoring');
const Entity = require('../controllers/Entity');
const Value = require('../controllers/Value');
const request = require('request');
const _ = require('lodash');

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



// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription/:type', (req, res) => {
  monitor.monitor('notify', req.params.type + ' received', req.body);
  res.status(204).send();
});

router.get('/subscription', (req, res) => {
  var paramName = req.query.entity
  var entities = [];
  
  request("http://192.168.183.128:1026/v2/entities?type=" + paramName + "&options=keyValues", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
        var reqBody = body.split(",")
        entities = monitor.deserializeJson(reqBody);
        
        var entitiesJson = "{" + '"entities": ' + JSON.stringify(entities) + "}";

        request({
          headers: {
            'Content-Type': 'application/json'
          },
          uri: 'http://192.168.183.128:1026/v2/subscriptions',
          body: '{ "description": "Notify me of all Room changes", "subject": { "entities": [{"idPattern": ".*", "type": "Light"}],  "condition": { "attrs": [ ] } },  "notification": {"http": { "url": "http://192.168.44.1:3000/subscription/temperature-change" } } }',
          method: 'POST'
        }, function (err, res, body) {
          //it works!
        });

        res.json(JSON.parse(entitiesJson));
    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
    }
});
});



module.exports = router;
