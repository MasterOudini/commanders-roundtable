// `Thraben Sentry // Thraben Militia` - a anotherCreatureDies trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { THRABEN_SENTRY_THRABEN_MILITIA } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { transformFrom, vocabularyEffects, vocabularyTargets } from '../vocabulary';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';

function printed(card: CardData, expected: string): string {
  const actual = card.faces.map((f) => f.oracleText ?? '').join('\n');
  if (actual !== expected) {
    throw new Error(
      `${card.name} reads "${actual}" and its script was written for "${expected}". ` +
        'Re-read the card before re-registering it (D90).',
    );
  }
  return expected;
}

const PRINTED = printed(THRABEN_SENTRY_THRABEN_MILITIA, "Vigilance\nWhenever another creature you control dies, you may transform this creature.\nTrample");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = transformFrom(vocabularyEffects("Transform this creature.", THRABEN_SENTRY_THRABEN_MILITIA.name), 0);
const VOCAB_T_L1 = vocabularyTargets("Transform this creature.");

export const THRABEN_SENTRY_THRABEN_MILITIA_SCRIPT: CardScript = {
  oracleId: THRABEN_SENTRY_THRABEN_MILITIA.oracleId,
  name: THRABEN_SENTRY_THRABEN_MILITIA.name,
  triggers: [
    {
      abilityId: 'anotherCreatureDies-1', face: 0,
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: true,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card !== self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Creature'),
        ),
      label: () => "Thraben Sentry // Thraben Militia - Transform this creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
