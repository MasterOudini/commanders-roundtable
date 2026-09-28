// `Glowstone Recluse` - a mutates trigger selfCounter
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GLOWSTONE_RECLUSE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GLOWSTONE_RECLUSE, "Mutate {3}{G} (If you cast this spell for its mutate cost, put it over or under target non-Human creature you own. They mutate into the creature on top plus all abilities from under it.)\nReach\nWhenever this creature mutates, put two +1/+1 counters on it.");
const LINES = PRINTED.split('\n');

export const GLOWSTONE_RECLUSE_SCRIPT: CardScript = {
  oracleId: GLOWSTONE_RECLUSE.oracleId,
  name: GLOWSTONE_RECLUSE.name,
  triggers: [
    {
      abilityId: 'mutates-2',
      text: LINES[2] as string,
      event: 'Mutated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'Mutated' && ev.host === self,
      label: () => "Glowstone Recluse - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }];
      },
    },
  ],
};
