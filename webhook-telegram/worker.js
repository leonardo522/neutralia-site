/**
 * Cloudflare Worker — Neutralia v2
 *
 * Endpoint pubblici:
 *   GET  /sostenitori-count           → counter Membri Fondatori
 *   POST /prenota-evento              → form prenotazione → Brevo
 *
 * Webhook Stripe:
 *   POST /stripe-webhook              → subscription → Brevo + KV active
 *                                      → payment one-time → Telegram (opz.)
 *                                      → subscription deleted → rimuove KV + Brevo
 *
 * Auth (Magic Link):
 *   POST /login-request               → genera token + invia email magic link via Brevo
 *   GET  /auth?t=TOKEN                → verifica token, set cookie HMAC, redirect
 *   POST /logout                      → cancella cookie
 *   GET  /check-access                → leggi cookie, ritorna { active, email }
 *
 * Contenuti protetti:
 *   GET  /api/protected/data/:tema    → JSON osservatorio (energetico/industriale/digitale/racconto)
 *                                      Richiede cookie HMAC valido + KV record attivo
 *
 * KV bindings (1 namespace):
 *   NEUTRALIA_KV — prefissi: sub:{email} (attivi), tok:{token} (login)
 *
 * Env vars:
 *   BREVO_API_KEY                — Secret
 *   BREVO_EVENT_LIST_ID          — Text (lista evento, default 9)
 *   BREVO_SUBSCRIBERS_LIST_ID    — Text (lista sostenitori, default 10)
 *   STRIPE_WEBHOOK_SECRET        — Secret (firma webhook)
 *   COOKIE_SECRET                — Secret (HMAC firma cookie, openssl rand -hex 32)
 *   SITE_URL                     — Text (https://neutralia.info)
 *   TELEGRAM_BOT_TOKEN / CHAT_ID — opzionali per notifiche acquisti one-time
 */

// ═══════════════════════════════════════════════════════════════════════
// DATI EMBEDDED — i 4 osservatori a pagamento (74 KB totali)
// ═══════════════════════════════════════════════════════════════════════
const DATA_ENERGETICO = {"tema": "energetico", "descrizione": "Sovranità energetica italiana: infrastrutture critiche (rete elettrica, gas, rigassificatori), dipendenze estere documentate dai contratti pubblici di import, e asset energetici nazionali controllati da soggetti esteri. Fonti: ENI, Snam, Terna, MISE, ARERA, Eurostat, FT, Reuters.", "items": [{"id": "tag-tarvisio", "nome": "TAG — Trans Austria Gasleitung", "lat": 46.5054, "lon": 13.5867, "kind": "gasdotto_import", "eyebrow": "Gasdotto di import", "sottotitolo": "Tarvisio (UD) · ingresso da Austria", "tipo": "Punto di ingresso del gas russo dalla rotta nord", "paese_controllo": "Italia (Snam) per il tratto austriaco fino al 2022; gas di origine russa (Gazprom)", "anno": "1974 (inaugurazione)", "descrizione": "Storica rotta principale di import del gas russo in Italia. Capacità ~40 mld m³/anno. Drasticamente ridotta dal 2022 dopo invasione russa dell'Ucraina e crisi degli stoccaggi.", "valori": [{"label": "Quota import Russia 2021", "value": "~40% del fabbisogno italiano"}, {"label": "Quota import Russia 2024", "value": "~5% (sostituito da TAP + Algeria + LNG)"}], "fatti": ["Snam gestisce il tratto italiano; Gas Connect Austria (ora ECA) gestiva il tratto austriaco", "L'Italia era il secondo importatore europeo di gas russo dopo la Germania", "Conversione progressiva del flusso da Est-Ovest a bidirezionale dal 2022"], "fonti": ["Snam — Annual Report", "MISE — Bilancio energetico nazionale", "Reuters, «Italy slashes Russian gas dependency», 2024"]}, {"id": "transmed-mazara", "nome": "TransMed (Enrico Mattei)", "lat": 37.6526, "lon": 12.5928, "kind": "gasdotto_import", "eyebrow": "Gasdotto di import", "sottotitolo": "Mazara del Vallo (TP) · ingresso da Algeria via Tunisia", "tipo": "Gasdotto sottomarino Algeria-Italia", "paese_controllo": "Sonatrach (Algeria) + Eni (Italia) + Sergaz/Stega (Tunisia)", "anno": "1983", "descrizione": "Principale rotta di import dall'Africa. Capacità 33,5 mld m³/anno. Diventato pilastro della sostituzione del gas russo dopo gli accordi 2022 Mattarella-Tebboune.", "valori": [{"label": "Capacità", "value": "33,5 mld m³/anno"}, {"label": "Quota Algeria 2024", "value": "~35-40% import italiano"}], "fatti": ["Accordo Eni-Sonatrach 2022: +9 mld m³/anno extra", "Asset strategico per la diversificazione post-Russia", "Tunisia ha quota di transito documentata"], "fonti": ["Eni — Comunicati stampa 2022-2024", "Sonatrach — Rapporti annuali", "IEA — Italy Energy Profile 2024"]}, {"id": "greenstream-gela", "nome": "GreenStream", "lat": 37.0723, "lon": 14.244, "kind": "gasdotto_import", "eyebrow": "Gasdotto di import", "sottotitolo": "Gela (CL) · ingresso da Libia", "tipo": "Gasdotto sottomarino Libia-Italia", "paese_controllo": "Eni (Italia) + NOC (Libia, statale)", "anno": "2004", "descrizione": "Connessione diretta con il giacimento Wafa nel deserto libico. Capacità ~8 mld m³/anno. Flussi ridotti per instabilità politica libica.", "fatti": ["Partecipazione Eni 50% / NOC Libia 50%", "Vulnerabilità geopolitica: dipende dalla stabilità delle istituzioni libiche", "Flusso 2023: ~3 mld m³ (sotto capacità nominale)"], "fonti": ["Eni — Annual Report", "MISE — Bilancio energetico"]}, {"id": "tap-melendugno", "nome": "TAP — Trans Adriatic Pipeline", "lat": 40.3486, "lon": 18.3683, "kind": "gasdotto_import", "eyebrow": "Gasdotto di import", "sottotitolo": "Melendugno (LE) · ingresso da Azerbaijan via Grecia/Albania", "tipo": "Gasdotto Corridoio Sud (Caspio→Europa)", "paese_controllo": "BP (UK) 20% · SNAM (Italia) 20% · SOCAR (Azerbaijan, statale) 20% · Fluxys (Belgio) 19% · Enagás (Spagna) 16% · Axpo (Svizzera) 5%", "anno": "2020 (entrata in esercizio)", "descrizione": "Tratto finale del Corridoio Sud del Gas, dall'Azerbaijan all'Italia. Capacità iniziale 10 mld m³/anno, raddoppiabile a 20 mld. Diventato strategico per la sostituzione del gas russo.", "valori": [{"label": "Capacità attuale", "value": "10 mld m³/anno"}, {"label": "Capacità futura (raddoppio)", "value": "20 mld m³/anno"}], "fonti": ["TAP AG — Corporate website (ownership structure)", "Snam — Investor presentation"]}, {"id": "olt-livorno", "nome": "OLT Offshore LNG Toscana", "lat": 43.7596, "lon": 10.0903, "kind": "rigassificatore", "eyebrow": "Rigassificatore offshore", "sottotitolo": "Offshore Livorno · 22 km dalla costa", "tipo": "Terminal LNG galleggiante (FSRU convertito)", "paese_controllo": "Snam (Italia) 49,07% · IGNEO Infrastructure Partners (fondo, gestione FCC/UK) 48,24% · Golar LNG (Bermuda/Norvegia) residuale", "anno": "2013", "descrizione": "Rigassificatore al largo della Toscana. Capacità 3,75 mld m³/anno. Snam ha acquisito quota di controllo nel 2024.", "fatti": ["Snam ha rilevato la quota di First Sentier Investors (poi IGNEO) raggiungendo il controllo nel 2024", "Approvvigionamento da carichi LNG spot — mercato globale", "Capacità: ~5% del consumo nazionale di gas"], "fonti": ["Snam — Comunicato 2024 acquisizione OLT", "OLT Offshore LNG Toscana — Bilancio"]}, {"id": "panigaglia", "nome": "Terminale GNL Panigaglia", "lat": 44.0717, "lon": 9.8364, "kind": "rigassificatore", "eyebrow": "Rigassificatore onshore", "sottotitolo": "Portovenere (SP) · Liguria", "tipo": "Terminale LNG storico", "paese_controllo": "GNL Italia (100% Snam)", "anno": "1971", "descrizione": "Primo terminale di rigassificazione costruito in Italia. Capacità 3,5 mld m³/anno. Asset strategico in mano italiana al 100%.", "fatti": ["Pieno controllo italiano via Snam (CDP)", "In funzione da oltre 50 anni"], "fonti": ["Snam — Sito istituzionale"]}, {"id": "cavarzere-rovigo", "nome": "Terminale Adriatic LNG (Rovigo)", "lat": 45.075, "lon": 12.4419, "kind": "rigassificatore", "eyebrow": "Rigassificatore offshore", "sottotitolo": "Offshore Porto Viro (RO) · 15 km dalla costa", "tipo": "Terminale LNG offshore (gravity-based structure)", "paese_controllo": "ExxonMobil (USA) 70,68% · QatarEnergy (Qatar, statale) 22% · Edison (gruppo EDF, Francia) 7,32%", "anno": "2009", "descrizione": "Maggior rigassificatore italiano. Capacità 8 mld m³/anno (~10% del consumo nazionale). Asset strategico interamente in mani estere: nessun socio italiano nel capitale.", "valori": [{"label": "Capacità", "value": "8 mld m³/anno"}, {"label": "Soci italiani", "value": "0%"}], "fatti": ["Il maggiore terminale GNL italiano è 100% di proprietà estera", "Edison (l'unica formalmente italiana) è in realtà controllata da EDF (Francia) al 99%", "Contratto di lungo termine con QatarEnergy per i carichi LNG"], "fonti": ["Adriatic LNG — Shareholders", "ExxonMobil — Annual Report", "FT, «Italy's LNG infrastructure: foreign control map», 2023"]}, {"id": "piombino-fsru", "nome": "FSRU Golar Tundra (Piombino)", "lat": 42.9281, "lon": 10.5375, "kind": "rigassificatore", "eyebrow": "Rigassificatore galleggiante", "sottotitolo": "Piombino (LI) · Toscana", "tipo": "FSRU (Floating Storage and Regasification Unit)", "paese_controllo": "Snam (Italia, CDP)", "anno": "2023", "descrizione": "FSRU acquistata da Golar LNG (Norvegia/Bermuda) e operata da Snam dal 2023 per ridurre dipendenza dal gas russo. Capacità 5 mld m³/anno.", "fatti": ["Acquistata per 350M$ nel 2022, operativa dal 2023", "Spostamento previsto a Ravenna nel 2026 per superare le contestazioni locali a Piombino"], "fonti": ["Snam — Comunicati 2022-2023", "Reuters — Italy LNG news"]}, {"id": "edison", "nome": "Edison S.p.A.", "lat": 45.4774, "lon": 9.1859, "kind": "asset_estero", "eyebrow": "Operatore energetico", "sottotitolo": "Sede Foro Buonaparte, Milano", "tipo": "Secondo operatore energetico italiano per quota mercato", "paese_controllo": "EDF — Électricité de France (Francia, statale ~84%) — 99,48% di Edison", "anno": "2012 (controllo EDF post-OPA)", "descrizione": "Storica utility italiana fondata nel 1884. Dal 2012 è di fatto una controllata francese: EDF (gruppo controllato dallo Stato francese) detiene quasi il 100% del capitale. Produzione elettrica e vendita di gas/luce a famiglie e imprese.", "valori": [{"label": "Quota EDF", "value": "99,48%"}, {"label": "Clienti retail Italia", "value": "~1,5 milioni"}], "fatti": ["Edison era controllata da Italenergia (Fiat, EdF, Montedison)", "OPA totalitaria EDF nel 2012, delisting da Piazza Affari", "Decisioni strategiche prese a Parigi"], "fonti": ["Edison — Relazione finanziaria annuale", "EDF — Document d'enregistrement universel"]}, {"id": "engie-italia", "nome": "ENGIE Italia S.p.A.", "lat": 45.4654, "lon": 9.1859, "kind": "asset_estero", "eyebrow": "Operatore energetico", "sottotitolo": "Sede Milano", "tipo": "Operatore elettrico-gas e servizi energetici", "paese_controllo": "ENGIE (Francia, partecipazione statale francese ~24%)", "anno": "1992 (ingresso in Italia come Gaz de France)", "descrizione": "Controllata italiana di ENGIE (ex Gaz de France-Suez), gruppo francese parastatale. Operatore retail su gas ed elettricità, gestione asset di generazione (cicli combinati) e servizi di efficienza energetica.", "fatti": ["ENGIE Holding capofila a Parigi", "Stato francese: 23,68% del capitale ENGIE (dati 2024)", "Asset di generazione: ~2.500 MW in Italia"], "fonti": ["ENGIE — Universal Registration Document", "Borsa Italiana — Profili emittenti"]}, {"id": "eon-italia", "nome": "E.ON Energia S.p.A.", "lat": 45.4585, "lon": 9.1888, "kind": "asset_estero", "eyebrow": "Operatore energetico", "sottotitolo": "Sede Milano", "tipo": "Operatore retail elettrico-gas", "paese_controllo": "E.ON SE (Germania) 100%", "anno": "2008 (acquisizione asset Endesa Italia)", "descrizione": "Filiale italiana del gruppo tedesco E.ON. Vendita elettricità e gas a clienti retail. Quota mercato italiana minore ma significativa.", "fonti": ["E.ON SE — Annual Report", "E.ON Energia — Bilancio depositato"]}, {"id": "sorgenia", "nome": "Sorgenia S.p.A.", "lat": 45.4655, "lon": 9.1843, "kind": "asset_estero", "eyebrow": "Operatore energetico", "sottotitolo": "Sede Milano", "tipo": "Operatore digitale retail elettrico-gas", "paese_controllo": "F2i SGR (fondo infrastrutturale italiano) + Asterion Industrial Partners (Spagna) — dal 2020", "anno": "1999 (fondazione, ex Energia Italiana del gruppo CIR)", "descrizione": "Operatore retail nato dal gruppo De Benedetti (CIR). Dal 2020 controllato da F2i (Italia) + Asterion (gestore infrastrutturale spagnolo). Forte componente di asset finanziari esteri nel capitale.", "fatti": ["Acquisizione F2i+Asterion da pool banche creditrici (ex-CIR)", "Asterion gestisce fondi infrastrutturali europei", "Asset di generazione: ~5 cicli combinati in Italia"], "fonti": ["Sorgenia — Bilanci", "F2i SGR — Comunicati portfolio", "Asterion Industrial Partners — Investor materials"]}, {"id": "eni-roma", "nome": "Eni S.p.A.", "lat": 41.842, "lon": 12.4796, "kind": "asset_italiano", "eyebrow": "Operatore energetico", "sottotitolo": "Sede legale Roma · operativa San Donato Milanese", "tipo": "Compagnia integrata oil & gas (azionariato a controllo statale)", "paese_controllo": "Italia — MEF (Ministero Economia e Finanze) 4,34% + CDP Equity 28,5% = ~33% Stato", "anno": "1953 (fondazione, Mattei)", "descrizione": "Major energetica italiana. Lo Stato italiano (MEF + CDP) ne detiene il controllo di fatto con ~33% in mano pubblica. Asset upstream in oltre 60 paesi.", "valori": [{"label": "Quota Stato (MEF+CDP)", "value": "~33%"}, {"label": "Quota flottante", "value": "~67%"}], "fatti": ["MEF detiene golden share residua", "Pilastro della politica energetica italiana", "Eni gestisce direttamente molti contratti di import (Algeria, Libia, Egitto, Mozambico, Congo)"], "fonti": ["Eni — Relazione finanziaria annuale 2024", "MEF — Partecipazioni"]}, {"id": "enel-roma", "nome": "Enel S.p.A.", "lat": 41.9082, "lon": 12.507, "kind": "asset_italiano", "eyebrow": "Operatore energetico", "sottotitolo": "Sede Roma", "tipo": "Maggior utility elettrica italiana / europea", "paese_controllo": "Italia — MEF 23,59% (azionista di riferimento)", "anno": "1962 (nazionalizzazione)", "descrizione": "Lo Stato italiano (MEF) detiene la quota di riferimento. Gestisce produzione, distribuzione e vendita elettrica in Italia, Spagna, Sudamerica.", "valori": [{"label": "Quota MEF", "value": "23,59%"}], "fatti": ["MEF è l'unico azionista rilevante", "Il resto è flottante (fondi internazionali, retail)", "Asset strategici: rete di distribuzione Enel Italia"], "fonti": ["Enel — Investor Relations", "MEF — Partecipazioni"]}, {"id": "terna", "nome": "Terna S.p.A. — rete di trasmissione", "lat": 41.9023, "lon": 12.4754, "kind": "asset_italiano", "eyebrow": "Rete elettrica nazionale", "sottotitolo": "Sede Roma · gestore della Rete di Trasmissione Nazionale", "tipo": "TSO (Transmission System Operator) elettrico", "paese_controllo": "CDP Reti 29,85% (controllo italiano)", "anno": "1999 (scorporo da Enel)", "descrizione": "Monopolista naturale della rete elettrica italiana ad alta tensione. CDP Reti (controllata da Cassa Depositi e Prestiti) ne detiene il controllo di fatto.", "fatti": ["Asset strategico nazionale — golden power", "CDP Reti è partecipata da CDP (Stato italiano) e State Grid of China (35%) — eredità acquisizione 2014", "State Grid of China ha il 35% di CDP Reti, e quindi indirettamente ~10% di Terna"], "fonti": ["Terna — Annual Report", "CDP — Partecipazioni", "Il Sole 24 Ore, «State Grid in CDP Reti», 2014"]}, {"id": "snam", "nome": "Snam S.p.A. — rete gas", "lat": 41.892, "lon": 12.5113, "kind": "asset_italiano", "eyebrow": "Rete gas nazionale", "sottotitolo": "Sede Milano (legale San Donato Milanese)", "tipo": "Gestore della rete di trasporto del gas", "paese_controllo": "CDP Reti 31,35% (controllo italiano)", "anno": "1941 (origine), 2001 quotazione", "descrizione": "Monopolista della rete di trasporto del gas in Italia. Gestisce ~32.000 km di gasdotti. Controllo via CDP, con esposizione indiretta a State Grid of China tramite CDP Reti.", "fatti": ["CDP Reti è controllata da CDP (Stato italiano), ma State Grid of China ha il 35% di CDP Reti", "Quindi State Grid detiene ~11% indiretto di Snam", "Asset strategico — golden power"], "fonti": ["Snam — Annual Report", "CDP — Partecipazioni"]}, {"id": "centrale-civitavecchia", "nome": "Centrale Torrevaldaliga Nord", "lat": 42.1242, "lon": 11.7717, "kind": "centrale_elettrica", "eyebrow": "Centrale elettrica", "sottotitolo": "Civitavecchia (RM) · Lazio", "tipo": "Centrale termoelettrica a carbone (in conversione a gas)", "paese_controllo": "Enel (Italia, MEF socio di riferimento)", "anno": "2008 (conversione a carbone)", "descrizione": "Una delle ultime centrali a carbone italiane. Conversione a gas naturale prevista entro il 2025-2027. 1.980 MW di potenza nominale.", "fatti": ["Storico contenzioso ambientale e sanitario con la popolazione locale", "Phase-out dal carbone parte della strategia energetica nazionale"], "fonti": ["Enel — Comunicati", "MISE — Strategia Energetica Nazionale 2030"]}, {"id": "centrale-brindisi", "nome": "Centrale Federico II di Cerano", "lat": 40.516, "lon": 17.997, "kind": "centrale_elettrica", "eyebrow": "Centrale elettrica", "sottotitolo": "Brindisi · Puglia", "tipo": "Centrale termoelettrica a carbone", "paese_controllo": "Enel (Italia)", "anno": "1991-1993 (gruppi entrati in servizio)", "descrizione": "Tra le maggiori centrali a carbone d'Europa. 2.640 MW. Phase-out previsto entro il 2025.", "fonti": ["Enel — Documentazione", "ARPA Puglia — Studi epidemiologici"]}, {"id": "caorso", "nome": "Centrale nucleare di Caorso (in decommissioning)", "lat": 45.0186, "lon": 9.8694, "kind": "nucleare_storico", "eyebrow": "Nucleare storico", "sottotitolo": "Caorso (PC) · Emilia-Romagna", "tipo": "Centrale BWR-6 — chiusa dal 1990 dopo referendum", "paese_controllo": "Sogin S.p.A. (100% MEF)", "anno": "1981 (entrata in servizio) · 1990 (chiusura definitiva)", "descrizione": "La maggiore centrale nucleare italiana (860 MWe). In smantellamento dal 1999 sotto la responsabilità di Sogin (controllata pubblica). Decommissioning previsto completato dopo il 2030.", "fatti": ["Reattore di tipo Boiling Water Reactor (BWR-6)", "Combustibile esaurito trasferito in Francia (La Hague) per riprocessamento", "Costi decommissioning a carico bolletta elettrica (componente A2)"], "fonti": ["Sogin — Piano operativo decommissioning", "ISIN — Ispettorato Nazionale per la Sicurezza Nucleare"]}, {"id": "trino-vercellese", "nome": "Centrale nucleare di Trino Vercellese", "lat": 45.1842, "lon": 8.2884, "kind": "nucleare_storico", "eyebrow": "Nucleare storico", "sottotitolo": "Trino (VC) · Piemonte", "tipo": "Centrale PWR — chiusa dal 1990", "paese_controllo": "Sogin S.p.A. (100% MEF)", "anno": "1965 · 1990 (chiusura)", "descrizione": "La prima centrale commerciale italiana. 270 MWe. In decommissioning sotto Sogin.", "fonti": ["Sogin — Piano operativo decommissioning"]}, {"id": "latina-nuke", "nome": "Centrale nucleare di Latina", "lat": 41.4256, "lon": 12.9408, "kind": "nucleare_storico", "eyebrow": "Nucleare storico", "sottotitolo": "Borgo Sabotino, Latina · Lazio", "tipo": "Centrale Magnox — chiusa dal 1987", "paese_controllo": "Sogin S.p.A. (100% MEF)", "anno": "1963 · 1987 (chiusura)", "descrizione": "Centrale di tecnologia britannica Magnox. 153 MWe. Smantellamento in corso.", "fonti": ["Sogin — Decommissioning"]}, {"id": "garigliano-nuke", "nome": "Centrale nucleare del Garigliano", "lat": 41.2585, "lon": 13.8281, "kind": "nucleare_storico", "eyebrow": "Nucleare storico", "sottotitolo": "Sessa Aurunca (CE) · Campania", "tipo": "Centrale BWR — chiusa dal 1982", "paese_controllo": "Sogin S.p.A. (100% MEF)", "anno": "1964 · 1982 (chiusura)", "descrizione": "Centrale di tecnologia BWR. 150 MWe. In decommissioning. Storicamente connessa a una zona ad alto rischio idrogeologico.", "fonti": ["Sogin — Decommissioning"]}]};
const DATA_INDUSTRIALE = {"tema": "industriale", "descrizione": "Sovranità industriale italiana: aziende manifatturiere e marchi storici acquisiti da soggetti esteri, delocalizzazioni di filiere strategiche, controllo del know-how nazionale. Tutti i casi citati hanno operazioni di M&A pubbliche e documentate.", "items": [{"id": "pirelli", "nome": "Pirelli & C.", "lat": 45.5106, "lon": 9.2128, "kind": "acquisizione_asia", "eyebrow": "Acquisizione estera", "sottotitolo": "Milano · sede Bicocca", "tipo": "Pneumatici premium", "paese_controllo": "Sinochem (Cina, statale) ~37% via Marco Polo Industrial Holding · Camfin (Italia, Tronchetti Provera) ~14%", "anno": "2015 (OPA ChemChina su Pirelli)", "descrizione": "Storica multinazionale italiana fondata nel 1872. Acquisita nel 2015 da ChemChina/Sinochem (Stato cinese) in joint venture con Camfin. Quotata di nuovo dal 2017 ma il primo azionista resta cinese. Nel 2023 il governo italiano ha esercitato il Golden Power per limitare il controllo cinese.", "valori": [{"label": "Quota cinese (Sinochem)", "value": "~37%"}, {"label": "Quota italiana (Camfin)", "value": "~14%"}], "fatti": ["Operazione 2015 valutata 7,1 mld €", "Golden Power esercitato dal governo Meloni nel 2023", "R&D mantenuta in Italia, ma controllo strategico cinese"], "fonti": ["Borsa Italiana — Comunicati Pirelli", "Reuters, «Italy invokes Golden Power on Pirelli», 2023", "FT — Sinochem-Pirelli deal coverage"]}, {"id": "italcementi", "nome": "Italcementi", "lat": 45.6948, "lon": 9.6645, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Bergamo · storica sede italiana", "tipo": "Cemento e calcestruzzo (5° produttore mondiale di cemento)", "paese_controllo": "HeidelbergCement (oggi Heidelberg Materials, Germania) 100%", "anno": "2016 (acquisizione totale)", "descrizione": "Quinta multinazionale italiana del cemento, fondata a Bergamo nel 1864 dalla famiglia Pesenti. Nel 2016 venduta interamente al gigante tedesco HeidelbergCement per 3,7 mld €. La sede storica è oggi un brand del gruppo tedesco.", "valori": [{"label": "Valore operazione", "value": "3,7 mld €"}, {"label": "Quota Heidelberg", "value": "100%"}], "fatti": ["Famiglia Pesenti uscita dal capitale nel 2016", "Brand Italcementi mantenuto in Italia", "Decisioni strategiche prese a Heidelberg"], "fonti": ["HeidelbergCement — Annual Report 2016-2017", "Reuters, «HeidelbergCement completes Italcementi acquisition», 2016"]}, {"id": "magneti-marelli", "nome": "Magneti Marelli (oggi Marelli Holdings)", "lat": 45.496, "lon": 9.169, "kind": "acquisizione_asia", "eyebrow": "Acquisizione estera", "sottotitolo": "Corbetta (MI) · Lombardia", "tipo": "Componentistica automotive", "paese_controllo": "KKR (USA, fondo private equity) — controllo di fatto post-merger con Calsonic Kansei (Giappone)", "anno": "2018 (vendita FCA→Calsonic Kansei/KKR)", "descrizione": "Storica controllata Fiat dal 1967. Nel 2018 ceduta da FCA per 6,2 mld € a Calsonic Kansei (giapponese, controllata da KKR). Fusione nel gruppo Marelli Holdings, sede legale in Giappone, controllo finanziario USA.", "valori": [{"label": "Valore operazione", "value": "6,2 mld €"}, {"label": "Sede legale post-fusione", "value": "Saitama, Giappone"}], "fatti": ["Stellantis non controlla più Marelli", "Marelli ha avuto procedura di ristrutturazione del debito 2022-2023 in Giappone", "Stabilimenti italiani: Bologna, Sulmona, Caivano, Melfi (a rischio chiusura)"], "fonti": ["Marelli Corporation — Annual Report", "Reuters — KKR/Calsonic acquisition coverage"]}, {"id": "pininfarina", "nome": "Pininfarina", "lat": 45.0367, "lon": 7.6822, "kind": "acquisizione_asia", "eyebrow": "Acquisizione estera", "sottotitolo": "Cambiano (TO) · Piemonte", "tipo": "Design e ingegneria automotive", "paese_controllo": "Mahindra & Mahindra (India) 76,06%", "anno": "2015 (acquisizione del gruppo Mahindra)", "descrizione": "Mito del design italiano (Ferrari, Alfa Romeo, Lancia). Ceduta nel 2015 al gruppo indiano Mahindra per ~168 M€ + assunzione debiti. Il brand resta in Italia, il controllo è in mani indiane.", "fatti": ["Famiglia Pininfarina uscita dall'azionariato", "Mahindra possiede anche Automobili Pininfarina (case ad alta gamma)", "Stabilimenti italiani ridimensionati"], "fonti": ["Pininfarina — Bilanci", "Mahindra — Annual Report"]}, {"id": "ferretti-yacht", "nome": "Ferretti Group", "lat": 44.4071, "lon": 12.2147, "kind": "acquisizione_asia", "eyebrow": "Acquisizione estera", "sottotitolo": "Forlì · Emilia-Romagna", "tipo": "Costruzione yacht di lusso (Riva, Pershing, Itama, Ferretti, Custom Line)", "paese_controllo": "Weichai Holding (Cina, statale) ~38% (azionista di controllo)", "anno": "2012 (acquisizione Weichai)", "descrizione": "Leader mondiale degli yacht di lusso. Dopo crisi finanziaria, acquisita nel 2012 dal gruppo cinese Weichai (statale, parte di Shandong Heavy Industry). Quotato in borsa Hong Kong dal 2022 e Milano dal 2023. Brand storici (Riva di Sarnico) sotto controllo cinese.", "fatti": ["Weichai è una holding statale cinese (Shandong SOE)", "Stabilimenti italiani: Forlì, La Spezia, Cattolica, Mondolfo, Ancona, Sarnico, Cala dei Medici", "R&D mantenuta in Italia"], "fonti": ["Ferretti Group — Annual Report", "FT, «Ferretti dual listing under Chinese control», 2022-2023"]}, {"id": "krizia", "nome": "Krizia", "lat": 45.4762, "lon": 9.1959, "kind": "acquisizione_asia", "eyebrow": "Acquisizione estera", "sottotitolo": "Milano · storica casa di moda", "tipo": "Alta moda femminile", "paese_controllo": "Shenzhen Marisfrolg Fashion (Cina) 100%", "anno": "2014", "descrizione": "Casa di moda fondata da Mariuccia Mandelli nel 1954. Dopo la morte della stilista, il marchio è stato acquisito dal gruppo cinese Marisfrolg.", "fonti": ["WWD, «Marisfrolg buys Krizia», 2014", "Marisfrolg — Corporate"]}, {"id": "bulgari", "nome": "Bulgari", "lat": 41.9056, "lon": 12.4823, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Roma · storica sede", "tipo": "Gioielleria e lusso", "paese_controllo": "LVMH (Francia, Bernard Arnault) 100%", "anno": "2011", "descrizione": "Maison fondata a Roma nel 1884 dalla famiglia Bulgari. Acquisita da LVMH nel 2011 per 4,3 mld €. Le boutique sono ovunque, il controllo è a Parigi.", "valori": [{"label": "Valore operazione", "value": "4,3 mld €"}], "fonti": ["LVMH — Document de référence", "Reuters — LVMH/Bulgari deal coverage"]}, {"id": "loro-piana", "nome": "Loro Piana", "lat": 45.7681, "lon": 8.1428, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Quarona (VC) · Piemonte", "tipo": "Tessuti pregiati e abbigliamento", "paese_controllo": "LVMH (Francia) 80% · famiglia Loro Piana 20%", "anno": "2013", "descrizione": "Maison del lusso fondata nel 1924, specializzata in vicuña e cashmere di qualità superiore. Acquisita da LVMH nel 2013 per 2 mld €.", "fonti": ["LVMH — Annual Report", "FT — Loro Piana coverage"]}, {"id": "gucci", "nome": "Gucci", "lat": 43.7711, "lon": 11.2486, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Firenze · sede legale Scandicci", "tipo": "Pelletteria e moda di lusso", "paese_controllo": "Kering (Francia, famiglia Pinault) 100%", "anno": "1999 (acquisizione PPR, oggi Kering)", "descrizione": "Casa di moda fondata a Firenze nel 1921 da Guccio Gucci. Acquisita nel 1999 da PPR (oggi Kering). Il brand più redditizio del gruppo francese.", "fonti": ["Kering — Document d'enregistrement universel"]}, {"id": "versace", "nome": "Versace", "lat": 45.4699, "lon": 9.1862, "kind": "acquisizione_usa", "eyebrow": "Acquisizione estera", "sottotitolo": "Milano · sede storica via Gesù", "tipo": "Alta moda e accessori", "paese_controllo": "Capri Holdings (USA, ex Michael Kors) 100% → trattative di vendita a Prada in corso (2025)", "anno": "2018 (acquisizione Capri)", "descrizione": "Casa di moda fondata a Milano nel 1978 da Gianni Versace. Acquisita nel 2018 dal gruppo statunitense Capri Holdings per 2,15 mld $. Nel 2025 in trattativa per riacquisizione da Prada (riportata italiana).", "valori": [{"label": "Valore operazione Capri", "value": "2,15 mld $"}], "fatti": ["Trattativa Prada-Capri annunciata aprile 2025 per ~1,375 mld $", "Donatella Versace direttore creativo fino al 2025"], "fonti": ["Capri Holdings — 10-K filing", "Reuters, «Prada to acquire Versace», aprile 2025"]}, {"id": "valentino", "nome": "Valentino", "lat": 41.907, "lon": 12.4862, "kind": "acquisizione_extra", "eyebrow": "Acquisizione estera", "sottotitolo": "Roma · sede storica", "tipo": "Alta moda", "paese_controllo": "Mayhoola for Investments (Qatar, sovereign wealth) 70% · Kering (Francia) 30%", "anno": "2012 (Mayhoola) · 2023 (entrata Kering 30%)", "descrizione": "Casa di moda fondata da Valentino Garavani nel 1960. Dal 2012 controllata dal fondo sovrano qatariota Mayhoola. Nel 2023 Kering ha acquisito il 30%, con opzione di salire al 100% entro il 2028.", "fatti": ["Mayhoola è veicolo della famiglia reale del Qatar", "Operazione Kering 30%: 1,7 mld €", "Direzione creativa: Alessandro Michele dal 2024"], "fonti": ["Kering — Comunicato luglio 2023", "Reuters — Valentino ownership"]}, {"id": "parmalat", "nome": "Parmalat", "lat": 44.8009, "lon": 10.3279, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Collecchio (PR) · Emilia-Romagna", "tipo": "Latte e derivati (filiera strategica alimentare)", "paese_controllo": "Sofil S.A.S. — Lactalis (Francia, famiglia Besnier) 90,7%", "anno": "2011 (OPA Lactalis)", "descrizione": "Marchio storico del latte italiano (Calisto Tanzi), risanato dopo il crac del 2003. Acquisito da Lactalis nel 2011 per ~3,7 mld €. Asset strategico della filiera latte italiana ora controllato in Francia.", "valori": [{"label": "Quota Lactalis", "value": "90,7%"}], "fatti": ["Famiglia Besnier (Lactalis) controlla anche Galbani", "Stabilimenti italiani: Collecchio, Zevio (VR), Pavia, ecc."], "fonti": ["Lactalis — Rapporto attività", "Borsa Italiana — Parmalat history"]}, {"id": "galbani", "nome": "Galbani", "lat": 45.6533, "lon": 9.4419, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Melzo (MI) · Lombardia", "tipo": "Formaggi e salumi", "paese_controllo": "Lactalis (Francia, famiglia Besnier)", "anno": "2006 (acquisizione Lactalis)", "descrizione": "Storico marchio italiano di formaggi (mozzarella, certosa, robiola). Acquisito da Lactalis nel 2006. Stabilimenti italiani conservati ma proprietà francese.", "fonti": ["Lactalis — Brand portfolio"]}, {"id": "tim-roma", "nome": "TIM (Telecom Italia)", "lat": 41.9203, "lon": 12.4961, "kind": "acquisizione_misto", "eyebrow": "Capitale frammentato estero", "sottotitolo": "Roma · sede legale", "tipo": "Operatore telecomunicazioni (telco)", "paese_controllo": "Vivendi (Francia) ~24% (in dismissione) · Poste Italiane (Stato) 9,8% · KKR (USA) ha rilevato la rete (NetCo) per 22 mld € nel 2024", "anno": "2024 (vendita NetCo a KKR)", "descrizione": "Storica telco italiana, privatizzata nel 1997. Dal 2015 Vivendi ne è il primo azionista. Nel 2024 KKR (USA) ha acquisito NetCo (rete fissa) per 22 mld €, scorporata da TIM. Asset strategico nazionale ora in mani estere e finanziarie.", "fatti": ["Asset di rete (NetCo) ora in proprietà KKR + MEF + F2i + ADIA (Abu Dhabi)", "ServCo (servizi) resta TIM", "Operazione contestata da CDP e dal governo Meloni nelle modalità ma autorizzata"], "fonti": ["TIM — Investor Relations", "FT, «KKR buys TIM's network», 2024"]}, {"id": "ilva-taranto", "nome": "Ilva (Acciaierie d'Italia)", "lat": 40.467, "lon": 17.22, "kind": "acquisizione_misto", "eyebrow": "Controllo in stallo", "sottotitolo": "Taranto · Puglia", "tipo": "Maggior siderurgico d'Europa", "paese_controllo": "ArcelorMittal (Lussemburgo) 38% · Invitalia (Italia, Stato) 32% (stato dal 2024 in evoluzione)", "anno": "2018 (acquisizione ArcelorMittal post-amministrazione straordinaria)", "descrizione": "Ex Ilva di Taranto, principale acciaieria europea. Acquisita da ArcelorMittal nel 2018 in joint venture con Invitalia. Situazione di crisi permanente per problemi ambientali, sanitari (cluster Taranto), debito. Nel 2024 ingresso del MEF e nuovi piani di rilancio in discussione.", "fatti": ["Cluster epidemiologico Taranto documentato (mortalità +21% area Tamburi vs Italia)", "Sentenza CEDU 2019: Italia condannata per violazione diritto alla vita", "Trattative continue per ingresso nuovo azionista (Baku Steel, Jindal, Vulcan, ecc.)"], "fonti": ["Acciaierie d'Italia — Bilanci", "CEDU — Cordella e altri c. Italia, 2019", "Studio SENTIERI — Ministero Salute"]}, {"id": "stellantis", "nome": "Stellantis (ex FCA + PSA)", "lat": 45.0411, "lon": 7.6253, "kind": "acquisizione_eu", "eyebrow": "Fusione cross-border", "sottotitolo": "Sede operativa Torino, sede legale Amsterdam", "tipo": "Multinazionale automobilistica", "paese_controllo": "Exor (Italia, Agnelli) 14,9% · Famiglia Peugeot (Francia) 7,1% · BPI France (Francia, statale) 6,4%", "anno": "2021 (fusione FCA-PSA)", "descrizione": "Nata dalla fusione FCA (italiana, Fiat) e PSA (francese, Peugeot) nel 2021. Sede legale ad Amsterdam, sede fiscale Olanda, quotazione Milano/Parigi/New York. Stabilimenti italiani ridimensionati (chiusure annunciate Mirafiori turni, Pomigliano, Cassino).", "valori": [{"label": "Produzione Italia 2024", "value": "~470.000 veicoli (minimo storico)"}, {"label": "Produzione Italia 2007", "value": "~1,3 mln (picco)"}], "fatti": ["Famiglia Agnelli (Exor) primo azionista — 14,9%", "Sede legale e fiscale spostate fuori Italia nel 2014 (Fiat) e mantenute con Stellantis", "Tagli all'occupazione e cassa integrazione strutturale stabilimenti italiani"], "fonti": ["Stellantis — Annual Report", "ANFIA — Statistiche produzione", "FIM-CISL, FIOM — Comunicati"]}, {"id": "pernigotti", "nome": "Pernigotti", "lat": 44.6772, "lon": 8.6203, "kind": "acquisizione_extra", "eyebrow": "Acquisizione estera (chiusura)", "sottotitolo": "Novi Ligure (AL) · Piemonte", "tipo": "Cioccolato e gianduiotti", "paese_controllo": "Toksöz Group (Turchia) — chiuso, poi rilevato da JP Morgan/Optima", "anno": "2013 (acquisizione Toksöz) · 2020 (cessione)", "descrizione": "Storica fabbrica di cioccolato fondata a Novi Ligure nel 1860. Acquisita dai turchi Toksöz nel 2013, annunciata la chiusura della produzione italiana nel 2018, salvata da Invitalia + JP Morgan nel 2020. Caso emblematico di delocalizzazione fallita.", "fonti": ["Reuters — Pernigotti closure news", "Il Sole 24 Ore — Cronache Pernigotti"]}, {"id": "berco", "nome": "Berco (Thyssenkrupp)", "lat": 44.9019, "lon": 11.5722, "kind": "acquisizione_eu", "eyebrow": "Acquisizione estera", "sottotitolo": "Copparo (FE) · Emilia-Romagna", "tipo": "Componenti per movimento terra (sottocarri)", "paese_controllo": "Thyssenkrupp (Germania) 100%", "anno": "1999", "descrizione": "Leader europeo nei sottocarri per macchine movimento terra. Controllata Thyssenkrupp dal 1999. Stabilimento principale a Copparo (Ferrara) in continua ristrutturazione con cassa integrazione.", "fonti": ["Thyssenkrupp — Annual Report"]}]};
const DATA_DIGITALE = {"tema": "digitale", "descrizione": "Sovranità digitale italiana: telecomunicazioni, infrastrutture cloud, data center sul suolo italiano, dipendenza tecnologica della PA da hyperscaler esteri. Tutti i casi sono documentati pubblicamente.", "items": [{"id": "tim-net", "nome": "TIM NetCo (rete fissa)", "lat": 41.9203, "lon": 12.4961, "kind": "telco", "eyebrow": "Rete telco fissa nazionale", "sottotitolo": "Roma · ex rete TIM", "tipo": "Asset strategico — rete fissa nazionale", "paese_controllo": "KKR (USA) 38% · MEF (Italia) 25% · F2i (Italia) + ADIA (Abu Dhabi)", "anno": "2024 (vendita asset NetCo)", "descrizione": "Storica rete telefonica italiana (ex SIP, Telecom Italia). Nel 2024 scorporata da TIM e venduta per 22 mld € a una cordata guidata dal fondo USA KKR. Lo Stato italiano (MEF) ha mantenuto il 25%, ma il controllo operativo è di KKR. Asset strategico nazionale ora finanziarizzato.", "valori": [{"label": "Valore operazione", "value": "22 mld €"}, {"label": "Quota Italia (MEF+F2i)", "value": "~35%"}, {"label": "Quota KKR (USA)", "value": "~38%"}, {"label": "Quota ADIA (Abu Dhabi)", "value": "~20%"}], "fatti": ["Golden Power esercitato per imporre vincoli su gestione e investimenti", "Operazione contestata da Vivendi (azionista TIM) in sede legale", "Cassa Depositi e Prestiti era originariamente nella cordata ma è uscita"], "fonti": ["Reuters, «KKR completes TIM network acquisition», luglio 2024", "MEF — Comunicati Golden Power"]}, {"id": "windtre", "nome": "WindTre", "lat": 45.4781, "lon": 9.2278, "kind": "telco", "eyebrow": "Operatore telco", "sottotitolo": "Rho (MI) · sede operativa", "tipo": "Operatore mobile + fisso (~25 mln clienti)", "paese_controllo": "CK Hutchison Holdings (Hong Kong, famiglia Li Ka-shing) 100%", "anno": "2020 (CK Hutchison rileva il 100% dopo uscita VEON)", "descrizione": "Operatore nato dalla fusione Wind (italiana) + 3 Italia (CK Hutchison). Dal 2020 controllato al 100% dalla holding di Hong Kong. Asset strategico ora interamente in mani estere.", "valori": [{"label": "Clienti mobile", "value": "~21 milioni"}, {"label": "Clienti fisso", "value": "~3 milioni"}], "fatti": ["CK Hutchison ha rilevato il 100% nel 2020 (uscita VEON/Vimpelcom)", "Discussioni 2024 su possibili dismissioni di asset di rete (FiberCop)", "Golden Power applicabile ma non esercitato in fase di acquisizione"], "fonti": ["CK Hutchison — Annual Report", "WindTre — Bilancio depositato"]}, {"id": "vodafone-italia", "nome": "Vodafone Italia (in vendita a Swisscom)", "lat": 45.4626, "lon": 9.188, "kind": "telco", "eyebrow": "Operatore telco", "sottotitolo": "Milano · Vodafone Village", "tipo": "Operatore mobile + fisso", "paese_controllo": "Swisscom (Svizzera, statale 51%) — acquisizione conclusa 2025 per 8 mld €", "anno": "2025 (closing acquisizione Swisscom)", "descrizione": "Filiale italiana di Vodafone Group (UK). Nel 2024 Vodafone ha annunciato la vendita a Swisscom (controllata dallo Stato svizzero) per 8 mld €. Operazione conclusa nel 2025. Asset strategico passa dalla UK alla Svizzera, con Stato svizzero come ultimo controllore.", "fatti": ["Swisscom è controllata dallo Stato svizzero al 51% (Confederazione)", "Fusione con Fastweb (anch'essa Swisscom) per creare Italian numero 2", "Operazione approvata da Bruxelles e dal governo italiano"], "fonti": ["Vodafone Group — Annual Report 2024", "Swisscom — Press release 2025", "FT — Vodafone Italy divestment coverage"]}, {"id": "fastweb", "nome": "Fastweb", "lat": 45.4708, "lon": 9.1812, "kind": "telco", "eyebrow": "Operatore telco", "sottotitolo": "Milano", "tipo": "Operatore fisso (fibra) + mobile", "paese_controllo": "Swisscom (Svizzera, statale 51%) 100%", "anno": "2007 (Swisscom acquisisce Fastweb)", "descrizione": "Operatore di telecomunicazioni broadband. Acquisita da Swisscom nel 2007. Dalla fusione con Vodafone Italia (2025) diventa il principale concorrente di TIM.", "fonti": ["Swisscom — Annual Report"]}, {"id": "iliad-italia", "nome": "Iliad Italia", "lat": 45.4756, "lon": 9.17, "kind": "telco", "eyebrow": "Operatore telco", "sottotitolo": "Milano", "tipo": "Operatore mobile + fisso (challenger)", "paese_controllo": "Iliad Holding (Francia, Xavier Niel) 100%", "anno": "2018 (lancio in Italia)", "descrizione": "Quarto operatore mobile italiano, lanciato nel 2018 con tariffe disruptive. Controllato dal gruppo francese Iliad di Xavier Niel. Ha cambiato la struttura del mercato italiano.", "valori": [{"label": "Clienti Italia 2024", "value": "~11 milioni"}], "fatti": ["Nato da operazione FCC (Free Mobile in Francia)", "Ha acquisito asset di Wind+3 Italia come parte della fusione del 2016", "Nel 2024 e 2025 in trattative per fusione con Vodafone/TIM, alla fine fallite"], "fonti": ["Iliad — Document de référence", "AGCOM — Osservatorio sulle comunicazioni"]}, {"id": "aruba-arezzo", "nome": "Aruba S.p.A. — IT3 Global Cloud Data Center", "lat": 43.4633, "lon": 11.8796, "kind": "datacenter_italiano", "eyebrow": "Data center italiano", "sottotitolo": "Arezzo · IT3 Tier IV", "tipo": "Maggior data center campus italiano (200.000 m²)", "paese_controllo": "Aruba S.p.A. (Italia, famiglia Cecchini) 100%", "anno": "2017", "descrizione": "Data center campus a Ponte San Pietro (Bergamo) e Arezzo. Aruba è il maggior operatore italiano di servizi cloud, hosting e PEC. Pieno controllo italiano. Tier IV (massimo standard di disponibilità).", "fatti": ["Aruba gestisce circa il 90% dei domini .it", "PEC certificata: ~7 milioni di caselle", "Fornitore qualificato AgID per la PA italiana"], "fonti": ["Aruba — Sito istituzionale", "AgID — Elenco fornitori qualificati"]}, {"id": "aws-milano", "nome": "AWS Europe (Milan) Region — eu-south-1", "lat": 45.538, "lon": 9.203, "kind": "datacenter_estero", "eyebrow": "Hyperscaler estero", "sottotitolo": "Milano · Settimo Milanese + Cornaredo", "tipo": "Region cloud AWS (3 Availability Zones)", "paese_controllo": "Amazon Web Services Inc. (USA, controllata Amazon.com)", "anno": "2020 (apertura region)", "descrizione": "Region italiana di AWS, prima fra gli hyperscaler in Italia. 3 zone di disponibilità, infrastruttura cruciale per molte PA, banche, startup italiane. Dati su suolo italiano ma controllo USA: soggetto al CLOUD Act statunitense.", "fatti": ["Dati Italiana ma sotto giurisdizione USA per il CLOUD Act 2018", "Investimento dichiarato AWS in Italia: 2 mld € entro 2029", "Usato da PSN (Polo Strategico Nazionale) per dati ordinari"], "fonti": ["AWS — Press release apertura Milano", "USA CLOUD Act, 2018"]}, {"id": "azure-italy", "nome": "Microsoft Azure Italy North Region", "lat": 45.4847, "lon": 9.0364, "kind": "datacenter_estero", "eyebrow": "Hyperscaler estero", "sottotitolo": "Milano (Settimo + Lainate + Cinisello)", "tipo": "Region cloud Microsoft Azure", "paese_controllo": "Microsoft Corporation (USA)", "anno": "2023 (apertura region Italy North)", "descrizione": "Region italiana di Microsoft Azure. Soggetta a CLOUD Act USA. Investimenti dichiarati 4,3 mld $ entro 2027 (annuncio Satya Nadella).", "fatti": ["Investimento dichiarato: 4,3 mld $ in 2 anni", "Forte adozione nella PA italiana per Office 365 ed Azure", "Sovranità dati: solo location, controllo legale resta USA"], "fonti": ["Microsoft — Annuncio Italy region", "Comunicato governo italiano marzo 2024"]}, {"id": "gcp-italy", "nome": "Google Cloud Italy Region (europe-west12)", "lat": 45.4628, "lon": 9.1885, "kind": "datacenter_estero", "eyebrow": "Hyperscaler estero", "sottotitolo": "Milano + Torino", "tipo": "Region Google Cloud", "paese_controllo": "Alphabet Inc. (USA)", "anno": "2022", "descrizione": "Region italiana di Google Cloud. Joint venture con TIM Enterprise per la commercializzazione. Soggetta a CLOUD Act USA.", "fatti": ["Partnership commerciale con TIM Enterprise", "Investimento dichiarato 900 mln € in 5 anni", "Usata per soluzioni AI Generativa (Vertex AI) anche da imprese italiane"], "fonti": ["Google Cloud — Italy region announcement", "TIM Group — Comunicato JV Google Cloud"]}, {"id": "equinix-milano", "nome": "Equinix Milano (MI1, MI2, MI3, MI4)", "lat": 45.498, "lon": 9.207, "kind": "datacenter_estero", "eyebrow": "Datacenter estero", "sottotitolo": "Milano · Caldera, Magenta, Cassina De Pecchi", "tipo": "Carrier-neutral data center (IX hub)", "paese_controllo": "Equinix Inc. (USA) 100%", "anno": "2009 (apertura MI1)", "descrizione": "Maggior operatore di colocation data center estero in Italia. Hub di Internet exchange — quasi tutto il traffico internet italiano transita per Equinix Milano. Asset infrastrutturale critico in mani USA.", "fatti": ["Sede principale del MIX (Milan Internet Exchange)", "Equinix è quotata NASDAQ — REIT", "Migliaia di clienti enterprise, banche, telco operano da Equinix Milano"], "fonti": ["Equinix — Annual Report", "MIX — Sito istituzionale"]}, {"id": "psn-roma", "nome": "Polo Strategico Nazionale (PSN)", "lat": 41.91, "lon": 12.5028, "kind": "datacenter_italiano", "eyebrow": "Cloud strategico PA", "sottotitolo": "Roma · sede operativa + Milano", "tipo": "Cloud nazionale per dati strategici della PA", "paese_controllo": "TIM 45% · Leonardo S.p.A. (Italia, MEF) 25% · CDP Equity (Italia) 20% · Sogei (Italia, MEF) 10%", "anno": "2022 (concessione governativa)", "descrizione": "Cloud sovrano italiano per i dati strategici della PA, nato come risposta al CLOUD Act USA. Concessione 13 anni dal 2022. I dati 'critici' delle PA devono migrare qui. Tecnologia parzialmente fornita da partner esteri (Oracle, Google), ma controllo legale e operativo italiano.", "fatti": ["Concessione assegnata al consorzio TIM-Leonardo-CDP-Sogei nel 2022", "Sedi: Roma (Acilia) + Pomezia + Milano + Rozzano (4 data center)", "Marketplace di soluzioni cloud disponibili anche con tecnologia Oracle/Google ma gestite italianamente"], "fonti": ["Comunicati Governo — Concessione PSN", "PSN — Sito istituzionale (psnitalia.it)"]}, {"id": "sogei-roma", "nome": "Sogei — Società Generale d'Informatica", "lat": 41.843, "lon": 12.475, "kind": "datacenter_italiano", "eyebrow": "Operatore IT della PA", "sottotitolo": "Roma · sede operativa via Mario Carucci", "tipo": "Partner IT del MEF — gestisce anagrafe fiscale e identità digitale", "paese_controllo": "Ministero Economia e Finanze (Italia) 100%", "anno": "1976 (fondazione)", "descrizione": "Società in-house del Tesoro. Gestisce l'Anagrafe Tributaria, SPID (in parte), il sistema dei pagamenti fiscali. Asset strategico nazionale interamente pubblico.", "fatti": ["100% MEF", "Gestisce dati fiscali di tutti i contribuenti italiani", "Anche operatore PSN (10%)"], "fonti": ["Sogei — Bilancio", "MEF — Partecipazioni"]}, {"id": "leonardo-roma", "nome": "Leonardo S.p.A.", "lat": 41.9018, "lon": 12.4633, "kind": "asset_italiano_strategico", "eyebrow": "Difesa, Aerospazio, Cybersecurity", "sottotitolo": "Roma · sede legale Piazza Monte Grappa", "tipo": "Gruppo industriale difesa-aerospazio-cyber", "paese_controllo": "MEF (Italia) 30,2% — controllo statale", "anno": "1948 (origine come Finmeccanica)", "descrizione": "Maggior gruppo italiano della difesa. Controllato dallo Stato via MEF. Operatore di cybersecurity (Leonardo Cyber Security, ex-Selex) anche per la PA italiana. Partecipa al PSN al 25%.", "fatti": ["MEF è il primo azionista (30,2%)", "Cybersecurity nazionale — partner ACN (Agenzia per la Cybersicurezza Nazionale)", "Quotata Milano e su listini esteri"], "fonti": ["Leonardo — Investor Relations", "MEF — Partecipazioni"]}, {"id": "acn-roma", "nome": "ACN — Agenzia per la Cybersicurezza Nazionale", "lat": 41.905, "lon": 12.481, "kind": "asset_italiano_strategico", "eyebrow": "Autorità cyber nazionale", "sottotitolo": "Roma · via Curtatone", "tipo": "Autorità nazionale per la cybersicurezza", "paese_controllo": "Presidenza del Consiglio (Italia) — agenzia governativa", "anno": "2021 (istituzione)", "descrizione": "Agenzia governativa istituita nel 2021 per coordinare la cybersicurezza nazionale, supervisionare il PSN, certificare fornitori della PA. Asset strategico nazionale.", "fatti": ["Diretta da Bruno Frattasi (2023-)", "Gestisce il Perimetro di Sicurezza Nazionale Cibernetica", "Pubblica liste di fornitori cloud qualificati (QC1/QC2/QC3/QC4)"], "fonti": ["ACN — Sito istituzionale (acn.gov.it)", "DPCM 5 febbraio 2021"]}, {"id": "open-fiber", "nome": "Open Fiber", "lat": 45.4773, "lon": 9.1879, "kind": "telco", "eyebrow": "Rete FTTH", "sottotitolo": "Milano · sede operativa", "tipo": "Operatore wholesale rete in fibra FTTH", "paese_controllo": "CDP Equity (Italia) 60% · Macquarie (Australia, fondo) 40%", "anno": "2017 (joint venture CDP-Enel) · 2021 (ingresso Macquarie)", "descrizione": "Rete FTTH (Fiber to the Home) parallela a TIM, finanziata con PNRR per la copertura del territorio nazionale. CDP mantiene il controllo (60%), ma il 40% è di Macquarie (Australia).", "fatti": ["Asset strategico per banda ultralarga in Italia", "Finanziamento PNRR per copertura aree bianche/grigie", "Trattative 2024-2025 per fusione con NetCo TIM"], "fonti": ["Open Fiber — Bilancio", "CDP — Comunicati partecipazioni"]}, {"id": "tiscali-cagliari", "nome": "Tiscali", "lat": 39.224, "lon": 9.1167, "kind": "telco", "eyebrow": "Operatore telco (minore)", "sottotitolo": "Cagliari · sede legale", "tipo": "Operatore broadband + servizi cloud", "paese_controllo": "Italia (azionariato diffuso) — fusione con Linkem Retail nel 2022", "anno": "1998 (fondazione, Renato Soru)", "descrizione": "Storico ISP italiano. Dopo la crisi finanziaria si è fuso con Linkem Retail nel 2022. Controllo italiano ma capitale frammentato.", "fonti": ["Tiscali — Bilancio", "Borsa Italiana"]}]};
const DATA_RACCONTO = {"tema": "racconto", "descrizione": "Sovranità del racconto — culturale, informativa e accademica. Documenta organizzazioni, fondazioni e istituti operanti in Italia il cui finanziamento o legame proviene da Stati, enti o capitali esteri, sulla base di bilanci, registri trasparenza e fonti pubbliche. Nessuna accusa, solo collegamenti finanziari/organizzativi documentabili. Tutti i casi sono pubblicamente noti.", "items": [{"id": "aspen-italia", "nome": "Aspen Institute Italia", "lat": 41.905, "lon": 12.4795, "kind": "think_tank", "eyebrow": "Think tank", "sottotitolo": "Roma · piazza Navona", "tipo": "Filiale italiana dell'Aspen Institute (USA)", "paese_controllo": "Associazione italiana affiliata ad Aspen Institute (Washington DC, USA)", "anno": "1984 (fondazione filiale italiana)", "descrizione": "Filiale italiana dell'Aspen Institute USA, think tank nato a Aspen (Colorado) nel 1949. In Italia organizza seminari e pubblicazioni con leader politici, finanziari e di impresa italiani. Affiliato istituzionalmente alla casa madre americana.", "fatti": ["Aspen Institute USA è considerato veicolo di soft power statunitense in numerose analisi accademiche", "I presidenti e i membri del Board sono spesso ex-ministri italiani (Letta, D'Alema, Padoan, Tremonti)", "I documenti e i seminari sono pubblici sul sito aspeninstitute.it"], "fonti": ["Aspen Institute Italia — Bilanci pubblicati", "Aspen Institute (USA) — 990 forms IRS", "C. Lasch, «The Revolt of the Elites» — analisi sui think tank atlantici"]}, {"id": "iai-roma", "nome": "IAI — Istituto Affari Internazionali", "lat": 41.9067, "lon": 12.4814, "kind": "think_tank", "eyebrow": "Think tank", "sottotitolo": "Roma · via dei Montecatini", "tipo": "Centro studi di politica estera", "paese_controllo": "Fondazione di diritto italiano — finanziamenti da MAECI, UE, NATO, fondazioni estere", "anno": "1965 (fondazione, Altiero Spinelli)", "descrizione": "Storico think tank italiano di politica estera. Pubblica analisi su NATO, UE, Mediterraneo. Bilancio finanziato da contributi pubblici italiani (MAECI), fondi UE, NATO, e fondazioni estere (es. Compagnia di San Paolo, Open Society, NED). Trasparenza pubblicata sul sito.", "fatti": ["Bilancio pubblicato annualmente con elenco contributori", "Tra i finanziatori storici: NATO PDD, Commissione UE, US Embassy Rome, German Marshall Fund", "Pubblica AffarInternazionali.it"], "fonti": ["IAI — Bilanci annuali (iai.it)", "IAI — Rapporto attività"]}, {"id": "ispi-milano", "nome": "ISPI — Istituto per gli Studi di Politica Internazionale", "lat": 45.4684, "lon": 9.1928, "kind": "think_tank", "eyebrow": "Think tank", "sottotitolo": "Milano · palazzo Clerici", "tipo": "Centro studi di politica internazionale", "paese_controllo": "Fondazione italiana — finanziamenti da MAECI, UE, fondazioni private e estere", "anno": "1934 (fondazione)", "descrizione": "Tra i più antichi think tank europei di politica estera. Sede a Palazzo Clerici (Milano). Finanziato in larga parte dal MAECI italiano, ma anche da fondazioni estere (es. Fondazione Cariplo, Open Society in passato, programmi UE).", "fatti": ["Bilancio pubblicato", "Organizza la principale conferenza annuale italiana di politica estera (MED — Mediterranean Dialogues, in partnership MAECI)"], "fonti": ["ISPI — Bilancio (ispionline.it)", "MAECI — Trasparenza contributi"]}, {"id": "ecfr-roma", "nome": "ECFR Rome — European Council on Foreign Relations", "lat": 41.9087, "lon": 12.481, "kind": "think_tank", "eyebrow": "Think tank", "sottotitolo": "Roma · ufficio italiano", "tipo": "Filiale italiana di ECFR (sede principale Berlino)", "paese_controllo": "ECFR (rete europea, sede Berlino) — finanziato da Open Society Foundations + governi europei + Stiftung Mercator + altri", "anno": "2007 (fondazione ECFR) · ufficio Roma successivo", "descrizione": "Think tank pan-europeo con uffici in 7 capitali europee. Tra i finanziatori storici: Open Society Foundations (George Soros), Stiftung Mercator (Germania), governi europei. ECFR ha pubblicato la trasparenza sui propri finanziatori.", "fonti": ["ECFR — Annual Report (ecfr.eu)", "ECFR — Funders list pubblicata"]}, {"id": "asgi-italia", "nome": "ASGI — Associazione Studi Giuridici sull'Immigrazione", "lat": 45.0703, "lon": 7.6869, "kind": "ong", "eyebrow": "ONG / advocacy", "sottotitolo": "Torino · sede legale", "tipo": "Associazione di avvocati e giuristi su diritti dei migranti", "paese_controllo": "Associazione italiana — finanziamenti da Open Society Foundations + UE + fondazioni private italiane", "anno": "1990 (fondazione)", "descrizione": "ONG italiana attiva sul diritto dell'immigrazione. Bilancio pubblico mostra contributi da Open Society Foundations (USA, Soros) e fondi UE (AMIF). Promotrice di numerosi ricorsi in materia di diritti dei migranti.", "fatti": ["Bilancio annuale pubblicato sul sito asgi.it", "Tra i finanziatori storici: OSF, Compagnia di San Paolo, UE AMIF, MAECI", "Attiva in advocacy presso istituzioni UE"], "fonti": ["ASGI — Bilancio (asgi.it)", "Open Society Foundations — Grants database"]}, {"id": "idos-roma", "nome": "IDOS — Centro Studi e Ricerche", "lat": 41.8927, "lon": 12.5102, "kind": "ong", "eyebrow": "Centro studi", "sottotitolo": "Roma · via Aurelia", "tipo": "Centro studi su migrazione e statistica sociale", "paese_controllo": "Cooperativa italiana — finanziamenti da Caritas, UE, fondazioni", "anno": "1989", "descrizione": "Pubblica annualmente il Dossier Statistico Immigrazione. Finanziato da Caritas Italiana, UE (FAMI/AMIF), Tavola Valdese (8x1000), CEI. Bilancio pubblico.", "fonti": ["IDOS — Dossier annuale", "Bilancio Caritas Italiana"]}, {"id": "luiss-roma", "nome": "LUISS Guido Carli", "lat": 41.917, "lon": 12.488, "kind": "universita", "eyebrow": "Università privata", "sottotitolo": "Roma · viale Pola", "tipo": "Università privata di Confindustria", "paese_controllo": "Fondazione LUISS (Confindustria) — partnership accademiche internazionali", "anno": "1974 (fondazione)", "descrizione": "Università privata di Confindustria. Numerose partnership accademiche con USA (Georgetown, Harvard Kennedy School), UK, Cina. Programmi specifici finanziati da governi esteri (Aspen Initiative, programmi Fulbright).", "fatti": ["Cattedra MAECI di studi diplomatici", "Programmi Fulbright attivi", "Partnership con Atlantic Council (Washington DC)"], "fonti": ["LUISS — Sito istituzionale (luiss.it)", "Bilancio pubblicato"]}, {"id": "cei-roma", "nome": "CEI — Conferenza Episcopale Italiana (8x1000)", "lat": 41.9038, "lon": 12.4585, "kind": "fondazione_religiosa", "eyebrow": "Istituzione religiosa", "sottotitolo": "Roma · Vaticano", "tipo": "Organismo di coordinamento della Chiesa cattolica italiana", "paese_controllo": "Santa Sede (Stato sovrano)", "anno": "1952 (fondazione)", "descrizione": "La CEI raccoglie e ridistribuisce l'8x1000 destinato dai contribuenti italiani alla Chiesa cattolica (~1 mld € annui). Asset finanziario gestito da un'istituzione formalmente collegata a uno Stato sovrano estero (Vaticano), benché composta da italiani.", "valori": [{"label": "8x1000 alla CEI annuo", "value": "~1 mld €"}], "fatti": ["Sede a Roma ma giurisdizione canonica vaticana", "Bilancio pubblico (Resoconto 8x1000 CEI)", "Stipulazione bilaterale tra Italia e Vaticano via Concordato"], "fonti": ["CEI — Rapporto annuale 8x1000", "Concordato Italia-Vaticano 1929/1984"]}, {"id": "valdese-roma", "nome": "Tavola Valdese (8x1000)", "lat": 41.9013, "lon": 12.4734, "kind": "fondazione_religiosa", "eyebrow": "Istituzione religiosa", "sottotitolo": "Roma · via Firenze", "tipo": "Organismo Chiesa Valdese", "paese_controllo": "Chiesa Evangelica Valdese — comunione con Riformata mondiale (WCRC)", "anno": "Intesa con Stato italiano 1984", "descrizione": "Raccoglie l'8x1000 destinato alle Chiese Valdesi (~50-70 mln € annui). Bilancio pubblico, ridistribuzione su progetti sociali e ONG (anche estere). Rapporti consolidati con World Council of Churches (Ginevra).", "fonti": ["Chiesa Valdese — Rapporto 8x1000 (chiesavaldese.org)", "Intesa Italia-Chiesa Valdese 1984"]}, {"id": "british-council-italia", "nome": "British Council Italy", "lat": 41.9099, "lon": 12.4869, "kind": "ente_estero_culturale", "eyebrow": "Ente culturale estero", "sottotitolo": "Roma + Milano · uffici italiani", "tipo": "Ente culturale ufficiale del Regno Unito", "paese_controllo": "Regno Unito — Foreign, Commonwealth & Development Office (FCDO)", "anno": "1934 (fondazione British Council)", "descrizione": "Ente di soft power culturale del Regno Unito. Promuove la lingua inglese, esami IELTS/Cambridge, programmi accademici. Finanziato dal governo britannico (FCDO). Asset estero ufficialmente in territorio italiano.", "fonti": ["British Council — Annual Report", "FCDO UK — Funding to British Council"]}, {"id": "goethe-roma", "nome": "Goethe-Institut Italia", "lat": 41.9101, "lon": 12.487, "kind": "ente_estero_culturale", "eyebrow": "Ente culturale estero", "sottotitolo": "Roma + Milano · Genova · Napoli · Torino · Trieste", "tipo": "Ente culturale ufficiale della Repubblica Federale di Germania", "paese_controllo": "Germania — Auswärtiges Amt (Ministero Esteri)", "anno": "1951 (fondazione Goethe-Institut, sede tedesca)", "descrizione": "Istituto culturale tedesco. Promuove lingua e cultura tedesca in Italia. Finanziato dal Ministero degli Esteri tedesco. Sedi in 6 città italiane.", "fonti": ["Goethe-Institut — Jahresbericht", "Auswärtiges Amt — Kulturhaushalt"]}, {"id": "institut-francais", "nome": "Institut Français Italia", "lat": 41.9088, "lon": 12.483, "kind": "ente_estero_culturale", "eyebrow": "Ente culturale estero", "sottotitolo": "Roma · piazza Navona / Centro Saint-Louis", "tipo": "Ente culturale ufficiale della Repubblica Francese", "paese_controllo": "Francia — Ministère de l'Europe et des Affaires Étrangères", "anno": "1875 (Institut Français de Florence) · rete italiana espansa nel '900", "descrizione": "Rete di istituti culturali francesi in Italia. Sedi a Roma, Milano, Firenze, Napoli, Palermo. Finanziamento dal MAE francese, attività di soft power culturale.", "fonti": ["Institut Français — Sito istituzionale", "MEAE France — Rapport sur l'action culturelle extérieure"]}, {"id": "instituto-cervantes", "nome": "Instituto Cervantes Italia", "lat": 41.9082, "lon": 12.4796, "kind": "ente_estero_culturale", "eyebrow": "Ente culturale estero", "sottotitolo": "Roma · Milano · Napoli · Palermo", "tipo": "Ente culturale ufficiale della Spagna", "paese_controllo": "Spagna — Ministerio de Asuntos Exteriores", "anno": "1991 (fondazione Cervantes)", "descrizione": "Ente di soft power spagnolo per la promozione di lingua e cultura. Finanziato dal MAE spagnolo. Sedi in 4 città italiane.", "fonti": ["Instituto Cervantes — Memoria anual"]}, {"id": "istituto-confucio-roma", "nome": "Istituti Confucio in Italia", "lat": 41.902, "lon": 12.516, "kind": "ente_estero_culturale", "eyebrow": "Ente culturale estero", "sottotitolo": "12 istituti in Italia · capofila Sapienza (RM), Università Cattolica (MI), Venezia", "tipo": "Centri culturali della Repubblica Popolare Cinese", "paese_controllo": "Repubblica Popolare Cinese — Hanban (oggi CLEC — Center for Language Education and Cooperation)", "anno": "2006 (primo Istituto Confucio italiano, Sapienza)", "descrizione": "Rete di istituti culturali della RPC ospitati da università italiane. Finanziamento misto università italiana + governo cinese (CLEC). Criticati per implicazioni di soft power cinese e questione accademica della libertà di ricerca su Tibet/Xinjiang/Taiwan.", "fatti": ["12 Istituti Confucio in Italia (Roma Sapienza, Milano Cattolica, Venezia Ca' Foscari, Bologna, Padova, Pisa, Napoli, Firenze, Macerata, Torino, Enna, Catania)", "Documenti di partenariato pubblici sui siti universitari", "Discussioni accademiche su autocensura in materia di temi sensibili Cina"], "fonti": ["Università italiane — Convenzioni Istituti Confucio (pubbliche)", "Hanban/CLEC — China"]}, {"id": "open-society-italy", "nome": "Open Society Foundations — attività in Italia", "lat": 41.907, "lon": 12.49, "kind": "fondazione_estera", "eyebrow": "Fondazione estera", "sottotitolo": "USA (sede principale New York) · attività finanziatrice in Italia", "tipo": "Rete di fondazioni di George Soros", "paese_controllo": "Open Society Foundations (USA, fondatore George Soros)", "anno": "1979 (fondazione OSF) · attività in Italia documentata", "descrizione": "Rete di fondazioni statunitensi attive a livello globale. In Italia ha finanziato (database pubblico OSF) ONG, think tank, programmi accademici. Tra i destinatari documentati: ASGI, IAI (in passato), MEDU, Carta di Roma, Cittadinanzattiva, Article 19. Tutte le grants sono pubblicate sul database OSF.", "fatti": ["Database pubblico delle grants su opensocietyfoundations.org/grants", "Volumi annui in Italia: variabili, stimati ordine di alcuni milioni $", "Mission dichiarata: 'open societies, accountable governments'"], "fonti": ["OSF — Grants Database (opensocietyfoundations.org/grants)", "OSF — Annual Reports"]}, {"id": "ned-italy", "nome": "National Endowment for Democracy — attività in Italia", "lat": 41.9082, "lon": 12.481, "kind": "fondazione_estera", "eyebrow": "Fondazione governativa estera", "sottotitolo": "USA (sede Washington DC) · attività in Italia", "tipo": "Fondazione governativa USA per la promozione della democrazia", "paese_controllo": "USA — finanziamento Congresso USA (annual appropriation)", "anno": "1983 (fondazione NED) · attività in Italia limitata ma documentata", "descrizione": "Fondazione USA istituita dal Congresso nel 1983 per finanziare attività pro-democrazia all'estero. Database pubblico delle grants. In Italia operano grants minori (su programmi specifici, ricerca giornalistica indipendente, ONG).", "fatti": ["Bilancio NED ~300 mln $ annui (2024), interamente da Congresso USA", "Grants Italia: numero limitato ma pubblicamente registrate", "Considerata da analisti veicolo di soft power USA"], "fonti": ["NED — Grants Search (ned.org/our-grants)", "US Congress — Annual NED Appropriation"]}, {"id": "gmf-italy", "nome": "German Marshall Fund — Italian programs", "lat": 41.908, "lon": 12.482, "kind": "fondazione_estera", "eyebrow": "Fondazione estera", "sottotitolo": "USA (sede Washington DC) · programmi italiani", "tipo": "Think tank transatlantico finanziato da Germania e USA", "paese_controllo": "USA + Germania (cofinanziamento)", "anno": "1972 (fondazione)", "descrizione": "Fondazione transatlantica nata come dono della Germania agli USA per i 25 anni del Piano Marshall. Pubblica analisi, organizza scambi politici. In Italia finanzia programmi di leadership giovanile (Marshall Memorial Fellowship), ricerche, eventi.", "fonti": ["GMF — Annual Report", "GMF — Funding sources"]}, {"id": "atlantic-council-italy", "nome": "Atlantic Council — collegamenti italiani", "lat": 41.91, "lon": 12.487, "kind": "fondazione_estera", "eyebrow": "Fondazione estera", "sottotitolo": "USA (sede Washington DC) · collegamenti italiani", "tipo": "Think tank atlantista", "paese_controllo": "USA — finanziatori multipli (incluso US State Department, governi alleati, corporate)", "anno": "1961 (fondazione)", "descrizione": "Think tank atlantista USA. Trasparenza finanziatori pubblicata (rivelati: US State Dept, US DoD, NATO, governi alleati, corporate donors fra cui FCA, Eni, Leonardo). Numerose collaborazioni con Aspen Italia, IAI, LUISS.", "fatti": ["Lista finanziatori pubblica (atlanticcouncil.org/funding)", "Tra i finanziatori italiani in passato: Eni, Enel, Leonardo, Intesa Sanpaolo", "Programmi specifici Italia: Mediterranean Initiatives, Future of Europe"], "fonti": ["Atlantic Council — Honor Roll of Contributors", "Atlantic Council — Annual Report"]}, {"id": "ned-rai", "nome": "RAI — Servizio pubblico radiotelevisivo", "lat": 41.9135, "lon": 12.4754, "kind": "media_pubblico", "eyebrow": "Servizio pubblico", "sottotitolo": "Roma · viale Mazzini", "tipo": "Servizio pubblico radiotelevisivo italiano", "paese_controllo": "MEF (Italia) — 100% partecipazione pubblica", "anno": "1954 (canale TV; società 1924)", "descrizione": "Servizio pubblico radiotelevisivo. 100% MEF. Asset strategico in mani pubbliche. Citato qui come riferimento di un asset ancora sotto pieno controllo pubblico italiano nello scenario mediatico.", "fatti": ["100% MEF", "Finanziamento da canone TV + pubblicità", "Indipendenza editoriale formalmente garantita dalla legge"], "fonti": ["RAI — Investor Relations", "MEF — Partecipazioni"]}]};

const PROTECTED_DATA = {
  energetico: DATA_ENERGETICO,
  industriale: DATA_INDUSTRIALE,
  digitale: DATA_DIGITALE,
  racconto: DATA_RACCONTO,
};

// ═══════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return preflight();

    // GET endpoints
    if (method === 'GET') {
      if (path === '/sostenitori-count') return handleSostenitoriCount(env);
      if (path === '/check-access')      return handleCheckAccess(request, env);
      if (path === '/auth')              return handleAuthCallback(request, env, url);
      if (path.startsWith('/api/protected/data/')) {
        const tema = path.replace('/api/protected/data/', '').replace('.json', '');
        return handleProtectedData(request, env, tema);
      }
      return new Response('Neutralia worker v2 OK', { headers: { 'content-type': 'text/plain' } });
    }

    // POST endpoints
    if (method === 'POST') {
      if (path === '/prenota-evento')  return handlePrenotazione(request, env);
      if (path === '/stripe-webhook' || path === '/') return handleStripeWebhook(request, env);
      if (path === '/login-request')   return handleLoginRequest(request, env);
      if (path === '/logout')          return handleLogout();
      return new Response('OK', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  },
};

// ═══════════════════════════════════════════════════════════════════════
// CORS / preflight
// ═══════════════════════════════════════════════════════════════════════
function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}
function preflight() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

// ═══════════════════════════════════════════════════════════════════════
// SOSTENITORI COUNT (per la barra crowdfunding)
// ═══════════════════════════════════════════════════════════════════════
async function handleSostenitoriCount(env) {
  const headers = { ...corsHeaders(), 'content-type': 'application/json', 'cache-control': 'public, max-age=30' };
  if (!env.BREVO_API_KEY || !env.BREVO_SUBSCRIBERS_LIST_ID) {
    return new Response(JSON.stringify({ count: 0, error: 'env_missing' }), { headers });
  }
  try {
    const r = await fetch(`https://api.brevo.com/v3/contacts/lists/${env.BREVO_SUBSCRIBERS_LIST_ID}`, {
      headers: { 'api-key': env.BREVO_API_KEY, 'accept': 'application/json' },
    });
    const data = await r.json();
    const count = data.uniqueSubscribers || data.totalSubscribers || 0;
    return new Response(JSON.stringify({ count }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, error: e.message }), { headers, status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PRENOTAZIONE EVENTO → Brevo
// ═══════════════════════════════════════════════════════════════════════
async function handlePrenotazione(request, env) {
  let data;
  try { data = await request.json(); }
  catch { return new Response('Invalid JSON', { status: 400, headers: corsHeaders() }); }

  const nome = String(data.nome || '').trim();
  const cognome = String(data.cognome || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const partecipanti = parseInt(data.partecipanti, 10) || 1;

  if (!nome || !cognome || !email || !isEmail(email)) {
    return new Response('Dati invalidi', { status: 400, headers: corsHeaders() });
  }

  try {
    await saveToBrevo({
      apiKey: env.BREVO_API_KEY,
      listId: parseInt(env.BREVO_EVENT_LIST_ID, 10),
      email,
      attributes: { NOME: nome, COGNOME: cognome, PARTECIPANTI: partecipanti, DATA_PRENOTAZIONE: new Date().toISOString() },
    });
  } catch (e) {
    return new Response('Errore Brevo', { status: 500, headers: corsHeaders() });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders(), 'content-type': 'application/json' } });
}

// ═══════════════════════════════════════════════════════════════════════
// STRIPE WEBHOOK — gestisce: subscription created → KV + Brevo
//                            subscription deleted → rimuove KV + Brevo
//                            payment one-time → Telegram (opz)
// ═══════════════════════════════════════════════════════════════════════
async function handleStripeWebhook(request, env) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';

  if (env.STRIPE_WEBHOOK_SECRET) {
    const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    if (!valid) return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  const type = event.type;
  const obj = event.data.object;

  // ── Subscription CREATA (via checkout.session.completed mode=subscription)
  if (type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const email = (obj.customer_details?.email || obj.customer_email || '').toLowerCase();
    const name = obj.customer_details?.name || '';
    if (email) {
      // 1) Brevo lista Sostenitori
      try {
        const [nome, ...rest] = name.split(' ');
        await saveToBrevo({
          apiKey: env.BREVO_API_KEY,
          listId: parseInt(env.BREVO_SUBSCRIBERS_LIST_ID, 10),
          email,
          attributes: {
            NOME: nome || '',
            COGNOME: rest.join(' ') || '',
            STRIPE_CUSTOMER_ID: obj.customer || '',
            SUBSCRIPTION_ID: obj.subscription || '',
            DATA_ISCRIZIONE: new Date().toISOString(),
          },
        });
      } catch (e) { console.error('Brevo sub-add failed:', e.message); }
      // 2) KV record attivo
      try {
        await env.NEUTRALIA_KV.put(`sub:${email}`, JSON.stringify({
          active: true,
          customer_id: obj.customer || null,
          subscription_id: obj.subscription || null,
          created_at: new Date().toISOString(),
        }));
      } catch (e) { console.error('KV sub-add failed:', e.message); }
    }
  }

  // ── Subscription CANCELLATA (alla fine del periodo o immediata)
  if (type === 'customer.subscription.deleted' || (type === 'customer.subscription.updated' && obj.status === 'canceled')) {
    // Recupero email del customer
    const email = await fetchCustomerEmail(obj.customer, env).catch(() => null);
    if (email) {
      // 1) Rimuovi da KV
      try { await env.NEUTRALIA_KV.delete(`sub:${email}`); } catch (e) { console.error(e.message); }
      // 2) Rimuovi da Brevo
      try { await removeFromBrevoList({ apiKey: env.BREVO_API_KEY, listId: parseInt(env.BREVO_SUBSCRIBERS_LIST_ID, 10), email }); } catch (e) { console.error(e.message); }
    }
  }

  // ── MAGLIETTA (payment link dedicato) → Telegram con taglia + spedizione
  if (type === 'checkout.session.completed' && obj.mode === 'payment' && obj.payment_link === SHIRT_PAYMENT_LINK && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const amount = (obj.amount_total || 0) / 100;
    const qty = Math.max(1, Math.round((obj.amount_subtotal || 2000) / 2000));
    const taglia = ((obj.custom_fields || []).find((f) => f.key === 'taglia') || {}).dropdown?.value || 'n.d.';
    // Indirizzo di SPEDIZIONE (non fatturazione); campo rinominato nelle API recenti
    const ship = obj.shipping_details || obj.collected_information?.shipping_details || null;
    const shipName = ship?.name || obj.customer_details?.name || '';
    const a = ship?.address || obj.customer_details?.address || null;
    const addr = a ? [a.line1, a.line2, `${a.postal_code || ''} ${a.city || ''}`.trim(), a.state, a.country].filter(Boolean).join(', ') : 'n.d.';
    const email = obj.customer_details?.email || '';
    const msg = `👕 *Maglietta venduta* — taglia *${taglia}*${qty > 1 ? ` × ${qty}` : ''}\n\n💶 ${amount.toFixed(2)} ${(obj.currency || 'eur').toUpperCase()}\n\n👤 ${shipName}\n📦 ${addr}\n📧 ${email}`;
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    }).catch(() => {});
  }

  // ── Payment ONE-TIME (libro/donazione) → Telegram opz.
  if (type === 'checkout.session.completed' && obj.mode === 'payment' && obj.payment_link !== SHIRT_PAYMENT_LINK && env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const amount = (obj.amount_total || 0) / 100;
    const email = obj.customer_details?.email || '';
    const name = obj.customer_details?.name || '';
    const a = obj.customer_details?.address;
    const addr = a ? `${a.line1 || ''}, ${a.postal_code || ''} ${a.city || ''}, ${a.country || ''}` : '';
    const msg = `📚 *Nuovo ordine*\n\n💶 *${amount.toFixed(2)} ${(obj.currency || 'eur').toUpperCase()}*\n\n👤 ${name}\n📧 ${email}\n📍 ${addr}`;
    fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    }).catch(() => {});
  }

  // ── Ordine LIBRO (payment link dedicati) → welcome email al cliente
  //    Discriminata per payment_link (NON per importo: le donazioni Stripe
  //    sono anch'esse mode=payment e un importo qualsiasi non basta).
  if (type === 'checkout.session.completed' && obj.mode === 'payment' && BOOK_PAYMENT_LINKS.includes(obj.payment_link)) {
    await sendBookWelcomeEmail(obj, env).catch((e) => console.error('welcome libro failed:', e.message));
  }

  // ── Rete di sicurezza: indirizzo senza numero civico → richiesta automatica
  if (type === 'checkout.session.completed' && obj.mode === 'payment' &&
      (BOOK_PAYMENT_LINKS.includes(obj.payment_link) || obj.payment_link === SHIRT_PAYMENT_LINK)) {
    await requestCivicoIfMissing(obj, env).catch((e) => console.error('civico-check failed:', e.message));
  }

  return new Response('OK', { status: 200 });
}

// ═══════════════════════════════════════════════════════════════════════
// CIVICO MANCANTE — se la via non contiene alcun numero, chiedi il civico
// via email (idempotente per sessione via KV civico:{id}, TTL 90 giorni).
// Stripe obbliga l'indirizzo ma non può validare la presenza del civico.
// ═══════════════════════════════════════════════════════════════════════
async function requestCivicoIfMissing(session, env) {
  if (!env.BREVO_API_KEY) return;
  const ship = session.shipping_details || session.collected_information?.shipping_details || null;
  const addr = (ship && ship.address) || session.customer_details?.address || null;
  const email = (session.customer_details?.email || '').trim();
  if (!email || !addr) return;
  const street = `${addr.line1 || ''} ${addr.line2 || ''}`;
  if (/\d/.test(street)) return; // c'è un numero: tutto ok

  if (env.NEUTRALIA_KV) {
    const k = `civico:${session.id}`;
    if (await env.NEUTRALIA_KV.get(k)) return;
    await env.NEUTRALIA_KV.put(k, '1', { expirationTtl: 60 * 60 * 24 * 90 });
  }

  const dove = [addr.line1, `${addr.postal_code || ''} ${addr.city || ''}`.trim()].filter(Boolean).join(', ');
  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#fafaf7;color:#1a1a1a;padding:2rem;line-height:1.65">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:2rem;border-radius:6px">
<h2 style="margin-top:0">Il suo ordine Neutralia &egrave; quasi pronto</h2>
<p>Buongiorno,</p>
<p>siamo del team di Neutralia: l'indirizzo che ci ha lasciato (<strong>${dove}</strong>) sembra privo del <strong>numero civico</strong>, e senza non possiamo consegnare.</p>
<p>Ce lo pu&ograve; indicare rispondendo a questa email? La ringraziamo.</p>
<p style="font-style:italic;color:#555">&mdash; Il team di Neutralia</p>
</div></body></html>`;
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Neutralia', email: 'neutralia.info@gmail.com' },
      replyTo: { email: 'neutralia.info@gmail.com' },
      to: [{ email }],
      subject: 'Il suo ordine Neutralia — ci manca il numero civico',
      htmlContent: html,
    }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status}`);
  console.log(`[civico-check] richiesta civico inviata a ${email} (${dove})`);
}

// Payment Link del libro cartaceo Neutralia:
//  - Italia €15 sped. inclusa   (buy.stripe.com/4gM14h0gr05J7F4f1K8IU00)
//  - Internazionale €15 + €10   (buy.stripe.com/3cIbIV1kvg4H3oOdXG8IU07)
const BOOK_PAYMENT_LINKS = [
  'plink_1TZZzB8wqCpL8THJYntW41wN',
  'plink_1TrEnm8wqCpL8THJV4tCAB8O',
];

// Payment Link della maglietta Neutralia (€20 + €6,50 sped. tracciata,
// taglia via custom field "taglia"): buy.stripe.com/6oUfZb0grcSv9NcbPy8IU09
const SHIRT_PAYMENT_LINK = 'plink_1Txvav8wqCpL8THJ6THi9u7M';

// ═══════════════════════════════════════════════════════════════════════
// WELCOME EMAIL ordine libro — template identico a quello della dashboard
// spedizioni locale (spedizioni_dashboard/app.py:send_welcome_email).
// Idempotente via KV welcome:{session.id} (TTL 90 giorni).
// ═══════════════════════════════════════════════════════════════════════
async function sendBookWelcomeEmail(session, env) {
  if (!env.BREVO_API_KEY) { console.error('welcome libro: BREVO_API_KEY mancante'); return; }

  const email = (session.customer_details?.email || session.customer_email || '').trim();
  if (!email) return;

  // Idempotenza: una sola welcome per checkout session
  if (env.NEUTRALIA_KV) {
    const already = await env.NEUTRALIA_KV.get(`welcome:${session.id}`);
    if (already) return;
  }

  // Shipping: API recenti la mettono in collected_information.shipping_details,
  // versioni precedenti in shipping_details top-level. Fallback: billing address.
  const ship = session.shipping_details || session.collected_information?.shipping_details || null;
  const name = (ship?.name || session.customer_details?.name || '').trim();
  const a = ship?.address || session.customer_details?.address || null;
  const addrParts = [];
  if (a?.line1) addrParts.push(a.line1);
  if (a?.line2) addrParts.push(a.line2);
  const capCity = `${a?.postal_code || ''} ${a?.city || ''}`.trim();
  if (capCity) addrParts.push(capCity);
  if (a?.state) addrParts.push(`(${a.state})`);
  if (a?.country) addrParts.push(a.country);
  const addrFormatted = addrParts.join(', ');

  const nameHtml = name ? `<strong>${escapeHtml(name)}</strong>` : `<em style='color:#c84b31'>— nome mancante —</em>`;
  const addrHtml = addrFormatted ? `<strong>${escapeHtml(addrFormatted)}</strong>` : `<em style='color:#c84b31'>— indirizzo mancante —</em>`;

  const html = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;background:#fafaf7;color:#1a1a1a;padding:2rem;line-height:1.65">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:2rem;border-radius:6px">
<h2 style="margin-top:0;color:#0a0a0a">Grazie per l'ordine.</h2>
<p>Grazie per l'ordine del libro <em>Neutralia</em>. Con i tuoi soldi stai sostenendo un progetto di guerriglia culturale per un'Italia neutrale e mediatrice di pace.</p>

<p>Visita <a href="https://neutralia.info" style="color:#0a0a0a"><strong>neutralia.info</strong></a> per rimanere aggiornato sugli sviluppi del progetto.</p>

<hr style="border:none;border-top:1px solid #e0e0d8;margin:1.5rem 0">

<p style="margin-bottom:0.4rem">Il tuo nome è:<br>${nameHtml}</p>
<p style="margin-top:1rem;margin-bottom:0.4rem">L'indirizzo di spedizione per inviare il libro è:<br>${addrHtml}</p>

<hr style="border:none;border-top:1px solid #e0e0d8;margin:1.5rem 0">

<p>Non siamo in tanti, ti chiediamo di pazientare per l'arrivo della copia. Se per qualche motivo noti un errore nell'indirizzo di spedizione o nel tuo nome, <strong>rispondi a questa mail</strong> con il tuo NOME COGNOME e indirizzo completo per la spedizione della copia del libro.</p>

<p style="font-style:italic;color:#555;margin-top:1.5rem">— Neutralia</p>
</div></body></html>`;

  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Neutralia', email: 'neutralia.info@gmail.com' },
      replyTo: { email: 'neutralia.info@gmail.com' },
      to: [{ email }],
      subject: "Grazie per l'ordine — libro Neutralia",
      htmlContent: html,
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Brevo ${r.status}: ${body.slice(0, 200)}`);
  }

  if (env.NEUTRALIA_KV) {
    await env.NEUTRALIA_KV.put(`welcome:${session.id}`, new Date().toISOString(), { expirationTtl: 90 * 86400 });
  }
  console.log(`welcome libro inviata a ${email} (${session.id})`);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchCustomerEmail(customerId, env) {
  if (!customerId || !env.STRIPE_SECRET_KEY) return null;
  const r = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
    headers: { 'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!r.ok) return null;
  const c = await r.json();
  return (c.email || '').toLowerCase();
}

// ═══════════════════════════════════════════════════════════════════════
// LOGIN — magic link
// ═══════════════════════════════════════════════════════════════════════
async function handleLoginRequest(request, env) {
  let data;
  try { data = await request.json(); }
  catch { return jsonResp({ error: 'invalid_json' }, 400); }

  const email = String(data.email || '').trim().toLowerCase();
  if (!isEmail(email)) return jsonResp({ error: 'invalid_email' }, 400);

  // Genera magic token (32 byte random hex)
  const token = bufferToHex(crypto.getRandomValues(new Uint8Array(32)));
  // Salva in KV con TTL 15 min
  await env.NEUTRALIA_KV.put(`tok:${token}`, email, { expirationTtl: 900 });

  // Costruisci link
  const siteUrl = env.SITE_URL || 'https://neutralia.info';
  const magicLink = `${request.headers.get('host') ? 'https://' + request.headers.get('host') : ''}/auth?t=${token}`;
  // Meglio: redirect su sito stesso
  const link = `${siteUrl}/api/auth?t=${token}`;  // viene rewritato sul sito
  // In realtà più semplice: redirect direttamente sul worker
  const workerUrl = new URL(request.url);
  const directLink = `${workerUrl.origin}/auth?t=${token}`;

  // Invia email via Brevo transactional
  try {
    await sendMagicLinkEmail({
      apiKey: env.BREVO_API_KEY,
      to: email,
      link: directLink,
    });
  } catch (e) {
    console.error('Brevo magic-link send failed:', e.message);
    return jsonResp({ error: 'send_failed' }, 500);
  }

  return jsonResp({ ok: true, sent_to: email });
}

async function sendMagicLinkEmail({ apiKey, to, link }) {
  const r = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'accept': 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Neutralia', email: 'noreply@neutralia.info' },
      to: [{ email: to }],
      subject: 'Il tuo link di accesso a Neutralia',
      htmlContent: `<!DOCTYPE html><html><body style="font-family:Georgia,serif;background:#fafaf7;color:#1a1a1a;line-height:1.6;padding:2rem;">
        <div style="max-width:520px;margin:0 auto;background:#fff;padding:2rem;border-radius:6px;">
        <h2 style="margin-top:0">Accesso Neutralia</h2>
        <p>Clicca il bottone qui sotto per accedere agli Osservatori riservati.<br>Il link scade fra <strong>15 minuti</strong> e funziona solo una volta.</p>
        <p style="margin:2rem 0"><a href="${link}" style="display:inline-block;background:#efe847;color:#1a1a1a;padding:0.9rem 1.6rem;text-decoration:none;font-weight:700;border-radius:3px;">→ Accedi adesso</a></p>
        <p style="font-size:0.85rem;color:#888">Se non hai richiesto questo accesso, ignora l'email.</p>
        </div></body></html>`,
    }),
  });
  if (!r.ok && r.status !== 201) {
    const t = await r.text();
    throw new Error(`Brevo SMTP ${r.status}: ${t}`);
  }
}

async function handleAuthCallback(request, env, url) {
  const token = url.searchParams.get('t');
  if (!token) return new Response('Token mancante', { status: 400 });

  const email = await env.NEUTRALIA_KV.get(`tok:${token}`);
  if (!email) return new Response('Token invalido o scaduto', { status: 400 });

  // Verifica se l'utente ha un'attiva sub
  const sub = await env.NEUTRALIA_KV.get(`sub:${email}`);
  if (!sub) {
    return new Response(`Nessuna sottoscrizione attiva per ${email}. <a href="${env.SITE_URL || 'https://neutralia.info'}/osservatori.html">Iscriviti</a>`,
      { status: 403, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  // Token "one-time" use: consuma
  await env.NEUTRALIA_KV.delete(`tok:${token}`);

  // Set cookie HMAC, redirect al sito
  const cookie = await signCookie(email, env.COOKIE_SECRET, 30 * 86400);
  const siteUrl = env.SITE_URL || 'https://neutralia.info';
  return new Response(null, {
    status: 302,
    headers: {
      'Location': `${siteUrl}/osservatorio.html`,
      'Set-Cookie': `neutralia_sub=${cookie}; Path=/; Max-Age=${30 * 86400}; SameSite=Lax; Secure; HttpOnly`,
    },
  });
}

async function handleLogout() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      ...corsHeaders(),
      'content-type': 'application/json',
      'Set-Cookie': `neutralia_sub=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`,
    },
  });
}

async function handleCheckAccess(request, env) {
  const cookieEmail = await readCookieEmail(request, env.COOKIE_SECRET);
  if (!cookieEmail) {
    return jsonResp({ active: false });
  }
  const sub = await env.NEUTRALIA_KV.get(`sub:${cookieEmail}`);
  return jsonResp({ active: !!sub, email: cookieEmail });
}

async function handleProtectedData(request, env, tema) {
  if (!PROTECTED_DATA[tema]) return jsonResp({ error: 'tema_unknown' }, 404);
  const cookieEmail = await readCookieEmail(request, env.COOKIE_SECRET);
  if (!cookieEmail) return jsonResp({ error: 'no_session' }, 401);
  const sub = await env.NEUTRALIA_KV.get(`sub:${cookieEmail}`);
  if (!sub) return jsonResp({ error: 'not_active' }, 403);
  return new Response(JSON.stringify(PROTECTED_DATA[tema]), {
    headers: { ...corsHeaders(), 'content-type': 'application/json', 'cache-control': 'private, max-age=60' },
  });
}

// ═══════════════════════════════════════════════════════════════════════
// COOKIE HMAC sign / verify
// ═══════════════════════════════════════════════════════════════════════
async function signCookie(email, secret, ttlSeconds) {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${email}|${expires}`;
  const sig = await hmacHex(secret, payload);
  return btoa(`${payload}|${sig}`).replace(/=/g, '');
}

async function readCookieEmail(request, secret) {
  const cookieHeader = request.headers.get('cookie') || '';
  const m = cookieHeader.match(/neutralia_sub=([^;]+)/);
  if (!m) return null;
  try {
    const decoded = atob(m[1] + '==='.slice((m[1].length + 3) % 4));
    const parts = decoded.split('|');
    if (parts.length !== 3) return null;
    const [email, expires, sig] = parts;
    if (parseInt(expires, 10) < Math.floor(Date.now() / 1000)) return null;
    const expectedSig = await hmacHex(secret, `${email}|${expires}`);
    if (!constantTimeEqual(sig, expectedSig)) return null;
    return email;
  } catch { return null; }
}

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bufferToHex(new Uint8Array(sig));
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bufferToHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══════════════════════════════════════════════════════════════════════
// Stripe webhook signature verify
// ═══════════════════════════════════════════════════════════════════════
async function verifyStripeSignature(rawBody, sigHeader, secret) {
  if (!sigHeader) return false;
  const parts = Object.fromEntries(sigHeader.split(',').map(s => s.split('=')));
  const t = parts.t, v1 = parts.v1;
  if (!t || !v1) return false;
  const age = Math.floor(Date.now() / 1000) - parseInt(t, 10);
  if (Math.abs(age) > 300) return false;
  const expected = await hmacHex(secret, `${t}.${rawBody}`);
  return constantTimeEqual(expected, v1);
}

// ═══════════════════════════════════════════════════════════════════════
// Brevo: save + remove contact from list
// ═══════════════════════════════════════════════════════════════════════
async function saveToBrevo({ apiKey, listId, email, attributes }) {
  if (!apiKey || !listId) throw new Error('Brevo env mancanti');
  const r = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify({ email, attributes, listIds: [listId], updateEnabled: true }),
  });
  if (!r.ok && r.status !== 204) throw new Error(`Brevo ${r.status}: ${await r.text()}`);
}

async function removeFromBrevoList({ apiKey, listId, email }) {
  if (!apiKey || !listId) throw new Error('Brevo env mancanti');
  await fetch(`https://api.brevo.com/v3/contacts/lists/${listId}/contacts/remove`, {
    method: 'POST',
    headers: { 'api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ emails: [email] }),
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Utility
// ═══════════════════════════════════════════════════════════════════════
function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders(), 'content-type': 'application/json' },
  });
}
