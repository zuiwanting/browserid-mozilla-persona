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

## Hosts


# Deploying New Code

# Monitoring & Escalation