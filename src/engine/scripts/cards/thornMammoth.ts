// `Thorn Mammoth` - a selfOrAnotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THORN_MAMMOTH } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THORN_MAMMOTH, "Trample\nWhenever this creature or another creature you control enters, this creature fights up to one target creature you don't control.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ fights up to one target creature you don't control.", THORN_MAMMOTH.name);
const VOCAB_T_L1 = vocabularyTargets("~ fights up to one target creature you don't control.");

export const THORN_MAMMOTH_SCRIPT: CardScript = {
  oracleId: THORN_MAMMOTH.oracleId,
  name: THORN_MAMMOTH.name,
  triggers: [
    {
      abilityId: 'selfOrAnotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (m.card === self || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Thorn Mammoth - ~ fights up to one target creature you don't control.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
