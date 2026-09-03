// `Focus Fire` — X is 2 plus the creatures and/or Spacecraft I control (a
// permanent that is both counts once). D291's role.

import { FOCUS_FIRE } from '../../../data/fixtures/engineCards';
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
  FOCUS_FIRE,
  'Focus Fire deals X damage to target attacking or blocking creature, where X is 2 plus the number of creatures and/or Spacecraft you control.',
);

export const FOCUS_FIRE_SCRIPT: CardScript = {
  oracleId: FOCUS_FIRE.oracleId,
  name: FOCUS_FIRE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      let count = 0;
      for (const id of ctx.state.zones.battlefield) {
        const c = ctx.state.cards[id];
        if (!c || c.controller !== obj.controller) continue;
        const d = ctx.derive(id);
        if (d.typeLine.types.includes('Creature') || d.typeLine.subtypes.includes('Spacecraft')) count++;
      }
      const amount = 2 + count;
      return [
        {
          t: 'DamageDealt',
          damages: [{ source: self, target: { kind: 'card', id: target.id }, amount, deathtouch: false, lifelinkTo: null, isCommanderDamage: false, viaTrample: 0, toxic: 0, applyAs: 'normal' }],
        },
      ];
    },
  },
};
