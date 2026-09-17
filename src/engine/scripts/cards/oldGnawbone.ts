// `Old Gnawbone` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { OLD_GNAWBONE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(OLD_GNAWBONE, "Flying\nWhenever a creature you control deals combat damage to a player, create that many Treasure tokens.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Create that many Treasure tokens.", OLD_GNAWBONE.name, { memo: true });
const VOCAB_T_L1 = vocabularyTargets("Create that many Treasure tokens.");

export const OLD_GNAWBONE_SCRIPT: CardScript = {
  oracleId: OLD_GNAWBONE.oracleId,
  name: OLD_GNAWBONE.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev, item) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.target.kind === 'player' && (item !== undefined ? d.source === item : ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self))).reduce((n, d) => n + d.amount, 0) : 0),
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)),
      label: () => "Old Gnawbone - Create that many Treasure tokens.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
