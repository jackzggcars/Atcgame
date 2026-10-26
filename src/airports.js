'use strict';
/* =====================================================================
   AIRPORT DATABASE — real airports (runway length / heading / designators, elevation,
   magnetic variation, airline mix, destinations from real coordinates, frequencies,
   surroundings) plus the fictional home field.  Terminal and taxiway layouts are simplified
   onto one active runway; frequencies and SID names are representative, not for navigation.
   ===================================================================== */
const NEWTYPES={
 A321:{n:'A321',wing:35.8,len:44.5,wake:'M',vref:137,vr:142,acc:1.9,eng:2,rf:2.1,wide:false},
 E175:{n:'E175',wing:26.0,len:31.7,wake:'M',vref:122,vr:128,acc:2.4,eng:2,rf:1.65,wide:false,rear:true},
 B789:{n:'B789',wing:60.1,len:62.8,wake:'H',vref:146,vr:152,acc:1.7,eng:2,rf:3.0,wide:true},
 A333:{n:'A333',wing:60.3,len:63.7,wake:'H',vref:140,vr:148,acc:1.65,eng:2,rf:2.95,wide:true},
 A388:{n:'A388',wing:79.8,len:72.7,wake:'H',vref:145,vr:155,acc:1.45,eng:4,rf:3.55,wide:true}
};
Object.assign(TYPES,NEWTYPES);
/* airline: icao, rt (telephony), nm (fuselage text), init (fin mark), tail/acc colours, body colour, fleet, voice/accent */
const AL2=[
 {icao:'QTR',rt:'Qatari',nm:'QATAR AIRWAYS',init:'Q',tail:0x5c0632,acc:0x5c0632,voice:'Alnilam',accent:'Gulf Arabic',fleet:['A359','B789','B77W','A333','A320']},
 {icao:'ETD',rt:'Etihad',nm:'ETIHAD',init:'EY',tail:0x8b6b2e,acc:0xb89a4b,voice:'Gacrux',accent:'Gulf Arabic',fleet:['B789','A359','A333','A320']},
 {icao:'THY',rt:'Turkish',nm:'TURKISH AIRLINES',init:'T',tail:0xc8102e,acc:0xc8102e,voice:'Sulafat',accent:'Turkish',fleet:['A321','A333','B77W','B738']},
 {icao:'SWR',rt:'Swiss',nm:'SWISS',init:'+',tail:0xd8232a,acc:0xd8232a,voice:'Schedar',accent:'Swiss German',fleet:['A320','A333','B77W','A321']},
 {icao:'IBE',rt:'Iberia',nm:'IBERIA',init:'I',tail:0xd7141a,acc:0xf5b800,voice:'Achird',accent:'Spanish',fleet:['A320','A321','A359']},
 {icao:'SIA',rt:'Singapore',nm:'SINGAPORE AIRLINES',init:'SQ',tail:0x1a2a5c,acc:0xf2a900,voice:'Zubenelgenubi',accent:'Singaporean',fleet:['A359','B789','B77W','A388','A333']},
 {icao:'SCO',rt:'Scooter',nm:'SCOOT',init:'TR',tail:0xffd800,acc:0xffd800,body:'#ffd800',tailInk:'#1b1b1b',voice:'Puck',accent:'Singaporean',fleet:['B789','A320']},
 {icao:'AAL',rt:'American',nm:'AMERICAN',init:'AA',tail:0xc9ced3,acc:0x1a4d9b,voice:'Orus',accent:'American',fleet:['A321','B738','B789','B77W','A333']},
 {icao:'DAL',rt:'Delta',nm:'DELTA',init:'D',tail:0xc01933,acc:0x003366,voice:'Fenrir',accent:'American',fleet:['A321','B738','A333','A359']},
 {icao:'UAL',rt:'United',nm:'UNITED',init:'U',tail:0x0a3d91,acc:0x0a3d91,voice:'Rasalgethi',accent:'American',fleet:['B738','A320','B789','B77W']},
 {icao:'SWA',rt:'Southwest',nm:'Southwest',init:'SW',tail:0x2a4cb0,acc:0xe8192c,voice:'Zephyr',accent:'American',fleet:['B738']},
 {icao:'JBU',rt:'JetBlue',nm:'jetBlue',init:'jB',tail:0x00205b,acc:0x0033a0,voice:'Kore',accent:'American',fleet:['A321','A320','E190']},
 {icao:'ASA',rt:'Alaska',nm:'Alaska',init:'A',tail:0x01426a,acc:0x01426a,voice:'Charon',accent:'American',fleet:['B738','E175']},
 {icao:'ACA',rt:'Air Canada',nm:'AIR CANADA',init:'AC',tail:0xd8262c,acc:0xd8262c,voice:'Iapetus',accent:'Canadian',fleet:['A320','A321','B789','B77W']},
 {icao:'FDB',rt:'Sky Dubai',nm:'flydubai',init:'fz',tail:0x1d3a6b,acc:0xe94e1b,voice:'Algenib',accent:'Gulf Arabic',fleet:['B738']},
 {icao:'JAL',rt:'Japan Air',nm:'JAPAN AIRLINES',init:'JAL',tail:0xc8102e,acc:0xc8102e,voice:'Vindemiatrix',accent:'Japanese',fleet:['B738','B789','B77W','A359']},
 {icao:'ANA',rt:'All Nippon',nm:'ANA',init:'ANA',tail:0x1f3d8a,acc:0x1f3d8a,voice:'Sadaltager',accent:'Japanese',fleet:['B738','B789','B77W','A321']},
 {icao:'QFA',rt:'Qantas',nm:'QANTAS',init:'Q',tail:0xe40000,acc:0xe40000,voice:'Enceladus',accent:'Australian',fleet:['B738','A333','B789','A388']},
 {icao:'JST',rt:'Jetstar',nm:'Jetstar',init:'J*',tail:0xff5a00,acc:0xff5a00,voice:'Laomedeia',accent:'Australian',fleet:['A320','B789']},
 {icao:'VOZ',rt:'Velocity',nm:'Virgin Australia',init:'V',tail:0xd20f2a,acc:0xd20f2a,voice:'Autonoe',accent:'Australian',fleet:['B738']},
 {icao:'ANZ',rt:'New Zealand',nm:'AIR NEW ZEALAND',init:'NZ',tail:0x14141a,acc:0x14141a,voice:'Umbriel',accent:'New Zealand',fleet:['A320','B789']},
 {icao:'TRA',rt:'Transavia',nm:'transavia',init:'t',tail:0x00a651,acc:0x00a651,voice:'Despina',accent:'Dutch',fleet:['B738']}
];
AIRLINES.push(...AL2);
/* fleets for the original nine */
const FLEET0={BAW:['A320','A321','A359','B789','B77W','A388'],DLH:['A320','A321','A359','A333'],AFR:['A320','A321','B77W','A359'],EZY:['A320','A321'],RYR:['B738'],KLM:['B738','E190','B789','B77W','A333'],VIR:['A333','A359','B789'],UAE:['B77W','A388','A359'],SAS:['A320','A359','E190']};
AIRLINES.forEach(a=>{if(!a.fleet)a.fleet=FLEET0[a.icao]||['A320'];});
const AL_BY=Object.fromEntries(AIRLINES.map(a=>[a.icao,a]));
const SPK={BAW:'Speedbird'};

const AIRPORTS={
 EGMW:{icao:'EGMW',name:'Marlow International',city:'Marlow',short:'Marlow',lat:51.60,lon:-1.10,elev:60,mv:0,
  rwy:{a:'09',b:'27',mag:90,len:3000,wid:45},fict:true,
  units:{DEL:['Marlow Delivery','121.700'],GND:['Marlow Ground','121.800'],TWR:['Marlow Tower','118.100'],DEP:['Marlow Departure','119.500'],ATIS:'128.350'},
  tx:{par:'Alpha',conn:['Bravo','Charlie','Delta','Echo'],fox:'Foxtrot',gol:'Golf'},term:'TERMINAL',stands:6,
  airlines:[['BAW',3],['DLH',2],['AFR',2],['EZY',3],['RYR',3],['KLM',2],['VIR',2],['UAE',2],['SAS',1]],
  dests:[['Frankfurt','EDDF',50.04,8.56],['Paris','LFPG',49.01,2.55],['Amsterdam','EHAM',52.31,4.76],['Dublin','EIDW',53.42,-6.27],['Madrid','LEMD',40.50,-3.57],['Copenhagen','EKCH',55.62,12.65],['Dubai','OMDB',25.25,55.36]],
  sids:[['Rosel Two Alpha',50],['Norta One Bravo',160],['Tilby Three Charlie',20],['Wesco Two Delta',250]],
  env:{ground:'green',relief:1,sea:null,skyline:null,trees:1},others:[],labels:[['TERMINAL',0,-425]]},
 EGLL:{icao:'EGLL',name:'London Heathrow',city:'London',short:'Heathrow',lat:51.4706,lon:-0.4619,elev:25,mv:0.5,
  rwy:{a:'09R',b:'27L',mag:91,len:3660,wid:50},
  units:{DEL:['Heathrow Delivery','121.980'],GND:['Heathrow Ground','121.900'],TWR:['Heathrow Tower','118.500'],DEP:['London Control','134.980'],ATIS:'128.075'},
  tx:{par:'Mike',conn:['Bravo','Echo','Juliet','Kilo'],fox:'November',gol:'Papa'},term:'TERMINALS 2 · 3 · 4 · 5',stands:6,
  airlines:[['BAW',34],['VIR',6],['DLH',4],['AFR',3],['KLM',3],['SAS',2],['UAE',4],['QTR',3],['ETD',2],['SIA',2],['AAL',4],['DAL',2],['UAL',3],['ACA',2],['THY',3],['SWR',3],['IBE',3]],
  dests:[['Frankfurt','EDDF',50.04,8.56],['Paris','LFPG',49.01,2.55],['Amsterdam','EHAM',52.31,4.76],['Dublin','EIDW',53.42,-6.27],['Madrid','LEMD',40.50,-3.57],['Zurich','LSZH',47.46,8.55],['Istanbul','LTFM',41.28,28.75],['New York','KJFK',40.64,-73.78],['Dubai','OMDB',25.25,55.36],['Doha','OTHH',25.27,51.61],['Singapore','WSSS',1.36,103.99],['Los Angeles','KLAX',33.94,-118.41],['Tokyo','RJTT',35.55,139.78],['Edinburgh','EGPH',55.95,-3.37]],
  sids:[['Brookmans Park Six Juliet',10],['Lambourne Three Juliet',60],['Detling Two Juliet',120],['Midhurst Six Juliet',190],['Compton Three Juliet',235],['Daventry Four Juliet',300],['Brookmans Park Six Juliet',340]],
  env:{ground:'green',relief:0.12,sea:null,skyline:{b:85,d:15500,n:34,hmin:60,hmax:300},trees:1.2},
  others:[{name:'09L / 27R',dz:-1415,dx:-120,len:3902,w:50}],labels:[['T3',-420,-470],['T2',90,-470],['T5',900,-470],['T4',-1100,-330]]},
 KJFK:{icao:'KJFK',name:'John F. Kennedy International',city:'New York',short:'Kennedy',lat:40.6398,lon:-73.7789,elev:4,mv:-13,
  rwy:{a:'13R',b:'31L',mag:134,len:4423,wid:61},
  units:{DEL:['Kennedy Clearance','135.050'],GND:['Kennedy Ground','121.900'],TWR:['Kennedy Tower','119.100'],DEP:['New York Departure','135.900'],ATIS:'128.725'},
  tx:{par:'Bravo',conn:['Alpha','Kilo','Zulu','Yankee'],fox:'Echo',gol:'Lima'},term:'TERMINALS 1 · 4 · 5 · 7 · 8',stands:6,
  airlines:[['JBU',22],['DAL',22],['AAL',12],['UAL',4],['BAW',4],['VIR',3],['AFR',3],['DLH',3],['KLM',3],['UAE',3],['QTR',3],['ACA',3],['SIA',2],['THY',3],['SWR',2],['IBE',2],['ASA',1]],
  dests:[['Los Angeles','KLAX',33.94,-118.41],['London','EGLL',51.47,-0.46],['Paris','LFPG',49.01,2.55],['Frankfurt','EDDF',50.04,8.56],['Amsterdam','EHAM',52.31,4.76],['Dubai','OMDB',25.25,55.36],['Doha','OTHH',25.27,51.61],['Toronto','CYYZ',43.68,-79.63],['Madrid','LEMD',40.50,-3.57],['Istanbul','LTFM',41.28,28.75],['Atlanta','KATL',33.64,-84.43],['Boston','KBOS',42.36,-71.01],['Miami','KMIA',25.79,-80.29]],
  sids:[['Deezz Five',60],['Greki Six',350],['Canarsie Two',200],['Merit Two',290],['Bayside Two',20]],
  env:{ground:'urban',relief:0.05,sea:{b:200,d:2300},skyline:{b:300,d:21000,n:44,hmin:80,hmax:440},trees:0.4},
  others:[{name:'13L / 31R',dz:-1100,dx:-300,len:3048,w:61},{name:'04L / 22R',dz:-900,dx:-1300,len:3460,w:61,rel:-90},{name:'04R / 22L',dz:-1500,dx:-1600,len:2560,w:61,rel:-90}],labels:[['T4',-480,-470],['T5 · T7',480,-470],['T8 · T1',1200,-470]]},
 KLAX:{icao:'KLAX',name:'Los Angeles International',city:'Los Angeles',short:'Los Angeles',lat:33.9425,lon:-118.4081,elev:38,mv:-11,
  rwy:{a:'07L',b:'25R',mag:70,len:3685,wid:61},
  units:{DEL:['Los Angeles Clearance','121.400'],GND:['Los Angeles Ground','121.750'],TWR:['Los Angeles Tower','120.950'],DEP:['SoCal Departure','124.300'],ATIS:'133.800'},
  tx:{par:'Delta',conn:['Bravo','Charlie','Echo','Foxtrot'],fox:'Golf',gol:'Hotel'},term:'TERMINALS 1 – 8 · TOM BRADLEY',stands:6,
  airlines:[['AAL',16],['UAL',14],['DAL',14],['SWA',12],['ASA',8],['JBU',4],['ACA',3],['BAW',3],['VIR',2],['DLH',2],['AFR',2],['KLM',2],['UAE',3],['QTR',2],['SIA',2],['JAL',2],['ANA',2],['QFA',2]],
  dests:[['San Francisco','KSFO',37.62,-122.38],['Las Vegas','KLAS',36.08,-115.15],['Phoenix','KPHX',33.43,-112.01],['Seattle','KSEA',47.45,-122.31],['Dallas','KDFW',32.90,-97.04],['New York','KJFK',40.64,-73.78],['Denver','KDEN',39.86,-104.67],['Atlanta','KATL',33.64,-84.43],['Chicago','KORD',41.98,-87.90],['Tokyo','RJTT',35.55,139.78],['London','EGLL',51.47,-0.46],['Sydney','YSSY',-33.95,151.18]],
  sids:[['Sadde Eight',300],['Seaview Five',330],['Loop Six',60],['Gaviota Seven',280],['Oshen Four',250],['Dotsy Three',100]],
  env:{ground:'urban',relief:0.35,sea:{b:250,d:2050},skyline:null,trees:0.5},
  others:[{name:'07R / 25L',dz:215,dx:-190,len:3382,w:61},{name:'06R / 24L',dz:-1450,dx:-300,len:3135,w:61},{name:'06L / 24R',dz:-1700,dx:-450,len:2720,w:61}],labels:[['TBIT',-200,-470],['T1 – T3',500,-470],['T4 – T8',-900,-470]]},
 OMDB:{icao:'OMDB',name:'Dubai International',city:'Dubai',short:'Dubai',lat:25.2528,lon:55.3644,elev:19,mv:2.5,
  rwy:{a:'12L',b:'30R',mag:120,len:4447,wid:60},
  units:{DEL:['Dubai Delivery','121.775'],GND:['Dubai Ground','121.650'],TWR:['Dubai Tower','118.750'],DEP:['Dubai Departure','125.650'],ATIS:'131.650'},
  tx:{par:'Alpha',conn:['Mike','Lima','Romeo','Quebec'],fox:'Echo',gol:'Hotel'},term:'TERMINALS 1 · 2 · 3',stands:6,
  airlines:[['UAE',52],['FDB',20],['BAW',3],['QTR',2],['ETD',2],['THY',3],['SIA',2],['DLH',2],['AFR',2],['KLM',2],['QFA',1],['VIR',1],['SWR',1],['JAL',1]],
  dests:[['London','EGLL',51.47,-0.46],['Singapore','WSSS',1.36,103.99],['Frankfurt','EDDF',50.04,8.56],['Paris','LFPG',49.01,2.55],['Mumbai','VABB',19.09,72.87],['Delhi','VIDP',28.56,77.10],['Istanbul','LTFM',41.28,28.75],['Riyadh','OERK',24.96,46.70],['Cairo','HECA',30.12,31.41],['Karachi','OPKC',24.91,67.16],['Doha','OTHH',25.27,51.61],['Sydney','YSSY',-33.95,151.18],['New York','KJFK',40.64,-73.78]],
  sids:[['Doxan Two Alpha',280],['Tolka Three Bravo',320],['Rasal One Charlie',0],['Lovan Two Delta',100],['Nokal Four Echo',160]],
  env:{ground:'desert',relief:0.04,sea:null,skyline:{b:235,d:13000,n:50,hmin:90,hmax:420,spire:828},trees:0.1},
  others:[{name:'12R / 30L',dz:385,dx:0,len:4000,w:60}],labels:[['T3',-300,-470],['T1',700,-470],['T2',1500,-470]]},
 WSSS:{icao:'WSSS',name:'Singapore Changi',city:'Singapore',short:'Changi',lat:1.3644,lon:103.9915,elev:7,mv:0,
  rwy:{a:'20R',b:'02L',mag:200,len:4000,wid:60},
  units:{DEL:['Changi Delivery','118.650'],GND:['Changi Ground','121.725'],TWR:['Changi Tower','118.600'],DEP:['Singapore Departure','120.300'],ATIS:'128.600'},
  tx:{par:'Alpha',conn:['Whiskey','Uniform','Tango','Sierra'],fox:'Echo',gol:'Foxtrot'},term:'TERMINALS 1 · 2 · 3 · JEWEL',stands:6,
  airlines:[['SIA',46],['SCO',12],['JST',3],['QFA',3],['BAW',2],['UAE',3],['QTR',2],['ETD',1],['THY',2],['KLM',2],['DLH',2],['AFR',1],['SWR',1],['JAL',2],['ANA',2],['ANZ',2],['VOZ',1]],
  dests:[['Kuala Lumpur','WMKK',2.74,101.70],['Jakarta','WIII',-6.13,106.66],['Bangkok','VTBS',13.69,100.75],['Hong Kong','VHHH',22.31,113.92],['Sydney','YSSY',-33.95,151.18],['Tokyo','RJTT',35.55,139.78],['Dubai','OMDB',25.25,55.36],['London','EGLL',51.47,-0.46],['Seoul','RKSI',37.46,126.44],['Manila','RPLL',14.51,121.02],['Melbourne','YMML',-37.67,144.84],['Frankfurt','EDDF',50.04,8.56]],
  sids:[['Sampang Three Alpha',20],['Kamal Two Bravo',90],['Sadas One Charlie',150],['Paka Four Delta',240],['Vjr Two Echo',320]],
  env:{ground:'tropical',relief:0.08,sea:{b:80,d:3200},skyline:null,trees:1.6},
  others:[{name:'02C / 20C',dz:-1380,dx:-100,len:4000,w:60},{name:'02R / 20L',dz:-2350,dx:300,len:2750,w:60}],labels:[['T1 · T2 · T3',0,-470],['JEWEL',-900,-470]]},
 EHAM:{icao:'EHAM',name:'Amsterdam Schiphol',city:'Amsterdam',short:'Schiphol',lat:52.3086,lon:4.7639,elev:-3,mv:2.5,
  rwy:{a:'06',b:'24',mag:60,len:3500,wid:45},
  units:{DEL:['Schiphol Delivery','121.800'],GND:['Schiphol Ground','121.700'],TWR:['Schiphol Tower','118.100'],DEP:['Schiphol Departure','119.050'],ATIS:'132.975'},
  tx:{par:'Alpha',conn:['Tango','Romeo','Yankee','Zulu'],fox:'Echo',gol:'Foxtrot'},term:'SCHIPHOL PLAZA · PIERS B – H',stands:6,
  airlines:[['KLM',54],['TRA',8],['EZY',5],['DLH',3],['BAW',3],['DAL',3],['UAE',2],['QTR',1],['THY',2],['SAS',2],['AFR',2],['SWR',1],['IBE',1],['ACA',1],['SIA',1],['ETD',1]],
  dests:[['London','EGLL',51.47,-0.46],['Paris','LFPG',49.01,2.55],['Frankfurt','EDDF',50.04,8.56],['Madrid','LEMD',40.50,-3.57],['Copenhagen','EKCH',55.62,12.65],['Dubai','OMDB',25.25,55.36],['New York','KJFK',40.64,-73.78],['Istanbul','LTFM',41.28,28.75],['Zurich','LSZH',47.46,8.55],['Singapore','WSSS',1.36,103.99],['Edinburgh','EGPH',55.95,-3.37],['Atlanta','KATL',33.64,-84.43]],
  sids:[['Arnem Two Alpha',100],['Sugol Three Bravo',20],['Nyker Two Charlie',320],['Redfa One Delta',250],['Lopik Two Echo',180]],
  env:{ground:'green',relief:0.02,sea:null,skyline:null,trees:0.9},
  others:[{name:'09 / 27',dz:-900,dx:-700,len:3453,w:45,rel:30},{name:'18C / 36C',dz:-1700,dx:200,len:3300,w:45,rel:-90},{name:'18R / 36L',dz:-3400,dx:-1500,len:3800,w:60,rel:-90}],labels:[['SCHIPHOL',-100,-470],['PIERS',900,-470]]},
 RJTT:{icao:'RJTT',name:'Tokyo Haneda',city:'Tokyo',short:'Haneda',lat:35.5533,lon:139.7811,elev:6,mv:-7.5,
  rwy:{a:'34L',b:'16R',mag:337,len:3000,wid:60},
  units:{DEL:['Haneda Delivery','121.800'],GND:['Haneda Ground','121.700'],TWR:['Haneda Tower','118.100'],DEP:['Tokyo Departure','124.700'],ATIS:'128.800'},
  tx:{par:'Alpha',conn:['Charlie','Echo','Golf','Juliet'],fox:'Kilo',gol:'Lima'},term:'TERMINALS 1 · 2 · 3',stands:6,
  airlines:[['JAL',34],['ANA',34],['JST',3],['SIA',2],['QFA',2],['BAW',2],['UAE',2],['AAL',2],['UAL',3],['DAL',2],['ACA',1],['QTR',1],['THY',1],['KLM',1],['AFR',1],['DLH',2],['ANZ',1],['SCO',1]],
  dests:[['Sapporo','RJCC',42.78,141.69],['Osaka','RJBB',34.43,135.24],['Fukuoka','RJFF',33.59,130.45],['Okinawa','ROAH',26.20,127.65],['Seoul','RKSS',37.56,126.79],['Hong Kong','VHHH',22.31,113.92],['Singapore','WSSS',1.36,103.99],['London','EGLL',51.47,-0.46],['Los Angeles','KLAX',33.94,-118.41],['Paris','LFPG',49.01,2.55],['Sydney','YSSY',-33.95,151.18],['New York','KJFK',40.64,-73.78]],
  sids:[['Kaname Three Alpha',20],['Tokyo Seven Bravo',90],['Uraga Two Charlie',200],['Aoba Four Delta',320],['Sakae Two Echo',250]],
  env:{ground:'urban',relief:0.15,sea:{b:120,d:1700},skyline:null,trees:0.4},
  others:[{name:'16L / 34R',dz:1100,dx:300,len:3360,w:60},{name:'04 / 22',dz:1900,dx:-500,len:2500,w:60,rel:-90},{name:'05 / 23',dz:-1300,dx:1600,len:2500,w:60,rel:-55}],labels:[['T1 · T2',300,-470],['T3',-900,-470]]},
 YSSY:{icao:'YSSY',name:'Sydney Kingsford Smith',city:'Sydney',short:'Sydney',lat:-33.9461,lon:151.1772,elev:6,mv:12.5,
  rwy:{a:'34L',b:'16R',mag:341,len:3962,wid:45},
  units:{DEL:['Sydney Delivery','127.250'],GND:['Sydney Ground','121.700'],TWR:['Sydney Tower','120.500'],DEP:['Sydney Departures','123.000'],ATIS:'118.800'},
  tx:{par:'Alpha',conn:['Bravo','Charlie','Delta','Echo'],fox:'Foxtrot',gol:'Golf'},term:'T1 INTERNATIONAL · T2 · T3',stands:6,
  airlines:[['QFA',40],['JST',22],['VOZ',14],['SIA',3],['UAE',3],['QTR',2],['ETD',2],['ANZ',4],['AAL',1],['UAL',1],['DAL',1],['JAL',1],['ANA',1],['SCO',1],['THY',1]],
  dests:[['Melbourne','YMML',-37.67,144.84],['Brisbane','YBBN',-27.38,153.12],['Perth','YPPH',-31.94,115.97],['Auckland','NZAA',-37.01,174.79],['Singapore','WSSS',1.36,103.99],['Tokyo','RJTT',35.55,139.78],['Dubai','OMDB',25.25,55.36],['Doha','OTHH',25.27,51.61],['Los Angeles','KLAX',33.94,-118.41],['Hong Kong','VHHH',22.31,113.92],['Adelaide','YPAD',-34.95,138.53],['Canberra','YSCB',-35.31,149.19]],
  sids:[['Richmond Eight',320],['Wollongong Three',200],['Bankstown Six',280],['Sydney Two',60],['Tasman Five',100]],
  env:{ground:'urban',relief:0.18,sea:{b:170,d:2300},skyline:null,trees:0.9},
  others:[{name:'16L / 34R',dz:800,dx:-600,len:2438,w:45},{name:'07 / 25',dz:-700,dx:1800,len:2529,w:45,rel:70}],labels:[['T1',-200,-470],['T2 · T3',800,-470]]}
};
const ALLOWED=Object.keys(AIRPORTS);
let _sel='EGMW';try{_sel=localStorage.getItem('marlow.airport')||'EGMW';}catch(e){}
if(!AIRPORTS[_sel])_sel='EGMW';
const AIRPORT=AIRPORTS[_sel];
function bearingTo(lat1,lon1,lat2,lon2){const r=Math.PI/180,p1=lat1*r,p2=lat2*r,dl=(lon2-lon1)*r;const y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return((Math.atan2(y,x)/r)+360)%360;}
function distNm(lat1,lon1,lat2,lon2){const r=Math.PI/180,dl=(lon2-lon1)*r,p1=lat1*r,p2=lat2*r;const a=Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;return 2*Math.asin(Math.sqrt(a))*3440.065;}
const HDG_A=((AIRPORT.rwy.mag+AIRPORT.mv)%360+360)%360;   // true heading of the +x (A-end) direction
const DESTS=AIRPORT.dests.map(([n,c,la,lo])=>{
 const br=bearingTo(AIRPORT.lat,AIRPORT.lon,la,lo);
 let best=AIRPORT.sids[0],bd=999;for(const s of AIRPORT.sids){const d=Math.abs(((br-s[1]+540)%360)-180);if(d<bd){bd=d;best=s;}}
 return{n,c,sid:best[0],th:br,nm:Math.round(distNm(AIRPORT.lat,AIRPORT.lon,la,lo))};
});
const UNITS={DEL:{n:AIRPORT.units.DEL[0],f:AIRPORT.units.DEL[1]},GND:{n:AIRPORT.units.GND[0],f:AIRPORT.units.GND[1]},TWR:{n:AIRPORT.units.TWR[0],f:AIRPORT.units.TWR[1]},DEP:{n:AIRPORT.units.DEP[0],f:AIRPORT.units.DEP[1]},OPS:{n:'Operations',f:AIRPORT.units.GND[1]}};
const RWL={'09':AIRPORT.rwy.a,'27':AIRPORT.rwy.b};            // internal end -> real designator
const rwLabel=r=>RWL[r]||r;
const rwSpoken=r=>{const l=RWL[r]||r;const m=/^(\d\d)([LRC])?$/.exec(l);if(!m)return l;return m[1]+(m[2]?' '+({L:'left',R:'right',C:'centre'}[m[2]]):'');};
const rwFromLabel=s=>{s=String(s||'').toLowerCase();for(const k of['09','27']){const l=RWL[k].toLowerCase();if(s===l||s===l.replace(/[lrc]$/,'')||s===l.replace(/[lrc]$/,'')+' '+({l:'left',r:'right',c:'centre'}[l.slice(-1)]||''))return k;}return null;};

/* ---- re-skin the static manual pages for the selected airport ---- */
(function(){
 const A=AIRPORT,U=A.units,T=A.tx;
 const f=(m,t)=>{const e=MAN_EXTRA.find(x=>x.title===t);return e;};
 const fr=MAN_EXTRA.find(x=>x.title==='Frequencies and airport');
 if(fr)fr.html='<table class="mt"><tr><td>'+U.DEL[0]+'</td><td>'+U.DEL[1]+'</td></tr><tr><td>'+U.GND[0]+'</td><td>'+U.GND[1]+'</td></tr><tr><td>'+U.TWR[0]+'</td><td>'+U.TWR[1]+'</td></tr><tr><td>'+U.DEP[0]+'</td><td>'+U.DEP[1]+'</td></tr><tr><td>ATIS</td><td>'+U.ATIS+'</td></tr></table><p><b>'+A.name+' ('+A.icao+')</b>, '+A.city+'. Elevation '+A.elev+' ft, magnetic variation '+(A.mv>=0?A.mv+'° E':(-A.mv)+'° W')+'. Active runway pair <b>'+A.rwy.a+' / '+A.rwy.b+'</b> ('+A.rwy.len+' m × '+A.rwy.wid+' m). Parallel taxiway <b>'+T.par+'</b>; runway connectors <b>'+T.conn.join(', ')+'</b>; apron connectors <b>'+T.fox+', '+T.gol+'</b>; six stands (1–6). '+(A.fict?'':'Frequencies are representative and the apron/taxiway layout is simplified onto this one runway; the real airport has more runways ('+A.others.map(o=>o.name).join(', ')+') and taxiways. Not for real navigation.')+'</p>';
 const lay=MAN_EXTRA.find(x=>x.title==='Airport layout and the words used');
 if(lay){
  const W=560,H=250,rx0=60,rx1=500;
  const sv='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Airport diagram" style="width:100%;max-width:640px;background:#0a1117;border:1px solid #223241;border-radius:3px" font-family="JetBrains Mono,monospace" font-size="10">'
   +'<rect x="150" y="30" width="260" height="22" fill="#2a3d4e"/><text x="280" y="45" text-anchor="middle" fill="#9fb2c1">'+A.term+'</text>'
   +'<rect x="180" y="60" width="200" height="46" fill="#16222d" stroke="#2c4054"/><text x="280" y="88" text-anchor="middle" fill="#dbe5ec">STANDS 1 – 6</text>'
   +'<line x1="'+rx0+'" y1="150" x2="'+rx1+'" y2="150" stroke="#5f7c93" stroke-width="3"/><text x="'+(rx0+60)+'" y="143" fill="#9fb2c1">'+T.par.toUpperCase()+'</text>'
   +'<rect x="'+rx0+'" y="190" width="'+(rx1-rx0)+'" height="14" fill="#2e3a45" stroke="#7c93a5"/>'
   +'<text x="'+(rx0-4)+'" y="201" text-anchor="end" fill="#e8f0f5">'+A.rwy.a+'</text><text x="'+(rx1+4)+'" y="201" fill="#e8f0f5">'+A.rwy.b+'</text>'
   +[0.13,0.265,0.735,0.87].map((p,i)=>{const x=rx0+(rx1-rx0)*p;return '<line x1="'+x+'" y1="150" x2="'+x+'" y2="190" stroke="#5f7c93" stroke-width="3"/><text x="'+x+'" y="222" text-anchor="middle" fill="#9fb2c1">'+T.conn[i].toUpperCase()+'</text>';}).join('')
   +'<line x1="230" y1="106" x2="230" y2="150" stroke="#5f7c93" stroke-width="3"/><text x="226" y="128" text-anchor="end" fill="#9fb2c1">'+T.fox.toUpperCase()+'</text>'
   +'<line x1="330" y1="106" x2="330" y2="150" stroke="#5f7c93" stroke-width="3"/><text x="336" y="128" fill="#9fb2c1">'+T.gol.toUpperCase()+'</text></svg>';
  const i=lay.html.indexOf('</svg>');
  lay.html='<p>'+sv+lay.html.slice(i);
  lay.html=lay.html.replace(/Marlow Delivery/g,U.DEL[0]).replace(/121\.700/g,U.DEL[1]).replace(/Marlow Ground/g,U.GND[0]).replace(/121\.800/g,U.GND[1]).replace(/Marlow Tower/g,U.TWR[0]).replace(/118\.100/g,U.TWR[1])
   .replace('(Bravo, Charlie, Delta or Echo)','('+T.conn.slice(0,-1).join(', ')+' or '+T.conn[3]+')').replace('via Golf, Alpha','via '+T.gol+', '+T.par);
 }
 MAN_EXTRA.forEach(e=>{if(e.html)e.html=e.html.replace(/Marlow (Delivery|Ground|Tower|Departure)/g,(m,k)=>U[{Delivery:'DEL',Ground:'GND',Tower:'TWR',Departure:'DEP'}[k]][0]);});
 const ph=MAN_EXTRA.find(x=>x.title.indexOf('Placeholders')===0);
 if(ph)ph.html=ph.html.replace('(09 or 27)','('+A.rwy.a+' or '+A.rwy.b+')').replace('Bravo, Charlie, Delta or Echo:',T.conn.slice(0,3).join(', ')+' or '+T.conn[3]+':').replace('&ldquo;Foxtrot, Alpha&rdquo;','&ldquo;'+T.fox+', '+T.par+'&rdquo;').replace('Departure 119.500, Tower 118.100, Ground 121.800, Delivery 121.700','Departure '+U.DEP[1]+', Tower '+U.TWR[1]+', Ground '+U.GND[1]+', Delivery '+U.DEL[1]);
})();
