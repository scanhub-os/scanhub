.. Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
   SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

====================
What is ScanHub?
====================

**ScanHub** is an open-source, cloud-oriented **multimodal acquisition platform** for medical imaging workflows (currently focused on **MRI**). It integrates device management, exam planning, sequence management, workflow execution, and cloud-based reconstruction/processing into one coherent platform and UI.

Repository layout
=================

- **Microservices** (backend): ``services/*``  
  - ``services/device-manager`` — register/select devices and handle device comms  
  - ``services/exam-manager`` — plan, schedule, track, and review exams  
  - ``services/mri/sequence-manager`` — manage MRI sequences (inspect, configure)  
  - ``services/patient-manager`` — patient and study metadata  
  - ``services/user-login-manager`` — authentication and session handling  
  - ``services/workflow-manager`` — orchestration of reconstruction/processing jobs
- **Web UI** (frontend): ``scanhub-ui`` — single entry point for operators/researchers

Why it exists
=============

Traditional MRI console workflows are costly to scale, hard to extend, and siloed. ScanHub shifts reconstruction and processing tasks into a cloud-ready, modular architecture, enabling:

- **Scalability & flexibility** – heavy workloads run in the cloud; services can be swapped or extended.
- **Open innovation** – avoid vendor lock-in; build on transparent, community-driven components.
- **Collaboration & sharing** – central data handling and standard formats support teamwork.
- **Interoperability** – open interfaces across device, exam, and sequence managers.

Key building blocks
===================

- **Device Manager** (``services/device-manager``)  
- **Exam Manager** (``services/exam-manager``)  
- **MRI Sequence Manager** (``services/mri/sequence-manager``)  
- **Patient Manager** (``services/patient-manager``)  
- **User Login Manager** (``services/user-login-manager``)  
- **Workflow Manager** (``services/workflow-manager``)  
- **Web UI** (``scanhub-ui``)

Licensing
=========

ScanHub is **dual-licensed**: GPLv3 **or** a commercial license from BRAIN-LINK UG. Choose GPLv3 for open-source use; choose commercial to embed without copyleft obligations and to obtain premium services.
