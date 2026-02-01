"""Define the resource used by Dagster jobs."""
from dagster import ConfigurableResource


class DAGConfiguration(ConfigurableResource):
    """Run-scoped parameters accessible from assets + IO managers."""

    output_directory: str = ""
    input_files: list[str] = []
    user_access_token: str = ""
    output_result_id: str = ""
