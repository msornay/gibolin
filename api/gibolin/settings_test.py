from .settings import *

# Use the same PostgreSQL database but allow Django to create test database
DATABASES = {
    'default': {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("POSTGRES_DB", default="gibolin"),
        "USER": "postgres",  # Use superuser for tests
        "PASSWORD": "postgres",
        "HOST": os.getenv("POSTGRES_HOST", default="postgres"),
        "PORT": os.getenv("POSTGRES_PORT", default="5432"),
        "TEST": {
            "NAME": "test_gibolin",  # Explicit test database name
        }
    }
}

# Disable migrations for faster testing
class DisableMigrations:
    def __contains__(self, item):
        return True

    def __getitem__(self, item):
        return None

MIGRATION_MODULES = DisableMigrations()

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# Disable logging during tests
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'ERROR',
        },
    },
}