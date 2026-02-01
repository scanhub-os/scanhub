# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""MRpro direct image reconstruction using."""
import mrpro
from dagster import AssetIn, asset
from scanhub_libraries.resources import IDATA_IO_KEY
from mrpro.data import IData

from orchestrator.assets.acquisition_data import AcquisitionData, acquisition_data_asset

@asset(
    group_name="reconstruction",
    description="MRpro direct reconstruction.",
    ins={"data": AssetIn(key=acquisition_data_asset.key)},
    io_manager_key=IDATA_IO_KEY,
    required_resource_keys={"dag_config"},
)
def mrpro_direct_reconstruction(context, data: AcquisitionData) -> IData:
    """Reconstruct an image from acquisition results using the direct reconstruction method from mrpro.

    Args:
        context: The execution context, typically used for logging and runtime information.
        data (AcquisitionData): The acquisition data containing the MRD file path and associated metadata.

    Returns:
        IData: The reconstructed image data.

    Workflow:
        1. Loads acquisition results using the DataLakeResource, providing the MRD path and metadata.
        2. Loads an mrpro KData object from the MRD path.
        3. Performs image reconstruction using mrpro's direct reconstruction algorithm.
        4. Returns the reconstructed IData object, which is passed to the idata_io_manager.

    """
    mrd_input = data.mrd_path
    context.log.info("Reading MRD input: %s", str(mrd_input))
    trajectory_calculator = mrpro.data.traj_calculators.KTrajectoryCartesian()
    kdata = mrpro.data.KData.from_file(mrd_input, trajectory_calculator)
    context.log.info("Loaded data: %s", kdata.shape)
    reconstruction = mrpro.algorithms.reconstruction.DirectReconstruction(kdata)
    context.log.info("Performing direct reconstruction using mrpro...")
    idata = reconstruction(kdata)
    return idata
