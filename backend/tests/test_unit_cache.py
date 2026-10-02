"""
Comprehensive Unit Test Suite for InMemoryCache, LRU Eviction, TTL Pruning,
Thread-Safety & Upstash Redis Fallback.
"""
import time
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import MagicMock, patch
import pytest
from app.core.cache import InMemoryCache, UpstashRedisCache


class TestInMemoryCache:
    """Tests the thread-safe in-memory cache implementation."""

    def test_basic_set_get_and_miss(self):
        cache = InMemoryCache(max_items=10, default_ttl=60.0)
        cache.set("brand:101", {"name": "AudioBrand", "score": 92.5})
        assert cache.get("brand:101") == {"name": "AudioBrand", "score": 92.5}
        assert cache.get("nonexistent_key") is None

    def test_ttl_expiration(self):
        cache = InMemoryCache(max_items=10, default_ttl=0.2)
        cache.set("temp_key", "temporary_value")
        assert cache.get("temp_key") == "temporary_value"
        time.sleep(0.3)
        assert cache.get("temp_key") is None

    def test_custom_ttl_override_per_set(self):
        cache = InMemoryCache(max_items=10, default_ttl=10.0)
        cache.set("short_lived", "value", ttl=0.1)
        cache.set("long_lived", "value", ttl=5.0)
        time.sleep(0.2)
        assert cache.get("short_lived") is None
        assert cache.get("long_lived") == "value"

    def test_max_items_lru_eviction(self):
        cache = InMemoryCache(max_items=3, default_ttl=60.0)
        cache.set("k1", "v1")
        cache.set("k2", "v2")
        cache.set("k3", "v3")

        # Access k1 to make it recently used
        assert cache.get("k1") == "v1"

        # Adding k4 should evict k2 (least recently used)
        cache.set("k4", "v4")
        assert cache.get("k4") == "v4"
        assert cache.get("k1") == "v1"
        assert cache.get("k3") == "v3"
        assert cache.get("k2") is None

    def test_delete_and_clear(self):
        cache = InMemoryCache(max_items=10, default_ttl=60.0)
        cache.set("a", 1)
        cache.set("b", 2)
        assert cache.delete("a") is True
        assert cache.get("a") is None
        assert cache.get("b") == 2

        cache.clear()
        assert cache.get("b") is None

    def test_invalidate_prefix(self):
        cache = InMemoryCache(max_items=20, default_ttl=60.0)
        cache.set("project:1:overview", {"data": 1})
        cache.set("project:1:results", {"data": 2})
        cache.set("project:2:overview", {"data": 3})
        cache.set("global:models", ["model1", "model2"])

        removed = cache.invalidate_prefix("project:1:")
        assert removed == 2
        assert cache.get("project:1:overview") is None
        assert cache.get("project:1:results") is None
        assert cache.get("project:2:overview") == {"data": 3}
        assert cache.get("global:models") == ["model1", "model2"]

    def test_thread_safety_under_concurrent_writes(self):
        cache = InMemoryCache(max_items=100, default_ttl=60.0)

        def worker(worker_id):
            for i in range(50):
                cache.set(f"thread_{worker_id}_{i}", i)
                val = cache.get(f"thread_{worker_id}_{i}")
                assert val == i

        with ThreadPoolExecutor(max_workers=8) as executor:
            futures = [executor.submit(worker, w) for w in range(8)]
            for f in futures:
                f.result()

    def test_telemetry_stats_tracking(self):
        cache = InMemoryCache(max_items=10, default_ttl=60.0)
        cache.set("stat_key", "stat_val")
        # 2 hits
        cache.get("stat_key")
        cache.get("stat_key")
        # 1 miss
        cache.get("missing_key")

        stats = cache.get_stats()
        assert stats["backend"] == "memory"
        assert stats["hits"] >= 2
        assert stats["misses"] >= 1
        assert "size" in stats


class TestUpstashRedisFallback:
    """Ensures Redis errors gracefully degrade to in-memory cache without crashing."""

    def test_redis_connection_failure_falls_back_gracefully(self):
        # When Redis raises ConnectionError, UpstashRedisCache should safely fall back
        with patch("app.core.cache.redis.from_url") as mock_redis_factory:
            mock_client = MagicMock()
            mock_client.get.side_effect = Exception("Redis connection refused")
            mock_client.setex.side_effect = Exception("Redis connection refused")
            mock_redis_factory.return_value = mock_client

            cache = UpstashRedisCache(redis_url="rediss://default:fake@fake.upstash.io:6379")
            # Operation must not raise, instead fallback to internal memory cache
            cache.set("test_key", "test_val")
            val = cache.get("test_key")
            assert val == "test_val"
