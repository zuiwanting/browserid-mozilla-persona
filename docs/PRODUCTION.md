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

* *reader* - handles all read only API requests, forwarding when needed to dbwriter and certifier.

* *writer* - handles all API requests which require write access to the database.

* *certifier* - handles certification of user keys.

* *verifier* - handles verification of assertions.

* *proxy* - handles requests to third-party domains to check their BrowserID support.

This process separation lets us scale optimally, by giving each function the ability to scale independently of the others. More importantly, it lets us do privilege separation:

* only <tt>writer</tt> has DB-write access.
* only <tt>certifier</tt> has access to the private key.
* <tt>writer</tt> and <tt>certifier</tt> are not directly reachable from the public web, requests must be proxied via <tt>router</tt> and <tt>reader</tt>, serially.

## Database

We use MySQL in single-master / many-slaves mode, with the ability to
promote any slave to master when needed. This process is not
instantaneous: a master failure leads to 20 minutes of write-downtime
(while reads are unaffected.)

## Hosts

We could host each process on a separate host, but we don't need to do that yet. Instead, we have four classes of hosts:

* *webhead* - runs the <tt>router</tt>, <tt>static</tt>, <tt>reader</tt>, <tt>verifier</tt>, and <tt>proxy</tt> processes. Also runs <tt>nginx</tt> as the web-facing process.

* *dbwriter* - runs the <tt>writer</tt> process.

* *certifier* - runs the <tt>certifier</tt> process.

* *db* - runs the MySQL Database, master or slave.

Each class of hosts has at least 3 instances so that maintenance can
proceed with remaining fault tolerance.

## Load Balancers

We use the Zeus load balancer in front of our multi-host system.

## Configuration Management

Hosts are configured with [Puppet](http://puppetlabs.com/puppet/what-is-puppet/), a tool that lets us specify invariants that Puppet ensures, e.g. "make sure that node 0.8.0 is installed."

# Deploying New Code

[This section merits further discussion.]

## High-Level Process

When deploying new code, we upgrade one cluster at a time, taking the
cluster offline first, upgrading it fully, then bringing it back
online. The alternative -- upgrading a cluster while it serves traffic
-- leaves open the possibility that a change in the internal API would
cause erratic behavior if, e.g. a read API call is served by old code
while a write API call is served by new code. This kind of
cluster-based deployment indicates that we'll need an additional
cluster for improved robustness.

## Details



# Monitoring & Escalation