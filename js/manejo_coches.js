// =====================================================
// CONFIGURACIÓN Y VARIABLES GLOBALES
// =====================================================

//Sliders control volumen tráfico para cada dirección (origen -> destino)
const sliderToRoute = {
    // NORTE (origen)
    'slider-N-S': { from: 'N', to: 'S', lane: 'outer', tlId: 'tl-N-S' },
    'slider-N-O': { from: 'N', to: 'O', lane: 'inner', tlId: 'tl-N-O' },
    'slider-N-E': { from: 'N', to: 'E', lane: 'inner', tlId: 'tl-N-E' },
    // SUR (origen)
    'slider-S-N': { from: 'S', to: 'N', lane: 'outer', tlId: 'tl-S-N' },
    'slider-S-E': { from: 'S', to: 'E', lane: 'inner', tlId: 'tl-S-E' },
    'slider-S-O': { from: 'S', to: 'O', lane: 'inner', tlId: 'tl-S-O' },
    // OESTE (origen)
    'slider-O-E': { from: 'O', to: 'E', lane: 'outer', tlId: 'tl-O-E' },
    'slider-O-N': { from: 'O', to: 'N', lane: 'inner', tlId: 'tl-O-N' },
    'slider-O-S': { from: 'O', to: 'S', lane: 'inner', tlId: 'tl-O-S' },
    // ESTE (origen)
    'slider-E-O': { from: 'E', to: 'O', lane: 'outer', tlId: 'tl-E-O' },
    'slider-E-S': { from: 'E', to: 'S', lane: 'inner', tlId: 'tl-E-S' },
    'slider-E-N': { from: 'E', to: 'N', lane: 'inner', tlId: 'tl-E-N' }
};

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
const CAR_SPEED = 1.8;

// Distancia mínima de seguridad entre coches (px entre la parte delantera del de atrás y la trasera del de delante)
const MIN_SAFE_DISTANCE = 6;

// Tasa de generación base (milisegundos entre generaciones por unidad de volumen)
const BASE_GENERATION_INTERVAL = 1800; // 1.8 segundos para volumen 1
const MIN_GENERATION_INTERVAL = 300;   // 300ms para volumen 5

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

// Obtener el estado actual de un semáforo (true = verde/amarillo permitido, false = rojo)
function getTrafficLightState(tlId) {
    const tlElement = document.getElementById(tlId);
    const greenElement = tlElement.closest('g')?.querySelector('.tl-green');
    const amberElement = tlElement.closest('g')?.querySelector('.tl-amber');
    if (greenElement.classList.contains('on')) return true;
    if (amberElement.classList.contains('on')) return true;
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
function sameLane(carA, carB) {
    if (carA.direction !== carB.direction) return false;
    const LANE_TOL = 14; // px de tolerancia lateral
    if (carA.direction === 'S' || carA.direction === 'N') {
        return Math.abs(carA.x - carB.x) < LANE_TOL;
    } else {
        return Math.abs(carA.y - carB.y) < LANE_TOL;
    }
}

// Coordenada del extremo DELANTERO del vehículo (el que apunta hacia donde avanza).
// Usa el largo total (cuerpo + cabina) para que la cabina ocupe espacio real.
function getFrontCoord(car) {
    const len = getVehicleLength(car.type);
    switch(car.direction) {
        case 'S': return car.y + len;
        case 'N': return car.y;        // frente = menor y
        case 'E': return car.x + len;
        case 'O': return car.x;        // frente = menor x
    }
    return 0;
}

// Coordenada del extremo TRASERO del vehículo.
function getRearCoord(car) {
    const len = getVehicleLength(car.type);
    switch(car.direction) {
        case 'S': return car.y;
        case 'N': return car.y + len;
        case 'E': return car.x;
        case 'O': return car.x + len;
    }
    return 0;
}

// Calcula el hueco (en px) entre el frente de carA y la trasera de carB,
// asumiendo que carB está delante de carA en el mismo carril.
// Devuelve Infinity si carB no está delante.
function getGapToCarAhead(carA, carB) {
    if (!sameLane(carA, carB)) return Infinity;
    if (carB.isTurning) return Infinity; // coches girando no bloquean en línea recta

    const frontA = getFrontCoord(carA);
    const rearB  = getRearCoord(carB);

    switch(carA.direction) {
        case 'S': return (rearB > frontA) ? rearB - frontA : Infinity;
        case 'N': return (rearB < frontA) ? frontA - rearB : Infinity;
        case 'E': return (rearB > frontA) ? rearB - frontA : Infinity;
        case 'O': return (rearB < frontA) ? frontA - rearB : Infinity;
    }
    return Infinity;
}

// Devuelve true si el coche debe frenar/detenerse por el vehículo de delante.
// Se aplica tanto en movimiento como en parada (para que los coches cola
// respeten la distancia aunque el primero esté parado en rojo).
function shouldStopForCarAhead(car) {
    if (car.isTurning) return false; // durante giros no se aplica

    for (const other of activeCars) {
        if (other.id === car.id) continue;
        const gap = getGapToCarAhead(car, other);
        if (gap >= 0 && gap < MIN_SAFE_DISTANCE) return true;
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
            if (to === 'E') return { x: 320, y: -30, direction: 'S' };
            else            return { x: 260, y: -30, direction: 'S' };
        case 'S':
            if (to === 'O') return { x: 365, y: 700, direction: 'N' };
            else            return { x: 425, y: 700, direction: 'N' };
        case 'O':
            if (to === 'N') return { x: -30, y: 360, direction: 'E' };
            else            return { x: -30, y: 420, direction: 'E' };
        case 'E':
            if (to === 'S') return { x: 930, y: 310, direction: 'O' };
            else            return { x: 930, y: 260, direction: 'O' };
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
function createCar(from, to, lane, tlId) {
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
        hasTurned: false
    };

    activeCars.push(car);
    return car;
}

// =====================================================
// ACTUALIZACIÓN DE POSICIONES (ANIMACIÓN)
// =====================================================

// Verificar si un coche debe detenerse por semáforo rojo
function shouldStopAtTrafficLight(car) {
    const isGreen = getTrafficLightState(car.tlId);
    if (isGreen) {
        if (car.isStopped) car.isStopped = false;
        return false;
    }

    const stopZones = {
        'S': { axis: 'y', stopLine: 230, range: 20 },
        'N': { axis: 'y', stopLine: 450, range: 20 },
        'E': { axis: 'x', stopLine: 230, range: 20 },
        'O': { axis: 'x', stopLine: 450, range: 20 }
    };

    const zone = stopZones[car.direction];
    if (!zone) return false;

    const currentValue = zone.axis === 'x' ? car.x : car.y;

    // Si ya pasó la intersección, no detener
    let hasPassedIntersection = false;
    if (zone.axis === 'y') {
        if (car.direction === 'S' && currentValue > zone.stopLine + 30) hasPassedIntersection = true;
        else if (car.direction === 'N' && currentValue < zone.stopLine - 30) hasPassedIntersection = true;
    } else {
        if (car.direction === 'E' && currentValue > zone.stopLine + 30) hasPassedIntersection = true;
        else if (car.direction === 'O' && currentValue < zone.stopLine - 30) hasPassedIntersection = true;
    }
    if (hasPassedIntersection) return false;

    let isInStopZone = false;
    if (car.direction === 'S')      isInStopZone = currentValue >= (zone.stopLine - zone.range) && currentValue < zone.stopLine;
    else if (car.direction === 'N') isInStopZone = currentValue <= (zone.stopLine + zone.range) && currentValue > zone.stopLine;
    else if (car.direction === 'E') isInStopZone = currentValue >= (zone.stopLine - zone.range) && currentValue < zone.stopLine;
    else if (car.direction === 'O') isInStopZone = currentValue <= (zone.stopLine + zone.range) && currentValue > zone.stopLine;

    if (isInStopZone && !isGreen) {
        car.isStopped = true;
        return true;
    }
    return false;
}

function needsToTurn(car) {
    return car.direction !== car.targetDirection;
}

// Obtener datos del giro según ruta
function getTurnPoint(car) {
    const turnMap = {
        'N-S': null, 'S-N': null, 'O-E': null, 'E-O': null,

        // GIROS DERECHA
        'N-O': { x: 260, y: 270, isCurved: false },
        'S-E': { x: 425, y: 415, isCurved: false },
        'E-N': { x: 420, y: 260, isCurved: false },
        'O-S': { x: 260, y: 420, isCurved: false },

        // GIROS IZQUIERDA (Bézier cúbica)
        'N-E': { cp1x: 320, cp1y: 380, cp2x: 390, cp2y: 360, endX: 450, endY: 360, isCurved: true },
        'S-O': { cp1x: 365, cp1y: 300, cp2x: 290, cp2y: 310, endX: 230, endY: 310, isCurved: true },
        'E-S': { cp1x: 300, cp1y: 310, cp2x: 310, cp2y: 370, endX: 310, endY: 450, isCurved: true },
        'O-N': { cp1x: 390, cp1y: 360, cp2x: 365, cp2y: 300, endX: 365, endY: 230, isCurved: true }
    };
    return turnMap[`${car.from}-${car.to}`];
}

// Función principal de movimiento
function moveCar(car) {
    if (!car.active) return;

    // ── 1. Evaluar semáforo ──────────────────────────────────────────────────
    // shouldStopAtTrafficLight actualiza car.isStopped internamente.
    const blockedByLight = shouldStopAtTrafficLight(car);

    // ── 2. Evaluar distancia de seguridad ────────────────────────────────────
    // Se comprueba siempre (también cuando el coche está parado por semáforo),
    // para que los vehículos en cola mantengan la distancia aunque el primero
    // esté detenido en rojo.
    const blockedByCar = shouldStopForCarAhead(car);

    // El coche avanza solo si no está bloqueado por semáforo NI por el de delante.
    const canMove = !blockedByLight && !car.isStopped && !blockedByCar;

    if (canMove) {
        // Iniciar giro si procede
        if (!car.hasTurned && needsToTurn(car)) {
            const turnData = getTurnPoint(car);
            let shouldStartTurn = false;

            switch(car.from) {
                case 'N': shouldStartTurn = car.y >= 250 && car.y <= 280; break;
                case 'S': shouldStartTurn = car.y <= 430 && car.y >= 400; break;
                case 'E': shouldStartTurn = car.x <= 420 && car.x >= 390; break;
                case 'O': shouldStartTurn = car.x >= 260 && car.x <= 290; break;
            }

            if (shouldStartTurn && turnData && turnData.isCurved && !car.isTurning) {
                car.isTurning = true;
                car.turnProgress = 0;
                car.turnStartX = car.x;
                car.turnStartY = car.y;
                car.turnData = turnData;
            } else if (shouldStartTurn && turnData && !turnData.isCurved && !car.isTurning) {
                car.isTurning = true;
                car.targetPoint = { x: turnData.x, y: turnData.y };
            }
        }

        // Procesar movimiento
        if (car.isTurning) {
            if (car.turnData && car.turnData.isCurved) {
                const t  = car.turnProgress;
                const td = car.turnData;
                const t2 = t * t, t3 = t2 * t;
                const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;

                car.x = mt3 * car.turnStartX + 3 * mt2 * t * td.cp1x + 3 * mt * t2 * td.cp2x + t3 * td.endX;
                car.y = mt3 * car.turnStartY + 3 * mt2 * t * td.cp1y + 3 * mt * t2 * td.cp2y + t3 * td.endY;

                const newT = t + 0.025;
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
                } else {
                    car.turnProgress = newT;
                }
            } else if (car.targetPoint) {
                const dx = car.targetPoint.x - car.x;
                const dy = car.targetPoint.y - car.y;
                const distance = Math.sqrt(dx*dx + dy*dy);

                if (distance < CAR_SPEED) {
                    car.x = car.targetPoint.x;
                    car.y = car.targetPoint.y;
                    car.direction = car.targetDirection;
                    car.from = car.to;
                    car.hasTurned = true;
                    car.isTurning = false;
                    delete car.targetPoint;
                } else {
                    const ratio = CAR_SPEED / distance;
                    car.x += dx * ratio;
                    car.y += dy * ratio;
                }
            }
        } else {
            // Movimiento recto libre
            switch(car.direction) {
                case 'S': car.y += CAR_SPEED; break;
                case 'N': car.y -= CAR_SPEED; break;
                case 'E': car.x += CAR_SPEED; break;
                case 'O': car.x -= CAR_SPEED; break;
            }
        }
    }

    updateCarTransform(car);

    if (car.x < -100 || car.x > 1000 || car.y < -50 || car.y > 750) {
        removeCar(car.id);
    }
}

// Actualizar la transformación SVG del coche
function updateCarTransform(car) {
    if (!car.element) return;

    let rotation;

    if (car.isTurning && car.turnData && car.turnData.isCurved) {
        // Durante el giro curvo (izquierda): mantener orientación de origen
        // El giro visual lo da la trayectoria Bézier
        rotation = rotationForDirection(car.direction);
    } else {
        // En recta o tras completar el giro: orientación según dirección actual
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
        const isGreen = getTrafficLightState(route.tlId);
        if (isGreen) {
            createCar(route.from, route.to, route.lane, route.tlId);
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
// OBSERVACIÓN DE CAMBIOS EN SEMÁFOROS
// =====================================================

function forceCarsUpdate() {
    // shouldStopAtTrafficLight se reevalúa en cada frame; nada extra necesario
}

function observeTrafficLights() {
    const tlIds = [
        'tl-N-S', 'tl-N-O', 'tl-N-E',
        'tl-S-N', 'tl-S-E', 'tl-S-O',
        'tl-O-E', 'tl-O-N', 'tl-O-S',
        'tl-E-O', 'tl-E-S', 'tl-E-N'
    ];
    tlIds.forEach(tlId => {
        const tlElement = document.getElementById(tlId);
        if (tlElement) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        forceCarsUpdate();
                    }
                });
            });
            observer.observe(tlElement, { attributes: true });
        }
    });
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
    observeTrafficLights();
    animate();
    window.addEventListener('beforeunload', cleanup);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}