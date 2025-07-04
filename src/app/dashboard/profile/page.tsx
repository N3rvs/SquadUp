
"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Twitter, Youtube, Twitch, Save, Edit, MapPin, Gamepad2, MessageCircle, Camera, Loader2, User, ShieldCheck, Crown, Users, Search, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { auth, db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import type { SecurityRole } from "@/hooks/useAuthRole";
import { countries, getCountryCode } from "@/lib/countries";
import { valorantRanks, valorantRoles } from "@/lib/valorant";

const profileFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(30, "Display name must not be longer than 30 characters."),
  bio: z.string().max(160, "Bio must not be longer than 160 characters.").optional(),
  valorantRoles: z.array(z.string()).min(1, "Debes seleccionar al menos un rol.").max(3, "Puedes seleccionar un máximo de 3 roles."),
  valorantRank: z.string().optional(),
  country: z.string({
    required_error: "Please select a country.",
  }),
  twitchUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  twitterUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  youtubeUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  discord: z.string().optional(),
  lookingForTeam: z.boolean().optional().default(false),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type UserProfileData = Omit<ProfileFormValues, 'valorantRoles' | 'avatarUrl'> & {
  uid: string;
  email: string | null;
  isBanned: boolean;
  createdAt: string;
  valorantRoles?: string[];
  avatarUrl?: string;
  primaryRole: string; // Subscription plan
};

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isPageLoading, setIsPageLoading] = useState(true); // For initial page data load
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [securityRole, setSecurityRole] = useState<SecurityRole | null>(null);
  const [userTeam, setUserTeam] = useState<{ id: string; name: string } | null>(null);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      valorantRoles: [],
      valorantRank: "Unranked",
      country: "",
      twitchUrl: "",
      twitterUrl: "",
      youtubeUrl: "",
      discord: "",
      lookingForTeam: false,
    },
    mode: "onChange",
  });

  const handleAuthStateChange = useCallback(async (user: FirebaseUser | null) => {
    if (user) {
      setIsPageLoading(true);
      const idTokenResultPromise = user.getIdTokenResult(true);
      const userDocRef = doc(db, "users", user.uid);
      const docSnapPromise = getDoc(userDocRef);

      try {
        const [idTokenResult, docSnap] = await Promise.all([
          idTokenResultPromise,
          docSnapPromise,
        ]);
        const userClaimRole = (idTokenResult.claims.role as SecurityRole) || "player";
        setSecurityRole(userClaimRole);

        let dataToSet: UserProfileData;
        
        if (docSnap.exists()) {
          const data = { uid: user.uid, email: user.email, ...docSnap.data() } as UserProfileData;
          
          if (!Array.isArray(data.valorantRoles) || data.valorantRoles.length === 0) {
            data.valorantRoles = ["Flex"];
          }
          dataToSet = data;
        } else {
          console.log("No profile found, creating a new one for existing user.");
          const defaultData: UserProfileData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "New User",
            primaryRole: "player",
            isBanned: false,
            valorantRoles: ["Flex"],
            valorantRank: "Unranked",
            bio: "",
            country: "United Kingdom",
            twitchUrl: "",
            twitterUrl: "",
            youtubeUrl: "",
            discord: "",
            avatarUrl: user.photoURL || "",
            createdAt: new Date().toISOString(),
            lookingForTeam: false,
          };
          await setDoc(userDocRef, defaultData);
          dataToSet = defaultData;
        }

        setProfileData(dataToSet);
        form.reset({
          ...dataToSet,
          bio: dataToSet.bio || "",
          twitchUrl: dataToSet.twitchUrl || "",
          twitterUrl: dataToSet.twitterUrl || "",
          youtubeUrl: dataToSet.youtubeUrl || "",
          discord: dataToSet.discord || "",
          valorantRank: dataToSet.valorantRank || "Unranked",
          lookingForTeam: dataToSet.lookingForTeam || false,
        });

        // Fetch user's team
        const teamsQuery = query(collection(db, "teams"), where("memberIds", "array-contains", user.uid), limit(1));
        const teamSnapshot = await getDocs(teamsQuery);
        if (!teamSnapshot.empty) {
          const teamDoc = teamSnapshot.docs[0];
          setUserTeam({ id: teamDoc.id, name: teamDoc.data().name });
        } else {
          setUserTeam(null);
        }
      } catch (error) {
          console.error("Error fetching user data on profile page:", error);
          toast({ variant: "destructive", title: "Error", description: "No se pudo cargar tu perfil." });
          router.push("/login");
      }
    } else {
      router.push("/login");
    }
    setIsPageLoading(false);
  }, [form, router, toast]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, handleAuthStateChange);
    return () => unsubscribe();
  }, [handleAuthStateChange]);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast({ variant: "destructive", title: "File too large", description: "Avatar image must be less than 2MB." });
        return;
      }
      if (!file.type.startsWith("image/")) {
        toast({ variant: "destructive", title: "Invalid file type", description: "Please select an image file." });
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const onDialogOpenChange = (open: boolean) => {
    if (!open && profileData) {
        setAvatarPreview(null);
        setAvatarFile(null);
        form.reset({
            ...profileData,
            bio: profileData.bio || '',
            twitchUrl: profileData.twitchUrl || '',
            twitterUrl: profileData.twitterUrl || '',
            youtubeUrl: profileData.youtubeUrl || '',
            discord: profileData.discord || '',
        });
    }
  };

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true);
    if (!auth.currentUser) {
        toast({ variant: "destructive", title: "Not Authenticated", description: "You must be logged in to update your profile."});
        setIsLoading(false);
        return;
    }
    const uid = auth.currentUser.uid;
    
    try {
      let newAvatarUrl = profileData?.avatarUrl || '';
      if (avatarFile) {
        const fileRef = storageRef(storage, `avatars/${uid}/avatar`);
        const uploadResult = await uploadBytes(fileRef, avatarFile);
        newAvatarUrl = await getDownloadURL(uploadResult.ref);
      }

      const dataToSave = {
        ...data,
        avatarUrl: newAvatarUrl,
      };

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, dataToSave);
      
      const updatedProfileData: UserProfileData = {
          ...profileData!,
          ...dataToSave,
      };
      setProfileData(updatedProfileData);

      setAvatarFile(null);
      setAvatarPreview(null);
      
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
      // Close the dialog after successful submission
      const closeButton = document.querySelector('[data-radix-dialog-close]');
      if (closeButton instanceof HTMLElement) {
          closeButton.click();
      }
    } catch (error) {
      console.error("Error updating profile: ", error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: "An error occurred while saving your profile. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (isPageLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-1 space-y-8">
          <Card>
            <CardContent className="pt-6 text-center flex flex-col items-center">
              <Skeleton className="h-24 w-24 rounded-full mb-4" />
              <Skeleton className="h-7 w-40 mb-2" />
              <Skeleton className="h-4 w-full max-w-sm" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
           <Card>
            <CardHeader><Skeleton className="h-6 w-32" /></CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-20 w-full" /></CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
            <CardContent><Skeleton className="h-24 w-full" /></CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  if (!profileData) {
    return <div>Could not load profile. You may be logged out.</div>
  }

  const countryCode = getCountryCode(profileData.country);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardContent className="pt-6 text-center flex flex-col items-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={profileData.avatarUrl || undefined} alt={profileData.displayName} />
              <AvatarFallback>{profileData.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex items-baseline justify-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold font-headline">{profileData.displayName}</h2>
            </div>

            <div className="flex items-center justify-center gap-2 flex-wrap mt-2">
                 {securityRole === 'admin' && (
                <Badge variant="admin" className="shrink-0"><Crown className="mr-1 h-3 w-3" />Admin</Badge>
              )}
              {securityRole === 'moderator' && (
                <Badge variant="default" className="shrink-0"><ShieldCheck className="mr-1 h-3 w-3" />Moderator</Badge>
              )}
              {profileData.primaryRole && (
                <Badge variant="secondary" className="shrink-0">
                  <User className="mr-1 h-3 w-3" />
                  {profileData.primaryRole.charAt(0).toUpperCase() + profileData.primaryRole.slice(1)}
                </Badge>
              )}
            </div>

            <p className="text-sm text-muted-foreground mt-2">{profileData.bio}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
                {profileData.lookingForTeam && (
                    <Badge variant="default"><Search className="mr-1 h-3 w-3" /> Looking for Team</Badge>
                )}
                {userTeam && (
                    <Link href={`/dashboard/teams/${userTeam.id}`}>
                        <Badge variant="default" className="cursor-pointer">
                            <Users className="mr-1 h-3 w-3" />
                            {userTeam.name}
                        </Badge>
                    </Link>
                )}
                <Badge variant="outline">{profileData.valorantRank || 'Unranked'}</Badge>
                {profileData.valorantRoles?.map(role => (
                   <Badge key={role} variant="secondary"><Gamepad2 className="mr-1 h-3 w-3" />{role}</Badge>
                ))}
                <Badge variant="secondary" className="inline-flex items-center gap-1.5 pl-1.5 pr-2.5 py-1">
                    {countryCode ? (
                        <Image 
                            src={`https://flagsapi.com/${countryCode}/flat/16.png`} 
                            alt={profileData.country}
                            width={16}
                            height={16}
                            className="rounded-sm" 
                        />
                    ) : (
                        <MapPin className="h-3 w-3" />
                    )}
                    <span>{profileData.country}</span>
                </Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Dialog onOpenChange={onDialogOpenChange}>
              <DialogTrigger asChild>
                <Button className="w-full">
                  <Edit className="mr-2 h-4 w-4" /> Edit Profile
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Your Profile</DialogTitle>
                  <DialogDescription>
                    Make changes to your profile here. Click save when you're done.
                  </DialogDescription>
                </DialogHeader>

                <div className="relative mx-auto w-fit cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <Avatar className="h-24 w-24">
                        <AvatarImage src={avatarPreview || profileData.avatarUrl || undefined} alt={profileData.displayName} />
                        <AvatarFallback>{profileData.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full opacity-0 hover:opacity-100 transition-opacity">
                      <Camera className="h-8 w-8 text-white"/>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                </div>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pr-2">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="displayName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Display Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Your display name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="bio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bio</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Tell us a little bit about yourself"
                                className="resize-none"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="valorantRoles"
                      render={() => (
                        <FormItem>
                          <FormLabel>Valorant Roles</FormLabel>
                           <FormDescription>
                             Selecciona de 1 a 3 roles.
                          </FormDescription>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {valorantRoles.map((role) => (
                              <FormField
                                key={role}
                                control={form.control}
                                name="valorantRoles"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={role}
                                      className="flex flex-row items-center space-x-2 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(role)}
                                          onCheckedChange={(checked) => {
                                            const currentValue = field.value || [];
                                            if (checked) {
                                              field.onChange([...currentValue, role]);
                                            } else {
                                              field.onChange(
                                                currentValue.filter(
                                                  (value) => value !== role
                                                )
                                              );
                                            }
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal text-sm">
                                        {role}
                                      </FormLabel>
                                    </FormItem>
                                  );
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <FormField
                            control={form.control}
                            name="valorantRank"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Valorant Rank</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your rank" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {valorantRanks.map(rank => (
                                        <SelectItem key={rank} value={rank}>
                                        {rank}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Country</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select your country" />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {countries.map(country => (
                                        <SelectItem key={country} value={country}>
                                        {country}
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                     <FormField
                        control={form.control}
                        name="lookingForTeam"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                <div className="space-y-0.5">
                                    <FormLabel>Looking for a Team?</FormLabel>
                                    <FormDescription>
                                       Enable this to appear in the player marketplace.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                        />
                    
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium">Social Links</h3>
                      <FormField
                        control={form.control}
                        name="twitterUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-muted-foreground">
                              <Twitter className="h-4 w-4" /> Twitter
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="https://twitter.com/yourhandle" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="twitchUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-muted-foreground">
                              <Twitch className="h-4 w-4" /> Twitch
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="https://twitch.tv/yourchannel" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="youtubeUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-muted-foreground">
                              <Youtube className="h-4 w-4" /> YouTube
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="https://youtube.com/c/yourchannel" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                          control={form.control}
                          name="discord"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="flex items-center gap-2 text-muted-foreground">
                                <MessageCircle className="h-4 w-4" /> Discord
                              </FormLabel>
                              <FormControl>
                                <Input placeholder="YourDiscord#1234" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                    </div>
                    
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button type="button" variant="ghost">Cancel</Button>
                      </DialogClose>
                      <Button type="submit" disabled={isLoading}>
                         {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isLoading ? "Saving..." : "Save Changes"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact & Socials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             {profileData.twitterUrl && (
              <a href={profileData.twitterUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:underline">
                <Twitter className="h-5 w-5 text-muted-foreground" /> <span>{profileData.twitterUrl.replace(/^https?:\/\//, '')}</span>
              </a>
             )}
             {profileData.twitchUrl && (
              <a href={profileData.twitchUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:underline">
                <Twitch className="h-5 w-5 text-muted-foreground" /> <span>{profileData.twitchUrl.replace(/^https?:\/\//, '')}</span>
              </a>
             )}
             {profileData.youtubeUrl && (
              <a href={profileData.youtubeUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:underline">
                <Youtube className="h-5 w-5 text-muted-foreground" /> <span>{profileData.youtubeUrl.replace(/^https?:\/\//, '')}</span>
              </a>
             )}
             {profileData.discord && (
                <div className="flex items-center gap-3 text-sm">
                   <MessageCircle className="h-5 w-5 text-muted-foreground" /> <span>{profileData.discord}</span>
                </div>
             )}
             {!(profileData.twitterUrl || profileData.twitchUrl || profileData.youtubeUrl || profileData.discord) && (
                <p className="text-sm text-muted-foreground">No has añadido enlaces sociales.</p>
             )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2 space-y-8">
        <Card>
            <CardHeader>
                <CardTitle>Player Stats (Coming Soon)</CardTitle>
                <CardDescription>Valorant stats will be displayed here once linked.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-8">No stats available yet.</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

    
