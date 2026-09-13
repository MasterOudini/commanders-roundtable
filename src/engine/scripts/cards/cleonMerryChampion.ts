// `Cleon, Merry Champion` - a heroic trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { CLEON_MERRY_CHAMPION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(CLEON_MERRY_CHAMPION, "Double strike\nHeroic — Whenever you cast a spell that targets Cleon, exile the top card of your library. You may play that card until the end of your next turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Exile the top card of your library. You may play that card until the end of your next turn.", CLEON_MERRY_CHAMPION.name);
const VOCAB_T_L1 = vocabularyTargets("Exile the top card of your library. You may play that card until the end of your next turn.");

export const CLEON_MERRY_CHAMPION_SCRIPT: CardScript = {
  oracleId: CLEON_MERRY_CHAMPION.oracleId,
  name: CLEON_MERRY_CHAMPION.name,
  triggers: [
    {
      abilityId: 'heroic-1',
      text: LINES[1] as string,
      event: 'SpellCast',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'SpellCast' && ev.obj.targets.some((t) => t.kind === 'card' && t.id === self),
      label: () => "Cleon, Merry Champion - Exile the top card of your library. You may play that card until the end of your next turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
