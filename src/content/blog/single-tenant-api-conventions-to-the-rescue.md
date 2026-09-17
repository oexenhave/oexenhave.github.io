---
title: "Single-Tenant API Conventions to the Rescue"
description: "TimeLog is special. In many ways. However for this blog post, it’s the way our product is built. TimeLog started out over 18 years ago and at that time many…"
pubDate: "2019-01-28"
permalink: "2019/01/28/single-tenant-api-conventions-to-the-rescue"
---
[TimeLog](https://www.timelog.com) is special. In many ways. However for this blog post, it’s the way our product is built. TimeLog started out over 18 years ago and at that time many applications were built to service one customer only. And to scale companies just copied the whole thing (code and database) to the next customer and so on. Single-tenant apps became scalable. TimeLog is build that way, so all our customers have their own silo. Naturally, it gives all kinds of issues, but some good stuff as well. To the far extreme then all customers could potentially run their own version of our product – however, this is not at all the case with us. We upgrade most sites to the latest version weekly.

[TimeLog have various APIs](https://api.timelog.com) and have had them for years. However, we want to enhance our abilities and (finally) move to a REST-based API. We believe that our API will grow more rapidly in the future, so we need to consider more carefully how to versioning our API – especially due to our nature of being a single-tenant app.

One of my recent initiatives as Tech Lead is, that I have started to build our definition of “Tech Nirvana” in TimeLog. An (for now) internal website gathering all our discussions and putting into short numbered rules categorized in manifestos and style guides across the different areas we operate in. Only technical stuff and focused on why-documentation – another blog post about that at another time.

In any case, I have worked with one of my colleagues to craft the conventions we need for ensuring that our mobile app offering (Android and iOS) can function well (almost) no matter which of our single-tenant apps they are trying to access. The API style guide have a number of sections, but the notable ones for this exercise is REST API Conventions and API Consumer Conventions.

I hope this can be used for inspiration for others – also in a multi-tenant environment.

#### API03: REST API Conventions

**API03.1:**After a method has been released, method names, input parameters and the general output structure MUST NOT be changed in any form.

> Because consumers of the API should not have to update their solution due to our changes.

**API03.2:**After a method has been released, additional optional input properties and output properties MAY be added.

> Because consumers SHOULD NOT care about new elements. General renames and/or adding required fields will break existing solutions so these MUST NOT happen.

**API03.3:**If API changes violate either API03.1 or API03.2, we will always bump the API version number – and implement necessary internal backwards compatibility into existing API versions.

> Because it allows existing integrations against our API to continue to work. For example, if a new required field is added, then for earlier API versions we automatically (internally) set a good default value to cope with the lack of API consumer input.

**API03.4:** API version and TLP version are not supposed to follow each other.

> Because the API only needed to be increased based on API03.3. However, new functionality and other additions will follow the TLP version which will increase the version each week.

#### API04: API Consumer Conventions

**API04.1:**All API consumers MUST adopt an upgrade-only distribution pattern.

> Because of the nature of app stores, this is inherently required for Play Store and Apple Store. A user can only download the latest version of the app, so we need to cope with that limitation for all our API consumers to make our integrations as homogenous as possible.

**API04.2:**Testing API consumers SHOULD target the latest TLP version and API version only.

> Because we upgrade all (latest TLP version) TLP sites at more or less the same time, and under 2% are held back for various reasons for a shorter period of time. Most of the time our web-app will be of a more recent TLP version than the API consumer targets.

**API04.3:**API consumers (that targets an unreleased TLP version) SHOULD support at least the latest two TLP versions.

> Because internal API consumers might be required to release before the general TLP release, e.g. for app stores to ensure close-to-same release date of app and TLP but due to the nature of app stores, we cannot count on it. API04.4 would solve most issues, but e.g. for personal settings those are hard. If required by PO, we should add a else-statement with a message to the user that the functionality they turned on is not available yet.

**API04.4:**Favor using the hypermedia structure to decide if a UI element or feature should be available over hardcoding display rules.

> For example, only show the “Expenses” tab (in the mobile apps) if link:Expenses is available from the root hypermedia note. This allows the server to control UI behavior (e.g. due to TLP versioning, licensing og setting constraints) in the applications without having to redo the apps. Another benefit is that the API consumer is backwards compatible (when targeting older TLP versions) for most use cases.

**API04.5:**API consumers SHOULD assume that features and functionalities are default off (until the hypermedia tree tells otherwise).

> Because we want to ensure that the app works even when targeting different TLP versions. In general, defaults should be implemented at all levels.

**API04.5:**Favor preloading content in the background over lazy loading content. If preloading fails, lazy loading SHOULD kick in.

> Because for mobile apps in particular requests take time, so if we can load data in the background the user gets a better experience.
