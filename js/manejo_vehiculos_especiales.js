// =====================================================
// VEHÍCULOS ESPECIALES (EMERGENCIAS)
// =====================================================

let emergencyVehicles = [];

// Rutas con prioridad activa
let emergencyRouteActive = null;

// Tipos disponibles
const EMERGENCY_TYPES = {
    ambulance: { color: '#ffffff', label: 'A' },
    police:    { color: '#0033ff', label: 'P' },
    fire:      { color: '#ff0000', label: 'F' }
};

// =====================================================
// CREACIÓN DE VEHÍCULO ESPECIAL
// =====================================================

function createEmergencyVehicle(from, to, type) {

    const startPos = getStartPosition(from, to);
    if (!startPos) return;

    const carId = `emg-${Date.now()}`;

    const svg = document.getElementById('layer-vehicles');

    const carGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    carGroup.setAttribute('id', carId);
    carGroup.setAttribute('class', 'car emergency');

    // Cuerpo
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '18');
    rect.setAttribute('height', '12');
    rect.setAttribute('fill', EMERGENCY_TYPES[type].color);
    rect.setAttribute('stroke', '#000');

    // Letra identificativa
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', '4');
    text.setAttribute('y', '9');
    text.setAttribute('font-size', '8');
    text.setAttribute('fill', '#000');
    text.textContent = EMERGENCY_TYPES[type].label;

    carGroup.appendChild(rect);
    carGroup.appendChild(text);

    const rotation = rotationForDirection(startPos.direction);
    carGroup.setAttribute('transform',
        `translate(${startPos.x}, ${startPos.y}) rotate(${rotation})`
    );

    svg.appendChild(carGroup);

    const car = {
        id: carId,
        element: carGroup,
        type: 'emergency',
        subtype: type,
        from,
        to,
        direction: startPos.direction,
        x: startPos.x,
        y: startPos.y,
        active: true,
        isEmergency: true,
        hasTurned: false
    };

    emergencyVehicles.push(car);
    activeCars.push(car);

    // ACTIVAR PRIORIDAD
    activateEmergencyRoute(from, to);
}

// =====================================================
// PRIORIDAD SEMAFÓRICA
// =====================================================

function activateEmergencyRoute(from, to) {
    emergencyRouteActive = { from, to };

    bloquearSemaforosExceptoRuta(from);
}

// Bloquea todos los semáforos excepto los de la dirección del vehículo
function bloquearSemaforosExceptoRuta(from) {

    const allTL = document.querySelectorAll("circle[id^='tl-']");

    allTL.forEach(light => {
        light.classList.remove('bloqueado');
    });

    allTL.forEach(light => {
        if (!light.id.includes(`tl-${from}`)) {
            light.classList.add('bloqueado');
        }
    });
}

// Liberar semáforos cuando termina
function liberarSemaforos() {
    const allTL = document.querySelectorAll("circle[id^='tl-']");

    allTL.forEach(light => {
        light.classList.remove('bloqueado');
    });

    emergencyRouteActive = null;
}

// =====================================================
// MOVIMIENTO ESPECIAL (IGNORA SEMÁFOROS)
// =====================================================

function updateEmergencyVehicles() {

    for (const car of emergencyVehicles) {

        if (!car.active) continue;

        // Movimiento SIN respetar semáforos
        moveCarForward(car);

        // Detectar salida de la intersección
        if (hasExitedScene(car)) {
            car.active = false;
            car.element.remove();

            liberarSemaforos();
        }
    }
}

// =====================================================
// MOVIMIENTO SIMPLE (puedes integrar con tu sistema)
// =====================================================

function moveCarForward(car) {
    const speed = CAR_SPEED * 1.8; // más rápido

    switch (car.direction) {
        case 'S': car.y += speed; break;
        case 'N': car.y -= speed; break;
        case 'E': car.x += speed; break;
        case 'O': car.x -= speed; break;
    }

    const rotation = rotationForDirection(car.direction);
    car.element.setAttribute(
        'transform',
        `translate(${car.x}, ${car.y}) rotate(${rotation})`
    );
}

// =====================================================
// SALIDA DE ESCENA
// =====================================================

function hasExitedScene(car) {
    return (
        car.x < -100 || car.x > 1000 ||
        car.y < -100 || car.y > 800
    );
}

// =====================================================
// INTEGRACIÓN CON TU LOOP
// =====================================================

// Llamar en tu animación principal
function updateAllEmergency() {
    updateEmergencyVehicles();
}

document.getElementById('btn-send-emergency').addEventListener('click', () => {

    const type = document.getElementById('emg-type').value;
    const from = document.getElementById('emg-from').value;
    const to   = document.getElementById('emg-to').value;

    if (from === to) {
        alert("Origen y destino no pueden ser iguales");
        return;
    }

    createEmergencyVehicle(from, to, type);
});

