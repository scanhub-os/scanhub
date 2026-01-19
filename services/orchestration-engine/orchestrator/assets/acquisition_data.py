# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Definition of acquisiton data assets."""
from dataclasses import dataclass
from pathlib import Path

from dagster import AssetExecutionContext, MetadataValue, OpExecutionContext, asset, op
from scanhub_libraries.resources.dag_config import DAGConfiguration
from scanhub_libraries.resources.data_lake import DataLakeResource


@dataclass
class AcquisitionData:
    """Acquisition data output of read acquisition data asset."""

    mrd_path: Path
    device_id: str
    device_parameter: dict


def _load_acquisition_data(dag_config: DAGConfiguration, data_lake: DataLakeResource) -> AcquisitionData:
    """Load acquisition data required for processing.

    Args:
        dag_config (DAGConfiguration): The configuration object containing DAG and input file information.
        data_lake (DataLakeResource): The data lake resource used to retrieve file paths and device parameters.

    Returns:
        AcquisitionData: An object containing the MRD file path, device ID, and device parameters.

    """
    mrd_file = data_lake.get_mrd_path(dag_config.input_files)
    device_id, device_parameter = data_lake.get_device_parameter(dag_config.input_files)
    return AcquisitionData(mrd_path=mrd_file, device_id=device_id, device_parameter=device_parameter)


@asset(
    group_name="io",
    description="Provides acquired ISMRMRD result",
)
def acquisition_data_asset(
    context: AssetExecutionContext,
    dag_config: DAGConfiguration,
    data_lake: DataLakeResource,
) -> AcquisitionData:
    """Define an acquisition result asset for the orchestration engine.

    This function loads acquisition data using the provided DAG configuration and data lake resource,
    logs device parameters, and attaches relevant metadata for visualization in the Dagster UI.

    Args:
        context (AssetExecutionContext): The execution context for the asset, used for logging and metadata.
        dag_config (DAGConfiguration): The configuration object for the current DAG execution.
        data_lake (DataLakeResource): The data lake resource used to load acquisition data.

    Returns:
        AcquisitionData: The loaded acquisition data object containing device information and parameters.

    Side Effects:
        - Logs device parameters to the context logger.
        - Adds output metadata to the context for Dagster UI visualization.

    """
    data = _load_acquisition_data(dag_config, data_lake)
    context.log.info("Parameters for device id %s: %s", data.device_id, data.device_parameter)

    # Optional: Add meta data for dagster UI
    context.add_output_metadata({
        "mrd_path": MetadataValue.path(str(data.mrd_path)),
        "device_id": data.device_id,
        "device_parameter": MetadataValue.json(data.device_parameter),
        "num_input_files": len(dag_config.input_files),
        "output_directory": MetadataValue.path(dag_config.output_directory),
        "output_result_id": dag_config.output_result_id,
        "access_token": dag_config.user_access_token,
    })
    return data


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
