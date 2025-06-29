
"use client";

import Image from "next/image";
import type { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, ShieldCheck, Globe, Briefcase, Target, Search } from "lucide-react";

export interface Team {
  id: string;
  name: string;
  logoUrl: string;
  bannerUrl: string;
  bio?: string;
  ownerId: string;
  memberIds: string[];
  minRank: string;
  maxRank: string;
  country: string;
  isRecruiting?: boolean;
  seekingCoach?: boolean;
  seekingRoles?: string[];
  videoUrl?: string;
  createdAt: Timestamp;
}

const countryNameToCode: { [key: string]: string } = {
    "Albania": "AL", "Andorra": "AD", "Austria": "AT", "Belarus": "BY", "Belgium": "BE", "Bosnia and Herzegovina": "BA", "Bulgaria": "BG", "Croatia": "HR", "Cyprus": "CY", "Czech Republic": "CZ", "Denmark": "DK", "Estonia": "EE", "Finland": "FI", "France": "FR", "Germany": "DE", "Greece": "GR", "Hungary": "HU", "Iceland": "IS", "Ireland": "IE", "Italy": "IT", "Latvia": "LV", "Liechtenstein": "LI", "Lithuania": "LT", "Luxembourg": "LU", "Malta": "MT", "Moldova": "MD", "Monaco": "MC", "Montenegro": "ME", "Netherlands": "NL", "North Macedonia": "MK", "Norway": "NO", "Poland": "PL", "Portugal": "PT", "Romania": "RO", "Russia": "RU", "San Marino": "SM", "Serbia": "RS", "Slovakia": "SK", "Slovenia": "SI", "Spain": "ES", "Sweden": "SE", "Switzerland": "CH", "Ukraine": "UA", "United Kingdom": "GB", "Vatican City": "VA",
    "Bahrain": "BH", "Egypt": "EG", "Iran": "IR", "Iraq": "IQ", "Israel": "IL", "Jordan": "JO", "Kuwait": "KW", "Lebanon": "LB", "Oman": "OM", "Palestine": "PS", "Qatar": "QA", "Saudi Arabia": "SA", "Syria": "SY", "Turkey": "TR", "United Arab Emirates": "AE", "Yemen": "YE",
    "Algeria": "DZ", "Angola": "AO", "Benin": "BJ", "Botswana": "BW", "Burkina Faso": "BF", "Burundi": "BI", "Cameroon": "CM", "Cape Verde": "CV", "Central African Republic": "CF", "Chad": "TD", "Comoros": "KM", "Congo, Democratic Republic of the": "CD", "Congo, Republic of the": "CG", "Cote d'Ivoire": "CI", "Djibouti": "DJ", "Equatorial Guinea": "GQ", "Eritrea": "ER", "Eswatini": "SZ", "Ethiopia": "ET", "Gabon": "GA", "Gambia": "GM", "Ghana": "GH", "Guinea": "GN", "Guinea-Bissau": "GW", "Kenya": "KE", "Lesotho": "LS", "Liberia": "LR", "Libya": "LY", "Madagascar": "MG", "Malawi": "MW", "Mali": "ML", "Mauritania": "MR", "Mauritius": "MU", "Morocco": "MA", "Mozambique": "MZ", "Namibia": "NA", "Niger": "NE", "Nigeria": "NG", "Rwanda": "RW", "Sao Tome and Principe": "ST", "Senegal": "SN", "Seychelles": "SC", "Sierra Leone": "SL", "Somalia": "SO", "South Africa": "ZA", "South Sudan": "SS", "Sudan": "SD", "Tanzania": "TZ", "Togo": "TG", "Tunisia": "TN", "Uganda": "UG", "Zambia": "ZM", "Zimbabwe": "ZW",
};

export function getCountryCode(countryName?: string): string | null {
  if (!countryName) return null;
  return countryNameToCode[countryName] || null;
}

export function TeamCard({ team }: { team: Team }) {
    const countryCode = getCountryCode(team.country);
    return (
        <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg hover:-translate-y-1 cursor-pointer h-full">
            <div className="relative h-36 w-full">
            <Image
                src={team.bannerUrl || 'https://placehold.co/400x150.png'}
                alt={`${team.name} banner`}
                fill
                className="w-full h-full object-cover"
                data-ai-hint="team banner"
            />
            <div className="absolute -bottom-8 left-4">
                <Avatar className="h-16 w-16 border-4 border-card bg-card">
                <AvatarImage src={team.logoUrl || 'https://placehold.co/128x128.png'} alt={`${team.name} logo`} data-ai-hint="team logo" />
                <AvatarFallback>{team.name.substring(0, 2)}</AvatarFallback>
                </Avatar>
            </div>
            {team.isRecruiting && <Badge className="absolute top-2 right-2" variant="default"><Search className="mr-1 h-3 w-3" /> Reclutando</Badge>}
            </div>
            <CardHeader className="pt-12">
            <CardTitle className="font-headline text-xl truncate">{team.name}</CardTitle>
            <CardDescription className="line-clamp-2 h-10">{team.bio || 'Este equipo aún no tiene una biografía.'}</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow space-y-2">
                <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Rango: {team.minRank} - {team.maxRank}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span>{team.memberIds.length}/5 Miembros</span>
                </div>
                {team.country && (
                    <div className="flex items-center gap-2 text-sm">
                        {countryCode ? (
                            <Image 
                                src={`https://flagsapi.com/${countryCode}/flat/16.png`} 
                                alt={team.country}
                                width={16}
                                height={16}
                                className="rounded-sm" 
                            />
                        ) : (
                            <Globe className="h-4 w-4 text-primary" />
                        )}
                        <span>{team.country}</span>
                    </div>
                )}
                {team.seekingCoach && (
                    <Badge variant="secondary"><Briefcase className="mr-1 h-3 w-3" /> Buscando Coach</Badge>
                )}
                {team.seekingRoles && team.seekingRoles.length > 0 && (
                    <div className="flex items-center gap-2 text-sm pt-1">
                        <Target className="h-4 w-4 text-primary shrink-0" />
                        <div className="flex flex-wrap gap-1">
                          {team.seekingRoles.map(role => <Badge key={role} variant="outline">{role}</Badge>)}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

    