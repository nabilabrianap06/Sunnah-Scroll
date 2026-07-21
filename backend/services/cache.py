"""TTLCache in-memory sederhana & thread-safe (tanpa Redis)."""
import threading
import time


class TTLCache:
    def __init__(self, ttl: int):
        self.ttl = ttl
        self._store = {}
        self._lock = threading.Lock()

    def get(self, key):
        with self._lock:
            item = self._store.get(key)
            if item is None:
                return None
            value, expiry = item
            if time.time() > expiry:
                self._store.pop(key, None)
                return None
            return value

    def set(self, key, value, ttl: int | None = None):
        with self._lock:
            self._store[key] = (value, time.time() + (ttl if ttl is not None else self.ttl))

    def clear(self):
        with self._lock:
            self._store.clear()
