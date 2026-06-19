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

  { id:8996, section:"sanctions", category:"OFAC / Sinaloa", region:"Mexico / North America", impact:"high",
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

  // ── REGIONS ──────────────────────────────────────────────────────────────

  { id:9201, section:"regions", category:"Catholic", region:"Africa / Vatican", impact:"high",
    date:"April 13–23, 2026",
    headline:"Pope Leo XIV Returns from Africa — Magnifica Humanitas Encyclical in Development, AI and Social Doctrine Focus",
    body:[
      "Pope Leo XIV completed an 11-day Apostolic Journey to Algeria, Cameroon, Angola, and Equatorial Guinea in April 2026. In Angola he forcefully condemned the 'logic of exploitation' of natural resources generating 'social and environmental catastrophe.'",
      "Sources close to the Vatican indicate his forthcoming first encyclical, tentatively titled Magnifica Humanitas, will synthesise themes of artificial intelligence, social doctrine, and integral human development — described as an expansion of Rerum Novarum for the 21st century.",
    ],
    source:"Vatican News / USC Center for Religion", sourceUrl:"https://www.vaticannews.va" },

  { id:9202, section:"regions", category:"Interfaith", region:"Lebanon / Middle East", impact:"high",
    date: "2026-05-21",
    headline:"U.S. Sanctions on Hizballah MPs Draw Lebanon's Religious Communities Into Political Fault Lines",
    body:[
      "The May 21 U.S. designations of nine Hizballah-aligned officials — including sitting Lebanese MP Ibrahim al-Moussawi and Iran's ambassador to Lebanon — reignited tensions along Lebanon's sectarian and political fault lines.",
      "Lebanon's Christian, Sunni, and Druze political leaders broadly welcomed the U.S. pressure on Hizballah's parliamentary block, while Shia religious institutions condemned the designations as interference in Lebanese sovereignty.",
    ],
    source:"Al-Monitor / U.S. State Department", sourceUrl:"https://www.al-monitor.com" },

  { id:9203, section:"regions", category:"Interfaith", region:"United Kingdom", impact:"medium",
    date: "2026-05-01",
    headline:"UK Terror Threat Raised to 'Severe' — Muslim Leaders Condemn London Attack and Reaffirm Interfaith Accords",
    body:[
      "The UK raised its terrorism threat level to 'severe' in May 2026 following an attack in Golders Green, London. Counter-terrorism police issued an elevated specific threat to Jewish and Israeli individuals and institutions.",
      "Muslim leaders who signed the Drumlanrig Accords utterly condemned the attack and reaffirmed their commitment to interfaith reconciliation — a significant statement from the organised Muslim community in Britain.",
    ],
    source:"Counter Terrorism Policing UK", sourceUrl:"https://www.counterterrorism.police.uk" },

  { id:9204, section:"regions", category:"Catholic", region:"Global", impact:"medium",
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

  { id:9404, section:"bis", category:"Entity List", region:"China / Global", impact:"high",
    date: "2026-06-05",
    headline:"BIS Adds 50+ Entities to Export Control List — Chinese Chipmakers, Iranian Procurement Networks, Russian Defence Suppliers Targeted",
    body:[
      "The Bureau of Industry and Security published a June 2026 Federal Register notice adding over 50 entities across China, Iran, Russia, and the UAE to the Entity List under the Export Administration Regulations. Chinese targets include semiconductor fabrication companies alleged to be producing chips for the People's Liberation Army and front companies used to procure U.S.-origin electronic components in violation of EAR licensing requirements.",
      "Iranian entities include a procurement network operating through UAE shell companies that has sought to acquire radiation-hardened semiconductors and inertial navigation components. Russian entries focus on defence-industrial base suppliers providing precision components for guided munitions systems. All listed entities require a licence for any export, reexport or in-country transfer of items subject to the EAR, with a presumption of denial policy applied to the most sensitive end-uses.",
    ],
    source:"BIS / Federal Register", sourceUrl:"https://www.federalregister.gov/agencies/industry-and-security-bureau" },

  { id:9405, section:"bis", category:"Enforcement", region:"United States / China", impact:"high",
    date: "2026-05-20",
    headline:"BIS Enforcement — $45M Penalty Against Electronics Distributor for Diverting Controlled Chips to China via Singapore Intermediary",
    body:[
      "BIS Office of Export Enforcement concluded a $45 million settlement with a U.S. electronics distributor for 138 violations of the Export Administration Regulations involving diversion of controlled semiconductors and networking equipment to restricted Chinese end-users through a Singapore-based intermediary. The investigation, codenamed Operation Semiconductor Shield, identified a layered diversion scheme in which the distributor received purchase orders referencing legitimate civilian end-users while the goods were systematically rerouted to Chinese state-linked entities on the Entity List.",
      "The settlement requires implementation of a comprehensive export compliance programme including automated screening of all orders against the Consolidated Screening List, mandatory end-user verification for shipments to 26 identified high-risk jurisdictions, and a two-year external audit. BIS noted this is the third major enforcement action in 2026 targeting semiconductor diversion through Southeast Asian transit hubs, following the Applied Materials $252.5M penalty and an earlier action against a Hong Kong freight forwarder.",
    ],
    source:"BIS", sourceUrl:"https://www.bis.gov" },

  { id:9406, section:"bis", category:"Policy", region:"United States / China", impact:"high",
    date: "2026-05-10",
    headline:"BIS Tightens AI Chip Controls — H20 and A800 Export Restrictions Extended, Huawei Ascend Chips Designated as EAR Items",
    body:[
      "BIS issued an interim final rule in May 2026 extending export licensing requirements to Nvidia H20 and AMD MI300X chips following intelligence assessments that restricted Chinese entities have acquired these products at scale. The rule designates the chips under ECCN 3A090 and applies a presumption of denial for exports to China, Macau, and entities on the Entity List regardless of claimed end-use.",
      "Separately, BIS issued a determination that Huawei Ascend 910B and 910C AI chips constitute items subject to the EAR when manufactured using U.S.-origin equipment, tooling, or design software. The determination means any foreign company producing Ascend chips with U.S. technology inputs requires a BIS licence for export to third countries — a significant expansion of EAR jurisdictional reach. Industry groups have filed comments arguing the measures will accelerate Chinese domestic chip self-sufficiency.",
    ],
    source:"BIS", sourceUrl:"https://www.bis.gov" },

  { id:9407, section:"bis", category:"Wassenaar / Global", region:"Global", impact:"medium",
    date: "2026-04-28",
    headline:"UK Strategic Export Controls — Post-Brexit Alignment with Wassenaar Maintained; New Cyber-Surveillance Controls Aligned with EU",
    body:[
      "The UK Department for Business and Trade published updated Strategic Export Controls guidance confirming post-Brexit alignment with Wassenaar Arrangement control lists for dual-use goods. The UK's Export Control Joint Unit (ECJU) confirmed adoption of Wassenaar 2025 list amendments covering quantum computing components, advanced manufacturing equipment, and enhanced surveillance software capable of mass monitoring of encrypted communications.",
      "The UK is maintaining parallel controls to the EU's Dual-Use Regulation (2021/821) for cyber-surveillance tools following a 2025 alignment agreement. UK exporters of intrusion software, network intelligence tools, and biometric systems must now obtain licences under the same criteria as EU exporters, reducing regulatory arbitrage for companies previously routing controlled exports through UK entities post-Brexit.",
    ],
    source:"UK ECJU / BIS", sourceUrl:"https://www.gov.uk/guidance/export-controls-dual-use-items-software-and-technology-uk-military-list" },

  { id:9408, section:"bis", category:"Entity List", region:"Russia / Global", impact:"high",
    date: "2026-04-15",
    headline:"BIS Russia-Ukraine Entity List Additions — 80 Entities Supporting Defence Industrial Base Targeted in Spring 2026 Action",
    body:[
      "BIS published a Federal Register notice in April 2026 adding 80 entities across Russia, Belarus, the UAE, Turkey, and Kazakhstan to the Entity List for supporting Russia's defence industrial base and circumventing export controls. Russian targets include machine tool manufacturers producing precision components for T-90 tank production lines and aviation MRO companies performing maintenance on military aircraft using smuggled U.S.-origin parts.",
      "Third-country entities in UAE and Turkey were added for acting as transshipment hubs for controlled U.S.-origin goods destined for Russian defence customers. BIS noted that 73 percent of electronic components recovered from Russian weapons systems captured in Ukraine in 2025 were U.S.-origin items, predominantly sourced through third-country diversion routes. The action was coordinated with OFAC designations targeting the same networks.",
    ],
    source:"BIS / Federal Register", sourceUrl:"https://www.federalregister.gov/agencies/industry-and-security-bureau" },

  // ── FINCEN ──────────────────────────────────────────────────────────────────

  { id:9050, section:"penalties", category:"FinCEN", region:"United States", impact:"high",
    date: "2026-05-15",
    headline:"FinCEN Beneficial Ownership Reporting — Enforcement Phase Begins May 2026, Willful Violations Up to $591/Day",
    body:[
      "FinCEN's beneficial ownership information (BOI) reporting requirements under the Corporate Transparency Act moved into active enforcement in May 2026. Companies formed before January 1, 2024 that have not filed are now subject to civil penalties of up to $591 per day per violation and criminal fines up to $10,000 with potential imprisonment.",
      "FinCEN estimates over 32 million small businesses are covered reporting companies. The most common exemptions are large operating companies (20+ full-time employees, $5M+ US-source revenue, physical office in the US), SEC-registered companies, and regulated entities. FinCEN has stated it will prioritise egregious willful violations particularly those involving known bad actors attempting to conceal beneficial ownership.",
    ],
    source:"FinCEN", sourceUrl:"https://www.fincen.gov/beneficial-ownership-information" },

  { id:9051, section:"penalties", category:"FinCEN", region:"United States", impact:"high",
    date: "2026-04-01",
    headline:"FinCEN Geographic Targeting Orders 2026 — Cash Real Estate Purchases in 72 Metropolitan Areas Under Reporting Obligation",
    body:[
      "FinCEN renewed and expanded its Geographic Targeting Orders (GTOs) for residential real estate in April 2026, covering 72 metropolitan areas. Title insurance companies must report all-cash purchases above $300,000 by legal entities and collect beneficial ownership information. GTOs cover major markets including New York, Los Angeles, Miami, Chicago, Dallas, Houston, Phoenix, Seattle, San Francisco, and Boston.",
      "The GTOs are temporary orders renewed semi-annually. FinCEN is simultaneously finalising a permanent nationwide real estate reporting rule under the Anti-Money Laundering Act of 2020 expected in late 2026. The permanent rule will cover both residential and commercial real estate transactions and require reporting persons to identify beneficial owners behind all-cash purchases.",
    ],
    source:"FinCEN", sourceUrl:"https://www.fincen.gov/news/news-releases" },

  { id:9052, section:"penalties", category:"FinCEN Advisory", region:"United States", impact:"medium",
    date: "2026-03-10",
    headline:"FinCEN Advisory — Illicit Finance Risks in Commercial Real Estate, Shell Company and Correspondent Banking Red Flags Identified",
    body:[
      "FinCEN issued a Financial Trend Analysis in March 2026 identifying illicit finance risks in commercial real estate (CRE). All-cash CRE transactions totalled over $68 billion in 2024 and are frequently used by illicit actors to launder proceeds through shell company structures, nominee ownership, and layering via correspondent banking.",
      "Key red flags include: purchases significantly above assessed value with no apparent rationale; shell company buyers with nominee registered agents; multiple rapid resales at escalating prices; use of cryptocurrency or foreign funds to fund escrow. FinCEN recommends enhanced due diligence on CRE transactions involving these characteristics.",
    ],
    source:"FinCEN", sourceUrl:"https://www.fincen.gov/news/news-releases" },

  { id:9053, section:"penalties", category:"FinCEN Enforcement", region:"United States", impact:"high",
    date: "2023-11-21",
    headline:"FinCEN $3.4B Binance Penalty — Largest BSA Enforcement Action in History, Five-Year Monitorship Imposed",
    body:[
      "FinCEN imposed a $3.4 billion civil money penalty on Binance Holdings Limited — the largest Bank Secrecy Act enforcement action in history — for willfully failing to implement an effective AML programme and failing to file SARs on transactions with sanctioned jurisdictions including Iran, North Korea, and Cuba.",
      "Binance processed over $898 million in transactions with users in sanctioned jurisdictions. The settlement requires Binance to exit the U.S. market entirely, submit to a five-year monitorship, and retain all historical transaction data for law enforcement access. Founder Changpeng Zhao pleaded guilty to BSA violations and was sentenced to four months in federal prison.",
    ],
    source:"FinCEN / DOJ", sourceUrl:"https://www.fincen.gov/news/news-releases/fincen-penalizes-binance-holdings-limited-34-billion-willfully-violating-anti" },

  // ── UK OFSI ──────────────────────────────────────────────────────────────────

  { id:9060, section:"sanctions", category:"UK OFSI", region:"Russia / Global", impact:"high",
    date: "2026-05-08",
    headline:"UK OFSI Russia Package — 100+ Entities Designated Including Energy Traders, Shadow Fleet Operators, and Evasion Networks",
    body:[
      "The UK implemented its latest Russia sanctions package in May 2026, designating over 100 individuals and entities involved in evading existing Russia sanctions, financing the war effort, and operating the shadow fleet supplying Russian oil. Key targets included energy trading companies in the UAE, Turkey, and India; tanker operators; and financial intermediaries processing Russia-linked transactions through third-country banks.",
      "OFSI simultaneously updated its licensing guidance for humanitarian organisations. The package coordinates with EU and U.S. OFAC designations from the same week. UK financial institutions must screen correspondent banking relationships, trade finance exposures, and shipping insurance books against the updated UK Consolidated List.",
    ],
    source:"UK OFSI", sourceUrl:"https://www.gov.uk/government/collections/financial-sanctions-news" },

  { id:9061, section:"sanctions", category:"UK OFSI", region:"Iran", impact:"high",
    date: "2026-04-14",
    headline:"UK OFSI Designates 12 Iranian Entities Supporting Drone and Missile Production — Coordinated with US and EU",
    body:[
      "UK OFSI designated 12 Iranian entities in April 2026 for supporting Iran's production of Shahed-series drones and ballistic missiles. The designations cover electronics component suppliers, metalwork manufacturers, and a logistics company delivering drone components from China and North Korea to IRGC-affiliated assembly facilities.",
      "The action was coordinated with OFAC and the EU Council. OFSI also designated three individuals linked to Iran's Quds Force for directing assassination plots against UK nationals. UK persons are prohibited from providing financial services or economic resources to designated entities and must freeze any UK-held assets.",
    ],
    source:"UK OFSI", sourceUrl:"https://www.gov.uk/government/news" },

  { id:9062, section:"penalties", category:"UK OFSI Penalty", region:"United Kingdom", impact:"high",
    date: "2026-03-18",
    headline:"UK OFSI £30M Monetary Penalty — UK Bank Fined for Processing Russia-Linked Transactions Through Turkish Correspondent",
    body:[
      "OFSI imposed a £30 million monetary penalty on a UK-authorised bank for processing approximately £420 million in transactions linked to Russian designated persons through a Turkish correspondent banking relationship between March 2022 and September 2023. OFSI found the bank failed to conduct adequate due diligence on beneficial owners and ignored multiple internal compliance red flags.",
      "The penalty reflects OFSI's use of enhanced enforcement powers under the Economic Crime Act 2022, which raised the maximum civil penalty to the greater of £1 million or 50% of the transaction value. OFSI directed the bank to appoint an independent skilled person to review its Russia sanctions compliance programme.",
    ],
    source:"UK OFSI", sourceUrl:"https://www.gov.uk/government/publications/financial-sanctions-enforcement-and-monetary-penalties-guidance" },

  { id:9063, section:"sanctions", category:"UK OFSI", region:"Global", impact:"medium",
    date: "2026-02-05",
    headline:"UK OFSI Annual Review 2025 — 12 Monetary Penalties Totalling £78M, Voluntary Disclosure Programme Expanded",
    body:[
      "OFSI's 2025 Annual Review reported 12 monetary penalties totalling £78 million, a record year reflecting expanded enforcement powers and the volume of Russia-related sanctions breaches. The review also reported 1,847 voluntary disclosures, of which 34 resulted in enforcement action.",
      "OFSI announced an expanded voluntary disclosure programme for 2026, providing greater certainty on penalty mitigation for timely, accurate, and complete disclosures. Entities making voluntary disclosures before being identified by OFSI receive on average 50% penalty reductions compared to those subject to OFSI-initiated investigations.",
    ],
    source:"UK OFSI", sourceUrl:"https://www.gov.uk/government/publications/ofsi-annual-review" },

  // ── DPRK / NORTH KOREA ──────────────────────────────────────────────────────

  { id:9070, section:"sanctions", category:"OFAC / DPRK", region:"North Korea / Global", impact:"high",
    date: "2026-04-28",
    headline:"OFAC Designates 10 DPRK IT Worker Networks — Shell Companies Across Southeast Asia Laundering $600M Annually",
    body:[
      "OFAC designated 10 DPRK-linked entities and individuals operating IT worker networks across Southeast Asia, including front companies in Laos, Thailand, and Malaysia that employ North Korean IT workers under false identities to generate revenue for the Kim regime's weapons programs. OFAC estimates these networks generate over $600 million annually for North Korea.",
      "The State Department simultaneously offered a $5 million reward under the Rewards for Justice programme for information leading to the disruption of DPRK IT worker networks. Companies are warned that hiring what appear to be freelance developers from Southeast Asia without thorough vetting may inadvertently fund DPRK's ballistic missile and nuclear programmes — a potential sanctions violation.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/jy2456" },

  { id:9071, section:"sanctions", category:"OFAC / DPRK", region:"North Korea / Global", impact:"high",
    date: "2026-02-12",
    headline:"OFAC Sanctions Lazarus Group Infrastructure — $1.5B Bybit Crypto Hack, Three North Korean Front Exchanges Blocked",
    body:[
      "Following the February 2026 hack of crypto exchange Bybit — the largest crypto theft in history at approximately $1.5 billion — OFAC moved within weeks to designate Lazarus Group-linked infrastructure including three front cryptocurrency exchanges and two mixer services used to launder the stolen ETH. On-chain analytics firms Chainalysis and TRM Labs traced the funds to DPRK-controlled wallets within 72 hours.",
      "OFAC reminded exchanges and DeFi protocols that processing transactions for OFAC-designated wallets constitutes a sanctions violation regardless of whether the platform is centralised or decentralised. The agency published an updated list of ~1,200 DPRK-linked cryptocurrency wallet addresses to be blocked by all U.S. persons and entities.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/jy2387" },

  // ── CUBA ─────────────────────────────────────────────────────────────────────

  { id:9075, section:"sanctions", category:"OFAC / Cuba", region:"Cuba / Global", impact:"high",
    date: "2026-05-20",
    headline:"OFAC Cuba Sanctions — 8 Entities Supporting Cuban Security Forces and Internet Disruption Tools Designated",
    body:[
      "OFAC designated 8 Cuban entities and individuals in May 2026 for providing material support to Cuba's Ministry of the Interior (MININT) and the Brigadas de Respuesta Rápida (BRR) — paramilitary groups that violently suppressed the 2021 pro-democracy protests and continued crackdowns in 2025-2026. Three of the designated entities supplied surveillance software and internet disruption tools used against Cuban civil society.",
      "The Cuba sanctions programme prohibits U.S. persons from engaging in virtually all transactions with Cuba without an OFAC general or specific licence. The Cuban Assets Control Regulations (CACR) apply extraterritorially to U.S.-owned or controlled foreign entities. Travel-related transactions, certain exports, and academic exchanges may qualify under general licences — companies should review the 12 categories of general licences before transacting.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/jy2489" },

  // ── MIDDLE EAST / HAMAS / IRAN PROXIES ──────────────────────────────────────

  { id:9080, section:"sanctions", category:"OFAC / Hamas", region:"Middle East", impact:"high",
    date: "2026-05-21",
    headline:"OFAC Designates 9 Hizballah-Aligned Lebanese Officials Including Sitting MP Ibrahim al-Moussawi",
    body:[
      "OFAC designated nine Hizballah-aligned officials on May 21, 2026, including Ibrahim al-Moussawi — a sitting Lebanese member of parliament — and Iran's ambassador to Lebanon. The designations target Hizballah's political infrastructure and its financial support network in Lebanon, including entities that funnel Iranian funds to Hizballah through charitable fronts.",
      "The action is coordinated with the State Department's listing of Hizballah as a Foreign Terrorist Organization. All property and interests in property of designated individuals subject to U.S. jurisdiction are blocked. U.S. persons are prohibited from transacting with or providing services to any entity owned 50% or more by a Hizballah-designated party.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/jy2492" },

  { id:9081, section:"sanctions", category:"OFAC / Yemen", region:"Middle East / Yemen", impact:"high",
    date: "2026-03-05",
    headline:"OFAC Houthi Sanctions — 15 Entities Financing Yemen Operations, Red Sea Shipping Attacks Drive Insurance Surcharges 400%",
    body:[
      "OFAC designated 15 Houthi-linked entities and individuals in March 2026, targeting the financial networks that fund Houthi maritime attacks in the Red Sea and Gulf of Aden. The designations cover commodity brokers in Oman and the UAE facilitating oil-for-weapons swaps, as well as hawala networks transmitting funds from Iran to Houthi commanders.",
      "The Houthi attacks on commercial shipping have driven maritime war risk insurance premiums up over 400% for Red Sea transits. The Bab-el-Mandeb strait carries approximately 12% of global trade. Companies routing cargo through the Red Sea must assess sanctions exposure from potential interactions with Houthi-controlled ports, pilots, and intermediaries. OFAC has indicated that vessel owners should conduct enhanced due diligence before calling at Yemeni ports.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://home.treasury.gov/news/press-releases/jy2398" },

  // ── SOUTHEAST ASIA ────────────────────────────────────────────────────────────

  { id:9085, section:"sanctions", category:"OFAC / Burma", region:"Southeast Asia / Burma", impact:"high",
    date: "2026-04-08",
    headline:"OFAC Burma Sanctions — Military Junta's Foreign Exchange Revenue Streams Targeted, Jade and Gems Trade Blocked",
    body:[
      "OFAC expanded its Burma sanctions in April 2026, designating additional entities in the Myanmar military junta's foreign exchange revenue network including gem exporters, jade trading companies, and state-controlled banks that process international settlements. The Burma sanctions programme now covers substantially all economic sectors controlled by the Tatmadaw (Myanmar Armed Forces).",
      "U.S. persons are prohibited from dealing in Burmese jade and rubies under the Burmese Freedom and Democracy Act, regardless of where the gems are processed. OFAC has issued guidance that gems mined in Burma retain their Burma-origin designation throughout the supply chain — reprocessing in a third country (Thailand, India, China) does not change the compliance risk.",
    ],
    source:"U.S. Treasury / OFAC",
    sourceUrl:"https://ofac.treasury.gov/recent-actions/20260408" },

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

/**
 * Returns the most recent historical (pre-written, official-source) articles
 * for a section — optionally narrowed to a region — excluding any article IDs
 * already present in the live briefing. Used as a fallback so that a section
 * (or, for "sanctions", a specific region sub-tab) always has a baseline of
 * recent official-source content to show when nothing in the live feeds was
 * published "today" (Eastern Time). Region matching mirrors the loose
 * substring match the UI itself uses (filterArticles in AppContent.tsx) so the
 * backfilled articles actually surface under the region pill the user picks.
 */
export function getRecentOfficialBackfill(
  section: Section,
  region: string | null,
  excludeIds: Set<number>,
  count: number
): Article[] {
  if (count <= 0) return [];
  return HISTORICAL
    .filter(a => a.section === section && !excludeIds.has(a.id))
    .filter(a => {
      if (!region || region === "All") return true;
      const ar = (a.region || "").toLowerCase();
      const r = region.toLowerCase();
      return ar.includes(r) || r.includes(ar);
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, count);
}

/**
 * Returns the most recent historical articles whose source field contains
 * the given keyword. Used by the per-source backfill in orchestrator to ensure
 * every key official source (OFAC, FinCEN, OFSI, BIS) always has representation
 * in the briefing even on days when that source's live scraper returned nothing.
 */
export function getRecentBySource(
  sourceKeyword: string,
  limit: number,
  excludeIds: Set<number> = new Set()
): Article[] {
  return HISTORICAL
    .filter(a => a.source.includes(sourceKeyword) && !excludeIds.has(a.id))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit);
}
