// `Breath Weapon` — "Breath Weapon deals 2 damage to each non-Dragon
// creature." A NEGATED subtype on a computed wipe is fine — nothing is
// targeted, so the filter is just the derive. D201.

import { BREATH_WEAPON } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BREATH_WEAPON, 'Breath Weapon deals 2 damage to each non-Dragon creature.');

export const BREATH_WEAPON_SCRIPT: CardScript = {
  oracleId: BREATH_WEAPON.oracleId,
  name: BREATH_WEAPON.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.subtypes.includes('Dragon')) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id },
          amount: 2,
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
