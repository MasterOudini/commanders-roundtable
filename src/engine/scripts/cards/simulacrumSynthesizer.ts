// `Simulacrum Synthesizer` - a etb trigger scry, a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SIMULACRUM_SYNTHESIZER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SIMULACRUM_SYNTHESIZER, "When this artifact enters, scry 2.\nWhenever another artifact you control with mana value 3 or greater enters, create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"", SIMULACRUM_SYNTHESIZER.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"");

export const SIMULACRUM_SYNTHESIZER_SCRIPT: CardScript = {
  oracleId: SIMULACRUM_SYNTHESIZER.oracleId,
  name: SIMULACRUM_SYNTHESIZER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Simulacrum Synthesizer - scry",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const library = ctx.state.zones.library[obj.controller] ?? [];
        const n = Math.min(2, library.length);
        if (n === 0) return [];
        const top = library.slice(library.length - n);
        return [
          { t: 'CardsRevealed', cards: top, to: [obj.controller] },
          { t: 'AwaitingSet', awaiting: { kind: 'scryChoice', player: obj.controller, count: n, toGraveyard: false, thenDraw: 0, label: "Simulacrum Synthesizer - scry 2" } },
        ];
      },
    },
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact') && (ctx.derive(m.card).manaValue ?? 0) >= 3,
        ),
      label: () => "Simulacrum Synthesizer - Create a 0/0 colorless Construct artifact creature token with \"This token gets +1/+1 for each artifact you control.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
