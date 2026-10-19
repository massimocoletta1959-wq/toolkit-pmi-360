import { confrontaGovernance, chiaveNome } from './governanceDaVisura'

const stato = {
  organi: [
    { id: 'o1', tipo: 'amministratore_unico', nome: 'Amministratore Unico' },
    { id: 'o2', tipo: 'assemblea', nome: 'Assemblea' },
  ],
  composizione: [
    { id: 'c1', organo_id: 'o1', membro_id: 'm1', ruolo: 'Amministratore Unico', data_nomina: '2020-01-10', membri: { nome: 'Mario', cognome: 'Rossi' } },
    { id: 'c2', organo_id: 'o2', membro_id: 'm1', ruolo: 'Socio', quota: 60, membri: { nome: 'Mario', cognome: 'Rossi' } },
    { id: 'c3', organo_id: 'o2', membro_id: 'm2', ruolo: 'Socio', quota: 40, membri: { nome: 'Anna', cognome: 'Bianchi' } },
  ],
  membri: [{ id: 'm1', nome: 'Mario', cognome: 'Rossi' }, { id: 'm2', nome: 'Anna', cognome: 'Bianchi' }, { id: 'm3', nome: 'Luca', cognome: 'Verdi' }],
}

test('chiave del nome indipendente da ordine, accenti e maiuscole', () => {
  expect(chiaveNome('ROSSI Mario')).toBe(chiaveNome('Mario Rossi'))
  expect(chiaveNome('Nicolò Bianchi')).toBe(chiaveNome('BIANCHI NICOLO'))
  expect(chiaveNome('Alfa S.r.l.')).toBe(chiaveNome('ALFA SRL'))
})

test('visura identica: nessuna modifica', () => {
  const v = {
    organo: { tipo: 'amministratore_unico' },
    componenti: [{ nome: 'MARIO', cognome: 'ROSSI', ruolo: 'Amministratore unico', data_nomina: '2020-01-10' }],
    soci: [{ denominazione: 'Rossi Mario', quota_perc: 60 }, { denominazione: 'Anna Bianchi', quota_perc: 40.0 }],
  }
  expect(confrontaGovernance(v, stato)).toEqual([])
})

test('da amministratore unico a CdA con nuovi consiglieri', () => {
  const v = {
    organo: { tipo: 'cda' },
    componenti: [
      { nome: 'Mario', cognome: 'Rossi', ruolo: 'Presidente del consiglio di amministrazione', data_nomina: '2026-05-01' },
      { nome: 'Luca', cognome: 'Verdi', ruolo: 'Consigliere', data_nomina: '2026-05-01' },
      { nome: 'Sara', cognome: 'Neri', ruolo: 'Sindaco effettivo' },
    ],
    soci: [],
  }
  const m = confrontaGovernance(v, stato)
  const tipi = m.map(x => x.azione.tipo)
  expect(tipi).toContain('organo_aggiorna')
  const agg = m.find(x => x.azione.tipo === 'componente_aggiorna')
  expect(agg.azione.patch).toEqual({ ruolo: 'Presidente del consiglio di amministrazione', data_nomina: '2026-05-01' })
  const nuovo = m.find(x => x.azione.tipo === 'componente_aggiungi' && x.azione.chiaveOrgano === 'amm')
  expect(nuovo.azione.membro_id).toBe('m3')          // riusa il membro già presente
  expect(m.find(x => x.chiave === 'collegio:crea')).toBeTruthy()
  expect(m.find(x => x.azione.chiaveOrgano === 'collegio' && x.azione.tipo === 'componente_aggiungi').azione.membro_id).toBeNull()
  // soci assenti in visura: la compagine non si tocca
  expect(m.some(x => x.gruppo === 'Soci')).toBe(false)
})

test('soci: quota cambiata, socio uscito, socio entrato', () => {
  const v = {
    organo: { tipo: 'amministratore_unico' },
    componenti: [{ nome: 'Mario', cognome: 'Rossi', ruolo: 'Amministratore Unico' }],
    soci: [{ denominazione: 'Mario Rossi', quota_perc: 70 }, { denominazione: 'Beta S.p.A.', persona_giuridica: true, quota_perc: 30 }],
  }
  const m = confrontaGovernance(v, stato)
  expect(m.find(x => x.azione.tipo === 'componente_aggiorna').azione).toEqual({ tipo: 'componente_aggiorna', id: 'c2', patch: { quota: 70 } })
  expect(m.find(x => x.azione.tipo === 'componente_rimuovi').azione.id).toBe('c3')
  const nuovo = m.find(x => x.azione.tipo === 'componente_aggiungi')
  expect(nuovo.azione.persona.nome).toBe('Beta S.p.A.')
  expect(nuovo.azione.organo_id).toBe('o2')
})

test('azienda senza organi: li crea', () => {
  const v = { organo: { tipo: 'cda' }, componenti: [{ nome: 'A', cognome: 'B', ruolo: 'Consigliere' }, { nome: 'C', cognome: 'D', ruolo: 'Presidente' }], soci: [] }
  const m = confrontaGovernance(v, { organi: [], composizione: [], membri: [] })
  expect(m[0].azione).toMatchObject({ tipo: 'organo_crea', chiaveOrgano: 'amm', dati: { tipo: 'cda', monocratico: false } })
  expect(m.filter(x => x.azione.tipo === 'componente_aggiungi').length).toBe(2)
})
