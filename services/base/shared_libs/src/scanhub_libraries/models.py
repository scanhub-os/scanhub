"""Pydantic models of ScanHub.

Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
"""
from datetime import date, datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# ----------------------------------------
# General
# ----------------------------------------

class XYZ(BaseModel):
    """Pydantic definition of coordinates."""

    x: float
    y: float
    z: float

# ----------------------------------------
# Enums
# ----------------------------------------

class Gender(str, Enum):
    """Pydantic definition of genders."""

    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    NOT_GIVEN = "NOT_GIVEN"


class DeviceStatus(str, Enum):
    """Pydantic definition of a commands."""

    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"
    BUSY = "BUSY"
    ERROR = "ERROR"


class CalibrationType(str, Enum):
    """Pydantic definition of calibration methods."""

    NONE = "no"
    ALL = "all"
    FLIPANGLE = "flip-angle"
    FREQUENCY = "frequency"
    SHIMS = "shims"


class ItemStatus(str, Enum):
    """Task status enum."""

    NEW = "NEW"
    UPDATED = "UPDATED"
    STARTED = "STARTED"
    FINISHED = "FINISHED"
    ERROR = "ERROR"
    INPROGRESS = "INPROGRESS"


class TaskType(str, Enum):
    """Task type enum."""

    ACQUISITION = "ACQUISITION"
    DAG = "DAG"
    # DAG_TASK has one of the following subtypes
    RECONSTRUCTION = "RECONSTRUCTION"
    PROCESSING = "PROCESSING"


class ResultType(str, Enum):
    """Result type enum."""

    DICOM = "DICOM"
    MRD = "MRD"
    NPY = "NUMPY"
    CALIBRATION = "CALIBRATION"
    NOT_SET = "NOT_SET"


class UserRole(Enum):
    """User role enum."""

    admin = "admin"
    medical = "medical"
    scientist = "scientist"
    engineer = "engineer"

# ----------------------------------------
# Device management
# ----------------------------------------

class DeviceCreationRequest(BaseModel):
    """Device registration request pydantic model.

    (to be sent by user first adding the device to the platform).
    """

    model_config = ConfigDict(extra="ignore")

    name: str
    description: str
    status: DeviceStatus | None = None


class DeviceDetails(BaseModel):
    """Device creation request pydantic model."""

    model_config = ConfigDict(extra="ignore")

    device_name: str | None = None
    serial_number: str | None = None
    manufacturer: str | None = None
    modality: str | None = None
    status: DeviceStatus | None = None
    site: str | None = None
    parameter: dict | None = None


class DeviceOut(DeviceCreationRequest, DeviceDetails):
    """Device pydantic output model."""

    id: UUID
    datetime_created: datetime
    datetime_updated: datetime | None = None


# ----------------------------------------
# Exam management
# ----------------------------------------

class BaseMRISequence(BaseModel):
    """Base model for MRI sequence."""

    model_config = ConfigDict(extra="ignore")

    name: str
    description: str
    sequence_type: str
    tags: list[str] = []


class MRISequenceOut(BaseMRISequence):
    """Output model for MRI sequence."""

    # Mongo db creates an object _id attribute, which is not a UUID
    id: str = Field(alias="_id")
    created_at: datetime
    updated_at: datetime | None = None
    seq_file: Any
    seq_file_extension: str | None = None
    xml_file: Any | None = None
    xml_file_extension: str | None = None


class BaseResult(BaseModel):
    """Result model."""

    model_config = ConfigDict(extra="ignore")
    task_id: UUID


class SetResult(BaseModel):
    """Update result model."""

    model_config = ConfigDict(extra="ignore")
    type: ResultType
    directory: str
    files: list[str] = []
    meta: dict | None = None


class ResultOut(BaseResult, SetResult):
    """Result output model."""

    id: UUID
    datetime_created: datetime


class BaseTask(BaseModel):
    """Task base model."""

    model_config = ConfigDict(extra="ignore")

    workflow_id: UUID | None = None
    name: str
    description: str
    task_type: TaskType
    destination: str
    status: ItemStatus
    progress: int
    is_template: bool


class TaskOut(BaseTask):
    """Task output model."""

    id: UUID
    creator: str
    datetime_created: datetime
    datetime_updated: datetime | None = None
    results: list[ResultOut]


class AcquisitionParameter(BaseModel):
    """Pydantic definition of acquisition parameters."""

    fov_scaling: XYZ
    fov_offset: XYZ
    fov_rotation: XYZ


class BaseAcquisitionTask(BaseTask):
    """Represents a task for data acquisition in the system."""

    task_type: Literal[TaskType.ACQUISITION]
    device_id: UUID | None = None
    calibration: CalibrationType = CalibrationType.NONE
    sequence_id: str | None = None    # sequence ID is a mongo db ObjectId, which is not a UUID
    acquisition_parameter: AcquisitionParameter | None = None


class AcquisitionLimits(BaseModel):
    """Pydantic definition of AcquisitionLimits."""

    patient_height: int
    patient_weight: int
    patient_gender: Gender = Field(Gender.NOT_GIVEN)
    patient_age: int


class AcquisitionTaskOut(TaskOut, BaseAcquisitionTask):
    """Acquisition Task output model."""

    acquisition_limits: AcquisitionLimits | None = None


class AcquisitionPayload(AcquisitionTaskOut):
    """Acquisition Task payload model."""

    mrd_header: str | None = None
    sequence: MRISequenceOut
    access_token: str
    device_parameter: dict


class BaseDAGTask(BaseTask):
    """Workflow task model."""

    task_type: Literal[TaskType.DAG]
    dag_type: Literal[TaskType.RECONSTRUCTION, TaskType.PROCESSING]
    dag_id: str
    input_task_ids: list[UUID] = []
    parameter: dict | None = None


class DAGTaskOut(TaskOut, BaseDAGTask):
    """Workflow Task output model."""


class DagsterJobConfiguration(BaseModel):
    """Configuration for a Dagster job."""

    model_config = ConfigDict(extra="ignore")

    callback_url: str | None = None
    input_path: str
    output_path: str


class BaseWorkflow(BaseModel):
    """Workflow base model."""

    model_config = ConfigDict(extra="ignore")

    exam_id: UUID | None = None
    name: str
    description: str
    comment: str | None = None
    status: ItemStatus
    is_template: bool


class WorkflowOut(BaseWorkflow):
    """Workflow output model."""

    id: UUID
    creator: str
    datetime_created: datetime
    datetime_updated: datetime | None = None
    tasks: list[AcquisitionTaskOut | DAGTaskOut]


class BaseExam(BaseModel):
    """Exam base model."""

    model_config = ConfigDict(extra="ignore")

    patient_id: UUID | None = None
    name: str
    description: str
    indication: str | None = None
    comment: str | None = None
    status: ItemStatus
    is_template: bool


class ExamOut(BaseExam):
    """Exam output model."""

    id: UUID
    creator: str
    datetime_created: datetime
    datetime_updated: datetime | None = None
    workflows: list[WorkflowOut]


# ----------------------------------------
# User management
# ----------------------------------------

class User(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: str | None = None
    role: UserRole
    # access_token is a standardized name in OAuth2, don't change it
    access_token: str
    # token_type is a standardized name in OAuth2, don't change it
    # token_type should most of the time be "bearer" as standardized in OAuth2
    # when adding new user, token_type is "password" and access_token contains password
    token_type: str
    last_activity_unixtime: int | None = None
    last_login_unixtime: int | None = None


class PasswordUpdateRequest(BaseModel):
    password_of_requester: str                 # the password of the user that sends the request
    username_to_change_password_for: str       # the username of the user whose password is set
    newpassword: str                           # the new password


# ----------------------------------------
# Patient management
# ----------------------------------------

class BasePatient(BaseModel):
    """Patient pydantic base model."""

    model_config = ConfigDict(extra="ignore")

    first_name: str
    last_name: str
    birth_date: date
    sex: Gender
    height: float
    weight: float
    issuer: str
    status: ItemStatus = ItemStatus.NEW
    comment: str | None = None


class PatientOut(BasePatient):
    """Patient pydantic output model."""

    patient_id: UUID = Field(alias="id")
    datetime_created: datetime
    datetime_updated: datetime | None = None


# ----------------------------------------
# Data models
# ----------------------------------------


class MRDAcquisitionInfo(BaseModel):
    """ISMRM raw data / (ISMR)MRD acquisition info."""

    acquisition_id: int = Field(..., ge=0)
    num_samples: int = Field(..., ge=1)
    num_coils: int = Field(..., ge=1)
    dwell_time: float


class MRDMetaResponse(BaseModel):
    """ISMRM raw data / (ISMR)MRD meta data response."""

    workflow_id: str
    task_id: str
    result_id: str
    dtype: str = "fc32" # float32 complex, interleaved (Re,Im)
    acquisitions: list[MRDAcquisitionInfo] = []
