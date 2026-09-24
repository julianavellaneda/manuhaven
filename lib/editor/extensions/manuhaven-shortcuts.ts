/**
 * ManuHavenShortcuts — Tiptap extension registering editor-wide
 * keyboard shortcuts that delegate to callbacks supplied by the
 * host component. Kept inside a PM extension (not a DOM listener)
 * so bindings only fire when focus is in the editor.
 */

import { Extension } from "@tiptap/core";

export interface ManuHavenShortcutCallbacks {
  onToggleFind?: () => void;
  onToggleReplace?: () => void;
  onForceSave?: () => void;
  onToggleDistractionFree?: () => void;
  onOpenLink?: () => void;
  onSplitChapter?: () => void;
}

export const ManuHavenShortcuts = Extension.create<ManuHavenShortcutCallbacks>({
  name: "manuhavenShortcuts",

  addOptions() {
    return {};
  },

  addKeyboardShortcuts() {
    return {
      "Mod-f": () => {
        this.options.onToggleFind?.();
        return true;
      },
      "Mod-Shift-f": () => {
        this.options.onToggleReplace?.();
        return true;
      },
      "Mod-s": () => {
        this.options.onForceSave?.();
        return true;
      },
      "Mod-Shift-d": () => {
        this.options.onToggleDistractionFree?.();
        return true;
      },
      "Mod-k": () => {
        this.options.onOpenLink?.();
        return true;
      },
      "Mod-Enter": () => {
        this.options.onSplitChapter?.();
        return true;
      },
    };
  },
});
