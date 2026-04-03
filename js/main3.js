
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
//cgd: no sé si lane hace falta?

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
//CGD:??'
let generationIntervals = {};

// Velocidad base de los coches (px por frame)
const CAR_SPEED = 1.8;

// Tasa de generación base (milisegundos entre generaciones por unidad de volumen)
const BASE_GENERATION_INTERVAL = 1800; // 1.8 segundos para volumen 1
const MIN_GENERATION_INTERVAL = 300;   // 300ms para volumen 5

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

// Obtener intervalo de generación basado en volumen
function getGenerationInterval(volume) {
    if (volume === 0) return null;
    // Relación inversa: más volumen = menos tiempo entre generaciones
    const interval = BASE_GENERATION_INTERVAL / volume;
    return Math.max(MIN_GENERATION_INTERVAL, interval);
}

// Generar color aleatorio para coches
function getRandomCarColor() {
    const hue = Math.random() * 360; //ángulo del tono
    // Saturación y luminosidad fija a 75% y 55%
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
    //rx es el radio de las esquinas redondeadas
    switch(type) {
        case 'van':   return { h: 12, w: 22, rx: 4 };
        case 'truck': return { h: 15, w: 35, rx: 2 };
        case 'car':
        default:      return { h: 10, w: 16, rx: 4 };
    }
}


// Obtener el estado actual de un semáforo (true = verde/amarillo permitido, false = rojo)
function getTrafficLightState(tlId) {
    // Buscar el elemento del semáforo
    const tlElement = document.getElementById(tlId);
    
    // Verificar si el semáforo tiene la clase 'on' para verde o ámbar
    const greenElement = tlElement.closest('g')?.querySelector('.tl-green');
    const amberElement = tlElement.closest('g')?.querySelector('.tl-amber');
    
    if (greenElement.classList.contains('on')) return true;
    if (amberElement.classList.contains('on')) return true;
    
    return false; // Rojo
}

// =====================================================
// GENERACIÓN DE COCHES
// =====================================================

// Calcular posición inicial según origen y destino
function getStartPosition(from, to, lane) {
    //CGD: lane igual es útil?
    switch(from) {
        case 'N':
            // Viene del norte (parte superior)
            if (to === 'E') {
                return { x: 320, y: -30, direction: 'S' };
            } else {
                return { x: 260, y: -30, direction: 'S' };
            }
        case 'S':
            // Viene del sur (parte inferior)
            if (to === 'O') {
                return { x: 365, y: 700, direction: 'N' };
            } else {
                return { x: 425, y: 700, direction: 'N' };
            }
        case 'O':
            // Viene del oeste (izquierda)
            if (to === 'N') {
                return { x: -30, y: 360, direction: 'E' };
            } else {
                return { x: -30, y: 420, direction: 'E' };
            }
        case 'E':
            // Viene del este (derecha)
            if (to === 'S') {
                return { x: 930, y: 310, direction: 'O' };
            } else {
                return { x: 930, y: 260, direction: 'O' };
            }
        default:
            return null;
    }
}

// Crear un nuevo coche
function createCar(from, to, lane, tlId) {
    const startPos = getStartPosition(from, to, lane);

    const color = getRandomCarColor();
    const type  = getRandomVehicleType();
    const dim   = getVehicleDimensions(type);
    const carId = `car-${carIdCounter++}`; // ID único para cada coche

    const svg = document.getElementById('intersection-svg');
    //crear un grupo <g> para el coche
    const carGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    carGroup.setAttribute('id', carId);
    carGroup.setAttribute('class', 'car');
    carGroup.setAttribute('data-from', from);
    carGroup.setAttribute('data-to', to);
    carGroup.setAttribute('data-tl-id', tlId);

    // Cuerpo principal del vehículo
    const carRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    carRect.setAttribute('width',  String(dim.w));
    carRect.setAttribute('height', String(dim.h));
    carRect.setAttribute('rx', String(dim.rx));
    carRect.setAttribute('ry', String(dim.rx));
    carRect.setAttribute('fill', color);
    //borde negro para mejor visibilidad
    carRect.setAttribute('stroke', '#000');
    carRect.setAttribute('stroke-width', '0.8');
    
    // ANCLAJE EN ESQUINA SUPERIOR IZQUIERDA (x=0, y=0)
    carRect.setAttribute('x', '0');
    carRect.setAttribute('y', '0');
    carGroup.appendChild(carRect);

    // Cabina delantera (solo furgoneta y camión)
    if (type === 'van' || type === 'truck') {
        const cabinDim = type === 'truck' ? 10 : 7;
        const cabin = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        
        // La cabina va DELANTE (hacia donde mira el vehículo)
        const cabinX = dim.w;
        const cabinY = (dim.h - cabinDim) / 2;     

        cabin.setAttribute('width',  String(cabinDim));
        cabin.setAttribute('height', String(cabinDim));
        cabin.setAttribute('x', String(cabinX));
        cabin.setAttribute('y', String(cabinY));
        cabin.setAttribute('rx', String(dim.rx));
        cabin.setAttribute('ry', String(dim.rx));
        cabin.setAttribute('fill', '#000');
        carGroup.appendChild(cabin);
    }

    // Aplicar transformación según la dirección de movimiento
    let rotation = 0;
    switch(from) {
        case 'N': rotation = 90; break;      // Norte: sin rotación
        case 'S': rotation = -90; break;    // Sur: rotación 180°
        case 'E': rotation = 180; break;     // Este: rotación 90°
        case 'O': rotation = 0; break;    // Oeste: rotación -90°
    }
    
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
        targetDirection: to,
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
    // Obtener estado del semáforo asociado
    const isGreen = getTrafficLightState(car.tlId);
    if (isGreen) {
        if (car.isStopped) {
            car.isStopped = false;
        }
        return false;
    }
    
    // Definir zonas de stop según dirección ACTUAL
    const stopZones = {
        'S': { axis: 'y', stopLine: 230, range: 20 },
        'N': { axis: 'y', stopLine: 450, range: 20 },
        'E': { axis: 'x', stopLine: 230, range: 20 },
        'O': { axis: 'x', stopLine: 450, range: 20 }
    };
    
    const zone = stopZones[car.direction];
    if (!zone) return false;
    
    const currentValue = zone.axis === 'x' ? car.x : car.y;
    
    // Verificar si ya pasó la intersección
    let hasPassedIntersection = false;
    if (zone.axis === 'y') {
        if (car.direction === 'S' && currentValue > zone.stopLine + 30) {
            hasPassedIntersection = true;
        } else if (car.direction === 'N' && currentValue < zone.stopLine - 30) {
            hasPassedIntersection = true;
        }
    } else {
        if (car.direction === 'E' && currentValue > zone.stopLine + 30) {
            hasPassedIntersection = true;
        } else if (car.direction === 'O' && currentValue < zone.stopLine - 30) {
            hasPassedIntersection = true;
        }
    }
    
    if (hasPassedIntersection) return false;
    
    // Verificar si está en zona de stop
    let isInStopZone = false;
    if (car.direction === 'S') {
        isInStopZone = currentValue >= (zone.stopLine - zone.range) && currentValue < zone.stopLine;
    } else if (car.direction === 'N') {
        isInStopZone = currentValue <= (zone.stopLine + zone.range) && currentValue > zone.stopLine;
    } else if (car.direction === 'E') {
        isInStopZone = currentValue >= (zone.stopLine - zone.range) && currentValue < zone.stopLine;
    } else if (car.direction === 'O') {
        isInStopZone = currentValue <= (zone.stopLine + zone.range) && currentValue > zone.stopLine;
    }
    
    if (isInStopZone && !isGreen) {
        car.isStopped = true;
        return true;
    }
    
    return false;
}

//ver si debe girar el coche
function needsToTurn(car) {
    return car.direction !== car.targetDirection;
}

// =====================================================
// FUNCIONES MODIFICADAS SOLO PARA GIROS IZQUIERDOS
// =====================================================

// Obtener punto de giro según la dirección
function getTurnPoint(car) {
    const turnMap = {
        // GIROS RECTOS (sin giro real)
        'N-S': null,
        'S-N': null,
        'O-E': null,
        'E-O': null,
        
        // GIROS DERECHA (punto simple - carril derecho)
        'N-O': { x: 260, y: 270, isCurved: false },
        'S-E': { x: 425, y: 415, isCurved: false },
        'E-N': { x: 420, y: 260, isCurved: false },
        'O-S': { x: 260, y: 420, isCurved: false },
        
        // GIROS IZQUIERDA (trayectoria curva - terminan en carril izquierdo)
        // N→E: entra x=320 yendo S → sale y=360 yendo E (carril izq. de E, igual que O→N)
        'N-E': {
            cp1x: 320, cp1y: 380,
            cp2x: 390, cp2y: 360,
            endX: 450, endY: 360,
            isCurved: true
        },
        // S→O: entra x=365 yendo N → sale y=310 yendo O (carril izq. de O, igual que E→S)
        'S-O': {
            cp1x: 365, cp1y: 300,
            cp2x: 290, cp2y: 310,
            endX: 230, endY: 310,
            isCurved: true
        },
        // E→S: entra y=310 yendo O → sale x=365 yendo S (carril izq. de S, igual que S→O)
        'E-S': {
            cp1x: 300, cp1y: 310,
            cp2x: 310, cp2y: 370,
            endX: 310, endY: 450,
            isCurved: true
        },
        // O→N: entra y=360 yendo E → sale x=320 yendo N (carril izq. de N, igual que N→E)
        'O-N': {
            cp1x: 390, cp1y: 360,
            cp2x: 365, cp2y: 300,
            endX: 365, endY: 230,
            isCurved: true
        }
    };
    
    return turnMap[`${car.from}-${car.to}`];
}

// Función para mover coches (CORREGIDA - sin Map)
function moveCar(car) {
    if (!car.active) return;
    
    // Verificar si debe detenerse por semáforo
    const shouldStop = shouldStopAtTrafficLight(car);
    
    if (!shouldStop && !car.isStopped) {
        // Verificar si debe iniciar un giro
        if (!car.hasTurned && needsToTurn(car)) {
            const turnData = getTurnPoint(car);
            
            // Determinar cuándo iniciar el giro basado en la posición
            let shouldStartTurn = false;
            
            switch(car.from) {
                case 'N':
                    shouldStartTurn = car.y >= 250 && car.y <= 280;
                    break;
                case 'S':
                    shouldStartTurn = car.y <= 430 && car.y >= 400;
                    break;
                case 'E':
                    shouldStartTurn = car.x <= 420 && car.x >= 390;
                    break;
                case 'O':
                    shouldStartTurn = car.x >= 260 && car.x <= 290;
                    break;
            }
            
            if (shouldStartTurn && turnData && turnData.isCurved && !car.isTurning) {
                // Iniciar giro curvo (izquierda)
                car.isTurning = true;
                car.turnProgress = 0;
                car.turnStartX = car.x;
                car.turnStartY = car.y;
                car.turnData = turnData;
            } else if (shouldStartTurn && turnData && !turnData.isCurved && !car.isTurning) {
                // Iniciar giro recto (derecha)
                car.isTurning = true;
                car.targetPoint = { x: turnData.x, y: turnData.y };
            }
        }
        
        // Procesar movimiento según si está girando
        if (car.isTurning) {
            if (car.turnData && car.turnData.isCurved) {
                // Movimiento por curva de Bézier cúbica
                const t = car.turnProgress;
                const td = car.turnData;
                
                // Fórmula de Bézier: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
                const t2 = t * t;
                const t3 = t2 * t;
                const mt = 1 - t;
                const mt2 = mt * mt;
                const mt3 = mt2 * mt;
                
                car.x = mt3 * car.turnStartX + 3 * mt2 * t * td.cp1x + 3 * mt * t2 * td.cp2x + t3 * td.endX;
                car.y = mt3 * car.turnStartY + 3 * mt2 * t * td.cp1y + 3 * mt * t2 * td.cp2y + t3 * td.endY;
                
                // Incrementar progreso
                let newT = t + 0.025;
                
                if (newT >= 1) {
                    // Giro completado
                    car.x = td.endX;
                    car.y = td.endY;
                    car.direction = car.targetDirection;
                    car.hasTurned = true;
                    car.isTurning = false;
                    delete car.turnProgress;
                    delete car.turnStartX;
                    delete car.turnStartY;
                    delete car.turnData;
                } else {
                    car.turnProgress = newT;
                }
            } 
            else if (car.targetPoint) {
                // Giro derecha simple (movimiento lineal al punto)
                const dx = car.targetPoint.x - car.x;
                const dy = car.targetPoint.y - car.y;
                const distance = Math.sqrt(dx*dx + dy*dy);
                
                if (distance < CAR_SPEED) {
                    car.x = car.targetPoint.x;
                    car.y = car.targetPoint.y;
                    car.direction = car.targetDirection;
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
            // Movimiento normal en línea recta
            switch(car.direction) {
                case 'S': car.y += CAR_SPEED; break;
                case 'N': car.y -= CAR_SPEED; break;
                case 'E': car.x += CAR_SPEED; break;
                case 'O': car.x -= CAR_SPEED; break;
            }
        }
    }
    
    // Actualizar posición y rotación en SVG
    updateCarTransform(car);
    
    // Verificar si el coche ha salido de la pantalla
    if (car.x < -100 || car.x > 1000 || car.y < -50 || car.y > 750) {
        removeCar(car.id);
    }
}

// Función para actualizar la transformación del coche
function updateCarTransform(car) {
    if (!car.element) return;
    
    let rotation = 0;
    
    // Calcular ángulo basado en dirección o progreso de giro
    if (car.isTurning && car.turnData && car.turnData.isCurved) {
        // DURANTE EL GIRO CURVO: mantener rotación fija basada en la dirección de origen
        // El coche NO rota durante la curva, solo se traslada
        switch(car.from) {
            case 'N': rotation = 90; break;   // Mirando al Sur
            case 'S': rotation = -90; break; // Mirando al Norte
            case 'E': rotation = 180; break;  // Mirando al Oeste
            case 'O': rotation = 0; break; // Mirando al Este
        }
        
        // NOTA: El coche mantiene esta rotación durante TODO el giro curvo
        // El efecto visual de giro se logra por la trayectoria curva de traslación
        // La esquina superior izquierda del rectángulo es el punto de anclaje
    } 
    else if (car.isTurning && car.targetPoint) {
        // Giro derecha: rotación fija hacia el destino
        switch(car.targetDirection) {
            case 'N': rotation = -90; break;
            case 'S': rotation = 90; break;
            case 'E': rotation = 180; break;
            case 'O': rotation = 0; break;
        }
    } 
    else {
        // Movimiento recto
        switch(car.from) {
            case 'N': rotation = 90; break;      // Norte: sin rotación
            case 'S': rotation = -90; break;    // Sur: rotación 180°
            case 'E': rotation = 180; break;     // Este: rotación 90°
            case 'O': rotation = 0; break;    // Oeste: rotación -90°
        }
    }
    
    // Aplicar transformación: traslación + rotación
    // El rectángulo rota sobre su esquina superior izquierda (0,0 local)
    car.element.setAttribute('transform', `translate(${car.x}, ${car.y}) rotate(${rotation})`);
}

// Función para eliminar coches (limpia propiedades)
function removeCar(carId) {
    const index = activeCars.findIndex(c => c.id === carId);
    if (index !== -1) {
        const car = activeCars[index];
        if (car.element && car.element.remove) {
            car.element.remove();
        }
        activeCars.splice(index, 1);
    }
}


function shouldTurn(car) {
    if (car.hasTurned) return false;
    if (!needsToTurn(car)) return false;

    const point = getTurnPoint(car);
    if (!point) return false;

    const dx = Math.abs(car.x - point.x);
    const dy = Math.abs(car.y - point.y);

    return (dx < 10 && dy < 10);
}

// Bucle de animación
let animationFrameId = null;

function animate() {
    // Mover todos los coches activos
    for (let i = 0; i < activeCars.length; i++) {
        moveCar(activeCars[i]);
    }
    animationFrameId = requestAnimationFrame(animate);
}

// =====================================================
// GESTIÓN DE VOLÚMENES Y GENERACIÓN
// =====================================================

// Iniciar generación de coches para una dirección
function startGenerationForRoute(routeKey, volume) {
    // Detener generación existente
    if (generationIntervals[routeKey]) {
        clearInterval(generationIntervals[routeKey]);
        generationIntervals[routeKey] = null;
    }
    
    if (volume === 0) return;
    
    const route = sliderToRoute[routeKey];
    if (!route) return;
    
    const interval = getGenerationInterval(volume);
    if (!interval) return;
    
    // Iniciar nuevo intervalo
    generationIntervals[routeKey] = setInterval(() => {
        // Verificar si el semáforo está en verde/ámbar antes de generar
        const isGreen = getTrafficLightState(route.tlId);
        if (isGreen) {
            createCar(route.from, route.to, route.lane, route.tlId);
        }
    }, interval);
}

// Actualizar volumen de tráfico
function updateTrafficVolume(sliderId, value) {
    const route = sliderToRoute[sliderId];
    if (!route) return;
    
    const routeKey = `${route.from}-${route.to}`;
    trafficVolumes[routeKey] = value;
    
    // Actualizar etiqueta
    const labelId = sliderId.replace('slider', 'label');
    const label = document.getElementById(labelId);
    if (label) label.textContent = value;
    
    // Reiniciar generación para esta ruta
    startGenerationForRoute(sliderId, value);
}

// Inicializar todos los sliders
function initSliders() {
    for (const [sliderId, route] of Object.entries(sliderToRoute)) {
        const slider = document.getElementById(sliderId);
        if (slider) {
            const routeKey = `${route.from}-${route.to}`;
            const initialValue = parseInt(slider.value, 10);
            trafficVolumes[routeKey] = initialValue;
            
            // Actualizar etiqueta
            const labelId = sliderId.replace('slider', 'label');
            const label = document.getElementById(labelId);
            if (label) label.textContent = initialValue;
            
            // Configurar evento
            slider.addEventListener('input', (e) => {
                const newValue = parseInt(e.target.value, 10);
                updateTrafficVolume(sliderId, newValue);
            });
            
            // Iniciar generación si valor > 0
            if (initialValue > 0) {
                startGenerationForRoute(sliderId, initialValue);
            }
        }
    }
}

// =====================================================
// OBSERVACIÓN DE CAMBIOS EN SEMÁFOROS
// =====================================================

// Forzar actualización de coches cuando cambian los semáforos
function forceCarsUpdate() {
    // Esto hará que todos los coches reevalúen su estado de stop en el próximo frame
    // No es necesario hacer nada adicional, ya que shouldStopAtTrafficLight se llama en cada frame
}

// Configurar MutationObserver para detectar cambios en semáforos
function observeTrafficLights() {
    // IDs de todos los semáforos de vehículos
    const tlIds = [
        'tl-N-S', 'tl-N-O', 'tl-N-E',
        'tl-S-N', 'tl-S-E', 'tl-S-O',
        'tl-O-E', 'tl-O-N', 'tl-O-S',
        'tl-E-O', 'tl-E-S', 'tl-E-N'
    ];
    
    tlIds.forEach(tlId => {
        const tlElement = document.getElementById(tlId);
        if (tlElement) {
            // Observar cambios en la clase 'on' del elemento
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        // Cuando cambia el semáforo, forzar actualización de coches
                        forceCarsUpdate();
                    }
                });
            });
            observer.observe(tlElement, { attributes: true });
        }
    });
}

// =====================================================
// LIMPIEZA DE INTERVALOS (para recarga de página)
// =====================================================
function cleanup() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    for (const interval of Object.values(generationIntervals)) {
        if (interval) clearInterval(interval);
    }
    // Eliminar todos los coches
    for (const car of activeCars) {
        if (car.element && car.element.remove) {
            car.element.remove();
        }
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
    
    // Limpiar al descargar página
    window.addEventListener('beforeunload', cleanup);
}

// Esperar a que el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}