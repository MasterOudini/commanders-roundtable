// `Court Street Denizen` — "Whenever another white creature you control
// enters, tap target creature an opponent controls." Soul Warden's two-def
// shape (a token enters via `TokenCreated`, never `CardsMoved`) with a
// COLOUR filter asked of the DERIVED entrant, a targeted trigger
// (CR 603.3d), and Auriok Transfixer's tapped-guard on the effect.
// M6.4l, D169.

import { COURT_STREET_DENIZEN } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript } from '../api';
import type { EventBody } from '../../types/events';
import type { ScriptCtx } from '../api';
import type { InstanceId } from '../../types/ids';

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
  COURT_STREET_DENIZEN,
  'Whenever another white creature you control enters, tap target creature an opponent controls.',
);

/** "another white creature you control" — asked of the DERIVED entrant. */
function qualifies(ctx: ScriptCtx, self: InstanceId, entrant: InstanceId): boolean {
  if (entrant === self) return false;
  const inst = ctx.state.cards[entrant];
  if (!inst || inst.controller !== ctx.query.controllerOf(self)) return false;
  const d = ctx.derive(entrant);
  return d.typeLine.types.includes('Creature') && d.colors.includes('W');
}

function tapTarget(ctx: ScriptCtx, obj: { readonly targets: readonly { kind: string; id: string }[] }): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id as InstanceId];
  if (!card || card.zone.kind !== 'battlefield' || card.tapped) return [];
  return [{ t: 'PermanentsTapped', cards: [target.id as InstanceId] }];
}

export const COURT_STREET_DENIZEN_SCRIPT: CardScript = {
  oracleId: COURT_STREET_DENIZEN.oracleId,
  name: COURT_STREET_DENIZEN.name,
  triggers: [
    {
      abilityId: 'etb-card',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) =>
            m.to.kind === 'battlefield' &&
            m.from.kind !== 'battlefield' &&
            qualifies(ctx, self, m.card),
        ),
      label: () => 'Court Street Denizen — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
    {
      abilityId: 'etb-token',
      text: TEXT,
      event: 'TokenCreated',
      activeZones: ['battlefield'],
      optional: false,
      targets: parseTargetClauses(TEXT),
      matches: (ctx, self, ev) => ev.t === 'TokenCreated' && qualifies(ctx, self, ev.card),
      label: () => 'Court Street Denizen — tap target creature an opponent controls',
      resolve: (ctx, _self, obj): readonly EventBody[] => tapTarget(ctx, obj),
    },
  ],
};
