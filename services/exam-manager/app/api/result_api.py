# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Definition of result API endpoints accessible through swagger UI."""

import struct
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from scanhub_libraries.models import MRDMetaResponse, ResultOut, SetResult, User
from scanhub_libraries.security import get_current_user
from starlette.responses import Response
from fastapi.security import OAuth2PasswordBearer

import os
import tempfile
import zipfile

import httpx
import requests
import app.tools.mrd_provider as mrd
from app import LOG_CALL_DELIMITER
from app.dal import result_dal, task_dal, workflow_dal, exam_dal
from scanhub_libraries.models import PatientOut
from app.tools.dicom_provider import (
    get_p10_dicom_bytes,
    provide_p10_dicom,
    resolve_dicom_path,
)

PREFIX_PATIENT_MANAGER = "http://patient-manager:8100/api/v1/patient"

# Http status codes
# 200 = Ok: GET, PUT
# 201 = Created: POST
# 204 = No Content: Delete
# 404 = Not found

result_router = APIRouter(dependencies=[Depends(get_current_user)])

# Define OAuth2 scheme for token-based authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

@result_router.post("/result", response_model=ResultOut, status_code=201, tags=["results"])
async def create_blank_result(task_id: str | UUID, user: Annotated[User, Depends(get_current_user)]) -> ResultOut:
    """Create a task result.

    Parameters
    ----------
    payload
        Result pydantic input model

    Returns
    -------
        Result pydantic output model

    Raises
    ------
    HTTPException
        404: Creation unsuccessful
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("Creating blank result for task ID:", task_id)
    if task_id is not None:
        task_id = UUID(task_id) if not isinstance(task_id, UUID) else task_id
        if not (task := await task_dal.get_task_data(task_id=task_id)):
            raise HTTPException(status_code=400, detail="Parent (task_id) does not exist.")
        if task.is_template:
            raise HTTPException(status_code=400, detail="Result parent (task) must not be a template.")
    if not (result := await result_dal.add_blank_result_db(task_id=task_id)):
        raise HTTPException(status_code=404, detail="Could not create result")
    result_out = ResultOut(**result.__dict__)
    return result_out


@result_router.get(
    "/result/{result_id}",
    response_model=ResultOut,
    status_code=200,
    tags=["results"],
)
async def get_result(result_id: UUID | str, user: Annotated[User, Depends(get_current_user)]) -> ResultOut:
    """Get an existing result.

    Parameters
    ----------
    result_id
        Id of the result to be returned

    Returns
    -------
        Result pydantic output model

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("task_id:", result_id)
    try:
        _id = UUID(result_id) if not isinstance(result_id, UUID) else result_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Badly formed result_id.")
    if not (result := await result_dal.get_result_db(result_id=_id)):
        raise HTTPException(status_code=404, detail="Result not found")
    return ResultOut(**result.__dict__)


@result_router.get(
    "/result/all/{task_id}",
    response_model=list[ResultOut],
    status_code=200,
    tags=["results"],
)
async def get_all_task_results(
    task_id: UUID | str, user: Annotated[User, Depends(get_current_user)]
) -> list[ResultOut]:
    """Get all existing results of a certain task.

    Parameters
    ----------
    task_id
        Id of parental task

    Returns
    -------
        List of task pydantic output model
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("task_id:", task_id)
    _id = UUID(task_id) if not isinstance(task_id, UUID) else task_id
    if not (tasks := await result_dal.get_all_results_db(task_id=_id)):
        # Don't raise exception here, list might be empty.
        return []
    result = [ResultOut(**task.__dict__) for task in tasks]
    print("List of tasks: ", result)
    return result


@result_router.delete("/result/{result_id}", response_model={}, status_code=204, tags=["results"])
async def delete_result(result_id: UUID | str, user: Annotated[User, Depends(get_current_user)]) -> None:
    """Delete a task.

    Parameters
    ----------
    task_id
        Id of the task to be deleted

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("result_id:", result_id)
    _id = UUID(result_id) if not isinstance(result_id, UUID) else result_id
    if not await result_dal.delete_result_db(result_id=_id):
        message = "Could not delete result, either because it does not exist, or for another reason."
        raise HTTPException(status_code=404, detail=message)


@result_router.put("/result/{result_id}", response_model=ResultOut, status_code=200, tags=["results"])
async def set_result(
    result_id: UUID | str, payload: SetResult, user: Annotated[User, Depends(get_current_user)]
) -> ResultOut:
    """Update an existing result.

    Parameters
    ----------
    result_id
        Id of the result to be updated
    payload
        Result pydantic base model/dict
        If this is the pydantic ResultBase model, only fields in the base model can be updated.

    Returns
    -------
        Task pydantic output model

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("result_id:", result_id)
    _id = UUID(result_id) if not isinstance(result_id, UUID) else result_id
    if not (result_updated := await result_dal.update_result_db(result_id=_id, payload=payload)):
        message = "Could not update result, either because it does not exist, or for another reason."
        raise HTTPException(status_code=404, detail=message)
    print("Updated result: ", result_updated.__dict__)
    return ResultOut(**result_updated.__dict__)


@result_router.get(
    "/dcm/{workflow_id}/{task_id}/{result_id}/{filename}",
    operation_id="get-dicom",
    responses={200: {"content": {"application/dicom": {}}}},
    tags=["results", "data"],
    summary="Get DICOM result",
)
async def get_dicom(
    workflow_id: str, task_id: str, result_id: str, filename: str, user: Annotated[User, Depends(get_current_user)]
) -> Response:
    """
    Serve a DICOM instance.

      - If it's already a DICOM Part-10 file → return FileResponse (supports HTTP Range).
      - Else → convert to Part-10 in memory and return StreamingResponse.

    Headers:
      - 'application/dicom' content type
      - inline disposition (avoid forced download)
      - 'Cache-Control: no-transform' to prevent proxies from gzipping (which breaks Range offsets)
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("RETURNING DICOM FILE...")

    dicom_path = resolve_dicom_path(workflow_id, task_id, result_id, filename)
    try:
        return provide_p10_dicom(dicom_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to provide P10 DICOM: {e}")


@result_router.post(
    "/xnat/upload/{workflow_id}/{task_id}/{result_id}/{filename}",
    operation_id="upload-to-xnat",
    tags=["results", "data"],
    summary="Upload DICOM result to XNAT",
)
async def upload_to_xnat(
    workflow_id: str, task_id: str, result_id: str, filename: str, access_token: Annotated[str, Depends(oauth2_scheme)]
) -> dict:
    """Upload a DICOM file to XNAT test database."""
    print(LOG_CALL_DELIMITER)
    print(f"UPLOADING {filename} TO XNAT...")

    headers = {"Authorization": "Bearer " + access_token}
    dicom_path = resolve_dicom_path(workflow_id, task_id, result_id, filename)

    xnat_host = os.getenv("XNAT_HOST", "http://host.docker.internal:8081")
    xnat_user = os.getenv("XNAT_USER", "admin")
    xnat_pass = os.getenv("XNAT_PASSWORD", "admin")
    project_id = os.getenv("XNAT_PROJECT_ID", "A4IM")

    # Fetch workflow and exam to get actual patient info
    workflow_uuid = UUID(workflow_id) if not isinstance(workflow_id, UUID) else workflow_id
    workflow = await workflow_dal.get_workflow_data(workflow_uuid)
    if not workflow:
        raise HTTPException(status_code=404, detail=f"Workflow not found: {workflow_id}")

    exam = await exam_dal.get_exam_data(workflow.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail=f"Exam not found for workflow: {workflow_id}")

    # Fetch patient details from patient-manager
    get_patient_response = requests.get(f"{PREFIX_PATIENT_MANAGER}/{exam.patient_id}", headers=headers, timeout=3)
    if get_patient_response.status_code != 200:
        raise HTTPException(status_code=get_patient_response.status_code, detail="Failed to fetch patient with id=" + str(exam.patient_id))
    patient_raw = get_patient_response.json()
    patient = PatientOut(**patient_raw)

    patient_name = f"{patient.first_name}^{patient.last_name}"
    subject_id = str(patient.patient_id)
    session_id = str(exam.id)

    upload_url = (
        f"{xnat_host}/data/services/import"
        f"?project={project_id}&subject={subject_id}&session={session_id}&type=DICOM-zip&quarantine=false&overwrite=true"
    )

    try:
        dicom_bytes = get_p10_dicom_bytes(
            dicom_path, 
            patient_id=subject_id, 
            patient_name=patient_name,
            study_description=session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to prepare DICOM for XNAT: {e}")

    with tempfile.NamedTemporaryFile(suffix=".zip", delete=True) as tmp_zip:
        with zipfile.ZipFile(tmp_zip, "w") as zf:
            zf.writestr(dicom_path.name, dicom_bytes)

        tmp_zip.seek(0)
        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                files = {"file": (f"{filename}.zip", tmp_zip, "application/zip")}
                response = await client.post(
                    upload_url,
                    auth=(xnat_user, xnat_pass),
                    files=files,
                )
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"XNAT upload request failed: {e}")

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"XNAT upload failed: {response.status_code} - {response.text}",
        )

    return {"status": "success", "xnat_response": response.text}



@result_router.get(
    "/mrd/{workflow_id}/{task_id}/{result_id}/meta",
    response_model=MRDMetaResponse,
    operation_id="get-mrd-meta",
    tags=["results", "data"],
    summary="Get ISMRMRD metadata (indexed acquisitions)",
)
def get_meta(workflow_id: str, task_id: str, result_id: str) -> MRDMetaResponse:
    """Get MRD meta info."""
    try:
        path = mrd.locate_mrd(workflow_id, task_id, result_id)
    except FileNotFoundError:
        raise HTTPException(404, "MRD file not found")

    return MRDMetaResponse(
        workflow_id=workflow_id,
        task_id=task_id,
        result_id=result_id,
        dtype="fc32",
        acquisitions=mrd.build_index_meta(path),
    )


@result_router.get(
    "/mrd/{workflow_id}/{task_id}/{result_id}/data",
    operation_id="getMRD",
    tags=["results", "data"],
    summary="Get MRD (binary, interleaved float32 complex)",
    responses={
        200: {
            "description": "Binary packet stream with a tiny header + payload(s).",
            "content": {
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"},
                },
            },
        },
    },
)
def get_mrd_binary(
    workflow_id: str,
    task_id: str,
    result_id: str,
    ids: str = Query(..., description="IDs: '0,1,10-20,40-50:2'"),
    coil_idx: int = Query(0, ge=0, description="Coil index"),
    stride: int = Query(1, ge=1, description="Decimate samples by stride"),
):
    """Get MRD as binary stream."""
    try:
        path = mrd.locate_mrd(workflow_id, task_id, result_id)
    except FileNotFoundError:
        raise HTTPException(404, "MRD file not found")

    try:
        acq_ids = mrd.parse_ids(ids)
    except Exception as e:
        raise HTTPException(400, f"Bad params: {e}")

    arrays = mrd.load_acquisitions_slices(path, acq_ids, coil_idx=coil_idx, stride=stride)

    def gen():
        # Packet: [u32 'ISMR'][u16 ver=1][u16 n]
        magic, ver = 0x49534D52, 1
        ids_list = list(acq_ids)
        yield struct.pack("<IHH", magic, ver, len(ids_list))
        for aid, arr in zip(ids_list, arrays):
            nsamp, _ = arr.shape
            payload = arr.tobytes(order="C")
            # [u32 acqId][u16 nCoils][u16 dtype=1(fc32)][u32 nSamples][u32 byteLen]
            yield struct.pack("<IHHII", int(aid), 1, 1, int(nsamp), len(payload))
            view = memoryview(payload)
            step = 1 << 20
            for i in range(0, len(payload), step):
                yield view[i:i+step]

    return StreamingResponse(gen(), media_type="application/octet-stream")
@result_router.get(
    "/mrd/{workflow_id}/{task_id}/{result_id}/download",
    operation_id="downloadMRD",
    tags=["results", "data"],
    summary="Download MRD file",
    responses={
        200: {
            "description": "The raw MRD file.",
            "content": {
                "application/octet-stream": {
                    "schema": {"type": "string", "format": "binary"},
                },
            },
        },
    },
)
async def download_mrd(
    workflow_id: str,
    task_id: str,
    result_id: str,
    user: Annotated[User, Depends(get_current_user)],
):
    """Download the full MRD file."""
    try:
        path = mrd.locate_mrd(workflow_id, task_id, result_id)
    except FileNotFoundError:
        raise HTTPException(404, "MRD file not found")

    return FileResponse(
        path=path,
        media_type="application/octet-stream",
        filename=path.name,
    )
