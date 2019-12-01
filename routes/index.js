const express = require('express');
const router = express.Router();
const monitor = require('../lib/monitoring');
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
  //console.log(req.body);
  monitor('notify', req.params.type + ' received', req.body);
  _.forEach(req.body.data, item => {
    broadcastEvents(req, item, ['refStore', 'refProduct', 'refShelf', 'type']);
  });
  res.status(204).send();
});

router.get('/subscription', (req, res) => {
  //var test = '{"entities": [{"name": "Light1", "values": [ { "name": "latitud", "value": "2.3124" }, { "name": "longitud", "value": "-6.2123" }, { "name": "voltaje", "value": "320" }]}, {"name": "Light2", "values": [ { "name": "latitud", "value": "3.3124" }, { "name": "longitud", "value": "-5.2123" }, { "name": "voltaje", "value": "284" }] } ] }';
  //console.log(JSON.parse(JSON.stringify(test)));
  //SOCKET_IO.emit('payload', test);
  res.json({ username: 'Flavio' })
});

module.exports = router;
