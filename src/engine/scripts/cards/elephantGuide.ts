// `Elephant Guide` - a static attachedStatic, a enchantedCreatureDies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ELEPHANT_GUIDE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ELEPHANT_GUIDE, "Enchant creature\nEnchanted creature gets +3/+3.\nWhen enchanted creature dies, create a 3/3 green Elephant creature token.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Elephant|3/3|G|Creature|");

export const ELEPHANT_GUIDE_SCRIPT: CardScript = {
  oracleId: ELEPHANT_GUIDE.oracleId,
  name: ELEPHANT_GUIDE.name,
  triggers: [
    {
      abilityId: 'enchantedCreatureDies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === ctx.state.cards[self]?.attachedTo && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Elephant Guide - token",
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
  statics: [
    {
      abilityId: 'attached-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 3;
        if (chars.toughness !== null) chars.toughness += 3;
      },
    },
  ],
};
