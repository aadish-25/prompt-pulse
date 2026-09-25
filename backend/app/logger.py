import os
import sys
import time
import logging
from logging.handlers import RotatingFileHandler
from contextlib import contextmanager

# Determine base directory
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOGS_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
LOG_FILE_PATH = os.path.join(LOGS_DIR, "promptpulse.log")

LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Configure root logger
logger = logging.getLogger("promptpulse")
logger.setLevel(logging.INFO)

# Avoid duplicate handlers on reload
if not logger.handlers:
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Rotating file handler
    file_handler = RotatingFileHandler(
        LOG_FILE_PATH,
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_formatter = logging.Formatter(LOG_FORMAT, datefmt=DATE_FORMAT)
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)


@contextmanager
def log_span(span_name: str, **extra):
    """
    Context manager to profile execution time and record step outcomes.
    Example:
        with log_span("web_search", query=query):
            ...
    """
    start_time = time.perf_counter()
    extra_str = f" | {extra}" if extra else ""
    logger.info(f"▶ START: {span_name}{extra_str}")
    try:
        yield
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        logger.info(f"✔ FINISH: {span_name} completed in {duration_ms:.1f}ms{extra_str}")
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        logger.error(f"✖ ERROR: {span_name} failed after {duration_ms:.1f}ms with {type(exc).__name__}: {exc}{extra_str}", exc_info=True)
        raise
