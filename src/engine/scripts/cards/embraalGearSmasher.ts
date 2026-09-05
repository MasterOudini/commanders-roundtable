// `Embraal Gear-Smasher` - an activation damageOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EMBRAAL_GEAR_SMASHER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody, ResolvedDamage } from '../../types/events';

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

const PRINTED = printed(EMBRAAL_GEAR_SMASHER, "{T}, Sacrifice an artifact: This creature deals 2 damage to each opponent.");

export const EMBRAAL_GEAR_SMASHER_SCRIPT: CardScript = {
  oracleId: EMBRAAL_GEAR_SMASHER.oracleId,
  name: EMBRAAL_GEAR_SMASHER.name,
  activated: [
    {
      ref: `${EMBRAAL_GEAR_SMASHER.oracleId}#a0`,
      text: PRINTED,
      resolve: (ctx, self, obj): readonly EventBody[] => {
        const d = ctx.derive(self);
        const infect = d.keywords.has('infect');
        const wither = d.keywords.has('wither');
        const damages: ResolvedDamage[] = [];
        for (const pid of Object.keys(ctx.state.players)) {
          if (pid === obj.controller) continue;
          damages.push({ source: self, target: { kind: 'player' as const, id: pid }, amount: 2, deathtouch: d.keywords.has('deathtouch'), lifelinkTo: d.keywords.has('lifelink') ? obj.controller : null, isCommanderDamage: false, viaTrample: 0, toxic: d.toxicAmount ?? 0, applyAs: infect ? ('poison' as const) : wither ? ('wither' as const) : ('normal' as const) });
        }
        return damages.length ? [{ t: 'DamageDealt', damages }] : [];
      },
    },
  ],
};
