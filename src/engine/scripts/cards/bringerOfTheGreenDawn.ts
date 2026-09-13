// `Bringer of the Green Dawn` - a upkeep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BRINGER_OF_THE_GREEN_DAWN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(BRINGER_OF_THE_GREEN_DAWN, "You may pay {W}{U}{B}{R}{G} rather than pay this spell's mana cost.\nTrample\nAt the beginning of your upkeep, you may create a 3/3 green Beast creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Beast|3/3|G|Creature|");

export const BRINGER_OF_THE_GREEN_DAWN_SCRIPT: CardScript = {
  oracleId: BRINGER_OF_THE_GREEN_DAWN.oracleId,
  name: BRINGER_OF_THE_GREEN_DAWN.name,
  triggers: [
    {
      abilityId: 'upkeep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Bringer of the Green Dawn - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L2.oracleId,
          printingId: TOKEN_L2.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
