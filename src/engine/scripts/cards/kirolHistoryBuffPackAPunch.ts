// `Kirol, History Buff // Pack a Punch` - a cardLeavesYourGraveyard trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { KIROL_HISTORY_BUFF_PACK_A_PUNCH } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { vocabularyEffects, vocabularyTargets } from '../vocabulary';
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

const PRINTED = printed(KIROL_HISTORY_BUFF_PACK_A_PUNCH, "Whenever one or more cards leave your graveyard, Kirol becomes prepared. (While it's prepared, you may cast a copy of its spell. Doing so unprepares it.)\nMill a card. Put two +1/+1 counters on target creature. It gains trample until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("~ becomes prepared.", KIROL_HISTORY_BUFF_PACK_A_PUNCH.name);
const VOCAB_T_L0 = vocabularyTargets("~ becomes prepared.");

export const KIROL_HISTORY_BUFF_PACK_APUNCH_SCRIPT: CardScript = {
  oracleId: KIROL_HISTORY_BUFF_PACK_A_PUNCH.oracleId,
  name: KIROL_HISTORY_BUFF_PACK_A_PUNCH.name,
  triggers: [
    {
      abilityId: 'cardLeavesYourGraveyard-0', face: 0,
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.from.kind === 'graveyard' && m.from.player === ctx.query.controllerOf(self)),
      label: () => "Kirol, History Buff // Pack a Punch - ~ becomes prepared.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
