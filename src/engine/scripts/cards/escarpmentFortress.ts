// `Escarpment Fortress` - a layer-6 anthem, "Other creatures you control get
// +1/+0" (a StaticDef in the shape of the engine's Levitation, D300), and
// "Whenever you attack with two or more creatures, draw a card" - one
// AttackersDeclared event, counted. Defender and reach are the engine's.

import { ESCARPMENT_FORTRESS } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
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

const PRINTED = printed(
  ESCARPMENT_FORTRESS,
  "Defender (This creature can't attack.)\nReach (This creature can block creatures with flying.)\nOther creatures you control get +1/+0.\nWhenever you attack with two or more creatures, draw a card.",
);
const LINES = PRINTED.split('\n');

export const ESCARPMENT_FORTRESS_SCRIPT: CardScript = {
  oracleId: ESCARPMENT_FORTRESS.oracleId,
  name: ESCARPMENT_FORTRESS.name,
  statics: [
    {
      abilityId: 'anthem',
      text: LINES[2] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => {
        const source = ctx.state.cards[self];
        const target = ctx.state.cards[candidate];
        if (!source || !target || target.zone.kind !== 'battlefield') return false;
        if (target.controller !== source.controller) return false;
        if (candidate === self) return false;
        return chars.typeLine.types.includes('Creature');
      },
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attack-with-two',
      text: LINES[3] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'AttackersDeclared' &&
        ev.attackers.filter((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)).length >= 2,
      label: () => 'Escarpment Fortress - draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
