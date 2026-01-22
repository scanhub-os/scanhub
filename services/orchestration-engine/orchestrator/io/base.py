"""Base IO Manager for ScanHub resources."""
from abc import ABC, abstractmethod
from typing import Any, List, Optional
from upath import UPath

from dagster import InputContext, OutputContext, UPathIOManager

class ScanHubIOManager(UPathIOManager, ABC):
    """Base IO Manager for ScanHub using UPathIOManager.
    
    Handles path resolution and common IO patterns.
    """
    
    def _get_path(self, context: InputContext | OutputContext) -> UPath:
        """Resolve the path for an asset.
        
        Uses the 'dag_config' resource if available to determine the base output directory.
        Falls back to a default if not found (though dag_config is expected).
        """
        # Retrieve configuration
        if hasattr(context.resources, "dag_config"):
            dag_config = context.resources.dag_config
            base_dir = dag_config.output_directory
            context.log.info(f"ScanHubIOManager: Retrieved output_directory from dag_config: {base_dir}")
        else:
             context.log.error("ScanHubIOManager: dag_config resource NOT found in context.")
             raise RuntimeError("dag_config resource NOT found in context. Ensure the asset requires 'dag_config' resource key.")
        
        # Ensure base_dir is set
        if not base_dir:
             context.log.error("ScanHubIOManager: output_directory is empty in dag_config.")
             raise ValueError("output_directory is not defined in dag_config.")

        # Construct path: base_dir / asset_key_path
        # asset_key.path is a list of strings
        if context.has_asset_key:
             return UPath(base_dir) / UPath(*context.asset_key.path)
        else:
             # Fallback for non-asset outputs (ops)
             return UPath(base_dir) / context.get_identifier()

    @abstractmethod
    def load_from_files(self, files: List[str]) -> Any:
        """Load object from a specific list of files."""
        pass

    def load_input(self, context: InputContext) -> Any:
        """Load input data.
        
        Overrides UPathIOManager.load_input to handle SourceAssets that rely on 
        run-time configuration (dag_config) instead of storage.
        """
        # Check if upstream asset has metadata indicating loading from dag_config
        # Note: For SourceAssets, upstream_output refers to the SourceAsset's definition
        if context.upstream_output and context.upstream_output.metadata:
            source = context.upstream_output.metadata.get("source")
            if source == "dag_config":
                 if not hasattr(context.resources, "dag_config"):
                     context.log.error("dag_config resource missing explicitly requested by source asset.")
                     raise AttributeError("dag_config resource missing.")
                     
                 dag_config = context.resources.dag_config
                 context.log.info(f"Loading input from dag_config files: {len(dag_config.input_files)} files")
                 return self.load_from_files(dag_config.input_files)
        
        # Default to standard UPath behavior (load from storage)
        return super().load_input(context)
