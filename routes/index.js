const express = require('express');
const router = express.Router();
const monitor = require('../controller/monitoring');
const Entity = require('../domain/Entity');
const Value = require('../domain/Value');
const request = require('request');
const _ = require('lodash');
const orionUrl = "http://192.168.111.129";
const microserviceUrl = "http://192.168.2.114";

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
      var paramUrl = "";
      var queryId = '"idPattern": ".*", ';
      var queryFilter = '';
      var notifyFilter = '';

      if(paramName != "")
      {
        paramUrl = '"type": "' + paramName + '"';
      }
      
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
          body: '{ "description": "Notify me of all ' + name + ' changes", "subject": { "entities": [{' + queryId + paramUrl + '}],  "condition": { "attrs": [ ]' + '} },  "notification": {"http": { "url": "' + microserviceUrl + ':3000/subscription/'+ paramName + '&' + paramId + '&' + notifyFilter + '" } } }',
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
  var paramUrl = "";
  var paramSeparator = "?";
  var optionsSeparator = "&";
  var extraUrl = "";
  var extraUrlQuery = '';
  var filterData = "";

  if(params[0] != "")
  {
    paramUrl = "?type=" + params[0];
    paramSeparator = "&";
  }


  if(params[1] != "")
  {
    extraUrl = paramSeparator + "id=" + params[1];
  }else
  {
    if(params[2] != "" && params[2] != 'undefined')
    {
      filterData = params[2];
      extraUrlQuery = paramSeparator + 'q=' + decodeURIComponent(params[2]);
    }else if(paramSeparator != "&")
    {
      optionsSeparator = "?";
    }
  }
  request(orionUrl + ":1026/v2/entities" + paramUrl + extraUrl + extraUrlQuery + optionsSeparator + "options=keyValues", function (error, response, body) {
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
  var paramUrl = "";
  var paramSeparator = "?";
  var optionsSeparator = "&";
  var extraUrl = "";
  var extraUrlQuery = '';

  if(paramName != "")
  {
    paramUrl = "?type=" + paramName;
    paramSeparator = "&";
  }

  if(paramId != "")
  {
    extraUrl = paramSeparator + "id=" + paramId;
  }else
  {
    if(req.query.queryFilter != 'undefined' && req.query.queryFilter != "" )
    {
      paramQuery = decodeURIComponent(req.query.queryFilter);
      extraUrlQuery = paramSeparator + 'q=' + decodeURIComponent(req.query.queryFilter);
    }else if(paramSeparator != "&")
    {
      optionsSeparator = "?";
    }
  } 
  request(orionUrl + ":1026/v2/entities" + paramUrl + extraUrl + extraUrlQuery + optionsSeparator + "options=keyValues", function (error, response, body) {
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

router.get('/attributeList', (req, res) => {
  var paramName = req.query.entity;
  var attributeList = [];

  if(paramName != "" && paramName != "undefined")
  {
    request(orionUrl + ":1026/v2/entities?type="+ paramName +"&options=keyValues", function (error, response, body) {
      if (!error && response.statusCode == 200) 
      {
          try
          {
            request(orionUrl + ":1026/v2/entities/" + JSON.parse(body)[0].id + "/attrs?options=keyValues", function (error, response, body) {
              if (!error && response.statusCode == 200) 
              {
                for(var i = 0; i < Object.keys(JSON.parse(body)).length; i++)
                {
                  attributeList.push(Object.keys(JSON.parse(body))[i])
                }
                  res.json(attributeList);
              } else {
                  console.log("There was an error: ") + response.statusCode;
                  console.log(body);
                  res.status(response.statusCode).send();
              }
          });
          }catch(error)
          {
            console.log("There was an error: ") + response.statusCode;
            console.log(body);
            res.status(204).send();
          }
          
      } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
      }
    });
  }else
  {
    request(orionUrl + ":1026/v2/types?options=noAttrDetail", function (error, response, body) {
      if (!error && response.statusCode == 200) 
      {
        for(var i = 0; i < JSON.parse(body).length; i++)
        {
          for(var j = 0; j < Object.keys(JSON.parse(body)[i].attrs).length; j++)
          {
            if(!attributeList.includes(Object.keys(JSON.parse(body)[i].attrs)[j])) attributeList.push(Object.keys(JSON.parse(body)[i].attrs)[j]);
          }
        }
        res.json(attributeList);
      } else {
        console.log("There was an error: ") + response.statusCode;
        console.log(body);
        res.status(response.statusCode).send();
      }
    });
  }
});




module.exports = router;
