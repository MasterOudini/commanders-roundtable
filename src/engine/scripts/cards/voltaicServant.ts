// `Voltaic Servant` — Voltaic Key's untap, moved off an activation and onto a
// TARGETED end-step trigger. `Step` carries 'end' (state.ts), so this is
// Geist of the Archives one step over, with targets attached the way
// Luminarch Aspirant attaches them. D267.

import { VOLTAIC_SERVANT } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
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

const TEXT = printed(VOLTAIC_SERVANT, 'At the beginning of your end step, untap target artifact.');

export const VOLTAIC_SERVANT_SCRIPT: CardScript = {
  oracleId: VOLTAIC_SERVANT.oracleId,
  name: VOLTAIC_SERVANT.name,
  triggers: [
    {
      abilityId: 'end-step-untap',
      text: TEXT,
      event: 'StepBegan',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      // "YOUR end step" — the active player must be my controller.
      matches: (ctx, self, ev) =>
        ev.t === 'StepBegan' &&
        ev.step === 'end' &&
        ctx.state.turn.activePlayer === ctx.state.cards[self]?.controller,
      label: () => 'Voltaic Servant — untap target artifact',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        const card = ctx.state.cards[target.id];
        if (!card || card.zone.kind !== 'battlefield' || !card.tapped) return [];
        return [{ t: 'PermanentsUntapped', cards: [target.id] }];
      },
    },
  ],
};
