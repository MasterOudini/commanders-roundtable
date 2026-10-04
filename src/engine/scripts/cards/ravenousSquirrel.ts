// `Ravenous Squirrel` - a youSacrifice trigger selfCounter, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RAVENOUS_SQUIRREL } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RAVENOUS_SQUIRREL, "Whenever you sacrifice an artifact or creature, put a +1/+1 counter on this creature.\n{1}{B}{G}, Sacrifice an artifact or creature: You gain 1 life and draw a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("You gain 1 life and draw a card.", RAVENOUS_SQUIRREL.name);
const VOCAB_T_A0 = vocabularyTargets("You gain 1 life and draw a card.");

export const RAVENOUS_SQUIRREL_SCRIPT: CardScript = {
  oracleId: RAVENOUS_SQUIRREL.oracleId,
  name: RAVENOUS_SQUIRREL.name,
  activated: [
    {
      ref: `${RAVENOUS_SQUIRREL.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'youSacrifice-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.reason === 'sacrifice' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && (ctx.derive(m.card).typeLine.types.includes('Artifact') || ctx.derive(m.card).typeLine.types.includes('Creature')),
        ),
      label: () => "Ravenous Squirrel - a counter on it",
      resolve: (ctx, self, _obj): readonly EventBody[] => {
        const me = ctx.state.cards[self];
        if (!me || me.zone.kind !== 'battlefield') return [];
        return [{ t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 1 }] }];
      },
    },
  ],
};
