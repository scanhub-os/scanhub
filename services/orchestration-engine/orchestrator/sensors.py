# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Sensors to notify workflow manager dependent on run status."""
from dagster import DagsterRunStatus, DefaultSensorStatus, RunStatusSensorContext, run_status_sensor
from scanhub_libraries.resources import DAG_CONFIG_KEY
from scanhub_libraries.resources.notifier import WorkflowManagerNotifier


def _get_dag_config_from_run(context: RunStatusSensorContext) -> dict:
    """Extract the DAG configuration dictionary from a given RunStatusSensorContext.

    Args:
        context (RunStatusSensorContext): The context containing the Dagster run information.

    Returns:
        dict: The DAG configuration found under the run's resources, or an empty dictionary if not present or invalid.

    """
    run_config = getattr(context.dagster_run, "run_config", None)
    if not isinstance(run_config, dict):
        return {}
    return run_config.get("resources", {}).get(DAG_CONFIG_KEY, {}).get("config", {})


@run_status_sensor(
    run_status=DagsterRunStatus.SUCCESS,
    default_status=DefaultSensorStatus.RUNNING,
    monitor_all_code_locations=True,
    minimum_interval_seconds=5,
)
def on_run_success(context: RunStatusSensorContext, notifier_workflow_manager: WorkflowManagerNotifier) -> None:
    """Handle successful DAG run events by notifying the workflow manager if required information is available.

    This function retrieves the DAG configuration from the provided context, extracts the user access token
    and output result ID, and attempts to notify the workflow manager of the success.
    If either the access token or result ID is missing, it logs an
    informational message indicating that the DAG status could not be reported.

    Args:
        context (RunStatusSensorContext): The context object containing information about the DAG run.
        notifier_workflow_manager (WorkflowManagerNotifier): The notifier used to report DAG run success.

    """
    dag_config = _get_dag_config_from_run(context)
    access_token = dag_config.get("user_access_token", "")
    result_id = dag_config.get("output_result_id", "")
    if result_id and access_token:
        notifier_workflow_manager.send_dag_success(result_id=result_id, access_token=access_token, success=True)
        context.log.info(
            "%s succeeded (run_id=%s).", context.dagster_run.job_name, context.dagster_run.run_id,
        )
    else:
        context.log.info("Run succeeded, but can not report DAG status, missing access_token and/or result_id.")


@run_status_sensor(
    run_status=DagsterRunStatus.FAILURE,
    default_status=DefaultSensorStatus.RUNNING,
    monitor_all_code_locations=True,
    minimum_interval_seconds=5,
)
def on_run_failure(context: RunStatusSensorContext, notifier_workflow_manager: WorkflowManagerNotifier) -> None:
    """Handle the failure of a DAG run by notifying the workflow manager if possible.

    This function retrieves the DAG configuration from the provided context, extracts the user access token
    and output result ID, and attempts to notify the workflow manager of the failure.
    If either the access token or result ID is missing, it logs an
    informational message indicating that the DAG status could not be reported.

    Args:
        context (RunStatusSensorContext):
            The context object containing information about the DAG run and logging utilities.
        notifier_workflow_manager (WorkflowManagerNotifier):
            The notifier used to send DAG status updates.

    Returns:
        None

    """
    dag_config = _get_dag_config_from_run(context)
    access_token = dag_config.get("user_access_token", "")
    result_id = dag_config.get("output_result_id", "")
    if result_id and access_token:
        notifier_workflow_manager.send_dag_success(result_id=result_id, access_token=access_token, success=False)
        context.log.info(
            "%s failed (run_id=%s).", context.dagster_run.job_name, context.dagster_run.run_id,
        )
    else:
        context.log.info("Run failed, but can not report DAG status, missing access_token and/or result_id.")

@run_status_sensor(
    run_status=DagsterRunStatus.CANCELED,
    default_status=DefaultSensorStatus.RUNNING,
    monitor_all_code_locations=True,
    minimum_interval_seconds=5,
)
def on_run_canceled(context: RunStatusSensorContext, notifier_workflow_manager: WorkflowManagerNotifier) -> None:
    """Handle the cancellation of a DAG run by notifying the workflow manager and logging the event.

    This function retrieves the DAG configuration from the provided context, extracts the user access token
    and output result ID, and attempts to notify the workflow manager of the cancellation.
    If either the access token or result ID is missing, it logs an
    informational message indicating that the DAG status could not be reported.

    Args:
        context (RunStatusSensorContext): The context object containing information about the current DAG run.
        notifier_workflow_manager (WorkflowManagerNotifier): The notifier used to send DAG status updates.

    """
    dag_config = _get_dag_config_from_run(context)
    access_token = dag_config.get("user_access_token", "")
    result_id = dag_config.get("output_result_id", "")
    if result_id and access_token:
        notifier_workflow_manager.send_dag_success(result_id=result_id, access_token=access_token, success=False)
        context.log.info(
            "%s canceled (run_id=%s).", context.dagster_run.job_name, context.dagster_run.run_id,
        )
    else:
        context.log.info("Run canceled, but can not report DAG status, missing access_token and/or result_id.")

