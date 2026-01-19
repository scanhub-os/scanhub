# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Definition of acquisiton data operation."""
from dagster import OpExecutionContext, op
from scanhub_libraries.resources.dag_config import DAGConfiguration
from scanhub_libraries.resources.data_lake import DataLakeResource
from orchestrator.assets.acquisition_data import AcquisitionData, _load_acquisition_data

@op
def acquisition_data_op(
    context: OpExecutionContext,
    dag_config: DAGConfiguration,
    data_lake: DataLakeResource,
) -> AcquisitionData:
    """Execute the acquisition data operation.

    Loads acquisition data from the data lake based on the provided DAG configuration.
    Logs the MRD file path and device parameters.

    Args:
        context (OpExecutionContext): The execution context for the operation, used for logging and runtime information.
        dag_config (DAGConfiguration): The configuration object for the DAG, containing parameters for the acquisition.
        data_lake (DataLakeResource): The data lake resource used to access acquisition data.

    Returns:
        AcquisitionData: The loaded acquisition data object containing MRD file path, device ID, and device parameters.

    """
    data = _load_acquisition_data(dag_config, data_lake)
    context.log.info("MRD file path: %s", str(data.mrd_path))
    context.log.info("Parameters for device id %s: %s", data.device_id, data.device_parameter)
    return data
