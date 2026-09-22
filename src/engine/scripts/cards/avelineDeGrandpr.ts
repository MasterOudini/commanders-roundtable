// `Aveline de Grandpré` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { AVELINE_DE_GRANDPR } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(AVELINE_DE_GRANDPR, "Deathtouch\nWhenever a creature you control with deathtouch deals combat damage to a player, put that many +1/+1 counters on that creature.\nDisguise {B}{G} (You may cast this card face down for {3} as a 2/2 creature with ward {2}. Turn it face up any time for its disguise cost.)");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put that many +1/+1 counters on target creature.", AVELINE_DE_GRANDPR.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Put that many +1/+1 counters on target creature.");

export const AVELINE_DE_GRANDPR_SCRIPT: CardScript = {
  oracleId: AVELINE_DE_GRANDPR.oracleId,
  name: AVELINE_DE_GRANDPR.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev, item) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.target.kind === 'player' && (item !== undefined ? d.source === item : ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self))).reduce((n, d) => n + d.amount, 0) : 0),
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && ctx.derive(d.source).keywords.has('deathtouch')).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && ctx.derive(d.source).keywords.has('deathtouch')),
      label: () => "Aveline de Grandpré - Put that many +1/+1 counters on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
