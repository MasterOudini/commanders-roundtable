// `Tainted Observer` - a anotherCreatureEnters trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { TAINTED_OBSERVER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(TAINTED_OBSERVER, "Flying\nToxic 1 (Players dealt combat damage by this creature also get a poison counter.)\nWhenever another creature you control enters, you may pay {2}. If you do, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L2 = vocabularyEffects("You may pay {2}. If you do, proliferate.", TAINTED_OBSERVER.name);
const VOCAB_T_L2 = vocabularyTargets("You may pay {2}. If you do, proliferate.");

export const TAINTED_OBSERVER_SCRIPT: CardScript = {
  oracleId: TAINTED_OBSERVER.oracleId,
  name: TAINTED_OBSERVER.name,
  triggers: [
    {
      abilityId: 'anotherCreatureEnters-2',
      text: LINES[2] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Tainted Observer - You may pay {2}. If you do, proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
