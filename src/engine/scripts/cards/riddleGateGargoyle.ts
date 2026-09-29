// `Riddle Gate Gargoyle` - a etb trigger vocab, a youAttack trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { RIDDLE_GATE_GARGOYLE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(RIDDLE_GATE_GARGOYLE, "Flying\nWhen this creature enters, you get {E}{E}{E} (three energy counters).\nWhenever you attack, you may pay {E}{E}. When you do, target creature you control gains lifelink until end of turn.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("You get {E}{E}{E}.", RIDDLE_GATE_GARGOYLE.name);
const VOCAB_T_L1 = vocabularyTargets("You get {E}{E}{E}.");
const VOCAB_L2 = vocabularyEffects("You may pay {E}{E}. When you do, target creature you control gains lifelink until end of turn.", RIDDLE_GATE_GARGOYLE.name);
const VOCAB_T_L2 = vocabularyTargets("You may pay {E}{E}. When you do, target creature you control gains lifelink until end of turn.");

export const RIDDLE_GATE_GARGOYLE_SCRIPT: CardScript = {
  oracleId: RIDDLE_GATE_GARGOYLE.oracleId,
  name: RIDDLE_GATE_GARGOYLE.name,
  triggers: [
    {
      abilityId: 'etb-1',
      text: LINES[1] as string,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' && ev.moves.some((m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield'),
      label: () => "Riddle Gate Gargoyle - You get {E}{E}{E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
    {
      abilityId: 'youAttack-2',
      text: LINES[2] as string,
      event: 'AttackersDeclared',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'AttackersDeclared' && ev.attackers.some((a) => ctx.state.cards[a.card]?.controller === ctx.query.controllerOf(self)),
      label: () => "Riddle Gate Gargoyle - You may pay {E}{E}. When you do, target creature you control gains lifelink until end of turn.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L2, VOCAB_T_L2);
      },
    },
  ],
};
