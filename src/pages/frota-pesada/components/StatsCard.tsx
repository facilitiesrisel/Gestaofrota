
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color: 'green' | 'orange' | 'red' | 'blue';
  description?: string;
  fullWidth?: boolean;
}

const colorMap = {
  green: {
      text: 'text-emerald-600',
      iconBg: 'bg-emerald-50 text-emerald-600',
      border: 'border-emerald-100',
      bar: 'bg-emerald-500'
  },
  orange: {
      text: 'text-amber-600',
      iconBg: 'bg-amber-50 text-amber-600',
      border: 'border-amber-100',
      bar: 'bg-amber-500'
  },
  red: {
      text: 'text-rose-600',
      iconBg: 'bg-rose-50 text-rose-600',
      border: 'border-rose-100',
      bar: 'bg-rose-500'
  },
  blue: {
      text: 'text-blue-600',
      iconBg: 'bg-blue-50 text-blue-600',
      border: 'border-blue-100',
      bar: 'bg-blue-500'
  },
};

const StatsCard: React.FC<StatsCardProps> = ({ title, value, icon: Icon, trend, color, description }) => {
  const styles = colorMap[color];

  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 h-full flex flex-col justify-between group`}>
      
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
            <div className={`p-2.5 rounded-xl ${styles.iconBg} border ${styles.border}`}>
                <Icon size={20} />
            </div>
             {trend && (
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider`}>
                    {trend}
                </span>
            )}
        </div>

        <div>
            <h3 className={`text-3xl font-black text-slate-800 mb-1 tracking-tight`}>{value}</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">{title}</p>
        </div>
      </div>
      
      {/* Small bar */}
      <div className="mt-4 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full w-2/3 ${styles.bar} rounded-full opacity-80 group-hover:w-full transition-all duration-500`}></div>
      </div>
    </div>
  );
};

export default StatsCard;
