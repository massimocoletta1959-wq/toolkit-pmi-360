import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { INQUADRAMENTI_INPS, CCNL_COMUNI } from '../lib/lavoro'
import { useApp } from '../App'
import { RISCHI_DEFAULT, RISCHI_PER_SETTORE, RISCHI_231_EDILIZIA, RISCHI_231_GENERICO } from '../lib/constants'
import { etichettaModulo } from '../lib/modalitaSolo'

const SETTORI = ['Manifatturiero','Servizi','Commercio','Edilizia','Sanità','Tecnologia','Agricoltura','Trasporti','Altro']
const DIMENSIONI = ['Micro (< 10 dipendenti)','Piccola (10-49)','Media (50-249)','Grande (250+)']

function pivaValida(p) {
  if (!/^[0-9]{11}$/.test(p)) return false
  let s = 0
  for (let i = 0; i < 11; i++) {
    let n = p.charCodeAt(i) - 48
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9 }
    s += n
  }
  return s % 10 === 0
}

export default function Impostazioni() {
  const { azienda, aziende, profilo, session, switchAzienda, reload, logout, onNuovaAzienda } = useApp()
  const [delConfirm, setDelConfirm] = useState(false)
  const [delNome, setDelNome]       = useState('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)
  const [editMode, setEditMode]     = useState(false)
  const [editForm, setEditForm]     = useState({ nome: '', piva: '', settore: '', dimensione: '', ccnl: '', mensilita: '', inquadramento_inps: '', numero_dipendenti: '', tasso_inail_pct: '', aliquota_inps_datore_pct: '' })
  const [lic, setLic]               = useState(null)
  const [modLoading, setModLoading] = useState(null)
  const [soloLoading, setSoloLoading] = useState(false)
  const [soggettoLoading, setSoggettoLoading] = useState(false)
  const [impRischi, setImpRischi]   = useState(false)   // mostra la finestra import rischi
  const [impScelta, setImpScelta]   = useState(null)
  const [impLoading, setImpLoading] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    supabase.from('gestori')
      .select('incl_rischi,incl_procedure,incl_governance')
      .eq('user_id', session.user.id).maybeSingle()
      .then(({ data }) => setLic(data || null))
  }, [session])

  async function toggleModulo(campo, incluso) {
    if (!incluso) return
    setModLoading(campo)
    const attivando = !azienda[campo]   // true = sto accendendo il modulo
    await supabase.from('aziende').update({ [campo]: !azienda[campo] }).eq('id', azienda.id)
    await reload()
    setModLoading(null)
    // se attivo i Rischi e l'azienda non ne ha ancora, propongo l'import
    if (campo === 'mod_rischi' && attivando) {
      const { count } = await supabase.from('rischi')
        .select('id', { count: 'exact', head: true }).eq('azienda_id', azienda.id)
      if (!count) { setImpScelta(null); setImpRischi(true) }
    }
  }

  async function importaRischi() {
    if (!impScelta || impScelta === 'nessuno') { setImpRischi(false); return }
    setImpLoading(true); setError(null)
    const set  = RISCHI_PER_SETTORE[azienda.settore] || []
    const r231 = azienda.settore === 'Edilizia' ? RISCHI_231_EDILIZIA : RISCHI_231_GENERICO
    let lista = []
    if (impScelta === 'standard') lista = [...RISCHI_DEFAULT]
    if (impScelta === 'settore')  lista = [...set]
    if (impScelta === 'tutti')    lista = [...RISCHI_DEFAULT, ...set]
    if (impScelta === 'tutti231') lista = [...RISCHI_DEFAULT, ...set, ...r231]
    if (impScelta === 'solo231')  lista = [...r231]
    if (lista.length) {
      const payload = lista.map(r => ({ ...r, azienda_id: azienda.id }))
      const { error: err } = await supabase.from('rischi').insert(payload)
      if (err) { setError(err.message); setImpLoading(false); return }
    }
    setImpLoading(false); setImpRischi(false)
    await reload()
  }

  async function impostaTipoSoggetto(val) {
    if (val === azienda.tipo_soggetto) return
    setSoggettoLoading(true)
    const payload = { tipo_soggetto: val }
    if (val === 'individuale' && !azienda.modalita_solo) payload.modalita_solo = true // proposta automatica, resta modificabile
    await supabase.from('aziende').update(payload).eq('id', azienda.id)
    await reload()
    setSoggettoLoading(false)
  }

  async function toggleModalitaSolo() {
    setSoloLoading(true)
    await supabase.from('aziende').update({ modalita_solo: !azienda.modalita_solo }).eq('id', azienda.id)
    await reload()
    setSoloLoading(false)
  }

  async function eliminaAzienda() {
    if (delNome !== azienda.nome) { setError('Il nome inserito non corrisponde.'); return }
    setLoading(true); setError(null)
    const aid = azienda.id
    await supabase.from('ticket').delete().eq('azienda_id', aid)
    await supabase.from('azioni').delete().eq('azienda_id', aid)
    await supabase.from('rischi').delete().eq('azienda_id', aid)
    await supabase.from('membri').delete().eq('azienda_id', aid)
    await supabase.from('utente_aziende').delete().eq('azienda_id', aid)
    const { error: err } = await supabase.from('aziende').delete().eq('id', aid)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false); setDelConfirm(false)
    await reload()
    const rimanenti = aziende.filter(a => a.id !== aid)
    if (rimanenti.length > 0) switchAzienda(rimanenti[0])
    else logout()
  }

  async function salvaModifiche() {
    setLoading(true); setError(null)
    const nomeClean = editForm.nome.trim()
    const pivaClean = (editForm.piva || '').replace(/[^0-9]/g, '')
    if (pivaClean && !pivaValida(pivaClean)) {
      setError('Partita IVA non valida: controlla le 11 cifre.')
      setLoading(false); return
    }
    if (pivaClean) {
      const { data: dup } = await supabase.from('aziende').select('id, nome').eq('piva', pivaClean).neq('id', azienda.id).limit(1)
      if (dup && dup.length > 0) {
        setError('Hai gia un\'altra azienda con questa Partita IVA: "' + dup[0].nome + '".')
        setLoading(false); return
      }
    }
    if (nomeClean.toLowerCase() !== (azienda.nome || '').toLowerCase()) {
      const { data: dupNome } = await supabase.from('aziende').select('id, nome').ilike('nome', nomeClean).neq('id', azienda.id).limit(1)
      if (dupNome && dupNome.length > 0) {
        const conferma = window.confirm('Hai gia un\'azienda chiamata "' + dupNome[0].nome + '". Vuoi davvero usare lo stesso nome?')
        if (!conferma) { setLoading(false); return }
      }
    }
    const { error: err } = await supabase.from('aziende')
      .update({ nome: nomeClean, settore: editForm.settore || null, dimensione: editForm.dimensione || null, piva: pivaClean || null, logo_url: editForm.logo_url || null,
        ccnl: editForm.ccnl.trim() || null, mensilita: editForm.mensilita ? Number(editForm.mensilita) : null,
        inquadramento_inps: editForm.inquadramento_inps || null,
        numero_dipendenti: editForm.numero_dipendenti === '' ? null : parseInt(editForm.numero_dipendenti, 10),
        tasso_inail_pct: editForm.tasso_inail_pct === '' ? null : Number(String(editForm.tasso_inail_pct).replace(',', '.')),
        aliquota_inps_datore_pct: editForm.aliquota_inps_datore_pct === '' ? null : Number(String(editForm.aliquota_inps_datore_pct).replace(',', '.')) })
      .eq('id', azienda.id)
    if (err) { setError(err.message); setLoading(false); return }
    setLoading(false); setEditMode(false)
    await reload()
  }

  async function caricaLogo(file) {
    if (!file) return
    setError(null)
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'svg', 'webp'].includes(ext)) { setError('Formato logo non valido: usa PNG, JPG, SVG o WEBP.'); return }
    const percorso = azienda.id + '/logo.' + ext
    const { error: err } = await supabase.storage.from('loghi').upload(percorso, file, { upsert: true })
    if (err) { setError('Upload logo: ' + err.message); return }
    const { data } = supabase.storage.from('loghi').getPublicUrl(percorso)
    const url = data.publicUrl + '?v=' + Date.now()
    setEditForm(f => ({ ...f, logo_url: url }))
    // Salvataggio immediato su DB, così il logo c'è anche senza premere Salva
    await supabase.from('aziende').update({ logo_url: url }).eq('id', azienda.id)
    await reload()
  }

  return (
    <div>
      <div className="page-header">
        <h2>Impostazioni</h2>
        <p>Gestione delle aziende e dei dati</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">👤 Profilo consulente</span></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 14 }}>
          <div><span style={{ color: '#888', fontSize: 12 }}>Nome</span><div style={{ fontWeight: 600 }}>{profilo?.nome || '—'}</div></div>
          <div><span style={{ color: '#888', fontSize: 12 }}>Email</span><div>{profilo?.email}</div></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">🏢 Aziende gestite ({aziende.length})</span>
          <button className="btn btn-sm btn-primary" onClick={onNuovaAzienda}>+ Nuova azienda</button>
        </div>
        {aziende.length === 0 ? (
          <div className="empty-state"><p>Nessuna azienda.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aziende.map(az => (
              <div key={az.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: az.id === azienda?.id ? '#EBF4FC' : '#F7F8FA', border: `1px solid ${az.id === azienda?.id ? '#B5D4F4' : '#E0E0E0'}` }}>
                <div>
                  <div style={{ fontWeight: 600, color: az.id === azienda?.id ? '#1A3A5C' : '#333', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {az.nome}
                    {az.id === azienda?.id && <span style={{ fontSize: 11, background: '#2B5FA5', color: 'white', padding: '1px 7px', borderRadius: 10 }}>Attiva</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {az.settore && <span style={{ marginRight: 8 }}>📂 {az.settore}</span>}
                    {az.dimensione && <span>👥 {az.dimensione}</span>}
                  </div>
                </div>
                {az.id !== azienda?.id && (
                  <button className="btn btn-sm btn-primary" onClick={() => switchAzienda(az)}>Passa a questa →</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">ℹ️ Dettagli azienda attiva</span>
          {!editMode && (
            <button className="btn btn-sm" onClick={() => {
              setEditForm({ nome: azienda?.nome || '', piva: azienda?.piva || '', settore: azienda?.settore || '', dimensione: azienda?.dimensione || '', logo_url: azienda?.logo_url || '',
                ccnl: azienda?.ccnl || '', mensilita: azienda?.mensilita ?? '', inquadramento_inps: azienda?.inquadramento_inps || '',
                numero_dipendenti: azienda?.numero_dipendenti ?? '', tasso_inail_pct: azienda?.tasso_inail_pct ?? '', aliquota_inps_datore_pct: azienda?.aliquota_inps_datore_pct ?? '' })
              setEditMode(true); setError(null)
            }}>✏️ Modifica</button>
          )}
        </div>
        {!editMode ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 14 }}>
            <div><span style={{ color: '#888', fontSize: 12 }}>Nome</span><div style={{ fontWeight: 600 }}>{azienda?.nome}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Partita IVA</span><div>{azienda?.piva || '—'}</div></div>
            {azienda?.codice_fiscale && <div><span style={{ color: '#888', fontSize: 12 }}>Codice fiscale</span><div>{azienda.codice_fiscale}</div></div>}
            {azienda?.forma_giuridica && <div><span style={{ color: '#888', fontSize: 12 }}>Forma giuridica</span><div>{azienda.forma_giuridica}</div></div>}
            <div><span style={{ color: '#888', fontSize: 12 }}>Settore</span><div>{azienda?.settore || '—'}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Dimensione</span><div>{azienda?.dimensione || '—'}</div></div>
            {azienda?.rea && <div><span style={{ color: '#888', fontSize: 12 }}>REA</span><div>{azienda.rea}</div></div>}
            {azienda?.pec && <div><span style={{ color: '#888', fontSize: 12 }}>PEC</span><div>{azienda.pec}</div></div>}
            {azienda?.ateco && <div><span style={{ color: '#888', fontSize: 12 }}>ATECO</span><div>{azienda.ateco}{azienda?.attivita ? ' · ' + azienda.attivita : ''}</div></div>}
            {azienda?.capitale_sociale && <div><span style={{ color: '#888', fontSize: 12 }}>Capitale sociale</span><div>{azienda.capitale_sociale}</div></div>}
            {azienda?.data_costituzione && <div><span style={{ color: '#888', fontSize: 12 }}>Costituzione</span><div>{new Date(azienda.data_costituzione).toLocaleDateString('it-IT')}</div></div>}
            {(azienda?.sede_via || azienda?.sede_comune) && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#888', fontSize: 12 }}>Sede legale</span>
                <div>{[azienda.sede_via, [azienda.sede_cap, azienda.sede_comune].filter(Boolean).join(' '), azienda.sede_provincia ? '(' + azienda.sede_provincia + ')' : ''].filter(Boolean).join(', ')}</div>
              </div>
            )}
            {azienda?.oggetto_sociale && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ color: '#888', fontSize: 12 }}>Oggetto sociale</span>
                <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{azienda.oggetto_sociale}</div>
              </div>
            )}
            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #EEE', paddingTop: 10, fontSize: 12, color: '#1A3A5C', fontWeight: 600 }}>Lavoro dipendente</div>
            <div><span style={{ color: '#888', fontSize: 12 }}>CCNL applicato</span><div>{azienda?.ccnl || '—'}{azienda?.mensilita ? ` · ${azienda.mensilita} mensilità` : ''}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Inquadramento INPS</span><div>{INQUADRAMENTI_INPS[azienda?.inquadramento_inps] || '—'}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Dipendenti</span><div>{azienda?.numero_dipendenti ?? '—'}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Contributi a carico azienda</span><div>{azienda?.aliquota_inps_datore_pct != null ? `INPS ${String(azienda.aliquota_inps_datore_pct).replace('.', ',')}%` : 'INPS —'} · {azienda?.tasso_inail_pct != null ? `INAIL ${String(azienda.tasso_inail_pct).replace('.', ',')}%` : 'INAIL —'}</div></div>
            <div><span style={{ color: '#888', fontSize: 12 }}>Logo</span><div>{azienda?.logo_url ? <img src={azienda.logo_url} alt="logo" style={{ maxHeight: 36, marginTop: 2 }} /> : '—'}</div></div>
          </div>
        ) : (
          <div>
            {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nome azienda</label>
                <input className="form-control" value={editForm.nome} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Partita IVA</label>
                <input className="form-control" value={editForm.piva} onChange={e => setEditForm({ ...editForm, piva: e.target.value })} maxLength={11} inputMode="numeric" placeholder="11 cifre" />
              </div>
              <div className="form-group">
                <label className="form-label">Settore</label>
                <select className="form-control" value={editForm.settore} onChange={e => setEditForm({ ...editForm, settore: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {SETTORI.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dimensione</label>
                <select className="form-control" value={editForm.dimensione} onChange={e => setEditForm({ ...editForm, dimensione: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {DIMENSIONI.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3A5C', margin: '6px 0 2px' }}>Lavoro dipendente</div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
              Servono alla simulazione d'impatto delle assunzioni. Le aliquote effettive si leggono sul cedolino o si chiedono al consulente del lavoro; il tasso INAIL è sull'avviso di pagamento INAIL.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">CCNL applicato</label>
                <input className="form-control" list="ccnl-comuni" value={editForm.ccnl} onChange={e => setEditForm({ ...editForm, ccnl: e.target.value })} placeholder="Scegli o scrivi…" />
                <datalist id="ccnl-comuni">{CCNL_COMUNI.map(c => <option key={c} value={c} />)}</datalist>
              </div>
              <div className="form-group">
                <label className="form-label">Mensilità</label>
                <select className="form-control" value={editForm.mensilita} onChange={e => setEditForm({ ...editForm, mensilita: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {[13, 14, 15].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Inquadramento INPS</label>
                <select className="form-control" value={editForm.inquadramento_inps} onChange={e => setEditForm({ ...editForm, inquadramento_inps: e.target.value })}>
                  <option value="">Seleziona...</option>
                  {Object.entries(INQUADRAMENTI_INPS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Numero dipendenti</label>
                <input className="form-control" type="number" min="0" step="1" value={editForm.numero_dipendenti} onChange={e => setEditForm({ ...editForm, numero_dipendenti: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Aliquota INPS a carico azienda (%)</label>
                <input className="form-control" type="number" min="0" max="50" step="0.01" value={editForm.aliquota_inps_datore_pct} onChange={e => setEditForm({ ...editForm, aliquota_inps_datore_pct: e.target.value })} placeholder="es. 29,98" />
              </div>
              <div className="form-group">
                <label className="form-label">Tasso INAIL (%)</label>
                <input className="form-control" type="number" min="0" max="30" step="0.001" value={editForm.tasso_inail_pct} onChange={e => setEditForm({ ...editForm, tasso_inail_pct: e.target.value })} placeholder="es. 0,85" />
              </div>
            </div>
            <div className="form-group" style={{ marginTop: 4 }}>
              <label className="form-label">Logo aziendale (per i documenti generati)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {editForm.logo_url && <img src={editForm.logo_url} alt="logo" style={{ maxHeight: 44, maxWidth: 140, border: '1px solid #E0E0E0', borderRadius: 6, padding: 3 }} />}
                <input type="file" accept="image/*" onChange={e => caricaLogo(e.target.files[0])} />
                {editForm.logo_url && <button className="btn btn-sm" onClick={() => setEditForm(f => ({ ...f, logo_url: '' }))}>Rimuovi</button>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button className="btn" onClick={() => { setEditMode(false); setError(null) }}>Annulla</button>
              <button className="btn btn-primary" onClick={salvaModifiche} disabled={loading || !editForm.nome.trim()}>{loading ? 'Salvataggio...' : '💾 Salva modifiche'}</button>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">🧩 Moduli attivi</span></div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          Attiva o disattiva i moduli per <strong>{azienda?.nome}</strong>. Puoi attivare solo i moduli inclusi nella tua licenza.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { campo: 'mod_rischi',     incl: 'incl_rischi',     label: `Gestione ${etichettaModulo('rischi', 'Rischi', !!azienda?.modalita_solo)}`, desc: "Registro rischi, piano d'azione, cruscotto", colore: '#378ADD' },
            { campo: 'mod_procedure',  incl: 'incl_procedure',  label: etichettaModulo('procedure', 'Procedure', !!azienda?.modalita_solo), desc: 'Catalogo, adozione e presa visione',        colore: '#1D9E75' },
            { campo: 'mod_governance', incl: 'incl_governance', label: 'Governance',      desc: 'Organi, riunioni, delibere e verbali',      colore: '#7F77DD' },
          ].map(m => {
            const incluso = lic ? !!lic[m.incl] : true
            const on = !!azienda?.[m.campo]
            return (
              <div key={m.campo} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: '#F7F8FA', border: '1px solid #E0E0E0', opacity: incluso ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: on ? m.colore : '#C8C8C8' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#333' }}>{m.label}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>{incluso ? m.desc : 'Non incluso nella licenza'}</div>
                  </div>
                </div>
                <button
                  className={`btn btn-sm${on ? ' btn-primary' : ''}`}
                  disabled={!incluso || modLoading === m.campo}
                  onClick={() => toggleModulo(m.campo, incluso)}
                >
                  {modLoading === m.campo ? '…' : on ? '✓ Attivo' : 'Attiva'}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">🏷️ Tipo di soggetto</span></div>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
          Definisce se <strong>{azienda?.nome}</strong> è una società di capitali (con organo amministrativo) o un'impresa individuale/professionista senza organi.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className={`btn btn-sm${azienda?.tipo_soggetto !== 'individuale' ? ' btn-primary' : ''}`}
            disabled={soggettoLoading}
            onClick={() => impostaTipoSoggetto('societa')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {soggettoLoading ? '…' : '🏢 Società di capitali'}
          </button>
          <button
            className={`btn btn-sm${azienda?.tipo_soggetto === 'individuale' ? ' btn-primary' : ''}`}
            disabled={soggettoLoading}
            onClick={() => impostaTipoSoggetto('individuale')}
            style={{ flex: 1, justifyContent: 'center' }}
          >
            {soggettoLoading ? '…' : '🧑‍💼 Impresa individuale / Professionista'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-title">🧑‍💼 Modalità Solo</span></div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: 8, background: '#F7F8FA', border: '1px solid #E0E0E0' }}>
          <div>
            <div style={{ fontWeight: 600, color: '#333' }}>Imprenditore senza struttura (solopreneur)</div>
            <div style={{ fontSize: 12, color: '#888' }}>Semplifica l'app per <strong>{azienda?.nome}</strong> nascondendo le voci pensate per organizzazioni con più persone (es. Organigramma).</div>
          </div>
          <button
            className={`btn btn-sm${azienda?.modalita_solo ? ' btn-primary' : ''}`}
            disabled={soloLoading}
            onClick={toggleModalitaSolo}
          >
            {soloLoading ? '…' : azienda?.modalita_solo ? '✓ Attiva' : 'Attiva'}
          </button>
        </div>
      </div>

      <div className="card" style={{ border: '1px solid #FFAAAA' }}>
        <div className="card-header"><span className="card-title" style={{ color: '#C0392B' }}>⚠️ Zona di pericolo</span></div>
        <p style={{ fontSize: 13, color: '#555', marginBottom: 16 }}>L'eliminazione è <strong>irreversibile</strong>. Verranno cancellati tutti i rischi, le azioni, i ticket e i membri dell'azienda <strong>{azienda?.nome}</strong>.</p>
        {!delConfirm ? (
          <button className="btn btn-danger" onClick={() => setDelConfirm(true)}>🗑️ Elimina azienda "{azienda?.nome}"</button>
        ) : (
          <div style={{ background: '#FCEBEB', borderRadius: 8, padding: 16 }}>
            <p style={{ fontSize: 13, color: '#C0392B', marginBottom: 12 }}>Per confermare scrivi: <strong>{azienda?.nome}</strong></p>
            {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
            <input className="form-control" value={delNome} onChange={e => { setDelNome(e.target.value); setError(null) }} placeholder={`Scrivi "${azienda?.nome}" per confermare`} style={{ marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => { setDelConfirm(false); setDelNome(''); setError(null) }}>Annulla</button>
              <button className="btn btn-danger" onClick={eliminaAzienda} disabled={loading || delNome !== azienda?.nome}>{loading ? 'Eliminazione...' : 'Elimina definitivamente'}</button>
            </div>
          </div>
        )}
      </div>

      {impRischi && (() => {
        const settore = azienda?.settore
        const set  = RISCHI_PER_SETTORE[settore] || []
        const haSet = set.length > 0
        const nStd = RISCHI_DEFAULT.length
        const nSet = set.length
        const r231 = settore === 'Edilizia' ? RISCHI_231_EDILIZIA : RISCHI_231_GENERICO
        const n231 = r231.length
        const opt = (val, titolo, badge, giallo) => (
          <div onClick={() => setImpScelta(val)} style={{ cursor:'pointer', padding:'12px 14px', border:`2px solid ${impScelta===val ? (giallo?'#856404':'#2B5FA5') : '#E0E0E0'}`, borderRadius:8, background: impScelta===val ? (giallo?'#FEF9E7':'#EBF4FC') : 'white', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontWeight:600, color: giallo?'#856404':'#1A3A5C', fontSize:13 }}>{titolo}</div>
            {badge != null && <span style={{ fontSize:11, fontWeight:600, color: giallo?'#856404':'#2B5FA5', background: giallo?'#FEF9E7':'#EBF4FC', padding:'2px 8px', borderRadius:20 }}>{badge}</span>}
          </div>
        )
        return (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
            <div className="card" style={{ maxWidth:480, width:'100%' }}>
              <div className="card-header"><span className="card-title">🛡️ Importa i rischi standard</span></div>
              <div className="card-body">
                <p style={{ fontSize:13, color:'#666', marginBottom:14 }}>Hai attivato il modulo Rischi per <strong>{azienda?.nome}</strong>. Vuoi partire da una lista di rischi predefiniti?</p>
                {error && <div className="alert alert-error" style={{ marginBottom:10 }}>{error}</div>}
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:16 }}>
                  {opt('standard', '📋 Solo rischi standard', nStd)}
                  {haSet && opt('settore', `🏗️ Solo rischi ${settore}`, nSet)}
                  {haSet && opt('tutti', `✅ Tutti — standard + ${settore}`, nStd + nSet)}
                  {opt('solo231', '⚖️ Solo Rischi 231', n231, true)}
                  {opt('tutti231', '🏆 Copertura completa + 231', nStd + nSet + n231, true)}
                  {opt('nessuno', 'Parto da zero — nessun rischio', null)}
                </div>
                <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                  <button className="btn" onClick={() => setImpRischi(false)} disabled={impLoading}>Chiudi</button>
                  <button className="btn btn-primary" onClick={importaRischi} disabled={!impScelta || impLoading}>
                    {impLoading ? 'Importazione…' : (impScelta === 'nessuno' ? 'Ok, parto da zero' : 'Importa i rischi')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
