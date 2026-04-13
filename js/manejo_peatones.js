const semaforos_peatones = document.querySelectorAll("circle[id^='tlp-']");
const semaforos_O_p = document.querySelectorAll("[id^='tlp-O'] circle");
const semaforos_E_p = document.querySelectorAll("[id^='tlp-E'] circle");
const semaforos_N_p = document.querySelectorAll("[id^='tlp-N'] circle");
const semaforos_S_p = document.querySelectorAll("[id^='tlp-S'] circle");

const direc_O = document.querySelectorAll("[id^='tl-'][id$='-O'] circle");
const direc_E = document.querySelectorAll("[id^='tl-'][id$='-E'] circle");
const direc_N = document.querySelectorAll("[id^='tl-'][id$='-N'] circle");
const direc_S = document.querySelectorAll("[id^='tl-'][id$='-S'] circle");


// Todos los peatones empiezan en verde
function todoAlVerdePeatones() {
    for (let i = 2; i < semaforos_peatones.length; i += 3) {
        semaforos_peatones[i].classList.add("on");
    }
}
todoAlVerdePeatones();

const bloqueando = { N: false, S: false, E: false, O: false };
const semPeatonPorDir = { N: semaforos_N_p, S: semaforos_S_p, E: semaforos_E_p, O: semaforos_O_p };
const semVehicPorDir  = { N: direc_N, S: direc_S, E: direc_E, O: direc_O };

// Referencias a los elementos de peatones animados
const peatones = {
    N: document.getElementById("peaton-N"),
    S: document.getElementById("peaton-S"),
    E: document.getElementById("peaton-E"),
    O: document.getElementById("peaton-O")
};

function aplicarEstadoPeaton(semList, indiceActivo) {
    for (let i = 0; i < semList.length; i += 3) {
        semList[i].classList.remove("on");
        semList[i+1].classList.remove("on");
        semList[i+2].classList.remove("on");
        semList[i + indiceActivo].classList.add("on");
    }
}

function reiniciarAnimacionPeaton(dir) {
    const peaton = peatones[dir];
    if (!peaton) return;
    
    // Quitar clase animando si existe
    peaton.classList.remove('animando');
    
    // Forzar reflow
    void peaton.offsetWidth;
    
    // Clonar y reemplazar para reiniciar la animación
    const nuevoPeaton = peaton.cloneNode(true);
    peaton.parentNode.replaceChild(nuevoPeaton, peaton);
    peatones[dir] = nuevoPeaton;
    
    // Añadir clase animando para mostrar y animar
    nuevoPeaton.classList.add('animando');
    
    // Hacer que el peatón desaparezca después de que termine la animación (3 segundos)
    setTimeout(() => {
        if (peatones[dir]) {
            peatones[dir].classList.remove('animando');
        }
    }, 3000);
}

function bloquearVehiculos(semV) {
    for (let i = 0; i < semV.length; i += 3) {
        const rojo  = semV[i];
        const ambar = semV[i+1];
        const verde = semV[i+2];

        if (verde.classList.contains("on")) {
            verde.classList.remove("on");
            ambar.classList.add("on");
            rojo.classList.add("bloqueado");
            setTimeout(() => {
                ambar.classList.remove("on");
                rojo.classList.add("on");
            }, 5000);
        } else if (ambar.classList.contains("on")) {
            rojo.classList.add("bloqueado");
        } else {
            rojo.classList.add("bloqueado");
        }
    }
}

function desbloquearVehiculos(semV) {
    for (let i = 0; i < semV.length; i += 3) {
        semV[i].classList.remove("bloqueado");
    }
}

function finBloqueo(circles, index) {
    // Si cualquier luz del grupo está bloqueada, no tocar nada
    for (let i = 0; i < circles.length; i++) {
        if (circles[i].classList.contains("bloqueado")) return;
    }
    for (let i = 0; i < circles.length; i++) {
        circles[i].classList.remove("on");
    }
    circles[index].classList.add("on");
}

function activarPeaton(dir) {
    if (bloqueando[dir]) return;
    bloqueando[dir] = true;

    const semP = semPeatonPorDir[dir];
    const semV = semVehicPorDir[dir];

    // Paso 1: Peatón: verde → ámbar inmediatamente
    aplicarEstadoPeaton(semP, 1);
    bloquearVehiculos(semV);

    setTimeout(() => {
        // Paso 2: 5s después: peatón → rojo (empieza el cruce)
        aplicarEstadoPeaton(semP, 0);
        
        // INICIAR ANIMACIÓN DEL PEATÓN (dura 3 segundos)
        reiniciarAnimacionPeaton(dir);
        
        // Paso 3: Esperar 10 segundos TOTALES en rojo
        // (3 segundos de animación + 7 segundos adicionales de seguridad)
        setTimeout(() => {
            // Paso 4: Después de 10s en rojo: peatón → verde
            aplicarEstadoPeaton(semP, 2);
            
            // Paso 5: Desbloquear vehículos (vuelven a su ciclo normal)
            desbloquearVehiculos(semV);
            bloqueando[dir] = false;
            //console.log(ciclo_semaforos);
            switch(dir){
                case 'N':
                    switch(ciclo_semaforos){
                        case 1:          
                            finBloqueo(colores_EN, 2);
                            break;
                        case 4:
                            finBloqueo(colores_ON, 2);
                            break;
                        case 7:
                            finBloqueo(colores_SN, 2);
                            break;
                        case 10:
                            finBloqueo(colores_EN, 2);
                            break;
                    }
                    break;
                case 'S':
                    switch(ciclo_semaforos){
                        case 1:          
                            finBloqueo(colores_OS, 2);
                            break;
                        case 4:
                            finBloqueo(colores_ES, 2);
                            break;
                        case 7:
                            finBloqueo(colores_NS, 2);
                            break;
                        case 10:
                            finBloqueo(colores_OS, 2);
                            break;
                    }
                    break;
                case 'E':
                    if(bloqueo_tren == false){
                        switch(ciclo_semaforos){
                            case 1:          
                                finBloqueo(colores_OE, 2);
                                break;
                            case 4:
                                finBloqueo(colores_SE, 2);
                                break;
                            case 7:
                                finBloqueo(colores_SE, 2);
                                break;
                            case 10:
                                finBloqueo(colores_NE, 2);
                                break;
                        }
                        break;
                    }
                    
                case 'O':
                    switch(ciclo_semaforos){
                        case 1:          
                            finBloqueo(colores_EO, 2);
                            break;
                        case 4:
                            finBloqueo(colores_NO, 2);
                            break;
                        case 7:
                            finBloqueo(colores_NO, 2);
                            break;
                        case 10:
                            finBloqueo(colores_SO, 2);
                            break;
                    }
                    break;
            }
        }, 10000); // 10 segundos totales en rojo
        
    }, 5000); // Tiempo que el semáforo peatonal está en ámbar
}

document.getElementById("boton-peatones-N").addEventListener("click", () => activarPeaton("N"));
document.getElementById("boton-peatones-S").addEventListener("click", () => activarPeaton("S"));
document.getElementById("boton-peatones-E").addEventListener("click", () => activarPeaton("E"));
document.getElementById("boton-peatones-O").addEventListener("click", () => activarPeaton("O"));