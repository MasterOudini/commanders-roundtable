// `Backup Agent` — "When this creature enters, put a +1/+1 counter on target
// creature." The whole card: a targeted ETB writing the counter Yotian's way,
// with no controller restriction — any creature may be backed up. M6.4f,
// D163.

import { BACKUP_AGENT } from '../../../data/fixtures/engineCards';
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

const TEXT = printed(BACKUP_AGENT, 'When this creature enters, put a +1/+1 counter on target creature.');

export const BACKUP_AGENT_SCRIPT: CardScript = {
  oracleId: BACKUP_AGENT.oracleId,
  name: BACKUP_AGENT.name,
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
      label: () => 'Backup Agent — +1/+1 counter on target creature',
      resolve: (ctx, _self, obj): readonly EventBody[] => {
        const target = obj.targets[0];
        if (!target || target.kind !== 'card') return [];
        // Re-checked at resolution (CR 603.2): a counter on a graveyard card
        // is a number nothing reads.
        return ctx.state.cards[target.id]?.zone.kind === 'battlefield'
          ? [{ t: 'CountersChanged', changes: [{ card: target.id, kind: '+1/+1', delta: 1 }] }]
          : [];
      },
    },
  ],
};
