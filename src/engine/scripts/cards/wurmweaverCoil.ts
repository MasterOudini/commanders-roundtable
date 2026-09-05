// `Wurmweaver Coil` - a static attachedStatic, an activation token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WURMWEAVER_COIL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WURMWEAVER_COIL, "Enchant green creature\nEnchanted creature gets +6/+6.\n{G}{G}{G}, Sacrifice this Aura: Create a 6/6 green Wurm creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_0 = tokenRef("Wurm|6/6|G|Creature|");

export const WURMWEAVER_COIL_SCRIPT: CardScript = {
  oracleId: WURMWEAVER_COIL.oracleId,
  name: WURMWEAVER_COIL.name,
  activated: [
    {
      ref: `${WURMWEAVER_COIL.oracleId}#a0`,
      text: LINES[2] as string,
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
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 6;
        if (chars.toughness !== null) chars.toughness += 6;
      },
    },
  ],
};
