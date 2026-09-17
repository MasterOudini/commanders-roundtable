// `Abomination, Irradiated Brute` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { ABOMINATION_IRRADIATED_BRUTE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(ABOMINATION_IRRADIATED_BRUTE, "Trample\nWhenever a Gamma or Villain you control deals combat damage to a player, put that many +1/+1 counters on Abomination.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put that many +1/+1 counters on ~.", ABOMINATION_IRRADIATED_BRUTE.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Put that many +1/+1 counters on ~.");

export const ABOMINATION_IRRADIATED_BRUTE_SCRIPT: CardScript = {
  oracleId: ABOMINATION_IRRADIATED_BRUTE.oracleId,
  name: ABOMINATION_IRRADIATED_BRUTE.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev, item) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.target.kind === 'player' && (item !== undefined ? d.source === item : ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self))).reduce((n, d) => n + d.amount, 0) : 0),
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && (ctx.derive(d.source).typeLine.subtypes.includes('Gamma') || ctx.derive(d.source).typeLine.subtypes.includes('Villain'))).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && (ctx.derive(d.source).typeLine.subtypes.includes('Gamma') || ctx.derive(d.source).typeLine.subtypes.includes('Villain'))),
      label: () => "Abomination, Irradiated Brute - Put that many +1/+1 counters on ~.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
