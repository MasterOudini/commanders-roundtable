// `Dwarven Catapult` — "Dwarven Catapult deals X damage divided evenly,
// rounded down, among all creatures target opponent controls." EVENLY is
// what makes it deterministic: floor(X / count) to each, no one chooses.
// D209.

import { DWARVEN_CATAPULT } from '../../../data/fixtures/engineCards';
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
  DWARVEN_CATAPULT,
  'Dwarven Catapult deals X damage divided evenly, rounded down, among all creatures target opponent controls.',
);

export const DWARVEN_CATAPULT_SCRIPT: CardScript = {
  oracleId: DWARVEN_CATAPULT.oracleId,
  name: DWARVEN_CATAPULT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const target = obj.targets[0];
      if (!target || target.kind !== 'player') return [];
      if (ctx.state.players[target.id]?.hasLost) return [];
      const creatures = [];
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== target.id) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        creatures.push(id);
      }
      if (creatures.length === 0) return [];
      const each = Math.floor(x / creatures.length);
      if (each <= 0) return [];
      return [
        {
          t: 'DamageDealt',
          damages: creatures.map((id) => ({
            source: self,
            target: { kind: 'card' as const, id },
            amount: each,
            deathtouch: false,
            lifelinkTo: null,
            isCommanderDamage: false,
            viaTrample: 0,
            toxic: 0,
            applyAs: 'normal' as const,
          })),
        },
      ];
    },
  },
};
