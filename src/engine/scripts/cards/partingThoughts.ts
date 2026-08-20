// `Parting Thoughts` — "Destroy target creature. You draw X cards and you
// lose X life, where X is the number of counters on that creature." Flay
// Essence's whole-counter census read BEFORE the move. D232.

import { PARTING_THOUGHTS } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import { drawEvents } from '../../effects';

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
  PARTING_THOUGHTS,
  'Destroy target creature. You draw X cards and you lose X life, where X is the number of counters on that creature.',
);

export const PARTING_THOUGHTS_SCRIPT: CardScript = {
  oracleId: PARTING_THOUGHTS.oracleId,
  name: PARTING_THOUGHTS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let x = 0;
      for (const n of Object.values(card.counters)) x += Math.max(0, n);
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      const player = ctx.state.players[obj.controller];
      if (x > 0 && player && !player.hasLost) {
        events.push(...drawEvents(ctx.state, obj.controller, x));
        events.push({ t: 'LifeChanged', player: obj.controller, delta: -x, to: player.life - x });
      }
      return events;
    },
  },
};
