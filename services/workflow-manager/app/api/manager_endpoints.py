# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""
Workflow manager endpoints.

TODO: How to handle tasks, and where to trigger the device task?
- There should be one endpoint for task, workflow and exam
- The endpoint processes the list, i.e. all the contained tasks
- Does it help to store an index with each task?

"""
import json
import os
from pathlib import Path
from typing import Annotated, Any
from uuid import UUID

import requests
from dagster import RunConfig
from dagster_graphql import DagsterGraphQLClient, DagsterGraphQLClientError
from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.encoders import jsonable_encoder
from fastapi.security import OAuth2PasswordBearer
from scanhub_libraries.models import (
    AcquisitionLimits,
    AcquisitionTaskOut,
    DAGTaskOut,
    ExamOut,
    ItemStatus,
    PatientOut,
    ResultOut,
    ResultType,
    SetResult,
    TaskType,
    WorkflowOut,
)
from scanhub_libraries.resources import DAG_CONFIG_KEY
from scanhub_libraries.resources.dag_config import DAGConfiguration
from scanhub_libraries.security import get_current_user
from scanhub_libraries.utils import calc_age_from_date

from app.api.dagster_queries import list_dagster_jobs, parse_job_id
from app.api.scanhub_requests import create_blank_result, delete_result, get_result, get_task, set_result, set_task

# Define the URIs for the different managers
EXAM_MANAGER_URI = "http://exam-manager:8000/api/v1/exam"
PATIENT_MANAGER_URI = "http://patient-manager:8100/api/v1/patient"
DEVICE_MANAGER_URI = "http://device-manager:8000/api/v1/device"
WORKFLOW_MANAGER_URI = "http://workflow-manager:8000/api/v1/workflowmanager"
DICOM_BASE_URI = "https://localhost:8443/api/v1/exam/dcm/"
DATA_LAKE_DIR = os.getenv("DATA_LAKE_DIRECTORY")
if DATA_LAKE_DIR is None:   # ensure that DATA_LAKE_DIR is set
    raise OSError("Missing `DATA_LAKE_DIRECTORY` environment variable.")


# Define dagster graphQL client
dg_client = DagsterGraphQLClient("dagster-webserver:3000/dagster", use_https=False)
# Define the API router
router = APIRouter(dependencies=[Depends(get_current_user)])
# Define OAuth2 scheme for token-based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


@router.post("/trigger_task/{task_id}/", tags=["WorkflowManager"])
async def trigger_task(
    task_id: str,
    access_token: Annotated[str, Depends(oauth2_scheme)],
) -> dict[str, Any]:
    """
    Endpoint to trigger a task in the orchestration engine.

    Args:
        task_id (str): The ID of the DAG to be triggered.

    Returns
    -------
        dict: A dictionary containing the response from the orchestration engine.
    """
    headers = {"Authorization": "Bearer " + access_token}

    task = get_task(task_id, access_token)
    print(f"\n>>>>>\nTriggering task: {task.model_dump_json()}\n")

    get_workflow_response = requests.get(f"{EXAM_MANAGER_URI}/workflow/{task.workflow_id}", headers=headers, timeout=3)
    if get_workflow_response.status_code != 200:
        raise HTTPException(status_code=get_workflow_response.status_code, detail="Failed to fetch workflow with id=" + str(task.workflow_id))
    workflow_raw = get_workflow_response.json()
    workflow = WorkflowOut(**workflow_raw)

    get_exam_response = requests.get(f"{EXAM_MANAGER_URI}/{workflow.exam_id}", headers=headers, timeout=3)
    if get_exam_response.status_code != 200:
        raise HTTPException(status_code=get_exam_response.status_code, detail="Failed to fetch exam with id=" + str(workflow.exam_id))
    exam_raw = get_exam_response.json()
    exam = ExamOut(**exam_raw)

    get_patient_response = requests.get(f"{PATIENT_MANAGER_URI}/{exam.patient_id}", headers=headers, timeout=3)
    if get_patient_response.status_code != 200:
        raise HTTPException(status_code=get_patient_response.status_code, detail="Failed to fetch patient with id=" + str(exam.patient_id))
    patient_raw = get_patient_response.json()
    patient = PatientOut(**patient_raw)

    print(f"\n>>>>>\nPatient: {patient.__dict__}\n")

    if task.task_type == TaskType.ACQUISITION:
        return handle_acquisition_task_trigger(task=task, patient=patient, access_token=access_token)

    if task.task_type == TaskType.DAG:
        return handle_dag_task_trigger(task=task, exam_id=str(exam.id), access_token=access_token)

    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED)


def handle_acquisition_task_trigger(
    task: AcquisitionTaskOut, patient: PatientOut, access_token: str,
) -> dict[str, str]:
    """Handle acquisition task trigger.

    Parameters
    ----------
    task
        Acquisition task model
    patient
        Patient model
    access_token
        User access token

    Returns
    -------
        Dictionary with status and data, i.e. success message

    Raises
    ------
    HTTPException
        Internal error if device task could not be triggered.
    """
    task.acquisition_limits = AcquisitionLimits(
        patient_height=int(patient.height),
        patient_weight=int(patient.weight),
        patient_gender=patient.sex,
        patient_age=calc_age_from_date(patient.birth_date),
    )
    task.status = ItemStatus.STARTED
    updated_task = set_task(task.id, task, access_token)
    print("Acquisition task: ", updated_task)
    response = requests.post(
        f"{DEVICE_MANAGER_URI}/start_scan_via_websocket",
        data=json.dumps(updated_task, default=jsonable_encoder),
        headers={"Authorization": "Bearer " + access_token},
        timeout=3,
    )
    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error at starting device task.")
    print("Device task started successfully.")
    return {"status": "success", "data": "Device task started successfully."}


def handle_dag_task_trigger(
    task: DAGTaskOut,
    exam_id: str,
    access_token: str,
):
    """Handle DAG trigger event.

    Parameters
    ----------
    task
        DAG Task to be triggered
    exam_id
        Corresponding exam ID
    access_token
        User access token

    Returns
    -------
        Dictionary with status and data, i.e. success message

    Raises
    ------
    HTTPException
        Missing input
    HTTPException
        Input does not have any result
    HTTPException
        Could not trigger DAG
    """
    task_id = str(task.id)
    print(f"Triggering DAG task with ID: {task_id}")
    try:
        # Get input, i.e. latest result of input task
        if not task.input_task_ids:
            print("Missing task input")
            detail = "DAG task input does not exist."
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail)

        # Collect task input files
        job_inputs = []
        for _id in task.input_task_ids:
            if not (input_task := get_task(str(_id), access_token)).results:
                print("Input task does not have any result.")
                detail = f"No results found for input task {input_task.id}."
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)
            latest_result = sorted(input_task.results, key=lambda r: r.datetime_created, reverse=True)[0]
            for _file in latest_result.files:
                file_path = Path(latest_result.directory) / _file
                if file_path.exists():
                    job_inputs.append(str(file_path))

        # Update the task status to IN_PROGRESS
        task.status = ItemStatus.INPROGRESS
        updated_task = set_task(task.id, task, access_token)

        # Create blank result
        new_result_out = create_blank_result(task_id, access_token)

        # Use internal url and http (not https and port 8443) because callback endpoint is requested from another docker container
        result_directory = f"{DATA_LAKE_DIR}/{str(task.workflow_id)}/{str(task.id)}/{str(new_result_out.id)}/"

        # Trigger dagster job
        job_name, repository, location = parse_job_id(task.dag_id)
        print(f"Triggering job: {job_name} in repository: {repository} at location: {location}")

        resource_cfg = {
            DAG_CONFIG_KEY: DAGConfiguration(
                output_directory=result_directory,
                input_files=job_inputs,
                user_access_token=access_token,
                output_result_id=str(new_result_out.id),
            ),
        }

        try:
            run_id = dg_client.submit_job_execution(
                job_name=job_name,
                repository_location_name=location,
                repository_name=repository,
                run_config=RunConfig(resources=resource_cfg),
            )
        except DagsterGraphQLClientError as exc:
            raise HTTPException(status_code=400, detail=f"Dagster submission failed: {exc}") from exc

        if run_id:
            # Update result
            new_result_out = set_result(
                result_id=str(new_result_out.id),
                payload=SetResult(
                    type=ResultType.DICOM,
                    meta={ "run_id": run_id },
                    directory=result_directory,
                ),
                user_access_token=access_token,
            )
            print(f"Created new result: {new_result_out.model_dump_json()}")
            return {"message": "DAG triggered successfully", "data": run_id}
        # Delete blank result, if run_id does not exist and update task_status
        delete_result(str(new_result_out.id), user_access_token=access_token)
        updated_task.status = ItemStatus.ERROR
        _ = set_task(task.id, updated_task, access_token)
        return {"message": "Failed to start DAG, no run_id..."}
    except Exception as exc:
        print(f"Failed to trigger DAG: {exc}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/result_ready/{result_id}", tags=["WorkflowManager"])
async def callback_results_ready(
    result_id: UUID | str,
    access_token: Annotated[str, Depends(oauth2_scheme)],
    success: bool = Body(..., embed=True),
) -> dict[str, Any]:
    """
    Notify that results are ready via callback endpoint.

    Args:
        dag_id (str): The ID of the DAG.
        access_token (str): The access token for authentication.

    Returns
    -------
        dict: A dictionary containing a success message.
    """
    if not isinstance(result := get_result(result_id, access_token), ResultOut):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Result ready callback received invalid result_id: {result_id.id}",
        )
    if not isinstance(task := get_task(result.task_id, access_token), DAGTaskOut):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Result ready callback received invalid task_id: {result.task_id}",
        )
    # Update task/result depending on success
    if not success:
        task.status = ItemStatus.ERROR
        task.progress = 0
        _ = set_task(task.id, task, access_token)
    else:
        task.status = ItemStatus.FINISHED
        task.progress = 100
        _ = set_task(task.id, task, access_token)

        # Get a list of dicom files from the result directory
        result_dir = Path(result.directory)
        dcm_files = sorted(result_dir.rglob("*.dcm"))
        result.files = [str(_file.name) for _file in dcm_files]

        # Get dicom location in data lake and update meta
        workflow_folder, task_folder, result_folder = result_dir.parts[-3:]
        meta_update = {
            "instance_count": len(dcm_files),
            "instances": [
                f"{DICOM_BASE_URI}{workflow_folder}/{task_folder}/{result_folder}/{_file.name}" for _file in dcm_files
            ],
        }
        if result.meta is not None:
            result.meta.update(meta_update)
        else:
            result.meta = meta_update
        print(f"Updated result: {result.model_dump_json()}")
        _ = set_result(result_id=result.id, payload=result, user_access_token=access_token)
    return {"message": "Results ready notification sent successfully."}


# Test endpoint to upload a file and trigger a DAG
@router.get("/tasks/", tags=["WorkflowManager"])
async def list_available_tasks():
    """Endpoint to list the available tasks from the orchestration engine.

    Returns
    -------
        dict: A dictionary containing the list of available dagster jobs.
    """
    return list_dagster_jobs()
