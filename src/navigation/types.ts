/**
 * Navigation contract for all screens (spec §4) + File Explorer.
 *
 * Bottom bar shows 5 primary destinations; the rest are hidden tabs
 * reached from Dashboard shortcuts / header actions.
 */
export type RootTabParamList = {
  Dashboard: undefined;
  Ram: undefined;
  Battery: undefined;
  Storage: undefined;
  CpuThermal: undefined;
  AppInspector: undefined;
  FileExplorer: undefined;
  History: undefined;
  Settings: undefined;
};

export type TabRouteName = keyof RootTabParamList;
