// `Mantle of the Wolf` - a static attachedStatic, a auraToGraveyard trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MANTLE_OF_THE_WOLF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MANTLE_OF_THE_WOLF, "Enchant creature\nEnchanted creature gets +4/+4.\nWhen this Aura is put into a graveyard from the battlefield, create two 2/2 green Wolf creature tokens.");
const LINES = PRINTED.split('\n');
const TOKEN_L2 = tokenRef("Wolf|2/2|G|Creature|");

export const MANTLE_OF_THE_WOLF_SCRIPT: CardScript = {
  oracleId: MANTLE_OF_THE_WOLF.oracleId,
  name: MANTLE_OF_THE_WOLF.name,
  triggers: [
    {
      abilityId: 'auraToGraveyard-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Mantle of the Wolf - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
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
        if (chars.power !== null) chars.power += 4;
        if (chars.toughness !== null) chars.toughness += 4;
      },
    },
  ],
};
