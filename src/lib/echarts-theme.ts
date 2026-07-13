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
            backgroundColor: 'var(--card)',
            buttonColor: '#4F46E5',
            buttonTextColor: '#ffffff',
            optionToContent: function (opt: any) {
                const isHierarchical = opt.series.some((s: any) => ['pie', 'treemap', 'sunburst', 'gauge'].includes(s.type));
                let table = '<div style="width:100%; height:100%; overflow:auto; background-color: var(--card); border: 1px solid var(--border); border-radius: 0.5rem; padding: 1rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">' +
                            '<table style="width:100%; text-align:left; border-collapse:collapse; font-size:0.875rem; color:var(--foreground);">' +
                            '<thead style="background-color: #4F46E5; color: #ffffff; font-size: 0.75rem; text-transform: uppercase;"><tr>' +
                            '<th style="padding: 0.75rem 1rem; font-weight: 600; border-top-left-radius: 0.375rem;">Category</th>';
                
                opt.series.forEach((s: any, i: number) => {
                    const radiusStyle = i === opt.series.length - 1 ? 'border-top-right-radius: 0.375rem;' : '';
                    table += `<th style="padding: 0.75rem 1rem; font-weight: 600; ${radiusStyle}">${s.name || 'Value'}</th>`;
                });
                table += '</tr></thead><tbody>';
                
                if (isHierarchical) {
                    const mainSeries = opt.series.find((s: any) => ['pie', 'treemap', 'sunburst', 'gauge'].includes(s.type) && s.data && s.data.length > 0);
                    if (mainSeries && mainSeries.data) {
                        const total = mainSeries.data.reduce((sum: number, item: any) => {
                            const val = item.value !== undefined ? item.value : item;
                            return sum + (typeof val === 'number' ? val : 0);
                        }, 0);

                        mainSeries.data.forEach((item: any, i: number) => {
                            const borderStyle = i !== mainSeries.data.length - 1 ? 'border-bottom: 1px solid var(--border);' : '';
                            table += `<tr style="${borderStyle}"><td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--foreground);">${item.name || `Item ${i+1}`}</td>`;
                            opt.series.forEach((s: any) => {
                                let val = s.data && s.data[i] ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                if (typeof val === 'number' && total > 0) {
                                    const percent = Math.round((val / total) * 100);
                                    val = `${val} <span style="color:var(--muted-foreground); font-size:0.75rem;">(${percent}%)</span>`;
                                }
                                table += `<td style="padding: 0.75rem 1rem; color: var(--muted-foreground);">${val}</td>`;
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
                            const borderStyle = i !== axisData.length - 1 ? 'border-bottom: 1px solid var(--border);' : '';
                            table += `<tr style="${borderStyle}"><td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--foreground);">${category}</td>`;
                            series.forEach((s: any) => {
                                const val = s.data && s.data[i] !== undefined ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                table += `<td style="padding: 0.75rem 1rem; color: var(--muted-foreground);">${val}</td>`;
                            });
                            table += '</tr>';
                        });
                    } else if (series[0] && series[0].data) {
                        series[0].data.forEach((_: any, i: number) => {
                            const borderStyle = i !== series[0].data.length - 1 ? 'border-bottom: 1px solid var(--border);' : '';
                            table += `<tr style="${borderStyle}"><td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--foreground);">Item ${i+1}</td>`;
                            series.forEach((s: any) => {
                                const val = s.data && s.data[i] !== undefined ? (s.data[i].value !== undefined ? s.data[i].value : s.data[i]) : '-';
                                table += `<td style="padding: 0.75rem 1rem; color: var(--muted-foreground);">${val}</td>`;
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
