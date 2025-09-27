"""
Unit tests for the configuration module.

This module contains tests for configuration loading, environment variable
handling, and settings validation.
"""

import pytest
import tempfile
from pathlib import Path
from unittest.mock import patch

from src.config import Settings, DevelopmentSettings, StagingSettings, ProductionSettings, get_settings


class TestSettings:
    """Test cases for the base Settings class."""

    def test_default_settings(self):
        """Test default settings values."""
        settings = Settings()

        assert settings.app_name == "AI Video Editor"
        assert settings.version == "1.0.0"
        assert settings.debug is False
        assert settings.log_level == "INFO"
        assert settings.host == "0.0.0.0"
        assert settings.port == 8000
        assert settings.max_video_size_mb == 500

    def test_path_resolution(self):
        """Test that relative paths are resolved to absolute paths."""
        settings = Settings()

        assert settings.base_dir.is_absolute()
        assert settings.upload_dir.is_absolute()
        assert settings.temp_dir.is_absolute()
        assert settings.output_dir.is_absolute()

    def test_directory_creation(self):
        """Test that required directories are created."""
        settings = Settings()

        assert settings.upload_dir.exists()
        assert settings.temp_dir.exists()
        assert settings.output_dir.exists()

    def test_supported_formats(self):
        """Test supported video formats."""
        settings = Settings()

        expected_formats = [".mp4", ".mov", ".avi", ".mkv", ".webm"]
        assert settings.supported_formats == expected_formats

    @patch.dict('os.environ', {'APP_NAME': 'Test App', 'DEBUG': 'true'})
    def test_environment_override(self):
        """Test that environment variables override defaults."""
        settings = Settings()

        assert settings.app_name == "Test App"
        assert settings.debug is True

    @patch.dict('os.environ', {'MAX_VIDEO_SIZE_MB': '1000'})
    def test_integer_conversion(self):
        """Test that string environment variables are converted to appropriate types."""
        settings = Settings()

        assert settings.max_video_size_mb == 1000
        assert isinstance(settings.max_video_size_mb, int)


class TestEnvironmentSettings:
    """Test cases for environment-specific settings."""

    @patch.dict('os.environ', {'ENVIRONMENT': 'development'})
    def test_development_settings(self):
        """Test development environment settings."""
        settings = get_settings()

        assert isinstance(settings, DevelopmentSettings)
        assert settings.debug is True
        assert settings.log_level == "DEBUG"

    @patch.dict('os.environ', {'ENVIRONMENT': 'staging'})
    def test_staging_settings(self):
        """Test staging environment settings."""
        settings = get_settings()

        assert isinstance(settings, StagingSettings)
        assert settings.debug is False
        assert settings.log_level == "INFO"

    @patch.dict('os.environ', {'ENVIRONMENT': 'production'})
    def test_production_settings(self):
        """Test production environment settings."""
        settings = get_settings()

        assert isinstance(settings, ProductionSettings)
        assert settings.debug is False
        assert settings.log_level == "WARNING"

    def test_default_environment(self):
        """Test that development is the default environment."""
        # No ENVIRONMENT variable set
        settings = get_settings()

        assert isinstance(settings, DevelopmentSettings)
        assert settings.debug is True


class TestSettingsValidation:
    """Test cases for settings validation and error handling."""

    def test_invalid_log_level(self):
        """Test handling of invalid log level values."""
        with patch.dict('os.environ', {'LOG_LEVEL': 'INVALID'}):
            settings = Settings()

            # Pydantic accepts the value as-is (this is expected behavior)
            assert settings.log_level == "INVALID"

    def test_empty_string_handling(self):
        """Test handling of empty string environment variables."""
        with patch.dict('os.environ', {'APP_NAME': ''}):
            settings = Settings()

            # Pydantic accepts empty strings (this is expected behavior)
            assert settings.app_name == ""

    def test_whitespace_handling(self):
        """Test handling of whitespace in environment variables."""
        with patch.dict('os.environ', {'APP_NAME': '  Test App  '}):
            settings = Settings()

            # Should preserve whitespace
            assert settings.app_name == "  Test App  "


class TestPathConfiguration:
    """Test cases for path configuration and directory handling."""

    def test_custom_base_dir(self):
        """Test custom base directory configuration."""
        with patch.dict('os.environ', {'BASE_DIR': '/custom/path'}):
            with patch.object(Path, 'mkdir'):  # Mock directory creation
                settings = Settings()

                # Use platform-specific path separator
                expected_path = str(Path('/custom/path'))
                assert str(settings.base_dir) == expected_path

    def test_relative_path_resolution(self):
        """Test that relative paths are properly resolved."""
        settings = Settings()

        # All paths should be absolute
        assert settings.base_dir.is_absolute()
        assert settings.upload_dir.is_absolute()
        assert settings.temp_dir.is_absolute()
        assert settings.output_dir.is_absolute()

        # Upload dir should be inside base_dir
        assert settings.upload_dir.is_relative_to(settings.base_dir)

    def test_directory_permissions(self):
        """Test that directories have appropriate permissions."""
        settings = Settings()

        # Directories should exist and be writable
        assert settings.upload_dir.exists()
        assert settings.temp_dir.exists()
        assert settings.output_dir.exists()

        # Test that we can create files in these directories
        test_file = settings.temp_dir / "test.txt"
        test_file.write_text("test")
        assert test_file.exists()
        test_file.unlink()  # Clean up


class TestSecuritySettings:
    """Test cases for security-related settings."""

    def test_secret_key_default(self):
        """Test default secret key generation."""
        settings = Settings()

        # Should have a default value
        assert settings.secret_key is not None
        assert len(settings.secret_key) > 0

    @patch.dict('os.environ', {'SECRET_KEY': 'custom-secret-key'})
    def test_custom_secret_key(self):
        """Test custom secret key configuration."""
        settings = Settings()

        assert settings.secret_key == "custom-secret-key"

    def test_allowed_hosts_default(self):
        """Test default allowed hosts configuration."""
        settings = Settings()

        assert settings.allowed_hosts == ["*"]

    @patch.dict('os.environ', {'ALLOWED_HOSTS': 'localhost,127.0.0.1'})
    def test_custom_allowed_hosts(self):
        """Test custom allowed hosts configuration."""
        settings = Settings()

        assert settings.allowed_hosts == ["localhost", "127.0.0.1"]

    def test_cors_origins_default(self):
        """Test default CORS origins configuration."""
        settings = Settings()

        assert settings.cors_origins == ["*"]

    @patch.dict('os.environ', {'CORS_ORIGINS': 'http://localhost:3000,https://app.example.com'})
    def test_custom_cors_origins(self):
        """Test custom CORS origins configuration."""
        settings = Settings()

        assert settings.cors_origins == ["http://localhost:3000", "https://app.example.com"]


class TestRateLimiting:
    """Test cases for rate limiting configuration."""

    def test_default_rate_limit(self):
        """Test default rate limiting configuration."""
        settings = Settings()

        assert settings.rate_limit_per_minute == 60

    @patch.dict('os.environ', {'RATE_LIMIT_PER_MINUTE': '120'})
    def test_custom_rate_limit(self):
        """Test custom rate limiting configuration."""
        settings = Settings()

        assert settings.rate_limit_per_minute == 120

    def test_rate_limit_type(self):
        """Test that rate limit is an integer."""
        settings = Settings()

        assert isinstance(settings.rate_limit_per_minute, int)
        assert settings.rate_limit_per_minute > 0


class TestDatabaseConfiguration:
    """Test cases for database configuration."""

    def test_default_database_url(self):
        """Test default database URL."""
        settings = Settings()

        assert settings.database_url == "sqlite:///./video_editor.db"

    @patch.dict('os.environ', {'DATABASE_URL': 'postgresql://user:pass@localhost/db'})
    def test_custom_database_url(self):
        """Test custom database URL configuration."""
        settings = Settings()

        assert settings.database_url == "postgresql://user:pass@localhost/db"

    def test_redis_default_url(self):
        """Test default Redis URL."""
        settings = Settings()

        assert settings.redis_url == "redis://localhost:6379"

    @patch.dict('os.environ', {'REDIS_URL': 'redis://redis-server:6379'})
    def test_custom_redis_url(self):
        """Test custom Redis URL configuration."""
        settings = Settings()

        assert settings.redis_url == "redis://redis-server:6379"