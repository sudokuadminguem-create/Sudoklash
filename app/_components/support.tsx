"use client";
import { useEffect, useState } from "react";
import { Crown, Heart, Medal } from "lucide-react";
import { authHeaders } from "@/app/lib/auth-headers";
import { euroPrice, supportPacks } from "@/lib/premium";
import "../support.css";

export function SupportPodium() {
  const [players,setPlayers]=useState<{place:number;username:string}[]>([]);
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/support",{signal:controller.signal}).then(async r=>{
      if(r.ok)setPlayers(((await r.json()) as {supporters:typeof players}).supporters);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[]);
  if(!players.length)return null;
  return <section className="support-podium" aria-label="Podium des soutiens">
    <h2><Heart aria-hidden="true"/> Les plus grands soutiens</h2>
    <ol>{players.map(p=><li key={p.place} data-place={p.place}>
      {p.place===1 ? <Crown aria-hidden="true"/>:<Medal aria-hidden="true"/>}
      <span><small>{["1er · Or","2e · Argent","3e · Bronze"][p.place-1]}</small><strong>{p.username}</strong></span>
    </li>)}</ol>
  </section>;
}

export function SupportShop({signedIn,openAuth}:{signedIn:boolean;openAuth:()=>void}) {
  const [available,setAvailable]=useState<boolean|null>(null),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/premium/checkout",{signal:controller.signal}).then(async r=>setAvailable(r.ok && !!((await r.json()) as {available:boolean}).available)).catch(()=>{if(!controller.signal.aborted)setAvailable(false);});
    return ()=>controller.abort();
  },[]);
  useEffect(()=>{
    const query=new URLSearchParams(location.search);
    if(query.has("support_cancelled"))setMessage("Paiement annulé.");
    const sessionId=query.get("support_session");
    if(!signedIn||!sessionId)return;
    let live=true;
    void (async()=>{
      try {
        const r=await fetch("/api/premium/checkout",{method:"POST",headers:{"Content-Type":"application/json",...await authHeaders()},body:JSON.stringify({action:"verify",sessionId})});
        if(!r.ok)throw Error();
        if(live){setMessage("Merci pour ton soutien ! Ton don a été confirmé.");const url=new URL(location.href);url.searchParams.delete("support_session");history.replaceState(null,"",url);}
      } catch {if(live)setMessage("Le paiement n’a pas encore pu être confirmé. Tu peux réessayer en rechargeant cette page.");}
    })();
    return ()=>{live=false;};
  },[signedIn]);
  const checkout=async(packId:string)=>{
    if(!signedIn){openAuth();return;}
    if(!consent||busy||!available)return;
    setBusy(true);setMessage("");
    try{
      const r=await fetch("/api/premium/checkout",{method:"POST",headers:{"Content-Type":"application/json",...await authHeaders()},body:JSON.stringify({packId,publishSupport:true})});
      if(!r.ok)throw Error();
      const url=new URL(((await r.json()) as {url:string}).url);
      if(url.protocol!=="https:"||url.hostname!=="checkout.stripe.com")throw Error();
      location.assign(url.href);
    }catch{setMessage("Impossible d’ouvrir le paiement. Réessaie dans un instant.");setBusy(false);}
  };
  return <section className="premium-section support-shop">
    <span className="eyebrow">SOUTIEN AU DÉVELOPPEMENT</span>
    <h2>Soutenir Sudoku Clash</h2>
    <p>Les trois plus grands donateurs voient leur pseudo en néon à l’accueil. Le rang se calcule sur le total des dons confirmés. Les montants restent privés.</p>
    {available===null && <p role="status">Vérification du paiement…</p>}
    {available===false && <p role="status">Les dons ne sont pas encore activés.</p>}
    {available && (signedIn ? <>
      <label className="support-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> J’accepte que mon pseudo s’affiche si je suis dans le top 3.</label>
      <div className="support-options">{supportPacks.map(p=><button type="button" className="primary" key={p.id} disabled={!consent||busy} onClick={()=>void checkout(p.id)}>Soutenir · {euroPrice(p.cents)}</button>)}</div>
    </> : <button type="button" className="primary" onClick={openAuth}>Se connecter pour soutenir</button>)}
    {message && <p role="status">{message}</p>}
    <SupportPodium/>
  </section>;
}
