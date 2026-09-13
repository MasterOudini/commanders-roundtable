// `Infested Roothold` - a opponentCastsSpell trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { INFESTED_ROOTHOLD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(INFESTED_ROOTHOLD, "Defender (This creature can't attack.)\nProtection from artifacts\nWhenever an opponent casts an artifact spell, you may create a 1/1 green Insect creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Insect|1/1|G|Creature|");

export const INFESTED_ROOTHOLD_SCRIPT: CardScript = {
  oracleId: INFESTED_ROOTHOLD.oracleId,
  name: INFESTED_ROOTHOLD.name,
  triggers: [
    {
      abilityId: 'opponentCastsSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller !== ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Artifact'),
      label: () => "Infested Roothold - token",
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
