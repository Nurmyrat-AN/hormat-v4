import type {SourceDocument} from './mapping.js';
/** Only an explicit source offset establishes an instant. Never infer UTC/local time. */
export function sourceEditTimestamp(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if(!m)return null;
  const [year,month,day,hour,minute,second]=m.slice(1,7).map(Number);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1]||hour>23||minute>59||second>59)return null;
  if(m[8]!=='Z' && (Number(m[10])>15||Number(m[11])>59))return null;
  // Pass fractional seconds intact; PostgreSQL rounds to its microsecond precision.
  return value;
}
export function sourceEditTimestamps(documents:SourceDocument[]):string[]{
  return documents.flatMap(document=>{
    if(document.deleted)return [];
    const value=sourceEditTimestamp(document.data.uytgeme_tarih);
    return value===null?[]:[value];
  });
}
