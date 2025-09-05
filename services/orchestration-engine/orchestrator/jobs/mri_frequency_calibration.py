# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""MRI calibration assets."""
import ismrmrd
import numpy as np
from dagster import OpExecutionContext, job, op
from scanhub_libraries.resources.dag_config import DAGConfiguration
from scanhub_libraries.resources.notifier import DeviceManagerNotifier

from orchestrator.io.acquisition_data import AcquisitionData, acquisition_data_op
from orchestrator.utils.snr import signal_to_noise_ratio


@op
def frequency_calibration_op(
    context: OpExecutionContext,
    data: AcquisitionData,
    dag_config: DAGConfiguration,
    notifier_device_manager: DeviceManagerNotifier,
) -> None:
    """Perform frequency calibration on MRI acquisition data.

    This operation reads an ISMRMRD file containing MRI acquisition data, computes the frequency offset using FFT,
    calculates the signal-to-noise ratio (SNR) and full width at half maximum (FWHM), and updates the device's
    larmor frequency parameter accordingly. The updated parameter is sent to the device manager notifier.

    Args:
        context (OpExecutionContext): The execution context for logging and operation metadata.
        data (AcquisitionData): The acquisition data containing device parameters and the path to the ISMRMRD file.
        dag_config (DAGConfiguration): The DAG configuration, including user access token.
        notifier_device_manager (DeviceManagerNotifier): The notifier for sending device parameter updates.

    Returns:
        None

    """
    parameter = data.device_parameter
    context.log.info(f"Received device parameters (device id: {data.device_id}): {parameter}")

    # Read ismrmrd file provided by acquisition data asset
    with ismrmrd.File(data.mrd_path, "r") as f:
        ds = f[list(f.keys())[0]]
        header = ds.header
        acquisitions = ds.acquisitions

        num_acquisitions = len(acquisitions)
        if num_acquisitions > 1:
            context.log.warning(
                "Data is not 1D, got %s acquisition, processing first acquisition.",
                num_acquisitions,
            )

        # Only consider first acquisition and data from coil at index 0
        acq = acquisitions[0]
        acq_data = acq.data[0, ...]
        dwell_time = acq.sample_time_us * 1e-6
        data_fft = np.fft.fftshift(np.fft.fft(np.fft.fftshift(acq_data)))
        fft_freq = np.fft.fftshift(np.fft.fftfreq(acq_data.size, dwell_time))

        # Calculate SNR and FWHM
        bw_per_pixel = 1 / dwell_time / acq_data.size
        snr, fwhm_px = signal_to_noise_ratio(data_fft)
        fwhm_hz = round(fwhm_px*bw_per_pixel)
        context.log.info("SNR: %s dB, FWHM: %s Hz", str(round(snr, 2)), str(fwhm_hz))

        freq_offset = fft_freq[np.argmax(np.abs(data_fft))]

        # Get experiment larmor frequency
        f0 = header.experimentalConditions.H1resonanceFrequency_Hz
        context.log.info(
            "Frequency from acquisition: %s Hz, Larmor frequency offset: %s Hz",
            str(f0),
            str(freq_offset),
        )

    # Correct device parameter
    parameter["larmor_frequency"] = f0 + freq_offset
    notifier_device_manager.send_device_parameter_update(
        device_id=data.device_id, access_token=dag_config.user_access_token, parameter=parameter,
    )


@job(
    name="frequency_calibration",
    description="Read ismrmrd data and adjust Larmor frequency.",
)
def frequency_calibration_job() -> None:
    """Perform the Larmor frequency calibration job.

    This function loads acquisition data and then runs the frequency calibration
    operation using loaded ISMRMRD data. It is intended to be used as a job in the
    orchestration engine for MRI frequency calibration.

    Returns:
        None

    """
    data = acquisition_data_op()
    frequency_calibration_op(data)
