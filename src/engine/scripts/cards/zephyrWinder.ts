// `Zephyr Winder` - untap on "untap up to one target creature", once per pick: the count and the
// noun are the parser's and the validator's (D299). Generated from one table row.

import { ZEPHYR_WINDER } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import { parseTargetClauses } from '../../../data/targetParse';
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

const PRINTED = printed(ZEPHYR_WINDER, "Flying\nWhenever this creature deals combat damage to a player, untap up to one target creature.");
const TEXT = PRINTED.split('\n')[1] as string;

export const ZEPHYR_WINDER_SCRIPT: CardScript = {
  oracleId: ZEPHYR_WINDER.oracleId,
  name: ZEPHYR_WINDER.name,
  triggers: [
    {
      abilityId: 'combatDamagePlayer',
      text: TEXT,
      event: 'CombatDamageDealt',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CombatDamageDealt' && ev.damages.some((d) => d.source === self && d.target.kind === 'player' && d.amount > 0),
      label: () => "Zephyr Winder - untap up to one target creature",
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        // D299: once per pick - the count is the parser's and the validator's.
        const out: EventBody[] = [];
        for (const target of obj.targets) {
          if (target.kind !== 'card') continue;
          const card = ctx.state.cards[target.id];
          if (!card || card.zone.kind !== 'battlefield') continue;
          if (card.tapped) out.push({ t: 'PermanentsUntapped', cards: [target.id] });
        }
        return out;
      },
    },
  ],
};
