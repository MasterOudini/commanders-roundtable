// `Aether Theorist` - a etb trigger vocab, an activation scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AETHER_THEORIST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AETHER_THEORIST, "When this creature enters, you get {E}{E}{E} (three energy counters).\n{T}, Pay {E}: Scry 1. (Look at the top card of your library. You may put that card on the bottom.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}{E}.", AETHER_THEORIST.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}{E}.");

export const AETHER_THEORIST_SCRIPT: CardScript = {
  oracleId: AETHER_THEORIST.oracleId,
  name: AETHER_THEORIST.name,
  activated: [
    {
      ref: `${AETHER_THEORIST.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Aether Theorist - scry 1" } },
        ];
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
      label: () => "Aether Theorist - You get {E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
