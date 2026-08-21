// `Swelter` — the counted PAIR: 2 damage to each of exactly two target
// creatures (min2/max2, probed — Sick and Tired's machinery at damage).
// D255.

import { SWELTER } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SWELTER, 'Swelter deals 2 damage to each of two target creatures.');

export const SWELTER_SCRIPT: CardScript = {
  oracleId: SWELTER.oracleId,
  name: SWELTER.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const damages = [];
      for (const target of obj.targets) {
        if (!target || target.kind !== 'card') continue;
        if (ctx.state.cards[target.id]?.zone.kind !== 'battlefield') continue;
        damages.push({
          source: self,
          target: { kind: 'card' as const, id: target.id },
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
