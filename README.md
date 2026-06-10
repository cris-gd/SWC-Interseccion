# Intersection Management

Interactive traffic intersection web simulator with traffic light control, pedestrians, emergency vehicles, and a railway level crossing. Developed as a part of the *Web Services: Client* course at UPNA (Telecommunications Engineering, Spring 2026)

---

## Features

**Traffic Lights** — automatic 68-second cycle divided into 12 phases for the intersection's 12 routes (N→S, N→W, N→E, S→N, …), with amber transitions and all-red phases between cycles.

**Traffic Volume** — independent sliders per route (0–5) that generate animated cars in the SVG at a frequency proportional to the volume. Cars respect traffic lights and maintain safe following distances.

**Pedestrians** — buttons for each cardinal direction (N/S/E/W) that activate crossing: pedestrian light turns amber → red, blocks affected vehicles, triggers pedestrian animation, and restores normal cycle after crossing.

**Emergency Vehicles** — type selector (ambulance / police / fire truck), origin and destination. The emergency vehicle forces green on its route, ordinary cars pull aside, and pending pedestrians who haven't started crossing are cancelled.

**Level Crossing** — animated train that crosses periodically at a configurable frequency (15–60 s). Sequence: amber → barriers lower → red → train passes → barriers rise → green.

**Manual Priority** — outer/inner lane buttons per cardinal direction that force immediate green on that lane, pause the normal cycle, and resume it from where it was interrupted.

**Dark/Light Theme** — toggle in the header.

---

## Repository Structure
```
.
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── ciclo_general.js            # Traffic light cycle and base functions
│   ├── manejo_coches.js            # Vehicle generation and movement
│   ├── manejo_peatones.js          # Pedestrian crossing logic
│   ├── manejo_tren.js              # Train level crossing cycle
│   ├── manejo_vehiculos_especiales.js  # Emergency vehicles
│   ├── prioridad_trafico.js        # Manual lane priority
│   └── temas.js                    # Toggle dark/ligth theme
├── img/
│   └── logo.jpeg
└── README.md
```
> The script loading order in `index.html` is important: `ciclo_general.js` must load first because it defines global variables (`semaforos_interseccion`, `ciclo_semaforos`, `prioridad`, etc.) that the other modules depend on.

---
## Dependencies

None. The project uses exclusively HTML5, CSS3, and vanilla JavaScript with inline SVG.

---
## Authors

- **Iñigo Aguirre**
- **Cristina García**

*Students of Telecommunications Engineering — Universidad Pública de Navarra (UPNA)*
