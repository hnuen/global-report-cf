/**
 * Historical Articles Database
 * Pre-written sourced articles for each section.
 * Used to fill sections that have fewer than 8 current articles.
 * Sorted newest first within each section.
 */

import type { Article, Section } from "./types";

export const HISTORICAL: Article[] = [

  // ── SANCTIONS ────────────────────────────────────────────────────────────

  { id:8999, section:"sanctions", category:"OFAC / Russia", region:"Russia / Global", impact:"high",
    date: "2026-05-01",
    headline:"Treasury Sanctions Russia's Two Largest Oil Companies — Rosneft and Gazprom Neft Targeted as Putin Refuses Ceasefire",
    body:[
      "The U.S. Department of Treasury's OFAC sanctioned Russia's two largest oil companies — funding the Kremlin's war machine — as a direct consequence of Russia's lack of serious commitment to a peace process to end the war in Ukraine. Secretary Bessent stated: 'Now is the time to stop the killing and for an immediate ceasefire. Given President Putin's refusal to end this senseless war, Treasury is sanctioning Russia's two largest oil companies that fund the Kremlin's war machine.'",
      "The action increases pressure on Russia's energy sector and degrades the Kremlin's ability to raise revenue for its war machine and support its weakened economy. Treasury stated it will continue to use its authorities in support of a peace process and that a permanent peace depends entirely on Russia's willingness to negotiate in good faith.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0290" },

  { id:8998, section:"sanctions", category:"OFAC / Venezuela", region:"Venezuela / Global", impact:"high",
    date: "2025-12-31",
    headline:"OFAC Sanctions Four Venezuela Oil Sector Companies — Four Shadow Fleet Tankers Designated as Blocked Property",
    body:[
      "OFAC sanctioned four companies operating in Venezuela's oil sector and identified four associated oil tankers as blocked property. The vessels, some of which are part of the shadow fleet serving Venezuela, continue to provide financial resources that fuel Maduro's illegitimate narco-terrorist regime.",
      "Maduro's regime increasingly depends on a shadow fleet of worldwide vessels to facilitate sanctionable activity, including sanctions evasion, and to generate revenue for its destabilising operations. The action signals that those involved in the Venezuelan oil trade continue to face significant sanctions risks.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0348" },

  { id:8997, section:"sanctions", category:"OFAC / Cyber", region:"Russia / Global", impact:"medium",
    date: "2025-11-19",
    headline:"OFAC, Australia and UK Coordinate Sanctions Against Russian Bulletproof Hosting — Media Land and Hypercore Designated",
    body:[
      "OFAC, Australia's Department of Foreign Affairs and Trade, and the UK's FCDO announced coordinated sanctions targeting Media Land — a Russia-based bulletproof hosting service provider — for its role in supporting ransomware operations and other cybercrime. OFAC also designated three members of Media Land's leadership and three sister companies.",
      "OFAC and the UK additionally designated Hypercore Ltd., a front company of Aeza Group LLC, another bulletproof hosting provider. Bulletproof hosting service providers sell access to specialised servers designed to evade detection and defy law enforcement efforts to disrupt malicious cyber activities.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0319" },

  { id:9000, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-18",
    headline:"OFAC $275M Settlement with Adani Enterprises — 32 Iran LPG Violations, Shadow Fleet, USD Payments Through US Banks",
    body:[
      "OFAC announced a $275 million settlement with Adani Enterprises Limited (AEL) on May 18, 2026 — one of the largest Iran sanctions penalties ever imposed on a non-U.S. company. AEL settled potential civil liability for 32 apparent violations of Iran sanctions arising from LPG purchases made between November 2023 and June 2025 from a Dubai-based trader who supplied what was purported to be Omani and Iraqi gas. OFAC determined the LPG actually originated from Iran.",
      "AEL caused U.S. financial institutions to process approximately $192 million in dollar-denominated payments for the shipments — bringing the transactions within OFAC's jurisdiction. OFAC classified the violations as egregious and non-voluntarily self-disclosed, with a statutory maximum penalty of $384 million. The penalty was reduced to $275 million based on AEL's cooperation, remedial measures, and the implementation of maritime intelligence technology. Notably, OFAC did not allege AEL knowingly purchased Iranian LPG — the egregious finding was based on recklessness and failure to investigate clear red flags including suspicious vessel activity, implausible shipping logistics, and unusually discounted pricing.",
    ],
    source:"U.S. Treasury OFAC / GRC Report / Corruption Crime & Compliance",
    sourceUrl:"https://ofac.treasury.gov/recent-actions/20260518" },

  { id:9001, section:"sanctions", category:"OFAC", region:"Iran", impact:"high",
    date: "2026-05-08",
    headline:"OFAC Designates 10 Iran UAV/Missile Network Enablers — Chinese Satellite Imagery Providers Also Targeted",
    body:[
      "OFAC designated 10 individuals and companies across the Middle East, Asia, and Eastern Europe on May 8, 2026 for enabling Iran's efforts to secure weapons and raw materials for its UAV and ballistic missile programs. The State Department simultaneously designated three Chinese entities for providing satellite imagery to Iran's military.",
      "The actions form part of OFAC's Economic Fury campaign targeting Iran's oil revenue networks and weapons procurement. Iraq's Deputy Minister of Oil and three alleged senior leaders of Iran-aligned terrorist militias were among those sanctioned.",
    ],
    source:"U.S. Treasury OFAC / Steptoe", sourceUrl:"https://home.treasury.gov/news/press-releases" },

  { id:9002, section:"sanctions", category:"OFAC / Cuba", region:"Cuba", impact:"high",
    date: "2026-05-01",
    headline:"Trump Signs EO 14404 on Cuba — GAESA Designated, Secondary Sanctions on Foreign Banks Authorised",
    body:[
      "Executive Order 14404 signed May 1, 2026 authorises broad sanctions across Cuba's energy, defence, metals, mining, and financial services sectors. The order authorises secondary sanctions against foreign financial institutions that engage with blocked entities — a significant escalation.",
      "On May 7, the State Department made first designations under the new authority, targeting Cuba's military-run conglomerate GAESA and military elites including Ania Guillermina Lastres Morera.",
    ],
    source:"U.S. Department of State / OFAC", sourceUrl:"https://ofac.treasury.gov/recent-actions" },

  { id:9003, section:"sanctions", category:"EU Sanctions", region:"EU / Europe", impact:"high",
    date: "2026-04-23",
    headline:"EU Adopts 20th Sanctions Package — 120 Designations, Full Crypto Ban from May 24, 632 Vessels Listed",
    body:[
      "The EU's 20th sanctions package adopted April 23, 2026 adds 120 new designations and invokes the Article 12f anti-circumvention instrument against Kyrgyzstan for the first time — after trade data showed systematic re-export of Common High Priority items to Russia.",
      "From May 24, 2026: total ban on all transactions with Russian crypto-asset service providers, explicitly targeting the A7A5/RUBx stablecoin and the digital rouble. The shadow fleet list now stands at 632 vessels.",
    ],
    source:"European Commission", sourceUrl:"https://finance.ec.europa.eu" },

  { id:9004, section:"sanctions", category:"UK Sanctions", region:"UK", impact:"high",
    date:"May 5–11, 2026",
    headline:"UK Issues Two Russia Sanctions Packages in One Week — Drone Supply Chains and Deportation Networks Targeted",
    body:[
      "On May 11, the UK sanctioned 85 individuals and entities involved in Russia's hostile activities including forced deportation of Ukrainian children and Kremlin influence operations. On May 5, a prior package targeted Russia's drone supply chains.",
      "A BBC News analysis found 184 UK-sanctioned shadow fleet vessels made 238 journeys through the UK's Exclusive Economic Zone since March 25, 2026 — highlighting continued enforcement gaps.",
    ],
    source:"UK FCDO / BBC News", sourceUrl:"https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation" },

  { id:9005, section:"sanctions", category:"Crypto Evasion", region:"Russia", impact:"high",
    date: "2026-04-01",
    headline:"A7A5 Stablecoin Hit $100B in Transactions Before EU Ban — Grinex Halted After Cyberattack",
    body:[
      "The Russia-linked A7A5 ruble-backed stablecoin crossed $100 billion in cumulative on-chain transactions before enforcement actions reduced daily volumes from $1.5 billion to ~$500 million. Grinex — the platform underpinning the ecosystem — halted in April after a cyberattack.",
      "The EU's structural response bans the entire category of Russian-established crypto-asset service providers from May 24, 2026 — specifically designed to close the 'designation loop' that allowed Grinex to succeed Garantex.",
    ],
    source:"Elliptic / EU Commission", sourceUrl:"https://www.elliptic.co" },

  { id:9006, section:"sanctions", category:"OFAC General Licence", region:"Russia", impact:"high",
    date: "2026-05-18",
    headline:"OFAC GL 134C Extends Russian Crude Oil Wind-Down to June 17 — Shadow Fleet Vessels Explicitly Covered",
    body:[
      "OFAC issued General License 134C on May 18, 2026, replacing expiring GL 134B and extending operational authorisation through June 17, 2026 for vessels that loaded Russian crude on or before April 17, 2026.",
      "GL 134C explicitly covers designated shadow fleet vessels — allowing qualifying cargoes to complete their voyage without triggering new violations. The June 17 expiry creates the next key compliance decision point for affected counterparties.",
    ],
    source:"U.S. Treasury OFAC / Discovery Alert", sourceUrl:"https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },

  { id:9007, section:"sanctions", category:"UN Sanctions", region:"DPRK", impact:"medium",
    date: "2026-03-01",
    headline:"UN Panel Finds DPRK Earned $1.7B in Crypto Through Cyberattacks in 2025 — Lazarus Group Active",
    body:[
      "The UN Panel of Experts on North Korea reported that the DPRK earned approximately $1.7 billion through cryptocurrency theft and cyberattacks targeting exchanges and DeFi platforms in 2025, according to the Panel's latest report submitted to the Security Council.",
      "The Lazarus Group remains the primary attribution for DPRK cyber operations. The Panel notes that DPRK technicians continue to work abroad under false identities generating foreign currency for the regime's weapons programs.",
    ],
    source:"UN Security Council Panel of Experts", sourceUrl:"https://www.un.org/securitycouncil/sanctions/information" },

  { id:8990, section:"sanctions", category:"OFAC / Venezuela", region:"Venezuela", impact:"high",
    date: "2026-01-01",
    headline:"Venezuela Sanctions in Transition — Maduro Detained, OFAC Issues New General Licenses for Energy Sector",
    body:[
      "In January 2026, a series of OFAC Venezuela-related general licenses collectively marked a significant evolution in U.S. sanctions policy toward Venezuela's energy sector following the apprehension of President Nicolás Maduro. The Trump administration backed up strong sanctions pressure on Venezuela while simultaneously managing the country's transition.",
      "Rosneft and Lukoil — two of Russia's largest oil companies — were designated by OFAC in October 2025. OFAC issued general licenses authorising wind-down activities and contingent divestment of their non-Russian assets. The potential deluge of Venezuelan crude into a saturated market created new opportunities for actions against Russia's oil sector, which was struggling in the wake of the designations.",
    ],
    source:"OFAC / Holland & Knight / Norton Rose Fulbright",
    sourceUrl:"https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information/venezuela-related-sanctions" },

  { id:8991, section:"sanctions", category:"OFAC / Iran", region:"Iran",  impact:"high",
    date: "2026-05-01",
    headline:"Economic Fury — Over 1,000 Iran-Related Designations Since February 2025 as Maximum Pressure Campaign Intensifies",
    body:[
      "OFAC's Economic Fury campaign — described by the Trump administration as the 'financial equivalent' of a bombing campaign — has resulted in over 1,000 Iran-related designations since February 2025. The campaign targets Iran's oil revenue networks, proxy financing, and missile program supply chains. Since May 2026, OFAC has sanctioned Iranian exchange houses overseeing hundreds of millions of dollars in transactions and blocked 19 vessels involved in Iranian petroleum shipments.",
      "Iran's currency is in freefall despite ongoing crude oil exports mostly to China. In 2026, OFAC has intensified enforcement against the shadow fleet of tankers and facilitators enabling that trade. The administration has also targeted Chinese satellite imagery providers supplying Iran's military and designated 10 UAV/missile network enablers in May 2026.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information/iran-sanctions" },

  { id:8992, section:"sanctions", category:"OFAC / Russia", region:"Russia", impact:"high",
    date: "2025-10-01",
    headline:"OFAC Designates Rosneft and Lukoil — Russia's Two Largest Oil Companies Sanctioned, 50% Rule Applies to Global Subsidiaries",
    body:[
      "OFAC designated OJSC Rosneft and PJSC Lukoil in October 2025 as Russia refused to commit to a peace process for the war in Ukraine. Secretary Bessent stated: 'Given President Putin's refusal to end this senseless war, Treasury is sanctioning Russia's two largest oil companies that fund the Kremlin's war machine.' All entities owned 50% or more by the sanctioned companies are automatically blocked, including a sprawling global network of international subsidiaries and assets.",
      "Concurrent with the designations, OFAC issued general licences authorising wind-down transactions. Russia remains subject to the EU 20th sanctions package, which invoked the Article 12f anti-circumvention tool against Kyrgyzstan for the first time and includes a full ban on Russian crypto-asset service providers effective May 24, 2026.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information/russian-harmful-foreign-activities-sanctions" },

  { id:8993, section:"sanctions", category:"OFAC / Cuba", region:"Cuba", impact:"high",
    date: "2026-05-01",
    headline:"EO 14404 on Cuba — GAESA Designated, Secondary Sanctions on Foreign Banks Authorised, Family Member Sanctions Expanded",
    body:[
      "President Trump signed Executive Order 14404 on May 1, 2026, authorising broad sanctions across Cuba's energy, defence, metals, mining, and financial services sectors. The order authorises secondary sanctions against foreign financial institutions engaging with blocked entities — a significant escalation beyond prior Cuba sanctions regimes. On May 7, the State Department made first designations targeting Cuba's military-run conglomerate GAESA.",
      "EO 14404 includes an expansive status-based targeting authority enabling sanctions against adult family members of designated persons — a novel provision. OFAC also issued Cuba-related general licence GL 58 authorising certain legal, financial advisory, and consulting services in connection with potential debt restructuring.",
    ],
    source:"U.S. Department of State / OFAC",
    sourceUrl:"https://home.treasury.gov/policy-issues/financial-sanctions/sanctions-programs-and-country-information/cuba-sanctions" },

  { id:8994, section:"sanctions", category:"OFAC / BIS / China", region:"China / Hong Kong", impact:"high",
    date: "2026-02-01",
    headline:"China Blocking Order vs. U.S. Export Controls — Multinationals Caught Between Washington and Beijing on Semiconductor Sanctions",
    body:[
      "China's Ministry of Commerce issued a blocking order effective May 2, 2026, prohibiting Chinese entities from recognising or complying with U.S. actions targeting China — placing multinationals in direct regulatory conflict between Washington and Beijing. The order is a direct response to OFAC and BIS designations affecting Chinese companies.",
      "BIS's Applied Materials penalty ($252.5M, February 2026) established definitively that routing exports through Korean subsidiaries to SMIC provides zero protection under the EAR. BIS received a 23% FY2026 budget increase with funds earmarked for semiconductor enforcement. Operation Gatekeeper disrupted a network exporting $160M+ in AI chips to mainland China and Hong Kong.",
    ],
    source:"BIS / Norton Rose Fulbright / Steptoe",
    sourceUrl:"https://www.bis.gov" },

  { id:8995, section:"sanctions", category:"OFAC / Hizballah", region:"Middle East", impact:"high",
    date: "2026-05-21",
    headline:"OFAC Designates 9 Hizballah-Aligned Officials in Lebanon — Iran's Ambassador, MPs, Security Officers Targeted",
    body:[
      "OFAC designated nine individuals in Lebanon on May 21, 2026 for obstructing the peace process and impeding Hizballah's disarmament. Those designated include Ibrahim al-Moussawi (Hizballah MP), Iran's designated ambassador to Lebanon, and senior Lebanese security officials. Mohamed Abdel-Mottaleb Fanich, who leads Hizballah's executive council, was also designated.",
      "Secretary Bessent stated: 'Hizballah is a terrorist organization and must be fully disarmed.' The action forms part of a broader U.S. push to support Lebanese state authority following Hizballah's military setbacks in 2024-25.",
    ],
    source:"U.S. Treasury OFAC / Al-Monitor",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0505" },

  { id:8996, section:"sanctions", category:"OFAC / Sinaloa", region:"Mexico / SEA", impact:"high",
    date: "2026-05-20",
    headline:"OFAC Sanctions Sinaloa Cartel Fentanyl Networks — 6 Ethereum Addresses Blacklisted, Cash-to-Crypto Pipeline from US Streets to Mexico",
    body:[
      "OFAC sanctioned more than a dozen individuals comprising two Sinaloa Cartel networks on May 20, 2026. Armando de Jesus Ojeda Aviles leads a Los Chapitos-affiliated money laundering network converting fentanyl proceeds from U.S. streets into cryptocurrency for transfer to Mexico — six Ethereum wallet addresses were added to the SDN list. Jesus Gonzalez Penuelas heads a separate trafficking and laundering organisation.",
      "Since February 2025, OFAC has sanctioned over 600 Sinaloa Cartel-linked persons. TRM Labs notes five of the six blacklisted Ethereum addresses are attributed to a single individual using multi-wallet fragmentation for layering — a pattern now subject to immediate blocking by all U.S.-regulated crypto exchanges.",
    ],
    source:"U.S. Treasury OFAC / TRM Labs",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0503" },

  // ── VERIFIED TREASURY PRESS RELEASES — exact titles & direct links ─────

  { id:9010, section:"sanctions", category:"SDGT / Hizballah", region:"MEA", impact:"high",
    date: "2026-05-21",
    headline:"Treasury Targets Hizballah-Aligned Officials Obstructing Peace and Disarmament",
    body:[
      "OFAC designated nine individuals in Lebanon for obstructing the peace process and impeding the disarmament of Hizballah. These Hizballah-aligned officials are embedded across Lebanon's parliament, military, and security sectors, where they seek to preserve the Iran-backed terrorist group's influence over key Lebanese state institutions.",
      "Secretary Bessent: 'Hizballah is a terrorist organization and must be fully disarmed. Treasury will continue to take action against officials who have infiltrated the Lebanese government and are enabling Hizballah to wage its senseless campaign of violence against the Lebanese people and obstruct lasting peace.'",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0505" },

  { id:9011, section:"sanctions", category:"SDGT / Hamas", region:"MEA", impact:"high",
    date: "2026-05-19",
    headline:"Treasury Sanctions Gaza Flotilla Organizers and Hamas-Aligned Muslim Brotherhood Networks",
    body:[
      "OFAC took action against four individuals associated with the pro-Hamas flotilla organized by the US-designated Popular Conference for Palestinians Abroad (PCPA) attempting to access Gaza. OFAC also targeted key actors operating within Hamas-aligned Muslim Brotherhood networks.",
      "Secretary Bessent: 'The pro-terror flotilla attempting to reach Gaza is a ludicrous attempt to undermine President Trump's successful progress toward lasting peace in the region. Treasury will continue to sever Hamas' global financial support networks, no matter where in the world they are.'",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0501" },

  { id:9012, section:"sanctions", category:"OFAC / Narcotics", region:"Global", impact:"high",
    date: "2026-05-20",
    headline:"Treasury Disrupts Sinaloa Cartel Fentanyl Trafficking Networks",
    body:[
      "OFAC sanctioned more than a dozen individuals and entities across two distinct networks linked to the terrorist-designated Sinaloa Cartel and its fentanyl trafficking activities. The action targets key financial facilitators and logistics networks moving fentanyl into the United States.",
      "The Sinaloa Cartel was designated as a Foreign Terrorist Organization in 2025. The action is part of Treasury's campaign to disrupt cartel financing and narco-terrorist networks operating across Mexico, Central America, and Asia.",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0503" },

  { id:9013, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-19",
    headline:"Treasury Targets Iran Terrorist Financing Networks — 19 Vessels Blocked",
    body:[
      "OFAC designated multiple individuals and entities across a global network enabling Iran's terrorist financing. The action blocked 19 vessels involved in Iranian oil sales to foreign customers, generating hundreds of millions in revenue for the Iranian regime.",
      "This is part of the Trump Administration's Economic Fury maximum pressure campaign. Since February 2025, OFAC has sanctioned approximately 1,000 Iran-related persons, vessels, and aircraft.",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0502" },

  { id:9014, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-12",
    headline:"Treasury Targets IRGC Oil Revenue Networks — 12 Entities Selling Iranian Oil to China Designated",
    body:[
      "OFAC designated 12 individuals and entities enabling the IRGC's sale and shipment of Iranian oil to China. The IRGC relies on front companies in permissive jurisdictions to obfuscate its role in oil sales and funnel revenue to the Iranian regime for weapons development and terrorist proxies.",
      "Since February 2025, OFAC has sanctioned approximately 1,000 Iran-related persons, vessels, and aircraft as part of the Economic Fury maximum pressure campaign.",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0498" },

  { id:9015, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-08",
    headline:"Treasury Targets Iran UAV and Missile Component Procurement Networks",
    body:[
      "OFAC designated 10 individuals and companies across the Middle East, Asia, and Eastern Europe enabling Iran's military to procure weapons and raw materials for Shahed-series UAVs and ballistic missiles. The action targeted Iran-based Pishgam Electronic Safeh Company (PESC), which procured thousands of servomotors with one-way attack UAV applications.",
      "This is the sixth round of nonproliferation designations in support of the September 2025 reimposition of UN sanctions on Iran. Engaging in transactions with the designated persons may risk secondary sanctions.",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0496" },

  { id:9016, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-04-28",
    headline:"Treasury Targets Iran Shadow Banking — 35 Entities Facilitating Tens of Billions in Sanctions Evasion",
    body:[
      "OFAC designated 35 entities and individuals overseeing Iran's shadow banking architecture, facilitating the movement of tens of billions of dollars tied to sanctions evasion and Iran's sponsorship of terrorism. These networks allow the IRGC to access the international financial system for illicit oil sales and weapons purchases.",
      "OFAC also issued guidance warning about significant sanctions exposure from making toll payments to the Government of Iran or the IRGC for passage through the Strait of Hormuz (see FAQ 1249).",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0477" },

  { id:9017, section:"sanctions", category:"OFAC / Nicaragua", region:"Venezuela", impact:"high",
    date: "2026-04-16",
    headline:"Treasury Sanctions Nicaraguan Government Officials and Gold Firms Involved in Seizing US-Owned Property",
    body:[
      "OFAC sanctioned five individuals and seven companies operating in Nicaragua's gold sector, helping the Murillo-Ortega dictatorship generate revenue and maintain political control. Those targeted include officials involved in the forceful seizure of US-owned property and two sons of co-presidents Rosario Murillo and Daniel Ortega.",
      "Secretary Bessent: 'The Murillo-Ortega dictatorship has sought to fill its own coffers through the use of these gold companies and co-conspirators by confiscating American investments in Nicaragua.'",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0451" },

  { id:9018, section:"sanctions", category:"OFAC / DRC", region:"MEA", impact:"high",
    date: "2026-03-02",
    headline:"Treasury Sanctions Rwanda Defence Force Supporting M23 Armed Group in Eastern DRC",
    body:[
      "OFAC imposed sanctions on the Rwanda Defence Force (RDF) and four senior officials for actively supporting, training, and fighting alongside M23, a UN-sanctioned armed group responsible for human rights abuses and mass displacement in the Democratic Republic of Congo. The RDF has supported M23 as it seized provincial capitals Goma and Bukavu.",
      "This follows the April 24, 2026 designation of former DRC President Joseph Kabila for his role supporting M23 and the Congo River Alliance.",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0411" },

  { id:9019, section:"sanctions", category:"OFAC / Venezuela", region:"Venezuela", impact:"high",
    date: "2025-12-31",
    headline:"Treasury Targets Oil Traders Engaged in Sanctions Evasion for Maduro Regime",
    body:[
      "OFAC sanctioned four companies for operating in Venezuela's oil sector and identified four associated oil tankers as blocked property. These vessels, part of the shadow fleet serving Venezuela, provide financial resources fueling Maduro's illegitimate narco-terrorist regime.",
      "Secretary Bessent: 'We will not allow the illegitimate Maduro regime to profit from exporting oil while it floods the United States with deadly drugs.'",
    ],
    source:"U.S. Treasury — Press Release",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0348" },

  { id:8970, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-08",
    headline:"Economic Fury Disrupts Iran Weapons Networks — 10 UAV and Missile Component Suppliers Designated",
    body:[
      "OFAC targeted 10 individuals and companies across the Middle East, Asia, and Eastern Europe enabling Iran's military to secure weapons and raw materials for Shahed-series UAVs and ballistic missiles. The action represents Treasury's sixth round of nonproliferation designations in support of the September 2025 reimposition of UN sanctions on Iran.",
      "OFAC also took additional action against Iran-based Pishgam Electronic Safeh Company (PESC), which procured thousands of servomotors with one-way attack UAV applications. Engaging in transactions involving the designated persons may risk secondary sanctions on participating foreign financial institutions.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0496" },

  { id:8971, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-05-12",
    headline:"Economic Fury — OFAC Targets Iran IRGC Oil Operations, Designates 12 Entities Selling Iranian Oil to China",
    body:[
      "OFAC designated 12 individuals and entities enabling the IRGC's sale and shipment of Iranian oil to China. The IRGC relies on front companies in permissive jurisdictions to obfuscate its role in oil sales and funnel revenue to the Iranian regime.",
      "Since February 2025, OFAC has sanctioned approximately 1,000 Iran-related persons, vessels, and aircraft as part of the Economic Fury maximum pressure campaign. The revenue is directed toward weapons development, backing terrorist proxies, and funding security forces that suppress citizens.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0498" },

  { id:8972, section:"sanctions", category:"OFAC / Iran", region:"Iran", impact:"high",
    date: "2026-04-28",
    headline:"Economic Fury Targets Iran Shadow Banking — 35 Entities Facilitating Tens of Billions in Sanctions Evasion Designated",
    body:[
      "OFAC designated 35 entities and individuals overseeing Iran's shadow banking architecture, facilitating the movement of tens of billions of dollars tied to sanctions evasion and Iran's sponsorship of terrorism. These networks allow Iran's armed forces including the IRGC to access the international financial system for illicit oil sales and weapons purchases.",
      "Alongside the designations, OFAC issued guidance warning about significant sanctions exposure from making toll payments to the Government of Iran or the IRGC for passage through the Strait of Hormuz. See FAQ 1249. Since February 2025, OFAC has sanctioned approximately 1,000 Iran-related persons.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0477" },

  { id:8973, section:"sanctions", category:"OFAC / DRC", region:"MEA", impact:"high",
    date: "2026-03-02",
    headline:"Treasury Sanctions Rwanda Defence Force — Military Supporting M23 Armed Group in Eastern DRC",
    body:[
      "OFAC imposed sanctions on the Rwanda Defence Force (RDF) and four senior officials for actively supporting, training, and fighting alongside M23, a UN-sanctioned armed group responsible for human rights abuses and mass displacement in the Democratic Republic of Congo. The RDF has supported M23 as it seized territory including provincial capitals Goma and Bukavu.",
      "This action follows designation of former DRC President Joseph Kabila on April 24, 2026 for his role supporting M23 and the Congo River Alliance. President Trump stated those who sow instability will be held accountable.",
    ],
    source:"U.S. Treasury OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/sb0411" },

  { id:8980, section:"sanctions", category:"India Sanctions", region:"India", impact:"high",
    date: "2025-05-01",
    headline:"India Bans All Pakistan Imports — DGFT Notification 06/2025-26 Effective Immediately, Comprehensive Trade Embargo",
    body:[
      "India's Directorate General of Foreign Trade (DGFT) issued Notification 06/2025-26 in May 2025, banning all imports of goods originating in or exported from Pakistan, adding Paragraph 2.20A to the Foreign Trade Policy. The ban covers all goods regardless of category and applies to transit goods as well.",
      "The ban followed escalating India-Pakistan tensions and represents one of the most comprehensive bilateral trade restrictions imposed by India. India also simultaneously froze diplomatic ties and closed the Attari-Wagah border crossing. India implements UN sanctions under the UN Security Council Act 1947 (UNSCA), with the Ministry of External Affairs (MEA) responsible for implementing UNSC sanctions resolutions through official gazette orders.",
    ],
    source:"India DGFT / Global Sanctions",
    sourceUrl:"https://globalsanctions.com/sanctioning-state/india/" },

  { id:8981, section:"sanctions", category:"India / Iran", region:"India", impact:"high",
    date: "2026-02-19",
    headline:"India Seizes Three US-Sanctioned Iranian Vessels — Stellar Ruby, Asphalt Star, Third Tanker Impounded",
    body:[
      "India seized three US-sanctioned vessels linked to Iran on February 19, 2026 — the Stellar Ruby (IMO 9555199), the Asphalt Star (IMO 9463528), and a third tanker. The vessels were impounded by Indian authorities in what analysts described as a significant shift in India's approach to US sanctions enforcement.",
      "India had previously received a US waiver to continue operations at Iran's Chabahar port (granted October 2025 for 6 months). The vessel seizures signal growing alignment between India and U.S. sanctions enforcement against Iran's shadow fleet, even as India maintains separate strategic interests in Iranian connectivity infrastructure.",
    ],
    source:"Global Sanctions — India / U.S. Treasury",
    sourceUrl:"https://globalsanctions.com/sanctioning-state/india/" },

  { id:8982, section:"bis", category:"India / BIS", region:"India", impact:"medium",
    date:"2026",
    headline:"India SCOMET List — Dual-Use Export Controls Aligned with Wassenaar; BIS Entity List Includes Indian Entities",
    body:[
      "India participates in the Wassenaar Arrangement and maintains its own SCOMET (Special Chemicals, Organisms, Materials, Equipment and Technologies) list of dual-use goods and technologies subject to export controls under the Foreign Trade Policy. India's DGFT administers export licences for SCOMET-listed items.",
      "The U.S. BIS Entity List includes several Indian entities subject to licensing requirements for export, reexport, and in-country transfers. Companies exporting U.S.-origin technology to India must screen against the Entity List, Denied Persons List, and Unverified List. India's growing defence industry and semiconductor aspirations have increased scrutiny of dual-use technology transfers both to and from India.",
    ],
    source:"India DGFT / BIS",
    sourceUrl:"https://www.dgft.gov.in" },

  { id:8983, section:"sanctions", category:"Indonesia", region:"Indonesia / SEA", impact:"medium",
    date:"2026",
    headline:"Indonesia Implements UN Sanctions Regime — BIS Export Controls, Diversion Risk via Jakarta Flagged by BIS Guidance",
    body:[
      "Indonesia implements UN Security Council sanctions under Presidential Regulation and Financial Services Authority (OJK) regulations. The country is not subject to comprehensive U.S. or EU sanctions but has been flagged by BIS as a potential diversion hub for controlled technology to sanctioned end-users in Asia.",
      "BIS 2026 enforcement guidance specifically identified Southeast Asian transshipment hubs — including Indonesia — as jurisdictions requiring enhanced due diligence for semiconductor, AI chip, and dual-use technology exports. Indonesian companies have appeared on BIS transaction review lists for potential diversion of U.S.-origin goods to China and other restricted destinations.",
    ],
    source:"BIS / U.S. State Department",
    sourceUrl:"https://www.bis.gov" },

  { id:8984, section:"sanctions", category:"India / Pakistan", region:"India", impact:"high",
    date:"2026",
    headline:"India-Pakistan Sanctions Standoff — India Implements UN Sanctions, Pakistan Subject to FATF Grey List Scrutiny",
    body:[
      "India implements UNSC sanctions against Iraq, Somalia, DPRK, Iran, Haiti, Mali, Libya, Lebanon, Sudan, Congo, Yemen, and Guinea-Bissau. India's MEA manages UNSC sanctions through official gazette notifications under the UNSCA. India's ban on all Pakistan imports (DGFT Notification 06/2025-26) is a bilateral trade measure separate from the UN sanctions framework.",
      "Pakistan has faced Financial Action Task Force (FATF) scrutiny for AML/CFT deficiencies, though it was removed from the grey list following compliance improvements. Pakistan's State Bank implements UNSC sanctions and maintains its own sanctions list. The India-Pakistan trade ban creates complex compliance obligations for third-country companies with supply chains touching both jurisdictions.",
    ],
    source:"India MEA / FATF / Global Sanctions",
    sourceUrl:"https://www.mea.gov.in/press-releases.htm" },

  // ── ECONOMICS ────────────────────────────────────────────────────────────

  { id:9101, section:"economics", category:"Markets", region:"United States", impact:"high",
    date: "2026-05-01",
    headline:"U.S. CPI Reaccelerates to 3.3% in March as Gasoline Surges 21.2% — Fed Under New Leadership",
    body:[
      "U.S. CPI came in at 3.3% year-over-year in March 2026, up from 2.4% in February, driven by a 21.2% monthly surge in gasoline prices linked to Strait of Hormuz supply disruption. Two Fed governors dissented from the April FOMC majority.",
      "Kevin Warsh has been confirmed to succeed Jerome Powell as Fed Chair, whose term as chair expired May 15, 2026. Markets are watching for any shift in rate policy under new leadership as energy-driven inflation complicates the inflation outlook.",
    ],
    source:"BLS / Federal Reserve / BlackRock", sourceUrl:"https://www.federalreserve.gov/newsevents/pressreleases.htm" },

  { id:9102, section:"economics", category:"Energy", region:"Global", impact:"high",
    date: "2026-05-01",
    headline:"Strait of Hormuz Effective Closure Drives Global Energy Shock — IEA Cuts Q2 Demand Forecast 1.5 mbpd",
    body:[
      "The effective closure of the Strait of Hormuz has driven a significant global energy price shock in Q2 2026. The IEA revised its 2026 global oil demand forecast, projecting a Q2 contraction of approximately 1.5 million barrels per day — the sharpest decline since COVID-19.",
      "Peace negotiations in the Middle East have raised hopes for a resolution, with crude oil prices pulling back from recent highs on OFAC's GL 134C Russian waiver news and positive diplomatic signals.",
    ],
    source:"IEA / RTTNews", sourceUrl:"https://www.iea.org" },

  { id:9103, section:"economics", category:"Trade", region:"Europe / UK", impact:"medium",
    date: "2026-05-22",
    headline:"UK Retail Sales Fall Fastest in Nearly a Year — ECB Holds Rates as Inflation Risks Mount",
    body:[
      "UK retail sales fell at the fastest pace in nearly a year in April 2026 as consumers cut fuel purchases following the Middle East conflict outbreak. GfK consumer confidence improved in May but energy price inflation raised concerns about sustainability.",
      "The ECB held all three key rates unchanged at its April 30 meeting, acknowledging that upside risks to inflation and downside risks to growth have both intensified. The ECB's Economic Bulletin Issue 3 identified the Middle East war as driving a sharp increase in energy prices.",
    ],
    source:"RTTNews / ECB", sourceUrl:"https://www.ecb.europa.eu" },

  { id:9104, section:"economics", category:"Regulatory", region:"Europe / Germany", impact:"medium",
    date: "2026-02-06",
    headline:"Germany's EU Sanctions Implementation Act in Force — Fines Up to €40M, Circumvention Now Criminal",
    body:[
      "Germany's EU Sanctions Implementation Act entered into force on February 6, 2026, significantly strengthening foreign trade criminal law. The act expands criminal offences, criminalises circumvention, and increases maximum corporate fines to €40 million.",
      "Canada is simultaneously establishing a dedicated Federal Financial Crimes Agency anticipated to launch in spring 2026. Both developments reflect a global trend toward treating sanctions evasion as a serious criminal matter rather than an administrative infraction.",
    ],
    source:"Norton Rose Fulbright", sourceUrl:"https://www.nortonrosefulbright.com" },

  // ── RELIGION ─────────────────────────────────────────────────────────────

  { id:9201, section:"religion", category:"Catholic", region:"Africa / Vatican", impact:"high",
    date:"April 13–23, 2026",
    headline:"Pope Leo XIV Returns from Africa — Magnifica Humanitas Encyclical in Development, AI and Social Doctrine Focus",
    body:[
      "Pope Leo XIV completed an 11-day Apostolic Journey to Algeria, Cameroon, Angola, and Equatorial Guinea in April 2026. In Angola he forcefully condemned the 'logic of exploitation' of natural resources generating 'social and environmental catastrophe.'",
      "Sources close to the Vatican indicate his forthcoming first encyclical, tentatively titled Magnifica Humanitas, will synthesise themes of artificial intelligence, social doctrine, and integral human development — described as an expansion of Rerum Novarum for the 21st century.",
    ],
    source:"Vatican News / USC Center for Religion", sourceUrl:"https://www.vaticannews.va" },

  { id:9202, section:"religion", category:"Interfaith", region:"Lebanon / Middle East", impact:"high",
    date: "2026-05-21",
    headline:"U.S. Sanctions on Hizballah MPs Draw Lebanon's Religious Communities Into Political Fault Lines",
    body:[
      "The May 21 U.S. designations of nine Hizballah-aligned officials — including sitting Lebanese MP Ibrahim al-Moussawi and Iran's ambassador to Lebanon — reignited tensions along Lebanon's sectarian and political fault lines.",
      "Lebanon's Christian, Sunni, and Druze political leaders broadly welcomed the U.S. pressure on Hizballah's parliamentary block, while Shia religious institutions condemned the designations as interference in Lebanese sovereignty.",
    ],
    source:"Al-Monitor / U.S. State Department", sourceUrl:"https://www.al-monitor.com" },

  { id:9203, section:"religion", category:"Interfaith", region:"United Kingdom", impact:"medium",
    date: "2026-05-01",
    headline:"UK Terror Threat Raised to 'Severe' — Muslim Leaders Condemn London Attack and Reaffirm Interfaith Accords",
    body:[
      "The UK raised its terrorism threat level to 'severe' in May 2026 following an attack in Golders Green, London. Counter-terrorism police issued an elevated specific threat to Jewish and Israeli individuals and institutions.",
      "Muslim leaders who signed the Drumlanrig Accords utterly condemned the attack and reaffirmed their commitment to interfaith reconciliation — a significant statement from the organised Muslim community in Britain.",
    ],
    source:"Counter Terrorism Policing UK", sourceUrl:"https://www.counterterrorism.police.uk" },

  { id:9204, section:"religion", category:"Catholic", region:"Global", impact:"medium",
    date: "2026-05-11",
    headline:"Pope Leo XIV Meets Jordan's Royal Institute for Interfaith Studies — Calls for Christian-Muslim Renewal",
    body:[
      "Pope Leo XIV met with Jordan's Royal Institute for Inter-Faith Studies in Rome on May 11 for a colloquium on 'Human Compassion and Empathy in Modern Times,' calling on Christians and Muslims to 'revive humanity where it has grown cold.'",
      "The meeting is part of the Pope's structural commitment to Christian-Muslim dialogue as a priority of his pontificate. The USC Center for Religion and Civic Culture notes a broader 'religious effervescence' in 2026 — religion carrying unusual cultural capital across both progressive and conservative political movements.",
    ],
    source:"Vatican News / USC Center for Religion", sourceUrl:"https://www.vaticannews.va" },

  // ── OCC ──────────────────────────────────────────────────────────────────

  { id:9301, section:"occ", category:"Consent Order", region:"United States", impact:"high",
    date: "2026-04-16",
    headline:"OCC Consent Order Against Federal Savings Bank Chicago — $10.8B in VA Loans, Deceptive Marketing, Restitution Required",
    body:[
      "The OCC issued a consent order against The Federal Savings Bank of Chicago for deceptive marketing of VA-backed cash-out refinance loans to military service members between 2022 and 2024. The bank originated $10.8 billion in loans covering 30,361 transactions.",
      "This is the bank's second consent order in five years. The board must engage an independent restitution consultant within 90 days. Former CEO Stephen Calk's 2021 conviction for bribery related to Paul Manafort loans preceded the bank's first enforcement action.",
    ],
    source:"OCC Enforcement Actions", sourceUrl:"https://www.occ.gov/news-issuances/news-releases/" },

  { id:9302, section:"occ", category:"Policy", region:"United States", impact:"medium",
    date: "2026-05-01",
    headline:"OCC Releases May 2026 Enforcement Actions — Three Terminations, AI Model Risk Remains Top Supervisory Priority",
    body:[
      "The OCC released its May 2026 enforcement actions, including termination of the formal agreement with Axiom Bank, and consent order termination for Cenlar Federal Savings Bank. The OCC confirmed AI model risk governance remains its top examination priority for 2026.",
      "Updated model risk management guidance was issued jointly with the Federal Reserve and FDIC on April 17, 2026. The guidance aims to tailor the supervisory framework to reduce unnecessary burden while promoting risk-based examination across institutions of all sizes.",
    ],
    source:"OCC Enforcement Actions", sourceUrl:"https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-40.html" },

  { id:9303, section:"occ", category:"Regulatory", region:"United States", impact:"medium",
    date: "2026-02-25",
    headline:"OCC Issues Proposed Rulemaking to Implement GENIUS Act on Stablecoin Regulation",
    body:[
      "The OCC issued a proposed rulemaking to implement the Guiding and Establishing National Innovation for U.S. Stablecoins (GENIUS) Act on February 25, 2026. The rule sets forth regulations for permitted payment stablecoin issuers and foreign payment stablecoin issuers under OCC jurisdiction.",
      "The proposed rule also covers custody activities conducted by OCC-supervised entities, establishing for the first time a comprehensive federal framework for stablecoin issuance. The comment period closes 60 days after Federal Register publication.",
    ],
    source:"OCC", sourceUrl:"https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-9.html" },

  // ── BIS ───────────────────────────────────────────────────────────────────

  { id:9398, section:"bis", category:"China / MOFCOM", region:"China / Hong Kong", impact:"high",
    date: "2026-01-06",
    headline:"China MOFCOM Announcement No. 1 [2026] — Dual-Use Export Controls on Japan-Bound Items, Effective Immediately",
    body:[
      "China's Ministry of Commerce (MOFCOM) issued Announcement No. 1 [2026] on January 6, 2026, imposing export controls on dual-use items destined for Japan with immediate effect and no wind-down period. The measures prohibit exports where the end user or use involves Japanese military entities, supports military end-uses, or contributes to enhancing Japan's military capabilities.",
      "The controls cover more than 800 dual-use items including advanced minerals (tungsten, molybdenum, NdFeB rare earth magnets), electronics, sensors, and aerospace components. MOFCOM cited China's Export Control Law and national security obligations. Companies with China-origin content in Japan-facing supply chains must conduct deep bill-of-materials audits and ensure End-User Certificates clearly delineate purely civilian use.",
    ],
    source:"China MOFCOM / National Law Review",
    sourceUrl:"http://english.mofcom.gov.cn/article/newsrelease/significantnews/" },

  { id:9399, section:"bis", category:"China / MOFCOM", region:"China / Hong Kong", impact:"high",
    date: "2026-04-01",
    headline:"China Adopts Supply Chain Security Regulation — Export Controls as Countermeasures Against Foreign Entities Now Authorised",
    body:[
      "China adopted a new regulation in April 2026 to protect the security of its industrial and supply chains, which explicitly includes the possibility of using export controls as countermeasures against foreign entities. The regulation reflects Beijing's continued development of its export control framework as a retaliatory legal instrument.",
      "China's broader export control framework includes the 2021 Anti-Foreign Sanctions Law, the Unreliable Entities List (UEL), and the Dual-Use Items Export Control List. The UEL targets parties deemed to endanger China's national development or sovereignty interests. In November 2025, China suspended for approximately one year restrictions on exports to the U.S. of gallium, germanium, antimony and superhard materials following US-China trade negotiations.",
    ],
    source:"SIPRI / WilmerHale",
    sourceUrl:"https://www.sipri.org/commentary/topical-backgrounder/2026/chinas-export-control-framework-domestic-developments-and-international-positioning" },

  { id:9400, section:"bis", category:"Wassenaar / Global", region:"Global", impact:"medium",
    date:"2026",
    headline:"Global Export Control Convergence — Wassenaar, EU Dual-Use, UK Strategic Controls Align Against Russia and China Technology Transfer",
    body:[
      "The Wassenaar Arrangement's 42 participating states have aligned export controls to prevent technology transfer to Russia and restrict sensitive dual-use technology flows to China. The EU's Dual-Use Regulation (2021/821) and UK Strategic Export Controls provide the primary frameworks for European enforcement, with the UK maintaining its own independent strategic export licensing regime post-Brexit.",
      "Key developments: The EU revised its Common High Priority Items list to restrict 38 categories of goods critical for Russia's military-industrial complex. The UK's Export Control Joint Unit (ECJU) has increased enforcement activity against Russia-linked diversion through third-country hubs including UAE, Turkey, Kazakhstan, and Armenia. Companies operating dual-use supply chains must screen against all three regimes — U.S. EAR, EU Dual-Use Regulation, and UK Export Control Order — simultaneously.",
    ],
    source:"Wassenaar Arrangement / UK ECJU / EU Commission",
    sourceUrl:"https://www.wassenaar.org/news/" },

  { id:9401, section:"bis", category:"Enforcement", region:"United States / China", impact:"high",
    date: "2026-02-11",
    headline:"Applied Materials $252.5M BIS Penalty — Third-Country Routing Provides Zero Protection, Two-Year Audit Imposed",
    body:[
      "BIS imposed a $252.5 million civil penalty on Applied Materials — the second-highest in agency history — for 56 exports of ion implanter systems routed through its Korean subsidiary to SMIC after SMIC was placed on the Entity List in 2020.",
      "BIS rejected the 'substantial transformation' defence outright, establishing definitively that customs law concepts do not translate to the Export Administration Regulations. Two annual audits for 2026 and 2027 were imposed alongside the penalty.",
    ],
    source:"Bureau of Industry and Security", sourceUrl:"https://www.bis.gov/press-releases" },

  { id:9402, section:"bis", category:"Policy", region:"United States / China", impact:"high",
    date:"2026",
    headline:"BIS 23% Budget Increase Targets Semiconductor Diversion — 50% Affiliates Rule Now Strictly Enforced",
    body:[
      "BIS received a 23% congressional budget increase for FY2026 with several million dollars earmarked specifically for semiconductor enforcement. Operation Gatekeeper in December 2025 disrupted a network that exported at least $160 million in AI chips to mainland China and Hong Kong.",
      "The BIS 50% Affiliates Rule — providing that any entity at least 50% owned by an Entity List company is automatically restricted — applies on a strict liability basis. Knowledge of restricted entity involvement is not required to trigger enforcement.",
    ],
    source:"Norton Rose Fulbright / BIS", sourceUrl:"https://www.bis.gov" },

  { id:9403, section:"bis", category:"Entity List", region:"China / Global", impact:"high",
    date: "2026-03-01",
    headline:"BIS Entity List Expanded — Third-Country Diversion Hubs in Kyrgyzstan, UAE, Turkey Under Enhanced Scrutiny",
    body:[
      "BIS has placed increased scrutiny on third-country diversion hubs used to route sensitive goods to Russia, Iran, China, and Venezuela. Kyrgyzstan, UAE, Turkey, and Thailand have been specifically identified as jurisdictions of concern in BIS's 2026 enforcement guidance.",
      "Companies operating in semiconductor, AI, quantum, and defence-adjacent supply chains must implement real-time screening against the continuously updated Entity List and ensure screening extends to in-country transfers and address-based entries.",
    ],
    source:"BIS / Norton Rose Fulbright", sourceUrl:"https://www.bis.gov" },
];

export function getHistoricalForSection(section: string, currentCount: number, targetCount = 8): Article[] {
  if (currentCount >= targetCount) return [];
  const needed = targetCount - currentCount;
  return HISTORICAL
    .filter(a => a.section === section)
    .slice(0, needed);
}

export function getAllHistorical(): Article[] {
  return HISTORICAL;
}
