// =====================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =====================================================

//Sliders control volumen tráfico para cada dirección (origen -> destino)
const sliderToRoute = {
    // NORTE (origen)
    'slider-N-S': { from: 'N', to: 'S', tlId: 'tl-N-S' },
    'slider-N-O': { from: 'N', to: 'O',  tlId: 'tl-N-O' },
    'slider-N-E': { from: 'N', to: 'E', tlId: 'tl-N-E' },
    // SUR (origen)
    'slider-S-N': { from: 'S', to: 'N', tlId: 'tl-S-N' },
    'slider-S-E': { from: 'S', to: 'E', tlId: 'tl-S-E' },
    'slider-S-O': { from: 'S', to: 'O', tlId: 'tl-S-O' },
    // OESTE (origen)
    'slider-O-E': { from: 'O', to: 'E', tlId: 'tl-O-E' },
    'slider-O-N': { from: 'O', to: 'N', tlId: 'tl-O-N' },
    'slider-O-S': { from: 'O', to: 'S', tlId: 'tl-O-S' },
    // ESTE (origen)
    'slider-E-O': { from: 'E', to: 'O', tlId: 'tl-E-O' },
    'slider-E-S': { from: 'E', to: 'S', tlId: 'tl-E-S' },
    'slider-E-N': { from: 'E', to: 'N', tlId: 'tl-E-N' }
};

// Registro de timestamps en que cada semáforo encendió el ámbar
// clave: tlId, valor: Date.now() cuando se detectó el cambio a ámbar
const amberOnTimestamps = {};

// Volumen tráfico inicial es 0
let trafficVolumes = {
    'N-S': 0, 'N-O': 0, 'N-E': 0,
    'S-N': 0, 'S-E': 0, 'S-O': 0,
    'O-E': 0, 'O-N': 0, 'O-S': 0,
    'E-O': 0, 'E-S': 0, 'E-N': 0
};

// Almacenamiento de coches activos
let activeCars = [];
let carIdCounter = 0;

// Intervalos de generación por dirección
let generationIntervals = {};

// Velocidad base de los coches (px por frame)
const CAR_SPEED = 1.2;

// Distancia mínima de seguridad entre coches (px entre la parte delantera del de atrás y la trasera del de delante)
const MIN_SAFE_DISTANCE = 10;

// Tasa de generación base (milisegundos entre generaciones por unidad de volumen)
const BASE_GENERATION_INTERVAL = 1800; // 1.8 segundos para volumen 1
const MIN_GENERATION_INTERVAL = 100;   // 200ms para volumen 5

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

// Obtener intervalo de generación basado en volumen
function getGenerationInterval(volume) {
    if (volume === 0) return null;
    const interval = BASE_GENERATION_INTERVAL / volume;
    return Math.max(MIN_GENERATION_INTERVAL, interval);
}

// Generar color aleatorio para coches
function getRandomCarColor() {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 75%, 55%)`;
}

// Obtener tipo de vehículo según probabilidad: 60% coche, 30% furgoneta, 10% camión
function getRandomVehicleType() {
    const r = Math.random();
    if (r < 0.60) return 'car';
    if (r < 0.90) return 'van';
    return 'truck';
}

// Dimensiones según tipo de vehículo
function getVehicleDimensions(type) {
    switch(type) {
        case 'van':   return { h: 12, w: 22, rx: 4 };
        case 'truck': return { h: 15, w: 35, rx: 2 };
        case 'car':
        default:      return { h: 10, w: 16, rx: 4 };
    }
}

// Duración total del ámbar (ms) — debe coincidir con ciclo_general.js
const AMBER_DURATION_MS = 5000;
// Margen final del ámbar que se trata como rojo (ms)
const AMBER_RED_MARGIN_MS = 1000;

// Obtener el estado actual de un semáforo.
// Devuelve true (puede pasar) si está en verde,
// o si está en ámbar Y lleva menos de (AMBER_DURATION_MS - AMBER_RED_MARGIN_MS) encendido.
// Devuelve false (debe pararse) si está en rojo,
// o si está en ámbar en su último segundo.
function getTrafficLightState(tlId) {
    const tlGroup = document.getElementById(tlId)?.closest('g');
    if (!tlGroup) return false;
    const greenEl = tlGroup.querySelector('.tl-green');
    const amberEl = tlGroup.querySelector('.tl-amber');

    if (greenEl && greenEl.classList.contains('on')) {
        // Limpia registro de ámbar al pasar a verde
        delete amberOnTimestamps[tlId];
        return true;
    }

    if (amberEl && amberEl.classList.contains('on')) {
        // Registrar cuándo se encendió el ámbar (solo la primera vez)
        if (!amberOnTimestamps[tlId]) {
            amberOnTimestamps[tlId] = Date.now();
        }
        const elapsed = Date.now() - amberOnTimestamps[tlId];
        // Si estamos en el último segundo del ámbar → tratar como rojo
        if (elapsed >= AMBER_DURATION_MS - AMBER_RED_MARGIN_MS) return false;
        return true;
    }

    // Rojo u otro estado
    delete amberOnTimestamps[tlId];
    return false;
}

// =====================================================
// DISTANCIA DE SEGURIDAD
// =====================================================

// Largo total del vehículo incluyendo cabina delantera (furgoneta y camión).
// El cuerpo mide dim.w; la cabina añade 7 px (van) o 10 px (truck) al frente.
function getVehicleLength(type) {
    switch(type) {
        case 'van':   return 22 + 7;   // cuerpo + cabina
        case 'truck': return 35 + 10;
        case 'car':
        default:      return 16;       // coches no tienen cabina separada
    }
}

// Determina si dos coches comparten el mismo carril lógico.
// Se considera que dos coches están en el mismo carril si se mueven en la
// misma dirección Y sus posiciones laterales son próximas (< LANE_TOL px).
// Esto cubre el caso de N-S y N-O que ambos viajan hacia el S pero por
// distintos carriles (x≈260 vs x≈320): con LANE_TOL=14 no solaparán.
// También detecta cuando dos rutas distintas comparten el mismo carril
// físico antes de la intersección (e.g. N-S y N-O arrancan en x=260 y x=320
// respectivamente, que son carriles distintos → sin bloqueo mutuo).
function sameLane(carA, carB) {
    // Si ya han girado y van en dirección distinta, nunca mismo carril
    if (carA.direction !== carB.direction) return false;
    const LANE_TOL = 14; // px de tolerancia lateral
    if (carA.direction === 'S' || carA.direction === 'N') {
        return Math.abs(carA.x - carB.x) < LANE_TOL;
    } else {
        return Math.abs(carA.y - carB.y) < LANE_TOL;
    }
}

// ── Geometría de vehículos ───────────────────────────────────────────────────
//
// car.x / car.y es siempre la esquina superior-izquierda del rect LOCAL antes
// de aplicar la rotación SVG.  Tras rotar:
//
//   S  rotate( 90): eje largo queda vertical, punta hacia abajo.
//          frente (mayor y SVG) = car.y + len
//          trasera               = car.y
//
//   N  rotate(-90): eje largo queda vertical, punta hacia arriba.
//          El extremo (len,0) local va a (car.x, car.y - len) en SVG.
//          frente (menor y SVG) = car.y - len
//          trasera               = car.y
//
//   E  rotate(  0): eje largo horizontal, punta a la derecha.
//          frente (mayor x SVG) = car.x + len
//          trasera               = car.x
//
//   O  rotate(180): eje largo horizontal, punta a la izquierda.
//          El extremo (len,0) local va a (car.x - len, car.y) en SVG.
//          frente (menor x SVG) = car.x - len
//          trasera               = car.x
//
// ────────────────────────────────────────────────────────────────────────────

function getFrontCoord(car) {
    const len = getVehicleLength(car.type);
    switch (car.direction) {
        case 'S': return car.y + len;   // frente apunta a y creciente
        case 'N': return car.y - len;   // frente apunta a y decreciente
        case 'E': return car.x + len;   // frente apunta a x creciente
        case 'O': return car.x - len;   // frente apunta a x decreciente
    }
    return 0;
}

function getRearCoord(car) {
    switch (car.direction) {
        case 'S': return car.y;         // trasera = esquina superior del rect rotado
        case 'N': return car.y;         // trasera = punto de anclaje (mayor y)
        case 'E': return car.x;         // trasera = borde izquierdo
        case 'O': return car.x;         // trasera = punto de anclaje (mayor x)
    }
    return 0;
}

// Calcula el hueco (px) entre el frente de carA y la trasera de carB.
// "Delante" significa en la dirección de avance de carA.
// Devuelve Infinity si carB no está adelante o no es el mismo carril.
function getGapToCarAhead(carA, carB) {
    if (!sameLane(carA, carB)) return Infinity;

    // Coches en giro: ignorarlos solo si ya se han separado lateralmente
    if (carB.isTurning) {
        const lateralSep = (carA.direction === 'S' || carA.direction === 'N')
            ? Math.abs(carA.x - carB.x)
            : Math.abs(carA.y - carB.y);
        if (lateralSep > 8) return Infinity;
    }

    const frontA = getFrontCoord(carA);
    const rearB  = getRearCoord(carB);

    // "carB está delante" significa que su trasera está MÁS ADELANTE que el frente de carA
    // en la dirección de avance:
    //   S → rearB (car.y) > frontA  (mayor y = más al sur = más adelante)
    //   N → rearB (car.y) < frontA  (menor y = más al norte = más adelante)
    //   E → rearB (car.x) > frontA  (mayor x = más al este = más adelante)
    //   O → rearB (car.x) < frontA  (menor x = más al oeste = más adelante)
    switch (carA.direction) {
        case 'S': return rearB > frontA ? rearB - frontA : Infinity;
        case 'N': return rearB < frontA ? frontA - rearB : Infinity;
        case 'E': return rearB > frontA ? rearB - frontA : Infinity;
        case 'O': return rearB < frontA ? frontA - rearB : Infinity;
    }
    return Infinity;
}

// Devuelve true si el coche debe frenar/detenerse por el vehículo de delante.
// Se aplica tanto en movimiento como en parada (para que los coches en cola
// respeten la distancia aunque el primero esté parado en rojo).
// Incluye coches en giro que físicamente ocupan espacio (via bounding-box lateral).
// Devuelve true si el coche debe frenar/detenerse por el vehículo de delante.
// Devuelve true si el coche debe frenar/detenerse por el vehículo de delante.
function shouldStopForCarAhead(car) {
    // Para coches en giro, usar una distancia de seguridad mayor
    if (car.isTurning) {
        const TURN_SAFE_DISTANCE = MIN_SAFE_DISTANCE * 2;
        for (const other of activeCars) {
            if (other.id === car.id) continue;
            const gap = getGapToCarAhead(car, other);
            if (gap >= 0 && gap < TURN_SAFE_DISTANCE) return true;
        }
        return false;
    }

    for (const other of activeCars) {
        if (other.id === car.id) continue;

        // Caso especial: el coche de delante está girando a la derecha en el mismo
        // carril de origen. Aunque su dirección SVG ya diverge, físicamente bloquea
        // el paso al coche que va recto. Se comprueba:
        //   1. El otro está girando (isTurning).
        //   2. Ambos comparten el mismo carril lateral de origen.
        //   3. El otro está físicamente por delante de car.
        if (other.isTurning && other.from === car.from) {
            const LANE_TOL = 14;
            const sameStartLane =
                (car.direction === 'S' || car.direction === 'N')
                    ? Math.abs(car.x - other.x) < LANE_TOL
                    : Math.abs(car.y - other.y) < LANE_TOL;

            if (sameStartLane) {
                const frontCar = getFrontCoord(car);
                let gap;
                switch (car.direction) {
                    case 'S': gap = other.y > frontCar ? other.y - frontCar : Infinity; break;
                    case 'N': gap = other.y < frontCar ? frontCar - other.y : Infinity; break;
                    case 'E': gap = other.x > frontCar ? other.x - frontCar : Infinity; break;
                    case 'O': gap = other.x < frontCar ? frontCar - other.x : Infinity; break;
                    default:  gap = Infinity;
                }
                if (gap < MIN_SAFE_DISTANCE + 20) return true;
            }
        }

        const gap = getGapToCarAhead(car, other);
        if (gap >= 0 && gap < MIN_SAFE_DISTANCE) return true;
    }
    return false;
}
// Devuelve true si hay un coche en el punto de spawn que impediría
// generar un nuevo vehículo sin solape.
function isSpawnBlocked(from, to) {
    const startPos = getStartPosition(from, to);
    if (!startPos) return false;
    const SPAWN_CLEARANCE = 55; // distancia mínima desde el spawn para que aparezca

    for (const other of activeCars) {
        if (other.direction !== startPos.direction) continue;
        // Comparar carril lateral
        const LANE_TOL = 14;
        if (startPos.direction === 'S' || startPos.direction === 'N') {
            if (Math.abs(other.x - startPos.x) >= LANE_TOL) continue;
        } else {
            if (Math.abs(other.y - startPos.y) >= LANE_TOL) continue;
        }
        // Ver si el otro coche está dentro de la zona de spawn
        // Para S/E el spawn está en coordenadas pequeñas y el coche avanza hacia valores mayores:
        //   rearOther (= car.y o car.x, el punto de anclaje) debe estar lejos del spawn.
        // Para N/O el spawn está en coordenadas grandes y el coche avanza hacia valores menores:
        //   rearOther es también car.y / car.x (el punto de anclaje, que es la trasera en esas dirs).
        const rearOther = getRearCoord(other);
        switch(startPos.direction) {
            case 'S':
                // spawn y=-30, avanza hacia sur; bloqueado si trasera < spawn+clearance
                if (rearOther < startPos.y + SPAWN_CLEARANCE) return true;
                break;
            case 'N':
                // spawn y=700, avanza hacia norte; bloqueado si trasera > spawn-clearance
                if (rearOther > startPos.y - SPAWN_CLEARANCE) return true;
                break;
            case 'E':
                // spawn x=-30, avanza hacia este; bloqueado si trasera < spawn+clearance
                if (rearOther < startPos.x + SPAWN_CLEARANCE) return true;
                break;
            case 'O':
                // spawn x=930, avanza hacia oeste; bloqueado si trasera > spawn-clearance
                if (rearOther > startPos.x - SPAWN_CLEARANCE) return true;
                break;
        }
    }
    return false;
}

// =====================================================
// GENERACIÓN DE COCHES
// =====================================================

// Calcular posición inicial según origen y destino
function getStartPosition(from, to) {
    switch(from) {
        case 'N':
            if (to === 'E') return { x: 320, y: -40, direction: 'S' };
            else            return { x: 260, y: -40, direction: 'S' };
        case 'S':
            if (to === 'O') return { x: 365, y: 725, direction: 'N' };
            else            return { x: 425, y: 725, direction: 'N' };
        case 'O':
            if (to === 'N') return { x: -50, y: 360, direction: 'E' };
            else            return { x: -50, y: 420, direction: 'E' };
        case 'E':
            if (to === 'S') return { x: 960, y: 310, direction: 'O' };
            else            return { x: 960, y: 260, direction: 'O' };
        default: return null;
    }
}

// Calcular la rotación SVG según la dirección de movimiento actual
function rotationForDirection(dir) {
    switch(dir) {
        case 'S': return 90;
        case 'N': return -90;
        case 'E': return 0;
        case 'O': return 180;
        default:  return 0;
    }
}

// Crear un nuevo coche
function createCar(from, to, tlId) {
    const startPos = getStartPosition(from, to);

    const color = getRandomCarColor();
    const type  = getRandomVehicleType();
    const dim   = getVehicleDimensions(type);
    const carId = `car-${carIdCounter++}`;

    const svg = document.getElementById('intersection-svg');
    const carGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    carGroup.setAttribute('id', carId);
    carGroup.setAttribute('class', 'car');
    carGroup.setAttribute('data-from', from);
    carGroup.setAttribute('data-to', to);
    carGroup.setAttribute('data-tl-id', tlId);

    // Cuerpo principal
    const carRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    carRect.setAttribute('width',  String(dim.w));
    carRect.setAttribute('height', String(dim.h));
    carRect.setAttribute('rx', String(dim.rx));
    carRect.setAttribute('ry', String(dim.rx));
    carRect.setAttribute('fill', color);
    carRect.setAttribute('stroke', '#000');
    carRect.setAttribute('stroke-width', '0.8');
    carRect.setAttribute('x', '0');
    carRect.setAttribute('y', '0');
    carGroup.appendChild(carRect);

    // Cabina delantera (furgoneta y camión)
    if (type === 'van' || type === 'truck') {
        const cabinDim = type === 'truck' ? 10 : 7;
        const cabin = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        cabin.setAttribute('width',  String(cabinDim));
        cabin.setAttribute('height', String(cabinDim));
        cabin.setAttribute('x', String(dim.w));
        cabin.setAttribute('y', String((dim.h - cabinDim) / 2));
        cabin.setAttribute('rx', String(dim.rx));
        cabin.setAttribute('ry', String(dim.rx));
        cabin.setAttribute('fill', '#000');
        carGroup.appendChild(cabin);
    }

    const rotation = rotationForDirection(startPos.direction);
    carGroup.setAttribute('transform', `translate(${startPos.x}, ${startPos.y}) rotate(${rotation})`);
    svg.appendChild(carGroup);

    const car = {
        id: carId,
        element: carGroup,
        type: type,
        from: from,
        to: to,
        tlId: tlId,
        direction: startPos.direction,
        x: startPos.x,
        y: startPos.y,
        active: true,
        isStopped: false,
        targetDirection: to,  // dirección final tras el giro (N/S/E/O)
        hasTurned: false,
        wasStoppedByExtraLight: false
    };

    activeCars.push(car);
    return car;
}

// =====================================================
// ACTUALIZACIÓN DE POSICIONES (ANIMACIÓN)
// =====================================================

// Líneas de stop principales (coordenada SVG donde debe quedar el FRENTE del vehículo)
//   S: frente = car.y + len  →  detener cuando frente >= 230  →  car.y = 230 - len
//   N: frente = car.y - len  →  detener cuando frente <= 450  →  car.y = 450 + len
//   E: frente = car.x + len  →  detener cuando frente >= 230  →  car.x = 230 - len
//   O: frente = car.x - len  →  detener cuando frente <= 450  →  car.x = 450 + len
const STOP_LINES = { 'S': 230, 'N': 450, 'E': 230, 'O': 450 };

// ─── Geometría exacta de zonas prohibidas de parada ──────────────────────────
//
// Un vehículo NUNCA puede quedar parado (ni siquiera en cola) con ninguna parte
// de su cuerpo dentro de estas bandas:
//
//   CEBRA NORTE  (vehículos dir S): banda y ∈ [50, 80]
//   CEBRA SUR    (vehículos dir N): banda y ∈ [580, 610]
//   CEBRA OESTE  (vehículos dir E): banda x ∈ [50, 80]
//   CEBRA ESTE   (vehículos dir O): banda x ∈ [590, 620]
//   VÍAS TREN    (vehículos dir O o E, carretera horizontal): banda x ∈ [751, 790]
//
// Líneas de stop de semáforos peatonales (frente del vehículo):
//   Dir S → frente se detiene en y = 48  (2 px antes del cebra N en y=50)
//   Dir N → frente se detiene en y = 612 (2 px después del cebra S en y=610, dir N avanza a y decreciente)
//   Dir E → frente se detiene en x = 48
//   Dir O → frente se detiene en x = 622
//
// Líneas de stop semáforo ferroviario (frente del vehículo):
//   Dir O → frente se detiene en x = 749  (2 px antes de x=751)
//   Dir E → frente se detiene en x = 792  (2 px después de x=790)
//
// ─────────────────────────────────────────────────────────────────────────────

// Bandas prohibidas indexadas por dirección de marcha.
// Cada entrada: { coord: 'x'|'y', min, max }
// "min" y "max" son coordenadas SVG del CUERPO (trasera..frente) del vehículo.
const FORBIDDEN_ZONES = {
    'S': [{ coord: 'y', min: 50,  max: 80  }],
    'N': [{ coord: 'y', min: 580, max: 610 }],
    'E': [{ coord: 'x', min: 50,  max: 80  },
          { coord: 'x', min: 751, max: 790 }],
    'O': [{ coord: 'x', min: 590, max: 620 },
          { coord: 'x', min: 751, max: 790 }]
};

// Devuelve true si el vehículo (en su posición actual) solapa con alguna zona prohibida.
function isInForbiddenZone(car) {
    const zones = FORBIDDEN_ZONES[car.direction];
    if (!zones) return false;
    const len = getVehicleLength(car.type);

    for (const z of zones) {
        let bodyMin, bodyMax;
        if (z.coord === 'y') {
            // Dir S: trasera = car.y, frente = car.y + len
            // Dir N: frente = car.y - len, trasera = car.y  → bodyMin = car.y-len, bodyMax = car.y
            bodyMin = (car.direction === 'S') ? car.y       : car.y - len;
            bodyMax = (car.direction === 'S') ? car.y + len : car.y;
        } else {
            // Dir E: trasera = car.x, frente = car.x + len
            // Dir O: frente = car.x - len, trasera = car.x
            bodyMin = (car.direction === 'E') ? car.x       : car.x - len;
            bodyMax = (car.direction === 'E') ? car.x + len : car.x;
        }
        // Solapamiento: los rangos se cruzan
        if (bodyMax > z.min && bodyMin < z.max) return true;
    }
    return false;
}

// Devuelve la lista de semáforos adicionales (peatonales + ferroviarios) que
// debe respetar un coche dado, con su línea de stop (coordenada SVG del FRENTE).
// Solo se añaden los checks relevantes para la posición actual del vehículo.
function getExtraStopChecks(car) {
    const checks = [];
    const front = getFrontCoord(car);

    switch (car.direction) {

        case 'S':
            // Cebra Norte: y=50..80. El frente (car.y+len) debe detenerse en y=48.
            // Solo antes de haberlo superado (front < 82).
            if (!car.hasTurned && front < 82) {
                checks.push({ tlId: 'tlp-N-O', stopLine: 48 });
                checks.push({ tlId: 'tlp-N-E', stopLine: 48 });
            }
            break;

        case 'N':
            // Cebra Sur: y=580..610. Dir N avanza a y decreciente; frente = car.y-len.
            // "Antes del paso" = frente > 612. Superado = frente < 578.
            if (!car.hasTurned && front > 578) {
                checks.push({ tlId: 'tlp-S-O', stopLine: 612 });
                checks.push({ tlId: 'tlp-S-E', stopLine: 612 });
            }
            break;

        case 'E':
            // Cebra Oeste: x=50..80. Frente = car.x+len debe detenerse en x=48.
            if (!car.hasTurned && front < 82) {
                checks.push({ tlId: 'tlp-O-N', stopLine: 48 });
                checks.push({ tlId: 'tlp-O-S', stopLine: 48 });
            }
            // Vías tren: x=751..790. Frente debe detenerse en x=792 (viniendo del O,
            // dir E avanza a x creciente, detener ANTES de x=751: frente en x=749).
            // Dir E viene del Oeste; las vías están a la derecha de la intersección.
            // El coche habrá girado antes si su destino no es E recto, pero para
            // los que sigan recto (O-E o los que giraron y ahora van E), aplica.
            if (front > 680 && front < 793) {
                checks.push({ tlId: 'rail-tl-N', stopLine: 749 });
            }
            break;

        case 'O':
            // Cebra Este: x=590..620. Dir O avanza a x decreciente; frente = car.x-len.
            // "Antes del paso" = frente > 622. Superado = frente > 588.
            if (!car.hasTurned && front > 588) {
                checks.push({ tlId: 'tlp-E-N', stopLine: 622 });
                checks.push({ tlId: 'tlp-E-S', stopLine: 622 });
            }
            // Vías tren: x=751..790. Dir O avanza a x decreciente; frente = car.x-len.
            // Detener antes de x=790: frente en x=792 (el frente aún no llegó a 790).
            // Rango activo: frente entre 792 y 680 (antes de cruzar, no después).
            if (front < 793 && front > 680) {
                checks.push({ tlId: 'rail-tl-S', stopLine: 800 });
            }
            break;
    }

    return checks;
}

// Evalúa un semáforo extra con su línea de stop.
// Misma lógica que shouldStopAtTrafficLight pero parametrizada.
// Devuelve true si el vehículo debe detenerse ante este semáforo.
function checkExtraLight(car, tlId, stopLine) {
    const isGreen = getTrafficLightState(tlId);
    if (isGreen) return false;

    const front = getFrontCoord(car);
    const len   = getVehicleLength(car.type);
    const dir   = car.direction;

    // Punto de no retorno: ya cruzó la línea → dejar pasar
    switch (dir) {
        case 'S': if (front > stopLine + 10) return false; break;
        case 'N': if (front < stopLine - 10) return false; break;
        case 'E': if (front > stopLine + 10) return false; break;
        case 'O': if (front < stopLine - 10) return false; break;
    }

    // El frente no ha llegado a la línea → no hace falta parar aún
    switch (dir) {
        case 'S': if (front < stopLine) return false; break;
        case 'N': if (front > stopLine) return false; break;
        case 'E': if (front < stopLine) return false; break;
        case 'O': if (front > stopLine) return false; break;
    }

    // Anclar el vehículo exactamente en la línea de stop
    switch (dir) {
        case 'S': car.y = stopLine - len; break;
        case 'N': car.y = stopLine + len; break;
        case 'E': car.x = stopLine - len; break;
        case 'O': car.x = stopLine + len; break;
    }
    car.isStopped = true;
    car.wasStoppedByExtraLight = true;
    return true;
}

function shouldStopAtTrafficLight(car) {
    if (car.wasStoppedByExtraLight) {
    const extraChecks = getExtraStopChecks(car);

    // Si YA no está bloqueado por ningún semáforo secundario → avanzar
    const stillBlocked = extraChecks.some(({ tlId, stopLine }) =>
        checkExtraLight(car, tlId, stopLine)
    );

    if (!stillBlocked) {
        car.wasStoppedByExtraLight = false;
        car.isStopped = false;
        return false; // 👈 IGNORA semáforo principal temporalmente
    }

    return true; // sigue parado por el secundario
}
    // ── 1. Semáforo principal de la ruta ────────────────────────────────────
    const isGreen = getTrafficLightState(car.tlId);
    if (isGreen) {
        car.isStopped = false;
        // Aun con semáforo principal en verde, verificar semáforos extra
    } else {
        const stopLine = STOP_LINES[car.direction];
        if (stopLine !== undefined) {
            const front = getFrontCoord(car);
            const len   = getVehicleLength(car.type);

            // Punto de no retorno
            let pastLine = false;
            switch (car.direction) {
                case 'S': pastLine = front > stopLine + 10; break;
                case 'N': pastLine = front < stopLine - 10; break;
                case 'E': pastLine = front > stopLine + 10; break;
                case 'O': pastLine = front < stopLine - 10; break;
            }

            if (!pastLine) {
                // No ha llegado aún
                let beforeLine = false;
                switch (car.direction) {
                    case 'S': beforeLine = front < stopLine; break;
                    case 'N': beforeLine = front > stopLine; break;
                    case 'E': beforeLine = front < stopLine; break;
                    case 'O': beforeLine = front > stopLine; break;
                }
                if (!beforeLine) {
                    // Anclar en línea principal
                    switch (car.direction) {
                        case 'S': car.y = stopLine - len; break;
                        case 'N': car.y = stopLine + len; break;
                        case 'E': car.x = stopLine - len; break;
                        case 'O': car.x = stopLine + len; break;
                    }
                    car.isStopped = true;
                    return true;
                } else {
                    // Todavía lejos: seguir avanzando
                }
            }
            // si pastLine → dejar pasar (ya cruzó)
        }
    }

    // ── 2. Semáforos peatonales y ferroviarios ───────────────────────────────
    const extraChecks = getExtraStopChecks(car);
    for (const { tlId, stopLine } of extraChecks) {
        if (checkExtraLight(car, tlId, stopLine)) {
            return true;
        }
    }

    // Ningún semáforo (ni principal ni extra) está bloqueando:
    // limpiar isStopped para que el coche pueda arrancar
    if (isGreen) car.isStopped = false;

    return false;
}

function needsToTurn(car) {
    return car.direction !== car.targetDirection;
}

// Obtener datos del giro según ruta
// Obtener datos del giro según ruta
function getTurnPoint(car) {

    const turnMap = {
        'N-S': null, 'S-N': null, 'O-E': null, 'E-O': null,

        // GIROS DERECHA N-O: mantener X constante
        'N-O': { 
            cp1x: 260, cp1y: 245,
            cp2x: 260, cp2y: 260,
            endX: 260, endY: 260,
            keepConstant: 'X'
        },
        
        // GIROS DERECHA S-E: mantener X constante
        'S-E': { 
            cp1x: 420, cp1y: 435,
            cp2x: 420, cp2y: 420,
            endX: 420, endY: 420,
            keepConstant: 'X'
        },
        
        // GIROS DERECHA E-N: mantener Y constante
        'E-N': { 
            cp1x: 440, cp1y: 260,
            cp2x: 425, cp2y: 260,
            endX: 425, endY: 260,
            keepConstant: 'Y'
        },
        
        // GIROS DERECHA O-S: mantener Y constante
        'O-S': { 
            cp1x: 245, cp1y: 420,
            cp2x: 260, cp2y: 420,
            endX: 260, endY: 420,
            keepConstant: 'Y'
        },

        // GIROS IZQUIERDA
        'N-E': { 
            cp1x: 320, cp1y: 335,
            cp2x: 380, cp2y: 345,
            endX: 450, endY: 360,
            keepConstant: null
        },
        'S-O': { 
            cp1x: 365, cp1y: 345,
            cp2x: 300, cp2y: 335,
            endX: 230, endY: 320,
            keepConstant: null
        },
        'E-S': { 
            cp1x: 345, cp1y: 310,
            cp2x: 335, cp2y: 380,
            endX: 320, endY: 450,
            keepConstant: null
        },
        'O-N': { 
            cp1x: 335, cp1y: 360,
            cp2x: 345, cp2y: 300,
            endX: 360, endY: 230,
            keepConstant: null
        }
    };
    
    return turnMap[`${car.from}-${car.to}`];
}

// Función mejorada para determinar cuándo iniciar un giro
function shouldStartTurn(car) {
    if (car.hasTurned || !needsToTurn(car)) return false;
    
    const turnData = getTurnPoint(car);
    if (!turnData) return false;
    
    const front = getFrontCoord(car);
    
    // Umbrales base según la dirección (centrados en la intersección)
    const turnThresholds = {
        'S': { start: 230, end: 280 },  // Viene del Norte
        'N': { start: 450, end: 400 },  // Viene del Sur
        'E': { start: 230, end: 280 },  // Viene del Oeste
        'O': { start: 450, end: 400 }   // Viene del Este
    };
    
    const thresholds = turnThresholds[car.direction];
    if (!thresholds) return false;
    
    // Ajustar umbrales según el tipo de vehículo
    // Los vehículos más largos necesitan empezar el giro más tarde
    let startThreshold = thresholds.start;
    let endThreshold = thresholds.end;
    
    switch(car.type) {
        case 'truck':
            if (car.direction === 'N' || car.direction === 'O') {
                startThreshold = Math.max(thresholds.start - 30, thresholds.end + 10);
            } else {
                startThreshold = Math.min(thresholds.start + 30, thresholds.end - 10);
            }
            endThreshold = thresholds.end;
            break;
        case 'van':
            if (car.direction === 'N' || car.direction === 'O') {
                startThreshold = Math.max(thresholds.start - 15, thresholds.end + 5);
            } else {
                startThreshold = Math.min(thresholds.start + 15, thresholds.end - 5);
            }
            endThreshold = thresholds.end;
            break;
        case 'car':
        default:
            // Los coches tienen los umbrales base
            break;
    }
    
    // Verificar si el frente del vehículo está dentro del rango de inicio de giro
    if (car.direction === 'S' || car.direction === 'E') {
        // Direcciones que avanzan hacia valores crecientes
        return front >= startThreshold && front <= endThreshold;
    } else {
        // Direcciones que avanzan hacia valores decrecientes (N y O)
        return front <= startThreshold && front >= endThreshold;
    }
}

// Función principal de movimiento
// Función principal de movimiento (CORREGIDA)
function moveCar(car) {
    if (!car.active) return;

    // ── 1. Evaluar semáforo ──────────────────────────────────────────────────
    const blockedByLight = shouldStopAtTrafficLight(car);

    // ── 2. Evaluar distancia de seguridad ────────────────────────────────────
    const blockedByCar = shouldStopForCarAhead(car);

    // ── 3. Lógica de movimiento ──────────────────────────────────────────────
    const canMove = !blockedByLight && !car.isStopped && !blockedByCar;

    // Compactar cola: el coche está parado (semáforo rojo) pero hay hueco delante
    if (!canMove && car.isStopped && !blockedByCar) {
        const stopLine = STOP_LINES[car.direction];
        let minGap = Infinity;
        for (const other of activeCars) {
            if (other.id === car.id) continue;
            const g = getGapToCarAhead(car, other);
            if (g < minGap) minGap = g;
        }

        if (minGap > MIN_SAFE_DISTANCE + CAR_SPEED) {
            const vehicleLen = getVehicleLength(car.type);

            // Calcular posición provisional tras avanzar un paso
            let nextX = car.x, nextY = car.y;
            switch(car.direction) {
                case 'S': nextY = car.y + CAR_SPEED; break;
                case 'N': nextY = car.y - CAR_SPEED; break;
                case 'E': nextX = car.x + CAR_SPEED; break;
                case 'O': nextX = car.x - CAR_SPEED; break;
            }

            // No sobrepasar la línea de stop principal
            let beyondStop = false;
            switch(car.direction) {
                case 'S': beyondStop = (nextY + vehicleLen >= stopLine); break;
                case 'N': beyondStop = (nextY - vehicleLen <= stopLine); break;
                case 'E': beyondStop = (nextX + vehicleLen >= stopLine); break;
                case 'O': beyondStop = (nextX - vehicleLen <= stopLine); break;
            }

            // Comprobar si la posición provisional entraría en una zona prohibida
            const testCar = Object.assign({}, car, { x: nextX, y: nextY });
            const wouldEnterForbidden = isInForbiddenZone(testCar);

            // Si ya estamos en zona prohibida (raro pero posible en el primer frame),
            // continuar avanzando para salir cuanto antes
            const alreadyInForbidden = isInForbiddenZone(car);

            if (!beyondStop && (!wouldEnterForbidden || alreadyInForbidden)) {
                car.x = nextX;
                car.y = nextY;
            }
        }
    }

    if (canMove) {
        // Iniciar giro si procede
        if (!car.hasTurned && needsToTurn(car)) {
            if (shouldStartTurn(car) && !car.isTurning) {
                const turnData = getTurnPoint(car);
                if (turnData) {
                    // Iniciar giro
                    car.isTurning = true;
                    car.turnProgress = 0;
                    car.turnStartX = car.x;
                    car.turnStartY = car.y;
                    car.turnData = turnData;
                    // Guardar rotación inicial para interpolación suave
                    car.startRotation = rotationForDirection(car.direction);
                }
            }
        }

        // Procesar movimiento
        if (car.isTurning && car.turnData) {
            const t = car.turnProgress;
            const td = car.turnData;
            
            // Usar ease-in-out para movimiento más natural
            const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            const t2 = easeT * easeT;
            const t3 = t2 * easeT;
            const mt = 1 - easeT;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;

            // Curva de Bézier cúbica con ease
            car.x = mt3 * car.turnStartX + 3 * mt2 * easeT * td.cp1x + 3 * mt * t2 * td.cp2x + t3 * td.endX;
            car.y = mt3 * car.turnStartY + 3 * mt2 * easeT * td.cp1y + 3 * mt * t2 * td.cp2y + t3 * td.endY;

            /// Para giros con constante, forzar el valor correspondiente
            if (td.keepConstant === 'X') {
                car.x = td.cp1x;  // Mantener X constante
            } else if (td.keepConstant === 'Y') {
                car.y = td.cp1y;  // Mantener Y constante
            }

            // Incremento de progreso más pequeño para giro más suave
            // Los vehículos largos giran más lento para mantener la trayectoria
            const LEFT_TURNS = new Set(['N-E', 'S-O', 'E-S', 'O-N']);
            const isLeftTurn = LEFT_TURNS.has(`${car.from}-${car.to}`);

            let turnSpeed;
            if (car.type === 'truck') {
                turnSpeed = isLeftTurn ? 0.007 : 0.04;
            } else if (car.type === 'van') {
                turnSpeed = isLeftTurn ? 0.007 : 0.04;
            } else {
                // car
                turnSpeed = isLeftTurn ? 0.007 : 0.06;
            }
            const newT = t + turnSpeed;

            if (newT >= 1) {
                // Giro completado
                car.x = td.endX;
                car.y = td.endY;
                car.direction = car.targetDirection;
                car.from = car.to;
                car.hasTurned = true;
                car.isTurning = false;
                delete car.turnProgress;
                delete car.turnStartX;
                delete car.turnStartY;
                delete car.turnData;
                delete car.startRotation;
            } else {
                car.turnProgress = newT;
            }
        } 
        else if (!car.isTurning) {
            // Movimiento recto normal
            switch(car.direction) {
                case 'S': car.y += CAR_SPEED; break;
                case 'N': car.y -= CAR_SPEED; break;
                case 'E': car.x += CAR_SPEED; break;
                case 'O': car.x -= CAR_SPEED; break;
            }
        }
    }

    updateCarTransform(car);

    // Eliminación por salida
    const outOfBounds =
        car.x < -100 || car.x > 1000 ||
        (car.direction === 'N' ? getFrontCoord(car) < -40 : car.y < -40) ||
        (car.direction === 'S' ? getFrontCoord(car) > 720 : car.y > 730);

    if (outOfBounds) {
        removeCar(car.id);
    }
}

// Actualizar la transformación SVG del coche
function updateCarTransform(car) {
    if (!car.element) return;

    let rotation;

    if (car.isTurning && car.turnData) {
        // Interpolación suave de rotación durante el giro
        const t = car.turnProgress;
        
        // Usar la misma función ease para la rotación
        const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        let endRotation;
        switch(car.targetDirection) {
            case 'S': endRotation = 90; break;
            case 'N': endRotation = -90; break;
            case 'E': endRotation = 0; break;
            case 'O': endRotation = 180; break;
            default: endRotation = car.startRotation || rotationForDirection(car.direction);
        }
        
        let startRot = car.startRotation || rotationForDirection(car.direction);
        
        // Calcular la diferencia más corta
        let delta = endRotation - startRot;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        // Interpolación lineal con ease
        rotation = startRot + delta * easeT;
    } else {
        // Movimiento recto: rotación según dirección actual
        rotation = rotationForDirection(car.direction);
    }

    car.element.setAttribute('transform', `translate(${car.x}, ${car.y}) rotate(${rotation})`);
}

// Eliminar coche del DOM y del array
function removeCar(carId) {
    const index = activeCars.findIndex(c => c.id === carId);
    if (index !== -1) {
        const car = activeCars[index];
        if (car.element && car.element.remove) car.element.remove();
        activeCars.splice(index, 1);
    }
}

// Bucle de animación
let animationFrameId = null;

function animate() {
    for (let i = 0; i < activeCars.length; i++) {
        moveCar(activeCars[i]);
    }
    animationFrameId = requestAnimationFrame(animate);
}

// =====================================================
// GESTIÓN DE VOLÚMENES Y GENERACIÓN
// =====================================================

function startGenerationForRoute(routeKey, volume) {
    if (generationIntervals[routeKey]) {
        clearInterval(generationIntervals[routeKey]);
        generationIntervals[routeKey] = null;
    }
    if (volume === 0) return;

    const route = sliderToRoute[routeKey];
    if (!route) return;

    const interval = getGenerationInterval(volume);
    if (!interval) return;

    generationIntervals[routeKey] = setInterval(() => {
        // Generar siempre que haya hueco físico en el spawn,
        // independientemente del estado del semáforo.
        // El coche avanzará y se detendrá solo en la línea de parada si hay rojo.
        if (!isSpawnBlocked(route.from, route.to)) {
            createCar(route.from, route.to, route.tlId);
        }
    }, interval);
}

function updateTrafficVolume(sliderId, value) {
    const route = sliderToRoute[sliderId];
    if (!route) return;

    const routeKey = `${route.from}-${route.to}`;
    trafficVolumes[routeKey] = value;

    const labelId = sliderId.replace('slider', 'label');
    const label = document.getElementById(labelId);
    if (label) label.textContent = value;

    startGenerationForRoute(sliderId, value);
}

function initSliders() {
    for (const [sliderId, route] of Object.entries(sliderToRoute)) {
        const slider = document.getElementById(sliderId);
        if (slider) {
            const routeKey = `${route.from}-${route.to}`;
            const initialValue = parseInt(slider.value, 10);
            trafficVolumes[routeKey] = initialValue;

            const labelId = sliderId.replace('slider', 'label');
            const label = document.getElementById(labelId);
            if (label) label.textContent = initialValue;

            slider.addEventListener('input', (e) => {
                const newValue = parseInt(e.target.value, 10);
                updateTrafficVolume(sliderId, newValue);
            });

            if (initialValue > 0) {
                startGenerationForRoute(sliderId, initialValue);
            }
        }
    }
}


// =====================================================
// LIMPIEZA
// =====================================================

function cleanup() {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    for (const interval of Object.values(generationIntervals)) {
        if (interval) clearInterval(interval);
    }
    for (const car of activeCars) {
        if (car.element && car.element.remove) car.element.remove();
    }
    activeCars = [];
}

// =====================================================
// INICIALIZACIÓN
// =====================================================

function init() {
    initSliders();
    animate();
    window.addEventListener('beforeunload', cleanup);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}