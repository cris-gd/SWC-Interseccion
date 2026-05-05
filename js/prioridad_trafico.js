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

// =====================================================
// CONFLICTOS DE CARRIL: rutas cuyo destino comparte carril físico
// con la ruta priorizada. Hay que esperar a que esos coches despejen
// antes de dar el verde de prioridad.
// =====================================================

// Para cada combinación (dirección, esExt), lista de rutas {from,to}
// cuyo DESTINO ocupa el mismo carril que la ruta priorizada.
const CONFLICTOS_PRIORIDAD = {
    'N-ext': [{ from:'E', to:'O' }, { from:'S', to:'O' }],  // prio N→O/S → carril O y carril S
    'N-int': [{ from:'S', to:'E' }, { from:'O', to:'E' }],  // prio N→E  → carril E
    'S-ext': [{ from:'O', to:'E' }, { from:'N', to:'E' }],  // prio S→E/N → carril E y carril N
    'S-int': [{ from:'E', to:'O' }, { from:'N', to:'O' }],  // prio S→O  → carril O
    'E-ext': [{ from:'N', to:'O' }, { from:'S', to:'O' }],  // prio E→O/N → carril O y carril N  
    'E-int': [{ from:'N', to:'S' }, { from:'O', to:'S' }],  // prio E→S  → carril S
    'O-ext': [{ from:'N', to:'S' }, { from:'S', to:'E' }],  // prio O→S/E → carril S y carril E
    'O-int': [{ from:'E', to:'N' }, { from:'S', to:'N' }],  // prio O→N  → carril N
};

/**
 * Devuelve true si hay algún coche activo cuya ruta (from→to) coincida
 * con alguna de las rutas conflictivas para la prioridad pedida,
 * Y ese coche ya cruzó la stop-line (está en la intersección o más allá),
 * es decir, aún puede ocupar el carril destino.
 */
function hayConflictoEnCarril(laneDirection, laneIsExt) {
    const key = laneDirection + (laneIsExt ? '-ext' : '-int');
    const conflictos = CONFLICTOS_PRIORIDAD[key];
    if (!conflictos || typeof activeCars === 'undefined') return false;

    const stopLines = { S: 230, N: 450, E: 230, O: 450 };

    for (const car of activeCars) {
        if (car.isEmergency) continue;
        // ¿Coincide la ruta del coche con algún conflicto?
        const esConflicto = conflictos.some(c => c.from === car.from && c.to === car.to);
        if (!esConflicto) continue;

        // ¿Ya cruzó la stop-line? (está en tránsito por la intersección)
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

/**
 * Espera hasta que no haya coches conflictivos en tránsito y luego
 * ejecuta el callback que activa el verde de prioridad.
 * Reintenta cada 150ms con un timeout máximo de 4s para no bloquear indefinidamente.
 */
function esperarYDarVerde(laneDirection, laneIsExt, callback) {
    const MAX_WAIT = 4000;
    const POLL_MS  = 150;
    const start    = Date.now();

    function poll() {
        if (!hayConflictoEnCarril(laneDirection, laneIsExt) || (Date.now() - start) >= MAX_WAIT) {
            callback();
        } else {
            setTimeout(poll, POLL_MS);
        }
    }
    poll();
}

function darPrioridad (laneDirection, laneIsExt){
    if (prioridad) return;
    prioridad = true;
    inicio_prioridad = Date.now()
    resto = duracionFase - (inicio_prioridad - inicio_fase);
    for (let i = 0; i < botones_prioridad.length; i++){
        botones_prioridad[i].disabled = true;
    }
    clearTimeout(timerActual);
    switch(laneDirection){
        case "N":
            if(laneIsExt){
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-N-O-") || semaforos_interseccion[i].id.includes("-N-S-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-N-E-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }
            }
            break;
        case "S":
            if(laneIsExt){
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-S-E-") || semaforos_interseccion[i].id.includes("-S-N-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-S-O-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }          
            }
            break;
        case "E":
            if(laneIsExt){
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-E-N-") || semaforos_interseccion[i].id.includes("-E-O-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-E-S-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                } 
            }
            break;
        case "O":
            if(laneIsExt){
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-O-S-") || semaforos_interseccion[i].id.includes("-O-E-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-O-N-")) {

                        // Marcar como prio inmediatamente (mantiene el ámbar/rojo actual)
                        rojo.classList.add("prio");
                        ambar.classList.add("prio");
                        verde.classList.add("prio");
                        // Capturar referencias para el closure
                        (function(r, a, v) {
                            // Dar ámbar primero (1s), luego esperar carril libre y dar verde
                            setTimeout(() => {
                                esperarYDarVerde(laneDirection, laneIsExt, () => {
                                    if (!r.classList.contains("bloqueado") && !r.classList.contains("trainblock")) {
                                        a.classList.remove("on");
                                        v.classList.add("on");
                                        r.classList.remove("on");
                                    }
                                });
                            }, 2000);
                        })(rojo, ambar, verde);

                    }else{

                        if(verde.classList.contains("on")){
                            ambar.classList.add("on");
                            verde.classList.remove("on");
                            rojo.classList.remove("on");
                        }
                        setTimeout(() => {
                            ambar.classList.remove("on");
                            verde.classList.remove("on");
                            rojo.classList.add("on");
                        }, 2000);

                    }

                } 
            }
            break;
    }
}

function finPrioridad (){
    if(prioridad){
        if((Date.now() - inicio_prioridad)<2000){
            setTimeout(() => {

            for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                if (semaforos_interseccion[i].classList.contains("prio") && !semaforos_interseccion[i].classList.contains("bloqueado") && !semaforos_interseccion[i].classList.contains("trainblock")){
                    semaforos_interseccion[i+2].classList.remove("on");
                    semaforos_interseccion[i+1].classList.add("on");
                }
            }
            switch (ciclo_semaforos){
                case 1:
                    if(colores_EO[0].classList.contains("prio") && !colores_EO[0].classList.contains("bloqueado") && !colores_EO[0].classList.contains("trainblock")){
                        colores_EO[1].classList.remove("on");
                        colores_EO[2].classList.add("on");
                    }
                    if(colores_EN[0].classList.contains("prio") && !colores_EN[0].classList.contains("bloqueado") && !colores_EN[0].classList.contains("trainblock")){
                        colores_EN[1].classList.remove("on");
                        colores_EN[2].classList.add("on");
                    }
                    if(colores_OS[0].classList.contains("prio") && !colores_OS[0].classList.contains("bloqueado") && !colores_OS[0].classList.contains("trainblock")){
                        colores_OS[1].classList.remove("on");
                        colores_OS[2].classList.add("on");
                    }
                    if(colores_OE[0].classList.contains("prio") && !colores_OE[0].classList.contains("bloqueado") && !colores_OE[0].classList.contains("trainblock")){
                        colores_OE[1].classList.remove("on");
                        colores_OE[2].classList.add("on");
                    }
                    break;
                case 4:
                    if(colores_ON[0].classList.contains("prio") && !colores_ON[0].classList.contains("bloqueado") && !colores_ON[0].classList.contains("trainblock")){
                        colores_ON[1].classList.remove("on");
                        colores_ON[2].classList.add("on");
                    }
                    if(colores_NO[0].classList.contains("prio") && !colores_NO[0].classList.contains("bloqueado") && !colores_NO[0].classList.contains("trainblock")){
                        colores_NO[1].classList.remove("on");
                        colores_NO[2].classList.add("on");
                    }
                    if(colores_ES[0].classList.contains("prio") && !colores_ES[0].classList.contains("bloqueado") && !colores_ES[0].classList.contains("trainblock")){
                        colores_ES[1].classList.remove("on");
                        colores_ES[2].classList.add("on");
                    }
                    if(colores_SE[0].classList.contains("prio") && !colores_SE[0].classList.contains("bloqueado") && !colores_SE[0].classList.contains("trainblock")){
                        colores_SE[1].classList.remove("on");
                        colores_SE[2].classList.add("on");
                    }
                    break;
                case 7:
                    if(colores_NO[0].classList.contains("prio") && !colores_NO[0].classList.contains("bloqueado") && !colores_NO[0].classList.contains("trainblock")){
                        colores_NO[1].classList.remove("on");
                        colores_NO[2].classList.add("on");
                    }
                    if(colores_SN[0].classList.contains("prio") && !colores_SN[0].classList.contains("bloqueado") && !colores_SN[0].classList.contains("trainblock")){
                        colores_SN[1].classList.remove("on");
                        colores_SN[2].classList.add("on");
                    }
                    if(colores_NS[0].classList.contains("prio") && !colores_NS[0].classList.contains("bloqueado") && !colores_NS[0].classList.contains("trainblock")){
                        colores_NS[1].classList.remove("on");
                        colores_NS[2].classList.add("on");
                    }
                    if(colores_SE[0].classList.contains("prio") && !colores_SE[0].classList.contains("bloqueado") && !colores_SE[0].classList.contains("trainblock")){
                        colores_SE[1].classList.remove("on");
                        colores_SE[2].classList.add("on");
                    }
                    break;
                case 10:
                    if(colores_NE[0].classList.contains("prio") && !colores_NE[0].classList.contains("bloqueado") && !colores_NE[0].classList.contains("trainblock")){
                        colores_NE[1].classList.remove("on");
                        colores_NE[2].classList.add("on");
                    }
                    if(colores_EN[0].classList.contains("prio") && !colores_EN[0].classList.contains("bloqueado") && !colores_EN[0].classList.contains("trainblock")){
                        colores_EN[1].classList.remove("on");
                        colores_EN[2].classList.add("on");
                    }
                    if(colores_OS[0].classList.contains("prio") && !colores_OS[0].classList.contains("bloqueado") && !colores_OS[0].classList.contains("trainblock")){
                        colores_OS[1].classList.remove("on");
                        colores_OS[2].classList.add("on");
                    }
                    if(colores_SO[0].classList.contains("prio") && !colores_SO[0].classList.contains("bloqueado") && !colores_SO[0].classList.contains("trainblock")){
                        colores_SO[1].classList.remove("on");
                        colores_SO[2].classList.add("on");
                    }
                    break;
            }
            setTimeout(() => {
                for (let i = 0; i < semaforos_interseccion.length; i++) {
                    if (semaforos_interseccion[i].classList.contains("prio")){
                        semaforos_interseccion[i].classList.remove("prio");
                    }
                }
                apagarTodas();
                todoAlRojo();
                switch (ciclo_semaforos){
                    case 1:
                        ciclo1();
                        timerActual = setTimeout(t10_15, resto);           
                        break;
                    case 2:
                        ciclo2();
                        timerActual = setTimeout(t15_17, resto); 
                        break;
                    case 3:
                        ciclo3();
                        timerActual = setTimeout(t17_27, resto); 
                        break;
                    case 4:
                        ciclo4();
                        timerActual = setTimeout(t27_32, resto); 
                        break;
                    case 5:
                        ciclo5();
                        timerActual = setTimeout(t32_34, resto); 
                        break;
                    case 6:
                        ciclo6();
                        timerActual = setTimeout(t34_44, resto); 
                        break;
                    case 7:
                        ciclo7();
                        timerActual = setTimeout(t44_49, resto); 
                        break;
                    case 8:
                        ciclo8();
                        timerActual = setTimeout(t49_51, resto); 
                        break;
                    case 9:
                        ciclo9();
                        timerActual = setTimeout(t51_61, resto); 
                        break;
                    case 10:
                        ciclo10();
                        timerActual = setTimeout(t61_66, resto); 
                        break;
                    case 11:
                        ciclo11();
                        timerActual = setTimeout(t66_68, resto); 
                        break;
                    case 12:
                        ciclo12();
                        timerActual = setTimeout(t0_10, resto); 
                        break;
                }
                prioridad = false;
                    for (let i = 0; i < botones_prioridad.length; i++){
                        botones_prioridad[i].disabled = false;
                    }
            }, 2000);
            }, 2000);
        }
        else{
            for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                if (semaforos_interseccion[i].classList.contains("prio") && !semaforos_interseccion[i].classList.contains("bloqueado") && !semaforos_interseccion[i].classList.contains("trainblock")){
                    semaforos_interseccion[i+2].classList.remove("on");
                    semaforos_interseccion[i+1].classList.add("on");
                }
            }
            switch (ciclo_semaforos){
                case 1:
                    if(colores_EO[0].classList.contains("prio") && !colores_EO[0].classList.contains("bloqueado") && !colores_EO[0].classList.contains("trainblock")){
                        colores_EO[1].classList.remove("on");
                        colores_EO[2].classList.add("on");
                    }
                    if(colores_EN[0].classList.contains("prio") && !colores_EN[0].classList.contains("bloqueado") && !colores_EN[0].classList.contains("trainblock")){
                        colores_EN[1].classList.remove("on");
                        colores_EN[2].classList.add("on");
                    }
                    if(colores_OS[0].classList.contains("prio") && !colores_OS[0].classList.contains("bloqueado") && !colores_OS[0].classList.contains("trainblock")){
                        colores_OS[1].classList.remove("on");
                        colores_OS[2].classList.add("on");
                    }
                    if(colores_OE[0].classList.contains("prio") && !colores_OE[0].classList.contains("bloqueado") && !colores_OE[0].classList.contains("trainblock")){
                        colores_OE[1].classList.remove("on");
                        colores_OE[2].classList.add("on");
                    }
                    break;
                case 4:
                    if(colores_ON[0].classList.contains("prio") && !colores_ON[0].classList.contains("bloqueado") && !colores_ON[0].classList.contains("trainblock")){
                        colores_ON[1].classList.remove("on");
                        colores_ON[2].classList.add("on");
                    }
                    if(colores_NO[0].classList.contains("prio") && !colores_NO[0].classList.contains("bloqueado") && !colores_NO[0].classList.contains("trainblock")){
                        colores_NO[1].classList.remove("on");
                        colores_NO[2].classList.add("on");
                    }
                    if(colores_ES[0].classList.contains("prio") && !colores_ES[0].classList.contains("bloqueado") && !colores_ES[0].classList.contains("trainblock")){
                        colores_ES[1].classList.remove("on");
                        colores_ES[2].classList.add("on");
                    }
                    if(colores_SE[0].classList.contains("prio") && !colores_SE[0].classList.contains("bloqueado") && !colores_SE[0].classList.contains("trainblock")){
                        colores_SE[1].classList.remove("on");
                        colores_SE[2].classList.add("on");
                    }
                    break;
                case 7:
                    if(colores_NO[0].classList.contains("prio") && !colores_NO[0].classList.contains("bloqueado") && !colores_NO[0].classList.contains("trainblock")){
                        colores_NO[1].classList.remove("on");
                        colores_NO[2].classList.add("on");
                    }
                    if(colores_SN[0].classList.contains("prio") && !colores_SN[0].classList.contains("bloqueado") && !colores_SN[0].classList.contains("trainblock")){
                        colores_SN[1].classList.remove("on");
                        colores_SN[2].classList.add("on");
                    }
                    if(colores_NS[0].classList.contains("prio") && !colores_NS[0].classList.contains("bloqueado") && !colores_NS[0].classList.contains("trainblock")){
                        colores_NS[1].classList.remove("on");
                        colores_NS[2].classList.add("on");
                    }
                    if(colores_SE[0].classList.contains("prio") && !colores_SE[0].classList.contains("bloqueado") && !colores_SE[0].classList.contains("trainblock")){
                        colores_SE[1].classList.remove("on");
                        colores_SE[2].classList.add("on");
                    }
                    break;
                case 10:
                    if(colores_NE[0].classList.contains("prio") && !colores_NE[0].classList.contains("bloqueado") && !colores_NE[0].classList.contains("trainblock")){
                        colores_NE[1].classList.remove("on");
                        colores_NE[2].classList.add("on");
                    }
                    if(colores_EN[0].classList.contains("prio") && !colores_EN[0].classList.contains("bloqueado") && !colores_EN[0].classList.contains("trainblock")){
                        colores_EN[1].classList.remove("on");
                        colores_EN[2].classList.add("on");
                    }
                    if(colores_OS[0].classList.contains("prio") && !colores_OS[0].classList.contains("bloqueado") && !colores_OS[0].classList.contains("trainblock")){
                        colores_OS[1].classList.remove("on");
                        colores_OS[2].classList.add("on");
                    }
                    if(colores_SO[0].classList.contains("prio") && !colores_SO[0].classList.contains("bloqueado") && !colores_SO[0].classList.contains("trainblock")){
                        colores_SO[1].classList.remove("on");
                        colores_SO[2].classList.add("on");
                    }
                    break;
            }
            setTimeout(() => {
                for (let i = 0; i < semaforos_interseccion.length; i++) {
                    if (semaforos_interseccion[i].classList.contains("prio")){
                        semaforos_interseccion[i].classList.remove("prio");
                    }
                }
                apagarTodas();
                todoAlRojo();
                switch (ciclo_semaforos){
                    case 1:
                        ciclo1();
                        timerActual = setTimeout(t10_15, resto);           
                        break;
                    case 2:
                        ciclo2();
                        timerActual = setTimeout(t15_17, resto); 
                        break;
                    case 3:
                        ciclo3();
                        timerActual = setTimeout(t17_27, resto); 
                        break;
                    case 4:
                        ciclo4();
                        timerActual = setTimeout(t27_32, resto); 
                        break;
                    case 5:
                        ciclo5();
                        timerActual = setTimeout(t32_34, resto); 
                        break;
                    case 6:
                        ciclo6();
                        timerActual = setTimeout(t34_44, resto); 
                        break;
                    case 7:
                        ciclo7();
                        timerActual = setTimeout(t44_49, resto); 
                        break;
                    case 8:
                        ciclo8();
                        timerActual = setTimeout(t49_51, resto); 
                        break;
                    case 9:
                        ciclo9();
                        timerActual = setTimeout(t51_61, resto); 
                        break;
                    case 10:
                        ciclo10();
                        timerActual = setTimeout(t61_66, resto); 
                        break;
                    case 11:
                        ciclo11();
                        timerActual = setTimeout(t66_68, resto); 
                        break;
                    case 12:
                        ciclo12();
                        timerActual = setTimeout(t0_10, resto); 
                        break;
                }
                prioridad = false;
                    for (let i = 0; i < botones_prioridad.length; i++){
                        botones_prioridad[i].disabled = false;
                    }
            }, 2000);
            
        }
        
    }
}




boton_ext_N.addEventListener("mousedown", () => darPrioridad("N", true));
boton_int_N.addEventListener("mousedown", () => darPrioridad("N", false));
boton_ext_S.addEventListener("mousedown", () => darPrioridad("S", true));
boton_int_S.addEventListener("mousedown", () => darPrioridad("S", false));
boton_ext_E.addEventListener("mousedown", () => darPrioridad("E", true));
boton_int_E.addEventListener("mousedown", () => darPrioridad("E", false));
boton_ext_O.addEventListener("mousedown", () => darPrioridad("O", true));
boton_int_O.addEventListener("mousedown", () => darPrioridad("O", false));

document.addEventListener("pointerup", () => finPrioridad());