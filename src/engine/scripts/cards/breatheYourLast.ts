// `Breathe Your Last` — "Destroy target creature or planeswalker. You gain
// 1 life for each of its colors." The colors are read off the DERIVED
// target BEFORE the move; indestructible survives and pays nothing
// (destroyed-then-counted, one reading, both halves gated). D201.

import { BREATHE_YOUR_LAST } from '../../../data/fixtures/engineCards';
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
  BREATHE_YOUR_LAST,
  'Destroy target creature or planeswalker. You gain 1 life for each of its colors.',
);

export const BREATHE_YOUR_LAST_SCRIPT: CardScript = {
  oracleId: BREATHE_YOUR_LAST.oracleId,
  name: BREATHE_YOUR_LAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const d = ctx.derive(target.id);
      if (d.keywords.has('indestructible')) return [];
      const colors = d.colors.length;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        },
      ];
      if (colors > 0) {
        const life = ctx.state.players[obj.controller]?.life ?? 0;
        events.push({ t: 'LifeChanged', player: obj.controller, delta: colors, to: life + colors });
      }
      return events;
    },
  },
};
