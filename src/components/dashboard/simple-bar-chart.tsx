"use client";

interface DataPoint {
  label: string;
  value: number;
  target?: number;
}

interface SimpleBarChartProps {
  data: DataPoint[];
  height?: number;
}

export function SimpleBarChart({ data, height = 200 }: SimpleBarChartProps) {
  const maxValue = Math.max(...data.map((d) => Math.max(d.value, d.target || 0)), 1);
  const barAreaHeight = height - 50; // Reserve space for labels

  return (
    <div className="w-full" style={{ height }}>
      {/* Bar area */}
      <div className="flex items-end justify-around gap-4" style={{ height: barAreaHeight }}>
        {data.map((item, index) => {
          const valueHeight = (item.value / maxValue) * barAreaHeight;
          const targetHeight = item.target ? (item.target / maxValue) * barAreaHeight : 0;

          return (
            <div key={index} className="flex items-end justify-center gap-1">
              {/* Target bar */}
              {item.target !== undefined && item.target > 0 && (
                <div
                  className="w-6 bg-ink/15 transition-all duration-500"
                  style={{ height: Math.max(targetHeight, 4) }}
                />
              )}
              {/* Value bar */}
              <div
                className="w-6 bg-accent transition-all duration-500"
                style={{ height: Math.max(valueHeight, 4) }}
              />
            </div>
          );
        })}
      </div>

      {/* Labels area */}
      <div className="flex justify-around gap-4 mt-2 border-t border-ink/10 pt-2">
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center">
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">
              {item.value}
            </span>
            <span className="label-tech">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
