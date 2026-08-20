// `Magmaquake` — X to each grounded creature and each planeswalker.
// D223.

import { MAGMAQUAKE } from '../../../data/fixtures/engineCards';
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
  MAGMAQUAKE,
  'Magmaquake deals X damage to each creature without flying and each planeswalker.',
);

export const MAGMAQUAKE_SCRIPT: CardScript = {
  oracleId: MAGMAQUAKE.oracleId,
  name: MAGMAQUAKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        const isCreature = d.typeLine.types.includes('Creature');
        const isPlaneswalker = d.typeLine.types.includes('Planeswalker');
        const hits = (isCreature && !d.keywords.has('flying')) || isPlaneswalker;
        if (!hits) continue;
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
