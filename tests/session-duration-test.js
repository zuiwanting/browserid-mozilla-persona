#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


require('./lib/test_env.js');

const assert =
require('assert'),
vows = require('vows'),
start_stop = require('./lib/start-stop.js'),
wsapi = require('./lib/wsapi.js'),
config = require('../lib/configuration.js'),
primary = require('./lib/primary.js'),
ca = require('../lib/keysigner/ca.js'),
jwcrypto = require('jwcrypto');

var suite = vows.describe('session-context');

// disable vows (often flakey?) async error behavior
suite.options.error = false;

start_stop.addStartupBatches(suite);

// test that auth_with_assertion also respects the 'ephemeral' argument
const PRIMARY_DOMAIN = 'example.domain',
      PRIMARY_EMAIL = 'testuser@' + PRIMARY_DOMAIN,
      PRIMARY_ORIGIN = 'http://127.0.0.1:10002';

// here we go!  let's authenticate with an assertion from
// a primary.

var primaryUser = new primary({
  email: PRIMARY_EMAIL,
  domain: PRIMARY_DOMAIN
});

function getSessionDuration(context) {
  // if context is undefined, cookies will be fetched from wsapi.js's internal
  // context state.
  var cookie = wsapi.getCookie(/^browserid_state/, context);
  if (!cookie) throw new Error("Could not get browserid_state cookie");

  var durationStr = cookie.split('.')[3];
  if (!durationStr) throw new Error("Malformed browserid_state cookie - does not contain duration");

  return parseInt(durationStr, 10);
}

suite.addBatch({
  "setup user": {
    topic: function() {
      primaryUser.setup(this.callback);
    },
    "works": function(err) {
      assert.isNull(err);
      assert.isObject(primaryUser._keyPair);
      assert.isString(primaryUser._cert);
    }
  }
});

suite.addBatch({
  "generating an assertion": {
    topic: function() {
      primaryUser.getAssertion(PRIMARY_ORIGIN, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and logging in with the assertion with ephemeral = true": {
      topic: function(err, assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          assertion: assertion,
          ephemeral: true
        }).call(this);
      },
      "works": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      },
      "has expected duration": function(err, r) {
        assert.strictEqual(parseInt(wsapi.getCookie(/^browserid_state/).split('.')[3], 10), config.get('ephemeral_session_duration_ms'));
      }
    }
  }
});

suite.addBatch({
  "generating an assertion": {
    topic: function() {
      primaryUser.getAssertion(PRIMARY_ORIGIN, this.callback);
    },
    "succeeds": function(err, r) {
      assert.isString(r);
    },
    "and logging in with the assertion with ephemeral = false": {
      topic: function(err, assertion)  {
        wsapi.post('/wsapi/auth_with_assertion', {
          assertion: assertion,
          ephemeral: false
        }).call(this);
      },
      "works": function(err, r) {
        var resp = JSON.parse(r.body);
        assert.isObject(resp);
        assert.isTrue(resp.success);
      },
      "has expected duration": function(err, r) {
        assert.strictEqual(parseInt(wsapi.getCookie(/^browserid_state/).split('.')[3], 10), config.get('authentication_duration_ms'));
      }
    }
  }
});

// now test that authenticate_user & secondary emails properly respect the 'ephemeral' argument to
// alter session length
const TEST_EMAIL = 'someuser@somedomain.com',
      PASSWORD = 'thisismypassword',
      RESET_PASSWORD = 'thisismynewpassword';


var token = undefined;

// first stage the account
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_user', {
      email: TEST_EMAIL,
      pass: PASSWORD,
      site: 'http://a.really.fakesite123.com:999'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (err, t) {
      assert.isNull(err);
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

// create a new account via the api with (first address)
suite.addBatch({
  "setting password": {
    topic: function() {
      wsapi.post('/wsapi/complete_user_creation', {
        token: token
      }).call(this);
    },
    "works just fine": function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

suite.addBatch({
  "authenticating with the password and ephemeral = true": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: PASSWORD,
      ephemeral: true
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
    "yields a session of expected length": function(err, r) {
      assert.strictEqual(parseInt(wsapi.getCookie(/^browserid_state/).split('.')[3], 10), config.get('ephemeral_session_duration_ms'));
    }
  }
});

suite.addBatch({
  "authenticating with the password and ephemeral = false": {
    topic: wsapi.post('/wsapi/authenticate_user', {
      email: TEST_EMAIL,
      pass: PASSWORD,
      ephemeral: false
    }),
    "works as expected": function(err, r) {
      assert.strictEqual(JSON.parse(r.body).success, true);
    },
    "yields a session of expected length": function(err, r) {
      assert.strictEqual(parseInt(wsapi.getCookie(/^browserid_state/).split('.')[3], 10), config.get('authentication_duration_ms'));
    }
  }
});

// finally, let's verify that ephemeral is properly handled when certifying keys for a user

var kp = null;

assert.within = function(got, expected, margin) {
  assert.ok(got + margin > expected);
  assert.ok(got - margin < expected);
}

suite.addBatch({
  "generate keypair": {
    topic: function() {
      jwcrypto.generateKeypair({algorithm:"RS", keysize: 64}, this.callback);
    },
    "works": function(err, keypair) {
      assert.isNull(err);
      kp = keypair;
    }
  }
});

suite.addBatch({
  "cert_key invoked with ephemeral = false": {
    topic: function() {
      wsapi.post('/wsapi/cert_key', {
        email: TEST_EMAIL,
        pubkey: kp.publicKey.serialize(),
        ephemeral: false
      }).call(this);
    },
    "returns a response with a proper content-type" : function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

suite.addBatch({
  "cert_key invoked with ephemeral = true": {
    topic: function() {
      wsapi.post('/wsapi/cert_key', {
        email: TEST_EMAIL,
        pubkey: kp.publicKey.serialize(),
        ephemeral: true
      }).call(this);
    },
    "returns a response with a proper content-type" : function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

/**
 * Check to make sure completing an email verification does not reset
 * the session duration
 */
suite.addBatch({
  "session prolonging": {
    topic: wsapi.post('/wsapi/prolong_session', {}),
    "returns 200": function(err, r) {
      assert.strictEqual(r.code, 200);
    }
  }
});

// now add an email address
suite.addBatch({
  "account staging": {
    topic: wsapi.post('/wsapi/stage_reset', {
      email: TEST_EMAIL,
      site: 'http://a.really.fakesite123.com:999'
    }),
    "works":     function(err, r) {
      assert.equal(r.code, 200);
    }
  }
});

// wait for the token
suite.addBatch({
  "a token": {
    topic: function() {
      start_stop.waitForToken(this.callback);
    },
    "is obtained": function (err, t) {
      assert.isNull(err);
      assert.strictEqual(typeof t, 'string');
      token = t;
    }
  }
});

// verify the account
suite.addBatch({
  "setting password": {
    topic: function() {
      wsapi.post('/wsapi/complete_reset', {
        pass: RESET_PASSWORD,
        token: token
      }).call(this);
    },
    "does not shorten session duration": function(err, r) {
      assert.equal(r.code, 200);
      assert.strictEqual(getSessionDuration(), config.get('authentication_duration_ms'));
    }
  }
});


start_stop.addShutdownBatches(suite);

// run or export the suite.
if (process.argv[1] === __filename) suite.run();
else suite.export(module);
