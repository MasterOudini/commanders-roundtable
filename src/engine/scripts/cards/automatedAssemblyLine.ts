// `Automated Assembly Line` - a creatureCombatDamagePlayer trigger vocab, an activation vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AUTOMATED_ASSEMBLY_LINE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AUTOMATED_ASSEMBLY_LINE, "Whenever one or more artifact creatures you control deal combat damage to a player, you get {E} (an energy counter).\nPay {E}{E}{E}: Create a tapped 3/3 colorless Robot artifact creature token.");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("You get {E}.", AUTOMATED_ASSEMBLY_LINE.name);
const VOCAB_T_L0 = vocabularyTargets("You get {E}.");
const VOCAB_A0 = vocabularyEffects("Create a tapped 3/3 colorless Robot artifact creature token.", AUTOMATED_ASSEMBLY_LINE.name);
const VOCAB_T_A0 = vocabularyTargets("Create a tapped 3/3 colorless Robot artifact creature token.");

export const AUTOMATED_ASSEMBLY_LINE_SCRIPT: CardScript = {
  oracleId: AUTOMATED_ASSEMBLY_LINE.oracleId,
  name: AUTOMATED_ASSEMBLY_LINE.name,
  activated: [
    {
      ref: `${AUTOMATED_ASSEMBLY_LINE.oracleId}#a0`,
      text: LINES[1] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Artifact') && ctx.derive(d.source).typeLine.types.includes('Creature')),
      label: () => "Automated Assembly Line - You get {E}.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
