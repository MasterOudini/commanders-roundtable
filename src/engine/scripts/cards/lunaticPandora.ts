// `Lunatic Pandora` - an activation scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LUNATIC_PANDORA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LUNATIC_PANDORA, "{2}, {T}: Surveil 1. (Look at the top card of your library. You may put it into your graveyard.)\n{6}, {T}, Sacrifice Lunatic Pandora: Destroy target nonland permanent.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Destroy target nonland permanent.", LUNATIC_PANDORA.name);
const VOCAB_T_A1 = vocabularyTargets("Destroy target nonland permanent.");

export const LUNATIC_PANDORA_SCRIPT: CardScript = {
  oracleId: LUNATIC_PANDORA.oracleId,
  name: LUNATIC_PANDORA.name,
  activated: [
    {
      ref: `${LUNATIC_PANDORA.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Lunatic Pandora - surveil 1" } },
        ];
      },
    },
    {
      ref: `${LUNATIC_PANDORA.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
  ],
};
