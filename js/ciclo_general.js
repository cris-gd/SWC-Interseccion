const semaforo_NS = document.getElementById("tl-N-S");
const colores_NS = semaforo_NS.getElementsByTagName("circle");
const semaforo_NO = document.getElementById("tl-N-O");
const colores_NO = semaforo_NO.getElementsByTagName("circle");
const semaforo_NE = document.getElementById("tl-N-E");
const colores_NE = semaforo_NE.getElementsByTagName("circle");

const semaforo_SN = document.getElementById("tl-S-N");
const colores_SN = semaforo_SN.getElementsByTagName("circle");
const semaforo_SE = document.getElementById("tl-S-E");
const colores_SE = semaforo_SE.getElementsByTagName("circle");
const semaforo_SO = document.getElementById("tl-S-O");
const colores_SO = semaforo_SO.getElementsByTagName("circle");

const semaforo_OE = document.getElementById("tl-O-E");
const colores_OE = semaforo_OE.getElementsByTagName("circle");
const semaforo_ON = document.getElementById("tl-O-N");
const colores_ON = semaforo_ON.getElementsByTagName("circle");
const semaforo_OS = document.getElementById("tl-O-S");
const colores_OS = semaforo_OS.getElementsByTagName("circle");

const semaforo_EO = document.getElementById("tl-E-O");
const colores_EO = semaforo_EO.getElementsByTagName("circle");
const semaforo_ES = document.getElementById("tl-E-S");
const colores_ES = semaforo_ES.getElementsByTagName("circle");
const semaforo_EN = document.getElementById("tl-E-N");
const colores_EN = semaforo_EN.getElementsByTagName("circle");

const semaforos_interseccion = document.querySelectorAll("circle[id^='tl-']");
//console.log(semaforos_interseccion);
function apagarTodas() {
    for (let i = 0; i < semaforos_interseccion.length; i++) {
        // Solo apagar si ninguna luz del trío está bloqueada
        if (!semaforos_interseccion[i].classList.contains("bloqueado")) {
            semaforos_interseccion[i].classList.remove("on");
        }
    }
}

function todoAlRojo() {
    for (let i = 0; i < semaforos_interseccion.length; i += 3) {
        const rojo  = semaforos_interseccion[i];
        const ambar = semaforos_interseccion[i+1];
        const verde = semaforos_interseccion[i+2];

        ambar.classList.remove("on");
        verde.classList.remove("on");
        rojo.classList.add("on");
    }
}

function setLight(circles, index) {
    // Si cualquier luz del grupo está bloqueada, no tocar nada
    for (let i = 0; i < circles.length; i++) {
        if (circles[i].classList.contains("bloqueado")) return;
    }
    for (let i = 0; i < circles.length; i++) {
        circles[i].classList.remove("on");
    }
    circles[index].classList.add("on");
}

function t0_10(){
    apagarTodas();//estado inicial
    todoAlRojo();

    setLight(colores_OE, 2);
    setLight(colores_OS, 2);
    setLight(colores_EO, 2);
    setLight(colores_EN, 2);
    setTimeout(t10_15, 10000);
}
function t10_15(){
    setLight(colores_OE, 1);
    setLight(colores_OS, 1);
    setLight(colores_EO, 1);
    setLight(colores_EN, 1);
    setTimeout(t15_17, 5000);
}
function t15_17(){
    apagarTodas();
    todoAlRojo();

    setTimeout(t17_27, 2000);
}
function t17_27(){
    setLight(colores_ON, 2);
    setLight(colores_NO, 2);
    setLight(colores_ES, 2);
    setLight(colores_SE, 2);
    setTimeout(t27_32, 10000);
}
function t27_32(){
    setLight(colores_ON, 1);
    setLight(colores_NO, 1);
    setLight(colores_ES, 1);
    setLight(colores_SE, 1);
    setTimeout(t32_34, 5000);
}
function t32_34(){
    apagarTodas();
    todoAlRojo();

    setTimeout(t34_44, 2000);
}
function t34_44(){
    setLight(colores_NS, 2);
    setLight(colores_NO, 2);
    setLight(colores_SN, 2);
    setLight(colores_SE, 2);
    setTimeout(t44_49, 10000);
}
function t44_49(){
    setLight(colores_NS, 1);
    setLight(colores_NO, 1);
    setLight(colores_SN, 1);
    setLight(colores_SE, 1);
    setTimeout(t49_51, 5000);
}
function t49_51(){
    apagarTodas();
    todoAlRojo();

    setTimeout(t51_61, 2000);
}
function t51_61(){
    setLight(colores_SO, 2);
    setLight(colores_NE, 2);
    setLight(colores_OS, 2);
    setLight(colores_EN, 2);
    setTimeout(t61_66, 10000);
}
function t61_66(){
    setLight(colores_SO, 1);
    setLight(colores_NE, 1);
    setLight(colores_OS, 1);
    setLight(colores_EN, 1);
    setTimeout(t66_68, 5000);
}
function t66_68(){
    apagarTodas();
    todoAlRojo();

    setTimeout(t0_10, 2000);
}

t0_10(); // iniciar ciclo
