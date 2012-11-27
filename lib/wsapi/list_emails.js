/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const
db = require('../db.js'),
logger = require('../logging.js').logger,
wsapi = require('../wsapi.js'),
primary = require('../primary.js');

// returns a list of emails owned by the user:
//
// {
//   "foo@foo.com" : {..properties..}
//   ...
// }

exports.method = 'get';
exports.writes_db = false;
exports.authed = 'assertion';
exports.i18n = false;

// at the time a client calls list_info, we will pre-fetch well-known
// documents from all relevant domains in order to seed our cache.
// we do this because we know that the client will soon call 'address_info'
// for one of them.
//
// all of these requests go through our proxy, and we rely on the proxy to
// only fetch data from the network when necessary, respecting domain's
// cache headers.
function prefetchDomainInfo(emails) {
  if (emails) {
    Object.keys(emails).forEach(function(email) {
      var domain = primary.emailRegex.exec(email)[1];
      primary.checkSupport(domain, function (/* err, r*/) {
        // do nothing with the response, err can simply indicate
        // that the domain does not have persona support, and we expect
        // this fact will be cached in our forward proxy regardless.
      });
    });
  }
}

exports.process = function(req, res) {
  logger.debug('listing emails for user ' + req.session.userid);
  db.listEmails(req.session.userid, function(err, emails) {
    if (err) wsapi.databaseDown(res, err);
    else {
      res.json(emails);
      prefetchDomainInfo(emails);
    }
  });
};
