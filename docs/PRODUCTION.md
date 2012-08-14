<!-- This Source Code Form is subject to the terms of the Mozilla Public
   - License, v. 2.0. If a copy of the MPL was not distributed with this
   - file, You can obtain one at http://mozilla.org/MPL/2.0/. -->

This document details the Persona production environment, how we maintain it, and how we deploy new code.

# Persona Production Environment

The Persona service is deployed, in production, as a set of clusters
with DNS load-balancing across them. Each cluster is internally
redundant, so no single host failure will take down the
service. Geographic distribution of clusters exists for failover and
scale. At this time, there are two clusters at two geographically
distant data centers. The number of clusters will likely increase.

A single Persona cluster looks like:

![alt](https://raw.github.com/benadida/browserid/opsdocs/docs/persona_arch.png "Optional title")

## Processes

Persona is composed of a few different distinct processes:

* *router* - the main entry point for all web requests, responsible for forwarding API requests appropriately. [QUESTION: should router be entry point for verifier? I don't think so... Maybe a separate router process?]

* *static* - handles all static file requests, e.g. images, CSS, etc.

* *webhead* - handles all read only API requests, forwarding when needed to dbwriter and certifier.

* *dbwriter* - handles all API requests which require write access to the database.

* *certifier* - handles certification of user keys.

* *verifier* - handles verification of assertions.

This process separation lets us scale optimally, by giving each function the ability to scale independently of the others. More importantly, it lets us do privilege separation:

* only dbwriter has DB-write access.
* only certifier has access to the private key.
* dbwriter and certifier are not directly reachable from the public web.


## Hosts


# Deploying New Code

# Monitoring & Escalation