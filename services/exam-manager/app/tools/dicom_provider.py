"""Helper functions for dicom."""

import io
import os
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydicom import dcmread
from pydicom.dataset import FileMetaDataset
from pydicom.filebase import DicomBytesIO
from pydicom.uid import (
    ExplicitVRBigEndian,
    ExplicitVRLittleEndian,
    ImplicitVRLittleEndian,
    generate_uid,
)
from starlette.responses import Response

DATA_LAKE_DIR = Path(os.getenv("DATA_LAKE_DIRECTORY", "/data")).resolve()


def resolve_dicom_path(workflow_id: str, task_id: str, result_id: str, filename: str) -> Path:
    """Build and validate the requested file path, prevent traversal, return (path, safe_name)."""
    safe_name = Path(filename).name  # strip any path components
    requested = (DATA_LAKE_DIR / workflow_id / task_id / result_id / safe_name).resolve()

    # Ensure request stays under BASE
    try:
        if not requested.is_relative_to(DATA_LAKE_DIR):
            raise ValueError
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid file path")

    if not requested.exists():
        raise HTTPException(status_code=404, detail=f"Dicom file does not exist: {requested}")

    return requested


def get_p10_dicom_bytes(
    dicom_path: str | Path,
    patient_id: str | None = None,
    patient_name: str | None = None,
    study_description: str | None = None,
) -> bytes:
    """
    Ensure the dataset at `path` is a valid DICOM Part-10 file and return its bytes.

    - If not Part-10 or missing metadata, create minimal File Meta + 128-byte preamble.
    - Ensures mandatory DICOM tags (SOP Class UID, SOP Instance UID, etc.) are present.
    - If `patient_id` or `study_description` are provided, they override the values in the dataset.
    """
    path = Path(dicom_path)

    # Read whatever is there; force=True accepts raw datasets
    ds = dcmread(str(path), force=True)

    # Ensure mandatory tags are in the dataset
    if not getattr(ds, "SOPClassUID", None):
        # Default to MR Image Storage
        ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.4"
    if not getattr(ds, "SOPInstanceUID", None):
        ds.SOPInstanceUID = generate_uid()

    # Generic mandatory tags for XNAT sanity
    if not getattr(ds, "Modality", None):
        ds.Modality = "MR"

    # Overrides or defaults for Patient
    ds.PatientID = patient_id if patient_id else getattr(ds, "PatientID", "ScanHub_001")
    ds.PatientName = patient_name if patient_name else getattr(ds, "PatientName", "ScanHub_001")

    # Overrides or defaults for Study
    if study_description:
        ds.StudyDescription = study_description
    elif not getattr(ds, "StudyDescription", None):
        ds.StudyDescription = "ScanHub_Reconstruction"
    if not getattr(ds, "StudyInstanceUID", None):
        ds.StudyInstanceUID = generate_uid()
    if not getattr(ds, "SeriesInstanceUID", None):
        ds.SeriesInstanceUID = generate_uid()
    if not getattr(ds, "StudyDate", None):
        ds.StudyDate = datetime.now().strftime("%Y%m%d")
    if not getattr(ds, "StudyTime", None):
        ds.StudyTime = datetime.now().strftime("%H%M%S")
    if not getattr(ds, "ContentDate", None):
        ds.ContentDate = ds.StudyDate
    if not getattr(ds, "ContentTime", None):
        ds.ContentTime = ds.StudyTime

    # Sync to File Meta
    if not getattr(ds, "file_meta", None):
        ds.file_meta = FileMetaDataset()

    ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
    ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID

    if not getattr(ds.file_meta, "TransferSyntaxUID", None):
        if hasattr(ds, "is_little_endian") and hasattr(ds, "is_implicit_VR"):
            ds.file_meta.TransferSyntaxUID = (
                ImplicitVRLittleEndian
                if ds.is_little_endian and ds.is_implicit_VR
                else ExplicitVRLittleEndian
                if ds.is_little_endian
                else ExplicitVRBigEndian
            )
        else:
            ds.file_meta.TransferSyntaxUID = ExplicitVRLittleEndian

    # Add the 128-byte preamble to make it Part-10
    ds.preamble = b"\x00" * 128

    # Serialize a clean Part-10 file into memory
    bio = DicomBytesIO()
    ds.save_as(bio, write_like_original=False)
    data = bio.getvalue()

    if len(data) < 132 or data[128:132] != b"DICM":
        raise ValueError("Produced bytes are not valid DICOM Part-10 format")

    return data


def provide_p10_dicom(dicom_path: str | Path) -> Response:
    """
    Ensure the dataset at `path` is a valid DICOM Part-10 file.

    - If already Part-10, return FileResponse
    - Else → convert to Part-10 in memory and return StreamingResponse.
    """
    path = Path(dicom_path)

    # If already Part-10, return raw bytes
    with path.open("rb") as f:
        head = f.read(132)
    # Check if header is P10
    if len(head) >= 132 and head[128:132] == b"DICM":
        # FastAPI's FileResponse automatically handles Range requests
        return FileResponse(
            path=path,
            media_type="application/dicom",
            filename=path.name,
            headers={
                "X-Content-Type-Options": "nosniff",
                "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
            },
        )

    try:
        data = get_p10_dicom_bytes(path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to produce P10 DICOM: {e}")

    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/dicom",
        headers={
            "Content-Disposition": f'inline; filename="{path.name}"',
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0, no-transform",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )
