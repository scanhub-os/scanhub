# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""AI based image segmentation."""
from typing import List

import numpy as np
import pydicom
from dagster import AssetIn, asset
from scanhub_libraries.resources import DICOM_IO_KEY
from skimage import filters
from orchestrator.assets.dicom_input import dicom_input


@asset(
    group_name="segmentation",
    description="AI based image segmentation.",
    ins={"data": AssetIn(key=dicom_input.key)},
    io_manager_key=DICOM_IO_KEY,
)
def image_smoothing(context, data: List[pydicom.Dataset]) -> List[pydicom.Dataset]:
    """Perform image smoothing on the input DICOM data.

    Args:
        context: Execution context.
        data (List[pydicom.Dataset]): Input DICOM data loaded automatically by IO Manager.

    Returns:
        List[pydicom.Dataset]: The segmented DICOM data.
    """
    
    datasets = data
    
    if not datasets:
        context.log.warning("No datasets to segment.")
        return []
    
    # Sort datasets by instance number or position
    # Assuming simple stack for now.
    datasets.sort(key=lambda x: x.InstanceNumber if hasattr(x, "InstanceNumber") else 0)
    
    # Check dimensions
    if len(datasets) == 0:
        return []
    
    # Stack pixel arrays
    # Note: pydicom pixel_array is (Rows, Columns). Stack depth is len(datasets).
    try:
        volume = np.stack([ds.pixel_array for ds in datasets], axis=0) # (D, H, W)
    except Exception as e:
        context.log.error(f"Failed to stack/read pixel arrays: {e}")
        raise e
    
    context.log.info(f"Volume shape: {volume.shape}")

    # Handle 4D volume (e.g. if single multi-frame DICOM was stacked)
    if volume.ndim == 4:
        if volume.shape[0] == 1:
             context.log.info("Squeezing singleton 4th dimension (0-axis).")
             volume = np.squeeze(volume, axis=0)
        else:
             context.log.warning(f"Volume is 4D {volume.shape} but morphology expects 3D. Processing first volume only.")
             volume = volume[0]
    
    # Denoising Logic (Gaussian smoothing)
    # Using preserve_range=True to keep values in original scale
    try:
        denoised_volume = filters.gaussian(volume, sigma=10.0, preserve_range=True)
    except Exception as e:
        context.log.error(f"Failed to apply Gaussian filter: {e}")
        raise e
    
    # Cast back to original dtype (likely uint16)
    # Note: gaussian with preserve_range returns float, but in original range.
    # We must cast it back safely.
    original_dtype = datasets[0].pixel_array.dtype
    denoised_volume = denoised_volume.astype(original_dtype)
    
    # Prepare output datasets
    output_datasets = []
    
    # Series Instance UID for the new series
    new_series_uid = pydicom.uid.generate_uid()
    
    # Case 1: Single Input File (Multiframe) -> Single Output File (Multiframe)
    if len(datasets) == 1 and denoised_volume.ndim == 3:
        ds = datasets[0]
        new_ds = ds.copy()
        
        # Update UIDs
        new_ds.SOPInstanceUID = pydicom.uid.generate_uid()
        new_ds.SeriesInstanceUID = new_series_uid
        new_ds.SeriesDescription = (ds.get("SeriesDescription", "") or "") + " - AI Denoising"
        new_ds.SeriesNumber = (ds.get("SeriesNumber", 0)) + 100

        # Update Transfer Syntax
        new_ds.file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
        new_ds.is_little_endian = True
        new_ds.is_implicit_VR = False

        # Prepare Pixel Data (Full Volume)
        pixel_bytes = denoised_volume.tobytes()
        if len(pixel_bytes) % 2 != 0:
            pixel_bytes += b'\0'
        
        new_ds.PixelData = pixel_bytes
        new_ds.Rows = denoised_volume.shape[1]
        new_ds.Columns = denoised_volume.shape[2]
        new_ds.NumberOfFrames = denoised_volume.shape[0]

        # Ensure Metadata Consistency
        itemsize = denoised_volume.dtype.itemsize 
        bits_allocated = itemsize * 8
        new_ds.BitsAllocated = bits_allocated
        new_ds.BitsStored = bits_allocated
        new_ds.HighBit = bits_allocated - 1
        new_ds.SamplesPerPixel = 1
        new_ds.PixelRepresentation = 1 if np.issubdtype(denoised_volume.dtype, np.signedinteger) else 0

        context.log.info(f"Created Multiframe DS: {new_ds.NumberOfFrames} frames, {new_ds.Rows}x{new_ds.Columns}")
        output_datasets.append(new_ds)

    # Case 2: Stack of Files -> Stack of Files
    else:
        for i, ds in enumerate(datasets):
            new_ds = ds.copy()
            
            # Update UIDs
            new_ds.SOPInstanceUID = pydicom.uid.generate_uid()
            new_ds.SeriesInstanceUID = new_series_uid
            new_ds.SeriesDescription = (ds.get("SeriesDescription", "") or "") + " - AI Denoising"
            new_ds.SeriesNumber = (ds.get("SeriesNumber", 0)) + 100

            # Update Transfer Syntax
            new_ds.file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
            new_ds.is_little_endian = True
            new_ds.is_implicit_VR = False
            
            # Prepare Pixel Data (Slice)
            # Handle potential dimension mismatch if volume was squeezed differently
            if denoised_volume.ndim == 3:
                 slice_data = denoised_volume[i]
            elif denoised_volume.ndim == 2:
                 slice_data = denoised_volume # processing single slice
            else:
                 # Fallback
                 slice_data = denoised_volume[i]

            pixel_bytes = slice_data.tobytes()
            if len(pixel_bytes) % 2 != 0:
                pixel_bytes += b'\0'
                
            new_ds.PixelData = pixel_bytes
            new_ds.Rows, new_ds.Columns = slice_data.shape
            
            # Enforce Single Frame
            if "NumberOfFrames" in new_ds:
                del new_ds.NumberOfFrames

            # Ensure Metadata Consistency
            itemsize = slice_data.dtype.itemsize 
            bits_allocated = itemsize * 8
            new_ds.BitsAllocated = bits_allocated
            new_ds.BitsStored = bits_allocated
            new_ds.HighBit = bits_allocated - 1
            new_ds.SamplesPerPixel = 1
            new_ds.PixelRepresentation = 1 if np.issubdtype(slice_data.dtype, np.signedinteger) else 0

            output_datasets.append(new_ds)
            
    context.log.info(f"Created {len(output_datasets)} segmented datasets.")
    
    return output_datasets
