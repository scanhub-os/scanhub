"""IO Manager for DICOM data."""
from typing import List, Union
from upath import UPath

import pydicom
from dagster import InputContext, OutputContext

from orchestrator.io.base import ScanHubIOManager


class DicomIOManager(ScanHubIOManager):
    """IO manager for pydicom objects using UPathIOManager."""

    def _get_path(self, context: OutputContext) -> UPath:
        """Resolve the path for an asset.

        Overrides ScanHubIOManager._get_path to return the output directory directly,
        without appending the asset key.
        """
        if hasattr(context.resources, "dag_config"):
            dag_config = context.resources.dag_config
            return UPath(dag_config.output_directory)
        return super()._get_path(context)

    def dump_to_path(self, context: OutputContext, obj: List[pydicom.Dataset], path: UPath) -> None:
        """Save list of datasets to path (directory)."""
        if not isinstance(obj, list):
             context.log.warning("DicomIOManager received single object, wrapping in list.")
             obj = [obj]
             
        # Ensure directory exists
        path.mkdir(parents=True, exist_ok=True)
        
        asset_name = context.asset_key.path[-1] if context.has_asset_key else "output"
             
        for i, ds in enumerate(obj):
            if len(obj) == 1:
                filename = f"{asset_name}.dcm"
            else:
                filename = f"{asset_name}_{i}.dcm"
            
            filepath = path / filename
            try:
                # pydicom requires str or Path, UPath should cast to PathStr if local
                # But to be safe, convert to string for pydicom
                ds.save_as(str(filepath))
            except Exception as e:
                context.log.error(f"Failed to save {filename}: {e}")
                raise e
        
        # Metadata logic is handled by base UPathIOManager?
        # UPathIOManager doesn't automatically add 'stored_files' metadata.
        # We can add it manually if desired, but dump_to_path returns None.
        # We can add metadata to context.
        # But OutputContext in dump_to_path is read-only? No, we can add_output_metadata.
        
        stored_files = [p.name for p in path.iterdir() if p.is_file()]
        context.add_output_metadata({
            "output_directory": str(path),
            "stored_files": stored_files,
            "num_files": len(stored_files)
        })

    def load_from_path(self, context: InputContext, path: UPath) -> List[pydicom.Dataset]:
        """Load all DICOMs from directory path."""
        datasets = []
        if path.exists() and path.is_dir():
            for p in path.iterdir():
                if p.is_file() and p.name.lower().endswith(".dcm"):
                    try:
                        ds = pydicom.dcmread(str(p))
                        datasets.append(ds)
                    except Exception as e:
                         context.log.warning(f"Failed to read {p}: {e}")
        return datasets

    def load_from_files(self, files: List[str]) -> List[pydicom.Dataset]:
        """Load DICOMs from file list (custom loader)."""
        datasets = []
        for f in files:
            try:
                ds = pydicom.dcmread(f)
                datasets.append(ds)
            except Exception as e:
                # Log? We don't have context here easily.
                # Actually we can get context if we pass it, but signature was load_from_files(files).
                # Print is bad. Raise? Or ignore?
                print(f"Warning: Failed to read {f}: {e}")
        return datasets
