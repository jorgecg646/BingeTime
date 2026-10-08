# ⏱️ Motor de Cálculo de Tiempo de Maratón

El núcleo de valor de BingeTime es cuantificar de forma atractiva y precisa el tiempo total invertido frente a la pantalla.

Volver al índice: [[BingeTime]].

---

## 🧮 Lógica de Cálculo

1. **Acumulación de Minutos:**
   Para cada show marcado como visto (o con temporadas/episodios seleccionados):
   $$T_{\text{show}} = \sum_{e \in \text{Episodios Vistos}} \text{runtime}(e)$$
   Si un episodio no reporta duración individual, se utiliza el `averageRuntime` declarado en la serie.

2. **Suma Global:**
   $$T_{\text{total\_minutos}} = \sum_{s \in \text{Biblioteca}} T_{\text{show}}(s)$$

3. **Descomposición en Unidades Humanas:**
   $$\text{Días} = \left\lfloor \frac{T_{\text{total\_minutos}}}{1440} \right\rfloor$$
   $$\text{Horas} = \left\lfloor \frac{T_{\text{total\_minutos}} \pmod{1440}}{60} \right\rfloor$$
   $$\text{Minutos} = T_{\text{total\_minutos}} \pmod{60}$$

---

## ⚡ Reactividad
* Cuando el usuario marca un nuevo episodio o temporada en el modal `show-details-modal`, el servicio emite el nuevo total reactivo.
* El componente `counter` actualiza las cifras de forma instantánea con animación numérica.

---

## Enlaces Relacionados
* [[Integracion-TVMaze-API]] — Duraciones provistas por TVMaze.
* [[Seguimiento-y-Estadisticas]] — Uso de estas métricas en gráficos y reportes.
