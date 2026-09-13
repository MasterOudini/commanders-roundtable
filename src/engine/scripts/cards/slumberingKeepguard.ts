// `Slumbering Keepguard` - a creatureEnters trigger scry, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SLUMBERING_KEEPGUARD } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SLUMBERING_KEEPGUARD, "Whenever an enchantment you control enters, scry 1.\n{2}{W}: This creature gets +1/+1 until end of turn for each enchantment you control.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ gets +1/+1 until end of turn for each enchantment you control.", SLUMBERING_KEEPGUARD.name);
const VOCAB_T_A0 = vocabularyTargets("~ gets +1/+1 until end of turn for each enchantment you control.");

export const SLUMBERING_KEEPGUARD_SCRIPT: CardScript = {
  oracleId: SLUMBERING_KEEPGUARD.oracleId,
  name: SLUMBERING_KEEPGUARD.name,
  activated: [
    {
      ref: `${SLUMBERING_KEEPGUARD.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureEnters-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Enchantment'),
        ),
      label: () => "Slumbering Keepguard - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(1, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Slumbering Keepguard - scry 1" } },
        ];
      },
    },
  ],
};
