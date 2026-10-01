// `Skyclave Squid` - a landfall trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SKYCLAVE_SQUID } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SKYCLAVE_SQUID, "Defender\nLandfall — Whenever a land you control enters, this creature can attack this turn as though it didn't have defender.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("~ can attack this turn as though it didn't have defender.", SKYCLAVE_SQUID.name);
const VOCAB_T_L1 = vocabularyTargets("~ can attack this turn as though it didn't have defender.");

export const SKYCLAVE_SQUID_SCRIPT: CardScript = {
  oracleId: SKYCLAVE_SQUID.oracleId,
  name: SKYCLAVE_SQUID.name,
  triggers: [
    {
      abilityId: 'landfall-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.to.kind === 'battlefield' && m.from.kind !== 'battlefield' && ctx.state.cards[m.card]?.controller === ctx.query.controllerOf(self) && ctx.derive(m.card).typeLine.types.includes('Land'),
        ),
      label: () => "Skyclave Squid - ~ can attack this turn as though it didn't have defender.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
