import React, { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Setup from './pages/Setup'
import Cruscotto from './pages/Cruscotto'
import RegistroRischi from './pages/RegistroRischi'
import PianoAzione from './pages/PianoAzione'
import GestioneMembri from './pages/GestioneMembri'
import Organigramma from './pages/Organigramma'
import Procedure from './pages/Procedure'
import TracciamentoProcedure from './pages/TracciamentoProcedure'
import GestioneTicket from './pages/GestioneTicket'
import Impostazioni from './pages/Impostazioni'
import IMieiTask from './pages/IMieiTask'
import Report from './pages/Report'
import Governance from './pages/Governance'
import RegistroDetermine from './pages/RegistroDetermine'
import NuovaDetermina from './pages/NuovaDetermina'
import Verbali from './pages/Verbali'
import DettaglioAdunanza from './pages/DettaglioAdunanza'
import ModelliVerbale from './pages/ModelliVerbale'
import DossierBJR from './pages/DossierBJR'
import ModelliDetermina from './pages/ModelliDetermina'
import Home from './pages/Home'
import Layout from './components/Layout'
import LayoutMembro from './components/LayoutMembro'

export const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export default function App() {
  const [session, setSession]      = useState(undefined)
  const [profilo, setProfilo]      = useState(null)
  const [aziende, setAziende]      = useState([])
  const [azienda, setAziendaState] = useState(null)
  const [page, setPage]            = useState('home')
  const [modulo, setModulo]        = useState(null)   // null = Home; 'rischi' | 'procedure' | 'governance'
  const [determinaId, setDeterminaId] = useState(null) // id determina da aprire nel wizard (null = nuova)
  const [determinaOrgano, setDeterminaOrgano] = useState(null) // organo dell'atto in creazione
  const [adunanzaId, setAdunanzaId] = useState(null)   // id adunanza da aprire nel dettaglio
  const [pagMembro, setPagMembro]  = useState('task') // vista membro: 'task' | 'procedure'
  const [showSetup, setShowSetup]  = useState(false)
  const [recoveryMode, setRecoveryMode] = useState(false) // true = utente ha cliccato il link "recupera password"
  const [licenzaBloccata, setLicenzaBloccata] = useState(null) // null = ok; altrimenti motivo del blocco per un consulente

  // Leggi token invito dall'URL e salvalo in localStorage per sopravvivere al redirect
  const urlParams = new URLSearchParams(window.location.search)
  const tokenDaUrl = urlParams.get('invito')
  if (tokenDaUrl) localStorage.setItem('token_invito', tokenDaUrl)
  const tokenInvito = tokenDaUrl || localStorage.getItem('token_invito')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadDati(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)
      if (event === 'PASSWORD_RECOVERY') { setRecoveryMode(true); return }
      if (session) {
        // Se c'è un token invito, collegalo dopo il login/registrazione
        if (tokenInvito) await accettaInvito(session.user.id, tokenInvito)
        // Se questa email era stata pre-registrata come gestore, collega l'account
        await claimGestorePendente(session.user.id, session.user.email)
        await loadDati(session.user.id)
        // Pulisci URL dopo aver processato l'invito
        if (tokenInvito) {
          window.history.replaceState({}, '', window.location.pathname)
          localStorage.removeItem('token_invito')
        }
      } else {
        setProfilo(null); setAziende([]); setAziendaState(null)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function accettaInvito(userId, token) {
    // Trova l'invito valido
    const { data: inviti } = await supabase
      .from('inviti').select('*').eq('token', token).eq('accettato', false)
    if (!inviti || inviti.length === 0) return
    const invito = inviti[0]
    if (new Date(invito.expires_at) < new Date()) return

    const { data: { user } } = await supabase.auth.getUser()

    // Controlla se il profilo esiste già (membro già registrato in un'altra azienda)
    const { data: existingProf } = await supabase
      .from('profili').select('*').eq('id', userId).single()

    if (!existingProf) {
      // Prima registrazione — crea profilo con ruolo membro
      await supabase.from('profili').insert({
        id: userId,
        email: user.email,
        nome: '',
        azienda_id: invito.azienda_id,  // azienda principale
        ruolo: 'membro',
        membro_id: invito.membro_id,
      })
    } else {
      // Profilo già esistente — aggiunge solo il collegamento alla nuova azienda
      // NON sovrascrive ruolo o azienda principale se è già consulente
      if (existingProf.ruolo !== 'consulente') {
        // Se è un membro, aggiorna il membro_id per includere questo invito
        // Usiamo un array di membro_ids nella tabella utente_aziende
        await supabase.from('profili').update({
          ruolo: 'membro',
        }).eq('id', userId)
      }
    }

    // Collega utente <-> azienda (anche se già registrato altrove)
    await supabase.from('utente_aziende').upsert({
      utente_id: userId,
      azienda_id: invito.azienda_id,
      ruolo: 'membro',
    }, { onConflict: 'utente_id,azienda_id' })

    // Collega il record membro all'utente (per trovare i ticket)
    await supabase.from('membri').update({ user_id: userId })
      .eq('id', invito.membro_id)

    // Marca invito come accettato
    await supabase.from('inviti').update({ accettato: true }).eq('id', invito.id)

    localStorage.setItem('azienda_attiva', invito.azienda_id)
  }

  // Se un gestore è stato pre-registrato (dal portale licenze) con questa email,
  // collega la riga in attesa al nuovo account non appena si registra/accede.
  async function claimGestorePendente(userId, email) {
    if (!email) return
    await supabase.from('gestori').update({ user_id: userId })
      .is('user_id', null).ilike('email', email)
  }

  async function loadDati(userId) {
    let { data: prof } = await supabase
      .from('profili').select('*').eq('id', userId).single()

    if (!prof) {
      // Ripara un membro già collegato (membri.user_id = userId) ma senza
      // profilo/utente_aziende — es. profilo perso in passato — invece di
      // trattarlo come un consulente nuovo e mandarlo su Setup.
      const { data: mieiMembri } = await supabase
        .from('membri').select('id, azienda_id, email').eq('user_id', userId)
      if (mieiMembri && mieiMembri.length > 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const primo = mieiMembri[0]
        await supabase.from('profili').insert({
          id: userId, email: user?.email || primo.email || '', nome: '',
          azienda_id: primo.azienda_id, ruolo: 'membro', membro_id: primo.id,
        })
        for (const m of mieiMembri) {
          await supabase.from('utente_aziende').upsert({
            utente_id: userId, azienda_id: m.azienda_id, ruolo: 'membro',
          }, { onConflict: 'utente_id,azienda_id' })
        }
        ;({ data: prof } = await supabase.from('profili').select('*').eq('id', userId).single())
      }
    }

    if (!prof) {
      setProfilo(null); setAziende([]); setAziendaState(null)
      return
    }

    // Un consulente (non un membro invitato) deve avere una licenza attiva per operare:
    // nessuna riga gestori, o stato diverso da "attivo", blocca l'accesso.
    if (prof.ruolo !== 'membro') {
      const { data: gestore } = await supabase.from('gestori').select('stato').eq('user_id', userId).maybeSingle()
      if (!gestore || gestore.stato !== 'attivo') {
        setLicenzaBloccata(gestore ? gestore.stato : 'nessuna_licenza')
        setProfilo(null); setAziende([]); setAziendaState(null)
        return
      }
    }
    setLicenzaBloccata(null)
    setProfilo(prof)

    // Carica aziende tramite utente_aziende
    const { data: ua } = await supabase
      .from('utente_aziende').select('aziende(*)').eq('utente_id', userId)

    const tutteAziende = (ua || []).map(r => r.aziende).filter(Boolean)
      .filter((az, idx, arr) => arr.findIndex(a => a.id === az.id) === idx)

    setAziende(tutteAziende)

    const savedId = localStorage.getItem('azienda_attiva')
    const saved   = tutteAziende.find(a => a.id === savedId)
    const attiva  = saved || tutteAziende[0] || null
    setAziendaState(attiva)
    if (attiva) localStorage.setItem('azienda_attiva', attiva.id)
    else localStorage.removeItem('azienda_attiva')
  }

  // Elimina le bozze provvisorie orfane di un'azienda (fascicoli inclusi)
  async function pulisciProvvisorie(aziendaId) {
    if (!aziendaId) return
    try {
      const { data: orfane } = await supabase.from('determine')
        .select('id').eq('azienda_id', aziendaId).eq('provvisoria', true)
      const ids = (orfane || []).map(o => o.id)
      if (!ids.length) return
      const { data: alg } = await supabase.from('determina_allegati')
        .select('storage_path').in('determina_id', ids)
      const paths = (alg || []).map(a => a.storage_path)
      if (paths.length) await supabase.storage.from('fascicoli').remove(paths)
      await supabase.from('determine').delete().in('id', ids)
    } catch (_e) { /* best-effort */ }
  }

  function switchAzienda(az) {
    // pulizia bozze fantasma dell'azienda che si lascia
    if (azienda?.id && azienda.id !== az.id) pulisciProvvisorie(azienda.id)
    setAziendaState(az)
    localStorage.setItem('azienda_attiva', az.id)
    setModulo(null)
    setPage('home')
  }

  // Entra in un modulo: imposta il modulo attivo e la sua pagina di default
  function entraModulo(m) {
    const defaultPage = { rischi: 'cruscotto', procedure: 'procedure', governance: 'governance' }[m]
    setModulo(m)
    setPage(defaultPage || 'home')
  }
  function tornaHome() {
    setModulo(null)
    setPage('home')
  }

  async function logout() {
    await supabase.auth.signOut()
    setSession(null); setProfilo(null); setAziende([]); setAziendaState(null)
  }

  // Apre il wizard di creazione azienda, rispettando il limite max_aziende del gestore (null = illimitato)
  async function onNuovaAzienda() {
    const { data: gestore } = await supabase.from('gestori')
      .select('max_aziende').eq('user_id', session.user.id).maybeSingle()
    if (gestore?.max_aziende != null && aziende.length >= gestore.max_aziende) {
      alert(`Hai raggiunto il limite di ${gestore.max_aziende} aziende previsto dal tuo piano. Contatta l'assistenza per aumentarlo.`)
      return
    }
    setShowSetup(true)
  }

  async function onNuovaAziendaDone(newId) {
    setShowSetup(false)
    if (newId) localStorage.setItem('azienda_attiva', newId)
    if (session) await loadDati(session.user.id)
    setModulo(null)
    setPage('home')
  }

  if (session === undefined) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div className="spinner" />
    </div>
  )

  // Link "recupera password" cliccato: mostra il form per impostare la nuova password
  if (recoveryMode) return <ResetPassword onFatto={() => { setRecoveryMode(false); supabase.auth.signOut() }} />

  // Mostra login — se c'è token invito, lo gestiremo dopo il login
  if (!session) return <Login tokenInvito={tokenInvito} />

  if (licenzaBloccata) {
    const messaggi = {
      sospeso: 'Il tuo account è stato sospeso.',
      scaduto: 'La tua licenza è scaduta.',
      cessato: 'Il tuo account non è più attivo.',
      nessuna_licenza: 'Il tuo account non ha ancora una licenza attiva.',
    }
    return (
      <div className="login-page">
        <div className="login-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⛔</div>
          <h2 style={{ marginBottom: 8 }}>Accesso non disponibile</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>{messaggi[licenzaBloccata] || 'Il tuo account non può operare.'} Contatta l'assistenza per maggiori informazioni.</p>
          <button className="btn" onClick={async () => { await supabase.auth.signOut(); setLicenzaBloccata(null) }}>Esci</button>
        </div>
      </div>
    )
  }

  // Se c'è un token invito nell'URL e non c'è ancora il profilo,
  // mostra un loader — accettaInvito creerà il profilo automaticamente
  if (!profilo && !showSetup) {
    if (tokenInvito) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', gap: 16 }}>
        <div className="spinner" />
        <p style={{ color: '#1A3A5C', fontSize: 14 }}>Collegamento al portale in corso...</p>
      </div>
    )
    return (
      <Setup onDone={() => loadDati(session.user.id)} userId={session.user.id} userEmail={session.user.email} />
    )
  }

  if (showSetup) return (
    <Setup onDone={onNuovaAziendaDone} onAnnulla={() => setShowSetup(false)} userId={session.user.id} userEmail={session.user.email} nuovaAzienda={true} />
  )

  if (!azienda) return (
    <div className="login-page">
      <div className="login-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
        <h2 style={{ color: '#1A3A5C', marginBottom: 8 }}>Nessuna azienda</h2>
        <p style={{ color: '#666', marginBottom: 20 }}>Crea la tua prima azienda per iniziare.</p>
        <button className="btn btn-primary" onClick={() => setShowSetup(true)}>+ Crea azienda</button>
      </div>
    </div>
  )

  const ctx = {
    session, profilo, azienda, aziende,
    switchAzienda,
    reload: () => loadDati(session.user.id),
    page, setPage, logout,
    modulo, entraModulo, tornaHome,
    determinaId, determinaOrgano,
    apriDetermina: (id) => { setDeterminaId(id); setPage('au_nuova') },
    nuovaDetermina: (organo) => { setDeterminaId(null); setDeterminaOrgano(organo || null); setPage('au_nuova') },
    adunanzaId,
    apriAdunanza: (id) => { setAdunanzaId(id); setPage('adunanza') },
    onNuovaAzienda,
  }

  // ── Vista MEMBRO OPERATIVO ──────────────────────────────────────────────
  if (profilo.ruolo === 'membro') {
    return (
      <AppContext.Provider value={ctx}>
        <LayoutMembro page={pagMembro} setPage={setPagMembro}>
          <IMieiTask key={pagMembro} modo={pagMembro} />
        </LayoutMembro>
      </AppContext.Provider>
    )
  }

  // ── Vista CONSULENTE ────────────────────────────────────────────────────
  const pages = {
    home:         <Home />,
    cruscotto:    <Cruscotto />,
    registro:     <RegistroRischi />,
    piano:        <PianoAzione />,
    ticket:       <GestioneTicket />,
    membri:       <GestioneMembri />,
    organigramma: <Organigramma />,
    governance:   <Governance />,
    au_registro:  <RegistroDetermine />,
    au_nuova:     <NuovaDetermina key={determinaId || 'nuova'} />,
    verbali:      <Verbali />,
    adunanza:     <DettaglioAdunanza key={adunanzaId || 'nuova'} />,
    modelli_verbale: <ModelliVerbale />,
    dossier_bjr: <DossierBJR />,
    modelli_determina: <ModelliDetermina />,
    procedure:    <Procedure />,
    tracciamento: <TracciamentoProcedure />,
    impostazioni: <Impostazioni />,
    report: <Report />,
  }

  return (
    <AppContext.Provider value={ctx}>
      <Layout>{pages[page] || <Home />}</Layout>
    </AppContext.Provider>
  )
}
