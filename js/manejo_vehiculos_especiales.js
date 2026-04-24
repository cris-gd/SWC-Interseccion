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
const YIELD_LERP = 0.08;

function yieldSign(direction) {
    return { S: -1, N: +1, E: -1, O: +1 }[direction] ?? 0;
}

/**
 * Devuelve la dirección de avance que usa la emergencia en cada tramo de su ruta.
 * Para una ruta N→O: primero avanza S (hasta el giro), luego E.
 * Los coches que circulan en dirección E (Oeste→Este) deben apartarse cuando la
 * emergencia está en su segundo tramo.
 */
function getEmergencyFlowDirections(route) {
    const { from, to } = route;
    if (from === to) return [];
    if (from === 'N' && to === 'S') return ['S'];
    if (from === 'S' && to === 'N') return ['N'];
    if (from === 'E' && to === 'O') return ['O'];
    if (from === 'O' && to === 'E') return ['E'];
    // Giros: primero avanza recto, luego gira
    const straightDir = { N: 'S', S: 'N', E: 'O', O: 'E' }[from];
    const turnDir = to;
    return [straightDir, turnDir];
}

/**
 * True si `car` debe ceder el paso lateralmente a la emergencia `route`.
 *
 * Hay dos situaciones donde un coche debe apartarse:
 *
 * A) TRAMO DE ORIGEN (antes de la intersección):
 *    El coche está en el mismo carril físico que la emergencia en su tramo
 *    inicial (misma dirección de avance, misma lateral) y la emergencia aún
 *    no ha girado. El coche solo se aparta si la emergencia está DETRÁS de él
 *    o muy cerca (a menos de 120 px por detrás), para no desplazar coches
 *    que ya están lejos por delante.
 *
 * B) DENTRO DE LA INTERSECCIÓN / TRAMO DE SALIDA:
 *    El coche ya superó la stop-line y circula en la misma dirección que
 *    algún tramo de la ruta de la emergencia (incluido el tramo de giro).
 */
function isSameLaneAsEmergency(car, route) {
    const startPos = getStartPosition(route.from, route.to);
    if (!startPos) return false;

    const LANE_TOL = 22;
    const stopLine = typeof STOP_LINES !== 'undefined' ? STOP_LINES[car.direction] : undefined;
    if (stopLine === undefined) return false;

    const emergencyDirs = getEmergencyFlowDirections(route);
    if (!emergencyDirs.includes(car.direction)) return false;

    const lateral = car._baseLateral !== undefined
        ? car._baseLateral
        : (car.direction === 'S' || car.direction === 'N' ? car.x : car.y);

    const refLateral = (startPos.direction === 'S' || startPos.direction === 'N')
        ? startPos.x
        : startPos.y;

    if (Math.abs(lateral - refLateral) >= LANE_TOL) return false;

    const front = getFrontCoord(car);
    const pastStopLine =
        (car.direction === 'S' || car.direction === 'E')
            ? front > stopLine + 10
            : front < stopLine - 10;

    // CASO B: ya está dentro/después de la intersección → siempre apartarse
    if (pastStopLine) return true;

    // CASO A: fuera de la intersección, en el tramo inicial de la emergencia.
    // Solo aplica si la emergencia todavía no ha girado (su dirección actual
    // coincide con la dirección de avance del coche).
    const emgCar = emergencyVehicles.find(e => e.id === route.carId);
    if (!emgCar || emgCar.hasTurned) return false;
    if (emgCar.direction !== car.direction) return false;

    // La emergencia está detrás del coche o muy cerca: apartarse.
    // Usamos un margen de 120 px para cubrir la zona de aproximación.
    const emgFront = getFrontCoord(emgCar);
    const carRear  = getRearCoord(car);
    const APPROACH_MARGIN = 120;

    switch (car.direction) {
        case 'S': return emgFront < carRear + APPROACH_MARGIN;
        case 'N': return emgFront > carRear - APPROACH_MARGIN;
        case 'E': return emgFront < carRear + APPROACH_MARGIN;
        case 'O': return emgFront > carRear - APPROACH_MARGIN;
    }
    return false;
}

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
    // Guardamos también las direcciones que bloquea esta emergencia
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

    // Recopilar todas las direcciones bloqueadas
    const allBlockedDirs = new Set();
    for (const route of activeEmergencyRoutes) {
        for (const dir of route.blockedDirs) {
            allBlockedDirs.add(dir);
        }
    }

    for (const car of activeCars) {
        if (car.isEmergency) continue;
        
        if (allBlockedDirs.has(car.direction)) {
            // Esta dirección debe parar (como si tuviera semáforo rojo)
            car.emergencyForced = true;
        } else {
            car.emergencyForced = false;
            car.isStopped = false;
        }
    }
}

// =====================================================
// MOVIMIENTO DE EMERGENCIA
// =====================================================

function moveEmergencyVehicle(car) {
    if (!car.active) return;

    // Semáforos del tren
    if (!car.isTurning) {
        const front = getFrontCoord(car);
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
    }
}

function updateAllEmergency() {
    for (let i = emergencyVehicles.length - 1; i >= 0; i--) {
        moveEmergencyVehicle(emergencyVehicles[i]);
    }
    applyYieldDisplacements();
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