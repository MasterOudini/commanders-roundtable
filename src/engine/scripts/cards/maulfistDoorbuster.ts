// `Maulfist Doorbuster` - a etb trigger vocab, a attacks trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { MAULFIST_DOORBUSTER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(MAULFIST_DOORBUSTER, "When this creature enters, you get {E}{E} (two energy counters).\nWhenever this creature attacks, you may pay {E}. If you do, target creature can't block this turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}{E}.", MAULFIST_DOORBUSTER.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}{E}.");
const VOCAB_L1 = vocabularyEffects("You may pay {E}. If you do, target creature can't block this turn.", MAULFIST_DOORBUSTER.name);
const VOCAB_T_L1 = vocabularyTargets("You may pay {E}. If you do, target creature can't block this turn.");

export const MAULFIST_DOORBUSTER_SCRIPT: CardScript = {
  oracleId: MAULFIST_DOORBUSTER.oracleId,
  name: MAULFIST_DOORBUSTER.name,
  triggers: [
    {
      abilityId: 'etb-0',
      text: LINES[0] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Maulfist Doorbuster - You get {E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
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
      label: () => "Maulfist Doorbuster - You may pay {E}. If you do, target creature can't block this turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
