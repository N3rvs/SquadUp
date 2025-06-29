"use client";

import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { getDocs, query, where, collection } from "firebase/firestore";
import { functions, db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

export function AssignRoleWithEmail() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [uid, setUid] = useState("");
  const [role, setRole] = useState("moderator");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    setSearching(true);
    setUid("");
    try {
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ variant: "destructive", title: "Usuario no encontrado", description: "Verifica el email." });
      } else {
        const doc = querySnapshot.docs[0];
        setUid(doc.id);
        toast({ title: "Usuario encontrado", description: `UID: ${doc.id}` });
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al buscar", description: error.message });
    } finally {
      setSearching(false);
    }
  };

  const handleAssignRole = async () => {
    if (!uid) return;

    setLoading(true);
    try {
      const assignRole = httpsCallable(functions, "setUserRole");
      await assignRole({ uid, role });
      toast({ title: "Rol asignado", description: `El rol '${role}' fue asignado a ${email}` });
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
          <div className="text-sm text-muted-foreground">UID: <span className="font-mono bg-muted p-1 rounded">{uid}</span></div>

          <Select value={role} onValueChange={setRole}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleAssignRole} disabled={loading} className="w-full">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Asignando...</> : "Asignar Rol"}
          </Button>
        </div>
      )}
    </div>
  );
}