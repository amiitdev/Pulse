import { useEffect, useState } from 'react';
import { DeviceMonitor } from '../native/DeviceMonitor';

interface Result<T> {
  data: T | null;
  loading: boolean;
}

interface Options {
  deps?: ReadonlyArray<unknown>;
  /** Auto-refresh interval in ms. Omit for a single one-shot read. */
  refreshMs?: number;
}

/**
 * Runs a native getter (optionally on an interval) and tracks loading.
 * Resolves to `null` when the module is not linked or the device does not
 * expose the property — screens render unavailable states.
 */
export function useNativeReading<T>(
  getter: () => Promise<T | null>,
  options: Options = {},
): Result<T> {
  const { deps = [], refreshMs } = options;
  const [state, setState] = useState<Result<T>>({ data: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = () => {
      getter().then(value => {
        if (!cancelled) {
          setState({ data: value, loading: false });
        }
      });
    };

    load();
    if (refreshMs != null && refreshMs > 0) {
      timer = setInterval(load, refreshMs);
    }

    return () => {
      cancelled = true;
      if (timer != null) {
        clearInterval(timer);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}

/** True when the Kotlin side is linked. */
export function isNativeAvailable(): boolean {
  return DeviceMonitor.isNativeAvailable();
}
