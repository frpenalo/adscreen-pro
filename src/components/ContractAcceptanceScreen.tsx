import { useRef, useState } from "react";
import { useAcceptContract } from "@/hooks/useContractAcceptance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const CONTRACT_DATE = new Date().toLocaleDateString("es-US", {
  year: "numeric", month: "long", day: "numeric",
});

const advertiserContract = (name: string, business: string, email: string) => `
ACUERDO DE SERVICIOS PUBLICITARIOS — ANUNCIANTE

Fecha: ${CONTRACT_DATE}
Proveedor: SOFTMEDIA, LLC DBA AdScreenPro, Raleigh, NC
Anunciante: ${name} — ${business}
Email: ${email}
Plan contratado: $60.00 USD / mes — Red de locales afiliados, Raleigh, NC

CLÁUSULA 1: OBJETO DEL SERVICIO
SOFTMEDIA, LLC DBA AdScreenPro (en adelante "AdScreenPro") se compromete a mostrar el contenido publicitario del Anunciante en su red de pantallas digitales instaladas en locales comerciales afiliados en la ciudad de Raleigh, NC, durante la vigencia de este acuerdo y de acuerdo con el plan contratado.

CLÁUSULA 2: DESCRIPCIÓN DEL SERVICIO
a) El anuncio del Anunciante se mostrará en rotación con otros anunciantes en las pantallas de la red AdScreenPro.
b) El tiempo de exposición mínimo garantizado es de 10 segundos por ciclo de rotación.
c) AdScreenPro proveerá acceso al panel de control en adscreenpro.com para que el Anunciante pueda subir, actualizar y gestionar su contenido publicitario.
d) Las pantallas operan durante el horario de atención de cada establecimiento afiliado.
e) AdScreenPro se reserva el derecho de ajustar el número de pantallas activas en la red, notificando al Anunciante con un mínimo de 7 días de anticipación si esto afecta significativamente el alcance del servicio contratado.

CLÁUSULA 3: PRECIO Y FORMA DE PAGO
El Anunciante pagará a AdScreenPro la suma de $60.00 USD mensuales por el servicio descrito en este acuerdo. El pago deberá realizarse por adelantado, entre los días 1 y 5 de cada mes, a través de la plataforma de pago habilitada en adscreenpro.com. El incumplimiento de pago dentro de los cinco (5) días calendario de gracia autorizará a AdScreenPro a suspender el servicio sin previo aviso adicional, sin que ello genere derecho a reembolso por el período ya cobrado.

CLÁUSULA 4: CONTENIDO PUBLICITARIO
a) El Anunciante es el único responsable del contenido que suba a la plataforma, garantizando que cuenta con todos los derechos, licencias y autorizaciones necesarias para su uso.
b) AdScreenPro se reserva el derecho de rechazar o retirar cualquier contenido que considere inapropiado, ofensivo, ilegal, engañoso o contrario a sus políticas de uso.
c) Queda prohibida la publicidad de alcohol, tabaco, armas, contenido adulto, apuestas ilegales o cualquier producto o servicio ilegal bajo las leyes del Estado de North Carolina.
d) El Anunciante deberá proveer el contenido en formato digital compatible (MP4, JPG, PNG) con las especificaciones indicadas en la plataforma.
e) AdScreenPro no se hace responsable por errores en el contenido publicado que sean responsabilidad del Anunciante.

CLÁUSULA 5: DURACIÓN Y RENOVACIÓN
Este acuerdo es de vigencia mensual y se renueva automáticamente cada mes, salvo que cualquiera de las partes notifique su intención de no renovar con al menos siete (7) días de anticipación al vencimiento del período en curso.

CLÁUSULA 6: CANCELACIÓN Y REEMBOLSOS
El Anunciante podrá cancelar el servicio en cualquier momento con siete (7) días de aviso escrito. No se realizarán reembolsos por períodos ya pagados. AdScreenPro podrá cancelar este acuerdo de forma inmediata en caso de incumplimiento de las condiciones de contenido o de pago establecidas en este documento.

CLÁUSULA 7: LIMITACIÓN DE RESPONSABILIDAD
AdScreenPro no garantiza un número específico de impresiones, visualizaciones ni resultados comerciales derivados de la publicidad. La responsabilidad total de AdScreenPro ante el Anunciante por cualquier concepto no excederá el monto pagado por el último mes de servicio.

CLÁUSULA 8: PROPIEDAD INTELECTUAL
El Anunciante conserva todos los derechos sobre su contenido publicitario. Al subir contenido a la plataforma, el Anunciante otorga a AdScreenPro una licencia no exclusiva, limitada y revocable para mostrar dicho contenido en su red de pantallas durante la vigencia de este acuerdo.

CLÁUSULA 9: CONFIDENCIALIDAD
Ambas partes acuerdan mantener confidencialidad sobre los términos económicos de este acuerdo y sobre cualquier información comercial sensible compartida durante la relación contractual.

CLÁUSULA 10: NO ELUSIÓN
Durante la vigencia de este acuerdo y por un período de doce (12) meses contados desde su terminación, el Anunciante se compromete a no contratar directa ni indirectamente servicios de publicidad con ningún local comercial, anfitrión de pantalla u oportunidad de colocación publicitaria que haya sido presentada al Anunciante por AdScreenPro, con el propósito de eludir las tarifas, comisiones o la intermediación de AdScreenPro.

CLÁUSULA 11: LEY APLICABLE Y JURISDICCIÓN
Este acuerdo se rige por las leyes del Estado de North Carolina, Estados Unidos de América. Cualquier disputa que no pueda resolverse de mutuo acuerdo será sometida a mediación en el Condado de Wake, NC, antes de iniciar cualquier acción legal.

CLÁUSULA 12: ACUERDO COMPLETO
Este documento constituye el acuerdo completo entre las partes y reemplaza cualquier comunicación verbal o escrita anterior sobre el mismo objeto. Cualquier modificación requerirá forma escrita firmada por ambas partes.

Al aceptar digitalmente este acuerdo, el Anunciante declara haber leído, comprendido y aceptado todos los términos y condiciones establecidos en el presente documento, con plena validez legal bajo la ley federal E-SIGN Act (15 U.S.C. § 7001 et seq.).
`;

const partnerContract = (name: string, business: string, email: string, tvOwner: "partner" | "adscreenpro" = "partner") => `
ACUERDO DE PARTNER — LOCAL COMERCIAL AFILIADO

Fecha: ${CONTRACT_DATE}
Proveedor: SOFTMEDIA, LLC DBA AdScreenPro, Raleigh, NC
Partner: ${name} — ${business}
Email: ${email}

CLÁUSULA 1: OBJETO DEL ACUERDO
El presente acuerdo establece los términos bajo los cuales el Partner (en adelante "el Local") autoriza a SOFTMEDIA, LLC DBA AdScreenPro (en adelante "AdScreenPro") a utilizar la pantalla o televisor de su propiedad, ya instalado en sus instalaciones, para la transmisión de contenido publicitario gestionado por la plataforma AdScreenPro.

CLÁUSULA 2: OBLIGACIONES DE ADSCREENPRO
a) Gestionar la plataforma tecnológica para la programación y distribución del contenido publicitario en la pantalla del Local.
b) Pagar al Partner las comisiones acordadas según lo estipulado en la Cláusula 4.
c) Garantizar que el contenido transmitido sea apropiado, legal y no contrario a las buenas costumbres.
d) Proveer acceso al panel de control en adscreenpro.com y soporte técnico remoto para el correcto funcionamiento del sistema.
e) Proveer al Partner un enlace único de referidos para la captación de nuevos anunciantes.

CLÁUSULA 3: OBLIGACIONES DEL PARTNER (LOCAL COMERCIAL)
a) Permitir el uso de su pantalla o televisor en un lugar visible para los clientes del establecimiento, durante el horario de atención del local.
b) Garantizar suministro eléctrico y conectividad a internet (WiFi o ethernet) para el funcionamiento continuo del sistema.
c) No alterar, bloquear ni interferir con la programación del sistema AdScreenPro en la pantalla sin autorización previa.
d) Notificar a AdScreenPro cualquier falla técnica o incidente relacionado con el sistema en un plazo razonable.

CLÁUSULA 4: COMISIONES AL PARTNER
El Partner recibirá las siguientes compensaciones:

a) Comisión por referidos: el 20% mensual del valor de la membresía de cada Anunciante que se registre como cliente activo de AdScreenPro a través del enlace único de referidos del Partner, durante el tiempo que dicho Anunciante permanezca activo.

b) Comisión por ventas desde pantalla: un porcentaje variable de cada venta de producto o servicio generada directamente desde la pantalla del Local. Este porcentaje será establecido por el dueño, creador o facilitador de cada producto o servicio en acuerdo con AdScreenPro.

Los pagos serán realizados entre los días 1 y 5 de cada mes calendario, correspondiente al mes anterior, a través de Zelle, ACH o el método acordado entre las partes.

CLÁUSULA 5: PROPIEDAD DEL EQUIPO
${tvOwner === "adscreenpro"
  ? `La pantalla, televisor y equipo provisto por AdScreenPro e instalado en las instalaciones del Local permanece siendo propiedad exclusiva de SOFTMEDIA, LLC DBA AdScreenPro. El Partner se compromete a: (a) mantener el equipo en buen estado y reportar cualquier daño o falla en un plazo razonable; (b) no trasladar, modificar ni enajenar el equipo sin autorización previa por escrito de AdScreenPro; (c) devolver el equipo en buen estado al momento de la terminación de este acuerdo, sin importar la causa. El uso del equipo no tiene costo para el Partner durante la vigencia del acuerdo. Cualquier daño por negligencia o mal uso será responsabilidad del Partner.`
  : `La pantalla, televisor y cualquier equipo ubicado en las instalaciones del Local es y permanece siendo propiedad exclusiva del Partner. AdScreenPro no adquiere ningún derecho sobre el equipo del Local por la sola participación en este acuerdo.`
}

CLÁUSULA 6: DURACIÓN Y TERMINACIÓN
Este acuerdo es de vigencia mensual y se renueva automáticamente cada mes. El Partner puede retirarse de la red AdScreenPro en cualquier momento, sin penalidad, notificando su decisión por escrito con al menos siete (7) días de anticipación. AdScreenPro también podrá dar por terminado el acuerdo con el mismo preaviso, salvo incumplimiento grave que justifique terminación inmediata.

CLÁUSULA 7: RESPONSABILIDAD
AdScreenPro no será responsable por daños al equipo del Local ni por interrupciones del servicio causadas por cortes de electricidad, fallas de internet o causas de fuerza mayor. El Local no será responsable por el contenido publicitario gestionado por AdScreenPro, siempre que haya notificado oportunamente cualquier irregularidad observada.

CLÁUSULA 8: CONFIDENCIALIDAD Y NO DIVULGACIÓN (NDA)
a) Información Confidencial: Se considera información confidencial toda aquella que una parte divulgue a la otra en el marco de este acuerdo, incluyendo sin limitación: tecnología y plataforma propietaria de AdScreenPro, lista de anunciantes y locales afiliados, estructuras de precios y comisiones, estrategias comerciales, datos de rendimiento de pantallas, y cualquier otra información designada como confidencial o que por su naturaleza deba entenderse como tal.

b) Obligaciones: Cada parte se compromete a: (i) no divulgar la información confidencial de la otra parte a terceros sin consentimiento previo por escrito; (ii) no utilizar dicha información para ningún propósito distinto al cumplimiento de este acuerdo; (iii) proteger la información confidencial con el mismo nivel de cuidado que aplica a su propia información confidencial, y en ningún caso con un nivel inferior al razonablemente diligente.

c) Vigencia: Las obligaciones de confidencialidad establecidas en esta cláusula se mantendrán durante la vigencia de este acuerdo y por un período de dos (2) años contados desde su terminación.

d) Excepciones: Las obligaciones de confidencialidad no aplican a información que: (i) sea o se convierta en de dominio público sin incumplimiento de este acuerdo; (ii) deba ser divulgada por mandato legal o de autoridad competente, en cuyo caso la parte obligada notificará a la otra con la mayor antelación posible.

CLÁUSULA 9: RELACIÓN ENTRE LAS PARTES
El Socio es un propietario de negocio independiente y un establecimiento participante en la red AdScreenPro. Nada de lo dispuesto en el presente Acuerdo constituye una relación laboral, de agencia, de sociedad o de empresa conjunta entre las partes. AdScreenPro no retiene impuestos sobre las comisiones pagadas al Partner, quien es responsable de sus propias obligaciones fiscales.

CLÁUSULA 10: NO COMPETENCIA, EXCLUSIVIDAD Y NO SOLICITUD
a) No Competencia y Exclusividad en el Establecimiento: El Partner acepta que AdScreenPro es el proveedor exclusivo de publicidad digital programática en el Establecimiento durante la vigencia de este acuerdo. Durante dicha vigencia, el Partner no podrá instalar, operar ni permitir ninguna red publicitaria de pantallas digitales de terceros en el Establecimiento que compita con los servicios de AdScreenPro provistos bajo este acuerdo, sin el consentimiento previo por escrito de AdScreenPro. Esta restricción aplica con independencia de que el Partner sea una persona física o una entidad comercial (LLC, Corp u otra), y tiene por objeto evitar la saturación visual y proteger la efectividad de la red de anunciantes de AdScreenPro.

b) No Solicitud: Durante la vigencia de este acuerdo y por un período de doce (12) meses contados desde su terminación, el Partner no podrá directa ni indirectamente solicitar, inducir o persuadir a ningún local afiliado, anunciante o cliente de AdScreenPro que haya sido presentado a través de la red de AdScreenPro, a terminar, reducir o eludir su relación comercial con AdScreenPro.

CLÁUSULA 11: LEY APLICABLE Y JURISDICCIÓN
Este acuerdo se rige por las leyes del Estado de North Carolina, Estados Unidos de América. Cualquier disputa que no pueda resolverse de mutuo acuerdo será sometida a mediación en el Condado de Wake, NC, antes de iniciar cualquier acción legal.

CLÁUSULA 12: ACUERDO COMPLETO
Este documento constituye el acuerdo completo entre las partes respecto a su objeto y reemplaza cualquier acuerdo verbal o escrito anterior. Cualquier modificación deberá constar por escrito y ser aceptada por ambas partes.

Al aceptar digitalmente este acuerdo, el Partner declara haber leído, comprendido y aceptado todos los términos y condiciones establecidos en el presente documento, con plena validez legal bajo la ley federal E-SIGN Act (15 U.S.C. § 7001 et seq.).
`;

interface Props {
  role: "advertiser" | "partner";
  name: string;
  business: string;
  email: string;
  tvOwner?: "partner" | "adscreenpro";
  onAccepted: () => void;
}

const ContractAcceptanceScreen = ({ role, name, business, email, tvOwner = "partner", onAccepted }: Props) => {
  const contractRef = useRef<HTMLDivElement>(null);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);
  const [signature, setSignature] = useState("");
  const { mutate: acceptContract, isPending } = useAcceptContract();

  const contractText = role === "advertiser"
    ? advertiserContract(name, business, email)
    : partnerContract(name, business, email, tvOwner);

  const handleScroll = () => {
    const el = contractRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
      setScrolledToEnd(true);
    }
  };

  const canSign = scrolledToEnd && checked && signature.trim().length >= 3;

  const handleAccept = () => {
    if (!canSign) return;
    acceptContract(
      { role, signature: signature.trim() },
      {
        onSuccess: () => {
          toast.success("Contrato firmado. ¡Bienvenido a AdScreenPro!");
          onAccepted();
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start py-8 px-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg overflow-hidden">

        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 flex-shrink-0" />
            <div>
              <h1 className="text-lg font-bold">
                {role === "advertiser"
                  ? "Acuerdo de Servicios Publicitarios"
                  : tvOwner === "adscreenpro"
                    ? "Acuerdo de Partner — Equipo Provisto por AdScreenPro"
                    : "Acuerdo de Partner — Local Afiliado"}
              </h1>
              <p className="text-sm text-primary-foreground/80 mt-0.5">Léelo completo antes de firmar</p>
            </div>
          </div>
        </div>

        {/* Contract text */}
        <div
          ref={contractRef}
          onScroll={handleScroll}
          className="h-96 overflow-y-auto px-6 py-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap border-b border-gray-200"
          style={{ fontFamily: "monospace", fontSize: "12px" }}
        >
          {contractText}
        </div>

        {!scrolledToEnd && (
          <p className="text-center text-xs text-muted-foreground py-2 bg-yellow-50 border-b border-yellow-200">
            ↓ Desplázate hasta el final para habilitar la firma
          </p>
        )}

        {/* Signature section */}
        <div className="px-6 py-5 space-y-4">

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              disabled={!scrolledToEnd}
              className="mt-0.5 h-4 w-4 accent-primary"
            />
            <span className={`text-sm ${scrolledToEnd ? "text-foreground" : "text-muted-foreground"}`}>
              He leído y acepto todos los términos y condiciones de este acuerdo. Entiendo que esta aceptación digital tiene la misma validez legal que una firma física bajo la ley E-SIGN Act.
            </span>
          </label>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              Firma digital — escribe tu nombre completo
            </label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Tu nombre completo"
              disabled={!checked}
              className="font-serif italic text-base"
            />
            <p className="text-xs text-muted-foreground">
              Al escribir tu nombre confirmas tu identidad y aceptación del contrato.
            </p>
          </div>

          <Button
            onClick={handleAccept}
            disabled={!canSign || isPending}
            className="w-full gap-2"
            size="lg"
          >
            {isPending
              ? <><Loader2 className="h-4 w-4 animate-spin" /> Guardando firma...</>
              : <><ShieldCheck className="h-4 w-4" /> Firmar y continuar</>
            }
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            SOFTMEDIA, LLC DBA AdScreenPro · Raleigh, NC · adscreenpro.com
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContractAcceptanceScreen;
