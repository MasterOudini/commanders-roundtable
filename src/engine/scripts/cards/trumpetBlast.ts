// `Trumpet Blast` — attacking creatures get +2/+0 (Marrow Shards D223,
// Sandstorm D243's predicate). Any controller's attackers, which is the
// whole card: cast in somebody else's combat it pumps THEIRS. D262.

import { TRUMPET_BLAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(TRUMPET_BLAST, 'Attacking creatures get +2/+0 until end of turn.');

export const TRUMPET_BLAST_SCRIPT: CardScript = {
  oracleId: TRUMPET_BLAST.oracleId,
  name: TRUMPET_BLAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx): readonly EventBody[] => {
      const events: EventBody[] = [];
      for (const decl of ctx.state.combat?.attackers ?? []) {
        if (ctx.state.cards[decl.card]?.zone.kind !== 'battlefield') continue;
        events.push({ t: 'PtModifiedUntilEndOfTurn', card: decl.card, power: 2, toughness: 0 });
      }
      return events;
    },
  },
};
