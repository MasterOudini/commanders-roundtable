// `Fists of Ironwood` - an Aura (Enchant creature): the enchanted creature (on entering: 2 tokens); has trample.
// The Enchant line is the engine's own - the cast aims by it and CR 704.5m keeps it
// (D304); the rest are defs whose one candidate is whatever the Aura is attached to.
// Generated from one table row.

import { FISTS_OF_IRONWOOD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FISTS_OF_IRONWOOD, "Enchant creature\nWhen this Aura enters, create two 1/1 green Saproling creature tokens.\nEnchanted creature has trample.");
const LINES = PRINTED.split('\n');

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const TOKEN = tokenRef("Saproling|1/1|G|Creature|");

export const FISTS_OF_IRONWOOD_SCRIPT: CardScript = {
  oracleId: FISTS_OF_IRONWOOD.oracleId,
  name: FISTS_OF_IRONWOOD.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Fists of Ironwood - create two tokens",
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN.oracleId,
          printingId: TOKEN.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
  statics: [
    {
      abilityId: 'enchanted-grant-2',
      text: LINES[2] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      // The one candidate: whatever the Aura is attached to (nothing while it is not).
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("trample");
      },
    },
  ],
};
