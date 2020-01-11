const express = require('express');
const router = express.Router();
const monitor = require('../controller/monitoring');
const Entity = require('../domain/Entity');
const Value = require('../domain/Value');
const request = require('request');
const _ = require('lodash');
const orionUrl = "http://192.168.183.128";
const microserviceUrl = "http://192.168.44.1";

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

function createSubscription(paramName, paramId, paramQuery)
{
  request(orionUrl + ":1026/v2/subscriptions", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
      var reqData = JSON.parse(body);
      var exists = false;
      var name = paramName;
      var queryId = '"idPattern": ".*", ';
      var queryFilter = '';
      var notifyFilter = '';
      
      if(paramId != "")
      {
        name = paramId;
        queryId = '"id": "' + paramId + '", ';
      }else
      {
        if(paramQuery!='undefined' && paramQuery != "")
        {
          notifyFilter = encodeURIComponent(paramQuery);
          name = paramName + " with conditions " + encodeURIComponent(paramQuery);
          queryFilter = ',"expression": {"q": "'+ paramQuery +'"}'; //Notify when on change this condition is true (not used yet)
        }
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
          body: '{ "description": "Notify me of all ' + name + ' changes", "subject": { "entities": [{' + queryId + '"type": "' + paramName + '"}],  "condition": { "attrs": [ ]' + '} },  "notification": {"http": { "url": "' + microserviceUrl + ':3000/subscription/'+ paramName + '&' + paramId + '&' + notifyFilter + '" } } }',
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
  var extraUrlQuery = '';
  var filterData = "";
  if(params[1] != "")
  {
    extraUrl = "&id=" + params[1];
  }else
  {
    if(params[2] != "" && params[2] != 'undefined')
    {
      filterData = params[2];
      extraUrlQuery = '&q=' + decodeURIComponent(params[2]);
    } 
  }

  request(orionUrl + ":1026/v2/entities?type=" + params[0] + extraUrl + extraUrlQuery +"&options=keyValues", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
       monitor.monitor(params[0], params[1], filterData, body);

    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
});

 
  res.status(204).send();
});

router.get('/subscription', (req, res) => {
  var paramName = req.query.entity;
  var paramId = req.query.id;
  var paramQuery = '';
  var entities = [];
  var extraUrl = "";
  var extraUrlQuery = '';

  if(paramId != "")
  {
    extraUrl = "&id=" + paramId;
  }else
  {
    if(req.query.queryFilter != 'undefined' && req.query.queryFilter != "" )
    {
      paramQuery = decodeURIComponent(req.query.queryFilter);
      extraUrlQuery = '&q=' + decodeURIComponent(req.query.queryFilter);
    } 
  } 

  request(orionUrl + ":1026/v2/entities?type=" + paramName + extraUrl + extraUrlQuery +"&options=keyValues", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
        var reqBody = body.split(",")
        entities = monitor.deserializeJson(reqBody);
        
        var entitiesJson = "{" + '"entities": ' + JSON.stringify(entities) + "}";

        createSubscription(paramName, paramId, paramQuery);
        res.json(JSON.parse(entitiesJson));
    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
});
});

router.get('/typeList', (req, res) => {
  request(orionUrl + ":1026/v2/types?options=values", function (error, response, body) {
    if (!error && response.statusCode == 200) 
    {
        res.json(JSON.parse(body));
    } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
    }
});
});



module.exports = router;
