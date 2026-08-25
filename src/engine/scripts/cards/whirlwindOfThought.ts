// `Whirlwind of Thought` — "Whenever you cast a noncreature spell, draw a
// card." Insight's cast watcher with the controller test inverted (MINE, not
// an opponent's) and a NEGATED TYPE in place of a colour. D269.

import { WHIRLWIND_OF_THOUGHT } from '../../../data/fixtures/engineCards';
import { drawEvents } from '../../effects';
import { faceOf } from '../../oracle';
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

const TEXT = printed(
  WHIRLWIND_OF_THOUGHT,
  'Whenever you cast a noncreature spell, draw a card.',
);

export const WHIRLWIND_OF_THOUGHT_SCRIPT: CardScript = {
  oracleId: WHIRLWIND_OF_THOUGHT.oracleId,
  name: WHIRLWIND_OF_THOUGHT.name,
  triggers: [
    {
      abilityId: 'noncreature-cast',
      text: TEXT,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => {
        if (ev.t !== 'SpellCast') return false;
        // "YOU cast" — mine only.
        if (ev.obj.controller !== ctx.query.controllerOf(self)) return false;
        if (!ev.obj.card) return false;
        const inst = ctx.state.cards[ev.obj.card];
        const oc = inst ? ctx.oracle.byPrinting(inst.printingId) : undefined;
        if (!oc) return false;
        return !faceOf(oc, ev.obj.faceIndex).typeLine.types.includes('Creature');
      },
      label: () => 'Whirlwind of Thought — draw a card',
      resolve: (ctx, _self, obj): readonly EventBody[] => drawEvents(ctx.state, obj.controller, 1),
    },
  ],
};
