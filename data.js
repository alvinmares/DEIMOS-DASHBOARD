// ══════════════════════════════════════════════════════
// DEIMOS DASHBOARD — CAPA DE DATOS
// Único archivo que se edita en cada actualización.
// Corte de datos: 22 ago 2026  ·  Publicado: 25 ago 2026
// Fuentes: tickets = Google Form lifecycle · envíos/DR = etl.mx__contract.frodo__deliveries
//
// ⚠️ Interrupción operativa 10–14 ago (NO es problema de datos).
//    El 10 y el 14 ago no se entregó ni una tarjeta al carrier, y el 13 salió
//    a ~26% de lo normal. Confirmado con tres fuentes independientes:
//      frodo delivery__created_at             0 / 3,745 / 0
//      logistics_information ready_to_carrier 262 / 4,739 / 1
//      balrog__response_files                 92 archivos el 10 y el 14
//                                             (perfil de domingo) vs ~190–254
//    La creación de paquetes siguió normal (~19.9k el 10, ~18.6k el 14): las
//    tarjetas sí se produjeron; lo que se detuvo fue el paso al carrier. Se
//    recuperó el 11, 12 y 15, que salen inflados por el catch-up.
//    Efecto en la métrica: la semana 08-10 trae envíos ~16% abajo y tickets
//    arriba, así que su TR/1k salta. Es real, no un artefacto del corte.
// ══════════════════════════════════════════════════════

// corte      = último día con datos de envíos (y de tickets: van alineados)
// actualizado= cuándo corrió la actualización (ISO con offset CDMX)
// ok         = la corrida terminó sin fallas de fuente ni de cálculo
// mensaje    = una línea de resumen para el pie del sidebar
// notas      = caveats del ciclo; salen en el tooltip del pie
const DATA_META = {
  corte: '2026-08-22',
  publicado: '2026-08-25',
  etiqueta: '22 ago 2026',
  actualizado: '2026-08-25T11:54:00-06:00',
  ok: true,
  mensaje: 'Corte al 22 ago · semana 08-17 cerrada · TR/1k de vuelta a niveles normales',
  notas: [
    'Semana 08-17 cierra en 3.28 / 5.69 / 8.49 (DHL / Estafeta / 99min): normalización tras el pico de la semana 08-10 (6.21 / 6.41 / 9.79). DHL cae 47%, justo debajo del umbral de alerta.',
    'Interrupción operativa 10–14 ago ya absorbida; sigue explicando el pico de la semana 08-10, no el corte actual.',
    'DR de agosto en null: cohorte inmadura (va en 76.77 / 82.88 / 78.84).',
    'DR de julio maduró a 84.58 / 91.65 / 91.63; se había publicado 84.56 / 91.63 / 91.38. Sigue subiendo, como esperado.',
    'DR de mayo bajó un pelo (DHL 85.02→84.89, Estafeta 91.97→91.87) con envíos idénticos: reclasificación de status en Frodo, no volumen. DHL sigue en su banda normal de 84–87%.',
    'Envíos y tickets históricos ene–jul verificados contra lo publicado: cero drift.',
    'Tickets cortados al 22 ago para alinear con envíos; los 52 del 23–25 ago entran el próximo ciclo.',
    'Pestaña de quejas reconstruida: taxonomía vigente del form (5 motivos) con desglose mensual y filtro de periodo. Los totales cuadran con RAW.tix. Cierra los pendientes de la §8 de la guía.',
    'Vista diaria: ene–abr viene de cargas por lote (17 días hábiles en 0 y picos de hasta 13x); la granularidad diaria solo es confiable de mayo en adelante.',
  ],
};

// Mes con * = parcial (aún no cierra)
const ALL_MONTHS = ['Ene 26','Feb 26','Mar 26','Abr 26','May 26','Jun 26','Jul 26','Ago 26*'];

// cr = tix/env*1000 · tix = tickets del form · env = envíos de Frodo
const RAW = {
  'DHL':     { cr:[3.68,3.28,1.75,3.49,4.99,3.39,2.12,4.39], tix:[135,68,68,108,134,96,60,84], env:[36670,20738,38867,30925,26847,28307,28334,19129] },
  'Estafeta':{ cr:[3.81,5.43,2.8,5.74,5.8,4.58,3.27,5.19], tix:[1363,1005,1097,1669,1464,1144,843,924], env:[357730,185203,392259,290616,252491,250049,257597,177880] },
  '99min':   { cr:[8.29,11.54,6.02,10.67,9.92,6.44,3.59,7.89], tix:[1533,1114,1200,1617,1277,828,479,711], env:[185030,96497,199476,151573,128726,128506,133309,90111] },
};

// Delivery Rate % · null = mes aún inmaduro (los envíos recientes no han terminado su ciclo)
const DR_DATA = {
  'DHL':     [83.97,87.68,84.09,86.91,84.89,86,84.58,null],
  'Estafeta':[90.73,91.58,90.17,91.45,91.87,92.22,91.65,null],
  '99min':   [93.46,94.37,92.05,91.9,92.5,91.65,91.63,null],
};

// Semanas lunes–domingo (ISO)
const SEM_WEEKS = ['01-05','01-12','01-19','01-26','02-02','02-09','02-16','02-23','03-02','03-09','03-16','03-23','03-30','04-06','04-13','04-20','04-27','05-04','05-11','05-18','05-25','06-01','06-08','06-15','06-22','06-29','07-06','07-13','07-20','07-27','08-03','08-10','08-17'];
const SEM_LABELS = ['05 ene','12 ene','19 ene','26 ene','02 feb','09 feb','16 feb','23 feb','02 mar','09 mar','16 mar','23 mar','30 mar','06 abr','13 abr','20 abr','27 abr','04 may','11 may','18 may','25 may','01 jun','08 jun','15 jun','22 jun','29 jun','06 jul','13 jul','20 jul','27 jul','03 ago','10 ago','17 ago'];

const SEM_DATA = {
  'DHL':     {
    env:[5560,4389,18217,6934,5629,2181,8551,4377,6075,2439,14299,12904,4614,9213,7151,7649,7138,6073,5326,7221,6537,6401,5979,7071,6955,6124,6464,6092,5709,6659,6150,5154,7012],
    tix:[24,38,32,35,18,18,7,24,16,14,10,20,13,20,31,28,28,25,37,44,21,34,21,12,24,13,16,11,11,16,27,32,23],
    tr: [4.32,8.66,1.76,5.05,3.2,8.25,0.82,5.48,2.63,5.74,0.7,1.55,2.82,2.17,4.34,3.66,3.92,4.12,6.95,6.09,3.21,5.31,3.51,1.7,3.45,2.12,2.48,1.81,1.93,2.4,4.39,6.21,3.28],
  },
  'Estafeta':{
    env:[59317,43608,169003,68245,45841,22457,85895,31010,87220,19633,126632,125496,46020,91000,66795,66889,70227,58487,49677,68302,58988,55069,53356,59881,61334,59657,53893,57799,52074,62315,57720,47881,64547],
    tix:[234,327,324,382,245,233,221,287,238,222,182,337,505,377,361,336,269,333,361,350,340,294,355,230,204,181,203,179,189,181,221,307,367],
    tr: [3.94,7.5,1.92,5.6,5.34,10.38,2.57,9.26,2.73,11.31,1.44,2.69,10.97,4.14,5.4,5.02,3.83,5.69,7.27,5.12,5.76,5.34,6.65,3.84,3.33,3.03,3.77,3.1,3.63,2.9,3.83,6.41,5.69],
  },
  '99min':   {
    env:[25960,24635,91945,35846,25438,11361,40739,18959,39523,13202,65561,64657,23408,46522,34592,36819,35511,30336,25179,34682,29783,29067,27292,31395,31606,27554,31072,29499,26854,31183,28434,24516,33454],
    tix:[254,381,385,448,309,273,252,267,276,242,139,371,376,325,425,425,291,317,354,319,207,243,222,174,160,98,105,100,105,131,156,240,284],
    tr: [9.78,15.47,4.19,12.5,12.15,24.03,6.19,14.08,6.98,18.33,2.12,5.74,16.06,6.99,12.29,11.54,8.19,10.45,14.06,9.2,6.95,8.36,8.13,5.54,5.06,3.56,3.38,3.39,3.91,4.2,5.49,9.79,8.49],
  },
};

// ── Vista diaria ───────────────────────────────────────────────────────
// Serie diaria del 1-ene al corte. env = Frodo (un día sin filas es un 0
// real, no un dato faltante); tix = form lifecycle. El TR/1k diario NO se
// guarda: se calcula al render y queda null los días con env = 0, para no
// dividir entre cero.
//
// ⚠️ Ene–Abr no tiene granularidad diaria confiable. En ese tramo
// delivery__created_at se asignaba en cargas por lote: 17 días hábiles en 0
// y 5 picos de 4x a 13x la mediana del mes, cuatro de ellos en jueves
// (22-ene 173k, 19-feb 121k, 05-mar 85k, 19-mar 206k). De mayo en adelante
// el patrón es limpio: mayo y julio no tienen un solo día hábil en 0.
// DIA_LOTE marca dónde empieza lo confiable; el dash sombrea lo anterior.
const DIA_LOTE = '05-01';

const DIA_DAYS = [
  '01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08','01-09','01-10','01-11','01-12',
  '01-13','01-14','01-15','01-16','01-17','01-18','01-19','01-20','01-21','01-22','01-23','01-24',
  '01-25','01-26','01-27','01-28','01-29','01-30','01-31','02-01','02-02','02-03','02-04','02-05',
  '02-06','02-07','02-08','02-09','02-10','02-11','02-12','02-13','02-14','02-15','02-16','02-17',
  '02-18','02-19','02-20','02-21','02-22','02-23','02-24','02-25','02-26','02-27','02-28','03-01',
  '03-02','03-03','03-04','03-05','03-06','03-07','03-08','03-09','03-10','03-11','03-12','03-13',
  '03-14','03-15','03-16','03-17','03-18','03-19','03-20','03-21','03-22','03-23','03-24','03-25',
  '03-26','03-27','03-28','03-29','03-30','03-31','04-01','04-02','04-03','04-04','04-05','04-06',
  '04-07','04-08','04-09','04-10','04-11','04-12','04-13','04-14','04-15','04-16','04-17','04-18',
  '04-19','04-20','04-21','04-22','04-23','04-24','04-25','04-26','04-27','04-28','04-29','04-30',
  '05-01','05-02','05-03','05-04','05-05','05-06','05-07','05-08','05-09','05-10','05-11','05-12',
  '05-13','05-14','05-15','05-16','05-17','05-18','05-19','05-20','05-21','05-22','05-23','05-24',
  '05-25','05-26','05-27','05-28','05-29','05-30','05-31','06-01','06-02','06-03','06-04','06-05',
  '06-06','06-07','06-08','06-09','06-10','06-11','06-12','06-13','06-14','06-15','06-16','06-17',
  '06-18','06-19','06-20','06-21','06-22','06-23','06-24','06-25','06-26','06-27','06-28','06-29',
  '06-30','07-01','07-02','07-03','07-04','07-05','07-06','07-07','07-08','07-09','07-10','07-11',
  '07-12','07-13','07-14','07-15','07-16','07-17','07-18','07-19','07-20','07-21','07-22','07-23',
  '07-24','07-25','07-26','07-27','07-28','07-29','07-30','07-31','08-01','08-02','08-03','08-04',
  '08-05','08-06','08-07','08-08','08-09','08-10','08-11','08-12','08-13','08-14','08-15','08-16',
  '08-17','08-18','08-19','08-20','08-21','08-22'
];

const DIA_DATA = {
  'DHL': {
    env: [
      0,805,765,0,1015,786,200,1277,1017,1265,0,1541,626,865,241,469,647,0,913,930,992,10798,2137,834,
      1613,384,1991,1187,1688,953,731,0,0,1437,1368,616,1160,1048,0,0,0,0,2181,0,0,0,0,0,0,7765,786,0,0,
      818,839,700,1188,460,372,0,706,563,879,3254,115,558,0,1462,903,74,0,0,0,0,0,0,110,14189,0,0,0,6947,
      969,1441,1115,722,1710,0,1439,1711,1464,0,0,0,0,3389,237,1625,0,3082,880,0,1157,1156,1894,1134,929,
      881,0,1235,1096,1955,1295,1255,813,0,1201,1459,762,2026,796,894,0,531,1171,1427,1057,831,1056,0,705,
      1052,1210,940,1419,0,0,1525,1227,1426,928,1073,1042,0,825,854,999,1768,1103,988,0,693,1306,1652,949,
      1088,713,0,778,1495,1099,1127,781,699,0,1237,892,1557,0,2543,842,0,1360,878,1621,1401,902,793,0,878,
      1023,1009,1153,1108,953,0,1258,1189,1186,878,1080,873,0,1063,609,965,801,1263,1391,0,1182,902,980,
      713,1082,850,0,150,1676,1514,1320,1186,813,0,1379,1256,1177,1021,691,626,0,0,1983,1619,250,0,1302,0,
      1978,1148,1248,818,1046,774
    ],
    tix: [
      3,2,1,4,4,4,3,6,2,1,4,5,6,6,5,6,1,9,5,8,4,3,7,0,5,10,5,3,4,7,2,4,8,1,4,2,0,1,2,4,1,2,4,2,4,1,0,1,0,
      2,3,1,0,3,6,5,6,0,1,3,2,4,2,2,2,1,3,1,4,1,4,3,1,0,0,0,0,1,3,6,0,3,4,4,2,4,2,1,1,4,5,0,1,1,1,2,5,2,0,
      2,7,2,2,6,5,7,7,3,1,4,5,5,2,5,4,3,3,7,6,5,4,1,2,2,5,5,7,2,3,1,3,5,5,4,10,8,2,4,5,7,9,9,5,5,4,1,4,2,
      3,5,2,6,3,3,8,6,4,4,4,4,4,4,2,1,2,4,0,3,1,4,0,0,2,7,3,3,3,3,3,3,2,5,0,3,0,0,3,0,2,4,2,2,3,1,2,2,4,1,
      1,0,1,1,3,0,1,2,3,0,3,6,1,4,0,2,3,4,5,4,6,5,0,5,1,4,9,7,3,3,
      3,0,5,9,4,2
    ],
  },
  'Estafeta': {
    env: [
      0,8668,8889,0,9015,9933,9633,8485,8068,14183,0,14105,6098,8099,4676,4498,6132,0,7861,9418,11410,
      105425,16141,9138,9610,2759,17809,14200,15318,11195,6964,0,0,7976,13651,7803,10983,5428,0,0,0,0,
      22457,0,0,0,0,0,0,76807,9088,0,0,7319,4973,3784,4938,5402,4594,0,8151,5547,7278,58569,1331,6344,0,
      7365,9865,2403,0,0,0,0,0,0,0,126632,0,0,0,72566,10305,7818,8991,8671,17145,0,12986,20292,12742,0,0,
      0,0,30372,2434,19463,0,28458,10273,0,11823,13025,12797,9550,10072,9528,0,12766,11875,11899,11096,
      11986,7267,0,10131,15688,8876,18495,8918,8119,0,6972,8829,14078,11378,6390,10840,0,8054,10678,13226,
      9401,8318,0,0,14779,11145,15760,9478,7112,10028,0,7716,8522,9695,12952,10793,9310,0,5822,13899,
      11309,9065,9356,5618,0,7191,13800,10173,8989,6969,6234,0,8669,8927,13515,0,21101,7669,0,12486,8078,
      14789,10546,8005,7430,0,8611,11798,8868,11418,9848,9114,0,8062,10059,8950,9048,9647,8127,0,9503,
      6537,10679,8328,9226,13526,0,11050,7392,9644,6695,9431,7862,0,1766,15009,13413,14005,10390,7732,0,
      11932,12148,10897,9063,6587,7093,0,0,15113,16435,2299,0,14034,0,
      15949,11617,11975,8176,8630,8200
    ],
    tix: [
      18,55,32,29,32,38,42,38,30,33,21,63,58,61,39,45,36,25,42,39,35,44,71,54,39,76,56,63,48,53,48,38,51,
      53,60,13,0,37,31,53,34,37,35,20,34,20,30,24,22,36,46,36,27,57,42,52,51,33,33,19,27,33,32,35,51,40,
      20,44,33,29,35,40,25,16,12,23,28,18,42,34,25,76,62,54,48,35,39,23,51,48,102,89,97,60,58,83,66,49,55,
      58,36,30,64,51,59,51,64,37,35,48,72,44,49,51,44,28,52,48,46,43,32,24,24,51,54,49,52,50,36,41,73,46,
      58,59,42,48,35,49,66,59,45,65,37,29,62,71,49,57,41,36,24,39,33,40,49,53,39,41,70,62,49,51,49,44,30,
      44,53,43,23,28,21,18,31,43,41,33,28,17,11,28,33,28,25,33,19,15,44,41,40,25,32,8,13,36,27,26,27,30,
      19,14,37,43,35,27,21,13,13,35,21,45,31,20,15,14,31,24,21,26,39,41,39,41,48,52,62,59,22,23,
      42,65,70,86,61,43
    ],
  },
  '99min': {
    env: [
      0,3174,3470,0,3721,4452,2901,4942,4462,5482,0,5045,4860,5154,4758,2283,2535,0,4980,5147,4917,57262,
      9226,4192,6221,3086,8582,6606,8153,5649,3770,0,0,6067,7439,3028,6518,2386,0,0,0,0,11361,0,0,0,0,0,0,
      35992,4747,0,0,3179,4114,1235,4652,3915,1864,0,4003,4514,3093,23616,1465,2832,0,7332,4044,1826,0,0,
      0,0,0,0,640,64921,0,0,0,34637,4560,7488,6062,3501,8409,0,6804,9729,6875,0,0,0,0,16512,1309,8452,0,
      15808,4441,0,5456,5842,9459,5186,4475,4174,0,5809,5164,9553,6318,5918,4057,0,5908,7074,3781,10002,
      4142,4604,0,2806,5743,6909,5085,4290,5503,0,3564,5027,5628,4232,6728,0,0,7115,5937,7380,4406,5097,
      4747,0,3829,4443,4717,7754,4801,4239,0,2796,6283,7757,4148,4738,3345,0,3710,7292,4657,5029,3084,
      3520,0,5599,4582,6746,0,10554,3914,0,6755,3928,7390,6121,3696,3716,0,4146,5000,4534,5139,4588,4147,
      0,6075,5460,6087,3961,5443,4046,0,5218,3069,4508,4287,5970,6447,0,5473,4206,4645,3484,5053,3993,0,
      724,7848,7231,6449,5224,3707,0,6405,6007,5648,4520,2868,2986,0,0,9401,7639,1196,0,6280,0,
      9254,5669,6003,3847,4879,3802
    ],
    tix: [
      19,26,35,25,33,40,28,42,39,42,30,60,68,73,54,39,48,39,63,69,49,40,57,72,35,78,70,62,70,66,62,40,64,
      79,60,15,0,43,48,65,53,37,24,42,25,27,22,22,16,42,53,59,38,57,49,35,27,36,36,27,31,53,48,50,36,32,
      26,44,52,26,47,36,13,24,13,18,12,11,42,26,17,50,68,64,77,25,48,39,76,69,75,41,49,37,29,47,33,41,51,
      53,59,41,96,62,54,70,47,49,47,62,84,77,74,52,42,34,79,58,37,37,18,35,27,53,59,44,34,53,48,26,55,61,
      60,66,44,33,35,45,66,64,42,35,40,27,38,38,27,33,25,32,14,35,30,43,53,32,29,21,40,37,40,39,17,21,28,
      32,30,32,15,24,18,23,25,40,20,26,13,18,18,15,14,15,19,10,12,13,17,15,15,22,12,12,12,23,20,17,12,8,9,
      11,17,16,20,18,15,10,9,26,16,21,12,25,14,17,21,33,14,12,24,28,24,30,36,38,41,44,27,24,
      26,52,53,56,52,45
    ],
  },
};

// ── Motivos de queja ──────────────────────────────────────────────────
// Taxonomía vigente del formulario (col. I, "¿Cómo te ayudamos?"), con las
// dos variantes de "Cambio de carrier" fundidas en una: el form traía el
// texto mal escrito ("Solosi") hasta el 8 ago 2026.
//
// A diferencia del QUEJAS_DATA anterior —totales fijos, con una taxonomía
// que ya no existía en el form— esto es un desglose mensual alineado a
// ALL_MONTHS, así que la pestaña se puede filtrar por periodo y los números
// se reproducen con una query. Los totales por mes cuadran exactamente con
// RAW[carrier].tix, que es la autovalidación al cargar.
//
// Query (Google Visualization API sobre el Sheet del form, ver guía §4):
//   select month(A), day(A), H, I, count(A)
//   where A >= date '2026-01-01' and (H='DHL' or H='Estafeta' or H='99 Minutos')
//   group by month(A), day(A), H, I
// Se corta en DATA_META.corte para alinear con los envíos.
const QUEJAS_CATS = [
  { key:'falsa',      label:'Falsa entrega',               color:'#F06292' },
  { key:'cruzada',    label:'Entregas cruzadas',           color:'#F4A020' },
  { key:'mensajeria', label:'Problemas con la mensajería', color:'#7B52B8' },
  { key:'cambio',     label:'Cambio de carrier',           color:'#90A4AE' },
  { key:'internos',   label:'Problemas internos',          color:'#26C6A0' },
];

const QUEJAS_MES = {
  'DHL':       { falsa:[96,56,55,94,114,82,50,73], cruzada:[0,1,0,3,0,1,1,2], mensajeria:[37,8,11,6,9,10,7,9], cambio:[0,0,0,5,11,3,2,0], internos:[2,3,2,0,0,0,0,0] },
  'Estafeta':  { falsa:[1063,787,873,1184,1208,975,632,786], cruzada:[192,150,171,402,117,114,134,98], mensajeria:[87,54,38,70,53,33,65,28], cambio:[0,0,1,5,75,19,7,12], internos:[21,14,14,8,11,3,5,0] },
  '99min':     { falsa:[1398,1029,1112,1542,1052,751,407,674], cruzada:[60,26,18,18,24,7,23,9], mensajeria:[64,46,61,48,130,55,43,25], cambio:[0,0,0,5,68,10,3,3], internos:[11,13,9,4,3,5,3,0] },
};

// Compatibilidad: la forma vieja {labels,data,colors} derivada del acumulado
// del año. Nada nuevo la usa —el filtro lee QUEJAS_MES— pero evita que una
// llamada heredada a buildQuejasChart truene.
const QUEJAS_DATA = (function () {
  var o = {};
  Object.keys(QUEJAS_MES).forEach(function (car) {
    var filas = QUEJAS_CATS.map(function (c) {
      return { c: c, n: QUEJAS_MES[car][c.key].reduce(function (a, b) { return a + b; }, 0) };
    }).filter(function (f) { return f.n > 0; }).sort(function (a, b) { return b.n - a.n; });
    o[car] = {
      labels: filas.map(function (f) { return f.c.label; }),
      data:   filas.map(function (f) { return f.n; }),
      colors: filas.map(function (f) { return f.c.color; }),
    };
  });
  return o;
})();

// ══════════════════════════════════════════════════════
// PIE DE ESTADO — capa de presentación
//
// Vive aquí y no en index.html porque data.js es el único archivo que la
// actualización reescribe cada ciclo. Si algún día se mueve a index.html,
// borra este bloque completo: no hay nada más que dependa de él.
//
// Hace dos cosas al cargar:
//   1. Pinta un pie gris al fondo del sidebar con la fecha de actualización
//      y si la corrida fue exitosa.
//   2. Reescribe los 5 literales de rango de fechas de index.html desde
//      DATA_META.etiqueta, para que no se queden atrás cada ciclo.
// ══════════════════════════════════════════════════════
(function () {
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

  function fechaLarga(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return String(iso || '—');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
  }

  // Revisa que la data publicada sea internamente consistente.
  function validar() {
    const problemas = [];
    const nM = (typeof ALL_MONTHS !== 'undefined' && ALL_MONTHS.length) || 0;
    const nS = (typeof SEM_WEEKS !== 'undefined' && SEM_WEEKS.length) || 0;

    if (!nM) problemas.push('ALL_MONTHS vacío');
    if (!nS) problemas.push('SEM_WEEKS vacío');
    if (typeof SEM_LABELS !== 'undefined' && SEM_LABELS.length !== nS) {
      problemas.push('SEM_LABELS no cuadra con SEM_WEEKS');
    }

    ['DHL', 'Estafeta', '99min'].forEach(function (c) {
      if (typeof RAW !== 'undefined' && RAW[c]) {
        ['cr', 'tix', 'env'].forEach(function (k) {
          if (RAW[c][k].length !== nM) problemas.push(`RAW.${c}.${k} ≠ ${nM} meses`);
        });
      }
      if (typeof DR_DATA !== 'undefined' && DR_DATA[c] && DR_DATA[c].length !== nM) {
        problemas.push(`DR_DATA.${c} ≠ ${nM} meses`);
      }
      if (typeof SEM_DATA !== 'undefined' && SEM_DATA[c]) {
        ['env', 'tix', 'tr'].forEach(function (k) {
          if (SEM_DATA[c][k].length !== nS) problemas.push(`SEM_DATA.${c}.${k} ≠ ${nS} semanas`);
        });
      }
    });

    ['DHL', 'Estafeta', '99min'].forEach(function (c) {
      if (typeof QUEJAS_MES !== 'undefined' && QUEJAS_MES[c] && typeof QUEJAS_CATS !== 'undefined') {
        var suma = 0;
        QUEJAS_CATS.forEach(function (k) {
          var a = QUEJAS_MES[c][k.key] || [];
          if (a.length !== nM) problemas.push(`QUEJAS_MES.${c}.${k.key} ≠ ${nM} meses`);
          suma += a.reduce(function (x, y) { return x + y; }, 0);
        });
        // los motivos deben sumar exactamente los tickets publicados
        if (typeof RAW !== 'undefined' && RAW[c]) {
          var tix = RAW[c].tix.reduce(function (x, y) { return x + y; }, 0);
          if (suma !== tix) problemas.push(`QUEJAS_MES.${c} suma ${suma} vs ${tix} tickets`);
        }
      }
    });

    ['DHL', 'Estafeta', '99min'].forEach(function (c) {
      if (typeof DIA_DAYS !== 'undefined' && typeof DIA_DATA !== 'undefined' && DIA_DATA[c]) {
        ['env', 'tix'].forEach(function (k) {
          if (DIA_DATA[c][k].length !== DIA_DAYS.length) {
            problemas.push(`DIA_DATA.${c}.${k} ≠ ${DIA_DAYS.length} días`);
          }
        });
      }
    });

    return problemas;
  }

  // Los 5 nodos con el rango hardcodeado son markup estático de index.html:
  // sobreviven los re-renders, así que basta un pase al cargar.
  function refrescarFechas() {
    const etiqueta = DATA_META.etiqueta;
    if (!etiqueta) return;
    const re = /(\d{1,2}\s+\w+\s+20\d{2})(?!.*\d{1,2}\s+\w+\s+20\d{2})/;
    document.querySelectorAll('*').forEach(function (el) {
      if (el.children.length !== 0) return;
      const t = el.textContent;
      if (t.indexOf('–') === -1 || !/20\d{2}/.test(t)) return;
      const nuevo = t.replace(re, etiqueta);
      if (nuevo !== t) el.textContent = nuevo;
    });
  }

  function pintarPie() {
    const sidebar = document.querySelector('nav.sidebar') || document.querySelector('.sidebar');
    if (!sidebar || document.getElementById('sidebarStatus')) return;

    const problemas = validar();
    // Las gráficas las construye index.html; si no hay ninguna, algo truncó el render.
    if (typeof charts !== 'undefined' && charts && Object.keys(charts).length === 0) {
      problemas.push('ninguna gráfica se construyó');
    }

    const ok = DATA_META.ok !== false && problemas.length === 0;
    const pie = document.createElement('div');
    pie.id = 'sidebarStatus';
    pie.style.cssText = [
      'margin-top:auto',
      'padding:14px 16px 12px',
      'font-size:10.5px',
      'line-height:1.5',
      'color:#8A8F98',
      'border-top:1px solid rgba(138,143,152,.18)',
      'letter-spacing:.1px',
    ].join(';');

    const notas = (DATA_META.notas || []).slice();
    if (problemas.length) notas.push('Validación: ' + problemas.join(' · '));
    if (notas.length) pie.title = notas.join('\n');

    const l1 = document.createElement('div');
    l1.textContent = 'Actualizado ' + fechaLarga(DATA_META.actualizado);

    const l2 = document.createElement('div');
    l2.style.cssText = 'margin-top:2px;color:' + (ok ? '#8A8F98' : '#C77700') + ';font-weight:500';
    l2.textContent = ok ? '✓ Actualización exitosa' : '⚠ Actualización con problemas';

    pie.appendChild(l1);
    pie.appendChild(l2);

    if (!ok) {
      const l3 = document.createElement('div');
      l3.style.cssText = 'margin-top:3px;color:#8A8F98';
      l3.textContent = problemas.length ? problemas[0] : (DATA_META.mensaje || '');
      pie.appendChild(l3);
    }

    sidebar.appendChild(pie);
  }

  function init() {
    try { refrescarFechas(); } catch (e) { /* cosmético, no tumbar el dash */ }
    try { pintarPie(); } catch (e) { /* idem */ }
  }

  // index.html construye el dash al cargar; corremos después para no competir.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 0); });
  } else {
    setTimeout(init, 0);
  }
})();
