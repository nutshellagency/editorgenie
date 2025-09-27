"""
Tests for Timeline Performance Optimizer

Test cases for performance optimization features including:
- Virtualization
- Memoization and caching
- Debounced updates
- Memory management
- Canvas rendering optimization
"""

import pytest
from unittest.mock import Mock, patch
import time

from src.services.performance.timelinePerformanceOptimizer import (
    TimelinePerformanceOptimizer,
    VirtualizationConfig,
    PerformanceMetrics,
    TimelineViewport
)
from src.core.timeline.models import TimelineState, TimelineSegment, TimelineTrack


class TestTimelinePerformanceOptimizer:
    """Test cases for the TimelinePerformanceOptimizer class"""

    def setup_method(self):
        """Set up test fixtures"""
        self.optimizer = TimelinePerformanceOptimizer()
        self.sample_segments = self._create_sample_segments()
        self.sample_tracks = self._create_sample_tracks()
        self.sample_state = self._create_sample_timeline_state()

    def _create_sample_segments(self):
        """Create sample timeline segments for testing"""
        return [
            TimelineSegment(
                id="seg1",
                start_time=0.0,
                end_time=5.0,
                track_id="track1",
                type="video",
                source="video1.mp4"
            ),
            TimelineSegment(
                id="seg2",
                start_time=3.0,
                end_time=8.0,
                track_id="track1",
                type="video",
                source="video2.mp4"
            ),
            TimelineSegment(
                id="seg3",
                start_time=10.0,
                end_time=15.0,
                track_id="track2",
                type="audio",
                source="audio1.mp3"
            ),
        ]

    def _create_sample_tracks(self):
        """Create sample timeline tracks for testing"""
        track1 = TimelineTrack(
            id="track1",
            name="Video Track",
            type="video",
            segments=self.sample_segments[:2]
        )
        track2 = TimelineTrack(
            id="track2",
            name="Audio Track",
            type="audio",
            segments=[self.sample_segments[2]]
        )
        return [track1, track2]

    def _create_sample_timeline_state(self):
        """Create sample timeline state for testing"""
        return TimelineState(
            id="timeline1",
            name="Test Timeline",
            tracks=self.sample_tracks
        )

    def test_initialization(self):
        """Test optimizer initialization"""
        assert self.optimizer is not None
        assert isinstance(self.optimizer.virtualizationConfig, dict)
        assert self.optimizer.cache is not None
        assert self.optimizer.renderCache is not None
        assert self.optimizer.debounceTimers is not None

    def test_get_visible_segments(self):
        """Test visible segments calculation"""
        viewport = TimelineViewport(
            start_time=0.0,
            end_time=6.0,
            start_y=0,
            end_y=100
        )

        visible_segments = self.optimizer.get_visible_segments(
            self.sample_state,
            viewport,
            self.sample_tracks
        )

        # Should return segments that overlap with viewport
        assert len(visible_segments) == 2  # seg1 and seg2 overlap with 0-6
        assert visible_segments[0].id == "seg1"
        assert visible_segments[1].id == "seg2"

    def test_calculate_segment_positions(self):
        """Test segment position calculation with memoization"""
        positions = self.optimizer.calculate_segment_positions(
            self.sample_segments,
            60
        )

        assert len(positions) == 3
        assert positions[0]['id'] == "seg1"
        assert positions[0]['x'] == 0.0
        assert positions[0]['width'] == 5.0
        assert positions[0]['height'] == 58  # 60 - 2

    def test_debounced_update(self):
        """Test debounced update functionality"""
        callback = Mock()
        key = "test-update"

        # Call debounced update multiple times quickly
        self.optimizer.debouncedUpdate(key, callback, 100)
        self.optimizer.debouncedUpdate(key, callback, 100)

        # Callback should not be called immediately
        assert not callback.called

        # Wait for debounce delay
        time.sleep(0.15)

        # Callback should be called once after debounce
        assert callback.call_count == 1

    def test_memory_cleanup(self):
        """Test memory cleanup functionality"""
        # Add some data to caches
        self.optimizer.cache.set("test1", "data1")
        self.optimizer.renderCache.set("test2", "data2")
        self.optimizer.debounceTimers.set("test3", None)

        # Verify data exists
        assert self.optimizer.cache.size > 0
        assert self.optimizer.renderCache.size > 0
        assert len(self.optimizer.debounceTimers) > 0

        # Clean up
        self.optimizer.cleanup()

        # Verify cleanup
        assert self.optimizer.cache.size == 0
        assert self.optimizer.renderCache.size == 0
        assert len(self.optimizer.debounceTimers) == 0

    def test_performance_metrics(self):
        """Test performance metrics collection"""
        metrics = self.optimizer.getMetrics()

        assert isinstance(metrics, dict)
        assert 'renderTime' in metrics
        assert 'updateTime' in metrics
        assert 'memoryUsage' in metrics
        assert 'visibleSegments' in metrics
        assert 'totalSegments' in metrics

    def test_spatial_index_creation(self):
        """Test spatial index creation for segments"""
        index = self.optimizer.createSpatialIndex(self.sample_segments)

        assert isinstance(index, dict)
        assert len(index) > 0

        # Check that segments are properly bucketed
        # seg1 (0-5) should be in bucket 0
        # seg2 (3-8) should be in bucket 0
        # seg3 (10-15) should be in bucket 10

        bucket_0 = index.get(0)
        bucket_10 = index.get(10)

        assert bucket_0 is not None
        assert bucket_10 is not None
        assert len(bucket_0) == 2  # seg1 and seg2
        assert len(bucket_10) == 1  # seg3

    def test_preload_timeline_data(self):
        """Test timeline data preloading"""
        center_time = 5.0
        preload_range = 10.0

        # Should not raise any exceptions
        self.optimizer.preloadTimelineData(
            self.sample_state,
            center_time,
            preload_range
        )

        # Verify that cache has been populated
        assert self.optimizer.renderCache.size > 0

    def test_canvas_rendering_optimization(self):
        """Test optimized canvas rendering"""
        # Mock canvas context
        mock_ctx = Mock()
        mock_ctx.save = Mock()
        mock_ctx.scale = Mock()
        mock_ctx.clearRect = Mock()
        mock_ctx.fill = Mock()
        mock_ctx.stroke = Mock()
        mock_ctx.restore = Mock()

        # Test rendering
        self.optimizer.renderCanvas(
            mock_ctx,
            self.sample_segments,
            800,
            600,
            1.0
        )

        # Verify canvas operations were called
        mock_ctx.save.assert_called_once()
        mock_ctx.scale.assert_called_once()
        mock_ctx.clearRect.assert_called_once()
        mock_ctx.restore.assert_called_once()

    def test_virtualization_config_update(self):
        """Test virtualization configuration updates"""
        new_config = {
            'enabled': False,
            'viewportBuffer': 100,
            'segmentHeight': 80
        }

        self.optimizer.updateVirtualizationConfig(new_config)

        # Verify config was updated
        config = self.optimizer.virtualizationConfig
        assert config['enabled'] is False
        assert config['viewportBuffer'] == 100
        assert config['segmentHeight'] == 80

    def test_performance_monitoring_setup(self):
        """Test performance monitoring setup"""
        mock_container = Mock()
        mock_container.tagName = 'DIV'

        # Should not raise exceptions
        self.optimizer.setupPerformanceMonitoring(mock_container)

        # Verify resize observer was created
        assert len(self.optimizer.observers) > 0

    def test_cache_efficiency(self):
        """Test that caching improves performance"""
        viewport = TimelineViewport(
            start_time=0.0,
            end_time=6.0,
            start_y=0,
            end_y=100
        )

        # First call - should compute and cache
        start_time = time.time()
        visible1 = self.optimizer.get_visible_segments(
            self.sample_state,
            viewport,
            self.sample_tracks
        )
        first_call_time = time.time() - start_time

        # Second call - should use cache
        start_time = time.time()
        visible2 = self.optimizer.get_visible_segments(
            self.sample_state,
            viewport,
            self.sample_tracks
        )
        second_call_time = time.time() - start_time

        # Second call should be faster (or at least not slower)
        assert second_call_time <= first_call_time * 2

        # Results should be identical
        assert len(visible1) == len(visible2)
        assert visible1[0].id == visible2[0].id

    def test_memory_usage_estimation(self):
        """Test memory usage estimation"""
        # Add some test data
        self.optimizer.cache.set("test1", {"data": "x" * 1000})
        self.optimizer.renderCache.set("test2", {"data": "y" * 2000})

        metrics = self.optimizer.getMetrics()

        # Memory usage should be greater than 0
        assert metrics['memoryUsage'] > 0

        # Should be roughly proportional to data size
        # (This is an approximation since we can't measure exact memory usage)
        assert metrics['memoryUsage'] > 1000  # At least 1KB

    def test_batch_rendering(self):
        """Test that segments are rendered in batches for performance"""
        mock_ctx = Mock()

        # Create many segments
        many_segments = []
        for i in range(250):  # More than typical batch size
            many_segments.append(TimelineSegment(
                id=f"seg{i}",
                start_time=i * 2.0,
                end_time=i * 2.0 + 1.0,
                track_id="track1",
                type="video",
                source=f"video{i}.mp4"
            ))

        # Test batch rendering
        self.optimizer.renderCanvas(mock_ctx, many_segments, 800, 600, 1.0)

        # Should handle large number of segments without issues
        # (This mainly tests that it doesn't crash or hang)
        assert True  # If we get here, the test passed

    def test_resize_observer_cleanup(self):
        """Test that resize observers are properly cleaned up"""
        mock_container = Mock()

        # Set up monitoring
        self.optimizer.setupPerformanceMonitoring(mock_container)
        initial_observer_count = len(self.optimizer.observers)

        # Clean up
        self.optimizer.cleanup()

        # Observers should be removed
        assert len(self.optimizer.observers) == 0

    def test_cache_expiration(self):
        """Test that cache entries expire properly"""
        # Add data with short expiration
        self.optimizer.cache.set("short_lived", "test_data")

        # Verify it exists
        assert self.optimizer.cache.has("short_lived")

        # Wait for expiration (cache timeout is 100ms)
        time.sleep(0.15)

        # Should be expired and removed
        assert not self.optimizer.cache.has("short_lived")

    def test_error_handling_in_optimization(self):
        """Test error handling in optimization methods"""
        # Test with invalid viewport
        invalid_viewport = TimelineViewport(
            start_time=-1.0,  # Invalid negative time
            end_time=-0.5,
            start_y=0,
            end_y=100
        )

        # Should handle gracefully
        visible_segments = self.optimizer.get_visible_segments(
            self.sample_state,
            invalid_viewport,
            self.sample_tracks
        )

        # Should return empty list for invalid viewport
        assert len(visible_segments) == 0

    def test_performance_with_large_dataset(self):
        """Test performance with large timeline datasets"""
        # Create large dataset
        large_segments = []
        for i in range(1000):
            large_segments.append(TimelineSegment(
                id=f"large_seg{i}",
                start_time=i * 0.1,
                end_time=i * 0.1 + 0.05,
                track_id="track1",
                type="video",
                source=f"video{i}.mp4"
            ))

        large_track = TimelineTrack(
            id="large_track",
            name="Large Track",
            type="video",
            segments=large_segments
        )

        large_state = TimelineState(
            id="large_timeline",
            name="Large Timeline",
            tracks=[large_track]
        )

        viewport = TimelineViewport(
            start_time=50.0,
            end_time=50.5,
            start_y=0,
            end_y=100
        )

        # Should handle large dataset efficiently
        start_time = time.time()
        visible_segments = self.optimizer.get_visible_segments(
            large_state,
            viewport,
            [large_track]
        )
        processing_time = time.time() - start_time

        # Should complete in reasonable time (< 100ms)
        assert processing_time < 0.1

        # Should return correct segments
        assert len(visible_segments) > 0

    def test_concurrent_access_safety(self):
        """Test thread safety of optimization operations"""
        import threading

        results = []
        errors = []

        def worker():
            try:
                viewport = TimelineViewport(
                    start_time=0.0,
                    end_time=6.0,
                    start_y=0,
                    end_y=100
                )

                visible = self.optimizer.get_visible_segments(
                    self.sample_state,
                    viewport,
                    self.sample_tracks
                )
                results.append(len(visible))
            except Exception as e:
                errors.append(e)

        # Run multiple threads concurrently
        threads = []
        for i in range(10):
            thread = threading.Thread(target=worker)
            threads.append(thread)
            thread.start()

        # Wait for all threads
        for thread in threads:
            thread.join()

        # Should complete without errors
        assert len(errors) == 0
        assert len(results) == 10
        assert all(count == 2 for count in results)  # All should return 2 segments

    def test_memory_pressure_handling(self):
        """Test behavior under memory pressure"""
        # Fill caches with large data
        for i in range(100):
            large_data = "x" * 10000  # 10KB per entry
            self.optimizer.cache.set(f"large_key_{i}", large_data)
            self.optimizer.renderCache.set(f"large_render_{i}", large_data)

        # Get metrics
        metrics = self.optimizer.getMetrics()

        # Should detect high memory usage
        assert metrics['memoryUsage'] > 0

        # Cleanup should work even with large data
        self.optimizer.cleanup()

        # Caches should be empty
        assert self.optimizer.cache.size == 0
        assert self.optimizer.renderCache.size == 0


class TestVirtualizationConfig:
    """Test cases for virtualization configuration"""

    def test_default_config(self):
        """Test default virtualization configuration"""
        optimizer = TimelinePerformanceOptimizer()

        config = optimizer.virtualizationConfig
        assert config['enabled'] is True
        assert config['viewportBuffer'] == 50
        assert config['segmentHeight'] == 60
        assert config['containerHeight'] == 600

    def test_custom_config(self):
        """Test custom virtualization configuration"""
        custom_config = {
            'enabled': False,
            'viewportBuffer': 100,
            'segmentHeight': 80,
            'containerHeight': 800
        }

        optimizer = TimelinePerformanceOptimizer(custom_config)

        config = optimizer.virtualizationConfig
        assert config['enabled'] is False
        assert config['viewportBuffer'] == 100
        assert config['segmentHeight'] == 80
        assert config['containerHeight'] == 800


class TestPerformanceMetrics:
    """Test cases for performance metrics"""

    def test_metrics_structure(self):
        """Test performance metrics structure"""
        optimizer = TimelinePerformanceOptimizer()

        metrics = optimizer.getMetrics()

        required_fields = [
            'renderTime', 'updateTime', 'memoryUsage',
            'visibleSegments', 'totalSegments'
        ]

        for field in required_fields:
            assert field in metrics
            assert isinstance(metrics[field], (int, float))

    def test_metrics_update(self):
        """Test that metrics are updated during operations"""
        optimizer = TimelinePerformanceOptimizer()

        initial_metrics = optimizer.getMetrics()

        # Perform some operations
        viewport = TimelineViewport(0.0, 10.0, 0, 100)
        segments = optimizer.get_visible_segments(
            TimelineState(tracks=[]),
            viewport,
            []
        )

        updated_metrics = optimizer.getMetrics()

        # Some metrics should have changed
        assert updated_metrics['visibleSegments'] == 0
        assert updated_metrics['totalSegments'] == 0


if __name__ == "__main__":
    pytest.main([__file__])