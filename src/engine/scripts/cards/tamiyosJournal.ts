// `Tamiyo's Journal` - a upkeep trigger token, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAMIYO_S_JOURNAL } from '../../../data/fixtures/engineCards';
import { TOKEN_TABLE, type TokenRef } from '../../../data/tokenTable';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

function tokenRef(key: string): TokenRef {
  const ref = TOKEN_TABLE[key];
  if (!ref) throw new Error(`TOKEN_TABLE lost "${key}" - re-check before re-registering (D90).`);
  return ref;
}

const PRINTED = printed(TAMIYO_S_JOURNAL, "At the beginning of your upkeep, investigate. (Create a Clue token. It's an artifact with \"{2}, Sacrifice this token: Draw a card.\")\n{T}, Sacrifice three Clues: Search your library for a card, put that card into your hand, then shuffle.");
const LINES = PRINTED.split('\n');
const TOKEN_L0 = tokenRef("Clue|/||Artifact|");

const VOCAB_A0 = vocabularyEffects("Search your library for a card, put that card into your hand, then shuffle.", TAMIYO_S_JOURNAL.name);
const VOCAB_T_A0 = vocabularyTargets("Search your library for a card, put that card into your hand, then shuffle.");

export const TAMIYOS_JOURNAL_SCRIPT: CardScript = {
  oracleId: TAMIYO_S_JOURNAL.oracleId,
  name: TAMIYO_S_JOURNAL.name,
  activated: [
    {
      ref: `${TAMIYO_S_JOURNAL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'upkeep-0',
      text: LINES[0] as string,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Tamiyo's Journal - token",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return Array.from({ length: 1 }, () => ({
          t: 'TokenCreated' as const,
          card: ctx.ids.nextInstance(),
          oracleId: TOKEN_L0.oracleId,
          printingId: TOKEN_L0.printingId,
          controller: obj.controller,
          owner: obj.controller,
          turnNumber: ctx.state.turn.turnNumber,
        }));
      },
    },
  ],
};
