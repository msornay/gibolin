import importlib
from unittest.mock import patch

from django.test import TestCase


class SessionCookieSecureSettingTest(TestCase):
    """SESSION_COOKIE_SECURE must be configurable via env var."""

    def _reload_settings(self, env_overrides):
        import gibolin.settings as settings_module
        with patch.dict("os.environ", env_overrides, clear=False):
            importlib.reload(settings_module)
            return settings_module

    def test_defaults_false_when_debug(self):
        s = self._reload_settings({"DEBUG": "true"})
        self.assertFalse(s.SESSION_COOKIE_SECURE)

    def test_defaults_true_when_not_debug(self):
        s = self._reload_settings({"DEBUG": "false"})
        self.assertTrue(s.SESSION_COOKIE_SECURE)

    def test_env_override_false_in_prod(self):
        s = self._reload_settings({
            "DEBUG": "false",
            "SESSION_COOKIE_SECURE": "false",
        })
        self.assertFalse(s.SESSION_COOKIE_SECURE)

    def test_env_override_true_in_debug(self):
        s = self._reload_settings({
            "DEBUG": "true",
            "SESSION_COOKIE_SECURE": "true",
        })
        self.assertTrue(s.SESSION_COOKIE_SECURE)
