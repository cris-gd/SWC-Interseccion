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
let ciclo_semaforos = 0;
let inicio_fase;
let prioridad = false;

let timerActual = null;
let duracionFase = 0;

function apagarTodas() {
    for (let i = 0; i < semaforos_interseccion.length; i++) {
        // Solo apagar si ninguna luz del trío está bloqueada
        if (!semaforos_interseccion[i].classList.contains("bloqueado") && !semaforos_interseccion[i].classList.contains("trainblock")) {
            semaforos_interseccion[i].classList.remove("on");
        }
    }
}

function todoAlRojo() {
    for (let i = 0; i < semaforos_interseccion.length; i += 3) {
        const rojo  = semaforos_interseccion[i];
        const ambar = semaforos_interseccion[i+1];
        const verde = semaforos_interseccion[i+2];

        if (!rojo.classList.contains("prio")){
            ambar.classList.remove("on");
            verde.classList.remove("on");
            rojo.classList.add("on");
        }

    }
}

function setLight(circles, index) {
    // Si cualquier luz del grupo está bloqueada, no tocar nada
    for (let i = 0; i < circles.length; i++) {
        if (circles[i].classList.contains("bloqueado") || circles[i].classList.contains("trainblock")) return;
    }
    for (let i = 0; i < circles.length; i++) {
        circles[i].classList.remove("on");
    }
    circles[index].classList.add("on");
}
function ciclo1(){
    setLight(colores_OE, 2);
    setLight(colores_OS, 2);
    setLight(colores_EO, 2);
    setLight(colores_EN, 2);
}
function t0_10(){
    if(!prioridad){
        ciclo_semaforos=1;
        inicio_fase=Date.now();
        ciclo1();
        duracionFase = 10000;
        timerActual = setTimeout(t10_15, duracionFase);
    }

}
function ciclo2(){
    setLight(colores_OE, 1);
    setLight(colores_OS, 1);
    setLight(colores_EO, 1);
    setLight(colores_EN, 1);
}
function t10_15(){
    if(!prioridad){
        ciclo_semaforos=2;
        inicio_fase=Date.now();
        ciclo2();
        duracionFase = 5000;
        timerActual = setTimeout(t15_17, duracionFase);
    }

}
function ciclo3(){
    apagarTodas();
    todoAlRojo();
}
function t15_17(){
    if(!prioridad){
        ciclo_semaforos=3;
        inicio_fase=Date.now();
        ciclo3();
        duracionFase = 2000;
        timerActual = setTimeout(t17_27, duracionFase);
    }

}
function ciclo4(){
    setLight(colores_ON, 2);
    setLight(colores_NO, 2);
    setLight(colores_ES, 2);
    setLight(colores_SE, 2);
}
function t17_27(){
    if(!prioridad){
        ciclo_semaforos=4;
        inicio_fase=Date.now();
        ciclo4();
        duracionFase = 10000;
        timerActual = setTimeout(t27_32, duracionFase);
    }

}
function ciclo5(){
    setLight(colores_ON, 1);
    setLight(colores_NO, 1);
    setLight(colores_ES, 1);
    setLight(colores_SE, 1);
}
function t27_32(){
    if(!prioridad){
        ciclo_semaforos=5;
        inicio_fase=Date.now();
        ciclo5();
        duracionFase = 5000;
        timerActual = setTimeout(t32_34, duracionFase);     
    }

}
function ciclo6(){
    apagarTodas();
    todoAlRojo();
}
function t32_34(){
    if(!prioridad){
        ciclo_semaforos=6;
        inicio_fase=Date.now();
        ciclo6();
        duracionFase = 2000;
        timerActual = setTimeout(t34_44, duracionFase);
    }

}
function ciclo7(){
    setLight(colores_NS, 2);
    setLight(colores_NO, 2);
    setLight(colores_SN, 2);
    setLight(colores_SE, 2);
}
function t34_44(){
    if(!prioridad){
        ciclo_semaforos=7;
        inicio_fase=Date.now();
        ciclo7();
        duracionFase = 10000;
        timerActual = setTimeout(t44_49, duracionFase);
    }

}
function ciclo8(){
    setLight(colores_NS, 1);
    setLight(colores_NO, 1);
    setLight(colores_SN, 1);
    setLight(colores_SE, 1);
}
function t44_49(){
    if(!prioridad){
        ciclo_semaforos=8;
        inicio_fase=Date.now();
        ciclo8();
        duracionFase = 5000;
        timerActual = setTimeout(t49_51, duracionFase);
    }

}
function ciclo9(){
    apagarTodas();
    todoAlRojo();
}
function t49_51(){
    if(!prioridad){
        ciclo_semaforos=9;
        inicio_fase=Date.now();
        ciclo9();
        duracionFase = 2000;
        timerActual = setTimeout(t51_61, duracionFase);
    }

}
function ciclo10(){
    setLight(colores_SO, 2);
    setLight(colores_NE, 2);
    setLight(colores_OS, 2);
    setLight(colores_EN, 2);
}
function t51_61(){
    if(!prioridad){
        ciclo_semaforos=10;
        inicio_fase=Date.now();
        ciclo10();
        duracionFase = 10000;
        timerActual = setTimeout(t61_66, duracionFase);
    }

}
function ciclo11(){
    setLight(colores_SO, 1);
    setLight(colores_NE, 1);
    setLight(colores_OS, 1);
    setLight(colores_EN, 1);
}
function t61_66(){
    if(!prioridad){
        ciclo_semaforos=11;
        inicio_fase=Date.now();
        ciclo11();
        duracionFase = 5000;
        timerActual = setTimeout(t66_68, duracionFase);      
    }

}
function ciclo12(){
    apagarTodas();
    todoAlRojo();
}
function t66_68(){
    if(!prioridad){
        ciclo_semaforos=12;
        inicio_fase=Date.now();
        ciclo12();
        duracionFase = 2000;
        timerActual = setTimeout(t0_10, duracionFase);
    }

}
apagarTodas();//estado inicial
todoAlRojo();
t0_10(); // iniciar ciclo
