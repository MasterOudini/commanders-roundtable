// `Ghost Hounds` - a blocksOrBecomesBlockedBy trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { GHOST_HOUNDS } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(GHOST_HOUNDS, "Vigilance\nWhenever this creature blocks or becomes blocked by a white creature, this creature gains first strike until end of turn.");
const LINES = PRINTED.split('\n');

export const GHOST_HOUNDS_SCRIPT: CardScript = {
  oracleId: GHOST_HOUNDS.oracleId,
  name: GHOST_HOUNDS.name,
  triggers: [
    {
      abilityId: 'blocksOrBecomesBlockedBy-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' && ev.blocks.some((b) => (b.blocker === self && ctx.derive(b.attacker).colors.some((c) => ["W"].includes(c))) || (b.attacker === self && ctx.derive(b.blocker).colors.some((c) => ["W"].includes(c)))),
      label: () => "Ghost Hounds - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["firstStrike"] }];
      },
    },
  ],
};
