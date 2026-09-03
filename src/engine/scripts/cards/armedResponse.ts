// `Armed Response` — damage to the attacker equal to the Equipment I control
// (derived subtype). D291's role.

import { ARMED_RESPONSE } from '../../../data/fixtures/engineCards';
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
  ARMED_RESPONSE,
  'Armed Response deals damage to target attacking creature equal to the number of Equipment you control.',
);

export const ARMED_RESPONSE_SCRIPT: CardScript = {
  oracleId: ARMED_RESPONSE.oracleId,
  name: ARMED_RESPONSE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let amount = 0;
      for (const id of ctx.state.zones.battlefield) {
        const c = ctx.state.cards[id];
        if (!c || c.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Equipment')) amount++;
      }
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
