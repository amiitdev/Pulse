/**
 * Pulse — premium Android device monitor.
 * App entry: animated splash → providers + navigation + historical sampler.
 * Logic lives in src/.
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashOverlay } from './src/components/SplashOverlay';
import { initDatabase } from './src/database/repository';
import { samplingService } from './src/services/samplingService';
import { loadSettings } from './src/services/settingsStore';

function App() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Kick off DB + settings in parallel with the splash animation.
    Promise.all([initDatabase(), loadSettings()]).then(([, settings]) => {
      if (cancelled) return;
      samplingService.start(settings.samplingIntervalMs);
      setReady(true);
    });
    return () => {
      cancelled = true;
      samplingService.stop();
    };
  }, []);

  // Block on the splash overlay until both the animation finished AND
  // the DB/settings are ready — never flash an empty navigator.
  if (!ready || !splashDone) {
    return (
      <>
        <StatusBar hidden />
        {!ready || !splashDone ? (
          <SplashOverlay onDone={() => setSplashDone(true)} />
        ) : null}
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}

export default App;
