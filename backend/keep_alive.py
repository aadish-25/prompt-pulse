"""
PromptPulse Keep-Alive / Health Ping Daemon.

Periodically pings the server / database health endpoint to prevent:
1. Neon PostgreSQL serverless compute cold-starts (which cause 5-30s initial query latency)
2. Railway / Render / free-tier host container sleep / suspension

Usage:
    python backend/keep_alive.py
    or import and start in a background thread:
    from backend.keep_alive import start_keep_alive_thread
"""
import os
import sys
import time
import logging
import threading
import urllib.request
import urllib.error

# Determine default target URL
DEFAULT_TARGET = os.environ.get("KEEP_ALIVE_URL", "http://localhost:8000/health")
DEFAULT_INTERVAL_SECS = int(os.environ.get("KEEP_ALIVE_INTERVAL_SECS", "240"))  # 4 mins

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [KEEP-ALIVE] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("keep_alive")


def ping_once(url: str, timeout: int = 15) -> bool:
    start = time.perf_counter()
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "PromptPulse-KeepAlive/1.0"}
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            status = resp.status
            if status == 200:
                logger.info(f"Ping successful -> {url} ({elapsed_ms:.1f}ms, status={status})")
                return True
            else:
                logger.warning(f"Ping returned non-200 status {status} -> {url} ({elapsed_ms:.1f}ms)")
                return False
    except urllib.error.URLError as err:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        logger.warning(f"Ping connection error ({elapsed_ms:.1f}ms) -> {url}: {err.reason}")
        return False
    except Exception as exc:
        elapsed_ms = (time.perf_counter() - start) * 1000.0
        logger.warning(f"Ping exception ({elapsed_ms:.1f}ms) -> {url}: {exc}")
        return False


def run_daemon(url: str = DEFAULT_TARGET, interval: int = DEFAULT_INTERVAL_SECS):
    logger.info(f"Starting Keep-Alive Daemon -> Target: {url} | Interval: {interval}s")
    while True:
        ping_once(url)
        time.sleep(interval)


def start_keep_alive_thread(url: str = DEFAULT_TARGET, interval: int = DEFAULT_INTERVAL_SECS) -> threading.Thread:
    """Starts the keep alive loop in a background daemon thread."""
    t = threading.Thread(target=run_daemon, args=(url, interval), daemon=True, name="PromptPulse-KeepAlive")
    t.start()
    return t


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TARGET
    interval = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_INTERVAL_SECS
    try:
        run_daemon(target, interval)
    except KeyboardInterrupt:
        logger.info("Keep-Alive Daemon stopped by user.")
