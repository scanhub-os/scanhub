.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

========================
Troubleshooting & FAQs
========================

Browser warns about HTTPS
=========================

**Symptom:** Browser shows a certificate warning on https://localhost/.

**Cause:** Development uses a self-signed certificate.

**Fix:** Proceed in development, or configure a real certificate for production (see :doc:`deployment`).

I changed code but nothing updates
==================================

**Symptom:** UI or services still behave like before a change.

**Cause:** Containers need a rebuild after structural/library changes.

**Fix:** Rebuild and restart::

  docker compose build
  docker compose up -d

Docker Compose command not found
================================

**Symptom:** Script uses ``docker compose`` but your system has ``docker-compose`` (hyphenated).

**Fix:** Use the command available on your system, or install the latest Docker Compose.
