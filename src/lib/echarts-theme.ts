export const ECHARTS_PALETTE = [
    '#4A90D9', // Blue
    '#4FD1D9', // Teal/Cyan
    '#F5C242', // Yellow/Gold
    '#F2846B', // Coral/Orange
    '#9B7ED9', // Purple
    '#E0567C', // Pink
    '#85C170'  // Light green
]

export const ECHARTS_TOOLBOX = {
    show: true,
    feature: {
        dataView: { 
            show: true, 
            readOnly: true,
            backgroundColor: 'transparent',
            buttonColor: '#4A90D9',
            buttonTextColor: '#fff',
            optionToContent: function (opt: any) {
                const isHierarchical = opt.series.some((s: any) => ['pie', 'treemap', 'sunburst', 'gauge'].includes(s.type));
                let table = '<div class="w-full h-full overflow-auto bg-card rounded-md border border-border p-4 shadow-sm">' +
                            '<table class="w-full text-sm text-left border-collapse">' +
                            '<thead class="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border"><tr>' +
                            '<th class="px-4 py-3 font-medium">Category</th>';
                
                opt.series.forEach((s: any) => {
                    table += `<th class="px-4 py-3 font-medium">${s.name || 'Value'}</th>`;
                });
                table += '</tr></thead><tbody class="divide-y divide-border">';
                
                if (isHierarchical) {
                    const mainSeries = opt.series.find((s: any) => ['pie', 'treemap', 'sunburst', 'gauge'].includes(s.type) && s.data && s.data.length > 0);
                    if (mainSeries && mainSeries.data) {
                        const total = mainSeries.data.reduce((sum: number, item: any) => {
                            const val = item.value !== undefined ? item.value : item;
                            return sum + (typeof val === 'number' ? val : 0);
                        }, 0);

                        mainSeries.data.forEach((item: any, i: number) => {
                            table += `<tr class="hover:bg-muted/30 transition-colors"><td class="px-4 py-3 font-medium text-foreground">${item.name || `Item ${i+1}`}</td>`;
                            opt.series.forEach((s: any) => {
                                let val = s.data && s.data[i] ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                if (typeof val === 'number' && total > 0) {
                                    const percent = Math.round((val / total) * 100);
                                    val = `${val} (${percent}%)`;
                                }
                                table += `<td class="px-4 py-3 text-muted-foreground">${val}</td>`;
                            });
                            table += '</tr>';
                        });
                    }
                } else {
                    const axisData = opt.xAxis && opt.xAxis[0] && opt.xAxis[0].data ? opt.xAxis[0].data : 
                                     (opt.yAxis && opt.yAxis[0] && opt.yAxis[0].data ? opt.yAxis[0].data : []);
                    const series = opt.series;
                    
                    if (axisData.length > 0) {
                        axisData.forEach((category: string, i: number) => {
                            table += `<tr class="hover:bg-muted/30 transition-colors"><td class="px-4 py-3 font-medium text-foreground">${category}</td>`;
                            series.forEach((s: any) => {
                                const val = s.data && s.data[i] !== undefined ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                table += `<td class="px-4 py-3 text-muted-foreground">${val}</td>`;
                            });
                            table += '</tr>';
                        });
                    } else if (series[0] && series[0].data) {
                        series[0].data.forEach((_: any, i: number) => {
                            table += `<tr class="hover:bg-muted/30 transition-colors"><td class="px-4 py-3 font-medium text-foreground">Item ${i+1}</td>`;
                            series.forEach((s: any) => {
                                const val = s.data && s.data[i] !== undefined ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                table += `<td class="px-4 py-3 text-muted-foreground">${val}</td>`;
                            });
                            table += '</tr>';
                        });
                    }
                }
                
                table += '</tbody></table></div>';
                return table;
            }
        },
        saveAsImage: { show: true }
    },
    iconStyle: { borderColor: '#999' }
}

export const ECHARTS_COMMON_OPTS = {
    color: ECHARTS_PALETTE,
    toolbox: ECHARTS_TOOLBOX
}
