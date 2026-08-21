// `Shadewing Laureate` — "Whenever another creature you control with
// flying dies, put a +1/+1 counter on target creature you control." The
// dies watcher with a DERIVED keyword filter — a matcher reads keywords
// directly, where the AIM layer's parse cannot (D197's distinction).
// D246.

import { SHADEWING_LAUREATE } from '../../../data/fixtures/engineCards';
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

const PRINTED = printed(
  SHADEWING_LAUREATE,
  'Flying\nWhenever another creature you control with flying dies, put a +1/+1 counter on target creature you control.',
);
const TEXT = PRINTED.split('\n')[1] as string;

export const SHADEWING_LAUREATE_SCRIPT: CardScript = {
  oracleId: SHADEWING_LAUREATE.oracleId,
  name: SHADEWING_LAUREATE.name,
  triggers: [
    {
      abilityId: 'flyer-dies-counter',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      looksBack: true,
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some((m) => {
          if (m.from.kind !== 'battlefield' || m.to.kind !== 'graveyard') return false;
          if (m.card === self) return false;
          const inst = ctx.state.cards[m.card];
          if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
          const d = ctx.derive(m.card);
          return d.typeLine.types.includes('Creature') && d.keywords.has('flying');
        }),
      label: () => 'Shadewing Laureate — put a +1/+1 counter on target creature you control',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
