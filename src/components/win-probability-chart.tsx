"use client"

import * as React from "react"
import { Label, Pie, PieChart, RadialBar, RadialBarChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

interface WinProbabilityChartProps {
  probability: number;
}

export function WinProbabilityChart({ probability }: WinProbabilityChartProps) {
  const chartData = [{ name: "win", value: probability * 100, fill: "hsl(var(--primary))" }]
  const percentage = Math.round(probability * 100)

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="items-center pb-0">
        <CardTitle className="font-headline">Win Probability</CardTitle>
        <CardDescription>Estimated chance of success</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={{}}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={-270}
            innerRadius="70%"
            outerRadius="100%"
            barSize={20}
            cy="50%"
          >
            <RadialBar
              background
              dataKey="value"
              cornerRadius={10}
            />
            <text
                x="50%"
                y="50%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-4xl font-bold"
              >
                {`${percentage}%`}
              </text>
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col gap-2 text-sm">
        <div className="flex items-center gap-2 font-medium leading-none">
          This composition has a strong potential for success.
        </div>
        <div className="leading-none text-muted-foreground">
          Based on current meta and agent synergies.
        </div>
      </CardFooter>
    </Card>
  )
}
