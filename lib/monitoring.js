const moment = require('moment');

/* global SOCKET_IO */

function monitor(type, message, payload) {
  SOCKET_IO.emit(type, moment().format('LTS') + ' - ' + message);
  console.log(type);
  console.log(message);
  console.log(payload);
  SOCKET_IO.emit('payload', "hehe");
  if (payload && Object.keys(payload).length !== 0) {
    SOCKET_IO.emit('payload', payload);
  }
}

module.exports = monitor;
