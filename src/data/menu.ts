export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  popular?: boolean;
}

export const menuItems: MenuItem[] = [
  // === TACOS ===
  // Individuales
  { id: 'taco-ind-1', name: 'Al Pastor (Individual)', description: 'Taco individual de carne al pastor', price: 23, image: '', category: 'tacos', popular: true },
  { id: 'taco-ind-2', name: 'Rajas (Individual)', description: 'Taco individual de rajas', price: 23, image: '', category: 'tacos' },
  // Orden de 3
  { id: 'taco-3-1', name: 'Chorizo (Orden de 3)', description: 'Orden de 3 tacos de chorizo', price: 85, image: '', category: 'tacos' },
  { id: 'taco-3-2', name: 'Bistec de Res (Orden de 3)', description: 'Orden de 3 tacos de bistec de res', price: 106, image: '', category: 'tacos' },
  { id: 'taco-3-3', name: 'Pechuga de Pollo (Orden de 3)', description: 'Orden de 3 tacos de pechuga de pollo', price: 105, image: '', category: 'tacos' },
  { id: 'taco-3-4', name: 'Chuleta de Cerdo (Orden de 3)', description: 'Orden de 3 tacos de chuleta de cerdo', price: 106, image: '', category: 'tacos' },
  { id: 'taco-3-5', name: 'Costilla de Res (Orden de 3)', description: 'Orden de 3 tacos de costilla de res', price: 106, image: '', category: 'tacos' },
  { id: 'taco-3-6', name: 'Arrachera (Orden de 3)', description: 'Orden de 3 tacos de arrachera', price: 136, image: '', category: 'tacos', popular: true },
  { id: 'taco-3-7', name: 'Poc-Chuc (Orden de 3)', description: 'Orden de 3 tacos de poc-chuc', price: 106, image: '', category: 'tacos' },
  { id: 'taco-3-8', name: 'Bistec Encebollado (Orden de 3)', description: 'Orden de 3 tacos de bistec encebollado', price: 107, image: '', category: 'tacos' },
  { id: 'taco-3-9', name: 'Alambre de Pastor (Orden de 3)', description: 'Orden de 3 tacos de alambre de pastor', price: 157, image: '', category: 'tacos' },
  { id: 'taco-3-10', name: 'Alambre de Bistec (Orden de 3)', description: 'Orden de 3 tacos de alambre de bistec', price: 157, image: '', category: 'tacos' },
  { id: 'taco-3-11', name: 'Alambre de Pechuga (Orden de 3)', description: 'Orden de 3 tacos de alambre de pechuga', price: 157, image: '', category: 'tacos' },
  { id: 'taco-3-12', name: 'Alambre de Chuleta (Orden de 3)', description: 'Orden de 3 tacos de alambre de chuleta', price: 157, image: '', category: 'tacos' },
  { id: 'taco-3-13', name: 'Alambre de Costilla (Orden de 3)', description: 'Orden de 3 tacos de alambre de costilla', price: 157, image: '', category: 'tacos' },
  { id: 'taco-3-14', name: 'Alambre de Arrachera (Orden de 3)', description: 'Orden de 3 tacos de alambre de arrachera', price: 196, image: '', category: 'tacos', popular: true },

  // === GRINGAS (ORDEN DE 2) ===
  { id: 'gringa-1', name: 'Pastor', description: 'Orden de 2 gringas de pastor', price: 96, image: '', category: 'gringas' },
  { id: 'gringa-2', name: 'Bistec', description: 'Orden de 2 gringas de bistec', price: 109, image: '', category: 'gringas' },
  { id: 'gringa-3', name: 'Pechuga de Pollo', description: 'Orden de 2 gringas de pechuga', price: 109, image: '', category: 'gringas' },
  { id: 'gringa-4', name: 'Chuleta', description: 'Orden de 2 gringas de chuleta', price: 109, image: '', category: 'gringas' },
  { id: 'gringa-5', name: 'Costilla', description: 'Orden de 2 gringas de costilla', price: 109, image: '', category: 'gringas' },
  { id: 'gringa-6', name: 'Arrachera', description: 'Orden de 2 gringas de arrachera', price: 150, image: '', category: 'gringas', popular: true },
  { id: 'gringa-7', name: 'Poc-Chuc', description: 'Orden de 2 gringas de poc-chuc', price: 96, image: '', category: 'gringas' },

  // === MESTIZAS (ORDEN DE 2) ===
  { id: 'mestiza-1', name: 'Pastor', description: 'Orden de 2 mestizas de pastor', price: 96, image: '', category: 'mestizas' },
  { id: 'mestiza-2', name: 'Poc-Chuc', description: 'Orden de 2 mestizas de poc-chuc', price: 96, image: '', category: 'mestizas' },
  { id: 'mestiza-3', name: 'Bistec', description: 'Orden de 2 mestizas de bistec', price: 109, image: '', category: 'mestizas' },
  { id: 'mestiza-4', name: 'Pechuga', description: 'Orden de 2 mestizas de pechuga', price: 109, image: '', category: 'mestizas' },
  { id: 'mestiza-5', name: 'Chuleta', description: 'Orden de 2 mestizas de chuleta', price: 109, image: '', category: 'mestizas' },
  { id: 'mestiza-6', name: 'Costilla', description: 'Orden de 2 mestizas de costilla', price: 109, image: '', category: 'mestizas' },
  { id: 'mestiza-7', name: 'Arrachera', description: 'Orden de 2 mestizas de arrachera', price: 150, image: '', category: 'mestizas' },

  // === ALAMBRE (ORDEN DE 5) ===
  { id: 'alambre-1', name: 'Pastor', description: 'Orden de 5 tacos de alambre de pastor', price: 240, image: '', category: 'alambre' },
  { id: 'alambre-2', name: 'Bistec', description: 'Orden de 5 tacos de alambre de bistec', price: 240, image: '', category: 'alambre' },
  { id: 'alambre-3', name: 'Pechuga', description: 'Orden de 5 tacos de alambre de pechuga', price: 240, image: '', category: 'alambre' },
  { id: 'alambre-4', name: 'Chuleta', description: 'Orden de 5 tacos de alambre de chuleta', price: 240, image: '', category: 'alambre' },
  { id: 'alambre-5', name: 'Costilla', description: 'Orden de 5 tacos de alambre de costilla', price: 240, image: '', category: 'alambre' },
  { id: 'alambre-6', name: 'Arrachera', description: 'Orden de 5 tacos de alambre de arrachera', price: 298, image: '', category: 'alambre', popular: true },

  // === CHETACOS ===
  { id: 'chetaco-1', name: 'Pastor', description: 'Tortilla de harina extra grande con frijol, queso, champiñones y carne. Acompañado de ensalada de lechuga y tomate', price: 253, image: '', category: 'chetacos', popular: true },
  { id: 'chetaco-2', name: 'Champiñón', description: 'Chetaco de champiñón', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-3', name: 'Bistec de Res', description: 'Chetaco de bistec de res', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-4', name: 'Chuleta de Cerdo', description: 'Chetaco de chuleta de cerdo', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-5', name: 'Pechuga', description: 'Chetaco de pechuga', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-6', name: 'Costilla de Res', description: 'Chetaco de costilla de res', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-7', name: 'Poc-Chuc', description: 'Chetaco de poc-chuc', price: 266, image: '', category: 'chetacos' },
  { id: 'chetaco-8', name: 'Arrachera', description: 'Chetaco de arrachera', price: 316, image: '', category: 'chetacos' },

  // === PAPAS DE PM ===
  { id: 'papa-1', name: 'Tradicional', description: 'Papa rellena de la carne de su elección', price: 177, image: '', category: 'papas' },
  { id: 'papa-2', name: 'Pastor', description: 'Papa rellena de pastor', price: 228, image: '', category: 'papas' },
  { id: 'papa-3', name: 'Bistec', description: 'Papa rellena de bistec', price: 240, image: '', category: 'papas' },
  { id: 'papa-4', name: 'Chuleta', description: 'Papa rellena de chuleta', price: 240, image: '', category: 'papas' },
  { id: 'papa-5', name: 'Pechuga', description: 'Papa rellena de pechuga', price: 240, image: '', category: 'papas' },
  { id: 'papa-6', name: 'Costilla', description: 'Papa rellena de costilla', price: 240, image: '', category: 'papas' },
  { id: 'papa-7', name: 'Arrachera', description: 'Papa rellena de arrachera', price: 298, image: '', category: 'papas', popular: true },

  // === FRANCÉS SUIZO ===
  { id: 'frances-1', name: 'Pastor', description: 'Francés tostadito con guacamole, frijol, queso gratinado y carne. Hecho en nuestro horno', price: 228, image: '', category: 'frances-suizo', popular: true },
  { id: 'frances-2', name: 'Champiñón', description: 'Francés suizo de champiñón', price: 228, image: '', category: 'frances-suizo' },
  { id: 'frances-3', name: 'Bistec de Res', description: 'Francés suizo de bistec de res', price: 240, image: '', category: 'frances-suizo' },
  { id: 'frances-4', name: 'Chuleta de Cerdo', description: 'Francés suizo de chuleta de cerdo', price: 240, image: '', category: 'frances-suizo' },
  { id: 'frances-5', name: 'Pechuga', description: 'Francés suizo de pechuga', price: 240, image: '', category: 'frances-suizo' },
  { id: 'frances-6', name: 'Costilla de Res', description: 'Francés suizo de costilla de res', price: 240, image: '', category: 'frances-suizo' },
  { id: 'frances-7', name: 'Poc-Chuc', description: 'Francés suizo de poc-chuc', price: 240, image: '', category: 'frances-suizo' },
  { id: 'frances-8', name: 'Arrachera', description: 'Francés suizo de arrachera', price: 298, image: '', category: 'frances-suizo' },

  // === TACOS SUIZOS (ORDEN DE 5) ===
  { id: 'suizo-1', name: 'Suizo de Pastor', description: 'Orden de 5 tacos suizos de pastor', price: 209, image: '', category: 'tacos-suizos' },
  { id: 'suizo-2', name: 'Suizo de Bistec', description: 'Orden de 5 tacos suizos de bistec', price: 247, image: '', category: 'tacos-suizos' },
  { id: 'suizo-3', name: 'Suizo de Chuleta', description: 'Orden de 5 tacos suizos de chuleta', price: 247, image: '', category: 'tacos-suizos' },
  { id: 'suizo-4', name: 'Suizo de Pechuga', description: 'Orden de 5 tacos suizos de pechuga', price: 247, image: '', category: 'tacos-suizos' },
  { id: 'suizo-5', name: 'Suizo de Costilla', description: 'Orden de 5 tacos suizos de costilla', price: 247, image: '', category: 'tacos-suizos' },
  { id: 'suizo-6', name: 'Suizo de Arrachera', description: 'Orden de 5 tacos suizos de arrachera', price: 316, image: '', category: 'tacos-suizos', popular: true },
  { id: 'suizo-7', name: 'Suizo de Poc-Chuc', description: 'Orden de 5 tacos suizos de poc-chuc', price: 247, image: '', category: 'tacos-suizos' },
  { id: 'suizo-8', name: 'Suizo de Chorizo', description: 'Orden de 5 tacos suizos de chorizo', price: 177, image: '', category: 'tacos-suizos' },
  { id: 'suizo-9', name: 'Suizo de Chile Poblano', description: 'Orden de 5 tacos suizos de chile poblano', price: 177, image: '', category: 'tacos-suizos' },
  { id: 'suizo-10', name: 'Alambre Suizo de Pastor', description: 'Alambre suizo de pastor', price: 266, image: '', category: 'tacos-suizos' },
  { id: 'suizo-11', name: 'Alambre Suizo de Bistec', description: 'Alambre suizo de bistec', price: 266, image: '', category: 'tacos-suizos' },
  { id: 'suizo-12', name: 'Alambre Suizo de Pechuga', description: 'Alambre suizo de pechuga', price: 266, image: '', category: 'tacos-suizos' },
  { id: 'suizo-13', name: 'Alambre Suizo de Chuleta', description: 'Alambre suizo de chuleta', price: 266, image: '', category: 'tacos-suizos' },
  { id: 'suizo-14', name: 'Alambre Suizo de Costilla', description: 'Alambre suizo de costilla', price: 266, image: '', category: 'tacos-suizos' },
  { id: 'suizo-15', name: 'Alambre Suizo de Arrachera', description: 'Alambre suizo de arrachera', price: 323, image: '', category: 'tacos-suizos' },
  { id: 'suizo-16', name: 'Tacos Suizos Chile Poblano y Bistec', description: 'Tacos suizos de chile poblano y bistec', price: 278, image: '', category: 'tacos-suizos' },
  { id: 'suizo-17', name: 'Tacos Suizos Chile Poblano y Arrachera', description: 'Tacos suizos de chile poblano y arrachera', price: 329, image: '', category: 'tacos-suizos' },

  // === ENTRADAS ===
  { id: 'entrada-1', name: 'Frijol con Tostada', description: 'Frijol con tostada', price: 83, image: '', category: 'entradas' },
  { id: 'entrada-2', name: 'Guacamole', description: 'Guacamole fresco', price: 127, image: '', category: 'entradas' },
  { id: 'entrada-3', name: 'Carbolla', description: 'Cebolla asada', price: 90, image: '', category: 'entradas' },
  { id: 'entrada-4', name: 'Cebollas Cambray', description: 'Cebollas cambray asadas', price: 114, image: '', category: 'entradas' },
  { id: 'entrada-5', name: 'Chicharrón de Queso', description: 'Chicharrón de queso crujiente', price: 146, image: '', category: 'entradas' },
  { id: 'entrada-6', name: 'Alitas de Pollo', description: 'Alitas de pollo', price: 177, image: '', category: 'entradas', popular: true },
  { id: 'entrada-7', name: 'Ensalada de PM', description: 'Ensalada de la casa', price: 184, image: '', category: 'entradas' },
  { id: 'entrada-8', name: 'Papas a la Francesa', description: 'Papas a la francesa', price: 101, image: '', category: 'entradas' },

  // === FRIJOLES CHARROS ===
  { id: 'frijoles-1', name: 'Normal', description: 'Frijoles charros normales', price: 114, image: '', category: 'frijoles-charros' },
  { id: 'frijoles-2', name: '½ Orden Normal', description: 'Media orden de frijoles charros', price: 76, image: '', category: 'frijoles-charros' },
  { id: 'frijoles-3', name: 'Con Queso', description: 'Frijoles charros con queso', price: 127, image: '', category: 'frijoles-charros' },
  { id: 'frijoles-4', name: '½ Orden Con Queso', description: 'Media orden de frijoles charros con queso', price: 95, image: '', category: 'frijoles-charros' },
  { id: 'frijoles-5', name: 'Especiales', description: 'Frijoles charros especiales', price: 159, image: '', category: 'frijoles-charros', popular: true },
  { id: 'frijoles-6', name: '½ Orden Especiales', description: 'Media orden de frijoles charros especiales', price: 121, image: '', category: 'frijoles-charros' },

  // === QUESADILLAS ===
  { id: 'quesadilla-1', name: 'Natural', description: 'Quesadilla de maíz o harina natural', price: 95, image: '', category: 'quesadillas' },
  { id: 'quesadilla-2', name: 'Rajas', description: 'Quesadilla de rajas', price: 108, image: '', category: 'quesadillas' },
  { id: 'quesadilla-3', name: 'Champiñones', description: 'Quesadilla de champiñones', price: 108, image: '', category: 'quesadillas' },
  { id: 'quesadilla-4', name: 'Chorizo', description: 'Quesadilla de chorizo', price: 114, image: '', category: 'quesadillas' },

  // === QUESO FUNDIDO ===
  { id: 'queso-1', name: 'Natural', description: 'Queso fundido natural', price: 139, image: '', category: 'queso-fundido' },
  { id: 'queso-2', name: 'Rajas', description: 'Queso fundido con rajas', price: 152, image: '', category: 'queso-fundido' },
  { id: 'queso-3', name: 'Champiñones', description: 'Queso fundido con champiñones', price: 152, image: '', category: 'queso-fundido' },
  { id: 'queso-4', name: 'Tocino', description: 'Queso fundido con tocino', price: 152, image: '', category: 'queso-fundido' },
  { id: 'queso-5', name: 'Chorizo', description: 'Queso fundido con chorizo', price: 152, image: '', category: 'queso-fundido', popular: true },

  // === NACHOS ===
  { id: 'nacho-1', name: 'Pastor', description: 'Nachos de pastor', price: 278, image: '', category: 'nachos', popular: true },
  { id: 'nacho-2', name: '½ Orden de Pastor', description: 'Media orden de nachos de pastor', price: 202, image: '', category: 'nachos' },
  { id: 'nacho-3', name: 'Champiñón', description: 'Nachos de champiñón', price: 278, image: '', category: 'nachos' },
  { id: 'nacho-4', name: '½ Orden de Champiñón', description: 'Media orden de nachos de champiñón', price: 202, image: '', category: 'nachos' },
  { id: 'nacho-5', name: 'Bistec', description: 'Nachos de bistec', price: 316, image: '', category: 'nachos' },
  { id: 'nacho-6', name: '½ Orden de Bistec', description: 'Media orden de nachos de bistec', price: 222, image: '', category: 'nachos' },
  { id: 'nacho-7', name: 'Pechuga', description: 'Nachos de pechuga', price: 316, image: '', category: 'nachos' },
  { id: 'nacho-8', name: '½ Orden de Pechuga', description: 'Media orden de nachos de pechuga', price: 222, image: '', category: 'nachos' },
  { id: 'nacho-9', name: 'Chuleta', description: 'Nachos de chuleta', price: 311, image: '', category: 'nachos' },
  { id: 'nacho-10', name: '½ Orden de Chuleta', description: 'Media orden de nachos de chuleta', price: 222, image: '', category: 'nachos' },
  { id: 'nacho-11', name: 'Costilla', description: 'Nachos de costilla', price: 311, image: '', category: 'nachos' },
  { id: 'nacho-12', name: '½ Orden de Costilla', description: 'Media orden de nachos de costilla', price: 222, image: '', category: 'nachos' },
  { id: 'nacho-13', name: 'Arrachera', description: 'Nachos de arrachera', price: 367, image: '', category: 'nachos' },
  { id: 'nacho-14', name: '½ Orden de Arrachera', description: 'Media orden de nachos de arrachera', price: 253, image: '', category: 'nachos' },

  // === COMIDA REGIONAL ===
  { id: 'regional-1', name: 'Papadzules (Ord.5)', description: 'Exquisitos platillos típicos de la región yucateca sazonados con un toque especial de PM', price: 164, image: '', category: 'comida-regional', popular: true },
  { id: 'regional-2', name: 'Codzitos (Ord.4)', description: 'Codzitos tradicionales', price: 114, image: '', category: 'comida-regional' },
  { id: 'regional-3', name: 'Sopa de Lima', description: 'Sopa de lima tradicional', price: 152, image: '', category: 'comida-regional' },
  { id: 'regional-4', name: 'Platillo de Cochinita', description: 'Platillo de cochinita pibil', price: 240, image: '', category: 'comida-regional' },
  { id: 'regional-5', name: 'Tacos de Cochinita (Ord.4)', description: 'Orden de 4 tacos de cochinita', price: 152, image: '', category: 'comida-regional' },
  { id: 'regional-6', name: 'Francés de Cochinita', description: 'Francés de cochinita', price: 190, image: '', category: 'comida-regional' },

  // === FLAUTAS DE PM ===
  { id: 'flauta-1', name: 'Pastor', description: 'Tortilla de maíz grande y frita, cubierta con queso gratinado, crema y rellena de carne, acompañada de ensalada de lechuga y tomate', price: 240, image: '', category: 'flautas', popular: true },
  { id: 'flauta-2', name: 'Bistec de Res', description: 'Flauta de bistec de res', price: 253, image: '', category: 'flautas' },
  { id: 'flauta-3', name: 'Chuleta de Cerdo', description: 'Flauta de chuleta de cerdo', price: 253, image: '', category: 'flautas' },
  { id: 'flauta-4', name: 'Pechuga', description: 'Flauta de pechuga', price: 253, image: '', category: 'flautas' },
  { id: 'flauta-5', name: 'Costilla de Res', description: 'Flauta de costilla de res', price: 253, image: '', category: 'flautas' },
  { id: 'flauta-6', name: 'Arrachera', description: 'Flauta de arrachera', price: 316, image: '', category: 'flautas' },
  { id: 'flauta-7', name: 'Poc-Chuc', description: 'Flauta de poc-chuc', price: 253, image: '', category: 'flautas' },

  // === PLATILLOS PM ===
  { id: 'platillo-1', name: 'Crujientes de Pechuga de Pollo', description: 'Todos los platillos incluyen tortillas, frijoles charros, carbolla, guacamole con tostadas y ensalada de tomate y lechuga', price: 304, image: '', category: 'platillos', popular: true },
  { id: 'platillo-2', name: 'Platillo de Pastor', description: 'Platillo de pastor', price: 291, image: '', category: 'platillos' },
  { id: 'platillo-3', name: 'Platillo de Bistec', description: 'Platillo de bistec', price: 342, image: '', category: 'platillos' },
  { id: 'platillo-4', name: 'Platillo de Pechuga de Pollo', description: 'Platillo de pechuga de pollo', price: 329, image: '', category: 'platillos' },
  { id: 'platillo-5', name: 'Platillo de Chuleta de Cerdo', description: 'Platillo de chuleta de cerdo', price: 329, image: '', category: 'platillos' },
  { id: 'platillo-6', name: 'Platillo de Costilla de Res', description: 'Platillo de costilla de res', price: 329, image: '', category: 'platillos' },
  { id: 'platillo-7', name: 'Platillo de Arrachera', description: 'Platillo de arrachera', price: 417, image: '', category: 'platillos' },
  { id: 'platillo-8', name: 'Platillo de Poc-Chuc', description: 'Platillo de poc-chuc', price: 329, image: '', category: 'platillos' },
  { id: 'platillo-9', name: 'Fajitas de Bistec', description: 'Fajitas de bistec', price: 342, image: '', category: 'platillos' },
  { id: 'platillo-10', name: 'Fajitas de Pechuga', description: 'Fajitas de pechuga', price: 342, image: '', category: 'platillos' },
  { id: 'platillo-11', name: 'Fajitas de Arrachera', description: 'Fajitas de arrachera', price: 417, image: '', category: 'platillos' },
  { id: 'platillo-12', name: 'Parrillada para 2', description: 'Parrillada para 2 personas', price: 519, image: '', category: 'platillos' },
  { id: 'platillo-13', name: 'Parrillada para 4', description: 'Parrillada para 4 personas', price: 886, image: '', category: 'platillos' },

  // === BOYO-HAMBURGUESAS ===
  { id: 'hamburguesa-1', name: 'Boyo-Hamburguesa Sencilla', description: 'Boyo-hamburguesa sencilla', price: 164, image: '', category: 'hamburguesas' },
  { id: 'hamburguesa-2', name: 'Boyo-Hamburguesa con Queso', description: 'Boyo-hamburguesa con queso', price: 190, image: '', category: 'hamburguesas', popular: true },
  { id: 'hamburguesa-3', name: 'Boyo-Hamburguesa con Queso y Tocino', description: 'Boyo-hamburguesa con queso y tocino', price: 202, image: '', category: 'hamburguesas' },

  // === POSTRES ===
  { id: 'postre-1', name: 'Crema Española', description: 'Crema española', price: 70, image: '', category: 'postres' },
  { id: 'postre-2', name: 'Crema de Coco', description: 'Crema de coco', price: 70, image: '', category: 'postres' },
  { id: 'postre-3', name: 'Jericallas', description: 'Postre típico de Guadalajara a base de huevo, leche y vainilla', price: 70, image: '', category: 'postres' },
  { id: 'postre-4', name: 'Flan', description: 'Flan tradicional', price: 70, image: '', category: 'postres', popular: true },
  { id: 'postre-5', name: 'Café', description: 'Café (con leche +$10)', price: 41, image: '', category: 'postres' },
  { id: 'postre-6', name: 'Queso Napolitano', description: 'Receta de la casa', price: 95, image: '', category: 'postres' },

  // === REFRESCOS ===
  { id: 'refresco-1', name: 'Coca-Cola', description: 'Botella o lata 355ml', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-2', name: 'Coca-Cola Light', description: 'Botella o lata 355ml', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-3', name: 'Coca-Cola Sin Azúcar', description: 'Botella o lata 355ml', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-4', name: 'Toronja Cristal', description: 'Refresco de toronja', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-5', name: 'Fanta', description: 'Botella', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-6', name: 'Sidral Mundet', description: 'Botella', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-7', name: 'Sprite', description: 'Lata', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-8', name: 'Sprite Cero', description: 'Lata', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-9', name: 'Agua Mineral Cristal', description: '300ml', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-10', name: 'Agua Purificada', description: '600ml', price: 45, image: '', category: 'refrescos' },
  { id: 'refresco-11', name: 'Topo Chico', description: '355ml', price: 63, image: '', category: 'refrescos' },
  { id: 'refresco-12', name: 'Limonada', description: 'Limonada natural', price: 51, image: '', category: 'refrescos' },
  { id: 'refresco-13', name: 'Limonada con Soda', description: 'Limonada con soda', price: 62, image: '', category: 'refrescos' },
  { id: 'refresco-14', name: 'Limonada con Topo Chico', description: 'Limonada con Topo Chico', price: 83, image: '', category: 'refrescos' },
  { id: 'refresco-15', name: 'Naranjada', description: 'Naranjada natural', price: 51, image: '', category: 'refrescos' },
  { id: 'refresco-16', name: 'Naranjada con Soda', description: 'Naranjada con soda', price: 62, image: '', category: 'refrescos' },
  { id: 'refresco-17', name: 'Naranjada con Topo Chico', description: 'Naranjada con Topo Chico', price: 83, image: '', category: 'refrescos' },
  { id: 'refresco-18', name: 'Suero con Soda', description: 'Suero con soda', price: 62, image: '', category: 'refrescos' },
  { id: 'refresco-19', name: 'Suero con Topo Chico', description: 'Suero con Topo Chico', price: 83, image: '', category: 'refrescos' },

  // === AGUAS FRESCAS ===
  { id: 'agua-1', name: 'Jamaica', description: 'Agua de jamaica natural', price: 51, image: '', category: 'aguas-frescas', popular: true },
  { id: 'agua-2', name: 'Horchata', description: 'Agua de horchata', price: 51, image: '', category: 'aguas-frescas' },
  { id: 'agua-3', name: 'Té', description: 'Té helado', price: 51, image: '', category: 'aguas-frescas' },

  // === CERVEZAS ===
  { id: 'cerveza-1', name: 'Sol', description: 'Cerveza Sol', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-2', name: 'Superior', description: 'Cerveza Superior', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-3', name: 'Tecate Light', description: 'Cerveza Tecate Light', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-4', name: 'Heineken 0', description: 'Cerveza Heineken sin alcohol', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-5', name: 'Heineken', description: 'Cerveza Heineken', price: 76, image: '', category: 'cervezas', popular: true },
  { id: 'cerveza-6', name: 'Heineken Silver', description: 'Cerveza Heineken Silver', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-7', name: 'Indio', description: 'Cerveza Indio', price: 66, image: '', category: 'cervezas' },
  { id: 'cerveza-8', name: 'XX Lager', description: 'Cerveza XX Lager', price: 67, image: '', category: 'cervezas' },
  { id: 'cerveza-9', name: 'XX Ámbar', description: 'Cerveza XX Ámbar', price: 67, image: '', category: 'cervezas' },
  { id: 'cerveza-10', name: 'Amstel Ultra', description: 'Cerveza Amstel Ultra', price: 76, image: '', category: 'cervezas' },
  { id: 'cerveza-11', name: 'Bohemia Clara', description: 'Cerveza Bohemia Clara', price: 76, image: '', category: 'cervezas' },
  { id: 'cerveza-12', name: 'Bohemia Oscura', description: 'Cerveza Bohemia Oscura', price: 76, image: '', category: 'cervezas' },
  { id: 'cerveza-13', name: 'Ceiba Dorada Premium', description: 'Cerveza artesanal Ceiba Dorada', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-14', name: 'Ceiba Light Lager', description: 'Cerveza artesanal Ceiba Light', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-15', name: 'Ceiba Mestiza', description: 'Cerveza artesanal Ceiba Mestiza', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-16', name: 'Ceiba Stout', description: 'Cerveza artesanal Ceiba Stout', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-17', name: 'Patito Oscura', description: 'Cerveza Patito Oscura', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-18', name: 'Patito Lager', description: 'Cerveza Patito Lager', price: 101, image: '', category: 'cervezas' },
  { id: 'cerveza-19', name: 'Ojo Rojo', description: 'Cerveza con clamato', price: 38, image: '', category: 'cervezas' },
  { id: 'cerveza-20', name: 'Vaso de Chelada', description: 'Vaso de chelada', price: 20, image: '', category: 'cervezas' },
  { id: 'cerveza-21', name: 'Vaso de Michelada', description: 'Vaso de michelada', price: 25, image: '', category: 'cervezas' },

  // === GUARNICIONES EXTRA ===
  { id: 'extra-1', name: 'Extra Champiñón', description: 'Porción extra de champiñón', price: 32, image: '', category: 'extras' },
  { id: 'extra-2', name: 'Extra Chile Poblano', description: 'Porción extra de chile poblano', price: 32, image: '', category: 'extras' },
  { id: 'extra-3', name: 'Extra Chorizo', description: 'Porción extra de chorizo', price: 32, image: '', category: 'extras' },
  { id: 'extra-4', name: 'Extra Guacamole', description: 'Porción extra de guacamole', price: 45, image: '', category: 'extras' },
  { id: 'extra-5', name: 'Extra Rajas', description: 'Porción extra de rajas', price: 32, image: '', category: 'extras' },
  { id: 'extra-6', name: 'Extra Tocino', description: 'Porción extra de tocino', price: 32, image: '', category: 'extras' },
  { id: 'extra-7', name: 'Orden de Tortilla Harina', description: 'Orden de tortillas de harina', price: 20, image: '', category: 'extras' },
  { id: 'extra-8', name: 'Orden de Tortilla Maíz', description: 'Orden de tortillas de maíz', price: 20, image: '', category: 'extras' },
  { id: 'extra-9', name: 'Queso', description: 'Porción extra de queso', price: 45, image: '', category: 'extras' },

  // === KILOS A DOMICILIO ===
  { id: 'kilo-1', name: 'Pastor', description: 'Kilo de pastor. Incluye salsa roja, verde, limones y tortillas', price: 750, image: '', category: 'kilos', popular: true },
  { id: 'kilo-2', name: 'Bistec de Res', description: 'Kilo de bistec de res', price: 950, image: '', category: 'kilos' },
  { id: 'kilo-3', name: 'Bistec de Res Encebollado', description: 'Kilo de bistec de res encebollado', price: 950, image: '', category: 'kilos' },
  { id: 'kilo-4', name: 'Chuleta de Cerdo', description: 'Kilo de chuleta de cerdo', price: 800, image: '', category: 'kilos' },
  { id: 'kilo-5', name: 'Pechuga de Pollo', description: 'Kilo de pechuga de pollo', price: 800, image: '', category: 'kilos' },
  { id: 'kilo-6', name: 'Poc-Chuc', description: 'Kilo de poc-chuc', price: 800, image: '', category: 'kilos' },
  { id: 'kilo-7', name: 'Arrachera', description: 'Kilo de arrachera', price: 1200, image: '', category: 'kilos' },
  { id: 'kilo-8', name: 'Costilla Res', description: 'Kilo de costilla de res', price: 800, image: '', category: 'kilos' },
];

export const categories = [
  { id: 'tacos', name: 'Tacos', icon: '🌮' },
  { id: 'gringas', name: 'Gringas', icon: '🫓' },
  { id: 'mestizas', name: 'Mestizas', icon: '🌮' },
  { id: 'alambre', name: 'Alambre', icon: '🥓' },
  { id: 'chetacos', name: 'Chetacos', icon: '🌯' },
  { id: 'papas', name: 'Papas de PM', icon: '🥔' },
  { id: 'frances-suizo', name: 'Francés Suizo', icon: '🥖' },
  { id: 'tacos-suizos', name: 'Tacos Suizos', icon: '🧀' },
  { id: 'entradas', name: 'Entradas', icon: '🍽️' },
  { id: 'frijoles-charros', name: 'Frijoles Charros', icon: '🫘' },
  { id: 'quesadillas', name: 'Quesadillas', icon: '🫓' },
  { id: 'queso-fundido', name: 'Queso Fundido', icon: '🧀' },
  { id: 'nachos', name: 'Nachos', icon: '🌽' },
  { id: 'comida-regional', name: 'Comida Regional', icon: '🍲' },
  { id: 'flautas', name: 'Flautas de PM', icon: '🌯' },
  { id: 'platillos', name: 'Platillos PM', icon: '🍖' },
  { id: 'hamburguesas', name: 'Boyo-Hamburguesas', icon: '🍔' },
  { id: 'postres', name: 'Postres', icon: '🍮' },
  { id: 'refrescos', name: 'Refrescos', icon: '🥤' },
  { id: 'aguas-frescas', name: 'Aguas Frescas', icon: '🧃' },
  { id: 'cervezas', name: 'Cervezas', icon: '🍺' },
  { id: 'extras', name: 'Guarniciones Extra', icon: '➕' },
  { id: 'kilos', name: 'Kilos a Domicilio', icon: '📦' },
] as const;

export type CategoryId = typeof categories[number]['id'];
