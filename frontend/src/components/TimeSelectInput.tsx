/** 시·분 드롭다운 선택 컴포넌트 (24시간 형식, 오전/오후 없음) */
interface TimeSelectInputProps {
  value: string; // "HH:mm"
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export function TimeSelectInput({ value, onChange, label, className = '' }: TimeSelectInputProps) {
  const [h, m] = value ? value.split(':') : ['09', '00'];
  const hour = HOURS.includes(h) ? h : '09';
  const minute = /^\d{1,2}$/.test(m) ? String(parseInt(m, 10)).padStart(2, '0') : '00';
  const minuteVal = MINUTES.includes(minute) ? minute : '00';

  const handleChange = (newH: string, newM: string) => {
    onChange(`${newH}:${newM}`);
  };

  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>}
      <div className="flex items-center gap-2">
        <select
          value={hour}
          onChange={(e) => handleChange(e.target.value, minuteVal)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {HOURS.map((hh) => (
            <option key={hh} value={hh}>{hh}</option>
          ))}
        </select>
        <span className="text-gray-400 font-medium">:</span>
        <select
          value={minuteVal}
          onChange={(e) => handleChange(hour, e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {MINUTES.map((mm) => (
            <option key={mm} value={mm}>{mm}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
