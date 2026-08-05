// `Ashen Rider` — "Flying\nWhen this creature enters or dies, exile target
// permanent." ONE printed line, TWO defs — an entry cannot watch the same
// event instance as a death, and "or" on the card means both. The dies half
// looks back (CR 603.10a, D147); both target through the trigger machinery
// and share Archon of Justice's exile. M6.4e, D162.

import { ASHEN_RIDER } from '../../../data/fixtures/engineCards';
import { parseTargetClauses } from '../../../data/targetParse';
import type { CardData } from '../../../data/cardTypes';
import type { CardScript, ScriptCtx } from '../api';
import type { EventBody } from '../../types/events';
import type { StackObject } from '../../types/state';
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

const PRINTED = printed(ASHEN_RIDER, 'Flying\nWhen this creature enters or dies, exile target permanent.');
const TEXT = PRINTED.split('\n')[1] as string;

function exileTarget(ctx: ScriptCtx, _self: InstanceId, obj: StackObject): readonly EventBody[] {
  const target = obj.targets[0];
  if (!target || target.kind !== 'card') return [];
  const card = ctx.state.cards[target.id];
  if (!card || card.zone.kind !== 'battlefield') return [];
  return [
    {
      t: 'CardsMoved',
      moves: [
        {
          card: target.id,
          from: { kind: 'battlefield', player: card.controller },
          to: { kind: 'exile', player: card.owner },
        },
      ],
    },
  ];
}

export const ASHEN_RIDER_SCRIPT: CardScript = {
  oracleId: ASHEN_RIDER.oracleId,
  name: ASHEN_RIDER.name,
  triggers: [
    {
      abilityId: 'etb',
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
      label: () => 'Ashen Rider — exile target permanent',
      resolve: exileTarget,
    },
    {
      abilityId: 'dies',
      text: TEXT,
      event: 'CardsMoved',
      activeZones: ['battlefield'],
      optional: false,
      looksBack: true,
      targets: parseTargetClauses(TEXT),
      matches: (_ctx, self, ev) =>
        ev.t === 'CardsMoved' &&
        ev.moves.some(
          (m) => m.card === self && m.from.kind === 'battlefield' && m.to.kind === 'graveyard',
        ),
      label: () => 'Ashen Rider — exile target permanent',
      resolve: exileTarget,
    },
  ],
};
