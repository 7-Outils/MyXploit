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
  const maxValue = Math.max(...data.map((d) => Math.max(d.value, d.target || 0)));

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-between gap-2 h-full">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <div className="w-full flex items-end justify-center gap-1 flex-1">
              {/* Target bar */}
              {item.target && (
                <div
                  className="w-3 bg-gray-200 rounded-t transition-all duration-500"
                  style={{ height: `${(item.target / maxValue) * 100}%` }}
                />
              )}
              {/* Value bar */}
              <div
                className="w-3 bg-gradient-to-t from-accent to-accent-light rounded-t transition-all duration-500"
                style={{ height: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-secondary">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
