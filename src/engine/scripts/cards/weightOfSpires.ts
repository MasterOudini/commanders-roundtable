// `Weight of Spires` — damage equal to the number of NONBASIC lands **that
// creature's controller** controls.
//
// ⚠️ The count is read off the TARGET'S controller, not off mine. A test that
// only ever aims at an opponent with the same board as me cannot tell the two
// readings apart, so the test gives the two seats DIFFERENT land counts.
// "Nonbasic" is the negation of the Basic supertype, read DERIVED. D268.

import { WEIGHT_OF_SPIRES } from '../../../data/fixtures/engineCards';
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
  WEIGHT_OF_SPIRES,
  "Weight of Spires deals damage to target creature equal to the number of nonbasic lands that creature's controller controls.",
);

export const WEIGHT_OF_SPIRES_SCRIPT: CardScript = {
  oracleId: WEIGHT_OF_SPIRES.oracleId,
  name: WEIGHT_OF_SPIRES.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const victim = ctx.state.cards[target.id];
      if (!victim || victim.zone.kind !== 'battlefield') return [];

      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== victim.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Land')) continue;
        if (d.typeLine.supertypes.includes('Basic')) continue;
        amount += 1;
      }
      if (amount === 0) return [];

      return [
        {
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: target.id },
              amount,
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
    },
  },
};
