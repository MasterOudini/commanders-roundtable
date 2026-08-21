// `Rain of Blades` — "Rain of Blades deals 1 damage to each attacking
// creature." Marrow Shards' attacker sweep for plain white. D237.

import { RAIN_OF_BLADES } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(RAIN_OF_BLADES, 'Rain of Blades deals 1 damage to each attacking creature.');

export const RAIN_OF_BLADES_SCRIPT: CardScript = {
  oracleId: RAIN_OF_BLADES.oracleId,
  name: RAIN_OF_BLADES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (!ctx.state.cards[a.card]) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: a.card },
          amount: 1,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      return damages.length > 0 ? [{ t: 'DamageDealt', damages }] : [];
    },
  },
};
