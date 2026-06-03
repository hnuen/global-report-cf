/**
 * OFAC Sanctions Programs Library
 * Source: https://ofac.treasury.gov/sanctions-programs-and-country-information
 * Last verified: May 2026
 *
 * Contains all 37 active programs with:
 * - Executive Orders (EOs)
 * - Active General Licenses (GLs)
 * - Key advisories
 * - Program status notes
 */

export interface SanctionsItem {
  number?: string;      // EOs and GLs
  title: string;
  date?: string;
  url?: string;
  archived?: boolean;   // true = no longer on current OFAC page
  archivedDate?: string;// when it was removed/superseded
  archivedNote?: string;// reason e.g. "Superseded by GL 134C" or "Expired"
  addedDate?: string;   // when first added to library
}

export interface ArchivedItems {
  generalLicenses?: SanctionsItem[];
  executiveOrders?: SanctionsItem[];
  advisories?: SanctionsItem[];
}

export interface SanctionsProgram {
  id: string;
  name: string;
  url: string;
  region: string;
  category: "country" | "thematic";
  lastUpdated: string;
  lastChecked?: string;     // when ⟳ Check for Updates was last run
  status: "active" | "residual";
  executiveOrders: SanctionsItem[];
  generalLicenses: SanctionsItem[];
  keyAdvisories?: SanctionsItem[];
  notes?: string;
  archive?: ArchivedItems; // items removed from OFAC page, kept for reference
}

export const SANCTIONS_PROGRAMS: SanctionsProgram[] = [

  // ── COUNTRY / GEOGRAPHIC PROGRAMS ────────────────────────────────────────

  {
    id: "afghanistan",
    name: "Afghanistan-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/afghanistan-related-sanctions",
    region: "SEA", category: "country", lastUpdated: "Feb 25, 2022", status: "active",
    executiveOrders: [
      { number: "14064", title: "Protecting Certain Property of Da Afghanistan Bank for the Benefit of the People of Afghanistan", date: "February 11, 2022", url: "https://ofac.treasury.gov/media/918781/download?inline" },
      { number: "13268", title: "Termination of Emergency With Respect to the Taliban and Amendment of Executive Order 13224 of September 23, 2001", date: "July 2, 2002", url: "https://ofac.treasury.gov/media/5631/download?inline" },
      { number: "13224", title: "Blocking Property and Prohibiting Transactions With Persons Who Commit, Threaten To Commit, or Support Terrorism", date: "September 24, 2001", url: "https://ofac.treasury.gov/media/5536/download?inline" },
    ],
    generalLicenses: [
      { number: "GL 20", title: "Authorizing Transactions Involving Afghanistan or Governing Institutions in Afghanistan", date: "February 25, 2022", url: "https://ofac.treasury.gov/media/920271/download?inline" },
      { number: "GL 19", title: "Authorizing Certain Transactions in Support of Nongovernmental Organizations' Activities in Afghanistan", date: "December 22, 2021", url: "https://ofac.treasury.gov/media/919086/download?inline" },
      { number: "GL 18", title: "Authorizing Official Activities of Certain International Organizations and Other International Entities", date: "December 22, 2021", url: "https://ofac.treasury.gov/media/919081/download?inline" },
      { number: "GL 17", title: "Authorizing Official Business of the United States Government", date: "December 22, 2021", url: "https://ofac.treasury.gov/media/917126/download?inline" },
      { number: "GL 16", title: "Authorizing Noncommercial, Personal Remittances to Afghanistan", date: "December 10, 2021", url: "https://ofac.treasury.gov/media/915126/download?inline" },
      { number: "GL 15", title: "Transactions Related to the Exportation or Reexportation of Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, or Software Updates in Afghanistan", date: "September 24, 2021", url: "https://ofac.treasury.gov/media/913001/download?inline" },
      { number: "GL 14", title: "Authorizing Humanitarian Activities in Afghanistan", date: "September 24, 2021", url: "https://ofac.treasury.gov/media/935366/download?inline" },
    ],
    keyAdvisories: [
      { title: "Fact Sheet: Provision of Humanitarian Assistance to Afghanistan and Support for the Afghan People", date: "Ongoing", url: "https://ofac.treasury.gov/media/922136/download?inline" },
    ],
  },
  {
    id: "balkans",
    name: "Balkans-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/balkans-related-sanctions",
    region: "EU / Europe", category: "country", lastUpdated: "Nov 20, 2025", status: "active",
    executiveOrders: [
      { number: "13219", title: "Blocking Property of Persons Who Threaten International Stabilization Efforts in the Western Balkans", date: "June 26, 2001", url: "https://ofac.treasury.gov/media/6246/download?inline" },
      { number: "13304", title: "Termination of Emergencies With Respect to Yugoslavia and Modification of EO 13219", date: "May 28, 2003", url: "https://ofac.treasury.gov/media/6176/download?inline" },
    ],
    generalLicenses: [],

        archive: {
      generalLicenses: [
        { number: "GL 2", title: "Authorizing the Wind Down of Transactions Involving Orka Holding AD", archived: true, archivedNote: "Expired March 15, 2024" },
        { number: "GL 4", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on June 18, 2024", archived: true, archivedNote: "Expired August 17, 2024" },
        { number: "GL 5A", title: "Authorizing Certain Transactions Involving Pumps Manufactured or Distributed by Kaldera Company EL PGP d.o.o. or Elpring d.o.o. Laktasi for the Treatment or Distribution of Drinking Water", archived: true, archivedNote: "Archived October 29, 2025" },
      ],
    },
  },

  {
    id: "belarus",
    name: "Belarus Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/belarus-sanctions",
    region: "EU / Europe", category: "country", lastUpdated: "Mar 26, 2026", status: "active",
    executiveOrders: [
      { number: "14038", title: "Blocking Property of Additional Persons Contributing to the Situation in Belarus", date: "August 9, 2021", url: "https://ofac.treasury.gov/media/912361/download?inline" },
      { number: "13405", title: "Blocking Property of Certain Persons Undermining Democratic Processes or Institutions in Belarus", date: "June 16, 2006", url: "https://ofac.treasury.gov/media/9216/download?inline" },
    ],
    generalLicenses: [
      { number: "GL 8", title: "Authorizing Certain Activities to Preserve Potash Operations in Belarus", date: "December 2021" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 2-H", title: "General License with Respect to Entities Blocked Pursuant to Executive Order 13405", archived: true, archivedNote: "Expired June 3, 2021" },
        { number: "GL 8", title: "Authorizing the Wind Down of Transactions Involving Joint Stock Company Byelorussian Steel Works Management Company of Holding Byelorussian Metallurgical Company", archived: true, archivedNote: "Expired October 9, 2023" },
        { number: "GL 9", title: "Authorizing Transactions Related to Civil Aviation Safety or the Wind Down of Transactions Involving Open Joint Stock Company Belavia Belarusian Airlines", archived: true, archivedNote: "Expired September 8, 2023" },
        { number: "GL 10", title: "Authorizing the Wind Down of Transactions Involving Tabak Invest LLC", archived: true, archivedNote: "Expired February 2, 2024" },
        { number: "GL 11", title: "Authorizing Transactions Involving Open Joint Stock Company Belavia Belarusian Airlines", archived: true, archivedNote: "Archived November 4, 2025" },
        { number: "GL 13", title: "Authorizing Transactions Involving Joint Stock Company Belarusian Potash Company, Agrorozkvit LLC, and Belaruskali OAO", archived: true, archivedNote: "Archived March 26, 2026" },
      ],
    },
  },

  {
    id: "burma",
    name: "Burma-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/burma",
    region: "SEA", category: "country", lastUpdated: "Nov 12, 2025", status: "active",
    executiveOrders: [
      { number: "14014", title: "Blocking Property With Respect to the Situation in Burma", date: "February 10, 2021", url: "https://www.federalregister.gov/executive-order/14014" },
    ],
    generalLicenses: [
      { number: "GL 4", title: "Authorizing Certain Transactions Related to the Exportation or Reexportation of Agricultural Commodities, Medicine, and Medical Devices to Burma", date: "February 2021" },
      { number: "GL 5", title: "Authorizing Certain Personal Remittances and NGO Activities in Burma", date: "February 2021" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 4", title: "Authorizing the Wind Down of Transactions Involving Myanmar Economic Corporation Limited and Myanma Economic Holdings Public Company Limited", archived: true, archivedNote: "Expired June 22, 2021" },
        { number: "GL 5", title: "Authorizing the Wind Down of Transactions Involving Myanma Investment and Commercial Bank or Myanma Foreign Trade Bank", archived: true, archivedNote: "Expired August 5, 2023" },
        { number: "GL 6", title: "Authorizing the Wind Down of Transactions Involving Shwe Byain Phyu Group of Companies", archived: true, archivedNote: "Expired March 1, 2024" },
      ],
    },
  },

  {
    id: "car",
    name: "Central African Republic Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/central-african-republic-sanctions",
    region: "MEA", category: "country", lastUpdated: "Dec 8, 2023", status: "active",
    executiveOrders: [
      { number: "13667", title: "Blocking Property of Certain Persons Contributing to the Conflict in the Central African Republic", date: "May 12, 2014", url: "https://ofac.treasury.gov/media/5836/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "cuba",
    name: "Cuba Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/cuba-sanctions",
    region: "Cuba", category: "country", lastUpdated: "May 7, 2026", status: "active",
    executiveOrders: [
      // 2 EOs — sorted newest first
      { number: "14404", title: "Imposing Sanctions on Those Responsible for Repression in Cuba and for Threats to United States National Security and Foreign Policy (new IEEPA-based program, separate from and in addition to CACR)", date: "May 1, 2026", url: "https://ofac.treasury.gov/media/935581/download?inline" },
      { number: "13799", title: "Strengthening the Policy of the United States Toward Cuba (National Security Presidential Memorandum-5 implementation; reinstated Cuba Restricted List)", date: "November 8, 2017", url: "https://ofac.treasury.gov/media/10651/download?inline" },
    ],
    generalLicenses: [
      { number: "GL 1", title: "Transactions Authorized Pursuant to the Cuban Assets Control Regulations — authorizes all transactions prohibited by EO 14404 where already authorized or exempt under the CACR (31 CFR Part 515)", date: "May 7, 2026", url: "https://ofac.treasury.gov/media/931821/download?inline" },
    ],
    notes: "Cuba sanctions operate on two parallel tracks: (1) Cuban Assets Control Regulations (CACR), 31 CFR Part 515 — the comprehensive embargo in place since 1963, statute-based, not an EO; and (2) EO 14404 (May 2026) — new IEEPA-based targeted sanctions program covering energy, defense, metals/mining, financial services, and security sectors. EO 14404 does not replace the CACR; both operate simultaneously.",
  },

  {
    id: "drc",
    name: "Democratic Republic of the Congo-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/democratic-republic-of-the-congo-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Apr 30, 2026", status: "active",
    executiveOrders: [
      { number: "13671", title: "Taking Additional Steps to Address the National Emergency With Respect to the Conflict in the Democratic Republic of the Congo", date: "July 8, 2014", url: "https://ofac.treasury.gov/media/7656/download?inline" },
      { number: "13413", title: "Blocking Property of Certain Persons Contributing to the Conflict in the Democratic Republic of the Congo", date: "October 27, 2006", url: "https://ofac.treasury.gov/media/7651/download?inline" },
    ],
    generalLicenses: [],
    keyAdvisories: [
      { title: "Rwanda Defence Force and DRC M23 Designations", date: "March 2, 2026", url: "https://home.treasury.gov/news/press-releases/sb0411" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 1", title: "Authorizing the Wind Down of Transactions Involving the Rwanda Defence Force", archived: true, archivedNote: "Expired April 1, 2026" },
      ],
    },
  },

  {
    id: "ethiopia",
    name: "Ethiopia-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/ethiopia",
    region: "MEA", category: "country", lastUpdated: "Feb 8, 2022", status: "active",
    executiveOrders: [
      { number: "14046", title: "Imposing Sanctions on Certain Persons With Respect to the Humanitarian and Human Rights Crisis in Ethiopia", date: "September 17, 2021", url: "https://ofac.treasury.gov/media/913011/download?inline" },
    ],
    generalLicenses: [
      { number: "GL 1", title: "Authorizing Humanitarian Activities", date: "2021" },
      { number: "GL 2", title: "Authorizing Official Business of the US Government", date: "2021" },
      { number: "GL 3", title: "Authorizing Official Activities of International Organizations", date: "2021" },
    ],
  },

  {
    id: "hong-kong",
    name: "Hong Kong-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/hong-kong-related-sanctions",
    region: "China / HK", category: "country", lastUpdated: "Mar 31, 2025", status: "active",
    executiveOrders: [
      { number: "13936", title: "The President's Executive Order on Hong Kong Normalization", date: "July 14, 2020", url: "https://ofac.treasury.gov/media/44826/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "iran",
    name: "Iran Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions",
    region: "Iran", category: "country", lastUpdated: "May 8, 2026", status: "active",
    executiveOrders: [
      // 26 EOs — newest first — all media IDs verified from OFAC page
      { number: "13949", title: "Blocking Property of Certain Persons with Respect to the Conventional Arms Activities of Iran", date: "September 21, 2020", url: "https://ofac.treasury.gov/media/48161/download?inline" },
      { number: "13902", title: "Imposing Sanctions With Respect to Additional Sectors of Iran", date: "January 10, 2020", url: "https://ofac.treasury.gov/media/31406/download?inline" },
      { number: "13876", title: "Imposing Sanctions with Respect to Iran", date: "June 24, 2019", url: "https://ofac.treasury.gov/media/16391/download?inline" },
      { number: "13871", title: "Imposing Sanctions with Respect to the Iron, Steel, Aluminum, and Copper Sectors of Iran", date: "May 8, 2019", url: "https://ofac.treasury.gov/media/14146/download?inline" },
      { number: "13846", title: "Reimposing Certain Sanctions With Respect To Iran", date: "August 6, 2018", url: "https://ofac.treasury.gov/media/30181/download?inline" },
      { number: "13608", title: "Prohibiting Certain Transactions With and Suspending Entry Into the United States of Foreign Sanctions Evaders With Respect to Iran and Syria", date: "May 1, 2012", url: "https://ofac.treasury.gov/media/5926/download?inline" },
      { number: "13606", title: "Blocking the Property and Suspending Entry Into the United States of Certain Persons With Respect to Grave Human Rights Abuses by the Governments of Iran and Syria via Information Technology", date: "April 23, 2012", url: "https://ofac.treasury.gov/media/6491/download?inline" },
      { number: "13599", title: "Blocking Property of the Government of Iran and Iranian Financial Institutions", date: "February 6, 2012", url: "https://ofac.treasury.gov/media/5931/download?inline" },
      { number: "13553", title: "Blocking Property of Certain Persons With Respect to Serious Human Rights Abuses By The Government of Iran and Taking Certain Other Actions", date: "September 29, 2010", url: "https://ofac.treasury.gov/media/8076/download?inline" },
      { number: "13059", title: "Prohibiting Certain Transactions With Respect to Iran", date: "August 20, 1997", url: "https://ofac.treasury.gov/media/8071/download?inline" },
      { number: "12959", title: "Prohibiting Certain Transactions With Respect to Iran", date: "May 7, 1995", url: "https://ofac.treasury.gov/media/8066/download?inline" },
      { number: "12957", title: "Prohibiting Certain Transactions With Respect to the Development of Iranian Petroleum Resources", date: "March 16, 1995", url: "https://ofac.treasury.gov/media/8061/download?inline" },
      { number: "12613", title: "Prohibiting Imports From Iran", date: "October 29, 1987", url: "https://ofac.treasury.gov/media/8056/download?inline" },
      { number: "12294", title: "Suspension of Litigation Against Iran", date: "February 26, 1981", url: "https://ofac.treasury.gov/media/8051/download?inline" },
      { number: "12284", title: "Restrictions on the Transfer of Property of the Former Shah of Iran", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8046/download?inline" },
      { number: "12283", title: "Non-Prosecution of Claims of Hostages and for Actions at the United States Embassy and Elsewhere", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8041/download?inline" },
      { number: "12282", title: "Revocation of Prohibitions Against Transactions Involving Iran", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8036/download?inline" },
      { number: "12281", title: "Direction To Transfer Certain Iranian Government Assets", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8031/download?inline" },
      { number: "12280", title: "Direction To Transfer Iranian Government Financial Assets Held By Non-Banking Institutions", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8026/download?inline" },
      { number: "12279", title: "Direction To Transfer Iranian Government Assets Held By Domestic Banks", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8021/download?inline" },
      { number: "12278", title: "Direction To Transfer Iranian Government Assets Overseas", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8016/download?inline" },
      { number: "12277", title: "Direction To Transfer Iranian Government Assets", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8011/download?inline" },
      { number: "12276", title: "Direction Relating to Establishment of Escrow Accounts", date: "January 23, 1981", url: "https://ofac.treasury.gov/media/8006/download?inline" },
      { number: "12211", title: "Prohibiting Certain Transactions With Iran", date: "April 17, 1980", url: "https://ofac.treasury.gov/media/8001/download?inline" },
      { number: "12205", title: "Prohibiting Certain Transactions With Iran", date: "April 17, 1980", url: "https://ofac.treasury.gov/media/6321/download?inline" },
      { number: "12170", title: "Blocking Iranian Government Property", date: "November 14, 1979", url: "https://ofac.treasury.gov/media/6316/download?inline" },
    ],
    generalLicenses: [
      // 11 active GLs — newest first — all media IDs verified from OFAC page
      { number: "GL W",   title: "Authorizing the Wind Down of Transactions Involving Certain Persons Blocked on May 1, 2026", date: "May 1, 2026", url: "https://ofac.treasury.gov/media/935561/download?inline" },
      { number: "GL V",   title: "Authorizing the Wind Down of Transactions Involving Hengli Petrochemical (Dalian) Refinery Co., Ltd.", date: "April 24, 2026", url: "https://ofac.treasury.gov/media/935521/download?inline" },
      { number: "GL T",   title: "Authorizing Limited Safety and Environmental Transactions and the Offloading of Cargo Involving Certain Persons or Vessels Blocked on January 23, 2026", date: "January 23, 2026", url: "https://ofac.treasury.gov/media/934946/download?inline" },
      { number: "GL Q",   title: "Authorizing Limited Safety, Environmental, and Sale Transactions Involving the Blocked Vessel M.V. Tinos I While Located in the United States", date: "May 20, 2025", url: "https://ofac.treasury.gov/media/934291/download?inline" },
      { number: "GL 8A",  title: "Authorizing Certain Humanitarian Trade Transactions Involving the Central Bank of Iran or the National Iranian Oil Company", date: "October 26, 2020", url: "https://ofac.treasury.gov/media/48841/download?inline" },
      { number: "GL L",   title: "Authorizing Certain Transactions Involving Iranian Financial Institutions Blocked Pursuant to Executive Order 13902", date: "October 8, 2020", url: "https://ofac.treasury.gov/media/48626/download?inline" },
      { number: "GL J-1", title: "Authorizing the Reexportation of Certain Civil Aircraft to Iran on Temporary Sojourn and Related Transactions", date: "December 15, 2016", url: "https://ofac.treasury.gov/media/7971/download?inline" },
      { number: "GL G",   title: "Certain Academic Exchanges and the Exportation or Importation of Certain Educational Services Authorized", date: "March 19, 2014", url: "https://ofac.treasury.gov/media/7966/download?inline" },
      { number: "GL F",   title: "Authorizing Certain Services in Support of Professional and Amateur Sports Activities and Exchanges Involving the United States and Iran", date: "September 10, 2023", url: "https://ofac.treasury.gov/media/7961/download?inline" },
      { number: "GL E",   title: "Authorizing Certain Services in Support of Nongovernmental Organizations' Activities in Iran", date: "September 10, 2023", url: "https://ofac.treasury.gov/media/7996/download?inline" },
    ],
    keyAdvisories: [
      // 10 advisories — exact titles, dates and media IDs from OFAC page — newest first
      { title: "OFAC Alert: Sanctions Risks of Iranian Demands for Strait of Hormuz Passage", date: "May 1, 2026", url: "https://ofac.treasury.gov/media/935556/download?inline" },
      { title: "OFAC Alert: Sanctions Risk of Dealing with Teapot Oil Refineries", date: "April 28, 2026", url: "https://ofac.treasury.gov/media/935546/download?inline" },
      { title: "Guidance for Shipping and Maritime Stakeholders on Detecting and Mitigating Iranian Oil Sanctions Evasion", date: "April 16, 2025", url: "https://ofac.treasury.gov/media/934236/download?inline" },
      { title: "Iran Ballistic Missile Procurement Advisory", date: "October 18, 2023", url: "https://ofac.treasury.gov/media/932206/download?inline" },
      { title: "Guidance to Industry on Iran's UAV-Related Activities", date: "June 9, 2023", url: "https://ofac.treasury.gov/media/931876/download?inline" },
      { title: "Financial Channels to Facilitate Humanitarian Trade with Iran and Related Due Diligence and Reporting Expectations", date: "October 25, 2019", url: "https://ofac.treasury.gov/media/31416/download?inline" },
      { title: "Deceptive Practices by Iran with respect to the Civil Aviation Industry", date: "July 23, 2019", url: "https://ofac.treasury.gov/media/16611/download?inline" },
      { title: "Guidance to Address Illicit Shipping and Sanctions Evasion Practices", date: "May 14, 2020", url: "https://ofac.treasury.gov/media/37751/download?inline" },
      { title: "Notice on the Re-imposition of the Sanctions on Iran that had Been Lifted or Waived Under the JCPOA", date: "November 4, 2018", url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/iran-sanctions/re-imposition-of-the-sanctions-on-iran-that-had-been-lifted-or-waived-under-the-jcpoa" },
      { title: "List of Medical Devices Requiring Specific Authorization", date: "February 27, 2014", url: "https://ofac.treasury.gov/media/7791/download?inline" },
    ],
archive: {
      generalLicenses: [
        { number: "GL 2 (unnamed)", title: "Authorizing U.S. persons who are employees or contractors of six international organizations to perform transactions for the conduct of the official business of those organizations in or involving Iran", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL (Personal Comms)", title: "Exportation of certain services and software over the internet", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL (Food)", title: "Authorizing the Exportation or Reexportation of Food Items", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL (Consular)", title: "Related to Consular Funds Transfers and to the Transportation of Human Remains", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL (Medical Parts)", title: "Authorizing the Exportation or Reexportation of Replacement Parts for Certain Medical Devices", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL D-1", title: "General License with Respect to Certain Services, Software, and Hardware Incident to Personal Communications", archived: true, archivedNote: "Superseded by Iran General License D-2" },
        { number: "GL D-2", title: "General License with Respect to Certain Services, Software, and Hardware Incident to Communications", archived: true, archivedNote: "Incorporated into 31 CFR Part 560" },
        { number: "GL I", title: "Authorizing Certain Transactions Related to the Negotiation of, and Entry into, Contingent Contracts for Activities Eligible for Authorization Under the Statement of Licensing Policy for Activities Related to the Export or Re-export to Iran of Commercial Passenger Aircraft and Related Parts and Services", archived: true, archivedNote: "Revoked June 27, 2018" },
        { number: "GL H", title: "Authorizing Certain Transactions relating to Foreign Entities Owned or Controlled by a United States Person", archived: true, archivedNote: "Revoked June 27, 2018" },
        { number: "GL K", title: "Authorizing Maintenance or Wind Down of Transactions Involving Cosco Shipping Tanker (Dalian) Co., Ltd.", archived: true, archivedNote: "Superseded by Iran General License K-1" },
        { number: "GL K-1", title: "Authorizing Maintenance or Wind Down of Transactions Involving Cosco Shipping Tanker (Dalian) Co., Ltd.", archived: true, archivedNote: "Revoked February 4, 2020" },
        { number: "GL M-2", title: "Authorizing the Exportation of Certain Graduate Level Educational Services and Software", archived: true, archivedNote: "Expired September 1, 2023" },
        { number: "GL N", title: "Authorizing Certain Activities to Respond to the Coronavirus Disease 2019 (COVID-19) Pandemic", archived: true, archivedNote: "Superseded by General License N-1" },
        { number: "GL N-1", title: "Authorizing Certain Activities to Respond to the Coronavirus Disease 2019 (COVID-19) Pandemic", archived: true, archivedNote: "Superseded by General License N-2" },
        { number: "GL N-2", title: "Authorizing Certain Activities to Respond to the Coronavirus Disease 2019 (COVID-19)", archived: true, archivedNote: "Expired June 14, 2024" },
        { number: "GL O", title: "Authorizing Wind-Down and Limited Safety and Environmental Transactions Involving Certain Vessels", archived: true, archivedNote: "Expired June 30, 2023" },
        { number: "GL P", title: "Authorizing the Wind Down of Transactions Involving Navyan Abr Arvan Private Limited Company or Arvancloud Global Technologies L.L.C.", archived: true, archivedNote: "Expired July 6, 2023" },
        { number: "GL R", title: "Authorizing Limited Safety and Environmental Transactions and the Offloading of Cargo Involving Certain Persons or Vessels Blocked on July 30, 2025", archived: true, archivedNote: "Expired September 28, 2025" },
        { number: "GL S", title: "Authorizing Limited Safety and Environmental Transactions and the Offloading of Cargo Involving Certain Persons or Vessels Blocked on December 18, 2025", archived: true, archivedNote: "Expired January 18, 2026" },
        { number: "GL U", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Iranian-Origin Loaded on Vessels as of March 20, 2026", archived: true, archivedNote: "Expired April 19, 2026" },
        { number: "GL V", title: "Authorizing the Wind Down of Transactions Involving Hengli Petrochemical (Dalian) Refinery Co., Ltd.", archived: true, archivedNote: "Expired May 24, 2026" },
      ],
    },
  },
  {
    id: "iraq",
    name: "Iraq-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/iraq-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Jul 9, 2025", status: "active",
    executiveOrders: [
      { number: "13303", title: "Protecting the Development Fund for Iraq and Certain Other Property in Which Iraq Has an Interest", date: "May 22, 2003", url: "https://ofac.treasury.gov/media/7391/download?inline" },
      { number: "13315", title: "Blocking Property of the Former Iraqi Regime, Its Senior Officials and Their Family Members", date: "August 28, 2003", url: "https://ofac.treasury.gov/media/7386/download?inline" },
      { number: "13350", title: "Termination of Emergency Declared in EO 12722 and EO 12724 with Respect to Iraq", date: "July 30, 2004", url: "https://ofac.treasury.gov/media/7406/download?inline" },
      { number: "13364", title: "Modifying the Protection Afforded to the Development Fund for Iraq", date: "November 29, 2004", url: "https://ofac.treasury.gov/media/7381/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "lebanon",
    name: "Lebanon-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/lebanon-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Feb 27, 2026", status: "active",
    executiveOrders: [
      { number: "13441", title: "Blocking Property of Persons Undermining the Sovereignty of Lebanon or Its Democratic Processes and Institutions", date: "August 1, 2007", url: "https://ofac.treasury.gov/media/6376/download?inline" },
    ],
    generalLicenses: [],
    keyAdvisories: [
      { title: "Treasury Targets Hizballah-Aligned Officials Obstructing Peace and Disarmament", date: "May 21, 2026", url: "https://home.treasury.gov/news/press-releases/sb0505" },
    ],
  },

  {
    id: "libya",
    name: "Libya Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/libya-sanctions",
    region: "MEA", category: "country", lastUpdated: "Sep 3, 2025", status: "active",
    executiveOrders: [
      { number: "13726", title: "Blocking Property and Suspending Entry Into the United States of Persons Contributing to the Situation in Libya", date: "April 19, 2016", url: "https://ofac.treasury.gov/media/5501/download?inline" },
      { number: "13566", title: "Blocking Property and Prohibiting Certain Transactions Related to Libya", date: "February 25, 2011", url: "https://ofac.treasury.gov/media/5846/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "mali",
    name: "Mali-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/mali-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Aug 4, 2023", status: "active",
    executiveOrders: [
      { number: "13882", title: "Blocking Property and Suspending Entry of Certain Persons Contributing to the Situation in Mali", date: "July 26, 2019", url: "https://ofac.treasury.gov/media/16616/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "nicaragua",
    name: "Nicaragua-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/nicaragua-related-sanctions",
    region: "Global", category: "country", lastUpdated: "Apr 16, 2026", status: "active",
    executiveOrders: [
      { number: "13851", title: "Taking Additional Steps to Address the National Emergency With Respect to Nicaragua", date: "November 27, 2018", url: "https://ofac.treasury.gov/media/6931/download?inline" },
      { number: "13779", title: "Taking Additional Steps With Respect to the National Emergency With Respect to the Situation in Venezuela (applied to Nicaragua)", date: "2019", url: "https://www.federalregister.gov/executive-order/13779" },
    ],
    generalLicenses: [],
    keyAdvisories: [
      { title: "Treasury Sanctions Nicaraguan Officials and Gold Firms — US Property Seizures", date: "April 16, 2026", url: "https://home.treasury.gov/news/press-releases/sb0451" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 1a", title: "Official Business of the United States Government", archived: true, archivedNote: "Incorporated into 31 CFR Part 582" },
        { number: "GL 2a", title: "Authorizing the Wind Down of Transactions Involving the Nicaraguan National Police", archived: true, archivedNote: "Expired May 6, 2020" },
        { number: "GL 5", title: "Authorizing the Wind Down of Transactions Involving Exportadora de Metales Sociedad Anonima", archived: true, archivedNote: "Expired May 16, 2026" },
      ],
    },
  },

  {
    id: "dprk",
    name: "North Korea Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/north-korea-sanctions",
    region: "DPRK", category: "country", lastUpdated: "Mar 12, 2026", status: "active",
    executiveOrders: [
      { number: "13466", title: "Continuing Certain Restrictions With Respect to North Korea", date: "June 26, 2008", url: "https://ofac.treasury.gov/media/7691/download?inline" },
      { number: "13551", title: "Blocking Property of Certain Persons With Respect to North Korea", date: "August 30, 2010", url: "https://ofac.treasury.gov/media/6036/download?inline" },
      { number: "13570", title: "Prohibiting Certain Transactions With Respect to North Korea", date: "April 18, 2011", url: "https://ofac.treasury.gov/media/5841/download?inline" },
      { number: "13687", title: "Imposing Additional Sanctions With Respect to North Korea", date: "January 2, 2015", url: "https://ofac.treasury.gov/media/7671/download?inline" },
      { number: "13722", title: "Blocking Property of the Government of North Korea and the Workers' Party of Korea", date: "March 16, 2016", url: "https://ofac.treasury.gov/media/7686/download?inline" },
      { number: "13810", title: "Imposing Additional Sanctions With Respect to North Korea (Comprehensive)", date: "September 21, 2017", url: "https://ofac.treasury.gov/media/7676/download?inline" },
    ],
    generalLicenses: [
      // All DPRK general licenses are codified in 31 CFR Part 510 (North Korea Sanctions Regulations)
      // There are no standalone GL PDFs — authorizations are embedded in the regulations
      { number: "31 CFR Part 510", title: "North Korea Sanctions Regulations — all valid general licenses are included in this regulation (see §§ 510.505–510.554)", date: "Ongoing", url: "https://www.ecfr.gov/current/title-31/subtitle-B/chapter-V/part-510" },
    ],
    notes: "All DPRK general licenses are incorporated directly into 31 CFR Part 510. OFAC does not issue standalone GL PDFs for North Korea — consult the regulations for all authorized activities.",
    keyAdvisories: [
      { title: "DPRK IT Workers Advisory — Illicit Revenue Generation", date: "May 16, 2022", url: "https://ofac.treasury.gov/media/923126/download?inline" },
      { title: "North Korea Ballistic Missile Procurement Advisory", date: "September 1, 2020", url: "https://ofac.treasury.gov/media/47751/download?inline" },
    ],
  },

  {
    id: "russia-hfa",
    name: "Russian Harmful Foreign Activities Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/russian-harmful-foreign-activities-sanctions",
    region: "Russia", category: "country", lastUpdated: "April 29, 2026", status: "active",
    executiveOrders: [
      { number: "14114", title: "Taking Additional Steps With Respect to the Russian Federation's Harmful Activities — amends EO 14024 to add secondary sanctions on foreign financial institutions supporting Russia's military-industrial base", date: "December 22, 2023", url: "https://ofac.treasury.gov/media/932441/download?inline" },
      { number: "14071", title: "Prohibiting New Investment in and Certain Services to the Russian Federation — accounting, management consulting, quantum computing, IT services", date: "April 6, 2022", url: "https://ofac.treasury.gov/media/922081/download?inline" },
      { number: "14068", title: "Prohibiting Certain Imports, Exports, and New Investments With Respect to Continued Russian Efforts — diamonds, seafood, gold, additional energy", date: "March 11, 2022", url: "https://ofac.treasury.gov/media/919281/download?inline" },
      { number: "14066", title: "Prohibiting Certain Imports and New Investments With Respect to Continued Efforts by Russia — energy imports, new investment in energy sector", date: "March 11, 2022", url: "https://ofac.treasury.gov/media/919111/download?inline" },
      { number: "14039", title: "Blocking Property With Respect to Certain Russian Energy Export Pipelines — Nord Stream 2", date: "August 20, 2021", url: "https://ofac.treasury.gov/media/912496/download?inline" },
      { number: "14024", title: "Blocking Property With Respect to Specified Harmful Foreign Activities of the Government of the Russian Federation — primary authority for the Russia HFA program", date: "April 15, 2021", url: "https://ofac.treasury.gov/media/57936/download?inline" },
    ],
    generalLicenses: [
      // 42 GLs — sorted newest first per OFAC selected-general-licenses-issued-ofac page
      { number: "GL 134C", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of April 17, 2026", date: "May 18, 2026", url: "https://ofac.treasury.gov/media/935641/download?inline" },
      { number: "GL 131E", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", date: "April 29, 2026", url: "https://ofac.treasury.gov/media/935791/download?inline" },
      { number: "GL 130A", title: "Authorizing Transactions Involving Certain Lukoil Entities in Bulgaria", date: "April 14, 2026", url: "https://ofac.treasury.gov/media/935501/download?inline" },
      { number: "GL 128C", title: "Authorizing Certain Transactions Involving Lukoil Retail Service Stations Located Outside of Russia", date: "April 14, 2026", url: "https://ofac.treasury.gov/media/935496/download?inline" },
      { number: "GL 13Q", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under EO 14024 — Central Bank, National Wealth Fund, Ministry of Finance", date: "April 8, 2026", url: "https://ofac.treasury.gov/media/935451/download?inline" },
      { number: "GL 129A", title: "Authorizing Transactions Involving Rosneft Deutschland GmbH and RN Refining & Marketing GmbH", date: "March 5, 2026", url: "https://ofac.treasury.gov/media/935096/download?inline" },
      { number: "GL 132", title: "Authorizing Certain Transactions Involving Paks II Civil Nuclear Power Plant — Hungary", date: "November 21, 2025", url: "https://ofac.treasury.gov/media/934776/download?inline" },
      { number: "GL 124B", title: "Authorizing Petroleum Services and Other Transactions Related to the Caspian Pipeline Consortium, Tengizchevroil, and Karachaganak Projects Involving Rosneft or Lukoil", date: "November 14, 2025", url: "https://ofac.treasury.gov/media/934746/download?inline" },
      { number: "GL 8K", title: "Authorizing Transactions Related to Energy", date: "October 30, 2024", url: "https://ofac.treasury.gov/recent-actions/20241030" },
      { number: "GL 25G", title: "Authorizing Transactions Related to Telecommunications and Certain Internet-Based Communications", date: "October 30, 2024", url: "https://ofac.treasury.gov/media/933536/download?inline" },
      { number: "GL 111", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Certain Entities Blocked on October 30, 2024", date: "October 30, 2024", url: "https://ofac.treasury.gov/recent-actions/20241030" },
      { number: "GL 110", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on October 30, 2024", date: "October 30, 2024", url: "https://ofac.treasury.gov/recent-actions/20241030" },
      { number: "GL 53A", title: "Authorizing Transactions for Diplomatic Missions of the Russian Federation Involving Gazprombank or Prohibited by Directive 4 under EO 14024", date: "November 21, 2024", url: "https://ofac.treasury.gov/media/933626/download?inline" },
      { number: "GL 4A", title: "Authorizing Certain Overflight Payments and Emergency Landings Involving the Russian Federation", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 9A", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Certain Russian Financial Institutions", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 10C", title: "Authorizing Certain Transactions Involving the Central Bank of the Russian Federation, the National Wealth Fund of the Russian Federation, or the Ministry of Finance of the Russian Federation", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 11", title: "Authorizing Transactions Related to Dealings in Certain Debt or Equity of, or Derivative Contracts Involving, Certain Sanctioned Russian Entities", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 12B", title: "Authorizing Certain Transactions Involving the Russian Federation Government Related to Loans, Credit, or Debt", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 14", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 3 under EO 14024", date: "Ongoing", url: "https://ofac.treasury.gov/media/935366/download?inline" },
      { number: "GL 15A", title: "Authorizing Certain Aircraft Safety Inspections and Transactions for Safety of Flight", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 16", title: "Authorizing Certain Transactions Related to Derivative Contracts", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 17A", title: "Authorizing Transactions Related to the Provision of Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, and Software Updates and the Prevention of Significant Food Insecurity", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 18", title: "Authorizing Certain Transactions in Support of Nongovernmental Organizations' Activities", date: "Ongoing", url: "https://ofac.treasury.gov/media/919081/download?inline" },
      { number: "GL 19", title: "Authorizing Certain Personal Transactions", date: "Ongoing", url: "https://ofac.treasury.gov/media/919086/download?inline" },
      { number: "GL 20", title: "Authorizing Transactions Related to Certain Financing for and Payments to Non-Sanctioned Persons", date: "Ongoing", url: "https://ofac.treasury.gov/media/920271/download?inline" },
      { number: "GL 21A", title: "Authorizing Certain Transactions with the United Nations", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 22", title: "Authorizing Certain Activities Related to Patents, Trademarks, Copyrights, and Other Intellectual Property", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 23", title: "Authorizing Transactions Incident to Exportation or Reexportation of Agricultural Commodities, Medicine, Medical Devices, and Items to Prevent the Spread of Disease", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 24", title: "Authorizing Certain Transactions Involving Blocked Funds Held in U.S. Financial Institutions and Payment of Legal Fees and Costs", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 26", title: "Authorizing Certain Transactions Involving Funds Transfers", date: "March 24, 2022", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 27", title: "Authorizing Certain Transactions Related to Derivatives", date: "Ongoing", url: "https://ofac.treasury.gov/media/922211/download?inline" },
      { number: "GL 28", title: "Authorizing Wind-Down Transactions Involving Sberbank CIB USA, Inc.", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 29", title: "Authorizing the Purchase of Certain Debt", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 30", title: "Authorizing Transactions Prohibited by Directive 3 under EO 14024 Related to Debt or Equity of, or Derivative Contracts Involving, Certain Russian State-Owned Enterprises", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 38A", title: "Authorizing Wind-Down Transactions Involving Certain Entities and the Rejection of Transactions Involving Certain Other Entities", date: "Ongoing", url: "https://ofac.treasury.gov/media/925321/download?inline" },
      { number: "GL 40A", title: "Authorizing Certain Administrative Transactions Involving VTB Capital PLC", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 42", title: "Authorizing Certain Transactions with the Federal Security Service", date: "June 28, 2022", url: "https://ofac.treasury.gov/media/923976/download?inline" },
      { number: "GL 43A", title: "Authorizing Transactions Related to Divestiture of Equity of, or Debt Issued by, Certain Entities", date: "Ongoing", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "GL 44", title: "Authorizing the Export or Reexport of Certain Accounting Services to U.S. Individuals Located in the Russian Federation", date: "July 14, 2022", url: "https://ofac.treasury.gov/media/924336/download?inline" },
      { number: "GL 46", title: "Authorizing Transactions in Support of an Auction Process to Settle Certain Credit Derivative Transactions Prohibited by EO 14071", date: "July 22, 2022", url: "https://ofac.treasury.gov/media/924546/download?inline" },
      { number: "GL 50", title: "Authorizing the Closing of Individual Accounts at Financial Institutions Blocked Pursuant to EO 14024", date: "August 19, 2022", url: "https://ofac.treasury.gov/media/925326/download?inline" },
      { number: "GL 52", title: "Authorizing Journalistic Activities and Establishment of News Bureaus in Russia", date: "September 15, 2022", url: "https://ofac.treasury.gov/media/926581/download?inline" },
    ],
    keyAdvisories: [
      { title: "OFAC Alert: Sanctions Risk for Foreign Financial Institutions that Join Russian Financial Messaging System (SPFS)", date: "November 21, 2024", url: "https://ofac.treasury.gov/media/933656/download?inline" },
      { title: "Advisory for the Maritime Oil Industry and Related Sectors — Price Cap Compliance (Updated)", date: "October 21, 2024", url: "https://ofac.treasury.gov/media/933506/download?inline" },
      { title: "Russian Attempts to Evade Sanctions Using New Overseas Branches and Subsidiaries Alert", date: "September 4, 2024", url: "https://ofac.treasury.gov/media/933256/download?inline" },
      { title: "REPO Act Reporting Instructions — Rebuilding Economic Prosperity and Opportunity for Ukrainians Act", date: "July 23, 2024", url: "https://ofac.treasury.gov/media/933071/download?inline" },
      { title: "Updated Guidance for Foreign Financial Institutions on OFAC Sanctions Authorities Targeting Support to Russia's Military-Industrial Base", date: "June 12, 2024", url: "https://ofac.treasury.gov/media/932436/download?inline" },
      { title: "Price Cap Coalition Compliance and Enforcement Alert", date: "February 1, 2024", url: "https://ofac.treasury.gov/media/932571/download?inline" },
      { title: "OFAC Guidance on Implementation of the Price Cap Policy for Crude Oil and Petroleum Products (Updated)", date: "December 20, 2023", url: "https://ofac.treasury.gov/media/932986/download?inline" },
      { title: "Humanitarian Assistance and Food Security Fact Sheet: UK and U.S. Sanctions Interconnection with Russia", date: "June 28, 2023", url: "https://ofac.treasury.gov/media/931951/download?inline" },
      { title: "Africa Gold Advisory — Targeting Russia's Use of Gold to Evade Sanctions", date: "June 27, 2023", url: "https://ofac.treasury.gov/media/931946/download?inline" },
      { title: "Cracking Down on Third-Party Intermediaries Used to Evade Russia-Related Sanctions and Export Controls", date: "March 2, 2023", url: "https://ofac.treasury.gov/media/931201/download?inline" },
      { title: "OFAC-BIS Alert: Impact of Sanctions and Export Controls on Russia's Military-Industrial Complex", date: "October 14, 2022", url: "https://ofac.treasury.gov/media/930036/download?inline" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 1A", title: "Authorizing Certain Activities Involving Federal State Budgetary Institution Marine Rescue Service", archived: true, archivedNote: "Superseded by General License 1B" },
        { number: "GL 6C", title: "Transactions Related to Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, or Software Updates, the COVID-19 Pandemic, or Clinical Trials", archived: true, archivedNote: "Superseded by General License 6D" },
        { number: "GL 8E", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8F" },
        { number: "GL 8F", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8G" },
        { number: "GL 8G", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8H" },
        { number: "GL 8H", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8I" },
        { number: "GL 8I", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8J" },
        { number: "GL 8J", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8K" },
        { number: "GL 8K", title: "Authorizing Transactions Related to Energy", archived: true, archivedNote: "Superseded by General License 8L" },
        { number: "GL 8L", title: "Authorizing the Wind Down of Transactions Related to Energy", archived: true, archivedNote: "Expired March 12, 2025" },
        { number: "GL 13D", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13E" },
        { number: "GL 13E", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13F" },
        { number: "GL 13F", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13G" },
        { number: "GL 13G", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13H" },
        { number: "GL 13H", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13I" },
        { number: "GL 13I", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13J" },
        { number: "GL 13J", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13K" },
        { number: "GL 13K", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13L" },
        { number: "GL 13L", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13M" },
        { number: "GL 13M", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13N" },
        { number: "GL 13N", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13O" },
        { number: "GL 13O", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13P" },
        { number: "GL 13P", title: "Authorizing Certain Administrative Transactions Prohibited by Directive 4 under Executive Order 14024", archived: true, archivedNote: "Superseded by General License 13Q" },
        { number: "GL 15", title: "Authorizing Transactions Involving Certain Blocked Entities Owned by Alisher Burhanovich Usmanov", archived: true, archivedNote: "Revoked April 12, 2023" },
        { number: "GL 25C", title: "Authorizing Transactions Related to Telecommunications and Certain Internet-Based Communications", archived: true, archivedNote: "Superseded by General License 25D" },
        { number: "GL 25D", title: "Authorizing Transactions Related to Telecommunications and Certain Internet-Based Communications", archived: true, archivedNote: "Superseded by General License 25E" },
        { number: "GL 25E", title: "Authorizing Transactions Related to Telecommunications and Certain Internet-Based Communications", archived: true, archivedNote: "Superseded by General License 25F" },
        { number: "GL 25F", title: "Authorizing Transactions Related to Telecommunications and Certain Internet-Based Communications", archived: true, archivedNote: "Superseded by General License 25G" },
        { number: "GL 55C", title: "Authorizing Certain Services Related to Sakhalin-2", archived: true, archivedNote: "Superseded by General License 55D" },
        { number: "GL 55D", title: "Authorizing Certain Services Related to Sakhalin-2", archived: true, archivedNote: "Superseded by General License 55E" },
        { number: "GL 58", title: "Authorizing the Wind Down and Rejection of Transactions Involving Public Joint Stock Company Rosbank", archived: true, archivedNote: "Expired March 15, 2023" },
        { number: "GL 59", title: "Authorizing Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Public Joint Stock Company Rosbank", archived: true, archivedNote: "Expired March 15, 2023" },
        { number: "GL 62", title: "Authorizing the Wind Down of Transactions Involving Holdingovaya Kompaniya Metalloinvest AO, MegaFon PAO, Limited Liability Company USM Telecom, or Akkermann Cement Ca Limited Liability Company", archived: true, archivedNote: "Expired July 11, 2023" },
        { number: "GL 63", title: "Authorizing Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Holdingovaya Kompaniya Metalloinvest AO", archived: true, archivedNote: "Expired July 11, 2023" },
        { number: "GL 66", title: "Authorizing the Wind Down of Transactions Involving Public Joint Stock Company Polyus", archived: true, archivedNote: "Expired August 17, 2023" },
        { number: "GL 67", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Public Joint Stock Company Polyus", archived: true, archivedNote: "Expired August 17, 2023" },
        { number: "GL 68", title: "Authorizing the Wind Down of Transactions Involving Certain Universities and Institutes", archived: true, archivedNote: "Expired July 17, 2023" },
        { number: "GL 69", title: "Authorizing Certain Debt Securities Servicing Transactions Involving International Investment Bank", archived: true, archivedNote: "Expired June 30, 2023" },
        { number: "GL 70", title: "Authorizing the Wind Down of Transactions Involving Joint Stock Company Ural Mining and Metallurgical Company", archived: true, archivedNote: "Expired October 18, 2023" },
        { number: "GL 71", title: "Authorizing the Wind Down and Rejection of Transactions Involving Certain Entities Blocked on July 20, 2023", archived: true, archivedNote: "Expired October 18, 2023" },
        { number: "GL 72", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on September 14, 2023", archived: true, archivedNote: "Expired December 13, 2023" },
        { number: "GL 76", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on November 2, 2023", archived: true, archivedNote: "Superseded by General License 76A" },
        { number: "GL 77", title: "Authorizing Limited Safety and Environmental Transactions Involving Certain Persons or Vessels", archived: true, archivedNote: "Expired February 14, 2024" },
        { number: "GL 83", title: "Authorizing Certain Transactions Related to Imports of Certain Categories of Fish, Seafood, and Preparations Thereof Prohibited by Executive Order 14068", archived: true, archivedNote: "Superseded by General License 83A" },
        { number: "GL 93", title: "Authorizing Transactions Involving Certain Sovcomflot Vessels", archived: true, archivedNote: "Revoked January 10, 2025" },
        { number: "GL 99", title: "Authorizing the Wind Down of Transactions and Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, MOEX, NCC, or NSD", archived: true, archivedNote: "Superseded by General License 99A" },
        { number: "GL 100", title: "Authorizing Certain Transactions Related to Debt or Equity or the Conversion of Currencies Involving MOEX, NCC, or NSD", archived: true, archivedNote: "Superseded by General License 100A" },
        { number: "GL 101", title: "Authorizing Civil Aviation Safety and Wind Down Transactions Involving Certain Entities Blocked on August 9, 2024", archived: true, archivedNote: "Expired September 10, 2024" },
        { number: "GL 104", title: "Authorizing Transactions Related to Imports of Certain Diamonds Prohibited by Executive Order 14068", archived: true, archivedNote: "Superseded by General License 104A" },
        { number: "GL 115", title: "Authorizing Transactions Involving Gazprombank Related to Civil Nuclear Energy", archived: true, archivedNote: "Superseded by General License 115A" },
        { number: "GL 115A", title: "Authorizing Transactions Involving Gazprombank Related to Civil Nuclear Energy", archived: true, archivedNote: "Superseded by General License 115B" },
        { number: "GL 115B", title: "Authorizing Certain Transactions Related to Civil Nuclear Energy", archived: true, archivedNote: "Superseded by General License 115C" },
        { number: "GL 118", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Gazprom Neft, Surgutneftegas, and Certain Additional Entities Blocked on January 10, 2025", archived: true, archivedNote: "Expired February 27, 2025" },
        { number: "GL 120", title: "Authorizing Limited Safety and Environmental Transactions and the Unloading of Cargo Involving Certain Persons or Vessels Blocked on January 10, 2025", archived: true, archivedNote: "Expired February 27, 2025" },
        { number: "GL 121", title: "Authorizing Petroleum Services Related to Certain Projects", archived: true, archivedNote: "Expired June 28, 2025" },
        { number: "GL 122", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on January 15, 2025", archived: true, archivedNote: "Expired March 1, 2025" },
        { number: "GL 124A", title: "Authorizing Petroleum Services Related to the Caspian Pipeline Consortium and Tengizchevroil Projects", archived: true, archivedNote: "Superseded by General License 124B" },
        { number: "GL 125", title: "Authorizing Transactions Related to Meetings Between the Government of the United States of America and the Government of the Russian Federation in Alaska", archived: true, archivedNote: "Expired August 20, 2025" },
        { number: "GL 126", title: "Authorizing the Wind Down of Transactions Involving Rosneft or Lukoil", archived: true, archivedNote: "Expired November 21, 2025" },
        { number: "GL 127", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Rosneft or Lukoil", archived: true, archivedNote: "Expired November 21, 2025" },
        { number: "GL 128", title: "Authorizing Certain Transactions Involving Lukoil Retail Service Stations Located Outside of Russia", archived: true, archivedNote: "Superseded by General License 128A" },
        { number: "GL 128A", title: "Authorizing Certain Transactions Involving Lukoil Retail Service Stations Located Outside of Russia", archived: true, archivedNote: "Superseded by General License 128B" },
        { number: "GL 128B", title: "Authorizing Certain Transactions Involving Lukoil Retail Service Stations Located Outside of Russia", archived: true, archivedNote: "Superseded by General License 128C" },
        { number: "GL 129", title: "Authorizing Transactions Involving Rosneft Deutschland GmbH and RN Refining & Marketing GmbH", archived: true, archivedNote: "Superseded by General License 129A" },
        { number: "GL 130", title: "Authorizing Transactions Involving Certain Lukoil Entities in Bulgaria", archived: true, archivedNote: "Superseded by General License 130A" },
        { number: "GL 131", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131A" },
        { number: "GL 131A", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131B" },
        { number: "GL 131B", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131C" },
        { number: "GL 131C", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131D" },
        { number: "GL 131D", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131E" },
        { number: "GL 131E", title: "Authorizing Certain Transactions for the Negotiation of and Entry Into Contingent Contracts for the Sale of Lukoil International GmbH and Related Maintenance Activities", archived: true, archivedNote: "Superseded by General License 131F" },
        { number: "GL 133", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of March 5, 2026 to India", archived: true, archivedNote: "Expired April 4, 2026" },
        { number: "GL 134", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of March 12, 2026", archived: true, archivedNote: "Superseded by General License 134A" },
        { number: "GL 134A", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of March 12, 2026", archived: true, archivedNote: "Expired April 11, 2026" },
        { number: "GL 134B", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of April 17, 2026", archived: true, archivedNote: "Expired May 16, 2026" },
      ],
    },
  },
  {
    id: "russia-ukraine",
    name: "Ukraine-/Russia-related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/ukraine-russia-related-sanctions",
    region: "Russia", category: "country", lastUpdated: "May 8, 2026", status: "active",
    executiveOrders: [
      // 7 EOs — sorted newest first — all PDF links verified from OFAC page
      { number: "14065", title: "Blocking Property of Certain Persons and Prohibiting Certain Transactions With Respect to Continued Russian Efforts to Undermine the Sovereignty and Territorial Integrity of Ukraine", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918791/download?inline" },
      { number: "13883", title: "Administration of Proliferation Sanctions and Amendment of Executive Order 12851", date: "August 3, 2019", url: "https://ofac.treasury.gov/media/26281/download?inline" },
      { number: "13849", title: "Authorizing the Implementation of Certain Sanctions Set Forth in the Countering America's Adversaries Through Sanctions Act (CAATSA)", date: "September 20, 2018", url: "https://ofac.treasury.gov/media/8671/download?inline" },
      { number: "13685", title: "Blocking Property of Certain Persons and Prohibiting Certain Transactions with Respect to the Crimea Region of Ukraine", date: "December 19, 2014", url: "https://ofac.treasury.gov/media/5966/download?inline" },
      { number: "13662", title: "Blocking Property of Additional Persons Contributing to the Situation in Ukraine (Sectoral Sanctions)", date: "March 20, 2014", url: "https://ofac.treasury.gov/media/5961/download?inline" },
      { number: "13661", title: "Blocking Property of Additional Persons Contributing to the Situation in Ukraine", date: "March 17, 2014", url: "https://ofac.treasury.gov/media/5956/download?inline" },
      { number: "13660", title: "Blocking Property of Certain Persons Contributing to the Situation in Ukraine", date: "March 6, 2014", url: "https://ofac.treasury.gov/media/5946/download?inline" },
    ],
    generalLicenses: [
      // 13 GLs — sorted newest first — all PDF links verified from OFAC page
      { number: "Russia GL 134A", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of March 12, 2026", date: "March 19, 2026", url: "https://ofac.treasury.gov/media/935371/download?inline" },
      { number: "Russia GL 133", title: "Authorizing the Delivery and Sale of Crude Oil and Petroleum Products of Russian Federation Origin Loaded on Vessels as of March 5, 2026 to India", date: "March 5, 2026", url: "https://ofac.treasury.gov/media/935101/download?inline" },
      { number: "Ukraine GL 26A", title: "Transactions Authorized Pursuant to the Russian Harmful Foreign Activities Sanctions Regulations", date: "January 15, 2025", url: "https://ofac.treasury.gov/media/933911/download?inline" },
      { number: "Ukraine GL 25", title: "Journalistic Activities and Establishment of News Bureaus in Certain Regions of Ukraine", date: "March 24, 2022", url: "https://ofac.treasury.gov/media/920276/download?inline" },
      { number: "Ukraine GL 24", title: "Transactions Related to the Provision of Maritime Services", date: "March 18, 2022", url: "https://ofac.treasury.gov/media/919801/download?inline" },
      { number: "Ukraine GL 23", title: "Certain Transactions in Support of Nongovernmental Organizations' Activities", date: "March 11, 2022", url: "https://ofac.treasury.gov/media/919151/download?inline" },
      { number: "Ukraine GL 22", title: "Authorizing the Exportation of Certain Services and Software Incident to Internet-Based Communications", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918706/download?inline" },
      { number: "Ukraine GL 21", title: "Authorizing Noncommercial, Personal Remittances and the Operation of Accounts", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918701/download?inline" },
      { number: "Ukraine GL 20", title: "Official Business of Certain International Organizations and Entities", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918696/download?inline" },
      { number: "Ukraine GL 19", title: "Authorizing Transactions Related to Telecommunications and Mail", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918691/download?inline" },
      { number: "Ukraine GL 18", title: "Authorizing the Exportation or Reexportation of Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, or Software Updates to Certain Regions of Ukraine", date: "February 21, 2022", url: "https://ofac.treasury.gov/media/918686/download?inline" },
      { number: "Ukraine GL 11", title: "Authorizing Certain Transactions With FAU Glavgosekspertiza Rossii", date: "December 20, 2016", url: "https://ofac.treasury.gov/media/8781/download?inline" },
      { number: "Update — Medical Supplies List", title: "Update to the List of Medical Supplies for Ukraine-/Russia-Related Sanctions", date: "May 31, 2022", url: "https://ofac.treasury.gov/media/923406/download?inline" },
    ],
    keyAdvisories: [
      // 3 advisories — all PDF links verified from OFAC page
      { title: "FACT SHEET: Russia Sanctions and Agricultural Trade", date: "July 2022", url: "https://ofac.treasury.gov/media/924341/download?inline" },
      { title: "FACT SHEET: Preserving Agricultural Trade, Access to Communication, and Other Support to Those Impacted by Russia's War Against Ukraine", date: "April 2022", url: "https://ofac.treasury.gov/media/922206/download?inline" },
      { title: "Advisory Regarding the Obfuscation of Critical Information in Financial and Trade Transactions Involving the Crimea Region of Ukraine", date: "July 30, 2015", url: "https://ofac.treasury.gov/media/8676/download?inline" },
    ],
    notes: "This program covers the original Ukraine/Crimea sanctions framework (EOs 13660-13662, 13685) and CAATSA (EO 13849). It is separate from the Russian Harmful Foreign Activities program (EO 14024). The Sectoral Sanctions Identifications (SSI) List under EO 13662 identifies Russian entities in specific sectors. See also 31 CFR Part 589.",

        archive: {
      generalLicenses: [
        { number: "Ukraine GL 3", title: "Authorizing Transactions Involving Certain Entities Otherwise Prohibited by Directive 1 under Executive Order 13662", archived: true, archivedNote: "Revoked May 2, 2022" },
        { number: "Ukraine GL 26", title: "Transactions Authorized Pursuant to the Russian Harmful Foreign Activities Sanctions Regulations", archived: true, archivedNote: "Superseded by General License 26A" },
        { number: "Russia GL 125", title: "Authorizing Transactions Related to Meetings Between the Government of the United States of America and the Government of the Russian Federation in Alaska", archived: true, archivedNote: "Expired August 20, 2025" },
      ],
    },
  },
  {
    id: "somalia",
    name: "Somalia Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/somalia-sanctions",
    region: "MEA", category: "country", lastUpdated: "May 24, 2023", status: "active",
    executiveOrders: [
      { number: "13536", title: "Blocking Property of Certain Persons Contributing to the Conflict in Somalia", date: "April 12, 2010", url: "https://ofac.treasury.gov/media/8521/download?inline" },
      { number: "13620", title: "Taking Additional Steps to Address the National Emergency With Respect to Somalia", date: "July 20, 2012", url: "https://ofac.treasury.gov/media/8526/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "south-sudan",
    name: "South Sudan-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/south-sudan-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Dec 8, 2023", status: "active",
    executiveOrders: [
      { number: "13664", title: "Blocking Property of Certain Persons With Respect to South Sudan", date: "April 3, 2014", url: "https://ofac.treasury.gov/media/5936/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "sudan",
    name: "Sudan and Darfur Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/sudan-and-darfur-sanctions",
    region: "MEA", category: "country", lastUpdated: "Apr 17, 2026", status: "active",
    executiveOrders: [
      { number: "13400", title: "Blocking Property of Persons in Connection With the Conflict in Sudan's Darfur Region", date: "April 26, 2006", url: "https://ofac.treasury.gov/media/7306/download?inline" },
    ],
    generalLicenses: [],
    notes: "The broader Sudan sanctions under EO 13067 were revoked in 2017. Darfur-specific EO 13400 remains active.",

        archive: {
      generalLicenses: [
        { number: "GL 4", title: "Authorizing the Wind Down of Transactions Involving Defense Industries System or Al Junaid Multi Activities Co Ltd.", archived: true, archivedNote: "Expired July 31, 2023" },
      ],
    },
  },

  {
    id: "venezuela",
    name: "Venezuela-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/venezuela-related-sanctions",
    region: "Venezuela", category: "country", lastUpdated: "May 5, 2026", status: "active",
    executiveOrders: [
      { number: "13692", title: "Blocking Property and Suspending Entry of Certain Persons Contributing to the Situation in Venezuela", date: "March 8, 2015", url: "https://ofac.treasury.gov/media/5906/download?inline" },
      { number: "13808", title: "Imposing Additional Sanctions With Respect to Venezuela", date: "August 24, 2017", url: "https://ofac.treasury.gov/media/5476/download?inline" },
      { number: "13827", title: "Taking Additional Steps to Address the Situation in Venezuela", date: "March 19, 2018", url: "https://ofac.treasury.gov/media/5486/download?inline" },
      { number: "13835", title: "Prohibiting Certain Additional Transactions With Respect to Venezuela", date: "May 21, 2018", url: "https://ofac.treasury.gov/media/5511/download?inline" },
      { number: "13850", title: "Blocking Property of Additional Persons Contributing to the Situation in Venezuela (Sectoral)", date: "November 1, 2018", url: "https://ofac.treasury.gov/media/5516/download?inline" },
      { number: "13857", title: "Taking Additional Steps to Address the National Emergency With Respect to Venezuela", date: "January 25, 2019", url: "https://ofac.treasury.gov/media/5491/download?inline" },
      { number: "13884", title: "Blocking Property of the Government of Venezuela", date: "August 5, 2019", url: "https://ofac.treasury.gov/media/26786/download?inline" },
    ],
    generalLicenses: [
      { number: "GL 8J", title: "Authorizing Certain Transactions Related to Petróleos de Venezuela", date: "2025 (latest revision)" },
      { number: "GL 20", title: "Authorizing Transactions Involving the Export or Reexport of Petroleum or Petroleum Products", date: "Ongoing" },
      { number: "GL 40", title: "Authorizing Official Activities of International Organizations", date: "Ongoing" },
    ],
    keyAdvisories: [
      { title: "Treasury Targets Oil Traders Engaged in Sanctions Evasion for Maduro Regime", date: "December 31, 2025", url: "https://home.treasury.gov/news/press-releases/sb0348" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 3H", title: "Authorizing Transactions Related to, Provision of Financing for, and Other Dealings in Certain Bonds", archived: true, archivedNote: "Superseded by General License 3I" },
        { number: "GL 5R", title: "Authorizing Certain Transactions Related to the Petróleos de Venezuela, S.A. 2020 8.5 Percent Bond on or After July 3, 2025", archived: true, archivedNote: "Superseded by General License 5S" },
        { number: "GL 5S", title: "Authorizing Certain Transactions Related to the Petróleos de Venezuela, S.A. 2020 8.5 Percent Bond on or After December 20, 2025", archived: true, archivedNote: "Superseded by General License 5T" },
        { number: "GL 5T", title: "Authorizing Certain Transactions Related to the Petróleos de Venezuela, S.A. 2020 8.5 Percent Bond on or After February 3, 2026", archived: true, archivedNote: "Superseded by General License 5U" },
        { number: "GL 5U", title: "Authorizing Certain Transactions Related to the Petróleos de Venezuela, S.A. 2020 8.5 Percent Bond on or After March 20, 2026", archived: true, archivedNote: "Superseded by General License 5V" },
        { number: "GL 5V", title: "Authorizing Certain Transactions Related to the Petróleos de Venezuela, S.A. 2020 8.5 Percent Bond on or After May 5, 2026", archived: true, archivedNote: "Superseded by General License 5W" },
        { number: "GL 8O", title: "Authorizing Transactions Involving Petróleos de Venezuela, S.A. (PdVSA) Necessary for the Limited Maintenance of Essential Operations in Venezuela or the Wind Down of Operations in Venezuela for Certain Entities", archived: true, archivedNote: "Expired May 9, 2025" },
        { number: "GL 9G", title: "Authorizing Transactions Related to Dealings in Certain Securities", archived: true, archivedNote: "Superseded by General License 9H" },
        { number: "GL 30A", title: "Authorizing Certain Transactions Necessary to Port and Airport Operations", archived: true, archivedNote: "Superseded by General License 30B" },
        { number: "GL 39B", title: "Authorizing Certain Activities to Respond to the Coronavirus Disease 2019 (COVID-19)", archived: true, archivedNote: "Expired June 14, 2024" },
        { number: "GL 40C", title: "Authorizing Certain Transactions Involving the Exportation or Reexportation of Liquefied Petroleum Gas to Venezuela", archived: true, archivedNote: "Superseded by General License 40D" },
        { number: "GL 40D", title: "Authorizing the Offloading of Liquefied Petroleum Gas in Venezuela", archived: true, archivedNote: "Expired September 5, 2025" },
        { number: "GL 41", title: "Authorizing Certain Transactions Related to Chevron Corporation's Joint Ventures in Venezuela", archived: true, archivedNote: "Superseded by General License 41A" },
        { number: "GL 41A", title: "Authorizing the Wind Down of Certain Transactions Related to Chevron Corporation's Joint Ventures in Venezuela", archived: true, archivedNote: "Superseded by General License 41B" },
        { number: "GL 41B", title: "Authorizing the Wind Down of Certain Transactions Related to Chevron Corporation's Joint Ventures in Venezuela", archived: true, archivedNote: "Expired June 3, 2025" },
        { number: "GL 43", title: "Authorizing Transactions Involving CVG Compania General de Mineria de Venezuela CA", archived: true, archivedNote: "Superseded by General License 43A" },
        { number: "GL 43A", title: "Authorizing the Wind Down of Transactions Involving CVG Compania General de Mineria de Venezuela CA", archived: true, archivedNote: "Expired February 13, 2024" },
        { number: "GL 44", title: "Authorizing Transactions Related to Oil or Gas Sector Operations in Venezuela", archived: true, archivedNote: "Superseded by General License 44A" },
        { number: "GL 44A", title: "Authorizing the Wind Down of Transactions Related to Oil or Gas Sector Operations in Venezuela", archived: true, archivedNote: "Expired May 31, 2024" },
        { number: "GL 45A", title: "Authorizing Certain Transactions Involving Consorcio Venezolano de Industrias Aeronáuticas y Servicios Aéreos, S.A.", archived: true, archivedNote: "Superseded by General License 45B" },
        { number: "GL 46", title: "Authorizing Certain Activities Involving Venezuelan-Origin Oil", archived: true, archivedNote: "Superseded by General License 46A" },
        { number: "GL 46A", title: "Authorizing Certain Activities Involving Venezuelan-Origin Oil", archived: true, archivedNote: "Superseded by General License 46B" },
        { number: "GL 48", title: "Authorizing the Supply of Certain Items and Services to Venezuela", archived: true, archivedNote: "Superseded by General License 48A" },
        { number: "GL 49", title: "Authorizing Negotiations of and Entry Into Contingent Contracts for Certain Investment in Venezuela", archived: true, archivedNote: "Superseded by General License 49A" },
        { number: "GL 50", title: "Authorizing Transactions Related to Oil or Gas Sector Operations in Venezuela of Certain Entities", archived: true, archivedNote: "Superseded by General License 50A" },
        { number: "GL 51", title: "Authorizing Certain Activities Involving Venezuelan-Origin Gold", archived: true, archivedNote: "Superseded by General License 51A" },
      ],
    },
  },

  {
    id: "yemen",
    name: "Yemen-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/yemen-related-sanctions",
    region: "MEA", category: "country", lastUpdated: "Nov 18, 2021", status: "active",
    executiveOrders: [
      { number: "13611", title: "Blocking Property of Persons Threatening the Peace, Security, or Stability of Yemen", date: "May 16, 2012", url: "https://ofac.treasury.gov/media/5951/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "paarss",
    name: "PAARSS (Syria Residual Sanctions)",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/paarss",
    region: "MEA", category: "country", lastUpdated: "Dec 23, 2025", status: "residual",
    executiveOrders: [
      { number: "14309 (EO of June 30, 2025)", title: "Removing US Sanctions on Syria — broad Syria sanctions lifted July 1, 2025", date: "June 30, 2025" },
    ],
    generalLicenses: [
      { number: "Syria GL 25", title: "Authorizing Transactions Prohibited by the Syrian Sanctions Regulations or Involving Certain Blocked Persons", date: "May 23, 2025", url: "https://ofac.treasury.gov/media/934306/download?inline" },
    ],
    notes: "Syria broad sanctions LIFTED July 1, 2025. PAARSS residual program covers: Assad & associates, human rights abusers, Captagon traffickers, proliferation-linked persons, ISIS/AQ affiliates, Iran proxies in Syria.",

        archive: {
      generalLicenses: [
        { number: "Syria GL 2", title: "Authorizing Certain Activities Necessary to the Wind Down of Operations or Existing Contracts Involving the Ministry of National Defence or the Ministry of Energy and Natural Resources of the Government of Turkey", archived: true, archivedNote: "Revoked November 5, 2019" },
        { number: "Syria GL 3", title: "Authorizing Official Activities of Certain International Organizations Involving the Ministry of National Defence or the Ministry of Energy and Natural Resources of the Government of Turkey", archived: true, archivedNote: "Revoked November 5, 2019" },
      ],
    },
  },

  // ── THEMATIC / ISSUE-BASED PROGRAMS ──────────────────────────────────────

  {
    id: "sdgt",
    name: "Counter Terrorism Sanctions (SDGT)",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/counter-terrorism-sanctions",
    region: "Global", category: "thematic", lastUpdated: "May 8, 2026", status: "active",
    executiveOrders: [
      { number: "13224", title: "Blocking Property and Prohibiting Transactions With Persons Who Commit, Threaten To Commit, or Support Terrorism", date: "September 23, 2001", url: "https://ofac.treasury.gov/media/5536/download?inline" },
      { number: "13268", title: "Termination of Emergency With Respect to the Taliban", date: "July 2, 2002", url: "https://ofac.treasury.gov/media/5631/download?inline" },
      { number: "13372", title: "Clarifying the Prohibition on Transactions With, and the Confiscation of Assets of, Terrorists Who Threaten to Disrupt the Middle East Peace Process", date: "February 16, 2005", url: "https://ofac.treasury.gov/media/5576/download?inline" },
    ],
    generalLicenses: [
      { number: "CT GL 26A", title: "Authorizing Certain Transactions Necessary to Port and Airport Operations Involving Ansarallah", date: "March 5, 2025" },
      { number: "CT GL 28A", title: "Authorizing Transactions for Third-Country Diplomatic and Consular Missions Involving Ansarallah", date: "March 5, 2025" },
    ],
    keyAdvisories: [
      { title: "Treasury Targets Hizballah-Aligned Officials Obstructing Peace and Disarmament (SDGT)", date: "May 21, 2026", url: "https://home.treasury.gov/news/press-releases/sb0505" },
      { title: "Treasury Sanctions Gaza Flotilla Organizers — Hamas/Muslim Brotherhood Networks (SDGT)", date: "May 19, 2026", url: "https://home.treasury.gov/news/press-releases/sb0501" },
    ],

        archive: {
      generalLicenses: [
        { number: "CT GL (unnamed)", title: "To authorize payments from funds originating outside the United States for certain legal services to or on behalf of blocked persons", archived: true, archivedNote: "Incorporated into 31 CFR Part 594" },
        { number: "CT GL 21B", title: "Authorizing Limited Safety and Environmental Transactions Involving Certain Vessels", archived: true, archivedNote: "Expired April 13, 2023" },
        { number: "CT GL 22", title: "Transactions Related to the Provision of Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, or Software Updates Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 22A" },
        { number: "CT GL 23", title: "Authorizing Transactions Related to Telecommunications Mail and Certain Internet-Based Communications Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 23A" },
        { number: "CT GL 24", title: "Authorizing Noncommercial, Personal Remittances Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 24A" },
        { number: "CT GL 25", title: "Authorizing Transactions Related to Refined Petroleum Products in Yemen Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 25A" },
        { number: "CT GL 25A", title: "Authorizing the Offloading of Refined Petroleum Products in Yemen Involving Ansarallah", archived: true, archivedNote: "Expired April 4, 2025" },
        { number: "CT GL 26", title: "Authorizing Certain Transactions Necessary to Port and Airport Operations Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 26A" },
        { number: "CT GL 27", title: "Authorizing Civil Aviation Safety and Wind Down Transactions Involving Fly Baghdad", archived: true, archivedNote: "Expired March 22, 2024" },
        { number: "CT GL 28", title: "Authorizing Transactions for Third-Country Diplomatic and Consular Missions Involving Ansarallah", archived: true, archivedNote: "Superseded by Counter Terrorism General License 28A" },
        { number: "CT GL 29", title: "Authorizing the Wind Down of Transactions Involving Haleel Commodities LLC", archived: true, archivedNote: "Expired April 10, 2024" },
        { number: "CT GL 30", title: "Authorizing the Wind Down of Transactions Involving Certain Entities Blocked on October 7, 2024", archived: true, archivedNote: "Expired November 21, 2024" },
        { number: "CT GL 31", title: "Authorizing Certain Transactions Related to Debt or Equity of, or Derivative Contracts Involving, Certain Entities Blocked on October 7, 2024", archived: true, archivedNote: "Expired November 21, 2024" },
        { number: "CT GL 32", title: "Authorizing the Wind Down of Transactions Involving Yemen Kuwait Bank for Trade and Investment Y.S.C", archived: true, archivedNote: "Expired February 1, 2025" },
        { number: "CT GL 33", title: "Authorizing the Wind Down of Transactions Involving International Bank of Yemen (IBY)", archived: true, archivedNote: "Expired May 17, 2025" },
        { number: "CT GL 34", title: "Authorizing the Wind Down of Transactions Involving Kovay Gardens", archived: true, archivedNote: "Expired March 21, 2026" },
        { number: "CT GL 35", title: "Authorizing the Wind Down of Transactions Involving Entities Blocked on April 14, 2026", archived: true, archivedNote: "Expired May 15, 2026" },
      ],
    },
  },

  {
    id: "narcotics",
    name: "Counter Narcotics Trafficking Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/counter-narcotics-trafficking-sanctions",
    region: "Global", category: "thematic", lastUpdated: "May 8, 2026", status: "active",
    executiveOrders: [
      { number: "12978", title: "Blocking Assets and Prohibiting Transactions With Significant Narcotics Traffickers", date: "October 21, 1995", url: "https://ofac.treasury.gov/media/6146/download?inline" },
      { number: "13818", title: "Blocking the Property of Persons Involved in Serious Human Rights Abuse or Corruption (also GNMA)", date: "December 20, 2017", url: "https://ofac.treasury.gov/media/8656/download?inline" },
    ],
    generalLicenses: [],
    keyAdvisories: [
      { title: "Treasury Disrupts Sinaloa Cartel Fentanyl Trafficking Networks", date: "May 20, 2026", url: "https://home.treasury.gov/news/press-releases/sb0503" },
    ],
  },

  {
    id: "non-prolif",
    name: "Non-Proliferation Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/non-proliferation-sanctions",
    region: "Global", category: "thematic", lastUpdated: "May 8, 2026", status: "active",
    executiveOrders: [
      { number: "12938", title: "Proliferation of Weapons of Mass Destruction", date: "November 14, 1994", url: "https://ofac.treasury.gov/media/6126/download?inline" },
      { number: "13094", title: "Amending EO 12938 with Respect to Proliferation of Weapons of Mass Destruction", date: "July 28, 1998", url: "https://ofac.treasury.gov/media/6076/download?inline" },
      { number: "13382", title: "Blocking Property of Weapons of Mass Destruction Proliferators and Their Supporters", date: "June 28, 2005", url: "https://ofac.treasury.gov/media/5556/download?inline" },
    ],
    generalLicenses: [],
    keyAdvisories: [
      { title: "Treasury Targets Iran UAV and Missile Component Procurement Networks", date: "May 8, 2026", url: "https://home.treasury.gov/news/press-releases/sb0496" },
    ],
  },

  {
    id: "cyber",
    name: "Cyber-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/sanctions-related-to-significant-malicious-cyber-enabled-activities",
    region: "Global", category: "thematic", lastUpdated: "Apr 23, 2026", status: "active",
    executiveOrders: [
      { number: "13694", title: "Blocking the Property of Certain Persons Engaging in Significant Malicious Cyber-Enabled Activities", date: "April 1, 2015", url: "https://ofac.treasury.gov/media/5831/download?inline" },
      { number: "13757", title: "Taking Additional Steps to Address the National Emergency With Respect to Significant Malicious Cyber-Enabled Activities", date: "December 28, 2016", url: "https://ofac.treasury.gov/media/8561/download?inline" },
    ],
    generalLicenses: [
      { number: "Cyber GL 2", title: "Authorizing Certain Transactions Involving Anco Water Supply Co. Ltd. Related to the Treatment and Distribution of Drinking Water", date: "April 23, 2026", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
      { number: "Cyber GL 1C", title: "Authorizing Certain Transactions with the Federal Security Service (FSB)", date: "April 27, 2023" },
    ],
  },

  {
    id: "global-magnitsky",
    name: "Global Magnitsky Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/global-magnitsky-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Mar 27, 2026", status: "active",
    executiveOrders: [
      { number: "13818", title: "Blocking the Property of Persons Involved in Serious Human Rights Abuse or Corruption", date: "December 20, 2017", url: "https://ofac.treasury.gov/media/8656/download?inline" },
    ],
    generalLicenses: [
      { number: "Global Magnitsky GL 8", title: "Authorizing Transactions Involving Certain Entities Owned by Ly Yong Phat or L.Y.P. Group Co., Ltd.", date: "2025", url: "https://ofac.treasury.gov/selected-general-licenses-issued-ofac" },
    ],

        archive: {
      generalLicenses: [
        { number: "GL 3", title: "Authorizing Transactions Related to Debt or Equity of Pingtan Marine Enterprise Ltd.", archived: true, archivedNote: "Expired March 9, 2023" },
        { number: "GL 4", title: "Authorizing the Wind Down of Transactions Involving Certain Vessels", archived: true, archivedNote: "Expired March 9, 2023" },
        { number: "GL 5", title: "Authorizing Certain Transactions Related to Frigorifico Chajha S.A.E.", archived: true, archivedNote: "Expired March 27, 2023" },
        { number: "GL 6", title: "Authorizing the Wind Down of Transactions Involving Bebidas USA Inc., Tabacos USA Inc., Frigorifico Chajha S.A.E., Dominicana Acquisition S.A., or Certain Blocked Entities Owned by Horacio Manuel Cartes Jara", archived: true, archivedNote: "Expired March 27, 2023" },
        { number: "GL 7", title: "Authorizing Certain Transactions Involving Tabacalera del Este S.A. or Tabacos USA Inc. Pursuant to the Tobacco Master Settlement Agreement", archived: true, archivedNote: "Archived October 6, 2025" },
      ],
    },
  },

  {
    id: "magnitsky",
    name: "Magnitsky Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/the-magnitsky-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Aug 17, 2023", status: "active",
    executiveOrders: [],
    generalLicenses: [],
    notes: "Based on the Sergei Magnitsky Rule of Law Accountability Act of 2012 (statute-based, no EO). Targets Russian human rights violators involved in the Magnitsky case.",
  },

  {
    id: "tco",
    name: "Transnational Criminal Organizations",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/transnational-criminal-organizations",
    region: "Global", category: "thematic", lastUpdated: "Dec 17, 2025", status: "active",
    executiveOrders: [
      { number: "13581", title: "Blocking Property of Transnational Criminal Organizations", date: "July 24, 2011", url: "https://ofac.treasury.gov/media/7551/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "caatsa",
    name: "CAATSA-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/countering-americas-adversaries-through-sanctions-act-related-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Feb 24, 2026", status: "active",
    executiveOrders: [],
    generalLicenses: [],
    notes: "Based on the Countering America's Adversaries Through Sanctions Act (CAATSA), Public Law 115-44 (August 2, 2017). Targets Russia, Iran, and North Korea. No EO — statute-based.",
  },

  {
    id: "china-military",
    name: "Chinese Military Companies Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/chinese-military-companies-sanctions",
    region: "China / HK", category: "thematic", lastUpdated: "Jun 1, 2022", status: "active",
    executiveOrders: [
      { number: "13959", title: "Addressing the Threat From Securities Investments That Finance Communist Chinese Military Companies", date: "November 12, 2020", url: "https://ofac.treasury.gov/media/49616/download?inline" },
      { number: "14032", title: "Addressing the Threat From Securities Investments That Finance Certain Companies of the People's Republic of China", date: "June 3, 2021", url: "https://ofac.treasury.gov/media/99111/download?inline" },
    ],
    generalLicenses: [],

        archive: {
      generalLicenses: [
        { number: "GL 1B", title: "Authorizing Transactions Involving Securities of Certain Communist Chinese Military Companies", archived: true, archivedNote: "Expired June 11, 2021" },
        { number: "GL 2", title: "Authorizing Securities Exchanges Operated by U.S. Persons to Engage in Transactions Involving Securities of Communist Chinese Military Companies", archived: true, archivedNote: "Expired December 16, 2021" },
      ],
    },
  },

  {
    id: "hostages",
    name: "Hostages and Wrongfully Detained US Nationals Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/hostages-and-wrongfully-detained-us-nationals-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Mar 25, 2025", status: "active",
    executiveOrders: [
      { number: "14078", title: "Bolstering Efforts to Bring Hostages and Wrongfully Detained United States Nationals Home", date: "July 19, 2022", url: "https://ofac.treasury.gov/media/924551/download?inline" },
    ],
    generalLicenses: [],
  },

  {
    id: "icc",
    name: "International Criminal Court-Related Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/international-criminal-court-related-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Dec 18, 2025", status: "active",
    executiveOrders: [
      { number: "14203", title: "Imposing Sanctions on the International Criminal Court", date: "February 6, 2025", url: "https://ofac.treasury.gov/media/933981/download?inline" },
    ],
    generalLicenses: [],
    notes: "Trump EO 14203 (Feb 2025) targets ICC officials. On May 13, 2026, a US District Court issued an injunction blocking enforcement of the designation of Francesca Albanese.",

        archive: {
      generalLicenses: [
        { number: "GL 1", title: "Authorizing the Wind Down of Transactions Involving Certain Persons Blocked on June 5, 2025", archived: true, archivedNote: "Expired July 8, 2025" },
        { number: "GL 2", title: "Authorizing the Provision of Certain Legal Services", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 3", title: "Authorizing Payments for Legal Services From Funds Originating Outside the United States", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 4", title: "Authorizing Emergency Medical Services", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 5", title: "Entries in Certain Accounts for Normal Service Charges and Payments and Transfers to Blocked Accounts in U.S. Financial Institutions Authorized", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 6", title: "Authorizing Transactions Related to the Provision of Agricultural Commodities, Medicine, Medical Devices, Replacement Parts and Components, or Software Updates for Personal, Non-Commercial Use", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 7", title: "Official Business of the United States Government", archived: true, archivedNote: "Incorporated into 31 CFR Part 528" },
        { number: "GL 8", title: "Authorizing the Wind Down of Transactions Involving Francesca Paola Albanese", archived: true, archivedNote: "Expired August 8, 2025" },
        { number: "GL 9", title: "Authorizing the Wind Down of Transactions Involving Certain Persons Blocked on August 20, 2025", archived: true, archivedNote: "Expired September 19, 2025" },
        { number: "GL 10", title: "Authorizing the Wind Down of Transactions Involving Certain Persons Blocked on September 4, 2025", archived: true, archivedNote: "Expired October 4, 2025" },
        { number: "GL 11", title: "Authorizing the Wind Down of Transactions Involving Certain Persons Blocked on December 18, 2025", archived: true, archivedNote: "Expired January 17, 2026" },
      ],
    },
  },

  {
    id: "election",
    name: "Foreign Interference in a US Election Sanctions",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/foreign-interference-in-a-united-states-election-sanctions",
    region: "Global", category: "thematic", lastUpdated: "Dec 31, 2024", status: "active",
    executiveOrders: [
      { number: "13848", title: "Imposing Certain Sanctions in the Event of Foreign Interference in a United States Election", date: "September 12, 2018", url: "https://ofac.treasury.gov/media/12906/download?inline" },
    ],
    generalLicenses: [],
    notes: "Last active use: December 2024 (Biden admin final designations). Zero new designations under Trump 2.0 as of May 2026.",
  },

  {
    id: "diamonds",
    name: "Rough Diamond Trade Controls",
    url: "https://ofac.treasury.gov/sanctions-programs-and-country-information/rough-diamond-trade-controls",
    region: "MEA", category: "thematic", lastUpdated: "Jun 18, 2018", status: "active",
    executiveOrders: [],
    generalLicenses: [],
    notes: "Based on the Clean Diamond Trade Act (Public Law 108-19, 2003) and the Kimberley Process Certification Scheme. No EO.",
  },
];

// Helper: get program by ID
export function getProgramById(id: string): SanctionsProgram | undefined {
  return SANCTIONS_PROGRAMS.find(p => p.id === id);
}

// Helper: get all programs for a region
export function getProgramsByRegion(region: string): SanctionsProgram[] {
  return SANCTIONS_PROGRAMS.filter(p => p.region === region);
}

// Helper: get all active general licenses across all programs
export function getAllActiveGeneralLicenses() {
  return SANCTIONS_PROGRAMS.flatMap(p =>
    p.generalLicenses.map(gl => ({ ...gl, program: p.name, programId: p.id, region: p.region }))
  );
}

// Helper: get programs with recent updates (within N days)
export function getRecentlyUpdatedPrograms(days = 90): SanctionsProgram[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return SANCTIONS_PROGRAMS.filter(p => {
    const d = new Date(p.lastUpdated);
    return !isNaN(d.getTime()) && d >= cutoff;
  });
}
