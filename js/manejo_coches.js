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
const amberOnTimestamps = {};

// Volumen tráfico inicial es 0
let trafficVolumes = {
    'N-S': 0, 'N-O': 0, 'N-E': 0,
    'S-N': 0, 'S-E': 0, 'S-O': 0,
    'O-E': 0, 'O-N': 0, 'O-S': 0,
    'E-O': 0, 'E-S': 0, 'E-N': 0
};

let activeCars = [];
let carIdCounter = 0;
let generationIntervals = {};

const CAR_SPEED = 1.2;
const MIN_SAFE_DISTANCE = 10;
const BASE_GENERATION_INTERVAL = 1800;
const MIN_GENERATION_INTERVAL = 100;

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function getGenerationInterval(volume) {
    if (volume === 0) return null;
    const interval = BASE_GENERATION_INTERVAL / volume;
    return Math.max(MIN_GENERATION_INTERVAL, interval);
}

function getRandomCarColor() {
    const hue = Math.random() * 360;
    return `hsl(${hue}, 75%, 55%)`;
}

function getRandomVehicleType() {
    const r = Math.random();
    if (r < 0.60) return 'car';
    if (r < 0.90) return 'van';
    return 'truck';
}

function getVehicleDimensions(type) {
    switch(type) {
        case 'van':   return { h: 12, w: 22, rx: 4 };
        case 'truck': return { h: 15, w: 35, rx: 2 };
        case 'car':
        default:      return { h: 10, w: 16, rx: 4 };
    }
}

const AMBER_DURATION_MS = 5000;
const AMBER_RED_MARGIN_MS = 1000;

function getTrafficLightState(tlId) {
    const tlGroup = document.getElementById(tlId)?.closest('g');
    if (!tlGroup) return false;
    const greenEl = tlGroup.querySelector('.tl-green');
    const amberEl = tlGroup.querySelector('.tl-amber');

    if (greenEl && greenEl.classList.contains('on')) {
        delete amberOnTimestamps[tlId];
        return true;
    }

    if (amberEl && amberEl.classList.contains('on')) {
        if (!amberOnTimestamps[tlId]) {
            amberOnTimestamps[tlId] = Date.now();
        }
        const elapsed = Date.now() - amberOnTimestamps[tlId];
        if (elapsed >= AMBER_DURATION_MS - AMBER_RED_MARGIN_MS) return false;
        return true;
    }

    delete amberOnTimestamps[tlId];
    return false;
}

// =====================================================
// DISTANCIA DE SEGURIDAD
// =====================================================

function getVehicleLength(type) {
    switch(type) {
        case 'van':   return 22 + 7;
        case 'truck': return 35 + 10;
        case 'car':
        default:      return 16;
    }
}

function sameLane(carA, carB) {
    if (carA.direction !== carB.direction) return false;
    const LANE_TOL = 14;
    if (carA.direction === 'S' || carA.direction === 'N') {
        return Math.abs(carA.x - carB.x) < LANE_TOL;
    } else {
        return Math.abs(carA.y - carB.y) < LANE_TOL;
    }
}

function getFrontCoord(car) {
    const len = getVehicleLength(car.type);
    switch (car.direction) {
        case 'S': return car.y + len;
        case 'N': return car.y - len;
        case 'E': return car.x + len;
        case 'O': return car.x - len;
    }
    return 0;
}

function getRearCoord(car) {
    switch (car.direction) {
        case 'S': return car.y;
        case 'N': return car.y;
        case 'E': return car.x;
        case 'O': return car.x;
    }
    return 0;
}

function getGapToCarAhead(carA, carB) {
    if (!sameLane(carA, carB)) return Infinity;

    if (carB.isTurning) {
        const lateralSep = (carA.direction === 'S' || carA.direction === 'N')
            ? Math.abs(carA.x - carB.x)
            : Math.abs(carA.y - carB.y);
        if (lateralSep > 8) return Infinity;
    }

    const frontA = getFrontCoord(carA);
    const rearB  = getRearCoord(carB);

    switch (carA.direction) {
        case 'S': return rearB > frontA ? rearB - frontA : Infinity;
        case 'N': return rearB < frontA ? frontA - rearB : Infinity;
        case 'E': return rearB > frontA ? rearB - frontA : Infinity;
        case 'O': return rearB < frontA ? frontA - rearB : Infinity;
    }
    return Infinity;
}

function shouldStopForCarAhead(car) {
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

function isSpawnBlocked(from, to) {
    const startPos = getStartPosition(from, to);
    if (!startPos) return false;
    const SPAWN_CLEARANCE = 55;

    for (const other of activeCars) {
        if (other.direction !== startPos.direction) continue;
        const LANE_TOL = 14;
        if (startPos.direction === 'S' || startPos.direction === 'N') {
            if (Math.abs(other.x - startPos.x) >= LANE_TOL) continue;
        } else {
            if (Math.abs(other.y - startPos.y) >= LANE_TOL) continue;
        }
        const rearOther = getRearCoord(other);
        switch(startPos.direction) {
            case 'S':
                if (rearOther < startPos.y + SPAWN_CLEARANCE) return true;
                break;
            case 'N':
                if (rearOther > startPos.y - SPAWN_CLEARANCE) return true;
                break;
            case 'E':
                if (rearOther < startPos.x + SPAWN_CLEARANCE) return true;
                break;
            case 'O':
                if (rearOther > startPos.x - SPAWN_CLEARANCE) return true;
                break;
        }
    }
    return false;
}

// =====================================================
// CAPACIDAD DE LA ZONA DE COLA (entre cebra y stop line)
// =====================================================
//
// El espacio entre el paso de cebra y la línea de stop del semáforo
// principal tiene una capacidad física limitada. Si ese espacio está
// lleno, los vehículos que llegan deben detenerse ANTES del cebra,
// no en él ni dentro de él.
//
// Zona de cola por dirección (coordenada del eje de avance):
//   S → y ∈ [82, 230]   (cebra norte termina en y≈80, stop en y=230)
//   N → y ∈ [450, 578]  (stop en y=450, cebra sur empieza en y≈580)
//   E → x ∈ [82, 230]   (cebra oeste termina en x≈80, stop en x=230)
//   O → x ∈ [450, 588]  (stop en x=450, cebra este empieza en x≈590)
//
// Espacio útil ≈ 148 px. La capacidad efectiva descuenta un hueco de
// seguridad por vehículo: QUEUE_CAPACITY_PX = 138 px.
//
// Longitudes de vehículo (incluyendo cabina):
//   car   → 16 px
//   van   → 29 px
//   truck → 45 px
//
// Esto hace que las siguientes combinaciones llenen la zona:
//   2 camiones + cualquier otro → no caben (45+10 + 45+10 = 110; + 16+10 > 138)
//   1 camión + 4 coches         → no caben (45+10 + (16+10)×3 + 16 = 149 > 138)
//   5 coches + 1 furgoneta      → no caben ((16+10)×4 + 16+10 + 29 = 159 > 138)
//   5 coches                    → el 6.º no cabe ((16+10)×4 + 16 = 120; +16+10 = 146 > 138)

const QUEUE_CAPACITY_PX = 138;

// Límites de la zona de cola por dirección (coordenada del eje de avance)
const QUEUE_ZONE = {
    'S': { axisMin: 82,  axisMax: 230 },
    'N': { axisMin: 450, axisMax: 578 },
    'E': { axisMin: 82,  axisMax: 230 },
    'O': { axisMin: 450, axisMax: 588 }
};

// Zona entre el paso de cebra Este y las vías del tren, para vehículos
// en dirección O (avanzan a x decreciente: frente = car.x - len).
// Cebra Este termina en x≈620, vías empiezan en x≈751.
// Espacio útil ≈ 131 px → misma capacidad que QUEUE_CAPACITY_PX (138 px).
const TRAIN_QUEUE_ZONE_O = { axisMin: 621, axisMax: 745 };

/**
 * Calcula los px ocupados en la zona de cola para el carril de `car`.
 * Suma la longitud solapada de cada vehículo ya en esa zona más un
 * hueco de seguridad por cada uno.
 */
function getQueueOccupancy(direction, laneCoord) {
    const zone = QUEUE_ZONE[direction];
    if (!zone) return 0;

    const LANE_TOL = 14;
    let occupied = 0;

    for (const other of activeCars) {
        if (other.direction !== direction) continue;
        if (other.hasTurned) continue;

        const lateral = (direction === 'S' || direction === 'N') ? other.x : other.y;
        if (Math.abs(lateral - laneCoord) >= LANE_TOL) continue;

        const len = getVehicleLength(other.type);
        let bodyMin, bodyMax;
        if (direction === 'S' || direction === 'E') {
            bodyMin = (direction === 'S') ? other.y : other.x;
            bodyMax = bodyMin + len;
        } else {
            const anchor = (direction === 'N') ? other.y : other.x;
            bodyMax = anchor;
            bodyMin = anchor - len;
        }

        const overlapMin = Math.max(bodyMin, zone.axisMin);
        const overlapMax = Math.min(bodyMax, zone.axisMax);
        if (overlapMax > overlapMin) {
            occupied += (overlapMax - overlapMin) + MIN_SAFE_DISTANCE;
        }
    }

    return occupied;
}

/**
 * Devuelve true si la zona de cola del carril de `car` no tiene espacio
 * para albergar un vehículo adicional de ese tipo.
 */
function isQueueZoneFull(car) {
    const zone = QUEUE_ZONE[car.direction];
    if (!zone) return false;

    const laneCoord = (car.direction === 'S' || car.direction === 'N') ? car.x : car.y;
    const occupied  = getQueueOccupancy(car.direction, laneCoord);
    const needed    = getVehicleLength(car.type) + MIN_SAFE_DISTANCE;

    return (occupied + needed) > QUEUE_CAPACITY_PX;
}

/**
 * Calcula los px ocupados en la zona entre el cebra Este y las vías del tren
 * para vehículos en dirección O en el carril dado (coord y).
 */
function getTrainQueueOccupancyO(laneCoord) {
    const zone = TRAIN_QUEUE_ZONE_O;
    const LANE_TOL = 14;
    let occupied = 0;

    for (const other of activeCars) {
        if (other.direction !== 'O') continue;

        const lateral = other.y;
        if (Math.abs(lateral - laneCoord) >= LANE_TOL) continue;

        const len = getVehicleLength(other.type);
        // Dir O: frente = car.x - len (x decreciente), trasera = car.x
        const bodyMin = other.x - len;
        const bodyMax = other.x;

        const overlapMin = Math.max(bodyMin, zone.axisMin);
        const overlapMax = Math.min(bodyMax, zone.axisMax);
        if (overlapMax > overlapMin) {
            occupied += (overlapMax - overlapMin) + MIN_SAFE_DISTANCE;
        }
    }

    return occupied;
}

/**
 * Devuelve true si la zona entre el cebra Este y las vías del tren
 * no tiene espacio para un vehículo adicional (dirección O).
 */
function isTrainQueueZoneFull(car) {
    if (car.direction !== 'O') return false;
    const occupied = getTrainQueueOccupancyO(car.y);
    const needed   = getVehicleLength(car.type) + MIN_SAFE_DISTANCE;
    return (occupied + needed) > QUEUE_CAPACITY_PX;
}

// =====================================================
// GENERACIÓN DE COCHES
// =====================================================

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

function rotationForDirection(dir) {
    switch(dir) {
        case 'S': return 90;
        case 'N': return -90;
        case 'E': return 0;
        case 'O': return 180;
        default:  return 0;
    }
}

function createCar(from, to, tlId) {
    const startPos = getStartPosition(from, to);

    const color = getRandomCarColor();
    const type  = getRandomVehicleType();
    const dim   = getVehicleDimensions(type);
    const carId = `car-${carIdCounter++}`;

    const vehiclesLayer = document.getElementById('layer-vehicles');
    const carGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    carGroup.setAttribute('id', carId);
    carGroup.setAttribute('class', 'car');
    carGroup.setAttribute('data-from', from);
    carGroup.setAttribute('data-to', to);
    carGroup.setAttribute('data-tl-id', tlId);

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
    vehiclesLayer.appendChild(carGroup);

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
        targetDirection: to,
        hasTurned: false,
        wasStoppedByExtraLight: false
    };

    activeCars.push(car);
    return car;
}

// =====================================================
// ACTUALIZACIÓN DE POSICIONES (ANIMACIÓN)
// =====================================================

const STOP_LINES = { 'S': 230, 'N': 450, 'E': 230, 'O': 450 };

const FORBIDDEN_ZONES = {
    'S': [{ coord: 'y', min: 50,  max: 80  }],
    'N': [{ coord: 'y', min: 580, max: 610 }],
    'E': [{ coord: 'x', min: 50,  max: 80  },
          { coord: 'x', min: 751, max: 790 }],
    'O': [{ coord: 'x', min: 590, max: 620 },
          { coord: 'x', min: 751, max: 790 }]
};

function isInForbiddenZone(car) {
    const zones = FORBIDDEN_ZONES[car.direction];
    if (!zones) return false;
    const len = getVehicleLength(car.type);

    for (const z of zones) {
        let bodyMin, bodyMax;
        if (z.coord === 'y') {
            bodyMin = (car.direction === 'S') ? car.y       : car.y - len;
            bodyMax = (car.direction === 'S') ? car.y + len : car.y;
        } else {
            bodyMin = (car.direction === 'E') ? car.x       : car.x - len;
            bodyMax = (car.direction === 'E') ? car.x + len : car.x;
        }
        if (bodyMax > z.min && bodyMin < z.max) return true;
    }
    return false;
}

function getExtraStopChecks(car) {
    const checks = [];
    const front = getFrontCoord(car);

    switch (car.direction) {

        case 'S':
            if (!car.hasTurned && front < 82) {
                checks.push({ tlId: 'tlp-N-O', stopLine: 48 });
                checks.push({ tlId: 'tlp-N-E', stopLine: 48 });
            }
            if (front > 568 && front < 600) {
                if(car.from=='N'){
                    car.hasTurned = true;
                }
                checks.push({ tlId: 'tlp-S-O', stopLine: 575 });
                checks.push({ tlId: 'tlp-S-E', stopLine: 575 });
            }
            break;

        case 'N':
            if (!car.hasTurned && front > 578) {
                checks.push({ tlId: 'tlp-S-O', stopLine: 612 });
                checks.push({ tlId: 'tlp-S-E', stopLine: 612 });
            }
            if (front < 100 && front > 66) {
                if(car.from=='S'){
                    car.hasTurned = true;
                }
                checks.push({ tlId: 'tlp-N-O', stopLine: 88 });
                checks.push({ tlId: 'tlp-N-E', stopLine: 88 });
            }
            break;

        case 'E':
            if (!car.hasTurned && front < 82) {
                checks.push({ tlId: 'tlp-O-N', stopLine: 48 });
                checks.push({ tlId: 'tlp-O-S', stopLine: 48 });
            }
            if (front > 680 && front < 793) {
                checks.push({ tlId: 'rail-tl-N', stopLine: 744 });
            }
            if (front > 568 && front < 600) {
                if(car.from=='O'){
                    car.hasTurned = true;
                }
                checks.push({ tlId: 'tlp-E-N', stopLine: 585 });
                checks.push({ tlId: 'tlp-E-S', stopLine: 585 });
            }
            break;

        case 'O':
            if (!car.hasTurned && front > 588) {
                checks.push({ tlId: 'tlp-E-N', stopLine: 622 });
                checks.push({ tlId: 'tlp-E-S', stopLine: 622 });
            }
            if (front < 805 && front > 680) {
                checks.push({ tlId: 'rail-tl-S', stopLine: 802 });
            }
            if (front < 100 && front > 66) {
                if(car.from=='E'){
                    car.hasTurned = true;
                }
                checks.push({ tlId: 'tlp-O-N', stopLine: 88 });
                checks.push({ tlId: 'tlp-O-S', stopLine: 88 });
            }
            break;
    }
    
    return checks;
}

// Conjunto de IDs de semáforos peatonales, para distinguirlos de los ferroviarios
const PEDESTRIAN_TL_IDS = new Set([
    'tlp-N-O', 'tlp-N-E',
    'tlp-S-O', 'tlp-S-E',
    'tlp-O-N', 'tlp-O-S',
    'tlp-E-N', 'tlp-E-S'
]);

function checkExtraLight(car, tlId, stopLine) {
    
    const isGreen = getTrafficLightState(tlId);

    // Para semáforos peatonales: bloquear también si la zona de cola está llena,
    // aunque el semáforo esté en verde. Así los vehículos se paran antes del
    // cebra en lugar de quedarse encima de él.
    const esPeatonal = PEDESTRIAN_TL_IDS.has(tlId);
    const colaLlena  = esPeatonal && !car.hasTurned && isQueueZoneFull(car);

    // Para el semáforo ferroviario en dir O: bloquear también si la zona entre
    // el cebra Este y las vías está llena, para evitar coches parados en esa banda.
    const esTrenO = (tlId === 'rail-tl-S') && car.direction === 'O';
    const colaTrenLlena = esTrenO && isTrainQueueZoneFull(car);

    if (isGreen && !colaLlena && !colaTrenLlena) return false;

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
        case 'O': car.x = stopLine + len; break;  // front = car.x - len = stopLine ✓
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
            return false;
        }

        return true;
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

            let pastLine = false;
            switch (car.direction) {
                case 'S': pastLine = front > stopLine + 10; break;
                case 'N': pastLine = front < stopLine - 10; break;
                case 'E': pastLine = front > stopLine + 10; break;
                case 'O': pastLine = front < stopLine - 10; break;
            }

            if (!pastLine) {
                let beforeLine = false;
                switch (car.direction) {
                    case 'S': beforeLine = front < stopLine; break;
                    case 'N': beforeLine = front > stopLine; break;
                    case 'E': beforeLine = front < stopLine; break;
                    case 'O': beforeLine = front > stopLine; break;
                }
                if (!beforeLine) {
                    switch (car.direction) {
                        case 'S': car.y = stopLine - len; break;
                        case 'N': car.y = stopLine + len; break;
                        case 'E': car.x = stopLine - len; break;
                        case 'O': car.x = stopLine + len; break;
                    }
                    car.isStopped = true;
                    return true;
                }
            }
        }
    }

    // ── 2. Semáforos peatonales y ferroviarios ───────────────────────────────
    const extraChecks = getExtraStopChecks(car);
    for (const { tlId, stopLine } of extraChecks) {
        if (checkExtraLight(car, tlId, stopLine)) {
            return true;
        }
    }

    if (isGreen) car.isStopped = false;

    return false;
}

function needsToTurn(car) {
    return car.direction !== car.targetDirection;
}

function getTurnPoint(car) {

    const turnMap = {
        'N-S': null, 'S-N': null, 'O-E': null, 'E-O': null,

        'N-O': { 
            cp1x: 260, cp1y: 245,
            cp2x: 260, cp2y: 260,
            endX: 260, endY: 260,
            keepConstant: 'X'
        },
        'S-E': { 
            cp1x: 420, cp1y: 435,
            cp2x: 420, cp2y: 420,
            endX: 420, endY: 420,
            keepConstant: 'X'
        },
        'E-N': { 
            cp1x: 440, cp1y: 260,
            cp2x: 425, cp2y: 260,
            endX: 425, endY: 260,
            keepConstant: 'Y'
        },
        'O-S': { 
            cp1x: 245, cp1y: 420,
            cp2x: 260, cp2y: 420,
            endX: 260, endY: 420,
            keepConstant: 'Y'
        },
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

function shouldStartTurn(car) {
    if (car.hasTurned || !needsToTurn(car)) return false;
    
    const turnData = getTurnPoint(car);
    if (!turnData) return false;
    
    const front = getFrontCoord(car);
    
    const turnThresholds = {
        'S': { start: 230, end: 280 },
        'N': { start: 450, end: 400 },
        'E': { start: 230, end: 280 },
        'O': { start: 450, end: 400 }
    };
    
    const thresholds = turnThresholds[car.direction];
    if (!thresholds) return false;
    
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
            break;
    }
    
    if (car.direction === 'S' || car.direction === 'E') {
        return front >= startThreshold && front <= endThreshold;
    } else {
        return front <= startThreshold && front >= endThreshold;
    }
}

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

            let nextX = car.x, nextY = car.y;
            switch(car.direction) {
                case 'S': nextY = car.y + CAR_SPEED; break;
                case 'N': nextY = car.y - CAR_SPEED; break;
                case 'E': nextX = car.x + CAR_SPEED; break;
                case 'O': nextX = car.x - CAR_SPEED; break;
            }

            let beyondStop = false;
            switch(car.direction) {
                case 'S': beyondStop = (nextY + vehicleLen >= stopLine); break;
                case 'N': beyondStop = (nextY - vehicleLen <= stopLine); break;
                case 'E': beyondStop = (nextX + vehicleLen >= stopLine); break;
                case 'O': beyondStop = (nextX - vehicleLen <= stopLine); break;
            }

            const testCar = Object.assign({}, car, { x: nextX, y: nextY });
            const wouldEnterForbidden = isInForbiddenZone(testCar);
            const alreadyInForbidden = isInForbiddenZone(car);

            if (!beyondStop && (!wouldEnterForbidden || alreadyInForbidden)) {
                car.x = nextX;
                car.y = nextY;
            }
        }
    }

    if (canMove) {
        if (!car.hasTurned && needsToTurn(car)) {
            if (shouldStartTurn(car) && !car.isTurning) {
                const turnData = getTurnPoint(car);
                if (turnData) {
                    car.isTurning = true;
                    car.turnProgress = 0;
                    car.turnStartX = car.x;
                    car.turnStartY = car.y;
                    car.turnData = turnData;
                    car.startRotation = rotationForDirection(car.direction);
                }
            }
        }

        if (car.isTurning && car.turnData) {
            const t = car.turnProgress;
            const td = car.turnData;
            
            const easeT = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            
            const t2 = easeT * easeT;
            const t3 = t2 * easeT;
            const mt = 1 - easeT;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;

            car.x = mt3 * car.turnStartX + 3 * mt2 * easeT * td.cp1x + 3 * mt * t2 * td.cp2x + t3 * td.endX;
            car.y = mt3 * car.turnStartY + 3 * mt2 * easeT * td.cp1y + 3 * mt * t2 * td.cp2y + t3 * td.endY;

            if (td.keepConstant === 'X') {
                car.x = td.cp1x;
            } else if (td.keepConstant === 'Y') {
                car.y = td.cp1y;
            }

            const LEFT_TURNS = new Set(['N-E', 'S-O', 'E-S', 'O-N']);
            const isLeftTurn = LEFT_TURNS.has(`${car.from}-${car.to}`);

            let turnSpeed;
            if (car.type === 'truck') {
                turnSpeed = isLeftTurn ? 0.007 : 0.04;
            } else if (car.type === 'van') {
                turnSpeed = isLeftTurn ? 0.007 : 0.04;
            } else {
                turnSpeed = isLeftTurn ? 0.007 : 0.06;
            }
            const newT = t + turnSpeed;

            if (newT >= 1) {
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
            switch(car.direction) {
                case 'S': car.y += CAR_SPEED; break;
                case 'N': car.y -= CAR_SPEED; break;
                case 'E': car.x += CAR_SPEED; break;
                case 'O': car.x -= CAR_SPEED; break;
            }
        }
    }

    updateCarTransform(car);

    const outOfBounds =
        car.x < -100 || car.x > 1000 ||
        (car.direction === 'N' ? getFrontCoord(car) < -40 : car.y < -40) ||
        (car.direction === 'S' ? getFrontCoord(car) > 720 : car.y > 730);

    if (outOfBounds) {
        removeCar(car.id);
    }
}

function updateCarTransform(car) {
    if (!car.element) return;

    let rotation;

    if (car.isTurning && car.turnData) {
        const t = car.turnProgress;
        
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
        
        let delta = endRotation - startRot;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        
        rotation = startRot + delta * easeT;
    } else {
        rotation = rotationForDirection(car.direction);
    }

    car.element.setAttribute('transform', `translate(${car.x}, ${car.y}) rotate(${rotation})`);
}

function removeCar(carId) {
    const index = activeCars.findIndex(c => c.id === carId);
    if (index !== -1) {
        const car = activeCars[index];
        if (car.element && car.element.remove) car.element.remove();
        activeCars.splice(index, 1);
    }
}

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