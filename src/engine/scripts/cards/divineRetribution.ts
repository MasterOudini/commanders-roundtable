// `Divine Retribution` — damage to the attacker equal to the number of
// attacking creatures, read off the live combat. D291's role.

import { DIVINE_RETRIBUTION } from '../../../data/fixtures/engineCards';
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
  DIVINE_RETRIBUTION,
  'Divine Retribution deals damage to target attacking creature equal to the number of attacking creatures.',
);

export const DIVINE_RETRIBUTION_SCRIPT: CardScript = {
  oracleId: DIVINE_RETRIBUTION.oracleId,
  name: DIVINE_RETRIBUTION.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const amount = ctx.state.combat?.attackers.length ?? 0;
      if (amount <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: [{ source: self, target: { kind: 'card', id: target.id }, amount, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' }],
        },
      ];
    },
  },
};
