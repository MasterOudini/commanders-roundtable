// `Tropical Storm` — TWO overlapping fans in one damage event: X to each
// flyer, and 1 more to each BLUE creature. A blue flyer takes X+1, a blue
// ground creature takes 1, and a colourless flyer takes X. The overlap is
// the card, so it is what the test proves. D262.

import { TROPICAL_STORM } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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
  TROPICAL_STORM,
  'Tropical Storm deals X damage to each creature with flying and 1 additional damage to each blue creature.',
);

export const TROPICAL_STORM_SCRIPT: CardScript = {
  oracleId: TROPICAL_STORM.oracleId,
  name: TROPICAL_STORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      const damages: {
        source: InstanceId;
        target: { kind: 'card'; id: InstanceId };
        amount: number;
        deathtouch: boolean;
        lifelinkTo: null;
        isCommanderDamage: boolean;
        viaTrample: number;
        toxic: number;
        applyAs: 'normal';
      }[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        // ⚠️ The two clauses stack on one creature rather than replacing each
        // other: "1 ADDITIONAL damage" is a rider on the same event.
        const amount = (d.keywords.has('flying') ? x : 0) + (d.colors.includes('U') ? 1 : 0);
        if (amount <= 0) continue;
        damages.push({
          source: self,
          target: { kind: 'card', id },
          amount,
          deathtouch: false,
          lifelinkTo: null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: 0,
          applyAs: 'normal',
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
