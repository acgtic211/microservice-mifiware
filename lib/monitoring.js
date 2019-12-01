const moment = require('moment');
const Entity = require('../controllers/Entity');
const Value = require('../controllers/Value');

/* global SOCKET_IO */

function monitor(type, message, payload) {
  SOCKET_IO.emit(type, moment().format('LTS') + ' - ' + message);
  console.log(type);
  console.log(message);
  console.log(payload);
  if (payload && Object.keys(payload).length !== 0) {
    var dataPreProcessed = preDeserialization(JSON.stringify(payload));
    dataPreProcessed = dataPreProcessed.split(",")
    entities = deserializeJson(dataPreProcessed);

    var entitiesJson = "{" + '"entities": ' + JSON.stringify(entities) + "}";
    SOCKET_IO.emit('payload', JSON.parse(entitiesJson));
  }
}




function preDeserialization(reqBody)
{
  var arrayData = reqBody.substring(reqBody.indexOf("data")+6, reqBody.length);
  var preData = arrayData.split(",");
  var res = "";
  for(var i = 0; i < preData.length; i++)
  {
  	if(preData[i].includes('{"type":'))
    {
    res += preData[i].substring(preData[i].indexOf('{"type"'), preData[i].indexOf('"value":'));
    }else if (preData[i].includes('"value":'))
    {
    	res += preData[i].replace('"value":', "");
    }else if(preData[i].includes('"metadata":'))
    {
    	if(i+1 == preData.length)
        {
        	res += "}";
        }else if(preData[i+1].includes('"id"'))
        {
        	res += "},";
        }else
        {
            res += ",";
        }
    }
    else
    {
    res += preData[i] + ",";
    }
  }
  res += "]";

  return res;
}

function deserializeJson(reqBody)
{
  var entities = [];
  var values = [];
  var entityName = "";

  for(var i = 0; i < reqBody.length; i++)
  {
    if(reqBody[i].includes('"id":'))
    {
      if(i!= 0)
      {
        entities.push(new Entity(entityName, values));
        values = [];
      } 
      entityName = reqBody[i].split(":")[1].replace(new RegExp('"', 'g'), "");

    }else if(!reqBody[i].includes('"type":'))
    {
      var processedData = reqBody[i].replace("}]", "").replace("}", "").split(":");
      var value = new Value(processedData[0].replace(new RegExp('"', 'g'), ""), processedData[1]);
      values.push(value);
    }
  }
  entities.push(new Entity(entityName, values));
  return entities;
}

module.exports = {monitor, deserializeJson}
