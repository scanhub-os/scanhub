# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Define dagster repository."""
import os

from dagster import AssetSelection, Definitions, define_asset_job, in_process_executor
from scanhub_libraries.resources import DAG_CONFIG_KEY, DATA_LAKE_KEY, IDATA_IO_KEY, NOTIFIER_DM_KEY, NOTIFIER_WM_KEY
from scanhub_libraries.resources.dag_config import DAGConfiguration
from scanhub_libraries.resources.data_lake import DataLakeResource
from scanhub_libraries.resources.notifier import DeviceManagerNotifier, WorkflowManagerNotifier

from orchestrator.assets.mrpro_direct_reconstruction import mrpro_direct_reconstruction
from orchestrator.io.acquisition_data import acquisition_data_asset
from orchestrator.io.idata_io_manager import IDataIOManager
from orchestrator.jobs.mri_frequency_calibration import frequency_calibration_job
from orchestrator.sensors import on_run_canceled, on_run_failure, on_run_success

DATA_LAKE_DIR = os.getenv("DATA_LAKE_DIRECTORY", "data")
DEVICE_MANAGER_URI = "http://device-manager:8000/api/v1/device"
WORKFLOW_MANAGER_URI = "http://workflow-manager:8000/api/v1/workflowmanager"


assets = [
    acquisition_data_asset,
    mrpro_direct_reconstruction,
]

sensors = [
    on_run_success,
    on_run_failure,
    on_run_canceled,
]

ressources = {
    DAG_CONFIG_KEY: DAGConfiguration.configure_at_launch(),
    DATA_LAKE_KEY: DataLakeResource.configure_at_launch(),
    IDATA_IO_KEY: IDataIOManager.configure_at_launch(),
    NOTIFIER_WM_KEY: WorkflowManagerNotifier(base_url=WORKFLOW_MANAGER_URI),
    NOTIFIER_DM_KEY: DeviceManagerNotifier(base_url=DEVICE_MANAGER_URI),
}

jobs = (
    define_asset_job(
        name="mrpro_reconstruction_job",
        selection=AssetSelection.keys(acquisition_data_asset.key, mrpro_direct_reconstruction.key),
    ),
    frequency_calibration_job,
)

defs = Definitions(assets=assets, resources=ressources, jobs=jobs, sensors=sensors, executor=in_process_executor)
