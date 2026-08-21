// `Sandstorm` — "Sandstorm deals 1 damage to each attacking creature."
// Marrow Shards' attacker sweep at a flat 1. D243.

import { SANDSTORM } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SANDSTORM, 'Sandstorm deals 1 damage to each attacking creature.');

export const SANDSTORM_SCRIPT: CardScript = {
  oracleId: SANDSTORM.oracleId,
  name: SANDSTORM.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const decl of ctx.state.combat?.attackers ?? []) {
        const card = ctx.state.cards[decl.card];
        if (!card || card.zone.kind !== 'battlefield') continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: decl.card },
          amount: 1,
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
