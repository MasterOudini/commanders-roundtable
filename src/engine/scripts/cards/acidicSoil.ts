// `Acidic Soil` — "Acidic Soil deals damage to each player equal to the
// number of lands they control." Per-player amounts computed at
// resolution from DERIVED type lines, all entries in one DamageDealt so
// the burn is simultaneous. The spell is the source — no riders. D196.

import { ACIDIC_SOIL } from '../../../data/fixtures/engineCards';
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
  ACIDIC_SOIL,
  'Acidic Soil deals damage to each player equal to the number of lands they control.',
);

export const ACIDIC_SOIL_SCRIPT: CardScript = {
  oracleId: ACIDIC_SOIL.oracleId,
  name: ACIDIC_SOIL.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const lands = new Map<string, number>();
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card) continue;
        if (!ctx.derive(id).typeLine.types.includes('Land')) continue;
        lands.set(card.controller, (lands.get(card.controller) ?? 0) + 1);
      }
      const damages = [];
      for (const [pid, p] of Object.entries(ctx.state.players)) {
        if (p.hasLost) continue;
        const n = lands.get(pid) ?? 0;
        if (n <= 0) continue;
        damages.push({
          source: self,
          target: { kind: 'player' as const, id: pid },
          amount: n,
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
