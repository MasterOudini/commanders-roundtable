// `Tel-Jilad Wolf` - a becomesBlocked trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TEL_JILAD_WOLF } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TEL_JILAD_WOLF, "Whenever this creature becomes blocked by an artifact creature, this creature gets +3/+3 until end of turn.");

export const TEL_JILAD_WOLF_SCRIPT: CardScript = {
  oracleId: TEL_JILAD_WOLF.oracleId,
  name: TEL_JILAD_WOLF.name,
  triggers: [
    {
      abilityId: 'becomesBlocked-0',
      text: PRINTED,
      event: 'BlockersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'BlockersDeclared' &&
        ev.blocks.some((b) => b.attacker === self && ctx.derive(b.blocker).typeLine.types.includes('Artifact') && ctx.derive(b.blocker).typeLine.types.includes('Creature')),
      label: () => "Tel-Jilad Wolf - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 3, toughness: 3 }];
      },
    },
  ],
};
