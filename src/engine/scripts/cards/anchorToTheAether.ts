// `Anchor to the Aether` — "Put target creature on top of its owner's
// library. Scry 1." The first SPELL composing a move with the D195 ask —
// and the reveal is computed against a SCRATCH state (the move folded
// through the pure reducer first), because the revealed top card may BE the
// creature just put there: that is the printed rule, not an edge case. D197.

import { ANCHOR_TO_THE_AETHER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { apply } from '../../reducer';

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
  ANCHOR_TO_THE_AETHER,
  "Put target creature on top of its owner's library. Scry 1. (Look at the top card of your library. You may put that card on the bottom.)",
);

export const ANCHOR_TO_THE_AETHER_SCRIPT: CardScript = {
  oracleId: ANCHOR_TO_THE_AETHER.oracleId,
  name: ANCHOR_TO_THE_AETHER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (card?.zone.kind !== 'battlefield') return [];
      const move: EventBody = {
        t: 'CardsMoved',
        moves: [
          {
            card: target.id,
            from: { kind: 'battlefield', player: card.controller },
            to: { kind: 'library', player: card.owner },
            placement: 'top',
          },
        ],
      };
      // The scry reads MY library as it stands AFTER the move.
      const scratch = apply(ctx.state, { seq: ctx.state.eventCount, body: move, cause: { kind: 'system' } } as never);
      const library = scratch.zones.library[obj.controller] ?? [];
      const n = Math.min(1, library.length);
      if (n === 0) return [move];
      const top = library.slice(library.length - n);
      return [
        move,
        { t: 'CardsRevealed', cards: top, to: [obj.controller] },
        {
          t: 'AwaitingSet',
          awaiting: {
            kind: 'scryChoice',
            player: obj.controller,
            count: n,
            toGraveyard: false,
            thenDraw: 0,
            label: obj.label,
          },
        },
      ];
    },
  },
};
