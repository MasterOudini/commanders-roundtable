// `Corrosive Gale` — "Corrosive Gale deals X damage to each creature with
// flying." Squall Line's flyer half; the {G/P} in the cost is the payment
// solver's business, not the resolve's. D204.

import { CORROSIVE_GALE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  CORROSIVE_GALE,
  '({G/P} can be paid with either {G} or 2 life.)\nCorrosive Gale deals X damage to each creature with flying.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const CORROSIVE_GALE_SCRIPT: CardScript = {
  oracleId: CORROSIVE_GALE.oracleId,
  name: CORROSIVE_GALE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (!d.keywords.has('flying')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: x,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal' as const,
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
