import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../App'
import { CATALOGO_PROCEDURE } from '../lib/procedure'
import { etichettaModulo } from '../lib/modalitaSolo'
import { descriviVersione } from '../lib/versione'

const versione = descriviVersione()

// ============================================================
// Home — la "ruota dei moduli": un cerchio diviso in quattro spicchi
// (Rischi, Finanza, Governance, Procedure). Al passaggio del cursore lo
// spicchio si stacca e si ingrandisce, il mozzo centrale ne mostra il
// numero chiave e il pannello accanto i dettagli. Click = entra nel modulo.
// ============================================================

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
  finanza:    { documenti: 0, budget: 0, ultimoAnno: null, kpi: null },
}

// Geometria della ruota (coordinate SVG centrate in 0,0)
const R_EST = 190, R_INT = 78, STACCO = 16
// Spicchi in senso orario partendo dall'alto
const SPICCHI = [
  { id: 'rischi',     icona: '🛡️', da: -90, a: 0,   colori: ['#4C8FE8', '#1F5FB8'] },
  { id: 'finanza',    icona: '📈', da: 0,   a: 90,  colori: ['#F2B544', '#C9831A'] },
  { id: 'governance', icona: '⚖️', da: 90,  a: 180, colori: ['#8C80EA', '#5A4FC0'] },
  { id: 'procedure',  icona: '📘', da: 180, a: 270, colori: ['#3FCB9F', '#118A65'] },
]
const rad = g => (g * Math.PI) / 180
const punto = (r, g) => [r * Math.cos(rad(g)), r * Math.sin(rad(g))]

// Corona circolare tra gli angoli da/a (con un piccolo varco tra gli spicchi)
function pathSpicchio(da, a, varco = 1.6) {
  const g0 = da + varco, g1 = a - varco
  const [x0, y0] = punto(R_EST, g0), [x1, y1] = punto(R_EST, g1)
  const [x2, y2] = punto(R_INT, g1), [x3, y3] = punto(R_INT, g0)
  const grande = g1 - g0 > 180 ? 1 : 0
  return `M ${x0} ${y0} A ${R_EST} ${R_EST} 0 ${grande} 1 ${x1} ${y1} L ${x2} ${y2} A ${R_INT} ${R_INT} 0 ${grande} 0 ${x3} ${y3} Z`
}

const eur = n => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 }) + ' €'
const SEMAFORO = { verde: '#3FA45B', giallo: '#D9B310', rosso: '#E5484D' }

export default function Home() {
  const { azienda, session, entraModulo, setPage } = useApp()
  const [d, setD] = useState(DEFAULT)
  const [lic, setLic] = useState(null)
  const [sopra, setSopra] = useState(null)     // spicchio sotto il cursore
  const [scelto, setScelto] = useState(null)   // ultimo spicchio visitato (resta nel pannello)

  const attivo = {
    rischi: !!azienda?.mod_rischi,
    procedure: !!azienda?.mod_procedure,
    governance: !!azienda?.mod_governance,
    finanza: !!azienda?.mod_finanza,
  }
  const modalitaSolo = !!azienda?.modalita_solo
  const NOMI = {
    rischi: etichettaModulo('rischi', 'Rischi', modalitaSolo),
    procedure: etichettaModulo('procedure', 'Procedure', modalitaSolo),
    governance: 'Governance',
    finanza: 'Finanza e Controllo',
  }

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
      supabase.from('fin_documenti').select('id', { count: 'exact', head: true }).eq('azienda_id', A),
      supabase.from('fin_budget').select('anno').eq('azienda_id', A),
      supabase.from('fin_kpi_tesoreria').select('saldo_corrente,semaforo,dso_giorni,dpo_giorni,data_snapshot')
        .eq('azienda_id', A).order('data_snapshot', { ascending: false }).limit(1),
    ])
    const val = i => (res[i].status === 'fulfilled' ? (res[i].value.data || []) : [])
    const rischiRows = val(0), procRows = val(1), organi = val(2)
    const azioniRows = val(3), riunioniRows = val(4), catalogoRows = val(5)
    const nDoc = res[6].status === 'fulfilled' ? (res[6].value.count || 0) : 0
    const budgetRows = val(7), kpi = val(8)[0] || null

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
    const anni = budgetRows.map(b => b.anno).filter(Boolean).sort()

    setD({
      rischi:     { n: rischiRows.length, tiers, azioni: azioniRows.length },
      procedure:  { n: procRows.filter(p => p.stato === 'Adottata').length, catalogo: catalogoRows.length || CATALOGO_PROCEDURE.length, personalizzate: procRows.filter(p => p.stato === 'Personalizzata').length },
      governance: { n: organi.length, organi, componenti, prossima: prossime[0] || null },
      finanza:    { documenti: nDoc, budget: budgetRows.length, ultimoAnno: anni[anni.length - 1] || null, kpi },
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

  // Numero chiave mostrato sullo spicchio e nel mozzo
  const chiave = {
    rischi:     { n: d.rischi.n, sotto: 'rischi mappati' },
    procedure:  { n: d.procedure.n, sotto: 'procedure adottate' },
    governance: { n: d.governance.n, sotto: 'organi' },
    finanza:    { n: d.finanza.documenti, sotto: 'documenti contabili' },
  }

  // Modulo nel pannello: quello sotto il cursore, poi l'ultimo visitato, poi il primo attivo
  const inPannello = sopra || scelto || SPICCHI.find(s => attivo[s.id])?.id || 'rischi'
  const spPannello = SPICCHI.find(s => s.id === inPannello)
  const rTot = d.rischi.n || 1

  return (
    <div>
      <style>{`
        .ruota-wrap { display:grid; grid-template-columns:minmax(300px, 470px) 1fr; gap:28px; align-items:center; }
        .ruota { width:100%; max-width:470px; aspect-ratio:1; overflow:visible; }
        .spicchio { cursor:pointer; transform-origin:0px 0px; transition:transform .35s cubic-bezier(.2,.8,.2,1.2), opacity .25s ease, filter .25s ease; outline:none; }
        .entrata { transform-origin:0px 0px; animation:entra .6s cubic-bezier(.2,.8,.2,1) both; }
        .spicchio:focus-visible path.fondo { stroke:#12233A; stroke-width:3; }
        .ruota.attenua .spicchio:not(.su) { opacity:.45; filter:saturate(.6); }
        .spicchio.su { filter:drop-shadow(0 14px 22px rgba(18,35,58,.28)); }
        .spicchio .etichetta { pointer-events:none; transition:transform .35s ease; }
        @keyframes entra { from { opacity:0; transform:scale(.6) rotate(-25deg); } to { opacity:1; } }
        .anello { animation:gira 60s linear infinite; transform-origin:0px 0px; }
        @keyframes gira { to { transform:rotate(360deg); } }
        .mozzo-n { transition:all .25s ease; }
        .pannello { border-radius:22px; padding:26px 28px; background:#fff; border:1px solid #EAEFF5;
                    box-shadow:0 10px 30px rgba(26,58,92,.08); position:relative; overflow:hidden; min-height:300px; }
        .pannello .alone { position:absolute; top:-90px; right:-90px; width:240px; height:240px; border-radius:50%; filter:blur(30px); opacity:.22; transition:background .3s; }
        .kicker { font-size:11px; font-weight:700; letter-spacing:1.4px; text-transform:uppercase; }
        .huge { font-size:52px; font-weight:800; line-height:1; letter-spacing:-1px; color:#12233A; }
        .cta { display:inline-flex; align-items:center; gap:6px; font-size:13px; font-weight:600; margin-top:20px; cursor:pointer; }
        .chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:600; padding:5px 11px; border-radius:999px; background:#EEF3FA; color:#2B5FA5; }
        .legenda { display:flex; gap:8px; flex-wrap:wrap; margin-top:16px; justify-content:center; }
        .legenda button { border:1px solid #E3EAF3; background:#fff; border-radius:999px; padding:6px 12px; font-size:12px; cursor:pointer; display:inline-flex; gap:6px; align-items:center; }
        @media (max-width:900px){ .ruota-wrap{ grid-template-columns:1fr; } .ruota{ margin:0 auto; } }
        @media (prefers-reduced-motion: reduce){ .spicchio, .entrata, .anello { animation:none; transition:none; } }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 24, color: '#12233A', marginBottom: 2, letterSpacing: -0.3 }}>{azienda?.nome}</h2>
          <p style={{ fontSize: 13.5, color: '#8A94A0' }}>La tua plancia di controllo · passa sulla ruota e scegli un modulo</p>
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

      <div className="ruota-wrap">
        {/* ── La ruota ── */}
        <div>
          <svg className={`ruota${sopra ? ' attenua' : ''}`} viewBox="-230 -230 460 460" role="group" aria-label="Moduli">
            <defs>
              {SPICCHI.map(s => (
                <radialGradient key={s.id} id={`g-${s.id}`} cx="0" cy="0" r={R_EST} gradientUnits="userSpaceOnUse">
                  <stop offset="40%" stopColor={s.colori[0]} />
                  <stop offset="100%" stopColor={s.colori[1]} />
                </radialGradient>
              ))}
              <pattern id="tratteggio" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="10" height="10" fill="#EEF1F5" />
                <line x1="0" y1="0" x2="0" y2="10" stroke="#DCE2EA" strokeWidth="4" />
              </pattern>
              <filter id="ombra-mozzo" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#12233A" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* anello decorativo che ruota lentamente */}
            <g className="anello">
              <circle r={R_EST + 22} fill="none" stroke="#DDE5EF" strokeWidth="1.5" strokeDasharray="2 9" />
            </g>

            {SPICCHI.map((s, i) => {
              const on = attivo[s.id]
              const su = sopra === s.id
              const mezzo = (s.da + s.a) / 2
              const [dx, dy] = punto(STACCO, mezzo)
              const [lx, ly] = punto((R_EST + R_INT) / 2 + 6, mezzo)
              return (
                <g key={s.id}
                   className={`spicchio${su ? ' su' : ''}`}
                   style={{ transform: su ? `translate(${dx}px, ${dy}px) scale(1.06)` : 'none' }}
                   tabIndex={0} role="button"
                   aria-label={`${NOMI[s.id]}${on ? '' : ' (non attivo)'}: ${chiave[s.id].n} ${chiave[s.id].sotto}`}
                   onMouseEnter={() => { setSopra(s.id); setScelto(s.id) }}
                   onMouseLeave={() => setSopra(null)}
                   onFocus={() => { setSopra(s.id); setScelto(s.id) }}
                   onBlur={() => setSopra(null)}
                   onClick={() => open(s.id)}
                   onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(s.id))}>
                  <g className="entrata" style={{ animationDelay: `${i * 0.09}s` }}>
                  <path className="fondo" d={pathSpicchio(s.da, s.a)} fill={on ? `url(#g-${s.id})` : 'url(#tratteggio)'}
                        stroke="#fff" strokeWidth="2" />
                  <g className="etichetta" transform={`translate(${lx} ${ly})`} textAnchor="middle">
                    <text y="-16" fontSize="24">{on ? s.icona : '🔒'}</text>
                    <text y="10" fontSize="13" fontWeight="700" fill={on ? '#fff' : '#9AA4B0'}>
                      {s.id === 'finanza' ? 'Finanza' : NOMI[s.id]}
                    </text>
                    <text y="30" fontSize="20" fontWeight="800" fill={on ? '#fff' : '#B4BCC6'} opacity={on ? 0.95 : 1}>
                      {on ? chiave[s.id].n : 'non attivo'}
                    </text>
                  </g>
                  </g>
                </g>
              )
            })}

            {/* mozzo centrale */}
            <g pointerEvents="none">
              <circle r={R_INT - 8} fill="#fff" filter="url(#ombra-mozzo)" />
              {sopra ? (
                <>
                  <text className="mozzo-n" y="-6" textAnchor="middle" fontSize="34" fontWeight="800"
                        fill={attivo[sopra] ? SPICCHI.find(s => s.id === sopra).colori[1] : '#9AA4B0'}>
                    {attivo[sopra] ? chiave[sopra].n : '🔒'}
                  </text>
                  <text y="16" textAnchor="middle" fontSize="10.5" fill="#5B6673">{attivo[sopra] ? chiave[sopra].sotto : 'non attivo'}</text>
                  <text y="34" textAnchor="middle" fontSize="10" fontWeight="700" fill="#12233A">{attivo[sopra] ? 'Entra →' : 'Attiva →'}</text>
                </>
              ) : (
                <>
                  <text y="-4" textAnchor="middle" fontSize="13" fontWeight="800" fill="#12233A">Pmi 360°</text>
                  <text y="15" textAnchor="middle" fontSize="10.5" fill="#8A94A0">scegli un modulo</text>
                </>
              )}
            </g>
          </svg>

          {/* scorciatoie testuali (utili anche da tastiera e su schermi piccoli) */}
          <div className="legenda">
            {SPICCHI.map(s => (
              <button key={s.id} onClick={() => open(s.id)} onMouseEnter={() => setScelto(s.id)}
                      style={{ color: attivo[s.id] ? s.colori[1] : '#9AA4B0' }}>
                <span style={{ width: 9, height: 9, borderRadius: 3, background: attivo[s.id] ? s.colori[1] : '#C9D1DA' }} />
                {NOMI[s.id]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Pannello di dettaglio del modulo evidenziato ── */}
        <div className="pannello" onClick={() => open(inPannello)} style={{ cursor: 'pointer' }}>
          <div className="alone" style={{ background: attivo[inPannello] ? spPannello.colori[1] : '#C9D1DA' }} />
          <div className="kicker" style={{ color: attivo[inPannello] ? spPannello.colori[1] : '#9AA4B0' }}>{spPannello.icona} {NOMI[inPannello]}</div>

          {!attivo[inPannello] ? (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 15, color: '#5B6673', lineHeight: 1.5 }}>Questo modulo non è attivo per <strong>{azienda?.nome}</strong>.</div>
              <div className="cta" style={{ color: '#8A94A0' }}>Attivalo in Impostazioni →</div>
            </div>
          ) : inPannello === 'rischi' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12 }}>
                <span className="huge">{d.rischi.n}</span><span style={{ fontSize: 14, color: '#8A94A0' }}>rischi mappati</span>
              </div>
              <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: '#F0F3F7', marginTop: 20 }}>
                {TIER.map(t => d.rischi.tiers[t.key] > 0 && <div key={t.key} title={`${t.label}: ${d.rischi.tiers[t.key]}`} style={{ width: `${(d.rischi.tiers[t.key] / rTot) * 100}%`, background: t.col }} />)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12 }}>
                {TIER.map(t => (
                  <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#5B6673' }}>
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: t.col }} /><strong style={{ color: '#12233A' }}>{d.rischi.tiers[t.key]}</strong> {t.label}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}><span className="chip">{d.rischi.azioni} azioni nel piano</span></div>
              <div className="cta" style={{ color: spPannello.colori[1] }}>Apri il cruscotto →</div>
            </div>
          ) : inPannello === 'procedure' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
                <span className="huge">{d.procedure.n}</span><span style={{ fontSize: 14, color: '#8A94A0' }}>adottate su {d.procedure.catalogo}</span>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: '#EDF2F0', overflow: 'hidden', marginTop: 20 }}>
                <div style={{ height: '100%', width: `${d.procedure.catalogo ? Math.min(100, (d.procedure.n / d.procedure.catalogo) * 100) : 0}%`, background: 'linear-gradient(90deg,#37C79C,#128A66)', borderRadius: 5 }} />
              </div>
              <div style={{ fontSize: 12.5, color: '#5B6673', marginTop: 12 }}><strong style={{ color: '#12233A' }}>{d.procedure.personalizzate}</strong> personalizzate per l'azienda</div>
              <div className="cta" style={{ color: spPannello.colori[1] }}>Apri le procedure →</div>
            </div>
          ) : inPannello === 'governance' ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
                <span className="huge">{d.governance.n}</span><span style={{ fontSize: 14, color: '#8A94A0' }}>organi · {d.governance.componenti} componenti</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
                {d.governance.organi.slice(0, 6).map(o => <span key={o.id} className="chip" style={{ background: '#EFEDFB', color: '#5A4FC0' }}>{o.nome}</span>)}
                {d.governance.organi.length === 0 && <span style={{ fontSize: 13, color: '#98A2AE' }}>Nessun organo ancora creato</span>}
              </div>
              <div style={{ fontSize: 12.5, color: '#5B6673', marginTop: 14 }}>
                {d.governance.prossima ? <>Prossima riunione <strong style={{ color: '#12233A' }}>{fmt(d.governance.prossima)}</strong></> : 'Nessuna riunione in agenda'}
              </div>
              <div className="cta" style={{ color: spPannello.colori[1] }}>Apri la governance →</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 12 }}>
                <span className="huge">{d.finanza.documenti}</span><span style={{ fontSize: 14, color: '#8A94A0' }}>documenti contabili</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginTop: 20 }}>
                <div style={{ background: '#FBF6EC', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9A7A3E' }}>Budget</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#12233A' }}>{d.finanza.budget}</div>
                  <div style={{ fontSize: 11, color: '#8A94A0' }}>{d.finanza.ultimoAnno ? `ultimo: ${d.finanza.ultimoAnno}` : 'nessuno'}</div>
                </div>
                <div style={{ background: '#FBF6EC', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11, color: '#9A7A3E' }}>Saldo di cassa</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#12233A' }}>{d.finanza.kpi ? eur(d.finanza.kpi.saldo_corrente) : '—'}</div>
                  <div style={{ fontSize: 11, color: '#8A94A0', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {d.finanza.kpi?.semaforo && <span style={{ width: 8, height: 8, borderRadius: '50%', background: SEMAFORO[d.finanza.kpi.semaforo] || '#C9D1DA' }} />}
                    {d.finanza.kpi ? `al ${fmtL(d.finanza.kpi.data_snapshot)}` : 'tesoreria non elaborata'}
                  </div>
                </div>
                {d.finanza.kpi && (
                  <div style={{ background: '#FBF6EC', borderRadius: 12, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#9A7A3E' }}>DSO / DPO</div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#12233A' }}>{Math.round(d.finanza.kpi.dso_giorni || 0)} / {Math.round(d.finanza.kpi.dpo_giorni || 0)}</div>
                    <div style={{ fontSize: 11, color: '#8A94A0' }}>giorni incasso / pagamento</div>
                  </div>
                )}
              </div>
              <div className="cta" style={{ color: spPannello.colori[1] }}>Apri Finanza e Controllo →</div>
            </div>
          )}
        </div>
      </div>
      {versione && (
        <div style={{ textAlign: 'center', fontSize: 11.5, color: '#8A94A0', padding: '18px 0 6px' }}>
          Versione {versione.codice}{versione.pubblicata ? ` · pubblicata il ${versione.pubblicata.replace(', ', ' alle ')}` : ''}
        </div>
      )}
    </div>
  )
}
