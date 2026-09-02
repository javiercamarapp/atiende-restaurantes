# Menú real — Los Taquitos de PM, sucursal Fco. de Montejo

Fuente: https://www.lostaquitosdepm.com/menufranciscodemontejo — transcrito el 2026-09-02.
Precios en pesos mexicanos (MXN). Este documento es la base de conocimiento del agente de voz
(subir como Knowledge Base en ElevenLabs Conversational AI).

## Reglas generales que el agente debe conocer

- **Formas de pago**: tarjeta de crédito/débito o pago contra entrega. Para pagar con tarjeta a domicilio hay que pedir la terminal al hacer el pedido — pregúntale al cliente si la necesita.
- **Tiempo de entrega**: 40 a 50 minutos. Si está lloviendo, avisa que puede tardar de 1 hora a 1 hora 20 minutos.
- **Salsas y tortillas extra**: las que ya vienen incluidas en cada platillo son gratis; si el cliente pide MÁS de las incluidas, tiene costo extra (ver categoría "Guarniciones Extra").
- **Promociones (2x1 tacos al pastor los lunes, nachos+aguas los martes)**: SOLO aplican para comer en el restaurante (dine-in), en las sucursales Francisco de Montejo, Pensiones y Plaza Galerías, en horario de apertura a cierre. **NO son válidas para pedidos a domicilio ni por teléfono.** No las ofrezcas en una llamada que es para domicilio.
- **Platillos PM**: todos incluyen tortillas, frijoles charros, cebolla (carbolla), guacamole con tostadas y ensalada de tomate y lechuga — EXCEPTO los marcados con (*) en este documento (crujientes, poc-chuc, fajitas, parrilladas), que no incluyen esas guarniciones.
- **Kilos a domicilio**: cada kilo incluye salsa roja, salsa verde, limones y tortillas sin costo extra. Se puede pedir en fracciones de 250g, 500g, 750g o el kilo completo — el precio ya está calculado abajo, no hay que hacer la cuenta en la llamada.
- **Disponibilidad varía por sucursal**: por ejemplo, cochinita pibil solo se ofrece en Prolongación Montejo, Victory Plätz y Altabrisa — no está en el menú de esta sucursal (Fco. de Montejo). Si el cliente pide algo que no está en este menú, dile que no está disponible en esta sucursal en vez de inventar un precio.
- **"Tacos al Pastor" en orden de 3**: el menú fotografiado no lista un precio de paquete para 3 tacos de pastor (solo el individual a $42). Si el cliente pide 3, cóbralos como 3 individuales ($126) y confírmalo — no hay un precio de bundle especial documentado para este caso.
- **Reclamos**: si el pedido llegó mal, decirle al cliente que se comunique de nuevo a esta misma sucursal.
- **Alcohol**: el menú incluye cervezas, licores y cocktails. Antes de agregar bebidas alcohólicas a un pedido a domicilio, confirma verbalmente que quien recibe el pedido es mayor de edad — no lo asumas.

## Sucursal, contacto y redes (para el agente y para el sitio)

- **Sucursal**: Francisco de Montejo — Calle 50 esquina x 53-B, Fracc. Francisco de Montejo, Mérida, Yucatán.
- **Teléfono de la sucursal**: 999 953 7122.
- **Horario de apertura/cierre**: NO está publicado en el sitio web. No lo inventes — si preguntan, di que no tienes el dato confirmado y que llamen para confirmar, o consíguelo directamente con el restaurante antes del demo.
- **Redes sociales (de toda la cadena, no solo esta sucursal)**: Facebook facebook.com/lostaquitosdepm — Instagram instagram.com/taquitosdepm. No se encontró TikTok ni cuenta de X/Twitter en el sitio.
- **Ubicación en mapa**: el sitio no tiene un enlace de Google Maps embebido por sucursal. Las coordenadas de esta sucursal (21.0350, -89.6050) ya estaban en el código (`Header.tsx`) para calcular "sucursal más cercana"; están aproximadas, no confirmadas contra el listado oficial de Google Business — verificar antes de usarlas como el pin oficial en un mapa de cliente.
- **Las 7 sucursales de la cadena**: Altabrisa, García Lavín, Prol. Montejo, Fco. de Montejo (esta), Galerías, Chicxulub, Pensiones — cada una tiene su propio teléfono real (ver tabla `branches` en Supabase, migración `20260902000000_branches_and_order_source.sql`).

## Catálogo

### Tacos

- **Taco Al Pastor (individual)**: $42 ⭐ — Orden individual
- **Taco de Rajas (individual)**: $37 — Orden individual
- **Taco de Champiñones (individual)**: $38 — Orden individual
- **Tacos de Chorizo (orden de 3)**: $150 — Orden de 3 tacos
- **Tacos de Bistec de Res (orden de 3)**: $194 — Orden de 3 tacos
- **Tacos de Pechuga de Pollo (orden de 3)**: $184 — Orden de 3 tacos
- **Tacos de Chuleta de Cerdo (orden de 3)**: $184 — Orden de 3 tacos
- **Tacos de Costilla de Res (orden de 3)**: $189 — Orden de 3 tacos
- **Tacos de Arrachera (orden de 3)**: $254 — Orden de 3 tacos
- **Tacos de Poc-Chuc (orden de 3)**: $189 — Orden de 3 tacos
- **Tacos de Bistec Encebollado (orden de 3)**: $202 — Orden de 3 tacos

### Gringas

- **Gringa de Pastor**: $194 — Orden de 2 tacos
- **Gringa de Bistec**: $224 — Orden de 2 tacos
- **Gringa de Pechuga de Pollo**: $212 — Orden de 2 tacos
- **Gringa de Chuleta**: $212 — Orden de 2 tacos
- **Gringa de Costilla**: $217 — Orden de 2 tacos
- **Gringa de Arrachera**: $299 — Orden de 2 tacos
- **Gringa de Poc-Chuc**: $217 — Orden de 2 tacos

### Mestizas

- **Mestiza de Pastor**: $168 — Orden de 2 tacos
- **Mestiza de Poc-Chuc**: $175 — Orden de 2 tacos
- **Mestiza de Bistec**: $194 — Orden de 2 tacos
- **Mestiza de Pechuga**: $184 — Orden de 2 tacos
- **Mestiza de Chuleta**: $184 — Orden de 2 tacos
- **Mestiza de Costilla**: $189 — Orden de 2 tacos
- **Mestiza de Arrachera**: $269 — Orden de 2 tacos

### Alambre

- **Alambre de Pastor**: $276 — Orden de 5 tacos
- **Alambre de Bistec**: $283 — Orden de 5 tacos
- **Alambre de Pechuga**: $269 — Orden de 5 tacos
- **Alambre de Chuleta**: $269 — Orden de 5 tacos
- **Alambre de Costilla**: $276 — Orden de 5 tacos
- **Alambre de Arrachera**: $343 — Orden de 5 tacos

### Tacos Suizos

- **Suizo de Pastor**: $247 — Orden de 5 tacos
- **Suizo de Bistec**: $291 — Orden de 5 tacos
- **Suizo de Chuleta**: $284 — Orden de 5 tacos
- **Suizo de Pechuga**: $284 — Orden de 5 tacos
- **Suizo de Costilla**: $284 — Orden de 5 tacos
- **Suizo de Arrachera**: $373 — Orden de 5 tacos
- **Suizo de Poc-Chuc**: $284 — Orden de 5 tacos
- **Suizo de Chorizo**: $209 — Orden de 5 tacos
- **Suizo de Chile Poblano**: $204 — Orden de 5 tacos
- **Alambre Suizo de Pastor**: $306
- **Alambre Suizo de Bistec**: $314
- **Alambre Suizo de Pechuga**: $306
- **Alambre Suizo de Chuleta**: $306
- **Alambre Suizo de Costilla**: $306
- **Alambre Suizo de Arrachera**: $371
- **Tacos Suizos de Chile Poblano y Bistec**: $328
- **Tacos Suizos de Chile Poblano y Arrachera**: $378

### Boyo-Hamburguesas

- **Boyo-Hamburguesa Sencilla**: $194
- **Boyo-Hamburguesa con Queso**: $224
- **Boyo-Hamburguesa con Queso y Tocino**: $238

### Chetacos

- **Chetaco de Pastor**: $291 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Champiñón**: $306 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Bistec de Res**: $314 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Chuleta de Cerdo**: $306 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Pechuga**: $306 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Costilla de Res**: $306 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Poc-Chuc**: $306 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate
- **Chetaco de Arrachera**: $373 — Tortilla de harina extra grande con frijol, queso, champiñones y carne; con ensalada de lechuga y tomate

### Papas de PM

- **Papa Tradicional**: $204 — Papa rellena
- **Papa Pastor**: $262 — Papa rellena
- **Papa Bistec**: $283 — Papa rellena
- **Papa Chuleta**: $276 — Papa rellena
- **Papa Pechuga**: $276 — Papa rellena
- **Papa Costilla**: $276 — Papa rellena
- **Papa Arrachera**: $352 — Papa rellena

### Francés Suizo

- **Francés Suizo de Pastor**: $262 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Champiñón**: $262 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Bistec de Res**: $283 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Chuleta de Cerdo**: $276 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Pechuga**: $276 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Costilla de Res**: $276 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Poc-Chuc**: $276 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno
- **Francés Suizo de Arrachera**: $352 — Francés tostadito con guacamole, frijol, queso gratinado y carne, hecho en horno

### Entradas

- **Frijol con Tostada**: $93
- **Guacamole**: $142
- **Carbolla**: $106
- **Cebollas Cambray**: $135
- **Chicharrón de Queso**: $172
- **Alitas de Pollo**: $204
- **Papas a la Francesa**: $113

### Frijoles Charros

- **Frijoles Charros Normal**: $123
- **Frijoles Charros Normal (1/2 orden)**: $82
- **Frijoles Charros con Queso**: $142
- **Frijoles Charros con Queso (1/2 orden)**: $106
- **Frijoles Charros Especiales**: $178
- **Frijoles Charros Especiales (1/2 orden)**: $136

### Quesadillas

- **Quesadilla de Natural**: $109 — De maíz o harina
- **Quesadilla de Rajas**: $124 — De maíz o harina
- **Quesadilla de Champiñones**: $127 — De maíz o harina
- **Quesadilla de Chorizo**: $135 — De maíz o harina

### Queso Fundido

- **Queso Fundido Natural**: $160
- **Queso Fundido Rajas**: $175
- **Queso Fundido Champiñones**: $175
- **Queso Fundido Tocino**: $179
- **Queso Fundido Chorizo**: $179

### Nachos

- **Nachos de Pastor**: $328
- **Nachos de Pastor (1/2 orden)**: $232
- **Nachos de Champiñón**: $320
- **Nachos de Champiñón (1/2 orden)**: $232
- **Nachos de Bistec**: $373
- **Nachos de Bistec (1/2 orden)**: $262
- **Nachos de Pechuga**: $363
- **Nachos de Pechuga (1/2 orden)**: $249
- **Nachos de Chuleta**: $358
- **Nachos de Chuleta (1/2 orden)**: $249
- **Nachos de Costilla**: $367
- **Nachos de Costilla (1/2 orden)**: $255
- **Nachos de Arrachera**: $433
- **Nachos de Arrachera (1/2 orden)**: $299

### Pizza Quesobich

- **Quesobich de Queso**: $206 — Pizza individual, orilla rellena de queso
- **Quesobich de Pastor**: $232 — Pastor con piña
- **Quesobich de Bistec**: $254
- **Quesobich de Pollo**: $247
- **Quesobich de Chuleta de Cerdo**: $247
- **Quesobich de Costilla de Res**: $247
- **Quesobich de Arrachera**: $291
- **Quesobich Vegetariana**: $212 — Champiñones, cebolla y rajas de chile poblano

### Platillos PM

- **Crujientes de Pechuga de Pollo**: $329 — * No incluye guarniciones estándar
- **Platillo de Pastor**: $335
- **Platillo de Bistec**: $404
- **Platillo de Pechuga de Pollo**: $378
- **Platillo de Chuleta de Cerdo**: $378
- **Platillo de Costilla de Res**: $388
- **Platillo de Arrachera**: $492
- **Platillo de Poc-Chuc**: $368 — * No incluye guarniciones estándar
- **Fajitas de Bistec**: $404 — * No incluye guarniciones estándar
- **Fajitas de Pechuga**: $393 — * No incluye guarniciones estándar
- **Fajitas de Arrachera**: $492 — * No incluye guarniciones estándar
- **Parrillada para 2**: $612 — * No incluye guarniciones estándar
- **Parrillada para 4**: $1045 — * No incluye guarniciones estándar

### Kilos a Domicilio

- **Pastor — 250 g**: $225 — Kilo completo $900. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pastor — 500 g**: $450 — Kilo completo $900. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pastor — 750 g**: $675 — Kilo completo $900. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pastor — 1 kg**: $900 — Kilo completo $900. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res — 250 g**: $275 — Kilo completo $1100. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res — 500 g**: $550 — Kilo completo $1100. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res — 750 g**: $825 — Kilo completo $1100. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res — 1 kg**: $1100 — Kilo completo $1100. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res Encebollado — 250 g**: $287.5 — Kilo completo $1150. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res Encebollado — 500 g**: $575 — Kilo completo $1150. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res Encebollado — 750 g**: $862.5 — Kilo completo $1150. Incluye salsa roja, salsa verde, limones y tortillas.
- **Bistec de Res Encebollado — 1 kg**: $1150 — Kilo completo $1150. Incluye salsa roja, salsa verde, limones y tortillas.
- **Chuleta de Cerdo — 250 g**: $237.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Chuleta de Cerdo — 500 g**: $475 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Chuleta de Cerdo — 750 g**: $712.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Chuleta de Cerdo — 1 kg**: $950 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pechuga de Pollo — 250 g**: $237.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pechuga de Pollo — 500 g**: $475 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pechuga de Pollo — 750 g**: $712.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Pechuga de Pollo — 1 kg**: $950 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Poc-Chuc — 250 g**: $237.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Poc-Chuc — 500 g**: $475 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Poc-Chuc — 750 g**: $712.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Poc-Chuc — 1 kg**: $950 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Arrachera — 250 g**: $350 — Kilo completo $1400. Incluye salsa roja, salsa verde, limones y tortillas.
- **Arrachera — 500 g**: $700 — Kilo completo $1400. Incluye salsa roja, salsa verde, limones y tortillas.
- **Arrachera — 750 g**: $1050 — Kilo completo $1400. Incluye salsa roja, salsa verde, limones y tortillas.
- **Arrachera — 1 kg**: $1400 — Kilo completo $1400. Incluye salsa roja, salsa verde, limones y tortillas.
- **Costilla de Res — 250 g**: $237.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Costilla de Res — 500 g**: $475 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Costilla de Res — 750 g**: $712.5 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.
- **Costilla de Res — 1 kg**: $950 — Kilo completo $950. Incluye salsa roja, salsa verde, limones y tortillas.

### Postres

- **Crema Española**: $83
- **Crema de Coco**: $83
- **Flan**: $83
- **Queso Napolitano**: $109 — Receta de la casa

### Refrescos

- **Coca-Cola**: $53 — Botella o lata
- **Coca-Cola Light**: $53 — Botella o lata
- **Coca-Cola sin Azúcar**: $53 — Botella o lata
- **Toronja Cristal**: $53
- **Fanta**: $53 — Botella
- **Sprite**: $53 — Lata
- **Sprite Cero**: $53 — Lata
- **Sidral Mundet**: $53 — Botella
- **Agua Mineral Cristal**: $53 — 300ml
- **Agua Purificada**: $53 — 600ml
- **Topo Chico**: $74 — 355ml
- **Limonada**: $60
- **Limonada con Soda**: $73
- **Limonada con Topo Chico**: $100
- **Naranjada**: $60
- **Naranjada con Soda**: $73
- **Naranjada con Topo Chico**: $100
- **Suero con Soda**: $79
- **Suero con Topo Chico**: $95

### Aguas Frescas

- **Agua de Jamaica**: $60 — Rellenable una vez
- **Horchata**: $60 — Rellenable una vez
- **Té**: $60 — Rellenable una vez

### Cervezas

- **Sol**: $80
- **Superior**: $80
- **Tecate Light**: $80
- **Heineken 0.0**: $80
- **Heineken**: $90
- **Heineken Silver**: $90
- **Indio**: $80
- **XX Lager**: $80
- **XX Ámbar**: $80
- **Amstel Ultra**: $90
- **Bohemia Clara**: $90
- **Bohemia Oscura**: $90
- **Ceiba Dorada Premium**: $120
- **Ceiba Light Lager**: $120
- **Ceiba Mestiza**: $120
- **Ceiba Stout**: $120
- **Patito Oscura**: $120
- **Patito Lager**: $120
- **Ojo Rojo**: $44
- **Vaso de Chelada**: $22
- **Vaso de Michelada**: $30

### Licores y Cocktails

- **Ron Appleton Especial**: $117
- **Ron Bacardí Añejo**: $113
- **Ron Bacardí Blanco**: $106
- **Ron Bacardí Solera**: $128
- **Tequila Don Julio Reposado**: $168
- **Tequila Herradura Reposado**: $139
- **Tequila Jimador**: $106
- **Tequila Tradicional**: $113
- **Vodka Absolut**: $123
- **Vodka Smirnoff**: $109
- **Whisky Buchanan's**: $178
- **Whisky Chivas Regal**: $156
- **Whisky J.W. Etiqueta Negra**: $190
- **Caribe Cooler**: $110
- **Conga**: $114
- **Conga sin Alcohol**: $105
- **Daiquiri**: $109
- **Daiquiri sin Alcohol**: $96
- **Limonada Eléctrica**: $109
- **Margarita**: $109
- **Margarita sin Alcohol**: $100
- **Piñada**: $100
- **Piña Colada**: $112
- **Sangría**: $112
- **Sangría sin Alcohol**: $100
- **Vino Tinto Selección (copa)**: $102

### Guarniciones Extra

- **Extra Champiñón**: $35
- **Extra Chile Poblano**: $35
- **Extra Chorizo**: $36
- **Extra Guacamole**: $49
- **Extra Rajas**: $35
- **Extra Tocino**: $36
- **Orden Tortilla de Harina**: $24
- **Orden Tortilla de Maíz**: $22
- **Extra Queso**: $52
