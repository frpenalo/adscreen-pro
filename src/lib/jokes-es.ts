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
  // ── Pepito / Jaimito (classics) ─────────────────────────────────────────
  { setup: "La maestra le pregunta a Pepito: ¿cuántos son 4 por 4?", delivery: "Empate, maestra." },
  { setup: "Pepito, ¿por qué llegas tarde? — pregunta la maestra.", delivery: "Es que soñé que jugaba fútbol y el partido se fue a tiempo extra." },
  { setup: "— Pepito, dime tres animales en peligro de extinción.", delivery: "— Dos leones y una cebra, porque los estoy persiguiendo con un palo." },
  { setup: "— Pepito, si tienes cinco manzanas y Juan te pide dos, ¿cuántas te quedan?", delivery: "— Cinco, maestra. Juan puede pedir lo que quiera." },
  { setup: "La maestra: — Pepito, usa la palabra 'fascinar' en una oración.", delivery: "— A mi abuela le robaron y fascinar al ladrón." },
  { setup: "— Pepito, conjuga el verbo caminar.", delivery: "— Yo camino, tú caminas, él camina… — Más rápido. — Corremos, corremos, corremos." },
  { setup: "— Pepito, ¿qué es peor: la ignorancia o la indiferencia?", delivery: "— No sé y no me importa." },
  { setup: "Mamá: — Pepito, ¿por qué le pegaste a tu hermano?", delivery: "— Empezó él, devolviéndome el golpe." },
  { setup: "— Pepito, escribe una oración con la palabra 'dentífrico'.", delivery: "— Mi papá se para dentífrico en la mañana." },
  { setup: "— Pepito, ¿cuál es la capital de Estados Unidos?", delivery: "— La letra E, maestra." },

  // ── Doctor / paciente (oro puro) ────────────────────────────────────────
  { setup: "— Doctor, cada vez que tomo café me duele el ojo derecho.", delivery: "— Pruebe sacando la cuchara antes de tomar." },
  { setup: "— Doctor, me duele aquí, aquí, aquí y aquí.", delivery: "— Tiene el dedo roto." },
  { setup: "— Doctor, ¿cómo están mis análisis?", delivery: "— Bien, pero los suyos salieron malos." },
  { setup: "— Doctor, tengo pérdida de memoria.", delivery: "— ¿Desde cuándo? — ¿Desde cuándo qué?" },
  { setup: "— Doctor, me siento como una cortina.", delivery: "— Pues hágase a un lado y deje pasar al siguiente." },
  { setup: "— Doctor, no puedo dormir en las noches.", delivery: "— Duerma de día, ¿qué le cuesta?" },
  { setup: "— Doctor, ¿viviré?", delivery: "— Esa es una pregunta que no tiene sentido hacerme a mí." },
  { setup: "— Doctor, mi esposo piensa que es una nevera.", delivery: "— Pues déjelo. — Es que duerme con la boca abierta y la luz no me deja dormir." },
  { setup: "— Doctor, ¿es grave?", delivery: "— Mire, de este hospital no sale." },
  { setup: "— Doctor, me duele cuando me toco el hombro.", delivery: "— Pues no se toque el hombro. Son $500." },

  // ── Matrimonio y pareja ─────────────────────────────────────────────────
  { setup: "Mi esposa me dijo que la vida con ella sería de ensueño.", delivery: "Tenía razón: cada vez que me acuesto, me duermo rapidísimo." },
  { setup: "— Mi amor, ¿me amas más a mí o a la comida?", delivery: "— ¿Te enojas si te digo la verdad, o prefieres que empiece con el postre?" },
  { setup: "El matrimonio es una relación de dos. Mientras ella mande y él obedezca…", delivery: "…todo estará en orden." },
  { setup: "— Amor, ¿por qué nunca me llevas a lugares caros?", delivery: "— Espera, voy por tu abrigo. — ¡Vamos a salir! — No, voy a subir el aire." },
  { setup: "Mi esposa me pidió algo con mucho hierro para estar en forma.", delivery: "Le compré la plancha." },
  { setup: "— ¿Sabes por qué me casé contigo?", delivery: "— Lo sé, lo sé… y todavía me lo recuerdas todos los días." },
  { setup: "— Amor, se me perdió el celular.", delivery: "— Llámalo, tonto. — ¿Y si está en modo silencio? — Llámalo más alto." },
  { setup: "Mi novia me llamó vago. Tardé dos horas en responderle.", delivery: "Pero bueno, la próxima vez respondo en una." },
  { setup: "— ¿Hace cuánto estás casado?", delivery: "— Desde el momento en que me arrepentí." },
  { setup: "Una esposa le pregunta al marido: — ¿Qué harías si me muero?", delivery: "— Seguramente me volvería loco. — ¿Y te casarías otra vez? — Ya te dije que loco no." },

  // ── Bar / borrachos (observacional) ─────────────────────────────────────
  { setup: "— Señor, llevamos dos horas esperándolo para cerrar.", delivery: "— Tranquilo, no tengo prisa, quédense el tiempo que necesiten." },
  { setup: "Un borracho ve a otro llorando en el bar. — ¿Qué le pasa, amigo?", delivery: "— Mi esposa dijo que no me hablaría en un mes. Y hoy se acaba." },
  { setup: "— Mesero, hay una mosca en mi sopa.", delivery: "— No se preocupe, la araña del techo se encarga." },
  { setup: "— Cantinero, sírvame lo mismo que al señor.", delivery: "— ¿Agua? Él es el conductor designado." },
  { setup: "Un borracho habla solo en la calle. Pasa otro y le dice:", delivery: "— ¿Puedo escuchar? Es que a mí solo me contestan groserías." },
  { setup: "— ¿Qué hace un borracho a las 3 de la mañana con una llave?", delivery: "— Peleándose con la cerradura, como siempre." },
  { setup: "— Mi abuelo vivió 95 años bebiendo todos los días.", delivery: "— ¿De veras? ¿Qué tomaba? — No sé, ya estaba muerto cuando pregunté." },
  { setup: "Un borracho se sube a un taxi: — Lléveme al aeropuerto, rápido.", delivery: "Media hora después: — Aquí estamos, señor. — ¡Perfecto! Pero la próxima vez no vaya tan rápido que me asusta." },

  // ── Uno-liners con punchline ────────────────────────────────────────────
  { setup: "Tengo una memoria excelente.", delivery: "Solo se me olvidan tres cosas: nombres, caras… y la tercera no me acuerdo." },
  { setup: "Ayer fui al gimnasio por primera vez.", delivery: "Fue tan doloroso que ya soy socio vitalicio… del sofá." },
  { setup: "Mi dieta va bien.", delivery: "He perdido dos semanas ya." },
  { setup: "Antes pensaba que era indeciso.", delivery: "Pero ahora no estoy tan seguro." },
  { setup: "Mi psicólogo me dijo que me tranquilizara.", delivery: "Le respondí: tranquilo tú, que aquí el que paga soy yo." },
  { setup: "Quería ser estudiante modelo.", delivery: "Lo único modelo que me salió fue el cuerpo: modelo 90, pero de peso." },
  { setup: "Soy tan optimista que cuando se me cae el pan con mantequilla…", delivery: "…pienso que el piso me dio un masaje facial." },
  { setup: "La vida es como una bicicleta.", delivery: "Si te paras, te caes. Y si la dejas sin candado, te la roban." },
  { setup: "Mi jefe me dijo: ponte en mi lugar.", delivery: "Le dije: dame tu sueldo primero." },
  { setup: "Cada mañana me levanto lleno de energía.", delivery: "Y cada mañana me vuelvo a acostar para gastarla." },
  { setup: "Dicen que el dinero no compra la felicidad.", delivery: "Pero compra tacos, y los tacos me hacen feliz." },
  { setup: "Lo malo de estar soltero es comer solo.", delivery: "Lo bueno es que siempre hay postre." },
  { setup: "Mi vecino dice que los robots nos van a reemplazar.", delivery: "Ya me reemplazaron: mi novia me dejó por una Roomba." },
  { setup: "La gente dice que hablo mucho.", delivery: "Yo solo me repito para que entiendan." },
  { setup: "Odio cuando la gente miente.", delivery: "Pero adoro cuando yo lo hago bien." },

  // ── Papás / mamás latinas ───────────────────────────────────────────────
  { setup: "— Mamá, ¿me das dinero?", delivery: "— ¿Crees que el dinero cae del cielo? — Pues no, pero Dios provee, eso dijiste el domingo." },
  { setup: "Mi mamá es tan exagerada que cuando me regaña…", delivery: "…hasta el perro pide disculpas." },
  { setup: "— Papá, necesito ayuda con mi tarea.", delivery: "— Te ayudo, pero si sale mal le decimos que fue idea tuya." },
  { setup: "Mi mamá tiene dos estados: de fiesta o con la chancla en la mano.", delivery: "Y los dos aparecen sin avisar." },
  { setup: "Cuando mi mamá dice 'ya voy a contar hasta tres'…", delivery: "…tienes más tiempo que cuando dice 'no me hagas ir hasta allá'." },
  { setup: "— Hijo, ¿en qué gastas tu sueldo?", delivery: "— Mitad en comida y la otra mitad en tonterías. — ¿Y el resto? — ¿Cuál resto, mamá?" },
  { setup: "Mi papá siempre dice: 'el que madruga, Dios lo ayuda'.", delivery: "Por eso él nunca madruga: no le gusta molestar a Dios." },
  { setup: "Mi mamá: ¿ya hiciste la tarea?", delivery: "Yo: sí, mamá. Mi mamá: muéstrame. Yo: bueno, casi. Mi mamá: y sale la chancla." },

  // ── Trabajo / oficina ───────────────────────────────────────────────────
  { setup: "El jefe me preguntó cuál era mi mayor debilidad.", delivery: "Le dije: la honestidad. — No creo que la honestidad sea una debilidad. — Me importa muy poco lo que usted crea." },
  { setup: "— ¿Por qué llegaste tarde otra vez?", delivery: "— Es que salí tarde. — ¿Y por qué saliste tarde? — Para llegar tarde, jefe." },
  { setup: "El lunes es un día que solo existe para hacerte valorar el viernes.", delivery: "Y el domingo solo existe para recordarte que ya viene el lunes." },
  { setup: "Mi jefe me dijo que tenía que pensar fuera de la caja.", delivery: "Le pedí una caja más grande." },
  { setup: "En la oficina preguntaron quién no había cumplido sus tareas.", delivery: "Yo levanté la mano por solidaridad." },
  { setup: "— ¿Qué tal el nuevo trabajo?", delivery: "— Excelente. Nueve horas nada más se me van viendo memes." },
  { setup: "Me ascendieron en el trabajo.", delivery: "Ahora me preocupo en un piso más alto." },
  { setup: "Si trabajar da salud…", delivery: "…¿por qué los burros y los caballos están en extinción?" },

  // ── Animales y cotidiano ────────────────────────────────────────────────
  { setup: "— ¿Sabías que los elefantes nunca olvidan?", delivery: "— ¿Y qué? Yo tampoco, y nadie me paga por eso." },
  { setup: "Mi gato me mira como si le debiera dinero.", delivery: "Y en realidad se lo debo: el otro día le pisé la cola." },
  { setup: "Mi perro sabe hacer muchos trucos.", delivery: "El mejor: convencerme de que tiene hambre cada vez que yo como." },
  { setup: "— ¿Qué hace una vaca cuando sale el sol?", delivery: "— Sombra." },
  { setup: "Un perro entra a un bar y pide una cerveza.", delivery: "El cantinero lo mira: — ¿Sabes? Tú deberías estar en un circo. — ¿Por qué? ¿Necesitan plomeros?" },
  { setup: "— ¿Por qué los flamencos se paran en una pata?", delivery: "— Porque si levantan las dos se caen, simples." },
  { setup: "Mi pez me ignora todo el día.", delivery: "Creo que está resentido porque lo llamé 'bocachancla' una vez." },

  // ── Clásicos cortos (buenos de verdad) ──────────────────────────────────
  { setup: "— ¿Cuál es el colmo de un electricista?", delivery: "— Tener una hija corriente y un hijo resistente." },
  { setup: "— ¿Cuál es el colmo de un jardinero?", delivery: "— Que su novia lo deje plantado." },
  { setup: "— ¿Cuál es el colmo de un panadero?", delivery: "— Tener una hija estufa… perdón, una hija buenota." },
  { setup: "— ¿Cuál es el colmo de un oftalmólogo?", delivery: "— Que le vea los defectos a todo el mundo menos a su suegra." },
  { setup: "— ¿Cuál es el colmo de un albañil?", delivery: "— Que su esposa le haga la vida imposible construyéndole problemas." },
  { setup: "— ¿Por qué los astronautas usan cinturón?", delivery: "— Por si hay que aterrizar de emergencia en la luna, que está llena de baches." },
  { setup: "— ¿Cuál es el animal más viejo del mundo?", delivery: "— La gallina, porque ya pasó los 40… pa'rriba." },
  { setup: "— ¿Por qué la luna está siempre triste?", delivery: "— Porque la dejaron en visto hace millones de años." },

  // ── Ocurrencias con ingenio ─────────────────────────────────────────────
  { setup: "Un amigo me presumió que habla seis idiomas.", delivery: "Yo también: español, spanish, espagnol, spanisch, spagnolo y castellano." },
  { setup: "No es que yo sea flojo.", delivery: "Es que mis músculos están en modo de ahorro de energía." },
  { setup: "Dicen que soy de mentalidad positiva.", delivery: "Claro, cada vez que veo un problema, positivamente lo ignoro." },
  { setup: "— ¿Cuál es tu hobby favorito?", delivery: "— Empezar cosas que nunca termino." },
  { setup: "Mi vida es como una novela.", delivery: "Cada capítulo lo veo el lunes y el viernes ya se me olvidó de qué iba." },
  { setup: "La gente dice 'el tiempo es oro'.", delivery: "Por eso cada vez que pierdo el tiempo, me siento rico." },
  { setup: "Tengo un plan para ser millonario.", delivery: "Paso uno: conseguir un millón. Paso dos: ya está." },
  { setup: "— ¿Cuál es el colmo de la paciencia?", delivery: "— Esperar a que el marido lave los platos sin que se lo pidan." },
  { setup: "Soy multitasking.", delivery: "Puedo ignorar varias cosas al mismo tiempo." },
  { setup: "Dicen que lo bueno se hace esperar.", delivery: "Por eso mi cuerpo atlético no llega todavía." },

  // ── Más Pepito + situacionales ──────────────────────────────────────────
  { setup: "La maestra: — Pepito, ¿cómo se llama el padre de tu papá?", delivery: "— Abuelo. — ¿Y el padre de tu mamá? — También abuelo. — ¿Y los dos se llaman igual? — Sí, pero uno vive en la costa y el otro en la montaña." },
  { setup: "Pepito le pregunta a su papá: — ¿Qué es la política?", delivery: "— Hijo, yo soy el gobierno, tu mamá el pueblo, tú la juventud y el bebé que duerme es el futuro. — Papá, se orinó el futuro." },
  { setup: "— Pepito, ¿qué planeta está después del Sol?", delivery: "— El lunes, maestra." },
  { setup: "La maestra: — Pepito, ¿qué pasó en 1492?", delivery: "— Yo no, maestra, estaba chiquito todavía." },
  { setup: "— Pepito, di una palabra con 'che'.", delivery: "— Cucha-ra. — ¿Y dónde está el 'che'? — Mi mamá me manda a buscarla: '¡Pepito, tráeche la cuchara!'" },

  // ── Tecnología / redes ──────────────────────────────────────────────────
  { setup: "Mi WiFi es tan lento…", delivery: "…que para ver un video en línea pido turno el lunes." },
  { setup: "Le dije a Siri: 'estoy solo'.", delivery: "Me respondió: 'lo siento, no reconozco ese contacto'." },
  { setup: "La batería de mi celular dura tanto como mis buenos propósitos del año:", delivery: "al mediodía ya se apagó." },
  { setup: "Mi contraseña es 'incorrecta'.", delivery: "Cada vez que me equivoco el sistema me dice 'tu contraseña es incorrecta' y yo ya sé cuál es." },
  { setup: "Ahora todos son influencers.", delivery: "Antes les decíamos 'metiches con teléfono'." },
  { setup: "Mi sobrino me preguntó qué era un walkman.", delivery: "Le dije: un Spotify sin internet y con pilas. Casi llora." },

  // ── Más matrimonio / suegras ────────────────────────────────────────────
  { setup: "— Mi suegra es un ángel.", delivery: "— Qué suerte. — Sí, la mía todavía está viva." },
  { setup: "¿Sabes por qué las suegras viven más que los suegros?", delivery: "Porque los suegros se van antes, de puro alivio." },
  { setup: "Mi esposa me dijo: 'si tu mamá y yo nos caemos al mar, ¿a quién salvas?'", delivery: "Le dije: '¿mi mamá sabe nadar?'" },
  { setup: "Le regalé un espejo a mi suegra para Navidad.", delivery: "Se ofendió muchísimo. Y eso que era un espejo viejito como ella." },

  // ── Más cortos con buen cierre ──────────────────────────────────────────
  { setup: "— ¿Qué le dice un pollo a un huevo?", delivery: "— Disculpa, pero creo que somos familia." },
  { setup: "Fui a la farmacia y pedí algo para el dolor.", delivery: "La farmacéutica me mandó a su ex." },
  { setup: "— ¿Qué hace un pingüino en el desierto?", delivery: "— Perdido, como yo en matemáticas." },
  { setup: "Leí que el chocolate aumenta el riesgo de enamorarse.", delivery: "Por eso yo solo como fruta, para no arriesgarme." },
  { setup: "Mi abuela me dijo: 'llegué a los 90 caminando todos los días'.", delivery: "Yo le dije: 'abuela, ¿y para qué caminaste tanto si ahora no te puedes ni parar?'" },
  { setup: "— ¿Cuál es el secreto de un matrimonio largo?", delivery: "— Dos televisores y dos baños." },
  { setup: "Dicen que los gatos tienen siete vidas.", delivery: "El mío va por la tercera y ya está cansado de mí." },
  { setup: "— ¿Cómo se dice 'pelo' en inglés?", delivery: "— Hair. — ¿Y 'pelo de nariz'? — Hair you are." },
  { setup: "Un día voy a dejar todo y vivir de mi pasión.", delivery: "Mi pasión es dormir, así que básicamente es el plan de jubilación." },
  { setup: "Mi papá siempre me dijo: 'nunca te rindas'.", delivery: "Por eso llevo tres años intentando abrir el frasco de mayonesa." },

  // ── Extras variados ─────────────────────────────────────────────────────
  { setup: "— ¿Sabes cuál es la diferencia entre el amor y una pizza?", delivery: "— La pizza siempre aparece a los 30 minutos." },
  { setup: "Me caí de las escaleras y no pasó nada.", delivery: "Bueno, sí: las escaleras se rieron de mí." },
  { setup: "Le dije a mi perro: 'quédate'.", delivery: "Me miró, se paró y se fue. Mejor, porque en realidad no quería quedarse conmigo." },
  { setup: "— Mamá, en el colegio me dicen 'distraído'.", delivery: "— Hijo, tú no estudias en un colegio, estudias en una panadería." },
  { setup: "Compré un libro sobre cómo manejar la ansiedad.", delivery: "Lo leí en una hora del pánico." },
  { setup: "Mi terapeuta me dijo: 'hábleme de su infancia'.", delivery: "Le dije: 'no recuerdo nada'. Me respondió: 'entonces fue perfecta'." },
  { setup: "Dicen que lo que no te mata te hace más fuerte.", delivery: "Pues llevo tres cafés y sigo de vago." },
  { setup: "— ¿Qué es lo peor de envejecer?", delivery: "— Que cada año la gente está más joven que uno." },
  { setup: "Hoy me miré al espejo y vi a mi padre.", delivery: "Le dije: '¿qué hago yo todavía levantándome tan temprano como tú?'" },
  { setup: "— ¿Por qué los libros de historia son tan tristes?", delivery: "— Porque siempre terminan mal para alguien." },
  { setup: "Fui al nutricionista.", delivery: "Me dijo: 'si quieres bajar de peso, cierra la boca'. Llevo dos horas sin hablar con nadie." },
  { setup: "Mi abuelo decía: 'la vida es como una escalera'.", delivery: "Yo le preguntaba: '¿sube o baja?' Él me respondía: 'depende de a quién le preguntes'." },
  { setup: "— ¿Qué le dice un uno a otro uno?", delivery: "— Juntos somos once, pero separados somos nada." },
  { setup: "Fui al supermercado y una señora me preguntó la hora.", delivery: "Le dije: 'son las tres'. Ella: '¿de la tarde?'. Yo: 'no, señora, de las galletas oreo'." },
  { setup: "— ¿Sabes por qué los peces no juegan fútbol?", delivery: "— Porque le tienen miedo a las redes." },
  { setup: "Mi primo es tan despistado que ayer llamó al número de emergencias…", delivery: "…para preguntar cuál era el número de emergencias." },
  { setup: "La vida te da sorpresas.", delivery: "La mía casi siempre es una multa de tránsito." },
  { setup: "— ¿Cuál es el secreto de la felicidad?", delivery: "— No tener WhatsApp." },
  { setup: "Fui a una fiesta y no conocía a nadie.", delivery: "Resulta que era mi cumpleaños, solo que había olvidado invitar a gente." },
  { setup: "Mi mamá me dijo: 'come, que estás flaco'.", delivery: "Diez años después: 'deja de comer, que estás gordo'. Nunca acierto." },
  { setup: "— ¿Sabes qué es un oxímoron?", delivery: "— Sí: 'servicio al cliente'." },
  { setup: "Soy tan puntual…", delivery: "…que siempre llego tarde a la misma hora." },
  { setup: "Mi hermano me dijo: 'tienes un problema'.", delivery: "Le respondí: 'no, tú eres el problema'. Y sigo siendo el favorito de mamá." },
  { setup: "— ¿Por qué los pumas no usan celular?", delivery: "— Porque donde viven no hay cobertura." },
  { setup: "Ayer vi a un hombre tirando café al suelo.", delivery: "Parece que le gustaba el suelo cafeinado." },
  { setup: "Si la vida te da limones…", delivery: "…agárralos, porque los limones están carísimos." },
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
