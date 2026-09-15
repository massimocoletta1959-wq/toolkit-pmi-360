import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { RISCHI_DEFAULT, RISCHI_PER_SETTORE, RISCHI_231_EDILIZIA, RISCHI_231_GENERICO } from '../lib/constants'
import { etichettaModulo } from '../lib/modalitaSolo'

const SETTORI = ['Manifatturiero','Servizi','Commercio','Edilizia','Hotel','Sanità','Tecnologia','Agricoltura','Trasporti','Altro']
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

export default function Setup({ onDone, onAnnulla, userId, userEmail, nuovaAzienda = false }) {
  async function esci() {
    try { await supabase.auth.signOut() } catch (_e) {}
    localStorage.clear(); sessionStorage.clear(); window.location.reload()
  }
  const [step, setStep]         = useState(1)
  const [nome, setNome]         = useState('')
  const [piva, setPiva]         = useState('')
  const [settore, setSettore]   = useState('')
  const [dimensione, setDimensione] = useState('')
  const [nomeProfilo, setNomeProfilo] = useState('')
  const [modalitaSolo, setModalitaSolo] = useState(false)
  const [tipoSoggetto, setTipoSoggetto] = useState('societa')
  function selezionaTipoSoggetto(val) {
    setTipoSoggetto(val)
    if (val === 'individuale') setModalitaSolo(true) // proposta automatica, resta modificabile
  }
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [aziendaId, setAziendaId] = useState(null)
  const [scelta, setScelta]     = useState(null)
  const [visuraData, setVisuraData]       = useState(null)
  const [visuraLoading, setVisuraLoading] = useState(false)
  const [visuraError, setVisuraError]     = useState(null)

  // moduli (passo 2)
  const [modRischi, setModRischi]         = useState(true)
  const [modProcedure, setModProcedure]   = useState(true)
  const [modGovernance, setModGovernance] = useState(true)
  // licenza: undefined=caricamento, null=nessuna, oggetto=licenza registrata
  const [lic, setLic] = useState(undefined)
  useEffect(() => {
    if (!userId) { setLic(null); return }
    supabase.from('gestori').select('incl_rischi,incl_procedure,incl_governance')
      .eq('user_id', userId).maybeSingle()
      .then(({ data }) => setLic(data || null))
  }, [userId])
  const incl = m => (lic ? !!lic['incl_' + m] : true)   // nessuna licenza registrata = tutto consentito
  useEffect(() => {
    if (lic === undefined) return
    setModRischi(incl('rischi')); setModProcedure(incl('procedure')); setModGovernance(incl('governance'))
  }, [lic])

  const haSettore  = !!(RISCHI_PER_SETTORE[settore]?.length)
  const ha231Edil  = settore === 'Edilizia'
  const rischi231  = ha231Edil ? RISCHI_231_EDILIZIA : RISCHI_231_GENERICO
  const num231     = rischi231.length
  const label231   = ha231Edil ? 'Edilizia (D.Lgs. 231/01)' : 'PMI Generiche (D.Lgs. 231/01)'
  const numStd     = RISCHI_DEFAULT.length
  const numSet     = RISCHI_PER_SETTORE[settore]?.length || 0

  // -------- PASSO 1: crea l'azienda (senza governance: spostata al passo 3) --------
  async function handleStep1(e) {
    e.preventDefault()
    setLoading(true); setError(null)

    const pivaClean = piva.replace(/[^0-9]/g, '')
    if (pivaClean && !pivaValida(pivaClean)) {
      setError('Partita IVA non valida: controlla le 11 cifre.')
      setLoading(false); return
    }
    if (pivaClean) {
      const { data: dup } = await supabase.from('aziende').select('id, nome').eq('piva', pivaClean).limit(1)
      if (dup && dup.length > 0) {
        setError('Hai gia un\'azienda con questa Partita IVA: "' + dup[0].nome + '".')
        setLoading(false); return
      }
    }
    const { data: dupNome } = await supabase.from('aziende').select('id, nome').ilike('nome', nome.trim()).limit(1)
    if (dupNome && dupNome.length > 0) {
      const conferma = window.confirm('Hai gia un\'azienda chiamata "' + dupNome[0].nome + '". Vuoi crearne davvero un\'altra con lo stesso nome?')
      if (!conferma) { setLoading(false); return }
    }

    // Genero l'id lato client: appena creata, l'azienda non è ancora collegata a
    // nessun utente in utente_aziende, quindi non sarebbe visibile per un
    // .select() successivo (RLS) — evitando il round-trip non serve rileggerla.
    const azId = crypto.randomUUID()
    const a = visuraData?.azienda || {}
    const { error: e1 } = await supabase.from('aziende')
      .insert({
        id: azId,
        nome: nome.trim(), settore, dimensione, piva: pivaClean || null,
        codice_fiscale: a.codice_fiscale || null,
        forma_giuridica: a.forma_giuridica || null,
        rea: a.rea || null,
        pec: a.pec || null,
        sede_via: a.sede_via || null,
        sede_comune: a.sede_comune || null,
        sede_provincia: a.sede_provincia || null,
        sede_cap: a.sede_cap || null,
        capitale_sociale: a.capitale_sociale || null,
        data_costituzione: a.data_costituzione || null,
        ateco: a.ateco || null,
        attivita: a.attivita || null,
        oggetto_sociale: a.oggetto_sociale || null,
        modalita_solo: modalitaSolo,
        tipo_soggetto: tipoSoggetto,
      })
    if (e1) { setError(e1.message); setLoading(false); return }

    if (!nuovaAzienda) {
      const { error: e2 } = await supabase.from('profili')
        .insert({ id: userId, email: userEmail, nome: nomeProfilo, azienda_id: azId })
      if (e2) { setError(e2.message); setLoading(false); return }
    }

    const { error: e3 } = await supabase.from('utente_aziende')
      .insert({ utente_id: userId, azienda_id: azId })
    if (e3 && !e3.message.includes('unique')) {
      setError(e3.message); setLoading(false); return
    }

    setAziendaId(azId)
    setLoading(false)
    setStep(2)
  }

  async function importaVisura(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setVisuraLoading(true); setVisuraError(null)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1])
        r.onerror = () => rej(new Error('lettura del file fallita'))
        r.readAsDataURL(file)
      })
      const { data, error: err } = await supabase.functions.invoke('extract-visura', { body: { pdf_base64: b64 } })
      if (err) throw err
      if (data?.error) throw new Error(data.error)
      const a = data.azienda || {}
      setNome(a.denominazione || '')
      setPiva((a.partita_iva || '').replace(/[^0-9]/g, ''))
      setSettore(a.settore_suggerito === 'edilizia' ? 'Edilizia' : 'Servizi')
      setVisuraData(data)
    } catch (err) {
      setVisuraError('Non sono riuscito a leggere la visura: ' + (err.message || String(err)))
    } finally {
      setVisuraLoading(false)
    }
  }

  // -------- PASSO 3: applica moduli + dati di default, poi entra --------
  async function finalizza() {
    setLoading(true); setError(null)
    try {
      // 1) salva i moduli attivi sull'azienda (stesse colonne usate dalle Impostazioni)
      const { error: eM } = await supabase.from('aziende').update({
        mod_rischi:     modRischi && incl('rischi'),
        mod_procedure:  modProcedure && incl('procedure'),
        mod_governance: modGovernance && incl('governance'),
      }).eq('id', aziendaId)
      if (eM) throw eM

      // 2) RISCHI: carica la lista scelta (se il modulo e' attivo)
      if (modRischi && scelta && scelta !== 'nessuno') {
        let lista = []
        if (scelta === 'standard') lista = [...RISCHI_DEFAULT]
        if (scelta === 'settore')  lista = [...(RISCHI_PER_SETTORE[settore] || [])]
        if (scelta === 'tutti')    lista = [...RISCHI_DEFAULT, ...(RISCHI_PER_SETTORE[settore] || [])]
        if (scelta === 'tutti231') lista = [...RISCHI_DEFAULT, ...(RISCHI_PER_SETTORE[settore] || []), ...rischi231]
        if (scelta === 'solo231')  lista = [...rischi231]
        if (lista.length > 0) {
          const payload = lista.map(r => ({ ...r, azienda_id: aziendaId }))
          const { error: eR } = await supabase.from('rischi').insert(payload)
          if (eR) throw eR
        }
      }

      // 3) GOVERNANCE: se attivo e c'e' la visura, crea organo/i + componenti (dati reali dalla visura)
      if (modGovernance && visuraData?.componenti?.length) {
        try {
          const org = visuraData.organo || {}
          const isSindaco = c => /sindaco|sindaca|collegio sindacale/i.test(c.ruolo || '')
          const componentiCda       = visuraData.componenti.filter(c => !isSindaco(c))
          const componentiSindacali = visuraData.componenti.filter(isSindaco)

          async function creaComponenti(organoId, lista, ruoloDefault) {
            for (const c of lista) {
              const { data: m } = await supabase.from('membri').insert({
                azienda_id: aziendaId,
                nome: c.nome || '', cognome: c.cognome || '',
                email: c.pec || null, pec: c.pec || null,
                ruolo: c.ruolo || ruoloDefault,
              }).select().single()
              if (organoId && m) {
                await supabase.from('organo_membri').insert({
                  organo_id: organoId, membro_id: m.id, ruolo: c.ruolo || 'Componente',
                  data_nomina: c.data_nomina || null,
                })
              }
            }
          }

          const { data: organo } = await supabase.from('organi').insert({
            azienda_id: aziendaId,
            tipo: org.tipo || 'cda',
            nome: org.nome || 'Consiglio di Amministrazione',
            monocratico: org.tipo === 'amministratore_unico',
          }).select().single()
          await creaComponenti(organo?.id, componentiCda, 'Amministratore')

          if (componentiSindacali.length) {
            const { data: collegio } = await supabase.from('organi').insert({
              azienda_id: aziendaId,
              tipo: 'collegio_sindacale',
              nome: 'Collegio Sindacale',
              monocratico: false,
            }).select().single()
            await creaComponenti(collegio?.id, componentiSindacali, 'Sindaco')
          }
        } catch (gErr) { console.error('Governance da visura:', gErr) }
      }

      // 3-bis) GOVERNANCE: soci -> organo "Assemblea dei Soci" (dati reali dalla visura)
      if (modGovernance && visuraData?.soci?.length) {
        try {
          const { data: assemblea } = await supabase.from('organi').insert({
            azienda_id: aziendaId,
            tipo: 'assemblea',
            nome: 'Assemblea Generale Ordinaria dei Soci',
            monocratico: false,
          }).select().single()
          for (const s of visuraData.soci) {
            const denom = (s.denominazione || '').trim()
            if (!denom) continue
            // se persona fisica "Nome Cognome": divido; se societa': tutto in nome
            let nome = denom, cognome = ''
            if (!s.persona_giuridica) {
              const parti = denom.split(/\s+/)
              if (parti.length > 1) { nome = parti.slice(0, -1).join(' '); cognome = parti.slice(-1)[0] }
            }
            const { data: m } = await supabase.from('membri').insert({
              azienda_id: aziendaId,
              nome, cognome,
              ruolo: 'Socio',
            }).select().single()
            if (assemblea && m) {
              await supabase.from('organo_membri').insert({
                organo_id: assemblea.id, membro_id: m.id,
                ruolo: 'Socio',
                quota: (s.quota_perc != null && s.quota_perc !== '') ? Number(s.quota_perc) : null,
              })
            }
          }
        } catch (sErr) { console.error('Soci da visura:', sErr) }
      }

      setLoading(false)
      onDone(aziendaId)
    } catch (e2) {
      setError(e2.message || 'Errore nel completamento.')
      setLoading(false)
    }
  }

  const preview = scelta === 'standard' ? RISCHI_DEFAULT
    : scelta === 'settore'  ? (RISCHI_PER_SETTORE[settore] || [])
    : scelta === 'tutti'    ? [...RISCHI_DEFAULT, ...(RISCHI_PER_SETTORE[settore] || [])]
    : scelta === 'tutti231' ? [...RISCHI_DEFAULT, ...(RISCHI_PER_SETTORE[settore] || []), ...rischi231]
    : scelta === 'solo231'  ? rischi231
    : []

  const cardModulo = (attivo, setAttivo, icona, titolo, desc, abilitato = true) => (
    <div onClick={() => abilitato && setAttivo(!attivo)} style={{ cursor: abilitato ? 'pointer' : 'not-allowed', opacity: abilitato ? 1 : 0.55, padding: '14px 16px', border: `2px solid ${attivo && abilitato ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: attivo && abilitato ? '#EBF4FC' : 'white', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${attivo && abilitato ? '#2B5FA5' : '#CBD5E0'}`, background: attivo && abilitato ? '#2B5FA5' : 'white', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>{attivo && abilitato ? '✓' : ''}</div>
      <div>
        <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 14 }}>{icona} {titolo}</div>
        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{abilitato ? desc : 'Non incluso nella licenza'}</div>
      </div>
    </div>
  )

  // ============ PASSO 2: SCELTA MODULI ============
  if (step === 2) return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-logo">
          <div style={{ fontSize: 36, marginBottom: 8 }}>🧩</div>
          <h1>Quali moduli vuoi attivare?</h1>
          <p>Attiva solo ciò che serve a <strong>{nome}</strong>. Potrai cambiare in seguito.</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {cardModulo(modRischi, setModRischi, '🛡️', etichettaModulo('rischi', 'Rischi', modalitaSolo), 'Mappatura e valutazione dei rischi, azioni, registro.', incl('rischi'))}
          {cardModulo(modProcedure, setModProcedure, '📋', etichettaModulo('procedure', 'Procedure', modalitaSolo), 'Catalogo procedure per settore, approvazione e personalizzazione.', incl('procedure'))}
          {cardModulo(modGovernance, setModGovernance, '⚖️', 'Governance', 'Organi, componenti, riunioni e delibere.', incl('governance'))}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>← Indietro</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={!modRischi && !modProcedure && !modGovernance}
                  onClick={() => setStep(3)}>Avanti →</button>
        </div>
      </div>
    </div>
  )

  // ============ PASSO 3: DATI DI DEFAULT PER MODULO ============
  if (step === 3) return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <div className="login-logo">
          <div style={{ fontSize: 36, marginBottom: 8 }}>📦</div>
          <h1>Dati iniziali</h1>
          <p>Per ogni modulo attivo, scegli se partire con i dati di default</p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}

        {/* --- RISCHI --- */}
        {modRischi && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 700, color: '#1A3A5C', marginBottom: 8 }}>🛡️ {etichettaModulo('rischi', 'Rischi', modalitaSolo)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div onClick={() => setScelta('standard')} style={{ cursor: 'pointer', padding: '12px 14px', border: `2px solid ${scelta === 'standard' ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'standard' ? '#EBF4FC' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>📋 Solo rischi standard</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#2B5FA5', background: '#EBF4FC', padding: '2px 8px', borderRadius: 20 }}>{numStd}</span>
                </div>
              </div>
              {haSettore && (
                <div onClick={() => setScelta('settore')} style={{ cursor: 'pointer', padding: '12px 14px', border: `2px solid ${scelta === 'settore' ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'settore' ? '#EBF4FC' : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>🏗️ Solo rischi {settore}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2B5FA5', background: '#EBF4FC', padding: '2px 8px', borderRadius: 20 }}>{numSet}</span>
                  </div>
                </div>
              )}
              {haSettore && (
                <div onClick={() => setScelta('tutti')} style={{ cursor: 'pointer', padding: '12px 14px', border: `2px solid ${scelta === 'tutti' ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'tutti' ? '#EBF4FC' : 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>✅ Tutti — standard + {settore}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#27AE60', background: '#D5F5E3', padding: '2px 8px', borderRadius: 20 }}>{numStd + numSet}</span>
                  </div>
                </div>
              )}
              <div onClick={() => setScelta('solo231')} style={{ cursor: 'pointer', padding: '12px 14px', border: `2px solid ${scelta === 'solo231' ? '#856404' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'solo231' ? '#FEF9E7' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#856404', fontSize: 13 }}>⚖️ Solo Rischi 231 — {label231}</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#856404', background: '#FEF9E7', padding: '2px 8px', borderRadius: 20 }}>{num231}</span>
                </div>
              </div>
              <div onClick={() => setScelta('tutti231')} style={{ cursor: 'pointer', padding: '12px 14px', border: `2px solid ${scelta === 'tutti231' ? '#856404' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'tutti231' ? '#FEF9E7' : 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#856404', fontSize: 13 }}>🏆 Copertura completa + 231</div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#856404', background: '#FEF9E7', padding: '2px 8px', borderRadius: 20 }}>{numStd + numSet + num231}</span>
                </div>
              </div>
              <div onClick={() => setScelta('nessuno')} style={{ cursor: 'pointer', padding: '10px 14px', border: `2px solid ${scelta === 'nessuno' ? '#aaa' : '#E0E0E0'}`, borderRadius: 8, background: scelta === 'nessuno' ? '#F5F5F5' : 'white' }}>
                <div style={{ fontWeight: 500, color: '#888', fontSize: 12 }}>Parto da zero — inserirò i rischi manualmente</div>
              </div>
            </div>
          </div>
        )}

        {/* --- PROCEDURE --- */}
        {modProcedure && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 700, color: '#1A3A5C', marginBottom: 8 }}>📋 {etichettaModulo('procedure', 'Procedure', modalitaSolo)}</div>
            <div className="alert alert-info" style={{ margin: 0 }}>
              ✓ Le procedure standard del settore {settore || ''} saranno disponibili nel catalogo, pronte da valutare e approvare.
            </div>
          </div>
        )}

        {/* --- GOVERNANCE --- */}
        {modGovernance && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ fontWeight: 700, color: '#1A3A5C', marginBottom: 8 }}>⚖️ Governance</div>
            {visuraData?.componenti?.length ? (
              <div className="alert alert-info" style={{ margin: 0 }}>
                ✓ I dati di governance verranno creati dalla visura: organo “{visuraData.organo?.nome || 'organo'}” e {visuraData.componenti.length} componenti reali.{visuraData.soci?.length ? ` Inoltre l'Assemblea con ${visuraData.soci.length} soci e relative quote.` : ''}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#666', background: '#F7F8FA', borderRadius: 8, padding: '10px 14px' }}>
                Nessuna visura importata: il modulo sarà attivo e potrai inserire organi e componenti manualmente dalla sezione Governance.
              </div>
            )}
          </div>
        )}

        {(modRischi && scelta && scelta !== 'nessuno' && preview.length > 0) && (
          <div style={{ background: '#F7F8FA', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#666', marginBottom: 16 }}>
            Verranno caricati {preview.length} rischi.
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)} disabled={loading}>← Indietro</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}
                  disabled={loading || (modRischi && !scelta)}
                  onClick={finalizza}>
            {loading ? 'Completamento…' : 'Completa e inizia →'}
          </button>
        </div>
        {modRischi && !scelta && <div style={{ fontSize: 11, color: '#C0392B', marginTop: 8, textAlign: 'center' }}>Scegli un'opzione per i Rischi (anche "parto da zero").</div>}
      </div>
    </div>
  )

  // ============ PASSO 1: DATI AZIENDA ============
  return (
    <div className="login-page">
      <div className="login-card" style={{ maxWidth: 480 }}>
        <div className="login-logo">
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏢</div>
          <h1>{nuovaAzienda ? 'Nuova azienda' : 'Configura la tua azienda'}</h1>
          <p>Prima configurazione — ci vogliono 30 secondi</p>
          {!nuovaAzienda && (
            <p style={{ marginTop: 6, fontSize: 12.5 }}>
              Non sei tu o vuoi cambiare account?{' '}
              <button type="button" onClick={esci}
                style={{ background: 'none', border: 'none', color: '#2B5FA5', cursor: 'pointer', textDecoration: 'underline', fontSize: 12.5, padding: 0 }}>
                Esci
              </button>
            </p>
          )}
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleStep1}>
          {!nuovaAzienda && (
            <div className="form-group">
              <label className="form-label">Il tuo nome</label>
              <input className="form-control" value={nomeProfilo} onChange={e => setNomeProfilo(e.target.value)} required placeholder="Es. Mario Rossi" />
            </div>
          )}

          <div style={{ background: '#F4F9FF', border: '1px dashed #B9D4F0', borderRadius: 12, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#1A3A5C', marginBottom: 4 }}>📄 Importa da visura camerale</div>
            <div style={{ fontSize: 12, color: '#6B7683', marginBottom: 12, lineHeight: 1.5 }}>
              Carica il PDF della visura: compileremo l'anagrafica e, se attivi la Governance, creeremo l'organo amministrativo con i suoi componenti e l'Assemblea con i soci e le quote.
            </div>
            <label className="btn btn-sm" style={{ cursor: visuraLoading ? 'default' : 'pointer', background: '#2B5FA5', color: '#fff' }}>
              {visuraLoading ? 'Lettura in corso…' : '📎 Scegli il PDF della visura'}
              <input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={visuraLoading} onChange={importaVisura} />
            </label>
            {visuraError && <div style={{ fontSize: 12, color: '#C0392B', marginTop: 10 }}>{visuraError}</div>}
            {visuraData && (
              <div style={{ fontSize: 12, color: '#0F6E56', marginTop: 10, lineHeight: 1.5 }}>
                ✓ Dati estratti dalla visura.
                {visuraData.componenti?.length ? ` Trovati ${visuraData.componenti.length} componenti (creati se attivi la Governance).` : ''}
                {visuraData.soci?.length ? ` Trovati ${visuraData.soci.length} soci con quote.` : ''}
                {' '}Controlla i campi qui sotto.
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Nome azienda</label>
            <input className="form-control" value={nome} onChange={e => setNome(e.target.value)} required placeholder="Es. Rossi S.r.l." />
          </div>
          <div className="form-group">
            <label className="form-label">Partita IVA <span style={{ color: '#888', fontWeight: 400 }}>(consigliata — evita duplicati)</span></label>
            <input className="form-control" value={piva} onChange={e => setPiva(e.target.value)} placeholder="11 cifre" maxLength={11} inputMode="numeric" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Settore</label>
              <select className="form-control" value={settore} onChange={e => setSettore(e.target.value)} required>
                <option value="">Seleziona...</option>
                {SETTORI.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Dimensione</label>
              <select className="form-control" value={dimensione} onChange={e => setDimensione(e.target.value)} required>
                <option value="">Seleziona...</option>
                {DIMENSIONI.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          {haSettore && (
            <div className="alert alert-info" style={{ marginBottom: 14 }}>
              🏗️ Per il settore <strong>{settore}</strong> ci sono rischi e procedure specifici — sceglierai al passo dei dati iniziali.
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Tipo di soggetto</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <div onClick={() => selezionaTipoSoggetto('societa')} style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', border: `2px solid ${tipoSoggetto === 'societa' ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: tipoSoggetto === 'societa' ? '#EBF4FC' : 'white' }}>
                <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>🏢 Società di capitali</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>S.r.l., S.p.A. — organo amministrativo, determine/delibere</div>
              </div>
              <div onClick={() => selezionaTipoSoggetto('individuale')} style={{ flex: 1, cursor: 'pointer', padding: '12px 14px', border: `2px solid ${tipoSoggetto === 'individuale' ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: tipoSoggetto === 'individuale' ? '#EBF4FC' : 'white' }}>
                <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>🧑‍💼 Impresa individuale o Professionista</div>
                <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>Partita IVA senza organi — Registro delle Decisioni</div>
              </div>
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '12px 14px', border: `2px solid ${modalitaSolo ? '#2B5FA5' : '#E0E0E0'}`, borderRadius: 8, background: modalitaSolo ? '#EBF4FC' : 'white', marginBottom: 14 }}>
            <input type="checkbox" checked={modalitaSolo} onChange={e => setModalitaSolo(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              <div style={{ fontWeight: 600, color: '#1A3A5C', fontSize: 13 }}>🧑‍💼 Modalità Solo — imprenditore senza struttura (solopreneur)</div>
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Semplifica l'app nascondendo le voci pensate per organizzazioni con più persone (es. Organigramma). Potrai cambiarlo in seguito dalle Impostazioni.</div>
            </span>
          </label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {nuovaAzienda && onAnnulla && (
              <button type="button" className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={onAnnulla}>
                ← Annulla
              </button>
            )}
            <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Salvataggio...' : 'Avanti →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}