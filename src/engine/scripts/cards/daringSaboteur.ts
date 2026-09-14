// `Daring Saboteur` - an activation vocab, a combatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { DARING_SABOTEUR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(DARING_SABOTEUR, "{2}{U}: This creature can't be blocked this turn.\nWhenever this creature deals combat damage to a player, you may draw a card. If you do, discard a card.");
const LINES = PRINTED.split('\n');

const VOCAB_A0 = vocabularyEffects("~ can't be blocked this turn.", DARING_SABOTEUR.name);
const VOCAB_T_A0 = vocabularyTargets("~ can't be blocked this turn.");
const VOCAB_L1 = vocabularyEffects("Draw a card. If you do, discard a card.", DARING_SABOTEUR.name);
const VOCAB_T_L1 = vocabularyTargets("Draw a card. If you do, discard a card.");

export const DARING_SABOTEUR_SCRIPT: CardScript = {
  oracleId: DARING_SABOTEUR.oracleId,
  name: DARING_SABOTEUR.name,
  activated: [
    {
      ref: `${DARING_SABOTEUR.oracleId}#a0`,
      text: LINES[0] as string,
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_A0, VOCAB_T_A0);
      },
    },
  ],
  triggers: [
    {
      abilityId: 'combatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: true,
      matches: (_ctx, self, ev) => ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Daring Saboteur - Draw a card. If you do, discard a card.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
