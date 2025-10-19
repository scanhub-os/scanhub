.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

==============================
Installation (detailed, local)
==============================

This page expands the Quickstart with additional notes useful for development and CI.

Build strategy
==============

Base image
----------

ScanHub services share a **base image**. You can:

- **Build locally** (best when you modify base libs)::

    cd services/base
    docker build -t scanhub-base .
    cd ../..
    docker compose build --build-arg BASE_IMG=scanhub-base:latest

- **Use the GHCR base image** (fastest to begin)::

    docker compose build

Rebuild when needed
-------------------

Rebuild containers whenever you change the base image, install new libraries, or alter structural aspects of a service.::

  docker compose build

Start/stop lifecycle
====================

- Start (detached):: 

    docker compose up --detach

- Stop and remove containers::

    docker compose down

Local HTTPS (development)
=========================

By default, ScanHub runs with a **self-signed certificate**. Browsers will warn; for **localhost** in development you can proceed. For production, see :doc:`deployment`.

Default credentials
===================

If no user exists, the UI presents a **Create first user** form. Enforce a strong password (≥12 chars).

Where to change URLs and CORS
=============================

For production hosts you will later change **localhost** to your domain in:

- NGINX config (see deployment page)
- UI URL configuration
- Allowed origins in API services

(Exact file paths are summarized in :doc:`deployment`.)
