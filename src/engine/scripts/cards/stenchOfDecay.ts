// `Stench of Decay` — the negated-type board debuff: every NONARTIFACT
// creature shrinks, artifact creatures are exempt. D253.

import { STENCH_OF_DECAY } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(STENCH_OF_DECAY, 'Nonartifact creatures get -1/-1 until end of turn.');

export const STENCH_OF_DECAY_SCRIPT: CardScript = {
  oracleId: STENCH_OF_DECAY.oracleId,
  name: STENCH_OF_DECAY.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, _obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const id of ctx.state.zones.battlefield) {
        if (!ctx.state.cards[id]) continue;
        const d = ctx.derive(id);
        if (!d.typeLine.types.includes('Creature')) continue;
        if (d.typeLine.types.includes('Artifact')) continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: id, power: -1, toughness: -1 });
      }
      return events;
    },
  },
};
