# STAMHOUSE SRL -- Detalle Pick ALVEN/PICK/10948

> **Documento vivo.** Este archivo se actualiza en este mismo chat o en cualquier otro chat
> futuro que trabaje en este proyecto -- el archivo vive en disco en la raiz del proyecto, no
> esta atado a ninguna conversacion. Cualquier sesion de Claude puede leerlo, editarlo y
> re-ejecutar la consulta para refrescarlo mientras sigan ocurriendo transferencias de esta
> tematica (STAMHOUSE / Obsoleto / CDP-INT).
>
> **Como actualizar (para Ron u otra sesion):**
> 1. Re-consultar `stock.move` del pick `ALVEN/PICK/10948` (orden S06988) para ver si hay
>    nuevas liberaciones, cambios de estado o nuevo OUT.
> 2. Re-consultar la lista vigente de transferencias CDP/INT relacionadas a Obsoleto/AA1
>    (la lista de 8 transferencias usada aqui puede haber crecido -- pedir a Gabriel
>    confirmacion de cuales transferencias nuevas incluir, igual que la primera vez).
>    Excluir siempre `PTN/INT/04359` salvo instruccion contraria de Gabriel.
>    Lista base usada en este reporte: CDP/INT/04930, 04933, 04935, 04939, 04940, 04944,
>    05292, 05302.
> 3. Cruzar por `product_id` entre los moves del pick y los move lines de esas transferencias
>    (mismo metodo que la seccion final de este documento).
> 4. Anexar los hallazgos nuevos como una seccion fechada al final del archivo (no borrar
>    historico), usando el formato `## Actualizacion AAAA-MM-DD`.
> 5. Mantener la nota metodologica de barcode=SKU y la limitacion de `mail.tracking.value`
>    inaccesible con uid 98.

Orden: S06988 | Liberado por: MELVIN GRULLON | Fecha: 2026-06-30 18:42  
Estado pick: confirmed | OUT correspondiente: ALVEN/OUT/05567 (waiting)  
Total articulos: 197 | Total unidades demandadas: 366  
Consulta: 2026-06-30 | Ron -- Analista Odoo (JSONRPC, uid 98)

> **reserved_availability = 0** en todos los moves a la fecha de consulta (post-liberacion).
> La columna "Qty demandada" es product_uom_qty (demanda original de la orden).
> Ubicacion origen = ALVEN/Stock: sin bin especifico asignado (reserva liberada).
> Columna "En Obsoleto": articulos que ademas aparecen en las 8 CDP/INT transferencias a Obsoleto/AA1.

| # | Nombre | SKU | Codigo de barras | Qty demandada | Pick / OUT | En Obsoleto |
|---|--------|-----|-----------------|---------------|------------|-------------|
| 1 | 10Th Caprera Coffee Table Barrique + Leaf Rust | EXT.10TH.CAPRERA.COFFTBL.P | 111.0002.EXT | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 2 | 3 Doors Cabinet Brown | BH-Z82025 | BH-Z82025 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 3 | 3 Mirrored Side Tables Set | AA-NST4B | AA-NST4B | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 4 | 3-Seater Sofa Grey | YU-F079-3 | YU-F079-3 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 5 | 4 Seater Sofa Mustard | SJ-FK0725M | SJ-FK0725M | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 6 | 6 Seater Sofa | SJ-FK0725L | SJ-FK0725L | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 7 | Ahnda Wing Chair Col Org W/ Cush Col Ar | DED-0070006105 | DED-0070006105 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 8 | Alum Barstool | SA-MODBARALUWH | SA-MODBARALUWH | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 9 | Amora 2-Seater Sofa Grey | YU-F079-2 | YU-F079-2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 10 | Aparador Athens | KB-MB005172 | KB-MB005172 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 11 | Aparador Capiz | KB-MB005178/C | KB-MB005178/C | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 12 | Armchair Grey | SJ-ZW-1018G | SJ-ZW-1018G | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 13 | Armchair Seat Col Dark Brown + Backrest Col Teak | RM-8002-8 | RM-8002-8 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 14 | Armchair Seat Col White + Beige Backrest | RM-8004-8 | RM-8004-8 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 15 | Aspen Coffee Table White | ALS-ASP600WHITE | ALS-ASP600WHITE | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 16 | Azimut Patas De Mesa | CAI-40143070 | CAI-40143070 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 17 | Babylon Stool And Side Table Col Taupe | DED.BABYLON.STOOL.BG.43.P | 20.0048.DED | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 18 | Barrel Armchair Black Frames | VS-VS08-234 | VS-VS08-234 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 19 | Bed Pearl White Cocodrile Queen | JLC-CB24Q | JLC-CB24Q | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 20 | Bench | CF-CZ-CH-003/G | CF-CZ-CH-003/G | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 21 | Blocks Espejos | NAT-Y003VG0 | NAT-Y003VG0 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 22 | Book Shelf 990 X 185 X 290 | HK-TZ236 | HK-TZ236 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 23 | Butaca | RM-104-8B | RM-104-8B | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 24 | Cama Con Espaldar En Leather Blanca | AS-BD1738LKL | AS-BD1738LKL | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 25 | Cama Pequena | SN-30 | SN-30 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 26 | Candelabro | KD-1044 | KD-1044 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 27 | Candelabro De 4 Luces Smoke | HG-BKMT070-4S | HG-BKMT070-4S | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 28 | Candelabro En Madera Extra Grande | SE-T239-XL | SE-T239-XL | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 29 | Candelabro En Madera Pequeña | SE-T239-S | SE-T239-S | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 30 | Candelabro Niquelada Grande | SE-T259-L | SE-T259-L | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 31 | Cape Town Lounge Chair | ALC-AC5830E10ALU | ALC-AC5830E10ALU | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 32 | Centro De Mesa | ARD-RZ1012-1A | ARD-RZ1012-1A | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 33 | Chair | IH-F9771114 | IH-F9771114 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 34 | Chair White | CCC-A092 | CCC-A092 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 35 | Chaise Longue Lx Mod White | IH-F9050420 | IH-F9050420 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 36 | Chaise Longue Rx Col Beige | WF.SOFA.BG.RX.CHAISE.P | 11.0002.WF | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 37 | Cheslong De Playa | META-2362 | META-2362 | 7 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 38 | Chocolat Mirror 100 Cm | NAT-Y007V0V | NAT-Y007V0V | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 39 | Cielo Armchair Rattan | ART-CAC | ART-CAC | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 40 | Coffee Table | DR-CUCTWD | DR-CUCTWD | 9 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 41 | Coffee Table Green | WF-E122M/V | WF-E122M/V | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 42 | Couch With Armrest | FSV-S8909 | FSV-S8909 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 43 | Credenza | KB-MB00517 | KB-MB00517 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 44 | Credenza | GM-91473.0 | GM-91473.0 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 45 | Credenza | RS-BU024/W-LQ | RS-BU024/W-LQ | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 46 | Cruz Corner | GD-HUC25232 | GD-HUC25232 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 47 | Da-Eden | DA-EDEN | DA-EDEN | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 48 | Decorative Foil Sheet | M-MD132025 | M-MD132025 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 49 | Decorative Sheet | M-MD131133 | M-MD131133 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 50 | Decorative Sheet | M-MD131134 | M-MD131134 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 51 | Dedon Babylon Stool And Side Table Designed By Harry Paul Color Taupe D43 X 45 Cm | DED-10003385 | DED-10003385 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 52 | Dimsum 40 End Table Bown | IC-1507G | IC-1507G | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 53 | Dr-Curlyhl | DR-CURLYHL | DR-CURLYHL | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 54 | Dresser | GY-KDS03 | GY-KDS03 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 55 | Escritorio | WF-1S001Z | WF-1S001Z | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 56 | Fa-W4840F | FA-W4840F | FA-W4840F | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 57 | Fa-W4840Fw | FA-W4840FW | FA-W4840FW | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 58 | Fc-Km-337D | FC-KM-337D | FC-KM-337D | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 59 | Fiam Rialto L Shelf Col Tr | FI-280530 | FI-280530 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 60 | Floor Lamp Wood Color | MA-ML80160-1-800 | MA-ML80160-1-800 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 61 | Florero | VS-VS08-078T | VS-VS08-078T | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 62 | Footstool Rattan | RM-120-14 | RM-120-14 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 63 | Four Seater Sofa | SJ-FK0725 | SJ-FK0725 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 64 | Gavetero Secret Love | ML-SL703GLL1 | ML-SL703GLL1 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 65 | Glass Display Unit Boxingbox 35X35X24H | GLA-BIB07 | GLA-BIB07 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 66 | Gryphon Led Table | GD-HUC31409 | GD-HUC31409 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 67 | Hamilton Lx Open End Sofa Col Beige | MI-HAMILTON.SOFA.BG.C3 | 33.0015.MI | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 68 | Hermione Lx Arm Sofa Col Beige | FSV.HERMIONE.SOFA.BG.LX.C2 | 22.0012.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 69 | Hermione Lx Sofa Col Black | FSV.HERMIONE.SOFA.BLK.LX.C1 | 12.0008.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 70 | Hermione Rx Arm Sofa Col Beige | FSV.HERMIONE.SOFA.BG.RX.C1 | 12.0012.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 71 | Hermione Rx Sofa Col Black | FSV.HERMIONE.SOFA.BLK.RX.C2 | 22.0008.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 72 | I4-Attitude/Cl | I4-ATTITUDE/CL | I4-ATTITUDE/CL | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 73 | In-1900Fam | IN-1900FAM | IN-1900FAM | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 74 | Jor-Eur-03-0133 | JOR-EUR-03-0133 | JOR-EUR-03-0133 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 75 | Jowil Cx Arm Sofa Col Beige | FSV.JOWIL.SOFA.BG.WLCX.C2 | 22.0011.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 76 | Jowil Lx Arm Sofa Col Beige | FSV.JOWIL.SOFA.BG.WLLX.C1 | 12.0011.FSV | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 77 | Kai Tripod Mwdium Brown | IC-2753 | IC-2753 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 78 | King Size Bed Upholstery | NI-CL045/K | NI-CL045/K | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 79 | Kubika 3B Matt Lacquer Anthracite | NAT-W010C3104033131 | NAT-W010C3104033131 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 80 | Labirinto Mesa De Centro | NAT-T140VH3 | NAT-T140VH3 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 81 | Labirinto Mesa De Esquina | NAT-T140V40 | NAT-T140V40 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 82 | Labirinto Mesa Lateral | NAT-T140V41 | NAT-T140V41 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 83 | Lampara De Piso Color Madera | MA-ML80160-1-500 | MA-ML80160-1-500 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 84 | Lampara De Techo Color Madera | MA-MD80160-1-380 | MA-MD80160-1-380 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 85 | Lampara De Techo Color Madera | MA-MD80160-1-600 | MA-MD80160-1-600 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 86 | Large Armchair Seat Col White + Beige Backrest | RM-8007-13 | RM-8007-13 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 87 | Lounge Beige | SJ-FK-0731B/BE | SJ-FK-0731B/BE | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 88 | M-Ah3142 | M-AH3142 | M-AH3142 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 89 | M-Ah3143 | M-AH3143 | M-AH3143 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 90 | M-Ah3429 | M-AH3429 | M-AH3429 | 7 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 91 | M-Ah3430 | M-AH3430 | M-AH3430 | 5 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 92 | M-Ym547 | M-YM547 | M-YM547 | 5 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 93 | M-Ym643 | M-YM643 | M-YM643 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 94 | M-Ym644 | M-YM644 | M-YM644 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 95 | Magic Mirror | RS-FR033BZMIOKNR | RS-FR033BZMIOKNR | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 96 | Mampara Blanca | WF-8P020 | WF-8P020 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 97 | Mbrace Base For Rocking Chair Col Teak | DED.MBRACE.BASE.TK.ROCKING.C2 | 112.0043.DED | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 98 | Mediterranean Sunlounger With Arms & Wheels | ALC-AS5602N61 | ALC-AS5602N61 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 99 | Melgru Chaise Lounge Col Beige | NI.MELGRU.SOFA.BG.CHAISEL.C1 | 12.0001.NI | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 100 | Melgru Lx 2 Seat Sofa Col Beige | NI.MELGRU.SOFA.BG.2SEAT.LX.C2 | 22.0001.NI | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 101 | Mesa De Centro | RM-201-4 | RM-201-4 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 102 | Mesa De Centro | STL-BFJ5052A-1/3 | STL-BFJ5052A-1/3 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 103 | Mesa De Centro | STL-BFJ5052A-2/3 | STL-BFJ5052A-2/3 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 104 | Mesa De Centro | STL-BFJ5052A-3/3 | STL-BFJ5052A-3/3 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 105 | Mesa De Centro | RM-202-4 | RM-202-4 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 106 | Mesa De Centro | RM-8008-4 | RM-8008-4 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 107 | Mesa De Centro | SMI-CM-317-GR | SMI-CM-317-GR | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 108 | Mesa De Centro Atollo Twin | CAI-52013207 | CAI-52013207 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 109 | Mesa De Centro Patas Colakas | FW-TT223/VL-2/2 | FW-TT223/VL-2/2 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 110 | Mesa De Centro Patas En Marmol Chocolate | FW-TT223/C-2/3 | FW-TT223/C-2/3 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 111 | Mesa De Noche | GY-KEC03 | GY-KEC03 | 5 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 112 | Mesa De Noche | GY-KNT03 | GY-KNT03 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 113 | Mesa Lateral | RM-302-5A | RM-302-5A | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 114 | Mesa Lateral Acero Inoxidable | FG-G25T02f | FG-G25T02f | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 115 | Mesa Rectangular Base | GC-3000 | GC-3000 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 116 | Mesas De Comedor | RM-106-7L | RM-106-7L | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 117 | Mesas De Comedor | SFG-CY-F029-40 | SFG-CY-F029-40 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 118 | Mesas De Comedor Base | ML-0SP4021-1/2 | ML-0SP4021-1/2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 119 | Mesas De Comedor En Madera Natural Con Patas En Metal | RF-NWT-2 | RF-NWT-2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 120 | Mesita De Noche Madera White | CF-CZ-NS001/M | CF-CZ-NS001/M | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 121 | Meta-5575 | META-5575 | META-5575 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 122 | Mirror | EN-AW650R | EN-AW650R | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 123 | Mirror | DA-ZAC/AW | DA-ZAC/AW | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 124 | Monti Coffee Table Col Brown Ebony | JLC.MONTI.COFFTBLE.BRW.EBONY.P | 111.0038.JLC | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 125 | Night Stand Off White | CF-CZ-NS001/S | CF-CZ-NS001/S | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 126 | Ottoman En Tela Color Crema 112X60X29 | TEMPO-119 | TEMPO-119 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 127 | Pearl Armchair Leather Col White W/ Tacks | SJ-FK-0731/P | SJ-FK-0731/P | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 128 | Plisse Libreo | NAT-W013012 -1/2 | NAT-W013012-1/2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 129 | Poseidon Lamp Table With Satin Brass Base | BOF-FM | BOF-FM | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 130 | Queen Size Bed Upholstery | NI-CLO45 | NI-CLO45 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 131 | Rd Sandstone Pot Col White W/ Wood Leg 37 X 37 X H 86 Cm | AN-62-23009-S2-07.S | AN-62-23009-S2-07.S | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 132 | Rd Sandstone Pot Col White W/ Wood Leg 40 X 40 X H 97 Cm | AN-62-23009-S2-07.L | AN-62-23009-S2-07.L | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 133 | Rhodes Sunlounger | ALC-AS5604E19TEX | ALC-AS5604E19TEX | 13 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 134 | Rhodes Sunlounger | ALC-AS5604B19TEX | ALC-AS5604B19TEX | 6 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 135 | Roosa 2 Seater | ART-R2S | ART-R2S | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 136 | Sarria Esquinero De Sofa Modular De | PF-107460803000-BE | PF-107460803000-BE | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 137 | Set Mbrace Coffee Table 70 Cm Black Color | DED-00085038341 | DED-00085038341 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 138 | Set Sofa 11 Pcs Y Mesa | KB-MCGX 4 | KB-MCGX 4 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 139 | Set Sofa 2 Sillones Y Mesa | KB-MCGX7 | KB-MCGX7 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 140 | Sill En Ratan Color Wegen | BR-BRYONS/C | BR-BRYONS/C | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 141 | Silla | HE-MF1976 | HE-MF1976 | 5 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 142 | Silla Ejecutiva Blanca Y Roja | RU-PC077 | RU-PC077 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 143 | Sillas Con Brazos Bellevou | CHI-AFLPN6 | CHI-AFLPN6 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 144 | Sillas De Comedor Carioca | CG-CGDC8-016 | CG-CGDC8-016 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 145 | Slanted Oval Planter - Mediano Color Negro 129X52X122 Cm | SN-008/N | SN-008/N | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 146 | Sn-023 | SN-023 | SN-023 | 5 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 147 | Sn-Venus | SN-VENUS | SN-VENUS | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 148 | Sofa | SUL-SF012C | SUL-SF012C | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 149 | Sofa | CF-BR-SF1063D | CF-BR-SF1063D | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 150 | Sofa 1570 X 1040 X 580 | SUL-SF012C-1/2 | SUL-SF012C-1/2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 151 | Sofa 1570X1040X580 | SUL-SF012C-2/2 | SUL-SF012C-2/2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 152 | Sofa Cx Mod Beige | FSV-S6037-2/CE | FSV-S6037-2/CE | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 153 | Sofa Cx Mod Beige | FSV-S5611 | FSV-S5611 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 154 | Sofa De 2 Puestos Gris | SJ-ZW-1006G-2 | SJ-ZW-1006G-2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 155 | Sofa De 2 Puestos White | SJ-ZW-1006W-2 | SJ-ZW-1006W-2 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 156 | Sofa De 3 Puestos Gris | SJ-ZW-1006G-3 | SJ-ZW-1006G-3 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 157 | Sofa De 3 Puestos White | SJ-ZW-1006W-3 | SJ-ZW-1006W-3 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 158 | Sofa De 4 Puesto | SAWADEE-01 | SAWADEE-01 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 159 | Sofa De Dos Puestos | FSV-S6740-1/M | FSV-S6740-1/M | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 160 | Sofa Lx Arm Col White | FSV.SOFA.WH.LX.P | 11.0001.FSV | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 161 | Sofa Lx Mod Col Beige | WF-SF027-C01L | WF-SF027-C01L | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 162 | Sofa Modular Pieza Central Blanco 152X101X37 Referencia Wf | FSV-5611/C | FSV-5611/C | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 163 | Sofa Off White | FSV-MS1002-1 | FSV-MS1002-1 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 164 | Sofa Rx White | FSV-S5605/WR | FSV-S5605/WR | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 165 | Sq Cement Fiber Candle Holder W/ Glass 31X31Xh78 Cm | AN-81-08500-S1-02 | AN-81-08500-S1-02 | 6 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 166 | Sq Cement Fiber Candle Holder W/ Glass 36X36Xh153 Cm | AN-81-08700-S1-02 | AN-81-08700-S1-02 | 7 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 167 | Sunny Day Cocktall Table | OC-10297-CKC1 | OC-10297-CKC1 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 168 | Table | BH-H8230 | BH-H8230 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 169 | Table | BH-H8232 | BH-H8232 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 170 | Tall Side Table Smoke Matt Titanium | DEM-MS-9117A | DEM-MS-9117A | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 171 | Tc-185-Lc5187-19-01 | TC-185-LC5187-19-01 | TC-185-LC5187-19-01 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 172 | Tc-Pv77.110031 | TC-PV77.110031 | TC-PV77.110031 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 173 | Tc-Pv77.190001 | TC-PV77.190001 | TC-PV77.190001 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 174 | Tc-Pv77.190004 | TC-PV77.190004 | TC-PV77.190004 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 175 | Top For Infinity Table | PO-175214 | PO-175214 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 176 | Underline 367F Print On Glass And Paper | RS.UNDERLINE.ART.SILVER.P/91X91F | RS.0008.11 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 177 | Upholstered Full Bed Small | NI-CL028Q/F | NI-CL028Q/F | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 178 | Venetian Mirror | RG-LD1612-6 | RG-LD1612-6 | 4 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 179 | Vr-26494 | VR-26494 | VR-26494 | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 180 | Vr-26496 | VR-26496 | VR-26496 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 181 | Vr-26747 | VR-26747 | VR-26747 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 182 | Vr-26768 | VR-26768 | VR-26768 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 183 | Vs-05-243 | VS-05-243 | VS-05-243 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 184 | Vs-Vs07-261A | VS-VS07-261A | VS-VS07-261A | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 185 | Wall Mirror | RG-LD2288-9 | RG-LD2288-9 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 186 | Wall Mirror | RG-LD6324-1 | RG-LD6324-1 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 187 | Wall Mirror | RG-LD6199-1 | RG-LD6199-1 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 188 | Wall Mirror Col Silver 107X84X5Cm | RG.MIRROR.SILVER.6232.5.P | 11.0001.RG | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 189 | Wall Mirror Gold | RG-LD6232-4 | RG-LD6232-4 | 7 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 190 | Wall Mirror Gold | RG-LD6231-3 | RG-LD6231-3 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 191 | Wall Mirror Silver | RG-LD6231-2 | RG-LD6231-2 | 2 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 192 | White Glass Pearl Plate Base | VGN-7511692.00 | VGN-7511692.00 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 193 | Wood Little Ornament | VS-07-100B | VS-07-100B | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 194 | Zafacon Niquelado Grande | SE-T212-L | SE-T212-L | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 195 | Zafacon Niquelado Grande | SE-T289-L | SE-T289-L | 3 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | SI |
| 196 | Zafacon Niquelado Pequeño | SE-T289-S | SE-T289-S | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |
| 197 | Zs-5547 | ZS-5547 | ZS-5547 | 1 | ALVEN/PICK/10948 / ALVEN/OUT/05567 | - |

---

**Total articulos:** 197 | **Con cruce a Obsoleto:** 70 (36%) | **Sin cruce:** 127

---

## Articulos liberados de STAMHOUSE y transferidos a Obsoleto/AA1

Estos 70 articulos estaban en la orden S06988 de STAMHOUSE SRL.
Despues de que MELVIN GRULLON libero la reserva el 2026-06-30, estos mismos productos
aparecen en las transferencias CDP/INT hacia Obsoleto/AA1 (algunas anteriores a la liberacion).

> **Atencion:** Las CDP/INT son de junio 2026 (16-27 jun). El unreserve fue el 30-jun.
> Esto no prueba causalidad directa -- algunos articulos pudieron haberse movido a Obsoleto
> independientemente de la reserva de STAMHOUSE. Pero el solapamiento es significativo (70/197 = 36%).

| # | Nombre | SKU | Qty demandada STAMHOUSE | Qty enviada a Obsoleto/AA1 | Transferencia(s) CDP/INT |
|---|--------|-----|------------------------|---------------------------|--------------------------|
| 1 | 3-Seater Sofa Grey | YU-F079-3 | 1 | 1 | CDP/INT/04930 |
| 2 | 4 Seater Sofa Mustard | SJ-FK0725M | 1 | 1 | CDP/INT/04930 |
| 3 | Alum Barstool | SA-MODBARALUWH | 1 | 1 | CDP/INT/04944 |
| 4 | Amora 2-Seater Sofa Grey | YU-F079-2 | 1 | 1 | CDP/INT/04930 |
| 5 | Aparador Athens | KB-MB005172 | 1 | 1 | CDP/INT/04944 |
| 6 | Aparador Capiz | KB-MB005178/C | 1 | 1 | CDP/INT/04933 |
| 7 | Armchair Seat Col White + Beige Backrest | RM-8004-8 | 3 | 1 | CDP/INT/04935 |
| 8 | Aspen Coffee Table White | ALS-ASP600WHITE | 4 | 4 | CDP/INT/04935, CDP/INT/04939, CDP/INT/04940 |
| 9 | Bench | CF-CZ-CH-003/G | 1 | 1 | CDP/INT/05302 |
| 10 | Chair | IH-F9771114 | 1 | 1 | CDP/INT/04940 |
| 11 | Cheslong De Playa | META-2362 | 7 | 7 | CDP/INT/04940 |
| 12 | Couch With Armrest | FSV-S8909 | 1 | 1 | CDP/INT/04930 |
| 13 | Credenza | KB-MB00517 | 1 | 1 | CDP/INT/04935 |
| 14 | Cruz Corner | GD-HUC25232 | 1 | 1 | CDP/INT/05302 |
| 15 | Footstool Rattan | RM-120-14 | 1 | 1 | CDP/INT/04935 |
| 16 | Four Seater Sofa | SJ-FK0725 | 1 | 1 | CDP/INT/04939 |
| 17 | Hamilton Lx Open End Sofa Col Beige | MI-HAMILTON.SOFA.BG.C3 | 1 | 1 | CDP/INT/04930 |
| 18 | Hermione Lx Sofa Col Black | FSV.HERMIONE.SOFA.BLK.LX.C1 | 1 | 1 | CDP/INT/04944 |
| 19 | Hermione Rx Sofa Col Black | FSV.HERMIONE.SOFA.BLK.RX.C2 | 1 | 2 | CDP/INT/04940 |
| 20 | I4-Attitude/Cl | I4-ATTITUDE/CL | 1 | 1 | CDP/INT/04935 |
| 21 | Jowil Lx Arm Sofa Col Beige | FSV.JOWIL.SOFA.BG.WLLX.C1 | 1 | 1 | CDP/INT/04939 |
| 22 | Lampara De Techo Color Madera | MA-MD80160-1-380 | 1 | 2 | CDP/INT/05302 |
| 23 | Lampara De Techo Color Madera | MA-MD80160-1-600 | 2 | 2 | CDP/INT/05302 |
| 24 | Large Armchair Seat Col White + Beige Backrest | RM-8007-13 | 2 | 1 | CDP/INT/04935 |
| 25 | Lounge Beige | SJ-FK-0731B/BE | 2 | 1 | CDP/INT/04935 |
| 26 | Mampara Blanca | WF-8P020 | 2 | 1 | CDP/INT/04940 |
| 27 | Mediterranean Sunlounger With Arms & Wheels | ALC-AS5602N61 | 1 | 2 | CDP/INT/04940 |
| 28 | Melgru Chaise Lounge Col Beige | NI.MELGRU.SOFA.BG.CHAISEL.C1 | 1 | 1 | CDP/INT/04940 |
| 29 | Mesa De Centro | RM-201-4 | 4 | 3 | CDP/INT/04935, CDP/INT/04944 |
| 30 | Mesa De Centro | STL-BFJ5052A-1/3 | 3 | 3 | CDP/INT/04944 |
| 31 | Mesa De Centro | STL-BFJ5052A-2/3 | 3 | 3 | CDP/INT/04944 |
| 32 | Mesa De Centro | STL-BFJ5052A-3/3 | 3 | 3 | CDP/INT/04944 |
| 33 | Mesa De Centro | RM-202-4 | 2 | 2 | CDP/INT/04935 |
| 34 | Mesa De Centro | RM-8008-4 | 4 | 3 | CDP/INT/04940 |
| 35 | Mesa De Centro | SMI-CM-317-GR | 2 | 2 | CDP/INT/04935 |
| 36 | Mesa De Centro Atollo Twin | CAI-52013207 | 2 | 1 | CDP/INT/04939 |
| 37 | Mesa De Noche | GY-KEC03 | 5 | 3 | CDP/INT/04940 |
| 38 | Mesa De Noche | GY-KNT03 | 4 | 1 | CDP/INT/04933 |
| 39 | Mesa Lateral Acero Inoxidable | FG-G25T02f | 1 | 1 | CDP/INT/04939 |
| 40 | Mesas De Comedor | RM-106-7L | 4 | 2 | CDP/INT/04935 |
| 41 | Mesas De Comedor | SFG-CY-F029-40 | 4 | 2 | CDP/INT/04935, CDP/INT/04940 |
| 42 | Meta-5575 | META-5575 | 1 | 1 | CDP/INT/04940 |
| 43 | Mirror | DA-ZAC/AW | 4 | 2 | CDP/INT/04944 |
| 44 | Monti Coffee Table Col Brown Ebony | JLC.MONTI.COFFTBLE.BRW.EBONY.P | 1 | 1 | CDP/INT/04940 |
| 45 | Night Stand Off White | CF-CZ-NS001/S | 2 | 1 | CDP/INT/04940 |
| 46 | Ottoman En Tela Color Crema 112X60X29 | TEMPO-119 | 4 | 3 | CDP/INT/04933 |
| 47 | Pearl Armchair Leather Col White W/ Tacks | SJ-FK-0731/P | 1 | 1 | CDP/INT/04939 |
| 48 | Queen Size Bed Upholstery | NI-CLO45 | 2 | 2 | CDP/INT/04930 |
| 49 | Rd Sandstone Pot Col White W/ Wood Leg 37 X 37 X H 86 Cm | AN-62-23009-S2-07.S | 1 | 1 | CDP/INT/04940 |
| 50 | Rd Sandstone Pot Col White W/ Wood Leg 40 X 40 X H 97 Cm | AN-62-23009-S2-07.L | 3 | 1 | CDP/INT/04944 |
| 51 | Rhodes Sunlounger | ALC-AS5604E19TEX | 13 | 8 | CDP/INT/04940, CDP/INT/04944 |
| 52 | Rhodes Sunlounger | ALC-AS5604B19TEX | 6 | 6 | CDP/INT/04940 |
| 53 | Set Sofa 11 Pcs Y Mesa | KB-MCGX 4 | 1 | 1 | CDP/INT/04935 |
| 54 | Set Sofa 2 Sillones Y Mesa | KB-MCGX7 | 1 | 1 | CDP/INT/04935 |
| 55 | Sillas Con Brazos Bellevou | CHI-AFLPN6 | 3 | 3 | CDP/INT/04940 |
| 56 | Sillas De Comedor Carioca | CG-CGDC8-016 | 2 | 1 | CDP/INT/04939 |
| 57 | Sn-Venus | SN-VENUS | 1 | 1 | CDP/INT/04935 |
| 58 | Sofa | SUL-SF012C | 1 | 1 | CDP/INT/04939 |
| 59 | Sofa 1570 X 1040 X 580 | SUL-SF012C-1/2 | 1 | 1 | CDP/INT/04939 |
| 60 | Sofa 1570X1040X580 | SUL-SF012C-2/2 | 1 | 1 | CDP/INT/04940 |
| 61 | Sofa De 4 Puesto | SAWADEE-01 | 1 | 2 | CDP/INT/04944 |
| 62 | Sofa Lx Arm Col White | FSV.SOFA.WH.LX.P | 2 | 2 | CDP/INT/04940 |
| 63 | Sofa Lx Mod Col Beige | WF-SF027-C01L | 1 | 1 | CDP/INT/04933 |
| 64 | Sofa Modular Pieza Central Blanco 152X101X37 Referencia Wf | FSV-5611/C | 1 | 1 | CDP/INT/04939 |
| 65 | Sunny Day Cocktall Table | OC-10297-CKC1 | 1 | 3 | CDP/INT/04940 |
| 66 | Table | BH-H8230 | 3 | 1 | CDP/INT/04944 |
| 67 | Tall Side Table Smoke Matt Titanium | DEM-MS-9117A | 1 | 1 | CDP/INT/04944 |
| 68 | Vr-26747 | VR-26747 | 1 | 1 | CDP/INT/04935 |
| 69 | Vr-26768 | VR-26768 | 1 | 1 | CDP/INT/04940 |
| 70 | Zafacon Niquelado Grande | SE-T289-L | 3 | 5 | CDP/INT/04944 |

---

**Notas metodologicas:**
- Cruce por product_id entre stock.move (ALVEN/PICK/10948) y stock.move.line (8 CDP/INT).
- Las CDP/INT van del 2026-06-16 al 2026-06-27; el unreserve es del 2026-06-30.
- No se puede determinar con uid 98 si el stock fue fisicamente desviado de STAMHOUSE hacia Obsoleto
  (mail.tracking.value inaccesible). El cruce es por product_id, no por lote/serie.
- barcode en Altri Tempi = default_code (SKU). No usan EAN/UPC configurado.