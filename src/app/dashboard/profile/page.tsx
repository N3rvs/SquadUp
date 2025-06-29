
"use client";

import React, { useState, useRef, useEffect } from "react";
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
import { Twitter, Youtube, Twitch, Save, Edit, MapPin, Gamepad2, MessageCircle, Camera, Loader2, User, Shield, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { auth, db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";


const profileFormSchema = z.object({
  displayName: z.string().min(2, "Display name must be at least 2 characters.").max(30, "Display name must not be longer than 30 characters."),
  bio: z.string().max(160, "Bio must not be longer than 160 characters.").optional(),
  valorantRole: z.string({
    required_error: "Please select a role.",
  }),
  country: z.string({
    required_error: "Please select a country.",
  }),
  twitchUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  twitterUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  youtubeUrl: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  discord: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// This type represents the full user document in Firestore.
type UserProfileData = ProfileFormValues & {
  uid: string;
  email: string | null;
  primaryRole: "player" | "moderator" | "admin";
  isBanned: boolean;
  createdAt: string;
};


const valorantRoles = ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];
const countries = ["United Kingdom", "Germany", "France", "Spain", "Italy", "Netherlands", "Sweden", "Poland", "Belgium", "Austria", "Switzerland", "Portugal", "Ireland", "Denmark", "Norway", "Finland"]; 

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isPageLoading, setIsPageLoading] = useState(true); // For initial page data load
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      displayName: "",
      bio: "",
      valorantRole: "Flex",
      country: "",
      twitchUrl: "",
      twitterUrl: "",
      youtubeUrl: "",
      discord: "",
      avatarUrl: "",
    },
    mode: "onChange",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfileData;
          setProfileData(data);
          form.reset(data);
        } else {
           console.log("No profile found, creating a new one for existing user.");
           const defaultData: UserProfileData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || "New User",
            primaryRole: "player",
            isBanned: false,
            valorantRole: "Flex",
            bio: "",
            country: "United Kingdom",
            twitchUrl: "",
            twitterUrl: "",
            youtubeUrl: "",
            discord: "",
            avatarUrl: user.photoURL || "",
            createdAt: new Date().toISOString(),
          };
          await setDoc(userDocRef, defaultData);
          setProfileData(defaultData);
          form.reset(defaultData);
        }
      } else {
        router.push("/login");
      }
      setIsPageLoading(false);
    });

    return () => unsubscribe();
  }, [form, router]);


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
    if (!open) {
      setAvatarPreview(null);
      setAvatarFile(null);
      if (profileData) {
        form.reset(profileData);
      }
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
        const fileRef = storageRef(storage, `avatars/${uid}/${avatarFile.name}`);
        const uploadResult = await uploadBytes(fileRef, avatarFile);
        newAvatarUrl = await getDownloadURL(uploadResult.ref);
      }

      const dataToSave = {
        ...data,
        avatarUrl: newAvatarUrl,
      };

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, dataToSave);
      
      const newProfileData = { ...profileData, ...dataToSave } as UserProfileData;
      setProfileData(newProfileData);
      form.reset(newProfileData);
      setAvatarFile(null);
      setAvatarPreview(null);
      
      toast({
        title: "Profile Updated",
        description: "Your changes have been saved successfully.",
      });
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
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardContent className="pt-6 text-center flex flex-col items-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src={profileData.avatarUrl || undefined} alt={profileData.displayName} />
              <AvatarFallback>{profileData.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <h2 className="text-2xl font-bold font-headline">{profileData.displayName}</h2>
              {profileData.primaryRole === 'admin' && (
                <Badge variant="destructive" className="shrink-0"><Shield className="mr-1 h-3 w-3" />Admin</Badge>
              )}
              {profileData.primaryRole === 'moderator' && (
                <Badge variant="default" className="shrink-0"><ShieldCheck className="mr-1 h-3 w-3" />Moderator</Badge>
              )}
              {profileData.primaryRole === 'player' && (
                <Badge variant="secondary" className="shrink-0"><User className="mr-1 h-3 w-3" />Player</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{profileData.bio}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary"><Gamepad2 className="mr-1 h-3 w-3" />{profileData.valorantRole}</Badge>
                <Badge variant="secondary"><MapPin className="mr-1 h-3 w-3" />{profileData.country}</Badge>
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="valorantRole"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valorant Role</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select your main role" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {valorantRoles.map(role => (
                                  <SelectItem key={role} value={role}>
                                    {role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription>
                              Only editable when not in a team.
                            </FormDescription>
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
                      <Button type="submit" disabled={isLoading} onClick={form.handleSubmit(onSubmit)}>
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
