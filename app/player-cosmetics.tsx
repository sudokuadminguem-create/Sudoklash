"use client";
import {useCallback,useEffect,useState} from "react";
import {Coins} from "lucide-react";
import {supabase} from "./lib/supabase";
import type {AccountState} from "./real-account";
import {achievementAvatars,avatars,levelFrames,rankedFrames,shopAvatars} from "@/lib/cosmetics";

export type CosmeticState={xp:number;level:number;levelXp:number;nextLevelXp:number;coins:number;counts:{solo:number;daily:number;weekly:number;wins:number;losses:number};ownedAvatars:string[];ownedThemes:string[];unlockedFrames:string[];avatarId:string;frameId:string;frameSelection:string;rank:string;rankName:string;rankPoints:number;themeId:string};

export function useCosmetics(account:AccountState){
 const[state,setState]=useState<CosmeticState|null>(null),[loading,setLoading]=useState(false);
 const refresh=useCallback(async()=>{
  if(!account.user){setState(null);return}
  setLoading(true);
  try{const{data}=await supabase.auth.getSession();const response=await fetch("/api/cosmetics",{cache:"no-store",headers:{Authorization:`Bearer ${data.session?.access_token??""}`}});if(!response.ok)throw Error("load");setState(await response.json() as CosmeticState)}catch{setState(null)}finally{setLoading(false)}
 },[account.user?.id]);
 useEffect(()=>{void refresh()},[refresh]);
 const action=async(action:"equip_avatar"|"equip_frame"|"buy_avatar"|"equip_theme"|"buy_theme",id:string)=>{
  const{data}=await supabase.auth.getSession();const response=await fetch("/api/cosmetics",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session?.access_token??""}`},body:JSON.stringify({action,id})});
  if(!response.ok)throw Error((await response.json() as {error:string}).error);
  const updated=await response.json() as CosmeticState;setState(updated);return updated;
 };
 return {state,loading,refresh,action};
}

export function PlayerAvatar({avatarId="nova",frameId="starter",size="normal",fallback}:{avatarId?:string;frameId?:string;size?:"normal"|"large"|"small";fallback?:string}){
 const avatar=avatars.find(a=>a.id===avatarId)??avatars[0],frame=levelFrames.find(f=>f.id===frameId)??levelFrames[0],rankFrame=rankedFrames.find(f=>`rank-${f.id}`===frameId);
 return <span className={`player-avatar ${size}${rankFrame?" ranked-avatar":""}${frameId==="none"?" frameless-avatar":""}`} data-rank={rankFrame?.id} style={{"--avatar-one":avatar.colors[0],"--avatar-two":avatar.colors[1],"--frame-color":rankFrame?.color??frame.color,"--frame-accent":rankFrame?.accent??frame.color,"--rank-symbol":`"${rankFrame?.symbol??""}"`} as React.CSSProperties} role="img" aria-label={`Avatar ${avatar.name}, ${frameId==="none"?"sans cadre":rankFrame?`cadre ${rankFrame.name}`:`cadre ${frame.name}`}`}><span>{fallback??avatar.symbol}</span></span>;
}

export function CosmeticCloset({cosmetics,notify}:{cosmetics:ReturnType<typeof useCosmetics>;notify:(message:string)=>void}){
 const data=cosmetics.state,[busy,setBusy]=useState("");
 if(cosmetics.loading&&!data)return <section className="panel cosmetic-closet">Chargement de la progression…</section>;
 if(!data)return <section className="panel cosmetic-closet"><p>Personnalisation momentanément indisponible.</p><button onClick={()=>void cosmetics.refresh()}>Réessayer</button></section>;
 const choose=async(action:"equip_avatar"|"equip_frame",id:string)=>{setBusy(id);try{await cosmetics.action(action,id);notify("Apparence mise à jour")}catch{notify("Impossible d’enregistrer. Réessayez.")}finally{setBusy("")}};
 return <section className="panel cosmetic-closet"><div className="closet-heading"><div><span className="eyebrow">PROGRESSION DU COMPTE</span><h3>Niveau {data.level}</h3><p>{data.xp} XP au total · Rang classé indépendant</p></div><PlayerAvatar avatarId={data.avatarId} frameId={data.frameId} size="large"/></div><div className="level-track" role="progressbar" aria-label="Progression vers le prochain niveau" aria-valuenow={data.levelXp} aria-valuemin={0} aria-valuemax={data.nextLevelXp}><span style={{width:`${Math.min(100,data.levelXp/data.nextLevelXp*100)}%`}}/></div><small>{data.nextLevelXp-data.levelXp} XP avant le niveau {data.level+1}</small>
  <h4>Choisir mon avatar</h4><p>15 avatars gratuits. Les autres se débloquent dans la boutique ou avec des succès.</p><div className="cosmetic-grid">{avatars.map(a=>{const owned=data.ownedAvatars.includes(a.id),selected=data.avatarId===a.id,achievement=achievementAvatars.find(x=>x.id===a.id),product=shopAvatars.find(x=>x.id===a.id);return <button key={a.id} className={selected?"selected":""} disabled={!owned||!!busy} onClick={()=>void choose("equip_avatar",a.id)} aria-pressed={selected} title={!owned?achievement?.requirement??`${product?.price} Sudokoins`:a.name}><PlayerAvatar avatarId={a.id} frameId={selected?data.frameId:"starter"}/><b>{a.name}</b><small>{selected?"Équipé":owned?"Choisir":achievement?achievement.requirement:`${product?.price} Sudokoins`}</small></button>})}</div>
  <h4>Cadres de rang classé</h4><p>Ton cadre suit automatiquement ton rang. Tu peux aussi le masquer ou choisir un cadre de niveau. Les animations se désactivent selon les préférences de mouvement de ton appareil.</p>
  <div className="rank-frame-actions"><button className={data.frameSelection==="rank_auto"?"selected":""} aria-pressed={data.frameSelection==="rank_auto"} disabled={!!busy} onClick={()=>void choose("equip_frame","rank_auto")}><PlayerAvatar avatarId={data.avatarId} frameId={`rank-${data.rankName}`}/><span><b>Afficher mon rang</b><small>{data.rank} · {data.rankPoints} points · évolue automatiquement</small></span></button><button className={data.frameSelection==="none"?"selected":""} aria-pressed={data.frameSelection==="none"} disabled={!!busy} onClick={()=>void choose("equip_frame","none")}><PlayerAvatar avatarId={data.avatarId} frameId="none"/><span><b>Masquer le cadre</b><small>Garder uniquement l'avatar</small></span></button></div>
  <div className="rank-frame-showcase" aria-label="Aperçu des cadres de rang">{rankedFrames.map(f=><div key={f.id} className={f.id===data.rankName?"current":""}><PlayerAvatar avatarId={data.avatarId} frameId={`rank-${f.id}`}/><b>{f.id}</b>{f.id===data.rankName&&<small>Ton rang</small>}</div>)}</div>
  <h4>Mes cadres de niveau</h4><div className="frame-grid">{levelFrames.map(f=><button key={f.id} disabled={!data.unlockedFrames.includes(f.id)||!!busy} className={data.frameSelection===f.id?"selected":""} aria-pressed={data.frameSelection===f.id} onClick={()=>void choose("equip_frame",f.id)}><PlayerAvatar avatarId={data.avatarId} frameId={f.id}/><span><b>{f.name}</b><small>{data.unlockedFrames.includes(f.id)?data.frameSelection===f.id?"Équipé":"Choisir":`Niveau ${f.level}`}</small></span></button>)}</div>
 </section>;
}

export function AvatarShop({cosmetics,notify,openAuth,account}:{cosmetics:ReturnType<typeof useCosmetics>;notify:(message:string)=>void;openAuth:()=>void;account:AccountState}){
 const[busy,setBusy]=useState("");
 if(!account.user)return <section className="panel cosmetic-closet"><h3>Avatars Sudoku Clash</h3><p>Connecte-toi pour enregistrer tes avatars et tes Sudokoins.</p><button className="primary" onClick={openAuth}>Se connecter</button></section>;
 if(!cosmetics.state)return <section className="panel cosmetic-closet">Chargement de la boutique…</section>;
 const data=cosmetics.state;
 const buy=async(id:string)=>{setBusy(id);try{await cosmetics.action(data.ownedAvatars.includes(id)?"equip_avatar":"buy_avatar",id);notify(data.ownedAvatars.includes(id)?"Avatar équipé":"Avatar débloqué !")}catch(e){notify(e instanceof Error&&e.message==="not_enough_coins"?"Pas assez de Sudokoins":"Achat indisponible. Réessaie.")}finally{setBusy("")}};
 return <section className="panel cosmetic-closet avatar-shop"><div className="closet-heading"><div><span className="eyebrow">AVATARS COSMÉTIQUES</span><h3>Choisis ton style</h3><p>Gagne des Sudokoins en terminant des grilles et en remportant des duels.</p></div><strong><Coins/>{data.coins} Sudokoins</strong></div><div className="cosmetic-grid">{shopAvatars.map(a=><button key={a.id} disabled={!!busy||(!data.ownedAvatars.includes(a.id)&&data.coins<a.price)} onClick={()=>void buy(a.id)}><PlayerAvatar avatarId={a.id}/><b>{a.name}</b><small>{data.avatarId===a.id?"Équipé":data.ownedAvatars.includes(a.id)?"Équiper":`${a.price} Sudokoins`}</small></button>)}</div><h4>À gagner avec les succès</h4><div className="cosmetic-grid">{achievementAvatars.map(a=><div className="achievement-avatar" key={a.id}><PlayerAvatar avatarId={a.id}/><b>{a.name}</b><small>{data.ownedAvatars.includes(a.id)?"Débloqué":a.requirement}</small></div>)}</div></section>;
}
