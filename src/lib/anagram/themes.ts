export type ThemeId =
  | "animals"
  | "food"
  | "nature"
  | "body"
  | "places"
  | "people"
  | "time"
  | "color"
  | "faith"
  | "ideas";

export const THEMES: { id: ThemeId; label: string; hint: string }[] = [
  { id: "animals", label: "Animals", hint: "Creatures, birds, fish, insects" },
  { id: "food", label: "Food", hint: "Meals, drink, cooking, crops" },
  { id: "nature", label: "Nature", hint: "Weather, plants, land, water" },
  { id: "body", label: "Body", hint: "Anatomy, health, senses" },
  { id: "places", label: "Places", hint: "Land, towns, rooms, travel" },
  { id: "people", label: "People", hint: "Roles, kin, names, titles" },
  { id: "time", label: "Time", hint: "Hours, seasons, age, history" },
  { id: "color", label: "Color", hint: "Hues, light, shade" },
  { id: "faith", label: "Faith", hint: "Scripture, worship, virtue" },
  { id: "ideas", label: "Ideas", hint: "Abstract nouns and qualities" },
];

const LISTS: Record<ThemeId, string[]> = {
  animals: [
    "ant","ape","asp","bat","bear","bee","bird","boar","buck","bull","calf","carp","cat","chick",
    "clam","cobra","cod","colt","cow","crab","crane","crow","cub","deer","dog","dove","duck","eagle",
    "eel","elk","emu","ewe","fawn","finch","fish","flea","fly","foal","fox","frog","gnat","goat",
    "goose","grouse","gull","hare","hawk","hen","herd","heron","hog","horse","hound","jay","lamb",
    "lark","lion","lizard","llama","loon","lynx","mare","mink","mole","moose","moth","mouse","mule",
    "newt","owl","ox","oyster","panda","parrot","pig","pike","pony","puma","pup","quail","rabbit",
    "ram","rat","raven","roach","rook","seal","shark","sheep","shrew","skunk","slug","snail","snake",
    "snipe","sow","sparrow","squid","stag","swan","swift","tiger","toad","trout","tuna","turtle",
    "wasp","whale","wolf","wren","yak","zebra","animal","beast","cattle","fowl","insect","kitten",
    "puppy","swarm","wildlife","bison","camel","donkey","ferret","gibbon","hyena","iguana","jackal",
    "koala","lemur","lizard","lobster","magpie","monkey","otter","pelican","pigeon","salmon","shrimp",
    "spider","squirrel","turkey","viper","walrus","weasel","wombat",
  ],
  food: [
    "ale","apple","bake","bean","beef","beer","berry","bread","broth","bun","butter","cake","candy",
    "cheese","cherry","chili","cider","clam","cocoa","coffee","corn","crab","cream","crust","curry",
    "date","dill","dough","egg","fig","fish","flour","food","fruit","fudge","garlic","gin","grape",
    "gravy","greens","ham","herb","honey","jam","jelly","juice","kale","lamb","leek","lemon","lime",
    "loaf","malt","mango","meal","meat","melon","milk","mint","noodle","nut","oat","oil","olive",
    "onion","orange","oven","pan","pasta","peach","pear","peel","pepper","pie","pizza","plum","pork",
    "potato","pretzel","prune","pudding","pumpkin","radish","raisin","rice","roast","roll","rum",
    "rye","salad","salt","sauce","seed","soup","spice","steak","stew","sugar","supper","syrup","tart",
    "tea","toast","tomato","tuna","vanilla","veal","wheat","wine","yam","yeast","yogurt","broil",
    "cook","feast","grain","lunch","snack","spice","turkey","vinegar","waffle","walnut","water",
  ],
  nature: [
    "ash","bay","beach","bluff","bog","branch","breeze","brook","bud","bush","canyon","cave","cedar",
    "cliff","cloud","coal","coast","creek","dale","dawn","delta","dew","dirt","dune","dust","earth",
    "elm","fern","field","fir","flood","flora","flower","fog","forest","frost","glen","grass","grove",
    "gust","hail","hill","ice","island","lake","land","leaf","marsh","meadow","mist","moon","moss",
    "mountain","mud","oak","ocean","peak","pine","pond","pool","rain","reef","river","rock","root",
    "sand","sea","seed","shade","sky","snow","soil","spring","star","stone","storm","stream","sun",
    "swamp","thorn","tide","tree","valley","vine","wave","wind","wood","world","bloom","cinder",
    "crag","glade","glacier","horizon","jungle","lava","meadow","pebble","petal","prairie","ridge",
    "shore","summit","thunder","tundra","volcano","waterfall","weed","willow",
  ],
  body: [
    "arm","back","blood","bone","brain","breath","brow","cheek","chest","chin","ear","elbow","eye",
    "face","finger","fist","flesh","foot","gut","hair","hand","head","heart","heel","hip","jaw",
    "joint","knee","leg","lip","liver","lung","mind","mouth","muscle","nail","neck","nerve","nose",
    "palm","rib","shin","sinew","skin","skull","spine","stomach","throat","thumb","toe","tongue",
    "tooth","vein","waist","wrist","ankle","artery","belly","body","brain","cornea","femur","gland",
    "kidney","knuckle","marrow","organ","pulse","pupil","scalp","sense","skull","spine","tendon",
    "tissue","torso","ulcer","ulna","wound","health","pain","sleep","sweat","tear","voice",
  ],
  places: [
    "abbey","alley","arch","arena","attic","bank","barn","bay","bridge","camp","castle","cave",
    "cell","chapel","church","city","court","den","dock","dome","door","farm","field","fort","gate",
    "hall","harbor","home","house","hut","inn","isle","jail","keep","kirk","land","lane","loft",
    "mall","manor","mill","mine","moor","nest","office","park","path","pier","pit","place","plaza",
    "port","post","pub","quay","ranch","road","room","ruin","school","shed","ship","shop","shore",
    "shrine","site","square","stage","stall","station","store","street","studio","temple","town",
    "trail","vault","village","wall","ward","wharf","yard","africa","america","asia","athens","rome",
    "paris","london","egypt","israel","jordan","nile","zion","desert","harbor","island","market",
    "palace","prison","region","river","state","studio","subway","tower","tunnel","valley",
  ],
  people: [
    "actor","adult","agent","aunt","baby","bard","baron","boy","bride","chief","child","clerk",
    "cook","cousin","crew","crowd","dad","dame","daughter","dean","doctor","duke","earl","elder",
    "father","folk","friend","girl","guard","guest","guide","heir","hero","host","human","husband",
    "judge","king","knight","lady","lord","lover","maid","man","master","mate","mayor","men","mom",
    "monk","mother","nurse","owner","pal","parent","people","person","pilot","poet","priest","prince",
    "queen","rabbi","saint","scout","sister","son","spouse","staff","stranger","student","teacher",
    "thief","uncle","user","victim","visitor","ward","widow","wife","woman","women","worker","youth",
    "adam","anna","david","esther","eve","isaac","jacob","james","john","joseph","luke","mark",
    "mary","moses","noah","paul","peter","rachel","ruth","sarah","solomon","thomas",
  ],
  time: [
    "age","april","august","autumn","century","dawn","day","decade","december","dusk","eon","epoch",
    "era","evening","fall","february","friday","future","hour","january","july","june","late","march",
    "may","midnight","minute","monday","month","morning","night","noon","november","now","october",
    "past","present","second","september","spring","summer","sunday","thursday","time","today",
    "tomorrow","tonight","tuesday","week","winter","year","yesterday","youth","season","moment",
    "while","always","never","often","soon","then","when","early","later","after","before",
  ],
  color: [
    "amber","ash","azure","beige","black","blue","bronze","brown","carmine","cerise","cobalt",
    "copper","coral","cream","crimson","cyan","ebony","gold","golden","gray","green","grey","indigo",
    "ivory","jade","khaki","lavender","lilac","lime","magenta","maroon","mauve","navy","ochre",
    "olive","orange","peach","pink","plum","purple","red","rose","ruby","russet","rust","sable",
    "salmon","scarlet","sepia","silver","tan","taupe","teal","umber","violet","white","yellow",
    "hue","shade","tint","tone","pale","dark","light","bright","dull","vivid",
  ],
  faith: [
    "altar","amen","angel","anoint","apostle","ark","baptism","belief","bible","bless","blessing",
    "choir","christ","church","covenant","creator","cross","deacon","disciple","divine","easter",
    "eden","elect","faith","fast","father","fear","fellowship","forgive","glory","god","gospel",
    "grace","heaven","hell","holy","hope","hymn","idol","incense","jesus","joy","judge","kingdom",
    "lamb","lord","love","mercy","messiah","miracle","mission","offering","parish","passover",
    "pastor","peace","praise","pray","prayer","priest","prophet","psalm","redeem","repent","rest",
    "reverence","righteous","sabbath","sacrament","sacrifice","saint","salvation","sanctify",
    "scripture","sermon","sin","soul","spirit","temple","testimony","tithe","truth","vine","vow",
    "wisdom","witness","word","worship","zion","adonai","hosanna","hallelujah","shabbat","torah",
  ],
  ideas: [
    "art","beauty","cause","chance","change","choice","courage","duty","error","fact","fate",
    "fear","force","form","freedom","good","grief","guilt","habit","honor","idea","justice","law",
    "liberty","life","logic","loss","luck","meaning","memory","mind","moral","myth","name","need",
    "order","pain","power","pride","proof","reason","right","risk","rule","sense","shame","skill",
    "story","strength","style","theory","thought","trust","truth","value","vice","virtue","will",
    "wisdom","wonder","work","worth","anger","calm","care","desire","doubt","dream","envy","hate",
    "love","mercy","patience","pity","rage","sorrow","wonder","aim","end","goal","plan","purpose",
  ],
};

export const themeWords: Record<ThemeId, Set<string>> = Object.fromEntries(
  THEMES.map((t) => [t.id, new Set(LISTS[t.id].map((w) => w.toLowerCase()))]),
) as Record<ThemeId, Set<string>>;

export function isThemeId(v: string | null | undefined): v is ThemeId {
  return !!v && THEMES.some((t) => t.id === v);
}

export function wordInTheme(word: string, theme: ThemeId | null): boolean {
  if (!theme) return false;
  return themeWords[theme].has(word.toLowerCase());
}

export function phraseThemeScore(words: string[], theme: ThemeId | null): number {
  if (!theme) return 0;
  const set = themeWords[theme];
  let n = 0;
  for (const w of words) if (set.has(w)) n += 1;
  return n;
}
