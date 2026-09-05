// `Setessan Oathsworn` - a heroic trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SETESSAN_OATHSWORN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SETESSAN_OATHSWORN, "Heroic — Whenever you cast a spell that targets this creature, put two +1/+1 counters on this creature.");

export const SETESSAN_OATHSWORN_SCRIPT: CardScript = {
  oracleId: SETESSAN_OATHSWORN.oracleId,
  name: SETESSAN_OATHSWORN.name,
  triggers: [
    {
      abilityId: 'heroic-0',
      text: PRINTED,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Setessan Oathsworn - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
