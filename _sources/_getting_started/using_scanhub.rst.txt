.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

=========================
Using ScanHub (the UI)
=========================

This hands-on tour shows the typical first workflow.

1) Sign in / Create admin user
==============================

- On first run, create the initial user in the UI. 
- Subsequent logins use your credentials.

2) Register or select a device
==============================

- Open **Device Manager**.
- For a quick trial, select a **simulation device** if available (e.g., a KomaMRI-backed device).

3) Inspect sequences
====================

- Open **MRI Sequences Manager**.
- Browse and inspect available sequences; confirm parameters match your intended test.

4) Plan and run an exam
=======================

- Open **Exam Manager** and create a new exam for a demo patient.
- Select the device and sequence, then **start acquisition** (or run a simulation on the virtual scanner).

5) View results (DICOM)
=======================

- When processing completes, open the exam results to **view the reconstructed DICOM** objects in the UI.
- Confirm metadata and basic image quality; iterate if necessary.

Tips
====

- Use simulated devices to validate pipelines before connecting real scanners.
- Keep an eye on logs (`docker compose logs -f`) if a job stalls.
