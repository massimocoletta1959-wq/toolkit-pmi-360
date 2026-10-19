// ============================================================
// Aggiornamento della governance da una visura camerale aggiornata: confronta organo amministrativo, collegio
// sindacale e soci letti dalla visura con organi e composizioni presenti nel portale e propone le modifiche
// (organo da creare o da cambiare, componenti nuovi, cessati, con ruolo/data di nomina/quota cambiati).
// Libreria pura: la usa AggiornaDaVisura e i test. Le persone si riconoscono dal nome (ordine delle parole,
// accenti e maiuscole non contano), riusando il membro già presente in azienda quando c'è.
// ============================================================

export const ORGANI_AMMINISTRATIVI = ['amministratore_unico', 'cda']
const NOME_ORGANO = { amministratore_unico: 'Amministratore Unico', cda: 'Consiglio di Amministrazione', collegio_sindacale: 'Collegio Sindacale', assemblea: 'Assemblea Generale Ordinaria dei Soci' }
export const ETICHETTA_ORGANO = { amministratore_unico: 'Amministratore unico', cda: 'Consiglio di amministrazione', collegio_sindacale: 'Collegio sindacale', assemblea: 'Assemblea dei soci' }

const pulisci = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/\b(s\.?\s?r\.?\s?l\.?s?|s\.?\s?p\.?\s?a\.?|s\.?\s?a\.?\s?s\.?|s\.?\s?n\.?\s?c\.?)\b/g, m => m.replace(/[^a-z]/g, ''))
  .replace(/[^a-z0-9]+/g, ' ').trim()
// chiave di confronto di una persona o societa': parole ordinate
export const chiaveNome = s => pulisci(s).split(' ').filter(Boolean).sort().join(' ')
const nomeMembro = m => [m?.nome, m?.cognome].filter(Boolean).join(' ')
const isSindaco = c => /sindac|collegio sindacale|revisore/i.test(c.ruolo || '')
const stessoTesto = (a, b) => pulisci(a) === pulisci(b)
const numero = v => (v == null || v === '' || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100)

// separa "Nome Cognome" di un socio persona fisica (stessa regola della creazione azienda)
export function dividiNome(denominazione, personaGiuridica) {
  const d = String(denominazione || '').trim()
  if (personaGiuridica) return { nome: d, cognome: '' }
  const p = d.split(/\s+/)
  return p.length > 1 ? { nome: p.slice(0, -1).join(' '), cognome: p.slice(-1)[0] } : { nome: d, cognome: '' }
}

/**
 * @param visura  risposta di extract-visura: { organo: {tipo,nome}, componenti: [...], soci: [...] }
 * @param stato   { organi: [{id,tipo,nome,monocratico}], composizione: [{id,organo_id,membro_id,ruolo,data_nomina,quota,membri:{nome,cognome}}], membri: [{id,nome,cognome}] }
 * @returns [{ chiave, gruppo, tipo, descrizione, attuale, nuovo, azione }]
 */
export function confrontaGovernance(visura, stato) {
  const { organi = [], composizione = [], membri = [] } = stato || {}
  const modifiche = []
  const componenti = visura?.componenti || []
  const amm = componenti.filter(c => !isSindaco(c))
  const sind = componenti.filter(isSindaco)

  // confronto della composizione di un organo (esistente o da creare)
  function confrontaComposizione(gruppo, organo, chiaveOrgano, persone, conQuota) {
    const attuali = organo ? composizione.filter(c => c.organo_id === organo.id) : []
    const usati = new Set()
    persone.forEach((p, i) => {
      const k = chiaveNome(p.nomeCompleto)
      if (!k) return
      const trovato = attuali.find(c => !usati.has(c.id) && chiaveNome(nomeMembro(c.membri)) === k)
      if (!trovato) {
        const membro = membri.find(m => chiaveNome(nomeMembro(m)) === k)
        modifiche.push({
          chiave: `${chiaveOrgano}:nuovo:${i}`, gruppo, tipo: 'nuovo',
          descrizione: `Nuovo: ${p.nomeCompleto}`,
          attuale: null, nuovo: [p.ruolo, p.data_nomina ? `dal ${p.data_nomina}` : null, conQuota && p.quota != null ? `${p.quota}%` : null].filter(Boolean).join(' · '),
          azione: { tipo: 'componente_aggiungi', organo_id: organo?.id || null, chiaveOrgano, membro_id: membro?.id || null, persona: p },
        })
        return
      }
      usati.add(trovato.id)
      const patch = {}
      const att = [], nuo = []
      if (p.ruolo && !stessoTesto(p.ruolo, trovato.ruolo)) { patch.ruolo = p.ruolo; att.push(trovato.ruolo || '—'); nuo.push(p.ruolo) }
      if (p.data_nomina && p.data_nomina !== (trovato.data_nomina || '').slice(0, 10)) { patch.data_nomina = p.data_nomina; att.push(`nomina ${trovato.data_nomina || '—'}`); nuo.push(`nomina ${p.data_nomina}`) }
      if (conQuota && p.quota != null && numero(trovato.quota) !== numero(p.quota)) { patch.quota = numero(p.quota); att.push(`${trovato.quota ?? '—'}%`); nuo.push(`${numero(p.quota)}%`) }
      if (Object.keys(patch).length) {
        modifiche.push({
          chiave: `${chiaveOrgano}:agg:${trovato.id}`, gruppo, tipo: 'modifica', descrizione: `Aggiornato: ${p.nomeCompleto}`,
          attuale: att.join(' · '), nuovo: nuo.join(' · '), azione: { tipo: 'componente_aggiorna', id: trovato.id, patch },
        })
      }
    })
    attuali.filter(c => !usati.has(c.id)).forEach(c => {
      modifiche.push({
        chiave: `${chiaveOrgano}:cessato:${c.id}`, gruppo, tipo: 'cessato', descrizione: `Non più in visura: ${nomeMembro(c.membri) || 'componente'}`,
        attuale: [c.ruolo, c.quota != null ? `${c.quota}%` : null].filter(Boolean).join(' · '), nuovo: 'rimosso dall\'organo',
        azione: { tipo: 'componente_rimuovi', id: c.id },
      })
    })
  }

  // ── organo amministrativo ──
  const tipoVisura = ORGANI_AMMINISTRATIVI.includes(visura?.organo?.tipo) ? visura.organo.tipo
    : amm.length === 1 && /unico/i.test(amm[0].ruolo || '') ? 'amministratore_unico' : amm.length ? 'cda' : null
  if (tipoVisura) {
    const organo = organi.find(o => ORGANI_AMMINISTRATIVI.includes(o.tipo)) || null
    if (!organo) {
      modifiche.push({
        chiave: 'amm:crea', gruppo: 'Organo amministrativo', tipo: 'nuovo', descrizione: `Nuovo organo: ${ETICHETTA_ORGANO[tipoVisura]}`,
        attuale: null, nuovo: NOME_ORGANO[tipoVisura],
        azione: { tipo: 'organo_crea', chiaveOrgano: 'amm', dati: { tipo: tipoVisura, nome: NOME_ORGANO[tipoVisura], monocratico: tipoVisura === 'amministratore_unico' } },
      })
    } else if (organo.tipo !== tipoVisura) {
      modifiche.push({
        chiave: 'amm:tipo', gruppo: 'Organo amministrativo', tipo: 'modifica', descrizione: 'Forma dell\'organo amministrativo',
        attuale: `${ETICHETTA_ORGANO[organo.tipo]} (${organo.nome})`, nuovo: ETICHETTA_ORGANO[tipoVisura],
        azione: { tipo: 'organo_aggiorna', id: organo.id, patch: { tipo: tipoVisura, nome: NOME_ORGANO[tipoVisura], monocratico: tipoVisura === 'amministratore_unico' } },
      })
    }
    confrontaComposizione('Organo amministrativo', organo, 'amm',
      amm.map(c => ({ nomeCompleto: [c.nome, c.cognome].filter(Boolean).join(' '), nome: c.nome || '', cognome: c.cognome || '', ruolo: c.ruolo || 'Amministratore', data_nomina: c.data_nomina || null, pec: c.pec || null })), false)
  }

  // ── collegio sindacale (solo se la visura riporta sindaci) ──
  if (sind.length) {
    const organo = organi.find(o => o.tipo === 'collegio_sindacale') || null
    if (!organo) {
      modifiche.push({
        chiave: 'collegio:crea', gruppo: 'Collegio sindacale', tipo: 'nuovo', descrizione: 'Nuovo organo: Collegio sindacale', attuale: null, nuovo: NOME_ORGANO.collegio_sindacale,
        azione: { tipo: 'organo_crea', chiaveOrgano: 'collegio', dati: { tipo: 'collegio_sindacale', nome: NOME_ORGANO.collegio_sindacale, monocratico: false } },
      })
    }
    confrontaComposizione('Collegio sindacale', organo, 'collegio',
      sind.map(c => ({ nomeCompleto: [c.nome, c.cognome].filter(Boolean).join(' '), nome: c.nome || '', cognome: c.cognome || '', ruolo: c.ruolo || 'Sindaco', data_nomina: c.data_nomina || null, pec: c.pec || null })), false)
  }

  // ── soci (solo se la visura riporta la compagine: per molte S.p.A. non c'e') ──
  const soci = (visura?.soci || []).filter(s => (s.denominazione || '').trim())
  if (soci.length) {
    const organo = organi.find(o => o.tipo === 'assemblea') || null
    if (!organo) {
      modifiche.push({
        chiave: 'assemblea:crea', gruppo: 'Soci', tipo: 'nuovo', descrizione: 'Nuovo organo: Assemblea dei soci', attuale: null, nuovo: NOME_ORGANO.assemblea,
        azione: { tipo: 'organo_crea', chiaveOrgano: 'assemblea', dati: { tipo: 'assemblea', nome: NOME_ORGANO.assemblea, monocratico: false } },
      })
    }
    confrontaComposizione('Soci', organo, 'assemblea', soci.map(s => ({
      nomeCompleto: s.denominazione.trim(), ...dividiNome(s.denominazione, s.persona_giuridica), ruolo: 'Socio', data_nomina: null, quota: numero(s.quota_perc),
    })), true)
  }
  return modifiche
}
