// `Omen of the Hunt` - a etb trigger vocab, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OMEN_OF_THE_HUNT } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OMEN_OF_THE_HUNT, "Flash\nWhen this enchantment enters, you may search your library for a basic land card, put it onto the battlefield tapped, then shuffle.\n{2}{G}, Sacrifice this enchantment: Scry 2.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", OMEN_OF_THE_HUNT.name);
const VOCAB_T_L1 = vocabularyTargets("Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.");

export const OMEN_OF_THE_HUNT_SCRIPT: CardScript = {
  oracleId: OMEN_OF_THE_HUNT.oracleId,
  name: OMEN_OF_THE_HUNT.name,
  activated: [
    {
      ref: `${OMEN_OF_THE_HUNT.oracleId}#a0`,
      text: LINES[2] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Omen of the Hunt - scry 2" } },
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
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Omen of the Hunt - Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
