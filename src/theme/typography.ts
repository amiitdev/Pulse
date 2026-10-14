import { TextStyle } from 'react-native';

/** Accessible type scale — nothing smaller than 12sp (spec §4). */

export const typography = {
  display: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: 0.2,
  } as TextStyle,
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
  } as TextStyle,
  heading: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
  } as TextStyle,
  body: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
  } as TextStyle,
  bodyBold: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  } as TextStyle,
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '400',
  } as TextStyle,
  micro: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  } as TextStyle,
} as const;
