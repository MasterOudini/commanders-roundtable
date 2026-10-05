// `Patrolling Peacemaker` - a static entersWithCounters, a opponentCommitsCrime trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { PATROLLING_PEACEMAKER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(PATROLLING_PEACEMAKER, "This creature enters with two +1/+1 counters on it.\nWhenever an opponent commits a crime, proliferate. (They commit a crime if they target an opponent, anything an opponent controls, and/or cards in an opponent's graveyard. To proliferate, you choose any number of permanents and/or players, then give each another counter of each kind already there.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Proliferate.", PATROLLING_PEACEMAKER.name);
const VOCAB_T_L1 = vocabularyTargets("Proliferate.");

export const PATROLLING_PEACEMAKER_SCRIPT: CardScript = {
  oracleId: PATROLLING_PEACEMAKER.oracleId,
  name: PATROLLING_PEACEMAKER.name,
  triggers: [
    {
      abilityId: 'opponentCommitsCrime-1',
      text: LINES[1] as string,
      event: 'CrimeCommitted',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'CrimeCommitted' && ev.player !== ctx.query.controllerOf(self),
      label: () => "Patrolling Peacemaker - Proliferate.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
  replacements: [
    {
      abilityId: 'enters-with-0',
      text: LINES[0] as string,
      activeZones: ['battlefield'],
      // CR 614.12 - offered to the entering card itself (D371).
      applies: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      replace: (_ctx, self, ev): readonly EventBody[] => [ev, { t: 'CountersChanged', changes: [{ card: self, kind: "+1/+1", delta: 2 }] }],
    },
  ],
};
