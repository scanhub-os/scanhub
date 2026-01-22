"""Client module for managing device interactions with device-manager.

This module defines the `Client` class, which facilitates the connection,
device registration, and command handling for devices communicating with
device-manager via WebSocket.

Classes:
    Client: Handles device registration, status updates, and server command processing.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any, Optional

from scanhub_libraries.models import AcquisitionPayload, DeviceDetails, DeviceStatus

from sdk.device_state_machine import DeviceStateMachine
from sdk.websocket_handler import WebSocketHandler

MAX_FILE_UPLOAD_ATTEMPTS = 3

CHUNK = 1 << 20  # 1 MiB, chunk size for file transfers
log = logging.getLogger("DeviceClient")


class Client:
    """Client for managing WebSocket interactions with device-manager.

    Includes device registration, status updates, and handling server commands.

    Attributes
    ----------
        websocket_uri (str): The URI of the WebSocket server (device-manager).
        websocket_handler (WebSocketHandler): Manages the WebSocket connection.
        device_id (UUID): The Device ID. Copy it from Scanhub.
        device_token (str): The device-token used to authenticate the device. Copy it from Scanhub.
        details (DeviceDetails): Details about the device, including device paramters.
        reconnect_delay (int): Delay in seconds before reconnect attempts.
        feedback_handler (callable): Callback for handling feedback messages.
        scan_callback (callable): Callback for handling scanning commands.
        error_handler (callable): Callback for handling error messages.
        logger (logging.Logger): Logger for the class.

    """

    def __init__(
        self,
        websocket_uri: str,
        device_id: str,
        device_token: str,
        device_details: DeviceDetails,
        reconnect_delay: int = 5,
        ca_file: str | None = None,
    ) -> None:
        """Initialize the Client instance.

        Args:
        ----
            websocket_uri (str): URI of the WebSocket server (device-manager).
            device_id (UUID): The Device ID. Copy it from Scanhub.
            device_token (str): The device-token used to authenticate the device. Copy it from Scanhub.
            device_name (str): Name of the device.
            serial_number (str): Serial number of the device.
            manufacturer (str): Device manufacturer.
            modality (str): Device modality type.
            site (str): Device location.
            reconnect_delay (int, optional): Delay in seconds for reconnect attempts. Defaults to 5.
            ca_file (str | None): Filepath to a ca_file to verify the server.

        """
        self.websocket_uri = websocket_uri
        self.websocket_handler = WebSocketHandler(
            uri=websocket_uri,
            device_id=device_id,
            device_token=device_token,
            reconnect_delay=reconnect_delay,
            ca_file=ca_file,
        )
        self.device_id = device_id  # Unique ID for the device
        self.device_token = device_token
        self.details: DeviceDetails = device_details
        self.reconnect_delay = reconnect_delay

        # External handlers
        self.feedback_handler: Optional[Callable[[str], Awaitable[None]]] = None
        self.error_handler: Optional[Callable[[str], Awaitable[None]]] = None
        self.scan_callback: Optional[Callable[[AcquisitionPayload], Awaitable[None]]] = None

        # Task management
        self.active_tasks: dict[str, asyncio.Task[Any]] = {}
        self._task_lock = asyncio.Lock()

        # Device state machine
        self.state_machine = DeviceStateMachine(self)

        # Create file upload queue
        self.upload_queue: asyncio.Queue[tuple[Path, str, dict[str, Any], str, str]] = asyncio.Queue()

    # --------------------------------------------------------------------------
    # Core lifecycle

    async def start(self) -> None:
        """Start client: connect, register, and listen for commands."""
        await self.connect_and_register()
        # Start background tasks
        asyncio.create_task(self.listen_for_commands())
        asyncio.create_task(self._heartbeat(interval=15))
        asyncio.create_task(self._file_uploader())

    async def connect_and_register(self) -> None:
        """Connect to the WebSocket server and registers the device."""
        await self.websocket_handler.connect()
        await self.state_machine.transition(DeviceStatus.ONLINE)
        await self.register_device()

    async def stop(self) -> None:
        """Stop the client and close all tasks."""
        async with self._task_lock:
            for t in self.active_tasks.values():
                t.cancel()
            self.active_tasks.clear()
        await self.state_machine.transition(DeviceStatus.OFFLINE)
        await self.websocket_handler.close()
        log.info("WebSocket connection closed.")

    async def reconnect(self) -> None:
        """Reconnect to the server and re-register the device."""
        log.info("Attempting to reconnect in %d seconds...", self.reconnect_delay)
        await asyncio.sleep(self.reconnect_delay)
        await self.connect_and_register()

    # --------------------------------------------------------------------------
    # Command loop and & heartbeat

    async def listen_for_commands(self) -> None:
        """Listen for incoming commands from the server and processes them.

        Handles commands like 'start', 'feedback', and errors. Reconnects if the connection is lost.
        """
        while True:
            try:
                message = await self.websocket_handler.receive_message()
                if message is None:
                    # Connection closed, try to reconnect
                    raise ConnectionError("Connection lost. Attempting to reconnect...")
                data = json.loads(message)
                command = data.get("command")

                if command == "start":
                    payload = AcquisitionPayload(**data.get("data", {}))
                    await self.handle_start_command(payload)
                elif command == "feedback":  # for feedback only 'message' is needed
                    await self.handle_feedback(data.get("message"))
                elif command == "pong":
                    log.debug("Pong received.")
                    continue
                else:  # on error whole websocket message is needed
                    await self.handle_error(str(data))
            except json.JSONDecodeError:
                log.error("Received invalid JSON message: %s", message)
            except ConnectionError as e:
                if self.websocket_handler.websocket is None:
                    return  # No active connection, exit the loop
                log.error(e)
                await self.reconnect()
            except Exception as e:
                log.error("Error while receiving commands: %s", str(e))
                await self.reconnect()

    async def _heartbeat(self, interval: int = 15) -> None:
        """Periodically send ping messages to keep connection alive.

        This application level ping-pong allows to track if devices are still alive
        and store additional information such as 'last_seen'.
        """
        while True:
            try:
                await asyncio.sleep(interval)
                if self.websocket_handler.websocket:
                    await self.websocket_handler.send_message(json.dumps({"command": "ping"}))
                    log.debug("Ping sent.")
            except asyncio.CancelledError:
                break
            except Exception as exc:
                log.warning(f"Heartbeat send failed: {exc}")
                await self.reconnect()

    # --------------------------------------------------------------------------
    # Command handlers

    async def handle_start_command(self, payload: AcquisitionPayload) -> None:
        """Handle the 'start' command from the server to begin a scanning process.

        Sends an error status if the scan callback is not defined or an error occurs during processing.

        Args:
        ----
            deviceTask (dict): Command data containing scanning parameters.

        """
        if not self.scan_callback:
            log.error("Scan callback not defined.")
            await self.state_machine.transition(
                DeviceStatus.ERROR,
                context={"error_message": "Scan callback not defined."},
            )
            return

        async with self._task_lock:
            if str(payload.id) in self.active_tasks:
                log.warning("Scan already running for task %s", payload.id)
                return

            # Create background task (non-blocking)
            task = asyncio.create_task(self._run_scan_task(payload))
            self.active_tasks[str(payload.id)] = task

    async def _run_scan_task(self, payload: AcquisitionPayload) -> None:
        """Execute the scan asynchronously and manage its lifecycle."""
        task_id = str(payload.id)
        try:
            if not callable(self.scan_callback):
                log.error("Scan callback not defined.")
                await self.state_machine.transition(
                    DeviceStatus.ERROR,
                    context={
                        "error_message": "Scan callback not defined.",
                        "task_id": str(payload.id),
                        "user_access_token": payload.access_token,
                    },
                )
                return
            await self.state_machine.transition(DeviceStatus.BUSY, context={
                "progress": 0,
                "task_id": str(payload.id),
                "user_access_token": payload.access_token,
            })
            await self.scan_callback(payload)
            log.info(f"Scan task {task_id} completed successfully.")

        except asyncio.CancelledError:
            log.warning(f"Scan task {task_id} cancelled.")
            await self.state_machine.transition(
                DeviceStatus.ERROR,
                context={
                    "error_message": "Scan cancelled",
                    "task_id": str(payload.id),
                    "user_access_token": payload.access_token,
                },
            )
        except Exception as exc:
            log.exception(f"Scan task {task_id} failed: {exc}")
            await self.state_machine.transition(
                DeviceStatus.ERROR,
                context={
                    "error_message": str(exc),
                    "task_id": str(payload.id),
                    "user_access_token": payload.access_token,
                },
            )
        finally:
            async with self._task_lock:
                self.active_tasks.pop(task_id, None)
            await self.state_machine.transition(DeviceStatus.ONLINE)

    async def cancel_scan(self, task_id: str) -> None:
        """Cancel an active scan."""
        async with self._task_lock:
            task = self.active_tasks.get(task_id)
            if task:
                task.cancel()
                log.info(f"Cancelled scan task {task_id}")

    # --------------------------------------------------------------------------
    # Status and feedback

    async def register_device(self) -> None:
        """Send a registration message to the server to register the device.

        The registration data includes device details like ID, name, manufacturer, and location.
        """
        registration_data = {
            "command": "register",
            "data": self.details.model_dump(),
        }
        await self.websocket_handler.send_message(json.dumps(registration_data))
        log.info("Device registration sent.")

    async def handle_feedback(self, message: str) -> None:
        """Handle feedback messages from the server."""
        if self.feedback_handler is not None:
            await self.feedback_handler(message)
        else:
            log.info("Feedback received from server: %s", message)

    async def handle_error(self, message: str) -> None:
        """Handle error messages from the server."""
        if self.error_handler is not None:
            await self.error_handler(message)
        else:
            log.info("Error received from server: %s", message)

    async def send_scanning_status(self, progress: int, task_id: str, user_access_token: str) -> None:
        """Send progress updates via state machine.

        Thin wrapper function which can be called within scan callback to update progress.
        """
        await self.state_machine.update_context({
            "progress": progress,
            "task_id": task_id,
            "user_access_token": user_access_token,
        })

    # --------------------------------------------------------------------------
    # File upload

    async def upload_file_result(
        self,
        file_path: str | Path,
        name: str,
        parameter: dict[str, Any],
        task_id: str,
        user_access_token: str,
    ) -> None:
        """Enqueue file upload task."""
        # Ensure that the file name has the correct suffix
        path = Path(file_path)
        if not name.endswith(path.suffix):
            name += path.suffix
        await self.upload_queue.put((path, name, parameter, task_id, user_access_token))
        msg = f"Queued file for upload: {file_path}"
        log.info(msg)

    async def _file_uploader(self) -> None:
        """Background worker to upload files sequentially with retry logic."""
        while True:
            try:
                file_path, name, parameter, task_id, user_token = await self.upload_queue.get()
                attempt, success = 0, False

                while not success and attempt < MAX_FILE_UPLOAD_ATTEMPTS:
                    attempt += 1
                    try:
                        await self._upload_file_direct(file_path, name, parameter, task_id, user_token)
                        success = True
                        msg = f"Uploaded file {file_path} successfully."
                        log.info(msg)
                    except Exception as exc:
                        msg = f"Upload failed (attempt {attempt}): {exc}"
                        log.warning(msg)
                        await asyncio.sleep(2**attempt)  # exponential backoff

                if not success:
                    msg = f"Giving up on file {file_path} after {attempt} attempts."
                    log.error(msg)
                    await self.state_machine.transition(
                        DeviceStatus.ERROR,
                        context={"error_message": f"File upload failed after {attempt} attempts."},
                    )

            except asyncio.CancelledError:
                break
            except Exception as exc:
                msg = f"Uploader error: {exc}"
                log.error(msg)

    async def _upload_file_direct(
        self,
        path: Path, name: str,
        parameter: dict[str, Any],
        task_id: str,
        user_access_token: str,
    ) -> None:
        """Perform actual streaming of a file to the backend."""
        if not path.exists():
            raise FileNotFoundError(path)

        size = path.stat().st_size
        ct = "application/x-ismrmrd+hdf5" if path.suffix == ".mrd" else "application/octet-stream"

        sha = hashlib.sha256()
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(CHUNK), b""):
                sha.update(chunk)
        sha_hex = sha.hexdigest()

        header = {
            "command": "file-transfer",
            "task_id": task_id,
            "user_access_token": user_access_token,
            "filename": name,
            "size_bytes": size,
            "content_type": ct,
            "sha256": sha_hex,
            "device_parameter": parameter,
        }

        await self.websocket_handler.send_message(json.dumps(header))
        with path.open("rb") as f:
            for chunk in iter(lambda: f.read(CHUNK), b""):
                await self.websocket_handler.send_message(chunk)

    # --------------------------------------------------------------------------
    # Handler registration

    def set_feedback_handler(self, handler: Callable[[str], Awaitable[None]]) -> None:
        """Set feedback handler."""
        self.feedback_handler = handler

    def set_error_handler(self, handler: Callable[[str], Awaitable[None]]) -> None:
        """Set error handler."""
        self.error_handler = handler

    def set_scan_callback(self, callback: Callable[[AcquisitionPayload], Awaitable[None]]) -> None:
        """Set scan callback."""
        self.scan_callback = callback
