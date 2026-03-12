export type Personality = 'divergent' | 'preserver' | 'agent' | 'visionary';

export interface QuizOption {
  text: string;
  personality: Personality;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: [QuizOption, QuizOption, QuizOption, QuizOption];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: 1,
    question: 'What would have happened if Rome never fell?',
    options: [
      { text: 'A global Roman republic with advanced aqueduct-based internet', personality: 'divergent' },
      { text: 'Eventually the same outcome — empires always decline', personality: 'preserver' },
      { text: 'Constant civil wars would have torn it apart even faster', personality: 'agent' },
      { text: 'A united Europe centuries earlier, accelerating science and democracy', personality: 'visionary' },
    ],
  },
  {
    id: 2,
    question: 'Which historical figure would have been the best modern president?',
    options: [
      { text: 'Cleopatra — master diplomat and multilingual strategist', personality: 'divergent' },
      { text: 'Marcus Aurelius — philosopher-king who believed in duty', personality: 'preserver' },
      { text: 'Genghis Khan — he\'d disrupt every institution on day one', personality: 'agent' },
      { text: 'Leonardo da Vinci — science advisor and president in one', personality: 'visionary' },
    ],
  },
  {
    id: 3,
    question: 'What technology would exist if the Library of Alexandria survived?',
    options: [
      { text: 'Steam-powered airships by the year 500 AD', personality: 'divergent' },
      { text: 'Roughly the same — one library can\'t change the arc of progress', personality: 'preserver' },
      { text: 'Knowledge monopoly would have caused massive power imbalances', personality: 'agent' },
      { text: 'A scientific revolution 1,000 years early, leading to space travel by 1500', personality: 'visionary' },
    ],
  },
  {
    id: 4,
    question: 'If the Aztec Empire had survived, what would the Americas look like today?',
    options: [
      { text: 'A blend of Mesoamerican and European cultures unlike anything we know', personality: 'divergent' },
      { text: 'Colonization was inevitable — the outcome would be similar', personality: 'preserver' },
      { text: 'Ongoing wars between empires for continental dominance', personality: 'agent' },
      { text: 'Advanced agricultural science and sustainable cities centuries ahead', personality: 'visionary' },
    ],
  },
  {
    id: 5,
    question: 'What if Napoleon had won at Waterloo?',
    options: [
      { text: 'A unified Europe under the metric system and secular law', personality: 'divergent' },
      { text: 'Another coalition would have eventually defeated him anyway', personality: 'preserver' },
      { text: 'Permanent continental warfare for another century', personality: 'agent' },
      { text: 'Rapid industrialization and a French-led space program by 1900', personality: 'visionary' },
    ],
  },
  {
    id: 6,
    question: 'What if the internet was invented 50 years earlier?',
    options: [
      { text: 'The 1960s counterculture goes global instantly — world peace by 1975', personality: 'divergent' },
      { text: 'Governments would have controlled it and slowed adoption', personality: 'preserver' },
      { text: 'Cold War cyberwarfare spirals everything into chaos', personality: 'agent' },
      { text: 'We\'d already have colonies on Mars by now', personality: 'visionary' },
    ],
  },
  {
    id: 7,
    question: 'What if ancient Greece never developed democracy?',
    options: [
      { text: 'Some other civilization would have invented it differently', personality: 'divergent' },
      { text: 'Monarchy and empire would still be the global norm today', personality: 'preserver' },
      { text: 'Constant tyrannical overthrows and revolutions everywhere', personality: 'agent' },
      { text: 'A merit-based technocracy might have emerged instead', personality: 'visionary' },
    ],
  },
  {
    id: 8,
    question: 'What if the Black Death never happened?',
    options: [
      { text: 'Feudalism persists but evolves into something totally new', personality: 'divergent' },
      { text: 'The Renaissance was coming regardless — just slower', personality: 'preserver' },
      { text: 'Overpopulation leads to massive resource wars by 1500', personality: 'agent' },
      { text: 'Labor stays cheap, but education spreads faster without the chaos', personality: 'visionary' },
    ],
  },
  {
    id: 9,
    question: 'What if China discovered the Americas first?',
    options: [
      { text: 'A Pacific-centered world with completely different trade routes', personality: 'divergent' },
      { text: 'Similar colonization patterns — human nature doesn\'t change', personality: 'preserver' },
      { text: 'Ming dynasty expansion triggers worldwide imperial conflicts', personality: 'agent' },
      { text: 'Peaceful trade networks and shared technology advancement', personality: 'visionary' },
    ],
  },
  {
    id: 10,
    question: 'What if Einstein had been born 200 years earlier?',
    options: [
      { text: 'His ideas would have been considered heretical magic', personality: 'divergent' },
      { text: 'Without modern math foundations, his genius goes unrecognized', personality: 'preserver' },
      { text: 'The church would have imprisoned or executed him', personality: 'agent' },
      { text: 'He jumpstarts physics early and we have nuclear power by 1850', personality: 'visionary' },
    ],
  },
  {
    id: 11,
    question: 'What if the Vikings successfully colonized North America?',
    options: [
      { text: 'A Norse-Indigenous hybrid culture unlike anything in history', personality: 'divergent' },
      { text: 'Small settlements that eventually get absorbed — no lasting impact', personality: 'preserver' },
      { text: 'Viking raiding culture destabilizes the entire continent', personality: 'agent' },
      { text: 'Earlier transatlantic trade routes accelerate global development', personality: 'visionary' },
    ],
  },
  {
    id: 12,
    question: 'What if the printing press was never invented?',
    options: [
      { text: 'Knowledge spreads through oral tradition and develops completely differently', personality: 'divergent' },
      { text: 'Someone else invents it within a few decades', personality: 'preserver' },
      { text: 'Elites maintain total information control indefinitely', personality: 'agent' },
      { text: 'We develop advanced memory techniques and visual communication instead', personality: 'visionary' },
    ],
  },
  {
    id: 13,
    question: 'What if the Ottoman Empire never fell?',
    options: [
      { text: 'A three-superpower 20th century: Ottoman, British, American', personality: 'divergent' },
      { text: 'Internal pressures would have reformed it into a constitutional monarchy', personality: 'preserver' },
      { text: 'Proxy wars across the Middle East are even more complex', personality: 'agent' },
      { text: 'A bridge between East and West accelerating cultural exchange', personality: 'visionary' },
    ],
  },
  {
    id: 14,
    question: 'What if dinosaurs never went extinct?',
    options: [
      { text: 'Intelligent dinosaurs develop their own civilization', personality: 'divergent' },
      { text: 'Mammals never rise — no humans, no quiz, no nothing', personality: 'preserver' },
      { text: 'Constant predator-prey arms races create mega-fauna chaos', personality: 'agent' },
      { text: 'Dinosaurs and mammals coevolve, creating a richer ecosystem', personality: 'visionary' },
    ],
  },
  {
    id: 15,
    question: 'What if the Moon was twice as close to Earth?',
    options: [
      { text: 'Massive tides reshape every coastline — coastal cities never form', personality: 'divergent' },
      { text: 'Life adapts to whatever conditions exist — we\'d still be here', personality: 'preserver' },
      { text: 'Catastrophic tidal forces make civilization nearly impossible', personality: 'agent' },
      { text: 'Tidal energy is harnessed early, giving us clean power from day one', personality: 'visionary' },
    ],
  },
  {
    id: 16,
    question: 'What if Alexander the Great lived to old age?',
    options: [
      { text: 'A permanent Hellenistic superstate stretching from Greece to India', personality: 'divergent' },
      { text: 'His empire fragments anyway — too large for one person to hold', personality: 'preserver' },
      { text: 'Decades more conquest push into China and North Africa', personality: 'agent' },
      { text: 'Greek philosophy and science merge with Eastern knowledge centuries early', personality: 'visionary' },
    ],
  },
  {
    id: 17,
    question: 'What if electricity was discovered in ancient Rome?',
    options: [
      { text: 'Electrified colosseums and neon-lit forums', personality: 'divergent' },
      { text: 'Without supporting infrastructure, it remains a curiosity', personality: 'preserver' },
      { text: 'Weaponized immediately — electric tridents in gladiator fights', personality: 'agent' },
      { text: 'Roman engineering plus electricity equals an industrial revolution by 200 AD', personality: 'visionary' },
    ],
  },
  {
    id: 18,
    question: 'What if women had equal rights throughout all of history?',
    options: [
      { text: 'A completely unrecognizable but fascinating world', personality: 'divergent' },
      { text: 'Progress would be faster but the broad strokes stay similar', personality: 'preserver' },
      { text: 'Power struggles just shift — different factions, same conflicts', personality: 'agent' },
      { text: 'Double the geniuses contributing means exponentially faster progress', personality: 'visionary' },
    ],
  },
  {
    id: 19,
    question: 'What if the Cold War turned hot in 1962?',
    options: [
      { text: 'Surviving civilizations rebuild in the Southern Hemisphere', personality: 'divergent' },
      { text: 'Mutually assured destruction keeps it limited — cooler heads prevail', personality: 'preserver' },
      { text: 'Total nuclear apocalypse — back to the stone age', personality: 'agent' },
      { text: 'The horror of limited nuclear war leads to immediate global disarmament', personality: 'visionary' },
    ],
  },
  {
    id: 20,
    question: 'What if Tesla won the "War of Currents" and got proper funding?',
    options: [
      { text: 'Wireless power transmission towers dot every city by 1930', personality: 'divergent' },
      { text: 'AC won anyway — the outcome is basically what happened', personality: 'preserver' },
      { text: 'Energy monopoly battles between Tesla Corp and Edison Inc.', personality: 'agent' },
      { text: 'Free wireless energy for the world, ending poverty a century early', personality: 'visionary' },
    ],
  },
  {
    id: 21,
    question: 'What if the Mongol Empire invaded Western Europe?',
    options: [
      { text: 'A Silk Road superhighway from Beijing to London', personality: 'divergent' },
      { text: 'Europe\'s castles and terrain would have stopped them eventually', personality: 'preserver' },
      { text: 'Total devastation — medieval Europe is wiped clean', personality: 'agent' },
      { text: 'Forced cultural exchange jumpstarts the Renaissance 200 years early', personality: 'visionary' },
    ],
  },
  {
    id: 22,
    question: 'What if humans could photosynthesize like plants?',
    options: [
      { text: 'Fashion revolves around maximum skin exposure — culture is unrecognizable', personality: 'divergent' },
      { text: 'We\'d still eat food — photosynthesis alone can\'t power a brain', personality: 'preserver' },
      { text: 'Wars over sunlit territory replace wars over farmland', personality: 'agent' },
      { text: 'No agriculture needed — civilization develops completely differently and faster', personality: 'visionary' },
    ],
  },
  {
    id: 23,
    question: 'What if the Titanic never sank?',
    options: [
      { text: 'Ocean liners remain dominant — no push for commercial aviation', personality: 'divergent' },
      { text: 'Maritime safety improves more slowly, but another disaster prompts reforms', personality: 'preserver' },
      { text: 'Overconfidence in "unsinkable" ships leads to an even worse disaster later', personality: 'agent' },
      { text: 'Luxury ocean travel persists and evolves into floating cities', personality: 'visionary' },
    ],
  },
  {
    id: 24,
    question: 'What if the Sahara Desert was still green and fertile?',
    options: [
      { text: 'An entirely different set of civilizations spanning North Africa', personality: 'divergent' },
      { text: 'Mediterranean civilizations still dominate — geography is secondary', personality: 'preserver' },
      { text: 'Massive empires clash across a fertile Saharan supercontinent', personality: 'agent' },
      { text: 'Africa becomes the center of world civilization and technology', personality: 'visionary' },
    ],
  },
  {
    id: 25,
    question: 'What if we discovered alien radio signals in 1950?',
    options: [
      { text: 'Religion, politics, culture — everything transforms overnight', personality: 'divergent' },
      { text: 'Governments classify it and life continues mostly unchanged', personality: 'preserver' },
      { text: 'Global panic and an arms race to build weapons against aliens', personality: 'agent' },
      { text: 'Humanity unites behind a shared goal of making first contact', personality: 'visionary' },
    ],
  },
  {
    id: 26,
    question: 'What if the Spanish Armada defeated England in 1588?',
    options: [
      { text: 'Spanish becomes the global lingua franca instead of English', personality: 'divergent' },
      { text: 'England recovers within a generation — island nations are hard to hold', personality: 'preserver' },
      { text: 'Catholic Inquisition extends across Northern Europe', personality: 'agent' },
      { text: 'Spanish golden age funds massive scientific expeditions worldwide', personality: 'visionary' },
    ],
  },
  {
    id: 27,
    question: 'What if photography was invented in ancient times?',
    options: [
      { text: 'We\'d know what historical figures actually looked like — mind-blowing', personality: 'divergent' },
      { text: 'Without chemical industry support, it remains a palace novelty', personality: 'preserver' },
      { text: 'Propaganda becomes even more powerful — tyrants love photo ops', personality: 'agent' },
      { text: 'Visual documentation accelerates scientific method by millennia', personality: 'visionary' },
    ],
  },
  {
    id: 28,
    question: 'What if gravity was half as strong on Earth?',
    options: [
      { text: 'Everything is twice as tall — trees, buildings, people', personality: 'divergent' },
      { text: 'Life adapts to its environment — things would feel normal to us', personality: 'preserver' },
      { text: 'Atmosphere bleeds away, making Earth barely habitable', personality: 'agent' },
      { text: 'Easier spaceflight — we reach the Moon with Renaissance-era technology', personality: 'visionary' },
    ],
  },
  {
    id: 29,
    question: 'What if the Mayans had developed steel weapons?',
    options: [
      { text: 'A completely different power dynamic when Europeans arrive', personality: 'divergent' },
      { text: 'European diseases were the real weapon — steel wouldn\'t matter', personality: 'preserver' },
      { text: 'Inter-Mayan wars intensify dramatically', personality: 'agent' },
      { text: 'Metallurgy leads to industrial revolution in the Americas by 1200', personality: 'visionary' },
    ],
  },
  {
    id: 30,
    question: 'What if social media existed during the French Revolution?',
    options: [
      { text: 'Revolution memes and guillotine live streams — surreal chaos', personality: 'divergent' },
      { text: 'The revolution happens the same way, just more documented', personality: 'preserver' },
      { text: 'Misinformation makes the Reign of Terror ten times worse', personality: 'agent' },
      { text: 'Organized citizen movements create a stable democracy faster', personality: 'visionary' },
    ],
  },
  {
    id: 31,
    question: 'What if Antarctica was tropical and inhabited?',
    options: [
      { text: 'An entire lost continent of unique civilizations', personality: 'divergent' },
      { text: 'Just another land mass — same human patterns play out', personality: 'preserver' },
      { text: 'Colonial powers fight brutal wars over Antarctic resources', personality: 'agent' },
      { text: 'A seventh center of civilization adds incredible cultural diversity', personality: 'visionary' },
    ],
  },
  {
    id: 32,
    question: 'What if the Roman Empire adopted Christianity 300 years earlier?',
    options: [
      { text: 'A pacifist Rome that spreads through culture instead of conquest', personality: 'divergent' },
      { text: 'Religion gets co-opted by power either way — same result', personality: 'preserver' },
      { text: 'Religious schisms tear the empire apart much sooner', personality: 'agent' },
      { text: 'Christian values of education and charity create a more literate empire', personality: 'visionary' },
    ],
  },
  {
    id: 33,
    question: 'What if oil was never discovered as a fuel source?',
    options: [
      { text: 'Coal-and-steam-powered everything well into the 21st century', personality: 'divergent' },
      { text: 'We find it eventually — it was always there waiting', personality: 'preserver' },
      { text: 'Fights over coal deposits become the defining conflicts', personality: 'agent' },
      { text: 'Solar, wind, and hydro power develop a century earlier', personality: 'visionary' },
    ],
  },
  {
    id: 34,
    question: 'What if the Neanderthals survived alongside us?',
    options: [
      { text: 'Two intelligent species coexisting — philosophy is completely different', personality: 'divergent' },
      { text: 'We interbreed and merge — which is basically what happened', personality: 'preserver' },
      { text: 'Species-level conflict and competition for resources', personality: 'agent' },
      { text: 'Complementary strengths combine: Neanderthal resilience plus Sapiens creativity', personality: 'visionary' },
    ],
  },
  {
    id: 35,
    question: 'What if the airplane was invented in the 1700s?',
    options: [
      { text: 'Hot air balloon empires and aerial trade routes across continents', personality: 'divergent' },
      { text: 'Without engines, it stays a glider — limited practical use', personality: 'preserver' },
      { text: 'Aerial bombardment transforms 18th-century warfare horrifically', personality: 'agent' },
      { text: 'Global communication and trade accelerate — Industrial Revolution goes airborne', personality: 'visionary' },
    ],
  },
  {
    id: 36,
    question: 'What if Julius Caesar was never assassinated?',
    options: [
      { text: 'He conquers Persia and creates a Rome-to-India empire', personality: 'divergent' },
      { text: 'Another strongman takes over eventually — Roman politics was brutal', personality: 'preserver' },
      { text: 'He becomes increasingly tyrannical without any check on power', personality: 'agent' },
      { text: 'His planned reforms create a more stable, educated Roman populace', personality: 'visionary' },
    ],
  },
  {
    id: 37,
    question: 'What if Earth had two moons?',
    options: [
      { text: 'Completely different mythology, calendars, and navigation systems', personality: 'divergent' },
      { text: 'Humans adapt to their environment — we\'d consider it normal', personality: 'preserver' },
      { text: 'Extreme tidal chaos makes coastal living nearly impossible', personality: 'agent' },
      { text: 'Double tidal energy and a more interesting night sky inspiring more astronomers', personality: 'visionary' },
    ],
  },
  {
    id: 38,
    question: 'What if penicillin was discovered in 1800 instead of 1928?',
    options: [
      { text: 'The entire 19th century looks different — no more dying from scratches', personality: 'divergent' },
      { text: 'Without understanding bacteria, they wouldn\'t know what to do with it', personality: 'preserver' },
      { text: 'Antibiotic resistance develops a century earlier too', personality: 'agent' },
      { text: 'Population booms and longer lifespans accelerate every field of progress', personality: 'visionary' },
    ],
  },
  {
    id: 39,
    question: 'What if there was a land bridge between Africa and South America?',
    options: [
      { text: 'Transatlantic migration patterns create cultures we can\'t imagine', personality: 'divergent' },
      { text: 'Same human tendencies play out — just with more walking involved', personality: 'preserver' },
      { text: 'Empire-building across the bridge triggers endless territorial wars', personality: 'agent' },
      { text: 'Free exchange of crops, animals, and ideas makes both continents thrive', personality: 'visionary' },
    ],
  },
  {
    id: 40,
    question: 'What if the Byzantine Empire recaptured Rome?',
    options: [
      { text: 'Greek becomes the dominant European language', personality: 'divergent' },
      { text: 'Overextension leads to collapse — they couldn\'t hold both halves', personality: 'preserver' },
      { text: 'Religious wars between Eastern and Western Christianity intensify', personality: 'agent' },
      { text: 'A reunified Roman Empire preserves and advances classical knowledge', personality: 'visionary' },
    ],
  },
  {
    id: 41,
    question: 'What if humans evolved to live 300 years?',
    options: [
      { text: 'Completely different social structures — imagine 250-year-old politicians', personality: 'divergent' },
      { text: 'We\'d just be slower to change — same problems stretched out', personality: 'preserver' },
      { text: 'Power hoarding by long-lived elites creates permanent dynasties', personality: 'agent' },
      { text: 'Scientists with 200-year careers make breakthroughs we can\'t imagine', personality: 'visionary' },
    ],
  },
  {
    id: 42,
    question: 'What if the Inca Empire developed writing?',
    options: [
      { text: 'An entirely different literary and philosophical tradition emerges', personality: 'divergent' },
      { text: 'Quipu was already a recording system — writing wouldn\'t change much', personality: 'preserver' },
      { text: 'Written laws and propaganda strengthen the emperor\'s iron grip', personality: 'agent' },
      { text: 'Recorded knowledge compounds over generations, accelerating Inca science', personality: 'visionary' },
    ],
  },
  {
    id: 43,
    question: 'What if the Suez Canal was built 2,000 years ago?',
    options: [
      { text: 'The Mediterranean and Indian Ocean trade create a cosmopolitan ancient world', personality: 'divergent' },
      { text: 'Ancient pharaohs attempted it — the tech just wasn\'t there', personality: 'preserver' },
      { text: 'Whoever controls the canal becomes a target for every empire', personality: 'agent' },
      { text: 'Global trade 2,000 years early transforms human development', personality: 'visionary' },
    ],
  },
  {
    id: 44,
    question: 'What if we could see the entire electromagnetic spectrum?',
    options: [
      { text: 'Art, architecture, and fashion are unrecognizably different', personality: 'divergent' },
      { text: 'Our brains would filter most of it out — too much information', personality: 'preserver' },
      { text: 'Seeing radiation makes nuclear power terrifying — we never develop it', personality: 'agent' },
      { text: 'We discover radio waves, X-rays, and more by observation alone — science leaps forward', personality: 'visionary' },
    ],
  },
  {
    id: 45,
    question: 'What if the Silk Road had been a sea route from the start?',
    options: [
      { text: 'Naval civilizations dominate while landlocked cultures fade', personality: 'divergent' },
      { text: 'Trade finds a way regardless of the route — same goods, same ideas', personality: 'preserver' },
      { text: 'Piracy becomes the defining challenge of ancient civilization', personality: 'agent' },
      { text: 'Maritime technology develops millennia early — global exploration by 500 BC', personality: 'visionary' },
    ],
  },
  {
    id: 46,
    question: 'What if the South won the American Civil War?',
    options: [
      { text: 'Two American nations with completely divergent cultures and values', personality: 'divergent' },
      { text: 'Economic pressure ends slavery within decades anyway', personality: 'preserver' },
      { text: 'Ongoing border conflicts and a second, bloodier war within 50 years', personality: 'agent' },
      { text: 'International pressure and internal reform create a different path to equality', personality: 'visionary' },
    ],
  },
  {
    id: 47,
    question: 'What if Japan was never isolated during the Edo period?',
    options: [
      { text: 'A Japanese colonial empire rivaling the European powers by 1700', personality: 'divergent' },
      { text: 'Isolation preserved Japanese culture — without it, Japan is just another colony', personality: 'preserver' },
      { text: 'Japanese-European naval conflicts reshape the Pacific completely', personality: 'agent' },
      { text: 'Japanese innovation combined with global knowledge creates a tech hub 200 years early', personality: 'visionary' },
    ],
  },
  {
    id: 48,
    question: 'What if gold was as common as iron?',
    options: [
      { text: 'An entirely different basis for currency and status — maybe platinum or diamonds', personality: 'divergent' },
      { text: 'Humans find something rare to obsess over no matter what', personality: 'preserver' },
      { text: 'The gold rushes never happen — completely different colonization patterns', personality: 'agent' },
      { text: 'Gold\'s conductivity being cheap means electronics develop much earlier', personality: 'visionary' },
    ],
  },
  {
    id: 49,
    question: 'What if the wheel was never invented?',
    options: [
      { text: 'Civilizations built around waterways and sled-based transport', personality: 'divergent' },
      { text: 'Someone else invents it — the wheel is too obvious to miss', personality: 'preserver' },
      { text: 'Without efficient transport, empires can\'t expand and wars stay local', personality: 'agent' },
      { text: 'Necessity drives innovation — we develop levitation or rail systems instead', personality: 'visionary' },
    ],
  },
  {
    id: 50,
    question: 'What if there were no oceans, just one giant continent?',
    options: [
      { text: 'One mega-civilization develops with incredible internal diversity', personality: 'divergent' },
      { text: 'Humans are humans — we\'d still divide into nations and fight', personality: 'preserver' },
      { text: 'Constant border wars across an endless landmass with no natural barriers', personality: 'agent' },
      { text: 'Overland trade networks make ideas spread faster — faster global progress', personality: 'visionary' },
    ],
  },
  {
    id: 51,
    question: 'What if the compass was never invented?',
    options: [
      { text: 'Stellar navigation becomes an art form — astronomers rule the seas', personality: 'divergent' },
      { text: 'Coastal navigation still works — exploration just takes longer', personality: 'preserver' },
      { text: 'Without open-ocean travel, continents remain isolated and hostile to outsiders', personality: 'agent' },
      { text: 'We develop magnetic field sensing biologically, like migratory birds', personality: 'visionary' },
    ],
  },
  {
    id: 52,
    question: 'What if the Renaissance happened in China instead of Europe?',
    options: [
      { text: 'A Mandarin-speaking global culture with calligraphy-based art movements', personality: 'divergent' },
      { text: 'China already had golden ages — one more doesn\'t change the big picture', personality: 'preserver' },
      { text: 'Imperial control stifles the free-thinking spirit that made the Renaissance special', personality: 'agent' },
      { text: 'Chinese naval power combined with Renaissance creativity means they colonize the world', personality: 'visionary' },
    ],
  },
  {
    id: 53,
    question: 'What if volcanic eruptions never happened on Earth?',
    options: [
      { text: 'No Hawaiian islands, no Iceland — the map looks completely different', personality: 'divergent' },
      { text: 'Climate is more stable but soil is less fertile — tradeoffs everywhere', personality: 'preserver' },
      { text: 'Without volcanic winter events, certain civilizations never collapse', personality: 'agent' },
      { text: 'Geothermal energy is replaced by earlier solar innovation', personality: 'visionary' },
    ],
  },
  {
    id: 54,
    question: 'What if music was never developed as an art form?',
    options: [
      { text: 'Rhythm and dance still exist but sound art evolves differently', personality: 'divergent' },
      { text: 'Humans are musical by nature — it\'s impossible to suppress', personality: 'preserver' },
      { text: 'Without music, military marches and morale suffer — wars end faster', personality: 'agent' },
      { text: 'All creative energy goes into visual art and architecture instead', personality: 'visionary' },
    ],
  },
  {
    id: 55,
    question: 'If you could add one amendment to any ancient constitution, what would it be?',
    options: [
      { text: 'Freedom of scientific inquiry — let curiosity run wild', personality: 'divergent' },
      { text: 'Protection of existing traditions and cultural heritage', personality: 'preserver' },
      { text: 'Term limits for everyone — no one holds power for more than 5 years', personality: 'agent' },
      { text: 'Universal education — every citizen must be taught to read and reason', personality: 'visionary' },
    ],
  },
];
