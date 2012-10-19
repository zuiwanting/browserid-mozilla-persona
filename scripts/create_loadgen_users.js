#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
path = require('path'),
config = require('../lib/configuration.js'),
logger = require('../lib/logging.js').logger,
db = require('../lib/db.js');

function fail(err) {
  process.stderr.write(err + "\n");
  process.exit(1);
}

if (process.argv.length !== 3) {
  fail("Usage: " + path.basename(process.argv[1]) +
       " <number of test users>");
}

var want = parseInt(process.argv[2], 10);

if (want <= 0 || want >= 50000) {
  fail("Invalid number of users, allowable is 0-50000");
}

var dbConf = config.get('database');
dbConf.driver = 'mysql';
db.open(dbConf, function (error) {

  if (error) fail("can't open database: " + error);

  require('../lib/bcrypt').encrypt(
    config.get('bcrypt_work_factor'), "THE PASSWORD", function(err, hash) {
      if (err) {
        logger.error("error creating test users - bcrypt encrypt pass: " +
                     err);
        process.exit(1);
      }
      var have = 0;
      for (var i = 1; i <= want; i++) {
        db.addTestUser(i + "@loadtest.domain", hash, function(err, email) {
          if (++have == want) {
            logger.warn("created " + want + " test users");
          }
        });
      }
    });
});
