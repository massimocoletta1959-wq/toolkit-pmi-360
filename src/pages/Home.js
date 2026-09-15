import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { CATALOGO_PROCEDURE } from '../lib/procedure'
import { etichettaModulo } from '../lib/modalitaSolo'

const TIER = [
  { key: 't1', label: 'Critici',      col: '#E5484D' },
  { key: 't2', label: 'Significativi', col: '#E08B0B' },
  { key: 't3', label: 'Moderati',     col: '#D9B310' },
  { key: 't4', label: 'Accettabili',  col: '#3FA45B' },
]

const DEFAULT = {
  rischi:     { n: 0, tiers: { t1: 0, t2: 0, t3: 0, t4: 0 }, azioni: 0 },
  procedure:  { n: 0, catalogo: 0, personalizzate: 0 },
  governance: { n: 0, organi: [], componenti: 0, prossima: null },
}

export default function Home() {
  const { azienda, session, entraModulo, setPage } = useApp()
  const [d, setD] = useState(DEFAULT)
  const [lic, setLic] = useState(null)

  const attivo = {
    rischi: !!azienda?.mod_rischi,
    procedure: !!azienda?.mod_procedure,
    governance: !!azienda?.mod_governance,
  }
  const modalitaSolo = !!azienda?.modalita_solo
  const labelRischi = etichettaModulo('rischi', 'Rischi', modalitaSolo)
  const labelProcedure = etichettaModulo('procedure', 'Procedure', modalitaSolo)

  const load = useCallback(async () => {
    if (!azienda?.id) return
    const A = azienda.id
    const res = await Promise.allSettled([
      supabase.from('rischi').select('probabilita,impatto').eq('azienda_id', A),
      supabase.from('procedure_azienda').select('stato').eq('azienda_id', A),
      supabase.from('organi').select('id,nome,tipo').eq('azienda_id', A),
      supabase.from('azioni').select('id').eq('azienda_id', A),
      supabase.from('riunioni').select('data_riunione').eq('azienda_id', A),
      supabase.from('procedure_template').select('codice').in('settore', [azienda?.settore, 'generico']),
    ])
    const val = i => (res[i].status === 'fulfilled' ? (res[i].value.data || []) : [])
    const rischiRows = val(0), procRows = val(1), organi = val(2)
    const azioniRows = val(3), riunioniRows = val(4), catalogoRows = val(5)

    const tiers = { t1: 0, t2: 0, t3: 0, t4: 0 }
    rischiRows.forEach(r => {
      const s = (Number(r.probabilita) || 0) * (Number(r.impatto) || 0)
      if (s >= 6) tiers.t1++; else if (s >= 4) tiers.t2++; else if (s >= 2) tiers.t3++; else tiers.t4++
    })

    let componenti = 0
    if (organi.length) {
      try {
        const c = await supabase.from('organo_membri').select('id').in('organo_id', organi.map(o => o.id))
        componenti = c.data?.length || 0
      } catch (e) { /* ignora */ }
    }

    const oggi = new Date().toISOString().slice(0, 10)
    const prossime = riunioniRows.map(r => r.data_riunione).filter(x => x && x.slice(0, 10) >= oggi).sort()

    setD({
      rischi:     { n: rischiRows.length, tiers, azioni: azioniRows.length },
      procedure:  { n: procRows.filter(p => p.stato === 'Adottata').length, catalogo: catalogoRows.length || CATALOGO_PROCEDURE.length, personalizzate: procRows.filter(p => p.stato === 'Personalizzata').length },
      governance: { n: organi.length, organi, componenti, prossima: prossime[0] || null },
    })

    if (session?.user?.id) {
      const { data } = await supabase.from('gestori')
        .select('ragione_sociale,piano,data_scadenza').eq('user_id', session.user.id).maybeSingle()
      setLic(data || null)
    }
  }, [azienda, session])

  useEffect(() => { load() }, [load])

  const open = (id) => (attivo[id] ? entraModulo(id) : setPage('impostazioni'))
  const fmt = x => x ? new Date(x + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : null
  const fmtL = x => x ? new Date(x).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  const rTot = d.rischi.n || 1

  return (
    <div>
      <style>{`
        .bento { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .t-risk { grid-column:1/3; } .t-proc { grid-column:3/4; } .t-gov { grid-column:1/-1; }
        .tile {
          position:relative; overflow:hidden; border-radius:20px; padding:26px 28px;
          background:#fff; border:1px solid #EAEFF5; cursor:pointer;
          box-shadow:0 2px 4px rgba(26,58,92,0.04);
          transition:transform .22s ease, box-shadow .22s ease;
        }
        .tile:hover { transform:translateY(-5px); box-shadow:0 18px 40px rgba(26,58,92,0.14); }
        .tile.off { cursor:pointer; background:#F7F9FC; border-style:dashed; }
        .blob { position:absolute; top:-70px; right:-70px; width:190px; height:190px; border-radius:50%; filter:blur(18px); opacity:.20; pointer-events:none; }
        .kicker { font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; }
        .huge { font-size:52px; font-weight:800; line-height:1; letter-spacing:-1px; color:#12233A; }
        .cta { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; margin-top:18px; }
        .chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:5px 11px; border-radius:999px; background:#EEF3FA; color:#2B5FA5; }
        @media (max-width:820px){ .bento{ grid-template-columns:1fr; } .t-risk,.t-proc,.t-gov{ grid-column:auto; } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 24, color: '#12233A', marginBottom: 2, letterSpacing: -0.3 }}>{azienda?.nome}</h2>
          <p style={{ fontSize: 13.5, color: '#8A94A0' }}>La tua plancia di controllo · scegli un modulo</p>
        </div>
        {lic && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: 'linear-gradient(135deg,#F7F9FC,#EDF2FA)', border: '1px solid #E3EAF3', borderRadius: 999, padding: '8px 16px', boxShadow: '0 1px 3px rgba(26,58,92,0.06)' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#2B5FA5,#163352)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12.5, fontWeight: 700 }}>
              {(lic.ragione_sociale || '?').slice(0, 2).toUpperCase()}
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1A3A5C' }}>{lic.ragione_sociale || 'Licenza'}</div>
              {lic.data_scadenza && <div style={{ fontSize: 11.5, color: '#8A94A0' }}>valida fino al {fmtL(lic.data_scadenza)}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="bento">

        {/* ---------- RISCHI (protagonista) ---------- */}
        <div className={`tile t-risk${attivo.rischi ? '' : ' off'}`} onClick={() => open('rischi')}>
          <div className="blob" style={{ background: '#2B6FD0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="kicker" style={{ color: '#2B6FD0' }}>■ {labelRischi}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12 }}>
                <span className="huge" style={{ color: attivo.rischi ? '#12233A' : '#B4BCC6' }}>{d.rischi.n}</span>
                <span style={{ fontSize: 14, color: '#8A94A0' }}>rischi mappati</span>
              </div>
            </div>
            {attivo.rischi && <span className="chip" style={{ background: '#EAF2FC' }}>{d.rischi.azioni} azioni nel piano</span>}
          </div>

          {attivo.rischi ? (
            <div style={{ marginTop: 22 }}>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: '#F0F3F7' }}>
                {TIER.map(t => {
                  const v = d.rischi.tiers[t.key]
                  return v > 0 ? <div key={t.key} title={`${t.label}: ${v}`} style={{ width: `${(v / rTot) * 100}%`, background: t.col }} /> : null
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
                {TIER.map(t => (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5B6673' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: t.col }} />
                    <strong style={{ color: '#12233A' }}>{d.rischi.tiers[t.key]}</strong> {t.label}
                  </div>
                ))}
              </div>
              <div className="cta" style={{ color: '#2B6FD0' }}>Apri il cruscotto →</div>
            </div>
          ) : (
            <div className="cta" style={{ color: '#8A94A0', marginTop: 26 }}>Modulo non attivo · attiva in Impostazioni →</div>
          )}
        </div>

        {/* ---------- PROCEDURE ---------- */}
        <div className={`tile t-proc${attivo.procedure ? '' : ' off'}`} onClick={() => open('procedure')}>
          <div className="blob" style={{ background: '#128A66' }} />
          <div className="kicker" style={{ color: '#128A66' }}>■ {labelProcedure}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
            <span className="huge" style={{ color: attivo.procedure ? '#12233A' : '#B4BCC6' }}>{d.procedure.n}</span>
            <span style={{ fontSize: 14, color: '#8A94A0' }}>adottate</span>
          </div>

          {attivo.procedure ? (
            <div style={{ marginTop: 20 }}>
              <div style={{ height: 10, borderRadius: 5, background: '#EDF2F0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${d.procedure.catalogo ? Math.min(100, (d.procedure.n / d.procedure.catalogo) * 100) : 0}%`, background: 'linear-gradient(90deg,#37C79C,#128A66)', borderRadius: 5 }} />
              </div>
              <div style={{ fontSize: 12.5, color: '#5B6673', marginTop: 10 }}><strong style={{ color: '#12233A' }}>{d.procedure.catalogo}</strong> nel catalogo</div>
              <div style={{ fontSize: 12.5, color: '#5B6673', marginTop: 4 }}><strong style={{ color: '#12233A' }}>{d.procedure.personalizzate}</strong> personalizzate</div>
              <div className="cta" style={{ color: '#128A66' }}>Apri le procedure →</div>
            </div>
          ) : (
            <div className="cta" style={{ color: '#8A94A0', marginTop: 24 }}>Non attivo →</div>
          )}
        </div>

        {/* ---------- GOVERNANCE (fascia larga) ---------- */}
        <div className={`tile t-gov${attivo.governance ? '' : ' off'}`} onClick={() => open('governance')}>
          <div className="blob" style={{ background: '#6A5ED0', top: '-70px', right: 60 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 26 }}>
              <div>
                <div className="kicker" style={{ color: '#6A5ED0' }}>■ Governance</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 10 }}>
                  <span className="huge" style={{ color: attivo.governance ? '#12233A' : '#B4BCC6' }}>{d.governance.n}</span>
                  <span style={{ fontSize: 14, color: '#8A94A0' }}>organi</span>
                </div>
              </div>
              {attivo.governance && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 460 }}>
                  {d.governance.organi.slice(0, 5).map(o => (
                    <span key={o.id} className="chip" style={{ background: '#EFEDFB', color: '#5A4FC0' }}>{o.nome}</span>
                  ))}
                  {d.governance.organi.length === 0 && <span style={{ fontSize: 13, color: '#98A2AE' }}>Nessun organo ancora creato</span>}
                </div>
              )}
            </div>
            {attivo.governance ? (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12.5, color: '#5B6673' }}><strong style={{ color: '#12233A' }}>{d.governance.componenti}</strong> componenti totali</div>
                <div style={{ fontSize: 12.5, color: '#5B6673', marginTop: 4 }}>{d.governance.prossima ? <>prossima riunione <strong style={{ color: '#12233A' }}>{fmt(d.governance.prossima)}</strong></> : 'nessuna riunione in agenda'}</div>
                <div className="cta" style={{ color: '#6A5ED0' }}>Apri la governance →</div>
              </div>
            ) : (
              <div className="cta" style={{ color: '#8A94A0' }}>Non attivo · attiva in Impostazioni →</div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}