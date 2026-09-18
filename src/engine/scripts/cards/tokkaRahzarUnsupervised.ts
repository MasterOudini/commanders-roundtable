// `Tokka & Rahzar, Unsupervised` - a leavesBattlefield trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TOKKA_RAHZAR_UNSUPERVISED } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TOKKA_RAHZAR_UNSUPERVISED, "First strike\nWhenever another nontoken creature you control leaves the battlefield, put a +1/+1 counter on Tokka & Rahzar and create a Treasure token. This ability triggers only once each turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on ~ and create a Treasure token.", TOKKA_RAHZAR_UNSUPERVISED.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on ~ and create a Treasure token.");

export const TOKKA_RAHZAR_UNSUPERVISED_SCRIPT: CardScript = {
  oracleId: TOKKA_RAHZAR_UNSUPERVISED.oracleId,
  name: TOKKA_RAHZAR_UNSUPERVISED.name,
  triggers: [
    {
      abilityId: 'leavesBattlefield-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      oncePerTurn: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.from.kind === 'battlefield' && m.to.kind !== 'battlefield' && m.card !== self && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "Tokka & Rahzar, Unsupervised - Put a +1/+1 counter on ~ and create a Treasure token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
