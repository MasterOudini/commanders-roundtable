import { create } from 'zustand';

// The hovered hand index, in a store rather than in component state.
//
// ⚠️ This is a VERIFIABILITY decision, and it is worth the extra file. The hand-fan
// geometry has to be asserted numerically — neighbours part by exactly
// 26·e^(−0.55·d) px — and the only way to drive a hover in this workspace is to
// inject it. Synthetic pointer events are unusable: if the real mouse happens to be
// over the Electron window, genuine and synthetic pointermoves interleave and
// corrupt the gesture, which has already cost debugging time here. A store write
// exercises exactly the same code path as a real pointerenter with none of that.
//
// It is also where a keyboard hand selection (1–9) and, later, the PromptBar's
// "choose a card in your hand" both need to write.

interface HandState {
  hovered: number | null;
  setHovered: (index: number | null) => void;
}

export const useHandHover = create<HandState>((set) => ({
  hovered: null,
  setHovered: (hovered) => set({ hovered }),
}));
