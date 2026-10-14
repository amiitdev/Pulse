import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  Theme,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RootTabParamList } from './types';
import { useTheme } from '../theme/useTheme';
import { IconName, TabBarIcon } from '../components/TabBarIcon';

import { DashboardScreen } from '../screens/DashboardScreen';
import { RamScreen } from '../screens/RamScreen';
import { BatteryScreen } from '../screens/BatteryScreen';
import { StorageScreen } from '../screens/StorageScreen';
import { CpuThermalScreen } from '../screens/CpuThermalScreen';
import { AppInspectorScreen } from '../screens/AppInspectorScreen';
import { FileExplorerScreen } from '../screens/FileExplorerScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator<RootTabParamList>();

const ICONS: Record<keyof RootTabParamList, IconName> = {
  Dashboard: 'dashboard',
  Ram: 'memory',
  Battery: 'battery',
  Storage: 'storage',
  CpuThermal: 'cpu',
  AppInspector: 'apps',
  FileExplorer: 'storage',
  History: 'history',
  Settings: 'settings',
};

/**
 * Primary bottom-bar destinations. CpuThermal / AppInspector / Settings are
 * still registered screens (reachable from Dashboard shortcuts) but are not
 * rendered as tabs — 5 items keep proper spacing on narrow screens (spec §4).
 */
const VISIBLE_TABS: Array<keyof RootTabParamList> = [
  'Dashboard',
  'Ram',
  'Battery',
  'Storage',
  'History',
];

const LABELS: Record<keyof RootTabParamList, string> = {
  Dashboard: 'Home',
  Ram: 'RAM',
  Battery: 'Battery',
  Storage: 'Storage',
  CpuThermal: 'CPU·Thermal',
  AppInspector: 'Apps',
  FileExplorer: 'Files',
  History: 'History',
  Settings: 'Settings',
};

/**
 * Custom tab bar: explicit gap between items, equal-width targets with a
 * 52dp minimum height, active pill background, and labels that scale down
 * (never ellipsize) when the user runs a large system font scale.
 */
function PulseTabBar({ state, navigation }: BottomTabBarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const focusedKey = state.routes[state.index]?.key;

  const visibleRoutes = state.routes.filter(r =>
    VISIBLE_TABS.includes(r.name as keyof RootTabParamList),
  );

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.colors.tabBar,
          borderTopColor: theme.colors.border,
          paddingBottom: Math.max(insets.bottom, 10),
        },
      ]}>
      {visibleRoutes.map(route => {
        const name = route.name as keyof RootTabParamList;
        const isFocused = route.key === focusedKey;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(name);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={LABELS[name]}
            style={({ pressed }) => [
              styles.item,
              isFocused && {
                backgroundColor: theme.colors.accentSoft,
              },
              pressed && styles.itemPressed,
            ]}>
            <TabBarIcon
              name={ICONS[name]}
              color={isFocused ? theme.colors.accent : theme.colors.tabInactive}
              focused={isFocused}
            />
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={[
                styles.label,
                {
                  color: isFocused ? theme.colors.accent : theme.colors.tabInactive,
                },
              ]}>
              {LABELS[name]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RootNavigator() {
  const { theme } = useTheme();

  const navTheme: Theme = {
    ...DefaultTheme,
    dark: true,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.tabBar,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.accent,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={{ headerShown: false }}
        // Must wrap: RN calls `tabBar` as a plain function, so hooks are only
        // legal inside the element we return, not in the callback itself.
        // eslint-disable-next-line react/no-unstable-nested-components
        tabBar={props => <PulseTabBar {...props} />}>
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Ram" component={RamScreen} />
        <Tab.Screen name="Battery" component={BatteryScreen} />
        <Tab.Screen name="Storage" component={StorageScreen} />
        <Tab.Screen name="CpuThermal" component={CpuThermalScreen} />
        <Tab.Screen name="AppInspector" component={AppInspectorScreen} />
        <Tab.Screen name="FileExplorer" component={FileExplorerScreen} />
        <Tab.Screen name="History" component={HistoryScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

/** Shared hairline top border helper for cards/sheets. */
export function Divider() {
  const { theme } = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 14,
  },
  itemPressed: {
    opacity: 0.75,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
