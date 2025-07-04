"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getDocs, query, where, collection } from "firebase/firestore";
import { functions, db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const securityRolesList = ['admin', 'moderator'];
const primaryRolesList = ['fundador', 'coach', 'player'];

export function AssignRoleWithEmail() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [currentRole, setCurrentRole] = useState("");
  const [role, setRole] = useState("player");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    setSearching(true);
    setUid("");
    setCurrentRole("");
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: "destructive", title: "Usuario no encontrado", description: "Verifica el email." });
      } else {
        const userDoc = querySnapshot.docs[0];
        setUid(userDoc.id);
        const userRole = userDoc.data().primaryRole || 'player';
        setCurrentRole(userRole);
        setRole(userRole);
        toast({ title: "Usuario encontrado", description: `UID: ${userDoc.id}` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al buscar", description: error.message });
    } finally {
      setSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!uid) return;
    if (!auth.currentUser) {
        toast({ variant: 'destructive', title: 'Error de Autenticación', description: 'Debes iniciar sesión para realizar esta acción.' });
        return;
    }

    setLoading(true);
    try {
      await auth.currentUser.getIdToken(true); // Force token refresh
      const assignRole = httpsCallable(functions, "setUserRoleAndSync");
      await assignRole({ uid, role });

      toast({ title: "Rol asignado", description: `El rol '${role}' fue asignado y sincronizado para ${email}` });
      setCurrentRole(role);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error al asignar", description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Email del usuario" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button onClick={handleSearch} disabled={!email || searching} size="icon">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {uid && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
             Rol Actual: <Badge variant="secondary">{currentRole}</Badge>
           </div>

          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Roles de Seguridad</SelectLabel>
                {securityRolesList.map(role => (
                    <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Roles de Plataforma</SelectLabel>
                 {primaryRolesList.map(role => (
                    <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button onClick={handleAssignRole} disabled={loading || role === currentRole} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Actualizando...</> : "Actualizar Rol"}
          </Button>
        </div>
      )}
    </div>
  );
}
