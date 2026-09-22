// `White Widow, Yelena Belova` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { WHITE_WIDOW_YELENA_BELOVA } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(WHITE_WIDOW_YELENA_BELOVA, "Deathtouch\nWhenever a creature you control with deathtouch deals combat damage to a player, put a +1/+1 counter on it.");
const LINES = PRINTED.split('\n');

const VOCAB_L1 = vocabularyEffects("Put a +1/+1 counter on target creature.", WHITE_WIDOW_YELENA_BELOVA.name);
const VOCAB_T_L1 = vocabularyTargets("Put a +1/+1 counter on target creature.");

export const WHITE_WIDOW_YELENA_BELOVA_SCRIPT: CardScript = {
  oracleId: WHITE_WIDOW_YELENA_BELOVA.oracleId,
  name: WHITE_WIDOW_YELENA_BELOVA.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-1',
      text: LINES[1] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      perItem: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' ? [...new Set(ev.damages.filter((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && ctx.derive(d.source).keywords.has('deathtouch')).map((d) => d.source))] : [],
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' &&
        ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self) && ctx.derive(d.source).typeLine.types.includes('Creature') && ctx.derive(d.source).keywords.has('deathtouch')),
      label: () => "White Widow, Yelena Belova - Put a +1/+1 counter on target creature.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        if (obj.item === undefined) return [];
        return ctx.vocabulary({ ...obj, targets: [{ kind: 'card', id: obj.item }] }, VOCAB_L1, VOCAB_T_L1);
      },
    },
  ],
};
