"""Test fixtures for health-agent tests."""
import os
import pytest

# Ensure a dummy secret is set so the app doesn't error on import
os.environ.setdefault("INTERNAL_API_SECRET", "test-secret")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
