export function overlaps(a,b){return a.start < b.end&&b.start < a.end}
export function isAvailable(vehicle,{cityId,start,end,allocations}){if(typeof start!=="string"||typeof end!=="string"||start>=end)throw Error("Invalid interval");if(!vehicle.approved||vehicle.suspended||!vehicle.serviceCityIds.includes(cityId))return false;return !allocations.some(a=>a.vehicleId===vehicle.id&&["HELD","CONFIRMED","INSTALLING","ACTIVE","REMOVING"].includes(a.status)&&overlaps({start,end},{start:a.start,end:a.end}))}
export function availableUniqueCount(vehicles,request){return new Set(vehicles.filter(v=>isAvailable(v,request)).map(v=>v.id)).size}
export function isBelowThreshold(free,minimum){if(!Number.isInteger(minimum)||minimum<0)throw Error("Invalid threshold");return free<minimum}
