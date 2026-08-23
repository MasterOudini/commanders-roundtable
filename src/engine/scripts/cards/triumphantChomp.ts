// `Triumphant Chomp` — max(2, greatest power among MY Dinosaurs). The floor
// is what makes it always do something: with no Dinosaur at all it is still
// 2 damage, so the census is a raise and never a gate. D262.

import { TRIUMPHANT_CHOMP } from '../../../data/fixtures/engineCards';
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
  TRIUMPHANT_CHOMP,
  'Triumphant Chomp deals damage to target creature equal to 2 or the greatest power among Dinosaurs you control, whichever is greater.',
);

export const TRIUMPHANT_CHOMP_SCRIPT: CardScript = {
  oracleId: TRIUMPHANT_CHOMP.oracleId,
  name: TRIUMPHANT_CHOMP.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') return [];

      let amount = 2;
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst || inst.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.subtypes.includes('Dinosaur')) continue;
        if ((d.power ?? 0) > amount) amount = d.power ?? 0;
      }

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
