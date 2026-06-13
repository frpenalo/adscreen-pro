// Local pool of family-friendly jokes in Spanish, curated for the
// Latam / Hispanic market. Two-part format (setup + delivery) to match
// the JokeWidget reveal animation.
//
// All jokes must be:
//   - Clean and safe for any audience (salons, barbershops, cafes)
//   - Culturally resonant with Latam Spanish speakers
//   - Short enough to fit comfortably on a TV screen
//   - Funny (setup + real punchline, not just a weak pun)

export interface LocalJoke {
  setup: string;
  delivery: string;
}

export const JOKES_ES: LocalJoke[] = [
  // ── Doctor / paciente ───────────────────────────────────────────────────
  { setup: "— Doctor, cada vez que tomo café me duele el ojo derecho.", delivery: "— Pruebe sacando la cuchara antes de tomar." },
  { setup: "— Doctor, me duele aquí, aquí, aquí y aquí.", delivery: "— Tiene el dedo roto." },
  { setup: "— Doctor, tengo pérdida de memoria.", delivery: "— ¿Desde cuándo? — ¿Desde cuándo qué?" },
  { setup: "— Doctor, me siento como una cortina.", delivery: "— Pues hágase a un lado y deje pasar al siguiente." },
  { setup: "— Doctor, ¿es grave?", delivery: "— Mire, de este hospital no sale." },
  { setup: "— Doctor, me duele cuando me toco el hombro.", delivery: "— Pues no se toque el hombro. Son $500." },
  { setup: "— Doctor, mi esposo cree que es una nevera.", delivery: "— Pues déjelo. — Es que duerme con la boca abierta y la luz no me deja dormir." },
  { setup: "— Doctor, nadie me hace caso.", delivery: "— El siguiente, por favor." },
  { setup: "— Doctor, me tomé las pastillas como me dijo y sigo igual.", delivery: "— ¿De frente o de espalda al espejo? — ¿Importa? — A mí no." },

  // ── Matrimonio y pareja ─────────────────────────────────────────────────
  { setup: "Mi esposa me dijo que la vida con ella sería de ensueño.", delivery: "Tenía razón: cada vez que me acuesto, me duermo rapidísimo." },
  { setup: "— Mi amor, ¿me amas más a mí o a la comida?", delivery: "— ¿Te enojas si te digo la verdad, o prefieres que empiece con el postre?" },
  { setup: "— Amor, se me perdió el celular.", delivery: "— Llámalo, tonto. — ¿Y si está en silencio? — Llámalo más alto." },
  { setup: "Una esposa le pregunta al marido: — ¿Qué harías si me muero?", delivery: "— Me volvería loco. — ¿Y te casarías otra vez? — Ya te dije que loco no." },
  { setup: "Mi esposa me pidió algo con mucho hierro para estar en forma.", delivery: "Le compré la plancha." },
  { setup: "— ¿Hace cuánto estás casado?", delivery: "— Desde el día en que me arrepentí." },
  { setup: "Mi esposa me dijo: 'si fueras la mitad de hombre…'", delivery: "Le dije: '…tú serías feliz con la otra mitad disponible'. Dormí en el sofá." },
  { setup: "— Amor, ¿por qué nunca me llevas a lugares caros?", delivery: "— Espera, voy por tu abrigo. — ¡Vamos a salir! — No, voy a subir el aire." },
  { setup: "— ¿Cuál es el secreto de un matrimonio largo?", delivery: "— Dos televisores y dos baños." },
  { setup: "Mi novia me llamó vago. Tardé dos horas en responderle.", delivery: "Pero la próxima vez respondo en una." },

  // ── Suegras ─────────────────────────────────────────────────────────────
  { setup: "— Mi suegra es un ángel.", delivery: "— Qué suerte. — Sí, la mía todavía está viva." },
  { setup: "— ¿Por qué las suegras viven más que los suegros?", delivery: "— Porque los suegros se van antes, de puro alivio." },
  { setup: "Mi esposa: 'si tu mamá y yo nos caemos al mar, ¿a quién salvas?'", delivery: "Le dije: '¿mi mamá sabe nadar?'" },

  // ── Bar / borrachos ─────────────────────────────────────────────────────
  { setup: "— Señor, llevamos dos horas esperándolo para cerrar.", delivery: "— Tranquilo, no tengo prisa, quédense el tiempo que necesiten." },
  { setup: "Un borracho ve a otro llorando en el bar: — ¿Qué le pasa, amigo?", delivery: "— Mi esposa dijo que no me hablaría en un mes. Y hoy se acaba." },
  { setup: "— Mesero, hay una mosca en mi sopa.", delivery: "— No se preocupe, la araña del techo se encarga." },
  { setup: "— Mi abuelo vivió 95 años bebiendo todos los días.", delivery: "— ¿De veras? ¿Qué tomaba? — No sé, ya estaba muerto cuando le pregunté." },
  { setup: "— Cantinero, sírvame lo mismo que al señor de allá.", delivery: "— ¿Agua? Es el conductor designado." },

  // ── One-liners con punchline ────────────────────────────────────────────
  { setup: "Tengo una memoria excelente.", delivery: "Solo se me olvidan tres cosas: nombres, caras… y la tercera no me acuerdo." },
  { setup: "Antes pensaba que era indeciso.", delivery: "Pero ahora no estoy tan seguro." },
  { setup: "Mi psicólogo me dijo que me tranquilizara.", delivery: "Le dije: tranquilo tú, que aquí el que paga soy yo." },
  { setup: "Mi dieta va perfecta.", delivery: "Llevo dos semanas perdidas ya." },
  { setup: "Mi jefe me dijo: ponte en mi lugar.", delivery: "Le dije: dame tu sueldo primero." },
  { setup: "Dicen que el dinero no compra la felicidad.", delivery: "Pero compra tacos, y los tacos me hacen feliz." },
  { setup: "Soy tan optimista que cuando se me cae el pan con mantequilla…", delivery: "…pienso que el piso me dio un masaje facial." },
  { setup: "Tengo un plan para ser millonario.", delivery: "Paso uno: conseguir un millón. Paso dos: ya está." },
  { setup: "Soy multitasking.", delivery: "Puedo ignorar varias cosas al mismo tiempo." },
  { setup: "Mi terapeuta me dijo: 'hábleme de su infancia'.", delivery: "Le dije: 'no recuerdo nada'. Me respondió: 'entonces fue perfecta'." },
  { setup: "Compré un libro para manejar la ansiedad.", delivery: "Lo leí completo en una hora del pánico." },
  { setup: "Lo bueno de estar soltero es que siempre hay postre.", delivery: "Lo malo es que también hay que lavar los platos solo." },
  { setup: "Dicen que lo que no te mata te hace más fuerte.", delivery: "Pues llevo tres cafés y sigo de vago." },
  { setup: "Mi vecino dice que los robots nos van a reemplazar.", delivery: "A mí ya: mi novia me dejó por una aspiradora robot." },
  { setup: "— ¿Cuál es tu hobby favorito?", delivery: "— Empezar cosas que nunca termino." },
  { setup: "Quería ser puntual.", delivery: "Ahora siempre llego tarde, pero a la misma hora." },

  // ── Mamás / papás latinos (chancla incluida) ────────────────────────────
  { setup: "— Mamá, ¿me das dinero?", delivery: "— ¿Crees que el dinero cae del cielo? — Pues no, pero Dios provee, eso dijiste el domingo." },
  { setup: "Mi mamá tiene dos estados: de fiesta o con la chancla en la mano.", delivery: "Y los dos aparecen sin avisar." },
  { setup: "Cuando mi mamá dice 'ya voy a contar hasta tres'…", delivery: "…tienes más tiempo que cuando dice 'no me hagas ir hasta allá'." },
  { setup: "— Hijo, ¿en qué gastas tu sueldo?", delivery: "— Mitad en comida y la otra mitad en tonterías. — ¿Y el resto? — ¿Cuál resto, mamá?" },
  { setup: "Mi papá dice: 'el que madruga, Dios lo ayuda'.", delivery: "Por eso él nunca madruga: no le gusta molestar a Dios." },
  { setup: "— Papá, necesito ayuda con la tarea.", delivery: "— Te ayudo, pero si sale mal le decimos que fue idea tuya." },
  { setup: "Mi mamá me dijo: 'come, que estás flaco'.", delivery: "Diez años después: 'deja de comer, que estás gordo'. Nunca acierto." },
  { setup: "— ¿Por qué le pegaste a tu hermano?", delivery: "— Empezó él, devolviéndome el golpe." },

  // ── Trabajo / oficina ───────────────────────────────────────────────────
  { setup: "El jefe me preguntó cuál era mi mayor debilidad.", delivery: "Le dije: la honestidad. — Esa no es una debilidad. — Me importa muy poco lo que usted crea." },
  { setup: "Mi jefe me dijo que pensara fuera de la caja.", delivery: "Le pedí una caja más grande." },
  { setup: "— ¿Por qué llegaste tarde otra vez?", delivery: "— Es que salí tarde. — ¿Y por qué saliste tarde? — Para llegar tarde, jefe." },
  { setup: "Me ascendieron en el trabajo.", delivery: "Ahora me preocupo en un piso más alto." },
  { setup: "En la oficina preguntaron quién no había terminado sus tareas.", delivery: "Yo levanté la mano por solidaridad." },
  { setup: "El lunes solo existe para hacerte valorar el viernes.", delivery: "Y el domingo, para recordarte que ya viene el lunes." },

  // ── Tecnología / redes ──────────────────────────────────────────────────
  { setup: "Le dije a Siri: 'estoy solo'.", delivery: "Me respondió: 'lo siento, no reconozco ese contacto'." },
  { setup: "Mi sobrino me preguntó qué era un walkman.", delivery: "Le dije: un Spotify sin internet y con pilas. Casi llora." },
  { setup: "Mi WiFi es tan lento…", delivery: "…que para ver un video pido turno el lunes." },
  { setup: "La batería de mi celular dura como mis propósitos de año nuevo:", delivery: "al mediodía ya se apagó." },
  { setup: "Ahora todos son influencers.", delivery: "Antes les decíamos 'metiches con teléfono'." },

  // ── Pepito (solo los buenos) ────────────────────────────────────────────
  { setup: "— Pepito, dime tres animales en peligro de extinción.", delivery: "— Dos leones y una cebra, porque los estoy persiguiendo con un palo." },
  { setup: "— Pepito, si tienes cinco manzanas y Juan te pide dos, ¿cuántas te quedan?", delivery: "— Cinco, maestra. Juan puede pedir lo que quiera." },
  { setup: "— Pepito, ¿qué es peor: la ignorancia o la indiferencia?", delivery: "— No sé y no me importa." },
  { setup: "Pepito le pregunta a su papá: — ¿Qué es la política?", delivery: "— Yo soy el gobierno, tu mamá el pueblo, tú la juventud y el bebé es el futuro. — Papá, se orinó el futuro." },
  { setup: "— Pepito, ¿por qué llegas tarde?", delivery: "— Soñé que jugaba fútbol y el partido se fue a tiempo extra." },

  // ── Cotidiano con buen cierre ───────────────────────────────────────────
  { setup: "Fui al nutricionista.", delivery: "Me dijo: 'si quieres bajar de peso, cierra la boca'. Llevo dos horas sin hablar con nadie." },
  { setup: "Mi papá siempre me dijo: 'nunca te rindas'.", delivery: "Por eso llevo tres años intentando abrir el frasco de mayonesa." },
  { setup: "Fui a una fiesta y no conocía a nadie.", delivery: "Resulta que era mi cumpleaños; había olvidado invitar gente." },
  { setup: "Hoy me miré al espejo y vi a mi padre.", delivery: "Le dije: '¿qué hago yo levantándome tan temprano como tú?'" },
  { setup: "— ¿Qué es lo peor de envejecer?", delivery: "— Que cada año la gente está más joven que uno." },
  { setup: "La vida te da sorpresas.", delivery: "La mía casi siempre es una multa de tránsito." },
  { setup: "Mi gato me mira como si le debiera dinero.", delivery: "Y se lo debo: el otro día le pisé la cola." },
  { setup: "Mi perro sabe muchos trucos.", delivery: "El mejor: convencerme de que tiene hambre cada vez que yo como." },
  { setup: "— ¿Sabes cuál es la diferencia entre el amor y una pizza?", delivery: "— La pizza sí aparece a los 30 minutos." },
  { setup: "Fui a la farmacia y pedí algo para el dolor.", delivery: "La farmacéutica me mandó a buscar a su ex." },
  { setup: "Mi abuela me dijo: 'llegué a los 90 caminando todos los días'.", delivery: "Le dije: 'abuela, ¿y de qué te sirvió, si ahora no te puedes ni parar?'" },
  { setup: "— ¿Sabes qué es un oxímoron?", delivery: "— Sí: 'servicio al cliente'." },
  { setup: "Mi primo es tan despistado que llamó a emergencias…", delivery: "…para preguntar cuál era el número de emergencias." },
  { setup: "Me caí por las escaleras y no me pasó nada.", delivery: "Bueno, sí: las escaleras se rieron de mí." },
  { setup: "Un amigo presume que habla seis idiomas.", delivery: "Yo igual: español, spanish, espagnol, spanisch, spagnolo y castellano." },
  { setup: "Dicen que el tiempo es oro.", delivery: "Por eso cada vez que pierdo el tiempo, me siento rico." },
  { setup: "— ¿Cuál es el secreto de la felicidad?", delivery: "— No tener grupo de WhatsApp de la familia." },
  { setup: "Si la vida te da limones…", delivery: "…guárdalos, que están carísimos." },
  { setup: "Mi mamá es tan exagerada que cuando me regaña…", delivery: "…hasta el perro pide disculpas." },
];

// Fisher–Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RECENT_KEY = "adscreenpro-joke-seen";
const RECENT_WINDOW = 60;

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function setRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(-RECENT_WINDOW)));
  } catch { /* ignore */ }
}

function fingerprint(j: LocalJoke): string {
  return (j.setup + "|" + j.delivery).slice(0, 80);
}

/**
 * Pick the next joke avoiding the last RECENT_WINDOW seen. Falls back
 * to any joke if every single one has been seen recently (unlikely).
 */
export function pickNextJoke(): LocalJoke {
  const recent = new Set(getRecent());
  const candidates = shuffle(JOKES_ES).filter((j) => !recent.has(fingerprint(j)));
  const chosen = candidates[0] ?? JOKES_ES[Math.floor(Math.random() * JOKES_ES.length)];
  setRecent([...recent, fingerprint(chosen)]);
  return chosen;
}
