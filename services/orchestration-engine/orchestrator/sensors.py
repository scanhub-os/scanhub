"""Sensors to notify workflow manager dependent on run status."""
from dagster import DagsterRunStatus, DefaultSensorStatus, RunStatusSensorContext, run_status_sensor
from scanhub_libraries.resources import DAG_CONFIG_KEY
from scanhub_libraries.resources.notifier import WorkflowManagerNotifier


def _get_dag_config_from_run(context: RunStatusSensorContext) -> dict:
    """Get DAG configuration from run status sensor conrext."""
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
    """Notify workflow manager about successful run using a sensor."""
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
    run_status=DagsterRunStatus.SUCCESS,
    default_status=DefaultSensorStatus.RUNNING,
    monitor_all_code_locations=True,
    minimum_interval_seconds=5,
)
def on_run_failure(context: RunStatusSensorContext, notifier_workflow_manager: WorkflowManagerNotifier) -> None:
    """Notify workflow manager about failed run using a sensor."""
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
    run_status=DagsterRunStatus.SUCCESS,
    default_status=DefaultSensorStatus.RUNNING,
    monitor_all_code_locations=True,
    minimum_interval_seconds=5,
)
def on_run_canceled(context: RunStatusSensorContext, notifier_workflow_manager: WorkflowManagerNotifier) -> None:
    """Notify workflow manager about cancelled run using a sensor."""
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

