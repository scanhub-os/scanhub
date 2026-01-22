# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial
"""Database file for the MRI sequence manager service."""

import datetime
import os
import uuid

from pydantic import BaseModel
from scanhub_libraries.models import AcquisitionLimits, AcquisitionParameter, ItemStatus, ResultType, TaskType, CalibrationType
from sqlalchemy import JSON, ForeignKey, String, create_engine, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID, JSONB
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.ext.automap import automap_base
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


# Create base for exam and workflow table
class Base(DeclarativeBase):
    """Declarative base class."""

    def update(self, data: BaseModel) -> None:
        """Update a exam entry.

        Parameters
        ----------
        data
            Data to be written
        """
        for key, value in data.model_dump().items():
            setattr(self, key, value)


postgres_user_filepath = "/run/secrets/scanhub_database_postgres_user"
postgres_password_filepath = "/run/secrets/scanhub_database_postgres_password"  # noqa: S105
postgres_db_name_filepath = "/run/secrets/scanhub_database_postgres_db_name"
if (
    os.path.exists(postgres_user_filepath)
    and os.path.exists(postgres_password_filepath)
    and os.path.exists(postgres_db_name_filepath)
):
    with open(postgres_user_filepath) as file:
        postgres_user = file.readline().strip()
    with open(postgres_password_filepath) as file:
        postgres_password = file.readline().strip()
    with open(postgres_db_name_filepath) as file:
        postgres_db_name = file.readline().strip()
    db_uri = f"postgresql://{postgres_user}:{postgres_password}@scanhub-database/{postgres_db_name}"
    db_uri_async = f"postgresql+asyncpg://{postgres_user}:{postgres_password}@scanhub-database/{postgres_db_name}"
    engine = create_engine(db_uri, echo=False)
    # Create async engine and session, echo=True generates console output
    async_engine = create_async_engine(db_uri_async, future=True, echo=False, isolation_level="AUTOCOMMIT")
    async_session = async_sessionmaker(async_engine, expire_on_commit=False)
else:
    raise RuntimeError("Database secrets for connection missing.")


def init_db() -> None:
    """Initialize the database."""
    Base.metadata.create_all(engine)


class Exam(Base):
    """Abstract exam ORM model."""

    __tablename__ = "exam"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    creator: Mapped[str] = mapped_column(nullable=False)
    datetime_created: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now()  # pylint: disable=not-callable
    )
    datetime_updated: Mapped[datetime.datetime] = mapped_column(
        onupdate=func.now(),
        nullable=True,  # pylint: disable=not-callable
    )
    workflows: Mapped[list["Workflow"]] = relationship(lazy="selectin")

    patient_id: Mapped[uuid.UUID] = mapped_column(nullable=True)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
    indication: Mapped[str] = mapped_column(nullable=True)
    patient_height_cm: Mapped[int] = mapped_column(nullable=True)
    patient_weight_kg: Mapped[int] = mapped_column(nullable=True)
    comment: Mapped[str] = mapped_column(nullable=True)
    status: Mapped[ItemStatus] = mapped_column(nullable=False)
    is_template: Mapped[bool] = mapped_column(nullable=False, default=True)


class Workflow(Base):  # TBD: rename to "Workflow"
    """Workflow ORM model."""

    __tablename__ = "workflow"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    creator: Mapped[str] = mapped_column(nullable=False)
    datetime_created: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now()  # pylint: disable=not-callable
    )
    datetime_updated: Mapped[datetime.datetime] = mapped_column(
        onupdate=func.now(),
        nullable=True,  # pylint: disable=not-callable
    )
    tasks: Mapped[list["Task"]] = relationship(
        "Task", lazy="selectin", cascade="all, delete-orphan", order_by="Task.position"
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exam.id"), nullable=True)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
    comment: Mapped[str] = mapped_column(nullable=True)
    status: Mapped[ItemStatus] = mapped_column(nullable=False)
    is_template: Mapped[bool] = mapped_column(nullable=False, default=True)


class Task(Base):
    """Abstract task ORM model."""

    __tablename__ = "task"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    creator: Mapped[str] = mapped_column(nullable=False)
    datetime_created: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now()  # pylint: disable=not-callable
    )
    datetime_updated: Mapped[datetime.datetime] = mapped_column(
        onupdate=func.now(),
        nullable=True,  # pylint: disable=not-callable
    )
    workflow_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflow.id"), nullable=True)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)
    task_type: Mapped[TaskType] = mapped_column(nullable=False)
    destination: Mapped[str] = mapped_column(nullable=False, default="")
    status: Mapped[ItemStatus] = mapped_column(nullable=False)
    progress: Mapped[int] = mapped_column(nullable=False)
    is_template: Mapped[bool] = mapped_column(nullable=False, default=True)
    position: Mapped[int] = mapped_column(nullable=False, default=0)
    results: Mapped[list["Result"]] = relationship("Result", lazy="selectin", cascade="all, delete-orphan")

    __mapper_args__ = {
        "polymorphic_identity": "task",
        "polymorphic_on": "task_type",
        "with_polymorphic": "*",
    }


class AcquisitionTask(Task):
    """Acquisition task ORM model."""

    __tablename__ = "acquisition_task"
    __mapper_args__ = {
        "polymorphic_identity": "ACQUISITION",
    }
    id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("task.id", ondelete="CASCADE"), primary_key=True, default=uuid.uuid4
    )
    sequence_id: Mapped[str] = mapped_column(nullable=True)
    calibration: Mapped[list[CalibrationType]] = mapped_column(
        type_=MutableList.as_mutable(JSONB),
        nullable=False,
        default=list,
    )
    device_id: Mapped[uuid.UUID] = mapped_column(nullable=True)
    acquisition_parameter: Mapped[AcquisitionParameter] = mapped_column(type_=JSON, nullable=True)
    acquisition_limits: Mapped[AcquisitionLimits] = mapped_column(type_=JSON, nullable=True)


class DAGTask(Task):
    """DAG task ORM model."""

    __tablename__ = "dag_task"
    __mapper_args__ = {
        "polymorphic_identity": "DAG",
    }
    id: Mapped[uuid.UUID] = mapped_column(ForeignKey("task.id", ondelete="CASCADE"), primary_key=True)
    dag_type: Mapped[TaskType] = mapped_column(nullable=False)
    dag_id: Mapped[str] = mapped_column(nullable=False)
    input_task_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    parameter: Mapped[dict] = mapped_column(type_=JSON, nullable=True)


class Result(Base):
    """Abstract result ORM model."""

    __tablename__ = "result"
    __table_args__ = {"extend_existing": True}

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    datetime_created: Mapped[datetime.datetime] = mapped_column(
        server_default=func.now(),  # pylint: disable=not-callable
    )
    task_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("task.id"), nullable=False)

    type: Mapped[ResultType] = mapped_column(nullable=True, default=ResultType.NOT_SET)
    directory: Mapped[str] = mapped_column(nullable=True, default="")
    files: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    meta: Mapped[dict] = mapped_column(nullable=True, type_=JSON)


# Create automap base
MappedBase = automap_base()
MappedBase.prepare(autoload_with=engine, reflect=True)

# Get existing device models
try:
    Device = MappedBase.classes.device
except AttributeError as error:
    raise AttributeError("Could not find device and/or workflow table(s).") from error
