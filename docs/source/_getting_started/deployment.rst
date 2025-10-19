.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

=========================
Deployment (production)
=========================

**Status:** initial notes. Validate for your environment before clinical/research use.

Prerequisites
=============

- A Linux server (on-prem or cloud) with Docker & Docker Compose.
- A **domain** (e.g., ``scanhub.example.org``).
- A **valid TLS certificate** and **private key** for that domain.

Steps (high-level)
==================

1) Provision server and DNS
---------------------------

- Point your domain (A/AAAA) to the server.
- Ensure outbound internet access for pulling images.

2) Configure TLS and secrets
----------------------------

Replace the development defaults with your own:

- Put your **private key** and **certificate** in the appropriate secrets paths.
- **Do not** commit these to version control.

3) Update hostnames and CORS
----------------------------

Replace ``localhost`` with your real domain in:

- **NGINX config** (e.g., ``infrastructure/nginx_config.conf``: `server_name` and HTTP→HTTPS redirect)
- **UI URLs** (e.g., in the UI URL utility)
- **Allowed origins** in API services (e.g., device/exam/patient/sequence managers)

4) Start services
-----------------

- Build/pull images and bring up the stack::

    docker compose build
    docker compose up -d

5) Create users
---------------

- Use the UI to create admin and operator accounts with strong passwords.

Security notes
==============

- Limit exposure of admin endpoints.
- Consider a reverse proxy or WAF, backups, central logging, and secrets management.
- Review data protection requirements applicable to your use case.

