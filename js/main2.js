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

function aplicarEstadoPeaton(semList, indiceActivo) {
    for (let i = 0; i < semList.length; i += 3) {
        semList[i].classList.remove("on");
        semList[i+1].classList.remove("on");
        semList[i+2].classList.remove("on");
        semList[i + indiceActivo].classList.add("on");
    }
}

function bloquearVehiculos(semV) {
    for (let i = 0; i < semV.length; i += 3) {
        const rojo  = semV[i];
        const ambar = semV[i+1];
        const verde = semV[i+2];

        if (verde.classList.contains("on")) {
            // Estaba en verde: imitar ciclo (verde→ambar→rojo)
            verde.classList.remove("on");
            ambar.classList.add("on");
            rojo.classList.add("bloqueado");   // ← el ciclo no tocará este semáforo
            setTimeout(() => {
                ambar.classList.remove("on");
                rojo.classList.add("on");
            }, 5000);
        } else if (ambar.classList.contains("on")) {
            // Estaba en ámbar: dejar que termine y luego bloquear en rojo
            rojo.classList.add("bloqueado");
            // El ciclo normal lo pondrá en rojo; el bloqueo lo mantiene ahí
        } else {
            // Ya estaba en rojo: simplemente bloquear
            rojo.classList.add("bloqueado");
        }
    }
}

function desbloquearVehiculos(semV) {
    for (let i = 0; i < semV.length; i += 3) {
        semV[i].classList.remove("bloqueado");
        // No tocamos .on — el ciclo lo retomará en su próxima llamada
    }
}

function activarPeaton(dir) {
    if (bloqueando[dir]) return;
    bloqueando[dir] = true;

    const semP = semPeatonPorDir[dir];
    const semV = semVehicPorDir[dir];

    // Peaton: verde → ámbar inmediatamente
    aplicarEstadoPeaton(semP, 1);
    bloquearVehiculos(semV);

    setTimeout(() => {
        // 5s después: peatón → rojo
        aplicarEstadoPeaton(semP, 0);

        setTimeout(() => {
            // 10s en rojo: peatón → verde y desbloquear
            aplicarEstadoPeaton(semP, 2);
            desbloquearVehiculos(semV);
            bloqueando[dir] = false;
        }, 10000);
    }, 5000);
}

document.getElementById("boton-peatones-N").addEventListener("click", () => activarPeaton("N"));
document.getElementById("boton-peatones-S").addEventListener("click", () => activarPeaton("S"));
document.getElementById("boton-peatones-E").addEventListener("click", () => activarPeaton("E"));
document.getElementById("boton-peatones-O").addEventListener("click", () => activarPeaton("O"));