// `Snarling Gorehound` — "Whenever another creature you control with power 2
// or less enters, surveil 1." Neighborhood Guardian's derived power filter
// meeting the surveil ask: TWO defs, card and token, one qualifier. D249.

import { SNARLING_GOREHOUND } from '../../../data/fixtures/engineCards';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { InstanceId, PlayerId } from '../../types/ids';

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
  SNARLING_GOREHOUND,
  'Menace\nWhenever another creature you control with power 2 or less enters, surveil 1. ' +
    '(Look at the top card of your library. You may put it into your graveyard.)',
);
const TEXT = PRINTED.split('\n')[1] as string;

function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const d = ctx.derive(entrant);
  return d.typeLine.types.includes('Creature') && (d.power ?? 0) <= 2;
}

function surveilOne(ctx: ScriptCtx, controller: PlayerId, label: string): readonly EventBody[] {
  const library = ctx.state.zones.library[controller] ?? [];
  const n = Math.min(1, library.length);
  if (n === 0) return [];
  const top = library.slice(library.length - n);
  return [
    { t: 'CardsRevealed', cards: top, to: [controller] },
    {
      t: 'AwaitingSet',
      awaiting: {
        kind: 'scryChoice',
        player: controller,
        count: n,
        toGraveyard: true,
        thenDraw: 0,
        label,
      },
    },
  ];
}

export const SNARLING_GOREHOUND_SCRIPT: CardScript = {
  oracleId: SNARLING_GOREHOUND.oracleId,
  name: SNARLING_GOREHOUND.name,
  triggers: [
    {
      abilityId: 'small-etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Snarling Gorehound — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        surveilOne(ctx, obj.controller, obj.label),
    },
    {
      abilityId: 'small-etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Snarling Gorehound — surveil 1',
      resolve: (ctx, _self, obj): readonly EventBody[] =>
        surveilOne(ctx, obj.controller, obj.label),
    },
  ],
};
