"use client"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import { useMemo, useState, useEffect } from "react"
// Dynamically import ApexCharts to avoid SSR issues
const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false })

type ChartType = "line" | "area" | "bar" | "pie" | "donut" | "radialBar" | "scatter" | "bubble" | "heatmap" | "treemap" | "boxPlot" | "candlestick" | "radar" | "polarArea" | "rangeBar" | "rangeArea"

interface ApexChartProps {
    type: ChartType
    series: any
    options?: any
    height?: number | string
    width?: number | string
    className?: string
}

export function ApexChart({ type, series, options = {}, height = 300, width = "100%", className }: ApexChartProps) {
    const { resolvedTheme } = useTheme()
    const isDark = resolvedTheme === "dark"

    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    const mergedOptions = useMemo<any>(() => {
        const foregroundColor = isDark ? "#fafafa" : "#09090b"
        const mutedColor = isDark ? "rgba(250, 250, 250, 0.15)" : "rgba(9, 9, 11, 0.08)"
        const bgColor = isDark ? "#09090b" : "#ffffff"

        return {
            chart: {
                background: "transparent",
                foreColor: isDark ? "#a1a1aa" : "#71717a",
                toolbar: { show: false },
                fontFamily: "inherit",
                ...options.chart,
            },
            theme: {
                mode: isDark ? "dark" : "light",
                ...options.theme,
            },
            grid: {
                borderColor: mutedColor,
                strokeDashArray: 4,
                ...options.grid,
            },
            xaxis: {
                axisBorder: { color: mutedColor },
                axisTicks: { color: mutedColor },
                labels: {
                    style: { colors: isDark ? "#a1a1aa" : "#71717a", fontSize: "12px" },
                },
                ...options.xaxis,
            },
            yaxis: {
                labels: {
                    style: { colors: isDark ? "#a1a1aa" : "#71717a", fontSize: "12px" },
                },
                ...((options.yaxis && !Array.isArray(options.yaxis)) ? options.yaxis : {}),
            },
            tooltip: {
                theme: isDark ? "dark" : "light",
                style: { fontSize: "12px" },
                ...options.tooltip,
            },
            legend: {
                labels: { colors: isDark ? "#a1a1aa" : "#71717a" },
                fontSize: "12px",
                ...options.legend,
            },
            dataLabels: {
                enabled: false,
                ...options.dataLabels,
            },
            stroke: {
                curve: "smooth",
                width: 2,
                ...options.stroke,
            },
            fill: {
                ...options.fill,
            },
            plotOptions: {
                ...options.plotOptions,
            },
            colors: options.colors || [
                "#38bdf8", // Sky Blue
                "#fcd34d", // Yellow
                "#f472b6", // Pink
                "#c084fc", // Purple
                "#fb923c", // Orange
                "#4ade80", // Green
                "#60a5fa", // Blue
                "#a78bfa", // Violet
                "#fb7185", // Rose
                "#34d399", // Emerald
                "#fbbf24", // Amber
                "#818cf8", // Indigo
                "#2dd4bf", // Teal
            ],
            ...(options.labels !== undefined && { labels: options.labels }),
            ...(Array.isArray(options.responsive) && { responsive: options.responsive }),
            states: {
                hover: { filter: { type: "darken", value: 0.9 } },
                active: { filter: { type: "darken", value: 0.8 } },
                ...options.states,
            },
        }
    }, [isDark, options])

    if (!mounted) return <div className={className} style={{ height, width }} />

    return (
        <div className={className}>
            <ReactApexChart
                type={type}
                series={series}
                options={mergedOptions}
                height={height}
                width={width}
            />
        </div>
    )
}
