// `Biblioplex Kraken` - a etb trigger scry, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { BIBLIOPLEX_KRAKEN } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(BIBLIOPLEX_KRAKEN, "When this creature enters, scry 3. (Look at the top three cards of your library, then put any number of them on the bottom and the rest on top in any order.)\nWhenever this creature attacks, you may return another creature you control to its owner's hand. If you do, this creature can't be blocked this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You may return another creature you control to its owner's hand. If you do, this creature can't be blocked this turn.", BIBLIOPLEX_KRAKEN.name);
const VOCAB_T_L1 = vocabularyTargets("You may return another creature you control to its owner's hand. If you do, this creature can't be blocked this turn.");

export const BIBLIOPLEX_KRAKEN_SCRIPT: CardScript = {
  oracleId: BIBLIOPLEX_KRAKEN.oracleId,
  name: BIBLIOPLEX_KRAKEN.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Biblioplex Kraken - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(3, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Biblioplex Kraken - scry 3" } },
        ];
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Biblioplex Kraken - You may return another creature you control to its owner's hand. If you do, this creature can't be blocked this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
