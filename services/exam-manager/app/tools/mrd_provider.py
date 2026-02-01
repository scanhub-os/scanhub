"""Tools to provide ISMRM raw data."""
from __future__ import annotations

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING

import ismrmrd
import numpy as np
from scanhub_libraries.models import MRDAcquisitionInfo

if TYPE_CHECKING:
    from collections.abc import Iterable

DATA_LAKE_DIR = Path(os.getenv("DATA_LAKE_DIRECTORY", "/data")).resolve()

RANGE_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)(?::(\d+))?\s*$")


def locate_mrd(workflow_id: str, task_id: str, result_id: str) -> Path:
    """
    Build a file path.

    /data_lake/{workflow_id}/{task_id}/{result_id}/*.mrd
    """
    # You may also look up a DB row here instead of building a path.
    # You may also look up a DB row here instead of building a path.
    result_dir = DATA_LAKE_DIR / workflow_id / task_id / result_id
    try:
        return next(result_dir.glob("*.mrd"))
    except StopIteration:
        raise FileNotFoundError(f"No .mrd file found in {result_dir}")


@lru_cache(maxsize=64)
def build_index_meta(file_path: str) -> list[MRDAcquisitionInfo]:
    """Build index."""
    with ismrmrd.File(file_path, "r") as fh:
        dataset = fh[list(fh.keys())[0]]
        acquisitions = dataset.acquisitions[:]
        acqs: list[MRDAcquisitionInfo] = []
        for k, acq in enumerate(acquisitions):
            acqs.append(MRDAcquisitionInfo(
                acquisition_id=k,
                num_samples=int(acq.number_of_samples),
                num_coils=int(acq.active_channels),
                dwell_time=np.round(float(acq.sample_time_us * 1e-6), 6),
            ))
    return acqs

def load_acquisitions_slices(
    file_path: Path, acquisition_indices: Iterable[int], coil_idx: int = 0, stride: int = 1, dataset_idx: int = 0,
) -> Iterable[np.ndarray]:
    """Load raw data slice."""
    with ismrmrd.File(file_path, "r") as fh:
        dataset = fh[list(fh.keys())[dataset_idx]]
        for acq_idx in acquisition_indices:
            data = dataset.acquisitions[acq_idx].data
            if coil_idx < data.shape[0]:
                data = data[coil_idx, :]
            if stride > 1:
                data = data[:, ::stride]
            out = np.empty((*data.shape, 2), dtype=np.float32)
            out[..., 0] = np.real(data).astype(np.float32)
            out[..., 1] = np.imag(data).astype(np.float32)
            yield out


def parse_ids(expr: str) -> list[int]:
    """Parse ids."""
    out: list[int] = []
    for token in expr.split(","):
        t = token.strip()
        if not t:
            continue
        m = RANGE_RE.match(t)
        if m:
            start, end, step = int(m.group(1)), int(m.group(2)), int(m.group(3) or 1)
            if end < start or step <= 0:
                raise ValueError(f"Bad range: {t}")
            out.extend(range(start, end + 1, step))
        else:
            out.append(int(t))
    return out
