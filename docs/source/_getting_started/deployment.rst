.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

=========================
Deployment (production)
=========================

**Status:** initial notes. Validate for your environment before clinical/research use.

Prerequisites
=============

- Linux server with Docker & Docker Compose
- Domain (e.g., ``scanhub.example.org``)
- Valid TLS certificate + private key

Steps (high-level)
==================

1) Provision server and DNS
---------------------------
- Point A/AAAA records to your server.

2) Configure TLS and secrets
----------------------------
- Place your **private key** and **certificate** under ``secrets/`` (do **not** commit).

3) Update hostnames and CORS
----------------------------
Replace ``localhost`` with your domain in:

- **NGINX**: ``infrastructure/nginx_config.conf`` (``server_name``, HTTP→HTTPS redirect)
- **UI base URLs**: ``scanhub-ui/src/utils/Urls.tsx``
- **Allowed origins** in API services:  
  - ``services/device-manager/app/main.py``  
  - ``services/exam-manager/app/main.py``  
  - ``services/mri/sequence-manager/app/main.py``  
  - ``services/patient-manager/app/main.py``  
  - ``services/user-login-manager/app/main.py``  
  - ``services/workflow-manager/app/main.py``

4) Build & start
----------------
::
  docker compose build
  docker compose up -d

5) Create users
---------------
Use the UI to create admin/operator accounts with strong passwords.

Security notes
==============
- Limit admin endpoints; consider a reverse proxy/WAF, backups, logging, and secrets management.
- Review data protection requirements for your use case.
