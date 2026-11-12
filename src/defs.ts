/** Metric definitions, mirrored from the Unity Catalog Pages. Paste each Page's URL into `url` to link the popover to it. */
export type Def = { name: string; def: string; calc: string; domain: string; url: string };

export const DEFS: Record<string, Def> = {
  offered: { name: 'Contacts Offered', def: 'Inbound contacts that entered a queue, handled or abandoned.', calc: "COUNT(*) WHERE direction = 'Inbound'", domain: 'Contact Operations', url: '' },
  abandon: { name: 'Abandon Rate', def: 'Share of inbound contacts where the customer left before reaching an agent. A queue metric, never attributed to an agent.', calc: 'abandoned / offered, inbound only', domain: 'Contact Operations', url: '' },
  aht: { name: 'Average Handle Time', def: 'Talk, hold and after-contact work per handled contact, in seconds.', calc: 'AVG(handle + hold + acw) over handled contacts', domain: 'Contact Operations', url: '' },
  tnps: { name: 'tNPS', def: 'Post-contact net promoter score from −100 to +100. Promoters score 9–10, detractors 0–6.', calc: '(promoters − detractors) / responses × 100', domain: 'Contact Operations', url: '' },
  hold: { name: 'Average Hold Time', def: 'Average seconds on hold per handled contact. Hold only occurs on Voice.', calc: 'AVG(hold_seconds) over handled contacts', domain: 'Contact Operations', url: '' },
  transfer: { name: 'Transfer Rate', def: 'Share of handled contacts transferred to another agent or queue.', calc: 'transferred / handled', domain: 'Contact Operations', url: '' },
  repeat: { name: 'Repeat Contact Rate', def: 'Share of inbound contacts from a customer who also contacted in the prior 7 days.', calc: 'COUNT_IF(repeat_within_7d) / offered', domain: 'Contact Operations', url: '' },
  fcvar: { name: 'Forecast Variance', def: 'Actual offered contacts minus forecast contacts, as a count and a percentage.', calc: '(actual − forecast) / forecast', domain: 'Contact Operations', url: '' },
  promoter: { name: 'Promoter %', def: 'Share of survey responses scoring 9 or 10.', calc: 'COUNT_IF(score >= 9) / responses', domain: 'Contact Operations', url: '' },
  detractor: { name: 'Detractor %', def: 'Share of survey responses scoring 0 to 6.', calc: 'COUNT_IF(score <= 6) / responses', domain: 'Contact Operations', url: '' },
  rrate: { name: 'Survey Response Rate', def: 'Surveys returned per handled contact. Abandoned contacts are never surveyed.', calc: 'responses / handled contacts', domain: 'Contact Operations', url: '' },
  util: { name: 'Utilization', def: 'Share of paid hours spent talking with customers. Below 0.50 in a pay period is under-utilized.', calc: 'handle hours / (regular + OT + training hours)', domain: 'Finance', url: '' },
  under: { name: 'Under-utilized Agents', def: 'Agents with utilization below 0.50 in a pay period.', calc: 'COUNT(agents) WHERE utilization < 0.50', domain: 'Finance', url: '' },
  occ: { name: 'Occupancy', def: 'Share of scheduled production time spent working contacts, including hold and wrap-up.', calc: '(handle + hold + acw hours) / scheduled Production hours', domain: 'Finance', url: '' },
  cost: { name: 'Total Labor Cost', def: 'Agent pay for the period: regular pay plus overtime pay.', calc: 'regular_pay + ot_pay', domain: 'Finance', url: '' },
  planpay: { name: 'Planned Pay and Pay Variance', def: 'Actual pay compared with the wage plan of scheduled Production hours × rate.', calc: 'total labor cost − scheduled production hours × rate', domain: 'Finance', url: '' },
  ot: { name: 'Regular vs OT Pay', def: 'Overtime is paid at 1.5 times the hourly rate on top of the shift.', calc: 'ot_hours × hourly_rate × 1.5', domain: 'Finance', url: '' },
  cpc: { name: 'Cost per Handled Contact', def: 'Agent labor cost divided by the contacts those agents handled.', calc: 'total labor cost / handled contacts', domain: 'Finance', url: '' },
};
