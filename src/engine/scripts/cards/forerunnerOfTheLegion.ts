// `Forerunner of the Legion` - a etb trigger vocab, a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { FORERUNNER_OF_THE_LEGION } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(FORERUNNER_OF_THE_LEGION, "When this creature enters, you may search your library for a Vampire card, reveal it, then shuffle and put that card on top.\nWhenever another Vampire you control enters, target creature gets +1/+1 until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Search your library for a Vampire card, reveal it, then shuffle and put that card on top.", FORERUNNER_OF_THE_LEGION.name);
const VOCAB_T_L0 = vocabularyTargets("Search your library for a Vampire card, reveal it, then shuffle and put that card on top.");
const VOCAB_L1 = vocabularyEffects("Target creature gets +1/+1 until end of turn.", FORERUNNER_OF_THE_LEGION.name);
const VOCAB_T_L1 = vocabularyTargets("Target creature gets +1/+1 until end of turn.");

export const FORERUNNER_OF_THE_LEGION_SCRIPT: CardScript = {
  oracleId: FORERUNNER_OF_THE_LEGION.oracleId,
  name: FORERUNNER_OF_THE_LEGION.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Forerunner of the Legion - Search your library for a Vampire card, reveal it, then shuffle and put that card on top.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.subtypes.includes('Vampire'),
        ),
      label: () => "Forerunner of the Legion - Target creature gets +1/+1 until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
