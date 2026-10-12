import { supabase } from './supabase'

const FUNZIONE_EMAIL = 'https://vwbixmbbcutjcplskjvg.supabase.co/functions/v1/invia-email'

// Ritira e cancella un ticket. Se era assegnato a un membro e non era completato, prima della cancellazione il
// membro riceve l'email "Incarico ritirato" con i dettagli del task, se inviaEmail e' vero (scelta del gestore
// nella finestra di conferma). Restituisce { errore, avvisato }.
export async function ritiraTicket(ticket, { inviaEmail = true } = {}) {
  let avvisato = false
  if (inviaEmail && ticket.membro_id && ticket.stato !== 'Completato') {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(FUNZIONE_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ ticket_id: ticket.id, tipo: 'ritirato' }),
      })
      const d = await r.json().catch(() => ({}))
      avvisato = !!d.successo
    } catch {
      avvisato = false
    }
  }
  const { data, error } = await supabase.from('ticket').delete().eq('id', ticket.id).select('id')
  if (error) return { errore: error.message, avvisato }
  if (!data || data.length === 0) return { errore: 'Il ticket non è stato cancellato: non hai i permessi per farlo.', avvisato }
  return { errore: null, avvisato }
}
