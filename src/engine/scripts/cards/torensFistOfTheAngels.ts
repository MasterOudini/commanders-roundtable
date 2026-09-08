// `Torens, Fist of the Angels` - a castCreatureSpell trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TORENS_FIST_OF_THE_ANGELS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TORENS_FIST_OF_THE_ANGELS, "Training (Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.)\nWhenever you cast a creature spell, create a 1/1 green and white Human Soldier creature token with training.");
const LINES = PRINTED.split('\n');
const TOKEN_L1 = tokenRef("Human Soldier|1/1|GW|Creature|training");

export const TORENS_FIST_OF_THE_ANGELS_SCRIPT: CardScript = {
  oracleId: TORENS_FIST_OF_THE_ANGELS.oracleId,
  name: TORENS_FIST_OF_THE_ANGELS.name,
  triggers: [
    {
      abilityId: 'castCreatureSpell-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' && ev.obj.controller === ctx.query.controllerOf(self) && ev.obj.card !== null && ctx.derive(ev.obj.card).typeLine.types.includes('Creature'),
      label: () => "Torens, Fist of the Angels - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L1.oracleId,
          printingId: TOKEN_L1.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
