const mysql = require('mysql');

exports.createClient = function(options) {
  var clients = [];
  for (var i = 0; i < 50; i++) clients.push(mysql.createClient(options));
  var lastUsed = 0;
  function getNextToUse() {
    var nxt = clients[lastUsed];
    if (++lastUsed >= clients.length) lastUsed = 0;
    return nxt;
  }

  return {
    end: function(cb) {
      var ended = 0;
      for (var i = 0; i < clients.length; i++) {
        clients[i].end(function(err) {
          if (err) {
            ended = -1;
            cb(err);
          }
          if (ended == -1) return;
          ended++;
          if (ended >= clients.length) cb(undefined);
        });
      }
    },
    query: function() {
      var client = getNextToUse();
      client.query.apply(client, arguments);
    },
    ping: function() {
      var client = getNextToUse();
      client.ping.apply(client, arguments);
    }
  }
};
