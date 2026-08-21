// `Suffocating Blast` — counter AND burn in one resolve: the probed two
// specs (a stack-aimed counter beside a creature ping), each independent
// of the other's legality. D255.

import { SUFFOCATING_BLAST } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(
  SUFFOCATING_BLAST,
  'Counter target spell and Suffocating Blast deals 3 damage to target creature.',
);

export const SUFFOCATING_BLAST_SCRIPT: CardScript = {
  oracleId: SUFFOCATING_BLAST.oracleId,
  name: SUFFOCATING_BLAST.name,
  spell: {
    text: TEXT,
    resolve: (ctx, self, obj): readonly EventBody[] => {
      const events: EventBody[] = [];
      const spellTarget = obj.targets[0];
      if (spellTarget && spellTarget.kind === 'stack') {
        const spell = ctx.state.stack.find((o) => o.id === spellTarget.id);
        if (spell && spell.kind === 'spell') {
          events.push({ t: 'SpellCountered', stackId: spell.id });
          if (spell.card) {
            const vc = ctx.state.cards[spell.card];
            if (vc) events.push(moveFromStack(spell.card, 'graveyard', vc.owner));
          }
        }
      }
      const victim = obj.targets[1];
      if (victim && victim.kind === 'card' && ctx.state.cards[victim.id]?.zone.kind === 'battlefield') {
        events.push({
          t: 'DamageDealt',
          damages: [
            {
              source: self,
              target: { kind: 'card', id: victim.id },
              amount: 3,
              deathtouch: false,
              lifelinkTo: null,
              isCommanderDamage: false,
              viaTrample: 0,
              toxic: 0,
              applyAs: 'normal',
            },
          ],
        });
      }
      return events;
    },
  },
};
