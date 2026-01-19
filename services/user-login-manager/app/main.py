# Copyright (C) 2023, BRAIN-LINK UG (haftungsbeschränkt). All Rights Reserved.
# SPDX-License-Identifier: GPL-3.0-only OR LicenseRef-ScanHub-Commercial

"""User login manager main file."""


from fastapi import FastAPI, HTTPException
from fastapi.exception_handlers import (
    http_exception_handler,
    request_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.db import engine, init_db
from app.userlogin import LOG_CALL_DELIMITER, router

app = FastAPI(
    openapi_url="/api/v1/userlogin/openapi.json",
    docs_url="/api/v1/userlogin/docs"
)

# To be done: Specify specific origins:
#   Wildcard ["*"] excludes eeverything that involves credentials
#   Better specify explicitly the allowed origins
#   See: https://fastapi.tiangolo.com/tutorial/cors/
import os

origins = [
    # "http://localhost",       # frontend via nginx-proxy with default port
    # "https://localhost",      # frontend via nginx-proxy with default port
    "http://localhost:8080",    # frontend via nginx-proxy with custom port
    "https://localhost:8443",   # frontend via nginx-proxy with custom port
]

if extra_origins := os.getenv("SCANHUB_ALLOWED_ORIGINS"):
    origins.extend(extra_origins.split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def custom_http_exception_handler(request, exc):
    """
    Add logging for http exceptions.

    https://fastapi.tiangolo.com/tutorial/handling-errors/#reuse-fastapis-exception-handlers
    """
    print(f"{repr(exc)}")
    return await http_exception_handler(request, exc)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    """
    Add logging for fastAPI's automatic input validation exceptions.

    https://fastapi.tiangolo.com/tutorial/handling-errors/#reuse-fastapis-exception-handlers
    """
    print(f"{exc}")
    return await request_validation_exception_handler(request, exc)


@app.on_event("startup")
async def startup():
    """Statup exam-tree microservice.

    Raises
    ------
    HTTPException
        500: Device table does not exist
    HTTPException
        500: Workflow table does not exist
    """
    # ins = inspect(engine)
    # tables = ins.get_table_names()
    # if "device" not in tables:     # maybe we need some other table, lets see
    #     raise HTTPException(
    #         status_code=500,
    #         detail="SQL-DB: Device table is required but does not exist.",
    #     )
    init_db()


@app.on_event("shutdown")
async def shutdown() -> None:
    """Shutdown function."""
    return None


@router.get("/health/readiness", response_model={}, status_code=200, tags=["health"])
async def readiness() -> dict:
    """Readiness health endpoint.

    Returns
    -------
        Status dictionary

    Raises
    ------
    HTTPException
        500: User table does not exist
    """
    print(LOG_CALL_DELIMITER)
    ins = inspect(engine)
    existing_tables = ins.get_table_names()
    required_tables = ["user"]

    if not all(t in existing_tables for t in required_tables):
        raise HTTPException(status_code=500, detail="SQL-DB: Could not create all required tables.")

    return {"status": "ok"}


app.include_router(router, prefix="/api/v1/userlogin")
