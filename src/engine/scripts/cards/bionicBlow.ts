// `Bionic Blow` — my creature gets +X/+0 until cleanup (X off the stack),
// then deals its pumped power in damage to up to one other creature; the
// targets are told apart by controller where they differ and by order
// otherwise (the required clause first).

import { BIONIC_BLOW } from '../../../data/fixtures/engineCards';
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
  BIONIC_BLOW,
  'Target creature you control gets +X/+0 until end of turn. Then it deals damage equal to its power to up to one other target creature.',
);

export const BIONIC_BLOW_SCRIPT: CardScript = {
  oracleId: BIONIC_BLOW.oracleId,
  name: BIONIC_BLOW.name,
  spell: {
    text: TEXT,
    resolve: (ctx, _self, obj): readonly EventBody[] => {
      const x = obj.xValue ?? 0;
      const cards = obj.targets.filter((t) => t.kind === 'card');
      const mine = cards.find((t) => ctx.state.cards[t.id]?.controller === obj.controller) ?? cards[0];
      const other = cards.find((t) => t !== mine);
      if (!mine || ctx.state.cards[mine.id]?.zone.kind !== 'battlefield') return [];
      const events: EventBody[] = [{ t: 'PtModifiedUntilEndOfTurn', card: mine.id, power: x, toughness: 0, keywords: [] }];
      if (other && ctx.state.cards[other.id]?.zone.kind === 'battlefield') {
        const power = (ctx.derive(mine.id).power ?? 0) + x;
        if (power > 0) {
          events.push({
            t: 'DamageDealt',
            damages: [
              {
                source: mine.id,
                target: { kind: 'card', id: other.id },
                amount: power,
                deathtouch: ctx.derive(mine.id).keywords.has('deathtouch'),
                lifelinkTo: ctx.derive(mine.id).keywords.has('lifelink') ? obj.controller : null,
                isCommanderDamage: false,
                viaTrample: 0,
                toxic: 0,
                applyAs: 'normal',
              },
            ],
          });
        }
      }
      return events;
    },
  },
};
