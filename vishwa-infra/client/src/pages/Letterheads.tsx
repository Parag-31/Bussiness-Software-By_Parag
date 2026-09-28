import React, { useEffect, useState } from 'react';
import { Check, Plus, Save, Trash2, PanelsTopLeft } from 'lucide-react';
import { type Letterhead, type User, DOC_TYPES, api, tintHex } from '../lib';
import { confirmDialog, toast } from '../bus';
import { Card, Empty, Page, Status } from '../ui';
import { typeMeta } from './meta';

export function Letterheads({ data, letterMap, user, onAdd, onRefresh }: { data: Letterhead[]; letterMap: Record<string, number | null>; user: User | null; onAdd: () => void; onRefresh: () => void }) {
  const [saving, setSaving] = useState(false);
  const canDelete = user?.role === 'Admin';
  const fromMap = () => { const d: Record<string, string> = {}; for (const t of DOC_TYPES) d[t] = String(letterMap[t] ?? ''); return d; };
  const [drafts, setDrafts] = useState<Record<string, string>>(fromMap);
  useEffect(() => { setDrafts(fromMap()); }, [letterMap]);

  const remove = async (l: Letterhead) => {
    if (!(await confirmDialog({ title: `Delete “${l.name}”?`, message: 'Documents already using it keep their saved copy.', confirmLabel: 'Delete letterhead', danger: true }))) return;
    try { await api(`/letterheads/${l.id}`, { method: 'DELETE' }); toast('Letterhead deleted', 'success'); onRefresh(); } catch (e: any) { toast('Could not delete', 'error', e.message); }
  };
  const saveMappings = async () => {
    setSaving(true);
    try {
      for (const t of DOC_TYPES) await api('/letterheads/mappings', { method: 'PUT', body: JSON.stringify({ doc_type: t, letterhead_id: drafts[t] ? Number(drafts[t]) : null }) });
      await onRefresh();
      toast('Default letterheads saved', 'success');
    } catch (e: any) { toast('Could not save', 'error', e.message); } finally { setSaving(false); }
  };
  const defaultsFor = (id: number) => DOC_TYPES.filter((t) => letterMap[t] === id);

  return (
    <Page title="Letterheads" sub="Maintain separate branded templates for your business documents." actions={<button className="btn primary" onClick={onAdd}><Plus size={17} /> Add letterhead</button>}>
      <div className="letter-grid">
        {data.map((l, i) => {
          const color = l.color || '#1c3a5e';
          const defs = defaultsFor(l.id);
          return (
            <div className="letter-card rise" key={l.id} style={{ ['--lc' as string]: color, ['--i' as string]: i } as React.CSSProperties}>
              <div className="paper-stage" style={{ background: `linear-gradient(160deg, ${tintHex(color, 0.9)}, ${tintHex(color, 0.97)})` }}>
                <div className="paper">
                  {l.header_data ? <img src={l.header_data} className="paper-img" alt="" /> : <div className="paper-line" />}
                  <div className="paper-body"><i /><i /><i className="s" /><i /><i className="s" /></div>
                  {l.footer_data ? <img src={l.footer_data} className="paper-img" alt="" /> : <div className="paper-footer" />}
                </div>
                {l.stamp_data && <img src={l.stamp_data} className="stamp-float" alt="" />}
              </div>
              <div className="letter-meta">
                <span className="letter-color-dot" style={{ background: color }} />
                <div className="grow"><b>{l.name}</b><span>Code {l.code || '—'}</span></div>
                <Status s="Active" />
                {canDelete && <button className="icon-btn danger" data-tip="Delete" onClick={() => remove(l)}><Trash2 size={16} /></button>}
              </div>
              {defs.length > 0 && <div className="def-tags">{defs.map((t) => <span key={t}><Check size={11} />Default · {typeMeta(t).label}</span>)}</div>}
            </div>
          );
        })}
      </div>
      {!data.length && <div className="card"><Empty title="No letterheads" text="Add your quotation and invoice branding assets." onClick={onAdd} cta="Add letterhead" icon={<PanelsTopLeft size={26} />} /></div>}
      <Card i={4} title="Default letterhead per document type" sub="New documents pick the right branding automatically" className="defaults">
        <div className="two">
          {DOC_TYPES.map((t) => {
            const m = typeMeta(t);
            return (
              <label key={t} className="field"><span className="fl"><span className={'dtype sm tone-' + m.tone}><m.icon size={14} /></span>{m.label}</span>
                <select value={drafts[t]} onChange={(e) => setDrafts({ ...drafts, [t]: e.target.value })}>
                  <option value="">None (choose manually each time)</option>
                  {data.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
            );
          })}
        </div>
        <button className="btn primary" onClick={saveMappings} disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save defaults'}</button>
      </Card>
    </Page>
  );
}
