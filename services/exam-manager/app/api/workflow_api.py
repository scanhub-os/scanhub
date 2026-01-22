# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Definition of exam API endpoints accessible through swagger UI."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from scanhub_libraries.models import (
    AcquisitionTaskOut,
    BaseWorkflow,
    DAGTaskOut,
    ItemStatus,
    User,
    WorkflowOut,
)
from scanhub_libraries.security import get_current_user
from scanhub_libraries.utils import ensure_uuid

from app import LOG_CALL_DELIMITER
from app.api import task_api
from app.dal import exam_dal, workflow_dal
from app.tools.helper import get_workflow_out_model

# Http status codes
# 200 = Ok: GET, PUT
# 201 = Created: POST
# 204 = No Content: Delete
# 404 = Not found

workflow_router = APIRouter(dependencies=[Depends(get_current_user)])


@workflow_router.post("/workflow/new", response_model=WorkflowOut, status_code=201, tags=["workflows"])
async def create_workflow(payload: BaseWorkflow, user: Annotated[User, Depends(get_current_user)]) -> WorkflowOut:
    """Create new workflow.

    Parameters
    ----------
    payload
        Workflow pydantic input model

    Returns
    -------
        Workflow pydantic output model

    Raises
    ------
    HTTPException
        404: Creation unsuccessful
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("payload:", payload)
    if payload.status != "NEW":
        raise HTTPException(status_code=400, detail="New workflow needs to have status NEW.")
    if (_id := ensure_uuid(payload.exam_id)) is not None:
        if not (exam := await exam_dal.get_exam_data(exam_id=_id)):
            raise HTTPException(status_code=400, detail="exam_id must be an existing id.")
        if exam.is_template != payload.is_template:
            raise HTTPException(
                status_code=400,
                detail="Invalid link to exam. Instance needs to refer to instance, template to template.",
            )
    if payload.is_template is False and payload.exam_id is None:
        raise HTTPException(status_code=400, detail="Workflow instance needs exam_id.")
    if not (workflow := await workflow_dal.add_workflow_data(payload=payload, creator=user.username)):
        raise HTTPException(status_code=404, detail="Could not create workflow")
    print("New workflow: ", workflow)
    return await get_workflow_out_model(data=workflow)


@workflow_router.post("/workflow", response_model=WorkflowOut, status_code=201, tags=["workflows"])
async def create_workflow_from_template(
    exam_id: UUID, template_id: UUID, new_workflow_is_template: bool, user: Annotated[User, Depends(get_current_user)]
) -> WorkflowOut:
    """Create new workflow from template.

    Parameters
    ----------
    exam_id
        Id of the exam, the workflow is related to
    template_id
        ID of the template, the workflow is created from
    new_workflow_is_template
        set the is_template property of the new workflow and its tasks

    Returns
    -------
        Workflow pydantic output model

    Raises
    ------
    HTTPException
        404: Creation unsuccessful
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("exam_id:", exam_id)
    print("template_id:", template_id)
    print("new_workflow_is_template:", new_workflow_is_template)
    if not (template := await workflow_dal.get_workflow_data(workflow_id=template_id)):
        raise HTTPException(status_code=404, detail="Workflow not found")
    if template.is_template is not True:
        raise HTTPException(
            status_code=400, detail="Request to create workflow from workflow instance instead of workflow template."
        )
    new_workflow = BaseWorkflow(**template.__dict__)
    new_workflow.status = ItemStatus.NEW
    new_workflow.is_template = new_workflow_is_template
    new_workflow.exam_id = exam_id
    if not (exam := await exam_dal.get_exam_data(exam_id=exam_id)):
        raise HTTPException(status_code=400, detail="exam_id must be an existing id.")
    if exam.is_template != new_workflow_is_template:
        raise HTTPException(
            status_code=400, detail="Invalid link to exam. Instance needs to refer to instance, template to template."
        )
    if not (workflow := await workflow_dal.add_workflow_data(payload=new_workflow, creator=user.username)):
        raise HTTPException(status_code=404, detail="Could not create workflow.")

    template_instance_mapping = {}
    task_instances: list[DAGTaskOut | AcquisitionTaskOut] = []

    # Create all the sub-items for the task templates in a workflow template
    # These must be created sequentially to ensure add_task_data correctly assigns positions
    for task in template.tasks:
        task_instance: DAGTaskOut | AcquisitionTaskOut = await task_api.create_task_from_template(
            workflow_id=workflow.id,
            template_id=task.id,
            new_task_is_template=new_workflow_is_template,
            user=user,
        )
        # Map template task IDs to instance task IDs
        template_instance_mapping[task.id] = task_instance.id
        task_instances.append(task_instance)

    # Update inputs of workflow task instances
    for task_instance in task_instances:
        if isinstance(task_instance, DAGTaskOut) and task_instance.input_task_ids:
            try:
                # Assign the new instance ID which corresponds to the original template ID
                task_instance.input_task_ids = [
                    template_instance_mapping[_id] for _id in task_instance.input_task_ids \
                        if _id in template_instance_mapping
                ]
                _ = await task_api.update_task(
                    task_id=task_instance.id,
                    payload=task_instance,
                    user=user,
                )
            except Exception as exc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Could not update input reference for task instance {task_instance.id}: {exc}",
                ) from exc

    # Get workflow out again with updated input_id on tasks
    return await get_workflow_out_model(data=workflow)


@workflow_router.get("/workflow/{workflow_id}", response_model=WorkflowOut, status_code=200, tags=["workflows"])
async def get_workflow(workflow_id: UUID | str, user: Annotated[User, Depends(get_current_user)]) -> WorkflowOut:
    """Get a workflow.

    Parameters
    ----------
    workflow_id
        Id of the workflow to be returned

    Returns
    -------
        Workflow pydantic output model

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("workflow_id:", workflow_id)
    try:
        _id = UUID(workflow_id) if not isinstance(workflow_id, UUID) else workflow_id
    except ValueError:
        raise HTTPException(status_code=400, detail="Badly formed workflow_id.")
    if not (workflow := await workflow_dal.get_workflow_data(workflow_id=_id)):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await get_workflow_out_model(data=workflow)


@workflow_router.get(
    "/workflow/all/{exam_id}",
    response_model=list[WorkflowOut],
    status_code=200,
    tags=["workflows"],
)
async def get_all_exam_workflows(
    exam_id: UUID | str, user: Annotated[User, Depends(get_current_user)]
) -> list[WorkflowOut]:
    """Get all existing workflows of a certain exam.

    Parameters
    ----------
    exam_id
        Id of parent exam

    Returns
    -------
        List of workflow pydantic output model
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("exam_id:", exam_id)
    _id = UUID(exam_id) if not isinstance(exam_id, UUID) else exam_id
    if not (workflows := await workflow_dal.get_all_workflow_data(exam_id=_id)):
        # Don't raise exception, list might be empty
        return []
    return [await get_workflow_out_model(data=workflow) for workflow in workflows]


@workflow_router.get(
    "/workflow/templates/all",
    response_model=list[WorkflowOut],
    status_code=200,
    tags=["workflows"],
)
async def get_all_workflow_templates(user: Annotated[User, Depends(get_current_user)]) -> list[WorkflowOut]:
    """Get all workflow templates.

    Returns
    -------
        List of workflow pydantic output model
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    if not (workflows := await workflow_dal.get_all_workflows_template_data()):
        # Don't raise exception, list might be empty
        return []
    return [await get_workflow_out_model(data=workflow) for workflow in workflows]


@workflow_router.delete("/workflow/{workflow_id}", response_model={}, status_code=204, tags=["workflows"])
async def delete_workflow(workflow_id: UUID | str, user: Annotated[User, Depends(get_current_user)]) -> None:
    """Delete a workflow. Cascade delete the associated tasks.

    Parameters
    ----------
    workflow_id
        Id of the workflow to be deleted

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("workflow_id:", workflow_id)
    _id = UUID(workflow_id) if not isinstance(workflow_id, UUID) else workflow_id
    if not await workflow_dal.delete_workflow_data(workflow_id=_id):
        message = "Could not delete workflow, either because it does not exist, or for another reason."
        raise HTTPException(status_code=404, detail=message)


@workflow_router.put("/workflow/{workflow_id}", response_model=WorkflowOut, status_code=200, tags=["workflows"])
async def update_workflow(
    workflow_id: UUID | str, payload: BaseWorkflow, user: Annotated[User, Depends(get_current_user)]
) -> WorkflowOut:
    """Update an existing workflow.

    Parameters
    ----------
    workflow_id
        Id of the workflow to be updated
    payload
        Workflow pydantic indput model

    Returns
    -------
        Workflow pydantic output model

    Raises
    ------
    HTTPException
        404: Not found
    """
    print(LOG_CALL_DELIMITER)
    print("Username:", user.username)
    print("workflow_id:", workflow_id)
    print("payload:", payload)
    if payload.status == "NEW":
        raise HTTPException(status_code=403, detail="Workflow cannot be updated to status NEW.")
    if (exam_id := ensure_uuid(payload.exam_id)) is not None:
        if not (exam := await exam_dal.get_exam_data(exam_id=exam_id)):
            raise HTTPException(status_code=400, detail="exam_id must be an existing id.")
        if exam.is_template != payload.is_template:
            raise HTTPException(
                status_code=400,
                detail="Invalid link to exam. Instance needs to refer to instance, template to template.",
            )
    if payload.is_template is False and payload.exam_id is None:
        raise HTTPException(status_code=400, detail="Workflow instance needs exam_id.")
    _id = UUID(workflow_id) if not isinstance(workflow_id, UUID) else workflow_id
    if not (workflow := await workflow_dal.get_workflow_data(workflow_id=_id)):
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not (workflow := await workflow_dal.update_workflow_data(workflow_id=_id, payload=payload)):
        raise HTTPException(status_code=404, detail="Workflow could not be updated.")
    return await get_workflow_out_model(data=workflow)
