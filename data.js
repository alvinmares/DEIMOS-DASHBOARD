// ══════════════════════════════════════════════════════
// DEIMOS DASHBOARD — CAPA DE DATOS
// Único archivo que se edita en cada actualización.
// Corte de datos: 12 ago 2026  ·  Publicado: 13 ago 2026
// Fuentes: tickets = Google Form lifecycle · envíos/DR = etl.mx__contract.frodo__deliveries
// ⚠️ Frodo no tiene envíos creados el 2026-08-10 (lunes). El volumen aparece
//    corrido a mar 11 / mié 12 (~26k c/u vs ~19k de un día hábil normal).
// ══════════════════════════════════════════════════════

const DATA_META = { corte: '2026-08-12', publicado: '2026-08-13', etiqueta: '12 ago 2026' };

// Mes con * = parcial (aún no cierra)
const ALL_MONTHS = ['Ene 26','Feb 26','Mar 26','Abr 26','May 26','Jun 26','Jul 26','Ago 26*'];

// cr = tix/env*1000 · tix = tickets del form · env = envíos de Frodo
const RAW = {
  'DHL':     { cr:[3.68,3.28,1.75,3.49,4.99,3.39,2.12,3.69], tix:[135,68,68,108,134,96,60,39], env:[36670,20738,38867,30925,26847,28307,28334,10565] },
  'Estafeta':{ cr:[3.81,5.43,2.8,5.74,5.8,4.58,3.27,4.03], tix:[1363,1005,1097,1669,1464,1144,843,391], env:[357730,185203,392259,290616,252491,250049,257597,97000] },
  '99min':   { cr:[8.29,11.54,6.02,10.67,9.92,6.44,3.59,5.92], tix:[1533,1114,1200,1617,1277,828,479,291], env:[185030,96497,199476,151573,128726,128506,133309,49181] },
};

// Delivery Rate % · null = mes aún inmaduro (los envíos recientes no han terminado su ciclo)
const DR_DATA = {
  'DHL':     [83.97,87.68,84.09,86.91,85.09,86,84.54,null],
  'Estafeta':[90.73,91.58,90.17,91.45,92.01,92.22,91.6,null],
  '99min':   [93.46,94.37,92.05,91.9,92.5,91.65,91.23,null],
};

// Semanas lunes–domingo (ISO)
const SEM_WEEKS = ['01-05','01-12','01-19','01-26','02-02','02-09','02-16','02-23','03-02','03-09','03-16','03-23','03-30','04-06','04-13','04-20','04-27','05-04','05-11','05-18','05-25','06-01','06-08','06-15','06-22','06-29','07-06','07-13','07-20','07-27','08-03'];
const SEM_LABELS = ['05 ene','12 ene','19 ene','26 ene','02 feb','09 feb','16 feb','23 feb','02 mar','09 mar','16 mar','23 mar','30 mar','06 abr','13 abr','20 abr','27 abr','04 may','11 may','18 may','25 may','01 jun','08 jun','15 jun','22 jun','29 jun','06 jul','13 jul','20 jul','27 jul','03 ago'];

const SEM_DATA = {
  'DHL':     {
    env:[5560,4389,18217,6934,5629,2181,8551,4377,6075,2439,14299,12904,4614,9213,7151,7649,7138,6073,5326,7221,6537,6401,5979,7071,6955,6124,6464,6092,5709,6659,6150],
    tix:[24,38,32,35,18,18,7,24,16,14,10,20,13,20,31,28,28,25,37,44,21,34,21,12,24,13,16,11,11,16,27],
    tr: [4.32,8.66,1.76,5.05,3.2,8.25,0.82,5.48,2.63,5.74,0.7,1.55,2.82,2.17,4.34,3.66,3.92,4.12,6.95,6.09,3.21,5.31,3.51,1.7,3.45,2.12,2.48,1.81,1.93,2.4,4.39],
  },
  'Estafeta':{
    env:[59317,43608,169003,68245,45841,22457,85895,31010,87220,19633,126632,125496,46020,91000,66795,66889,70227,58487,49677,68302,58988,55069,53356,59881,61334,59657,53893,57799,52074,62315,57720],
    tix:[234,327,324,382,245,233,221,287,238,222,182,337,505,377,361,336,269,333,361,350,340,294,355,230,204,181,203,179,189,181,221],
    tr: [3.94,7.5,1.92,5.6,5.34,10.38,2.57,9.26,2.73,11.31,1.44,2.69,10.97,4.14,5.4,5.02,3.83,5.69,7.27,5.12,5.76,5.34,6.65,3.84,3.33,3.03,3.77,3.1,3.63,2.9,3.83],
  },
  '99min':   {
    env:[25960,24635,91945,35846,25438,11361,40739,18959,39523,13202,65561,64657,23408,46522,34592,36819,35511,30336,25179,34682,29783,29067,27292,31395,31606,27554,31072,29499,26854,31183,28434],
    tix:[254,381,385,448,309,273,252,267,276,242,139,371,376,325,425,425,291,317,354,319,207,243,222,174,160,98,105,100,105,131,156],
    tr: [9.78,15.47,4.19,12.5,12.15,24.03,6.19,14.08,6.98,18.33,2.12,5.74,16.06,6.99,12.29,11.54,8.19,10.45,14.06,9.2,6.95,8.36,8.13,5.54,5.06,3.56,3.38,3.39,3.91,4.2,5.49],
  },
};

// ⚠️ Taxonomía heredada del form anterior — no reproducible con el form actual. Pendiente redefinir.
const QUEJAS_DATA={
  'DHL':{labels:['Falsa entrega','Prob. repartidor','Cambio carrier','Devolución sin intentos','Sin cobertura','No completó entrega','Múltiples intentos','Entrega cruzada','Punto forzado','Otros'],
    data:[518,41,20,18,9,7,7,6,4,8],colors:['#F06292','#7B52B8','#90A4AE','#F4A020','#26C6A0','#60A5FA','#E040A0','#BDBDBD','#FF8A65','#9E9E9E']},
  'Estafeta':{labels:['Falsa entrega','Entrega cruzada','Prob. repartidor','Cambio carrier','Problema interno','Devolución sin intentos','Nombre incorrecto','Punto forzado','Sobre abierto','Otros'],
    data:[6408,1183,247,105,63,61,33,22,10,24],colors:['#F06292','#F4A020','#7B52B8','#90A4AE','#9E9E9E','#60A5FA','#E040A0','#FF8A65','#26C6A0','#BDBDBD']},
  '99min':{labels:['Falsa entrega','Prob. repartidor','Entrega cruzada','Cambio carrier','Devolución sin intentos','Problema interno','No completó entrega','Punto forzado','Sobre abierto','No contestan','Otros'],
    data:[7079,294,166,84,58,38,18,16,14,13,26],colors:['#F06292','#7B52B8','#F4A020','#90A4AE','#60A5FA','#9E9E9E','#26C6A0','#FF8A65','#E040A0','#BDBDBD','#CFD8DC']}
};
