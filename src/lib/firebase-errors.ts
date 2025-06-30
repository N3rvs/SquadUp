import { FunctionsError } from "firebase/functions";

export function getFirebaseErrorMessage(error: any): string {
    if (error instanceof FunctionsError) {
        switch (error.code) {
            case 'unauthenticated':
                return "No estás autenticado. Por favor, inicia sesión de nuevo.";
            case 'permission-denied':
                return "No tienes los permisos necesarios para realizar esta acción.";
            case 'not-found':
                return "El recurso solicitado no fue encontrado en el servidor.";
            case 'invalid-argument':
                return "Los datos enviados son inválidos. Por favor, revisa la información.";
            case 'already-exists':
                 return "El elemento ya existe o la acción no puede ser completada.";
            default:
                return `Ocurrió un error con el servidor: ${error.message}`;
        }
    }
    if (error instanceof Error) {
        return error.message;
    }
    return "Ocurrió un error desconocido.";
}
