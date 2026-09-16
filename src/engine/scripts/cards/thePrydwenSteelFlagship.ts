// `The Prydwen, Steel Flagship` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THE_PRYDWEN_STEEL_FLAGSHIP } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(THE_PRYDWEN_STEEL_FLAGSHIP, "Flying\nWhenever another nontoken artifact you control enters, create a 2/2 white Human Knight creature token with \"This token gets +2/+2 as long as an artifact entered the battlefield under your control this turn.\"\nCrew 2");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create a 2/2 white Human Knight creature token with \"This token gets +2/+2 as long as an artifact entered the battlefield under your control this turn.\"", THE_PRYDWEN_STEEL_FLAGSHIP.name);
const VOCAB_T_L1 = vocabularyTargets("Create a 2/2 white Human Knight creature token with \"This token gets +2/+2 as long as an artifact entered the battlefield under your control this turn.\"");

export const THE_PRYDWEN_STEEL_FLAGSHIP_SCRIPT: CardScript = {
  oracleId: THE_PRYDWEN_STEEL_FLAGSHIP.oracleId,
  name: THE_PRYDWEN_STEEL_FLAGSHIP.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Artifact') && !ctx.state.cards[m.card]?.isToken,
        ),
      label: () => "The Prydwen, Steel Flagship - Create a 2/2 white Human Knight creature token with \"This token gets +2/+2 as long as an artifact entered the battlefield under your control this turn.\"",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
