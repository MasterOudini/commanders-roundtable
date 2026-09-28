// `Child of the Pack // Savage Packmate` - an activation token, a static anthem
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CHILD_OF_THE_PACK_SAVAGE_PACKMATE } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
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

const PRINTED = printed(CHILD_OF_THE_PACK_SAVAGE_PACKMATE, "{2}{R}{G}: Create a 2/2 green Wolf creature token.\nDaybound (If a player casts no spells during their own turn, it becomes night next turn.)\nTrample\nOther creatures you control get +1/+0.\nNightbound (If a player casts at least two spells during their own turn, it becomes day next turn.)");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Wolf|2/2|G|Creature|");

export const CHILD_OF_THE_PACK_SAVAGE_PACKMATE_SCRIPT: CardScript = {
  oracleId: CHILD_OF_THE_PACK_SAVAGE_PACKMATE.oracleId,
  name: CHILD_OF_THE_PACK_SAVAGE_PACKMATE.name,
  activated: [
    {
      ref: `${CHILD_OF_THE_PACK_SAVAGE_PACKMATE.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_0.oracleId,
          printingId: TOKEN_0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-3', face: 1,
      text: LINES[3] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => candidate !== self && chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 0;
      },
    },
  ],
};
