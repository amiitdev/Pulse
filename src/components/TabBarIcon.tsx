import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'dashboard'
  | 'memory'
  | 'battery'
  | 'storage'
  | 'history'
  | 'cpu'
  | 'apps'
  | 'settings';

interface Props {
  name: IconName;
  color: string;
  size?: number;
  focused?: boolean;
}

/**
 * Hand-drawn 24x24 stroke icon set (no extra font dependency).
 * Focused state adds a subtle filled backdrop handled by the tab bar;
 * here focused just thickens the stroke.
 */
export function TabBarIcon({ name, color, size = 24, focused = false }: Props) {
  const sw = focused ? 2.2 : 1.8;
  const common = {
    stroke: color,
    strokeWidth: sw,
    fill: 'none' as const,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {name === 'dashboard' && (
        <>
          <Rect x={3} y={3} width={8} height={8} rx={2} {...common} />
          <Rect x={13} y={3} width={8} height={5} rx={2} {...common} />
          <Rect x={3} y={13} width={8} height={8} rx={2} {...common} />
          <Rect x={13} y={10} width={8} height={11} rx={2} {...common} />
        </>
      )}

      {name === 'memory' && (
        <>
          <Rect x={3} y={7} width={18} height={10} rx={2} {...common} />
          <Line x1={7} y1={10} x2={7} y2={14} {...common} />
          <Line x1={11} y1={10} x2={11} y2={14} {...common} />
          <Line x1={15} y1={10} x2={15} y2={14} {...common} />
          <Line x1={7} y1={17} x2={7} y2={20} {...common} />
          <Line x1={12} y1={17} x2={12} y2={20} {...common} />
          <Line x1={17} y1={17} x2={17} y2={20} {...common} />
        </>
      )}

      {name === 'battery' && (
        <>
          <Rect x={2} y={7} width={17} height={10} rx={2.5} {...common} />
          <Line x1={21} y1={10} x2={21} y2={14} {...common} />
          <Line x1={5} y1={12} x2={11} y2={12} {...common} />
          <Path d="M12 9.5 9.5 12.8h2.2L10.8 15.5 13.6 12h-2.2z" {...common} />
        </>
      )}

      {name === 'storage' && (
        <>
          <Path
            d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3z"
            {...common}
          />
          <Path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" {...common} />
          <Path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" {...common} />
        </>
      )}

      {name === 'history' && (
        <>
          <Path d="M3 17l4.5-4.5 3 3L15 9l3 3 3-3.5" {...common} />
          <Line x1={3} y1={21} x2={21} y2={21} {...common} />
        </>
      )}

      {name === 'cpu' && (
        <>
          <Rect x={7} y={7} width={10} height={10} rx={2} {...common} />
          <Rect x={4} y={4} width={16} height={16} rx={3.5} {...common} />
          <Line x1={9} y1={1.5} x2={9} y2={4} {...common} />
          <Line x1={15} y1={1.5} x2={15} y2={4} {...common} />
          <Line x1={9} y1={20} x2={9} y2={22.5} {...common} />
          <Line x1={15} y1={20} x2={15} y2={22.5} {...common} />
          <Line x1={1.5} y1={9} x2={4} y2={9} {...common} />
          <Line x1={1.5} y1={15} x2={4} y2={15} {...common} />
          <Line x1={20} y1={9} x2={22.5} y2={9} {...common} />
          <Line x1={20} y1={15} x2={22.5} y2={15} {...common} />
        </>
      )}

      {name === 'apps' && (
        <>
          <Rect x={3} y={3} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={13.5} y={3} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={3} y={13.5} width={7.5} height={7.5} rx={2} {...common} />
          <Rect x={13.5} y={13.5} width={7.5} height={7.5} rx={2} {...common} />
        </>
      )}

      {name === 'settings' && (
        <>
          <Line x1={3} y1={7} x2={21} y2={7} {...common} />
          <Line x1={3} y1={12} x2={21} y2={12} {...common} />
          <Line x1={3} y1={17} x2={21} y2={17} {...common} />
          <Circle cx={9} cy={7} r={2.4} fill={color} stroke={color} strokeWidth={sw} />
          <Circle cx={16} cy={12} r={2.4} fill={color} stroke={color} strokeWidth={sw} />
          <Circle cx={8} cy={17} r={2.4} fill={color} stroke={color} strokeWidth={sw} />
        </>
      )}
    </Svg>
  );
}
