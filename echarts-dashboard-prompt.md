# Prompt: Build a CTF Analytics Dashboard with Apache ECharts

Build a multi-panel analytics dashboard using **Apache ECharts** (via `echarts` npm package, vanilla JS or `echarts-for-react`). Match the following style and chart specs exactly.

## Global Style
- Light gray page background (`#f5f5f5` or similar), white/very-light-gray card panels (`#fafafa`) with soft rounded corners (8px) and subtle box-shadow.
- Each panel has a bold title (16-18px, semi-bold, near-black) and a smaller gray subtitle/description line beneath it.
- Each panel includes small toolbox icons top-right using ECharts' built-in `toolbox` feature:
  ```js
  toolbox: {
    show: true,
    feature: {
      dataView: { show: true, readOnly: false },
      saveAsImage: { show: true }
    },
    iconStyle: { borderColor: '#999' }
  }
  ```
- Color palette: blue (`#4A90D9`), teal/cyan (`#4FD1D9`), yellow/gold (`#F5C242`), coral/orange (`#F2846B`), purple (`#9B7ED9`), pink (`#E0567C`), plus a light green. Use as the `color` array in each chart's global option.

## Panel-by-Panel Specs

### 1. Treemap panels ("Most Popular Challenges" / "Least Popular Challenges")
```js
series: [{
  type: 'treemap',
  roam: false,
  nodeClick: false,
  breadcrumb: { show: false },
  label: {
    show: true,
    formatter: '{b}',
    color: '#fff',
    fontSize: 12,
    overflow: 'truncate'
  },
  itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 },
  levels: [{ itemStyle: { borderWidth: 0 } }],
  data: [ /* name + value pairs, sorted by value descending */ ]
}]
```
Use the multi-color palette above per-cell (not a single-color gradient).

### 2. Donut charts with leader-line labels ("Challenges by Difficulty", "Category", "Success Rate")
```js
series: [{
  type: 'pie',
  radius: ['45%', '70%'],
  avoidLabelOverlap: true,
  label: {
    show: true,
    formatter: '{b} ({d}%)',
    color: '#333',
    fontSize: 12
  },
  labelLine: {
    show: true,
    length: 15,
    length2: 10,
    smooth: true
  },
  data: [ /* {name, value} */ ]
}]
```
This produces the bent leader-line-to-label look seen in the reference image.

### 3. Multi-series line chart ("Participant Score Timeline")
- One line per contestant, thin lines (`lineWidth: 1.5`), distinct colors, no area fill.
- Legend at top, small font, scrollable if many entries (`type: 'scroll'`).
- `dataZoom` slider at the bottom (both `inside` and `slider` type) for time-range scrubbing:
```js
dataZoom: [
  { type: 'inside', start: 0, end: 100 },
  { type: 'slider', start: 0, end: 100, height: 16 }
]
```
- X-axis is time-based; Y-axis is numeric score with comma formatting.

### 4. Horizontal bar "race" chart ("CTF Race Chart")
```js
series: [{
  type: 'bar',
  data: [ /* one bar per contestant, each a different color */ ],
  itemStyle: {
    color: (params) => paletteColors[params.dataIndex % paletteColors.length]
  }
}],
xAxis: { type: 'value' },
yAxis: { type: 'category', data: [ /* contestant names */ ] }
```
- Add a large, semi-transparent gray watermark text (e.g., "13 hours") layered behind the bars using the `graphic` API:
```js
graphic: [{
  type: 'text',
  left: 'center',
  top: 'middle',
  style: {
    text: '13 hours',
    fontSize: 60,
    fontFamily: 'serif',
    fill: 'rgba(0,0,0,0.08)'
  },
  z: 0
}]
```

### 5. Timeline / area-ish line chart ("Submission Timeline")
- Single-series jagged line chart (submissions per time bucket), thin blue line, no smoothing, light fill under the curve (`areaStyle: { opacity: 0.1 }`).
- Same `dataZoom` slider pattern as the score timeline.

### 6. Histogram / distribution chart ("Participant Score Distribution")
- Bar chart with many thin adjacent bars (near-zero `barGap`), single blue color, no axis labels needed beyond ticks — compact/small panel.

### 7. Scatter chart ("Performance Grid")
```js
series: [{
  type: 'scatter',
  symbolSize: 10,
  itemStyle: { color: '#333' },
  data: [ /* [x, y] pairs: e.g. difficulty vs score */ ]
}]
```

### 8. KPI stat cards (bottom row: "298 Contestants", "5084 Submissions", "35 Challenges")
Not ECharts — build these as plain HTML/CSS cards: large bold number, small gray label beneath, with 2-3 smaller sub-stat rows (e.g. "Teams: 0", "Individuals: 298").

## Layout
Use CSS Grid to arrange panels:
- Row 1: 2 treemaps (narrow) + 1 wide line chart (score timeline)
- Row 2: 2 donut charts (narrow) + 1 wide bar chart (race chart)
- Row 3: 3 equal donut charts (difficulty/category/success rate breakdown) aligned under the race chart
- Row 4: full-width timeline chart
- Row 5: distribution histogram + KPI cards + scatter chart

Each grid cell = one white card with padding ~16-20px.

## Tech notes
- Use `echarts.init(domNode)` per panel, call `.resize()` on window resize.
- If using React, wrap with `echarts-for-react` or manage refs manually.
- Keep chart `option` objects in separate config files/functions per panel for maintainability.
