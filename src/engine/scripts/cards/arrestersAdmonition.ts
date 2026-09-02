// `Arrester's Admonition` — "Return target creature to its owner's hand.\n
// Addendum — If you cast this spell during your main phase, draw a card."
//
// ⚠️ ADDENDUM IS READ AT RESOLUTION, AND THAT IS EXACT. The stack object
// carries no memory of the phase it was cast in — but it needs none: a phase
// cannot end while the stack is non-empty (CR 500.2), so a spell resolves in
// the very phase and step it was cast in. "Cast during your main phase" is
// therefore identical to "resolving while you are the active player in a
// main phase", which the state says directly. No cast-time memory, no new
// seam, no half-execution (D90). D272.

import { ARRESTER_S_ADMONITION } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces[0]?.oracleText;
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const TEXT = printed(
  ARRESTER_S_ADMONITION,
  "Return target creature to its owner's hand.\nAddendum — If you cast this spell during your main phase, draw a card.",
);

export const ARRESTERS_ADMONITION_SCRIPT: CardScript = {
  oracleId: ARRESTER_S_ADMONITION.oracleId,
  name: ARRESTER_S_ADMONITION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'hand', player: card.owner },
            },
          ],
        },
      ];
      const turn = ctx.state.turn;
      const myMainPhase =
        turn.activePlayer === obj.controller &&
        (turn.phase === 'precombatMain' || turn.phase === 'postcombatMain');
      if (myMainPhase) events.push(...drawEvents(ctx.state, obj.controller, 1));
      return events;
    },
  },
};
