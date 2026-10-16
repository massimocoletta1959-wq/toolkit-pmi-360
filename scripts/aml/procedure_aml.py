#!/usr/bin/env python3
"""Procedure antiriciclaggio (D.Lgs. 231/2007) per INTELLCREDIT S.P.A. — agenzia di recupero stragiudiziale dei crediti
per conto terzi. Genera l'SQL che le inserisce nel catalogo delle procedure come procedure riservate all'azienda
(settore 'azienda:<id>'), nel formato a sezioni del portale (modificabile da EditorProcedura).

BOZZA del 16/10/2026 preparata con l'utente: i riferimenti normativi vanno verificati sulla versione vigente del
D.Lgs. 231/2007, sui provvedimenti UIF e sulle indicazioni di categoria (UNIREC) prima dell'approvazione.
Uso: python3 scripts/aml/procedure_aml.py > supabase/sql/2026-10-16_w_procedure_aml_intellcredit.sql
"""
import html

AZIENDA_ID = '3bcc90e8-a801-402b-8d87-5909429f44b3'   # INTELLCREDIT S.P.A.
SETTORE = f'azienda:{AZIENDA_ID}'
AREA = 'AML'
AREA_LABEL = 'Antiriciclaggio — D.Lgs. 231/2007'
REVISIONE = 'Ottobre 2027'
e = lambda t: html.escape(t, quote=False)

# ruoli dell'organigramma usati nelle procedure (sigla -> nome)
RUOLI_AML = {
    'RAML': 'Responsabile Antiriciclaggio (funzione AML)',
    'DSOS': 'Delegato alle Segnalazioni di Operazioni Sospette',
    'ADV': 'Addetti adeguata verifica e gestori pratiche',
    'RCI': 'Controlli interni / Revisione interna AML',
}

R_BASE = ('D.Lgs. 231/2007 e s.m.i.', 'Prevenzione dell\'uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo')
R_TUB = ('Art. 3, c. 5 D.Lgs. 231/2007', 'Operatori non finanziari: recupero stragiudiziale dei crediti per conto di terzi con licenza ex art. 115 TULPS')
R_115 = ('Art. 115 TULPS (R.D. 773/1931)', 'Licenza per l\'attività di recupero crediti per conto di terzi')


def procedura(p):
    raci_cols = p['raci_cols']
    righe_fasi = ''.join(f"<tr><td><strong>{i + 1}</strong></td><td>{e(f[0])}</td><td>{e(f[1])}</td><td>{e(f[2])}</td></tr>" for i, f in enumerate(p['fasi']))
    righe_rif = ''.join(f"<tr><td><strong>{e(r[0])}</strong></td><td>{e(r[1])}</td></tr>" for r in p['rif'])
    righe_raci = ''.join('<tr><td><strong>' + e(r[0]) + '</strong></td>' + ''.join(f'<td>{e(x)}</td>' for x in r[1]) + '</tr>' for r in p['raci'])
    righe_flussi = ''.join(f"<tr><td><strong>{e(f[0])}</strong></td><td>{e(f[1])}</td><td>→</td><td>{e(f[2])}</td><td>{e(f[3])}</td><td>{e(f[4])}</td><td><blockquote><p>{e(f[5])}</p></blockquote></td></tr>" for f in p['flussi'])
    righe_kpi = ''.join(f"<tr><td>{e(k[0])}</td><td>{e(k[1])}</td><td>{e(k[2])}</td></tr>" for k in p['kpi'])
    righe_anom = ''.join(f"<tr><td><strong>{e(a[0])}</strong></td><td>{e(a[1])}</td><td>{e(a[2])}</td></tr>" for a in p['anomalie'])
    scopo = ''.join(f'<p>{e(s)}</p>' for s in p['scopo'])
    th_raci = '<th><strong>Attività</strong></th>' + ''.join(f'<th><strong>{e(c)}</strong></th>' for c in raci_cols)
    return f"""<blockquote>
<p><strong>{p['codice']} · {AREA_LABEL}</strong></p>
</blockquote>
<h1>{e(p['titolo'])}</h1>
<blockquote>
<p><em>Ambito: {e(p['ambito'])} — {{{{AZIENDA}}}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>{p['codice']}</th><th><strong>Owner</strong></th><th><blockquote><p>{{{{RUOLO:{p['owner']}}}}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>{e(p['titolo'])}</td><td><strong>Area</strong></td><td><blockquote><p>{AREA_LABEL}</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{{{VERSIONE}}}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{{{STATO}}}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{{{DATA_EMISSIONE}}}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>{REVISIONE}</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{{{RUOLO:{p.get('approva', 'CdA')}}}}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>{p.get('classificazione', 'Riservato — uso interno')}</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
{scopo}
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody>{righe_rif}</tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody>{righe_fasi}</tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header">{th_raci}</tr></thead>
<tbody>{righe_raci}</tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody>{righe_flussi}</tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody>{righe_kpi}</tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody>{righe_anom}</tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{{{DATA_EMISSIONE}}}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{{{AZIENDA}}}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{{{AZIENDA}}}} — {p['codice']} v{{{{VERSIONE}}}} ({{{{STATO}}}}) — Riservato uso interno — Approvato: {{{{RUOLO:{p.get('approva', 'CdA')}}}}}</p>
<p></p>
</blockquote>"""


C4 = ['RAML', 'DSOS', 'ADV', 'DL']
PROCEDURE = [
    dict(codice='AML-01', titolo='Politica antiriciclaggio e assetto organizzativo', owner='RAML', ambito='principi, ruoli e responsabilità del presidio antiriciclaggio',
         funzioni=['CdA', 'DL', 'RAML', 'DSOS'],
         scopo=['Definire la politica di {{AZIENDA}} per la prevenzione del riciclaggio e del finanziamento del terrorismo nell\'attività di recupero stragiudiziale dei crediti per conto terzi, e l\'assetto organizzativo che la presidia: organo amministrativo, Responsabile Antiriciclaggio, Delegato SOS, addetti all\'adeguata verifica, controlli interni.',
                'Il documento è il capitolo introduttivo del Manuale AML: le procedure AML-02 … AML-13 ne costituiscono le parti operative. Si applica a tutti i dipendenti e collaboratori, anche esterni, che gestiscono mandanti, debitori, incassi e documentazione.'],
         rif=[R_BASE, R_TUB, ('Artt. 15 e 16 D.Lgs. 231/2007', 'Valutazione del rischio, procedure e controlli proporzionati'), R_115, ('Indicazioni UNIREC', 'Linee guida di categoria per le agenzie di recupero crediti')],
         fasi=[('Approvazione della politica', 'CdA', 'L\'organo amministrativo approva la politica AML, l\'organigramma AML e il Manuale; ne verifica l\'adeguatezza almeno annualmente.'),
               ('Nomina delle funzioni', 'CdA', 'Delibera di nomina del Responsabile Antiriciclaggio e del Delegato SOS con requisiti, poteri, risorse e linee di riporto; accettazione scritta dell\'incarico (fascicolo BJR).'),
               ('Organigramma AML', 'RAML', 'Aggiornamento dell\'organigramma AML: addetti all\'adeguata verifica per ciascuna area (gestione mandanti, recupero, incassi), sostituti in caso di assenza.'),
               ('Diffusione del Manuale', 'RAML', 'Invio del Manuale e delle procedure a tutti gli incaricati con presa visione tracciata; aggiornamento a ogni modifica normativa od organizzativa.'),
               ('Riporto all\'organo amministrativo', 'RAML', 'Relazione annuale su rischi, controlli, formazione, segnalazioni (in forma anonima) e azioni correttive.'),
               ('Riesame', 'CdA', 'Riesame annuale della politica sulla base della relazione e dell\'autovalutazione del rischio (AML-02).')],
         raci_cols=['CdA', 'RAML', 'DSOS', 'DL'],
         raci=[('Approvazione politica e Manuale', ['A', 'R', 'C', 'C']), ('Nomina delle funzioni AML', ['A', 'C', 'I', 'R']), ('Diffusione e prese visione', ['I', 'R', 'I', 'C']), ('Relazione annuale', ['I', 'R', 'C', 'I'])],
         flussi=[('Delibera di nomina RAML e DSOS', 'CdA', 'RAML, DSOS, personale', 'Delibera con fascicolo', 'Alla nomina', 'Registro delibere'),
                 ('Organigramma AML', 'RAML', 'Tutto il personale', 'Documento', 'A ogni variazione', 'Portale — Organigramma'),
                 ('Relazione annuale AML', 'RAML', 'CdA', 'Documento', 'Entro aprile', 'Fascicolo AML aziendale')],
         kpi=[('Funzioni AML nominate con accettazione', '100%', 'Continuo'), ('Prese visione del Manuale', '100% degli incaricati', 'A ogni emissione'), ('Relazione annuale presentata al CdA', 'Sì', 'Annuale')],
         anomalie=[('Funzione AML vacante', 'Dimissioni o assenza prolungata', 'Nomina del sostituto con delibera entro 30 giorni; nel frattempo le attività passano al DL.'),
                   ('Manuale non letto da un incaricato', 'Presa visione non effettuata', 'Sollecito; senza presa visione l\'incaricato non opera su nuove pratiche.'),
                   ('Variazione normativa', 'Nuove disposizioni o indicatori UIF', 'Aggiornamento delle procedure entro 60 giorni e nuova diffusione.')]),

    dict(codice='AML-02', titolo='Autovalutazione del rischio di riciclaggio', owner='RAML', ambito='valutazione periodica dei rischi aziendali di riciclaggio e finanziamento del terrorismo',
         funzioni=['RAML', 'CdA', 'RCI'],
         scopo=['Stabilire come {{AZIENDA}} valuta, almeno una volta l\'anno e a ogni cambiamento rilevante, i rischi di riciclaggio e finanziamento del terrorismo cui è esposta, tenendo conto di mandanti, debitori, tipologie di crediti, canali di incasso e aree geografiche.',
                'L\'autovalutazione individua il rischio inerente, la vulnerabilità dei presidi e il rischio residuo, e alimenta il Piano d\'azione. Nel portale è registrata nel Registro rischi (gruppo «Antiriciclaggio»).'],
         rif=[R_BASE, ('Art. 15 D.Lgs. 231/2007', 'Valutazione del rischio da parte dei soggetti obbligati'), ('Analisi nazionale dei rischi (NRA)', 'Rischi di settore individuati dal Comitato di sicurezza finanziaria'), ('Indicazioni UNIREC', 'Fattori di rischio tipici del recupero crediti')],
         fasi=[('Mappatura delle attività', 'RAML', 'Censimento di mandanti per tipologia (banche, finanziarie, utility, telco, enti), portafogli gestiti, canali di incasso (bonifico, bollettino, carte, contante) e aree geografiche dei debitori.'),
               ('Rischio inerente', 'RAML', 'Valutazione per ciascun fattore: clientela, prodotti/servizi, canali, geografia; scala 1-4.'),
               ('Vulnerabilità dei presidi', 'RAML / RCI', 'Valutazione dell\'efficacia di organizzazione, adeguata verifica, controllo costante, SOS, conservazione, formazione, controlli.'),
               ('Rischio residuo', 'RAML', 'Combinazione di rischio inerente e vulnerabilità secondo la matrice approvata; giudizio complessivo.'),
               ('Azioni di mitigazione', 'RAML', 'Azioni correttive con responsabile e scadenza nel Piano d\'azione del portale.'),
               ('Approvazione', 'CdA', 'Esame e approvazione dell\'autovalutazione; conservazione nel fascicolo AML aziendale.')],
         raci_cols=['RAML', 'RCI', 'CdA', 'DL'],
         raci=[('Mappatura e rischio inerente', ['R', 'C', 'I', 'C']), ('Vulnerabilità dei presidi', ['R', 'C', 'I', 'I']), ('Approvazione', ['R', 'I', 'A', 'C']), ('Azioni di mitigazione', ['A', 'C', 'I', 'R'])],
         flussi=[('Autovalutazione del rischio', 'RAML', 'CdA', 'Documento + Registro rischi', 'Annuale (entro marzo)', 'Fascicolo AML aziendale'),
                 ('Piano delle azioni di mitigazione', 'RAML', 'Responsabili di funzione', 'Piano d\'azione', 'Con l\'autovalutazione', 'Portale — Piano d\'azione')],
         kpi=[('Autovalutazione aggiornata', 'Entro 12 mesi', 'Annuale'), ('Azioni di mitigazione chiuse nei tempi', '≥ 90%', 'Trimestrale')],
         anomalie=[('Nuovo mandante o canale ad alto rischio', 'Cambiamento dell\'attività', 'Aggiornamento straordinario dell\'autovalutazione entro 30 giorni.'),
                   ('Rischio residuo alto', 'Presidi insufficienti', 'Azioni correttive immediate e informativa al CdA.')]),

    dict(codice='AML-03', titolo='Metodologia di classificazione del rischio cliente', owner='RAML', ambito='profilatura del rischio di mandanti e debitori',
         funzioni=['RAML', 'ADV'],
         scopo=['Definire la metodologia con cui {{AZIENDA}} attribuisce a ciascun cliente — mandanti e debitori — un profilo di rischio (basso, medio, alto) che determina la misura dell\'adeguata verifica e la frequenza del controllo costante.',
                'Il profilo si calcola nel portale con fattori e pesi approvati: natura e struttura del soggetto, attività economica, area geografica, PEP e liste, comportamento (modalità e provenienza dei pagamenti), coerenza delle operazioni con il profilo.'],
         rif=[R_BASE, ('Artt. 17 e 18 D.Lgs. 231/2007', 'Adeguata verifica commisurata al rischio'), ('Artt. 23 e 24 D.Lgs. 231/2007', 'Misure semplificate e rafforzate; fattori di basso ed elevato rischio'), ('Allegati 1 e 2 al D.Lgs. 231/2007', 'Fattori di rischio e di basso rischio')],
         fasi=[('Raccolta dei dati', 'ADV', 'All\'apertura del rapporto (mandante) o della pratica (debitore) si raccolgono i dati necessari alla profilatura.'),
               ('Calcolo del punteggio', 'ADV', 'Compilazione della scheda di profilatura nel portale: ogni fattore ha un punteggio; il totale determina la classe.'),
               ('Fattori di rischio elevato', 'ADV', 'PEP, paesi terzi ad alto rischio, presenza in liste di sanzioni, pagamenti da terzi non giustificati, contante oltre soglia, frazionamenti: classe alta d\'ufficio.'),
               ('Validazione', 'RAML', 'Il RAML valida i profili alti e quelli in cui l\'addetto ha modificato la classe calcolata (con motivazione).'),
               ('Revisione del profilo', 'ADV', 'Il profilo si rivede alle scadenze del controllo costante (AML-07) e a ogni evento rilevante.'),
               ('Taratura della metodologia', 'RAML', 'Verifica annuale della metodologia sulla base dei risultati e dell\'autovalutazione; approvazione delle modifiche.')],
         raci_cols=C4,
         raci=[('Compilazione della scheda', ['C', 'I', 'R', '—']), ('Validazione profili alti', ['R', 'C', 'I', 'I']), ('Taratura della metodologia', ['R', 'C', 'C', 'A'])],
         flussi=[('Scheda di profilatura', 'ADV', 'Fascicolo cliente', 'Scheda nel portale', 'Apertura rapporto/pratica', 'Fascicolo AML del cliente'),
                 ('Elenco clienti ad alto rischio', 'RAML', 'DL', 'Report', 'Trimestrale', 'Fascicolo AML aziendale')],
         kpi=[('Clienti con profilo di rischio', '100%', 'Continuo'), ('Profili alti validati dal RAML', '100%', 'Continuo')],
         anomalie=[('Profilo mancante', 'Pratica aperta senza scheda', 'Blocco delle attività di incasso fino alla compilazione.'),
                   ('Classe modificata senza motivazione', 'Errore dell\'addetto', 'Ripristino della classe calcolata e richiamo.')]),

    dict(codice='AML-04', titolo='Adeguata verifica dei mandanti', owner='RAML', ambito='identificazione e verifica dei mandanti al conferimento del mandato e nel corso del rapporto',
         funzioni=['ADV', 'RAML', 'DC'],
         scopo=['Regolare l\'adeguata verifica dei mandanti (creditori che affidano a {{AZIENDA}} il recupero dei crediti): identificazione del cliente e del titolare effettivo, verifica dei dati, informazioni su scopo e natura del rapporto, profilatura e conservazione.',
                'Per mandanti che sono intermediari bancari e finanziari vigilati, o pubbliche amministrazioni, si possono applicare misure semplificate se il profilo di rischio è basso; restano in ogni caso identificazione, verifica del legale rappresentante e conservazione.'],
         rif=[R_BASE, ('Artt. 17-19 D.Lgs. 231/2007', 'Obblighi e modalità dell\'adeguata verifica'), ('Art. 20 D.Lgs. 231/2007', 'Criteri per la determinazione del titolare effettivo'), ('Art. 23 D.Lgs. 231/2007', 'Misure semplificate'), ('Art. 24 D.Lgs. 231/2007', 'Misure rafforzate'), ('Art. 42 D.Lgs. 231/2007', 'Astensione')],
         fasi=[('Raccolta documentale', 'ADV', 'Visura camerale aggiornata, documento del legale rappresentante e dei delegati, procure, statuto se necessario, dichiarazione sul titolare effettivo, questionario AML del mandante.'),
               ('Identificazione e verifica', 'ADV', 'Verifica dei dati su fonti affidabili e indipendenti (registro imprese, registro dei titolari effettivi ove consultabile); controllo PEP e liste di sanzioni (AML-06).'),
               ('Scopo e natura del rapporto', 'ADV', 'Registrazione di tipologia dei crediti affidati, volumi, canali di incasso concordati e modalità di riversamento.'),
               ('Profilatura', 'ADV', 'Scheda di profilatura (AML-03); misure semplificate, ordinarie o rafforzate in base alla classe.'),
               ('Approvazione del rapporto', 'RAML / DL', 'Per i mandanti ad alto rischio l\'avvio del rapporto richiede l\'autorizzazione del RAML e del DL.'),
               ('Astensione', 'RAML', 'Se non è possibile completare l\'adeguata verifica il rapporto non si avvia; il RAML valuta l\'invio di una SOS (AML-09).'),
               ('Fascicolo', 'ADV', 'Tutta la documentazione confluisce nel fascicolo AML del mandante nel portale, con data e autore.')],
         raci_cols=['ADV', 'RAML', 'DC', 'DL'],
         raci=[('Raccolta e verifica documenti', ['R', 'C', 'C', '—']), ('Profilatura', ['R', 'A', 'I', '—']), ('Approvazione mandanti ad alto rischio', ['C', 'R', 'I', 'A']), ('Astensione', ['I', 'R', 'I', 'A'])],
         flussi=[('Fascicolo AML del mandante', 'ADV', 'RAML', 'Fascicolo nel portale', 'Prima dell\'avvio del mandato', 'Portale — Fascicoli AML'),
                 ('Autorizzazione rapporto ad alto rischio', 'RAML', 'DL', 'Approvazione nel portale', 'Prima dell\'avvio', 'Fascicolo AML del mandante')],
         kpi=[('Mandanti con fascicolo completo', '100%', 'Continuo'), ('Rapporti ad alto rischio autorizzati', '100%', 'Continuo')],
         anomalie=[('Titolare effettivo non individuabile', 'Struttura societaria complessa o opaca', 'Rafforzata; se resta non individuabile, astensione e valutazione SOS.'),
                   ('Documenti scaduti', 'Mancato aggiornamento', 'Richiesta immediata; sospensione dei riversamenti se non regolarizzati entro 30 giorni.')]),

    dict(codice='AML-05', titolo='Adeguata verifica dei debitori e gestione degli incassi', owner='RAML', ambito='identificazione dei debitori e dei soggetti che pagano, controlli sugli incassi',
         funzioni=['ADV', 'RAML', 'AMM'],
         scopo=['Regolare i presidi antiriciclaggio sui debitori: identificazione del debitore e di chi effettua il pagamento, verifica della provenienza dei fondi quando il pagamento è anomalo per importo, modalità o soggetto pagatore, profilatura e conservazione.',
                'L\'attenzione si concentra su: pagamenti da terzi non legati al debitore, pagamenti da conti esteri o da paesi ad alto rischio, contante, frazionamenti, pagamenti eccedenti il dovuto con richiesta di restituzione, saldi improvvisi di posizioni di importo rilevante.'],
         rif=[R_BASE, ('Artt. 17-19 D.Lgs. 231/2007', 'Adeguata verifica'), ('Art. 49 D.Lgs. 231/2007', 'Limitazioni all\'uso del contante (soglia vigente)'), ('Provvedimento UIF 12 maggio 2023', 'Indicatori di anomalia')],
         fasi=[('Identificazione del debitore', 'ADV', 'All\'avvio della pratica: dati anagrafici e documento quando il debitore entra in contatto per accordi di pagamento o piani di rientro.'),
               ('Accordi di pagamento', 'ADV', 'Il piano di rientro indica importi, scadenze e canali tracciabili; il pagamento in contante è ammesso solo entro la soglia di legge e secondo AML-10.'),
               ('Verifica del pagatore', 'ADV / AMM', 'A ogni incasso si verifica che il pagatore sia il debitore o un soggetto legato (coniuge, garante, datore di lavoro su cessione); in caso contrario si raccolgono dati e motivazione del terzo pagatore.'),
               ('Pagamenti anomali', 'ADV', 'Saldi improvvisi di importo rilevante, pagamenti dall\'estero, frazionamenti, eccedenze con richiesta di rimborso: segnalazione interna al DSOS (AML-09).'),
               ('Rimborsi', 'AMM', 'Le eccedenze si restituiscono solo allo stesso conto di provenienza, previa verifica del RAML.'),
               ('Fascicolo', 'ADV', 'Documenti, profilo e anomalie nel fascicolo AML del debitore nel portale.')],
         raci_cols=['ADV', 'AMM', 'RAML', 'DSOS'],
         raci=[('Identificazione del debitore', ['R', '—', 'C', '—']), ('Verifica del pagatore', ['R', 'R', 'C', 'I']), ('Segnalazione interna di anomalie', ['R', 'R', 'I', 'A']), ('Rimborsi delle eccedenze', ['C', 'R', 'A', 'I'])],
         flussi=[('Segnalazione interna di anomalia', 'ADV / AMM', 'DSOS', 'Modulo nel portale', 'Senza ritardo', 'Registro segnalazioni interne (riservato)'),
                 ('Fascicolo AML del debitore', 'ADV', 'RAML', 'Fascicolo nel portale', 'Durante la pratica', 'Portale — Fascicoli AML')],
         kpi=[('Incassi da terzi con motivazione registrata', '100%', 'Continuo'), ('Anomalie segnalate al DSOS entro 2 giorni lavorativi', '100%', 'Continuo')],
         anomalie=[('Pagamento da terzo sconosciuto', 'Soggetto non legato al debitore', 'Raccolta dati e motivazione; se non giustificato, segnalazione interna al DSOS.'),
                   ('Richiesta di rimborso su conto diverso', 'Possibile triangolazione', 'Rifiuto; restituzione solo al conto di provenienza; segnalazione interna.')]),

    dict(codice='AML-06', titolo='Titolare effettivo, persone politicamente esposte e liste di sanzioni', owner='RAML', ambito='individuazione del titolare effettivo, controlli PEP, sanzioni ed embarghi',
         funzioni=['ADV', 'RAML'],
         scopo=['Definire come {{AZIENDA}} individua il titolare effettivo dei clienti persone giuridiche, riconosce le persone politicamente esposte (PEP) e verifica che mandanti, debitori e pagatori non siano presenti nelle liste di sanzioni finanziarie.',
                'La presenza di un PEP comporta l\'adeguata verifica rafforzata e l\'autorizzazione del DL; la corrispondenza con una lista di sanzioni comporta il blocco dell\'operatività e l\'immediato coinvolgimento del RAML.'],
         rif=[R_BASE, ('Art. 20 D.Lgs. 231/2007', 'Titolare effettivo'), ('Art. 1, c. 2, lett. dd) D.Lgs. 231/2007', 'Definizione di persone politicamente esposte'), ('Art. 24 D.Lgs. 231/2007', 'Rafforzata per PEP e paesi ad alto rischio'), ('D.Lgs. 109/2007', 'Misure di congelamento (sanzioni finanziarie)')],
         fasi=[('Titolare effettivo', 'ADV', 'Dichiarazione del cliente, verifica su visura e registro dei titolari effettivi; criteri di proprietà (>25%), controllo e, in mancanza, legali rappresentanti.'),
               ('Controllo PEP', 'ADV', 'Dichiarazione del cliente e verifica su fonti pubbliche o banca dati; estensione a familiari e stretti collaboratori.'),
               ('Liste di sanzioni', 'ADV', 'Verifica del nominativo sulle liste UE e ONU all\'avvio e a ogni aggiornamento rilevante.'),
               ('Esito positivo', 'RAML', 'PEP: rafforzata e autorizzazione del DL; corrispondenza con liste: blocco, verifica dell\'omonimia, comunicazioni previste dalla normativa.'),
               ('Registrazione', 'ADV', 'Esito dei controlli con data, fonte e autore nel fascicolo AML.')],
         raci_cols=['ADV', 'RAML', 'DL', 'DSOS'],
         raci=[('Titolare effettivo e PEP', ['R', 'C', 'I', '—']), ('Esito positivo PEP', ['C', 'R', 'A', 'I']), ('Corrispondenza con liste di sanzioni', ['I', 'R', 'A', 'C'])],
         flussi=[('Esito controlli TE / PEP / liste', 'ADV', 'Fascicolo cliente', 'Registrazione nel portale', 'Apertura e revisioni', 'Fascicolo AML del cliente')],
         kpi=[('Clienti con verifica liste registrata', '100%', 'Continuo')],
         anomalie=[('Omonimia con soggetto in lista', 'Dati anagrafici simili', 'Verifica con dati aggiuntivi; blocco fino alla conferma.'),
                   ('Dichiarazione PEP non resa', 'Cliente non collaborativo', 'Rafforzata; se persiste, astensione.')]),

    dict(codice='AML-07', titolo='Controllo costante e aggiornamento dei fascicoli', owner='RAML', ambito='monitoraggio dei rapporti e aggiornamento periodico di documenti e profili',
         funzioni=['ADV', 'RAML'],
         scopo=['Assicurare il controllo costante dei rapporti con mandanti e debitori: coerenza delle operazioni con il profilo, aggiornamento di documenti, dati e profilo di rischio con frequenza proporzionata al rischio.',
                'Frequenze di revisione: rischio alto ogni 12 mesi, medio ogni 24 mesi, basso ogni 36 mesi, e comunque a ogni evento rilevante. Il portale genera le scadenze e assegna i task agli addetti.'],
         rif=[R_BASE, ('Art. 18, c. 1, lett. d) D.Lgs. 231/2007', 'Controllo costante del rapporto'), ('Art. 19, c. 1, lett. d) D.Lgs. 231/2007', 'Modalità del controllo costante')],
         fasi=[('Pianificazione', 'RAML', 'Il portale calcola le scadenze di revisione per classe di rischio.'),
               ('Revisione del fascicolo', 'ADV', 'Verifica di documenti, titolare effettivo, PEP e liste; aggiornamento della scheda di profilatura.'),
               ('Analisi delle operazioni', 'ADV', 'Confronto tra incassi/riversamenti e profilo: volumi, canali, pagatori.'),
               ('Esito', 'ADV', 'Conferma o modifica della classe; eventuali anomalie al DSOS.'),
               ('Supervisione', 'RAML', 'Verifica a campione delle revisioni e dei ritardi.')],
         raci_cols=C4,
         raci=[('Revisione periodica', ['A', 'I', 'R', '—']), ('Analisi delle operazioni', ['C', 'I', 'R', '—']), ('Supervisione', ['R', '—', 'I', 'I'])],
         flussi=[('Esito revisione del fascicolo', 'ADV', 'RAML', 'Registrazione nel portale', 'Alla scadenza', 'Fascicolo AML del cliente'),
                 ('Report revisioni scadute', 'RAML', 'DL', 'Report', 'Trimestrale', 'Fascicolo AML aziendale')],
         kpi=[('Revisioni completate entro la scadenza', '≥ 95%', 'Trimestrale')],
         anomalie=[('Revisione scaduta', 'Carico di lavoro', 'Sollecito; oltre 60 giorni sospensione di nuove attività sul rapporto.'),
                   ('Operazioni incoerenti con il profilo', 'Variazione del comportamento', 'Aggiornamento del profilo e segnalazione interna.')]),

    dict(codice='AML-08', titolo='Conservazione dei dati e dei documenti', owner='RAML', ambito='conservazione di documenti, dati e informazioni per 10 anni',
         funzioni=['RAML', 'IT', 'DPO'],
         scopo=['Garantire che documenti, dati e informazioni acquisiti per l\'adeguata verifica e le operazioni siano conservati per dieci anni dalla cessazione del rapporto, in modo da essere accessibili, integri e utilizzabili per gli accertamenti delle autorità.',
                'La conservazione avviene nei fascicoli AML del portale, con data, autore e impronta digitale (hash) di ogni documento; i dati personali sono trattati secondo il GDPR.'],
         rif=[R_BASE, ('Artt. 31-34 D.Lgs. 231/2007', 'Obblighi e modalità di conservazione'), ('Reg. UE 2016/679 (GDPR)', 'Protezione dei dati personali')],
         fasi=[('Acquisizione', 'ADV', 'Caricamento dei documenti nel fascicolo AML al momento dell\'acquisizione.'),
               ('Integrità', 'IT', 'Impronta hash e registro delle modifiche; nessuna cancellazione nel periodo di conservazione.'),
               ('Accesso', 'RAML', 'Accesso riservato agli incaricati; registro degli accessi.'),
               ('Esibizione', 'RAML', 'Messa a disposizione dei documenti in caso di ispezione o richiesta delle autorità.'),
               ('Cancellazione', 'DPO / RAML', 'Cancellazione o anonimizzazione decorsi i dieci anni, salvo contenziosi.')],
         raci_cols=['RAML', 'IT', 'DPO', 'ADV'],
         raci=[('Caricamento documenti', ['A', '—', '—', 'R']), ('Integrità e accessi', ['A', 'R', 'C', '—']), ('Cancellazione a termine', ['A', 'C', 'R', '—'])],
         flussi=[('Fascicoli AML', 'ADV', 'Archivio', 'Portale', 'Continuo', 'Portale — 10 anni')],
         kpi=[('Documenti con impronta hash', '100%', 'Continuo')],
         anomalie=[('Documento mancante in ispezione', 'Caricamento omesso', 'Recupero immediato e verifica a tappeto sul campione.')]),

    dict(codice='AML-09', titolo='Segnalazione delle operazioni sospette (SOS)', owner='DSOS', ambito='flusso interno delle segnalazioni, valutazione del Delegato e invio alla UIF',
         funzioni=['ADV', 'DSOS', 'DL'], classificazione='Riservato — accesso limitato al Delegato SOS',
         scopo=['Regolare il processo con cui il personale di {{AZIENDA}} segnala al Delegato SOS le operazioni che sa, sospetta o ha motivo di sospettare collegate a riciclaggio o finanziamento del terrorismo, e la valutazione del Delegato per l\'eventuale invio alla UIF.',
                'È garantita la riservatezza dell\'identità del segnalante ed è vietato comunicare al cliente o a terzi l\'avvenuta segnalazione. Il registro delle segnalazioni interne è accessibile solo al Delegato SOS.'],
         rif=[R_BASE, ('Art. 35 D.Lgs. 231/2007', 'Obbligo di segnalazione delle operazioni sospette'), ('Art. 36 D.Lgs. 231/2007', 'Modalità di segnalazione'), ('Art. 38 D.Lgs. 231/2007', 'Tutela della riservatezza del segnalante'), ('Art. 39 D.Lgs. 231/2007', 'Divieto di comunicazione'), ('Provvedimento UIF 12 maggio 2023', 'Indicatori di anomalia')],
         fasi=[('Rilevazione', 'ADV / AMM', 'Il dipendente che rileva un\'anomalia (indicatori UIF, AML-05) compila la segnalazione interna nel portale, senza ritardo.'),
               ('Istruttoria', 'DSOS', 'Il Delegato acquisisce fascicolo e operazioni, approfondisce, eventualmente chiede chiarimenti senza rivelare la finalità.'),
               ('Decisione', 'DSOS', 'Invio alla UIF tramite il portale Infostat-UIF oppure archiviazione motivata per iscritto.'),
               ('Invio alla UIF', 'DSOS', 'Segnalazione senza ritardo e, ove possibile, prima di eseguire l\'operazione; conservazione della ricevuta.'),
               ('Riservatezza', 'DSOS', 'Nessuna informazione al cliente o a terzi; esito al segnalante solo in forma generica.'),
               ('Seguiti', 'DSOS', 'Gestione di richieste UIF e autorità; rafforzamento del controllo costante sul cliente.')],
         raci_cols=['ADV', 'DSOS', 'RAML', 'DL'],
         raci=[('Segnalazione interna', ['R', 'I', '—', '—']), ('Istruttoria e decisione', ['C', 'R', 'C', 'I']), ('Invio alla UIF', ['—', 'R', 'I', 'I'])],
         flussi=[('Segnalazione interna', 'Dipendente', 'DSOS', 'Modulo riservato nel portale', 'Senza ritardo', 'Registro segnalazioni (solo DSOS)'),
                 ('Decisione motivata', 'DSOS', 'Registro', 'Scheda riservata', 'Entro 15 giorni', 'Registro segnalazioni (solo DSOS)'),
                 ('SOS alla UIF', 'DSOS', 'UIF', 'Infostat-UIF', 'Senza ritardo', 'Ricevuta nel registro (solo DSOS)')],
         kpi=[('Segnalazioni interne valutate entro 15 giorni', '100%', 'Continuo'), ('Decisioni di archiviazione motivate', '100%', 'Continuo')],
         anomalie=[('Fuga di notizie verso il cliente', 'Violazione del divieto', 'Informativa al DL; provvedimenti disciplinari; valutazione delle conseguenze.'),
                   ('Segnalazione interna tardiva', 'Mancata percezione dell\'anomalia', 'Formazione mirata; valutazione nel controllo interno.')]),

    dict(codice='AML-10', titolo='Limitazioni all\'uso del contante e comunicazione delle infrazioni', owner='RAML', ambito='incassi in contante e comunicazione al MEF delle violazioni rilevate',
         funzioni=['AMM', 'ADV', 'RAML'],
         scopo=['Stabilire che gli incassi da debitori avvengano con strumenti tracciabili e che il contante sia accettato solo entro la soglia di legge vigente, con ricevuta e identificazione del pagatore.',
                'Il personale che rileva infrazioni alle limitazioni al contante ne informa il RAML, che provvede alla comunicazione al Ministero dell\'Economia e delle Finanze nei termini di legge.'],
         rif=[R_BASE, ('Art. 49 D.Lgs. 231/2007', 'Limitazioni all\'uso del contante e dei titoli al portatore'), ('Art. 51 D.Lgs. 231/2007', 'Obbligo di comunicazione delle infrazioni al MEF')],
         fasi=[('Canali di incasso', 'AMM', 'Bonifico, bollettino, carte e strumenti tracciabili come canali ordinari.'),
               ('Contante', 'ADV', 'Ammesso solo entro la soglia vigente, con ricevuta numerata e identificazione del pagatore; vietato il frazionamento artificioso.'),
               ('Infrazioni', 'ADV / AMM', 'Rilevazione di pagamenti oltre soglia o frazionati: informativa al RAML.'),
               ('Comunicazione al MEF', 'RAML', 'Comunicazione entro 30 giorni; valutazione congiunta con il DSOS dell\'eventuale SOS.')],
         raci_cols=['AMM', 'ADV', 'RAML', 'DSOS'],
         raci=[('Incassi in contante', ['R', 'R', 'I', '—']), ('Comunicazione al MEF', ['C', 'C', 'R', 'C'])],
         flussi=[('Comunicazione infrazione', 'RAML', 'MEF', 'Modulo ministeriale', 'Entro 30 giorni', 'Fascicolo AML aziendale')],
         kpi=[('Incassi in contante oltre soglia', '0', 'Mensile')],
         anomalie=[('Contante oltre soglia', 'Pressione del debitore', 'Rifiuto dell\'incasso; se avvenuto, comunicazione al MEF e valutazione SOS.')]),

    dict(codice='AML-11', titolo='Formazione antiriciclaggio del personale', owner='RAML', ambito='formazione iniziale e periodica del personale e registro della formazione',
         funzioni=['RAML', 'HR'],
         scopo=['Assicurare che dipendenti e collaboratori di {{AZIENDA}} conoscano gli obblighi antiriciclaggio, gli indicatori di anomalia e le procedure aziendali, con formazione iniziale all\'ingresso e aggiornamento almeno annuale.',
                'La formazione si eroga nel portale (corso AML con test di verifica); il registro della formazione riporta partecipanti, date, durata, esiti e attestati.'],
         rif=[R_BASE, ('Art. 16, c. 3 D.Lgs. 231/2007', 'Formazione continua del personale')],
         fasi=[('Piano formativo', 'RAML / HR', 'Piano annuale con contenuti differenziati per ruolo (addetti, amministrazione, management).'),
               ('Erogazione', 'HR', 'Corso AML nel portale; formazione iniziale entro 30 giorni dall\'ingresso.'),
               ('Verifica dell\'apprendimento', 'RAML', 'Test finale; ripetizione in caso di esito negativo.'),
               ('Registro', 'HR', 'Registro della formazione con attestati, conservato e disponibile per le ispezioni.')],
         raci_cols=['RAML', 'HR', 'ADV', 'DL'],
         raci=[('Piano formativo', ['R', 'C', 'I', 'A']), ('Erogazione e registro', ['C', 'R', 'I', 'I'])],
         flussi=[('Registro della formazione', 'HR', 'RAML, ispettori', 'Portale', 'Continuo', 'Portale — Registro formazione')],
         kpi=[('Personale formato nell\'anno', '100%', 'Annuale'), ('Test superati al primo tentativo', '≥ 85%', 'Annuale')],
         anomalie=[('Dipendente non formato', 'Assenza', 'Recupero entro 30 giorni; fino ad allora non opera su nuove pratiche.')]),

    dict(codice='AML-12', titolo='Controlli interni e verifica dell\'efficacia dei presidi', owner='RCI', ambito='verifiche periodiche di conformità e relazione annuale',
         funzioni=['RCI', 'RAML', 'CdA'],
         scopo=['Definire le verifiche periodiche sull\'efficacia del presidio antiriciclaggio: completezza dei fascicoli, tempestività del controllo costante, gestione delle anomalie e delle segnalazioni, formazione, conservazione.',
                'Gli esiti sono documentati con evidenze nel portale e portano ad azioni correttive nel Piano d\'azione; la relazione annuale è presentata all\'organo amministrativo.'],
         rif=[R_BASE, ('Art. 16 D.Lgs. 231/2007', 'Procedure e controlli interni proporzionati')],
         fasi=[('Piano dei controlli', 'RCI', 'Piano annuale: aree, campioni, frequenze (almeno semestrale per i fascicoli ad alto rischio).'),
               ('Verifiche a campione', 'RCI', 'Controllo di fascicoli, revisioni, incassi da terzi, contante, formazione; checklist nel portale.'),
               ('Evidenze', 'RCI', 'Esiti, carenze e documenti a supporto salvati nel portale con data e autore.'),
               ('Azioni correttive', 'RAML', 'Azioni con responsabile e scadenza nel Piano d\'azione; verifica della chiusura.'),
               ('Relazione annuale', 'RCI / RAML', 'Relazione al CdA sugli esiti dei controlli e sullo stato delle azioni.')],
         raci_cols=['RCI', 'RAML', 'CdA', 'ADV'],
         raci=[('Piano e verifiche', ['R', 'C', 'I', 'C']), ('Azioni correttive', ['C', 'R', 'I', 'R']), ('Relazione annuale', ['R', 'C', 'A', '—'])],
         flussi=[('Verbale di verifica', 'RCI', 'RAML', 'Checklist nel portale', 'A ogni verifica', 'Portale — Controlli AML'),
                 ('Relazione annuale sui controlli', 'RCI', 'CdA', 'Documento', 'Annuale', 'Fascicolo AML aziendale')],
         kpi=[('Verifiche del piano eseguite', '100%', 'Annuale'), ('Azioni correttive chiuse nei tempi', '≥ 90%', 'Trimestrale')],
         anomalie=[('Carenza grave', 'Presidio inefficace', 'Informativa immediata al CdA e piano di rientro.')]),

    dict(codice='AML-13', titolo='Segnalazione interna delle violazioni (whistleblowing AML)', owner='RAML', ambito='canale riservato per segnalare violazioni della normativa antiriciclaggio',
         funzioni=['RAML', 'DL'],
         scopo=['Mettere a disposizione di dipendenti e collaboratori un canale riservato per segnalare violazioni, potenziali o effettive, delle disposizioni antiriciclaggio, con tutela del segnalante da ritorsioni.',
                'Il canale si coordina con il sistema aziendale di whistleblowing; le segnalazioni sono gestite in modo riservato e documentato.'],
         rif=[R_BASE, ('Art. 48 D.Lgs. 231/2007', 'Sistemi interni di segnalazione delle violazioni'), ('D.Lgs. 24/2023', 'Protezione delle persone che segnalano violazioni')],
         fasi=[('Ricezione', 'RAML', 'Ricezione tramite il canale riservato; avviso di ricevimento al segnalante.'),
               ('Istruttoria', 'RAML', 'Verifica dei fatti in modo riservato; coinvolgimento del DL se non coinvolto.'),
               ('Esito', 'RAML', 'Azioni correttive o archiviazione motivata; riscontro al segnalante nei termini.'),
               ('Tutela', 'DL', 'Nessuna ritorsione; riservatezza dell\'identità.')],
         raci_cols=['RAML', 'DL', 'CdA', 'HR'],
         raci=[('Gestione della segnalazione', ['R', 'C', 'I', '—']), ('Tutela del segnalante', ['C', 'R', 'A', 'C'])],
         flussi=[('Registro segnalazioni di violazione', 'RAML', 'CdA (in forma aggregata)', 'Registro riservato', 'Annuale', 'Archivio riservato')],
         kpi=[('Segnalazioni gestite nei termini', '100%', 'Continuo')],
         anomalie=[('Segnalazione sul RAML', 'Conflitto di interessi', 'Gestione da parte del DL o del CdA.')]),
]


def sql_str(t):
    return "'" + t.replace("'", "''") + "'"


if __name__ == '__main__':
    out = ['-- Procedure antiriciclaggio per INTELLCREDIT S.P.A. (procedure riservate all\'azienda: settore azienda:<id>)',
           '-- Generato da scripts/aml/procedure_aml.py — bozza da confrontare con le procedure in uso', 'begin;']
    for p in PROCEDURE:
        corpo = procedura(p)
        funzioni = 'array[' + ','.join(sql_str(f) for f in p['funzioni']) + ']::text[]'
        out.append(f"delete from public.procedure_template where codice = {sql_str(p['codice'])} and settore = {sql_str(SETTORE)};")
        out.append(f"delete from public.procedure_catalogo where codice = {sql_str(p['codice'])} and settore = {sql_str(SETTORE)};")
        out.append(f"insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ({sql_str(p['codice'])}, {sql_str(SETTORE)}, {sql_str(AREA)}, {sql_str(p['titolo'])}, {funzioni}, true);")
        out.append(f"insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ({sql_str(p['codice'])}, {sql_str(SETTORE)}, {sql_str(AREA)}, {sql_str(p['titolo'])}, {funzioni}, {sql_str(corpo)}, '0.1');")
    # ruoli AML nell'organigramma (senza persona: li assegna l'utente)
    for sigla, nome in RUOLI_AML.items():
        out.append(f"insert into public.ruoli (azienda_id, sigla, nome, fascia) select {sql_str(AZIENDA_ID)}, {sql_str(sigla)}, {sql_str(nome)}, 'staff' where not exists (select 1 from public.ruoli where azienda_id = {sql_str(AZIENDA_ID)} and sigla = {sql_str(sigla)});")
    out.append('commit;')
    print('\n'.join(out))
