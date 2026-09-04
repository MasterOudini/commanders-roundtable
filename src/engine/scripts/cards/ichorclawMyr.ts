// `Ichorclaw Myr` - a becomesBlocked trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ICHORCLAW_MYR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ICHORCLAW_MYR, "Infect (This creature deals damage to creatures in the form of -1/-1 counters and to players in the form of poison counters.)\nWhenever this creature becomes blocked, it gets +2/+2 until end of turn.");
const LINES = PRINTED.split('\n');

export const ICHORCLAW_MYR_SCRIPT: CardScript = {
  oracleId: ICHORCLAW_MYR.oracleId,
  name: ICHORCLAW_MYR.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.attacker === self),
      label: () => "Ichorclaw Myr - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
