
"use client";

import React, { useState, useRef, useEffect } from "react";
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
import { Twitter, Youtube, Twitch, Save, Edit, MapPin, Gamepad2, MessageCircle, Camera, Loader2, User, ShieldCheck, Crown, Users, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { auth, db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, getDoc, setDoc, collection, query, where, getDocs, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";


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
  avatarUrl: z.string().url().optional().or(z.literal('')),
  lookingForTeam: z.boolean().optional().default(false),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

type UserProfileData = Omit<ProfileFormValues, 'valorantRoles'> & {
  uid: string;
  email: string | null;
  primaryRole: "player" | "moderator" | "admin";
  isBanned: boolean;
  createdAt: string;
  valorantRoles?: string[];
  valorantRole?: string; // For backwards compatibility
};

const valorantRanks = ["Unranked", "Iron", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Ascendant", "Immortal", "Radiant"];
const valorantRoles = ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];
const countries = [
  "Albania", "Andorra", "Austria", "Belarus", "Belgium", "Bosnia and Herzegovina", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland", "Italy", "Latvia", "Liechtenstein", "Lithuania", "Luxembourg", "Malta", "Moldova", "Monaco", "Montenegro", "Netherlands", "North Macedonia", "Norway", "Poland", "Portugal", "Romania", "Russia", "San Marino", "Serbia", "Slovakia", "Slovenia", "Spain", "Sweden", "Switzerland", "Ukraine", "United Kingdom", "Vatican City",
  "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon", "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen",
  "Algeria", "Angola", "Benin", "Botswana", "Burkina Faso", "Burundi", "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo, Democratic Republic of the", "Congo, Republic of the", "Cote d'Ivoire", "Djibouti", "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana", "Guinea", "Guinea-Bissau", "Kenya", "Lesotho", "Liberia", "Libya", "Madagascar", "Malawi", "Mali", "Mauritania", "Mauritius", "Morocco", "Mozambique", "Namibia", "Niger", "Nigeria", "Rwanda", "Sao Tome and Principe", "Senegal", "Seychelles", "Sierra Leone", "Somalia", "South Africa", "South Sudan", "Sudan", "Tanzania", "Togo", "Tunisia", "Uganda", "Zambia", "Zimbabwe"
].sort();

const countryNameToCode: { [key: string]: string } = {
    "Albania": "AL", "Andorra": "AD", "Austria": "AT", "Belarus": "BY", "Belgium": "BE", "Bosnia and Herzegovina": "BA", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czech Republic": "CZ", "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Moldova": "MD", "Monaco": "MC", "Montenegro": "ME", "Netherlands": "NL", "North Macedonia": "MK", "Norway": "NO", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "San Marino": "SM", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Ukraine": "UA", "United Kingdom": "GB", "Vatican City": "VA",
    "Bahrain": "BH", "Egypt": "EG", "Iran": "IR", "Iraq": "IQ", "Israel": "IL", "Jordan": "JO", "Kuwait": "KW", "Lebanon": "LB", "Oman": "OM", "Palestine": "PS", "Qatar": "QA", "Saudi Arabia": "SA", "Syria": "SY", "Turkey": "TR", "United Arab Emirates": "AE", "Yemen": "YE",
    "Algeria": "DZ", "Angola": "AO", "Benin": "BJ", "Botswana": "BW", "Burkina Faso": "BF", "Burundi": "BI", "Cameroon": "CM", "Cape Verde": "CV", "Central African Republic": "CF", "Chad": "TD", "Comoros": "KM", "Congo, Democratic Republic of the": "CD", "Congo, Republic of the": "CG", "Cote d'Ivoire": "CI", "Djibouti": "DJ", "Equatorial Guinea": "GQ", "Eritrea": "ER", "Eswatini": "SZ", "Ethiopia": "ET", "Gabon": "GA", "Gambia": "GM", "Ghana": "GH", "Guinea": "GN", "Guinea-Bissau": "GW", "Kenya": "KE", "Lesotho": "LS", "Liberia": "LR", "Libya": "LY", "Madagascar": "MG", "Malawi": "MW", "Mali": "ML", "Mauritania": "MR", "Mauritius": "MU", "Morocco": "MA", "Mozambique": "MZ", "Namibia": "NA", "Niger": "NE", "Nigeria": "NG", "Rwanda": "RW", "Sao Tome and Principe": "ST", "Senegal": "SN", "Seychelles": "SC", "Sierra Leone": "SL", "Somalia": "SO", "South Africa": "ZA", "South Sudan": "SS", "Sudan": "SD", "Tanzania": "TZ", "Togo": "TG", "Tunisia": "TN", "Uganda": "UG", "Zambia": "ZM", "Zimbabwe": "ZW",
};

function getCountryCode(countryName: string): string | null {
  return countryNameToCode[countryName] || null;
}

export default function ProfilePage() {
  const { toast } = useToast();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false); // For form submission
  const [isPageLoading, setIsPageLoading] = useState(true); // For initial page data load
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
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
      avatarUrl: "",
      lookingForTeam: false,
    },
    mode: "onChange",
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(userDocRef);

        let dataToSet;
        if (docSnap.exists()) {
          const data = { ...docSnap.data() } as UserProfileData;
          if (data.valorantRole && !Array.isArray(data.valorantRoles)) {
            data.valorantRoles = [data.valorantRole];
            delete data.valorantRole;
          }
          if (!data.valorantRoles) {
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
          bio: dataToSet.bio || '',
          twitchUrl: dataToSet.twitchUrl || '',
          twitterUrl: dataToSet.twitterUrl || '',
          youtubeUrl: dataToSet.youtubeUrl || '',
          discord: dataToSet.discord || '',
          valorantRank: dataToSet.valorantRank || 'Unranked',
          lookingForTeam: dataToSet.lookingForTeam || false,
        });
        
        // --- Fetch user's team ---
        const teamsQuery = query(collection(db, "teams"), where("memberIds", "array-contains", user.uid), limit(1));
        const teamSnapshot = await getDocs(teamsQuery);
        if (!teamSnapshot.empty) {
            const teamDoc = teamSnapshot.docs[0];
            setUserTeam({ id: teamDoc.id, name: teamDoc.data().name });
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
        form.reset({
          ...profileData,
          bio: profileData.bio || '',
          twitchUrl: profileData.twitchUrl || '',
          twitterUrl: profileData.twitterUrl || '',
          youtubeUrl: profileData.youtubeUrl || '',
          discord: profileData.discord || '',
          valorantRank: profileData.valorantRank || 'Unranked',
          lookingForTeam: profileData.lookingForTeam || false,
        });
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
        const fileRef = storageRef(storage, `avatars/${uid}/avatar`);
        const uploadResult = await uploadBytes(fileRef, avatarFile);
        newAvatarUrl = await getDownloadURL(uploadResult.ref);
      }

      const dataToSave: Omit<UserProfileData, 'valorantRole' | 'uid' | 'email' | 'primaryRole' | 'isBanned' | 'createdAt'> = {
        ...data,
        avatarUrl: newAvatarUrl,
      };

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, dataToSave as any);
      
      const newProfileData = { ...profileData, ...dataToSave } as UserProfileData;
      setProfileData(newProfileData);
      form.reset({
        ...newProfileData,
        bio: newProfileData.bio || '',
        twitchUrl: newProfileData.twitchUrl || '',
        twitterUrl: newProfileData.twitterUrl || '',
        youtubeUrl: newProfileData.youtubeUrl || '',
        discord: newProfileData.discord || '',
      });
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
              {profileData.primaryRole === 'admin' && (
                <Badge variant="admin" className="shrink-0"><Crown className="mr-1 h-3 w-3" />Admin</Badge>
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

    