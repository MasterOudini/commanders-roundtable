// `Ajani, Adversary of Tyrants Emblem` - a endStep trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AJANI_ADVERSARY_OF_TYRANTS_EMBLEM } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AJANI_ADVERSARY_OF_TYRANTS_EMBLEM, "At the beginning of your end step, create three 1/1 white Cat creature tokens with lifelink.");
const TOKEN_L0 = tokenRef("Cat|1/1|W|Creature|lifelink");

export const AJANI_ADVERSARY_OF_TYRANTS_EMBLEM1C97E5B2_SCRIPT: CardScript = {
  oracleId: AJANI_ADVERSARY_OF_TYRANTS_EMBLEM.oracleId,
  name: AJANI_ADVERSARY_OF_TYRANTS_EMBLEM.name,
  triggers: [
    {
      abilityId: 'endStep-0',
      text: PRINTED,
      event: 'StepBegan',
      activeZones: ['command'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'end' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Ajani, Adversary of Tyrants Emblem - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 3 }, () => ({
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
