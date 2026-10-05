// `Overzealous Muscle` - a youCommitCrime trigger pumping itself
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OVERZEALOUS_MUSCLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OVERZEALOUS_MUSCLE, "Whenever you commit a crime during your turn, this creature gains indestructible until end of turn. (Targeting opponents, anything they control, and/or cards in their graveyards is a crime. Damage and effects that say \"destroy\" don't destroy a creature with indestructible.)");

export const OVERZEALOUS_MUSCLE_SCRIPT: CardScript = {
  oracleId: OVERZEALOUS_MUSCLE.oracleId,
  name: OVERZEALOUS_MUSCLE.name,
  triggers: [
    {
      abilityId: 'youCommitCrime-0',
      text: PRINTED,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ctx.state.turn.activePlayer === ctx.query.controllerOf(self) &&
        (ev.t === 'CrimeCommitted' && ev.player === ctx.query.controllerOf(self)),
      label: () => "Overzealous Muscle - it pumped until end of turn",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'PtModifiedUntilEndOfTurn', card: self, power: 0, toughness: 0, keywords: ["indestructible"] }];
      },
    },
  ],
};
