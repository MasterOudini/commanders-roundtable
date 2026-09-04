// `Sensor Splicer` - "When this creature enters, create a 3/3 colorless Phyrexian
// Golem artifact creature token" and the layer-6 grant "Golem creatures you
// control have vigilance" (a StaticDef in the shape of the engine's Levitation,
// D300) - the token it makes is a Golem it reaches.

import { SENSOR_SPLICER } from '../../../data/fixtures/engineCards';
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
  SENSOR_SPLICER,
  'When this creature enters, create a 3/3 colorless Phyrexian Golem artifact creature token.\nGolem creatures you control have vigilance.',
);
const LINES = PRINTED.split('\n');
const GOLEM = tokenRef('Phyrexian Golem|3/3||Artifact Creature|');

export const SENSOR_SPLICER_SCRIPT: CardScript = {
  oracleId: SENSOR_SPLICER.oracleId,
  name: SENSOR_SPLICER.name,
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
      label: () => 'Sensor Splicer - create a 3/3 Phyrexian Golem token',
      resolve: (ctx, _self, obj): readonly EventBody[] => [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: GOLEM.oracleId,
          printingId: GOLEM.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ],
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
        chars.keywords.add('vigilance');
      },
    },
  ],
};
