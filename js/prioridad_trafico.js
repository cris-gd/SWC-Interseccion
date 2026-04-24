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

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-N-E-")) {

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

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

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-S-O-")) {

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

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

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-E-S-")) {

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

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

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

                    }

                }
            }else{
                for (let i = 0; i < semaforos_interseccion.length; i+=3) {
                    const rojo  = semaforos_interseccion[i];
                    const ambar = semaforos_interseccion[i+1];
                    const verde = semaforos_interseccion[i+2];

                    if (semaforos_interseccion[i].id.includes("-O-N-")) {

                        setTimeout(() => {
                            rojo.classList.add("prio");
                            ambar.classList.add("prio");
                            verde.classList.add("prio");
                            
                            if (!rojo.classList.contains("bloqueado") && !rojo.classList.contains("trainblock")) {
                                ambar.classList.remove("on");
                                verde.classList.add("on");
                                rojo.classList.remove("on");
                            }    
                        }, 1000);

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
                        }, 1000);

                    }

                } 
            }
            break;
    }
}

function finPrioridad (){
    if(prioridad){
        if((Date.now() - inicio_prioridad)<1000){
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

            }, 1000);
        }else{
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



