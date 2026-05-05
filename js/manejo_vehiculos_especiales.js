// =====================================================
// VEHÍCULOS ESPECIALES (EMERGENCIAS)
// Requiere: manejo_coches.js cargado antes que este archivo
// =====================================================

let emergencyVehicles = [];
let activeEmergencyRoutes = [];  // [{ from, to, carId, blockedDirections }]

const EMERGENCY_TYPES = {
    ambulance: { bodyColor: '#ffffff', accentColor: '#cc0000', label: 'A', lightColor: '#cc0000' },
    police:    { bodyColor: '#0033ff', accentColor: '#ffffff', label: 'P', lightColor: '#00cfff' },
    fire:      { bodyColor: '#cc2200', accentColor: '#ffcc00', label: 'F', lightColor: '#ffcc00' }
};

// =====================================================
// CARRILES NORMALES — referencia lateral fija por dirección de spawn
// =====================================================

const YIELD_OFFSET = 14;
const YIELD_LERP   = 0.08;

// Distancia máxima (en px en el eje de avance) desde la que un coche
// ordinario empieza a apartarse cuando la emergencia se aproxima.
const PROXIMITY_YIELD_DISTANCE = 120;

function yieldSign(direction) {
    return { S: -1, N: +1, E: -1, O: +1 }[direction] ?? 0;
}

/**
 * Devuelve la dirección de avance que usa la emergencia en cada tramo de su ruta.
 */
function getEmergencyFlowDirections(route) {
    const { from, to } = route;
    if (from === to) return [];
    if (from === 'N' && to === 'S') return ['S'];
    if (from === 'S' && to === 'N') return ['N'];
    if (from === 'E' && to === 'O') return ['O'];
    if (from === 'O' && to === 'E') return ['E'];
    const straightDir = { N: 'S', S: 'N', E: 'O', O: 'E' }[from];
    const turnDir = to;
    return [straightDir, turnDir];
}

/**
 * Calcula la distancia (en px, en el eje de avance compartido) entre
 * el frente del vehículo de emergencia y la trasera del coche ordinario.
 * Retorna Infinity si la emergencia ya está por delante del coche,
 * o si no pertenecen al mismo carril/dirección.
 *
 * Un valor positivo pequeño significa que la emergencia está cerca
 * y por detrás del coche → el coche debe apartarse.
 * Un valor negativo significa que la emergencia ya adelantó al coche
 * → el coche puede volver a su posición original.
 */
function emergencyDistanceToCar(car, emgCar) {
    if (emgCar.direction !== car.direction) return Infinity;

    const emgFront = getFrontCoord(emgCar);
    const carRear  = getRearCoord(car);

    switch (car.direction) {
        case 'S': return carRear - emgFront;  // positivo si emg está detrás
        case 'N': return emgFront - carRear;  // positivo si emg está detrás (N avanza con y decreciente)
        case 'E': return carRear - emgFront;
        case 'O': return emgFront - carRear;
    }
    return Infinity;
}

/**
 * True si `car` debe apartarse lateralmente por la emergencia `route`.
 *
 * Se comprueban los DOS tramos de la ruta de forma independiente,
 * usando la referencia lateral correcta para cada uno:
 *
 * TRAMO A — antes de girar (dirección de spawn):
 *   Referencia lateral: posición de spawn del vehículo de emergencia.
 *   Solo se activa cuando la emergencia todavía no ha girado Y está
 *   a menos de PROXIMITY_YIELD_DISTANCE px por detrás del coche
 *   (efecto ola: solo los coches cercanos reaccionan en cada momento).
 *
 * TRAMO B — después de girar (dirección de destino):
 *   Referencia lateral: posición actual de la emergencia en su eje
 *   lateral (es decir, el carril que ocupa tras el giro).
 *   Solo se activa cuando la emergencia ya ha girado Y está a menos de
 *   PROXIMITY_YIELD_DISTANCE px por detrás del coche.
 *
 * En ambos casos, cuando la emergencia ya ha adelantado al coche
 * (dist ≤ 0), getTargetLateral devuelve _baseLateral y el coche
 * vuelve suavemente a su posición original.
 */
function isSameLaneAsEmergency(car, route) {
    const LANE_TOL = 22;

    const emgCar = emergencyVehicles.find(e => e.id === route.carId);
    if (!emgCar) return false;

    // ── TRAMO A: emergencia en su tramo inicial (no ha girado aún) ────────────
    if (!emgCar.hasTurned && emgCar.direction === car.direction) {
        // Referencia lateral: spawn de la emergencia
        const startPos = getStartPosition(route.from, route.to);
        if (!startPos) return false;

        const carLateral = car._baseLateral !== undefined
            ? car._baseLateral
            : (car.direction === 'S' || car.direction === 'N' ? car.x : car.y);

        const refLateral = (startPos.direction === 'S' || startPos.direction === 'N')
            ? startPos.x
            : startPos.y;

        if (Math.abs(carLateral - refLateral) < LANE_TOL) {
            const dist = emergencyDistanceToCar(car, emgCar);
            return dist > 0 && dist < PROXIMITY_YIELD_DISTANCE;
        }
    }

    // ── TRAMO B: emergencia tras el giro (hasTurned === true) ────────────────
    if (emgCar.hasTurned && emgCar.direction === car.direction) {
        // Referencia lateral: posición actual de la emergencia en su eje lateral
        const emgLateral = (emgCar.direction === 'S' || emgCar.direction === 'N')
            ? emgCar.x
            : emgCar.y;

        const carLateral = car._baseLateral !== undefined
            ? car._baseLateral
            : (car.direction === 'S' || car.direction === 'N' ? car.x : car.y);

        if (Math.abs(carLateral - emgLateral) < LANE_TOL) {
            const dist = emergencyDistanceToCar(car, emgCar);
            return dist > 0 && dist < PROXIMITY_YIELD_DISTANCE;
        }
    }

    return false;
}

/**
 * Devuelve la posición lateral objetivo para `car`:
 *  - Si hay una emergencia próxima en su carril → posición desplazada.
 *  - Si no → posición base (carril normal).
 *
 * El hecho de devolver siempre _baseLateral cuando no hay emergencia
 * garantiza que el coche vuelve suavemente a su posición en cuanto la
 * emergencia le adelanta (sin necesitar lógica adicional).
 */
function getTargetLateral(car) {
    if (car.isEmergency) return null;
    if (car._baseLateral === undefined) return null;

    const hasEmergency = activeEmergencyRoutes.some(r => isSameLaneAsEmergency(car, r));
    return hasEmergency
        ? car._baseLateral + yieldSign(car.direction) * YIELD_OFFSET
        : car._baseLateral;
}

function smoothLateral(car, target) {
    if (car.direction === 'S' || car.direction === 'N') {
        if (Math.abs(car.x - target) < 0.3) { car.x = target; return; }
        car.x += (target - car.x) * YIELD_LERP;
    } else {
        if (Math.abs(car.y - target) < 0.3) { car.y = target; return; }
        car.y += (target - car.y) * YIELD_LERP;
    }
}

function applyYieldDisplacements() {
    for (const car of activeCars) {
        if (car.isEmergency) continue;
        if (car.isTurning) continue;
        const target = getTargetLateral(car);
        if (target === null) continue;

        // Detectar si debe volver (target es base y está desplazado actualmente)
        const currentLateral = (car.direction === 'S' || car.direction === 'N') ? car.x : car.y;
        const isCurrentlyShifted = (currentLateral !== car._baseLateral);
        const shouldReturn = (target === car._baseLateral && isCurrentlyShifted);
        
        if (shouldReturn) {
            // Si está intentando volver pero tiene delay, esperar
            if (car.returnDelay === undefined) {
                car.returnDelay = 45;  // ~0.75 segundos a 60 FPS
            }
            
            if (car.returnDelay > 0) {
                car.returnDelay--;
                continue;  // No mover este frame, mantener posición
            }
        } else {
            // Resetear delay cuando no está volviendo
            car.returnDelay = undefined;
        }   

        smoothLateral(car, target);
    }
}

function buildEmergencyElement(type, carId) {
    const cfg = EMERGENCY_TYPES[type];
    const ns  = 'http://www.w3.org/2000/svg';
    const g   = document.createElementNS(ns, 'g');
    g.setAttribute('id', carId);
    g.setAttribute('class', 'car emergency');

    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('width', '20');  body.setAttribute('height', '12');
    body.setAttribute('rx', '3');
    body.setAttribute('fill', cfg.bodyColor);
    body.setAttribute('stroke', '#111'); body.setAttribute('stroke-width', '1');

    const stripe = document.createElementNS(ns, 'rect');
    stripe.setAttribute('x', '4');    stripe.setAttribute('y', '4');
    stripe.setAttribute('width', '9'); stripe.setAttribute('height', '4');
    stripe.setAttribute('fill', cfg.accentColor); stripe.setAttribute('opacity', '0.9');

    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '5');  text.setAttribute('y', '9');
    text.setAttribute('font-size', '7'); text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', cfg.bodyColor === '#ffffff' ? '#cc0000' : '#fff');
    text.textContent = cfg.label;

    const siren = document.createElementNS(ns, 'circle');
    siren.setAttribute('cx', '14'); siren.setAttribute('cy', '6');
    siren.setAttribute('r', '3');
    siren.setAttribute('fill', cfg.lightColor);
    siren.setAttribute('class', 'siren-light');
    siren.setAttribute('stroke', '#000'); siren.setAttribute('stroke-width', '0.5');

    g.appendChild(body); g.appendChild(stripe);
    g.appendChild(text); g.appendChild(siren);
    return g;
}

(function injectSirenCSS() {
    if (document.getElementById('emg-siren-style')) return;
    const s = document.createElement('style');
    s.id = 'emg-siren-style';
    s.textContent = `
        .siren-light { animation: sirenBlink 0.35s infinite alternate; }
        @keyframes sirenBlink { from { opacity:1; } to { opacity:0.1; } }
    `;
    document.head.appendChild(s);
})();

// =====================================================
// CREACIÓN
// =====================================================

function createEmergencyVehicle(from, to, type) {
    const startPos = getStartPosition(from, to);
    if (!startPos) return;

    const carId    = `emg-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const carGroup = buildEmergencyElement(type, carId);

    carGroup.setAttribute(
        'transform',
        `translate(${startPos.x},${startPos.y}) rotate(${rotationForDirection(startPos.direction)})`
    );
    document.getElementById('layer-vehicles').appendChild(carGroup);

    const car = {
        id:              carId,
        element:         carGroup,
        type:            'car',
        subtype:         type,
        from:            from,
        to:              to,
        tlId:            `tl-${from}-${to}`,
        direction:       startPos.direction,
        targetDirection: to,
        x:               startPos.x,
        y:               startPos.y,
        active:          true,
        isStopped:       false,
        isEmergency:     true,
        hasTurned:       false,
        wasStoppedByExtraLight: false,
        emergencySpeed:  CAR_SPEED * 1.8,
        _baseLateral: (startPos.direction === 'S' || startPos.direction === 'N') ? startPos.x : startPos.y
    };

    emergencyVehicles.push(car);
    activeCars.push(car);

    activateEmergencyRoute(from, to, carId);
}

// =====================================================
// PRIORIDAD — los coches perpendiculares se comportan como si tuvieran SEMÁFORO ROJO
// (pueden avanzar hasta la línea de stop, pero no cruzarla)
// =====================================================

function directionForFrom(from) {
    return { N:'S', S:'N', E:'O', O:'E' }[from] || null;
}

function activateEmergencyRoute(from, to, carId) {
    const blockedDirs = [];
    const allDirs = ['N', 'S', 'E', 'O'];
    const emergencyDir = directionForFrom(from);

    for (const dir of allDirs) {
        if (dir !== emergencyDir) {
            blockedDirs.push(dir);
        }
    }

    activeEmergencyRoutes.push({ from, to, carId, blockedDirs });
    refreshEmergencyFlags();
}

function releaseEmergencyRoute(carId) {
    activeEmergencyRoutes = activeEmergencyRoutes.filter(r => r.carId !== carId);
    refreshEmergencyFlags();
}

function refreshEmergencyFlags() {
    if (activeEmergencyRoutes.length === 0) {
        for (const car of activeCars) {
            if (car.isEmergency) continue;
            if (car.emergencyForced) {
                car.emergencyForced = false;
                car.isStopped = false;
            }
        }
        return;
    }

    const allBlockedDirs = new Set();
    for (const route of activeEmergencyRoutes) {
        for (const dir of route.blockedDirs) {
            allBlockedDirs.add(dir);
        }
    }

    for (const car of activeCars) {
        if (car.isEmergency) continue;

        if (allBlockedDirs.has(car.direction)) {
            car.emergencyForced = true;
        } else {
            car.emergencyForced = false;
            car.isStopped = false;
        }
    }
}

// =====================================================
// PRIORIDAD DEL VEHÍCULO ESPECIAL SOBRE LOS PEATONES
//
// Si hay un vehículo especial activo aproximándose a un paso de cebra,
// el botón de peatones de ese lado queda bloqueado temporalmente.
// =====================================================

/**
 * Determina qué pasos de cebra (por dirección de peatón) debe bloquear
 * una emergencia según su ruta actual.
 *
 * La emergencia circula en la dirección `emergencyDir` y puede bloquear
 * los cebras cuya dirección de peatón sea perpendicular a dicha marcha.
 *
 * Mapeamos dirección de avance de emergencia → IDs de botones peatonales
 * que comparten calzada con ese avance:
 *   S (baja por la calle N-S) → cebras N (tlp-N-*) y S (tlp-S-*)
 *   N (sube por la calle N-S) → ídem
 *   E (avanza por la calle O-E) → cebras O (tlp-O-*) y E (tlp-E-*)
 *   O (avanza por la calle O-E) → ídem
 */
const PEDESTRIAN_BUTTONS_BY_LANE = {
    S: ['boton-peatones-N', 'boton-peatones-S'],
    N: ['boton-peatones-N', 'boton-peatones-S'],
    E: ['boton-peatones-O', 'boton-peatones-E'],
    O: ['boton-peatones-O', 'boton-peatones-E'],
};

/**
 * Actualiza el estado bloqueado/desbloqueado de todos los botones peatonales
 * según las rutas de emergencia activas.
 *
 * Un botón se bloquea si al menos una emergencia circula por su calzada.
 */
function refreshPedestrianBlocks() {
    // Calcular qué botones deben estar bloqueados ahora
    const buttonsToBlock = new Set();

    for (const route of activeEmergencyRoutes) {
        const emgCar = emergencyVehicles.find(e => e.id === route.carId);
        if (!emgCar) continue;

        // Usar la dirección de marcha actual (puede haber girado ya)
        const laneDir = emgCar.direction;
        const affected = PEDESTRIAN_BUTTONS_BY_LANE[laneDir] || [];
        for (const btnId of affected) {
            buttonsToBlock.add(btnId);
        }
    }

    // Aplicar a todos los botones conocidos
    const allButtons = [
        'boton-peatones-N', 'boton-peatones-S',
        'boton-peatones-E', 'boton-peatones-O'
    ];

    for (const btnId of allButtons) {
        const btn = document.getElementById(btnId);
        if (!btn) continue;

        if (buttonsToBlock.has(btnId)) {
            btn.disabled = true;
            btn.title = 'Vehículo de emergencia en tránsito';
        } else {
            btn.disabled = false;
            btn.title = '';
        }
    }
}

// =====================================================
// MOVIMIENTO DE EMERGENCIA
// =====================================================

function moveEmergencyVehicle(car) {
    if (!car.active) return;

    // ── CAMBIO 1: El vehículo especial respeta el semáforo del tren ──────────
    // (Comportamiento ya presente en la versión anterior; se mantiene intacto.)
    if (!car.isTurning) {
        const front = getFrontCoord(car);

        // Dirección E → semáforo norte de las vías (rail-tl-N)
        if (car.direction === 'E' && front > 744 && front < 800) {
            const trainGreen = getTrafficLightState('rail-tl-N');
            if (!trainGreen) {
                const len = getVehicleLength(car.type);
                if (front >= 744) car.x = 744 - len;
                car.isStopped = true;
                updateCarTransform(car);
                return;
            }
        }

        // Dirección O → semáforo sur de las vías (rail-tl-S)
        if (car.direction === 'O' && front < 800 && front > 744) {
            const trainGreen = getTrafficLightState('rail-tl-S');
            if (!trainGreen) {
                const len = getVehicleLength(car.type);
                if (front <= 802) car.x = 802 + len;
                car.isStopped = true;
                updateCarTransform(car);
                return;
            }
        }

        if (car.isStopped) car.isStopped = false;
    }

    if (!car.hasTurned && needsToTurn(car) && !car.isTurning) {
        if (shouldStartTurn(car)) {
            const td = getTurnPoint(car);
            if (td) {
                car.isTurning     = true;
                car.turnProgress  = 0;
                car.turnStartX    = car.x;
                car.turnStartY    = car.y;
                car.turnData      = td;
                car.startRotation = rotationForDirection(car.direction);
            }
        }
    }

    if (car.isTurning && car.turnData) {
        const t  = car.turnProgress;
        const td = car.turnData;
        const eT = t < 0.5 ? 2*t*t : 1 - Math.pow(-2*t+2,2)/2;
        const t2 = eT*eT, t3 = t2*eT, mt = 1-eT;

        car.x = mt*mt*mt*car.turnStartX + 3*mt*mt*eT*td.cp1x + 3*mt*t2*td.cp2x + t3*td.endX;
        car.y = mt*mt*mt*car.turnStartY + 3*mt*mt*eT*td.cp1y + 3*mt*t2*td.cp2y + t3*td.endY;

        if (td.keepConstant === 'X') car.x = td.cp1x;
        else if (td.keepConstant === 'Y') car.y = td.cp1y;

        const isLeft = new Set(['N-E','S-O','E-S','O-N']).has(`${car.from}-${car.to}`);
        const newT   = t + (isLeft ? 0.007 : 0.06);

        if (newT >= 1) {
            car.x = td.endX; car.y = td.endY;
            car.direction = car.targetDirection;
            car.from = car.to;
            car.hasTurned = true; car.isTurning = false;
            delete car.turnProgress;
            delete car.turnStartX;
            delete car.turnStartY;
            delete car.turnData;
            delete car.startRotation;
            if (car.direction === 'S' || car.direction === 'N') {
                car._baseLateral = car.x;
            } else {
                car._baseLateral = car.y;
            }
            // Al cambiar de dirección, actualizar qué peatones bloquear
            refreshPedestrianBlocks();
        } else {
            car.turnProgress = newT;
        }

    } else if (!car.isTurning) {
        const sp = car.emergencySpeed;
        switch (car.direction) {
            case 'S': car.y += sp; break;
            case 'N': car.y -= sp; break;
            case 'E': car.x += sp; break;
            case 'O': car.x -= sp; break;
        }
    }

    updateCarTransform(car);

    if (car.x < -100 || car.x > 1000 || car.y < -40 || car.y > 750) {
        car.active = false;
        if (car.element) car.element.remove();

        emergencyVehicles = emergencyVehicles.filter(e => e.id !== car.id);
        const idx = activeCars.findIndex(c => c.id === car.id);
        if (idx !== -1) activeCars.splice(idx, 1);

        releaseEmergencyRoute(car.id);
        // Al salir de escena, desbloquear peatones que ya no tienen emergencia
        refreshPedestrianBlocks();
    }
}

function updateAllEmergency() {
    for (let i = emergencyVehicles.length - 1; i >= 0; i--) {
        moveEmergencyVehicle(emergencyVehicles[i]);
    }

    // CAMBIO 3: desplazamiento lateral progresivo (basado en proximidad).
    // applyYieldDisplacements evalúa en cada frame si cada coche individual
    // tiene una emergencia CERCA (< PROXIMITY_YIELD_DISTANCE). Cuando la
    // emergencia adelanta a un coche, getTargetLateral devuelve _baseLateral
    // y smoothLateral lo devuelve a su carril original de forma suave.
    applyYieldDisplacements();

    // CAMBIO 2: bloqueo progresivo de botones peatonales según posición actual.
    refreshPedestrianBlocks();
}

document.getElementById('btn-send-emergency').addEventListener('click', () => {
    const type = document.getElementById('emg-type').value;
    const from = document.getElementById('emg-from').value;
    const to   = document.getElementById('emg-to').value;

    if (from === to) {
        alert('Origen y destino no pueden ser iguales');
        return;
    }
    createEmergencyVehicle(from, to, type);
});