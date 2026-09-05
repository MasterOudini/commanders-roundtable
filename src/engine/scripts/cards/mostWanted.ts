// `Most Wanted` - a static attachedStatic, a enchantedCreatureDies trigger token
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOST_WANTED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOST_WANTED, "Flash\nEnchant creature\nEnchanted creature gets +2/+1.\nWhen enchanted creature dies, create two Treasure tokens.");
const LINES = PRINTED.split('\n');
const TOKEN_L3 = tokenRef("Treasure|/||Artifact|");

export const MOST_WANTED_SCRIPT: CardScript = {
  oracleId: MOST_WANTED.oracleId,
  name: MOST_WANTED.name,
  triggers: [
    {
      abilityId: 'enchantedCreatureDies-3',
      text: LINES[3] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === ctx.state.cards[self]?.attachedTo && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Most Wanted - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L3.oracleId,
          printingId: TOKEN_L3.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-pt-2',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        if (chars.power !== null) chars.power += 2;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
