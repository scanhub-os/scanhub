# orchestrator/resources/notifier.py
import httpx
from dagster import ConfigurableResource


class WorkflowManagerNotifier(ConfigurableResource):
    """Notifies device manager."""

    base_url: str
    timeout: float = 5.0

    def send_dag_success(self, result_id: str, access_token: str, success: bool = True) -> None:
        """Notify backend about successful execution of dagster job/dag."""
        headers = {"Authorization": "Bearer " + access_token}
        payload = {"success": success}
        url = self.base_url.rstrip("/") + f"/result_ready/{result_id}"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload, headers=headers)
            response.raise_for_status()


class DeviceManagerNotifier(ConfigurableResource):
    """Notifies device manager."""

    base_url: str
    timeout: float = 5.0

    def send_device_parameter_update(self, device_id: str, access_token: str, parameter: dict) -> None:
        """Notify backend about device parameter update and send parameters."""
        headers = {"Authorization": "Bearer " + access_token}
        url = self.base_url.rstrip("/") + f"/parameter/{device_id}"
        with httpx.Client(timeout=self.timeout) as client:
            response = client.put(url, json=parameter, headers=headers)
            response.raise_for_status()
