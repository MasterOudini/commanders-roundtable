// `Confront the Unknown` — "Investigate, then target creature gets +1/+1
// until end of turn for each Clue you control." The NEW Clue counts: the
// pump is my current Clues (by oracle name) PLUS the one this spell just
// made. D204.

import { CONFRONT_THE_UNKNOWN } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
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

const TEXT = printed(
  CONFRONT_THE_UNKNOWN,
  'Investigate, then target creature gets +1/+1 until end of turn for each Clue you control. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const CONFRONT_THE_UNKNOWN_SCRIPT: CardScript = {
  oracleId: CONFRONT_THE_UNKNOWN.oracleId,
  name: CONFRONT_THE_UNKNOWN.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      let clues = 1; // the one Investigate is about to make
      for (const id of ctx.state.zones.battlefield) {
        const card = ctx.state.cards[id];
        if (!card || card.controller !== obj.controller) continue;
        if (ctx.derive(id).typeLine.subtypes.includes('Clue')) clues++;
      }
      const events: EventBody[] = [
        {
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        },
      ];
      const target = obj.targets[0];
      if (target && target.kind === 'card' && ctx.state.cards[target.id]?.zone.kind === 'battlefield') {
        events.push({
          t: 'PtModifiedUntilEndOfTurn',
          card: target.id,
          power: clues,
          toughness: clues,
        });
      }
      return events;
    },
  },
};
