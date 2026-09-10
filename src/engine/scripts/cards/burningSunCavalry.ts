// `Burning Sun Cavalry` - a attacks trigger pumping itself, a blocks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BURNING_SUN_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BURNING_SUN_CAVALRY, "Whenever this creature attacks or blocks while you control a Dinosaur, this creature gets +1/+1 until end of turn.");

export const BURNING_SUN_CAVALRY_SCRIPT: CardScript = {
  oracleId: BURNING_SUN_CAVALRY.oracleId,
  name: BURNING_SUN_CAVALRY.name,
  triggers: [
    {
      abilityId: 'attacks-0',
      text: PRINTED,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        Object.values(ctx.state.cards).some((c) => c.zone.kind === 'battlefield' && c.controller === ctx.query.controllerOf(self) && ctx.derive(c.id).typeLine.subtypes.includes('Dinosaur')) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Burning Sun Cavalry - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
    {
      abilityId: 'blocks-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        Object.values(ctx.state.cards).some((c) => c.zone.kind === 'battlefield' && c.controller === ctx.query.controllerOf(self) && ctx.derive(c.id).typeLine.subtypes.includes('Dinosaur')) &&
        (ev.t === 'BlockersDeclared' && ev.blocks.some((b) => b.blocker === self)),
      label: () => "Burning Sun Cavalry - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
