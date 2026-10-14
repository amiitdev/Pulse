import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const AnimatedSvgPath = Animated.createAnimatedComponent(Path);

const CORAL = '#FF5C69';
const CORAL_DIM = 'rgba(255,92,105,0.45)';
const BG = '#000000';

/** ECG path in a 100x100 viewBox, centered. */
const ECG_D =
  'M10 50 L32 50 L40 50 L45 50 L49 34 L54 70 L59 30 L64 50 L80 50 L90 50';

/**
 * Animated Pulse splash overlay.
 * Pulsing coral heart-pulse glyph + radiating rings + "Pulse" wordmark,
 * then fades out. Pure RN Animated + react-native-svg (bare RN — no Expo).
 */
export function SplashOverlay({ onDone }: { onDone: () => void }) {
  const phase = useRef(new Animated.Value(0)).current;
  const rings = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const textY = useRef(new Animated.Value(24)).current;
  const textO = useRef(new Animated.Value(0)).current;
  const dash = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const beat = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

    const loops = Animated.parallel([
      ...rings.map((rv, i) => beat(rv, i * 220)),
      Animated.loop(
        Animated.sequence([
          Animated.timing(phase, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(phase, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ),
    ]);

    Animated.timing(dash, {
      toValue: 1,
      duration: 900,
      useNativeDriver: false, // SVG path prop
    }).start();

    Animated.parallel([
      Animated.timing(textY, {
        toValue: 0,
        duration: 650,
        useNativeDriver: true,
      }),
      Animated.timing(textO, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();

    loops.start();

    const t = setTimeout(() => {
      Animated.timing(fade, {
        toValue: 0,
        duration: 480,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          loops.stop();
          onDone();
        }
      });
    }, 2100);

    return () => {
      clearTimeout(t);
      loops.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = phase.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.07],
  });
  const strokeDashoffset = dash.interpolate({
    inputRange: [0, 1],
    outputRange: [220, 0],
  });

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}>
      <View style={styles.stage}>
        {/* Radiating pulse rings — animated via View scale/opacity (Hermes-safe) */}
        {rings.map((rv, i) => {
          const ringScale = rv.interpolate({
            inputRange: [0, 1],
            outputRange: [0.72, 1.5],
          });
          const ringOpacity = rv.interpolate({
            inputRange: [0, 0.15, 1],
            outputRange: [0.55, 0.28, 0],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.ring,
                {
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                },
              ]}
            />
          );
        })}

        {/* Heart-pulse glyph */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.glyphCenter,
            { transform: [{ scale }] },
          ]}>
          <Svg width={120} height={120} viewBox="0 0 100 100">
            <Path
              d="M50 82 C20 60 12 42 12 32 C12 20 22 12 32 12 C40 12 46 16 50 22 C54 16 60 12 68 12 C78 12 88 20 88 32 C88 42 80 60 50 82 Z"
              fill="none"
              stroke={CORAL}
              strokeWidth="5"
              strokeLinejoin="round"
            />
            <AnimatedSvgPath
              d={ECG_D}
              fill="none"
              stroke={CORAL}
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="220"
              strokeDashoffset={strokeDashoffset}
            />
          </Svg>
        </Animated.View>
      </View>

      {/* Wordmark */}
      <Animated.Text
        style={[
          styles.wordmark,
          { opacity: textO, transform: [{ translateY: textY }] },
        ]}>
        Pulse
      </Animated.Text>
      <Animated.Text
        style={[
          styles.tagline,
          { opacity: textO, transform: [{ translateY: textY }] },
        ]}>
        device monitor
      </Animated.Text>
    </Animated.View>
  );
}

const RING_SIZE = 200;

const styles = StyleSheet.create({
  root: {
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stage: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: CORAL_DIM,
  },
  glyphCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: 8,
    color: '#F4F4F7',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  tagline: {
    marginTop: 6,
    color: CORAL,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
