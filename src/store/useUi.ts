/**
 * Discipline, the Build chain, the board/list mode — and the toast strip.
 *
 * The view is not here: the four views are the four routes and the only thing
 * in the URL (ADR-0008). Everything in this store is a *mode*, not a place.
 * The toasts are the exception in kind but not in layer: they are UI state,
 * they are transient, and `partialize` leaves them out of storage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Discipline, SkillId } from '../domain/types';

export type BoardMode = 'board' | 'list';

export type Toast = { id: string; message: string };

const TOAST_MS = 2600;

type UiState = {
  discipline: Discipline;
  boardMode: BoardMode;
  /**
   * Keyed by discipline, so switching discipline no longer throws the chain
   * away — the prototype's unconditional clear was a mis-tap that destroyed
   * unsaved work (ADR-0008).
   */
  chain: Record<Discipline, SkillId[]>;
  toasts: Toast[];

  setDiscipline: (discipline: Discipline) => void;
  setBoardMode: (mode: BoardMode) => void;

  appendToChain: (skillId: SkillId) => void;
  insertIntoChain: (skillId: SkillId, at: number) => void;
  removeFromChain: (at: number) => void;
  loadChain: (skillIds: SkillId[]) => void;
  clearChain: () => void;

  notify: (message: string) => void;
  dismissToast: (id: string) => void;
};

export const useUi = create<UiState>()(
  persist(
    (set, get) => ({
      discipline: 'juggling',
      boardMode: 'board',
      chain: { juggling: [], acro: [] },
      toasts: [],

      setDiscipline: (discipline) => set({ discipline }),
      setBoardMode: (boardMode) => set({ boardMode }),

      appendToChain: (skillId) =>
        set((state) => ({
          chain: {
            ...state.chain,
            [state.discipline]: [...state.chain[state.discipline], skillId],
          },
        })),

      insertIntoChain: (skillId, at) =>
        set((state) => {
          const next = [...state.chain[state.discipline]];
          next.splice(at, 0, skillId);
          return { chain: { ...state.chain, [state.discipline]: next } };
        }),

      removeFromChain: (at) =>
        set((state) => ({
          chain: {
            ...state.chain,
            [state.discipline]: state.chain[state.discipline].filter((_, i) => i !== at),
          },
        })),

      loadChain: (skillIds) =>
        set((state) => ({
          chain: { ...state.chain, [state.discipline]: [...skillIds] },
        })),

      clearChain: () =>
        set((state) => ({ chain: { ...state.chain, [state.discipline]: [] } })),

      notify: (message) => {
        const id = crypto.randomUUID();
        set((state) => ({ toasts: [...state.toasts, { id, message }] }));
        setTimeout(() => get().dismissToast(id), TOAST_MS);
      },

      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'trilha:ui',
      version: 1,
      partialize: ({ discipline, boardMode, chain }) => ({ discipline, boardMode, chain }),
    },
  ),
);

/** Callable from anywhere in the store layer, not only from a component. */
export const notify = (message: string): void => useUi.getState().notify(message);
