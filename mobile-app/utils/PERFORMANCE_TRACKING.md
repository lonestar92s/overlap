# Performance Tracking Guide

This utility tracks search performance metrics to measure and compare performance changes over time.

## Quick Start

Performance tracking is automatically enabled for:
- **Initial searches** (from LocationSearchModal) - Measures from button press until matches are rendered on map/list
- **"Search this area"** searches (from MapResultsScreen) - Measures from button press until matches are rendered on map/list
- **Filter computations** (when processing match data) - Measures filter data processing time

## What Gets Measured

### End-to-End Search Time
For both initial searches and "Search this area", the timer measures:
1. **Start**: When the user presses the search button
2. **End**: When matches are fully rendered on both the map and in the match list

This includes:
- API call time
- Data processing
- State updates
- Filter computation
- Map marker rendering
- List rendering

This gives you the **user-perceived performance** - how long the user waits from clicking search until they see results.

## Viewing Metrics

### In Development Console

Metrics are automatically logged to the console in development mode:
```
⏱️ [PERF] ✅ search_initial: 1234.56ms { location: {...}, dateRange: {...} }
⏱️ [PERF] ✅ search_this_area: 987.65ms { bounds: {...}, requestId: 123 }
⏱️ [PERF] filter_computation: 12.34ms { matchCount: 150 }
```

### Programmatically

```javascript
import * as performanceTracker from '../utils/performanceTracker';
import * as performanceViewer from '../utils/performanceViewer';

// Get summary of all metrics
const summary = await performanceTracker.getSummary();
console.log(summary);

// Get stats for a specific metric type
const stats = await performanceTracker.getStats('search_initial');
console.log(stats);

// Get formatted summary (for display)
const formatted = await performanceViewer.getFormattedSummary();
console.log(formatted);

// Compare two metric types
const comparison = await performanceViewer.compareMetrics(
  'search_initial',
  'search_this_area'
);
console.log(comparison);
```

## Metric Types

- `search_initial` - Initial search from LocationSearchModal
- `search_this_area` - "Search this area" from MapResultsScreen
- `search_unified` - Unified search (leagues, teams, venues)
- `search_flights` - Flight search
- `filter_computation` - Filter data processing
- `map_render` - Map rendering
- `component_render` - Component rendering

## Manual Tracking

### Track Async Operations

```javascript
import { trackPerformance, MetricType } from '../utils/performanceTracker';

const result = await trackPerformance(
  MetricType.SEARCH_UNIFIED,
  async () => {
    return await ApiService.searchUnified(query);
  },
  { query, userId: user.id }
);
```

### Track Sync Operations

```javascript
import { trackSyncPerformance, MetricType } from '../utils/performanceTracker';

const result = trackSyncPerformance(
  MetricType.FILTER_COMPUTATION,
  () => {
    return processMatchesForFilterData(matches);
  },
  { matchCount: matches.length }
);
```

### Manual Timer

```javascript
import { startTimer, MetricType } from '../utils/performanceTracker';

const stopTimer = startTimer(MetricType.SEARCH_FLIGHTS, {
  origin: 'JFK',
  destination: 'LAX'
});

// ... do work ...

const duration = stopTimer(true); // true = success
// or
const duration = stopTimer(false, error); // false = failure
```

## Viewing Metrics in AccountScreen (Example)

Add this to AccountScreen for easy access:

```javascript
import * as performanceViewer from '../utils/performanceViewer';
import * as performanceTracker from '../utils/performanceTracker';

// In AccountScreen component:
const [perfSummary, setPerfSummary] = useState('');

useEffect(() => {
  const loadPerfSummary = async () => {
    const summary = await performanceViewer.getFormattedSummary();
    setPerfSummary(summary);
  };
  loadPerfSummary();
}, []);

// In render:
<ScrollView>
  <Text style={styles.sectionTitle}>Performance Metrics</Text>
  <Text style={styles.monoText}>{perfSummary}</Text>
  <Button
    title="Clear Metrics"
    onPress={async () => {
      await performanceTracker.clearMetrics();
      const summary = await performanceViewer.getFormattedSummary();
      setPerfSummary(summary);
    }}
  />
</ScrollView>
```

## Comparing Performance Changes

To compare performance before and after changes:

1. **Before changes**: Clear metrics and run some searches
   ```javascript
   await performanceTracker.clearMetrics();
   // Run searches...
   const beforeStats = await performanceTracker.getStats('search_initial');
   ```

2. **After changes**: Run the same searches
   ```javascript
   // Run same searches...
   const afterStats = await performanceTracker.getStats('search_initial');
   ```

3. **Compare**:
   ```javascript
   const improvement = beforeStats.avgDuration - afterStats.avgDuration;
   const percentImprovement = (improvement / beforeStats.avgDuration) * 100;
   console.log(`Improvement: ${improvement.toFixed(2)}ms (${percentImprovement.toFixed(1)}%)`);
   ```

## Storage

- Metrics are stored in AsyncStorage under `@performance_metrics`
- Maximum of 100 metrics are kept (oldest are removed)
- Metrics persist across app restarts
- Use `clearMetrics()` to reset

## Production

- In production builds, metrics are still tracked but not logged to console
- Consider adding a remote analytics service to track metrics in production
- Metrics can be exported and sent to your analytics backend

