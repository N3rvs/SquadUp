import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function ProfilePage() {
  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">My Profile</CardTitle>
          <CardDescription>
            Update your profile information. Your primary role is managed by the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src="https://placehold.co/80x80.png" data-ai-hint="male avatar" />
                <AvatarFallback>JD</AvatarFallback>
              </Avatar>
              <Button variant="outline">Change Avatar</Button>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input id="displayName" defaultValue="JohnDoe" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="primaryRole">Primary Role</Label>
                <Input id="primaryRole" defaultValue="Player" disabled />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gameRoles">Game Roles</Label>
                <Select defaultValue="duelist">
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="duelist">Duelist</SelectItem>
                    <SelectItem value="controller">Controller</SelectItem>
                    <SelectItem value="initiator">Initiator</SelectItem>
                    <SelectItem value="sentinel">Sentinel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button>Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-headline">Competitive History</CardTitle>
          <CardDescription>
            Your recent match history and performance statistics.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <p>No competitive history found.</p>
            <p className="text-sm">Play some matches to see your stats here.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
