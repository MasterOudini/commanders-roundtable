// `Ramunap Ruins` - an activation damageOpponents
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAMUNAP_RUINS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAMUNAP_RUINS, "{T}: Add {C}.\n{T}, Pay 1 life: Add {R}.\n{2}{R}{R}, {T}, Sacrifice a Desert: This land deals 2 damage to each opponent.");
const LINES = PRINTED.split('\n');

export const RAMUNAP_RUINS_SCRIPT: CardScript = {
  oracleId: RAMUNAP_RUINS.oracleId,
  name: RAMUNAP_RUINS.name,
  activated: [
    {
      ref: `${RAMUNAP_RUINS.oracleId}#a2`,
      text: LINES[2] as string,
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
