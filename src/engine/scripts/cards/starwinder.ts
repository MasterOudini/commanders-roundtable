// `Starwinder` - a creatureCombatDamagePlayer trigger vocab
// until end of turn where it pumps (D194's carrier, D301). Generated from one table row.

import { STARWINDER } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(STARWINDER, "Whenever a creature you control deals combat damage to a player, you may draw that many cards.\nWarp {2}{U}{U} (You may cast this card from your hand for its warp cost. Exile this creature at the beginning of the next end step, then you may cast it from exile on a later turn.)");
const LINES = PRINTED.split('\n');

const VOCAB_L0 = vocabularyEffects("Draw that many cards.", STARWINDER.name, { memo: true });
const VOCAB_T_L0 = vocabularyTargets("Draw that many cards.");

export const STARWINDER_SCRIPT: CardScript = {
  oracleId: STARWINDER.oracleId,
  name: STARWINDER.name,
  triggers: [
    {
      abilityId: 'creatureCombatDamagePlayer-0',
      text: LINES[0] as string,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      memo: (ctx, self, ev, item) => (ev.t === 'CombatDamageDealt' ? ev.damages.filter((d) => d.target.kind === 'player' && (item !== undefined ? d.source === item : ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self))).reduce((n, d) => n + d.amount, 0) : 0),
      optional: true,
      matches: (ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.target.kind === 'player' && d.amount > 0 && ctx.state.cards[d.source]?.controller === ctx.query.controllerOf(self)),
      label: () => "Starwinder - Draw that many cards.",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        return ctx.vocabulary(obj, VOCAB_L0, VOCAB_T_L0);
      },
    },
  ],
};
