import React, { useEffect } from 'react'
import { useApp } from '../App'

// ============================================================
// "I miei organi" — area dell'incaricato alla gestione di uno o più
// organi. Riusa le pagine della Governance: le regole di accesso del
// database limitano i dati all'organo (o agli organi) dell'incarico.
// ============================================================

const TIPO_LABEL = {
  cda: 'Consiglio di Amministrazione', amministratore_unico: 'Amministratore Unico', comitato: 'Comitato',
  collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea', altro: 'Organo',
}
// Tipi di organo che adottano determine/delibere istruite nel registro atti
const CON_ATTI = ['cda', 'amministratore_unico', 'assemblea']

export default function IncarichiOrgani({ pagine }) {
  const { mieiOrgani, organoIncarico, apriOrganoIncarico, chiudiOrganoIncarico, page, setPage } = useApp()

  // Un solo incarico: si entra direttamente nell'organo
  useEffect(() => {
    if (!organoIncarico && mieiOrgani.length === 1) apriOrganoIncarico(mieiOrgani[0])
  }, [organoIncarico, mieiOrgani, apriOrganoIncarico])

  if (!organoIncarico) {
    return (
      <div>
        <div className="page-header">
          <h2>I miei organi</h2>
          <p>Organi di cui sei stato nominato incaricato della gestione.</p>
        </div>
        {mieiOrgani.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 40, color: '#666' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>⚖️</div>
            Non hai incarichi di gestione d'organo attivi.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {mieiOrgani.map(o => (
              <div key={o.organo_id} className="card" style={{ cursor: 'pointer', marginBottom: 0 }} onClick={() => apriOrganoIncarico(o)}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1A3A5C' }}>⚖️ {o.organo_nome}</div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{TIPO_LABEL[o.organo_tipo] || 'Organo'} · {o.azienda_nome}</div>
                <div style={{ marginTop: 12 }}><span className="btn btn-sm btn-primary">Gestisci →</span></div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const schede = [
    { id: 'governance', label: 'Organo e componenti', pagine: ['governance'] },
    { id: 'verbali', label: 'Adunanze e verbali', pagine: ['verbali', 'adunanza'] },
    { id: 'modelli_verbale', label: 'Modelli di verbale', pagine: ['modelli_verbale'] },
    ...(CON_ATTI.includes(organoIncarico.organo_tipo) ? [{ id: 'au_registro', label: 'Atti e istruttorie', pagine: ['au_registro', 'au_nuova'] }] : []),
  ]
  const ammesse = schede.flatMap(s => s.pagine)
  const corrente = ammesse.includes(page) ? page : 'governance'

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        {mieiOrgani.length > 1 && <button className="btn btn-sm" onClick={chiudiOrganoIncarico}>← I miei organi</button>}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#1A3A5C' }}>⚖️ {organoIncarico.organo_nome}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{organoIncarico.azienda_nome} · incarico di gestione</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, borderBottom: '1px solid #E8ECF2', paddingBottom: 10 }}>
        {schede.map(s => (
          <button key={s.id} className={`btn btn-sm${s.pagine.includes(corrente) ? ' btn-primary' : ''}`} onClick={() => setPage(s.id)}>{s.label}</button>
        ))}
      </div>
      {pagine[corrente]}
    </div>
  )
}
