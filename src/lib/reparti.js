import { supabase } from './supabase'

// Per ogni sigla di ruolo (reparto) dell'azienda, l'elenco dei membro_id che ne
// fanno parte — responsabile del ruolo + team — utile per selezionare in un colpo
// "tutti quelli di AMM" invece di spuntarli uno per uno.
export async function repartiConMembri(aziendaId) {
  const [{ data: ruoli }, { data: team }] = await Promise.all([
    supabase.from('ruoli').select('id, sigla, nome, membro_id').eq('azienda_id', aziendaId).order('sigla'),
    supabase.from('ruolo_team').select('ruolo_id, membro_id').eq('azienda_id', aziendaId),
  ])
  const teamPerRuolo = {}
  ;(team || []).forEach(t => { (teamPerRuolo[t.ruolo_id] ||= []).push(t.membro_id) })
  return (ruoli || [])
    .map(r => ({
      sigla: r.sigla,
      nome: r.nome,
      membroIds: new Set([r.membro_id, ...(teamPerRuolo[r.id] || [])].filter(Boolean)),
    }))
    .filter(r => r.membroIds.size > 0)
}
