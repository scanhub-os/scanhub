/**
 * Copyright (C) 2024, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
 * SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
 *
 * api.tsx contains instances of the different apis.
 */
import { PatientsApi, HealthApi as PatientManagerHealthApi } from './openapi/generated-client/patient'
import { ExamsApi, WorkflowsApi, TasksApi, ResultsApi, MriSequencesApi, DataApi, HealthApi as ExamManagerHealthApi } from './openapi/generated-client/exam'
import { WorkflowManagerApi, HealthApi as WorkflowManagerHealthApi } from './openapi/generated-client/workflowmanager'
import { UserApi, LoginApi, HealthApi as UserLoginManagerHealthApi } from './openapi/generated-client/userlogin'
import { DevicesApi, HealthApi as DeviceManagerHealthApi } from './openapi/generated-client/device'
import baseUrls from './utils/Urls'


export const patientApi = new PatientsApi(undefined, baseUrls.patientService)
export const patientManagerHealthApi = new PatientManagerHealthApi(undefined, baseUrls.patientService)

export const examApi = new ExamsApi(undefined, baseUrls.examService)
export const workflowsApi = new WorkflowsApi(undefined, baseUrls.examService)
export const taskApi = new TasksApi(undefined, baseUrls.examService)
export const resultApi = new ResultsApi(undefined, baseUrls.examService)
export const sequenceApi = new MriSequencesApi(undefined, baseUrls.examService)
export const dataApi = new DataApi(undefined, baseUrls.examService)
export const examManagerHealthApi = new ExamManagerHealthApi(undefined, baseUrls.examService)

export const workflowManagerApi = new WorkflowManagerApi(undefined, baseUrls.workflowManagerService)
export const workflowManagerHealthApi = new WorkflowManagerHealthApi(undefined, baseUrls.workflowManagerService)

export const loginApi = new LoginApi(undefined, baseUrls.userloginService)
export const userApi = new UserApi(undefined, baseUrls.userloginService)
export const userLoginManagerHealthApi = new UserLoginManagerHealthApi(undefined, baseUrls.userloginService)

export const deviceApi = new DevicesApi(undefined, baseUrls.deviceService)
export const deviceManagerHealthApi = new DeviceManagerHealthApi(undefined, baseUrls.deviceService)
