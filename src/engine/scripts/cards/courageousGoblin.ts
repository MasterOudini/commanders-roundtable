// `Courageous Goblin` - a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { COURAGEOUS_GOBLIN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(COURAGEOUS_GOBLIN, "Whenever this creature attacks while you control a creature with power 4 or greater, this creature gets +1/+0 and gains menace until end of turn. (It can't be blocked except by two or more creatures.)");

export const COURAGEOUS_GOBLIN_SCRIPT: CardScript = {
  oracleId: COURAGEOUS_GOBLIN.oracleId,
  name: COURAGEOUS_GOBLIN.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        Object.values(ctx.state.cards).some((c) => c.zone.kind === 'battlefield' && c.controller === ctx.query.controllerOf(self) && ctx.derive(c.id).typeLine.types.includes('Creature') && (ctx.derive(c.id).power ?? 0) >= 4) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Courageous Goblin - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 0, keywords: ["menace"] }];
      },
    },
  ],
};
