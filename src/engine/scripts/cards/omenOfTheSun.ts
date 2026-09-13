// `Omen of the Sun` - a etb trigger vocab, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OMEN_OF_THE_SUN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OMEN_OF_THE_SUN, "Flash\nWhen this enchantment enters, create two 1/1 white Human Soldier creature tokens and you gain 2 life.\n{2}{W}, Sacrifice this enchantment: Scry 2.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create two 1/1 white Human Soldier creature tokens and you gain 2 life.", OMEN_OF_THE_SUN.name);
const VOCAB_T_L1 = vocabularyTargets("Create two 1/1 white Human Soldier creature tokens and you gain 2 life.");

export const OMEN_OF_THE_SUN_SCRIPT: CardScript = {
  oracleId: OMEN_OF_THE_SUN.oracleId,
  name: OMEN_OF_THE_SUN.name,
  activated: [
    {
      ref: `${OMEN_OF_THE_SUN.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Omen of the Sun - scry 2" } },
        ];
      },
    },
  ],
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Omen of the Sun - Create two 1/1 white Human Soldier creature tokens and you gain 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
