// `Smelted Chargebug` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { SMELTED_CHARGEBUG } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(SMELTED_CHARGEBUG, "Menace\nWhen this creature enters, you get {E}{E} (two energy counters).\nWhenever this creature attacks, you may pay {E}. If you do, another target attacking creature gets +1/+0 and gains menace until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You get {E}{E}.", SMELTED_CHARGEBUG.name);
const VOCAB_T_L1 = vocabularyTargets("You get {E}{E}.");
const VOCAB_L2 = vocabularyEffects("You may pay {E}. If you do, another target attacking creature gets +1/+0 and gains menace until end of turn.", SMELTED_CHARGEBUG.name);
const VOCAB_T_L2 = vocabularyTargets("You may pay {E}. If you do, another target attacking creature gets +1/+0 and gains menace until end of turn.");

export const SMELTED_CHARGEBUG_SCRIPT: CardScript = {
  oracleId: SMELTED_CHARGEBUG.oracleId,
  name: SMELTED_CHARGEBUG.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Smelted Chargebug - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'attacks-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      targets: VOCAB_T_L2,
      matches: (_ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => a.card === self),
      label: () => "Smelted Chargebug - You may pay {E}. If you do, another target attacking creature gets +1/+0 and gains menace until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
