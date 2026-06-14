/**
 * FinCEN BSA Enforcement Actions Database
 * Source: https://www.fincen.gov/news/enforcement-actions
 * Includes all major BSA/AML civil money penalties.
 * Sorted newest first.
 */

export interface FinCENPenalty {
  id: string;
  date: string;
  year: number;
  institution: string;
  institutionType: string;
  penalty: number;
  penaltyDisplay: string;
  agencies: string[];
  violation: string;
  program: string;
  voluntaryDisclosure: boolean;
  egregious: boolean;
  sourceUrl: string;
  notes?: string;
}

export const FINCEN_PENALTIES: FinCENPenalty[] = [
  {
    id:"F2026-01", date:"2026-03-06", year:2026,
    institution:"Canaccord Genuity LLC", institutionType:"Securities",
    penalty:80000000, penaltyDisplay:"$80M",
    agencies:["FinCEN","SEC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to maintain effective AML program; failed to file SARs for suspicious securities transactions",
    program:"BSA / AML / Securities", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2025-02", date:"2025-12-09", year:2025,
    institution:"Paxful, Inc. and Paxful USA, Inc.", institutionType:"MSB/Crypto",
    penalty:7700000, penaltyDisplay:"$7.7M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to register as MSB; failure to implement effective AML program for P2P crypto marketplace",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2025-01", date:"2025-01-31", year:2025,
    institution:"Brink's Global Services USA, Inc.", institutionType:"MSB",
    penalty:37000000, penaltyDisplay:"$37M",
    agencies:["FinCEN","DOJ"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — first action against armored car company; failed to register as MSB; moved ~$800M in bulk currency without effective AML controls",
    program:"BSA / AML / MSB", sourceUrl:"https://www.fincen.gov/news/news-releases/fincen-announces-37000000-civil-money-penalty-against-brinks-global-services-usa",
    notes:"FinCEN-only $37M; total resolution $42M including DOJ forfeiture",
  },
  {
    id:"F2024-03", date:"2024-10-22", year:2024,
    institution:"Sahara Dunes Casino LP d/b/a Lake Elsinore Hotel and Casino", institutionType:"Casino",
    penalty:650000, penaltyDisplay:"$650K",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program at casino",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2024-02", date:"2024-10-10", year:2024,
    institution:"TD Bank N.A. and TD Bank USA N.A.", institutionType:"Bank",
    penalty:1300000000, penaltyDisplay:"$1.3B",
    agencies:["FinCEN","OCC","DOJ","Federal Reserve"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — processed $18.3T in transactions with systemic AML failures; three money laundering networks moved $670M+; monitored only 8% of transaction volume",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/news-releases/fincen-takes-historic-13-billion-enforcement-action-against-td-bank",
    notes:"Largest BSA penalty in US history; $3.09B total with DOJ/OCC",
  },
  {
    id:"F2024-01", date:"2024-01-31", year:2024,
    institution:"Gyanendra Kumar Asre", institutionType:"Individual",
    penalty:100000, penaltyDisplay:"$100K",
    agencies:["FinCEN","NCUA"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — BSA compliance officer failure to implement effective AML program at credit union",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2023-04", date:"2023-11-21", year:2023,
    institution:"Binance Holdings Limited d/b/a Binance", institutionType:"MSB/Crypto",
    penalty:3400000000, penaltyDisplay:"$3.4B",
    agencies:["FinCEN","DOJ","CFTC","OFAC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willfully operated as unregistered MSB; processed transactions for sanctioned jurisdictions; failed to implement AML program",
    program:"BSA / AML / Crypto / Sanctions", sourceUrl:"https://www.fincen.gov/news/news-releases/fincen-and-doj-reach-43-billion-resolution-with-binance",
    notes:"Largest crypto enforcement ever; FinCEN $3.4B of $4.3B total",
  },
  {
    id:"F2023-03", date:"2023-09-29", year:2023,
    institution:"Shinhan Bank America", institutionType:"Bank",
    penalty:15000000, penaltyDisplay:"$15M",
    agencies:["FinCEN","FDIC","NYDFS"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program; failed to file SARs for suspicious transactions 2016-2021",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2023-02", date:"2023-09-15", year:2023,
    institution:"Bancrédito International Bank and Trust Corporation", institutionType:"Bank",
    penalty:15000000, penaltyDisplay:"$15M",
    agencies:["FinCEN","OCIF"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — first enforcement action against Puerto Rican International Banking Entity; inadequate correspondent account due diligence",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2023-01", date:"2023-04-26", year:2023,
    institution:"The Kingdom Trust Company", institutionType:"Bank",
    penalty:1500000, penaltyDisplay:"$1.5M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program as a trust company holding digital assets",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2022-03", date:"2022-10-11", year:2022,
    institution:"Bittrex, Inc.", institutionType:"MSB/Crypto",
    penalty:29000000, penaltyDisplay:"$29M",
    agencies:["FinCEN","OFAC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to maintain effective AML program; processed transactions for sanctioned jurisdictions",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2022-02", date:"2022-03-31", year:2022,
    institution:"A&S World Trading Incorporated", institutionType:"MSB",
    penalty:200000, penaltyDisplay:"$200K",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to register as MSB and maintain AML program",
    program:"BSA / AML / MSB", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2022-01", date:"2022-03-17", year:2022,
    institution:"USAA Federal Savings Bank", institutionType:"Bank",
    penalty:140000000, penaltyDisplay:"$140M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willful failure to implement AML program; failed to file thousands of SARs and CTRs",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2021-03", date:"2021-12-16", year:2021,
    institution:"CommunityBank of Texas N.A.", institutionType:"Bank",
    penalty:8000000, penaltyDisplay:"$8M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — willful failure to implement effective AML program; failed to file SARs 2015-2019",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2021-02", date:"2021-08-10", year:2021,
    institution:"HDR Global Trading Limited d/b/a BitMEX", institutionType:"MSB/Crypto",
    penalty:100000000, penaltyDisplay:"$100M",
    agencies:["FinCEN","CFTC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willful failure to implement AML program as unregistered MSB; served US customers without KYC/AML controls",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2021-01", date:"2021-01-15", year:2021,
    institution:"Capital One, National Association", institutionType:"Bank",
    penalty:390000000, penaltyDisplay:"$390M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willful failure to implement AML program 2008-2014; failed to file thousands of SARs and CTRs; allowed millions in suspicious transactions",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/news-releases/fincen-announces-390000000-enforcement-action-against-capital-one-national",
  },
  {
    id:"F2020-02", date:"2020-10-19", year:2020,
    institution:"Larry Dean Harmon d/b/a Helix", institutionType:"MSB/Crypto",
    penalty:60000000, penaltyDisplay:"$60M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — operated Bitcoin mixer (tumbler) as unregistered MSB; processed $311M for dark web markets",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2020-01", date:"2020-03-04", year:2020,
    institution:"Michael LaFontaine", institutionType:"Individual",
    penalty:450000, penaltyDisplay:"$450K",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — BSA compliance officer willful failure; allowed millions in suspicious transactions to go unreported",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2019-01", date:"2019-04-18", year:2019,
    institution:"Eric Powers", institutionType:"MSB",
    penalty:35350, penaltyDisplay:"$35.4K",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — operated peer-to-peer virtual currency exchange as unlicensed MSB",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2018-03", date:"2018-12-17", year:2018,
    institution:"UBS Financial Services Inc.", institutionType:"Securities",
    penalty:14500000, penaltyDisplay:"$14.5M",
    agencies:["FinCEN","SEC","FINRA"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — willful failure to implement AML program and file SARs",
    program:"BSA / AML / Securities", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2018-02", date:"2018-05-03", year:2018,
    institution:"Artichoke Joe's Casino", institutionType:"Casino",
    penalty:5000000, penaltyDisplay:"$5M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program at card club casino",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2018-01", date:"2018-02-15", year:2018,
    institution:"U.S. Bank National Association", institutionType:"Bank",
    penalty:185000000, penaltyDisplay:"$185M",
    agencies:["FinCEN","OCC","DOJ"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willful failure to maintain AML program; deliberately capped SAR filings; processed transactions for high-risk customers",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2017-04", date:"2017-11-01", year:2017,
    institution:"Lone Star National Bank", institutionType:"Bank",
    penalty:2000000, penaltyDisplay:"$2M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to file SARs for money laundering along US-Mexico border",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2017-03", date:"2017-07-27", year:2017,
    institution:"BTC-E a/k/a Canton Business Corporation and Alexander Vinnik", institutionType:"MSB/Crypto",
    penalty:110003520, penaltyDisplay:"$110M",
    agencies:["FinCEN","DOJ"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — operated unlicensed MSB; facilitated transactions for ransomware, dark web, and cybercriminals",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2017-02", date:"2017-02-27", year:2017,
    institution:"Merchants Bank of California N.A.", institutionType:"Bank",
    penalty:7000000, penaltyDisplay:"$7M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program; failed to file SARs",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2017-01", date:"2017-01-19", year:2017,
    institution:"Western Union Financial Services Inc.", institutionType:"MSB",
    penalty:184000000, penaltyDisplay:"$184M",
    agencies:["FinCEN","DOJ","FTC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — willful failure to implement AML program; processed payments for fraud schemes",
    program:"BSA / AML / MSB", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2016-05", date:"2016-10-03", year:2016,
    institution:"CG Technology d/b/a Cantor Gaming", institutionType:"Casino",
    penalty:22500000, penaltyDisplay:"$22.5M",
    agencies:["FinCEN","Nevada"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program at Nevada sports book",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2016-04", date:"2016-07-15", year:2016,
    institution:"Hawaiian Gardens Casino d/b/a The Gardens Casino", institutionType:"Casino",
    penalty:2800000, penaltyDisplay:"$2.8M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program at California card club",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2016-01", date:"2016-02-25", year:2016,
    institution:"Gibraltar Private Bank and Trust Company", institutionType:"Bank",
    penalty:4000000, penaltyDisplay:"$4M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2015-10", date:"2015-09-08", year:2015,
    institution:"Desert Palace Inc. d/b/a Caesars Palace", institutionType:"Casino",
    penalty:8000000, penaltyDisplay:"$8M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program; failed to file SARs for high-rollers",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2015-05", date:"2015-05-05", year:2015,
    institution:"Ripple Labs Inc.", institutionType:"MSB/Crypto",
    penalty:700000, penaltyDisplay:"$700K",
    agencies:["FinCEN","DOJ"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to register as MSB; sold XRP without implementing AML program",
    program:"BSA / AML / Crypto", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2015-02", date:"2015-03-06", year:2015,
    institution:"Trump Taj Mahal Casino Resort", institutionType:"Casino",
    penalty:10000000, penaltyDisplay:"$10M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — willful and repeated failure to implement AML program; third action against this casino",
    program:"BSA / AML / Casino", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2015-01", date:"2015-01-27", year:2015,
    institution:"Oppenheimer & Co. Inc.", institutionType:"Securities",
    penalty:20000000, penaltyDisplay:"$20M",
    agencies:["FinCEN","SEC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — repeat offender; willful failure to implement AML program and file SARs",
    program:"BSA / AML / Securities", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2014-01", date:"2014-01-07", year:2014,
    institution:"JPMorgan Chase Bank N.A.", institutionType:"Bank",
    penalty:461000000, penaltyDisplay:"$461M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — failure to file SARs related to Bernie Madoff ponzi scheme; processed hundreds of millions without reporting",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2013-01", date:"2013-09-23", year:2013,
    institution:"TD Bank N.A.", institutionType:"Bank",
    penalty:37500000, penaltyDisplay:"$37.5M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement AML program; processed $1B+ in suspicious transactions",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2012-02", date:"2012-12-11", year:2012,
    institution:"HSBC Bank USA N.A.", institutionType:"Bank",
    penalty:1256000000, penaltyDisplay:"$1.256B",
    agencies:["FinCEN","DOJ","OCC"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA/AML failures — processed $881B for sanctioned countries; $665M for drug cartels; systemic AML failures",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
    notes:"FinCEN portion of $1.92B global settlement",
  },
  {
    id:"F2010-01", date:"2010-03-17", year:2010,
    institution:"Wachovia Bank National Association", institutionType:"Bank",
    penalty:160000000, penaltyDisplay:"$160M",
    agencies:["FinCEN","OCC","DOJ"], voluntaryDisclosure:false, egregious:true,
    violation:"BSA violations — failed to monitor $378B through Mexican currency exchange houses linked to drug cartels",
    program:"BSA / AML / Narcotics", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2007-01", date:"2007-08-06", year:2007,
    institution:"American Express Bank International and American Express Travel Related Services", institutionType:"Bank/MSB",
    penalty:65000000, penaltyDisplay:"$65M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to file SARs on suspicious activity through private banking accounts",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2006-07", date:"2006-10-31", year:2006,
    institution:"Israel Discount Bank of New York", institutionType:"Bank",
    penalty:8000000, penaltyDisplay:"$8M",
    agencies:["FinCEN","NYDFS"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2006-03", date:"2006-04-26", year:2006,
    institution:"BankAtlantic", institutionType:"Bank",
    penalty:10000000, penaltyDisplay:"$10M",
    agencies:["FinCEN","OTS"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2005-05", date:"2005-12-19", year:2005,
    institution:"The New York Branch of ABN AMRO Bank N.V.", institutionType:"Bank",
    penalty:80000000, penaltyDisplay:"$80M",
    agencies:["FinCEN","DOJ"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — processed transactions for sanctioned countries by stripping wire transfer information",
    program:"BSA / AML / Sanctions", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2005-02", date:"2005-08-17", year:2005,
    institution:"The New York Branch of Arab Bank", institutionType:"Bank",
    penalty:24000000, penaltyDisplay:"$24M",
    agencies:["FinCEN","FDIC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program for high-risk correspondent accounts",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2004-02", date:"2004-10-12", year:2004,
    institution:"AmSouth Bank", institutionType:"Bank",
    penalty:10000000, penaltyDisplay:"$10M",
    agencies:["FinCEN","Federal Reserve"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to establish adequate AML program; failure to file SARs",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2004-01", date:"2004-05-13", year:2004,
    institution:"Riggs Bank NA", institutionType:"Bank",
    penalty:25000000, penaltyDisplay:"$25M",
    agencies:["FinCEN","OCC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to report suspicious transactions for Saudi Arabia and Equatorial Guinea government accounts; led to bank collapse",
    program:"BSA / AML / Foreign Government Accounts", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
    notes:"Largest CMP at time; led to Riggs Bank collapse and PNC acquisition",
  },
  {
    id:"F2003-02", date:"2003-03-06", year:2003,
    institution:"Western Union Financial Services Inc.", institutionType:"MSB",
    penalty:8000000, penaltyDisplay:"$8M",
    agencies:["FinCEN"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement AML program as large MSB money transmitter",
    program:"BSA / AML / MSB", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2003-01", date:"2003-01-16", year:2003,
    institution:"Banco Popular de Puerto Rico", institutionType:"Bank",
    penalty:21000000, penaltyDisplay:"$21M",
    agencies:["FinCEN","FDIC"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement effective AML program",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  },
  {
    id:"F2002-01", date:"2002-04-08", year:2002,
    institution:"Sovereign Bank", institutionType:"Bank",
    penalty:1000000, penaltyDisplay:"$1M",
    agencies:["FinCEN","OTS"], voluntaryDisclosure:false, egregious:false,
    violation:"BSA violations — failure to implement AML program",
    program:"BSA / AML", sourceUrl:"https://www.fincen.gov/news/enforcement-actions",
  }
];


export function getFinCENByYear(year?: number): FinCENPenalty[] {
  const records = year
    ? FINCEN_PENALTIES.filter(p => p.year === year)
    : [...FINCEN_PENALTIES];
  return records.sort((a, b) => b.date.localeCompare(a.date));
}

export function getFinCENYears(): number[] {
  return [...new Set(FINCEN_PENALTIES.map(p => p.year))].sort((a,b) => b-a);
}

export function finCENTotalByYear(year: number): number {
  return FINCEN_PENALTIES
    .filter(p => p.year === year)
    .reduce((sum, p) => sum + p.penalty, 0);
}
