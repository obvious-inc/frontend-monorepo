import { useStore } from "../store.js";
import {
  selectHasFetchedInitialData,
  selectHasFetchedMenuData,
} from "../reducers/ui.js";

export const useHasFetchedInitialData = () =>
  useStore((s) => selectHasFetchedInitialData(s));

export const useHasFetchedMenuData = () =>
  useStore((s) => selectHasFetchedMenuData(s));
