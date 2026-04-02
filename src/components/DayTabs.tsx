import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DAYS_OF_WEEK } from '@/lib/constants';

interface DayTabsProps {
  value: string;
  onChange: (day: string) => void;
}

export function DayTabs({ value, onChange }: DayTabsProps) {
  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="w-full overflow-x-auto flex justify-start gap-0">
        {DAYS_OF_WEEK.map(day => (
          <TabsTrigger key={day} value={day} className="flex-shrink-0 text-xs sm:text-sm px-2 sm:px-3">
            <span className="sm:hidden">{day.slice(0, 3)}</span>
            <span className="hidden sm:inline">{day}</span>
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
