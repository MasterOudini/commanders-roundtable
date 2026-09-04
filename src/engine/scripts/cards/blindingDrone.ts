// `Blinding Drone` - an activation tapTarget
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BLINDING_DRONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BLINDING_DRONE, "Devoid (This card has no color.)\n{C}, {T}: Tap target creature. ({C} represents colorless mana.)");
const LINES = PRINTED.split('\n');

export const BLINDING_DRONE_SCRIPT: CardScript = {
  oracleId: BLINDING_DRONE.oracleId,
  name: BLINDING_DRONE.name,
  activated: [
    {
      ref: `${BLINDING_DRONE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
        return [{ t: 'PermanentsTapped', cards: [target.id] }];
      },
    },
  ],
};
