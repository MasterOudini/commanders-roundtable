// `Mardu Monument` - a etb trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MARDU_MONUMENT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MARDU_MONUMENT, "When this artifact enters, search your library for a basic Mountain, Plains, or Swamp card, reveal it, put it into your hand, then shuffle.\n{2}{R}{W}{B}, {T}, Sacrifice this artifact: Create three 1/1 red Warrior creature tokens. They gain menace and haste until end of turn. Activate only as a sorcery. (A creature with menace can't be blocked except by two or more creatures.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a basic Mountain, Plains, or Swamp card, reveal it, put it into your hand, then shuffle.", MARDU_MONUMENT.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a basic Mountain, Plains, or Swamp card, reveal it, put it into your hand, then shuffle.");
const VOCAB_A0 = vocabularyEffects("Create three 1/1 red Warrior creature tokens. They gain menace and haste until end of turn.", MARDU_MONUMENT.name);
const VOCAB_T_A0 = vocabularyTargets("Create three 1/1 red Warrior creature tokens. They gain menace and haste until end of turn.");

export const MARDU_MONUMENT_SCRIPT: CardScript = {
  oracleId: MARDU_MONUMENT.oracleId,
  name: MARDU_MONUMENT.name,
  activated: [
    {
      ref: `${MARDU_MONUMENT.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Mardu Monument - Search your library for a basic Mountain, Plains, or Swamp card, reveal it, put it into your hand, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
