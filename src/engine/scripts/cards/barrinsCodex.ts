// `Barrin's Codex` - a upkeep trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BARRIN_S_CODEX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BARRIN_S_CODEX, "At the beginning of your upkeep, you may put a page counter on this artifact.\n{4}, {T}, Sacrifice this artifact: Draw X cards, where X is the number of page counters on this artifact.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Put a page counter on this artifact.", BARRIN_S_CODEX.name);
const VOCAB_T_L0 = vocabularyTargets("Put a page counter on this artifact.");
const VOCAB_A0 = vocabularyEffects("Draw X cards, where X is the number of page counters on ~.", BARRIN_S_CODEX.name);
const VOCAB_T_A0 = vocabularyTargets("Draw X cards, where X is the number of page counters on ~.");

export const BARRINS_CODEX_SCRIPT: CardScript = {
  oracleId: BARRIN_S_CODEX.oracleId,
  name: BARRIN_S_CODEX.name,
  activated: [
    {
      ref: `${BARRIN_S_CODEX.oracleId}#a0`,
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
      optional: true,
      matches: (ctx, self, ev) => ev.t === 'StepBegan' && ev.step === 'upkeep' && ctx.state.turn.activePlayer === ctx.query.controllerOf(self),
      label: () => "Barrin's Codex - Put a page counter on this artifact.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
