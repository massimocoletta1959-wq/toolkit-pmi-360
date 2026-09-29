// ============================================================
// Dati sul lavoro dipendente dell'azienda (scheda in Impostazioni).
// Servono alla simulazione d'impatto di tipo "personale" (EasyPMI):
// l'aliquota contributiva effettiva va presa dal cedolino / consulente
// del lavoro, perché dipende da inquadramento INPS, dimensione,
// qualifica e agevolazioni, non dal solo CCNL.
// ============================================================

export const INQUADRAMENTI_INPS = {
  industria: 'Industria',
  artigianato: 'Artigianato',
  commercio_terziario: 'Commercio e terziario',
  cooperative: 'Cooperative',
  agricoltura: 'Agricoltura',
  credito_assicurazioni: 'Credito e assicurazioni',
  altro: 'Altro',
}

// Suggerimenti per il campo CCNL (testo libero: vale quello scritto)
export const CCNL_COMUNI = [
  'Commercio e terziario (Confcommercio)',
  'Metalmeccanici industria',
  'Metalmeccanici artigianato',
  'Edilizia industria',
  'Edilizia artigianato',
  'Chimico-farmaceutico industria',
  'Alimentare industria',
  'Tessile-abbigliamento industria',
  'Legno-arredo industria',
  'Turismo e pubblici esercizi',
  'Studi professionali',
  'Logistica, trasporto merci e spedizione',
  'Servizi di pulizia e multiservizi',
  'Cooperative sociali',
  'Agricoltura operai',
  'Dirigenti industria',
  'Dirigenti commercio',
]
