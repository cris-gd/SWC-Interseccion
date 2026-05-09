const boton_ext_N = document.getElementById("boton-prioridad-ext-N");
const boton_int_N = document.getElementById("boton-prioridad-int-N");
const boton_ext_S = document.getElementById("boton-prioridad-ext-S");
const boton_int_S = document.getElementById("boton-prioridad-int-S");
const boton_ext_E = document.getElementById("boton-prioridad-ext-E");
const boton_int_E = document.getElementById("boton-prioridad-int-E");
const boton_ext_O = document.getElementById("boton-prioridad-ext-O");
const boton_int_O = document.getElementById("boton-prioridad-int-O");

const botones_prioridad = document.getElementsByClassName("boton-prioridad");

let inicio_prioridad;
let resto;
let timeoutPrioridad = null; // Timeout para la finalización de prioridad

// =====================================================
// FUNCIONES AUXILIARES PARA GESTIÓN DE SEMÁFOROS
// =====================================================

// Poner todos los semáforos en rojo (respetando bloques)
function todoAlRojoPrioridad() {
    for (let i = 0; i < semaforos_interseccion.length; i += 3) {
        const rojo = semaforos_interseccion[i];
        const ambar = semaforos_interseccion[i+1];
        const verde = semaforos_interseccion[i+2];
        
        // No modificar si está bloqueado por peatón o tren
        if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
            ambar.classList.remove("on");
            verde.classList.remove("on");
            rojo.classList.add("on");
        }
    }
}

// Obtener los círculos del semáforo por su ID
function getSemaphoreCircles(tlId) {
    const semaforo = document.getElementById(tlId);
    if (semaforo) {
        return semaforo.getElementsByTagName("circle");
    }
    return null;
}

// =====================================================
// CONFLICTOS DE CARRIL
// =====================================================

const CONFLICTOS_PRIORIDAD = {
    'N-ext': [{ from:'E', to:'O' }, { from:'S', to:'O' }],
    'N-int': [{ from:'S', to:'E' }, { from:'O', to:'E' }],
    'S-ext': [{ from:'O', to:'E' }, { from:'N', to:'E' }],
    'S-int': [{ from:'E', to:'O' }, { from:'N', to:'O' }],
    'E-ext': [{ from:'N', to:'O' }, { from:'S', to:'O' }],
    'E-int': [{ from:'N', to:'S' }, { from:'O', to:'S' }],
    'O-ext': [{ from:'N', to:'S' }, { from:'S', to:'E' }],
    'O-int': [{ from:'E', to:'N' }, { from:'S', to:'N' }],
};

function hayConflictoEnCarril(laneDirection, laneIsExt) {
    const key = laneDirection + (laneIsExt ? '-ext' : '-int');
    const conflictos = CONFLICTOS_PRIORIDAD[key];
    if (!conflictos || typeof activeCars === 'undefined') return false;

    const stopLines = { S: 230, N: 450, E: 230, O: 450 };

    for (const car of activeCars) {
        if (car.isEmergency) continue;
        const esConflicto = conflictos.some(c => c.from === car.from && c.to === car.to);
        if (!esConflicto) continue;

        const stopLine = stopLines[car.direction];
        if (stopLine === undefined) continue;

        const front = (car.direction === 'S' || car.direction === 'E')
            ? (car.direction === 'S' ? car.y + getVehicleLength(car.type) : car.x + getVehicleLength(car.type))
            : (car.direction === 'N' ? car.y - getVehicleLength(car.type) : car.x - getVehicleLength(car.type));

        const pastLine = (car.direction === 'S' || car.direction === 'E')
            ? front > stopLine + 10
            : front < stopLine - 10;

        if (pastLine) return true;
    }
    return false;
}

function esperarYDarVerde(laneDirection, laneIsExt, semaphoreCircles, callback) {
    const MAX_WAIT = 4000;
    const POLL_MS = 150;
    const start = Date.now();

    function poll() {
        if (!hayConflictoEnCarril(laneDirection, laneIsExt) || (Date.now() - start) >= MAX_WAIT) {
            callback(semaphoreCircles);
        } else {
            setTimeout(poll, POLL_MS);
        }
    }
    poll();
}

// =====================================================
// OBTENER SEMÁFOROS PRIORITARIOS SEGÚN DIRECCIÓN
// =====================================================

function getPrioritarySemaphores(laneDirection, laneIsExt) {
    const semaphores = [];
    
    switch(laneDirection) {
        case "N":
            if (laneIsExt) {
                // Carril exterior N: puede ir a S (recto) o a O (izquierda)
                semaphores.push(getSemaphoreCircles("tl-N-S"));
                semaphores.push(getSemaphoreCircles("tl-N-O"));
            } else {
                // Carril interior N: puede ir a E (derecha)
                semaphores.push(getSemaphoreCircles("tl-N-E"));
            }
            break;
        case "S":
            if (laneIsExt) {
                // Carril exterior S: puede ir a N (recto) o a E (izquierda)
                semaphores.push(getSemaphoreCircles("tl-S-N"));
                semaphores.push(getSemaphoreCircles("tl-S-E"));
            } else {
                // Carril interior S: puede ir a O (derecha)
                semaphores.push(getSemaphoreCircles("tl-S-O"));
            }
            break;
        case "E":
            if (laneIsExt) {
                // Carril exterior E: puede ir a O (recto) o a N (izquierda)
                semaphores.push(getSemaphoreCircles("tl-E-O"));
                semaphores.push(getSemaphoreCircles("tl-E-N"));
            } else {
                // Carril interior E: puede ir a S (derecha)
                semaphores.push(getSemaphoreCircles("tl-E-S"));
            }
            break;
        case "O":
            if (laneIsExt) {
                // Carril exterior O: puede ir a E (recto) o a S (izquierda)
                semaphores.push(getSemaphoreCircles("tl-O-E"));
                semaphores.push(getSemaphoreCircles("tl-O-S"));
            } else {
                // Carril interior O: puede ir a N (derecha)
                semaphores.push(getSemaphoreCircles("tl-O-N"));
            }
            break;
    }
    
    return semaphores.filter(s => s !== null);
}

// =====================================================
// FUNCIÓN PRINCIPAL DE PRIORIDAD
// =====================================================

function darPrioridad(laneDirection, laneIsExt) {
    // Si ya hay una prioridad activa, no hacer nada
    if (prioridad) return;
    
    // Cancelar cualquier timeout pendiente de finalización
    if (timeoutPrioridad) {
        clearTimeout(timeoutPrioridad);
        timeoutPrioridad = null;
    }
    
    prioridad = true;
    inicio_prioridad = Date.now();
    resto = duracionFase - (inicio_prioridad - inicio_fase);
    
    // Deshabilitar todos los botones de prioridad durante la operación
    for (let i = 0; i < botones_prioridad.length; i++) {
        botones_prioridad[i].disabled = true;
    }
    
    // Detener el ciclo normal actual
    clearTimeout(timerActual);
    
    // Poner todos los semáforos en rojo
    todoAlRojoPrioridad();
    
    // Obtener los semáforos prioritarios
    const prioritarySemaphores = getPrioritarySemaphores(laneDirection, laneIsExt);
    
    // Marcar los semáforos prioritarios y cambiar a ámbar (luego verde)
    for (const semCircles of prioritarySemaphores) {
        if (!semCircles) continue;
        
        const rojo = semCircles[0];
        const ambar = semCircles[1];
        const verde = semCircles[2];
        
        // Marcar como prioritario (para que no sean afectados por otros procesos)
        rojo.classList.add("prio");
        ambar.classList.add("prio");
        verde.classList.add("prio");
        
        // Si el semáforo está en rojo, pasar a ámbar
        if (rojo.classList.contains("on")) {
            rojo.classList.remove("on");
            ambar.classList.add("on");
        }
    }
    
    // Después de 2 segundos en ámbar, pasar a verde (esperando que el carril esté libre)
    setTimeout(() => {
        for (const semCircles of prioritarySemaphores) {
            if (!semCircles) continue;
            
            const rojo = semCircles[0];
            const ambar = semCircles[1];
            const verde = semCircles[2];
            
            // Verificar conflictos de carril antes de dar verde
            esperarYDarVerde(laneDirection, laneIsExt, semCircles, (circles) => {
                if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                    ambar.classList.remove("on");
                    verde.classList.add("on");
                    rojo.classList.remove("on");
                }
            });
        }
    }, 2000);
}

// =====================================================
// FINALIZACIÓN DE PRIORIDAD
// =====================================================

function finPrioridad() {
    if (!prioridad) return;
    
    const tiempoTranscurrido = Date.now() - inicio_prioridad;
    
    // Si ha pasado menos de 2 segundos, esperar a que termine el ciclo de ámbar
    if (tiempoTranscurrido < 2000) {
        // Programar la finalización después de que termine el ámbar
        if (timeoutPrioridad) clearTimeout(timeoutPrioridad);
        timeoutPrioridad = setTimeout(() => {
            finalizarPrioridad();
        }, 2000 - tiempoTranscurrido);
        return;
    }
    
    finalizarPrioridad();
}

function finalizarPrioridad() {
    if (!prioridad) return;
    
    // Poner en ámbar los semáforos que estaban en verde prioritario
    for (let i = 0; i < semaforos_interseccion.length; i += 3) {
        const rojo = semaforos_interseccion[i];
        const ambar = semaforos_interseccion[i+1];
        const verde = semaforos_interseccion[i+2];
        
        if (rojo.classList.contains("prio") && verde.classList.contains("on")) {
            verde.classList.remove("on");
            ambar.classList.add("on");
        }
    }
    
    // Esperar 2 segundos en ámbar y luego restaurar el ciclo normal
    setTimeout(() => {
        // Limpiar marcas de prioridad
        for (let i = 0; i < semaforos_interseccion.length; i++) {
            if (semaforos_interseccion[i].classList.contains("prio")) {
                semaforos_interseccion[i].classList.remove("prio");
            }
        }
        
        // Apagar todas las luces y poner en rojo
        apagarTodas();
        todoAlRojo();
        
        // Reanudar el ciclo desde la fase en la que estaba interrumpido
        reanudarCiclo(resto);
        
        prioridad = false;
        
        // Rehabilitar botones de prioridad
        for (let i = 0; i < botones_prioridad.length; i++) {
            botones_prioridad[i].disabled = false;
        }
        
        timeoutPrioridad = null;
    }, 2000);
}

function reanudarCiclo(tiempoRestante) {
    // Restaurar el ciclo desde la fase actual con el tiempo restante
    switch (ciclo_semaforos) {
        case 1: ciclo1(); timerActual = setTimeout(t10_15, tiempoRestante); break;
        case 2: ciclo2(); timerActual = setTimeout(t15_17, tiempoRestante); break;
        case 3: ciclo3(); timerActual = setTimeout(t17_27, tiempoRestante); break;
        case 4: ciclo4(); timerActual = setTimeout(t27_32, tiempoRestante); break;
        case 5: ciclo5(); timerActual = setTimeout(t32_34, tiempoRestante); break;
        case 6: ciclo6(); timerActual = setTimeout(t34_44, tiempoRestante); break;
        case 7: ciclo7(); timerActual = setTimeout(t44_49, tiempoRestante); break;
        case 8: ciclo8(); timerActual = setTimeout(t49_51, tiempoRestante); break;
        case 9: ciclo9(); timerActual = setTimeout(t51_61, tiempoRestante); break;
        case 10: ciclo10(); timerActual = setTimeout(t61_66, tiempoRestante); break;
        case 11: ciclo11(); timerActual = setTimeout(t66_68, tiempoRestante); break;
        case 12: ciclo12(); timerActual = setTimeout(t0_10, tiempoRestante); break;
        default: t0_10(); break;
    }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

boton_ext_N.addEventListener("mousedown", () => darPrioridad("N", true));
boton_int_N.addEventListener("mousedown", () => darPrioridad("N", false));
boton_ext_S.addEventListener("mousedown", () => darPrioridad("S", true));
boton_int_S.addEventListener("mousedown", () => darPrioridad("S", false));
boton_ext_E.addEventListener("mousedown", () => darPrioridad("E", true));
boton_int_E.addEventListener("mousedown", () => darPrioridad("E", false));
boton_ext_O.addEventListener("mousedown", () => darPrioridad("O", true));
boton_int_O.addEventListener("mousedown", () => darPrioridad("O", false));

document.addEventListener("pointerup", () => finPrioridad());