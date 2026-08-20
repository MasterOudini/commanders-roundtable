// `Mystic Snake` — "When this creature enters, counter target spell." The
// first ETB trigger AIMED AT THE STACK: the trigger's target spec is the
// counterspell's, the answer arrow offers stack objects (D169's stack
// TargetSource), and the resolve is Daring Apprentice's two-event pair.
// D227.

import { MYSTIC_SNAKE } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import { moveFromStack } from '../../effects';
import type { CardData } from '../../../data/cardTypes';
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

const PRINTED = printed(MYSTIC_SNAKE, 'Flash\nWhen this creature enters, counter target spell.');
const TEXT = PRINTED.split('\n')[1] as string;

export const MYSTIC_SNAKE_SCRIPT: CardScript = {
  oracleId: MYSTIC_SNAKE.oracleId,
  name: MYSTIC_SNAKE.name,
  triggers: [
    {
      abilityId: 'etb-counter',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.to.kind === 'battlefield' && m.from.kind !== 'battlefield',
        ),
      label: () => 'Mystic Snake — counter target spell',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'stack') return [];
        const spell = ctx.state.stack.find((o) => o.id === target.id);
        if (!spell || spell.kind !== 'spell') return [];
        const out: EventBody[] = [{ t: 'SpellCountered', stackId: spell.id }];
        if (spell.card) {
          const vc = ctx.state.cards[spell.card];
          if (vc) out.push(moveFromStack(spell.card, 'graveyard', vc.owner));
        }
        return out;
      },
    },
  ],
};
