const express = require('express');
const router = express.Router();
const monitor = require('../controller/monitoring');
const Entity = require('../domain/Entity');
const Value = require('../domain/Value');
const request = require('request');
const _ = require('lodash');
const orionUrl = "http://192.168.111.129";

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

function createSubscription(paramName, paramId)
{
  request(orionUrl + ":1026/v2/subscriptions", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
      var reqData = JSON.parse(body);
      var exists = false;
      var name = paramName;
      var queryId = '"idPattern": ".*", ';
      
      if(paramId != "")
      {
        name = paramId;
        queryId = '"id": "' + paramId + '", ';
      } 
      
      for(var i = 0; i < reqData.length; i++)
      {
          if(reqData[i].description == 'Notify me of all ' + name + ' changes') exists = true;
      }
      if(!exists)
      {
        request({
          headers: {
            'Content-Type': 'application/json'
          },
          uri: orionUrl + ':1026/v2/subscriptions?options=skipInitialNotification',
          body: '{ "description": "Notify me of all ' + name + ' changes", "subject": { "entities": [{' + queryId + '"type": "' + paramName + '"}],  "condition": { "attrs": [ ] } },  "notification": {"http": { "url": "' + orionUrl + ':3000/subscription/'+ paramName + '&' + paramId + '" } } }',
          method: 'POST'
        }, function (err, res, body) {
          //it works!
        });
      }

    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
  });
}



// Whenever a subscription is received, display it on the monitor
// and notify any interested parties using Socket.io
router.post('/subscription/:type', (req, res) => {
  var params = req.params.type.split("&");
  var extraUrl = "";
  if(params[1] != "") extraUrl = "&id=" + params[1];

  request(orionUrl + ":1026/v2/entities?type=" + params[0] + extraUrl +"&options=keyValues", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
       monitor.monitor(params[0], params[1], body);

    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
});

 
  res.status(204).send();
});

router.get('/subscription', (req, res) => {
  var paramName = req.query.entity
  var paramId = req.query.id
  var entities = [];
  var extraUrl = "";

  if(paramId != "") extraUrl = "&id=" + paramId;
  
  request(orionUrl + ":1026/v2/entities?type=" + paramName + extraUrl +"&options=keyValues", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
        var reqBody = body.split(",")
        entities = monitor.deserializeJson(reqBody);
        
        var entitiesJson = "{" + '"entities": ' + JSON.stringify(entities) + "}";

        createSubscription(paramName, paramId);
        res.json(JSON.parse(entitiesJson));
    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
});
});



module.exports = router;
