// `Moon-Boy, Dino Rider` - a attacks trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MOON_BOY_DINO_RIDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MOON_BOY_DINO_RIDER, "Dinosaur spells you cast cost {1} less to cast.\nWhenever Moon-Boy attacks while you control a Dinosaur, Moon-Boy gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

export const MOON_BOY_DINO_RIDER_SCRIPT: CardScript = {
  oracleId: MOON_BOY_DINO_RIDER.oracleId,
  name: MOON_BOY_DINO_RIDER.name,
  triggers: [
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        Object.values(ctx.state.cards).some((c) => c.zone.kind === 'battlefield' && c.controller === ctx.query.controllerOf(self) && ctx.derive(c.id).typeLine.subtypes.includes('Dinosaur')) &&
        (ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self)),
      label: () => "Moon-Boy, Dino Rider - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 1, toughness: 1 }];
      },
    },
  ],
};
