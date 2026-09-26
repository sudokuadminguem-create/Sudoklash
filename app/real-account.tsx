"use client";
import {useCallback,useEffect,useState} from "react";
import type {User} from "@supabase/supabase-js";
import {Copy,Eye,EyeOff,LogIn,LogOut,ShieldCheck,Users,X} from "lucide-react";
import {supabase} from "./lib/supabase";
import FriendsDirectory from "./friends-directory";
import {CosmeticCloset,PlayerAvatar,useCosmetics} from "./player-cosmetics";

export type Profile={id:string;username:string|null;display_name:string;avatar_url:string|null;last_seen:string};
export type AccountState={loading:boolean;user:User|null;profile:Profile|null};
export type Room={id:string;code:string;host_id:string;status:"waiting"|"playing"|"finished"|"cancelled";difficulty:string;puzzle:string;max_players:number;started_at:string|null;winner_id:string|null};
export type RoomPlayer={room_id:string;user_id:string;is_ready:boolean;progress:number;finished_at:string|null;elapsed_ms:number|null;profile?:Profile|null};

export function useAccount(){
 const[state,setState]=useState<AccountState>({loading:true,user:null,profile:null});
 const load=useCallback(async(user:User|null)=>{if(!user){setState({loading:false,user:null,profile:null});return}const {data:session}=await supabase.auth.getSession();try{const response=await fetch("/api/profile",{headers:{Authorization:`Bearer ${session.session?.access_token??""}`},cache:"no-store"});if(!response.ok)throw new Error("profile_unavailable");const data=await response.json();setState({loading:false,user,profile:data.profile as Profile|null})}catch{setState({loading:false,user,profile:null})}},[]);
 useEffect(()=>{supabase.auth.getUser().then(({data})=>load(data.user));const{subscription}=supabase.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>load(session?.user??null),0)}).data;return()=>subscription.unsubscribe()},[load]);
 return{...state,refresh:()=>load(state.user)};
}

const authMessages:Record<string,string>={invalid_credentials:"E-mail ou mot de passe incorrect.",user_already_exists:"Ce compte existe déjà.",username_unavailable:"Ce pseudo est déjà pris.",invalid_username:"Utilisez 3 à 20 lettres, chiffres ou underscores.",profile_unavailable:"Le profil est temporairement indisponible. Réessayez dans un instant."};
const friendly=(message:string)=>Object.entries(authMessages).find(([key])=>message.includes(key))?.[1]??message;

export function AuthDialog({account,onClose,recovery=false,recoveryStatus="checking",onRecovered}:{account:ReturnType<typeof useAccount>;onClose:()=>void;recovery?:boolean;recoveryStatus?:"checking"|"ready"|"expired";onRecovered?:()=>void}){
 const[mode,setMode]=useState<"signin"|"signup"|"forgot"|"reset">(recovery?"reset":"signin");
 const[email,setEmail]=useState(""),[password,setPassword]=useState(""),[username,setUsername]=useState("");
 const[visible,setVisible]=useState(false),[error,setError]=useState(""),[info,setInfo]=useState(""),[busy,setBusy]=useState(false);
 useEffect(()=>{if(recovery)setMode("reset")},[recovery]);
 const needsUsername=!!account.user&&!account.profile?.username&&mode!=="reset";
 const changeMode=(next:typeof mode)=>{setMode(next);setError("");setInfo("");setPassword("")};
 const submit=async()=>{
  setBusy(true);setError("");setInfo("");
  try{
   if(needsUsername){
    const{data:session}=await supabase.auth.getSession();
    const response=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.session?.access_token??""}`},body:JSON.stringify({username})});
    if(!response.ok){const data=await response.json();throw new Error(data.error??"profile_unavailable")}
    await account.refresh();onClose();return;
   }
   if(mode==="forgot"){
    const{error:e}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/?reset=1`});
    if(e)throw e;
    setInfo("Si cette adresse correspond à un compte, vous recevrez un e-mail avec un lien pour choisir un nouveau mot de passe.");
    return;
   }
   if(mode==="reset"){
    const{data:session,error:sessionError}=await supabase.auth.getSession();
    if(sessionError||!session.session)throw new Error("Le lien de récupération est expiré ou invalide. Demandez un nouveau lien.");
    const{error:e}=await supabase.auth.updateUser({password});
    if(e)throw e;
    setInfo("Mot de passe modifié. Votre compte est connecté.");
    setPassword("");onRecovered?.();return;
   }
   const result=mode==="signup"?await supabase.auth.signUp({email:email.trim(),password}):await supabase.auth.signInWithPassword({email:email.trim(),password});
   if(result.error)throw result.error;
   if(mode==="signup"&&!result.data.session)setInfo("Compte créé. Ouvrez l’e-mail de confirmation, puis connectez-vous.");
   else if(result.data.session)await account.refresh();
  }catch(e){setError(friendly(e instanceof Error?e.message:"Connexion impossible"))}finally{setBusy(false)}
 };
 const passwordField=<label>Mot de passe<div className="password-field"><input type={visible?"text":"password"} autoComplete={mode==="signup"||mode==="reset"?"new-password":"current-password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8 caractères minimum"/><button type="button" aria-label={visible?"Masquer le mot de passe":"Afficher le mot de passe"} aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?<EyeOff/>:<Eye/>}</button></div></label>;
 return <div className="account-backdrop" role="presentation"><section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
  <button className="account-close" aria-label="Fermer" onClick={onClose}><X/></button><div className="account-shield"><ShieldCheck/></div><span className="eyebrow">COMPTE SUDOKU CLASH</span>
  <h2 id="account-title">{needsUsername?"Choisissez votre pseudo":mode==="forgot"?"Mot de passe oublié":mode==="reset"?"Nouveau mot de passe":mode==="signup"?"Créer un compte":"Se connecter"}</h2>
  {needsUsername?<><p>Ce pseudo sera visible par vos amis et vos adversaires. Il doit être unique.</p><label>Pseudo<input autoFocus value={username} onChange={e=>setUsername(e.target.value)} placeholder="Ex. LogikRush" maxLength={20}/></label><button className="primary account-submit" disabled={busy||username.length<3} onClick={submit}>{busy?"Enregistrement…":"Valider mon pseudo"}</button></>:
   mode==="forgot"?<><p>Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un lien pour choisir un nouveau mot de passe.</p><label>E-mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@exemple.fr"/></label><button className="primary account-submit" disabled={busy||!email.includes("@")} onClick={submit}>{busy?"Envoi…":"Envoyer le lien"}</button><button className="auth-switch" onClick={()=>changeMode("signin")}>Retour à la connexion</button></>:
   mode==="reset"?recoveryStatus==="checking"?<p>Vérification du lien de récupération…</p>:recoveryStatus==="expired"?<><p>Ce lien a expiré ou ne permet pas de modifier le mot de passe. Demandez un nouveau lien depuis votre adresse e-mail.</p><button className="primary account-submit" onClick={()=>changeMode("forgot")}>Demander un nouveau lien</button></>:<><p>Choisissez un nouveau mot de passe d’au moins 8 caractères pour votre compte.</p>{passwordField}<button className="primary account-submit" disabled={busy||password.length<8} onClick={submit}>{busy?"Enregistrement…":"Enregistrer le mot de passe"}</button></>:
   <><label>E-mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="vous@exemple.fr"/></label>{passwordField}<button className="primary account-submit" disabled={busy||!email.includes("@")||password.length<8} onClick={submit}>{busy?"Connexion…":mode==="signup"?"Créer mon compte":"Se connecter"}</button>{mode==="signin"&&<button className="auth-switch" onClick={()=>changeMode("forgot")}>Mot de passe oublié ?</button>}<button className="auth-switch" onClick={()=>changeMode(mode==="signup"?"signin":"signup")}>{mode==="signup"?"J’ai déjà un compte":"Créer un compte gratuitement"}</button></>}
  {error&&<p className="form-error" role="alert">{error}</p>}{info&&<p className="form-info" role="status">{info}</p>}
 </section></div>;
}

type AccountStats={profile:{username:string;created_at:number}|null;solo:{games:number;best:number|null;total:number|null};daily:number;weekly:number;ranked:{points:number;wins:number;losses:number;rank:string};recent:{difficulty:string;elapsed_seconds:number;completed_at:number}[]};
function gameTime(seconds:number){return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`}

export function AccountOverview({account,openAuth,cosmetics,notify}:{account:ReturnType<typeof useAccount>;openAuth:()=>void;cosmetics:ReturnType<typeof useCosmetics>;notify:(message:string)=>void}){
 const[stats,setStats]=useState<AccountStats|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
 useEffect(()=>{if(!account.user)return;let live=true;supabase.auth.getSession().then(({data})=>fetch("/api/account",{headers:{Authorization:`Bearer ${data.session?.access_token??""}`},cache:"no-store"})).then(response=>{if(!response.ok)throw new Error("stats_unavailable");return response.json() as Promise<AccountStats>}).then(value=>{if(live)setStats(value)}).catch(()=>{if(live)setError(true)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[account.user]);
 if(account.loading)return <div className="panel account-overview">Chargement du compte…</div>;
 if(!account.user)return <div className="panel locked-real"><ShieldCheck/><h2>Votre compte Sudoku Clash</h2><p>Connectez-vous pour retrouver votre profil et vos résultats.</p><button className="primary" onClick={openAuth}>Se connecter ou créer un compte</button></div>;
 const joined=stats?.profile?.created_at??Date.parse(account.user.created_at);
 return <div className="account-overview"><section className="panel account-identity"><PlayerAvatar avatarId={cosmetics.state?.avatarId} image={cosmetics.state?.customAvatar} frameId={cosmetics.state?.frameId} size="large"/><div><span className="eyebrow">MON COMPTE</span><h2>{stats?.profile?.username??account.profile?.username??"Pseudo à choisir"}</h2><p>{account.user.email}</p><small>Inscrit depuis le {new Date(joined).toLocaleDateString("fr-FR")}</small></div></section><CosmeticCloset cosmetics={cosmetics} notify={notify}/>
  {loading?<div className="panel">Chargement des statistiques…</div>:error?<div className="panel">Statistiques momentanément indisponibles. Revenez dans quelques instants.</div>:stats&&<><section className="account-stat-grid"><div className="panel"><span>Rang classé</span><b>{stats.ranked.rank}</b></div><div className="panel"><span>Points classés</span><b>{stats.ranked.points}</b><small>{stats.ranked.wins} victoires · {stats.ranked.losses} défaites</small></div><div className="panel"><span>Grilles solo terminées</span><b>{stats.solo.games}</b></div><div className="panel"><span>Meilleur temps solo</span><b>{stats.solo.best==null?"—":gameTime(stats.solo.best)}</b></div><div className="panel"><span>Défis du jour terminés</span><b>{stats.daily}</b></div><div className="panel"><span>Défis hebdo terminés</span><b>{stats.weekly}</b></div></section><section className="panel account-history"><h3>Dernières grilles solo</h3>{stats.recent.length?stats.recent.map((result,index)=><div key={`${result.completed_at}-${index}`}><span>{result.difficulty}</span><b>{gameTime(result.elapsed_seconds)}</b><small>{new Date(result.completed_at).toLocaleDateString("fr-FR")}</small></div>):<p>Aucune grille solo terminée pour le moment.</p>}</section></>}
 </div>;
}

export function RealFriends({account,notify,openAuth}:{account:ReturnType<typeof useAccount>;notify:(s:string)=>void;openAuth:()=>void}){
 if(!account.user)return <Locked title="Retrouvez vos amis" text="Connectez-vous pour choisir un pseudo unique, ajouter des amis et les défier." action={openAuth}/>;
 return <FriendsDirectory account={account} notify={notify}/>;
}

export function PrivateLobby({account,notify,openAuth,onRace}:{account:ReturnType<typeof useAccount>;notify:(s:string)=>void;openAuth:()=>void;onRace:(room:Room,players:RoomPlayer[])=>React.ReactNode}){
 const[room,setRoom]=useState<Room|null>(null),[players,setPlayers]=useState<RoomPlayer[]>([]),[code,setCode]=useState(""),[busy,setBusy]=useState(false);
 const me=account.user?.id;
 const load=useCallback(async(roomId:string)=>{const[{data:r},{data:p}]=await Promise.all([supabase.from("rooms").select("*").eq("id",roomId).single(),supabase.from("room_players").select("*,profile:profiles!room_players_user_id_fkey(id,username,display_name,avatar_url,last_seen)").eq("room_id",roomId).order("joined_at")]);if(r)setRoom(r as Room);if(p)setPlayers(p as unknown as RoomPlayer[])},[]);
 useEffect(()=>{if(!room?.id)return;const channel=supabase.channel(`room:${room.id}`).on("postgres_changes",{event:"*",schema:"public",table:"rooms",filter:`id=eq.${room.id}`},()=>load(room.id)).on("postgres_changes",{event:"*",schema:"public",table:"room_players",filter:`room_id=eq.${room.id}`},()=>load(room.id)).subscribe();return()=>{void supabase.removeChannel(channel)}},[room?.id,load]);
 if(!account.user)return <Locked title="Jouez vraiment à plusieurs" text="Un compte est nécessaire pour créer ou rejoindre un salon privé synchronisé." action={openAuth}/>;
 const create=async()=>{setBusy(true);const game="Intermédiaire";const puzzle="000260701680070090190004500820100040004602900050003028009300074040050036703018000";const solution=solveText(puzzle);const{data,error}=await supabase.rpc("create_room",{p_difficulty:game,p_puzzle:puzzle,p_solution:solution,p_max_players:2});setBusy(false);if(error)return notify(friendly(error.message));const row=Array.isArray(data)?data[0]:data;if(row){await load(row.room_id);notify("Salon créé")}};
 const join=async()=>{setBusy(true);const{data,error}=await supabase.rpc("join_room",{p_code:code.trim().toUpperCase()});setBusy(false);if(error)return notify(friendly(error.message));if(data)await load(data as string)};
 const toggleReady=async()=>{const current=players.find(p=>p.user_id===me);if(!room||!current)return;const{error}=await supabase.rpc("set_room_ready",{p_room_id:room.id,p_ready:!current.is_ready});if(error)notify(friendly(error.message));else await load(room.id)};
 const start=async()=>{if(!room)return;const{error}=await supabase.rpc("start_room",{p_room_id:room.id});if(error)notify(friendly(error.message));else await load(room.id)};
 if(room?.status==="playing"||room?.status==="finished")return <>{onRace(room,players)}</>;
 if(!room)return <div className="panel private real-private"><Users/><h2>Salon privé réel</h2><p>Créez une course synchronisée ou saisissez le code reçu d’un ami.</p><div className="private-choices"><button className="primary" disabled={busy} onClick={create}>{busy?"Création…":"Créer un salon 1 contre 1"}</button><span>OU</span><div><input value={code} onChange={e=>setCode(e.target.value.replace(/[^a-z0-9]/gi,"").slice(0,6).toUpperCase())} placeholder="CODE À 6 CARACTÈRES"/><button disabled={busy||code.length!==6} onClick={join}>Rejoindre</button></div></div></div>;
 const self=players.find(p=>p.user_id===me);const allReady=players.length>=2&&players.every(p=>p.is_ready);return <div className="panel private real-private"><Users/><span className="eyebrow">SALON PRIVÉ</span><h2>Code <b>{room.code}</b></h2><button className="copy-code" onClick={()=>navigator.clipboard.writeText(room.code).then(()=>notify("Code copié"))}><Copy/>Copier le code</button><div className="lobby-list">{players.map(p=><div key={p.user_id}><div className="avatar">{(p.profile?.username||"?").slice(0,2).toUpperCase()}</div><span><b>{p.profile?.username||"Joueur"}</b><small>{p.user_id===room.host_id?"Hôte":"Invité"}</small></span><em className={p.is_ready?"ready":""}>{p.is_ready?"PRÊT":"EN ATTENTE"}</em></div>)}</div><button className="primary" onClick={toggleReady}>{self?.is_ready?"Annuler prêt":"Je suis prêt"}</button>{me===room.host_id&&<button className="primary start-room" disabled={!allReady} onClick={start}>{players.length<2?"En attente d’un adversaire":allReady?"Lancer la course":"Tous les joueurs doivent être prêts"}</button>}</div>
}

function Locked({title,text,action}:{title:string;text:string;action:()=>void}){return <div className="panel locked-real"><LogIn/><h2>{title}</h2><p>{text}</p><button className="primary" onClick={action}>Se connecter ou créer un compte</button></div>}
function solveText(value:string){const g=value.split("").map(Number);const valid=(p:number,n:number)=>{const r=Math.floor(p/9),c=p%9;for(let i=0;i<9;i++)if(g[r*9+i]===n||g[i*9+c]===n)return false;const br=Math.floor(r/3)*3,bc=Math.floor(c/3)*3;for(let y=0;y<3;y++)for(let x=0;x<3;x++)if(g[(br+y)*9+bc+x]===n)return false;return true};const go=():boolean=>{const p=g.findIndex(x=>!x);if(p<0)return true;for(let n=1;n<=9;n++)if(valid(p,n)){g[p]=n;if(go())return true;g[p]=0}return false};if(!go())throw new Error("Grille invalide");return g.join("")}

export function AccountButton({account,onOpen,onAccount,cosmetics}:{account:ReturnType<typeof useAccount>;onOpen:()=>void;onAccount:()=>void;cosmetics:ReturnType<typeof useCosmetics>}){
  if(account.loading)return <div className="profile"><div className="avatar">…</div></div>;
  if(!account.user)return <button className="profile signin account-trigger account-orb" onClick={onOpen} aria-label="Se connecter"><span className="avatar">?</span></button>;
  const level=cosmetics.state?.level??1;
  return <div className="profile"><button className="profile-account-link account-orb" onClick={onAccount} aria-label={`Ouvrir mon compte, niveau ${level}`}><PlayerAvatar avatarId={cosmetics.state?.avatarId} image={cosmetics.state?.customAvatar} frameId={cosmetics.state?.frameId}/><span className="orb-level" aria-hidden="true">Niv. {level}</span></button><button className="logout" aria-label="Se déconnecter" onClick={()=>supabase.auth.signOut()}><LogOut/></button></div>
}
