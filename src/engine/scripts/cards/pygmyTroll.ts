// `Pygmy Troll` - a becomesBlocked trigger pumping itself, an activation regenerate
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PYGMY_TROLL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PYGMY_TROLL, "Whenever this creature becomes blocked by a creature, this creature gets +1/+1 until end of turn.\n{G}: Regenerate this creature.");
const LINES = PRINTED.split('\n');

export const PYGMY_TROLL_SCRIPT: CardScript = {
  oracleId: PYGMY_TROLL.oracleId,
  name: PYGMY_TROLL.name,
  activated: [
    {
      ref: `${PYGMY_TROLL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'RegenerationShieldAdded', card: self }];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: LINES[0] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.attacker === self && ctx.derive(b.blocker).typeLine.types.includes('Creature')),
      label: () => "Pygmy Troll - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
