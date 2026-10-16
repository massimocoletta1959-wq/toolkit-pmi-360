-- Procedure antiriciclaggio per INTELLCREDIT S.P.A. (procedure riservate all'azienda: settore azienda:<id>)
-- Generato da scripts/aml/procedure_aml.py — bozza da confrontare con le procedure in uso
begin;
delete from public.procedure_template where codice = 'AML-01' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-01' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-01', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Politica antiriciclaggio e assetto organizzativo', array['CdA','DL','RAML','DSOS']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-01', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Politica antiriciclaggio e assetto organizzativo', array['CdA','DL','RAML','DSOS']::text[], '<blockquote>
<p><strong>AML-01 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Politica antiriciclaggio e assetto organizzativo</h1>
<blockquote>
<p><em>Ambito: principi, ruoli e responsabilità del presidio antiriciclaggio — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-01</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Politica antiriciclaggio e assetto organizzativo</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Definire la politica di {{AZIENDA}} per la prevenzione del riciclaggio e del finanziamento del terrorismo nell''attività di recupero stragiudiziale dei crediti per conto terzi, e l''assetto organizzativo che la presidia: organo amministrativo, Responsabile Antiriciclaggio, Delegato SOS, addetti all''adeguata verifica, controlli interni.</p><p>Modello operativo: {{AZIENDA}} gestisce in via esclusivamente telefonica (phone collection) portafogli di crediti bancari/NPL e commerciali; non impiega esattori domiciliari e non incassa contante; gli incassi avvengono con strumenti tracciabili (bonifico, SDD, link di pagamento con carta). La funzione antiriciclaggio è istituita e le verifiche sui debitori sono svolte caso per caso al verificarsi di trigger oggettivi.</p><p>Il documento è il capitolo introduttivo del Manuale AML: le procedure AML-02 … AML-13 ne costituiscono le parti operative. Si applica a tutti i dipendenti e collaboratori, anche esterni, che gestiscono mandanti, debitori, incassi e documentazione.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 3, c. 5 D.Lgs. 231/2007</strong></td><td>Operatori non finanziari: recupero stragiudiziale dei crediti per conto di terzi con licenza ex art. 115 TULPS</td></tr><tr><td><strong>Artt. 15 e 16 D.Lgs. 231/2007</strong></td><td>Valutazione del rischio, procedure e controlli proporzionati</td></tr><tr><td><strong>Art. 115 TULPS (R.D. 773/1931)</strong></td><td>Licenza per l''attività di recupero crediti per conto di terzi</td></tr><tr><td><strong>Art. 120 TULPS (R.D. 773/1931)</strong></td><td>Registro giornale degli affari</td></tr><tr><td><strong>Indicazioni UNIREC</strong></td><td>Linee guida di categoria per le agenzie di recupero crediti</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Approvazione della politica</td><td>CdA</td><td>L''organo amministrativo approva la politica AML, l''organigramma AML e il Manuale; ne verifica l''adeguatezza almeno annualmente.</td></tr><tr><td><strong>2</strong></td><td>Nomina delle funzioni</td><td>CdA</td><td>Delibera di nomina del Responsabile Antiriciclaggio e del Delegato SOS con requisiti, poteri, risorse e linee di riporto; accettazione scritta dell''incarico (fascicolo BJR).</td></tr><tr><td><strong>3</strong></td><td>Organigramma AML</td><td>RAML</td><td>Aggiornamento dell''organigramma AML: addetti all''adeguata verifica per ciascuna area (gestione mandanti, recupero, incassi), sostituti in caso di assenza.</td></tr><tr><td><strong>4</strong></td><td>Diffusione del Manuale</td><td>RAML</td><td>Invio del Manuale e delle procedure a tutti gli incaricati con presa visione tracciata; aggiornamento a ogni modifica normativa od organizzativa.</td></tr><tr><td><strong>5</strong></td><td>Riporto all''organo amministrativo</td><td>RAML</td><td>Relazione annuale su rischi, controlli, formazione, segnalazioni (in forma anonima) e azioni correttive.</td></tr><tr><td><strong>6</strong></td><td>Licenze e registri di legge</td><td>DL</td><td>Licenza ex art. 115 TULPS archiviata nel portale con le scadenze. Il registro giornale degli affari (art. 120 TULPS), tenuto in forma cartacea presso la sede, si aggiorna giorno per giorno in ordine cronologico, senza accumulare le pratiche: per ogni affare data di affidamento, committente, debitore e natura del credito, importo da recuperare e compenso pattuito, esito (incasso totale o parziale, piano di rientro, esito negativo). In ispezione deve riflettere la situazione fino al giorno del controllo. Nel portale si annotano il responsabile, il luogo di custodia e le verifiche di allineamento (AML-12). Sono i primi documenti richiesti all''avvio di una verifica.</td></tr><tr><td><strong>7</strong></td><td>Riesame</td><td>CdA</td><td>Riesame annuale della politica sulla base della relazione e dell''autovalutazione del rischio (AML-02).</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>CdA</strong></th><th><strong>RAML</strong></th><th><strong>DSOS</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Approvazione politica e Manuale</strong></td><td>A</td><td>R</td><td>C</td><td>C</td></tr><tr><td><strong>Nomina delle funzioni AML</strong></td><td>A</td><td>C</td><td>I</td><td>R</td></tr><tr><td><strong>Diffusione e prese visione</strong></td><td>I</td><td>R</td><td>I</td><td>C</td></tr><tr><td><strong>Relazione annuale</strong></td><td>I</td><td>R</td><td>C</td><td>I</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Delibera di nomina RAML e DSOS</strong></td><td>CdA</td><td>→</td><td>RAML, DSOS, personale</td><td>Delibera con fascicolo</td><td>Alla nomina</td><td><blockquote><p>Registro delibere</p></blockquote></td></tr><tr><td><strong>Organigramma AML</strong></td><td>RAML</td><td>→</td><td>Tutto il personale</td><td>Documento</td><td>A ogni variazione</td><td><blockquote><p>Portale — Organigramma</p></blockquote></td></tr><tr><td><strong>Relazione annuale AML</strong></td><td>RAML</td><td>→</td><td>CdA</td><td>Documento</td><td>Entro aprile</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Funzioni AML nominate con accettazione</td><td>100%</td><td>Continuo</td></tr><tr><td>Prese visione del Manuale</td><td>100% degli incaricati</td><td>A ogni emissione</td></tr><tr><td>Relazione annuale presentata al CdA</td><td>Sì</td><td>Annuale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Funzione AML vacante</strong></td><td>Dimissioni o assenza prolungata</td><td>Nomina del sostituto con delibera entro 30 giorni; nel frattempo le attività passano al DL.</td></tr><tr><td><strong>Manuale non letto da un incaricato</strong></td><td>Presa visione non effettuata</td><td>Sollecito; senza presa visione l''incaricato non opera su nuove pratiche.</td></tr><tr><td><strong>Variazione normativa</strong></td><td>Nuove disposizioni o indicatori UIF</td><td>Aggiornamento delle procedure entro 60 giorni e nuova diffusione.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-01 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-02' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-02' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-02', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Autovalutazione del rischio di riciclaggio', array['RAML','CdA','RCI']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-02', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Autovalutazione del rischio di riciclaggio', array['RAML','CdA','RCI']::text[], '<blockquote>
<p><strong>AML-02 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Autovalutazione del rischio di riciclaggio</h1>
<blockquote>
<p><em>Ambito: valutazione periodica dell''esposizione complessiva dell''azienda ai rischi di riciclaggio e finanziamento del terrorismo — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-02</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Autovalutazione del rischio di riciclaggio</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Stabilire come {{AZIENDA}} valuta, almeno una volta l''anno e a ogni cambiamento rilevante, la propria esposizione complessiva ai rischi di riciclaggio e finanziamento del terrorismo. L''esercizio non valuta il singolo cliente ma la struttura nel suo insieme; è documentato, aggiornato periodicamente e non è delegabile all''esterno, anche se l''organo amministrativo può farsi assistere dalla funzione AML o da consulenti.</p><p>Metodo: Rischio inerente (natura del business) − Vulnerabilità (qualità dei presidi) = Rischio residuo. Se il rischio residuo è elevato, l''organo amministrativo approva immediate azioni correttive. Nel portale l''esercizio si registra nel Registro rischi (categoria «Antiriciclaggio») e le azioni nel Piano d''azione.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 15 D.Lgs. 231/2007</strong></td><td>Valutazione del rischio da parte dei soggetti obbligati</td></tr><tr><td><strong>Art. 3, c. 5 D.Lgs. 231/2007</strong></td><td>Operatori non finanziari: recupero stragiudiziale dei crediti per conto di terzi con licenza ex art. 115 TULPS</td></tr><tr><td><strong>Analisi nazionale dei rischi (NRA)</strong></td><td>Rischi di settore individuati dal Comitato di sicurezza finanziaria</td></tr><tr><td><strong>Indicazioni Banca d''Italia e UNIREC</strong></td><td>Metodologia di autovalutazione (rischio inerente, vulnerabilità, rischio residuo)</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Rischio inerente — clientela</td><td>RAML</td><td>Committenti: bancari/NPL (rischio basso, la banca ha già svolto l''adeguata verifica all''origine del rapporto) e commerciali (rischio medio: attenzione a interposizioni fittizie e frodi). Debitori: persone fisiche e giuridiche, catene societarie complesse, presenza in aree esposte a infiltrazione criminale.</td></tr><tr><td><strong>2</strong></td><td>Rischio inerente — canali</td><td>RAML</td><td>Contatto esclusivamente telefonico; incassi tracciabili (bonifico, SDD, link di pagamento con carta); nessun contante. Rischio concentrato sulla provenienza dei fondi: bonifici da conti di terzi, pagamenti dall''estero, frazionamenti, saldi improvvisi.</td></tr><tr><td><strong>3</strong></td><td>Rischio inerente — aree geografiche</td><td>RAML</td><td>Distribuzione territoriale dei debitori e dei pagamenti; operatività con soggetti o conti legati a paesi terzi ad alto rischio.</td></tr><tr><td><strong>4</strong></td><td>Vulnerabilità dei presidi</td><td>RAML / RCI</td><td>Valutazione di: policy e procedure; funzione AML (punto di forza); identificazione a distanza del debitore (punto critico); verifiche manuali caso per caso (rischio di errori, ritardi e mancate rilevazioni — «false clean» — per assenza di screening automatico); formazione degli operatori telefonici; tracciabilità e conservazione decennale.</td></tr><tr><td><strong>5</strong></td><td>Rischio residuo</td><td>RAML</td><td>Combinazione di rischio inerente e vulnerabilità sulla matrice approvata (scala 1-4); giudizio complessivo e per area. Il capitolo sui controlli interni dichiara che il controllo manuale è commisurato al canale tracciabile, compensato da trigger oggettivi, audit trail, controlli a campione e formazione almeno annuale.</td></tr><tr><td><strong>6</strong></td><td>Azioni correttive</td><td>RAML</td><td>Azioni con responsabile e scadenza nel Piano d''azione, tra cui la valutazione dell''integrazione di uno screening massivo (PEP/sanzioni) dei portafogli all''atto dell''affidamento.</td></tr><tr><td><strong>7</strong></td><td>Approvazione</td><td>CdA</td><td>Esame e approvazione dell''autovalutazione; conservazione nel fascicolo AML aziendale.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>RCI</strong></th><th><strong>CdA</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Rischio inerente</strong></td><td>R</td><td>C</td><td>I</td><td>C</td></tr><tr><td><strong>Vulnerabilità dei presidi</strong></td><td>R</td><td>C</td><td>I</td><td>I</td></tr><tr><td><strong>Approvazione e azioni correttive</strong></td><td>R</td><td>I</td><td>A</td><td>C</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Documento di autovalutazione</strong></td><td>RAML</td><td>→</td><td>CdA</td><td>Documento + Registro rischi</td><td>Annuale (entro marzo)</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr><tr><td><strong>Piano delle azioni correttive</strong></td><td>RAML</td><td>→</td><td>Responsabili di funzione</td><td>Piano d''azione</td><td>Con l''autovalutazione</td><td><blockquote><p>Portale — Piano d''azione</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Autovalutazione aggiornata</td><td>Entro 12 mesi</td><td>Annuale</td></tr><tr><td>Azioni correttive chiuse nei tempi</td><td>≥ 90%</td><td>Trimestrale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Nuovo mandante, portafoglio o canale</strong></td><td>Cambiamento dell''attività (es. nuovi portafogli commerciali, incassi diversi)</td><td>Aggiornamento straordinario dell''autovalutazione entro 30 giorni.</td></tr><tr><td><strong>Rischio residuo alto</strong></td><td>Presidi insufficienti</td><td>Azioni correttive immediate approvate dal CdA.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-02 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-03' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-03' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-03', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Metodologia di classificazione del rischio cliente', array['RAML','ADV']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-03', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Metodologia di classificazione del rischio cliente', array['RAML','ADV']::text[], '<blockquote>
<p><strong>AML-03 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Metodologia di classificazione del rischio cliente</h1>
<blockquote>
<p><em>Ambito: profilatura del rischio di mandanti e debitori — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-03</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Metodologia di classificazione del rischio cliente</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Definire la metodologia con cui {{AZIENDA}} attribuisce a ciascun cliente — mandanti e debitori — un profilo di rischio (basso, medio, alto) che determina la misura dell''adeguata verifica e la frequenza del controllo costante.</p><p>Il profilo si calcola nel portale con fattori e pesi approvati: natura e struttura del soggetto, attività economica, area geografica, PEP e liste, comportamento (modalità e provenienza dei pagamenti), coerenza delle operazioni con il profilo.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Artt. 17 e 18 D.Lgs. 231/2007</strong></td><td>Adeguata verifica commisurata al rischio</td></tr><tr><td><strong>Artt. 23 e 24 D.Lgs. 231/2007</strong></td><td>Misure semplificate e rafforzate; fattori di basso ed elevato rischio</td></tr><tr><td><strong>Allegati 1 e 2 al D.Lgs. 231/2007</strong></td><td>Fattori di rischio e di basso rischio</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Raccolta dei dati</td><td>ADV</td><td>All''apertura del rapporto (mandante) o della pratica (debitore) si raccolgono i dati necessari alla profilatura.</td></tr><tr><td><strong>2</strong></td><td>Calcolo del punteggio</td><td>ADV</td><td>Compilazione della scheda di profilatura nel portale: ogni fattore ha un punteggio; il totale determina la classe. Mandanti: bancario/NPL vigilato (basso), commerciale (medio, alto se struttura opaca o crediti di origine non documentata). Debitori: importo, natura (persona fisica/giuridica, catene societarie), area geografica, modalità e soggetto pagatore.</td></tr><tr><td><strong>3</strong></td><td>Fattori di rischio elevato</td><td>ADV</td><td>PEP, paesi terzi ad alto rischio, presenza in liste di sanzioni, pagamenti da terzi non giustificati, contante oltre soglia, frazionamenti: classe alta d''ufficio.</td></tr><tr><td><strong>4</strong></td><td>Valutazione scritta dei fattori</td><td>ADV</td><td>La scheda riporta sempre per iscritto ogni fattore considerato (anche quelli assenti), il punteggio attribuito, la classe risultante e la motivazione della decisione: non basta attribuire una classe, bisogna poter dimostrare quali fattori sono stati considerati e perché si è arrivati a quella classificazione.</td></tr><tr><td><strong>5</strong></td><td>Validazione</td><td>RAML</td><td>Il RAML valida i profili alti e quelli in cui l''addetto ha modificato la classe calcolata (con motivazione).</td></tr><tr><td><strong>6</strong></td><td>Revisione del profilo</td><td>ADV</td><td>Il profilo si rivede alle scadenze del controllo costante (AML-07) e a ogni evento rilevante.</td></tr><tr><td><strong>7</strong></td><td>Taratura della metodologia</td><td>RAML</td><td>Verifica annuale della metodologia sulla base dei risultati e dell''autovalutazione; approvazione delle modifiche.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>DSOS</strong></th><th><strong>ADV</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Compilazione della scheda</strong></td><td>C</td><td>I</td><td>R</td><td>—</td></tr><tr><td><strong>Validazione profili alti</strong></td><td>R</td><td>C</td><td>I</td><td>I</td></tr><tr><td><strong>Taratura della metodologia</strong></td><td>R</td><td>C</td><td>C</td><td>A</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Scheda di profilatura</strong></td><td>ADV</td><td>→</td><td>Fascicolo cliente</td><td>Scheda nel portale</td><td>Apertura rapporto/pratica</td><td><blockquote><p>Fascicolo AML del cliente</p></blockquote></td></tr><tr><td><strong>Elenco clienti ad alto rischio</strong></td><td>RAML</td><td>→</td><td>DL</td><td>Report</td><td>Trimestrale</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Clienti con profilo di rischio</td><td>100%</td><td>Continuo</td></tr><tr><td>Schede con valutazione scritta dei fattori</td><td>100%</td><td>Continuo</td></tr><tr><td>Profili alti validati dal RAML</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Profilo mancante</strong></td><td>Pratica aperta senza scheda</td><td>Blocco delle attività di incasso fino alla compilazione.</td></tr><tr><td><strong>Classe modificata senza motivazione</strong></td><td>Errore dell''addetto</td><td>Ripristino della classe calcolata e richiamo.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-03 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-04' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-04' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-04', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Adeguata verifica dei mandanti', array['ADV','RAML','DC']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-04', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Adeguata verifica dei mandanti', array['ADV','RAML','DC']::text[], '<blockquote>
<p><strong>AML-04 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Adeguata verifica dei mandanti</h1>
<blockquote>
<p><em>Ambito: identificazione e verifica dei mandanti al conferimento del mandato e nel corso del rapporto — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-04</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Adeguata verifica dei mandanti</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Regolare l''adeguata verifica dei mandanti (creditori che affidano a {{AZIENDA}} il recupero dei crediti): identificazione del cliente e del titolare effettivo, verifica dei dati, informazioni su scopo e natura del rapporto, profilatura e conservazione.</p><p>Due percorsi: committenti bancari e finanziari vigilati (portafogli bancari/NPL), per i quali si possono applicare misure semplificate se il profilo è basso; committenti commerciali, per i quali l''onboarding segue una checklist rafforzata che verifica la reale esistenza e operatività dell''impresa, l''origine dei crediti affidati e l''assenza del titolare effettivo nelle liste di sanzioni, per escludere frodi carosello e interposizioni fittizie.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Artt. 17-19 D.Lgs. 231/2007</strong></td><td>Obblighi e modalità dell''adeguata verifica</td></tr><tr><td><strong>Art. 20 D.Lgs. 231/2007</strong></td><td>Criteri per la determinazione del titolare effettivo</td></tr><tr><td><strong>Art. 23 D.Lgs. 231/2007</strong></td><td>Misure semplificate</td></tr><tr><td><strong>Art. 24 D.Lgs. 231/2007</strong></td><td>Misure rafforzate</td></tr><tr><td><strong>Art. 42 D.Lgs. 231/2007</strong></td><td>Astensione</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Raccolta documentale</td><td>ADV</td><td>Visura camerale aggiornata, documento del legale rappresentante e dei delegati, procure, statuto se necessario, dichiarazione sul titolare effettivo, questionario AML del mandante.</td></tr><tr><td><strong>2</strong></td><td>Identificazione e verifica</td><td>ADV</td><td>Verifica dei dati su fonti affidabili e indipendenti (registro imprese, registro dei titolari effettivi ove consultabile); controllo PEP e liste di sanzioni (AML-06).</td></tr><tr><td><strong>3</strong></td><td>Scopo e natura del rapporto</td><td>ADV</td><td>Registrazione di tipologia dei crediti affidati, volumi, canali di incasso concordati e modalità di riversamento.</td></tr><tr><td><strong>4</strong></td><td>Checklist committenti commerciali</td><td>ADV / RAML</td><td>Reale esistenza e operatività (sede, bilanci, attività coerente con i crediti), origine e documentazione dei crediti affidati, titolare effettivo verificato e controllato su liste di sanzioni e notizie avverse.</td></tr><tr><td><strong>5</strong></td><td>Profilatura</td><td>ADV</td><td>Scheda di profilatura (AML-03); misure semplificate, ordinarie o rafforzate in base alla classe.</td></tr><tr><td><strong>6</strong></td><td>Approvazione del rapporto</td><td>RAML / DL</td><td>Per i mandanti ad alto rischio l''avvio del rapporto richiede l''autorizzazione del RAML e del DL.</td></tr><tr><td><strong>7</strong></td><td>Astensione</td><td>RAML</td><td>Se non è possibile completare l''adeguata verifica il rapporto non si avvia; il RAML valuta l''invio di una SOS (AML-09).</td></tr><tr><td><strong>8</strong></td><td>Fascicolo</td><td>ADV</td><td>Tutta la documentazione confluisce nel fascicolo AML del mandante nel portale, con data e autore.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>ADV</strong></th><th><strong>RAML</strong></th><th><strong>DC</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Raccolta e verifica documenti</strong></td><td>R</td><td>C</td><td>C</td><td>—</td></tr><tr><td><strong>Profilatura</strong></td><td>R</td><td>A</td><td>I</td><td>—</td></tr><tr><td><strong>Approvazione mandanti ad alto rischio</strong></td><td>C</td><td>R</td><td>I</td><td>A</td></tr><tr><td><strong>Astensione</strong></td><td>I</td><td>R</td><td>I</td><td>A</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Fascicolo AML del mandante</strong></td><td>ADV</td><td>→</td><td>RAML</td><td>Fascicolo nel portale</td><td>Prima dell''avvio del mandato</td><td><blockquote><p>Portale — Fascicoli AML</p></blockquote></td></tr><tr><td><strong>Autorizzazione rapporto ad alto rischio</strong></td><td>RAML</td><td>→</td><td>DL</td><td>Approvazione nel portale</td><td>Prima dell''avvio</td><td><blockquote><p>Fascicolo AML del mandante</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Mandanti con fascicolo completo</td><td>100%</td><td>Continuo</td></tr><tr><td>Rapporti ad alto rischio autorizzati</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Titolare effettivo non individuabile</strong></td><td>Struttura societaria complessa o opaca</td><td>Rafforzata; se resta non individuabile, astensione e valutazione SOS.</td></tr><tr><td><strong>Documenti scaduti</strong></td><td>Mancato aggiornamento</td><td>Richiesta immediata; sospensione dei riversamenti se non regolarizzati entro 30 giorni.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-04 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-05' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-05' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-05', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Adeguata verifica dei debitori, identificazione a distanza e trigger di controllo', array['ADV','RAML','AMM']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-05', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Adeguata verifica dei debitori, identificazione a distanza e trigger di controllo', array['ADV','RAML','AMM']::text[], '<blockquote>
<p><strong>AML-05 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Adeguata verifica dei debitori, identificazione a distanza e trigger di controllo</h1>
<blockquote>
<p><em>Ambito: identificazione telefonica e telematica dei debitori, controlli sui pagamenti e invio alla funzione AML — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-05</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Adeguata verifica dei debitori, identificazione a distanza e trigger di controllo</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Regolare i presidi sui debitori in un''attività di recupero esclusivamente telefonica: identificazione a distanza prima di negoziare piani di rientro o saldi, verifica di chi paga e della provenienza dei fondi, invio della posizione alla funzione AML al verificarsi di trigger oggettivi.</p><p>Gli operatori telefonici non decidono discrezionalmente quando coinvolgere la funzione AML: la posizione si blocca e passa al controllo manuale quando scatta un trigger. Ogni verifica lascia una traccia scritta (audit trail): trigger, banche dati consultate, esito motivato.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 17 D.Lgs. 231/2007</strong></td><td>Adeguata verifica, anche per operazioni pari o superiori a 15.000 euro (singole o frazionate)</td></tr><tr><td><strong>Art. 19 D.Lgs. 231/2007</strong></td><td>Modalità di identificazione, anche a distanza</td></tr><tr><td><strong>Art. 42 D.Lgs. 231/2007</strong></td><td>Obbligo di astensione</td></tr><tr><td><strong>Provvedimento UIF 12 maggio 2023</strong></td><td>Indicatori di anomalia</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Identificazione a distanza</td><td>ADV</td><td>Prima di concordare un piano di rientro o un saldo: acquisizione telematica di documento d''identità valido e codice fiscale del debitore (o del legale rappresentante), controllo di coerenza con i dati del mandante.</td></tr><tr><td><strong>2</strong></td><td>Canali di pagamento</td><td>ADV</td><td>Solo strumenti tracciabili intestati al debitore: bonifico, SDD, link di pagamento con carta. Nessun incasso in contante.</td></tr><tr><td><strong>3</strong></td><td>Trigger di controllo AML</td><td>ADV</td><td>La posizione si blocca e passa alla funzione AML se: saldo o piano di rientro pari o superiore a 15.000 euro (anche cumulato nell''anno); pagamento proposto o eseguito da un terzo (conto non intestato al debitore); frazionamento sospetto (pagamenti ravvicinati appena sotto le soglie); pagamento da conti esteri o paesi a rischio; fretta ingiustificata di saldare importi rilevanti; eccedenza con richiesta di rimborso.</td></tr><tr><td><strong>4</strong></td><td>Verifica manuale</td><td>RAML</td><td>Consultazione di registro imprese, liste di sanzioni pubbliche, verifica PEP, ricerca di notizie avverse; acquisizione di giustificativi sulla provenienza dei fondi o sul legame con il terzo pagatore.</td></tr><tr><td><strong>5</strong></td><td>Esito motivato</td><td>RAML</td><td>Registrazione nel fascicolo: trigger, fonti consultate, esito (es. «archiviata, rischio basso per comprovata provenienza dei fondi» oppure «segnalazione interna al DSOS»). Senza adeguata verifica possibile: astensione dal piano di rientro.</td></tr><tr><td><strong>6</strong></td><td>Rimborsi</td><td>AMM</td><td>Eccedenze restituite solo allo stesso conto di provenienza, previa verifica del RAML.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>ADV</strong></th><th><strong>RAML</strong></th><th><strong>DSOS</strong></th><th><strong>AMM</strong></th></tr></thead>
<tbody><tr><td><strong>Identificazione a distanza</strong></td><td>R</td><td>C</td><td>—</td><td>—</td></tr><tr><td><strong>Blocco della posizione al trigger</strong></td><td>R</td><td>I</td><td>—</td><td>C</td></tr><tr><td><strong>Verifica manuale ed esito</strong></td><td>C</td><td>R</td><td>I</td><td>C</td></tr><tr><td><strong>Segnalazione interna</strong></td><td>C</td><td>R</td><td>A</td><td>—</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Posizione bloccata per trigger</strong></td><td>ADV / gestionale</td><td>→</td><td>RAML</td><td>Task nel portale</td><td>Immediato</td><td><blockquote><p>Fascicolo AML del debitore</p></blockquote></td></tr><tr><td><strong>Esito motivato della verifica</strong></td><td>RAML</td><td>→</td><td>Fascicolo</td><td>Registrazione nel portale</td><td>Entro 5 giorni lavorativi</td><td><blockquote><p>Fascicolo AML del debitore</p></blockquote></td></tr><tr><td><strong>Segnalazione interna di anomalia</strong></td><td>RAML / ADV</td><td>→</td><td>DSOS</td><td>Modulo riservato</td><td>Senza ritardo</td><td><blockquote><p>Registro segnalazioni (solo DSOS)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Posizioni con trigger verificate entro 5 giorni</td><td>≥ 95%</td><td>Mensile</td></tr><tr><td>Verifiche con esito motivato e fonti indicate</td><td>100%</td><td>Continuo</td></tr><tr><td>Piani di rientro con identificazione a distanza completa</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Pagamento da terzo non giustificato</strong></td><td>Soggetto estraneo al debito</td><td>Rifiuto o restituzione; segnalazione interna al DSOS.</td></tr><tr><td><strong>Documento d''identità non fornito</strong></td><td>Debitore non collaborativo</td><td>Nessun piano di rientro (astensione); valutazione SOS se il comportamento è anomalo.</td></tr><tr><td><strong>Trigger non rilevato dall''operatore</strong></td><td>Errore umano</td><td>Emerge dal controllo a campione (AML-12): recupero della verifica e formazione mirata.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-05 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-06' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-06' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-06', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Titolare effettivo, persone politicamente esposte e liste di sanzioni', array['ADV','RAML']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-06', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Titolare effettivo, persone politicamente esposte e liste di sanzioni', array['ADV','RAML']::text[], '<blockquote>
<p><strong>AML-06 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Titolare effettivo, persone politicamente esposte e liste di sanzioni</h1>
<blockquote>
<p><em>Ambito: individuazione del titolare effettivo, controlli PEP, sanzioni ed embarghi — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-06</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Titolare effettivo, persone politicamente esposte e liste di sanzioni</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Definire come {{AZIENDA}} individua il titolare effettivo dei clienti persone giuridiche, riconosce le persone politicamente esposte (PEP) e verifica che mandanti, debitori e pagatori non siano presenti nelle liste di sanzioni finanziarie.</p><p>La presenza di un PEP comporta l''adeguata verifica rafforzata e l''autorizzazione del DL; la corrispondenza con una lista di sanzioni comporta il blocco dell''operatività e l''immediato coinvolgimento del RAML.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 20 D.Lgs. 231/2007</strong></td><td>Titolare effettivo</td></tr><tr><td><strong>Art. 1, c. 2, lett. dd) D.Lgs. 231/2007</strong></td><td>Definizione di persone politicamente esposte</td></tr><tr><td><strong>Art. 24 D.Lgs. 231/2007</strong></td><td>Rafforzata per PEP e paesi ad alto rischio</td></tr><tr><td><strong>D.Lgs. 109/2007</strong></td><td>Misure di congelamento (sanzioni finanziarie)</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Titolare effettivo</td><td>ADV</td><td>Dichiarazione del cliente, verifica su visura e registro dei titolari effettivi; criteri di proprietà (&gt;25%), controllo e, in mancanza, legali rappresentanti.</td></tr><tr><td><strong>2</strong></td><td>Struttura di controllo</td><td>ADV</td><td>Ricostruzione documentata della catena partecipativa e di controllo fino alle persone fisiche (schema allegato al fascicolo con le visure usate): la mancata individuazione della struttura di controllo è una delle carenze più contestate.</td></tr><tr><td><strong>3</strong></td><td>Controllo PEP</td><td>ADV</td><td>Dichiarazione del cliente e verifica su fonti pubbliche o banca dati; estensione a familiari e stretti collaboratori.</td></tr><tr><td><strong>4</strong></td><td>Liste di sanzioni</td><td>ADV</td><td>Verifica del nominativo sulle liste UE e ONU all''avvio e a ogni aggiornamento rilevante.</td></tr><tr><td><strong>5</strong></td><td>Esito positivo</td><td>RAML</td><td>PEP: rafforzata e autorizzazione del DL; corrispondenza con liste: blocco, verifica dell''omonimia, comunicazioni previste dalla normativa.</td></tr><tr><td><strong>6</strong></td><td>Registrazione</td><td>ADV</td><td>Esito dei controlli con data, fonte e autore nel fascicolo AML.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>ADV</strong></th><th><strong>RAML</strong></th><th><strong>DL</strong></th><th><strong>DSOS</strong></th></tr></thead>
<tbody><tr><td><strong>Titolare effettivo e PEP</strong></td><td>R</td><td>C</td><td>I</td><td>—</td></tr><tr><td><strong>Esito positivo PEP</strong></td><td>C</td><td>R</td><td>A</td><td>I</td></tr><tr><td><strong>Corrispondenza con liste di sanzioni</strong></td><td>I</td><td>R</td><td>A</td><td>C</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Esito controlli TE / PEP / liste</strong></td><td>ADV</td><td>→</td><td>Fascicolo cliente</td><td>Registrazione nel portale</td><td>Apertura e revisioni</td><td><blockquote><p>Fascicolo AML del cliente</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Clienti con verifica liste registrata</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Omonimia con soggetto in lista</strong></td><td>Dati anagrafici simili</td><td>Verifica con dati aggiuntivi; blocco fino alla conferma.</td></tr><tr><td><strong>Dichiarazione PEP non resa</strong></td><td>Cliente non collaborativo</td><td>Rafforzata; se persiste, astensione.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-06 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-07' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-07' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-07', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Controllo costante e aggiornamento dei fascicoli', array['ADV','RAML']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-07', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Controllo costante e aggiornamento dei fascicoli', array['ADV','RAML']::text[], '<blockquote>
<p><strong>AML-07 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Controllo costante e aggiornamento dei fascicoli</h1>
<blockquote>
<p><em>Ambito: monitoraggio dei rapporti e aggiornamento periodico di documenti e profili — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-07</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Controllo costante e aggiornamento dei fascicoli</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Assicurare il controllo costante dei rapporti con mandanti e debitori: coerenza delle operazioni con il profilo, aggiornamento di documenti, dati e profilo di rischio con frequenza proporzionata al rischio.</p><p>Frequenze di revisione: rischio alto ogni 12 mesi, medio ogni 24 mesi, basso ogni 36 mesi, e comunque a ogni evento rilevante. Il portale genera le scadenze e assegna i task agli addetti.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 18, c. 1, lett. d) D.Lgs. 231/2007</strong></td><td>Controllo costante del rapporto</td></tr><tr><td><strong>Art. 19, c. 1, lett. d) D.Lgs. 231/2007</strong></td><td>Modalità del controllo costante</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Pianificazione</td><td>RAML</td><td>Il portale calcola le scadenze di revisione per classe di rischio.</td></tr><tr><td><strong>2</strong></td><td>Revisione del fascicolo</td><td>ADV</td><td>Verifica di documenti, titolare effettivo, PEP e liste; aggiornamento della scheda di profilatura.</td></tr><tr><td><strong>3</strong></td><td>Analisi delle operazioni</td><td>ADV</td><td>Confronto tra incassi/riversamenti e profilo: volumi, canali, pagatori.</td></tr><tr><td><strong>4</strong></td><td>Documenti in scadenza</td><td>ADV</td><td>Il portale segnala i documenti d''identità e le visure scaduti o in scadenza; l''addetto ne chiede l''aggiornamento: un fascicolo rimasto invariato dalla stipula del contratto o con documenti scaduti è irregolare.</td></tr><tr><td><strong>5</strong></td><td>Esito</td><td>ADV</td><td>Ogni riesame lascia un''evidenza nel fascicolo: data del riesame, informazioni verificate, variazioni riscontrate (anche «nessuna variazione») e conseguenze sul profilo di rischio; conferma o modifica della classe; eventuali anomalie al DSOS.</td></tr><tr><td><strong>6</strong></td><td>Supervisione</td><td>RAML</td><td>Verifica a campione delle revisioni e dei ritardi.</td></tr><tr><td><strong>7</strong></td><td>Audit trail</td><td>RAML</td><td>Ogni verifica manuale riporta motivo (trigger o scadenza), banche dati consultate ed esito motivato, con data e autore.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>DSOS</strong></th><th><strong>ADV</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Revisione periodica</strong></td><td>A</td><td>I</td><td>R</td><td>—</td></tr><tr><td><strong>Analisi delle operazioni</strong></td><td>C</td><td>I</td><td>R</td><td>—</td></tr><tr><td><strong>Supervisione</strong></td><td>R</td><td>—</td><td>I</td><td>I</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Esito revisione del fascicolo</strong></td><td>ADV</td><td>→</td><td>RAML</td><td>Registrazione nel portale</td><td>Alla scadenza</td><td><blockquote><p>Fascicolo AML del cliente</p></blockquote></td></tr><tr><td><strong>Report revisioni scadute</strong></td><td>RAML</td><td>→</td><td>DL</td><td>Report</td><td>Trimestrale</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Revisioni completate entro la scadenza</td><td>≥ 95%</td><td>Trimestrale</td></tr><tr><td>Fascicoli attivi senza documenti scaduti</td><td>100%</td><td>Trimestrale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Revisione scaduta</strong></td><td>Carico di lavoro</td><td>Sollecito; oltre 60 giorni sospensione di nuove attività sul rapporto.</td></tr><tr><td><strong>Operazioni incoerenti con il profilo</strong></td><td>Variazione del comportamento</td><td>Aggiornamento del profilo e segnalazione interna.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-07 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-08' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-08' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-08', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Conservazione dei dati e dei documenti', array['RAML','IT','DPO']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-08', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Conservazione dei dati e dei documenti', array['RAML','IT','DPO']::text[], '<blockquote>
<p><strong>AML-08 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Conservazione dei dati e dei documenti</h1>
<blockquote>
<p><em>Ambito: conservazione di documenti, dati e informazioni per 10 anni — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-08</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Conservazione dei dati e dei documenti</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Garantire che documenti, dati e informazioni acquisiti per l''adeguata verifica e le operazioni siano conservati per dieci anni dalla cessazione del rapporto, in modo da essere accessibili, integri e utilizzabili per gli accertamenti delle autorità.</p><p>La conservazione avviene nei fascicoli AML del portale, con data, autore e impronta digitale (hash) di ogni documento; i dati personali sono trattati secondo il GDPR.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Artt. 31-34 D.Lgs. 231/2007</strong></td><td>Obblighi e modalità di conservazione</td></tr><tr><td><strong>Reg. UE 2016/679 (GDPR)</strong></td><td>Protezione dei dati personali</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Acquisizione</td><td>ADV</td><td>Caricamento dei documenti nel fascicolo AML al momento dell''acquisizione.</td></tr><tr><td><strong>2</strong></td><td>Integrità</td><td>IT</td><td>Impronta hash e registro delle modifiche; nessuna cancellazione nel periodo di conservazione.</td></tr><tr><td><strong>3</strong></td><td>Accesso</td><td>RAML</td><td>Accesso riservato agli incaricati; registro degli accessi.</td></tr><tr><td><strong>4</strong></td><td>Modulistica adottata</td><td>RAML</td><td>Esemplare in bianco, con versione e data di adozione, di ogni modulo di adeguata verifica (questionario del mandante, dichiarazione titolare effettivo/PEP, scheda di profilatura, checklist committenti commerciali, scheda di verifica manuale).</td></tr><tr><td><strong>5</strong></td><td>Gestionali precedenti</td><td>IT / RAML</td><td>Documenti e dati AML presenti su gestionali dismessi o in archivi esterni sono importati o indicizzati nel portale: un documento non reperibile durante l''accesso equivale a un documento mancante.</td></tr><tr><td><strong>6</strong></td><td>Esibizione</td><td>RAML</td><td>In ispezione si estrae dal portale, senza ritardo, il dossier richiesto: licenza, elenco di mandanti e debitori con i relativi fascicoli, movimenti dei conti correnti degli ultimi cinque anni (forniti dall''amministrazione), elenco delle SOS con la documentazione istruttoria, comunicazioni al MEF, Manuale e procedure, registro della formazione, evidenze dei controlli interni. Il registro giornale degli affari, cartaceo, si esibisce in originale dal luogo di custodia indicato nel portale.</td></tr><tr><td><strong>7</strong></td><td>Cancellazione</td><td>DPO / RAML</td><td>Cancellazione o anonimizzazione decorsi i dieci anni, salvo contenziosi.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>IT</strong></th><th><strong>DPO</strong></th><th><strong>ADV</strong></th></tr></thead>
<tbody><tr><td><strong>Caricamento documenti</strong></td><td>A</td><td>—</td><td>—</td><td>R</td></tr><tr><td><strong>Integrità e accessi</strong></td><td>A</td><td>R</td><td>C</td><td>—</td></tr><tr><td><strong>Cancellazione a termine</strong></td><td>A</td><td>C</td><td>R</td><td>—</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Fascicoli AML</strong></td><td>ADV</td><td>→</td><td>Archivio</td><td>Portale</td><td>Continuo</td><td><blockquote><p>Portale — 10 anni</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Documenti con impronta hash</td><td>100%</td><td>Continuo</td></tr><tr><td>Dossier ispettivo estraibile</td><td>In giornata</td><td>Prova annuale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Documento mancante in ispezione</strong></td><td>Caricamento omesso</td><td>Recupero immediato e verifica a tappeto sul campione.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-08 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-09' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-09' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-09', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Segnalazione delle operazioni sospette (SOS)', array['ADV','DSOS','DL']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-09', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Segnalazione delle operazioni sospette (SOS)', array['ADV','DSOS','DL']::text[], '<blockquote>
<p><strong>AML-09 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Segnalazione delle operazioni sospette (SOS)</h1>
<blockquote>
<p><em>Ambito: flusso interno delle segnalazioni, valutazione del Delegato e invio alla UIF — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-09</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:DSOS}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Segnalazione delle operazioni sospette (SOS)</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — accesso limitato al Delegato SOS</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Regolare il processo con cui il personale di {{AZIENDA}} segnala al Delegato SOS le operazioni che sa, sospetta o ha motivo di sospettare collegate a riciclaggio o finanziamento del terrorismo, e la valutazione del Delegato per l''eventuale invio alla UIF.</p><p>È garantita la riservatezza dell''identità del segnalante ed è vietato comunicare al cliente o a terzi l''avvenuta segnalazione. Il registro delle segnalazioni interne è accessibile solo al Delegato SOS.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 35 D.Lgs. 231/2007</strong></td><td>Obbligo di segnalazione delle operazioni sospette</td></tr><tr><td><strong>Art. 36 D.Lgs. 231/2007</strong></td><td>Modalità di segnalazione</td></tr><tr><td><strong>Art. 38 D.Lgs. 231/2007</strong></td><td>Tutela della riservatezza del segnalante</td></tr><tr><td><strong>Art. 39 D.Lgs. 231/2007</strong></td><td>Divieto di comunicazione</td></tr><tr><td><strong>Provvedimento UIF 12 maggio 2023</strong></td><td>Indicatori di anomalia</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Rilevazione</td><td>ADV / AMM</td><td>Il dipendente che rileva un''anomalia (indicatori UIF, AML-05) compila la segnalazione interna nel portale, senza ritardo.</td></tr><tr><td><strong>2</strong></td><td>Istruttoria</td><td>DSOS</td><td>Il Delegato acquisisce fascicolo e operazioni, approfondisce, eventualmente chiede chiarimenti senza rivelare la finalità.</td></tr><tr><td><strong>3</strong></td><td>Decisione</td><td>DSOS</td><td>Invio alla UIF tramite il portale Infostat-UIF oppure archiviazione motivata per iscritto.</td></tr><tr><td><strong>4</strong></td><td>Invio alla UIF</td><td>DSOS</td><td>Segnalazione senza ritardo e, ove possibile, prima di eseguire l''operazione; conservazione della ricevuta.</td></tr><tr><td><strong>5</strong></td><td>Riservatezza</td><td>DSOS</td><td>Nessuna informazione al cliente o a terzi; esito al segnalante solo in forma generica.</td></tr><tr><td><strong>6</strong></td><td>Anomalie non segnalate</td><td>DSOS</td><td>Anche le anomalie valutate e archiviate restano nel registro con chi le ha rilevate, chi le ha valutate, gli elementi esaminati e la motivazione: non aver mai trasmesso una SOS è legittimo solo se la società sa spiegare come rileva e valuta le anomalie.</td></tr><tr><td><strong>7</strong></td><td>Seguiti</td><td>DSOS</td><td>Gestione di richieste UIF e autorità; rafforzamento del controllo costante sul cliente.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>ADV</strong></th><th><strong>DSOS</strong></th><th><strong>RAML</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Segnalazione interna</strong></td><td>R</td><td>I</td><td>—</td><td>—</td></tr><tr><td><strong>Istruttoria e decisione</strong></td><td>C</td><td>R</td><td>C</td><td>I</td></tr><tr><td><strong>Invio alla UIF</strong></td><td>—</td><td>R</td><td>I</td><td>I</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Segnalazione interna</strong></td><td>Dipendente</td><td>→</td><td>DSOS</td><td>Modulo riservato nel portale</td><td>Senza ritardo</td><td><blockquote><p>Registro segnalazioni (solo DSOS)</p></blockquote></td></tr><tr><td><strong>Decisione motivata</strong></td><td>DSOS</td><td>→</td><td>Registro</td><td>Scheda riservata</td><td>Entro 15 giorni</td><td><blockquote><p>Registro segnalazioni (solo DSOS)</p></blockquote></td></tr><tr><td><strong>SOS alla UIF</strong></td><td>DSOS</td><td>→</td><td>UIF</td><td>Infostat-UIF</td><td>Senza ritardo</td><td><blockquote><p>Ricevuta nel registro (solo DSOS)</p></blockquote></td></tr><tr><td><strong>Elenco SOS con documentazione istruttoria</strong></td><td>DSOS</td><td>→</td><td>Autorità ispettive</td><td>Estrazione riservata</td><td>Su richiesta</td><td><blockquote><p>Registro segnalazioni (solo DSOS)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Segnalazioni interne valutate entro 15 giorni</td><td>100%</td><td>Continuo</td></tr><tr><td>Decisioni di archiviazione motivate</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Fuga di notizie verso il cliente</strong></td><td>Violazione del divieto</td><td>Informativa al DL; provvedimenti disciplinari; valutazione delle conseguenze.</td></tr><tr><td><strong>Segnalazione interna tardiva</strong></td><td>Mancata percezione dell''anomalia</td><td>Formazione mirata; valutazione nel controllo interno.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-09 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-10' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-10' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-10', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Limitazioni all''uso del contante e comunicazione delle infrazioni', array['AMM','ADV','RAML']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-10', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Limitazioni all''uso del contante e comunicazione delle infrazioni', array['AMM','ADV','RAML']::text[], '<blockquote>
<p><strong>AML-10 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Limitazioni all''uso del contante e comunicazione delle infrazioni</h1>
<blockquote>
<p><em>Ambito: incassi in contante e comunicazione al MEF delle violazioni rilevate — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-10</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Limitazioni all''uso del contante e comunicazione delle infrazioni</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Stabilire che gli incassi da debitori avvengano esclusivamente con strumenti tracciabili (bonifico, SDD, link di pagamento con carta): {{AZIENDA}} opera solo per telefono e non accetta contante.</p><p>Il personale che rileva infrazioni alle limitazioni al contante ne informa il RAML, che provvede alla comunicazione al Ministero dell''Economia e delle Finanze nei termini di legge.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 49 D.Lgs. 231/2007</strong></td><td>Limitazioni all''uso del contante e dei titoli al portatore</td></tr><tr><td><strong>Art. 51 D.Lgs. 231/2007</strong></td><td>Obbligo di comunicazione delle infrazioni al MEF</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Canali di incasso</td><td>AMM</td><td>Bonifico, bollettino, carte e strumenti tracciabili come canali ordinari.</td></tr><tr><td><strong>2</strong></td><td>Contante</td><td>ADV</td><td>Non accettato; il debitore che propone di pagare in contante è indirizzato ai canali tracciabili e la proposta è annotata (indicatore da valutare).</td></tr><tr><td><strong>3</strong></td><td>Infrazioni</td><td>ADV / AMM</td><td>Rilevazione di pagamenti oltre soglia o frazionati: informativa al RAML.</td></tr><tr><td><strong>4</strong></td><td>Comunicazione al MEF</td><td>RAML</td><td>Comunicazione entro 30 giorni; valutazione congiunta con il DSOS dell''eventuale SOS.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>AMM</strong></th><th><strong>ADV</strong></th><th><strong>RAML</strong></th><th><strong>DSOS</strong></th></tr></thead>
<tbody><tr><td><strong>Incassi in contante</strong></td><td>R</td><td>R</td><td>I</td><td>—</td></tr><tr><td><strong>Comunicazione al MEF</strong></td><td>C</td><td>C</td><td>R</td><td>C</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Comunicazione infrazione</strong></td><td>RAML</td><td>→</td><td>MEF</td><td>Modulo ministeriale</td><td>Entro 30 giorni</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Incassi in contante</td><td>0</td><td>Mensile</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Infrazione rilevata (es. pagamento in contante oltre soglia al mandante)</strong></td><td>Notizia acquisita nella gestione della pratica</td><td>Comunicazione al MEF entro 30 giorni e valutazione SOS.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-10 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-11' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-11' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-11', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Formazione antiriciclaggio del personale', array['RAML','HR']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-11', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Formazione antiriciclaggio del personale', array['RAML','HR']::text[], '<blockquote>
<p><strong>AML-11 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Formazione antiriciclaggio del personale</h1>
<blockquote>
<p><em>Ambito: formazione iniziale e periodica del personale e registro della formazione — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-11</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Formazione antiriciclaggio del personale</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Assicurare che dipendenti e collaboratori di {{AZIENDA}} conoscano gli obblighi antiriciclaggio, gli indicatori di anomalia e le procedure aziendali, con formazione iniziale all''ingresso e aggiornamento almeno annuale.</p><p>Gli operatori telefonici (phone collector) sono la prima linea: la formazione, almeno annuale, li addestra a riconoscere gli indicatori di anomalia durante la conversazione (fretta ingiustificata di saldare importi rilevanti, pagamenti proposti da terzi estranei, frazionamenti) e ad applicare i trigger di AML-05.</p><p>La formazione si eroga nel portale (corso AML con test di verifica); il registro della formazione riporta partecipanti, date, durata, esiti e attestati.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 16, c. 3 D.Lgs. 231/2007</strong></td><td>Formazione continua del personale</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Piano formativo</td><td>RAML / HR</td><td>Piano annuale con contenuti differenziati per ruolo (addetti, amministrazione, management).</td></tr><tr><td><strong>2</strong></td><td>Erogazione</td><td>HR</td><td>Corso AML nel portale; formazione iniziale entro 30 giorni dall''ingresso.</td></tr><tr><td><strong>3</strong></td><td>Verifica dell''apprendimento</td><td>RAML</td><td>Test finale; ripetizione in caso di esito negativo.</td></tr><tr><td><strong>4</strong></td><td>Registro</td><td>HR</td><td>Registro della formazione con programmi, date, durata, partecipanti, esiti dei test, attestati e aggiornamenti, conservato e disponibile per le ispezioni: non basta dichiarare che il personale ha partecipato a un corso.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>HR</strong></th><th><strong>ADV</strong></th><th><strong>DL</strong></th></tr></thead>
<tbody><tr><td><strong>Piano formativo</strong></td><td>R</td><td>C</td><td>I</td><td>A</td></tr><tr><td><strong>Erogazione e registro</strong></td><td>C</td><td>R</td><td>I</td><td>I</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Registro della formazione</strong></td><td>HR</td><td>→</td><td>RAML, ispettori</td><td>Portale</td><td>Continuo</td><td><blockquote><p>Portale — Registro formazione</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Personale formato nell''anno</td><td>100%</td><td>Annuale</td></tr><tr><td>Test superati al primo tentativo</td><td>≥ 85%</td><td>Annuale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Dipendente non formato</strong></td><td>Assenza</td><td>Recupero entro 30 giorni; fino ad allora non opera su nuove pratiche.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-11 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-12' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-12' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-12', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Controlli interni e verifica dell''efficacia dei presidi', array['RCI','RAML','CdA']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-12', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Controlli interni e verifica dell''efficacia dei presidi', array['RCI','RAML','CdA']::text[], '<blockquote>
<p><strong>AML-12 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Controlli interni e verifica dell''efficacia dei presidi</h1>
<blockquote>
<p><em>Ambito: verifiche periodiche di conformità e relazione annuale — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-12</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RCI}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Controlli interni e verifica dell''efficacia dei presidi</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Definire le verifiche periodiche sull''efficacia del presidio antiriciclaggio: completezza dei fascicoli, tempestività del controllo costante, gestione delle anomalie e delle segnalazioni, formazione, conservazione.</p><p>Gli esiti sono documentati con evidenze nel portale e portano ad azioni correttive nel Piano d''azione; la relazione annuale è presentata all''organo amministrativo.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 16 D.Lgs. 231/2007</strong></td><td>Procedure e controlli interni proporzionati</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Piano dei controlli</td><td>RCI</td><td>Piano annuale: aree, campioni, frequenze (almeno semestrale per i fascicoli ad alto rischio).</td></tr><tr><td><strong>2</strong></td><td>Verifiche a campione</td><td>RCI</td><td>Controllo di fascicoli, revisioni, incassi da terzi, formazione; checklist nel portale.</td></tr><tr><td><strong>3</strong></td><td>Registro giornale degli affari</td><td>RCI</td><td>Verifica mensile a sorpresa: le ultime annotazioni del registro cartaceo coincidono con affidamenti ed esiti presenti nel gestionale fino al giorno precedente; esito annotato nel portale.</td></tr><tr><td><strong>4</strong></td><td>Controllo retroattivo (back-testing)</td><td>RCI</td><td>Ogni sei mesi estrazione del 5% delle posizioni gestite solo per telefono e non passate al controllo manuale, per verificare che nessun trigger sia sfuggito e che la classificazione sia corretta.</td></tr><tr><td><strong>5</strong></td><td>Evidenze</td><td>RCI</td><td>Esiti, carenze e documenti a supporto salvati nel portale con data e autore.</td></tr><tr><td><strong>6</strong></td><td>Azioni correttive</td><td>RAML</td><td>Azioni con responsabile e scadenza nel Piano d''azione; verifica della chiusura.</td></tr><tr><td><strong>7</strong></td><td>Relazione annuale</td><td>RCI / RAML</td><td>Relazione al CdA sugli esiti dei controlli e sullo stato delle azioni.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RCI</strong></th><th><strong>RAML</strong></th><th><strong>CdA</strong></th><th><strong>ADV</strong></th></tr></thead>
<tbody><tr><td><strong>Piano e verifiche</strong></td><td>R</td><td>C</td><td>I</td><td>C</td></tr><tr><td><strong>Azioni correttive</strong></td><td>C</td><td>R</td><td>I</td><td>R</td></tr><tr><td><strong>Relazione annuale</strong></td><td>R</td><td>C</td><td>A</td><td>—</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Verbale di verifica</strong></td><td>RCI</td><td>→</td><td>RAML</td><td>Checklist nel portale</td><td>A ogni verifica</td><td><blockquote><p>Portale — Controlli AML</p></blockquote></td></tr><tr><td><strong>Relazione annuale sui controlli</strong></td><td>RCI</td><td>→</td><td>CdA</td><td>Documento</td><td>Annuale</td><td><blockquote><p>Fascicolo AML aziendale</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Verifiche del piano eseguite</td><td>100%</td><td>Annuale</td></tr><tr><td>Azioni correttive chiuse nei tempi</td><td>≥ 90%</td><td>Trimestrale</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Carenza grave</strong></td><td>Presidio inefficace</td><td>Informativa immediata al CdA e piano di rientro.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-12 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
delete from public.procedure_template where codice = 'AML-13' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
delete from public.procedure_catalogo where codice = 'AML-13' and settore = 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3';
insert into public.procedure_catalogo (codice, settore, area, titolo, funzioni, attivo) values ('AML-13', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Segnalazione interna delle violazioni (whistleblowing AML)', array['RAML','DL']::text[], true);
insert into public.procedure_template (codice, settore, area, titolo, funzioni, corpo_html, versione) values ('AML-13', 'azienda:3bcc90e8-a801-402b-8d87-5909429f44b3', 'AML', 'Segnalazione interna delle violazioni (whistleblowing AML)', array['RAML','DL']::text[], '<blockquote>
<p><strong>AML-13 · Antiriciclaggio — D.Lgs. 231/2007</strong></p>
</blockquote>
<h1>Segnalazione interna delle violazioni (whistleblowing AML)</h1>
<blockquote>
<p><em>Ambito: canale riservato per segnalare violazioni della normativa antiriciclaggio — {{AZIENDA}}</em></p>
<p><strong>1 Scheda Identificativa</strong></p>
</blockquote>
<table style="width:100%;"><colgroup><col style="width: 13%" /><col style="width: 36%" /><col style="width: 13%" /><col style="width: 36%" /></colgroup>
<thead><tr class="header"><th><strong>Codice</strong></th><th>AML-13</th><th><strong>Owner</strong></th><th><blockquote><p>{{RUOLO:RAML}}</p></blockquote></th></tr></thead>
<tbody>
<tr class="odd"><td><strong>Titolo</strong></td><td>Segnalazione interna delle violazioni (whistleblowing AML)</td><td><strong>Area</strong></td><td><blockquote><p>Antiriciclaggio — D.Lgs. 231/2007</p></blockquote></td></tr>
<tr class="even"><td><strong>Versione</strong></td><td>{{VERSIONE}}</td><td><strong>Stato</strong></td><td><blockquote><p>{{STATO}}</p></blockquote></td></tr>
<tr class="odd"><td><strong>Data emissione</strong></td><td>{{DATA_EMISSIONE}}</td><td><strong>Prossima revisione</strong></td><td><blockquote><p>Ottobre 2027</p></blockquote></td></tr>
<tr class="even"><td><strong>Approvato da</strong></td><td>{{RUOLO:CdA}}</td><td><strong>Classificazione</strong></td><td><blockquote><p>Riservato — uso interno</p></blockquote></td></tr>
</tbody></table>
<blockquote>
<p><strong>2 Scopo e Campo di Applicazione</strong></p>
<p>Mettere a disposizione di dipendenti e collaboratori un canale riservato per segnalare violazioni, potenziali o effettive, delle disposizioni antiriciclaggio, con tutela del segnalante da ritorsioni.</p><p>Il canale si coordina con il sistema aziendale di whistleblowing; le segnalazioni sono gestite in modo riservato e documentato.</p>
<p><strong>3 Riferimenti Normativi</strong></p>
</blockquote>
<table><colgroup><col style="width: 27%" /><col style="width: 72%" /></colgroup>
<thead><tr class="header"><th><strong>Riferimento normativo</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>D.Lgs. 231/2007 e s.m.i.</strong></td><td>Prevenzione dell''uso del sistema finanziario a scopo di riciclaggio e finanziamento del terrorismo</td></tr><tr><td><strong>Art. 48 D.Lgs. 231/2007</strong></td><td>Sistemi interni di segnalazione delle violazioni</td></tr><tr><td><strong>D.Lgs. 24/2023</strong></td><td>Protezione delle persone che segnalano violazioni</td></tr></tbody></table>
<blockquote>
<p><strong>4 Fasi Operative</strong></p>
</blockquote>
<table><colgroup><col style="width: 3%" /><col style="width: 17%" /><col style="width: 15%" /><col style="width: 64%" /></colgroup>
<thead><tr class="header"><th><strong>#</strong></th><th><strong>Fase</strong></th><th><strong>Responsabile</strong></th><th><strong>Descrizione</strong></th></tr></thead>
<tbody><tr><td><strong>1</strong></td><td>Ricezione</td><td>RAML</td><td>Ricezione tramite il canale riservato; avviso di ricevimento al segnalante.</td></tr><tr><td><strong>2</strong></td><td>Istruttoria</td><td>RAML</td><td>Verifica dei fatti in modo riservato; coinvolgimento del DL se non coinvolto.</td></tr><tr><td><strong>3</strong></td><td>Esito</td><td>RAML</td><td>Azioni correttive o archiviazione motivata; riscontro al segnalante nei termini.</td></tr><tr><td><strong>4</strong></td><td>Tutela</td><td>DL</td><td>Nessuna ritorsione; riservatezza dell''identità.</td></tr></tbody></table>
<blockquote>
<p><strong>5 Matrice RACI</strong></p>
<p><em>R = Responsabile · A = Accountable · C = Consultato · I = Informato</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Attività</strong></th><th><strong>RAML</strong></th><th><strong>DL</strong></th><th><strong>CdA</strong></th><th><strong>HR</strong></th></tr></thead>
<tbody><tr><td><strong>Gestione della segnalazione</strong></td><td>R</td><td>C</td><td>I</td><td>—</td></tr><tr><td><strong>Tutela del segnalante</strong></td><td>C</td><td>R</td><td>A</td><td>C</td></tr></tbody></table>
<blockquote>
<p><strong>6 Flussi Informativi tra Funzioni</strong></p>
<p><em>Documenti, destinatari, formato, tempistica e archiviazione — evidenza per il verificatore.</em></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Documento</strong></th><th><strong>Generato da</strong></th><th><strong>→</strong></th><th><strong>Destinato a</strong></th><th><strong>Formato</strong></th><th><strong>Entro</strong></th><th><blockquote><p><strong>Archiviazione</strong></p></blockquote></th></tr></thead>
<tbody><tr><td><strong>Registro segnalazioni di violazione</strong></td><td>RAML</td><td>→</td><td>CdA (in forma aggregata)</td><td>Registro riservato</td><td>Annuale</td><td><blockquote><p>Archivio riservato</p></blockquote></td></tr></tbody></table>
<blockquote>
<p><strong>7 KPI e Indicatori di Prestazione</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Indicatore</strong></th><th><strong>Target</strong></th><th><strong>Frequenza</strong></th></tr></thead>
<tbody><tr><td>Segnalazioni gestite nei termini</td><td>100%</td><td>Continuo</td></tr></tbody></table>
<blockquote>
<p><strong>8 Gestione Anomalie</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Anomalia</strong></th><th><strong>Causa</strong></th><th><strong>Azione</strong></th></tr></thead>
<tbody><tr><td><strong>Segnalazione sul RAML</strong></td><td>Conflitto di interessi</td><td>Gestione da parte del DL o del CdA.</td></tr></tbody></table>
<blockquote>
<p><strong>9 Registro Revisioni</strong></p>
</blockquote>
<table><thead><tr class="header"><th><strong>Ver.</strong></th><th><blockquote><p><strong>Data</strong></p></blockquote></th><th><strong>Autore</strong></th><th><blockquote><p><strong>Descrizione</strong></p></blockquote></th></tr></thead>
<tbody><tr class="odd"><td><strong>0.1</strong></td><td><blockquote><p>{{DATA_EMISSIONE}}</p></blockquote></td><td>Massimo Coletta</td><td><blockquote><p>Prima bozza — {{AZIENDA}} (da confrontare con le procedure in uso e verificare sulla normativa vigente)</p></blockquote></td></tr></tbody></table>
<blockquote>
<p>{{AZIENDA}} — AML-13 v{{VERSIONE}} ({{STATO}}) — Riservato uso interno — Approvato: {{RUOLO:CdA}}</p>
<p></p>
</blockquote>', '0.1');
insert into public.ruoli (azienda_id, sigla, nome, fascia) select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'RAML', 'Responsabile Antiriciclaggio (funzione AML)', 'staff' where not exists (select 1 from public.ruoli where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and sigla = 'RAML');
insert into public.ruoli (azienda_id, sigla, nome, fascia) select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'DSOS', 'Delegato alle Segnalazioni di Operazioni Sospette', 'staff' where not exists (select 1 from public.ruoli where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and sigla = 'DSOS');
insert into public.ruoli (azienda_id, sigla, nome, fascia) select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'ADV', 'Addetti adeguata verifica e gestori pratiche', 'staff' where not exists (select 1 from public.ruoli where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and sigla = 'ADV');
insert into public.ruoli (azienda_id, sigla, nome, fascia) select '3bcc90e8-a801-402b-8d87-5909429f44b3', 'RCI', 'Controlli interni / Revisione interna AML', 'staff' where not exists (select 1 from public.ruoli where azienda_id = '3bcc90e8-a801-402b-8d87-5909429f44b3' and sigla = 'RCI');
commit;
