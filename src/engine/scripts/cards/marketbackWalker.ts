// `Marketback Walker` - a static entersWithCountersX, an activation selfCounter, a dies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARKETBACK_WALKER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(MARKETBACK_WALKER, "This creature enters with X +1/+1 counters on it.\n{4}: Put a +1/+1 counter on this creature.\nWhen this creature dies, draw a card for each +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("Draw a card for each +1/+1 counter on ~.", MARKETBACK_WALKER.name);
const VOCAB_T_L2 = vocabularyTargets("Draw a card for each +1/+1 counter on ~.");

export const MARKETBACK_WALKER_SCRIPT: CardScript = {
  oracleId: MARKETBACK_WALKER.oracleId,
  name: MARKETBACK_WALKER.name,
  activated: [
    {
      ref: `${MARKETBACK_WALKER.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'dies-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Marketback Walker - Draw a card for each +1/+1 counter on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (ctx, self, ev): readonly EventBody[] => {
        // The cast's X, read off the stack object the spell still is (CR 608.2).
        const x = ctx.state.stack.find((o) => o.card === self)?.xValue ?? 0;
        return x > 0 ? [ev, { t: 'CountersChanged', changes: [{ card: self, kind: '+1/+1', delta: x }] }] : [ev];
      },
    },
  ],
};
