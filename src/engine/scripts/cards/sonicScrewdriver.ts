// `Sonic Screwdriver` - an activation vocab, an activation scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SONIC_SCREWDRIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SONIC_SCREWDRIVER, "{T}: Add one mana of any color.\n{1}, {T}: Untap another target artifact.\n{2}, {T}: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)\n{3}, {T}: Target creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Untap another target artifact.", SONIC_SCREWDRIVER.name);
const VOCAB_T_A1 = vocabularyTargets("Untap another target artifact.");
const VOCAB_A3 = vocabularyEffects("Target creature can't be blocked this turn.", SONIC_SCREWDRIVER.name);
const VOCAB_T_A3 = vocabularyTargets("Target creature can't be blocked this turn.");

export const SONIC_SCREWDRIVER_SCRIPT: CardScript = {
  oracleId: SONIC_SCREWDRIVER.oracleId,
  name: SONIC_SCREWDRIVER.name,
  activated: [
    {
      ref: `${SONIC_SCREWDRIVER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${SONIC_SCREWDRIVER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Sonic Screwdriver - scry 1" } },
        ];
      },
    },
    {
      ref: `${SONIC_SCREWDRIVER.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A3, VOCAB_T_A3);
      },
    },
  ],
};
