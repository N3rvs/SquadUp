
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCountryCode } from '@/lib/countries';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Twitter, Youtube, Twitch, MessageCircle, MapPin, Gamepad2, ArrowLeft, Search, Users } from 'lucide-react';
import Link from 'next/link';

type UserProfileData = {
    uid: string;
    displayName: string;
    bio?: string;
    avatarUrl?: string;
    valorantRoles?: string[];
    valorantRank?: string;
    country: string;
    twitchUrl?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
    discord?: string;
    lookingForTeam?: boolean;
    primaryRole: string; // Subscription plan
};

type TeamInfo = {
    id: string;
    name: string;
};

function ProfileSkeleton() {
    return (
        <div className="space-y-8">
             <Skeleton className="h-10 w-32" />
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                <div className="lg:col-span-1 space-y-8">
                    <Card>
                        <CardContent className="pt-6 text-center flex flex-col items-center">
                        <Skeleton className="h-24 w-24 rounded-full mb-4" />
                        <Skeleton className="h-7 w-40 mb-2" />
                        <Skeleton className="h-4 w-full max-w-sm" />
                        </CardContent>
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
                </div>
            </div>
        </div>
    )
}


export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [profileData, setProfileData] = useState<UserProfileData | null>(null);
    const [userTeam, setUserTeam] = useState<TeamInfo | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(true);
    const uid = typeof params.uid === 'string' ? params.uid : '';

    useEffect(() => {
        if (!uid) {
            router.push('/dashboard/marketplace');
            return;
        };

        const fetchUserProfile = async () => {
            setIsPageLoading(true);
            const userDocRef = doc(db, 'users', uid);
            const teamQuery = query(collection(db, "teams"), where("memberIds", "array-contains", uid), limit(1));
            
            const [docSnap, teamSnapshot] = await Promise.all([
                getDoc(userDocRef),
                getDocs(teamQuery)
            ]);


            if (docSnap.exists()) {
                setProfileData({ uid, ...docSnap.data() } as UserProfileData);
            } else {
                console.error("No such user!");
                setProfileData(null);
            }

            if (!teamSnapshot.empty) {
                const teamDoc = teamSnapshot.docs[0];
                setUserTeam({ id: teamDoc.id, name: teamDoc.data().name });
            }

            setIsPageLoading(false);
        };

        fetchUserProfile();
    }, [uid, router]);
    
    if (isPageLoading) {
        return <ProfileSkeleton />;
    }

    if (!profileData) {
        return (
            <div className="text-center py-10">
                <h1 className="text-2xl font-bold">Usuario no encontrado</h1>
                <p className="text-muted-foreground">No se pudo encontrar el perfil de este usuario.</p>
                <Button asChild variant="link" className="mt-4">
                    <Link href="/dashboard/marketplace">Volver al Marketplace</Link>
                </Button>
            </div>
        )
    }
    
    const countryCode = getCountryCode(profileData.country);

    return (
        <div className="space-y-8">
             <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
            </Button>
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
                                 <p className="text-sm text-muted-foreground">Este usuario no ha añadido enlaces sociales.</p>
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
        </div>
    );
}

