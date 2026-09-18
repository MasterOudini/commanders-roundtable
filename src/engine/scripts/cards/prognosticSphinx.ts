// `Prognostic Sphinx` - an activation vocab, a attacks trigger scry
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PROGNOSTIC_SPHINX } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PROGNOSTIC_SPHINX, "Flying\nDiscard a card: This creature gains hexproof until end of turn. Tap it.\nWhenever this creature attacks, scry 3.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gains hexproof until end of turn. Tap it.", PROGNOSTIC_SPHINX.name);
const VOCAB_T_A0 = vocabularyTargets("~ gains hexproof until end of turn. Tap it.");

export const PROGNOSTIC_SPHINX_SCRIPT: CardScript = {
  oracleId: PROGNOSTIC_SPHINX.oracleId,
  name: PROGNOSTIC_SPHINX.name,
  activated: [
    {
      ref: `${PROGNOSTIC_SPHINX.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Prognostic Sphinx - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(3, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Prognostic Sphinx - scry 3" } },
        ];
      },
    },
  ],
};
