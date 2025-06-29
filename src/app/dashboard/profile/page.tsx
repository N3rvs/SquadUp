"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Avatar,
  AvatarFallback,
  AvatarImage
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Twitter, Youtube, Twitch, Save, Edit, MapPin, Gamepad2, Briefcase, MessageCircle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  availableForRecruitment: z.boolean().default(false),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

const valorantRoles = ["Duelist", "Controller", "Initiator", "Sentinel", "Flex"];
const countries = ["United Kingdom", "Germany", "France", "Spain", "Italy", "Netherlands", "Sweden", "Poland", "Belgium", "Austria", "Switzerland", "Portugal", "Ireland", "Denmark", "Norway", "Finland"]; 

export default function ProfilePage() {
  const { toast } = useToast();
  const [profileData, setProfileData] = useState({
      displayName: "JohnDoe",
      bio: "Aspiring Valorant pro. Looking for a serious team to climb the ranks.",
      valorantRole: "Duelist",
      country: "United Kingdom",
      twitterUrl: "https://twitter.com/johndoe",
      twitchUrl: "https://twitch.tv/johndoe",
      youtubeUrl: "",
      discord: "JohnDoe#1234",
      availableForRecruitment: true,
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: profileData,
    mode: "onChange",
  });

  function onSubmit(data: ProfileFormValues) {
    console.log(data);
    setProfileData(data);
    form.reset(data);
    toast({
      title: "Profile Updated",
      description: "Your changes have been saved successfully.",
    });
  }
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardContent className="pt-6 text-center flex flex-col items-center">
            <Avatar className="h-24 w-24 mb-4">
              <AvatarImage src="https://placehold.co/96x96.png" data-ai-hint="male avatar" />
              <AvatarFallback>{profileData.displayName.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <h2 className="text-2xl font-bold font-headline">{profileData.displayName}</h2>
            <p className="text-sm text-muted-foreground mt-1">{profileData.bio}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Badge variant="secondary"><Gamepad2 className="mr-1 h-3 w-3" />{profileData.valorantRole}</Badge>
                <Badge variant="secondary"><MapPin className="mr-1 h-3 w-3" />{profileData.country}</Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Dialog>
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
                            <FormLabel>Primary Role</FormLabel>
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

                    <FormField
                      control={form.control}
                      name="availableForRecruitment"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              Active in Player Market
                            </FormLabel>
                            <FormDescription>
                              Enable this to let teams know you are looking for a squad.
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
                    
                    <DialogFooter>
                      <DialogClose asChild>
                         <Button type="button" variant="ghost">Cancel</Button>
                      </DialogClose>
                      <DialogClose asChild>
                        <Button type="submit">
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </Button>
                      </DialogClose>
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
                <CardTitle>Recruitment Status</CardTitle>
            </CardHeader>
            <CardContent>
                {profileData.availableForRecruitment ? (
                    <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
                        <CheckCircle className="h-6 w-6 text-green-500"/>
                        <div>
                            <p className="font-semibold">Available for Recruitment</p>
                            <p className="text-sm text-muted-foreground">You are listed in the player market and can receive team invites.</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg">
                        <Briefcase className="h-6 w-6 text-muted-foreground"/>
                        <div>
                            <p className="font-semibold">Not Currently Looking</p>
                            <p className="text-sm text-muted-foreground">You are not listed in the player market.</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
        
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
