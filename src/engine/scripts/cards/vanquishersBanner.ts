// `Vanquisher's Banner` - a static anthem, a castSpell trigger draw
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { VANQUISHER_S_BANNER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(VANQUISHER_S_BANNER, "As this artifact enters, choose a creature type.\nCreatures you control of the chosen type get +1/+1.\nWhenever you cast a creature spell of the chosen type, draw a card.");
const LINES = PRINTED.split('\n');

export const VANQUISHERS_BANNER_SCRIPT: CardScript = {
  oracleId: VANQUISHER_S_BANNER.oracleId,
  name: VANQUISHER_S_BANNER.name,
  triggers: [
    {
      abilityId: 'castSpell-2',
      text: LINES[2] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'SpellCast' &&
        ev.obj.card !== null &&
        ev.obj.controller === ctx.query.controllerOf(self) &&
        ctx.derive(ev.obj.card).typeLine.types.includes('Creature') &&
        ctx.derive(ev.obj.card).typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? ''),
      label: () => "Vanquisher's Banner - draw",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return drawEvents(ctx.state, obj.controller, 1);
      },
    },
  ],
  statics: [
    {
      abilityId: 'anthem-pt-1',
      text: LINES[1] as string,
      layer: 'ptModify',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, chars) => chars.typeLine.types.includes('Creature') && ctx.state.cards[candidate]?.zone.kind === 'battlefield' && chars.typeLine.subtypes.includes(ctx.state.cards[self]?.chosenType ?? '') && ctx.state.cards[candidate]?.controller === ctx.query.controllerOf(self),
      modify: (chars) => {
        if (chars.power !== null) chars.power += 1;
        if (chars.toughness !== null) chars.toughness += 1;
      },
    },
  ],
};
