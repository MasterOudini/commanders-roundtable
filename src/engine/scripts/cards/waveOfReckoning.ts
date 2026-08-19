// `Wave of Reckoning` — "Each creature deals damage to itself equal to its
// power." Solar Blaze's exact text on a second oracle id (the
// Benalish-twin precedent), proven on its own: one DamageDealt, every
// derived creature its own source and target, riders per creature, power 0
// deals nothing. D196.

import { WAVE_OF_RECKONING } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(WAVE_OF_RECKONING, 'Each creature deals damage to itself equal to its power.');

export const WAVE_OF_RECKONING_SCRIPT: CardScript = {
  oracleId: WAVE_OF_RECKONING.oracleId,
  name: WAVE_OF_RECKONING.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const damages = [];
      for (const id of ctx.state.zones.battlefield) {
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        const power = d.power ?? 0;
        if (power <= 0) continue;
        const controller = ctx.state.cards[id]?.controller;
        damages.push({
          source: id,
          target: { kind: 'card' as const, id },
          amount: power,
          deathtouch: d.keywords.has('deathtouch'),
          lifelinkTo: d.keywords.has('lifelink') && controller !== undefined ? controller : null,
          isCommanderDamage: false,
          viaTrample: 0,
          toxic: d.toxicAmount,
          applyAs:
            d.keywords.has('infect') || d.keywords.has('wither')
              ? ('wither' as const)
              : ('normal' as const),
        });
      }
      if (damages.length === 0) return [];
      return [{ t: 'DamageDealt', damages }];
    },
  },
};
