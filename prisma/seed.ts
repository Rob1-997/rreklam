import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
type Name = { code:string; hy:string; ru:string; en:string };
const yerevan:Name={code:"yerevan",hy:"Երևան",ru:"Ереван",en:"Yerevan"};
const marzes:{region:Name;center:Name}[]=[
  {region:{code:"aragatsotn",hy:"Արագածոտն",ru:"Арагацотн",en:"Aragatsotn"},center:{code:"ashtarak",hy:"Աշտարակ",ru:"Аштарак",en:"Ashtarak"}},
  {region:{code:"ararat",hy:"Արարատ",ru:"Арарат",en:"Ararat"},center:{code:"artashat",hy:"Արտաշատ",ru:"Арташат",en:"Artashat"}},
  {region:{code:"armavir_region",hy:"Արմավիր",ru:"Армавирская область",en:"Armavir region"},center:{code:"armavir",hy:"Արմավիր",ru:"Армавир",en:"Armavir"}},
  {region:{code:"gegharkunik",hy:"Գեղարքունիք",ru:"Гегаркуник",en:"Gegharkunik"},center:{code:"gavar",hy:"Գավառ",ru:"Гавар",en:"Gavar"}},
  {region:{code:"kotayk",hy:"Կոտայք",ru:"Котайк",en:"Kotayk"},center:{code:"hrazdan",hy:"Հրազդան",ru:"Раздан",en:"Hrazdan"}},
  {region:{code:"lori",hy:"Լոռի",ru:"Лори",en:"Lori"},center:{code:"vanadzor",hy:"Վանաձոր",ru:"Ванадзор",en:"Vanadzor"}},
  {region:{code:"shirak",hy:"Շիրակ",ru:"Ширак",en:"Shirak"},center:{code:"gyumri",hy:"Գյումրի",ru:"Гюмри",en:"Gyumri"}},
  {region:{code:"syunik",hy:"Սյունիք",ru:"Сюник",en:"Syunik"},center:{code:"kapan",hy:"Կապան",ru:"Капан",en:"Kapan"}},
  {region:{code:"tavush",hy:"Տավուշ",ru:"Тавуш",en:"Tavush"},center:{code:"ijevan",hy:"Իջևան",ru:"Иджеван",en:"Ijevan"}},
  {region:{code:"vayots_dzor",hy:"Վայոց ձոր",ru:"Вайоцдзор",en:"Vayots Dzor"},center:{code:"yeghegnadzor",hy:"Եղեգնաձոր",ru:"Ехегнадзор",en:"Yeghegnadzor"}}
];
async function seed(){
  await db.location.upsert({where:{code:yerevan.code},update:{},create:{code:yerevan.code,nameHy:yerevan.hy,nameRu:yerevan.ru,nameEn:yerevan.en,kind:"CITY"}});
  for(const {region,center} of marzes){
    const parent=await db.location.upsert({where:{code:region.code},update:{kind:"REGION"},create:{code:region.code,nameHy:region.hy,nameRu:region.ru,nameEn:region.en,kind:"REGION"}});
    await db.location.upsert({where:{code:center.code},update:{kind:"CITY",parentId:parent.id},create:{code:center.code,nameHy:center.hy,nameRu:center.ru,nameEn:center.en,kind:"CITY",parentId:parent.id}});
  }
  for(const [code,nameRu] of [["sedan","Седан"],["hatchback","Хэтчбек"],["suv","Внедорожник"],["minivan","Минивэн"],["van","Фургон"],["wagon","Универсал"],["coupe","Купе"],["other","Другой"]] as const){
    await db.bodyType.upsert({where:{code},update:{nameRu},create:{code,nameRu}});
  }
  for(const days of [7,14,30,90])for(const format of ["REAR_WINDOW","DOORS","PARTIAL","FULL"] as const){
    await db.adPackage.upsert({where:{format_durationDays:{format,durationDays:days}},update:{},create:{code:`${format}_${days}`,format,durationDays:days,active:false}});
  }
  console.log("Seeded 10 marzes, Yerevan, 11 centers, body types and unpublished packages.");
}
seed().finally(()=>db.$disconnect());
