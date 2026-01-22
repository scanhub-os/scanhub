

from dagster import SourceAsset, AssetKey
from scanhub_libraries.resources import DICOM_IO_KEY

# SourceAsset for loading data via DicomIOManager from dag_config
dicom_input = SourceAsset(
    key=AssetKey("dicom_input"), 
    io_manager_key=DICOM_IO_KEY, 
    description="Load DICOMs from input path defined in dag_config.",
    metadata={"source": "dag_config"}
)
