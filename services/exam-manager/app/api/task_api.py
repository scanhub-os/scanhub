# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Definition of exam API endpoints accessible through swagger UI."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from scanhub_libraries.models import (
    AcquisitionTaskOut,
    BaseAcquisitionTask,
    BaseDAGTask,
    DAGTaskOut,
    ItemStatus,
    TaskType,
    User,
)
from scanhub_libraries.security import get_current_user
from scanhub_libraries.utils import ensure_uuid

from app import LOG_CALL_DELIMITER
from app.dal import task_dal, workflow_dal
from app.tools.helper import get_task_out

# Http status codes
# 200 = Ok: GET, PUT
# 201 = Created: POST
# 204 = No Content: Delete
# 404 = Not found


task_router = APIRouter(dependencies=[Depends(get_current_user)])


class TaskReorder(BaseModel):
    """Task reorder model."""

    task_ids: list[UUID]


@task_router.post("/task/new", response_model=AcquisitionTaskOut | DAGTaskOut, status_code=201, tags=["tasks"])
async def create_task(
    payload: Annotated[BaseAcquisitionTask | BaseDAGTask, Field(discriminator="task_type")],
    user: Annotated[User, Depends(get_current_user)],
) -> AcquisitionTaskOut | DAGTaskOut:
    """Create a new task.

    Parameters
    ----------
    payload
        Task pydantic input model

    Returns
    -------
        Task pydantic output model

    Raises
    ------
    HTTPException
        404: Creation unsuccessful
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("payload:", payload)
    if payload.status != ItemStatus.NEW:
        raise HTTPException(status_code=400, detail="New task needs to have status NEW")
    if (workflow_id := ensure_uuid(payload.workflow_id)) is not None:
        if not (workflow := await workflow_dal.get_workflow_data(workflow_id=workflow_id)):
            raise HTTPException(status_code=400, detail="workflow_id must be an existing id.")
        if workflow.is_template != payload.is_template:
            raise HTTPException(
                status_code=400,
                detail="Invalid link to workflow. Instance needs to refer to instance, template to template.",
            )
    if payload.is_template is False and payload.workflow_id is None:
        raise HTTPException(status_code=400, detail="Task instance needs workflow_id.")
    # The position of the new task is automatically set to the end of the workflow in add_task_data
    if not (task := await task_dal.add_task_data(payload=payload, creator=user.username)):
        raise HTTPException(status_code=404, detail="Could not create task")

    print("Task created: ", task)
    return await get_task_out(data=task)


@task_router.post("/task", response_model=AcquisitionTaskOut | DAGTaskOut, status_code=201, tags=["tasks"])
async def create_task_from_template(
    workflow_id: UUID,
    template_id: UUID,
    new_task_is_template: bool,
    user: Annotated[User, Depends(get_current_user)],
) -> AcquisitionTaskOut | DAGTaskOut:
    """Create a new task from template.

    Parameters
    ----------
    workflow_id
        ID of the workflow, the task is related to
    template_id
        ID of the template, the task is created from
    new_task_is_template
        set the is_template property on the new task

    Returns
    -------
        Task pydantic output model

    Raises
    ------
    HTTPException
        404: Creation unsuccessful
    """
    # TODO: Check if all optional parameters like device_id, acquisition_parameter etc. are set.
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("workflow_id:", workflow_id)
    print("template_id:", template_id)
    print("new_task_is_template:", new_task_is_template)
    if not (template := await task_dal.get_task_data(task_id=template_id)):
        raise HTTPException(status_code=404, detail="Task template not found")
    if template.is_template is not True:
        raise HTTPException(
            status_code=400, detail="Request to create task from task instance instead of task template."
        )
    new_task: BaseAcquisitionTask | BaseDAGTask
    if template.task_type is TaskType.ACQUISITION:
        new_task = BaseAcquisitionTask(**template.__dict__)
    elif template.task_type is TaskType.DAG:
        new_task = BaseDAGTask(**template.__dict__)
    else:
        raise TypeError("Invalid task type.")

    new_task.is_template = new_task_is_template
    new_task.workflow_id = workflow_id
    if not (workflow := await workflow_dal.get_workflow_data(workflow_id=workflow_id)):
        raise HTTPException(status_code=400, detail="workflow_id must be an existing id.")
    if workflow.is_template != new_task_is_template:
        raise HTTPException(
            status_code=400,
            detail="Invalid link to workflow. Instance needs to refer to instance, template to template.",
        )
    # The position of the new task is automatically set to the end of the workflow in add_task_data
    if not (task := await task_dal.add_task_data(payload=new_task, creator=user.username)):
        raise HTTPException(status_code=404, detail="Could not create task.")

    print("Task created: ", task)
    return await get_task_out(data=task)


@task_router.get("/task/{task_id}", response_model=AcquisitionTaskOut | DAGTaskOut, status_code=200, tags=["tasks"])
async def get_task(
    task_id: UUID | str, user: Annotated[User, Depends(get_current_user)]
) -> AcquisitionTaskOut | DAGTaskOut:
    """Get an existing task.

    Parameters
    ----------
    task_id
        Id of the task to be returned

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
    print("task_id:", task_id)
    try:
        _id = UUID(task_id) if not isinstance(task_id, UUID) else task_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Badly formed task_id.")
    if not (task := await task_dal.get_task_data(task_id=_id)):
        raise HTTPException(status_code=404, detail="Task not found")
    return await get_task_out(data=task)


@task_router.get(
    "/task/all/{workflow_id}",
    response_model=list[AcquisitionTaskOut | DAGTaskOut],
    status_code=200,
    tags=["tasks"],
)
async def get_all_workflow_tasks(
    workflow_id: UUID | str,
    user: Annotated[User, Depends(get_current_user)],
) -> list[AcquisitionTaskOut | DAGTaskOut]:
    """Get all existing tasks of a certain workflow.

    Parameters
    ----------
    workflow_id
        Id of parental workflow

    Returns
    -------
        List of task pydantic output model
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("workflow_id:", workflow_id)
    _id = UUID(workflow_id) if not isinstance(workflow_id, UUID) else workflow_id
    if not (tasks := await task_dal.get_all_task_data(workflow_id=_id)):
        # Don't raise exception here, list might be empty.
        return []
    print("List of tasks: ", tasks)
    return [await get_task_out(data=task) for task in tasks]


@task_router.get(
    "/task/templates/all",
    response_model=list[AcquisitionTaskOut | DAGTaskOut],
    status_code=200,
    tags=["tasks"],
)
async def get_all_task_templates(
    user: Annotated[User, Depends(get_current_user)],
) -> list[AcquisitionTaskOut | DAGTaskOut]:
    """Get all existing task templates.

    Returns
    -------
        List of task pydantic output model
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    if not (tasks := await task_dal.get_all_task_template_data()):
        # Don't raise exception here, list might be empty.
        return []
    result = [await get_task_out(data=task) for task in tasks]
    return result


@task_router.delete("/task/{task_id}", response_model=None, status_code=204, tags=["tasks"])
async def delete_task(task_id: UUID | str, user: Annotated[User, Depends(get_current_user)]) -> None:
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
    print("task_id:", task_id)
    _id = UUID(task_id) if not isinstance(task_id, UUID) else task_id
    if not await task_dal.delete_task_data(task_id=_id):
        message = "Could not delete task, either because it does not exist, or for another reason."
        raise HTTPException(status_code=404, detail=message)


@task_router.put("/task/reorder", response_model=None, status_code=204, tags=["tasks"])
async def reorder_tasks(
    payload: TaskReorder,
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    """Reorder tasks by updating their position.

    Parameters
    ----------
    payload
        Task reorder pydantic model containing list of task IDs in the new order
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("task_ids:", payload.task_ids)
    if not await task_dal.reorder_tasks_data(task_ids=payload.task_ids):
        raise HTTPException(status_code=404, detail="Could not reorder tasks")


@task_router.put("/task/{task_id}", response_model=AcquisitionTaskOut | DAGTaskOut, status_code=200, tags=["tasks"])
async def update_task(
    task_id: UUID | str,
    payload: Annotated[BaseAcquisitionTask | BaseDAGTask, Field(discriminator="task_type")],
    user: Annotated[User, Depends(get_current_user)],
) -> AcquisitionTaskOut | DAGTaskOut:
    """Update an existing task.

    Parameters
    ----------
    task_id
        Id of the workflow to be updated
    payload
        Task pydantic base model

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
    print("task_id:", task_id)
    # if TaskStatus.PENDING in payload.status:
    #     raise HTTPException(status_code=400, detail="Task must not update to status PENDING "
    if (workflow_id := ensure_uuid(payload.workflow_id)) is not None:
        if not (workflow := await workflow_dal.get_workflow_data(workflow_id=workflow_id)):
            raise HTTPException(status_code=400, detail="workflow_id must be an existing id.")
        if workflow.is_template != payload.is_template:
            raise HTTPException(
                status_code=400,
                detail="Invalid link to workflow. Instance needs to refer to instance, template to template.",
            )
    if payload.is_template is False and payload.workflow_id is None:
        raise HTTPException(status_code=400, detail="Task instance needs workflow_id.")
    _id = UUID(task_id) if not isinstance(task_id, UUID) else task_id
    if not (task_updated := await task_dal.update_task_data(task_id=_id, payload=payload)):
        message = "Could not update workflow, either because it does not exist, or for another reason."
        raise HTTPException(status_code=404, detail=message)
    return await get_task_out(data=task_updated)



