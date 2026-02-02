.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

=========================
Quickstart (5–10 minutes)
=========================

This quickstart gets you running **locally** using Docker Compose.

Prerequisites
=============

- Docker and Docker Compose installed on your machine.
- Internet connection to build/pull images.

Steps
=====

1. **Clone the repository**::

   git clone https://github.com/brain-link/scanhub.git
   cd scanhub

2. **Build images**

   **Option A (recommended for development)** – build with local base image::

     cd services/base
     docker build -t scanhub-base .
     cd ../..
     docker compose build --build-arg BASE_IMG=scanhub-base:latest

   **Option B (convenience)** – use base image from GHCR::

     docker compose build

3. **Start ScanHub**::

   docker compose up --detach

4. **Open the UI**

   Navigate to **https://localhost/**. 
   Your browser will warn about the self-signed certificate (development default) – continue anyway.

5. **Create the first user**

   If the database is empty, ScanHub prompts you to create an admin-level user. Use a **strong password (≥12 chars)**.

6. **Stop ScanHub**::

   docker compose down

Next steps
==========

- See :doc:`using_scanhub` to plan an exam, run a simulation, and view results.
- See :doc:`troubleshooting` if you hit Docker or HTTPS issues.
