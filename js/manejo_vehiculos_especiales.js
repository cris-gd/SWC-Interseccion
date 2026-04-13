// =====================================================
// VEHÍCULOS ESPECIALES (EMERGENCIAS)
// Requiere: manejo_coches.js cargado antes que este archivo
// =====================================================

let emergencyVehicles = [];
let activeEmergencyRoutes = [];  // [{ from, to, carId }]

const EMERGENCY_TYPES = {
    ambulance: { bodyColor: '#ffffff', accentColor: '#cc0000', label: 'A', lightColor: '#cc0000' },
    police:    { bodyColor: '#0033ff', accentColor: '#ffffff', label: 'P', lightColor: '#00cfff' },
    fire:      { bodyColor: '#cc2200', accentColor: '#ffcc00', label: 'F', lightColor: '#ffcc00' }
};

// =====================================================
// DISEÑO SVG (tres aspectos distintos)
// =====================================================

function buildEmergencyElement(type, carId) {
    const cfg = EMERGENCY_TYPES[type];
    const ns  = 'http://www.w3.org/2000/svg';
    const g   = document.createElementNS(ns, 'g');
    g.setAttribute('id', carId);
    g.setAttribute('class', 'car emergency');

    // Cuerpo
    const body = document.createElementNS(ns, 'rect');
    body.setAttribute('width', '20');  body.setAttribute('height', '12');
    body.setAttribute('rx', '3');
    body.setAttribute('fill', cfg.bodyColor);
    body.setAttribute('stroke', '#111'); body.setAttribute('stroke-width', '1');

    // Franja identificativa
    const stripe = document.createElementNS(ns, 'rect');
    stripe.setAttribute('x', '4');    stripe.setAttribute('y', '4');
    stripe.setAttribute('width', '9'); stripe.setAttribute('height', '4');
    stripe.setAttribute('fill', cfg.accentColor); stripe.setAttribute('opacity', '0.9');

    // Letra
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', '5');  text.setAttribute('y', '9');
    text.setAttribute('font-size', '7'); text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', cfg.bodyColor === '#ffffff' ? '#cc0000' : '#fff');
    text.textContent = cfg.label;

    // Luz de sirena (parpadea por CSS)
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

// Inyectar CSS de parpadeo una sola vez
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
    // getStartPosition, rotationForDirection definidas en manejo_coches.js
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
        type:            'car',        // usa dimensiones de coche para distancias/giros
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
        isEmergency:     true,         // flag leído por manejo_coches.js → moveCar lo omite
        hasTurned:       false,
        wasStoppedByExtraLight: false,
        emergencySpeed:  CAR_SPEED * 1.8
    };

    emergencyVehicles.push(car);
    activeCars.push(car);              // integrado en el array central de manejo_coches.js

    activateEmergencyRoute(from, to, carId);
}

// =====================================================
// PRIORIDAD — se gestiona con el flag emergencyForced
// en los coches normales; el ciclo de semáforos NO se toca
// =====================================================

function directionForFrom(from) {
    return { N:'S', S:'N', E:'O', O:'E' }[from] || null;
}

function activateEmergencyRoute(from, to, carId) {
    activeEmergencyRoutes.push({ from, to, carId });
    refreshEmergencyFlags();
}

function releaseEmergencyRoute(carId) {
    activeEmergencyRoutes = activeEmergencyRoutes.filter(r => r.carId !== carId);
    refreshEmergencyFlags();
}

function refreshEmergencyFlags() {
    // Vías que tienen paso libre (hay un emergencia viniendo desde allí)
    const freeDirections = new Set(
        activeEmergencyRoutes.map(r => directionForFrom(r.from))
    );

    for (const car of activeCars) {
        if (car.isEmergency) continue;

        if (activeEmergencyRoutes.length === 0) {
            // Sin emergencias: quitar todos los flags y desbloquear
            if (car.emergencyForced) {
                car.emergencyForced = false;
                car.isStopped       = false;
            }
        } else if (freeDirections.has(car.direction)) {
            // Misma vía que el emergencia: libre
            car.emergencyForced = false;
            car.isStopped       = false;
        } else {
            // Vía perpendicular: parar
            car.emergencyForced = true;
        }
    }
}

// =====================================================
// MOVIMIENTO DE EMERGENCIA
// Usa la misma lógica de giro Bézier que manejo_coches.js
// pero omite la comprobación de semáforo
// =====================================================

function moveEmergencyVehicle(car) {
    if (!car.active) return;

    // ── Iniciar giro si corresponde ──────────────────────────────────────────
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

    // ── Ejecutar giro Bézier ─────────────────────────────────────────────────
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
            delete car.turnProgress; delete car.turnStartX; delete car.turnStartY;
            delete car.turnData;    delete car.startRotation;
        } else {
            car.turnProgress = newT;
        }

    } else if (!car.isTurning) {
        // ── Avance recto ─────────────────────────────────────────────────────
        const sp = car.emergencySpeed;
        switch (car.direction) {
            case 'S': car.y += sp; break;
            case 'N': car.y -= sp; break;
            case 'E': car.x += sp; break;
            case 'O': car.x -= sp; break;
        }
    }

    // Actualizar transform SVG (función de manejo_coches.js)
    updateCarTransform(car);

    // ── Salida de escena ─────────────────────────────────────────────────────
    if (car.x < -100 || car.x > 1000 || car.y < -40 || car.y > 750) {
        car.active = false;
        if (car.element) car.element.remove();

        emergencyVehicles = emergencyVehicles.filter(e => e.id !== car.id);
        const idx = activeCars.findIndex(c => c.id === car.id);
        if (idx !== -1) activeCars.splice(idx, 1);

        releaseEmergencyRoute(car.id);
    }
}

// =====================================================
// PUNTO DE ENTRADA llamado desde animate() en manejo_coches.js
// =====================================================

function updateAllEmergency() {
    for (let i = emergencyVehicles.length - 1; i >= 0; i--) {
        moveEmergencyVehicle(emergencyVehicles[i]);
    }
}

// =====================================================
// BOTÓN
// El script se carga con defer o al final del body,
// por lo que el DOM ya está listo aquí.
// =====================================================

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