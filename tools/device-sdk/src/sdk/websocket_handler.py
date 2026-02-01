"""
WebSocketHandler module for managing WebSocket connections.

This module provides the `WebSocketHandler` class, which simplifies managing a WebSocket connection,
handling reconnection, and providing methods to send and receive messages.

Classes:
    WebSocketHandler: Manages WebSocket connections with reconnect logic.
"""

import asyncio
import logging
import ssl

from websockets.exceptions import ConnectionClosed
from websockets.legacy.client import WebSocketClientProtocol, connect


class WebSocketHandler:
    """
    Handler for managing WebSocket connections.

    Sends and receives messages, and handles automatic reconnection.

    Attributes
    ----------
        uri (str): The WebSocket server URI (device-manager) to connect to.
        websocket (websockets.WebSocketClientProtocol): The WebSocket connection object.
        device_id (str): The device ID to send when opening the connection.
        device_token (str): The device token to send when opening the connection.
        reconnect_delay (int): Delay in seconds before retrying connection upon failure.
        ca_file (str | None): Filepath to a ca_file to verify the server.
        logger (logging.Logger): Logger instance for logging events.
    """

    def __init__(
        self,
        uri: str,
        device_id: str,
        device_token: str,
        reconnect_delay: int = 5,
        ca_file: str | None = None,
    ) -> None:
        """Initialize the WebSocketHandler instance.

        Args:
            uri (str): The URI of the WebSocket server (device-manager).
            reconnect_delay (int, optional): Time in seconds to wait before
                                             retrying a failed connection.
                                             Defaults to 5.
        """
        self.uri: str = uri
        self.device_id: str = device_id
        self.device_token: str = device_token
        self.websocket: WebSocketClientProtocol | None = None
        self.reconnect_delay: int = reconnect_delay
        self.ca_file: str | None = ca_file
        self.logger: logging.Logger = logging.getLogger("WebSockerHandler")

    async def connect(self) -> None:
        """Establish a WebSocket connection.

        Continuously attempts to connect to the WebSocket server specified by the URI.
        Retries connection after `reconnect_delay` seconds in case of failure.

        Logs specific connection-related errors and retries accordingly.
        """
        print("Device ID:", self.device_id)
        self.websocket = await connect(
            self.uri,
            extra_headers={
                "Device-Id": str(self.device_id),
                "Device-Token": str(self.device_token),
            },
            ssl=ssl.create_default_context(cafile=self.ca_file),
            max_size=None,
        )
        self.logger.info("WebSocket connection established.")

    async def send_message(self, message: str | bytes) -> None:
        """Send a message through the WebSocket connection, buffering if disconnected."""
        try:
            if self.websocket is not None:
                await self.websocket.send(message)
            else:
                raise ConnectionError("WebSocket closed")
        except Exception as e:
            self.logger.warning("WebSocket send failed: %s", e)
            # Optionally trigger reconnect if not already doing so
            await asyncio.sleep(1)
            raise

    async def receive_message(self) -> str | bytes | None:
        """Receive a message from the WebSocket connection.

        Returns
        -------
            str or None: The received message, or `None` if the connection is closed.

        Logs:
            Logs an error if the connection is closed.
        """
        try:
            if self.websocket is not None:
                return await self.websocket.recv()
            raise ConnectionError("WebSocket closed")
        except ConnectionClosed:
            self.logger.info("WebSocket closed.")
            return None
        except Exception:
            self.logger.exception("Error on websocket message receive.", exc_info=True)
            raise

    async def close(self) -> None:
        """Close the WebSocket connection gracefully.

        Ensures the WebSocket connection is closed and logs the event.
        """
        if self.websocket is not None:
            await self.websocket.close()
            self.logger.info("WebSocket connection closed.")
            self.websocket = None
