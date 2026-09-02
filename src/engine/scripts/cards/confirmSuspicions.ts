// `Confirm Suspicions` — "Counter target spell.\nInvestigate three times.
// (reminder)" Daring Apprentice's counter pair (D170) from a SPELL, then
// three Clues (Auspicious Arrival's investigate, D2xx). A departed target
// has already fizzled the whole spell (CR 608.2b), so the Clues never come
// without the counter — which is the card's own rule. D273.

import { CONFIRM_SUSPICIONS } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import { moveFromStack } from '../../effects';
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
  CONFIRM_SUSPICIONS,
  'Counter target spell.\nInvestigate three times. (To investigate, create a Clue token. It\'s an artifact with "{2}, Sacrifice this token: Draw a card.")',
);

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" — re-check before re-registering (D90).`);
  return ref;
}

const CLUE = tokenRef('Clue|/||Artifact|');

export const CONFIRM_SUSPICIONS_SCRIPT: CardScript = {
  oracleId: CONFIRM_SUSPICIONS.oracleId,
  name: CONFIRM_SUSPICIONS.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const target = obj.targets[0];
      if (!target || target.kind !== 'stack') return [];
      const spell = ctx.state.stack.find((o) => o.id === target.id);
      if (!spell || spell.kind !== 'spell') return [];
      const events: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
      if (spell.card) {
        const vc = ctx.state.cards[spell.card];
        if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner));
      }
      for (let i = 0; i < 3; i += 1) {
        events.push({
          t: 'TokenCreated',
          card: ctx.ids.nextInstance(),
          oracleId: CLUE.oracleId,
          printingId: CLUE.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        });
      }
      return events;
    },
  },
};
