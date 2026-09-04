// `Maul Splicer` - "When this creature enters, create two 3/3 colorless Phyrexian
// Golem artifact creature tokens" and the layer-6 grant "Golem creatures you
// control have trample" (a StaticDef in the shape of the engine's Levitation,
// D300) - the tokens it makes are the Golems it reaches.

import { MAUL_SPLICER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  MAUL_SPLICER,
  'When this creature enters, create two 3/3 colorless Phyrexian Golem artifact creature tokens.\nGolem creatures you control have trample.',
);
const LINES = PRINTED.split('\n');
const GOLEM = tokenRef('Phyrexian Golem|3/3||Artifact Creature|');

export const MAUL_SPLICER_SCRIPT: CardScript = {
  oracleId: MAUL_SPLICER.oracleId,
  name: MAUL_SPLICER.name,
  triggers: [
    {
      abilityId: 'etb',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => 'Maul Splicer - create two 3/3 Phyrexian Golem tokens',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        Array.from({ length: 2 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: GOLEM.oracleId,
          printingId: GOLEM.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        })),
    },
  ],
  statics: [
    {
      abilityId: 'grant',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (!chars.typeLine.types.includes('Creature')) return false;
        return chars.typeLine.subtypes.includes('Golem');
      },
      modify: (chars) => {
        chars.keywords.add('trample');
      },
    },
  ],
};
