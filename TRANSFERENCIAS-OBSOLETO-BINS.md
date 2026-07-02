# Articulos por Bin Correcto de Origen -- Transferencias Despacho Obsoleto

**Fecha de consulta:** 2026-06-30  
**Preparado por:** Ron -- Analista Odoo (JSONRPC en vivo, uid 98, altritempi.odoo.com)  
**Logica:** Para cada articulo de las 8 CDP/INT, se identifica el bin donde Odoo tenia su stock ANTES de la transferencia. Ese es el bin que debio haberse usado como origen en lugar de A-CDP.

> **Metodo de identificacion del bin correcto:**
> 1. Si el producto tiene quant activo en un bin distinto a A-CDP y Obsoleto/AA1 -> ese es el bin correcto (quant con mayor cantidad).
> 2. Si no tiene quant activo externo, se busca el ultimo movimiento de ENTRADA en ubicacion interna antes del 2026-06-16 -> ese bin es donde estaba registrado.
> La columna "Existencia actual" muestra el stock del producto en ese bin a 2026-06-30.

---

## Resumen general

| Metrica | Valor |
|---------|-------|
| Total bins distintos identificados | 184 |
| Total lineas de movimiento | 608 |
| Total unidades transferidas a Obsoleto/AA1 | 920 |
| Articulos sin bin identificable | 0 |

## Resumen por transferencia

| Transferencia | Fecha | Articulos | Unidades |
|---------------|-------|-----------|----------|
| CDP/INT/04930 | 2026-06-16 | 26 | 32 |
| CDP/INT/04933 | 2026-06-16 | 68 | 91 |
| CDP/INT/04935 | 2026-06-17 | 131 | 163 |
| CDP/INT/04939 | 2026-06-18 | 87 | 111 |
| CDP/INT/04940 | 2026-06-20 | 104 | 156 |
| CDP/INT/04944 | 2026-06-27 | 143 | 230 |
| CDP/INT/05292 | 2026-06-27 | 3 | 73 |
| CDP/INT/05302 | 2026-06-27 | 46 | 64 |
| **TOTAL** | | **608** | **920** |

---

## Por Bin de Origen Correcto

Los articulos se agrupan por el bin donde Odoo tenia el stock antes de la transferencia CDP/INT.

### BIN: ALVEN/Output (49 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | WF-P103 | 1 | 0 |
| Ottoman Beige | FSV-CX820 | 2 | 0 |
| Cordoba Sillas De Comedor | NZ-DC1193/BR | 1 | 0 |
| Jowil Rx Arm Raw Sofa Col Biege | 12.0010.FSV | 1 | 0 |
| Terrazzo Rd Fiberstone Pot Plant Cream 112 X 112 X H 97 Cm | AN-52-04100-01-14 | 1 | 0 |
| Buffet Col White | WF-HB129A | 1 | 0 |
| Sq Fiberstone Pot Plant Grey 140 X 140 X H 82 Cm | AN-52-11000-01-03 | 1 | 0 |
| Sn-Venus | SN-VENUS | 1 | 0 |
| Bentley Berger Armchair | SEL-18.457 | 1 | 0 |
| Rd Fiberstone Pot Plain Grey 112 X 112 X H 97 Cm | AN-52-03300-01-03 | 1 | 0 |
| Mesa De Centro | RM-202-4 | 1 | 0 |
| Armchair Mallorca Ratan | 112.0001.BR | 1 | 0 |
| Volare Lounger Natural Rattan | ART-LOUN | 1 | 0 |
| Sillas Comedor | RM-901-9 | 1 | 0 |
| Arco Rug 350 X 250 Cm | LD-359817 | 1 | 0 |
| Mesa De Centro White | WF-SE130C | 1 | 0 |
| Night Stand White | NI-T138 | 1 | 0 |
| Set Sofa 2 Sillones Y Mesa | KB-MCGX7 | 1 | 0 |
| Mesa Lateral Acero Inoxidable 85X85X25H | FG-G25T03F | 1 | 0 |
| Stool Sandy Light Grey | NAH-T1526 | 1 | 0 |
| Mesa De Centro | RM-202-4 | 1 | 0 |
| Coffee Table | CF-ND-CT01 | 1 | 0 |
| Mesita Lateral Blanca | RU-GT037 | 1 | 0 |
| Herman Mesa Lateral Redonda | NAT-T156XHS | 1 | 0 |
| Mesa De Noche | CF-BR-TV006/ML | 1 | 0 |
| Rect Bench Col Lemon 185 X 40 X 45 Cm | AN-18700S114 | 1 | 0 |
| Sofa Modular | FSV-MS1003-ML+JL | 1 | 0 |
| Mesa Lateral Acero Inoxidable | FG-G25T02f | 1 | 0 |
| Round Fiberstone Pot Plant D 83 X H 71 Cm | AN-52-03300-S3-03S | 1 | 0 |
| Rhodes Sunlounger | ALC-AS5604B19TEX | 6 | 0 |
| Mesa Con Top De Walnut Oscuro 140X88X50H | CF-BR-TA-199 | 1 | 0 |
| Round Fiberstone Pot Plant D 98 X 98 X 84 H | AN-52-03300-S3-14M | 1 | 0 |
| Terrazo Sq Fiberstone Pot Grey 110 X 110 X H 92 Cm | AN-52-13800-01-03 | 2 | 0 |
| Side Table | CF-ND-CT03A | 1 | 0 |
| Meta-5575 | META-5575 | 1 | 0 |
| Dining Chair White | NI-XL3120 | 1 | 0 |
| Rd Fiberstone Pot Plain Grey 112 X 112 X H 97 Cm | AN-52-03300-01-03 | 1 | 0 |
| Dining Chair Small | SD-081D | 1 | 0 |
| Bohol Coffee Table Base Col Black | 12.0004.SN | 2 | 0 |
| Mesita De Noche En Madera 3 Gabetas 70X50X72 | TEMPO-107 | 1 | 0 |
| Buffet Col White | WF-HB129A | 1 | 0 |
| Alum Barstool | SA-MODBARALUWH | 1 | 0 |
| Cordoba Sillas De Comedor | NZ-DC1193/P | 1 | 0 |
| Terrazzo Rd Fiberstone Pot Plant Cream 112 X 112 X H 97 Cm | AN-52-04100-01-14 | 1 | 0 |
| Rd Fiberstone Pot Plant Cream 98 X 98 X H 85 Cm | AN-52-04100-02-14 | 1 | 0 |
| Mesita De Noche En Madera 3 Gabetas 70X50X72 | TEMPO-107 | 1 | 0 |
| Terrazzo Rd Fiberstone Pot Plant Cream 112 X 112 X H 97 Cm | AN-52-04100-01-14 | 1 | 0 |
| Oregon Sofa De Dos Puestos | NZ-SF1160/C2 | 1 | 0 |
| Queen Size Bed Upholstery | NI-CLO45 | 2 | 0 |

### BIN: ALVEN/Stock/A-CDP/PFRONTAL (39 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro Gris | WF-SE130C/G | 1 | 0 |
| Armchair Blue | SJ-FK-0731B | 2 | 0 |
| Silla De Comedor Maja Accent | LFC-CHAIR MAJA | 1 | 0 |
| Seccion De Mueble Tv 120X39X53 | TEMPO-136 | 1 | 0 |
| Mesa De Centro | GM-50026.0 | 1 | 0 |
| Silla En Fibra Naturalwegen Y Gray | BR-ASTONS/C | 1 | 0 |
| Armchair Col Grey | SJ-ZW1060/G | 1 | 0 |
| Sq Fiberstone Pot Plant Grey 90 X 90 X H 82 Cm | AN-52-13800-02-03 | 1 | 0 |
| Silla En Fibra Naturalwegen Y Gray | BR-ASTONS/C | 1 | 0 |
| Mesa De Centro | GM-91444.0 | 1 | 0 |
| Mesa De Centro Gris | WF-SE130C/G | 2 | 0 |
| Ottoman | FSV-S5630OT | 5 | 0 |
| Sillas De Comedor | PT-CC05 | 1 | 0 |
| Mesa De Centro Gris | WF-SE130C/G | 1 | 0 |
| Armchair W/ Withe + Black Stripes | TEMPO-067 | 2 | 0 |
| Mesa Lateral | GM-50066 | 2 | 0 |
| Tommy Butacas | VW-TOMMYB | 2 | 0 |
| Sq Fiberstone Pot Plant Grey 90 X 90 X H 82 Cm | AN-52-13800-02-03 | 1 | 0 |
| Patmos Night Stand Col Brown | DEM.0030.11 | 1 | 0 |
| Wood Bookshelf Brown | BH-Z8208 | 1 | 0 |
| Mesa Lateral | GM-50066 | 2 | 0 |
| Ottoman | FSV-S5630OT | 1 | 0 |
| Silla | HN-C6Z51-C-1/2 | 8 | 0 |
| Silla | HN-C6Z51-C-2/2 | 8 | 0 |
| Aura Butaca | NAT-291300388/88005204 | 2 | 0 |
| Hermione Rx Sofa Col Black | 22.0008.FSV | 2 | 0 |
| Monti Coffee Table Col Brown Ebony | 111.0038.JLC | 1 | 0 |
| Herman Mesa Lateral Redonda | NAT-T156VMS | 1 | 0 |
| Sq Fiberstone Pot Plant Grey 110 X 110 X H 70 Cm | AN-52-11000-02-03 | 1 | 0 |
| Mesa De Centro Gris | WF-SE130C/G | 1 | 0 |
| Sillas De Comedor | SG-DC073 | 1 | 0 |
| Ottoman | WF-S736E01/M | 1 | 0 |
| Coffee Table Extra Clear 42X42X42H | YS-CB001EC.42 | 1 | 0 |
| Coffee Table Extra Clear 42X42X42H | YS-CB001EC.42 | 1 | 0 |
| Coffee Table Extra Clear 42X42X42H | YS-CB001EC.42 | 1 | 0 |
| Coffee Table Extra Clear 42X42X42H | YS-CB001EC.42 | 4 | 0 |
| Side Table Clear | YS-CB159-1 | 3 | 4 |
| Silla | VS-VS07-263A | 2 | 0 |
| Silla | VS-VS07-263A | 2 | 0 |

### BIN: NAVE2/Existencias (37 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Silla | GM-03182.0 | 2 | 1 |
| Fu-Ftf1296/Ot | FU-FTF1296/OT | 1 | 1 |
| Ottoman En Tela Color Crema 112X60X29 | TEMPO-119 | 3 | 1 |
| White Dining Chair | TEMPO-044 | 2 | 1 |
| Saler Silla | GB-SAL-038-0194 | 1 | 1 |
| Porto 2-Seater Sofa | KN-SL003-2 | 2 | 1 |
| Leisure Chair Uphostery Chair With Solid Wood Leg | DEM-L13.VB145-11 | 1 | 3 |
| Blue Pana Armchair | FSV-C1109-2/A | 1 | 1 |
| Lounge Beige | SJ-FK-0731B/BE | 1 | 1 |
| Armchair Seat Col White + Beige Backrest | RM-8004-8 | 1 | 1 |
| Butaca Watson Love | KN-SL1051W | 1 | 1 |
| Sillas De Comedor Dresscode | ML-DC501COL1B21 | 1 | 1 |
| White Dining Chair | TEMPO-044 | 1 | 1 |
| Large Armchair Seat Col White + Beige Backrest | RM-8007-13 | 1 | 1 |
| Ottoman | FSV-CX820/L | 1 | 1 |
| Fu-Ftf1333/G | FU-FTF1333/G | 1 | 1 |
| Armchair White | KN-2040 | 1 | 1 |
| Chair | FSV-S6710 | 2 | 1 |
| Chair | WF-E131Y | 1 | 2 |
| Sofa 1570 X 1040 X 580 | SUL-SF012C-1/2 | 1 | 1 |
| Manhattan Sofa Central Module | ALC-AC5835N07ALU | 1 | 2 |
| Sillas De Comedor Carioca | CG-CGDC8-016 | 1 | 1 |
| Gaber Pouff Square | ALS-GAB505 | 2 | 2 |
| Philipp Pouff Corner Square | ALS-PHI504 | 1 | 5 |
| Silla | TW-DC1034/G | 2 | 1 |
| Dining Chair Brown | NI-XL3120/B | 1 | 2 |
| Pearl Armchair Leather Col White W/ Tacks | SJ-FK-0731/P | 1 | 1 |
| Ottoman | FSV-S6740/C | 1 | 5 |
| Chair | FSV-S6710 | 2 | 1 |
| Ottoman | FSV-S6740/C | 1 | 5 |
| Retro Pouff | SEL-18.466 | 1 | 2 |
| Chair | FSV-S6710 | 2 | 1 |
| Chair | FSV-S6710 | 3 | 1 |
| Armchair Col Cream | FSV-S6760/C | 1 | 1 |
| Sul-Sf122C | SUL-SF122C | 1 | 1 |
| Silla | FSV-MC1104/N | 1 | 1 |
| Sillas Blancas Con Tachuelas | NI-CF090W | 1 | 1 |

### BIN: ALVEN/Stock/B-STI (29 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cocktail Table | SI-TRAN105/W | 2 | 1 |
| Grey Resin Vase S | SUD-YH7108-3G | 4 | 1 |
| Grey Resin Vase S | SUD-YH7108-3G | 1 | 1 |
| Grey Resin Vase S | SUD-YH7108-3G | 1 | 1 |
| Terrazzo Sq Fiberstone Pot Plant Cream 46 X 46 X H 43 Cm | AN-52-27400-S4-14.S | 1 | 1 |
| Coffee Table Extra Clear 38X38X38H | YS-CB001EC.38 | 5 | 2 |
| Coffee Table Extra Clear 34X34X34H | YS-CB001EC.34 | 2 | 2 |
| Mueble Tv Blanco Y Negro | WF-S102 | 1 | 0 |
| Side Table | WF-P506B | 1 | 1 |
| Coffee Table Extra Clear 34X34X34H | YS-CB001EC.34 | 2 | 2 |
| Coffee Table Extra Clear 38X38X38H | YS-CB001EC.38 | 3 | 2 |
| Coffee Table Extra Clear 34X34X34H | YS-CB001EC.34 | 3 | 2 |
| Coffee Table Extra Clear 38X38X38H | YS-CB001EC.38 | 3 | 2 |
| Cocktail Table | SI-TRAN105/W | 1 | 1 |
| Side Table Concrete White | NAH-S1905 | 2 | 3 |
| Side Table Concrete White | NAH-S1905-01 | 2 | 3 |
| Tarro Rectangular En Acero Negro Medium 600 X 150 X | HK-HP520/B | 2 | 2 |
| Candle Holder Big | FH-F-BJ205 | 2 | 2 |
| Magazine Rack Extra Clear | YS-S058 | 1 | 2 |
| Coffee Table Extra Clear 34X34X34H | YS-CB001EC.34 | 5 | 2 |
| Coffee Table Extra Clear 38X38X38H | YS-CB001EC.38 | 5 | 2 |
| Magazine Rack Extra Clear | YS-S058 | 1 | 2 |
| Roosa Side Table | ART-RST | 1 | 3 |
| Magazine Rack Extra Clear | YS-S058 | 3 | 2 |
| Iron Plus Crystal, Silver Plating | ARD-RD9010-3 | 3 | 1 |
| Lampara De Techo Color Madera | MA-MD80160-1-800 | 4 | 1 |
| Lampara De Mesa | SU-676T | 2 | 1 |
| Cruz Corner | GD-HUC25232 | 1 | 0 |
| Lampara De Techo Color Madera | MA-MD80160-1-380 | 2 | 4 |

### BIN: ALVEN/Stock/C-Outlet 27 FEB (22 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Side Table | DR-CUSTWD | 1 | 1 |
| Acato Chair Col Grey Leather | STF-ARSE | 1 | 1 |
| Sillas De Comedor Solitaire Leather | ML-SO501N0L8C23 | 1 | 1 |
| Cape Town Sofa Center Module | ALC-AC5830E07ALU | 1 | 1 |
| Coffee Table | WF-E166A | 1 | 1 |
| Standing Vase 600 X 150 X 600 | HK-HP520 | 1 | 2 |
| Mesa De Centro | GY-ACT20-1 | 1 | 1 |
| Side Table | DR-CUSTWD | 1 | 1 |
| Rect Plant Pot 65 X 22 X 30 Crema | AN-05100S201/M | 3 | 3 |
| Cape Town Sofa Center Module | ALC-AC5830E07ALU | 1 | 1 |
| Taburete Blanco | RU-BC071 | 3 | 3 |
| Su-966S2 | SU-966S2 | 1 | 1 |
| Taburete Blanco | RU-BC071 | 1 | 3 |
| Taburete Blanco | RU-BC071 | 1 | 3 |
| Standing Vase 600 X 150 X 600 | HK-HP520 | 3 | 2 |
| Cape Town Sofa Center Module | ALC-AC5830E07ALU | 1 | 1 |
| Solitaire Coffee Table Col Brown 90.D | ML-SO308NBL7 | 1 | 1 |
| Lampara De Techo | SU-787S2 | 1 | 1 |
| Standing Vase 600 X 150 X 600 | HK-HP520 | 1 | 2 |
| Diamond Lampara Colgante | POL-300-450-025 | 3 | 4 |
| Lampara De Techo Color Madera | MA-MD80160-1-600 | 2 | 1 |
| Ottoman | SJ-ZW369/G | 2 | 1 |

### BIN: ALVEN/Stock/D-PTN/SHOWROOM (15 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Moonstone Sq Fiberstone Pot Plant 20 X 20 X H 20 Cm | AN-52-00600-S5-31S | 1 | 1 |
| Mesa De Centro | SMI-CM-317-GR | 2 | 2 |
| Silla Masters | KA-05849/XX | 1 | 1 |
| Sq Fiber Stone Plant Pot 33 X 33 X H 34 Cm | AN-17500S201/S | 1 | 1 |
| Vr-26768 | VR-26768 | 1 | 1 |
| Terrazzo Sq Fiberstone Pot Plant Cream 84 X 84 X H 60 Cm | AN-52-26300-02-14 | 1 | 1 |
| Round Plant Pot D 50 X H 100 Cm | AN-00800S201/L-BLK | 1 | 0 |
| Sq Fiber Stone Plant Pot 33 X 33 X H 34 Cm | AN-17500S201/S | 2 | 1 |
| Terrazo Coffee Table D50 Color Grey (Copia) | 111.0012.HGI | 1 | 1 |
| Sq Plain Plant Plot Cream 40 X 40 X H 40 Cm | AN-00600B414/L | 1 | 1 |
| Lampara De Mesa | IN-7301ZAM | 1 | 1 |
| Terrazo Coffee Table D50 Color Grey (Copia) | 111.0012.HGI | 1 | 1 |
| Círa Coffee Table Top White Marble | 112.0036.GVF | 1 | 1 |
| Círa Coffee Table Top White Marble | 122.0036.GVF | 1 | 2 |
| Sq Plain Plant Plot Cream 40 X 40 X H 40 Cm | AN-00600B414/L | 1 | 1 |

### BIN: Obsoleto/OE4 (10 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman White W/ Wood Legs | NI-CFH128P | 1 | 0 |
| Ottoman | WF-S736E01 | 1 | 0 |
| Velador | GM-50027.0 | 1 | 0 |
| Sq Side Table Walnut | CF-CZ-ST001 | 1 | 0 |
| Coffe Table Black And White Marble+Jazz, Top White | DEM-CANDY-2 | 1 | 0 |
| Ottoman White W/ Wood Legs | NI-CFH128P | 1 | 0 |
| Mesa De Centro | SMI-CM-317 | 2 | 0 |
| Ottoman | WF-S736E01 | 1 | 0 |
| Ottoman White W/ Wood Legs | NI-CFH128P | 1 | 0 |
| Ottoman White W/ Wood Legs | NI-CFH128P | 1 | 0 |

### BIN: Obsoleto/JG4 (9 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman Rectangular 109X59X34 Missoni | TEMPO-126 | 1 | 0 |
| Butaca Sin Espardar En Mimbre Color Natural 102X54X50 | TEMPO-125 | 1 | 0 |
| Mesita Lateral | RU-GT112 | 1 | 1 |
| Mesa Auxiliar | WF-E122M/W | 1 | 0 |
| Coffe Table | WF-P102C/W | 1 | 1 |
| Coffe Table | WF-P102C/W | 1 | 1 |
| Coffee Table | WF-HSE029C | 1 | 0 |
| Silla | SU-SC5225 | 1 | 0 |
| Ottoman Rectangular 109X59X34 Missoni | TEMPO-126 | 1 | 0 |

### BIN: Obsoleto/ME3 (8 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman | FSV-S6740-P | 1 | 0 |
| Ottoman | FSV-S6740-P | 1 | 0 |
| Ottoman | FSV-S6740-P | 1 | 0 |
| Ottoman | FSV-S6740-P | 1 | 0 |
| Four Seater Sofa | SJ-FK0725 | 1 | 0 |
| Tarro Pequeño Safari | IC-3721OD | 1 | 0 |
| Rest Butaca | V-53001 | 1 | 0 |
| Lampara De Pared | DK-701605 | 1 | 0 |

### BIN: Obsoleto/OD4 (7 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro En Mimbre Natural 186X72X50 | TEMPO-150 | 1 | 0 |
| Mesa Auxiliar Cuadrada | KB-AL003 | 1 | 0 |
| Mesa De Centro En Mimbre Natural 186X72X50 | TEMPO-150 | 1 | 0 |
| Wood Coffee Table | FC-S-CJ-015 | 1 | 0 |
| Sofa Lx Arm Col White | 11.0001.FSV | 1 | 0 |
| Mesa Lateral En Metal Con Tope De Marmol 30X30X63 | TEMPO-095 | 1 | 0 |
| Sofa Lx Arm Col White | 11.0001.FSV | 1 | 0 |

### BIN: Obsoleto/OG3 (6 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cordoba Sillas De Comedor | NZ-DC1193/PE | 1 | 0 |
| Moonstone Sq Fiberstone Pot Plant 30 X 30 X H 30 Cm | AN-52-00600-S5-31M | 1 | 1 |
| Sq Stone Fiber Plant Pot 33 X 33 X H 34 Cm | AN-17500S203/S-BK | 1 | 1 |
| Grace Mesa Lateral | NAT-T104MXS | 1 | 0 |
| Silla C/Tachuelas Y Botones Blanca | KN-XL2030 | 1 | 0 |
| Grace Mesa Lateral | NAT-T104MXS | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/HG1 (6 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Macetero En Forma De Cono Color Negro 160 Cm | N-EC4118BL-BLACK | 2 | 0 |
| Seaside Planter | N-EC4132EB | 1 | 0 |
| High Planter White | N-EC4132SG | 1 | 0 |
| Tarro Bajo Con Textura Ondulada 190.5Cm Blanco | N-EC4197-BLACK | 5 | 0 |
| Macetero Negro Alto | N-EC4132SG-BLACK | 6 | 0 |
| Macetero En Forma De Cono Color Negro 160 Cm | N-EC4118BL-BLACK | 1 | 0 |

### BIN: Obsoleto/PG4 (6 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| 6 Drawers & 2 Doors Cabinet Walnut | BH-H8242 | 1 | 0 |
| Mesa | BH-08002 | 1 | 0 |
| Vintage Cabinet W/ 3 Doors | BH-SH82006 | 1 | 0 |
| Wood Vintage Sideboard Brown | BH-Z82032 | 1 | 0 |
| 6 Drawers & 2 Doors Cabinet Walnut | BH-H8242 | 1 | 0 |
| Mesa | BH-08002 | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/KA4 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Jewellery Box | RG-LD4624 | 23 | 23 |
| Jewellery Box | RG-LD4622 | 30 | 30 |
| Jewellery Box | RG-LD4622-1 | 20 | 20 |
| Jewellery Box | RG-LD4624 | 1 | 23 |
| Jewellery Box | RG-LD4622-1 | 2 | 20 |

### BIN: Obsoleto/KC3 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Modulo Rx Gris | STL-ADS803-LR | 1 | 0 |
| Sofa | TEMPO-002 | 1 | 0 |
| Set Sofa 11 Pcs Y Mesa | KB-MCGX 4 | 1 | 0 |
| Mesa De Centro | KB-MB005033 | 1 | 0 |
| Dressing Stool Sovana | RVA-A289 | 1 | 0 |

### BIN: Obsoleto/LD5 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vintage Pouf | SEL-18.451.0 | 5 | 0 |
| Vintage Pouf | SEL-18.455.0 | 1 | 0 |
| Vintage Pouf | SEL-18.451.0 | 1 | 0 |
| Chest | CA-08493 | 1 | 0 |
| Lamp Col Black | IN-4424ALA | 1 | 0 |

### BIN: Obsoleto/LA5 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesas De Comedor | FW-DT134/L | 1 | 0 |
| Mesa De Centro | KB-AL011 | 3 | 2 |
| Mesa De Centro | KB-AL011 | 1 | 2 |
| Rect Fiber Stone Table Col White | AN-18500S103/M | 1 | 0 |
| Mesa De Centro | KB-AL011 | 1 | 2 |

### BIN: Obsoleto/NA4 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Dresscode Side Table Walnut | ML-DC304C0L1 | 1 | 0 |
| Upholstery Dining Chair Brown | NI-XL2035M | 2 | 0 |
| Hamilton Sillas De Comedor | NZ-DC1452/C | 2 | 0 |
| Credenza | TEMPO-311 | 1 | 0 |
| Dk-742582 | DK-742582 | 1 | 0 |

### BIN: Obsoleto/JC3 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Bases De Comedor | CF-BI-AT132 | 2 | 0 |
| Architect Sideboard | VM-M703G | 2 | 0 |
| Ottoman | IH-F9050N91 | 2 | 1 |
| Ottoman | IH-F9050N91 | 1 | 1 |
| Architect Sideboard | VM-M703G | 1 | 0 |

### BIN: ALVEN/Stock/D-PTN/PISO8 (5 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca En Mimbre Con Brazos | TEMPO-115 | 1 | 1 |
| Butaca En Mimbre Con Brazos | TEMPO-115 | 1 | 1 |
| Stool | SMI-CM-315 | 1 | 1 |
| Rd Fiberstone Pot Plain Grey Size 83 X 83 X 73H Cm | AN-52-04100-03-03 | 1 | 2 |
| Stool Transparente-Violeta | RU-PC093 | 1 | 3 |

### BIN: Obsoleto/NE4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa Walnut Oscuro Brilloso Con Bronce Pulido | CF-BR-TA-280B | 4 | 1 |
| Mesa Walnut Oscuro Brilloso Con Bronce Pulido | CF-BR-TA-280B | 1 | 1 |
| Mesa Walnut Oscuro Brilloso Con Bronce Pulido | CF-BR-TA-280B | 1 | 1 |
| Mesa Walnut Oscuro Brilloso Con Bronce Pulido | CF-BR-TA-280B | 3 | 1 |

### BIN: Obsoleto/LD4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman Color Gris 105X95X34 | TEMPO-117 | 1 | 0 |
| Ottoman Rectangular Color Negro 129X70X36 Ref. Fsv | TEMPO-114 | 1 | 0 |
| Ottoman Color Gris 103X79X35 Ref. Fsv | TEMPO-122 | 1 | 0 |
| Small Ottoman White | FSV-CX820.C | 1 | 0 |

### BIN: Obsoleto/KF4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca | 11.0001.JOR | 1 | 0 |
| Biplano Square Pouff Max | ALS-BIP505.PADOVA07 | 1 | 0 |
| Silla En Leather Crema Con Patas En Metal | TEMPO-085 | 1 | 0 |
| Ceiling Lamp | W-LP60491M-1 | 2 | 1 |

### BIN: Obsoleto/KD5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Stool | FSV-CX820M | 1 | 0 |
| Ceramic Vase Col Grey | SUD-YH7108-1G | 2 | 0 |
| White Resin Vase S | SUD-YH7108-3W | 2 | 0 |
| Su-1068W2 | SU-1068W2 | 1 | 3 |

### BIN: Obsoleto/LD3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Terrazzo Sq Fiberstone Pot Plant Cream 90 X 90 X H 60 Cm | AN-52-11000-03-14 | 1 | 0 |
| Base For Table Color Red | VS-VS08-464/R | 1 | 0 |
| Tv Stand/Kd With Walnut Veneer And Ash Solid Wood Frame B... | DEM-TS007 | 1 | 0 |
| Kali Dinning Chair | BD-BF7KL02 | 1 | 0 |

### BIN: Obsoleto/LE3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Stool Brown/White Leather | CCC-TTO-4 | 2 | 0 |
| Stool Brown/White Leather | CCC-TTO-4 | 2 | 0 |
| Stool Brown/White Leather | CCC-TTO-4 | 1 | 0 |
| Stool Brown/White Leather | CCC-TTO-4 | 1 | 0 |

### BIN: Obsoleto/NB5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Aparador Capiz | KB-MB005178/C | 1 | 0 |
| Rd Fiberstone Pot Plant 83 X 83 X 71 H | AN-52-03300-03-14 | 1 | 0 |
| Pantalla Lampara De Mesa Blanca | SU-969T1-1/2 | 4 | 6 |
| Base For Table Lamp | SU-969T1-2/2 | 3 | 6 |

### BIN: Obsoleto/LC5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tabitha Ottoman White | 211.0002.FG | 2 | 0 |
| Murano Ceiling Lamp | GM-19416.8 | 1 | 1 |
| Ceiling Lamp | W-A60499L | 1 | 0 |
| Shade For Melt Lamp Copper | TD-MES01CO | 2 | 0 |

### BIN: Obsoleto/ND4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Armchair Gray | SJ-FK-0731G | 1 | 0 |
| Sofa Rx Arm Mod Col White | 11.0002.FSV | 1 | 0 |
| Mesa De Centro | TEMPO-313 | 2 | 0 |
| Sofa Rx Arm Mod Col White | 11.0002.FSV | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/GD3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vintage Armchair Col Brown | TEMPO-011 | 1 | 0 |
| Armchair Col Black | WF-L129 | 1 | 0 |
| Armchair Col Black | WF-L129 | 1 | 0 |
| Armchair Col Black | WF-L129 | 1 | 0 |

### BIN: Obsoleto/OB4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesas De Comedor | SFG-CY-F029-40 | 1 | 1 |
| Mesas De Comedor | SFG-CY-F029-40 | 1 | 1 |
| Terrazo Sq Fiberstone Pot Plant Cream 110 X 110 X H 92 Cm | AN-52-13800-01-14 | 1 | 2 |
| Terrazo Sq Fiberstone Pot Plant Cream 110 X 110 X H 92 Cm | AN-52-13800-01-14 | 2 | 2 |

### BIN: ALVEN/Stock/A-CDP/ID4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sillas De Comedor En Walnut | CF-BR-CC-040 | 1 | 0 |
| Rect Standing Vase 60 X 15 X 43 Cm | 11.0001.HK | 2 | 1 |
| Sq Firestone Pot Plant Grey 58 X 58 X H 55 Cm | AN-52-27400-S4-03.M | 1 | 0 |
| Terrazzo Sq Fiberstone Pot Plant Cream 34 X 34 X H 32 Cm | AN-52-27400-S4-14.XS | 1 | 1 |

### BIN: Obsoleto/JE3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Metropolis Pouff Square | ALS-MET505 | 2 | 0 |
| Plant Pot Col White 45 X H 97 Cm | AN-80-00100-S1-01 | 1 | 0 |
| Metropolis Pouff Square | ALS-MET505 | 1 | 0 |
| Metropolis Pouff Square | ALS-MET505 | 1 | 0 |

### BIN: Obsoleto/JE2 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa Cx Mod Col Gris | WF-SF027-D01 | 1 | 0 |
| 2 Seater Rugby Sofa Mod Rx Col Ar | 111.0057.KDF | 1 | 0 |
| Sillon 106X95X68 | TEMPO-121 | 1 | 0 |
| Pana Armchair Col Light Purple 109 X 83 X 62 Cm | FSV-S6760/W | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/IA5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Grey Resin Vase | SUD-YH7108-2G | 1 | 0 |
| Grey Resin Vase | SUD-YH7108-2G | 3 | 0 |
| Lampara De Techo | CA-LS009773 | 1 | 3 |
| Ornament | IN-4207BAM | 1 | 0 |

### BIN: Obsoleto/OB5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Silla De Comedor Con Espaldar Capitoneado Color Verde | TW-DC1034/V | 1 | 0 |
| Tufted Armchair In Velvet | HSLC-689 | 1 | 0 |
| Sillas De Comedor | KN-XL3120 | 2 | 0 |
| Silla | TW-DC1122/C | 1 | 0 |

### BIN: Obsoleto/OE3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesita De Walnut Oscuro | CF-UB-TA005B | 1 | 1 |
| Mesita De Noche En Madera 3 Gabetas 39X30X75 | TEMPO-128 | 1 | 0 |
| Mesita De Noche En Madera 58X29X70 | TEMPO-161 | 1 | 1 |
| Tempo Footstool Leather Col Brown | TEMPO-145 | 1 | 0 |

### BIN: Obsoleto/NC4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Chair | DA-NUBIAB | 1 | 0 |
| Coffee Table | WF-SFF008-DK01 | 1 | 1 |
| Mampara Blanca | WF-8P020 | 1 | 0 |
| Aparador Athens | KB-MB005172 | 1 | 0 |

### BIN: Obsoleto/OF3 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro Cuadrada ..128X122X50H | TEMPO-135 | 1 | 0 |
| Mesita De Noche Blanca 100X100X75 | TEMPO-191 | 1 | 0 |
| Mesa De Centro Milano | KB-MB005092 | 2 | 0 |
| Coffee Table White | SL-686E | 1 | 0 |

### BIN: Obsoleto/NA5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cylinder Side Table Bronze | LP-2006-4143 | 1 | 0 |
| Rhodes Sunlounger | ALC-AS5604E19TEX | 7 | 5 |
| Sq Fiber Stone Plant Pot Col Pink H 100 X D 43 Cm | AN-00900S113 | 1 | 0 |
| Rhodes Sunlounger | ALC-AS5604E19TEX | 1 | 5 |

### BIN: Obsoleto/PF2 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | FSV-K3920 | 1 | 0 |
| Coffee Table Wenge | OP-CT011A | 1 | 0 |
| Mesa De Centro | FSV-K3920 | 1 | 0 |
| Silla Verde | RU-PC069 | 3 | 1 |

### BIN: ALVEN/Stock/A-CDP/HG4 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Stading Vase 500 | HK-HP512 | 4 | 1 |
| Sq Fiber Stone Plant Pot 33 X 33 X H 34 Cm | AN-17500S203/S | 4 | 2 |
| Stading Vase 500 | HK-HP512 | 1 | 1 |
| Sq Fiber Stone Plant Pot 33 X 33 X H 34 Cm | AN-17500S203/S | 1 | 2 |

### BIN: ALVEN/Stock/A-CDP/IE5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Su-1040W2 | SU-1040W2 | 2 | 2 |
| Lampara | W-EP60471M | 1 | 0 |
| W-A168061/3L | W-A168061/3L | 1 | 2 |
| W-Ep168051S | W-EP168051S | 2 | 2 |

### BIN: ALVEN/Stock/A-CDP/IB5 (4 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ceramic Vase | SUD-G9106-0XL | 4 | 0 |
| Ceramic Vase | SUD-G9106-1L | 2 | 0 |
| Zafacon Niquelado Mediano | SE-T289-M | 1 | 0 |
|  | ZS-304/240 | 2 | 2 |

### BIN: ALVEN/Stock/A-CDP/HC4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Antigua Armchair Col White + Green | SN-017 | 1 | 0 |
| Antigua Armchair Col White + Green | SN-017 | 1 | 0 |
| Sn-014 | SN-014 | 1 | 0 |

### BIN: Obsoleto/MC3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman | WF-S736E01/C | 1 | 0 |
| Ottoman | WF-S736E01/C | 1 | 0 |
| Ottoman | WF-S736E01/C | 1 | 0 |

### BIN: Obsoleto/JE4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Silla | GY-ADC10-1 | 1 | 0 |
| Silla Masters | KA-05869/15 | 1 | 0 |
| Bar Stool | TEMPO-257 | 1 | 0 |

### BIN: Obsoleto/LE5 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Escarlet Sideboard Col Brown | KB-MB005178 | 1 | 1 |
| Escarlet Sideboard Col Brown | KB-MB005178 | 1 | 1 |
| Lampara Colgante | JL-5795-8 | 1 | 0 |

### BIN: Obsoleto/JA5 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesas De Comedor | RM-106-7C | 1 | 0 |
| Mesas De Comedor | RM-106-7C | 1 | 0 |
| Armchair | SJ-ZW1061 | 1 | 0 |

### BIN: Obsoleto/MG4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Square Cement Fiber + Plastic Pot Plant 45 X 45 X H 97 Cm | AN-80-00100-01-01 | 1 | 0 |
| Sq Fiber Stone Plant Pot H 50 X D 37 Cm | AN-02500S202/M | 1 | 0 |
| Macetero Grande Cuadrado | HK-HP508 | 1 | 0 |

### BIN: Obsoleto/NG5 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vintage Armchair Col Green | TEMPO-021 | 1 | 0 |
| Velvet Armchair Col Green | WY-D81 | 1 | 0 |
| Mesa Auxiliar Scott | KN-SW801 | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/MB4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Paladio High Coffee Table Col Teak | 11.0010.JLC | 1 | 0 |
| Paladio Low Coffee Table Col Teak | 11.0011.JLC | 1 | 0 |
| Sofa 1570X1040X580 | SUL-SF012C-2/2 | 1 | 0 |

### BIN: Obsoleto/OB3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Dining Chair With Back Hole | SD-207C | 1 | 0 |
| Dining Chair With Back Hole | SD-207C | 1 | 0 |
| Azra Dining Chair | RV-DSC02 | 1 | 0 |

### BIN: Obsoleto/LF5 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca De Un Puesto Rah En Fibra Natural | CG-CGSS11-026 | 1 | 0 |
| Mesa De Centro Cuadrada | KB-AL002 | 2 | 1 |
| Mesa De Centro Cuadrada | KB-AL002 | 2 | 1 |

### BIN: Obsoleto/MB3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Round Coffee Table Brown | KD-2420-5 | 1 | 0 |
| Spun Table Short Brass | TD-SUT01B | 1 | 0 |
| Gray Armchair | SJ-ZW1018/G | 1 | 0 |

### BIN: Obsoleto/KD3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| White Resin Vase | SUD-YH7108-1W | 2 | 0 |
| White Resin Vase | SUD-YH7108-1W | 1 | 0 |
| White Resin Vase | SUD-YH7108-1W | 1 | 0 |

### BIN: Obsoleto/ME4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Aspen Coffee Table White | ALS-ASP600WHITE | 1 | 0 |
| Aspen Coffee Table White | ALS-ASP600WHITE | 2 | 0 |
| Aspen Coffee Table White | ALS-ASP600WHITE | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/HB4 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | RM-201-4 | 1 | 0 |
| Mesa De Centro | RM-201-4 | 1 | 0 |
| Mesa De Centro | RM-201-4 | 1 | 0 |

### BIN: Obsoleto/OC2 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa | SUL-SF012C | 1 | 0 |
| Coffee Table | WF-E154 | 1 | 0 |
| Fa-G4810H | FA-G4810H | 1 | 0 |

### BIN: Obsoleto/KB5 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| He-Mf1968 | HE-MF1968 | 1 | 1 |
| Mirror | DA-ZAC/AW | 2 | 1 |
| High Side Table Brown | FSV-MT1201-B | 1 | 0 |

### BIN: Obsoleto/OD3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Coffee Table Brown | OP-CT023A-12 | 1 | 0 |
| Mesa De Noche | GY-KEC03 | 3 | 1 |
| Mesa Rectangular 125X71X49 H..Color Negro | TEMPO-267 | 1 | 0 |

### BIN: Obsoleto/LE1 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Kaia Coffee Table Base | 133.0011.GVF | 1 | 0 |
| Kaia Coffee Table Marble Top Color Black | 123.0011.GVF | 1 | 0 |
| Kaia Coffee Table Marble Top Color White | 113.0011.GVF | 1 | 0 |

### BIN: Obsoleto/ND3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Wind Macetero De Resina | PC-PH56689 | 1 | 0 |
| Pedestal 40 X 40 X H120 Cm | TEMPO-237 | 1 | 0 |
| Diabola Mesa | POL-300-225-013 | 1 | 0 |

### BIN: ALVEN/Stock/D-PTN/DESPACHO PTN (P-2) (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Albury Coffee Table In Concrete Grey | 111.0017.HGI | 1 | 0 |
| Albury Coffee Table In Concrete Grey | 111.0017.HGI | 1 | 0 |
| Albury Coffee Table In Concrete Grey | 111.0017.HGI | 1 | 0 |

### BIN: Obsoleto/PG3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman Color Naranja 56X66X43.. | TEMPO-146 | 1 | 0 |
| Ottoman Color Naranja 56X66X43.. | TEMPO-146 | 1 | 0 |
| Gavetero | GY-ANT28 | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/FE3 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Lobby Candelabro | POL-390-225-079 | 1 | 0 |
| Table Lamp | TC-330-18-009-BRASS | 1 | 0 |
| Wood Ornament | IN-4301PAM | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/LD2 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Terrazo Coffee Table D50 Top Color Grey (Copia) | 122.0010.HGI | 3 | 2 |
| Terrazo Coffee Table D70 Color Grey (Copia) | 112.0010.HGI | 1 | 2 |
| Terrazo Coffee Table D70 Color Grey (Copia) | 112.0010.HGI | 4 | 2 |

### BIN: Obsoleto/LF1 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | STL-BFJ5052A-2/3 | 3 | 0 |
| Mesa De Centro | STL-BFJ5052A-1/3 | 3 | 0 |
| Mesa De Centro | STL-BFJ5052A-3/3 | 3 | 0 |

### BIN: Obsoleto/ME2 (3 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa Cama De 2 Puestos Leather 97X162X37 | TEMPO-271 | 1 | 0 |
| Ih-F9798240 | IH-F9798240 | 1 | 0 |
| Couch With Armrest | FSV-S8909 | 1 | 0 |

### BIN: Obsoleto/JB5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro De Walnut Brilloso Y Bronce | CF-BR-TA-280A | 2 | 1 |
| Stool | FSV-S5610 | 2 | 0 |

### BIN: Obsoleto/JB3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Silla Con Tela | CF-BR-RC-033 | 1 | 0 |
| Credenza | KB-MB00517 | 1 | 0 |

### BIN: Obsoleto/LB3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa Lx Mod Col Beige | WF-SF027-C01L | 1 | 0 |
| Amora 2-Seater Sofa Grey | YU-F079-2 | 1 | 0 |

### BIN: Obsoleto/JC4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Dining Chair | SF-DU14 | 1 | 0 |
| Dining Chair Brown | KN-XL2035 | 1 | 0 |

### BIN: MONTIBELLO NACO (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sillas De Comedor | SFG-CY-G022-40 | 1 | 1 |
| W-P168051M | W-P168051M | 1 | 4 |

### BIN: Obsoleto/LD1 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Gabetero 7 Gabetas Marron Oscuro 173X50 | TEMPO-064 | 1 | 0 |
| Table | BH-H8230 | 1 | 1 |

### BIN: Obsoleto/LB1 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Buffet 160 X 50 X 85 Cm | CF-BR-SA026 | 1 | 0 |
| 3-Seater Sofa Grey | YU-F079-3 | 1 | 0 |

### BIN: Obsoleto/MB5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| 2 Door Cabinet | BH-08003 | 1 | 0 |
| Corner Mod Sofa Col Beige | 11.0004.FSV | 1 | 1 |

### BIN: Obsoleto/KG3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Jol-19011740 | JOL-19011740 | 1 | 1 |
| Mesa De Ketall Pequena | K-MESAP | 1 | 0 |

### BIN: DIF.PTN (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Platani Hocker Lavabo | ES-HCSF110TL-WH | 3 | 1 |
| Rd Sandstone Pot Col White W/ Wood Leg 37 X 37 X H 86 Cm | AN-62-23009-S2-07.S | 1 | 1 |

### BIN: Obsoleto/MC4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cordoba Sillas De Comedor | NZ-DC1193NLN | 1 | 0 |
| Doblez Side | DA-DOBLEZ | 1 | 0 |

### BIN: Obsoleto/MD3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Rd Fiberstone Pot Plant Cream 112 X 112 X H 97 Cm | AN-52-03300-01-14 | 1 | 0 |
| Rd Fiberstone Pot Plant Cream 112 X 112 X H 97 Cm | AN-52-03300-01-14 | 1 | 0 |

### BIN: Obsoleto/KG5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tarro Alto Safari | IC-2439OD | 2 | 0 |
| Mesita Niquelada | SE-T318 | 1 | 3 |

### BIN: ALVEN/Stock/D-PTN/PATIO (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Rd Fiberstone Pot Plain 98 X 98 X H 85 Cm | AN-52-03300-02-03 | 1 | 3 |
| Terrazzo Sq Fiberstone Pot Plant Cream 50 X 50 X H 48 Cm | AN-52-13800-04-14 | 1 | 1 |

### BIN: Obsoleto/OG5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca Watson Love | KN-SL1051C | 1 | 0 |
| Pendant Ottoman | OC-10265-FSC2 | 1 | 0 |

### BIN: Obsoleto/JG5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Red Basket | OC-40461-LC | 1 | 0 |
| Brass Plus White Clothshade Plus Glass Silver | ARD-RB9046-1 | 4 | 0 |

### BIN: Obsoleto/NG4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Chaise Lounge Con Brazos Sin Espardar Color Azul Turqueza... | TEMPO-292 | 1 | 0 |
| Vw-Sawa/3 | VW-SAWA/3 | 1 | 0 |

### BIN: Obsoleto/PF3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vr-26747 | VR-26747 | 1 | 1 |
| Console | CF-BR-XC-006 | 1 | 0 |

### BIN: Obsoleto/LG4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Taburete Bitta | K-70300410 | 1 | 0 |
| Macetero | AC-A104177 | 1 | 0 |

### BIN: Obsoleto/KF3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Armless Loungue | GD-HUC25231 | 1 | 0 |
| Armless Loungue | GD-HUC25231 | 3 | 0 |

### BIN: Obsoleto/NA2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro Cuadrada | GM-50076.0 | 1 | 0 |
| Andalucia Coffee Table | ALC-AT5786N23 | 1 | 0 |

### BIN: Obsoleto/NE3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Modesto Butaca | NZ-CC1385/B | 1 | 0 |
| Capitonado Ottoman Beige | YU-CF079S | 1 | 0 |

### BIN: ALVEN/Stock/D-PTN/DEVOLUCION (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Diatom Varnished Small Armchair. | MOR-00DT001F.0003 | 2 | 0 |
| Diatom Varnished Small Armchair. | MOR-00DT001F.0004 | 1 | 0 |

### BIN: Obsoleto/NF4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Viavai Mesa De Centro | NAT-T133MS3 | 1 | 1 |
| Viavai Mesa De Centro | NAT-T133MS3 | 1 | 1 |

### BIN: Obsoleto/LA2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Jowil Lx Arm Sofa Col Beige | 12.0011.FSV | 1 | 1 |
| 4 Seater Sofa Mustard | SJ-FK0725M | 1 | 0 |

### BIN: Obsoleto/PE3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Chainlonge | TEMPO-327 | 1 | 0 |
| 3 Drawers Chest Dark Walnut | BH-Z82003 | 1 | 0 |

### BIN: Obsoleto/NB4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesita De Noche | GM-50130.0 | 1 | 0 |
| Mesa De Centro Atollo Twin | CAI-52013207 | 1 | 0 |

### BIN: Obsoleto/OA3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Noche Suzy | IC-CUSTOM/M | 1 | 0 |
| Nh | TEMPO-253 | 1 | 1 |

### BIN: ALVEN/Stock/C-Outlet (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman | WF-SFF008-E01 | 1 | 0 |
| Mediterranean Sunlounger With Arms & Wheels | ALC-AS5602N61 | 2 | 0 |

### BIN: Obsoleto/LF3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman En Leather Color Marron 100X100X38 | TEMPO-124 | 1 | 0 |
| Sn-Hc166X166X27 | SN-HC166X166X27 | 1 | 0 |

### BIN: Obsoleto/PG1 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| 3 Doors Buffet Light Brown | BH-08030 | 1 | 0 |
| 3 Doors Buffet Light Brown | BH-08030 | 1 | 0 |

### BIN: Obsoleto/JF2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | RM-8008-4 | 3 | 1 |
| Pony Leather Armchair | YF-A22-35 | 1 | 0 |

### BIN: Obsoleto/KE4 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tw-Bs1079 | TW-BS1079 | 1 | 1 |
| Tw-Bs1079 | TW-BS1079 | 1 | 1 |

### BIN: Obsoleto/MF5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Wood Chaise Longue W/ Stainless Steel Frame | FG-G27C12f | 1 | 0 |
| Mesa Lateral | GM-91530.0 | 1 | 0 |

### BIN: Obsoleto/KG2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca Pigalle | IC-3829OD-URF | 1 | 0 |
| Retro One Armchair | SEL-18.464.1 | 1 | 0 |

### BIN: ALVEN/Stock/D-PTN/FRENTE (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Messina Fountain Medium | AE-FM70 | 1 | 2 |
| Sq Fiberstone Pot Plant Grey 70 X 70 X H 62 Cm | AN-52-13800-03-03 | 1 | 2 |

### BIN: Obsoleto/MG3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Rd Sandstone Pot Col White W/ Wood Leg 40 X 40 X H 97 Cm | AN-62-23009-S2-07.L | 1 | 2 |
| Rest Coffee Table | V-53009 | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/HC3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Zafacon Niquelado Grande | SE-T289-L | 2 | 2 |
| Zafacon Niquelado Grande | SE-T289-L | 3 | 2 |

### BIN: Obsoleto/KC5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Zs-250C | ZS-250C | 1 | 2 |
| Sq Cement Fiber Candle Holder W/ Glass Frame 31X31Xh78 Cm | AN-80-07200-S1-02 | 1 | 1 |

### BIN: Obsoleto/NG2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa De 4 Puesto | SAWADEE-01 | 2 | 0 |
| Three Chaise R Sofa Col Grey | 133.0196.DEM | 1 | 0 |

### BIN: Obsoleto/LB5 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tulipa Table Lamp | ADC-S1121 | 2 | 4 |
| Hercules Table Lamp | VL-21027003 | 1 | 1 |

### BIN: Obsoleto/PE2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa Lx Mod White | IH-F9050410 | 1 | 0 |
| Ls-25033F | LS-25033F | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/HA2 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Harlow Ii Side Table Black Top | 222.0113.DEM | 1 | 2 |
| Harlow Ii Side Table Base Black | 212.0113.DEM | 1 | 2 |

### BIN: Obsoleto/NB3 (2 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Floor Lamp | DV-1280R | 1 | 0 |
| Floor Lamp Black | GM-19248 | 1 | 0 |

### BIN: Obsoleto/JF4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Blina Mesa De Centro | RS-TA276/WD | 1 | 0 |

### BIN: Obsoleto/PB2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vr-26754 | VR-26754 | 1 | 2 |

### BIN: ALVEN/Stock/A-CDP/DA3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mugello Coffee Table Col Teak | 111.0006.YC | 1 | 1 |

### BIN: Obsoleto/JD4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Stool | SN-BF88X64X37 | 2 | 0 |

### BIN: Obsoleto/JG3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Room Chair | CF-BR-RC031 | 2 | 0 |

### BIN: Obsoleto/ME1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Chaiselongue Bilbao En Madera Color Blanco 250X120X61 | SN-BILBAO-W | 1 | 0 |

### BIN: Obsoleto/MB1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| 4 Door Cabinet | BH-08041 | 1 | 0 |

### BIN: Obsoleto/NE1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Noche | GY-KNT03 | 1 | 2 |

### BIN: Obsoleto/MA2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesas De Comedor | CF-BR-AT035/M | 1 | 0 |

### BIN: Obsoleto/MD2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Bahia Armchair Wood + Fiber | SN-BAHIA | 2 | 0 |

### BIN: Obsoleto/LA4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca Lyon | KN-SL1159 | 1 | 1 |

### BIN: Obsoleto/NG1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Terrazzo Sq Fiberstone Pot Plant Cream 140 X 140 X H 82 Cm | AN-52-11000-01-14 | 1 | 0 |

### BIN: Obsoleto/KA2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Round Fiberstone Pot Plant D 112 X 112 X 97 H Cm | AN-52-03300-S3-03L | 1 | 0 |

### BIN: MICHELL II (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman Brown | FSV-S5608M | 1 | 1 |

### BIN: Obsoleto/MC5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Duffy - Small Table Anthracite | BON-TD35AN | 1 | 0 |

### BIN: Obsoleto/LF4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Veronique Pouff | ALS-VER505 | 4 | 0 |

### BIN: Obsoleto/JE5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesas De Comedor | RM-106-7L | 2 | 0 |

### BIN: Obsoleto/KE3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Feel Good Chaise Longue | ALS-FLG426 | 1 | 0 |

### BIN: Obsoleto/MD4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Footstool Rattan | RM-120-14 | 1 | 0 |

### BIN: Obsoleto/LG5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| I4-Attitude/Cl | I4-ATTITUDE/CL | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/KC2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Silla | TW-AC1065/W | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/ID5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Round Fiberstone Plain Grey D61 X 140 Cm | AN-52-43800-S2-03M | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/JA3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Coffee Table | WF-SFF008-DK01-01 | 1 | 0 |

### BIN: Obsoleto/KA5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Base For Table Color Black | VS-VS08-464/B | 1 | 0 |

### BIN: Obsoleto/KE5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Soho Sillon Reclinable Leather | NZ-CC1475/C | 1 | 0 |

### BIN: Obsoleto/PC3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sillon En Mimbre | TEMPO-075 | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/KA1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Boss Square Base | RS-TA199/SQ | 1 | 0 |

### BIN: Obsoleto/OA4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Rest Tumbona | V-53008 | 2 | 0 |

### BIN: Obsoleto/OC3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sofa Modular Pieza Central Blanco 152X101X37 Referencia Wf | FSV-5611/C | 1 | 0 |

### BIN: Obsoleto/OE5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Jowil Lx Arm Sofa Corduroy Col Beige | 12.0009.FSV | 1 | 1 |

### BIN: Obsoleto/PB4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Rayn Left Module Color Salina | DED-00078005085 | 1 | 0 |

### BIN: Obsoleto/JD5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Coffee Table | WF-E181 | 1 | 1 |

### BIN: Obsoleto/LB4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sq Fiberstone Pot Plant Moonstone 40 X 40 X H 40 Cm | AN-52-00600-S5-31L | 1 | 0 |

### BIN: Obsoleto/LA1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Buffet/Kd White Jazz Marble Top | DEM-BU1906 | 1 | 0 |

### BIN: Obsoleto/JC5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Pana Armchair Col Beige | FSV-CC3011-3/C | 1 | 0 |

### BIN: Obsoleto/KG1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Melgru Chaise Lounge Col Beige | 12.0001.NI | 1 | 0 |

### BIN: Obsoleto/NE2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Secret Love Coffee Table Black Pearl W/ Gold Frame | 11.0015.ML | 1 | 1 |

### BIN: Obsoleto/MG5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| High Round Plant Pot Col Cream D 47 X H 100 Cm | AN-04300S214 | 1 | 0 |

### BIN: Obsoleto/NA3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Taburete Sotsass | KA-08853/09 | 1 | 1 |

### BIN: Obsoleto/MF4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Terrazzo Sq Fiberstone Pot Plant Cream 110 X 110 X H 70 Cm | AN-52-11000-02-14 | 1 | 0 |

### BIN: Obsoleto/QC3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cheslong De Playa | META-2362 | 7 | 0 |

### BIN: Obsoleto/PD3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Buffet Lacqued Col Off White | CF-CZ-BS-1501B | 1 | 0 |

### BIN: Obsoleto/PA2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sillas Con Brazos Bellevou | CHI-AFLPN6 | 3 | 0 |

### BIN: Obsoleto/MD5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Micaela Dining Chair Rattan + Walnut W/ Cushion Col Light... | 10.0028.DEM | 3 | 1 |

### BIN: Obsoleto/PC2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sunny Day Cocktall Table | OC-10297-CKC1 | 3 | 0 |

### BIN: Obsoleto/JG2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tempo-003 | TEMPO-003 | 1 | 0 |

### BIN: Obsoleto/PD4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Chair | IH-F9771114 | 1 | 0 |

### BIN: Obsoleto/OE1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Night Stand Off White | CF-CZ-NS001/S | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/GE3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Kubika Mesa De Noche | NAT-W01005503040505 | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/DC6 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Oakland Mesa De Centro | NZ-CT1374/C | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/HE4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ottoman | SUL-SF01157JT | 3 | 0 |

### BIN: ALVEN/Stock/A-CDP/FD4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesita De Noche | CF-CZ-NS003A | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/GB4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Alum Ottoman | SA-MODOALUWH | 2 | 0 |

### BIN: ALVEN/Stock/A-CDP/GA3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Piera Coffee Table Top Color Black | 112.0280.DEM | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/FD5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Sn-013 Coffe Table Peq | SN-013 | 1 | 0 |

### BIN: Obsoleto/PA4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Mesa De Centro | VS-VS08-375/B | 1 | 0 |

### BIN: Obsoleto/NC5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Lampara De Mesa , ..Color Verde Y Dorado Base Metal Y Crs... | KD-FS104-1041-UL | 8 | 15 |

### BIN: ALVEN/Stock/A-CDP/GA4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Su-1064S2 | SU-1064S2 | 1 | 1 |

### BIN: Obsoleto/NF1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Cama King | CF-BR-BG003/GL | 3 | 0 |

### BIN: Obsoleto/KC1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Hermione Lx Sofa Col Black | 12.0008.FSV | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/IA4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Lampara De Mesa Take | KA-U9050/Q6 | 1 | 1 |

### BIN: Obsoleto/MA3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Tall Side Table Smoke Matt Titanium | DEM-MS-9117A | 1 | 0 |

### BIN: ALVEN/Stock/D-PTN/REJA (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Footstool Blue | WF-FM509OLM076-40 | 1 | 1 |

### BIN: ALVEN/Stock/A-CDP/IG5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Ornament Large Col Bronze | FH-F-BJ166 | 1 | 3 |

### BIN: Obsoleto/NF5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| W-Ep168037S | W-EP168037S | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/EC3 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Vela Coffee Table Col White | V.0008.11 | 1 | 1 |

### BIN: MONTIBELLO PTN (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Bench | CF-CZ-CH-003/G | 1 | 1 |

### BIN: Obsoleto/JF5 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Evergreen Floor Lamp | ALS-CODEVERG620 | 2 | 0 |

### BIN: Obsoleto/KG4 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Butaca Swimg | JM-112372 | 1 | 0 |

### BIN: Obsoleto/ND1 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Daybed | SN-JAVA/F | 1 | 0 |

### BIN: ALVEN/Stock/A-CDP/CG2 (1 articulos)

| Nombre | Codigo de barras | Qty transferida a AA1 | Existencia actual en bin |
|--------|-----------------|----------------------|--------------------------|
| Hamilton Lx Open End Sofa Col Beige | 33.0015.MI | 1 | 1 |

---

**Notas metodologicas:**
- Consultas ejecutadas 2026-06-30 via JSONRPC (uid 98, altritempi.odoo.com).
- Modelos: stock.move.line (state=done), stock.quant, product.product (barcode).
- Ubicaciones A-CDP (101 bins incluyendo sub-bins) y Obsoleto/AA1 (id=55) excluidas de la busqueda del bin correcto.
- Ubicacion virtual id=697 (Devoluciones sistema anterior) excluida.
- lastEntry: ultimo movimiento de entrada a ubicacion interna (state=done) con fecha < 2026-06-16.
- Si un producto tenia quant activo Y lastEntry, se prioriza el quant activo (estado actual del inventario).