"""
DeviceStateMachine module.

Manages and validates device status transitions and synchronizes them
with the ScanHub backend via the Client.send_status() method.

This component ensures consistent, valid state updates even when
multiple asynchronous tasks interact with the same device instance.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any, ClassVar

from scanhub_libraries.models import DeviceStatus

if TYPE_CHECKING:
    from sdk.client import Client

log = logging.getLogger("DeviceStateMachine")


class InvalidStateTransitionError(Exception):
    """Raised when an invalid state transition is attempted."""


class DeviceStateMachine:
    """Finite state machine for device lifecycle management."""

    _VALID_TRANSITIONS: ClassVar[dict[DeviceStatus, list[DeviceStatus]]] = {
        DeviceStatus.OFFLINE: [DeviceStatus.ONLINE],
        DeviceStatus.ONLINE: [DeviceStatus.BUSY, DeviceStatus.OFFLINE],
        DeviceStatus.BUSY: [DeviceStatus.ONLINE, DeviceStatus.ERROR, DeviceStatus.OFFLINE],
        DeviceStatus.ERROR: [DeviceStatus.ONLINE, DeviceStatus.OFFLINE],
    }

    def __init__(self, client: Client) -> None:
        """
        Initialize a new DeviceStateMachine.

        Args:
            client: Reference to the Client instance used to send status updates.
        """
        self.client = client
        self._state: DeviceStatus = DeviceStatus.OFFLINE
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------
    # Core methods

    @property
    def state(self) -> DeviceStatus:
        """Return the current device state."""
        return self._state

    async def transition(self, new_state: DeviceStatus, *, context: dict[str, Any] | None = None) -> None:
        """
        Perform a validated state transition and propagate it to the backend.

        Args:
            new_state: Target state to transition to.
            context: Optional metadata (progress, task_id, access_token, etc.).
        """
        async with self._lock:
            if not self._is_valid_transition(new_state):
                msg = f"Invalid transition {self._state.value} → {new_state.value}"
                log.warning(msg)
                raise InvalidStateTransitionError(msg)

            self._state = new_state
            await self._send_status(new_state, context)
            msg = f"[STATE] Transitioned to {new_state.value}"
            log.info(msg)

    async def update_context(self, context: dict[str, Any]) -> None:
        """
        Update contextual data (e.g., progress) without changing state.

        Useful when BUSY state persists but progress updates are frequent.
        """
        async with self._lock:
            await self._send_status(self._state, context)
            msg = f"[STATE] Context update in {self._state.value}: {context}"
            log.debug(msg)

    # ------------------------------------------------------------------
    # Internal helpers

    def _is_valid_transition(self, new_state: DeviceStatus) -> bool:
        """Check if a transition is allowed from the current state."""
        valid_next = self._VALID_TRANSITIONS.get(self._state, [])
        return new_state in valid_next

    async def _send_status(self, status: DeviceStatus, context: dict[str, Any] | None = None) -> None:
        """Propagate state/context to backend."""
        context = context or {}
        try:
            await self.client.websocket_handler.send_message(
                self._build_status_message(status, context)
            )
        except Exception as e:
            # Don't kill the scan task because of a temporary socket issue.
            # Local state is still updated; the next progress or state update after reconnect will re-sync.
            log.warning(f"Suppressed send failure during {status.value}: {e}")

    def _build_status_message(self, status: DeviceStatus, context: dict[str, Any]) -> str:
        """Format a JSON message for WebSocket transmission."""
        message = {
            "command": "update_status",
            "status": status.value,
            "data": {k: v for k, v in context.items() if k not in ("task_id", "user_access_token")},
            "task_id": context.get("task_id"),
            "user_access_token": context.get("user_access_token"),
        }
        return json.dumps(message)
