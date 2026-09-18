/* eslint-disable */
"use client";
import { useRef, useEffect, useState } from "react";
import { select } from "d3-selection";
import { scaleBand, scaleLinear, scaleOrdinal } from "d3-scale";
import { max, quantile, ascending } from "d3-array";
import { axisBottom, axisLeft } from "d3-axis"; // D3 is a JavaScript library for data visualization: https://d3js.org/
import { csv } from "d3-fetch";

const DIETS = ["carnivore", "herbivore", "omnivore"] as const;
const DIET_COLORS = ["#f87171", "#4ade80", "#facc15"]; // carnivore red, herbivore green, omnivore yellow

// Ordinal scale mapping each diet to a consistent color
// https://github.com/d3/d3-scale#ordinal-scales
const color = scaleOrdinal<string, string>().domain(DIETS as unknown as string[]).range(DIET_COLORS);

interface BoxStat {
  diet: string;
  q1: number;
  median: number;
  q3: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
}

// Five-number summary + Tukey outliers (points beyond 1.5x the interquartile range)
function computeBox(diet: string, raw: number[]): BoxStat {
  const s = raw.slice().sort(ascending);
  const q1 = quantile(s, 0.25) ?? 0;
  const median = quantile(s, 0.5) ?? 0;
  const q3 = quantile(s, 0.75) ?? 0;
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  const inliers = s.filter((v) => v >= loFence && v <= hiFence); // contiguous, since s is sorted
  const outliers = s.filter((v) => v < loFence || v > hiFence);
  return {
    diet,
    q1,
    median,
    q3,
    whiskerLow: inliers[0] ?? q1,
    whiskerHigh: inliers[inliers.length - 1] ?? q3,
    outliers,
  };
}

export default function AnimalSpeedGraph() {
  const graphRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<BoxStat[]>([]);
  const [yMax, setYMax] = useState<number>(0);

  // Load CSV once, then compute a box-plot summary per diet
  useEffect(() => {
    csv("/sample_animals.csv")
      .then((rows) => {
        const parsed = rows
          .map((d) => ({ speed: Number(d.speed), diet: String(d.diet) }))
          .filter((d) => Number.isFinite(d.speed) && DIETS.includes(d.diet as (typeof DIETS)[number]));

        const boxes = DIETS.map((diet) =>
          computeBox(
            diet,
            parsed.filter((d) => d.diet === diet).map((d) => d.speed),
          ),
        );
        setStats(boxes);
        setYMax(max(parsed, (d) => d.speed) ?? 0);
      })
      .catch((err) => console.error("CSV load failed:", err));
  }, []);

  useEffect(() => {
    // Clear any previous SVG to avoid duplicates when React hot-reloads
    if (graphRef.current) graphRef.current.innerHTML = "";
    if (stats.length === 0) return;

    const containerWidth = graphRef.current?.clientWidth ?? 800;
    const width = Math.max(containerWidth, 600);
    const height = 500;
    const margin = { top: 40, right: 40, bottom: 60, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // https://github.com/d3/d3-selection
    const svg = select(graphRef.current!).append<SVGSVGElement>("svg").attr("width", width).attr("height", height);
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // https://github.com/d3/d3-scale#band-scales
    const x = scaleBand()
      .domain(stats.map((d) => d.diet))
      .range([0, innerWidth])
      .padding(0.4);

    // Shared vertical scale in km/h — covers the largest value including outliers
    // https://github.com/d3/d3-scale#linear-scales
    const y = scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

    const boxWidth = Math.min(x.bandwidth(), 80);

    stats.forEach((d) => {
      const center = (x(d.diet) ?? 0) + x.bandwidth() / 2;
      const left = center - boxWidth / 2;

      // Whisker: vertical line from low to high
      g.append("line")
        .attr("x1", center)
        .attr("x2", center)
        .attr("y1", y(d.whiskerLow))
        .attr("y2", y(d.whiskerHigh))
        .attr("stroke", "currentColor");

      // Whisker caps
      [d.whiskerLow, d.whiskerHigh].forEach((v) => {
        g.append("line")
          .attr("x1", center - boxWidth / 4)
          .attr("x2", center + boxWidth / 4)
          .attr("y1", y(v))
          .attr("y2", y(v))
          .attr("stroke", "currentColor");
      });

      // Box: Q1 to Q3
      g.append("rect")
        .attr("x", left)
        .attr("y", y(d.q3))
        .attr("width", boxWidth)
        .attr("height", y(d.q1) - y(d.q3))
        .attr("fill", color(d.diet))
        .attr("fill-opacity", 0.65)
        .attr("stroke", "currentColor");

      // Median line
      g.append("line")
        .attr("x1", left)
        .attr("x2", left + boxWidth)
        .attr("y1", y(d.median))
        .attr("y2", y(d.median))
        .attr("stroke", "currentColor")
        .attr("stroke-width", 2);

      // Outliers
      d.outliers.forEach((o) => {
        g.append("circle")
          .attr("cx", center)
          .attr("cy", y(o))
          .attr("r", 4)
          .attr("fill", color(d.diet))
          .attr("stroke", "currentColor");
      });
    });

    // Axes
    // https://github.com/d3/d3-axis
    g.append("g")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(axisBottom(x))
      .selectAll("text")
      .style("text-transform", "capitalize")
      .style("font-size", "13px");

    g.append("g").call(axisLeft(y));

    // Axis titles
    svg
      .append("text")
      .attr("x", margin.left + innerWidth / 2)
      .attr("y", height - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .text("Diet");

    svg
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + innerHeight / 2))
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "currentColor")
      .text("Speed (km/h)");
  }, [stats, yMax]);

  return (
    <div>
      {/* Legend: diet colors + a short note on box-plot anatomy */}
      <div className="mb-3 flex flex-wrap gap-6">
        {DIETS.map((diet) => (
          <div key={diet} className="flex items-center gap-2">
            <span className="inline-block h-3.5 w-3.5 rounded-sm" style={{ backgroundColor: color(diet) }} />
            <span className="capitalize">{diet}</span>
          </div>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Box = middle 50% (Q1–Q3), line = median, whiskers = range within 1.5×IQR, dots = outliers.
      </p>
      <div ref={graphRef} className="w-full" />
    </div>
  );
}