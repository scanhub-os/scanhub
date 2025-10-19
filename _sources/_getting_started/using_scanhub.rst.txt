.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

=============================
Using the ScanHub Web UI
=============================

All user interaction with **ScanHub** happens through its **Web UI**, a browser-based interface that provides access to the complete imaging workflow — from planning to viewing results.

Accessing the Web UI
====================
After starting the system with ``docker compose up -d``, open your browser at:

   **https://localhost/**

For production deployments, replace *localhost* with your configured domain.

First login
===========
When the system runs for the first time, the Web UI will prompt you to create an administrator account.  
Use a strong password (at least 12 characters). You can later add standard user accounts under *Settings → User Management*.

Typical workflow
================

1. **Login**  
   Sign in using your administrator or user credentials.

2. **Plan an exam**  
   Define a new exam by specifying the subject, study details, and imaging sequence.  
   (In the development setup, simulated devices and test sequences are preconfigured.)

3. **Run the acquisition or simulation**  
   Start the exam. Data will be acquired or simulated and processed automatically in the background.  
   No additional configuration or manual processing steps are required.

4. **Inspect results**  
   Once processing completes, you can view and download reconstructed DICOM images directly from the Web UI.

5. **Manage data**  
   Review previous exams, manage subjects, and organize studies from the dashboard.

Monitoring
==========
To observe background activity or troubleshoot technical issues, you can follow the logs of all running services::

   docker compose logs -f

Shutdown
========
To stop all containers and services safely::

   docker compose down

Notes
=====
- The Web UI encapsulates all backend functionality — users never interact with the individual services directly.  
- For development and debugging, internal microservices reside under the ``services/`` directory, but they remain transparent to end users.
