// `Ruby, Daring Tracker` - a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RUBY_DARING_TRACKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RUBY_DARING_TRACKER, "Haste (This creature can attack and {T} as soon as it comes under your control.)\nWhenever Ruby attacks while you control a creature with power 4 or greater, Ruby gets +2/+2 until end of turn.\n{T}: Add {R} or {G}.");
const LINES = PRINTED.split('\n');

export const RUBY_DARING_TRACKER_SCRIPT: CardScript = {
  oracleId: RUBY_DARING_TRACKER.oracleId,
  name: RUBY_DARING_TRACKER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        Object.values(ctx.state.cards).some((c) => c.zone.kind === 'battlefield' && c.controller === ctx.query.controllerOf(self) && ctx.derive(c.id).typeLine.types.includes('Creature') && (ctx.derive(c.id).power ?? 0) >= 4) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Ruby, Daring Tracker - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 2, toughness: 2 }];
      },
    },
  ],
};
