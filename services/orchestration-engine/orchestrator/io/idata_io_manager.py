"""Dagster IO Manager for mrpro IData object."""
from typing import List
from upath import UPath

from dagster import InputContext, OutputContext
from mrpro.data import IData

from orchestrator.io.base import ScanHubIOManager


class IDataIOManager(ScanHubIOManager):
    """IO manager for mrpro IData object."""

    def _get_path(self, context: OutputContext) -> UPath:
        """Resolve the path for an asset.

        Overrides ScanHubIOManager._get_path to return the output directory directly,
        without appending the asset key. This is required because the exam-manager
        expects files to be directly in the result directory.
        """
        if hasattr(context.resources, "dag_config"):
            dag_config = context.resources.dag_config
            return UPath(dag_config.output_directory)
        return super()._get_path(context)

    def dump_to_path(self, context: OutputContext, obj: IData, path: UPath) -> None:
        """Save IData to directory."""
        if path.exists():
            import shutil
            shutil.rmtree(path)
            
        # path (UPath) will be converted to string, UPath creates dir structure if needed? 
        # mrpro expects parent to exist?
        # to_dicom_folder creates the folder itself.
        # But parents?
        # path.parent.mkdir(parents=True, exist_ok=True)
        # Actually UPath might need specific handling, but for local FS str(path) is fine.
        
        # Ensure parent exists just in case
        path.parent.mkdir(parents=True, exist_ok=True)
        
        # Assuming mrpro supports path-like string or Path object
        obj.to_dicom_folder(str(path))
        
        stored_files = [p.name for p in path.iterdir() if p.is_file()]
        context.add_output_metadata({
            "output_directory": str(path),
            "stored_files": stored_files,
        })

    def load_from_path(self, context: InputContext, path: UPath) -> IData:
        """Load IData from directory."""
        return IData.from_dicom_folder(str(path))

    def load_from_files(self, files: List[str]) -> IData:
        """Load IData from file list."""
        if not files:
            return None
        
        folder = UPath(files[0]).parent
        return IData.from_dicom_folder(str(folder))
