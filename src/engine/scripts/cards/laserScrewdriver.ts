// `Laser Screwdriver` - an activation vocab, an activation scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { LASER_SCREWDRIVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(LASER_SCREWDRIVER, "{T}: Add one mana of any color.\n{1}, {T}: Tap target artifact.\n{2}, {T}: Surveil 1. (Look at the top card of your library. You may put that card into your graveyard.)\n{3}, {T}: Goad target creature. (Until your next turn, it attacks each combat if able and attacks a player other than you if able.)");
const LINES = PRINTED.split('\n');

const VOCAB_A1 = vocabularyEffects("Tap target artifact.", LASER_SCREWDRIVER.name);
const VOCAB_T_A1 = vocabularyTargets("Tap target artifact.");
const VOCAB_A3 = vocabularyEffects("Goad target creature.", LASER_SCREWDRIVER.name);
const VOCAB_T_A3 = vocabularyTargets("Goad target creature.");

export const LASER_SCREWDRIVER_SCRIPT: CardScript = {
  oracleId: LASER_SCREWDRIVER.oracleId,
  name: LASER_SCREWDRIVER.name,
  activated: [
    {
      ref: `${LASER_SCREWDRIVER.oracleId}#a1`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A1, VOCAB_T_A1);
      },
    },
    {
      ref: `${LASER_SCREWDRIVER.oracleId}#a2`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: true, thenDraw: 0, label: "Laser Screwdriver - surveil 1" } },
        ];
      },
    },
    {
      ref: `${LASER_SCREWDRIVER.oracleId}#a3`,
      text: LINES[3] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A3, VOCAB_T_A3);
      },
    },
  ],
};
