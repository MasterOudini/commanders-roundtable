// `Hopeless Nightmare` - a etb trigger vocab, a auraToGraveyard trigger scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { HOPELESS_NIGHTMARE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(HOPELESS_NIGHTMARE, "When this enchantment enters, each opponent discards a card and loses 2 life.\nWhen this enchantment is put into a graveyard from the battlefield, scry 2.\n{2}{B}: Sacrifice this enchantment.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Each opponent discards a card and loses 2 life.", HOPELESS_NIGHTMARE.name);
const VOCAB_T_L0 = vocabularyTargets("Each opponent discards a card and loses 2 life.");
const VOCAB_A0 = vocabularyEffects("Sacrifice this enchantment.", HOPELESS_NIGHTMARE.name);
const VOCAB_T_A0 = vocabularyTargets("Sacrifice this enchantment.");

export const HOPELESS_NIGHTMARE_SCRIPT: CardScript = {
  oracleId: HOPELESS_NIGHTMARE.oracleId,
  name: HOPELESS_NIGHTMARE.name,
  activated: [
    {
      ref: `${HOPELESS_NIGHTMARE.oracleId}#a0`,
      text: LINES[2] as string,
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
      label: () => "Hopeless Nightmare - Each opponent discards a card and loses 2 life.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'auraToGraveyard-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (_ctx, self, ev) => ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard'),
      label: () => "Hopeless Nightmare - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Hopeless Nightmare - scry 2" } },
        ];
      },
    },
  ],
};
