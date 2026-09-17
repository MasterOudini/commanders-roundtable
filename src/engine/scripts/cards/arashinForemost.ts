// `Arashin Foremost` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ARASHIN_FOREMOST } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ARASHIN_FOREMOST, "Double strike\nWhenever this creature enters or attacks, another target Warrior creature you control gains double strike until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Another target Warrior creature you control gains double strike until end of turn.", ARASHIN_FOREMOST.name);
const VOCAB_T_L1 = vocabularyTargets("Another target Warrior creature you control gains double strike until end of turn.");

export const ARASHIN_FOREMOST_SCRIPT: CardScript = {
  oracleId: ARASHIN_FOREMOST.oracleId,
  name: ARASHIN_FOREMOST.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Arashin Foremost - Another target Warrior creature you control gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'attacks-1',
      text: LINES[1] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L1,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Arashin Foremost - Another target Warrior creature you control gains double strike until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
