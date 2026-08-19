// `Solar Blaze` — "Each creature deals damage to itself equal to its power."
// Every derived creature is BOTH source and target of its own entry, in ONE
// DamageDealt so the whole board burns simultaneously. The riders are each
// creature's own: deathtouch makes its self-damage lethal at any amount,
// lifelink pays its controller, wither/infect mark -1/-1 counters instead —
// the Kamahl idiom (D160) applied per entry. Power 0 deals nothing
// (CR 120.8: an amount of 0 is not damage). D192.

import { SOLAR_BLAZE } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(SOLAR_BLAZE, 'Each creature deals damage to itself equal to its power.');

export const SOLAR_BLAZE_SCRIPT: CardScript = {
  oracleId: SOLAR_BLAZE.oracleId,
  name: SOLAR_BLAZE.name,
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
