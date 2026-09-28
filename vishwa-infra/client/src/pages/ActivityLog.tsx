import React, { useEffect, useState } from 'react';
import { History, PlusCircle, Pencil, Trash2, Copy, LogIn } from 'lucide-react';
import { type ActivityEntry, api } from '../lib';
import { Avatar, Card, Empty, Page, SkeletonRows } from '../ui';

const ACTION_META: Record<string, { label: string; icon: React.ElementType; tone: string }> = {
  create: { label: 'Created', icon: PlusCircle, tone: 'green' },
  update: { label: 'Updated', icon: Pencil, tone: 'blue' },
  'update-status': { label: 'Changed status of', icon: Pencil, tone: 'blue' },
  delete: { label: 'Deleted', icon: Trash2, tone: 'rose' },
  duplicate: { label: 'Repeated', icon: Copy, tone: 'violet' },
  login: { label: 'Signed in', icon: LogIn, tone: 'amber' },
};

const ENTITY_LABEL: Record<string, string> = {
  document: 'document', payment: 'payment', customer: 'customer', product: 'product/service',
  letterhead: 'letterhead', company: 'company profile', user: '',
};

function fmtWhen(s: string): string {
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function ActivityLog() {
  const [rows, setRows] = useState<ActivityEntry[] | null>(null);
  useEffect(() => { api('/activity').then(setRows).catch(() => setRows([])); }, []);

  return (
    <Page title="Activity Log" sub="Who did what, and when — every create, edit and delete across the app.">
      <Card title="Recent activity" sub="Most recent first · last 200 events" flush>
        {rows === null ? <div className="pad"><SkeletonRows rows={8} /></div> : rows.length === 0 ? (
          <Empty title="Nothing logged yet" text="Actions across the app will start appearing here." icon={<History size={26} />} />
        ) : (
          <div className="balances">
            {rows.map((r) => {
              const meta = ACTION_META[r.action] || { label: r.action, icon: History, tone: 'blue' };
              const Icon = meta.icon;
              const entity = ENTITY_LABEL[r.entity_type] ?? r.entity_type;
              return (
                <div className="bal-row" key={r.id}>
                  <Avatar name={r.user_name || '?'} size={36} />
                  <div className="grow">
                    <b>{r.user_name || 'Unknown user'}</b>
                    <span>
                      <span className={'dtype sm tone-' + meta.tone} style={{ display: 'inline-grid', verticalAlign: 'middle', marginRight: 6 }}><Icon size={12} /></span>
                      {meta.label} {entity ? entity : ''}{r.detail ? ` — ${r.detail}` : ''}
                    </span>
                  </div>
                  <strong className="pos">{fmtWhen(r.created_at)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Page>
  );
}
