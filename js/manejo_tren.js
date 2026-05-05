const barrierNorth = document.getElementById('barrier-N');
const barrierSouth = document.getElementById('barrier-S');
const intervaloInput = document.getElementById('intervalo-tren');

const semaforos_tren = document.querySelectorAll("[id^='rail-tl'] circle");

let intervaloActivo = null;
let timeoutActual = null;
let timeoutAmbar = null;
let timeoutVerde = null;

// Añadir clases CSS a las barreras
barrierNorth.classList.add('barrera-norte');
barrierSouth.classList.add('barrera-sur');

const train = document.getElementById('train');
let bloqueo_tren = false;

function bloquearVehiculosT() {
    for (let i = 0; i < direc_E.length; i += 3) {
        const rojo  = direc_E[i];
        const ambar = direc_E[i+1];
        const verde = direc_E[i+2];

        if (verde.classList.contains("on")) {
            verde.classList.remove("on");
            ambar.classList.add("on");
            rojo.classList.add("trainblock");
            setTimeout(() => {
                ambar.classList.remove("on");
                rojo.classList.add("on");
            }, 5000);
        } else if (ambar.classList.contains("on")) {
            rojo.classList.add("trainblock");
            setTimeout(() => {
                ambar.classList.remove("on");
                rojo.classList.add("on");
            }, 5000);
        } else {
            rojo.classList.add("trainblock");
        }
    }
}
function desbloquearVehiculosT() {
    for (let i = 0; i < direc_E.length; i += 3) {
        direc_E[i].classList.remove("trainblock");
    }
}
function finBloqueoT(circles, index) {
    if(!prioridad){
        // Si cualquier luz del grupo está bloqueada, no tocar nada
        for (let i = 0; i < circles.length; i++) {
            if (circles[i].classList.contains("trainblock")) return;
        }
        for (let i = 0; i < circles.length; i++) {
            circles[i].classList.remove("on");
        }
        circles[index].classList.add("on");
    }

}

function patch2() {
    if(prioridad){
        for (let i = 0; i < semaforos_interseccion.length; i+=3) {
            if (semaforos_interseccion[i].classList.contains("prio") && !semaforos_interseccion[i].classList.contains("bloqueado") && !semaforos_interseccion[i].classList.contains("trainblock")){
                semaforos_interseccion[i].classList.remove("on");
                semaforos_interseccion[i+1].classList.remove("on");
                semaforos_interseccion[i+2].classList.add("on");
            }
        }
    }
}



function pasarTren() {
    // Reiniciar animación
    train.classList.remove('animar');
    
    // Forzar reflow para reiniciar la animación
    void train.offsetWidth;
    
    // Añadir clase para animar
    train.classList.add('animar');
    
    // Cuando termine la animación, ocultar el tren
    train.addEventListener('animationend', () => {
        train.classList.remove('animar');
    }, { once: true });
}

// Ejemplo: que el tren pase cuando las barreras están bajadas
// Llama a pasarTren() en el momento que quieras

function limpiarSemaforos() {
    for (let i = 0; i < semaforos_tren.length; i++) {
        semaforos_tren[i].classList.remove("on");
    }
}

function verdeTren() {
    limpiarSemaforos();
    for (let i = 2; i < semaforos_tren.length; i += 3) {
        semaforos_tren[i].classList.add("on");
    }
}

function ambarTren() {
    limpiarSemaforos();
    for (let i = 1; i < semaforos_tren.length; i += 3) {
        semaforos_tren[i].classList.add("on");
    }
}

function rojoTren() {
    limpiarSemaforos();
    for (let i = 0; i < semaforos_tren.length; i += 3) {
        semaforos_tren[i].classList.add("on");
    }
}

function lowerBarriers() {
    // Quitar clases de subida y añadir clase de bajada
    barrierNorth.classList.remove('subiendo');
    barrierSouth.classList.remove('subiendo');
    barrierNorth.classList.add('bajando');
    barrierSouth.classList.add('bajando');
}

function raiseBarriers() {
    // Quitar clases de bajada y añadir clase de subida
    barrierNorth.classList.remove('bajando');
    barrierSouth.classList.remove('bajando');
    barrierNorth.classList.add('subiendo');
    barrierSouth.classList.add('subiendo');
}

function ejecutarCiclo() {
    if (bloqueo_tren) return;
    // Limpiar timeouts anteriores
    if (timeoutActual) clearTimeout(timeoutActual);
    if (timeoutAmbar) clearTimeout(timeoutAmbar);
    if (timeoutVerde) clearTimeout(timeoutVerde);
    
    // 1. Poner ámbar durante 5 segundos (aviso de que van a bajar)
    bloqueo_tren=true;
    ambarTren();
    bloquearVehiculosT();
    
    // 2. Después de 5 segundos, bajar barreras y poner rojo
    timeoutAmbar = setTimeout(() => {
        lowerBarriers();
        rojoTren();

        pasarTren();
        
        // 3. Después de 7 segundos (tiempo que están bajadas), subir barreras
        timeoutActual = setTimeout(() => {
            raiseBarriers();
            
            // 4. Esperar 2 segundos más y poner verde
            timeoutVerde = setTimeout(() => {
                verdeTren();
                desbloquearVehiculosT();
                bloqueo_tren = false;
                if(bloqueando['E']==false){
                    switch(ciclo_semaforos){
                        case 1:          
                            finBloqueoT(colores_OE, 2);
                            patch2();
                            break;
                        case 4:
                            finBloqueoT(colores_SE, 2);
                            patch2();
                            break;
                        case 7:
                            finBloqueoT(colores_SE, 2);
                            patch2();
                            break;
                        case 10:
                            finBloqueoT(colores_NE, 2);
                            patch2();
                            break;
                        default:
                            patch2();
                            break;
                    }
                }
                
            }, 2000);
            
        }, 7000);
        
    }, 5000);
}

function iniciarBucle() {
    // Detener intervalo anterior si existe
    if (intervaloActivo) {
        clearInterval(intervaloActivo);
    }
    
    const segundos = parseInt(intervaloInput.value);
    if (isNaN(segundos) || segundos < 1) return;
    
    // Ejecutar primer ciclo inmediatamente
    ejecutarCiclo();
    
    // Configurar intervalo periódico
    intervaloActivo = setInterval(() => {
        ejecutarCiclo();
    }, segundos * 1000);
}

// Escuchar cambios en el input
intervaloInput.addEventListener('change', iniciarBucle);

// Iniciar al cargar la página
iniciarBucle();