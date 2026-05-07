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
// PRIORIDAD — sólo los coches en el MISMO CARRIL y POR DELANTE de la
// emergencia se comportan como si tuvieran semáforo rojo. El resto del
// tráfico circula con normalidad.
//
// "Mismo carril" se entiende como:
//   - misma dirección de avance que la emergencia, y
//   - posición lateral (el eje perpendicular al avance) dentro de
//     LANE_TOL respecto a la emergencia (o a su carril de spawn si la
//     emergencia todavía no ha aparecido).
// =====================================================

const EMG_LANE_TOL = 22;

function activateEmergencyRoute(from, to, carId) {
    // Guardamos el carril de spawn para poder bloquearlo durante la
    // pre-reserva (antes de que el vehículo de emergencia se haya creado).
    const startPos = getStartPosition(from, to);
    const spawnDirection = startPos ? startPos.direction : null;
    const spawnLateral = startPos
        ? ((startPos.direction === 'S' || startPos.direction === 'N') ? startPos.x : startPos.y)
        : null;

    activeEmergencyRoutes.push({ from, to, carId, spawnDirection, spawnLateral });

    // Cancelar cruces peatonales pendientes (en fase ámbar, antes de cruzar)
    // en las direcciones origen y destino de la emergencia.
    // Si el peatón ya estaba cruzando, se deja terminar.
    if (typeof cancelarPeatonPendiente === 'function') {
        cancelarPeatonPendiente(from);
        cancelarPeatonPendiente(to);
    }

    refreshEmergencyFlags();
    refreshPedestrianBlocks();
}

function releaseEmergencyRoute(carId) {
    activeEmergencyRoutes = activeEmergencyRoutes.filter(r => r.carId !== carId);
    refreshEmergencyFlags();
    refreshPedestrianBlocks();
}

/**
 * Indica si `car` está por delante de un punto `frontCoord` en su
 * dirección de avance. Si `frontCoord` es null, devuelve true (para la
 * pre-reserva: todavía no hay emergencia, así que cualquier coche en el
 * carril cuenta como "delante").
 */
function _carIsAheadOfPoint(car, direction, frontCoord) {
    if (frontCoord === null || frontCoord === undefined) return true;
    const carRear = getRearCoord(car);
    switch (direction) {
        case 'S': return carRear > frontCoord;
        case 'N': return carRear < frontCoord;
        case 'E': return carRear > frontCoord;
        case 'O': return carRear < frontCoord;
    }
    return false;
}

function _carLateralFor(car) {
    if (car._baseLateral !== undefined) return car._baseLateral;
    return (car.direction === 'S' || car.direction === 'N') ? car.x : car.y;
}

function refreshEmergencyFlags() {
    // Reset previo
    for (const car of activeCars) {
        if (car.isEmergency) continue;
        car.emergencyForced = false;
    }

    if (activeEmergencyRoutes.length === 0) {
        for (const car of activeCars) {
            if (car.isEmergency) continue;
            // Si estaba parado únicamente por la emergencia, liberarlo.
            // (El resto de la lógica de tráfico volverá a parar el coche
            // si fuera necesario en el siguiente frame.)
            car.isStopped = false;
        }
        return;
    }

    // Para cada ruta de emergencia activa, calculamos el "carril activo"
    // (dirección + lateral). Cualquier coche que NO esté en ese carril
    // (otra dirección, u otro carril dentro de la misma dirección) queda
    // forzado a no entrar en la intersección hasta que la emergencia salga.
    //
    // Los coches que sí están en el mismo carril y por delante de la
    // emergencia se gestionan en moveCar() mediante `porDelanteDeEmergencia`,
    // que tiene precedencia sobre `emergencyForced` y les permite ignorar
    // los semáforos para dejar paso. Por eso aquí los excluimos del flag
    // (no es estrictamente necesario, pero deja el estado más limpio).
    const activeLanes = [];
    for (const route of activeEmergencyRoutes) {
        const emgCar = emergencyVehicles.find(e => e.id === route.carId);
        if (emgCar) {
            activeLanes.push({
                dir: emgCar.direction,
                lateral: (emgCar.direction === 'S' || emgCar.direction === 'N') ? emgCar.x : emgCar.y,
                frontCoord: getFrontCoord(emgCar)
            });
        } else if (route.spawnDirection && route.spawnLateral !== null) {
            // Pre-reserva: la emergencia aún no ha aparecido.
            activeLanes.push({
                dir: route.spawnDirection,
                lateral: route.spawnLateral,
                frontCoord: null
            });
        }
    }
    if (activeLanes.length === 0) return;

    for (const car of activeCars) {
        if (car.isEmergency) continue;

        // ¿Está este coche en el mismo carril que alguna emergencia activa?
        const carLat = _carLateralFor(car);
        const inEmergencyLane = activeLanes.some(lane =>
            lane.dir === car.direction &&
            Math.abs(carLat - lane.lateral) <= EMG_LANE_TOL
        );

        if (inEmergencyLane) {
            // Mismo carril: la lógica de "porDelanteDeEmergencia" en moveCar
            // se encarga de darle paso si está por delante. Si está por
            // detrás, se gestiona como tráfico normal (la emergencia le
            // adelantará por su mismo carril manteniendo distancia).
            continue;
        }

        // Otro carril (otra dirección o el mismo `from` por otro carril)
        // → bloqueado: no debe entrar en la intersección hasta que la
        // emergencia haya salido de ella.
        car.emergencyForced = true;
    }

    // Liberar coches que ya no están forzados
    for (const car of activeCars) {
        if (car.isEmergency) continue;
        if (!car.emergencyForced && car.isStopped) {
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
/**
 * Actualiza el estado bloqueado/desbloqueado de todos los botones peatonales
 * según las rutas de emergencia activas.
 *
 * Sólo se bloquean los botones de las direcciones ORIGEN y DESTINO de la
 * ruta de emergencia (los pasos de cebra que la ambulancia atraviesa).
 * También se bloquea el botón de enviar emergencia mientras haya alguna
 * ruta activa, para evitar lanzar otra hasta que la actual salga de la
 * intersección.
 */
function refreshPedestrianBlocks() {
    const buttonsToBlock = new Set();

    for (const route of activeEmergencyRoutes) {
        buttonsToBlock.add(`boton-peatones-${route.from}`);
        buttonsToBlock.add(`boton-peatones-${route.to}`);
    }

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

    // Botón de enviar emergencia: bloqueado mientras haya una ruta activa
    const sendBtn = document.getElementById('btn-send-emergency');
    if (sendBtn) {
        if (activeEmergencyRoutes.length > 0) {
            sendBtn.disabled = true;
            sendBtn.title = 'Vehículo de emergencia en tránsito';
            sendBtn.style.opacity = '0.5';
            sendBtn.style.cursor = 'not-allowed';
        } else {
            sendBtn.disabled = false;
            sendBtn.title = '';
            sendBtn.style.opacity = '1';
            sendBtn.style.cursor = 'pointer';
        }
    }
}

// =====================================================
// MOVIMIENTO DE EMERGENCIA
// =====================================================

function moveEmergencyVehicle(car) {
    if (!car.active) return;

    // ── El vehículo de emergencia sólo puede ignorar los semáforos peatonales
    //    de su dirección de origen (car.direction / car.from) y de su dirección
    //    de destino (car.to). El resto de peatonales y SIEMPRE los del tren se
    //    respetan.
    if (!car.isTurning) {
        const checks = (typeof getExtraStopChecks === 'function')
            ? getExtraStopChecks(car)
            : [];
        const pedSet = (typeof PEDESTRIAN_TL_IDS !== 'undefined') ? PEDESTRIAN_TL_IDS : null;
        const originPrefix = `tlp-${car.from || car.direction}-`;
        const destPrefix = `tlp-${car.to}-`;
        for (const { tlId, stopLine } of checks) {
            const isPed = pedSet && pedSet.has(tlId);
            const ignorable = isPed && (tlId.startsWith(originPrefix) || tlId.startsWith(destPrefix));
            if (ignorable) continue;
            if (typeof checkExtraLight === 'function' && checkExtraLight(car, tlId, stopLine)) {
                updateCarTransform(car);
                return;
            }
        }
        if (car.isStopped) car.isStopped = false;
    }

    // ── Distancia de seguridad: la emergencia NO se superpone con otros vehículos ──
    // Distancia de seguridad ampliada para los vehículos de emergencia.
    const EMERGENCY_SAFE_DISTANCE = MIN_SAFE_DISTANCE * 2;
    if (!car.isTurning) {
        for (const other of activeCars) {
            if (other.id === car.id) continue;
            const gap = (typeof getGapToCarAhead === 'function')
                ? getGapToCarAhead(car, other)
                : Infinity;
            if (gap >= 0 && gap < EMERGENCY_SAFE_DISTANCE) {
                car.isStopped = true;
                updateCarTransform(car);
                return;
            }
        }
        car.isStopped = false;
    }

    // ── Durante el giro: comprobar si hay un vehículo muy cerca en la dirección
    //    de DESTINO para evitar solapamiento (especialmente con furgonetas/camiones)
    if (car.isTurning && car.turnData) {
        const td = car.turnData;
        // Posición aproximada del frente de la emergencia en el eje de destino
        const exitDir = car.targetDirection;
        const emgFrontExit = (exitDir === 'S' || exitDir === 'N') ? car.y : car.x;
        const TURNING_SAFE_DISTANCE = MIN_SAFE_DISTANCE * 3;

        for (const other of activeCars) {
            if (other.id === car.id) continue;
            if (other.direction !== exitDir) continue;
            // Lateral del otro en el eje de su dirección
            const otherLateral = (exitDir === 'S' || exitDir === 'N') ? other.x : other.y;
            const exitLateral  = (exitDir === 'S' || exitDir === 'N') ? td.endX : td.endY;
            if (Math.abs(otherLateral - exitLateral) > 22) continue;

            const otherRear = getRearCoord(other);
            let gap;
            switch (exitDir) {
                case 'S': gap = otherRear - emgFrontExit; break;
                case 'N': gap = emgFrontExit - otherRear; break;
                case 'E': gap = otherRear - emgFrontExit; break;
                case 'O': gap = emgFrontExit - otherRear; break;
                default:  gap = Infinity;
            }
            if (gap >= 0 && gap < TURNING_SAFE_DISTANCE) {
                // Pausar el giro sin resetear su progreso
                updateCarTransform(car);
                return;
            }
        }
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

    // ── Liberar la ruta de emergencia al salir de la INTERSECCIÓN ────────────
    // Una vez la ambulancia ha cruzado la intersección, los vehículos de las
    // demás direcciones pueden volver a circular con normalidad (no hay que
    // esperar a que la ambulancia desaparezca de la pantalla).
    if (!car._routeReleased && !car.isTurning) {
        const INTERSECTION = { xMin: 230, xMax: 450, yMin: 230, yMax: 450 };
        const rear = getRearCoord(car);
        let outOfIntersection = false;
        switch (car.direction) {
            case 'S': outOfIntersection = rear > INTERSECTION.yMax; break;
            case 'N': outOfIntersection = rear < INTERSECTION.yMin; break;
            case 'E': outOfIntersection = rear > INTERSECTION.xMax; break;
            case 'O': outOfIntersection = rear < INTERSECTION.xMin; break;
        }
        if (outOfIntersection) {
            car._routeReleased = true;
            releaseEmergencyRoute(car.id);
            refreshPedestrianBlocks();
        }
    }

    const outOfBounds =
        car.x < -100 || car.x > 1000 ||
        (car.direction === 'N' ? getFrontCoord(car) < -40 : car.y < -40) ||
        (car.direction === 'S' ? getFrontCoord(car) > 720 : car.y > 730);

    if (outOfBounds) {
        car.active = false;
        if (car.element) car.element.remove();

        emergencyVehicles = emergencyVehicles.filter(e => e.id !== car.id);
        const idx = activeCars.findIndex(c => c.id === car.id);
        if (idx !== -1) activeCars.splice(idx, 1);

        if (!car._routeReleased) releaseEmergencyRoute(car.id);
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
    // applyYieldDisplacements();  // desactivado: los coches no se apartan

    // Recalcular qué coches están "delante de la emergencia en su carril"
    // en cada frame, ya que la emergencia se mueve.
    refreshEmergencyFlags();

    // CAMBIO 2: bloqueo progresivo de botones peatonales según posición actual.
    refreshPedestrianBlocks();
}

const EMERGENCY_SPAWN_DELAY_MS = 2500;

document.getElementById('btn-send-emergency').addEventListener('click', () => {
    const type = document.getElementById('emg-type').value;
    const from = document.getElementById('emg-from').value;
    const to   = document.getElementById('emg-to').value;

    if (from === to) {
        alert('Origen y destino no pueden ser iguales');
        return;
    }

    // Reservamos la ruta inmediatamente con un id temporal para bloquear
    // las direcciones perpendiculares y dar 2 s de margen a los vehículos
    // que ya estaban dentro de la intersección para que terminen de cruzar
    // antes de que aparezca la ambulancia.
    const reservationId = `emg-pending-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    activateEmergencyRoute(from, to, reservationId);

    setTimeout(() => {
        // Liberamos la reserva temporal; createEmergencyVehicle volverá
        // a registrar la ruta con el id real del vehículo.
        releaseEmergencyRoute(reservationId);
        // Segunda llamada de cancelación: cubre el caso en que el peatón
        // se activó DURANTE los 2.5 s de margen previo al spawn.
        if (typeof cancelarPeatonPendiente === 'function') {
            cancelarPeatonPendiente(from);
            cancelarPeatonPendiente(to);
        }
        createEmergencyVehicle(from, to, type);
    }, EMERGENCY_SPAWN_DELAY_MS);
});