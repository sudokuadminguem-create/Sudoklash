import type {ChallengeKind} from "./challenges";

const parisClock=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
type CalendarDay={year:number;month:number;day:number};

function parisParts(instant:Date){
 const parts=Object.fromEntries(parisClock.formatToParts(instant).map(part=>[part.type,Number(part.value)]));
 return {year:parts.year,month:parts.month,day:parts.day,hour:parts.hour,minute:parts.minute,second:parts.second};
}

function shiftDay(day:CalendarDay,days:number):CalendarDay{
 const date=new Date(Date.UTC(day.year,day.month-1,day.day+days));
 return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate()};
}

function dateId(day:CalendarDay){return `${day.year}-${String(day.month).padStart(2,"0")}-${String(day.day).padStart(2,"0")}`}

// Convert a Paris wall-clock time to a UTC instant. Iterating the offset handles winter/summer time.
function parisTime(day:CalendarDay,hour:number,minute:number){
 const wall=Date.UTC(day.year,day.month-1,day.day,hour,minute);
 let instant=wall;
 for(let index=0;index<3;index++){
  const local=parisParts(new Date(instant));
  const offset=Date.UTC(local.year,local.month-1,local.day,local.hour,local.minute,local.second)-instant;
  instant=wall-offset;
 }
 return instant;
}

export function challengeWindow(kind:ChallengeKind,now=new Date()){
 const local=parisParts(now),today={year:local.year,month:local.month,day:local.day};
 if(kind==="daily")return {periodId:dateId(today),nextAt:new Date(parisTime(shiftDay(today,1),0,0)).toISOString()};
 const daysSinceSunday=new Date(Date.UTC(today.year,today.month-1,today.day)).getUTCDay();
 let sunday=shiftDay(today,-daysSinceSunday);
 if(now.getTime()<parisTime(sunday,23,59))sunday=shiftDay(sunday,-7);
 // Keep Monday IDs so attempts started before this update remain attached to their week.
 return {periodId:dateId(shiftDay(sunday,1)),nextAt:new Date(parisTime(shiftDay(sunday,7),23,59)).toISOString()};
}

// Sudoku symmetries keep the same solution count and difficulty while changing the visible grid.
export function periodPuzzle(puzzle:string,kind:ChallengeKind,periodId:string){
 let seed=2166136261;
 for(const char of `${kind}:${periodId}:${puzzle}`)seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296};
 const shuffle=(values:number[])=>{const result=[...values];for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result};
 const lines=()=>shuffle([0,1,2]).flatMap(group=>shuffle([0,1,2]).map(line=>group*3+line));
 const rows=lines(),columns=lines(),digits=shuffle([1,2,3,4,5,6,7,8,9]),transpose=random()<.5;
 return Array.from({length:81},(_,index)=>{
  const row=Math.floor(index/9),column=index%9;
  const value=Number(transpose?puzzle[rows[column]*9+columns[row]]:puzzle[rows[row]*9+columns[column]]);
  return value?digits[value-1]:0;
 }).join("");
}
