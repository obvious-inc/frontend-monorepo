import { useStore } from "../store.js";
import {
  selectHasFetchedUserChannels,
  selectHasFetchedMenuData,
} from "../reducers/ui.js";

export const useHasFetchedUserChannels = () =>
  useStore((s) => selectHasFetchedUserChannels(s));

export const useHasFetchedMenuData = () =>
  useStore((s) => selectHasFetchedMenuData(s));
