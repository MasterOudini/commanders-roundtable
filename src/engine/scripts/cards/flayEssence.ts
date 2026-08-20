// `Flay Essence` — "Exile target creature or planeswalker. You gain life
// equal to the number of counters on it." The census is EVERY counter
// kind on the card (reading arbitrary kinds is fine — only writing
// outside the +1/+1 vocabulary is barred), read pre-move. D214.

import { FLAY_ESSENCE } from '../../../data/fixtures/engineCards';
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
  FLAY_ESSENCE,
  'Exile target creature or planeswalker. You gain life equal to the number of counters on it.',
);

export const FLAY_ESSENCE_SCRIPT: CardScript = {
  oracleId: FLAY_ESSENCE.oracleId,
  name: FLAY_ESSENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let counters = 0;
      for (const n of Object.values(card.counters)) counters += n ?? 0;
      const events: EventBody[] = [
        {
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'exile', player: card.owner },
            },
          ],
        },
      ];
      const me = ctx.state.players[obj.controller];
      if (counters > 0 && me && !me.hasLost) {
        events.push({
          t: 'LifeChanged',
          player: obj.controller,
          delta: counters,
          to: me.life + counters,
        });
      }
      return events;
    },
  },
};
