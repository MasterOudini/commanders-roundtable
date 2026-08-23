// `Thoughtweft Gambit` — Metal Fatigue's board tap composed with Mobilize's
// untap sweep, in ONE resolve and in the printed order: theirs go down, mine
// come up. Two separate events, because tapping and untapping are two
// reducer verbs. D259.

import { THOUGHTWEFT_GAMBIT } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId } from '../../types/ids';

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

const TEXT = printed(
  THOUGHTWEFT_GAMBIT,
  'Tap all creatures your opponents control and untap all creatures you control.',
);

export const THOUGHTWEFT_GAMBIT_SCRIPT: CardScript = {
  oracleId: THOUGHTWEFT_GAMBIT.oracleId,
  name: THOUGHTWEFT_GAMBIT.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const toTap: InstanceId[] = [];
      const toUntap: InstanceId[] = [];
      for (const id of ctx.state.zones.battlefield) {
        const inst = ctx.state.cards[id];
        if (!inst) continue;
        if (!ctx.derive(id).typeLine.types.includes('Creature')) continue;
        if (inst.controller === obj.controller) {
          if (inst.tapped) toUntap.push(id);
        } else if (!inst.tapped) {
          toTap.push(id);
        }
      }
      const events: EventBody[] = [];
      if (toTap.length > 0) events.push({ t: 'PermanentsTapped', cards: toTap });
      if (toUntap.length > 0) events.push({ t: 'PermanentsUntapped', cards: toUntap });
      return events;
    },
  },
};
