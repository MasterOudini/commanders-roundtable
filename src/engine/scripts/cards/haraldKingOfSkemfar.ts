// `Harald, King of Skemfar` - a etb trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HARALD_KING_OF_SKEMFAR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HARALD_KING_OF_SKEMFAR, "Menace (This creature can't be blocked except by two or more creatures.)\nWhen Harald enters, look at the top five cards of your library. You may reveal an Elf, Warrior, or Tyvar card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Look at the top five cards of your library. You may reveal an Elf, Warrior, or Tyvar card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.", HARALD_KING_OF_SKEMFAR.name);
const VOCAB_T_L1 = vocabularyTargets("Look at the top five cards of your library. You may reveal an Elf, Warrior, or Tyvar card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.");

export const HARALD_KING_OF_SKEMFAR_SCRIPT: CardScript = {
  oracleId: HARALD_KING_OF_SKEMFAR.oracleId,
  name: HARALD_KING_OF_SKEMFAR.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Harald, King of Skemfar - Look at the top five cards of your library. You may reveal an Elf, Warrior, or Tyvar card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
