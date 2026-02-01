# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Data acess layer (DAL) between fastapi endpoint and sql database."""

from uuid import UUID

from scanhub_libraries.models import BaseAcquisitionTask, BaseDAGTask, TaskType
from sqlalchemy import func
from sqlalchemy.engine import Result as SQLResult
from sqlalchemy.future import select
from sqlalchemy.orm import with_polymorphic

from app.db.postgres import AcquisitionTask, DAGTask, Task, async_session


async def add_task_data(payload: BaseAcquisitionTask | BaseDAGTask, creator) -> AcquisitionTask | DAGTask:
    """Add new task to database.

    Parameters
    ----------
    payload
        Task pydantic base model
    creator
        The username/id of the user who creats this task

    Returns
    -------
        Database orm model of created task
    """
    new_task: AcquisitionTask | DAGTask
    if payload.task_type is TaskType.ACQUISITION:
        new_task = AcquisitionTask(**payload.model_dump(), creator=creator)
    elif payload.task_type is TaskType.DAG:
        new_task = DAGTask(**payload.model_dump(), creator=creator)
    else:
        raise ValueError(f"Unsupported task type: {payload.task_type}")

    async with async_session() as session:
        if new_task.workflow_id:
            # Get max position for the workflow
            result = await session.execute(
                select(func.max(Task.position)).where(Task.workflow_id == new_task.workflow_id)
            )
            max_position = result.scalar()
            if max_position is not None:
                new_task.position = max_position + 1
            else:
                new_task.position = 0

        session.add(new_task)
        await session.commit()
        await session.refresh(new_task)
    return new_task


async def get_task_data(task_id: UUID) -> Task | None:
    """Get task by id.

    Parameters
    ----------
    task_id
        Id of the requested task

    Returns
    -------
        Database orm model with data of requested task
    """
    task_poly = with_polymorphic(Task, [AcquisitionTask, DAGTask])  # Add all subclasses you have

    async with async_session() as session:
        result = await session.execute(select(task_poly).where(task_poly.id == task_id))
        task = result.scalar_one_or_none()
        return task


async def get_all_task_data(workflow_id: UUID) -> list[Task]:
    """Get a list of all tasks assigned to a certain workflow.

    Parameters
    ----------
    workflow_id
        Id of the parent workflow entry, tasks are assigned to

    Returns
    -------
        List of task data base orm models
    """
    task_poly = with_polymorphic(Task, [AcquisitionTask, DAGTask])  # Add all subclasses here

    async with async_session() as session:
        result = await session.execute(
            select(task_poly).where(task_poly.workflow_id == workflow_id).order_by(task_poly.position)
        )
        return list(result.scalars().all())


async def get_all_task_template_data() -> list[Task]:
    """Get a list of all tasks assigned to a certain workflow.

    Parameters
    ----------
    workflow_id
        Id of the parent workflow entry, tasks are assigned to

    Returns
    -------
        List of task data base orm models
    """
    task_poly = with_polymorphic(Task, [AcquisitionTask, DAGTask])  # Add all subclasses here

    async with async_session() as session:
        result: SQLResult = await session.execute(
            select(task_poly).where(task_poly.is_template).order_by(task_poly.position)
        )
        return list(result.scalars().all())


async def delete_task_data(task_id: UUID) -> bool:
    """Delete task by id.

    Parameters
    ----------
    task_id
        Id of the task to be deleted

    Returns
    -------
        Success of deletion
    """
    task_polymorphic = with_polymorphic(Task, [AcquisitionTask, DAGTask])
    async with async_session() as session:
        result = await session.execute(select(task_polymorphic).where(task_polymorphic.id == task_id))
        if task := result.scalar_one_or_none():
            await session.delete(task)
            await session.commit()
            return True
        return False


async def update_task_data(task_id: UUID, payload: BaseAcquisitionTask | BaseDAGTask) -> Task | None:
    """Update existing task in database.

    Parameters
    ----------
    task_id
        Id of the task to be updateed
    payload
        Task pydantic base model with data to be updated

    Returns
    -------
        Database orm model of updated task
    """
    task_polymorphic = with_polymorphic(Task, [AcquisitionTask, DAGTask])
    async with async_session() as session:
        result = await session.execute(select(task_polymorphic).where(task_polymorphic.id == task_id))
        if task := result.scalar_one_or_none():
            task.update(payload)
            await session.commit()
            await session.refresh(task)
            return task
        return None


async def reorder_tasks_data(task_ids: list[UUID]) -> bool:
    """Update the position of multiple tasks.

    Parameters
    ----------
    task_ids
        List of task IDs in the new order
    """
    task_poly = with_polymorphic(Task, [AcquisitionTask, DAGTask])
    async with async_session() as session:
        for index, task_id in enumerate(task_ids):
            result = await session.execute(select(task_poly).where(task_poly.id == task_id))
            if task := result.scalar_one_or_none():
                task.position = index
        await session.commit()
        return True
