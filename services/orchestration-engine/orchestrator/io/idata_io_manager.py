# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Dagster IO Manager for mrpro IData object."""
from dataclasses import dataclass
from pathlib import Path

from dagster import ConfigurableIOManager, InputContext, OutputContext
from mrpro.data import IData
from scanhub_libraries.resources.dag_config import DAGConfiguration


@dataclass
class IDataContext:
    """Context definition for IData IO manager."""

    data: IData
    dag_config: DAGConfiguration


class IDataIOManager(ConfigurableIOManager):
    """IO manager for mrpro IData object."""

    def handle_output(self, context: OutputContext, obj: IDataContext) -> None:
        """Handle the output of a data processing step by saving the data as DICOM files.

        Args:
            context (OutputContext): The context object providing logging and metadata methods.
            obj (IDataContext): The data context containing the data and DAG configuration.

        Raises:
            AttributeError: If the output directory is not defined in the DAG configuration.

        Side Effects:
            - Saves the data as DICOM files in the specified output directory.
            - Adds output metadata including the output directory path and list of stored files.

        """
        # Decide where to write based on asset key
        if not obj.dag_config.output_directory:
            context.log.error("Output directory not defined")
            raise AttributeError
        directory_path = Path(obj.dag_config.output_directory)

        # Save data as dicom to result folder
        obj.data.to_dicom_folder(directory_path)

        # Surface paths in the UI and for hooks/sensors
        context.add_output_metadata({
            "output_directory": str(directory_path.resolve()),
            "stored_files": [p.name for p in directory_path.iterdir() if p.is_file()],
        })

    def load_input(self, context: InputContext) -> IData:
        """Load input DICOM data from a specified directory using metadata from the provided context.

        Args:
            context (InputContext): The context containing metadata and logging utilities.

        Returns:
            IData: An IData instance loaded from the DICOM folder.

        Raises:
            AttributeError: If required metadata or the output directory is missing.
            FileNotFoundError: If the specified DICOM folder does not exist.

        Logs:
            Errors are logged if metadata or directory information is missing or invalid.

        """
        if (meta := context.metadata) is None:
            context.log.error("No metadata, cannot save result")
            raise AttributeError
        dcm_folder = meta.get("output_directory")
        if not dcm_folder:
            context.log.error("Missing directory to load dicom files")
            raise AttributeError
        dcm_path = Path(dcm_folder)
        if not dcm_path.exists():
            msg = f"DICOM folder does not exist: {dcm_path}"
            context.log.error(msg)
            raise FileNotFoundError(msg)
        return IData.from_dicom_folder(str(dcm_path))
