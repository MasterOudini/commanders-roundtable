// `Verdant Force` — EACH upkeep, not just mine (Celestial Force's shape,
// D167): no active-player filter at all, so an opponent's upkeep pays too and
// the token still arrives under the FORCE's controller. D265.

import { VERDANT_FORCE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE } from '../../../data/tokenTable';
import type { TokenRef } from '../../../data/tokenTable';
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
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const TEXT = printed(
  VERDANT_FORCE,
  'At the beginning of each upkeep, create a 1/1 green Saproling creature token.',
);

const SAPROLING = tokenRef('Saproling|1/1|G|Creature|');

export const VERDANT_FORCE_SCRIPT: CardScript = {
  oracleId: VERDANT_FORCE.oracleId,
  name: VERDANT_FORCE.name,
  triggers: [
    {
      abilityId: 'each-upkeep',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep',
      label: () => 'Verdant Force — create a 1/1 Saproling',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: SAPROLING.oracleId,
          printingId: SAPROLING.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
    },
  ],
};
