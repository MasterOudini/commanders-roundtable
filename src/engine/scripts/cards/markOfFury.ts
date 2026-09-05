// `Mark of Fury` - a static attachedStatic, a eachEndStep trigger bounceSelf
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARK_OF_FURY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARK_OF_FURY, "Enchant creature\nEnchanted creature has haste.\nAt the beginning of the end step, return this Aura to its owner's hand.");
const LINES = PRINTED.split('\n');

export const MARK_OF_FURY_SCRIPT: CardScript = {
  oracleId: MARK_OF_FURY.oracleId,
  name: MARK_OF_FURY.name,
  triggers: [
    {
      abilityId: 'eachEndStep-2',
      text: LINES[2] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, _self, ev) => ev.t === 'StepBegan' && ev.step === 'end',
      label: () => "Mark of Fury - bounceSelf",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CardsMoved', moves: [{ card: self, from: { kind: 'battlefield', player: me.controller }, to: { kind: 'hand', player: me.owner } }] }];
      },
    },
  ],
  statics: [
    {
      abilityId: 'attached-grant-1',
      text: LINES[1] as string,
      layer: 'ability',
      activeZones: ['battlefield'],
      appliesTo: (ctx, self, candidate, _chars) => ctx.state.cards[self]?.attachedTo === candidate,
      modify: (chars) => {
        chars.keywords.add("haste");
      },
    },
  ],
};
