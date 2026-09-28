import {achievementFrames,earnedAchievements} from "./achievement-frames";
import {achievementProgress} from "./achievement-progress";

export async function playerAchievements(db:D1Database,userId:string,points:number){
 const [progress,prior]=await Promise.all([
  achievementProgress(db,userId,points),
  db.prepare("SELECT achievement_id FROM achievement_unlocks WHERE user_id=?").bind(userId).all<{achievement_id:string}>(),
 ]);
 const known=new Set(prior.results.map(row=>row.achievement_id));
 const earned=earnedAchievements(progress,known);
 const newAwards=earned.filter(a=>!known.has(a.id));
 if(newAwards.length){
  await db.batch(newAwards.map(a=>db.prepare("INSERT OR IGNORE INTO achievement_unlocks(user_id,achievement_id,unlocked_at) VALUES(?,?,?)").bind(userId,a.id,Date.now())));
 }
 const ids=new Set(earned.map(a=>a.id));
 return {progress,ids,newAwards:newAwards.map(a=>a.id),visibleCount:achievementFrames.filter(a=>a.rarity==="simple"&&ids.has(a.id)).length,epicCount:achievementFrames.filter(a=>a.rarity==="epic"&&ids.has(a.id)).length};
}
