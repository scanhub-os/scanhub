"""Signal-to-noise ratio (SNR) calculation."""
import numpy as np


def signal_to_noise_ratio(data: np.ndarray) -> tuple[float, int]:
    """Calculate the signal to noise ratio in dB.

    Parameters
    ----------
    data
        Centered 1D spectrum of the acquired signal

    Returns
    -------
        Tuple containing snr and fwhm in points

    """
    if data.ndim > 1:
        raise AttributeError("Provide 1D data to calculate snr.")
    data_abs = np.abs(data)
    peak_idx = int(np.argmax(data_abs))
    peak = data_abs[peak_idx]
    fwhm_left_idx = np.argmin(data_abs[:peak_idx] - peak / 2)
    fwhm_right_idx = np.argmin(data_abs[peak_idx:] - peak / 2)
    fwhm_px = int(fwhm_right_idx - fwhm_left_idx)
    if fwhm_px <= 0:
        raise ValueError("Invalid FWHM (result <= 0)")

    noise_left = data[:peak_idx-fwhm_px]
    noise_right = data[peak_idx+fwhm_px:]
    noise = np.concat((noise_left, noise_right)).std()

    snr_db = float(20 * np.log10(peak / noise))

    return (snr_db, fwhm_px)
