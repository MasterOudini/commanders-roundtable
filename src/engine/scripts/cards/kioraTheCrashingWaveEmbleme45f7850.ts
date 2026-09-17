// `Kiora, the Crashing Wave Emblem` - a endStep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIORA_THE_CRASHING_WAVE_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(KIORA_THE_CRASHING_WAVE_EMBLEM, "At the beginning of your end step, create a 9/9 blue Kraken creature token.");
const TOKEN_L0 = tokenRef("Kraken|9/9|U|Creature|");

export const KIORA_THE_CRASHING_WAVE_EMBLEME45F7850_SCRIPT: CardScript = {
  oracleId: KIORA_THE_CRASHING_WAVE_EMBLEM.oracleId,
  name: KIORA_THE_CRASHING_WAVE_EMBLEM.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Kiora, the Crashing Wave Emblem - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
