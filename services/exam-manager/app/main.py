# main.py

# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""Exam manager main file."""

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.exam_api import exam_router
from app.api.mri_sequence_api import seq_router
from app.api.result_api import result_router
from app.api.task_api import task_router
from app.api.workflow_api import workflow_router
from app.db.mongodb import close_mongo_connection, connect_to_mongo, db
from app.db.postgres import engine, init_db

from . import LOG_CALL_DELIMITER

import os

ORIGINS = [
    "http://localhost:8080",
    "https://localhost:8443",
    "https://localhost:3000",
]

if extra_origins := os.getenv("SCANHUB_ALLOWED_ORIGINS"):
    ORIGINS.extend(extra_origins.split(","))

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Define application lifespan."""
    # STARTUP
    ins = inspect(engine)
    tables = ins.get_table_names()
    if "device" not in tables:
        # Use RuntimeError (or any Exception) to abort startup; HTTPException is for request-time.
        raise RuntimeError("SQL-DB: Device table is required but does not exist.")

    print("Initializing postgres db...")
    init_db()

    print("Connecting to mongodb...")
    await connect_to_mongo()

    # Create shared connections here...

    try:
        # hand control to the app runtime
        yield
    finally:
        # Shutdown
        print("Closing mongodb connection...")
        await close_mongo_connection()

        # Close shared connections here, if any

app = FastAPI(
    openapi_url="/api/v1/exam/openapi.json",
    docs_url="/api/v1/exam/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*", "Range"],
    expose_headers=["Content-Range", "Accept-Ranges", "Content-Length"],
)

@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    """Get http exception handler."""
    print(f"{repr(exc)}")
    return await http_exception_handler(request, exc)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """Get request validation exception handler."""
    print(f"{exc}")
    return await request_validation_exception_handler(request, exc)

@app.get("/api/v1/exam/health/readiness", response_model={}, status_code=200, tags=["health"])
async def readiness() -> dict:
    """Get status / health endpoint."""
    print(LOG_CALL_DELIMITER)
    ins = inspect(engine)
    existing_tables = ins.get_table_names()
    required_tables = ["exam", "workflow", "task"]

    if not all(t in existing_tables for t in required_tables):
        raise HTTPException(status_code=500, detail="SQL-DB: Could not create all required tables.")

    if db.collection is None:
        raise HTTPException(status_code=503, detail=f"Database not connected: {str(db.collection)}")

    return {"status": "ok"}

# Routers
app.include_router(exam_router, prefix="/api/v1/exam")
app.include_router(workflow_router, prefix="/api/v1/exam")
app.include_router(task_router, prefix="/api/v1/exam")
app.include_router(result_router, prefix="/api/v1/exam")
app.include_router(seq_router, prefix="/api/v1/exam")
