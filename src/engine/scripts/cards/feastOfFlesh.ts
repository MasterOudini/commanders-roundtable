// `Feast of Flesh` — "Feast of Flesh deals X damage to target creature and
// you gain X life, where X is 1 plus the number of cards named Feast of
// Flesh in all graveyards." The name census across EVERY graveyard by
// oracle name (Accumulated Knowledge's idiom); the copy resolving is on
// the STACK and does not count itself. D213.

import { FEAST_OF_FLESH } from '../../../data/fixtures/engineCards';
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
  FEAST_OF_FLESH,
  'Feast of Flesh deals X damage to target creature and you gain X life, where X is 1 plus the number of cards named Feast of Flesh in all graveyards.',
);

export const FEAST_OF_FLESH_SCRIPT: CardScript = {
  oracleId: FEAST_OF_FLESH.oracleId,
  name: FEAST_OF_FLESH.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];
      let named = 0;
      for (const pid of ctx.state.seating) {
        for (const id of ctx.state.zones.graveyard[pid] ?? []) {
          const card = ctx.state.cards[id];
          if (!card) continue;
          if (ctx.oracle.byPrinting(card.printingId)?.name === 'Feast of Flesh') named++;
        }
      }
      const x = 1 + named;
      const me = ctx.state.players[obj.controller];
      const events: EventBody[] = [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount: x,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        },
      ];
      if (me && !me.hasLost) {
        events.push({ t: 'LifeChanged', player: obj.controller, delta: x, to: me.life + x });
      }
      return events;
    },
  },
};
