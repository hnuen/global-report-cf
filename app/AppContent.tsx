"use client";
// v6 cache bust CF
import { useState, useEffect, useCallback, useRef } from "react";
import { SANCTIONS_PROGRAMS } from "@/src/lib/sanctions-programs-library";


const css = `
/* fonts loaded via layout.tsx */
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --ink:#111111;--paper:#ffffff;--paper2:#f5f5f5;
  --gold:#111111;--gold2:#cc0000;
  --c-san:#cc0000;--c-eco:#1a56db;--c-rel:#15803d;
  --c-occ:#b45309;--c-pen:#0369a1;--c-bis:#6d28d9;
  --rule:#e5e7eb;--muted:#6b7280;--mono:'IBM Plex Mono',monospace
}
body{background:#ffffff}
.app{min-height:100vh;background:var(--paper);color:var(--ink);font-family:'IBM Plex Sans',sans-serif}
.app{overflow-x:hidden;max-width:100vw}
.masthead{background:#ffffff}
.mast-inner{max-width:1140px;margin:0 auto;padding:14px 20px 11px;display:flex;justify-content:center;align-items:center;border-bottom:2px solid #e5e7eb}
.mast-l,.mast-r{font-family:var(--mono);font-size:.6rem;color:#9ca3af;letter-spacing:.1em;text-transform:uppercase;line-height:1.8}
.mast-r{text-align:right}
.pub-name{font-family:'Playfair Display',serif;font-size:clamp(1rem,2.4vw,1.7rem);font-weight:900;letter-spacing:.09em;text-transform:uppercase;color:#111111;line-height:1;display:block;text-align:center}
.pub-tag{font-family:var(--mono);font-size:.48rem;color:#6b7280;letter-spacing:.14em;text-transform:uppercase;margin-top:4px;display:block;text-align:center}
.sec-nav{background:#f9fafb;border-bottom:1px solid #e5e7eb;overflow-x:auto;-webkit-overflow-scrolling:touch}
.sec-nav-inner{max-width:1140px;margin:0 auto;display:flex;min-width:0}
.sec-tab{flex:1;padding:10px 4px;background:transparent;border:none;border-right:1px solid #e5e7eb;color:#6b7280;font-family:'Playfair Display',serif;font-size:.7rem;font-style:italic;cursor:pointer;transition:all .2s;text-align:center;white-space:nowrap}
.sec-tab:last-child{border-right:none}
.sec-tab:hover{color:#111111;background:#f3f4f6}
.sec-tab.sanctions.active{color:#cc0000;background:#ffffff;border-bottom:2px solid #cc0000}
.sec-tab.economics.active{color:#1a56db;background:#ffffff;border-bottom:2px solid #1a56db}
.sec-tab.regions.active{color:#15803d;background:#ffffff;border-bottom:2px solid #15803d}
.sec-tab.occ.active{color:#b45309;background:#ffffff;border-bottom:2px solid #b45309}
.sec-tab.penalties.active{color:#0369a1;background:#ffffff;border-bottom:2px solid #0369a1}
.sec-tab.bis.active{color:#6d28d9;background:#ffffff;border-bottom:2px solid #6d28d9}
.sec-tab.all.active{color:#111111;background:#ffffff;border-bottom:2px solid #111111}
.san-search{background:#fef2f2;border-bottom:1px solid #fca5a5;padding:8px 20px}
.san-inner{max-width:1140px;margin:0 auto;display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.san-lbl{font-family:var(--mono);font-size:.55rem;color:#cc0000;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.san-q{background:#ffffff;border:1px solid #d1d5db;border-radius:3px;padding:7px 10px;color:#111111;font-family:var(--mono);font-size:.72rem;outline:none;flex:1;min-width:110px}
.san-q:focus{border-color:var(--c-san)}
.san-q::placeholder{color:#9ca3af}
.date-in{background:#ffffff;border:1px solid #d1d5db;border-radius:3px;padding:7px 8px;color:#111111;font-family:var(--mono);font-size:.65rem;outline:none;width:112px}
.date-in:focus{border-color:#cc0000}
.san-go{padding:7px 13px;background:#cc0000;border:none;border-radius:3px;color:#ffffff;font-family:'Playfair Display',serif;font-size:.72rem;font-style:italic;cursor:pointer}
.san-go:hover{background:#aa0000}
.san-x{padding:7px 10px;background:transparent;border:1px solid #d1d5db;border-radius:3px;color:#6b7280;font-family:var(--mono);font-size:.6rem;cursor:pointer}
.san-x:hover{border-color:#cc0000}
.ctrl-bar{background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:5px 20px}
.ctrl-inner{max-width:1140px;margin:0 auto;display:flex;flex-direction:column;gap:0}
.ctrl-main{display:flex;align-items:center;gap:8px;flex-wrap:nowrap;overflow:hidden;padding:5px 0}
.ctrl-regions{display:flex;align-items:center;gap:6px;padding:3px 0 5px;border-top:1px solid #f3f4f6;flex-wrap:wrap}
.pill{padding:4px 10px;border-radius:3px;border:1px solid #d1d5db;background:transparent;color:#374151;font-family:var(--mono);font-size:.58rem;letter-spacing:.07em;cursor:pointer;transition:all .15s;white-space:nowrap}
.pill:hover{border-color:#111111;color:#111111}.pill.on{background:#111111;border-color:#111111;color:#ffffff}
.tlbl{font-family:var(--mono);font-size:.58rem;color:#9ca3af;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}

.live-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;display:inline-block;animation:pulse 2s infinite;margin-right:4px;vertical-align:middle}
.spin-dot{width:6px;height:6px;border-radius:50%;background:var(--gold2);display:inline-block;animation:pulse .8s infinite;margin-right:4px;vertical-align:middle}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.upd-text{font-family:var(--mono);font-size:.58rem;color:#6b7280}
.refresh-btn{padding:4px 12px;border:1px solid #374151;border-radius:3px;background:transparent;color:#374151;font-family:var(--mono);font-size:.58rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s;margin-left:auto}
.refresh-btn:hover:not(:disabled){background:#111111;color:#ffffff}
.refresh-btn:disabled{opacity:.45;cursor:not-allowed}
.spin{display:inline-block;animation:spin .7s linear infinite;margin-right:4px}
@keyframes spin{to{transform:rotate(360deg)}}
.topic-input{background:#ffffff;border:1px solid #d1d5db;border-radius:3px;padding:4px 8px;color:#111111;font-family:var(--mono);font-size:.58rem;outline:none;width:160px}
.topic-input:focus{border-color:#374151}
.topic-input::placeholder{color:#9ca3af}
.layout{max-width:1140px;margin:0 auto;padding:20px 20px 56px;display:grid;grid-template-columns:1fr 252px;gap:28px}
.sec-banner{display:flex;align-items:center;gap:8px;margin-bottom:13px;padding-bottom:6px;border-bottom:2px solid var(--ink)}
.sec-stripe{width:4px;height:20px;border-radius:2px;flex-shrink:0}
.stripe-sanctions{background:var(--c-san)}.stripe-economics{background:var(--c-eco)}
.stripe-regions{background:var(--c-rel)}.stripe-occ{background:var(--c-occ)}
.stripe-penalties{background:var(--c-pen)}.stripe-bis{background:var(--c-bis)}.stripe-all{background:var(--gold)}
.sec-title{font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:var(--ink)}
.sec-count{font-family:var(--mono);font-size:.58rem;color:var(--muted);margin-left:auto}
.article{padding:16px 0;border-bottom:1px solid var(--rule);animation:fadeUp .32s ease both}
@keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
.art-meta{display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap}
.art-tag{font-family:var(--mono);font-size:.52rem;font-weight:500;letter-spacing:.13em;text-transform:uppercase;padding:2px 5px;border-radius:2px;flex-shrink:0}
.t-san{background:#8b1a1a18;color:var(--c-san);border:1px solid #8b1a1a30}
.t-eco{background:#1a3a8b18;color:var(--c-eco);border:1px solid #1a3a8b30}
.t-rel{background:#2a6b3a18;color:var(--c-rel);border:1px solid #2a6b3a30}
.t-occ{background:#6b4a1a18;color:var(--c-occ);border:1px solid #6b4a1a30}
.t-pen{background:#1a5a6b18;color:var(--c-pen);border:1px solid #1a5a6b30}
.t-bis{background:#4a1a6b18;color:var(--c-bis);border:1px solid #4a1a6b30}
.stag{font-family:var(--mono);font-size:.5rem;letter-spacing:.12em;text-transform:uppercase;padding:2px 5px;border-radius:2px;flex-shrink:0}
.stag-sanctions{background:var(--c-san);color:#fce8e8}.stag-economics{background:var(--c-eco);color:#e8ecfc}
.stag-regions{background:var(--c-rel);color:#e8fcea}.stag-occ{background:var(--c-occ);color:#fceee8}
.stag-penalties{background:var(--c-pen);color:#e8f8fc}.stag-bis{background:var(--c-bis);color:#f0e8fc}
.art-region{font-family:var(--mono);font-size:.6rem;color:var(--muted)}
.art-date{font-family:var(--mono);font-size:.6rem;color:#b8a880;margin-left:auto;white-space:nowrap}
.idot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.d-high{background:var(--c-san)}.d-medium{background:var(--gold2)}.d-low{background:#4a7a4a}
.art-hl{font-family:'Playfair Display',serif;font-size:clamp(.88rem,1.5vw,1.1rem);font-weight:700;line-height:1.28;color:var(--ink);margin-bottom:7px}
.art-body{font-size:.84rem;line-height:1.76;color:#374151;font-weight:300}
.art-body p{margin-bottom:8px}.art-body p:last-child{margin-bottom:0}
.art-source{margin-top:7px;display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.src-lbl{font-family:var(--mono);font-size:.5rem;color:#9ca3af;letter-spacing:.1em;text-transform:uppercase}
.src-link{font-family:var(--mono);font-size:.56rem;color:#1a56db;text-decoration:none}
.src-link:hover{color:#cc0000;text-decoration:underline}
.more-btn{margin-top:7px;font-family:var(--mono);font-size:.56rem;letter-spacing:.11em;text-transform:uppercase;color:#374151;cursor:pointer;display:inline-flex;align-items:center;gap:3px;border:none;background:none;padding:0}
.more-btn:hover{color:#cc0000}
.sb-section{margin-bottom:16px}
.sb-head{font-family:'Playfair Display',serif;font-size:.7rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:3px;margin-bottom:8px}
.sb-item{padding:6px 0;border-bottom:1px solid #e5e7eb;font-size:.66rem;color:#374151;line-height:1.5}
.sb-item strong{font-weight:500;display:block;margin-bottom:1px;color:#111111;font-size:.7rem}
.sb-lbl{font-family:var(--mono);font-size:.48rem;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.sb-note{margin-top:2px;font-size:.6rem;color:#6b7280}
.kf-val{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;line-height:1}
.kv-san{color:var(--c-san)}.kv-eco{color:var(--c-eco)}.kv-rel{color:var(--c-rel)}
.kv-occ{color:var(--c-occ)}.kv-pen{color:var(--c-pen)}.kv-bis{color:var(--c-bis)}
.sec-div{font-family:'Playfair Display',serif;font-size:.62rem;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#9ca3af;border-bottom:1px solid var(--rule);padding-bottom:3px;margin-bottom:7px}
.empty-s{padding:28px 0;font-family:'Playfair Display',serif;font-style:italic;color:var(--muted);font-size:.9rem}
.page-loading{padding:60px 20px;text-align:center;font-family:var(--mono);font-size:.7rem;color:var(--muted);letter-spacing:.15em;text-transform:uppercase}
.err-msg{font-family:var(--mono);font-size:.56rem;color:var(--c-san)}
.hint{padding-top:16px;border-top:1px solid #e5e7eb;font-family:var(--mono);font-size:.54rem;color:#9ca3af;line-height:1.9}
.pen-table{width:100%;border-collapse:collapse;font-size:.78rem}
.pen-table th{text-align:left;font-family:var(--mono);font-size:.58rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:8px 10px;border-bottom:2px solid #111;cursor:pointer;white-space:nowrap}
.pen-table th:hover{color:#111}
.pen-table td{padding:9px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;line-height:1.5}
.pen-table tr:hover td{background:#f9fafb}
.pen-amount{font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;color:#cc0000}
.pen-inst{font-weight:500;color:#111;margin-bottom:2px}
.pen-viol{font-size:.72rem;color:#6b7280;margin-top:2px}
.pen-badge{display:inline-block;font-size:.55rem;padding:2px 6px;border-radius:3px;font-family:var(--mono);letter-spacing:.06em;text-transform:uppercase;margin-right:4px;margin-top:2px}
.pb-ofac{background:#fef2f2;color:#cc0000}
.pb-fincen{background:#eff6ff;color:#1a56db}
.pb-occ{background:#fffbeb;color:#b45309}
.pb-fed{background:#f0fdf4;color:#15803d}
.pb-cfpb{background:#faf5ff;color:#6d28d9}
.pb-bis{background:#f0f9ff;color:#0369a1}
.pb-eu{background:#eff6ff;color:#1a56db}
.pb-uk{background:#f0fdf4;color:#15803d}
.pb-doj{background:#fef2f2;color:#cc0000}
.pen-tabs{display:flex;gap:0;border-bottom:2px solid #111;margin-bottom:14px}
.pen-tab-btn{padding:7px 16px;border:none;background:transparent;font-family:'Playfair Display',serif;font-size:13px;font-style:italic;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-2px}
.pen-tab-btn.active{color:#111;border-bottom-color:#111;font-weight:500}
.pen-tab-btn:hover{color:#111}
.pen-year-btns{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px}
.pen-sort-row{display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap}
.pen-total{font-family:var(--mono);font-size:.6rem;color:#6b7280;margin-left:auto}
.gs-wrap{background:#f8fafc;border-bottom:2px solid #111;padding:10px 20px}
.gs-inner{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.gs-lbl{font-family:var(--mono);font-size:.55rem;color:#374151;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}
.gs-input{flex:1;min-width:200px;background:#fff;border:1px solid #d1d5db;border-radius:3px;padding:7px 10px;color:#111;font-family:var(--mono);font-size:.72rem;outline:none}
.gs-inline{width:200px;background:#fff;border:1px solid #374151;border-radius:3px;padding:4px 8px;color:#111;font-family:var(--mono);font-size:.65rem;outline:none;transition:width .2s}
.gs-input:focus{border-color:#111}
.gs-btn{padding:7px 14px;background:#111;border:none;border-radius:3px;color:#fff;font-family:'Playfair Display',serif;font-size:.72rem;font-style:italic;cursor:pointer;white-space:nowrap}
.gs-btn:hover{background:#374151}
.gs-btn:disabled{opacity:.5;cursor:not-allowed}
.gs-close{padding:7px 10px;background:transparent;border:1px solid #d1d5db;border-radius:3px;color:#6b7280;font-family:var(--mono);font-size:.6rem;cursor:pointer}
.gs-result{padding:14px 0;border-bottom:1px solid #e5e7eb}
.gs-result:last-child{border-bottom:none}
.gs-rtitle{font-family:'Playfair Display',serif;font-size:1.05rem;font-weight:700;color:#111;line-height:1.3;margin-bottom:4px}
.gs-rtitle a{color:#111;text-decoration:none}
.gs-rtitle a:hover{color:#cc0000;text-decoration:underline}
.gs-rmeta{display:flex;gap:10px;align-items:center;margin-bottom:6px;flex-wrap:wrap}
.gs-rsource{font-family:var(--mono);font-size:.62rem;color:#1a56db;font-weight:500}
.gs-rdate{font-family:var(--mono);font-size:.6rem;color:#9ca3af}
.gs-rrel{font-size:.55rem;padding:2px 6px;border-radius:3px;font-family:var(--mono);letter-spacing:.06em}
.gs-rrel-high{background:#fef2f2;color:#cc0000}
.gs-rrel-med{background:#fffbeb;color:#b45309}
.gs-rrel-low{background:#f9fafb;color:#6b7280}
.gs-rbrief{font-size:.82rem;color:#374151;line-height:1.65}
.gs-rtags{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}
.gs-rtag{font-size:.55rem;padding:2px 7px;background:#f3f4f6;border-radius:10px;color:#6b7280;font-family:var(--mono)}
.gs-panel{max-width:780px;margin:0 auto;padding:16px 20px}
.gs-empty{font-family:var(--mono);font-size:.7rem;color:#9ca3af;padding:20px 0;text-align:center}
.ofac-prog-panel{padding:0 0 24px 0}
.ofac-prog-header{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.ofac-prog-select{font-family:var(--mono);font-size:.72rem;padding:6px 10px;border:1.5px solid #111;border-radius:3px;background:#fff;cursor:pointer;min-width:320px;max-width:100%}
.ofac-prog-select:focus{outline:2px solid #cc0000;outline-offset:1px}
.ofac-prog-badge{font-family:var(--mono);font-size:.58rem;padding:2px 8px;border-radius:10px;font-weight:500;letter-spacing:.05em}
.ofac-prog-badge.active{background:#dcfce7;color:#166534}
.ofac-prog-badge.residual{background:#fef9c3;color:#854d0e}
.ofac-prog-note{font-family:var(--mono);font-size:.62rem;color:#6b7280;padding:8px 12px;background:#f9fafb;border-left:3px solid #e5e7eb;margin-bottom:14px;line-height:1.6}
.ofac-prog-section{margin-bottom:20px}
.ofac-prog-section-title{font-family:var(--mono);font-size:.62rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#374151;margin-bottom:8px;padding-bottom:4px;border-bottom:1.5px solid #e5e7eb;display:flex;align-items:center;gap:8px}
.ofac-prog-section-title span{color:#9ca3af;font-weight:400}
.ofac-prog-table{width:100%;border-collapse:collapse;font-size:.78rem}
.ofac-prog-table th{text-align:left;font-family:var(--mono);font-size:.56rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;padding:7px 10px;border-bottom:2px solid #111;white-space:nowrap}
.ofac-prog-table td{padding:8px 10px;border-bottom:1px solid #e5e7eb;vertical-align:top;line-height:1.5}
.ofac-prog-table tr:hover td{background:#fef2f2}
.ofac-prog-table td:first-child{font-family:var(--mono);font-size:.65rem;font-weight:600;color:#111;white-space:nowrap}
.ofac-prog-table td:nth-child(2){color:#374151;max-width:420px}
.ofac-prog-table td:last-child{font-family:var(--mono);font-size:.6rem;color:#6b7280;white-space:nowrap}
.ofac-prog-link{color:#1a56db;text-decoration:none;font-size:.65rem;font-family:var(--mono)}
.ofac-prog-link:hover{text-decoration:underline}
.ofac-prog-empty{font-family:var(--mono);font-size:.65rem;color:#9ca3af;padding:10px 0;font-style:italic}
.ofac-prog-url{font-family:var(--mono);font-size:.58rem;color:#9ca3af;margin-left:6px}
.show-more-btn{width:100%;padding:8px 0;border:1px dashed #d1d5db;border-radius:3px;background:transparent;font-family:var(--mono);font-size:.62rem;color:#6b7280;cursor:pointer;margin-top:4px;letter-spacing:.05em}
.show-more-btn:hover{border-color:#111;color:#111;background:#f9fafb}
.ofac-update-panel{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:12px 14px;margin-bottom:14px}
.ofac-update-panel.checking{background:#fefce8;border-color:#fde047}
.ofac-update-panel.none{background:#f9fafb;border-color:#e5e7eb}
.ofac-update-meta{font-family:var(--mono);font-size:.58rem;color:#6b7280;margin-top:6px}
.live-fallback{background:#f0fdf4;border:1px solid #86efac}
.show-more-btn{width:100%;padding:8px 0;border:1px dashed #d1d5db;border-radius:3px;background:transparent;font-family:var(--mono);font-size:.62rem;color:#6b7280;cursor:pointer;margin-top:4px;letter-spacing:.05em}
.show-more-btn:hover{border-color:#111;color:#111;background:#f9fafb}
.ofac-update-panel{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:12px 14px;margin-bottom:14px}
.ofac-update-panel.checking{background:#fefce8;border-color:#fde047}
.ofac-update-panel.none{background:#f9fafb;border-color:#e5e7eb}
.ofac-update-meta{font-family:var(--mono);font-size:.58rem;color:#6b7280;margin-top:6px}
.live-fallback{background:#f0fdf4;border:1px solid #86efac;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-family:var(--mono);font-size:.62rem;color:#15803d;letter-spacing:.05em}
.live-result{padding:12px 0;border-bottom:1px solid #e5e7eb}
.live-result:last-child{border-bottom:none}
.live-rtitle{font-family:'Playfair Display',serif;font-size:.95rem;font-weight:700;color:#111;line-height:1.3;margin-bottom:4px}
.live-rtitle a{color:#111;text-decoration:none}
.live-rtitle a:hover{color:#cc0000;text-decoration:underline}
.live-rmeta{display:flex;gap:8px;align-items:center;margin-bottom:5px;flex-wrap:wrap}
.live-rsource{font-family:var(--mono);font-size:.58rem;color:#1a56db}
.live-rdate{font-family:var(--mono);font-size:.58rem;color:#9ca3af}
.live-rbrief{font-size:.8rem;color:#374151;line-height:1.6}
.live-rtags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.live-rtag{font-size:.52rem;padding:1px 6px;background:#f3f4f6;border-radius:10px;color:#6b7280;font-family:var(--mono)}
.b-egregious{background:#fef2f2;color:#cc0000;font-family:var(--mono);font-size:.55rem;padding:2px 6px;border-radius:3px;letter-spacing:.06em}
.b-vsd{background:#f0fdf4;color:#15803d;font-family:var(--mono);font-size:.55rem;padding:2px 6px;border-radius:3px;letter-spacing:.06em}
.fincen-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb}
.fincen-stat{font-size:12px;color:#6b7280;font-family:var(--font-mono)}
.fincen-stat b{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#cc0000;display:block}
/* Key-figures compact strip — mobile only, hidden on desktop */
.kf-strip{display:none;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;
  gap:0;border-bottom:1px solid #e5e7eb;background:#fafafa;padding:0 4px;margin-bottom:10px}
.kf-strip::-webkit-scrollbar{display:none}
.kf-chip{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;padding:8px 14px;
  border-right:1px solid #e5e7eb;min-width:80px}
.kf-chip:last-child{border-right:none}
.kf-chip-val{font-family:'Playfair Display',serif;font-size:.95rem;font-weight:700;line-height:1.1}
.kf-chip-lbl{font-family:'IBM Plex Mono',monospace;font-size:.44rem;letter-spacing:.1em;
  text-transform:uppercase;color:#9ca3af;margin-top:2px;text-align:center;white-space:nowrap}



`;

interface Article {
  id: number; section: string; category: string; region: string;
  impact: string; date: string; headline: string; body: string[];
  source: string; sourceUrl: string;
}
interface Briefing {
  lastUpdated: string; articles: Article[];
  sidebar: Record<string, { watchlist: {entity:string;type:string;note:string;url?:string}[]; keyFigures: {label:string;value:string}[] }>;
}
interface PenaltyRecord {
  id: string; year: number; date: string; institution: string; type: string;
  regulator: string; program: string; amount: number; amountDisplay: string;
  currency: string; violation: string; jurisdiction: string; sourceUrl: string;
}
interface FinCENPenalty {
  id: string; date: string; year: number; institution: string; institutionType: string;
  penalty: number; penaltyDisplay: string; agencies: string[]; violation: string;
  program: string; voluntaryDisclosure: boolean; egregious: boolean; sourceUrl: string; notes?: string;
}

const SECTIONS = ["all","sanctions","economics","regions","occ","penalties","bis"];

// Static sidebar data — always shown regardless of LLM status
const STATIC_SIDEBAR: Record<string, { watchlist: {entity:string;type:string;note:string;url?:string}[]; keyFigures: {label:string;value:string}[] }> = {
  sanctions: {
    keyFigures: [
      {label:"OFAC SDN List entries (approx)", value:"13,000+"},
      {label:"EU 20th package designations", value:"120"},
      {label:"GL 134C expiry (Russian oil)", value:"Jun 17"},
      {label:"Economic Fury Iran actions since Feb 2025", value:"1,000+"},
    ],
    watchlist: [
      {entity:"EU Council Sanctions (consilium.europa.eu)", type:"EU Official Source", note:"All EU restrictive measures — press releases + RSS", url:"https://www.consilium.europa.eu/en/press/press-releases/?keyword=sanctions"},
      {entity:"UK OFSI — Financial Sanctions", type:"UK Official Source", note:"OFSI enforcement, penalties, guidance", url:"https://www.gov.uk/government/organisations/office-of-financial-sanctions-implementation"},
      {entity:"Russia GL 134C Wind-Down", type:"General Licence", note:"Expires June 17 — OFAC general licences page", url:"https://ofac.treasury.gov/recent-actions/general-licenses"},
      {entity:"Adani $275M Settlement", type:"OFAC Enforcement", note:"Iran LPG — largest non-US company OFAC penalty 2026", url:"https://ofac.treasury.gov/recent-actions/20260518"},
      {entity:"UN SC Sanctions Committees", type:"UN Official", note:"All active UN sanctions regimes", url:"https://www.un.org/securitycouncil/sanctions/information"},
    ]
  },
  economics: {
    keyFigures: [
      {label:"U.S. CPI (March 2026)", value:"3.3%"},
      {label:"Fed Chair (from May 15)", value:"K. Warsh"},
      {label:"ECB rates (Apr 30 decision)", value:"Held"},
      {label:"IEA Q2 demand contraction", value:"1.5 mbpd"},
    ],
    watchlist: [
      {entity:"Kevin Warsh — Fed Chair", type:"Leadership", note:"Confirmed — Powell term expired May 15, 2026", url:"https://www.federalreserve.gov/newsevents/pressreleases.htm"},
      {entity:"Strait of Hormuz", type:"Geopolitics", note:"Effective closure driving global energy price shock", url:"https://www.iea.org/topics/oil-market-report"},
      {entity:"Germany Sanctions Act", type:"Regulatory", note:"In force Feb 6 — fines up to €40M, circumvention criminal", url:"https://www.nortonrosefulbright.com/en/knowledge/publications/70ad8666/spotlight-on-sanctions"},
    ]
  },
  regions: {
    keyFigures: [
      {label:"Pope Leo XIV Africa journey countries", value:"4"},
      {label:"U.S. Christians (Pew 2026)", value:"62%"},
    ],
    watchlist: [
      {entity:"Magnifica Humanitas", type:"Encyclical", note:"Leo XIV first encyclical — AI + social doctrine", url:"https://www.vaticannews.va/en/pope.html"},
      {entity:"Lebanon Sectarian Tensions", type:"Security", note:"Hizballah designations reignite fault lines May 2026", url:"https://home.treasury.gov/news/press-releases/sb0505"},
    ]
  },
  occ: {
    keyFigures: [
      {label:"Federal Savings Bank VA originations", value:"$10.8B"},
      {label:"OCC consent order (Apr 2026)", value:"2nd in 5yrs"},
    ],
    watchlist: [
      {entity:"Federal Savings Bank Chicago", type:"Consent Order", note:"Restitution consultant required within 90 days", url:"https://www.occ.gov/news-events/newsroom/news-issuances-by-year/news-releases/2026-news-releases.html"},
      {entity:"AI Model Risk", type:"Supervisory Priority", note:"OCC top examination priority for 2026", url:"https://www.occ.gov/news-events/newsroom/news-issuances-by-year/news-releases/2026-news-releases.html"},
      {entity:"GENIUS Act Stablecoin Rule", type:"Proposed Rule", note:"OCC rulemaking — comment period open", url:"https://www.occ.gov/news-issuances/news-releases/2026/nr-occ-2026-9.html"},
    ]
  },
  penalties: {
    keyFigures: [
      {label:"OFAC 2026 actions (YTD)", value:"4"},
      {label:"OFAC 2025 total penalties", value:"$265.7M"},
      {label:"Largest OFAC 2026 (Adani)", value:"$275M"},
      {label:"Largest FinCEN ever (Binance)", value:"$3.4B"},
      {label:"Largest bank BSA (TD Bank)", value:"$1.34B"},
      {label:"Total OFAC 2023 (Binance)", value:"$968.6M"},
    ],
    watchlist: [
      {entity:"OFAC Self-Disclosure Portal", type:"Process Change", note:"Launched Feb 6, 2026 — now required for all VSDs", url:"https://ofac.treasury.gov/civil-penalties-and-enforcement-information"},
      {entity:"Adani Enterprises $275M", type:"2026 Settlement", note:"Iran LPG via shadow fleet, EGREGIOUS, non-VSD", url:"https://ofac.treasury.gov/recent-actions/20260518"},
      {entity:"Canaccord Genuity $80M", type:"2026 BSA Record", note:"Largest broker-dealer BSA penalty ever", url:"https://www.fincen.gov/news/news-releases"},
      {entity:"OFAC Civil Penalties", type:"Official Source", note:"All years: 2003–2026", url:"https://ofac.treasury.gov/civil-penalties-and-enforcement-information"},
      {entity:"FinCEN Enforcement Actions", type:"Official Source", note:"fincen.gov/news/enforcement-actions", url:"https://www.fincen.gov/news/enforcement-actions"},
    ]
  },
  bis: {
    keyFigures: [
      {label:"Applied Materials BIS penalty", value:"$252.5M"},
      {label:"BIS FY2026 budget increase", value:"23%"},
      {label:"AI chips diverted (Op. Gatekeeper)", value:"$160M+"},
    ],
    watchlist: [
      {entity:"Applied Materials $252.5M", type:"BIS Enforcement", note:"Routing via Korea no defence; 2-yr annual audits", url:"https://www.bis.gov/press-releases"},
      {entity:"50% Affiliates Rule", type:"BIS Policy", note:"Entity List subsidiaries auto-restricted — strict liability", url:"https://www.bis.gov/licensing/policy-guidance"},
      {entity:"Semiconductor Export Controls", type:"Priority", note:"AI chips, quantum, dual-use — enhanced diversion scrutiny", url:"https://www.bis.gov/export-controls"},
    ]
  },
};
const LABELS: Record<string,string> = {all:"All",sanctions:"Sanctions",economics:"Economics",regions:"Regions",occ:"OCC",penalties:"Penalties",bis:"BIS / Export"};
const REGIONS: Record<string,string[]> = {
  all:["All"], sanctions:["All","Iran","DPRK","Russia","Cuba","Venezuela","EU / Europe","UK","China / HK","MEA","India / Pakistan","SEA","Global"],
  economics:["All","United States","Europe","Global"], regions:["All","Africa","Middle East","Southeast Asia","South Asia","Central Asia","United Kingdom","United States","Europe","Global"],
  occ:["All","United States"], penalties:["All"], bis:["All","United States / China","China / Global","United States"],
};
const tagCls = (s:string) => ({sanctions:"t-san",economics:"t-eco",regions:"t-rel",occ:"t-occ",penalties:"t-pen",bis:"t-bis"}[s]||"t-san");
const kvCls  = (s:string) => ({sanctions:"kv-san",economics:"kv-eco",regions:"kv-rel",occ:"kv-occ",penalties:"kv-pen",bis:"kv-bis"}[s]||"kv-san");

const MONTHS: Record<string,number> = {january:0,february:1,march:2,april:3,may:4,june:5,july:6,august:7,september:8,october:9,november:10,december:11};
const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"];

// Format YYYY-MM-DD to "May 31, 2026" for display
const formatDisplayDate = (d:string): string => {
  if (!d) return d;
  // Already formatted (not ISO)
  if (!d.match(/^\d{4}-\d{2}-\d{2}$/)) return d;
  const [y,m,day] = d.split('-');
  return `${MONTH_NAMES[parseInt(m)-1]} ${parseInt(day)}, ${y}`;
};

const parseDate = (d:string): number => {
  if (!d) return 0;
  try {
    const M: Record<string,number> = {january:0,february:1,march:2,april:3,may:4,june:5,
      july:6,august:7,september:8,october:9,november:10,december:11};
    // "May 29, 2026" or "May 29 2026"
    const mdy = d.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (mdy && M[mdy[1].toLowerCase()] !== undefined)
      return new Date(+mdy[3], M[mdy[1].toLowerCase()], +mdy[2]).getTime();
    // "March 6, 2026" format already handled above
    // "May 2026" — month year only
    const my = d.match(/^(\w+)\s+(\d{4})$/i);
    if (my && M[my[1].toLowerCase()] !== undefined)
      return new Date(+my[2], M[my[1].toLowerCase()], 1).getTime();
    // ISO or other formats
    const t = new Date(d).getTime();
    return isNaN(t) ? 0 : t;
  } catch { return 0; }
};
const OFAC_SOURCE_PATTERNS = [
  "ofac.treasury.gov", "OFAC", "U.S. Treasury", "Treasury Press Release",
];
const isOFACArticle = (a: Article) =>
  OFAC_SOURCE_PATTERNS.some(p =>
    (a.source||"" ).includes(p) || (a.sourceUrl||"").includes("ofac.treasury.gov") || (a.sourceUrl||"").includes("home.treasury.gov")
  );

// Decode HTML entities (&#39; → ', &amp; → &, etc.)
const decodeEntities = (s: string): string => {
  if (!s || !s.includes("&")) return s;
  return s
    .replace(/&#39;/g, "\'")
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&apos;/g, "\'")
    .replace(/&#x27;/g, "\'")
    .replace(/&nbsp;/g, " ");
};

// Explicit keyword sets for each sanctions region tab.
// Match is checked against BOTH article.region (from server) AND article.headline.
// Keep region lists TIGHT — only keywords that unambiguously belong to that region.
const REGION_MATCH: Record<string, string[]> = {
  // US program / country-specific OFAC programs
  "Iran":             ["iran", "irgc", "economic fury", "tehran", "persian"],
  "DPRK":             ["dprk", "north korea", "pyongyang", "kim jong", "korean people"],
  "Russia":           ["russia", "ukraine", "rosneft", "lukoil", "kremlin", "moscow", "zelensky", "zelenskyy"],
  "Cuba":             ["cuba", "gaesa", "havana", "cuban"],
  "Venezuela":        ["venezuela", "maduro", "pdvsa", "caracas", "venezuelan", "venezuela sanctions"],
  // European bodies — exclude UK (not in EU post-Brexit)
  "EU / Europe":      ["eu / europe", "eu council", "consilium.europa.eu", "european commission",
                       "european union", "eu sanctions", "eu restrictive", "balkans", "eu external action"],
  // UK bodies only
  "UK":               ["uk", " / uk", "united kingdom", "ofsi", "hm treasury", "british",
                       "britain", "london", "gov.uk"],
  // China / Hong Kong — specific programs & keywords
  "China / HK":       ["china / hk", "china / hong kong", "hong kong", "xinjiang", "ccmc",
                       "uyghur", "chinese military", "caatsa china", "cmic", "prc export",
                       "beijing chip", "huawei", "smic", "byd sanction", "china sanction"],
  // Middle East & Africa — explicit country list, no Iran (has own tab)
  "MEA":              ["mea", "middle east", "iraq", "syria", "lebanon", "israel", "gaza",
                       "west bank", "yemen", "sudan", "somalia", "libya", "mali", "ethiopia",
                       "congo", "drc", "south sudan", "caf", "central african",
                       "hizballah", "hezbollah", "hamas", "al-shabaab"],
  // India & Pakistan — bilateral + regional
  "India / Pakistan": ["india", "pakistan", "india / pakistan", "new delhi", "islamabad",
                       "karachi", "lahore", "balochistan", "kashmir"],
  // Southeast Asia — explicit country list
  "SEA":              ["sea", "southeast asia", "myanmar", "burma", "vietnam", "thailand",
                       "singapore", "malaysia", "philippines", "indonesia", "cambodia",
                       "laos", "brunei", "timor"],
};

// Source names whose articles belong to specific regions regardless of headline
const SOURCE_REGION_OVERRIDES: Record<string, string> = {
  "UK OFSI":         "UK",
  "UK Sanctions":    "UK",
  "UK Government":   "UK",
  "EU Council":      "EU / Europe",
  "EU External":     "EU / Europe",
  "EU Sanctions":    "EU / Europe",
  // New targeted sources
  "Singapore ASEAN": "SEA",
  "Al Jazeera Pakistan Iran": "India / Pakistan",
};

const SPECIFIC_REGION_KEYS = Object.keys(REGION_MATCH);

const articleMatchesRegion = (a: Article, reg: string): boolean => {
  if (reg === "All") return true;
  const ar  = (a.region  || "").toLowerCase();
  const hl  = (a.headline|| "").toLowerCase();
  const src = (a.source  || "");

  // Check source-based override first
  for (const [srcKey, srcReg] of Object.entries(SOURCE_REGION_OVERRIDES)) {
    if (src.includes(srcKey)) {
      if (reg === "Global") return false; // source-pinned articles excluded from Global
      return reg === srcReg;
    }
  }

  if (reg === "Global") {
    // Global = doesn\'t match any specific named region
    return !SPECIFIC_REGION_KEYS.some(rk => {
      const kws = REGION_MATCH[rk] || [];
      return kws.some(kw => ar.includes(kw) || hl.includes(kw));
    });
  }

  const keywords = REGION_MATCH[reg] || [reg.toLowerCase()];

  // For China / HK: require at least one specific China/HK keyword — exclude Russia/Iran hits
  if (reg === "China / HK") {
    const chinaSpecific = ["china", "hong kong", "hk", "xinjiang", "ccmc", "uyghur",
                           "chinese", "prc", "huawei", "smic", "cmic", "beijing"];
    return chinaSpecific.some(kw => ar.includes(kw) || hl.includes(kw));
  }

  return keywords.some(kw => ar.includes(kw) || hl.includes(kw));
};

const filterArticles = (articles:Article[], sec:string, reg:string) => {
  if (!articles || !Array.isArray(articles)) return [];
  let pool = [...articles];
  // Filter by section
  if (sec && sec !== "all") pool = pool.filter(a => a.section === sec);
  // Filter by region using explicit keyword matching
  let result = reg === "All" ? pool : pool.filter(a => articleMatchesRegion(a, reg));
  // Sort newest first
  result.sort((a,b) => parseDate(b.date) - parseDate(a.date));
  // Pin top 3 OFAC/Treasury articles at the top (for any region — US sanctions are always relevant)
  const ofacPin = result.filter(isOFACArticle).slice(0, 3);
  if (ofacPin.length > 0) {
    const ofacIds = new Set(ofacPin.map(a => a.url || a.headline));
    const rest    = result.filter(a => !ofacIds.has(a.url || a.headline));
    result = [...ofacPin, ...rest];
  }
  return result;
};

const filterArticlesBySearch = (articles:Article[], sec:string, q:string, dateFrom:string, dateTo:string) =>
  [...articles].sort((a,b) => parseDate(b.date) - parseDate(a.date)).filter(a => {
    if (sec !== "all" && a.section !== sec) return false;

    // Date range filter
    if (dateFrom || dateTo) {
      // Parse article date — try to extract a date from the string
      const articleDateStr = a.date;
      const articleDate = new Date(articleDateStr);
      if (!isNaN(articleDate.getTime())) {
        if (dateFrom && articleDate < new Date(dateFrom)) return false;
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59); // include the full end day
          if (articleDate > toDate) return false;
        }
      }
    }

    // Keyword filter
    if (!q.trim()) return true;
    return [a.headline,...a.body,a.category,a.region,a.source].join(" ").toLowerCase().includes(q.toLowerCase().trim());
  });

export default function GlobalMonitor() {
  const [data, setData]           = useState<Briefing|null>(null);
  const [section, setSection]     = useState("all");
  const [region, setRegion]       = useState("All");
  const [expanded, setExpanded]   = useState<Record<string|number,boolean>>({});
  const [sanQ, setSanQ]           = useState("");
  const [dateFrom, setDateFrom]   = useState("");
  const [dateTo, setDateTo]       = useState("");
  const [sanOn, setSanOn]         = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTopic, setRefreshTopic] = useState("");
  const [error, setError]         = useState("");
  const [penalties, setPenalties] = useState<PenaltyRecord[]>([]);
  const [penaltyYears, setPenaltyYears] = useState<number[]>([]);
  const [yearDropdownOpen, setYearDropdownOpen] = useState(false);
  const [penaltyYear, setPenaltyYear]   = useState<number|null>(null);
  const [penaltySort, setPenaltySort]   = useState<"amount"|"date"|"regulator">("date");
  const [fincenPenalties, setFincenPenalties] = useState<FinCENPenalty[]>([]);
  const [fincenYears, setFincenYears]   = useState<number[]>([]);
  const [fincenYear, setFincenYear]     = useState<number|null>(null);
  const [penTab, setPenTab]             = useState<"ofac"|"fincen">("ofac");
  const [searchBarOpen, setSearchBarOpen] = useState(false);
  const [penaltiesLoading, setPenaltiesLoading] = useState(true);
  const [penaltiesError, setPenaltiesError]   = useState("");
  const [globalQ, setGlobalQ]           = useState("");
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [globalError, setGlobalError]   = useState("");
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  // Tab search fallback — live web search when no local results found
  const [ofacProgram, setOfacProgram] = useState<string>("");
  const [ofacProgramChecking, setOfacProgramChecking] = useState(false);
  const [ofacProgramUpdate, setOfacProgramUpdate] = useState<{found:boolean;results:any[];checkedAt:string}|null>(null);
  const [ofacDiff, setOfacDiff] = useState<any>(null);
  const [ofacDiffLoading, setOfacDiffLoading] = useState(false);
  const [ofacOverride, setOfacOverride] = useState<any>(null);
  const [ofacApplying, setOfacApplying] = useState(false);

  // Multi-batch background refresh — groups 2/3/4 fire at t=+3min/+6min/+9min
  const [bgRefreshCountdown, setBgRefreshCountdown] = useState(0); // seconds to NEXT batch
  const [bgRefreshNextGroup, setBgRefreshNextGroup] = useState(0); // 0 = none pending
  const bgTimerIdsRef  = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bgIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tabShowAll, setTabShowAll] = useState<Record<string,boolean>>({});
  const [tabLiveResults, setTabLiveResults] = useState<any[]>([]);
  const [tabLiveSearching, setTabLiveSearching] = useState(false);
  const [tabLiveError, setTabLiveError] = useState("");
  const [tabLiveSearched, setTabLiveSearched] = useState(false);

  // Silent background auto-refresh — re-fetches briefing every 30 min.
  // Only updates if new data has more articles (> 50) and a newer timestamp.
  const AUTO_REFRESH_MS = 30 * 60 * 1000; // 30 minutes

  useEffect(() => {
    const newsUrl = () => `/api/news?t=${Date.now()}`;
    const loadNews = () =>
      fetch(newsUrl(), { cache: "no-store" }).then(r=>r.json()).then((fresh: Briefing) => {
        setData(prev => {
          if (!prev) return fresh;
          const freshCount = fresh?.articles?.length ?? 0;
          if (freshCount >= 5 && fresh.lastUpdated !== prev.lastUpdated) {
            console.log(`[auto-refresh] New briefing detected — ${freshCount} articles`);
            return fresh;
          }
          return prev;
        });
      }).catch(() => {});

    loadNews(); // initial load
    fetch(newsUrl(), { cache: "no-store" }).then(r=>r.json()).then(setData)
      .catch(()=>setError("Could not load briefing."));
    fetch("/api/penalties").then(r=>r.json())
      .then((d:{records:PenaltyRecord[];years:number[]})=>{ setPenalties(d.records); setPenaltyYears(d.years); setPenaltiesLoading(false); })
      .catch((e)=>{ setPenaltiesError("Failed to load: "+String(e)); setPenaltiesLoading(false); });
    fetch("/api/fincen").then(r=>r.json())
      .then((d:{records:FinCENPenalty[];years:number[]})=>{ setFincenPenalties(d.records); setFincenYears(d.years); })
      .catch(()=>{});

    const timer = setInterval(loadNews, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const setPenYear = (y:number|null) => {
    setPenaltyYear(y);
    const url = y ? `/api/penalties?year=${y}` : "/api/penalties";
    fetch(url).then(r=>r.json()).then((d:{records:PenaltyRecord[]})=>setPenalties(d.records)).catch(()=>{});
  };
  const setFincenYearFn = (y:number|null) => {
    setFincenYear(y);
    const url = y ? `/api/fincen?year=${y}` : "/api/fincen";
    fetch(url).then(r=>r.json()).then((d:{records:FinCENPenalty[]})=>setFincenPenalties(d.records)).catch(()=>{});
  };

  const [refreshQueued, setRefreshQueued] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Refreshing in-process (fetching ~50 sources) reliably exceeds Cloudflare's
  // worker time limits, so the button no longer waits on /api/refresh directly.
  // Instead it asks the "Refresh Global Report" GitHub Actions workflow to run
  // right now (which has much more headroom) via /api/trigger-refresh, then
  // polls /api/news for a couple of minutes until the new briefing lands.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true); setError(""); setRefreshQueued(false);
    const previousUpdated = data?.lastUpdated;
    try {
      // Fire GitHub Actions workflow in background (Gemini + full OFAC scrape, ~2-3 min)
      // Don't await — it runs async while trigger-refresh handles the immediate fast path
      fetch("/api/trigger-github-refresh", { method: "POST" }).catch(() => {});

      const res = await fetch("/api/trigger-refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, topic: refreshTopic || undefined }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok || !result.ok) throw new Error(result.error || `HTTP ${res.status}`);
      setRefreshQueued(true);
      // Poll for the new briefing — trigger-refresh already saved to Redis before returning,
      // so first check is immediate (1s), then every 3s for up to 45s.
      let detected = false;
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, i === 0 ? 1000 : 3000));
        try {
          const newsRes = await fetch(`/api/news?t=${Date.now()}`, { cache: "no-store" });
          const newsData = await newsRes.json();
          if (newsData?.lastUpdated && newsData.lastUpdated !== previousUpdated) {
            setData(newsData); setExpanded({});
            detected = true;
            break;
          }
        } catch { /* keep polling */ }
      }
      // If lastUpdated didn't change (same-minute refresh), force one final fetch.
      // DO NOT window.location.reload() — that resets the active section to "all".
      if (!detected) {
        try {
          const finalRes = await fetch(`/api/news?t=${Date.now()}`, { cache: "no-store" });
          const finalData = await finalRes.json().catch(() => null);
          if (finalData?.articles?.length) { setData(finalData); setExpanded({}); }
        } catch { /* ignore */ }
      }
      // Multi-batch background refresh — groups 2/3/4 at t=+3min, +6min, +9min
      // Each group fetches its own source slice and merges into Redis without overwriting.
      bgTimerIdsRef.current.forEach(clearTimeout);
      bgTimerIdsRef.current = [];
      if (bgIntervalRef.current) { clearInterval(bgIntervalRef.current); bgIntervalRef.current = null; }

      const BATCH_SECS = 3 * 60; // 3 minutes between batches
      const bgBatches: { group: 2|3|4; fireAt: number }[] = [
        { group: 2, fireAt: Date.now() + BATCH_SECS * 1000 },
        { group: 3, fireAt: Date.now() + BATCH_SECS * 2000 },
        { group: 4, fireAt: Date.now() + BATCH_SECS * 3000 },
      ];

      // Countdown shows the NEXT upcoming batch
      let nextIdx = 0;
      setBgRefreshNextGroup(2);
      setBgRefreshCountdown(BATCH_SECS);

      bgIntervalRef.current = setInterval(() => {
        if (nextIdx >= bgBatches.length) {
          clearInterval(bgIntervalRef.current!);
          bgIntervalRef.current = null;
          setBgRefreshCountdown(0);
          setBgRefreshNextGroup(0);
          return;
        }
        const secsLeft = Math.max(0, Math.round((bgBatches[nextIdx].fireAt - Date.now()) / 1000));
        setBgRefreshNextGroup(bgBatches[nextIdx].group);
        setBgRefreshCountdown(secsLeft);
        // Once this batch has fired (secsLeft=0), advance to the next one
        if (secsLeft === 0) nextIdx++;
      }, 1000);

      const triggerGroup = async (groupNum: 2|3|4) => {
        try {
          console.log(`[bg-refresh] Group ${groupNum} starting`);
          const bgRes = await fetch("/api/background-refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ group: groupNum, section }),
          });
          const bgData = await bgRes.json().catch(() => ({}));
          console.log(`[bg-refresh] Group ${groupNum} done — ${bgData.newArticles ?? 0} new articles`);
          if ((bgData.newArticles ?? 0) > 0) {
            const fresh = await fetch(`/api/news?t=${Date.now()}`, { cache: "no-store" });
            const freshData = await fresh.json().catch(() => null);
            if (freshData?.articles?.length) setData(freshData);
          }
        } catch (bgErr) {
          console.warn(`[bg-refresh] Group ${groupNum} failed (non-fatal):`, String(bgErr));
        }
      };

      const t2 = setTimeout(() => triggerGroup(2), BATCH_SECS * 1000);
      const t3 = setTimeout(() => triggerGroup(3), BATCH_SECS * 2000);
      const t4 = setTimeout(() => triggerGroup(4), BATCH_SECS * 3000);
      bgTimerIdsRef.current = [t2, t3, t4];

    } catch(e){
      setError("Refresh failed — please try again in a moment.");
      console.error(e);
    }
    setRefreshing(false); setRefreshQueued(false);
  }, [refreshTopic, data, section]);

  // Live web fallback — called when tab date/keyword search returns 0 local results
  const doTabLiveSearch = async (q: string, from: string, to: string, sec: string) => {
    setTabLiveSearching(true);
    setTabLiveError("");
    setTabLiveResults([]);
    setTabLiveSearched(true);
    try {
      // Build targeted official-source queries per section
      const officialSources: Record<string,string> = {
        sanctions: "site:home.treasury.gov OR site:ofac.treasury.gov OR site:consilium.europa.eu OR site:gov.uk/government/organisations/office-of-financial-sanctions-implementation OR site:state.gov OR site:un.org/securitycouncil",
        economics: "site:home.treasury.gov OR site:federalreserve.gov OR site:bls.gov OR site:commerce.gov",
        occ:       "site:occ.gov OR site:fdic.gov OR site:federalreserve.gov OR site:ffiec.gov",
        bis:       "site:bis.doc.gov OR site:state.gov OR site:wassenaar.org",
        penalties: "site:ofac.treasury.gov OR site:fincen.gov OR site:occ.gov",
        regions:   "site:apnews.com OR site:reuters.com OR site:bbc.com OR site:aljazeera.com OR site:cnn.com",
        all:       "site:home.treasury.gov OR site:ofac.treasury.gov OR site:consilium.europa.eu OR site:gov.uk",
      };
      const sources = officialSources[sec] || officialSources["all"];
      const keyword = q || (sec === "sanctions" ? "OFAC designations sanctions" : sec);
      // Format date range for search
      const dateClause = from && to
        ? `from ${from} to ${to}`
        : from ? `after ${from}`
        : to   ? `before ${to}`
        : "recent";
      const query = `${keyword} ${dateClause} (${sources})`;
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({query}),
      });
      const d = await res.json();
      if (d.error) setTabLiveError(d.error);
      else setTabLiveResults(d.results || []);
    } catch(e) {
      setTabLiveError("Live search failed.");
    }
    setTabLiveSearching(false);
  };

  // Load saved override from Redis for a program
  const loadOfacOverride = async (programId: string) => {
    try {
      const res = await fetch(`/api/ofac-update?id=${programId}`);
      const d = await res.json();
      setOfacOverride(d.override || null);
    } catch {}
  };

  // Apply diff changes to library (saves to Redis, archives removed items)
  const applyOfacDiff = async (programId: string, diff: any) => {
    setOfacApplying(true);
    try {
      const res = await fetch("/api/ofac-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId,
          newGLs:            diff.newGLs || [],
          removedGLs:        diff.removedGLs || [],
          newEOs:            diff.newEOs || [],
          removedEOs:        diff.removedEOs || [],
          newAdvisories:     diff.newAdvisories || [],
          removedAdvisories: diff.removedAdvisories || [],
          checkedAt:         diff.checkedAt,
        }),
      });
      const d = await res.json();
      setOfacOverride(d.override);
      setOfacDiff(null); // clear diff panel after accepting
      alert(d.message);
    } catch { alert("Failed to apply changes"); }
    setOfacApplying(false);
  };

  // Check for updates by fetching real OFAC page and diffing against library
  const checkOfacDiff = async (programId: string, force = false) => {
    setOfacDiffLoading(true);
    setOfacDiff(null);
    try {
      const res = await fetch(`/api/ofac-program?id=${programId}${force ? "&force=1" : ""}`);
      const d = await res.json();
      setOfacDiff(d);
    } catch { setOfacDiff({ error: "Check failed — try again" }); }
    setOfacDiffLoading(false);
  };

  // Check for new regulations on selected OFAC program
  const checkOfacProgramUpdate = async (programId: string) => {
    const prog = SANCTIONS_PROGRAMS.find(p => p.id === programId);
    if (!prog) return;
    setOfacProgramChecking(true);
    setOfacProgramUpdate(null);
    try {
      const query = `${prog.name} new regulation designation general license 2026 site:ofac.treasury.gov OR site:home.treasury.gov`;
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const d = await res.json();
      const results = d.results || [];
      const checkedAt = new Date().toISOString().slice(0,16).replace('T',' ');
      setOfacProgramUpdate({ found: results.length > 0, results: results.slice(0, 5), checkedAt });
    } catch {
      setOfacProgramUpdate({ found: false, results: [], checkedAt: "error" });
    }
    setOfacProgramChecking(false);
  };

  const doGlobalSearch = async () => {
    if (!globalQ.trim()) return;
    setGlobalSearching(true); setGlobalError(""); setGlobalResults([]); setShowGlobalSearch(true);
    try {
      const res = await fetch("/api/search", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({query:globalQ}) });
      const d = await res.json();
      if (d.error) setGlobalError(d.error); else setGlobalResults(d.results||[]);
    } catch(e) { setGlobalError("Search failed. Please try again."); }
    setGlobalSearching(false);
  };

  const handleSection = (s:string) => { setSection(s); setRegion("All"); setSanOn(false); };
  const toggle = (id:string|number) => setExpanded(p=>({...p,[id]:!p[id]}));
  const doSearch = () => setSanOn(true);
  const clearSearch = () => { setSanOn(false); setSanQ(""); setDateFrom(""); setDateTo(""); };

  if (!data) return (<><style>{css}</style><div className="page-loading">{error||"Loading briefing…"}</div></>);

  const allFiltered = data?.articles ? filterArticles(data.articles, section, region) : [];
  const sanResults  = (sanOn && data?.articles) ? filterArticlesBySearch(data.articles, section, sanQ, dateFrom, dateTo) : null;
  const groups      = section==="all" ? ["sanctions","economics","regions","occ","penalties","bis"] : [section];
  const sidebarSecs = section==="all" ? ["sanctions","economics","regions","occ","penalties","bis"] : [section];

  const getSourceDisplay = (source: string, sourceUrl: string) => {
    const name = (source||"")
      .replace("OFAC Sanctions List Updates","OFAC")
      .replace("OFAC Recent Actions","OFAC")
      .replace("U.S. Treasury — OFAC Sanctions","U.S. Treasury / OFAC")
      .replace("U.S. Treasury — Press Releases","U.S. Treasury")
      .replace("U.S. Treasury — Enforcement","U.S. Treasury")
      .replace("U.S. Treasury — News","U.S. Treasury")
      .replace("Federal Reserve — Press Releases","Federal Reserve")
      .replace("U.S. State Department — News","State Dept")
      .replace(/^Google News — /,"")
      .replace(/^OFAC — /,"OFAC / ");
    let href = sourceUrl || "#";
    let pathLabel = "";
    try {
      const u = new URL(sourceUrl);
      const isFeed = u.pathname.includes("/feeds/") || u.pathname.includes("/rss") ||
        u.pathname.endsWith(".xml") || u.search.includes("ceid=") || u.hostname === "news.google.com";
      const isIndex = ["sanctions-list-updates","press-releases","selected-general",
        "news-and-communications","collections"].some(p =>
        u.pathname.includes(p) && u.pathname.split("/").filter(Boolean).length <= 2);
      const isSpecific = !isFeed && !isIndex && u.pathname.split("/").filter(Boolean).length > 1;
      if (isFeed) href = u.protocol + "//" + u.hostname;
      if (isSpecific) pathLabel = u.hostname.replace("www.","") + u.pathname.slice(0,40) + (u.pathname.length>40?"…":"");
    } catch {}
    return { name, href, pathLabel };
  };

  const renderBody = (a:Article, key:string|number) => (
    <>
      <div className="art-body">
        <p>{a.body[0]}</p>
        {expanded[key] && a.body.slice(1).map((p,i)=><p key={i}>{p}</p>)}
        {a.body.length>1 && <button className="more-btn" onClick={()=>toggle(key)}>{expanded[key]?"▲ Show less":"▼ Continue reading"}</button>}
      </div>
      <div className="art-source" suppressHydrationWarning>
        <span className="src-lbl">Source:</span>
        {(()=>{
          const sd = getSourceDisplay(a.source, a.sourceUrl);
          return (<>
            <a className="src-link" href={sd.href} target="_blank" rel="noopener noreferrer">{sd.name}</a>
            {sd.pathLabel && <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="src-path"
              style={{fontFamily:"var(--mono)",fontSize:".55rem",color:"#1a56db",textDecoration:"none",marginLeft:"6px",letterSpacing:".04em"}}>
              ↗ {sd.pathLabel}
            </a>}
          </>);
        })()}
      </div>
    </>
  );

  const renderArticle = (a:Article, i:number, key?:string|number) => (
    <article key={key??a.id} className="article" style={{animationDelay:`${i*44}ms`}}>
      <div className="art-meta">
        <div className={`idot d-${a.impact??"medium"}`}/>
        {section==="all" && <span className={`stag stag-${a.section}`}>{a.section==="bis"?"BIS":a.section}</span>}
        <span className={`art-tag ${tagCls(a.section)}`}>{a.category}</span>
        <span className="art-region">{decodeEntities(a.region)}</span>
        <span className="art-date">{formatDisplayDate(a.date)}</span>
      </div>
      <h2 className="art-hl">{decodeEntities(a.headline)}</h2>
      {renderBody(a, key??a.id)}
    </article>
  );

  // ── MOBILE VIEW ──────────────────────────────────────────────
  if (isMobile) {
    const mSecs = SECTIONS;
    const mArticles = allFiltered.slice(0, 60);
    const kfAll = sidebarSecs.flatMap(s => {
      const kf = ((data.sidebar?.[s]?.keyFigures ?? []).length > 0
        ? data.sidebar[s].keyFigures
        : STATIC_SIDEBAR[s]?.keyFigures) ?? [];
      return kf.slice(0, 2).map((f:any) => ({ ...f, s }));
    });
    const mRegions = REGIONS[section] || [];

    return (<><style>{css}</style><style>{`
      .m-app{font-family:var(--sans);background:#fff;min-height:100vh;max-width:100vw;overflow-x:hidden}
      .m-head{text-align:center;padding:12px 0 8px;border-bottom:2px solid #111;background:#fff}
      .m-head h1{font-family:'Playfair Display',serif;font-size:1.5rem;font-weight:700;letter-spacing:.02em;margin:0}
      .m-tabs{display:flex;overflow-x:auto;border-bottom:1px solid #e5e7eb;scrollbar-width:none;background:#fff;position:sticky;top:0;z-index:20}
      .m-tabs::-webkit-scrollbar{display:none}
      .m-tab{flex-shrink:0;padding:10px 14px;font-family:var(--mono);font-size:.62rem;font-weight:600;letter-spacing:.05em;border:none;background:transparent;color:#6b7280;cursor:pointer;border-bottom:2px solid transparent;text-transform:uppercase}
      .m-tab.active{color:#cc0000;border-bottom-color:#cc0000}
      .m-tab.sanctions.active{color:#cc0000;border-bottom-color:#cc0000}
      .m-tab.economics.active{color:#15803d;border-bottom-color:#15803d}
      .m-tab.regions.active{color:#6d28d9;border-bottom-color:#6d28d9}
      .m-tab.occ.active{color:#b45309;border-bottom-color:#b45309}
      .m-tab.penalties.active{color:#374151;border-bottom-color:#374151}
      .m-tab.bis.active{color:#0369a1;border-bottom-color:#0369a1}
      .m-bar{display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid #e5e7eb;flex-wrap:wrap;font-family:var(--mono);font-size:.58rem;color:#374151;background:#f9fafb}
      .m-dot{width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0}
      .m-txt{flex:1;min-width:0;font-size:.56rem;color:#6b7280}
      .m-btn{padding:3px 9px;border:1px solid #d1d5db;border-radius:3px;background:transparent;font-family:var(--mono);font-size:.56rem;color:#374151;cursor:pointer;white-space:nowrap}
      .m-btn.on{background:#111;color:#fff;border-color:#111}
      .m-region-sel{font-family:var(--mono);font-size:.58rem;padding:3px 6px;border:1px solid #d1d5db;border-radius:3px;background:#fff;max-width:140px}
      .m-filter{background:#fef2f2;border-bottom:1px solid #fca5a5;padding:8px 12px;display:flex;flex-direction:column;gap:6px}
      .m-filter input{padding:5px 8px;border:1px solid #d1d5db;border-radius:3px;font-size:.68rem;font-family:var(--mono);width:100%;box-sizing:border-box}
      .m-filter-row{display:flex;gap:6px;align-items:center}
      .m-kf{display:flex;overflow-x:auto;padding:8px 12px;gap:8px;border-bottom:1px solid #e5e7eb;scrollbar-width:none;background:#fafafa}
      .m-kf::-webkit-scrollbar{display:none}
      .m-kfc{flex-shrink:0;display:flex;flex-direction:column;align-items:center;min-width:72px;padding:5px 8px;background:#fff;border:1px solid #e5e7eb;border-radius:4px}
      .m-kfv{font-family:var(--mono);font-size:.9rem;font-weight:700;line-height:1}
      .m-kfl{font-family:var(--mono);font-size:.35rem;letter-spacing:.04em;text-transform:uppercase;color:#9ca3af;margin-top:2px;text-align:center}
      .m-art{padding:10px 12px;border-bottom:1px solid #e5e7eb}
      .m-art-meta{display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:3px}
      .m-art-tag{font-family:var(--mono);font-size:.48rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 4px;border-radius:2px;background:#fee2e2;color:#cc0000}
      .m-art-tag.economics{background:#dcfce7;color:#15803d}
      .m-art-tag.regions{background:#f3e8ff;color:#6d28d9}
      .m-art-tag.occ{background:#fef3c7;color:#b45309}
      .m-art-tag.bis{background:#dbeafe;color:#1d4ed8}
      .m-art-tag.penalties{background:#f3f4f6;color:#374151}
      .m-art-reg{font-family:var(--mono);font-size:.5rem;color:#9ca3af}
      .m-art-date{font-family:var(--mono);font-size:.5rem;color:#9ca3af;margin-left:auto}
      .m-art-hl{font-family:'Playfair Display',serif;font-size:.95rem;line-height:1.35;color:#111;font-weight:700;display:block;word-break:break-word;overflow-wrap:break-word}
      .m-art-src{font-family:var(--mono);font-size:.5rem;color:#9ca3af;margin-top:3px}
      .m-art-src a{color:#6b7280;text-decoration:none}
      .m-pen-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:0 0 8px}
      .m-pen-table{min-width:480px;width:100%;border-collapse:collapse;font-family:var(--mono);font-size:.58rem}
      .m-pen-table th{background:#f9fafb;border-bottom:1px solid #e5e7eb;padding:4px 6px;text-align:left;font-size:.5rem;letter-spacing:.04em;color:#6b7280;white-space:nowrap}
      .m-pen-table td{padding:4px 6px;border-bottom:1px solid #f3f4f6;vertical-align:top}
      .m-pen-table tr:hover td{background:#f9fafb}
      .m-section-hd{padding:10px 12px 4px;font-family:'Playfair Display',serif;font-size:1rem;font-weight:700;border-bottom:1px solid #e5e7eb}
      .m-empty{padding:20px 12px;font-family:var(--mono);font-size:.62rem;color:#9ca3af;text-align:center}
      .m-yr-row{display:flex;gap:5px;overflow-x:auto;padding:6px 12px;scrollbar-width:none;background:#fafafa;border-bottom:1px solid #f3f4f6}
      .m-yr-row::-webkit-scrollbar{display:none}
      .m-yr-pill{flex-shrink:0;padding:3px 9px;border-radius:3px;border:1px solid #d1d5db;background:#fff;color:#374151;font-family:var(--mono);font-size:.56rem;cursor:pointer;white-space:nowrap}
      .m-yr-pill.on{background:#111;border-color:#111;color:#fff}
    `}</style>
    <div className="m-app">
      {/* Header */}
      <div className="m-head"><h1>THE GLOBAL REPORT</h1></div>
      {/* Section tabs */}
      <div className="m-tabs">
        {mSecs.map(s=><button key={s} className={`m-tab ${s} ${section===s?"active":""}`}
          onClick={()=>{ handleSection(s); setSearchBarOpen(false); }}>{LABELS[s]}</button>)}
      </div>
      {/* Status bar */}
      <div className="m-bar">
        <span className="m-dot"/>
        <span className="m-txt">{data.lastUpdated.replace(/\s*·\s*\d+\s*stories/i, "")} · {allFiltered.length} stories</span>
        {section !== "penalties" && (
          <button className={`m-btn ${searchBarOpen||sanOn?"on":""}`}
            onClick={()=>setSearchBarOpen(v=>!v)}>⊘ {sanOn?"Filtered":"Filter"}</button>
        )}
        {mRegions.length>1 && (
          <select className="m-region-sel" value={region} onChange={e=>setRegion(e.target.value)}>
            {mRegions.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <button className="m-btn" onClick={handleRefresh} disabled={refreshing}>
          {refreshing?"…":"↻"}
        </button>
      </div>
      {/* Filter panel */}
      {section !== "penalties" && searchBarOpen && (
        <div className="m-filter">
          <input placeholder='Keyword — "Iran oil", "EU 20th"' value={sanQ}
            onChange={e=>setSanQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} autoFocus/>
          <div className="m-filter-row">
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{flex:1}}/>
            <span style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#9ca3af"}}>→</span>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{flex:1}}/>
          </div>
          <div className="m-filter-row">
            <button className="m-btn on" onClick={doSearch} style={{flex:1}}>Search</button>
            {sanOn && <button className="m-btn" onClick={()=>{clearSearch();setSearchBarOpen(false);}} style={{flex:1}}>✕ Clear</button>}
            <button className="m-btn" onClick={()=>setSearchBarOpen(false)}>✕</button>
          </div>
        </div>
      )}
      {/* Key figures strip */}
      {kfAll.length > 0 && section !== "penalties" && (
        <div className="m-kf">
          {kfAll.map((f:any,i:number)=>(
            <div key={i} className="m-kfc">
              <span className="m-kfv" style={{color:f.s==="economics"?"#15803d":f.s==="regions"?"#6d28d9":f.s==="occ"?"#b45309":f.s==="bis"?"#1d4ed8":"#cc0000"}}>{f.value}</span>
              <span className="m-kfl">{f.label}</span>
            </div>
          ))}
        </div>
      )}
      {/* Articles */}
      {section !== "penalties" && (<>
        {mArticles.length === 0 && <div className="m-empty">No stories match your filter.</div>}
        {mArticles.map((a,i)=>{
          const sd = getSourceDisplay(a.source, a.sourceUrl);
          return (
            <div key={a.id??i} className="m-art">
              <div className="m-art-meta">
                <span className={`m-art-tag ${a.section}`}>{a.section==="bis"?"BIS":a.section}</span>
                <span className="m-art-reg">{decodeEntities(a.region)}</span>
                <span className="m-art-date">{formatDisplayDate(a.date)}</span>
              </div>
              <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer"
                style={{textDecoration:"none",color:"inherit"}}>
                <span className="m-art-hl">{decodeEntities(a.headline)}</span>
              </a>
              <div className="m-art-src">{sd.name}</div>
            </div>
          );
        })}
      </>)}
      {/* Penalties section */}
      {section === "penalties" && (<>
        <div className="m-section-hd">OFAC Civil Penalties</div>
        <div className="m-yr-row">
          <button className={`m-yr-pill ${penaltyYear===null?"on":""}`} onClick={()=>setPenYear(null)}>All</button>
          {penaltyYears.map(y=>(
            <button key={y} className={`m-yr-pill ${penaltyYear===y?"on":""}`} onClick={()=>setPenYear(y)}>{y}</button>
          ))}
        </div>
        <div className="m-pen-wrap">
          <table className="m-pen-table">
            <thead><tr><th>Date</th><th>Entity</th><th>Amount</th><th>Program</th></tr></thead>
            <tbody>
              {[...penalties].sort((a,b)=>b.year-a.year||b.date.localeCompare(a.date)).slice(0,40).map((p,i)=>(
                <tr key={i}>
                  <td style={{whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:".55rem"}}>{p.date}</td>
                  <td><div style={{fontWeight:600,fontSize:".62rem"}}>{p.institution}</div><div style={{fontSize:".52rem",color:"#6b7280"}}>{p.violation}</div></td>
                  <td style={{whiteSpace:"nowrap",color:"#cc0000",fontWeight:700,fontFamily:"var(--mono)"}}>{p.amountDisplay}</td>
                  <td style={{color:"#6b7280",fontFamily:"var(--mono)",fontSize:".55rem"}}>{p.regulator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="m-section-hd" style={{marginTop:8}}>FinCEN Enforcement</div>
        <div className="m-yr-row">
          <button className={`m-yr-pill ${fincenYear===null?"on":""}`} onClick={()=>setFincenYearFn(null)}>All</button>
          {fincenYears.map(y=>(
            <button key={y} className={`m-yr-pill ${fincenYear===y?"on":""}`} onClick={()=>setFincenYearFn(y)}>{y}</button>
          ))}
        </div>
        <div className="m-pen-wrap">
          <table className="m-pen-table">
            <thead><tr><th>Date</th><th>Institution</th><th>Amount</th><th>Violation</th></tr></thead>
            <tbody>
              {[...fincenPenalties].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30).map((p,i)=>(
                <tr key={i}>
                  <td style={{whiteSpace:"nowrap",fontFamily:"var(--mono)",fontSize:".55rem"}}>{p.date}</td>
                  <td style={{fontWeight:600,fontSize:".62rem"}}>{p.institution}</td>
                  <td style={{whiteSpace:"nowrap",color:"#1d4ed8",fontWeight:700,fontFamily:"var(--mono)"}}>${(p.penalty/1e6).toFixed(1)}M</td>
                  <td style={{color:"#6b7280",fontSize:".55rem"}}>{p.violation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}
    </div>
    </>);
  }
  // ── END MOBILE VIEW ───────────────────────────────────────────

  return (
    <><style>{css}</style>
    <div className="app">
      <div className="masthead">
        <div className="mast-inner">
          <div><span className="pub-name">The Global Report</span></div>
        </div>
      </div>

      <div className="sec-nav"><div className="sec-nav-inner">
        {SECTIONS.map(s=><button key={s} className={`sec-tab ${s} ${section===s?"active":""}`} onClick={()=>handleSection(s)}>{LABELS[s]}</button>)}
      </div></div>
      {section !== "penalties" && searchBarOpen && (
        <div className="san-search" style={{background: section==="bis"?"#f0f9ff":section==="economics"?"#f0fdf4":section==="occ"?"#fffbeb":section==="regions"?"#faf5ff":"#fef2f2", borderBottomColor: section==="bis"?"#7dd3fc":section==="economics"?"#86efac":section==="occ"?"#fcd34d":section==="regions"?"#d8b4fe":"#fca5a5"}}><div className="san-inner">
          <span className="san-lbl" style={{color: section==="bis"?"#0369a1":section==="economics"?"#15803d":section==="occ"?"#b45309":section==="regions"?"#6d28d9":"#cc0000"}}>⊘ Search {section==="all"?"All":section.toUpperCase()}</span>
          <input className="san-q" placeholder='Keyword — "Iran oil", "EU 20th", "OFSI"' value={sanQ} onChange={e=>setSanQ(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} autoFocus/>
          <input className="date-in" type="date" value={dateFrom} onChange={e=>{setDateFrom(e.target.value);if(e.target.value||dateTo)setSanOn(true);}} title="From date"/>
          <span style={{color:"#5a3020",fontFamily:"var(--mono)",fontSize:".65rem"}}>→</span>
          <input className="date-in" type="date" value={dateTo} onChange={e=>{setDateTo(e.target.value);if(e.target.value||dateFrom)setSanOn(true);}} title="To date"/>
          <button className="san-go" onClick={doSearch}>Search</button>
          {sanOn && <button className="san-x" onClick={()=>{clearSearch();setSearchBarOpen(false);}}>✕ Clear</button>}
          <button className="san-x" onClick={()=>setSearchBarOpen(false)} style={{marginLeft:"auto"}}>✕</button>
        </div></div>
      )}
      <div className="ctrl-bar"><div className="ctrl-inner">
        {/* Row 1: status · filter · search · OFAC · refresh */}
        <div className="ctrl-main">
          <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0,flexWrap:"wrap"}}>
            {refreshing ? <><span className="spin-dot"/><span className="upd-text">{refreshQueued?"Queued…":"Refreshing…"}</span></>
              : <><span className="live-dot"/><span className="upd-text">{data.lastUpdated.replace(/\s*·\s*\d+\s*stories/i, "")} · {allFiltered.length} stories</span></>}

            {error && <span className="err-msg">{error}</span>}
          </div>
          <span style={{color:"#d1d5db",fontFamily:"var(--mono)"}}>|</span>
          {section !== "penalties" && (
            <button className={`pill ${searchBarOpen||sanOn?"on":""}`}
              onClick={()=>setSearchBarOpen(v=>!v)}
              style={{fontFamily:"var(--mono)",fontSize:".58rem"}}
            >⊘ {sanOn?"Filtered":"Filter"}</button>
          )}
          {showGlobalSearch ? (
            <>
              <input className="gs-inline" placeholder="Search web…" value={globalQ}
                onChange={e=>setGlobalQ(e.target.value)}
                onKeyDown={e=>{if(e.key==="Enter"&&!globalSearching)doGlobalSearch();}}
                autoFocus
              />
              <button className="pill on" onClick={()=>doGlobalSearch()} disabled={globalSearching}
                style={{fontFamily:"var(--mono)",fontSize:".58rem",flexShrink:0}}>
                {globalSearching?"…":"🔍 Go"}
              </button>
              <button className="san-x" onClick={()=>{setShowGlobalSearch(false);setGlobalResults([]);setGlobalQ("");}}>✕</button>
            </>
          ) : (
            <button className="pill" onClick={()=>setShowGlobalSearch(true)}
              style={{fontFamily:"var(--mono)",fontSize:".58rem"}}>🔍 Search</button>
          )}
          {section==="sanctions" && (
            <button className={`pill ${ofacProgram?"on":""}`}
              style={{fontFamily:"var(--mono)",fontSize:".6rem"}}
              onClick={()=>setOfacProgram(ofacProgram?"":"iran")}
            >⚖ OFAC Programs</button>
          )}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
            <input className="topic-input" placeholder="Focus topic…" value={refreshTopic} onChange={e=>setRefreshTopic(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!refreshing&&handleRefresh()}/>
            <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? <><span className="spin">↻</span>Refreshing…</> : "↻ Refresh Now"}
            </button>
          </div>
        </div>
        {/* Row 2: region pills — only when regions exist */}
        {(REGIONS[section]?.length||0)>1 && (
          <div className="ctrl-regions">
            <span className="tlbl">Region:</span>
            {(REGIONS[section]||["All"]).map(r=><button key={r} className={`pill ${region===r?"on":""}`} onClick={()=>setRegion(r)}>{r}</button>)}
          </div>
        )}
      </div></div>
      {showGlobalSearch && (globalSearching || globalResults.length > 0 || globalError) && (
        <div style={{borderBottom:"2px solid #111",background:"#fff"}}>
          <div className="gs-panel">
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px",borderBottom:"1px solid #e5e7eb",paddingBottom:"10px"}}>
              <div>
                <span style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:"1.1rem"}}>Web Search Results</span>
                <span style={{fontFamily:"var(--mono)",fontSize:".62rem",color:"#6b7280",marginLeft:"10px"}}>"{globalQ}"</span>
              </div>
              {globalResults.length > 0 && <span style={{fontFamily:"var(--mono)",fontSize:".62rem",color:"#6b7280"}}>{globalResults.length} results</span>}
            </div>
            {globalSearching && <div className="gs-empty">Searching the web… (~15s)</div>}
            {globalError && <div className="gs-empty" style={{color:"#cc0000"}}>{globalError}</div>}
            {!globalSearching && !globalError && globalResults.length === 0 && showGlobalSearch && <div className="gs-empty">No results found. Try a different query.</div>}
            {globalResults.map((r:any, i:number) => (
              <div key={i} className="gs-result">
                <div className="gs-rtitle">
                  <a href={r.url} target="_blank" rel="noopener">{r.title}</a>
                </div>
                <div className="gs-rmeta">
                  <span className="gs-rsource">{r.source}</span>
                  {r.date && <span className="gs-rdate">{r.date}</span>}
                  <span className={`gs-rrel gs-rrel-${r.relevance==="high"?"high":r.relevance==="medium"?"med":"low"}`}>{r.relevance}</span>
                  <a href={r.url} target="_blank" rel="noopener" style={{fontFamily:"var(--mono)",fontSize:".58rem",color:"#1a56db",textDecoration:"none",marginLeft:"auto"}}>↗ {(() => { try { return new URL(r.url).hostname.replace("www.",""); } catch { return "link"; } })()}</a>
                </div>
                {r.brief && <div className="gs-rbrief">{r.brief}</div>}
                {r.tags?.length > 0 && (
                  <div className="gs-rtags">{r.tags.map((t:string,j:number)=><span key={j} className="gs-rtag">{t}</span>)}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="layout">
        <main>
      {section==="sanctions" && ofacProgram && (()=>{
        const prog=SANCTIONS_PROGRAMS.find(p=>p.id===ofacProgram);
        if(!prog) return null;
        return (<div style={{borderBottom:"2px solid #111",background:"#fff",padding:"0 0 0 0"}}>
          <div style={{maxWidth:900,margin:"0 auto",padding:"16px 24px 24px"}}>
            <div className="ofac-prog-header">
              <span style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:"1.05rem"}}>OFAC Sanctions Programs</span>
              <select className="ofac-prog-select" value={ofacProgram} onChange={e=>{const id=e.target.value;setOfacProgram(id);setOfacProgramUpdate(null);setOfacDiff(null);setOfacOverride(null);loadOfacOverride(id);}}>
                <optgroup label="Country / Geographic Programs">
                  {SANCTIONS_PROGRAMS.filter(p=>p.category==="country").map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
                </optgroup>
                <optgroup label="Thematic / Issue-Based Programs">
                  {SANCTIONS_PROGRAMS.filter(p=>p.category==="thematic").map(p=>(<option key={p.id} value={p.id}>{p.name}</option>))}
                </optgroup>
              </select>
              <span className={`ofac-prog-badge ${prog.status}`}>{prog.status.toUpperCase()}</span>
              <span style={{fontFamily:"var(--mono)",fontSize:".58rem",color:"#6b7280"}}>Updated: {prog.lastUpdated}</span>
              <div style={{marginLeft:"auto",display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
                <a href={prog.url} target="_blank" rel="noopener noreferrer" style={{fontFamily:"var(--mono)",fontSize:".6rem",padding:"4px 10px",border:"1.5px solid #1a56db",borderRadius:"3px",background:"#1a56db",color:"#fff",textDecoration:"none",whiteSpace:"nowrap"}}>
                  View on OFAC.gov
                </a>
                <button onClick={()=>checkOfacDiff(ofacProgram)} disabled={ofacDiffLoading}
                  style={{fontFamily:"var(--mono)",fontSize:".6rem",padding:"4px 10px",border:"1.5px solid #166534",borderRadius:"3px",background:ofacDiffLoading?"#f9fafb":"#166534",color:ofacDiffLoading?"#6b7280":"#fff",cursor:ofacDiffLoading?"wait":"pointer",whiteSpace:"nowrap"}}>
                  {ofacDiffLoading ? "Checking..." : "Check for Updates"}
                </button>
              </div>
            </div>
            {prog.notes && <div className="ofac-prog-note">note: {prog.notes}</div>}

            {ofacDiff && !ofacDiff.error && !ofacDiff.blocked && (()=>{
              // ofacDiff.executiveOrders/generalLicenses are now full {number,title,date,url}
              // objects sourced from the GitHub Actions scrape cache (see app/api/ofac-program/route.ts) —
              // carry the real metadata through instead of just bare numbers, so accepted
              // changes get real titles/dates/urls rather than "pending title update" placeholders.
              const liveEOs=new Map<string,any>((ofacDiff.executiveOrders||[]).map((e:any)=>[String(e.number),e]));
              const liveGLs=new Map<string,any>((ofacDiff.generalLicenses||[]).map((g:any)=>[String(g.number),g]));
              const libEOs=new Set(prog.executiveOrders.map(e=>e.number));
              const libGLs=new Set(prog.generalLicenses.map(g=>g.number.replace("GL ","").trim()));
              const newEOs=[...liveEOs.values()].filter(e=>!libEOs.has(e.number)&&!libEOs.has("EO "+e.number));
              const newGLs=[...liveGLs.values()].filter(g=>!libGLs.has(g.number)&&!libGLs.has("GL "+g.number));
              const removedGLs=prog.generalLicenses
                .filter(g=>{const n=g.number.replace("GL ","").trim(); return !liveGLs.has(n)&&!liveGLs.has("GL "+n);})
                .map(g=>({number:g.number.replace("GL ","").trim(), title:g.title}));
              const allGood=!newEOs.length&&!newGLs.length&&!removedGLs.length;
              const diffPayload={newGLs,removedGLs,newEOs,removedEOs:[],checkedAt:ofacDiff.checkedAt};
              return (
                <div style={{background:allGood?"#f0fdf4":"#fefce8",border:`1px solid ${allGood?"#86efac":"#fde047"}`,borderRadius:4,padding:"10px 14px",marginBottom:14}}>
                  <div style={{fontFamily:"var(--mono)",fontSize:".62rem",fontWeight:600,color:allGood?"#166534":"#854d0e",marginBottom:6,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
                    <span>{allGood?"Library matches OFAC page":`${newEOs.length+newGLs.length} new / ${removedGLs.length} removed`}</span>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      {!allGood&&<button onClick={()=>applyOfacDiff(ofacProgram,diffPayload)} disabled={ofacApplying} style={{fontFamily:"var(--mono)",fontSize:".58rem",padding:"2px 8px",border:"1px solid #166534",borderRadius:"3px",background:"#166534",color:"#fff",cursor:ofacApplying?"wait":"pointer"}}>
                        {ofacApplying?"Saving...":"Accept and Save Changes"}
                      </button>}
                      <span style={{fontWeight:400,color:"#9ca3af",fontSize:".55rem"}}>{ofacDiff.cached?"cached":"live"}</span>
                    </div>
                  </div>
                  <div style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#374151",display:"flex",gap:16,flexWrap:"wrap"}}>
                    <span>Live EOs: <b>{ofacDiff.executiveOrders?.length??0}</b></span>
                    <span>Live GLs: <b>{ofacDiff.generalLicenses?.length??0}</b></span>
                    <span>Library EOs: <b>{prog.executiveOrders.length}</b></span>
                    <span>Library GLs: <b>{prog.generalLicenses.length}</b></span>
                  </div>
                  {newEOs.length>0&&<div style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#166534",marginTop:4}}>New EOs: {newEOs.map(e=>`EO ${e.number}${e.title?` (${e.title})`:""}`).join(", ")}</div>}
                  {newGLs.length>0&&<div style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#166534",marginTop:4}}>New GLs: {newGLs.map(g=>`GL ${g.number}${g.title?` (${g.title})`:""}`).join(", ")}</div>}
                  {removedGLs.length>0&&<div style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#cc0000",marginTop:4}}>Will archive: {removedGLs.map(g=>`GL ${g.number}`).join(", ")}</div>}
                </div>
              );
            })()}
            {ofacDiff?.blocked&&<div className="ofac-prog-note" style={{borderColor:"#fde047",background:"#fefce8",color:"#854d0e"}}>{ofacDiff.message || "OFAC scrape cache temporarily unavailable. Use View on OFAC.gov to check manually."}</div>}
            {ofacDiff?.error&&<div className="ofac-prog-note" style={{borderColor:"#fca5a5",background:"#fef2f2",color:"#cc0000"}}>{ofacDiff.error}</div>}

            <div className="ofac-prog-panel">
              <div className="ofac-prog-section">
                <div className="ofac-prog-section-title">Executive Orders
                  <span style={{background:"#111",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>{prog.executiveOrders.length} Active</span>
                </div>
                {prog.executiveOrders.length===0
                  ?<div className="ofac-prog-empty">No executive orders - statute-based program.</div>
                  :<table className="ofac-prog-table"><thead><tr><th>EO Number</th><th>Title</th><th>Date</th><th>Document</th></tr></thead><tbody>
                    {[...prog.executiveOrders].sort((a,b)=>parseDate(b.date)-parseDate(a.date)).map((eo,i)=>(
                      <tr key={i}><td>EO {eo.number}</td><td>{eo.title}</td><td>{eo.date}</td>
                        <td>{eo.url?<a href={eo.url} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:"var(--mono)",fontSize:".62rem",color:"#fff",background:"#111",padding:"3px 8px",borderRadius:"3px",textDecoration:"none"}}>View PDF</a>:<span style={{color:"#d1d5db"}}>-</span>}</td>
                      </tr>
                    ))}
                  </tbody></table>}
              </div>
              {(() => {
                // GLs carry an optional `expires` date (parsed from OFAC's own
                // "...through <date>" authorization text — see refresh-briefing.mjs).
                // Once that date has passed, treat it as expired in the UI even if
                // the curated library hasn't been explicitly updated with
                // archived:true yet (that only happens once a successor GL is
                // detected during a sync run). This is purely a display-layer
                // partition — it does not mutate the underlying data.
                const now = Date.now();
                const isPastExpiry = (gl: typeof prog.generalLicenses[number]) =>
                  !!gl.expires && parseDate(gl.expires) < now;
                const liveGLs = prog.generalLicenses.filter(gl => !isPastExpiry(gl));
                const autoExpiredGLs = prog.generalLicenses.filter(isPastExpiry);
                return (
                  <>
                    <div className="ofac-prog-section">
                      <div className="ofac-prog-section-title">General Licenses
                        <span style={{background:liveGLs.length>0?"#166534":"#6b7280",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>{liveGLs.length} Active</span>
                      </div>
                      {liveGLs.length===0
                        ?<div className="ofac-prog-empty">No active general licenses.</div>
                        :<table className="ofac-prog-table"><thead><tr><th>License</th><th>Title / Authorization</th><th>Date</th><th>Expires</th><th>Document</th></tr></thead><tbody>
                          {[...liveGLs].sort((a,b)=>parseDate(b.date)-parseDate(a.date)).map((gl,i)=>(
                            <tr key={i}><td>{gl.number}</td><td>{gl.title}</td><td>{gl.date}</td>
                              <td style={{whiteSpace:"nowrap"}}>{gl.expires||"—"}</td>
                              <td>{gl.url?<a href={gl.url} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:"var(--mono)",fontSize:".62rem",color:"#fff",background:"#166534",padding:"3px 8px",borderRadius:"3px",textDecoration:"none"}}>View PDF</a>:<a href={`${prog.url}#general-licenses`} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:"var(--mono)",fontSize:".62rem",color:"#1a56db",background:"#eff6ff",padding:"3px 8px",borderRadius:"3px",textDecoration:"none",border:"1px solid #bfdbfe"}}>OFAC Page</a>}</td>
                            </tr>
                          ))}
                        </tbody></table>}
                    </div>
                    {autoExpiredGLs.length>0 && (
                      <div className="ofac-prog-section" style={{opacity:.7}}>
                        <div className="ofac-prog-section-title" style={{color:"#9ca3af"}}>
                          Expired — Pending Archive
                          <span style={{background:"#9ca3af",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>{autoExpiredGLs.length} Items</span>
                        </div>
                        <table className="ofac-prog-table" style={{opacity:.8}}><thead><tr><th>License</th><th>Title / Authorization</th><th>Expired</th><th>Document</th></tr></thead><tbody>
                          {[...autoExpiredGLs].sort((a,b)=>parseDate(b.expires||"")-parseDate(a.expires||"")).map((gl,i)=>(
                            <tr key={i} style={{background:"#f9fafb"}}>
                              <td style={{textDecoration:"line-through",color:"#9ca3af",fontFamily:"var(--mono)",fontSize:".65rem"}}>{gl.number}</td>
                              <td style={{color:"#9ca3af"}}>{gl.title}</td>
                              <td style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#cc0000",whiteSpace:"nowrap"}}>{gl.expires}</td>
                              <td>{gl.url?<a href={gl.url} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:"var(--mono)",fontSize:".62rem",color:"#9ca3af",background:"#f3f4f6",padding:"3px 8px",borderRadius:"3px",textDecoration:"none"}}>View PDF</a>:"—"}</td>
                            </tr>
                          ))}
                        </tbody></table>
                      </div>
                    )}
                  </>
                );
              })()}
              {prog.keyAdvisories&&prog.keyAdvisories.length>0&&(
                <div className="ofac-prog-section">
                  <div className="ofac-prog-section-title">Key Advisories &amp; Press Releases
                    <span style={{background:"#1a56db",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>{prog.keyAdvisories.length} Items</span>
                  </div>
                  <table className="ofac-prog-table"><thead><tr><th>Date</th><th>Title</th><th>Link / Source</th></tr></thead><tbody>
                    {[...prog.keyAdvisories].sort((a,b)=>parseDate(b.date)-parseDate(a.date)).map((adv,i)=>(
                      <tr key={i}><td>{adv.date}</td><td>{adv.title}</td>
                        <td>{adv.url?<a href={adv.url} target="_blank" rel="noopener" style={{display:"inline-flex",alignItems:"center",gap:"4px",fontFamily:"var(--mono)",fontSize:".62rem",color:"#fff",background:"#cc0000",padding:"3px 8px",borderRadius:"3px",textDecoration:"none"}}>Read</a>:<span style={{color:"#d1d5db"}}>-</span>}</td>
                      </tr>
                    ))}
                  </tbody></table>
                </div>
              )}
              {/* Archive section */}
              {prog.archive && ((prog.archive.generalLicenses?.length??0) + (prog.archive.executiveOrders?.length??0) + (prog.archive.advisories?.length??0) > 0) && (
                <div className="ofac-prog-section" style={{opacity:.7}}>
                  <div className="ofac-prog-section-title" style={{color:"#9ca3af"}}>
                    Archive — Expired / Superseded
                    <span style={{background:"#9ca3af",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>
                      {(prog.archive.generalLicenses?.length??0)+(prog.archive.executiveOrders?.length??0)+(prog.archive.advisories?.length??0)} Items
                    </span>
                  </div>
                  <table className="ofac-prog-table" style={{opacity:.8}}>
                    <thead><tr><th>Item</th><th>Title</th><th>Archived</th><th>Note</th></tr></thead>
                    <tbody>
                      {[...(prog.archive.generalLicenses||[]),...(prog.archive.executiveOrders||[]),...(prog.archive.advisories||[])]
                        .sort((a,b)=>parseDate(b.archivedDate||b.date)-parseDate(a.archivedDate||a.date))
                        .map((item,i)=>(
                        <tr key={i} style={{background:"#f9fafb"}}>
                          <td style={{textDecoration:"line-through",color:"#9ca3af",fontFamily:"var(--mono)",fontSize:".65rem"}}>{item.number||"Advisory"}</td>
                          <td style={{color:"#9ca3af"}}>{item.title}</td>
                          <td style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#9ca3af",whiteSpace:"nowrap"}}>{item.archivedDate||"—"}</td>
                          <td style={{fontStyle:"italic",color:"#9ca3af",fontSize:".7rem"}}>{item.archivedNote||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>);
      })()}

      {/* Library change log - shown below OFAC panel when override exists */}
      {section==="sanctions" && ofacProgram && ofacOverride && ofacOverride.hasChanges && (
        <div style={{maxWidth:900,margin:"0 auto 16px",padding:"0 24px"}}>
          <div className="ofac-prog-section">
            <div className="ofac-prog-section-title">
              Library Change Log
              <span style={{background:"#6b7280",color:"#fff",fontFamily:"var(--mono)",fontSize:".55rem",padding:"2px 7px",borderRadius:"10px",fontWeight:600}}>Updated {ofacOverride.lastUpdated}</span>
            </div>
            {(ofacOverride.addedGLs||[]).length > 0 && <div style={{marginBottom:8}}>
              <div style={{fontFamily:"var(--mono)",fontSize:".6rem",fontWeight:600,color:"#166534",marginBottom:4}}>Added to Library</div>
              <table className="ofac-prog-table"><thead><tr><th>GL</th><th>Title</th><th>Added</th></tr></thead><tbody>
                {(ofacOverride.addedGLs||[]).map((g:any,i:number)=>(<tr key={i}><td>{g.number}</td><td>{g.title}</td><td>{g.addedDate}</td></tr>))}
              </tbody></table>
            </div>}
            {(ofacOverride.archivedGLs||[]).length > 0 && <div style={{marginBottom:8}}>
              <div style={{fontFamily:"var(--mono)",fontSize:".6rem",fontWeight:600,color:"#9ca3af",marginBottom:4}}>Archived (removed from OFAC page)</div>
              <table className="ofac-prog-table" style={{opacity:.7}}><thead><tr><th>GL</th><th>Title</th><th>Archived</th><th>Note</th></tr></thead><tbody>
                {(ofacOverride.archivedGLs||[]).map((g:any,i:number)=>(<tr key={i} style={{background:"#f9fafb"}}><td style={{textDecoration:"line-through",color:"#9ca3af"}}>{g.number}</td><td style={{color:"#9ca3af"}}>{g.title}</td><td>{g.archivedDate}</td><td style={{fontStyle:"italic",color:"#9ca3af"}}>{g.archivedNote}</td></tr>))}
              </tbody></table>
            </div>}
            {(ofacOverride.addedEOs||[]).length > 0 && <div style={{marginBottom:8}}>
              <div style={{fontFamily:"var(--mono)",fontSize:".6rem",fontWeight:600,color:"#166534",marginBottom:4}}>New EOs Added</div>
              <table className="ofac-prog-table"><thead><tr><th>EO</th><th>Title</th><th>Added</th></tr></thead><tbody>
                {(ofacOverride.addedEOs||[]).map((e:any,i:number)=>(<tr key={i}><td>{e.number}</td><td>{e.title}</td><td>{e.addedDate}</td></tr>))}
              </tbody></table>
            </div>}
            {(ofacOverride.archivedEOs||[]).length > 0 && <div>
              <div style={{fontFamily:"var(--mono)",fontSize:".6rem",fontWeight:600,color:"#9ca3af",marginBottom:4}}>Archived EOs</div>
              <table className="ofac-prog-table" style={{opacity:.7}}><thead><tr><th>EO</th><th>Title</th><th>Archived</th></tr></thead><tbody>
                {(ofacOverride.archivedEOs||[]).map((e:any,i:number)=>(<tr key={i} style={{background:"#f9fafb"}}><td style={{textDecoration:"line-through",color:"#9ca3af"}}>{e.number}</td><td style={{color:"#9ca3af"}}>{e.title}</td><td>{e.archivedDate}</td></tr>))}
              </tbody></table>
            </div>}
          </div>
        </div>
      )}
          {/* Mobile-only compact key-figures strip — scrollable horizontal chips */}
          {(() => {
            const kfAll = sidebarSecs.flatMap(s => {
              const kf = ((data.sidebar?.[s]?.keyFigures ?? []).length > 0
                ? data.sidebar[s].keyFigures
                : STATIC_SIDEBAR[s]?.keyFigures) ?? [];
              return kf.slice(0, 2).map(f => ({ ...f, s }));
            });
            if (!kfAll.length) return null;
            return (
              <div className="kf-strip">
                {kfAll.map((f, i) => (
                  <div key={i} className="kf-chip">
                    <span className={`kf-chip-val ${kvCls(f.s)}`}>{f.value}</span>
                    <span className="kf-chip-lbl">{f.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {sanOn && section !== "penalties" && (
            <div style={{marginBottom:24}}>
              <div className="sec-banner"><div className={`sec-stripe stripe-${section==="all"?"sanctions":section}`}/><span className="sec-title">{section==="all"?"All":"" } Search Results</span><span className="sec-count">{sanQ&&`"${sanQ}"`}</span></div>
              {sanResults?.length===0 && <div className="empty-s">No matching articles. Try a different keyword or click ↻ Refresh Now with a specific topic.</div>}
              {sanResults?.map((a,i)=>renderArticle(a,i,`sr${i}`))}
            </div>
          )}
          {groups.map(g=>{
            if (g==="penalties") return null; // penalties section uses dedicated table UI below — not article cards
            if (g==="sanctions"&&sanOn) return null;
            if (g==="sanctions"&&ofacProgram&&section==="sanctions") return null;
            const arts = allFiltered.filter(a=>a.section===g);
            if (!arts.length) return null;
            const LIMIT = 15;
            const showAll = tabShowAll[g];
            const visible = showAll ? arts : arts.slice(0, LIMIT);
            const hidden = arts.length - LIMIT;
            return <div key={g} style={{marginBottom:22}}>
              <div className="sec-banner"><div className={`sec-stripe stripe-${g}`}/><span className="sec-title">{LABELS[g]}</span><span className="sec-count">{arts.length} stories</span></div>
              {visible.map((a,i)=>renderArticle(a,i))}
              {!showAll && hidden > 0 && (
                <button className="show-more-btn" onClick={()=>setTabShowAll(p=>({...p,[g]:true}))}>
                  ↓ Show {hidden} more {LABELS[g]?.toLowerCase()||g} stories
                </button>
              )}
              {showAll && arts.length > LIMIT && (
                <button className="show-more-btn" onClick={()=>setTabShowAll(p=>({...p,[g]:false}))}>
                  ↑ Show less
                </button>
              )}
            </div>;
          })}
          {section==="penalties" && (
            <div>
              <div className="sec-banner"><div className="sec-stripe stripe-penalties"/><span className="sec-title">Financial Penalties & Enforcement Actions</span></div>
              <div className="pen-tabs">
                <button className={`pen-tab-btn ${penTab==="ofac"?"active":""}`} onClick={()=>setPenTab("ofac")}>OFAC Civil Penalties</button>
                <button className={`pen-tab-btn ${penTab==="fincen"?"active":""}`} onClick={()=>setPenTab("fincen")}>FinCEN / BSA Enforcement</button>
              </div>
              <div className="pen-year-btns" style={{alignItems:"center"}}>
                <span className="tlbl" style={{alignSelf:"center"}}>Year:</span>
                <button className={`pill ${(penTab==="ofac"?penaltyYear:fincenYear)===null?"on":""}`} onClick={()=>{penTab==="ofac"?setPenYear(null):setFincenYearFn(null);setYearDropdownOpen(false);}}>All</button>
                {/* Show 5 most recent years as pills */}
                {(penTab==="ofac"?penaltyYears:fincenYears).slice(0,5).map(y=>(
                  <button key={y} className={`pill ${(penTab==="ofac"?penaltyYear:fincenYear)===y?"on":""}`} onClick={()=>{penTab==="ofac"?setPenYear(y):setFincenYearFn(y);setYearDropdownOpen(false);}}>{y}</button>
                ))}
                {/* Dropdown for older years */}
                {(penTab==="ofac"?penaltyYears:fincenYears).length > 5 && (
                  <div style={{position:"relative",display:"inline-block"}}>
                    <button
                      className={`pill ${(penTab==="ofac"?penaltyYears:fincenYears).slice(5).includes((penTab==="ofac"?penaltyYear:fincenYear)??0)?"on":""}`}
                      onClick={()=>setYearDropdownOpen(o=>!o)}
                      style={{gap:4}}
                    >
                      {(penTab==="ofac"?penaltyYears:fincenYears).slice(5).includes((penTab==="ofac"?penaltyYear:fincenYear)??0)
                        ? (penTab==="ofac"?penaltyYear:fincenYear)
                        : "Older"} ▾
                    </button>
                    {yearDropdownOpen && (
                      <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,background:"#fff",border:"1.5px solid #111",borderRadius:"4px",boxShadow:"0 4px 12px rgba(0,0,0,.12)",zIndex:100,minWidth:80}}>
                        {(penTab==="ofac"?penaltyYears:fincenYears).slice(5).map(y=>(
                          <button key={y}
                            onClick={()=>{penTab==="ofac"?setPenYear(y):setFincenYearFn(y);setYearDropdownOpen(false);}}
                            style={{display:"block",width:"100%",padding:"6px 14px",textAlign:"left",fontFamily:"var(--mono)",fontSize:".65rem",border:"none",background:(penTab==="ofac"?penaltyYear:fincenYear)===y?"#f3f4f6":"#fff",cursor:"pointer",fontWeight:(penTab==="ofac"?penaltyYear:fincenYear)===y?600:400}}
                          >{y}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {penaltiesLoading && <div style={{fontFamily:"var(--mono)",fontSize:".65rem",color:"#6b7280",padding:"12px 0"}}>Loading penalty records…</div>}
              {penaltiesError && <div style={{fontFamily:"var(--mono)",fontSize:".65rem",color:"#cc0000",padding:"12px 0"}}>⚠ {penaltiesError}</div>}
              {penTab==="ofac" && (
                <>
                <div style={{fontSize:".65rem",color:"#6b7280",fontFamily:"var(--mono)",marginBottom:"8px"}}>
                  Source: <a href={(!penaltyYear || penaltyYear === 2026) ? "https://ofac.treasury.gov/civil-penalties-and-enforcement-information" : `https://ofac.treasury.gov/civil-penalties-and-enforcement-information/${penaltyYear}-enforcement-information`} target="_blank" rel="noopener" style={{color:"#1a56db"}}>OFAC {penaltyYear||"All Years"} Civil Penalties ↗</a>
                </div>
                <div className="pen-wrap"><table className="pen-table">
                  <thead><tr>
                    <th onClick={()=>setPenaltySort("date")} style={{width:110}}>Date {penaltySort==="date"?"↓":""}</th>
                    <th>Name / Institution</th>
                    <th onClick={()=>setPenaltySort("amount")} style={{width:150}}>Amount {penaltySort==="amount"?"↓":""}</th>
                    <th onClick={()=>setPenaltySort("regulator")} style={{width:130}}>Regulator {penaltySort==="regulator"?"↓":""}</th>
                    <th style={{width:60}}>Source</th>
                  </tr></thead>
                  <tbody>
                    <tr style={{background:"#f0f5ff",fontWeight:600,borderBottom:"2px solid #1a56db"}}>
                      <td style={{fontFamily:"var(--mono)",fontSize:".65rem",letterSpacing:".08em",textTransform:"uppercase",padding:"9px 10px",color:"#1a56db"}} colSpan={2}>
                        TOTAL {penaltyYear||"ALL"} — {penalties.length} actions
                      </td>
                      <td style={{padding:"9px 10px"}}><span suppressHydrationWarning style={{fontFamily:"'Playfair Display',serif",fontSize:"1rem",fontWeight:700,color:"#cc0000"}}>{penalties.filter(p=>p.amount>0).reduce((s,p)=>s+p.amount,0).toLocaleString()}</span></td>
                      <td colSpan={2} style={{color:"#6b7280",padding:"9px 10px",fontSize:".65rem",fontFamily:"var(--mono)"}}>{penalties.filter(p=>p.amount===0).length} settlements (undisclosed)</td>
                    </tr>
                    {[...penalties].sort((a,b)=>{
                      if(penaltySort==="amount") return b.amount-a.amount;
                      if(penaltySort==="regulator") return a.regulator.localeCompare(b.regulator);
                      return b.year-a.year||b.date.localeCompare(a.date);
                    }).map(p=>{
                      const regCls=p.regulator.toLowerCase().includes("ofac")?"pb-ofac":p.regulator.toLowerCase().includes("fincen")?"pb-fincen":p.regulator.toLowerCase().includes("occ")?"pb-occ":p.regulator.toLowerCase().includes("fed")?"pb-fed":p.regulator.toLowerCase().includes("bis")?"pb-bis":"pb-doj";
                      return <tr key={p.id}>
                        <td style={{fontFamily:"var(--mono)",fontSize:".7rem",color:"#374151",whiteSpace:"nowrap"}}>{p.date}</td>
                        <td><div className="pen-inst">{p.institution}</div><div className="pen-viol">{p.violation}</div></td>
                        <td><div className="pen-amount">{p.amountDisplay}</div></td>
                        <td><span className={`pen-badge ${regCls}`}>{p.regulator}</span></td>
                        <td><a href={p.sourceUrl} target="_blank" rel="noopener" style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#1a56db",textDecoration:"none"}}>↗ View</a></td>
                      </tr>;
                    })}
                  </tbody>
                </table></div>
                </>
              )}
              {penTab==="fincen" && (
                <>
                <div style={{fontSize:".65rem",color:"#6b7280",fontFamily:"var(--mono)",marginBottom:"8px"}}>
                  Source: <a href="https://www.fincen.gov/news/enforcement-actions" target="_blank" rel="noopener" style={{color:"#1a56db"}}>FinCEN Enforcement Actions ↗</a>
                </div>
                <div className="pen-wrap"><table className="pen-table">
                  <thead><tr>
                    <th style={{width:110}}>Date</th>
                    <th>Institution</th>
                    <th style={{width:150}}>Penalty</th>
                    <th style={{width:180}}>Agencies</th>
                    <th>Violation</th>
                    <th style={{width:80}}>Flags</th>
                  </tr></thead>
                  <tbody>
                    <tr style={{background:"#f0f5ff",fontWeight:600,borderBottom:"2px solid #1a56db"}}>
                      <td style={{fontFamily:"var(--mono)",fontSize:".65rem",letterSpacing:".08em",textTransform:"uppercase",padding:"9px 10px",color:"#1a56db"}} colSpan={2}>
                        TOTAL {fincenYear||"ALL"} — {fincenPenalties.length} actions
                      </td>
                      <td style={{padding:"9px 10px"}}><span style={{fontFamily:"'Playfair Display',serif",fontSize:"1rem",fontWeight:700,color:"#cc0000"}}>${(fincenPenalties.reduce((s,p)=>s+p.penalty,0)/1e9).toFixed(2)}B</span></td>
                      <td colSpan={3} style={{color:"#6b7280",padding:"9px 10px",fontSize:".65rem",fontFamily:"var(--mono)"}}>{fincenPenalties.filter(p=>p.egregious).length} egregious · {fincenPenalties.filter(p=>p.voluntaryDisclosure).length} VSD</td>
                    </tr>
                    {[...fincenPenalties].sort((a,b)=>b.date.localeCompare(a.date)||b.penalty-a.penalty).map(p=>(
                      <tr key={p.id}>
                        <td style={{fontFamily:"var(--mono)",fontSize:".7rem",color:"#374151",whiteSpace:"nowrap"}}>{p.date}</td>
                        <td><div className="pen-inst">{p.institution}</div><div className="pen-viol" style={{fontSize:".65rem"}}>{p.institutionType}</div></td>
                        <td><div className="pen-amount">{p.penaltyDisplay}</div></td>
                        <td>{p.agencies.map(a=>{
                          const c=a==="FinCEN"?"pb-fincen":a==="OFAC"?"pb-ofac":a==="OCC"?"pb-occ":a==="DOJ"?"pb-doj":a.includes("Fed")?"pb-fed":"pb-bis";
                          return <span key={a} className={`pen-badge ${c}`}>{a}</span>;
                        })}</td>
                        <td><div className="pen-viol">{p.violation}</div>{p.notes&&<div style={{fontSize:".62rem",color:"#9ca3af",marginTop:2,fontStyle:"italic"}}>{p.notes}</div>}</td>
                        <td>
                          {p.egregious&&<span className="b-egregious">EGREGIOUS</span>}<br/>
                          {p.voluntaryDisclosure&&<span className="b-vsd">VSD</span>}
                          <a href={p.sourceUrl} target="_blank" rel="noopener" style={{fontFamily:"var(--mono)",fontSize:".6rem",color:"#1a56db",textDecoration:"none",display:"block",marginTop:2}}>↗ Source</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                </>
              )}
            </div>
          )}
          {section!=="penalties" && !allFiltered.length&&!sanOn&&<div className="empty-s">No stories match the current filters.</div>}
          <div className="hint"><strong style={{color:"var(--muted)"}}>HOW THIS WORKS</strong><br/>
            ↻ Refresh Now queues a live source fetch (lands in ~1-2 min) · Sources linked below each article<br/>
            Auto-refreshes throughout the day on a schedule · Sanctions search filters the current edition instantly
          </div>
        </main>
        <aside>
          {sidebarSecs.map((s,si)=>{
            const kf = ((data.sidebar?.[s]?.keyFigures ?? []).length > 0 ? data.sidebar[s].keyFigures : STATIC_SIDEBAR[s]?.keyFigures) ?? [];
            const wl = ((data.sidebar?.[s]?.watchlist ?? []).length > 0 ? data.sidebar[s].watchlist : STATIC_SIDEBAR[s]?.watchlist) ?? [];
            return (
              <div key={s}>
                {section==="all" && <div className="sec-div" style={{marginTop:si?14:0}}>{LABELS[s]}</div>}
                {kf.length > 0 && (
                  <div className="sb-section"><div className="sb-head">Key Figures</div>
                    {kf.map((f,i)=>(
                      <div key={i} className="sb-item">
                        <div className={`kf-val ${kvCls(s)}`}>{f.value}</div>
                        <span className="sb-lbl">{f.label}</span>
                      </div>
                    ))}
                  </div>
                )}
                {wl.length > 0 && section!=="all" && (
                  <div className="sb-section"><div className="sb-head">Watch List</div>
                    {wl.map((w,i)=>(
                      <div key={i} className="sb-item">
                        <strong>
                          {w.url
                            ? <a href={w.url} target="_blank" rel="noopener" style={{color:"#111",textDecoration:"none",borderBottom:"1px dotted #9ca3af"}}>{w.entity}</a>
                            : w.entity}
                        </strong>
                        <span className="sb-lbl">{w.type}</span>
                        <div className="sb-note">{w.note}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </aside>
      </div>
    </div></>
  );
}
