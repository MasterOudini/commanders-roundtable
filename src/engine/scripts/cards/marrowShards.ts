// `Marrow Shards` — 1 to each attacking creature, behind a Phyrexian
// pip. D223.

import { MARROW_SHARDS } from '../../../data/fixtures/engineCards';
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
  MARROW_SHARDS,
  '({W/P} can be paid with either {W} or 2 life.)\nMarrow Shards deals 1 damage to each attacking creature.',
);

export const MARROW_SHARDS_SCRIPT: CardScript = {
  oracleId: MARROW_SHARDS.oracleId,
  name: MARROW_SHARDS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const a of ctx.state.combat?.attackers ?? []) {
        if (!ctx.state.cards[a.card]) continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: a.card },
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
