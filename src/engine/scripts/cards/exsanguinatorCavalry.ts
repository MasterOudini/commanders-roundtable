// `Exsanguinator Cavalry` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { EXSANGUINATOR_CAVALRY } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(EXSANGUINATOR_CAVALRY, "Menace, lifelink\nWhenever a Knight you control deals combat damage to a player, put a +1/+1 counter on that creature and create a Blood token. (It's an artifact with \"{1}, {T}, Discard a card, Sacrifice this token: Draw a card.\")");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature and create a Blood token.", EXSANGUINATOR_CAVALRY.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature and create a Blood token.");

export const EXSANGUINATOR_CAVALRY_SCRIPT: CardScript = {
  oracleId: EXSANGUINATOR_CAVALRY.oracleId,
  name: EXSANGUINATOR_CAVALRY.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Knight')).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.subtypes.includes('Knight')),
      label: () => "Exsanguinator Cavalry - Put a +1/+1 counter on target creature and create a Blood token.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
