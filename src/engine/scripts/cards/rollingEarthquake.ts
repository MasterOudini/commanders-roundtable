// `Rolling Earthquake` — "Rolling Earthquake deals X damage to each
// creature without horsemanship and each player." Squall Line's X fan
// with the exemption NEGATED — horsemanship is the filter's other half,
// and nobody printed in this pool has it. D241.

import { ROLLING_EARTHQUAKE } from '../../../data/fixtures/engineCards';
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
  ROLLING_EARTHQUAKE,
  'Rolling Earthquake deals X damage to each creature without horsemanship and each player.',
);

export const ROLLING_EARTHQUAKE_SCRIPT: CardScript = {
  oracleId: ROLLING_EARTHQUAKE.oracleId,
  name: ROLLING_EARTHQUAKE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      if (x <= 0) return [];
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature') || d.keywords.has('horsemanship')) continue;
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
      for (const [pid, p] of Object.entries(ctx.state.players)) {
        if (p.hasLost) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
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
