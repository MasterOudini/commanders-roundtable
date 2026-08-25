// `Whipflare` — 2 damage to each NONARTIFACT creature. A negated type, read
// resolve-side off the derived type line, so an artifact creature is spared
// and a plain one is not. D269.

import { WHIPFLARE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WHIPFLARE, 'Whipflare deals 2 damage to each nonartifact creature.');

export const WHIPFLARE_SCRIPT: CardScript = {
  oracleId: WHIPFLARE.oracleId,
  name: WHIPFLARE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const types = ctx.derive(id).typeLine.types;
        if (!types.includes('Creature')) continue;
        if (types.includes('Artifact')) continue;
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
