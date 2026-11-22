import { Activity, Bone, Brain, Download, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui";

export default function ViolenceImpact() {
  return (
    <section
      className="panel violence-impact"
      aria-labelledby="impacto-violencia"
    >
      <h2 id="impacto-violencia">
        Cómo afecta la violencia al cuerpo y la salud
      </h2>
      <p>
        La violencia puede causar lesiones y activar una respuesta de alarma.
        Cuando el miedo, las amenazas o el maltrato se prolongan, el estado de
        alerta puede mantenerse y convertirse en estrés crónico.
      </p>
      <div className="two-grid violence-impact-grid">
        <article>
          <h3>
            <Activity size={20} aria-hidden="true" />
            Respuesta física inmediata
          </h3>
          <p>
            Ante el peligro, el sistema nervioso activa una respuesta de
            protección en la que participan hormonas como la adrenalina y el
            cortisol. El cuerpo puede prepararse para luchar, huir o quedarse
            inmóvil.
          </p>
          <ul>
            <li>El corazón late más rápido y la respiración se acelera.</li>
            <li>Puede haber sudoración, temblores o tensión muscular.</li>
          </ul>
        </article>
        <article>
          <h3>
            <Bone size={20} aria-hidden="true" />
            Lesiones en el cuerpo
          </h3>
          <p>
            Algunas lesiones son visibles y otras ocurren dentro del cuerpo.
          </p>
          <ul>
            <li>
              <strong>Cabeza, rostro y piel.</strong> Cortes, moretones,
              quemaduras, traumatismos craneales y lesiones por
              estrangulamiento.
            </li>
            <li>
              <strong>Músculos y huesos.</strong> Contracturas, desgarros,
              fracturas y luxaciones.
            </li>
            <li>
              <strong>Órganos internos.</strong> Lesiones en el pecho o el
              abdomen.
            </li>
            <li>
              <strong>Salud sexual y reproductiva.</strong> La violencia sexual
              puede provocar lesiones, infecciones de transmisión sexual o
              embarazos no deseados.
            </li>
          </ul>
        </article>
        <article>
          <h3>
            <Brain size={20} aria-hidden="true" />
            Efectos a mediano y largo plazo
          </h3>
          <p>
            El estrés persistente puede afectar la salud física y emocional.
          </p>
          <ul>
            <li>Dificultad para dormir, cansancio y falta de energía.</li>
            <li>
              Dolores persistentes, tensión muscular y problemas digestivos.
            </li>
            <li>
              Mayor riesgo de hipertensión y enfermedades cardiovasculares.
            </li>
            <li>
              Ansiedad, depresión, baja autoestima y dificultades de memoria o
              concentración.
            </li>
          </ul>
        </article>
        <article>
          <h3>
            <HeartHandshake size={20} aria-hidden="true" />
            Efectos en adolescentes y cómo buscar apoyo
          </h3>
          <p>
            El estrés prolongado puede dificultar el aprendizaje, el descanso y
            la convivencia. También puede afectar el rendimiento escolar y la
            confianza en otras personas.
          </p>
          <p>
            Cada experiencia es distinta. Hablar con una persona adulta de
            confianza, pedir orientación en la escuela o buscar atención
            profesional puede ayudar.
          </p>
          <Link className="text-link" href="/ayuda">
            Encontrar ayuda
          </Link>
        </article>
      </div>
      <Button variant="outline" asChild>
        <a href="/recursos/estres-cronico-y-violencia.pdf" download>
          <Download size={18} aria-hidden="true" />
          Descargar la investigación sobre estrés crónico (PDF)
        </a>
      </Button>
    </section>
  );
}
