// `Fateful Absence` — "Destroy target creature or planeswalker. Its
// controller investigates." The Clue goes to the VICTIM's controller
// (Declaration in Stone's idiom), destroyed or not — the rider names the
// controller, not the destruction. D212.

import { FATEFUL_ABSENCE } from '../../../data/fixtures/engineCards';
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
  FATEFUL_ABSENCE,
  'Destroy target creature or planeswalker. Its controller investigates. (Create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const FATEFUL_ABSENCE_SCRIPT: CardScript = {
  oracleId: FATEFUL_ABSENCE.oracleId,
  name: FATEFUL_ABSENCE.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'card') return [];
      const card = ctx.state.cards[target.id];
      if (!card || card.zone.kind !== 'battlefield') return [];
      const controller = card.controller;
      const events: EventBody[] = [];
      if (!ctx.derive(target.id).keywords.has('indestructible')) {
        events.push({
          t: 'CardsMoved',
          moves: [
            {
              card: target.id,
              from: { kind: 'battlefield', player: card.controller },
              to: { kind: 'graveyard', player: card.owner },
            },
          ],
        });
      }
      if (!ctx.state.players[controller]?.hasLost) {
        events.push({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller,
          owner: controller,
          turnNumber: ctx.state.turn.turnNumber,
        });
      }
      return events;
    },
  },
};
