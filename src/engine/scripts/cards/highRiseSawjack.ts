// `High-Rise Sawjack` - a blocks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HIGH_RISE_SAWJACK } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HIGH_RISE_SAWJACK, "Reach (This creature can block creatures with flying.)\nWhenever this creature blocks a creature with flying, this creature gets +2/+0 until end of turn.");
const LINES = PRINTED.split('\n');

export const HIGH_RISE_SAWJACK_SCRIPT: CardScript = {
  oracleId: HIGH_RISE_SAWJACK.oracleId,
  name: HIGH_RISE_SAWJACK.name,
  triggers: [
    {
      abilityId: 'blocks-1',
      text: LINES[1] as string,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.blocker === self && ctx.derive(b.attacker).typeLine.types.includes('Creature') && ctx.derive(b.attacker).keywords.has('flying')),
      label: () => "High-Rise Sawjack - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 0 }];
      },
    },
  ],
};
