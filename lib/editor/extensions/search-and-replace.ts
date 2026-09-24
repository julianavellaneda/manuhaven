/**
 * Tiptap SearchAndReplace — a minimal ProseMirror-decoration-based
 * find/replace extension. Custom because published packages either
 * target Tiptap v2 or are paid.
 *
 * Commands:
 *   - setSearchTerm(term)
 *   - setReplaceTerm(term)
 *   - setCaseSensitive(boolean)
 *   - gotoNext() / gotoPrevious()
 *   - replace()            // replace current match
 *   - replaceAll()
 *   - clearSearch()
 *
 * Storage: { searchTerm, replaceTerm, caseSensitive, results, activeIndex }
 */

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import type { Node as PMNode } from "@tiptap/pm/model";

type Range = { from: number; to: number };

interface SearchStorage {
  searchTerm: string;
  replaceTerm: string;
  caseSensitive: boolean;
  results: Range[];
  activeIndex: number;
}

const searchKey = new PluginKey<DecorationSet>("manuhaven-search");

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  doc: PMNode,
  term: string,
  caseSensitive: boolean
): Range[] {
  if (!term) return [];
  const flags = caseSensitive ? "g" : "gi";
  const regex = new RegExp(escapeRegExp(term), flags);
  const results: Range[] = [];
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex += 1;
        continue;
      }
      results.push({
        from: pos + m.index,
        to: pos + m.index + m[0].length,
      });
    }
  });
  return results;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    manuhavenSearch: {
      setSearchTerm: (term: string) => ReturnType;
      setReplaceTerm: (term: string) => ReturnType;
      setCaseSensitive: (value: boolean) => ReturnType;
      gotoNext: () => ReturnType;
      gotoPrevious: () => ReturnType;
      replace: () => ReturnType;
      replaceAll: () => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchAndReplace = Extension.create<
  Record<string, never>,
  SearchStorage
>({
  name: "manuhavenSearch",

  addStorage() {
    return {
      searchTerm: "",
      replaceTerm: "",
      caseSensitive: false,
      results: [],
      activeIndex: 0,
    };
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ tr, state, dispatch }) => {
          const storage = this.storage;
          storage.searchTerm = term;
          storage.results = findMatches(
            state.doc,
            term,
            storage.caseSensitive
          );
          storage.activeIndex = 0;
          if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
          return true;
        },

      setReplaceTerm:
        (term: string) =>
        () => {
          this.storage.replaceTerm = term;
          return true;
        },

      setCaseSensitive:
        (value: boolean) =>
        ({ tr, state, dispatch }) => {
          this.storage.caseSensitive = value;
          this.storage.results = findMatches(
            state.doc,
            this.storage.searchTerm,
            value
          );
          this.storage.activeIndex = 0;
          if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
          return true;
        },

      gotoNext:
        () =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          if (s.results.length === 0) return false;
          s.activeIndex = (s.activeIndex + 1) % s.results.length;
          if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
          return true;
        },

      gotoPrevious:
        () =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          if (s.results.length === 0) return false;
          s.activeIndex =
            (s.activeIndex - 1 + s.results.length) % s.results.length;
          if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
          return true;
        },

      replace:
        () =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          const match = s.results[s.activeIndex];
          if (!match) return false;
          const replace = s.replaceTerm;
          tr.insertText(replace, match.from, match.to);
          if (dispatch) dispatch(tr);
          return true;
        },

      replaceAll:
        () =>
        ({ tr, state, dispatch }) => {
          const s = this.storage;
          if (s.results.length === 0 || !s.searchTerm) return false;
          const replace = s.replaceTerm;
          // Walk matches in reverse so earlier offsets stay valid.
          const results = findMatches(
            state.doc,
            s.searchTerm,
            s.caseSensitive
          );
          for (let i = results.length - 1; i >= 0; i--) {
            const r = results[i];
            tr.insertText(replace, r.from, r.to);
          }
          if (dispatch) dispatch(tr);
          s.results = [];
          s.activeIndex = 0;
          return true;
        },

      clearSearch:
        () =>
        ({ tr, dispatch }) => {
          const s = this.storage;
          s.searchTerm = "";
          s.results = [];
          s.activeIndex = 0;
          if (dispatch) dispatch(tr.setMeta(searchKey, { refresh: true }));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: (): DecorationSet => DecorationSet.empty,
          apply(
            tr: Transaction,
            _old: DecorationSet,
            _oldState: EditorState,
            newState: EditorState
          ): DecorationSet {
            const shouldRecompute =
              tr.getMeta(searchKey) || (tr.docChanged && storage.searchTerm);
            if (shouldRecompute && storage.searchTerm) {
              storage.results = findMatches(
                newState.doc,
                storage.searchTerm,
                storage.caseSensitive
              );
              if (storage.activeIndex >= storage.results.length) {
                storage.activeIndex = Math.max(0, storage.results.length - 1);
              }
            }
            if (storage.results.length === 0) return DecorationSet.empty;
            const decos: Decoration[] = storage.results.map((range, i) =>
              Decoration.inline(range.from, range.to, {
                class:
                  i === storage.activeIndex
                    ? "manuhaven-search-active"
                    : "manuhaven-search-match",
              })
            );
            return DecorationSet.create(newState.doc, decos);
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

// Re-export type for consumers.
export type { SearchStorage };
