"""
Handler for exam requests.

This module defines functions to interact with the exam manager service,
including fetching tasks, sequences, and results. It provides a way to
create and update acquisition tasks and results, ensuring that the data
is properly formatted and authenticated.

Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
"""
import json

import requests
from fastapi import HTTPException
from fastapi.encoders import jsonable_encoder
from scanhub_libraries.models import AcquisitionTaskOut, MRISequenceOut, ResultOut, SetResult

TASK_URI = "http://exam-manager:8000/api/v1/exam/task"
RESULT_URI = "http://exam-manager:8000/api/v1/exam/result"
SEQUENCE_URI = "http://exam-manager:8000/api/v1/exam/sequence"


def get_task(task_id: str, user_access_token: str) -> AcquisitionTaskOut:
    """
    Fetch acquisition task by ID from the exam manager service.

    Args
    ----
        task_id (str): The unique identifier of the task to retrieve.
        user_access_token (str): The user's access token for authentication.

    Returns
    -------
        AcquisitionTaskOut | None: The acquisition task object if found and valid.

    Raises
    ------
        HTTPException: If the task is not found (404) or is not an acquisition task (400).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    get_task_response = requests.get(f"{TASK_URI}/{task_id}", headers=headers, timeout=3)
    if get_task_response.status_code != 200:
        raise HTTPException(status_code=404, detail="Task not found")
    task_raw = get_task_response.json()
    if not task_raw["task_type"] == "ACQUISITION":
        raise HTTPException(status_code=400, detail="Task is not an acquisition task")
    return AcquisitionTaskOut(**task_raw)


def set_task(task_id: str, payload: AcquisitionTaskOut, user_access_token: str) -> AcquisitionTaskOut:
    """
    Update an acquisition task on the task service with the provided payload.

    Parameters
    ----------
    task_id : str
        The unique identifier of the task to update.
    payload : AcquisitionTaskOut
        The updated task data to send to the task service.
    user_access_token : str
        The access token used for authorization with the task service.

    Returns
    -------
    AcquisitionTaskOut
        The updated task object returned from the task service.

    Raises
    ------
    HTTPException
        If the task update fails (e.g. non-200 response from the task service).
    """
    update_task_response = requests.put(
        f"{TASK_URI}/{task_id}",
        data=json.dumps(payload, default=jsonable_encoder),
        headers={"Authorization": "Bearer " + user_access_token},
        timeout=3
    )
    if update_task_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Error updating task")
    return AcquisitionTaskOut(**update_task_response.json())


def get_sequence(sequence_id: str, user_access_token: str) -> MRISequenceOut:
    """
    Fetch MRI sequence by ID from the exam manager service.

    Args
    ----
        sequence_id (str): The unique identifier of the sequence to retrieve.
        user_access_token (str): The user's access token for authentication.

    Returns
    -------
        dict: The MRI sequence object if found.

    Raises
    ------
        HTTPException: If the sequence is not found (404).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    get_sequence_response = requests.get(f"{SEQUENCE_URI}/{sequence_id}", headers=headers, timeout=3)
    if get_sequence_response.status_code != 200:
        raise HTTPException(status_code=404, detail="Sequence not found")
    return MRISequenceOut(**get_sequence_response.json())


def create_blank_result(task_id: str, user_access_token: str) -> ResultOut:
    """
    Create a blank result in the exam manager service.

    Returns
    -------
        ResultOut: The created blank result object.

    Raises
    ------
        HTTPException: If the result creation fails (status code not 201).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    blank_result_response = requests.post(
        RESULT_URI, params={"task_id": task_id}, headers=headers, timeout=3
    )
    if blank_result_response.status_code != 201:
        raise HTTPException(status_code=404, detail="Could not create blank result.")
    return ResultOut(**blank_result_response.json())


def delete_blank_result(result_id: str, user_access_token: str) -> None:
    """
    Delete a blank result in the exam manager service.

    Args
    ----
        result_id (str): The unique identifier of the result to delete.
        user_access_token (str): The user's access token for authentication.

    Returns
    -------
        None

    Raises
    ------
        HTTPException: If the result deletion fails (status code not 204).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    delete_response = requests.delete(
        RESULT_URI, params={"result_id": result_id}, headers=headers, timeout=3
    )
    if delete_response.status_code != 204:
        raise HTTPException(status_code=404, detail="Could not delete result.")


def set_result(result_id: str, payload: SetResult, user_access_token: str) -> ResultOut:
    """
    Update a result in the exam manager service.

    Args
    ----
        result_id (str): The unique identifier of the result to update.
        payload (SetResult): The data to update the result with.
        user_access_token (str): The user's access token for authentication.

    Returns
    -------
        ResultOut: The updated result object.

    Raises
    ------
        HTTPException: If the result update fails (status code not 200).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    update_result_response = requests.put(
        f"{RESULT_URI}/{result_id}",
        data=json.dumps(payload, default=jsonable_encoder),
        headers=headers,
        timeout=3
    )
    if update_result_response.status_code != 200:
        raise HTTPException(status_code=400, detail="Error updating result")
    return ResultOut(**update_result_response.json())


def get_result(result_id: str, user_access_token: str) -> ResultOut:
    """
    Fetch result by ID from the exam manager service.

    Args
    ----
        result_id (str): The unique identifier of the result to retrieve.
        user_access_token (str): The user's access token for authentication.

    Returns
    -------
        ResultOut | None: The result object if found and valid.

    Raises
    ------
        HTTPException: If the result is not found (404).
    """
    headers = {"Authorization": "Bearer " + user_access_token}
    get_result_response = requests.get(f"{RESULT_URI}/{result_id}", headers=headers, timeout=3)
    if get_result_response.status_code != 200:
        raise HTTPException(status_code=404, detail="Result not found")
    return ResultOut(**get_result_response.json())

