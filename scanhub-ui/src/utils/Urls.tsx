/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * Urls.tsx contains the different urls of the backend services.
 */

const origin = typeof window !== 'undefined' ? window.location.origin : 'https://localhost:8443';

const baseUrls = {
  patientService: origin,
  examService: origin,
  workflowManagerService: origin,
  userloginService: origin,
  deviceService: origin,
  nginxUrl: origin
}

export default baseUrls
