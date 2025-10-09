"""Device state machine."""
import asyncio
import logging

from scanhub_libraries.models import DeviceStatus

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("DeviceClient")


class InvalidStateTransition(Exception):
    """Raised when an invalid state transition is attempted."""


class DeviceStateMachine:
    """Manages and enforces valid device state transitions."""

    def __init__(self, client) -> None:
        """Init function."""
        self._state = DeviceStatus.OFFLINE
        self._lock = asyncio.Lock()  # prevent race conditions
        self.client = client  # reference to Client for sending status updates

    @property
    def state(self) -> DeviceStatus:
        return self._state

    async def transition(self, new_state: DeviceStatus, *, context: dict | None = None) -> None:
        """Perform a safe state transition and propagate to backend."""
        async with self._lock:
            if not self._is_valid_transition(new_state):
                msg = f"Cannot transition {self._state} → {new_state}"
                log.error(msg)
                raise InvalidStateTransition(msg)

            self._state = new_state
            await self.client.send_status(new_state, data=context or {})
            log.info(f"[STATE] Device transitioned to {new_state.value}")

    def _is_valid_transition(self, new_state: DeviceStatus) -> bool:
        """Define valid transitions."""
        transitions = {
            DeviceStatus.OFFLINE: [DeviceStatus.ONLINE],
            DeviceStatus.ONLINE: [DeviceStatus.BUSY, DeviceStatus.OFFLINE],
            DeviceStatus.BUSY: [DeviceStatus.ONLINE, DeviceStatus.ERROR, DeviceStatus.OFFLINE],
            DeviceStatus.ERROR: [DeviceStatus.ONLINE, DeviceStatus.OFFLINE],
        }
        return new_state in transitions[self._state]
